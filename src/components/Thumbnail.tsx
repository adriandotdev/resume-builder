"use client";
import type { ResumeDoc } from "@/lib/schema";
import { getTemplate } from "@/templates/registry";
import { useElementWidth } from "./useElementWidth";

const PAGE_W = 794; // A4 at 96dpi
const PAGE_H = 1123;

/** Live, non-interactive thumbnail rendered by the real template from a doc. */
export function Thumbnail({ doc, uid, pad = 48 }: { doc: ResumeDoc; uid: string; pad?: number }) {
  const [ref, w] = useElementWidth<HTMLDivElement>();
  const scale = w ? w / PAGE_W : 0.3;
  const { Component } = getTemplate(doc.style.template);
  return (
    <div ref={ref} className="relative w-full overflow-hidden rounded-[var(--r-paper)] bg-white" style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }} aria-hidden="true" data-ui>
      <div style={{ width: PAGE_W, height: PAGE_H, padding: pad, boxSizing: "border-box", transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }} ref={(el) => { if (el) el.setAttribute("inert", ""); }}>
        <Component doc={doc} idPrefix={`th-${uid}`} />
      </div>
    </div>
  );
}
