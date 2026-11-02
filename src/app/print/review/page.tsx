"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useResumeDoc } from "@/lib/store";
import { anonymizeDoc } from "@/lib/anonymize";
import { ResumePreview } from "@/components/ResumePreview";
import { IconDownload } from "@/components/icons";

const FILE_TITLE = "Resume for review";

/** Anonymized copy of the saved resume for posting publicly. Print this page to get a PDF without personal details. */
export default function ReviewPrintPage() {
  const doc = useResumeDoc();
  const { doc: anon } = useMemo(() => anonymizeDoc(doc), [doc]);

  const print = () => {
    // The browser suggests the page title as the file name and stores it in the PDF, so keep the real name out of it.
    const previous = document.title;
    document.title = FILE_TITLE;
    window.addEventListener("afterprint", () => { document.title = previous; }, { once: true });
    window.print();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={print} data-testid="review-print"><IconDownload size={18} />Save as PDF</button>
        <Link className="btn btn-quiet" href="/editor">Back to editor</Link>
        <p className="basis-full text-sm text-[var(--text-muted)]">Name, contact details, links, locations and employer names are removed. Check the page before you post. In the print dialog, choose Save as PDF and turn off headers and footers.</p>
      </div>
      <ResumePreview doc={anon} />
    </div>
  );
}
