import { describe, expect, it } from "vitest";
import { postingCoverage } from "@/lib/coverage";
import { createSampleDoc } from "@/lib/sample";
import type { ResumeDoc, SkillsSection } from "@/lib/schema";

const skills = (d: ResumeDoc) => d.sections.find((s) => s.type === "skills") as SkillsSection;
const doc = (list: string) => {
  const d = createSampleDoc();
  skills(d).content.items = [{ id: "s1", label: "Tools", skills: list }];
  return d;
};
const BACKEND = "Requirements:\n- Kubernetes\n- Terraform\n- Kubernetes\n- Terraform";
const PLATFORM = "Requirements:\n- k8s\n- Terraform\n- k8s\n- Terraform";
const QA = "Requirements:\n- Cypress\n- Selenium\n- Cypress\n- Selenium";

describe("postingCoverage", () => {
  it("counts found terms per posting", () => {
    const r = postingCoverage(doc("Kubernetes"), [{ id: "a", name: "Backend", jd: BACKEND }, { id: "b", name: "QA", jd: QA }]);
    expect(r.postings.map((p) => p.name)).toEqual(["Backend", "QA"]);
    for (const p of r.postings) expect(p.found + p.missing.length).toBe(p.total);
    expect(r.postings[0].missing.map((t) => t.toLowerCase())).toContain("terraform");
    expect(r.postings[0].missing.map((t) => t.toLowerCase())).not.toContain("kubernetes");
  });
  it("lists a term missing from two postings once, even when they spell it differently", () => {
    const r = postingCoverage(doc("Docker"), [{ id: "a", name: "Backend", jd: BACKEND }, { id: "b", name: "Platform", jd: PLATFORM }, { id: "c", name: "QA", jd: QA }]);
    const k = r.shared.filter((g) => /kubernetes|k8s/i.test(g.term));
    expect(k).toHaveLength(1);
    expect(k[0].postings).toEqual(["Backend", "Platform"]);
    expect(r.shared.find((g) => /terraform/i.test(g.term))?.postings).toEqual(["Backend", "Platform"]);
  });
  it("leaves out a term missing from one posting only", () => {
    const r = postingCoverage(doc("Docker"), [{ id: "a", name: "Backend", jd: BACKEND }, { id: "b", name: "QA", jd: QA }]);
    expect(r.shared).toEqual([]);
  });
  it("drops a term once the resume has it", () => {
    const r = postingCoverage(doc("k8s, Terraform"), [{ id: "a", name: "Backend", jd: BACKEND }, { id: "b", name: "Platform", jd: PLATFORM }]);
    expect(r.shared).toEqual([]);
  });
  it("sorts the most widespread gaps first", () => {
    const r = postingCoverage(doc("Docker"), [{ id: "a", name: "A", jd: BACKEND }, { id: "b", name: "B", jd: PLATFORM }, { id: "c", name: "C", jd: "Requirements:\n- Terraform\n- Terraform" }]);
    expect(r.shared[0].term.toLowerCase()).toBe("terraform");
    expect(r.shared[0].postings).toHaveLength(3);
  });
  it("skips postings without text or key terms", () => {
    const r = postingCoverage(doc("Docker"), [{ id: "a", name: "Empty", jd: "  \n" }, { id: "b", name: "Filler", jd: "We are looking for a strong team." }, { id: "c", name: "Backend", jd: BACKEND }]);
    expect(r.postings.map((p) => p.name)).toEqual(["Backend"]);
  });
  it("does not count a term in a hidden section as found, since it will not print", () => {
    const d = doc("Terraform");
    skills(d).visible = false;
    const r = postingCoverage(d, [{ id: "a", name: "Backend", jd: BACKEND }]);
    expect(r.postings[0].missing.map((t) => t.toLowerCase())).toContain("terraform");
  });
});
