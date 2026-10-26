import { describe, expect, it } from "vitest";
import { runCoach, type CoachRule } from "@/lib/coach";
import { createSampleDoc } from "@/lib/sample";
import { createDefaultDoc, type ExperienceSection, type ProjectsSection, type ResumeDoc } from "@/lib/schema";

function withBullets(bullets: string[], current = false, doc: ResumeDoc = createSampleDoc()) {
  const exp = doc.sections.find((s) => s.type === "experience") as ExperienceSection;
  exp.content.items[0].bullets = bullets;
  exp.content.items[0].current = current;
  return doc;
}
const rules = (doc: ResumeDoc): CoachRule[] => runCoach(doc).map((f) => f.rule);

describe("bullet coach", () => {
  it("sample doc has no findings", () => {
    expect(runCoach(createSampleDoc())).toEqual([]);
  });
  it("blank doc has no findings", () => {
    expect(runCoach(createDefaultDoc())).toEqual([]);
  });

  it("flags a weak opener and names it", () => {
    const f = runCoach(withBullets(["Responsible for the weekly report, saving 4 hours."])).find((x) => x.rule === "weak-opener");
    expect(f?.message).toMatch(/Responsible for/);
    expect(f?.bulletIndex).toBe(0);
  });
  it("does not flag a strong opener", () => {
    expect(rules(withBullets(["Led a team of 5 engineers."]))).not.toContain("weak-opener");
  });

  it("flags bullets with no quantity only when most lack one", () => {
    expect(rules(withBullets(["Wrote reports.", "Updated dashboards.", "Cleaned data."]))).toContain("no-number");
    expect(rules(withBullets(["Wrote reports for 3 teams.", "Updated dashboards.", "Cut costs by 10%."]))).not.toContain("no-number");
  });
  it("flags at most two unquantified bullets per entry", () => {
    const n = runCoach(withBullets(["Wrote reports.", "Updated dashboards.", "Cleaned data.", "Fixed bugs."])).filter((f) => f.rule === "no-number");
    expect(n).toHaveLength(2);
  });
  it("accepts number words", () => {
    expect(rules(withBullets(["Cut churn by a third."]))).not.toContain("no-number");
  });

  it("flags a present-tense opener in a past role", () => {
    const f = runCoach(withBullets(["Manage a team of 4."])).find((x) => x.rule === "tense");
    expect(f?.message).toMatch(/Managed/);
    expect(rules(withBullets(["Manages a team of 4."]))).toContain("tense");
  });
  it("leaves past tense alone, and does not judge current roles", () => {
    expect(rules(withBullets(["Managed a team of 4."]))).not.toContain("tense");
    expect(rules(withBullets(["Manage a team of 4."], true))).not.toContain("tense");
    expect(rules(withBullets(["Led a team of 4."]))).not.toContain("tense");
  });

  it("flags a verb repeated inside one entry, on the later bullets", () => {
    const f = runCoach(withBullets(["Led a pilot of 3 depots.", "Led a team of 12.", "Built a tool for 5 users."])).filter((x) => x.rule === "repeated-verb");
    expect(f.map((x) => x.bulletIndex)).toEqual([1]);
  });
  it("flags a verb used three times across entries", () => {
    const doc = withBullets(["Led a pilot of 3 depots.", "Built a tool for 5 users."]);
    const exp = doc.sections.find((s) => s.type === "experience") as ExperienceSection;
    exp.content.items[1].bullets = ["Led 2 audits.", "Documented 4 launches."];
    (doc.sections.find((x) => x.type === "projects") as ProjectsSection).content.items[0].bullets = ["Led 2 workshops."];
    const f = runCoach(doc).filter((x) => x.rule === "repeated-verb");
    expect(f).toHaveLength(1);
    expect(f[0].message).toMatch(/3 bullets across your resume/);
  });

  it("flags passive voice but not good news", () => {
    expect(rules(withBullets(["Reports were written by me weekly for 3 teams."]))).toContain("passive");
    expect(rules(withBullets(["Was promoted twice in 3 years."]))).not.toContain("passive");
  });

  it("flags filler phrases", () => {
    const f = runCoach(withBullets(["Handled various tasks for 3 clients."])).find((x) => x.rule === "filler");
    expect(f?.message).toMatch(/various/);
    expect(rules(withBullets(["Cut costs by 10% in order to fund 2 hires."]))).toContain("filler");
  });

  it("ignores blank lines and hidden sections", () => {
    expect(runCoach(withBullets(["", "  "]))).toEqual([]);
    const doc = withBullets(["Responsible for various things."]);
    (doc.sections.find((s) => s.type === "experience") as ExperienceSection).visible = false;
    expect(runCoach(doc)).toEqual([]);
  });

  it("points at the section, entry and line", () => {
    const f = runCoach(withBullets(["Led a team of 4.", "Responsible for 3 reports."]))[0];
    expect(f).toMatchObject({ sectionId: "s-exp", itemId: "e1", bulletIndex: 1 });
    expect(f.itemLabel).toBe("Senior Operations Analyst");
  });
  it("gives every finding a unique id", () => {
    const f = runCoach(withBullets(["Responsible for various tasks.", "Responsible for various duties.", "Helped with etc."]));
    expect(new Set(f.map((x) => x.id)).size).toBe(f.length);
  });
});
