/**
 * Compare two resume docs: which sections and lines were added, removed or changed, and which
 * key terms of a job posting each one covers. Pure and rule-based, like `ats.ts` and `jobmatch.ts`.
 * Counts and lists only, no score.
 */
import { formatRange, STANDARD_TITLES, type ResumeDoc, type Section, type SectionType } from "./schema";
import { matchJobDescription } from "./jobmatch";

export type DiffStatus = "added" | "removed" | "changed" | "same";
export interface LineDiff { kind: "same" | "added" | "removed"; text: string }
export interface EntryDiff { label: string; status: DiffStatus; lines: LineDiff[] }
export interface SectionDiff {
  type: SectionType;
  title: string;
  status: DiffStatus;
  /** Plain-words reasons beyond line edits: renamed, moved, hidden or shown. */
  notes: string[];
  entries: EntryDiff[];
}
export interface DiffTotals { sectionsChanged: number; linesAdded: number; linesRemoved: number }
export interface DocDiff { sections: SectionDiff[]; totals: DiffTotals }

/** What a section looks like to the diff: one entry per item, each a list of comparable lines. */
interface Entry { id: string; label: string; lines: string[] }

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const nonEmpty = (lines: string[]) => lines.map(clean).filter(Boolean);
const DATE_FORMAT = "MMM YYYY"; // fixed, so a different date style alone never shows as a change

function entriesOf(s: Section): Entry[] {
  switch (s.type) {
    case "contact": {
      const c = s.content;
      const lines = nonEmpty([
        c.fullName && `Name: ${c.fullName}`, c.headline && `Headline: ${c.headline}`, c.email && `Email: ${c.email}`,
        c.phone && `Phone: ${c.phone}`, c.location && `Location: ${c.location}`, ...c.links.map((l) => `Link: ${l}`),
      ].filter((x): x is string => !!x));
      return [{ id: s.id, label: "Contact", lines }];
    }
    case "summary":
      return [{ id: s.id, label: "Summary", lines: nonEmpty(s.content.text.split("\n")) }];
    case "experience":
      return s.content.items.map((i) => ({
        id: i.id,
        label: clean([i.role, i.org].filter(Boolean).join(", ")) || "Untitled role",
        lines: nonEmpty([i.role, i.org, i.location, formatRange(i.start, i.end, i.current, DATE_FORMAT), ...i.bullets]),
      }));
    case "education":
      return s.content.items.map((i) => ({
        id: i.id,
        label: clean([i.degree, i.school].filter(Boolean).join(", ")) || "Untitled education",
        lines: nonEmpty([i.degree, i.school, i.location, formatRange(i.start, i.end, false, DATE_FORMAT), ...i.details]),
      }));
    case "skills":
      return s.content.items.map((i) => ({
        id: i.id,
        label: clean(i.label) || "Skills",
        lines: nonEmpty(i.skills.split(",")),
      }));
    case "projects":
      return s.content.items.map((i) => ({
        id: i.id,
        label: clean(i.name) || "Untitled project",
        lines: nonEmpty([i.name, i.link, formatRange(i.start, i.end, false, DATE_FORMAT), ...i.bullets]),
      }));
    case "certifications":
      return s.content.items.map((i) => ({ id: i.id, label: clean(i.name) || "Untitled certification", lines: nonEmpty([i.name, i.issuer, i.date]) }));
    case "languages":
      return s.content.items.map((i) => ({ id: i.id, label: clean(i.name) || "Untitled language", lines: nonEmpty([i.name, i.level]) }));
    case "custom":
      return s.content.items.map((i) => ({ id: i.id, label: clean(i.text).slice(0, 48) || "Empty line", lines: nonEmpty([i.text]) }));
  }
}

/**
 * Longest common subsequence alignment. Returns index pairs in order: [a, b] for a shared item,
 * [a, -1] for one only in `a`, [-1, b] for one only in `b`.
 */
export function align(a: string[], b: string[]): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const out: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { out.push([i++, j++]); }
    else if (j >= m || (i < n && dp[i + 1][j] >= dp[i][j + 1])) out.push([i++, -1]);
    else out.push([-1, j++]);
  }
  return out;
}

export function diffLines(a: string[], b: string[]): LineDiff[] {
  return align(a, b).map(([i, j]): LineDiff => (i >= 0 && j >= 0 ? { kind: "same", text: b[j] } : i >= 0 ? { kind: "removed", text: a[i] } : { kind: "added", text: b[j] }));
}

const lower = (s: string) => clean(s).toLowerCase();

