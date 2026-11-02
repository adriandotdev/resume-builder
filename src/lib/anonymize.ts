import type { ResumeDoc, Section } from "./schema";

/**
 * Review-only copy of a resume with identifying details removed, for posting to public forums.
 * Pure: never mutates the input. Structured fields are cleared or replaced with generic labels, and every
 * free-text field is scrubbed for contact patterns plus the names found in the doc itself.
 */

export interface AnonymizeReport {
  /** Contact fields (name, email, phone, location, links) that held a value and were removed. */
  contactFields: number;
  /** Distinct company, school and issuer names replaced with generic labels. */
  organizations: number;
  /** Mentions replaced inside free text (emails, links, phones, handles, known names). */
  textRedactions: number;
  hiddenSections: number;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const URL_SCHEME = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi;
// Lowercase-only TLDs so "ASP.NET" and "Node.js" are not mistaken for domains.
const BARE_DOMAIN = /\b(?:[A-Za-z0-9-]+\.)+(?:com|org|net|io|dev|co|me|app|ai|edu|gov|ph|uk|us|ca|de|in|au)\b(?:\/[^\s<>"')]*)?/g;
const HANDLE = /(?<![\w.])@[A-Za-z0-9_]{2,}/g;
const PHONE = /(?<![\w])\+?\d[\d\s().-]{7,}\d(?![\w])/g;
const GENERIC_PLACES = new Set(["remote", "hybrid", "onsite", "on-site", "usa", "united states", "worldwide"]);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const letter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String(i + 1));

interface Rule { re: RegExp; label: string }

function buildRules(doc: ResumeDoc, orgLabel: (name: string) => string, schoolLabel: (name: string) => string, issuerLabel: (name: string) => string): Rule[] {
  const map = new Map<string, string>(); // lowercase needle -> label
  const add = (needle: string, label: string, min = 3) => {
    const n = needle.trim();
    if (n.length >= min && !GENERIC_PLACES.has(n.toLowerCase()) && !map.has(n.toLowerCase())) map.set(n.toLowerCase(), label);
  };
  const place = (loc: string) => {
    add(loc, "[location]");
    add(loc.split(",")[0], "[location]");
  };
  for (const s of doc.sections) {
    switch (s.type) {
      case "contact": {
        const c = s.content;
        add(c.fullName, "[name]");
        for (const t of c.fullName.split(/\s+/)) add(t.replace(/[^\p{L}\p{N}'-]/gu, ""), "[name]");
        place(c.location);
        for (const l of c.links) add(l, "[link]");
        break;
      }
      case "experience":
        for (const i of s.content.items) {
          if (i.org.trim()) {
            const label = orgLabel(i.org);
            add(i.org, label);
            const first = i.org.trim().split(/\s+/)[0];
            if (first.length >= 5) add(first, label, 5);
          }
          place(i.location);
        }
        break;
      case "education":
        for (const i of s.content.items) {
          if (i.school.trim()) add(i.school, schoolLabel(i.school));
          place(i.location);
        }
        break;
      case "projects":
        for (const i of s.content.items) add(i.link, "[link]");
        break;
      case "certifications":
        for (const i of s.content.items) if (i.issuer.trim()) add(i.issuer, issuerLabel(i.issuer));
        break;
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([needle, label]) => ({ re: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(needle)}(?![\\p{L}\\p{N}])`, "giu"), label }));
}

export function anonymizeDoc(doc: ResumeDoc): { doc: ResumeDoc; report: AnonymizeReport } {
  const report: AnonymizeReport = { contactFields: 0, organizations: 0, textRedactions: 0, hiddenSections: 0 };

  const orgs = new Map<string, string>();
  const labelFor = (store: Map<string, string>, name: string, make: (n: number) => string) => {
    const key = name.trim().toLowerCase();
    let l = store.get(key);
    if (!l) {
      l = make(store.size);
      store.set(key, l);
      report.organizations += 1;
    }
    return l;
  };
  const schools = new Map<string, string>();
  const issuers = new Map<string, string>();
  const orgLabel = (n: string) => labelFor(orgs, n, (i) => `Company ${letter(i)}`);
  const schoolLabel = (n: string) => labelFor(schools, n, (i) => (i === 0 ? "University" : `University ${letter(i)}`));
  const issuerLabel = (n: string) => labelFor(issuers, n, (i) => (i === 0 ? "Issuing body" : `Issuing body ${letter(i)}`));

  const rules = buildRules(doc, orgLabel, schoolLabel, issuerLabel);

  const hit = (replacement: string) => () => { report.textRedactions += 1; return replacement; };
  const scrub = (text: string): string => {
    if (!text) return text;
    let t = text.replace(EMAIL, hit("[email]")).replace(URL_SCHEME, hit("[link]")).replace(BARE_DOMAIN, hit("[link]")).replace(HANDLE, hit("[handle]"));
    t = t.replace(PHONE, (m) => {
      const digits = m.replace(/\D/g, "").length;
      if (digits < 7 || digits > 15) return m;
      // Year ranges like "2019 - 2022" are dates, not phone numbers.
      if (m.split(/\D+/).filter(Boolean).every((g) => /^(?:19|20)\d{2}$/.test(g))) return m;
      report.textRedactions += 1;
      return "[phone]";
    });
    for (const r of rules) t = t.replace(r.re, hit(r.label));
    return t;
  };
  const many = (a: string[]) => a.map(scrub);
  const orgOr = (name: string, make: (n: string) => string) => (name.trim() ? make(name) : "");

  const sections: Section[] = [];
  for (const s of doc.sections) {
    if (!s.visible) { report.hiddenSections += 1; continue; }
    const title = scrub(s.title);
    switch (s.type) {
      case "contact": {
        const c = s.content;
        report.contactFields += [c.fullName, c.email, c.phone, c.location].filter((v) => v.trim()).length + c.links.filter((l) => l.trim()).length;
        sections.push({ ...s, title, content: { fullName: "Candidate", headline: scrub(c.headline), email: "", phone: "", location: "", links: [] } });
        break;
      }
      case "summary":
        sections.push({ ...s, title, content: { text: scrub(s.content.text) } });
        break;
      case "experience":
        sections.push({ ...s, title, content: { items: s.content.items.map((i) => ({ ...i, role: scrub(i.role), org: orgOr(i.org, orgLabel), location: "", bullets: many(i.bullets) })) } });
        break;
      case "education":
        sections.push({ ...s, title, content: { items: s.content.items.map((i) => ({ ...i, degree: scrub(i.degree), school: orgOr(i.school, schoolLabel), location: "", details: many(i.details) })) } });
        break;
      case "skills":
        sections.push({ ...s, title, content: { items: s.content.items.map((i) => ({ ...i, label: scrub(i.label), skills: scrub(i.skills) })) } });
        break;
      case "projects":
        sections.push({ ...s, title, content: { items: s.content.items.map((i) => ({ ...i, name: scrub(i.name), link: "", bullets: many(i.bullets) })) } });
        break;
      case "certifications":
        sections.push({ ...s, title, content: { items: s.content.items.map((i) => ({ ...i, name: scrub(i.name), issuer: orgOr(i.issuer, issuerLabel) })) } });
        break;
      case "languages":
        sections.push({ ...s, title, content: { items: s.content.items.map((i) => ({ ...i, name: scrub(i.name), level: scrub(i.level) })) } });
        break;
      case "custom":
        sections.push({ ...s, title, content: { items: s.content.items.map((i) => ({ ...i, text: scrub(i.text) })) } });
        break;
    }
  }
  return { doc: { ...doc, sections }, report };
}
