import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MARGINS, PAGE_SIZES, type ResumeDoc } from "@/lib/schema";
import { PX_PER_MM, pagesFor, type FitPatch } from "@/lib/fit";
import { getTemplate } from "@/templates/registry";

export interface Measurement { sheetH: number; pageH: number; pages: number }

/**
 * Lays the resume out off-screen with the real template and CSS, the same way the preview does,
 * and reports how many pages it spans. One hidden root is reused for every candidate style,
 * then removed. Nothing here is visible, focusable or printed.
 */
export function createMeasurer() {
  const host = document.createElement("div");
  host.className = "no-print";
  host.setAttribute("aria-hidden", "true");
  host.inert = true;
  host.style.cssText = "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none";
  document.body.appendChild(host);
  const root = createRoot(host);

  return {
    measure(doc: ResumeDoc, patch: FitPatch = {}): Measurement {
      const next: ResumeDoc = { ...doc, style: { ...doc.style, ...patch } };
      const page = PAGE_SIZES[next.style.pageSize];
      const pageW = page.w * PX_PER_MM;
      const pageH = page.h * PX_PER_MM;
      const margin = MARGINS[next.style.margins] * PX_PER_MM;
      const { Component } = getTemplate(next.style.template);
      flushSync(() => root.render(
        <div className="preview-sheet paper-edge bg-white rounded-[var(--r-paper)]" style={{ width: pageW, minHeight: pageH, padding: margin, boxSizing: "border-box" }}>
          <Component doc={next} idPrefix="fit" />
        </div>,
      ));
      const sheetH = (host.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
      return { sheetH, pageH, pages: pagesFor(sheetH, pageH, margin) };
    },
    dispose() {
      root.unmount();
      host.remove();
    },
  };
}
