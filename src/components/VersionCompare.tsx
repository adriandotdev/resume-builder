"use client";
import { useEffect, useRef, useState } from "react";
import { diffCoverage, diffDocs, type DiffStatus, type EntryDiff, type SectionDiff } from "@/lib/diff";
import { useVersionIndex, versionsStore } from "@/lib/versionsStore";
import { IconClose, IconEdit, IconMinus, IconPlus, IconTick } from "./icons";

const STATUS: Record<DiffStatus, { word: string; icon: typeof IconTick }> = {
  added: { word: "Added", icon: IconPlus },
  removed: { word: "Removed", icon: IconMinus },
  changed: { word: "Changed", icon: IconEdit },
  same: { word: "Same", icon: IconTick },
};

/** Status is always an icon plus a word, never color alone. */
function StatusBadge({ status }: { status: DiffStatus }) {
  const { word, icon: Icon } = STATUS[status];
  return (
    <span className="inline-flex min-h-6 flex-none items-center gap-1.5 rounded-full border border-[var(--line-strong)] px-2.5 text-[0.8125rem] font-semibold">
      <Icon size={14} />{word}
    </span>
  );
}

const LINE: Record<"same" | "added" | "removed", { mark: string; word: string }> = {
  same: { mark: " ", word: "Unchanged" },
  added: { mark: "+", word: "Added" },
  removed: { mark: "−", word: "Removed" },
};

