"use client";
import { AnimatePresence, motion } from "motion/react";
import { EASE } from "@/lib/motion";
import { useMemo } from "react";
import { RULE_LABEL, runCoach, type CoachFinding } from "@/lib/coach";
import type { BulletJump } from "@/lib/ops";
import type { ResumeDoc } from "@/lib/schema";
import { IconWarn } from "./icons";

interface Group { key: string; sectionTitle: string; itemLabel: string; findings: CoachFinding[] }

function groupFindings(findings: CoachFinding[]): Group[] {
  const groups: Group[] = [];
  for (const f of findings) {
    const key = `${f.sectionId}:${f.itemId}`;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, sectionTitle: f.sectionTitle, itemLabel: f.itemLabel, findings: [] }));
    g.findings.push(f);
  }
  return groups;
}

function Row({ f, onJump }: { f: CoachFinding; onJump: (t: BulletJump) => void }) {
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.2, ease: EASE }} className="flex gap-3 rounded-[var(--r-control)] p-3" style={{ background: "var(--pen-soft)" }} data-rule={f.rule}>
      <span className="mt-0.5 shrink-0 text-[var(--pen-text)]"><IconWarn size={20} /></span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-[0.9375rem] leading-snug">
          <strong className="mr-1.5 font-semibold text-[var(--pen-text)]">{RULE_LABEL[f.rule]}:</strong>
          {f.message}
        </p>
        <p className="break-words text-sm text-[var(--text-muted)]">“{f.text}”</p>
        <button type="button" className="btn" onClick={() => onJump({ sectionId: f.sectionId, itemId: f.itemId, bulletIndex: f.bulletIndex })} aria-label={`Go to bullet ${f.bulletIndex + 1} of ${f.itemLabel}: ${RULE_LABEL[f.rule]}`}>Go to bullet</button>
      </div>
    </motion.li>
  );
}

/** Wording suggestions for each bullet. Rule-based and local; each one names the phrase it is about. */
export function CoachPanel({ doc, onJump }: { doc: ResumeDoc; onJump: (target: BulletJump) => void }) {
  const findings = useMemo(() => runCoach(doc), [doc]);
  const groups = useMemo(() => groupFindings(findings), [findings]);
  return (
    <section aria-labelledby="coach-h" className="space-y-5">
      <div>
        <h2 id="coach-h" className="serif text-2xl">Bullet coach</h2>
        <p className="field-hint mt-1">Rule-based wording checks on your bullets. They are suggestions, not a score, and nothing leaves this browser. Ignore any that do not fit what you did.</p>
      </div>
      <p role="status" className="text-[0.9375rem] font-semibold" data-testid="coach-summary">
        {findings.length === 0 ? "No wording issues found." : `${findings.length} suggestion${findings.length === 1 ? "" : "s"} to review.`}
      </p>
      <div data-testid="coach-list" className="space-y-5">
        {findings.length === 0 && (
          <p className="rounded-[var(--r-control)] border border-dashed border-[var(--line-strong)] p-4 text-[0.9375rem] text-[var(--text-muted)]">
            Nothing to flag. Add bullets under Experience, Projects or Education and they will be checked here.
          </p>
        )}
        {groups.map((g) => (
          <div key={g.key} className="space-y-2">
            <h3 className="text-sm font-semibold">{g.itemLabel} <span className="font-normal text-[var(--text-muted)]">in {g.sectionTitle} ({g.findings.length})</span></h3>
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
                {g.findings.map((f) => <Row key={f.id} f={f} onJump={onJump} />)}
              </AnimatePresence>
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
