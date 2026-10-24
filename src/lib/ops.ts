import { createEmptyItem, createSection, type ResumeDoc, type Section, type SectionType, type SkillGroup, type Style } from "./schema";

export function moveSection(doc: ResumeDoc, from: number, to: number): ResumeDoc {
  if (from === to || from < 0 || to < 0 || from >= doc.sections.length || to >= doc.sections.length) return doc;
  const sections = doc.sections.slice();
  const [s] = sections.splice(from, 1);
  sections.splice(to, 0, s);
  return { ...doc, sections };
}
export function insertSection(doc: ResumeDoc, section: Section, index: number): ResumeDoc {
  const i = Math.max(0, Math.min(doc.sections.length, index));
  return { ...doc, sections: [...doc.sections.slice(0, i), section, ...doc.sections.slice(i)] };
}
export function addSection(doc: ResumeDoc, type: SectionType): ResumeDoc {
  return { ...doc, sections: [...doc.sections, createSection(type)] };
}
export function removeSection(doc: ResumeDoc, id: string): ResumeDoc {
  return { ...doc, sections: doc.sections.filter((s) => s.id !== id) };
}
export function patchSection(doc: ResumeDoc, id: string, fn: (s: Section) => Section): ResumeDoc {
  return { ...doc, sections: doc.sections.map((s) => (s.id === id ? fn(s) : s)) };
}
export function patchStyle(doc: ResumeDoc, patch: Partial<Style>): ResumeDoc {
  return { ...doc, style: { ...doc.style, ...patch } };
}

export const ADDED_SKILLS_LABEL = "Additional skills";

/** Adds a term to the "Additional skills" group of the first Skills section, creating either when missing. Never edits other groups. */
export function addSkillTerm(doc: ResumeDoc, term: string, groupLabel = ADDED_SKILLS_LABEL): ResumeDoc {
  const t = term.trim();
  if (!t) return doc;
  const withSection = doc.sections.some((s) => s.type === "skills") ? doc : addSection(doc, "skills");
  const target = withSection.sections.find((s) => s.type === "skills")!;
  return patchSection(withSection, target.id, (s) => {
    if (s.type !== "skills") return s;
    const items = s.content.items;
    const i = items.findIndex((g) => g.label.trim().toLowerCase() === groupLabel.toLowerCase());
    if (i < 0) {
      const group = { ...(createEmptyItem("skills") as SkillGroup), label: groupLabel, skills: t };
      return { ...s, content: { items: [...items, group] } };
    }
    const existing = items[i].skills.split(",").map((x) => x.trim()).filter(Boolean);
    if (existing.some((x) => x.toLowerCase() === t.toLowerCase())) return s;
    const skills = [...existing, t].join(", ");
    return { ...s, content: { items: items.map((g, j) => (j === i ? { ...g, skills } : g)) } };
  });
}

export type WriteInTarget = "summary" | "experience";

/** Where a missing term can be written into a sentence: the summary, and the first (most recent) job. */
export function writeInTargets(doc: ResumeDoc): WriteInTarget[] {
  const out: WriteInTarget[] = [];
  if (doc.sections.some((s) => s.type === "summary")) out.push("summary");
  if (doc.sections.some((s) => s.type === "experience" && s.content.items.length > 0)) out.push("experience");
  return out;
}
