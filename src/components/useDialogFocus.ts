"use client";
import { useEffect, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE = ['a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]']
  .map((s) => `${s}:not([tabindex="-1"])`).join(", ");

/**
 * Focus management for non-<dialog> overlays (tablet drawer, phone preview sheet):
 * focus moves in on open, Tab loops inside, Esc closes, focus returns on close.
 * Returns a React onKeyDown handler to put on the overlay element.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, active: boolean, onClose: () => void, initial?: string) {
  useEffect(() => {
    if (!active) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const target = (initial && el?.querySelector<HTMLElement>(initial)) || el?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
    return () => { if (prev && document.contains(prev)) prev.focus(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (e: KeyboardEvent<HTMLElement>) => {
    if (!active) return;
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
}
