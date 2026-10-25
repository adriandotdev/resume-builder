"use client";
import { useResumeDoc } from "@/lib/store";
import { useCoverLetter } from "@/lib/coverStore";
import { ResumePreview } from "@/components/ResumePreview";
import { CoverLetterBody } from "@/components/CoverPreview";
import { IconDownload } from "@/components/icons";

/** Clean view of the saved cover letter. Print this page to get a PDF without editor chrome. */
export default function PrintCoverPage() {
  const doc = useResumeDoc();
  const letter = useCoverLetter();
  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}><IconDownload size={18} />Print / Save as PDF</button>
        <p className="text-sm text-[var(--text-muted)]">Uses the same renderer as the editor preview. Choose Save as PDF and turn off headers and footers.</p>
      </div>
      <ResumePreview doc={doc} body={<CoverLetterBody doc={doc} letter={letter} />} />
    </div>
  );
}
