"use client";
import { AnimatePresence, motion } from "motion/react";
import { EASE } from "@/lib/motion";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { runAtsChecks, type AtsCheck } from "@/lib/ats";
import { postingCoverage } from "@/lib/coverage";
import { matchJobDescription, MAX_JD_CHARS, type TermMatch } from "@/lib/jobmatch";
import { useJobPosting } from "@/lib/jobPostingStore";
import { addSkillTerm, patchSection, writeInTargets, type WriteInTarget } from "@/lib/ops";
import { resumeStore } from "@/lib/store";
import { groupByCategory } from "@/lib/termCategories";
import { useVersionIndex, versionsStore } from "@/lib/versionsStore";
import { useToast } from "./Toast";
import { summarizeChecks } from "@/lib/ui";
import type { ResumeDoc } from "@/lib/schema";
import { Segmented } from "./controls";
import { TextArea } from "./fields";
import { IconAlert, IconTick, IconWarn } from "./icons";

const WORD = { pass: "Passed", warn: "Review", fail: "Fix" } as const;

function Row({ c }: { c: AtsCheck }) {
  const pass = c.level === "pass";
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.2, ease: EASE }} className={`flex gap-3 rounded-[var(--r-control)] ${pass ? "px-1 py-2.5" : "p-3"}`} style={pass ? undefined : { background: "var(--pen-soft)" }} data-level={c.level}>
      <span className={`mt-0.5 shrink-0 ${pass ? "text-[var(--tick-text)]" : "text-[var(--pen-text)]"}`}>
        {pass ? <IconTick size={20} /> : c.level === "fail" ? <IconAlert size={20} /> : <IconWarn size={20} />}
      </span>
      <p className="text-[0.9375rem] leading-snug">
        <strong className={`mr-1.5 font-semibold ${pass ? "sr-only" : "text-[var(--pen-text)]"}`}>{WORD[c.level]}:</strong>
        {c.message}
      </p>
    </motion.li>
  );
}

function FoundRow({ t }: { t: TermMatch }) {
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.2, ease: EASE }} className="flex gap-3 px-1 py-2.5">
      <span className="mt-0.5 shrink-0 text-[var(--tick-text)]"><IconTick size={20} /></span>
      <p className="min-w-0 break-words text-[0.9375rem] leading-snug">
        <strong className="font-semibold">{t.term}</strong>
        <span className="ml-1.5 text-[var(--text-muted)]">in {t.where.join(", ")}{t.matchedAs ? `, written as "${t.matchedAs}"` : ""}</span>
      </p>
    </motion.li>
  );
}

/** A term the resume has only in a hidden section: it is not in the PDF, so it is not counted as found. */
function HiddenRow({ t, onShow }: { t: TermMatch; onShow: (id: string) => void }) {
  const first = t.hiddenIn[0];
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.2, ease: EASE }} className="space-y-2 rounded-[var(--r-control)] p-3" style={{ background: "var(--pen-soft)" }} data-hidden-term={t.term}>
      <div className="flex gap-3">
        <span className="mt-0.5 shrink-0 text-[var(--pen-text)]"><IconWarn size={20} /></span>
        <p className="min-w-0 break-words text-[0.9375rem] leading-snug">
          <strong className="font-semibold">{t.term}</strong>
          <span className="ml-1.5 text-[var(--pen-text)]">is only in your hidden {t.hiddenIn.map((h) => h.title).join(", ")} section, so it won&apos;t be in the PDF.</span>
        </p>
      </div>
      <button type="button" className="btn" data-show-section={first.id} onClick={() => onShow(first.id)}>Show {first.title}<span className="sr-only"> section, for {t.term}</span></button>
    </motion.li>
  );
}

function MissingRow({ t, targets, onWriteIn, onAdd, onSkip }: { t: TermMatch; targets: WriteInTarget[]; onWriteIn?: (target: WriteInTarget, term: string) => void; onAdd: () => void; onSkip: () => void }) {
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.2, ease: EASE }} className="space-y-2 px-1 py-3">
      <p className="min-w-0 break-words text-[0.9375rem] font-semibold leading-snug">{t.term}</p>
      {t.alsoCounts && <p className="field-hint">Also counts: {t.alsoCounts.slice(0, 3).join(", ")}</p>}
      <div className="flex flex-wrap gap-2">
        {targets.map((target) => (
          <button key={target} type="button" className="btn" data-write-in={target} onClick={() => onWriteIn?.(target, t.term)}>Write in {target === "summary" ? "Summary" : "Experience"}<span className="sr-only">, for {t.term}</span></button>
        ))}
        <button type="button" className={targets.length > 0 ? "btn btn-quiet" : "btn"} data-add-term={t.term} onClick={onAdd}>Add to Skills<span className="sr-only">, for {t.term}</span></button>
        <button type="button" className="btn btn-quiet" data-skip-term={t.term} onClick={onSkip}>Skip<span className="sr-only">, for {t.term}</span></button>
      </div>
    </motion.li>
  );
}

