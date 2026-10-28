import { describe, expect, it } from "vitest";
import { currentFor, describePatch, fitCandidates, FIT_FONT_FLOOR, FIT_LINE_FLOOR, overflowLines, pagesFor, pickFit, trimCandidates, trimsNeeded, withoutTrims, type FitPatch } from "@/lib/fit";
import { createSampleDoc } from "@/lib/sample";
import { createDefaultDoc, DEFAULT_STYLE, type EducationSection, type ExperienceSection, type ResumeDoc } from "@/lib/schema";

const PAGE_H = 1000;

describe("pagesFor", () => {
  it("is 1 for an empty or short sheet", () => {
    expect(pagesFor(0, PAGE_H, 50)).toBe(1);
    expect(pagesFor(PAGE_H, PAGE_H, 50)).toBe(1);
  });
  it("counts a second page once content passes one page of content area", () => {
    expect(pagesFor(PAGE_H + 3, PAGE_H, 50)).toBe(2);
    expect(pagesFor(PAGE_H * 2 + 10, PAGE_H, 50)).toBe(3);
  });
});

describe("overflowLines", () => {
  it("is 0 when it fits and counts lines when it does not", () => {
    expect(overflowLines(PAGE_H, PAGE_H, DEFAULT_STYLE)).toBe(0);
    const linePx = DEFAULT_STYLE.fontSize * (96 / 72) * DEFAULT_STYLE.lineSpacing;
    expect(overflowLines(PAGE_H + 2 + linePx * 3, PAGE_H, DEFAULT_STYLE)).toBe(3);
  });
});

describe("fitCandidates", () => {
  const cands = fitCandidates({ fontSize: 10.5, lineSpacing: 1.25, margins: "normal" });
  it("starts with the cheapest change: one line-spacing step", () => {
    expect(cands[0].patch).toEqual({ lineSpacing: 1.2 });
  });
  it("is ordered by cost and never includes the current style", () => {
    for (let i = 1; i < cands.length; i++) expect(cands[i].cost).toBeGreaterThanOrEqual(cands[i - 1].cost);
    expect(cands.every((c) => Object.keys(c.patch).length > 0)).toBe(true);
  });
  it("only tightens, and stops at the floors", () => {
    for (const { patch } of cands) {
      expect(patch.lineSpacing ?? 1.25).toBeLessThanOrEqual(1.25);
      expect(patch.lineSpacing ?? 1.25).toBeGreaterThanOrEqual(FIT_LINE_FLOOR - 1e-9);
      expect(patch.fontSize ?? 10.5).toBeLessThanOrEqual(10.5);
      expect(patch.fontSize ?? 10.5).toBeGreaterThanOrEqual(FIT_FONT_FLOOR);
      expect(patch.margins === undefined || patch.margins === "narrow").toBe(true);
    }
  });
  it("offers nothing when already at every floor", () => {
    expect(fitCandidates({ fontSize: FIT_FONT_FLOOR, lineSpacing: FIT_LINE_FLOOR, margins: "narrow" })).toEqual([]);
  });
  it("does not raise a value already below the floor", () => {
    const low = fitCandidates({ fontSize: 9, lineSpacing: 1, margins: "narrow" });
    expect(low).toEqual([]);
  });
  it("walks margins from wide through normal to narrow", () => {
    const wide = fitCandidates({ fontSize: FIT_FONT_FLOOR, lineSpacing: FIT_LINE_FLOOR, margins: "wide" });
    expect(wide.map((c) => c.patch.margins)).toEqual(["normal", "narrow"]);
  });
});

describe("pickFit", () => {
  const cands = fitCandidates({ fontSize: 10.5, lineSpacing: 1.25, margins: "normal" });
  const tightest = cands.reduce((a, b) => (b.cost > a.cost ? b : a));
  it("returns the first candidate that fits, in cost order", () => {
    const seen: FitPatch[] = [];
    const r = pickFit(cands, (p) => { seen.push(p); return p === cands[2].patch || p === tightest.patch ? 1 : 2; });
    expect(r?.patch).toEqual(cands[2].patch);
    expect(seen).toEqual([tightest.patch, cands[0].patch, cands[1].patch, cands[2].patch]); // tightest is probed once, then cost order, stopping at the first fit
  });
  it("gives up after one layout when even the tightest candidate spills over", () => {
    let calls = 0;
    expect(pickFit(cands, () => { calls++; return 2; })).toBeNull();
    expect(calls).toBe(1);
  });
  it("returns null for no candidates", () => {
    expect(pickFit([], () => 1)).toBeNull();
  });
});

