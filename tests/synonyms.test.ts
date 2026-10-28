import { describe, expect, it } from "vitest";
import { canonicalKey, extractTerms, matchJobDescription, phraseKey, variantKeys } from "@/lib/jobmatch";
import { SYNONYM_GROUPS } from "@/lib/synonyms";
import { createSampleDoc } from "@/lib/sample";
import type { ResumeDoc, SkillsSection } from "@/lib/schema";

const skills = (d: ResumeDoc) => d.sections.find((s) => s.type === "skills") as SkillsSection;
const withSkills = (list: string) => {
  const d = createSampleDoc();
  skills(d).content.items = [{ id: "s1", label: "Tools", skills: list }];
  return d;
};
const find = (d: ResumeDoc, jd: string, term: string) => matchJobDescription(d, jd).terms.find((t) => t.term.toLowerCase() === term.toLowerCase());

describe("synonym groups", () => {
  it("gives every spelling in a group the same canonical key", () => {
    for (const group of SYNONYM_GROUPS) {
      const keys = new Set(group.map((p) => canonicalKey(phraseKey(p))));
      expect(keys.size, group.join(" / ")).toBe(1);
    }
  });
  it("lists every spelling as a variant of the others", () => {
    expect(variantKeys(phraseKey("k8s"))).toContain(phraseKey("Kubernetes"));
    expect(variantKeys("python")).toEqual(["python"]);
  });
  it("keeps no spelling in two groups", () => {
    const seen = new Map<string, number>();
    SYNONYM_GROUPS.forEach((g, i) => g.forEach((p) => {
      const key = phraseKey(p);
      expect(seen.get(key) ?? i, `${p} appears in two groups`).toBe(i);
      seen.set(key, i);
    }));
  });
  it("leaves ambiguous short words out", () => {
    for (const word of ["go", "r", "c", "sap", "rest", "node"]) expect(variantKeys(word)).toEqual([word]);
  });
});

describe("variants in a posting", () => {
  it("merges two spellings of one skill into a single term", () => {
    const t = extractTerms("Requirements:\n- Kubernetes\n- k8s operators\n- Kubernetes upgrades").filter((x) => /kubernetes|k8s/i.test(x.term));
    expect(t.map((x) => x.term.toLowerCase()).filter((x) => x === "kubernetes" || x === "k8s")).toHaveLength(1);
    expect(t[0].variants).toContain(phraseKey("k8s"));
  });
  it("adds the weight of both spellings", () => {
    const one = extractTerms("Kubernetes daily.").find((x) => x.term === "Kubernetes")!;
    const both = extractTerms("Kubernetes daily. k8s daily.").find((x) => /kubernetes|k8s/i.test(x.term))!;
    expect(both.weight).toBeGreaterThan(one.weight);
  });
  it("merges a one-word and a multi-word spelling", () => {
    const t = extractTerms("Requirements:\n- CI/CD pipelines\n- Continuous integration experience").map((x) => x.term.toLowerCase());
    expect(t.filter((x) => x === "ci/cd" || x === "continuous integration")).toHaveLength(1);
  });
});

describe("variants in a resume", () => {
  const jd = "Requirements:\n- Kubernetes\n- Kubernetes";
  it("counts k8s in the resume as Kubernetes", () => {
    const r = find(withSkills("k8s, Docker"), jd, "Kubernetes");
    expect(r).toMatchObject({ found: true, where: ["Skills"], matchedAs: "k8s" });
  });
  it("counts Kubernetes in the resume as k8s", () => {
    const r = find(withSkills("Kubernetes"), "Requirements:\n- k8s\n- k8s", "k8s");
    expect(r).toMatchObject({ found: true, matchedAs: "Kubernetes" });
  });
  it("does not mention matchedAs when the resume uses the posting's own spelling", () => {
    const r = find(withSkills("Kubernetes, k8s"), jd, "Kubernetes");
    expect(r?.found).toBe(true);
    expect(r?.matchedAs).toBeUndefined();
  });
  it("lists the other spellings on a missing term", () => {
    const r = find(withSkills("Docker"), jd, "Kubernetes");
    expect(r).toMatchObject({ found: false, alsoCounts: ["k8s"] });
  });
  it("still flags a variant found only in a hidden section", () => {
    const d = withSkills("k8s");
    skills(d).visible = false;
    expect(find(d, jd, "Kubernetes")).toMatchObject({ found: false, hiddenOnly: true });
  });
  it("does not read a single letter or an ordinary word as a variant", () => {
    const d = withSkills("Go, R, C");
    const r = matchJobDescription(d, "Requirements:\n- Golang\n- Golang").terms.find((t) => t.term.toLowerCase() === "golang");
    expect(r).toMatchObject({ found: false });
  });
});