/** Adds a term to Skills with an Undo toast. `label` names the Skills group; without it the term goes to "Additional skills". */
function useAddToSkills() {
  const toast = useToast();
  return (term: string, label?: string) => {
    const previous = resumeStore.getState();
    resumeStore.update((d) => addSkillTerm(d, term, label));
    toast.show({ message: label ? `Added "${term}" to ${label} in Skills.` : `Added "${term}" to Skills.`, actionLabel: "Undo", onAction: () => resumeStore.setDoc(previous) });
  };
}

/** Makes a hidden section visible again, with an Undo toast. */
function useShowSection() {
  const toast = useToast();
  return (id: string) => {
    const previous = resumeStore.getState();
    const title = previous.sections.find((s) => s.id === id)?.title;
    resumeStore.update((d) => patchSection(d, id, (s) => ({ ...s, visible: true })));
    toast.show({ message: `${title ?? "Section"} is visible again.`, actionLabel: "Undo", onAction: () => resumeStore.setDoc(previous) });
  };
}

/** How the resume covers every saved posting, and which key terms are missing from more than one. Counts only, no score. */
function AllPostings({ doc, activeText, addToSkills }: { doc: ResumeDoc; activeText: string; addToSkills: (term: string) => void }) {
  const index = useVersionIndex();
  const deferredDoc = useDeferredValue(doc);
  const { postings, shared } = useMemo(
    // `index` and `activeText` are not read here, but a switched version or an edited posting changes what listPostings returns.
    () => { void index; void activeText; return postingCoverage(deferredDoc, versionsStore.listPostings()); },
    [deferredDoc, index, activeText],
  );
  if (postings.length < 2) return null;
  return (
    <details className="rounded-[var(--r-control)] border border-[var(--line)] p-3" data-testid="jd-all">
      <summary className="cursor-pointer text-sm font-semibold">Across all your postings ({postings.length})</summary>
      <div className="mt-3 space-y-5">
        <ul className="divide-y divide-[var(--line)]" data-testid="jd-all-list">
          {postings.map((p) => (
            <li key={p.id} className="px-1 py-2.5 text-[0.9375rem] leading-snug"><strong className="font-semibold">{p.name}:</strong> {p.found} of {p.total} key terms appear in your resume.</li>
          ))}
        </ul>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold" tabIndex={-1} data-all-heading>Missing from more than one posting ({shared.length})</h4>
          {shared.length > 0 ? (
            <ul className="divide-y divide-[var(--line)]" data-testid="jd-shared">
              {shared.map((g) => (
                <li key={g.key} className="space-y-2 px-1 py-3">
                  <p className="min-w-0 break-words text-[0.9375rem] leading-snug"><strong className="font-semibold text-[var(--pen-text)]">{g.term}</strong><span className="ml-1.5 text-[var(--text-muted)]">in {g.postings.join(", ")}</span></p>
                  <button type="button" className="btn" data-add-shared={g.term} onClick={() => { addToSkills(g.term); requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-all-heading]")?.focus()); }}>Add to Skills<span className="sr-only">, for {g.term}</span></button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field-hint">No key term is missing from more than one posting.</p>
          )}
        </div>
      </div>
    </details>
  );
}

type MatchView = "status" | "category";

/** Compares a pasted job posting with the resume. The posting stays in this browser and never reaches the export. */
function JobMatch({ doc, onWriteIn }: { doc: ResumeDoc; onWriteIn?: (target: WriteInTarget, term: string) => void }) {
  const { text, setText, clear, skipped, skip, unskip } = useJobPosting();
  const deferred = useDeferredValue(text);
  const { terms } = useMemo(() => matchJobDescription(doc, deferred), [doc, deferred]);
  const wrap = useRef<HTMLDivElement>(null);
  const addToSkills = useAddToSkills();
  const showSection = useShowSection();
  const [view, setView] = useState<MatchView>("status");
  const targets = onWriteIn ? writeInTargets(doc) : [];
  const skippedTerms = terms.filter((t) => !t.found && !t.hiddenOnly && skipped.includes(t.key));
  const missing = terms.filter((t) => !t.found && !t.hiddenOnly && !skipped.includes(t.key));
  const hidden = terms.filter((t) => t.hiddenOnly);
  const found = terms.filter((t) => t.found);
  const groups = useMemo(() => groupByCategory(terms), [terms]);
  const hasText = text.trim() !== "";
  // The missing terms in the order they are shown, so focus can move to the next one after an add.
  const order = view === "status" ? missing : groups.flatMap((g) => g.items.filter((t) => missing.includes(t)));
  /** Moves focus to the next undecided term (or the heading) once `t` has left the list. */
  const advanceFrom = (t: TermMatch) => {
    const index = order.indexOf(t);
    const next = order[index + 1] ?? order[index - 1];
    requestAnimationFrame(() => {
      const target = next && [...(wrap.current?.querySelectorAll<HTMLElement>("[data-add-term]") ?? [])].find((b) => b.dataset.addTerm === next.term);
      (target ?? wrap.current?.querySelector<HTMLElement>("[data-missing-heading]"))?.focus();
    });
  };
  const addTerm = (t: TermMatch, label?: string) => { addToSkills(t.term, label); advanceFrom(t); };
  const skipTerm = (t: TermMatch) => { skip(t.key); advanceFrom(t); };
  let status = "";
  if (hasText && deferred === text) {
    status = terms.length === 0
      ? "No key terms found in this posting. Paste more of it."
      : `${found.length} of ${terms.length} key terms from this posting appear in your resume.${hidden.length > 0 ? ` ${hidden.length} more ${hidden.length === 1 ? "is" : "are"} only in a hidden section.` : ""}`;
  }
  return (
    <div ref={wrap} className="space-y-4 border-t border-[var(--line)] pt-6" data-testid="jd-match">
      <h3 className="serif text-xl">Match a job posting</h3>
      <TextArea label="Paste the job posting" rows={6} value={text} onChange={setText} hint="Stays in this browser. Not included in exports." />
      {text.length > MAX_JD_CHARS && <p className="field-hint">Only the first {MAX_JD_CHARS.toLocaleString("en-US")} characters are read.</p>}
      <p className="text-lg font-medium" role="status" data-testid="jd-summary">{status}</p>
      {hasText ? (
        <div className="space-y-6">
          {terms.length > 0 && (
            <>
              <Segmented legend="Group key terms" value={view} onChange={setView} options={[{ value: "status", label: "By status" }, { value: "category", label: "By category" }]} />
              {view === "status" ? (
                <>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold" tabIndex={-1} data-missing-heading>Not found ({missing.length})</h4>
                    <p className="field-hint">Add only terms that truly describe your experience. Skip the rest.</p>
                    {missing.length > 0 ? (
                      <ul className="divide-y divide-[var(--line)]" data-testid="jd-missing">
                        <AnimatePresence initial={false} mode="popLayout">
                          {missing.map((t) => <MissingRow key={t.term} t={t} targets={targets} onWriteIn={onWriteIn} onAdd={() => addTerm(t)} onSkip={() => skipTerm(t)} />)}
                        </AnimatePresence>
                      </ul>
                    ) : (
                      <p className="field-hint">{skippedTerms.length > 0 ? "No terms left to decide." : "No key term is missing from your resume."}</p>
                    )}
                  </div>
                  {hidden.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Hidden, not in the PDF ({hidden.length})</h4>
                      <ul className="space-y-2" data-testid="jd-hidden"><AnimatePresence initial={false}>{hidden.map((t) => <HiddenRow key={t.term} t={t} onShow={showSection} />)}</AnimatePresence></ul>
                    </div>
                  )}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Found ({found.length})</h4>
                    {found.length > 0 ? (
                      <ul className="divide-y divide-[var(--line)]" data-testid="jd-found"><AnimatePresence initial={false}>{found.map((t) => <FoundRow key={t.term} t={t} />)}</AnimatePresence></ul>
                    ) : (
                      <p className="field-hint">None of the key terms appear in your resume yet.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-6" data-testid="jd-categories">
                  <h4 className="sr-only" tabIndex={-1} data-missing-heading>Key terms by category</h4>
                  <p className="field-hint">Add only terms that truly describe your experience. Skip the rest.</p>
                  {groups.map(({ category, items }) => {
                    const gMissing = items.filter((t) => missing.includes(t));
                    const gHidden = items.filter((t) => t.hiddenOnly);
                    const gFound = items.filter((t) => t.found);
                    const label = category === "Other" ? undefined : category;
                    return (
                      <section key={category} className="space-y-2" aria-label={category} data-category={category}>
                        <h4 className="text-sm font-semibold">{category} <span className="font-normal text-[var(--text-muted)]">({gFound.length} of {items.length} found)</span></h4>
                        {gMissing.length > 0 && (
                          <ul className="divide-y divide-[var(--line)]" data-testid="jd-cat-missing">
                            <AnimatePresence initial={false} mode="popLayout">
                              {gMissing.map((t) => <MissingRow key={t.term} t={t} targets={targets} onWriteIn={onWriteIn} onAdd={() => addTerm(t, label)} onSkip={() => skipTerm(t)} />)}
                            </AnimatePresence>
                          </ul>
                        )}
                        {gHidden.length > 0 && (
                          <ul className="space-y-2" data-testid="jd-cat-hidden"><AnimatePresence initial={false}>{gHidden.map((t) => <HiddenRow key={t.term} t={t} onShow={showSection} />)}</AnimatePresence></ul>
                        )}
                        {gFound.length > 0 && (
                          <ul className="divide-y divide-[var(--line)]" data-testid="jd-cat-found"><AnimatePresence initial={false}>{gFound.map((t) => <FoundRow key={t.term} t={t} />)}</AnimatePresence></ul>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
              {skippedTerms.length > 0 && (
                <details className="rounded-[var(--r-control)] border border-[var(--line)] p-3" data-testid="jd-skipped">
                  <summary className="cursor-pointer text-sm font-semibold">Skipped ({skippedTerms.length})</summary>
                  <ul className="mt-2 divide-y divide-[var(--line)]">
                    {skippedTerms.map((t) => (
                      <li key={t.key} className="flex flex-wrap items-center justify-between gap-2 px-1 py-2">
                        <span className="min-w-0 break-words text-[0.9375rem]">{t.term}</span>
                        <button type="button" className="btn btn-quiet" data-unskip-term={t.term} onClick={() => unskip(t.key)}>Restore<span className="sr-only">, for {t.term}</span></button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
          <button type="button" className="btn" onClick={() => { clear(); wrap.current?.querySelector("textarea")?.focus(); }}>Clear</button>
        </div>
      ) : (
        <p className="rounded-[var(--r-control)] border border-dashed border-[var(--line-strong)] p-4 text-[0.9375rem] text-[var(--text-muted)]">Paste a job posting to see which of its key terms already appear in your resume and which are missing.</p>
      )}
      <AllPostings doc={doc} activeText={text} addToSkills={addToSkills} />
    </div>
  );
}

export function AtsPanel({ doc, onWriteIn }: { doc: ResumeDoc; onWriteIn?: (target: WriteInTarget, term: string) => void }) {
  const checks = useMemo(() => runAtsChecks(doc), [doc]);
  const { passed, review } = summarizeChecks(checks);
  const issues = review.length;
  return (
    <section aria-labelledby="ats-h" className="space-y-5">
      <div>
        <h2 id="ats-h" className="serif text-2xl">ATS check</h2>
        <p className="field-hint mt-1">Rule-based checks of common ATS-safe practice. They are not a score from a real applicant tracking system.</p>
      </div>
      <p className="text-lg font-medium" role="status" data-testid="ats-summary">{issues === 0 ? "No issues found." : `${issues} item${issues === 1 ? "" : "s"} to review.`}</p>
      <div className="space-y-6" data-testid="ats-list">
        {issues > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">To review ({issues})</h3>
            <ul className="space-y-2"><AnimatePresence initial={false}>{review.map((c) => <Row key={c.id} c={c} />)}</AnimatePresence></ul>
          </div>
        ) : (
          <p className="rounded-[var(--r-control)] border border-dashed border-[var(--line-strong)] p-4 text-[0.9375rem] text-[var(--text-muted)]">Nothing to fix right now. Keep this tab in mind as you edit, since the checks run on every change.</p>
        )}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Passed ({passed.length})</h3>
          <ul className="divide-y divide-[var(--line)]"><AnimatePresence initial={false}>{passed.map((c) => <Row key={c.id} c={c} />)}</AnimatePresence></ul>
        </div>
      </div>
      <JobMatch doc={doc} onWriteIn={onWriteIn} />
    </section>
  );
}
