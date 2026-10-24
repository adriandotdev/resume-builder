import { describe, expect, it, vi } from "vitest";
import { dragTargetIndex, filterByTag, formatSavedAgo, insertAt, summarizeChecks, TEMPLATE_FILTERS } from "@/lib/ui";
import { TEMPLATES } from "@/templates/registry";
import { insertSection, removeSection, moveSection } from "@/lib/ops";
import { createSampleDoc } from "@/lib/sample";
import { createResumeStore, type KeyValueStorage } from "@/lib/store";
import { runAtsChecks } from "@/lib/ats";
import { createDefaultDoc } from "@/lib/schema";

describe("template filters", () => {
  it("every filter chip has at least one template and All returns all", () => {
    expect(filterByTag(TEMPLATES, "all")).toHaveLength(TEMPLATES.length);
    for (const f of TEMPLATE_FILTERS) expect(filterByTag(TEMPLATES, f).length).toBeGreaterThan(0);
  });
  it("filters by registry tags", () => {
    expect(filterByTag(TEMPLATES, "bold").map((t) => t.id)).toEqual(["bold"]);
    expect(filterByTag(TEMPLATES, "compact").map((t) => t.id)).toEqual(["compact", "academic", "technical"]);
  });
});

describe("saved indicator text", () => {
  it("reads naturally over time", () => {
    expect(formatSavedAgo(1000, 1000)).toBe("Saved just now");
    expect(formatSavedAgo(0, 30_000)).toBe("Saved 30 seconds ago");
    expect(formatSavedAgo(0, 150_000)).toMatch(/^Saved [23] min ago$/);
    expect(formatSavedAgo(0, 3_600_000)).toBe("Saved 1 hour ago");
  });
});

describe("drag reorder maths", () => {
  const mids = [50, 150, 250, 350];
  it("keeps position when released near the start point", () => {
    expect(dragTargetIndex(mids, 1, 150)).toBe(1);
  });
  it("moves down and up", () => {
    expect(dragTargetIndex(mids, 0, 360)).toBe(3);
    expect(dragTargetIndex(mids, 3, 10)).toBe(0);
    expect(dragTargetIndex(mids, 1, 260)).toBe(2);
  });
});

describe("undo helpers", () => {
  it("re-inserts a removed section at its old index", () => {
    const d = createSampleDoc();
    const s = d.sections[3];
    const removed = removeSection(d, s.id);
    expect(removed.sections).toHaveLength(d.sections.length - 1);
    expect(insertSection(removed, s, 3).sections.map((x) => x.id)).toEqual(d.sections.map((x) => x.id));
  });
  it("clamps out-of-range indexes", () => {
    expect(insertAt([1, 2], 9, 99)).toEqual([1, 2, 9]);
    expect(insertAt([1, 2], 9, -4)).toEqual([9, 1, 2]);
  });
  it("moveSection stays a pure permutation", () => {
    const d = createSampleDoc();
    expect(moveSection(d, 1, 3).sections.map((x) => x.id).sort()).toEqual(d.sections.map((x) => x.id).sort());
  });
});

describe("ATS check grouping", () => {
  it("sample has nothing to review; blank has items and passes", () => {
    expect(summarizeChecks(runAtsChecks(createSampleDoc())).review).toHaveLength(0);
    const blank = summarizeChecks(runAtsChecks(createDefaultDoc()));
    expect(blank.review.length).toBeGreaterThan(0);
    expect(blank.passed.length).toBeGreaterThan(0);
    expect(blank.review.length + blank.passed.length).toBe(blank.total);
  });
});

describe("store save tracking", () => {
  it("tracks pending and savedAt for the Saved indicator", () => {
    vi.useFakeTimers();
    const data = new Map<string, string>();
    const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
    const s = createResumeStore({ storage, debounceMs: 100 });
    expect(s.getSavedAt()).toBeNull();
    s.update((d) => d);
    expect(s.isPending()).toBe(true);
    vi.advanceTimersByTime(150);
    expect(s.isPending()).toBe(false);
    expect(typeof s.getSavedAt()).toBe("number");
    vi.useRealTimers();
  });
});

describe("sample and empty detection", () => {
  it("tells the untouched sample, a blank doc and a real resume apart", async () => {
    const { isSampleDoc, isEmptyDoc } = await import("@/lib/ui");
    const sample = createSampleDoc();
    expect(isSampleDoc(sample)).toBe(true);
    expect(isEmptyDoc(sample)).toBe(false);
    const blank = createDefaultDoc();
    expect(isSampleDoc(blank)).toBe(false);
    expect(isEmptyDoc(blank)).toBe(true);
    const named = { ...sample, sections: sample.sections.map((s) => (s.type === "contact" ? { ...s, content: { ...s.content, fullName: "Ana Reyes" } } : s)) };
    expect(isSampleDoc(named)).toBe(false);
  });
});

describe("pristine sample", () => {
  it("is false as soon as any sample content is edited, even with the sample name kept", async () => {
    const { isPristineSample, isSampleDoc } = await import("@/lib/ui");
    const sample = createSampleDoc();
    expect(isPristineSample(sample)).toBe(true);
    expect(isPristineSample({ ...sample, style: { ...sample.style, template: "modern" } })).toBe(true);
    const edited = { ...sample, sections: sample.sections.map((s) => (s.type === "summary" ? { ...s, content: { text: "My own summary." } } : s)) };
    expect(isSampleDoc(edited)).toBe(true);
    expect(isPristineSample(edited)).toBe(false);
    expect(isPristineSample(createDefaultDoc())).toBe(false);
  });
});
