import { PAGE_SIZES, MARGINS, type ResumeDoc, type Section } from "./schema";
import { toPlainText } from "./plaintext";

export type AtsLevel = "pass" | "warn" | "fail";
export interface AtsCheck { id: string; level: AtsLevel; message: string }

const STANDARD_HEADINGS = new Set([
  "contact", "contact information", "summary", "professional summary", "profile", "objective",
  "experience", "work experience", "professional experience", "employment history", "work history",
  "education", "skills", "technical skills", "core skills", "projects", "certifications", "licenses",
  "certifications and licenses", "languages", "awards", "publications", "volunteering", "volunteer experience",
  "interests", "additional information", "references",
]);

export const MAX_BULLET_CHARS = 200;
export const MAX_SUMMARY_CHARS = 600;
const MAX_BULLETS_PER_ITEM = 8;
const TYPED_BULLET = /^\s*[•●◦▪‣⁃\-*>→]\s/;
const DATE_OK = /^(\d{4}(-\d{2})?)?$/;

function bulletsOf(s: Section): string[][] {
  switch (s.type) {
    case "experience": return s.content.items.map((i) => i.bullets);
    case "projects": return s.content.items.map((i) => i.bullets);
    case "education": return s.content.items.map((i) => i.details);
    case "custom": return [s.content.items.map((i) => i.text)];
    default: return [];
  }
}
function isEmpty(s: Section): boolean {
  switch (s.type) {
    case "contact": return !s.content.fullName && !s.content.email && !s.content.phone;
    case "summary": return !s.content.text.trim();
    default: return s.content.items.length === 0;
  }
}

/** Rough characters-per-page capacity used for the one-page hint. */
export function estimatePages(doc: ResumeDoc): number {
  const { fontSize, lineSpacing, margins, pageSize } = doc.style;
  const page = PAGE_SIZES[pageSize];
  const m = MARGINS[margins];
  const mmPerLine = fontSize * 0.3528 * lineSpacing;
  const lines = (page.h - 2 * m) / mmPerLine;
  const charsPerLine = (page.w - 2 * m) / (fontSize * 0.3528 * 0.5);
  const text = toPlainText(doc);
  const used = text.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / charsPerLine)), 0);
  return Math.max(1, used / lines);
}

export function runAtsChecks(doc: ResumeDoc): AtsCheck[] {
  const checks: AtsCheck[] = [];
  const add = (id: string, level: AtsLevel, message: string) => checks.push({ id, level, message });
  const visible = doc.sections.filter((s) => s.visible);

  // Contact
  const contact = visible.find((s) => s.type === "contact");
  if (!contact || contact.type !== "contact") {
    add("contact-missing", "fail", "No visible Contact section: recruiters and parsers need your name and email in the page body.");
  } else {
    const c = contact.content;
    const missing = [["name", c.fullName], ["email", c.email], ["phone", c.phone], ["location", c.location]].filter(([, v]) => !v.trim()).map(([k]) => k);
    if (!c.fullName.trim() || !c.email.trim()) add("contact-fields", "fail", `Missing required contact field(s): ${missing.filter((k) => k === "name" || k === "email").join(", ")}.`);
    else if (missing.length) add("contact-fields", "warn", `Consider adding: ${missing.join(", ")}.`);
    else add("contact-fields", "pass", "Name, email, phone and location are present as real text in the page body.");
    if (c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) add("contact-email", "warn", "The email address does not look valid.");
  }

  // Standard sections present
  for (const [type, label] of [["experience", "Experience"], ["education", "Education"], ["skills", "Skills"]] as const) {
    const s = visible.find((x) => x.type === type);
    if (!s || isEmpty(s)) add(`missing-${type}`, "warn", `No ${label} section with content. Parsers expect it.`);
  }

  // Headings
  const odd = visible.filter((s) => s.type !== "contact" && !STANDARD_HEADINGS.has(s.title.trim().toLowerCase()));
  if (odd.length) add("headings", "warn", `Non-standard heading(s): ${odd.map((s) => `"${s.title}"`).join(", ")}. Use common names such as Experience or Education.`);
  else add("headings", "pass", "All section headings use standard names.");

  // Empty sections
  const empties = visible.filter((s) => s.type !== "contact" && isEmpty(s));
  if (empties.length) add("empty", "warn", `Empty visible section(s): ${empties.map((s) => s.title).join(", ")}. Hide or fill them.`);

  // Bullets
  let long = 0, typed = 0, many = 0;
  for (const s of visible) for (const list of bulletsOf(s)) {
    if (list.length > MAX_BULLETS_PER_ITEM) many++;
    for (const b of list) { if (b.length > MAX_BULLET_CHARS) long++; if (TYPED_BULLET.test(b)) typed++; }
  }
  const summary = visible.find((s) => s.type === "summary");
  if (long) add("bullet-length", "warn", `${long} bullet(s) are longer than ${MAX_BULLET_CHARS} characters. Shorter bullets scan better.`);
  else add("bullet-length", "pass", "No overly long bullets.");
  if (many) add("bullet-count", "warn", `${many} entr${many === 1 ? "y has" : "ies have"} more than ${MAX_BULLETS_PER_ITEM} bullets.`);
  if (typed) add("typed-bullets", "warn", `${typed} bullet(s) start with a typed symbol such as a dash or dot. Remove it; the template adds real list markup.`);
  if (summary && summary.type === "summary" && summary.content.text.length > MAX_SUMMARY_CHARS) add("summary-length", "warn", `Summary is over ${MAX_SUMMARY_CHARS} characters.`);

  // Dates
  let badDates = 0, undated = 0;
  const formats = new Set<string>();
  for (const s of visible) {
    if (s.type === "experience" || s.type === "education" || s.type === "projects") {
      for (const i of s.content.items) {
        const vals = [i.start, i.end];
        for (const v of vals) { if (!DATE_OK.test(v.trim())) badDates++; else if (v.trim()) formats.add(v.trim().length === 4 ? "y" : "ym"); }
        if (s.type === "experience" && !i.start.trim()) undated++;
      }
    }
  }
  if (badDates) add("dates", "warn", `${badDates} date(s) are free text. Use the YYYY-MM or YYYY form so all dates display consistently.`);
  else if (undated) add("dates", "warn", `${undated} experience entr${undated === 1 ? "y has" : "ies have"} no start date.`);
  else add("dates", "pass", "Dates are consistent; the chosen date format is applied everywhere.");

  // Structural, always true for this app
  add("layout", "pass", "Single-column layout; no tables, text boxes, images or icons are used.");
  add("fonts", "pass", "Common system fonts are used and the PDF contains real, selectable text.");

  // Length
  const pages = estimatePages(doc);
  if (pages > 1.05) add("length", "warn", `Estimated length is about ${pages.toFixed(1)} pages. Consider trimming, or reduce font size or margins.`);
  else add("length", "pass", "Estimated to fit on one page.");

  return checks;
}
