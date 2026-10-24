"use client";
import { useDeferredValue, useMemo, useRef } from "react";
import { runAtsChecks, type AtsCheck } from "@/lib/ats";
import { matchJobDescription, MAX_JD_CHARS, type TermMatch } from "@/lib/jobmatch";
import { useJobPosting } from "@/lib/jobPostingStore";
import { summarizeChecks } from "@/lib/ui";
import type { ResumeDoc } from "@/lib/schema";
import { TextArea } from "./fields";
import { IconAlert, IconTick, IconWarn } from "./icons";

const WORD = { pass: "Passed", warn: "Review", fail: "Fix" } as const;

function Row({ c }: { c: AtsCheck }) {
  const pass = c.level === "pass";
  return (
    <li className={`flex gap-3 rounded-[var(--r-control)] ${pass ? "px-1 py-2.5" : "p-3"}`} style={pass ? undefined : { background: "var(--pen-soft)" }} data-level={c.level}>
      <span className={`mt-0.5 shrink-0 ${pass ? "text-[var(--tick-text)]" : "text-[var(--pen-text)]"}`}>
        {pass ? <IconTick size={20} /> : c.level === "fail" ? <IconAlert size={20} /> : <IconWarn size={20} />}
      </span>
      <p className="text-[0.9375rem] leading-snug">
        <strong className={`mr-1.5 font-semibold ${pass ? "sr-only" : "text-[var(--pen-text)]"}`}>{WORD[c.level]}:</strong>
        {c.message}
      </p>
    </li>
  );
}

function FoundRow({ t }: { t: TermMatch }) {
  return (
    <li className="flex gap-3 px-1 py-2.5">
      <span className="mt-0.5 shrink-0 text-[var(--tick-text)]"><IconTick size={20} /></span>
      <p className="min-w-0 break-words text-[0.9375rem] leading-snug">
        <strong className="font-semibold">{t.term}</strong>
        {t.hiddenOnly ? (
          <span className="ml-1.5 text-[var(--pen-text)]">only in a hidden section, so it won&apos;t be in the PDF</span>
        ) : (
          <span className="ml-1.5 text-[var(--text-muted)]">in {t.where.join(", ")}</span>
        )}
      </p>
    </li>
  );
}

/** Compares a pasted job posting with the resume. The posting stays in this browser and never reaches the export. */
function JobMatch({ doc }: { doc: ResumeDoc }) {
  const { text, setText, clear } = useJobPosting();
  const deferred = useDeferredValue(text);
  const { terms } = useMemo(() => matchJobDescription(doc, deferred), [doc, deferred]);
  const wrap = useRef<HTMLDivElement>(null);
  const missing = terms.filter((t) => !t.found && !t.hiddenOnly);
  const found = terms.filter((t) => t.found || t.hiddenOnly);
  const hasText = text.trim() !== "";
  let status = "";
  if (hasText && deferred === text) {
    status = terms.length === 0
      ? "No key terms found in this posting. Paste more of it."
      : `${found.length} of ${terms.length} key terms from this posting appear in your resume.`;
  }
  return (
    <div ref={wrap} className="space-y-4 border-t border-[var(--line)] pt-6" data-testid="jd-match">
      <h3 className="text-sm font-semibold">Match a job posting</h3>
      <TextArea label="Paste the job posting" rows={6} value={text} onChange={setText} hint="Stays in this browser. Not included in exports." />
      {text.length > MAX_JD_CHARS && <p className="field-hint">Only the first {MAX_JD_CHARS.toLocaleString("en-US")} characters are read.</p>}
      <p className="text-lg font-medium" role="status" data-testid="jd-summary">{status}</p>
      {hasText ? (
        <div className="space-y-6">
          {terms.length > 0 && (
            <>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Not found ({missing.length})</h4>
                {missing.length > 0 ? (
                  <ul className="flex flex-wrap gap-2" data-testid="jd-missing">
                    {missing.map((t) => (
                      <li key={t.term} className="max-w-full break-words rounded-[var(--r-control)] px-3 py-1.5 text-[0.9375rem] leading-snug text-[var(--pen-text)]" style={{ background: "var(--pen-soft)" }}>{t.term}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="field-hint">Every key term appears in your resume.</p>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Found ({found.length})</h4>
                {found.length > 0 ? (
                  <ul className="divide-y divide-[var(--line)]" data-testid="jd-found">{found.map((t) => <FoundRow key={t.term} t={t} />)}</ul>
                ) : (
                  <p className="field-hint">None of the key terms appear in your resume yet.</p>
                )}
              </div>
              <p className="field-hint">Add only terms that truly describe your experience.</p>
            </>
          )}
          <button type="button" className="btn" onClick={() => { clear(); wrap.current?.querySelector("textarea")?.focus(); }}>Clear</button>
        </div>
      ) : (
        <p className="rounded-[var(--r-control)] border border-dashed border-[var(--line-strong)] p-4 text-[0.9375rem] text-[var(--text-muted)]">Paste a job posting to see which of its key terms already appear in your resume and which are missing.</p>
      )}
    </div>
  );
}

export function AtsPanel({ doc }: { doc: ResumeDoc }) {
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
            <ul className="space-y-2">{review.map((c) => <Row key={c.id} c={c} />)}</ul>
          </div>
        ) : (
          <p className="rounded-[var(--r-control)] border border-dashed border-[var(--line-strong)] p-4 text-[0.9375rem] text-[var(--text-muted)]">Nothing to fix right now. Keep this tab in mind as you edit, since the checks run on every change.</p>
        )}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Passed ({passed.length})</h3>
          <ul className="divide-y divide-[var(--line)]">{passed.map((c) => <Row key={c.id} c={c} />)}</ul>
        </div>
      </div>
      <JobMatch doc={doc} />
    </section>
  );
}
