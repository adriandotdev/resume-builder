"use client";
import { motion, useScroll, useTransform } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { EASE } from "@/lib/motion";
import { createSampleDoc } from "@/lib/sample";
import { toPlainText } from "@/lib/plaintext";
import { ClassicTemplate } from "@/templates/classic";
import type { ResumeDoc } from "@/lib/schema";

const START_ROLE = "Dispatch Coordinator";
const START_LINE = "cut missed pickups from 9 a week to 2 by moving driver check-ins to 6:30";

/** One experience entry, typed on the left and shown on the right as printed and as parsed. */
export function Showcase() {
  const [role, setRole] = useState(START_ROLE);
  const [line, setLine] = useState(START_LINE);
  const doc = useMemo<ResumeDoc>(() => {
    const base = createSampleDoc();
    const tidy = line.trim() ? line.trim()[0].toUpperCase() + line.trim().slice(1) : "";
    return {
      ...base,
      sections: [{
        id: "show-exp", type: "experience", title: "Experience", visible: true,
        content: { items: [{ id: "show-1", role: role.trim(), org: "Harborline Logistics", location: "Portland, OR", start: "2022-03", end: "", current: true, bullets: tidy ? [tidy] : [] }] },
      }],
    };
  }, [role, line]);
  const text = toPlainText(doc).trim();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const driftA = useTransform(scrollYProgress, [0, 1], ["-12%", "0%"]);
  const driftB = useTransform(scrollYProgress, [0, 1], ["12%", "0%"]);

  return (
    <section ref={ref} className="show" aria-labelledby="show-h" data-reveal>
      <div className="show-in">
        <h2 id="show-h" className="show-h show-h-a order-2"><motion.span className="inline-block" style={{ x: driftA }}>Type it once,</motion.span><span className="sr-only"> read it twice</span></h2>
        <div className="show-fields">
          <label className="show-label" htmlFor="show-role">Job title</label>
          <input id="show-role" className="show-input" value={role} onChange={(e) => setRole(e.target.value)} maxLength={60} autoComplete="off" />
          <label className="show-label mt-6" htmlFor="show-line">One thing you did there</label>
          <textarea id="show-line" className="show-input show-area" value={line} onChange={(e) => setLine(e.target.value)} maxLength={180} rows={3} />
        </div>
      </div>
      <div className="show-out">
        <div className="show-result" data-ui>
          <p className="show-cap">On the page</p>
          <div className="show-paper paper-edge">
            <div ref={(el) => { if (el) el.setAttribute("inert", ""); }}>
              <ClassicTemplate doc={doc} idPrefix="show" />
            </div>
          </div>
          <p className="show-cap mt-8">What a parser reads</p>
          <pre className="show-ats"><motion.mark key={text} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: EASE }}>{text}</motion.mark></pre>
        </div>
        <p className="show-h show-h-b" aria-hidden="true"><motion.span className="inline-block" style={{ x: driftB }}>read it twice</motion.span></p>
      </div>
    </section>
  );
}