function EntryView({ entry, showSame, hideLabel }: { entry: EntryDiff; showSame: boolean; hideLabel: boolean }) {
  const lines = entry.status === "changed" && !showSame ? entry.lines.filter((l) => l.kind !== "same") : entry.lines;
  return (
    <li className="space-y-1.5 py-3" data-testid="diff-entry">
      {(!hideLabel || entry.status !== "changed") && (
        <p className="flex flex-wrap items-center gap-2 text-[0.9375rem] font-semibold">
          {!hideLabel && <span className="min-w-0 break-words">{entry.label}</span>}
          {entry.status !== "changed" && <StatusBadge status={entry.status} />}
        </p>
      )}
      {lines.length > 0 && (
        <ul className="space-y-0.5">
          {lines.map((l, i) => (
            <li key={i} className={`flex gap-2 text-[0.9375rem] leading-snug ${l.kind === "same" ? "text-[var(--text-muted)]" : ""}`} data-diff={l.kind}>
              <span aria-hidden="true" className="num w-4 flex-none text-center font-semibold">{LINE[l.kind].mark}</span>
              <span className="sr-only">{LINE[l.kind].word}: </span>
              <span className={`min-w-0 break-words ${l.kind === "removed" ? "line-through" : ""}`}>{l.text}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function SectionView({ section, showSame, n }: { section: SectionDiff; showSame: boolean; n: number }) {
  const entries = section.entries.filter((e) => showSame || e.status !== "same");
  return (
    <section className="well p-4" aria-labelledby={`diff-s-${n}`} data-testid="diff-section" data-status={section.status}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`diff-s-${n}`} className="serif min-w-0 break-words text-xl">{section.title}</h3>
        <StatusBadge status={section.status} />
        {section.notes.map((n) => <span key={n} className="text-[0.875rem] text-[var(--text-muted)]">{n}</span>)}
      </div>
      {entries.length > 0 && <ul className="mt-1 divide-y divide-[var(--line)]">{entries.map((e, i) => <EntryView key={i} entry={e} showSame={showSame} hideLabel={section.type === "contact" || section.type === "summary"} />)}</ul>}
    </section>
  );
}

function Terms({ title, terms, empty }: { title: string; terms: string[]; empty: string }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{title} ({terms.length})</h4>
      {terms.length ? (
        <ul className="flex flex-wrap gap-2">{terms.map((t) => <li key={t} className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[0.9375rem]">{t}</li>)}</ul>
      ) : <p className="field-hint">{empty}</p>}
    </div>
  );
}

/** Compare two saved versions: what changed in each section, and which posting terms each covers. */
export function VersionCompare({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const index = useVersionIndex();
  const [aId, setA] = useState(index.activeId);
  const [bId, setB] = useState(() => [...index.versions].filter((v) => v.id !== index.activeId).sort((x, y) => y.updatedAt - x.updatedAt)[0]?.id ?? index.activeId);
  const [showSame, setShowSame] = useState(false);
  const [postingOf, setPostingOf] = useState<"a" | "b">("b");
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => { back.current?.focus(); }, []);

  const a = versionsStore.getVersion(aId);
  const b = versionsStore.getVersion(bId);
  const same = aId === bId;
  const diff = a?.doc && b?.doc && !same ? diffDocs(a.doc, b.doc) : null;
  const jd = (postingOf === "a" ? a?.jd : b?.jd) ?? "";
  const coverage = a?.doc && b?.doc && !same && jd.trim() ? diffCoverage(a.doc, b.doc, jd) : null;

  const nameA = a?.meta.name ?? "A";
  const nameB = b?.meta.name ?? "B";
  const hiddenCount = diff ? diff.sections.filter((s) => s.status === "same").length : 0;
  const shown = diff ? diff.sections.filter((s) => showSame || s.status !== "same") : [];

  let summary = "";
  if (same) summary = "Pick two different versions to compare.";
  else if (!a?.doc || !b?.doc) summary = "One of these versions could not be read, so it cannot be compared.";
  else if (diff) {
    const { sectionsChanged: s, linesAdded: ad, linesRemoved: rm } = diff.totals;
    summary = s === 0 ? "These two versions have the same content." : `${s} ${s === 1 ? "section differs" : "sections differ"}: ${ad} ${ad === 1 ? "line" : "lines"} added, ${rm} removed.`;
  }

  return (
    <div className="p-5 sm:p-6" data-testid="compare-view">
      <div className="flex items-start justify-between gap-3">
        <h2 id="compare-h" className="display text-3xl">Compare versions</h2>
        <button type="button" className="btn btn-quiet btn-icon -mr-2" aria-label="Close" onClick={onClose}><IconClose /></button>
      </div>
      <p className="mt-2 text-[var(--text-muted)]">Shows what changed going from the first version to the second. Everything is read from this browser.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="field"><label htmlFor="compare-a">From</label>
          <select id="compare-a" className="input" value={aId} onChange={(e) => setA(e.target.value)} data-testid="compare-a">{index.versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
        <div className="field"><label htmlFor="compare-b">To</label>
          <select id="compare-b" className="input" value={bId} onChange={(e) => setB(e.target.value)} data-testid="compare-b">{index.versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
      </div>
      <div className="mt-2"><button type="button" className="btn" onClick={() => { setA(bId); setB(aId); }}>Swap</button></div>

      <p className="mt-4 text-lg font-medium" role="status" data-testid="compare-summary">{summary}</p>

      {diff && (
        <>
          <p className="field-hint mt-1"><span aria-hidden="true">+</span> added in {nameB} · <span aria-hidden="true">{"−"}</span> removed, only in {nameA}</p>
          <div className="mt-3 space-y-3">
            {shown.map((s, i) => <SectionView key={`${s.type}-${i}`} n={i} section={s} showSame={showSame} />)}
          </div>
          {hiddenCount > 0 && (
            <button type="button" className="btn mt-3" aria-pressed={showSame} onClick={() => setShowSame((v) => !v)} data-testid="compare-show-same">
              {showSame ? "Hide unchanged" : `Show unchanged (${hiddenCount} ${hiddenCount === 1 ? "section" : "sections"})`}
            </button>
          )}

          <div className="mt-6 space-y-4 border-t border-[var(--line)] pt-6" data-testid="compare-coverage">
            <h3 className="serif text-xl">Key terms covered</h3>
            <div className="field"><label htmlFor="compare-posting">Job posting</label>
              <select id="compare-posting" className="input sm:max-w-xs" value={postingOf} onChange={(e) => setPostingOf(e.target.value === "a" ? "a" : "b")}>
                <option value="b">From {nameB}</option><option value="a">From {nameA}</option>
              </select></div>
            {coverage ? (
              coverage.total === 0 ? <p className="field-hint">No key terms found in this posting.</p> : (
                <div className="space-y-4">
                  <Terms title="In both" terms={coverage.both} empty="No key term appears in both." />
                  <Terms title={`Only in ${nameA}`} terms={coverage.onlyA} empty="None." />
                  <Terms title={`Only in ${nameB}`} terms={coverage.onlyB} empty="None." />
                  <Terms title="In neither" terms={coverage.neither} empty="Every key term appears in at least one." />
                </div>
              )
            ) : <p className="rounded-[var(--r-control)] border border-dashed border-[var(--line-strong)] p-4 text-[0.9375rem] text-[var(--text-muted)]">That version has no job posting yet. Paste one in the ATS tab to compare coverage.</p>}
          </div>
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button ref={back} type="button" className="btn" onClick={onBack} data-testid="compare-back">Back to versions</button>
        <button type="button" className="btn" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
