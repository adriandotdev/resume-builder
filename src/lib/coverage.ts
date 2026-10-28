import { matchJobDescription } from "./jobmatch";
import type { ResumeDoc } from "./schema";

export interface PostingInput { id: string; name: string; jd: string }
export interface PostingCoverage { id: string; name: string; found: number; total: number; missing: string[] }
export interface SharedGap { term: string; key: string; postings: string[] }

/**
 * How one resume covers each saved posting, and which key terms are missing from more than one of
 * them. Counts only, never a score. A term only in a hidden section does not count as found, because it
 * will not be in the PDF; postings without text are skipped.
 */
export function postingCoverage(doc: ResumeDoc, postings: PostingInput[]): { postings: PostingCoverage[]; shared: SharedGap[] } {
  const rows: PostingCoverage[] = [];
  const gaps = new Map<string, SharedGap>();
  for (const p of postings) {
    if (!p.jd.trim()) continue;
    const { terms } = matchJobDescription(doc, p.jd);
    if (terms.length === 0) continue;
    const missing = terms.filter((t) => !t.found);
    rows.push({ id: p.id, name: p.name, found: terms.length - missing.length, total: terms.length, missing: missing.map((t) => t.term) });
    for (const t of missing) {
      const gap = gaps.get(t.key);
      if (gap) gap.postings.push(p.name);
      else gaps.set(t.key, { term: t.term, key: t.key, postings: [p.name] });
    }
  }
  const shared = [...gaps.values()].filter((g) => g.postings.length > 1).sort((a, b) => b.postings.length - a.postings.length || a.term.localeCompare(b.term));
  return { postings: rows, shared };
}