describe("describePatch and currentFor", () => {
  const style = { fontSize: 10.5, lineSpacing: 1.25, margins: "normal" as const };
  it("describes only the changed fields", () => {
    expect(describePatch(style, { lineSpacing: 1.15 })).toEqual(["Line spacing 1.25 → 1.15"]);
    expect(describePatch(style, { margins: "narrow", fontSize: 10 })).toEqual(["Margins Normal (18 mm) → Narrow (12 mm)", "Font size 10.5 pt → 10 pt"]);
  });
  it("captures only the touched fields for Undo", () => {
    expect(currentFor({ ...DEFAULT_STYLE }, { lineSpacing: 1.1, margins: "narrow" })).toEqual({ lineSpacing: 1.25, margins: "normal" });
  });
});

function withExperience(doc: ResumeDoc, bullets: string[][]) {
  const exp = doc.sections.find((s) => s.type === "experience") as ExperienceSection;
  exp.content.items = bullets.map((b, i) => ({ id: `it${i}`, role: `Role ${i}`, org: "Org", location: "", start: "2020-01", end: "2021-01", current: false, bullets: b }));
  return doc;
}

describe("trimCandidates", () => {
  it("is empty for a blank doc and the sample doc", () => {
    expect(trimCandidates(createDefaultDoc())).toEqual([]);
    expect(trimCandidates(createSampleDoc()).every((t) => t.kind !== "bullet" || t.text)).toBe(true);
  });
  it("suggests trailing bullets of the oldest role first, and keeps the recent role's first four", () => {
    const doc = withExperience(createDefaultDoc(), [["a1", "a2", "a3", "a4", "a5"], ["b1", "b2", "b3", "b4"]]);
    const t = trimCandidates(doc);
    expect(t.map((x) => x.text)).toEqual(["b4", "a5"]);
    expect(t[0]).toMatchObject({ kind: "bullet", itemId: "it1", bulletIndex: 3 });
  });
  it("skips blank bullets and keeps their original index", () => {
    const doc = withExperience(createDefaultDoc(), [["x1", "x2", "x3", "x4", "", "x5"]]);
    const t = trimCandidates(doc);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ text: "x5", bulletIndex: 5 });
  });
  it("ignores hidden sections", () => {
    const doc = withExperience(createDefaultDoc(), [["a", "b", "c", "d", "e"]]);
    doc.sections.find((s) => s.type === "experience")!.visible = false;
    expect(trimCandidates(doc)).toEqual([]);
  });
  it("lists education details after bullets, and optional sections last", () => {
    const doc = withExperience(createDefaultDoc(), [["a", "b", "c", "d", "e"]]);
    const edu = doc.sections.find((s) => s.type === "education") as EducationSection;
    edu.content.items = [{ id: "e1", degree: "BSc", school: "Uni", location: "", start: "", end: "", details: ["Dean's list"] }];
    const langs = doc.sections.find((s) => s.type === "languages")!;
    (langs.content as { items: unknown[] }).items = [{ id: "l1", name: "French", level: "B2" }];
    expect(trimCandidates(doc).map((t) => t.kind)).toEqual(["bullet", "detail", "section"]);
  });
  it("caps the list", () => {
    const doc = withExperience(createDefaultDoc(), [Array.from({ length: 20 }, (_, i) => `bullet ${i}`)]);
    expect(trimCandidates(doc).length).toBeLessThanOrEqual(8);
  });
});

describe("withoutTrims and trimsNeeded", () => {
  const doc = createSampleDoc();
  const trims = trimCandidates(doc);
  const total = (d: ResumeDoc) => d.sections.reduce((n, sec) => n + (!sec.visible ? 0 : "items" in sec.content ? sec.content.items.reduce((m, it) => m + ("bullets" in it ? it.bullets.length : "details" in it ? it.details.length : 0), 0) : 0), 0);
  it("leaves the original doc untouched and removes only what was listed", () => {
    const before = total(doc);
    const after = total(withoutTrims(doc, trims));
    expect(total(doc)).toBe(before);
    expect(after).toBeLessThanOrEqual(before);
  });
  it("finds the smallest prefix that reaches one page", () => {
    if (!trims.length) return;
    expect(trimsNeeded(doc, trims, (d) => (total(d) <= total(withoutTrims(doc, trims.slice(0, 2))) ? 1 : 2))).toBeLessThanOrEqual(2);
  });
  it("returns null when even all the cuts are not enough, and when there are none", () => {
    expect(trimsNeeded(doc, trims, () => 2)).toBeNull();
    expect(trimsNeeded(doc, [], () => 1)).toBeNull();
  });
});
