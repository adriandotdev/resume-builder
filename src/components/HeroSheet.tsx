"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createSampleDoc } from "@/lib/sample";
import { getTemplate } from "@/templates/registry";
import type { TemplateId } from "@/lib/schema";

const PAGE_W = 794;
const PAGE_H = 1123;
const MARGIN = 64;

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
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const n = Number((e.target as HTMLElement).dataset.scene);
        setScene(n);
        setAts(SCENES[n]?.ats ?? false);
      }
    }, { rootMargin: "-45% 0px -45% 0px" });
    marks.forEach((m) => io.observe(m));
    return () => io.disconnect();
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
          <button type="button" className="seg-opt" aria-pressed={!ats} onClick={() => pick(false)} data-testid="view-looks">How it looks</button>
          <button type="button" className="seg-opt" aria-pressed={ats} onClick={() => pick(true)} data-testid="view-ats">What an ATS reads</button>
        </div>
      </div>
      <div ref={boxRef} className="stage-box">
        <div className="stage-page" data-ui style={{ width: PAGE_W * scale, height: PAGE_H * scale, opacity: scale ? 1 : 0 }} aria-hidden="true">
          {LAYERS.map((id) => {
            const { Component } = getTemplate(id);
            const lens = (
              <div className="ats-lens" data-on={ats} data-testid={id === "classic" ? "hero-lens" : undefined}>
                <div ref={(el) => { if (el) el.setAttribute("inert", ""); }} style={{ width: PAGE_W, height: PAGE_H, padding: MARGIN, boxSizing: "border-box", transform: `scale(${scale})`, transformOrigin: "top left" }}>
                  <Component doc={{ ...doc, style: { ...doc.style, template: id } }} idPrefix={`stage-${id}`} />
                </div>
              </div>
            );
            return <div key={id} className="stage-layer" data-shown={id === template}>{lens}</div>;
          })}
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      <p className="stage-caption" data-testid="hero-caption">
        {ats
          ? "Plain text, in reading order. Every highlighted line is real text a parser can pull out: no columns, tables or images in the way."
          : `A sample resume for a fictional person, in the ${name} template. Switch the view to see what software extracts from it.`}
      </p>
    </aside>
  );
}
