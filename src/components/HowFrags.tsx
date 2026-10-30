"use client";
import { useMemo, type ReactNode } from "react";
import { motion } from "motion/react";
import { EASE } from "@/lib/motion";
import { createSampleDoc } from "@/lib/sample";
import { HIDE_AT, MOVE_AT, SHOW_TEMPLATES, TYPED, beatOf, typedChars, useStory, type StoryCheck } from "./HeroSheet";
import { IconAlert, IconDownload, IconGrip, IconTick, IconWarn } from "./icons";
import { Thumbnail } from "./Thumbnail";

const T = { duration: 0.4, ease: EASE };

/** The three template thumbnails; the one the stage is showing lifts, the others step back. */
export function HowThumbs() {
  const { scene, p } = useStory();
  const sample = useMemo(() => createSampleDoc(), []);
  const cur = scene < 1 ? -1 : scene === 1 ? beatOf(p, SHOW_TEMPLATES.length) : SHOW_TEMPLATES.length - 1;
  return (
    <ul className="how-thumbs" aria-hidden="true">
      {SHOW_TEMPLATES.map((id, i) => (
        <motion.li key={id} className="paper-edge" data-ui data-on={i === cur} animate={{ opacity: cur < 0 || i === cur ? 1 : 0.45, y: i === cur ? -6 : 0 }} transition={T}>
          <Thumbnail doc={{ ...sample, style: { ...sample.style, template: id } }} uid={`how-${id}`} />
        </motion.li>
      ))}
    </ul>
  );
}

/** The section list: the headline types into Contact, Experience is dragged up, Certifications is switched off. */
export function HowSections() {
  const { scene, p } = useStory();
  const done = scene > 2;
  const typed = done ? TYPED.length : scene === 2 ? typedChars(p) : 0;
  const moved = done || (scene === 2 && p >= MOVE_AT);
  const hidden = done || (scene === 2 && p >= HIDE_AT);
  const rows = [
    { t: "Contact", note: typed ? `Operations Analyst${TYPED.slice(0, typed)}` : "" },
    { t: "Summary" },
    { t: "Experience" },
    { t: "Certifications" },
  ];
  if (moved) rows.splice(1, 0, rows.splice(2, 1)[0]);
  return (
    <div className="how-frag" data-ui aria-hidden="true">
      {rows.map((r) => {
        const off = r.t === "Certifications" && hidden;
        return (
          <motion.div key={r.t} layout="position" transition={T} className="frag-row">
            <span className="text-[var(--text-muted)]"><IconGrip size={18} /></span>
            <span className={`font-semibold transition-colors ${off ? "text-[var(--text-muted)]" : ""}`}>{r.t}</span>
            <span className="min-w-0 flex-1 truncate text-right text-sm text-[var(--text-muted)]">{off ? "Hidden" : r.note}</span>
            <span className="frag-switch" data-on={!off} />
          </motion.div>
        );
      })}
      <p className="frag-foot">About 1 page</p>
    </div>
  );
}

function Level({ level }: { level: string }) {
  return level === "pass" ? <IconTick size={18} /> : level === "fail" ? <IconAlert size={18} /> : <IconWarn size={18} />;
}

/** The ATS checks light up one by one as the stage marks what each one reads. */
export function HowChecks({ checks }: { checks: (StoryCheck & { level: string })[] }) {
  const { scene, p } = useStory();
  const cur = scene < 3 ? checks.length : scene > 3 ? checks.length : beatOf(p, checks.length);
  return (
    <ul className="how-frag" data-ui aria-hidden="true">
      {checks.map((c, i) => {
        const on = scene !== 3 ? true : i <= cur;
        return (
          <motion.li key={c.id} className="frag-row items-start" animate={{ opacity: on ? 1 : 0.4, x: on ? 0 : -10 }} transition={T}>
            <motion.span className="mt-0.5 inline-flex" animate={{ scale: on ? 1 : 0.8, color: on ? (c.level === "pass" ? "var(--tick-text)" : "var(--pen-text)") : "var(--text-muted)" }} transition={T}><Level level={c.level} /></motion.span>
            <span className="flex-1 leading-snug">{c.message}</span>
          </motion.li>
        );
      })}
    </ul>
  );
}

const PRINT_STEPS = ["Set the destination to Save as PDF.", "Turn off Headers and footers.", "Paper is already set to A4."];
const PRINT_AT = [0.1, 0.38, 0.64];

/** The print steps tick off in turn, then the button is pressed. */
export function HowPrint(): ReactNode {
  const { scene, p } = useStory();
  const live = scene === 4;
  const pressed = live && p >= 0.86;
  return (
    <div className="how-frag" data-ui aria-hidden="true">
      <p className="frag-title">Save as PDF</p>
      <ol className="mt-3 space-y-2">
        {PRINT_STEPS.map((t, i) => {
          const on = !live || p >= PRINT_AT[i];
          return (
            <motion.li key={t} className="flex gap-2.5" animate={{ opacity: on ? 1 : 0.4, x: on ? 0 : -10 }} transition={T}>
              <motion.span className="mt-0.5 inline-flex" animate={{ scale: on ? 1 : 0.8, color: on ? "var(--tick-text)" : "var(--text-muted)" }} transition={T}><IconTick size={18} /></motion.span>{t}
            </motion.li>
          );
        })}
      </ol>
      <motion.span className="btn btn-primary mt-5" animate={{ scale: pressed ? 0.96 : 1 }} transition={{ duration: 0.18, ease: EASE }}><IconDownload size={18} />Open print dialog</motion.span>
    </div>
  );
}
