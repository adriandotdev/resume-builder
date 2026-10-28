"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { describePatch, currentFor, fitCandidates, FIT_FONT_FLOOR, FIT_LINE_FLOOR, overflowLines, pickFit, trimCandidates, trimsNeeded, type FitPatch, type FitResult, type TrimCandidate } from "@/lib/fit";
import { patchStyle, type BulletJump, type DesignJump, type FieldJump } from "@/lib/ops";
import type { ResumeDoc } from "@/lib/schema";
import { resumeStore } from "@/lib/store";
import { createMeasurer } from "./fitMeasure";
import { useToast } from "./Toast";

interface Measured { doc: ResumeDoc; pages: number; overflow: number; fit: FitResult | null; cuts: number | null }

const CONTROL_LABEL: Record<DesignJump["control"], string> = { fontSize: "font size", lineSpacing: "line spacing", margins: "margins" };

function controlsIn(patch: FitPatch): DesignJump["control"][] {
  const out: DesignJump["control"][] = [];
  if (patch.lineSpacing !== undefined) out.push("lineSpacing");
  if (patch.margins !== undefined) out.push("margins");
  if (patch.fontSize !== undefined) out.push("fontSize");
  return out;
}

const TRIMS_SHOWN = 4;

/** One line per changed style field, with the Design control it belongs to. describePatch and controlsIn walk the fields in the same order. */
function fitLines(style: ResumeDoc["style"], patch: FitPatch): { control: DesignJump["control"]; text: string }[] {
  const texts = describePatch(style, patch);
  return controlsIn(patch).map((control, i) => ({ control, text: texts[i] }));
}

/** The visible label of a trim's jump button; the accessible name starts with the same words. */
function trimLabel(t: TrimCandidate): string {
  if (t.kind === "section" || t.bulletIndex === undefined) return "Open section";
  return `${t.kind === "detail" ? "Edit detail" : "Edit bullet"} ${t.bulletIndex + 1}`;
}

/** What the measured cuts amount to, in the list's own order. */
function cutsNote(cuts: number): string {
  return cuts === 1 ? "Making the first cut below gets you to one page." : `Making the top ${cuts} cuts below gets you to one page.`;
}

/** Groups trim candidates by section, keeping the best-first order of each group's first row. */
function groupBySection(trims: TrimCandidate[]): { sectionId: string; title: string; rows: TrimCandidate[] }[] {
  const groups: { sectionId: string; title: string; rows: TrimCandidate[] }[] = [];
  for (const t of trims) {
    const g = groups.find((x) => x.sectionId === t.sectionId);
    if (g) g.rows.push(t);
    else groups.push({ sectionId: t.sectionId, title: t.sectionTitle, rows: [t] });
  }
  return groups;
}

function trimJump(t: TrimCandidate): BulletJump | FieldJump {
  if (t.kind === "section" || !t.itemId || t.bulletIndex === undefined) return { sectionId: t.sectionId, label: "" }; // opens the section; no input matches an empty label
  return { sectionId: t.sectionId, itemId: t.itemId, bulletIndex: t.bulletIndex };
}

/**
 * The smallest style change that fits one page, checked by laying the real template out off-screen,
 * plus places to cut if style alone is not enough. Suggestions only: Apply changes style, never content.
 */
