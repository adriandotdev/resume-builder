import { describe, expect, it } from "vitest";
import { align, diffCoverage, diffDocs, diffLines } from "@/lib/diff";
import { createSampleDoc } from "@/lib/sample";
import type { ExperienceSection, ResumeDoc, SkillsSection } from "@/lib/schema";
import { FRONTEND } from "./fixtures/postings";

const clone = (d: ResumeDoc) => JSON.parse(JSON.stringify(d)) as ResumeDoc;
const exp = (d: ResumeDoc) => d.sections.find((s) => s.type === "experience") as ExperienceSection;
const skills = (d: ResumeDoc) => d.sections.find((s) => s.type === "skills") as SkillsSection;
const section = (diff: ReturnType<typeof diffDocs>, type: string) => diff.sections.find((s) => s.type === type)!;

describe("line diff", () => {
  it("aligns shared, removed and added lines in order", () => {
    expect(diffLines(["a", "b", "c"], ["a", "x", "c"])).toEqual([
      { kind: "same", text: "a" }, { kind: "removed", text: "b" }, { kind: "added", text: "x" }, { kind: "same", text: "c" },
    ]);
    expect(align([], ["a"])).toEqual([[-1, 0]]);
    expect(diffLines([], [])).toEqual([]);
  });
});

describe("diffDocs", () => {
  it("reports nothing for identical docs", () => {
    const doc = createSampleDoc();
    const d = diffDocs(doc, clone(doc));
    expect(d.totals).toEqual({ sectionsChanged: 0, linesAdded: 0, linesRemoved: 0 });
    expect(d.sections.every((s) => s.status === "same" && s.notes.length === 0)).toBe(true);
  });

  it("finds an edited bullet in a duplicated version (matched by id)", () => {
    const a = createSampleDoc();
    const b = clone(a);
    const bullets = exp(b).content.items[0].bullets;
    const old = bullets[0];
    bullets[0] = "Rewrote the checkout flow in TypeScript";
    bullets.push("Mentored two junior engineers");
    const d = diffDocs(a, b);
    const e = section(d, "experience").entries[0];
    expect(section(d, "experience").status).toBe("changed");
    expect(e.status).toBe("changed");
    expect(e.lines.filter((l) => l.kind === "removed").map((l) => l.text)).toEqual([old]);
    expect(e.lines.filter((l) => l.kind === "added").map((l) => l.text)).toEqual(["Rewrote the checkout flow in TypeScript", "Mentored two junior engineers"]);
    expect(d.totals).toEqual({ sectionsChanged: 1, linesAdded: 2, linesRemoved: 1 });
    expect(d.sections.filter((s) => s.type !== "experience").every((s) => s.status === "same")).toBe(true);
  });

  it("matches independently created versions by label when ids differ", () => {
    const a = createSampleDoc();
    const b = clone(a);
    b.sections.forEach((s) => { s.id = `other-${s.id}`; if ("items" in s.content) s.content.items.forEach((i) => { i.id = `other-${i.id}`; }); });
    exp(b).content.items[0].bullets.pop();
    const d = diffDocs(a, b);
    expect(section(d, "experience").entries.map((e) => e.status)).toEqual(exp(a).content.items.map((_, i) => (i === 0 ? "changed" : "same")));
    expect(d.totals.linesAdded).toBe(0);
    expect(d.totals.linesRemoved).toBe(1);
  });

  it("reports added and removed sections", () => {
    const a = createSampleDoc();
    const b = clone(a);
    const removedTitle = b.sections.splice(b.sections.findIndex((s) => s.type === "skills"), 1)[0].title;
    const d = diffDocs(a, b);
    const gone = d.sections.find((s) => s.title === removedTitle)!;
    expect(gone.status).toBe("removed");
    expect(gone.entries.every((e) => e.status === "removed" && e.lines.every((l) => l.kind === "removed"))).toBe(true);
    expect(diffDocs(b, a).sections.find((s) => s.title === removedTitle)!.status).toBe("added");
  });

  it("flags a moved section once, not every section it jumped over", () => {
    const a = createSampleDoc();
    const b = clone(a);
    const [moved] = b.sections.splice(b.sections.length - 1, 1);
    b.sections.splice(1, 0, moved);
    const d = diffDocs(a, b);
    expect(d.sections.filter((s) => s.notes.includes("Moved"))).toHaveLength(1);
    expect(d.sections.find((s) => s.notes.includes("Moved"))!.status).toBe("changed");
  });

  it("notes renamed and hidden sections", () => {
    const a = createSampleDoc();
    const b = clone(a);
    skills(b).title = "Technical skills";
    skills(b).visible = false;
    const s = section(diffDocs(a, b), "skills");
    expect(s.status).toBe("changed");
    expect(s.notes).toEqual([`Renamed from “${skills(a).title}”`, "Now hidden"]);
  });

  it("compares skills one at a time", () => {
    const a = createSampleDoc();
    const b = clone(a);
    const group = skills(b).content.items[0];
    group.skills = `${group.skills}, Rust`;
    const lines = section(diffDocs(a, b), "skills").entries[0].lines;
    expect(lines.filter((l) => l.kind === "added")).toEqual([{ kind: "added", text: "Rust" }]);
    expect(lines.some((l) => l.kind === "removed")).toBe(false);
  });

  it("ignores the date style", () => {
    const a = createSampleDoc();
    const b = clone(a);
    b.style.dateFormat = "YYYY";
    expect(diffDocs(a, b).totals.sectionsChanged).toBe(0);
  });
});

describe("diffCoverage", () => {
  it("buckets each key term by which resume covers it", () => {
    const a = createSampleDoc();
    const b = clone(a);
    const none = diffCoverage(a, b, FRONTEND);
    expect(none.total).toBeGreaterThan(0);
    expect(none.onlyA).toEqual([]);
    expect(none.onlyB).toEqual([]);

    const first = [...none.neither, ...none.both][0];
    skills(b).content.items[0].skills += `, ${first}`;
    const withTerm = diffCoverage(a, b, FRONTEND);
    expect(withTerm.total).toBe(none.total);
    expect(withTerm.both.length + withTerm.onlyA.length + withTerm.onlyB.length + withTerm.neither.length).toBe(withTerm.total);
    expect([...withTerm.onlyB, ...withTerm.both]).toContain(first);
  });

  it("is empty for an empty posting", () => {
    const doc = createSampleDoc();
    expect(diffCoverage(doc, doc, "").total).toBe(0);
  });
});
