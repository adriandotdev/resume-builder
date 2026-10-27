"use client";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { EASE } from "@/lib/motion";
import { useId, useMemo, useState } from "react";
import { runParseSim, type ParseFinding } from "@/lib/parsesim";
import type { FieldJump } from "@/lib/ops";
import type { ResumeDoc } from "@/lib/schema";
import { IconAlert, IconChevron, IconWarn } from "./icons";

const WORD = { warn: "Review", fail: "Fix" } as const;

/** Findings grouped by section in document order, so the list reads the way the resume does. Fixes come before reviews inside a group. */
function groupFindings(findings: ParseFinding[]) {
  const groups = new Map<string, { title: string; items: ParseFinding[] }>();
  for (const f of findings) {
    const g = groups.get(f.sectionId) ?? { title: f.sectionTitle, items: [] };
    g.items.push(f);
    groups.set(f.sectionId, g);
  }
  return [...groups].map(([id, g]) => ({ id, title: g.title, items: [...g.items].sort((a, b) => Number(b.level === "fail") - Number(a.level === "fail")) }));
}

/** Fix rows carry the pen wash; review rows stay flat on the sheet with a 1px edge. */
function Row({ f, onJump }: { f: ParseFinding; onJump: (t: FieldJump) => void }) {
  const Icon = f.level === "fail" ? IconAlert : IconWarn;
  const ctx = useId();
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.2, ease: EASE }} className={`flex gap-3 rounded-[var(--r-control)] p-3 ${f.level === "fail" ? "" : "border border-[var(--line)]"}`} style={f.level === "fail" ? { background: "var(--pen-soft)" } : undefined} data-level={f.level}>
      <span className="mt-0.5 shrink-0 text-[var(--pen-text)]"><Icon size={20} /></span>
      <div className="min-w-0 flex-1 space-y-1.5">
        {f.itemId && <p id={`${ctx}-item`} className="text-sm font-semibold [overflow-wrap:anywhere]">{f.itemLabel}</p>}
        <p className="text-[0.9375rem] leading-snug">
          <strong className="mr-1.5 font-semibold text-[var(--pen-text)]">{WORD[f.level]}:</strong>
          {f.message}
        </p>
        {f.sectionId && f.fieldLabel && (
          <button type="button" className="btn" aria-describedby={f.itemId ? `${ctx}-item` : undefined} onClick={() => onJump({ sectionId: f.sectionId, itemId: f.itemId, label: f.fieldLabel })}>Go to {f.fieldLabel}</button>
        )}
      </div>
    </motion.li>
  );
}

/** What a simple ATS parser reads out of the text layer, and where it goes wrong. A simulation, not a score. */
export function ParsePanel({ doc, onJump }: { doc: ResumeDoc; onJump: (target: FieldJump) => void }) {
  const { contact, sections, findings } = useMemo(() => runParseSim(doc), [doc]);
  const groups = useMemo(() => groupFindings(findings), [findings]);
  const [startOpen] = useState(findings.length === 0);
  return (
    <MotionConfig reducedMotion="user">
    <section aria-labelledby="parse-h" className="space-y-5">
      <div className="space-y-1.5">
        <h2 id="parse-h" className="serif mb-1 text-2xl">Parser</h2>
        <p role="status" className="text-[0.9375rem] font-semibold" data-testid="parse-summary">
          {findings.length === 0 ? "Everything was read into a field." : `${findings.length} thing${findings.length === 1 ? "" : "s"} to review.`}
        </p>
        <p className="field-hint">Shows how a simple ATS splits your text into fields, where ATS check tests the document itself. A simulation, not a real ATS or a score.</p>
      </div>

      {findings.length > 0 && (
        <div data-testid="parse-findings" className="space-y-2">
          <h3 className="text-base font-semibold">Where parsing goes wrong</h3>
          <ul className="space-y-5">
            <AnimatePresence initial={false}>
              {groups.map((g) => (
                <motion.li key={g.id} layout="position" exit={{ opacity: 0, transition: { duration: 0.12 } }}>
                  <h4 className="mb-1.5 text-sm font-semibold">{g.title} <span className="font-normal tabular-nums text-[var(--text-muted)]">{g.items.length}</span></h4>
                  <ul className="space-y-1.5">
                    <AnimatePresence initial={false}>{g.items.map((f) => <Row key={f.id} f={f} onJump={onJump} />)}</AnimatePresence>
                  </ul>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      {/* Open on arrival only when there is nothing to fix, so the evidence is the first thing a clean result shows. */}
      <details data-testid="parse-list" className="group" open={startOpen}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <IconChevron size={18} className="shrink-0 -rotate-90 motion-safe:transition-transform group-open:rotate-0" />
          <span className="text-base font-semibold">What the parser read</span>
        </summary>
        <div className="mt-2 space-y-5">
          {contact && (
            <Fields title="Contact" entries={[[["Name", contact.name], ["Headline", contact.headline], ["Email", contact.email], ["Phone", contact.phone], ["Location", contact.location], ["Links", contact.links.join(", ")]]]} />
          )}
          {sections.map((s) => (
            <Fields
              key={s.sectionId}
              title={s.heading}
              note={s.recognized ? undefined : "(not a standard heading)"}
              empty="Nothing under this heading."
              entries={s.entries.map((e) => e.fields.map((x): [string, string] => [x.label, x.value]))}
            />
          ))}
        </div>
      </details>
    </section>
    </MotionConfig>
  );
}

/** One parsed section: a heading, then each entry as a flat label/value list, told apart by a hairline. */
function Fields({ title, note, empty, entries }: { title: string; note?: string; empty?: string; entries: [string, string][][] }) {
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold">{title}{note && <span className="ml-1.5 text-[var(--pen-text)]">{note}</span>}</h4>
      {entries.length === 0 && empty && <p className="text-sm text-[var(--text-muted)]">{empty}</p>}
      <div className="divide-y divide-[var(--line)]">
        {entries.map((rows, n) => (
          <dl key={n} className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-0.5 py-2 text-[0.9375rem]">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[var(--text-muted)]">{k}</dt>
                <dd className="min-w-0 [overflow-wrap:anywhere]">{v || <span className="text-[var(--text-muted)]">Not found</span>}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </div>
  );
}
