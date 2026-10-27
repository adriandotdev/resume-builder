import { STANDARD_HEADINGS } from "./ats";
import { sectionPlainText } from "./plaintext";
import type { ResumeDoc, Section } from "./schema";

/**
 * ATS parse simulator. Reads the real text layer (the same lines `toPlainText` emits, section by
 * section) the way a naive parser would, and reports what it extracted and where it went wrong.
 * Rule-based, local, and not a score. The model is used only to say *which* field to fix.
 */

export interface ParsedField { label: string; value: string }
export interface ParsedEntry { itemId: string | null; fields: ParsedField[] }
export interface ParsedSection { sectionId: string; heading: string; recognized: boolean; type: Section["type"]; entries: ParsedEntry[] }
export interface ParsedContact { name: string; headline: string; email: string; phone: string; location: string; links: string[] }

export interface ParseFinding {
  id: string;
  level: "warn" | "fail";
  message: string;
  sectionId: string;
  sectionTitle: string;
  itemId?: string;
  /** Visible label of the input to fix, for the jump button. */
  fieldLabel: string;
  itemLabel: string;
}
export interface ParseResult { contact: ParsedContact | null; sections: ParsedSection[]; findings: ParseFinding[] }

const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \\d{4}";
const DATE = `(?:${MONTH}|\\d{2}/\\d{4}|\\d{4})`;
const RANGE = new RegExp(`^(${DATE})(?:\\s[–-]\\s(${DATE}|Present))?$`);
const EMAIL = /[^\s@|]+@[^\s@|]+\.[^\s@|]+/;
const PHONE = /^\+?[\d(][\d\s().-]{6,}\d$/;
const LINK = /^(?:https?:\/\/|www\.)|\.[a-z]{2,}(?:\/|$)/i;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Sortable month index for a date as printed, or null when it is "Present". */
function dateKey(d: string): number | null {
  if (d === "Present") return null;
  const m = new RegExp(`^(${MONTHS.join("|")}) (\\d{4})$`).exec(d);
  if (m) return Number(m[2]) * 12 + MONTHS.indexOf(m[1]);
  const n = /^(\d{2})\/(\d{4})$/.exec(d);
  if (n) return Number(n[2]) * 12 + Number(n[1]) - 1;
  return Number(d) * 12;
}

function parseContact(text: string, typed: { email: string; phone: string }): ParsedContact {
  const [name = "", ...rest] = text.split("\n");
  const c: ParsedContact = { name, headline: "", email: "", phone: "", location: "", links: [] };
  // Email and phone are matched on what was typed in their own inputs: with no name or headline the
  // text layer shifts up a line, which made the email line read as the name and the phone as the location.
  const em = EMAIL.exec(typed.email.trim());
  if (em) c.email = em[0];
  if (PHONE.test(typed.phone.trim())) c.phone = typed.phone.trim();
  for (const line of rest) {
    for (const part of line.split(" | ").map((x) => x.trim()).filter(Boolean)) {
      if (part === typed.email.trim() || part === typed.phone.trim()) continue;
      if (LINK.test(part)) c.links.push(part);
      else if (line.includes(" | ") && !c.location) c.location = part;
      else if (!c.headline) c.headline = part;
    }
  }
  return c;
}

export function runParseSim(doc: ResumeDoc): ParseResult {
  const f = doc.style.dateFormat;
  const visible = doc.sections.filter((s) => s.visible);
  const findings: ParseFinding[] = [];
  const sections: ParsedSection[] = [];
  let contact: ParsedContact | null = null;

  const flag = (s: Section, level: ParseFinding["level"], key: string, message: string, fieldLabel: string, itemId?: string, itemLabel = s.title) =>
    findings.push({ id: `${s.id}:${itemId ?? "-"}:${key}`, level, message, sectionId: s.id, sectionTitle: s.title, itemId, fieldLabel, itemLabel });

  // A parser takes the first line of the document as the name.
  const first = visible[0];
  const contactSection = visible.find((s) => s.type === "contact");
  if (contactSection && contactSection.type === "contact") {
    const c = contactSection.content;
    contact = parseContact(sectionPlainText(contactSection, f), c);
    if (first && first.id !== contactSection.id) {
      const lead = sectionPlainText(first, f).split("\n")[0];
      flag(contactSection, "fail", "not-first", `Contact is not the first section, so a parser reads “${lead}” as your name. Move Contact to the top.`, "Full name");
    } else if (!c.fullName.trim()) {
      flag(contactSection, "fail", "name", "No name found. A parser takes the first line as your name, so add your full name.", "Full name");
    }
    if (!contact.email) flag(contactSection, "fail", "email", "No email found, so a recruiter's system has nowhere to reach you.", "Email");
    else if (c.email.trim() && !EMAIL.test(c.email)) flag(contactSection, "fail", "email-bad", `“${c.email}” does not read as an email address. Check it for typos.`, "Email");
    if (!contact.phone) flag(contactSection, "warn", "phone", c.phone.trim() ? `“${c.phone}” does not read as a phone number. Use digits, with a country code if you have one.` : "No phone number found. Add one so a recruiter can call you.", "Phone");
  } else if (visible.length > 0) {
    findings.push({ id: "no-contact", level: "fail", message: "No contact section, so a parser has no name or email to file the resume under.", sectionId: "", sectionTitle: "Contact", fieldLabel: "", itemLabel: "Contact" });
  }

  for (const s of visible) {
    if (s.type === "contact") continue;
    const lines = sectionPlainText(s, f).split("\n");
    const heading = lines.shift() ?? "";
    const recognized = STANDARD_HEADINGS.has(s.title.trim().toLowerCase());
    if (!recognized) flag(s, "warn", "heading", `“${s.title}” is not a heading parsers recognize, so its content may be filed under the wrong section or dropped. Standard names work best.`, "Section heading");
    const ps: ParsedSection = { sectionId: s.id, heading, recognized, type: s.type, entries: [] };
    sections.push(ps);

    if (s.type === "summary") {
      const text = lines.join(" ").trim();
      if (text) ps.entries.push({ itemId: null, fields: [{ label: "Summary", value: text }] });
      continue;
    }
    if (s.type === "custom") {
      for (const [n, l] of lines.entries()) ps.entries.push({ itemId: s.content.items[n]?.id ?? null, fields: [{ label: "Line", value: l.replace(/^- /, "") }] });
      continue;
    }
    if (s.type === "skills") {
      const groups = s.content.items.filter((i) => i.label || i.skills);
      for (const [n, l] of lines.entries()) {
        const item = groups[n];
        const i = l.indexOf(": ");
        const label = item?.label ? l.slice(0, i) : "";
        const terms = (item?.label ? l.slice(i + 2) : l).split(",").map((t) => t.trim()).filter(Boolean);
        ps.entries.push({ itemId: item?.id ?? null, fields: [{ label: "Group label", value: label }, { label: `Skills (${terms.length})`, value: terms.join(" · ") }] });
        if (item && terms.length === 1 && /[;|•·]|\s\/\s|\s{2,}|\S+(?:\s\S+){4,}/.test(terms[0]))
          flag(s, "warn", "separators", `“${terms[0].slice(0, 60)}” is read as one skill. Separate skills with commas so each is matched on its own.`, "Skills (comma separated)", item.id, item.label || "Skill group");
      }
      continue;
    }
    if (s.type === "certifications" || s.type === "languages") {
      const items = s.content.items as { id: string }[];
      const kept = items.filter((i) => Object.values(i).some((v) => typeof v === "string" && v !== "" && v !== i.id));
      lines.forEach((l, n) => ps.entries.push({ itemId: kept[n]?.id ?? null, fields: [{ label: s.type === "certifications" ? "Certification" : "Language", value: l }] }));
      continue;
    }

    // experience, education, projects: a header line, then an optional date line, then bullets
    // `second` is what was typed in the employer/school input: when it is empty, whatever sits second on the line is not it.
    type It = { id: string; header: string; second: string; start: string; end: string; current: boolean; label: string };
    const items: It[] = s.type === "experience"
      ? s.content.items.map((i) => ({ id: i.id, header: [i.role, i.org, i.location].filter(Boolean).join(", "), second: i.org, start: i.start, end: i.end, current: i.current, label: i.role || i.org || "Experience" }))
      : s.type === "education"
        ? s.content.items.map((i) => ({ id: i.id, header: [i.degree, i.school, i.location].filter(Boolean).join(", "), second: i.school, start: i.start, end: i.end, current: false, label: i.degree || i.school || "Education" }))
        : s.content.items.map((i) => ({ id: i.id, header: [i.name, i.link].filter(Boolean).join(", "), second: i.link, start: i.start, end: i.end, current: false, label: i.name || "Project" }));
    const [a, b, c] = s.type === "experience" ? ["Job title", "Employer", "Location"] : s.type === "education" ? ["Degree", "School", "Location"] : ["Name", "Link", ""];
    let cursor = 0;
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n];
      if (line.startsWith("- ")) {
        // Bullets before any header: they get attached to whatever came before.
        if (ps.entries.length === 0) {
          const orphan = items.find((i) => !i.header);
          if (orphan) flag(s, "fail", "orphan", `Achievements without a ${a.toLowerCase()} or ${b.toLowerCase()} have nothing to attach to, so a parser may drop them or merge them into another entry.`, a, orphan.id, orphan.label);
        }
        continue;
      }
      const hit = items.findIndex((i, k) => k >= cursor && i.header === line);
      const item = hit >= 0 ? items[hit] : undefined;
      if (hit >= 0) cursor = hit + 1;
      const parts = line.split(", ");
      const fields: ParsedField[] = s.type === "projects"
        ? [{ label: a, value: parts[0] ?? "" }, { label: b, value: parts.slice(1).join(", ") }]
        : [{ label: a, value: parts[0] ?? "" }, { label: b, value: parts[1] ?? "" }, { label: c, value: parts.slice(2).join(", ") }];
      const range = RANGE.exec(lines[n + 1] ?? "");
      if (range) {
        n++;
        fields.push({ label: "Start", value: range[1] }, { label: "End", value: range[2] ?? "" });
        const sk = dateKey(range[1]);
        const ek = range[2] ? dateKey(range[2]) : null;
        // formatDate prints a month outside 01-12 as the bare year, so the text layer never shows the mistake.
        const badMonth = item && s.type !== "projects" ? [item.start, item.end].find((v) => /^\d{4}-(?!(0[1-9]|1[0-2])$)\d{2}$/.test(v.trim())) : undefined;
        if (item && badMonth) flag(s, "warn", "month", `“${badMonth.trim()}” is not a month, so only the year is printed. Use a month from 01 to 12.`, item.start.trim() === badMonth.trim() ? "Start (YYYY-MM)" : "End (YYYY-MM)", item.id, item.label);
        if (item && sk !== null && ek !== null && ek < sk) flag(s, "fail", "range", `Ends (${range[2]}) before it starts (${range[1]}), so a parser may drop the dates or compute a negative length of service.`, "Start (YYYY-MM)", item.id, item.label);
        if (item && s.type === "experience" && !range[2])
          flag(s, "warn", "open-end", `${range[1]} has no end date, so a parser cannot tell if you still work here. Add an end date or tick “I currently work here”.`, "End (YYYY-MM)", item.id, item.label);
      } else {
        fields.push({ label: "Start", value: "" }, { label: "End", value: "" });
        if (item && s.type !== "projects") {
          const raw = [item.start, item.end].find((v) => v.trim() && !/^\d{4}(-(0[1-9]|1[0-2]))?$/.test(v.trim()));
          if (raw) flag(s, "fail", "date", `“${raw}” is not a date format parsers read, so the dates for this entry are lost. Use YYYY-MM.`, item.start.trim() === raw ? "Start (YYYY-MM)" : "End (YYYY-MM)", item.id, item.label);
          else flag(s, "warn", "no-date", "No dates found, so a parser cannot place this entry in your timeline. Add a start date.", "Start (YYYY-MM)", item.id, item.label);
        }
      }
      if (item && s.type !== "projects") {
        const field = b === "Employer" ? "Employer" : "School";
        if (!parts[1]) flag(s, "warn", "pair", `Only “${parts[0]}” was found on the first line, so the parser reads it as the ${a.toLowerCase()} and leaves ${b.toLowerCase()} empty. Fill in both.`, field, item.id, item.label);
        else if (!item.second.trim()) flag(s, "warn", "pair", `No ${b.toLowerCase()} is filled in, so the parser reads “${parts[1].trim()}” as the ${b.toLowerCase()} instead. Fill in the ${b.toLowerCase()}.`, field, item.id, item.label);
      }
      ps.entries.push({ itemId: item?.id ?? null, fields });
    }
  }

  return { contact, sections, findings };
}
