import { formatRange, formatDate, type ResumeDoc } from "./schema";

/** Plain-text rendering in the same order a parser would read the resume. */
export function toPlainText(doc: ResumeDoc): string {
  const f = doc.style.dateFormat;
  const out: string[] = [];
  const push = (...l: string[]) => out.push(...l.filter((x) => x.trim() !== ""));
  for (const s of doc.sections) {
    if (!s.visible) continue;
    switch (s.type) {
      case "contact": {
        const c = s.content;
        push(c.fullName, c.headline, [c.email, c.phone, c.location, ...c.links].filter(Boolean).join(" | "));
        out.push("");
        continue;
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
    out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
