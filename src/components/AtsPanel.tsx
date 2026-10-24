"use client";
import { useMemo } from "react";
import { runAtsChecks, type AtsCheck } from "@/lib/ats";
import { summarizeChecks } from "@/lib/ui";
import type { ResumeDoc } from "@/lib/schema";
import { IconAlert, IconTick, IconWarn } from "./icons";

const WORD = { pass: "Passed", warn: "Review", fail: "Fix" } as const;

function Row({ c }: { c: AtsCheck }) {
  const pass = c.level === "pass";
  return (
    <li className={`flex gap-3 rounded-[10px] ${pass ? "px-1 py-2.5" : "p-3"}`} style={pass ? undefined : { background: "var(--pen-soft)" }} data-level={c.level}>
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
          <p className="rounded-[10px] border border-dashed border-[var(--line-strong)] p-4 text-[0.9375rem] text-[var(--text-muted)]">Nothing to fix right now. Keep this tab in mind as you edit, since the checks run on every change.</p>
        )}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Passed ({passed.length})</h3>
          <ul className="divide-y divide-[var(--line)]">{passed.map((c) => <Row key={c.id} c={c} />)}</ul>
        </div>
      </div>
    </section>
  );
}
