"use client";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { MARGINS, PAGE_SIZES, type ResumeDoc } from "@/lib/schema";
import { PX_PER_MM, pagesFor } from "@/lib/fit";
import { getTemplate } from "@/templates/registry";
import { useElementWidth } from "./useElementWidth";

/** Injects @page rules so the browser prints at the chosen paper size and margins. */
export function PageStyle({ doc }: { doc: ResumeDoc }) {
  const p = PAGE_SIZES[doc.style.pageSize];
  const m = MARGINS[doc.style.margins];
  return <style>{`@page { size: ${p.w}mm ${p.h}mm; margin: ${m}mm; }`}</style>;
}

/** The paper sheet at the chosen size, scaled to fit. Shows the resume, or `body` (the cover letter) in its place. */
export const ResumePreview = memo(function ResumePreview({ doc, onPages, zoom = "fit", body }: { doc: ResumeDoc; onPages?: (n: number) => void; zoom?: "fit" | "actual"; body?: ReactNode }) {
  const [stageRef, stageW] = useElementWidth<HTMLDivElement>();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetH, setSheetH] = useState(0);
  const page = PAGE_SIZES[doc.style.pageSize];
  const m = MARGINS[doc.style.margins];
  const pageW = page.w * PX_PER_MM;
  const pageH = page.h * PX_PER_MM;
  const margin = m * PX_PER_MM;
  const scale = zoom === "actual" ? 1 : stageW > 0 ? Math.min(1, stageW / pageW) : 1;
  const { Component } = getTemplate(doc.style.template);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const update = () => setSheetH(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pages = pagesFor(sheetH, pageH, margin);
  useEffect(() => { onPages?.(pages); }, [pages, onPages]);

  return (
    <div ref={stageRef} className="preview-stage w-full">
      <PageStyle doc={doc} />
      <div className="preview-frame" style={{ width: pageW * scale, height: Math.max(sheetH, pageH) * scale }}>
        <div className="preview-scale" style={{ width: pageW, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <div
            ref={sheetRef}
            className="preview-sheet paper-edge bg-white rounded-[var(--r-paper)]"
            style={{ width: pageW, minHeight: pageH, padding: margin, boxSizing: "border-box" }}
            data-testid="preview-sheet"
          >
            {body ?? <Component doc={doc} idPrefix="pv" />}
          </div>
        </div>
      </div>
    </div>
  );
});