/** Pair up items of A and B: by id first, then by label for the ones left over. Returns [aIndex, bIndex] with -1 for none. */
function pair<T>(a: T[], b: T[], id: (x: T) => string, key: (x: T) => string): Array<[number, number]> {
  const bOfA = new Map<number, number>();
  const usedB = new Set<number>();
  const link = (k: (x: T) => string) => {
    const free = new Map<string, number[]>();
    b.forEach((x, j) => { if (!usedB.has(j)) free.set(k(x), [...(free.get(k(x)) ?? []), j]); });
    a.forEach((x, i) => {
      if (bOfA.has(i)) return;
      const j = free.get(k(x))?.shift();
      if (j !== undefined) { bOfA.set(i, j); usedB.add(j); }
    });
  };
  link(id);
  link(key);
  const out: Array<[number, number]> = [];
  b.forEach((_, j) => {
    const i = [...bOfA].find(([, bj]) => bj === j)?.[0];
    out.push([i ?? -1, j]);
  });
  a.forEach((_, i) => { if (!bOfA.has(i)) out.push([i, -1]); });
  return out;
}

function diffEntries(a: Entry[], b: Entry[]): EntryDiff[] {
  return pair(a, b, (e) => e.id, (e) => lower(e.label)).map(([i, j]): EntryDiff => {
    if (i < 0) return { label: b[j].label, status: "added", lines: b[j].lines.map((text) => ({ kind: "added", text })) };
    if (j < 0) return { label: a[i].label, status: "removed", lines: a[i].lines.map((text) => ({ kind: "removed", text })) };
    const lines = diffLines(a[i].lines, b[j].lines);
    return { label: b[j].label, status: lines.every((l) => l.kind === "same") ? "same" : "changed", lines };
  });
}

const sectionTitle = (s: Section) => clean(s.title) || STANDARD_TITLES[s.type];

export function diffDocs(a: ResumeDoc, b: ResumeDoc): DocDiff {
  const pairs = pair(a.sections, b.sections, (s) => s.id, (s) => `${s.type}:${lower(sectionTitle(s))}`);

  // A section is "moved" when its order among the shared sections changed. LCS keeps one move
  // from flagging every section it jumped over.
  const shared = pairs.filter(([i, j]) => i >= 0 && j >= 0);
  const orderA = shared.map(([i]) => i).sort((x, y) => x - y).map(String);
  const orderB = shared.map(([i]) => String(i));
  const stable = new Set(align(orderA, orderB).filter(([x, y]) => x >= 0 && y >= 0).map(([x]) => orderA[x]));

  const sections: SectionDiff[] = pairs.map(([i, j]): SectionDiff => {
    if (i < 0) {
      const s = b.sections[j];
      return { type: s.type, title: sectionTitle(s), status: "added", notes: s.visible ? [] : ["Hidden"], entries: diffEntries([], entriesOf(s)) };
    }
    if (j < 0) {
      const s = a.sections[i];
      return { type: s.type, title: sectionTitle(s), status: "removed", notes: s.visible ? [] : ["Hidden"], entries: diffEntries(entriesOf(s), []) };
    }
    const sa = a.sections[i];
    const sb = b.sections[j];
    const entries = diffEntries(entriesOf(sa), entriesOf(sb));
    const notes: string[] = [];
    if (sectionTitle(sa) !== sectionTitle(sb)) notes.push(`Renamed from “${sectionTitle(sa)}”`);
    if (!stable.has(String(i))) notes.push("Moved");
    if (sa.visible !== sb.visible) notes.push(sb.visible ? "Now shown" : "Now hidden");
    const edited = entries.some((e) => e.status !== "same");
    return { type: sb.type, title: sectionTitle(sb), status: edited || notes.length ? "changed" : "same", notes, entries };
  });

  const totals: DiffTotals = { sectionsChanged: 0, linesAdded: 0, linesRemoved: 0 };
  for (const s of sections) {
    if (s.status !== "same") totals.sectionsChanged++;
    for (const e of s.entries) for (const l of e.lines) {
      if (l.kind === "added") totals.linesAdded++;
      else if (l.kind === "removed") totals.linesRemoved++;
    }
  }
  return { sections, totals };
}

export interface Coverage { both: string[]; onlyA: string[]; onlyB: string[]; neither: string[]; total: number }

/** Which key terms of one posting each resume covers. Hidden-only mentions do not count, as in the ATS tab. */
export function diffCoverage(a: ResumeDoc, b: ResumeDoc, jd: string): Coverage {
  const inB = new Map(matchJobDescription(b, jd).terms.map((t) => [t.term, t.found]));
  const out: Coverage = { both: [], onlyA: [], onlyB: [], neither: [], total: 0 };
  for (const t of matchJobDescription(a, jd).terms) {
    const fb = inB.get(t.term) ?? false;
    (t.found ? (fb ? out.both : out.onlyA) : fb ? out.onlyB : out.neither).push(t.term);
    out.total++;
  }
  return out;
}
