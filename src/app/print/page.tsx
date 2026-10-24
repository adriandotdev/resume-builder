"use client";
import { useResumeDoc } from "@/lib/store";
import { ResumePreview } from "@/components/ResumePreview";
import { IconDownload } from "@/components/icons";

/** Clean view of the saved resume. Print this page to get a PDF without editor chrome. */
export default function PrintPage() {
  const doc = useResumeDoc();
  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}><IconDownload size={18} />Print / Save as PDF</button>
        <p className="text-sm text-[var(--text-muted)]">Uses the same renderer as the editor preview. Choose Save as PDF and turn off headers and footers.</p>
      </div>
      <ResumePreview doc={doc} />
    </div>
  );
}
