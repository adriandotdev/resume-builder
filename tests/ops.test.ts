import { describe, expect, it } from "vitest";
import { addSkillTerm, writeInTargets } from "@/lib/ops";
import { matchJobDescription } from "@/lib/jobmatch";
import { createSampleDoc } from "@/lib/sample";
import type { ResumeDoc, SkillsSection } from "@/lib/schema";

const skills = (d: ResumeDoc) => d.sections.find((s) => s.type === "skills") as SkillsSection;
const withoutSkills = (d: ResumeDoc): ResumeDoc => ({ ...d, sections: d.sections.filter((s) => s.type !== "skills") });

describe("addSkillTerm", () => {
  it("creates an Additional skills group and leaves other groups alone", () => {
    const doc = createSampleDoc();
    const out = addSkillTerm(doc, "kubernetes");
    const items = skills(out).content.items;
    expect(items.slice(0, -1)).toEqual(skills(doc).content.items);
    expect(items.at(-1)).toMatchObject({ label: "Additional skills", skills: "kubernetes" });
  });
  it("appends to the existing group and dedupes case-insensitively", () => {
    let doc = addSkillTerm(createSampleDoc(), "kubernetes");
    doc = addSkillTerm(doc, "terraform");
    doc = addSkillTerm(doc, "Kubernetes");
    expect(skills(doc).content.items.at(-1)?.skills).toBe("kubernetes, terraform");
  });
  it("adds a Skills section when there is none", () => {
    const out = addSkillTerm(withoutSkills(createSampleDoc()), "sql");
    expect(skills(out).content.items).toMatchObject([{ label: "Additional skills", skills: "sql" }]);
  });
  it("does not mutate the input and ignores blank terms", () => {
    const doc = createSampleDoc();
    const copy = structuredClone(doc);
    addSkillTerm(doc, "kubernetes");
    expect(doc).toEqual(copy);
    expect(addSkillTerm(doc, "  ")).toBe(doc);
  });
  it("makes the term count as found in Skills, including symbol terms", () => {
    const jd = "Requirements: Kubernetes, C++, Node.js, CI/CD. Kubernetes, C++, Node.js, CI/CD.";
    let doc = createSampleDoc();
    const missing = matchJobDescription(doc, jd).terms.filter((t) => !t.found).map((t) => t.term);
    expect(missing.length).toBeGreaterThan(0);
    for (const t of missing) doc = addSkillTerm(doc, t);
    const after = matchJobDescription(doc, jd).terms;
    expect(after.filter((t) => !t.found)).toEqual([]);
    expect(after.every((t) => t.where.includes("Skills"))).toBe(true);
  });
});

describe("writeInTargets", () => {
  it("offers the summary and experience when both can take text", () => {
    expect(writeInTargets(createSampleDoc())).toEqual(["summary", "experience"]);
  });
  it("leaves out experience with no jobs and summary when the section is gone", () => {
    const doc = createSampleDoc();
    const noJobs: ResumeDoc = { ...doc, sections: doc.sections.map((s) => (s.type === "experience" ? { ...s, content: { items: [] } } : s)) };
    expect(writeInTargets(noJobs)).toEqual(["summary"]);
    expect(writeInTargets({ ...doc, sections: doc.sections.filter((s) => s.type !== "summary") })).toEqual(["experience"]);
  });
});
