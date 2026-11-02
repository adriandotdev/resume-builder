"use client";
import Link from "next/link";
import { Fragment, useMemo, useRef, useState } from "react";
import { anonymizeDoc } from "@/lib/anonymize";
import { toPlainText } from "@/lib/plaintext";
import type { ResumeDoc } from "@/lib/schema";
import { Modal } from "./Modal";
import { IconClose, IconDownload, IconShield } from "./icons";

// Stand-ins the anonymizer writes. Marked in the preview so the reader can see exactly what changed.
const PLACEHOLDER = /(\[(?:name|email|link|handle|phone|location)\]|Company [A-Z0-9]+|University(?: [A-Z0-9]+)?|Issuing body(?: [A-Z0-9]+)?|^Candidate$)/gm;

function canUseStorage(): boolean {
  try {
    const k = "resume-builder:probe";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Copies an anonymized resume as text, or opens the anonymized print page. Nothing is uploaded. */
export function ShareReviewDialog({ open, onClose, doc }: { open: boolean; onClose: () => void; doc: ResumeDoc }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [status, setStatus] = useState<{ kind: "copied" | "failed"; n: number } | null>(null);
  const { report, text, empty, pageOk } = useMemo(() => {
    if (!open) return { report: null, text: "", empty: true, pageOk: true };
    const r = anonymizeDoc(doc);
    const t = toPlainText(r.doc);
    return { report: r.report, text: t, empty: t.replace("Candidate", "").trim() === "", pageOk: canUseStorage() };
  }, [open, doc]);

  // Clear the last copy result when the dialog closes (adjusting state during render, as Modal does).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) { setPrevOpen(open); if (!open) setStatus(null); }

  const copy = async () => {
    const n = (status?.n ?? 0) + 1;
    try {
      await navigator.clipboard.writeText(text);
      setStatus({ kind: "copied", n });
    } catch {
      // Leave the text selected so Ctrl/Cmd+C still works.
      const el = preRef.current;
      if (el) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(el);
        sel?.addRange(range);
        el.focus();
      }
      setStatus({ kind: "failed", n });
    }
  };

  const parts = text.split(PLACEHOLDER);

  return (
    <Modal open={open} onClose={onClose} labelledBy="share-h" describedBy="share-intro" className="dlg-share" testId="share-dialog">
      <div className="dlg-share-grab" aria-hidden="true" />
      <div className="dlg-share-head flex flex-none items-start justify-between gap-3 px-4 pt-3 sm:px-6 sm:pt-6">
        <h2 id="share-h" className="display text-2xl sm:text-3xl" tabIndex={-1} data-autofocus>Share for review</h2>
        <button type="button" className="btn btn-quiet btn-icon -mr-2" aria-label="Close" onClick={onClose}><IconClose /></button>
      </div>
      <div className="dlg-share-body">
        <p id="share-intro" className="text-[0.9375rem] text-[var(--text-muted)] sm:text-base">
          A copy with your name, contact details, links, locations and employer names taken out. Nothing is uploaded, and your saved resume does not change.
        </p>

        {empty ? (
          <p className="well mt-5 p-4" data-testid="share-empty">There is nothing to share yet. Add your experience in the editor, then come back.</p>
        ) : (
          <>
            {report && (
              <p className="mt-4 flex items-start gap-2 text-[0.9375rem]" data-testid="share-report">
                <span className="mt-0.5 shrink-0 text-[var(--tick-text)]"><IconShield size={18} /></span>
                <span>
                  Removed {plural(report.contactFields, "contact detail", "contact details")}, relabelled {plural(report.organizations, "organization", "organizations")} and cleaned {plural(report.textRedactions, "mention", "mentions")} in your text.
                  {report.hiddenSections > 0 && <> Left out {plural(report.hiddenSections, "hidden section", "hidden sections")}.</>}
                </span>
              </p>
            )}
            <p className="mt-4 rounded-[var(--r-inset)] bg-[var(--pen-soft)] p-3 text-[0.9375rem] text-[var(--text)]" data-testid="share-warning">
              <strong className="text-[var(--pen-text)]">Read every line before you post.</strong> Cleaning cannot recognise a client, product or manager named in a bullet. If you spot one, go back and edit the resume, then reopen this.
            </p>
            <p className="mt-4 text-sm text-[var(--text-muted)]" id="share-legend">
              <mark className="rounded-sm px-1" style={{ background: "var(--hl)", color: "var(--on-hl)" }}>Highlighted</mark> text is what we replaced.
            </p>
            <pre ref={preRef} className="share-text paper-edge mt-2 max-h-[34dvh] overflow-auto whitespace-pre-wrap break-words rounded-[var(--r-paper)] bg-white p-3 font-mono text-[0.8125rem] leading-relaxed sm:p-4 sm:text-sm text-[var(--ats-ink)] sm:max-h-[40dvh]" tabIndex={0} aria-label="Anonymized resume text" aria-describedby="share-legend" data-testid="share-text">
              {parts.map((p, i) => i % 2 === 1
                ? <mark key={i} className="rounded-sm" style={{ background: "var(--hl)", color: "var(--on-hl)" }}>{p}</mark>
                : <Fragment key={i}>{p}</Fragment>)}
            </pre>
          </>
        )}
      </div>

      <div className="dlg-share-foot">
        <p role="status" className="share-status order-first min-h-[1.5em] text-[0.9375rem] empty:hidden sm:order-last sm:mt-3 sm:empty:block" data-testid="share-status" key={status?.n ?? 0}>
          {status?.kind === "copied" && "Copied. Paste it into your post."}
          {status?.kind === "failed" && <span className="text-[var(--pen-text)]">Your browser blocked copying. The text is selected, so press Ctrl+C (Cmd+C on Mac).</span>}
          {!pageOk && !empty && !status && <span className="text-[var(--text-muted)]">This browser blocks storage, so the printable page is unavailable. Copy the text instead.</span>}
        </p>
        <div className="flex flex-col gap-2 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center">
          <button type="button" className="btn btn-primary share-primary" onClick={copy} disabled={empty} data-testid="share-copy">{status?.kind === "copied" ? "Copied" : "Copy text"}</button>
          {pageOk && !empty && (
            <Link className="btn" href="/print/review" data-testid="share-pdf"><IconDownload size={18} />Printable page</Link>
          )}
          <button type="button" className="btn btn-quiet" onClick={onClose}>Back to editing</button>
        </div>
      </div>
    </Modal>
  );
}
