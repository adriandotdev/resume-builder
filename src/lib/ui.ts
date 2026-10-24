/** Pure UI helpers (kept free of React so they can be unit tested in node). */
import type { AtsCheck } from "./ats";
import type { ResumeDoc } from "./schema";
import { createSampleDoc } from "./sample";

export const TEMPLATE_FILTERS = ["all", "simple", "modern", "compact", "bold", "formal", "first-job"] as const;
export type TemplateFilter = (typeof TEMPLATE_FILTERS)[number];

export function filterByTag<T extends { tags: readonly string[] }>(list: readonly T[], filter: TemplateFilter): T[] {
  return filter === "all" ? list.slice() : list.filter((t) => t.tags.includes(filter));
}

/** "Saved just now", "Saved 2 min ago"... */
export function formatSavedAgo(savedAt: number, now: number): string {
  const s = Math.max(0, Math.round((now - savedAt) / 1000));
  if (s < 15) return "Saved just now";
  if (s < 60) return `Saved ${s} seconds ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `Saved ${m} min ago`;
  const h = Math.round(m / 60);
  return `Saved ${h} hour${h === 1 ? "" : "s"} ago`;
}

/**
 * Where a dragged row would land. `mids` are the vertical midpoints of every row in
 * order (including the dragged one); the result is the index in the list after the
 * dragged row has been removed and re-inserted.
 */
export function dragTargetIndex(mids: readonly number[], from: number, y: number): number {
  let t = 0;
  mids.forEach((m, i) => { if (i !== from && y > m) t++; });
  return t;
}

export function summarizeChecks(checks: readonly AtsCheck[]) {
  const passed = checks.filter((c) => c.level === "pass");
  const review = checks.filter((c) => c.level !== "pass");
  return { passed, review, total: checks.length };
}

/** Insert `item` at `index` (clamped) without mutating. Used by Undo for removals. */
export function insertAt<T>(list: readonly T[], item: T, index: number): T[] {
  const i = Math.max(0, Math.min(list.length, index));
  return [...list.slice(0, i), item, ...list.slice(i)];
}

/** Accessible, ATS-friendly accent choices (all dark enough to print legibly). */
export const ACCENT_SWATCHES = [
  { name: "Navy", value: "#1f4e79" },
  { name: "Forest", value: "#1f6b4f" },
  { name: "Teal", value: "#0e7a68" },
  { name: "Plum", value: "#6b2d5c" },
  { name: "Brick", value: "#a23b2a" },
  { name: "Graphite", value: "#2b3640" },
] as const;

/** True while the document is still the untouched first-run sample. */
export function isSampleDoc(doc: ResumeDoc): boolean {
  const first = doc.sections[0];
  return first?.type === "contact" && first.id === "s-contact" && first.content.fullName === "Elena Marchetti";
}

/** True when the sections are exactly the first-run sample: nothing has been edited, moved or hidden. */
export function isPristineSample(doc: ResumeDoc): boolean {
  return JSON.stringify(doc.sections) === JSON.stringify(createSampleDoc().sections);
}

/** True when no section holds any text yet (a fresh blank resume). */
export function isEmptyDoc(doc: ResumeDoc): boolean {
  return doc.sections.every((s) => {
    if (s.type === "contact") return !s.content.fullName && !s.content.headline && !s.content.email && !s.content.phone && !s.content.location && s.content.links.length === 0;
    if (s.type === "summary") return !s.content.text.trim();
    return s.content.items.length === 0;
  });
}
