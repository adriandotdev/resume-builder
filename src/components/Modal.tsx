"use client";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal built on the native <dialog>: the browser makes the page behind inert and
 * restores focus on close. We add an explicit Tab loop and Esc handling so focus
 * is trapped even where the browser would let it escape to its own UI.
 */
export function Modal({ open, onClose, labelledBy, children, wide = false, testId }: { open: boolean; onClose: () => void; labelledBy: string; children: ReactNode; wide?: boolean; testId?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      const first = d.querySelector<HTMLElement>("[data-autofocus]") ?? d.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== "Tab") return;
    const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <dialog
      ref={ref}
      className={`dlg no-print ${wide ? "dlg-wide" : ""}`}
      aria-labelledby={labelledBy}
      data-testid={testId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClose={() => { if (open) onClose(); }}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {open ? children : null}
    </dialog>
  );
}
