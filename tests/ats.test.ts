import { describe, expect, it } from "vitest";
import { runAtsChecks, estimatePages } from "@/lib/ats";
import { createSampleDoc } from "@/lib/sample";
import { createDefaultDoc, type ExperienceSection } from "@/lib/schema";
import { toPlainText } from "@/lib/plaintext";

const get = (checks: ReturnType<typeof runAtsChecks>, id: string) => checks.find((c) => c.id === id);

describe("ATS rules", () => {
  it("sample doc has no failures or warnings", () => {
    const c = runAtsChecks(createSampleDoc());
    expect(c.filter((x) => x.level !== "pass")).toEqual([]);
  });
  it("blank doc fails contact and warns missing sections", () => {
    const c = runAtsChecks(createDefaultDoc());
    expect(get(c, "contact-fields")?.level).toBe("fail");
    expect(get(c, "missing-experience")?.level).toBe("warn");
    expect(get(c, "missing-education")).toBeTruthy();
    expect(get(c, "empty")).toBeTruthy();
  });
  it("flags missing contact section when hidden", () => {
    const d = createSampleDoc();
    d.sections[0].visible = false;
    expect(get(runAtsChecks(d), "contact-missing")?.level).toBe("fail");
  });
  it("flags long bullets and typed bullet symbols", () => {
    const d = createSampleDoc();
    const exp = d.sections.find((s) => s.type === "experience") as ExperienceSection;
    exp.content.items[0].bullets = ["x".repeat(250), "• typed bullet", "- dash bullet"];
    const c = runAtsChecks(d);
    expect(get(c, "bullet-length")?.level).toBe("warn");
    expect(get(c, "typed-bullets")?.message).toMatch(/^2 /);
  });
  it("flags nonstandard headings", () => {
    const d = createSampleDoc();
    d.sections[2].title = "My Journey";
    expect(get(runAtsChecks(d), "headings")?.message).toMatch(/My Journey/);
  });
  it("flags free-text dates", () => {
    const d = createSampleDoc();
    (d.sections[2] as ExperienceSection).content.items[0].start = "last spring";
    expect(get(runAtsChecks(d), "dates")?.level).toBe("warn");
  });
  it("flags invalid email and estimates long docs over one page", () => {
    const d = createSampleDoc();
    if (d.sections[0].type === "contact") d.sections[0].content.email = "nope";
    expect(get(runAtsChecks(d), "contact-email")).toBeTruthy();
    const exp = d.sections[2] as ExperienceSection;
    exp.content.items = Array.from({ length: 12 }, (_, i) => ({ ...exp.content.items[0], id: `i${i}` }));
    expect(estimatePages(d)).toBeGreaterThan(1.05);
    expect(get(runAtsChecks(d), "length")?.level).toBe("warn");
  });
});

describe("plain text", () => {
  it("emits name first, standard headings in order, skips hidden sections", () => {
    const d = createSampleDoc();
    d.sections.find((s) => s.type === "languages")!.visible = false;
    const t = toPlainText(d);
    expect(t.startsWith("Elena Marchetti")).toBe(true);
    const order = ["SUMMARY", "EXPERIENCE", "EDUCATION", "SKILLS"].map((h) => t.indexOf(h));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(t).not.toContain("LANGUAGES");
    expect(t).toContain("Mar 2022 – Present");
  });
});

describe("toPlainText output", () => {
  it("is stable for the sample doc, with a hidden section, and for a blank doc", () => {
    const d = createSampleDoc();
    expect(toPlainText(d)).toMatchSnapshot("sample");
    d.sections[3].visible = false;
    expect(toPlainText(d)).toMatchSnapshot("sample with a hidden section");
    expect(toPlainText(createDefaultDoc())).toMatchSnapshot("blank");
  });
});
