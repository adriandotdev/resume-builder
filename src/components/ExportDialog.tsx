"use client";
import { PAGE_SIZES, type ResumeDoc } from "@/lib/schema";
import { useVersionIndex } from "@/lib/versionsStore";
import { Modal } from "./Modal";
import { IconClose, IconDownload, IconTick } from "./icons";

export function ExportDialog({ open, onClose, doc, kind = "resume" }: { open: boolean; onClose: () => void; doc: ResumeDoc; kind?: "resume" | "letter" }) {
  const size = PAGE_SIZES[doc.style.pageSize].label;
  const index = useVersionIndex();
  const versionName = index.versions.find((v) => v.id === index.activeId)?.name ?? "";
  const contact = doc.sections.find((s) => s.type === "contact");
  const fullName = contact?.type === "contact" ? contact.content.fullName.trim() : "";
  const fileTitle = [fullName, kind === "letter" ? "Cover letter" : "", versionName].filter(Boolean).join(" - ");
  const print = () => {
    onClose();
    setTimeout(() => {
      // Browsers suggest the page title as the PDF file name; put it back afterwards.
      const previous = document.title;
      if (fileTitle) {
        document.title = fileTitle;
        window.addEventListener("afterprint", () => { document.title = previous; }, { once: true });
      }
      window.print();
    }, 120);
  };
  return (
    <Modal open={open} onClose={onClose} labelledBy="export-h" testId="export-dialog">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="export-h" className="display text-3xl">{kind === "letter" ? "Save the letter as PDF" : "Save as PDF"}</h2>
          <button type="button" className="btn btn-quiet btn-icon -mr-2" aria-label="Close" onClick={onClose}><IconClose /></button>
        </div>
        <p className="mt-2 text-[var(--text-muted)]">Your browser makes the PDF, so the text stays real and selectable. In the print dialog that opens:</p>
        <ol className="mt-4 space-y-3">
          {[
            <>Set the destination to <strong>Save as PDF</strong>.</>,
            <>Turn off <strong>Headers and footers</strong>, so no date or web address is added.</>,
            <>Leave scale at 100% and margins on default. Paper is set to <strong>{size}</strong> already.</>,
            ...(fileTitle ? [<>Your browser may suggest <strong>{fileTitle}</strong> as the file name.</>] : []),
          ].map((t, i) => (
            <li key={i} className="flex gap-3 text-[0.9375rem] leading-snug">
              <span className="mt-0.5 shrink-0 text-[var(--tick-text)]"><IconTick size={18} /></span><span>{t}</span>
            </li>
          ))}
        </ol>
        <div className="mt-7 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" data-autofocus data-testid="print-confirm" onClick={print}><IconDownload size={18} />Open print dialog</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
