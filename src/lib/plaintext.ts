import { formatRange, formatDate, type DateFormat, type ResumeDoc, type Section } from "./schema";

/** Plain text of one section as an ATS would read it: its upper-cased heading, then its content. */
export function sectionPlainText(s: Section, f: DateFormat): string {
  const out: string[] = [];
  const push = (...l: string[]) => out.push(...l.filter((x) => x.trim() !== ""));
  switch (s.type) {
    case "contact": {
      const c = s.content;
      push(c.fullName, c.headline, [c.email, c.phone, c.location, ...c.links].filter(Boolean).join(" | "));
      return out.join("\n");
    }
    case "summary":
      out.push(s.title.toUpperCase());
      push(s.content.text);
      break;
    case "experience":
      out.push(s.title.toUpperCase());
      for (const i of s.content.items) {
        push([i.role, i.org, i.location].filter(Boolean).join(", "), formatRange(i.start, i.end, i.current, f));
        push(...i.bullets.map((b) => `- ${b}`));
      }
      break;
    case "education":
      out.push(s.title.toUpperCase());
      for (const i of s.content.items) {
        push([i.degree, i.school, i.location].filter(Boolean).join(", "), formatRange(i.start, i.end, false, f));
        push(...i.details.map((b) => `- ${b}`));
      }
      break;
    case "skills":
      out.push(s.title.toUpperCase());
      for (const i of s.content.items) push([i.label, i.skills].filter(Boolean).join(": "));
      break;
    case "projects":
      out.push(s.title.toUpperCase());
      for (const i of s.content.items) {
        push([i.name, i.link].filter(Boolean).join(", "), formatRange(i.start, i.end, false, f));
        push(...i.bullets.map((b) => `- ${b}`));
      }
      break;
    case "certifications":
      out.push(s.title.toUpperCase());
      for (const i of s.content.items) push([i.name, i.issuer, formatDate(i.date, f)].filter(Boolean).join(", "));
      break;
    case "languages":
      out.push(s.title.toUpperCase());
      for (const i of s.content.items) push([i.name, i.level].filter(Boolean).join(": "));
      break;
    case "custom":
      out.push(s.title.toUpperCase());
      for (const i of s.content.items) push(`- ${i.text}`);
      break;
  }
  return out.join("\n");
}

/** Plain-text rendering in the same order a parser would read the resume. */
export function toPlainText(doc: ResumeDoc): string {
  const f = doc.style.dateFormat;
  const out: string[] = [];
  for (const s of doc.sections) {
    if (!s.visible) continue;
    out.push(sectionPlainText(s, f), "");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
