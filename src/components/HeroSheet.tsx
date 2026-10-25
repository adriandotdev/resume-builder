"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { EASE } from "@/lib/motion";
import { SegButton } from "./controls";
import { createSampleDoc } from "@/lib/sample";
import { getTemplate } from "@/templates/registry";
import type { TemplateId } from "@/lib/schema";

const PAGE_W = 794;
const PAGE_H = 1123;
const MARGIN = 64;
const SETTLE = [0.16, 1, 0.3, 1] as const;

export interface Scene { template: TemplateId; ats: boolean }

/** The scenes the stage moves through as the reading column scrolls; index 0 is the first screen. */
export const SCENES: Scene[] = [
  { template: "classic", ats: false },
  { template: "elegant", ats: false },
  { template: "modern", ats: false },
  { template: "classic", ats: true },
  { template: "classic", ats: false },
];
const LAYERS = Array.from(new Set(SCENES.map((s) => s.template)));

function useBoxSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * The split page: a reading column on the left and the stage, one sample resume
 * that stays in view and changes as each part of the column arrives. Elements in
 * the column marked data-scene="n" switch the stage to SCENES[n].
 */
export function SplitStory({ children }: { children: ReactNode }) {
  const colRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState(0);
  const [ats, setAts] = useState(false);

  useEffect(() => {
    const marks = Array.from(colRef.current?.querySelectorAll<HTMLElement>("[data-scene]") ?? []);
    if (!marks.length) return;
    let lens = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const n = Number((e.target as HTMLElement).dataset.scene);
        setScene(n);
        // Let an incoming page settle before the highlighter sweeps across it.
        const next = SCENES[n]?.ats ?? false;
        window.clearTimeout(lens);
        lens = window.setTimeout(() => setAts(next), next ? 450 : 0);
      }
    }, { rootMargin: "-45% 0px -45% 0px" });
    marks.forEach((m) => io.observe(m));
    return () => { io.disconnect(); window.clearTimeout(lens); };
  }, []);

  return (
    <div className="story">
      <div ref={colRef} className="story-col">{children}</div>
      <Stage template={SCENES[scene]?.template ?? "classic"} ats={ats} onAts={setAts} />
    </div>
  );
}

function Stage({ template, ats, onAts }: { template: TemplateId; ats: boolean; onAts: (v: boolean) => void }) {
  const doc = useMemo(() => createSampleDoc(), []);
  const [boxRef, box] = useBoxSize<HTMLDivElement>();
  const scale = box.w && box.h ? Math.min(box.w / PAGE_W, box.h / PAGE_H) : 0;
  const name = getTemplate(template).name;
  const [announce, setAnnounce] = useState("");
  const pick = (v: boolean) => { onAts(v); setAnnounce(v ? "Showing the text an ATS extracts, in reading order." : "Showing the sample resume as it looks."); };

  return (
    <aside className="stage" aria-label="Sample resume">
      <div className="stage-bar">
        <div className="seg" role="group" aria-label="Sample resume view">
          <SegButton group="stage-view" pressed={!ats} onClick={() => pick(false)} testId="view-looks">How it looks</SegButton>
          <SegButton group="stage-view" pressed={ats} onClick={() => pick(true)} testId="view-ats">What an ATS reads</SegButton>
        </div>
      </div>
      <div ref={boxRef} className="stage-box">
        <motion.div
          className="stage-page" data-ui data-ready={scale > 0} style={{ width: PAGE_W * scale, height: PAGE_H * scale }} aria-hidden="true"
          initial={false} animate={scale > 0 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 12, scale: 0.985 }}
          transition={{ opacity: { duration: 0.9, ease: EASE, delay: 0.2 }, y: { duration: 1.4, ease: SETTLE, delay: 0.2 }, scale: { duration: 1.4, ease: SETTLE, delay: 0.2 } }}
        >
          {LAYERS.map((id) => {
            const { Component } = getTemplate(id);
            const lens = (
              <div className="ats-lens" data-on={ats} data-testid={id === "classic" ? "hero-lens" : undefined}>
                <div ref={(el) => { if (el) el.setAttribute("inert", ""); }} style={{ width: PAGE_W, height: PAGE_H, padding: MARGIN, boxSizing: "border-box", transform: `scale(${scale})`, transformOrigin: "top left" }}>
                  <Component doc={{ ...doc, style: { ...doc.style, template: id } }} idPrefix={`stage-${id}`} />
                </div>
              </div>
            );
            const shown = id === template;
            return (
              <motion.div
                key={id} className="stage-layer" data-shown={shown} style={{ zIndex: shown ? 1 : 0 }}
                initial={false}
                animate={shown ? "in" : "out"}
                variants={{
                  in: { opacity: 1, filter: "blur(0px)", scale: 1, visibility: "visible", transition: { opacity: { duration: 1.1 }, filter: { duration: 0.9, ease: EASE }, scale: { duration: 1.6, ease: SETTLE }, visibility: { duration: 0 } } },
                  out: { opacity: 0, filter: "blur(5px)", scale: 1.012, visibility: "hidden", transition: { duration: 0, delay: 1.2 } },
                }}
              >{lens}</motion.div>
            );
          })}
        </motion.div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      {/* Keyed so each new caption fades in with its page. */}
      <motion.p key={ats ? "ats" : name} className="stage-caption" data-testid="hero-caption" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, ease: EASE }}>
        {ats
          ? "Plain text, in reading order. Every highlighted line is real text a parser can pull out: no columns, tables or images in the way."
          : `A sample resume for a fictional person, in the ${name} template. Switch the view to see what software extracts from it.`}
      </motion.p>
    </aside>
  );
}
