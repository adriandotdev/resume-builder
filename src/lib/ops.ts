import { createSection, type ResumeDoc, type Section, type SectionType, type Style } from "./schema";

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