export function FitPanel({ doc, onJump, onDesignJump }: { doc: ResumeDoc; onJump: (t: BulletJump | FieldJump) => void; onDesignJump: (t: DesignJump) => void }) {
  const toast = useToast();
  const [measured, setMeasured] = useState<Measured | null>(null);
  const trims = useMemo(() => trimCandidates(doc), [doc]);
  const [showAllTrims, setShowAllTrims] = useState(false);
  const [showCuts, setShowCuts] = useState(false); // cuts that cannot reach one page stay folded until asked for
  const headingRef = useRef<HTMLHeadingElement>(null);
  const applied = useRef(false); // the toast already announces an Apply, so its result is not announced twice
  const shownTrims = showAllTrims ? trims : trims.slice(0, TRIMS_SHOWN);
  const trimGroups = useMemo(() => groupBySection(shownTrims), [shownTrims]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      await document.fonts?.ready;
      if (cancelled) return;
      const m = createMeasurer();
      try {
        const cur = m.measure(doc);
        const fit = cur.pages > 1 ? pickFit(fitCandidates(doc.style), (patch) => m.measure(doc, patch).pages) : null;
        // The cuts are laid out too, so the panel only says they are enough when they are.
        const cuts = cur.pages > 1 ? trimsNeeded(doc, trims, (d) => m.measure(d).pages) : null;
        if (!cancelled) setMeasured({ doc, pages: cur.pages, overflow: overflowLines(cur.sheetH, cur.pageH, doc.style), fit, cuts });
      } finally {
        m.dispose();
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [doc, trims]);

  const ready = measured !== null && measured.doc === doc;
  const over = ready && measured.pages > 1;
  const quiet = applied.current && ready;
  useEffect(() => { if (ready) applied.current = false; }, [ready, measured]);

  const apply = (fit: FitResult) => {
    const before = currentFor(doc.style, fit.patch);
    resumeStore.update((d) => patchStyle(d, fit.patch));
    // Undo restores only the fields the fit changed, so edits made since are kept.
    applied.current = true;
    headingRef.current?.focus(); // the Apply button is about to unmount
    toast.show({ message: "Fitted to one page.", actionLabel: "Undo", onAction: () => resumeStore.update((d) => patchStyle(d, before)) });
  };

  const summary = !measured ? "Checking the page…" : !ready ? "Rechecking…" : measured.pages <= 1 ? "Fits on 1 page." : `Runs to ${measured.pages} pages, about ${measured.overflow} line${measured.overflow === 1 ? "" : "s"} over one page.`;

  return (
    <section aria-labelledby="fit-h" className="space-y-5">
      <div className="space-y-1.5">
        <h2 id="fit-h" ref={headingRef} tabIndex={-1} className="serif mb-1 text-2xl">One-page fit</h2>
        {/* Only the finished answer is announced; the transient "checking" line is visual. */}
        <div className="fit-status">
          <div role="status" aria-live={quiet ? "off" : "polite"} className="text-[0.9375rem] font-semibold" data-testid="fit-summary">{ready ? <span key={summary} className="fit-text">{summary}</span> : null}</div>
          {!ready && <p aria-hidden="true" className="text-[0.9375rem] font-semibold" data-testid="fit-checking"><span key={summary} className="fit-text">{summary}</span></p>}
        </div>
        <p className="field-hint">Finds the smallest style change that fits one page, checked on your real template. Nothing leaves this browser, and your wording is never changed.</p>
      </div>

      {over && measured.fit && (
        <div className="well fit-in space-y-3 p-4" data-testid="fit-suggestion">
          <h3 className="text-base font-semibold">Smallest change that fits</h3>
          <ul className="text-[0.9375rem]">
            {fitLines(doc.style, measured.fit.patch).map((l) => (
              <li key={l.control} className="flex items-center justify-between gap-3">
                <span>{l.text}</span>
                <button type="button" className="btn btn-quiet shrink-0" aria-label={`Adjust ${CONTROL_LABEL[l.control]}`} onClick={() => onDesignJump({ control: l.control })}>Adjust</button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary" onClick={() => apply(measured.fit!)} data-testid="fit-apply">Apply</button>
        </div>
      )}

      {over && !measured.fit && (
        <div className="well fit-in space-y-1.5 p-4" data-testid="fit-none">
          <p className="text-[0.9375rem]">Style changes cannot reach one page. {measured.cuts === null ? "Two pages is fine for many resumes." : cutsNote(measured.cuts)}</p>
          <p className="field-hint">Limits: {FIT_FONT_FLOOR} pt text, {FIT_LINE_FLOOR.toFixed(2)} line spacing, narrow margins. Smaller is hard to read.</p>
        </div>
      )}

      {over && !(measured.fit && measured.cuts === null) && (
        <div className="space-y-2" data-testid="fit-trims">
          {(measured.cuts !== null || showCuts) && <h3 className="text-base font-semibold">{measured.fit ? "Or keep your style and cut" : "Where to cut"}</h3>}
          {measured.fit && measured.cuts !== null && trims.length > 0 && <p className="field-hint">{cutsNote(measured.cuts)}</p>}
          {trims.length === 0 ? (
            <p className="text-[0.9375rem] text-[var(--text-muted)]">Nothing obvious to cut. Shorten the longest entries or merge small sections.</p>
          ) : (
            <div className="space-y-4">
              {measured.cuts === null && (
                <button type="button" className="btn" aria-expanded={showCuts} onClick={() => setShowCuts((v) => !v)}>{showCuts ? "Hide the cuts" : "Show where I could cut"}</button>
              )}
              {(measured.cuts !== null || showCuts) && trimGroups.map((g, gi) => (
                <div key={g.sectionId} className="fit-in space-y-1.5" style={{ "--i": Math.min(gi + 1, 4) } as CSSProperties}>
                  <h4 className="text-sm font-semibold">{g.title}</h4>
                  <ul className="space-y-1.5">
                    {g.rows.map((t, i) => (
                      <li key={t.id} className="rounded-[var(--r-control)] border border-[var(--line)] p-3">
                        <div className="min-w-0 space-y-1.5">
                          <p className="text-[0.9375rem] leading-snug">{t.itemLabel && t.itemLabel !== g.rows[i - 1]?.itemLabel && <strong className="mr-1.5 font-semibold">{t.itemLabel}:</strong>}{t.reason}</p>
                          {t.text && <p className="break-words text-sm text-[var(--text-muted)]">“{t.text}”</p>}
                          <button type="button" className="btn" onClick={() => onJump(trimJump(t))} aria-label={`${trimLabel(t)}, ${t.sectionTitle}${t.itemLabel ? `, ${t.itemLabel}` : ""}`}>{trimLabel(t)}</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {(measured.cuts !== null || showCuts) && trims.length > TRIMS_SHOWN && (
                <button type="button" className="btn btn-quiet" aria-expanded={showAllTrims} onClick={() => setShowAllTrims((v) => !v)}>{showAllTrims ? "Show fewer" : `Show ${trims.length - TRIMS_SHOWN} more`}</button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
