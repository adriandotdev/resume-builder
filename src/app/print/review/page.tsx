"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useResumeDoc } from "@/lib/store";
import { anonymizeDoc } from "@/lib/anonymize";
import { downloadBlob, sheetToPngs } from "@/lib/exportPng";
import { PX_PER_MM } from "@/lib/fit";
import { MARGINS, PAGE_SIZES } from "@/lib/schema";
import { ResumePreview } from "@/components/ResumePreview";
import { IconDownload } from "@/components/icons";

const FILE_TITLE = "Resume for review";
const FILE_NAME = "resume-for-review";

/** Anonymized copy of the saved resume for posting publicly. Print this page to get a PDF without personal details. */
export default function ReviewPrintPage() {
  const doc = useResumeDoc();
  const { doc: anon } = useMemo(() => anonymizeDoc(doc), [doc]);
  const paperRef = useRef<HTMLDivElement>(null);
  const [png, setPng] = useState<{ kind: "working" | "done" | "failed"; n: number } | null>(null);

  const print = () => {
    // The browser suggests the page title as the file name and stores it in the PDF, so keep the real name out of it.
    const previous = document.title;
    document.title = FILE_TITLE;
    window.addEventListener("afterprint", () => { document.title = previous; }, { once: true });
    window.print();
  };

  const downloadPng = async () => {
    const sheet = paperRef.current?.querySelector<HTMLElement>('[data-testid="preview-sheet"]');
    if (!sheet) return;
    setPng({ kind: "working", n: 0 });
    try {
      const page = PAGE_SIZES[anon.style.pageSize];
      const blobs = await sheetToPngs(sheet, page.w * PX_PER_MM, page.h * PX_PER_MM, MARGINS[anon.style.margins] * PX_PER_MM);
      blobs.forEach((b, i) => downloadBlob(b, blobs.length === 1 ? `${FILE_NAME}.png` : `${FILE_NAME}-${i + 1}.png`));
      setPng({ kind: "done", n: blobs.length });
    } catch {
      setPng({ kind: "failed", n: 0 });
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={print} data-testid="review-print"><IconDownload size={18} />Save as PDF</button>
        <button type="button" className="btn" onClick={downloadPng} disabled={png?.kind === "working"} data-testid="review-png"><IconDownload size={18} />{png?.kind === "working" ? "Preparing…" : "Download PNG"}</button>
        <Link className="btn btn-quiet" href="/editor">Back to editor</Link>
        <p role="status" className="basis-full text-sm empty:hidden" data-testid="review-png-status">
          {png?.kind === "done" && (png.n === 1 ? "Saved 1 image." : `Saved ${png.n} images, one per page. If only one arrived, allow multiple downloads for this site.`)}
          {png?.kind === "failed" && <span className="text-[var(--pen-text)]">Could not make the image. Use Save as PDF instead.</span>}
        </p>
        <p className="basis-full text-sm text-[var(--text-muted)]">Name, contact details, links, locations and employer names are removed. Check the page before you post. For a PDF, choose Save as PDF in the print dialog and turn off headers and footers. A PNG is a picture, so its text cannot be copied.</p>
      </div>
      <div ref={paperRef}><ResumePreview doc={anon} /></div>
    </div>
  );
}
