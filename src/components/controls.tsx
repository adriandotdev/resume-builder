"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { IconMore } from "./icons";

/** Segmented control built from native radios (keyboard + screen reader friendly). */
export function Segmented<T extends string>({ legend, value, options, onChange, hint }: { legend: string; value: T; options: { value: T; label: string; sub?: string }[]; onChange: (v: T) => void; hint?: string }) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="seg" role="presentation">
        {options.map((o) => (
          <label key={o.value} className="seg-opt">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}{o.sub && <span className="ml-1.5 text-xs opacity-75">{o.sub}</span>}</span>
          </label>
        ))}
      </div>
      {hint && <p className="field-hint mt-1.5">{hint}</p>}
    </fieldset>
  );
}

/** Arrow-key movement for a group of `role="radio"` buttons: focus and select the neighbour, wrapping at the ends. */
export function onRadioGroupKey(e: KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
  if (!keys.includes(e.key)) return;
  const list = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
  const i = list.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  const n = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
  list[n].focus();
  list[n].click();
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="switch-track" aria-hidden="true" />
    </label>
  );
}

export interface MenuAction { label: string; ariaLabel?: string; onSelect: () => void; disabled?: boolean; danger?: boolean; icon?: ReactNode }

/** "..." button with a menu of actions: arrow keys, Esc, outside click, focus return. */
export function ActionMenu({ label, actions, testId }: { label: string; actions: MenuAction[]; testId?: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    items()[0]?.focus();
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.stopPropagation(); setOpen(false); btn.current?.focus(); return; }
    if (e.key === "Tab") { setOpen(false); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const list = Array.from(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    if (!list.length) return;
    e.preventDefault();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : e.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
    list[next].focus();
  };

  return (
    <div ref={wrap} className="relative" onKeyDown={onKey}>
      <button ref={btn} type="button" className="btn btn-quiet btn-icon" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} data-testid={testId} onClick={() => setOpen((o) => !o)}>
        <IconMore />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label} className="menu">
          {actions.map((a) => (
            <button
              key={a.label} type="button" role="menuitem" aria-label={a.ariaLabel} aria-disabled={a.disabled || undefined} tabIndex={-1}
              className={`menu-item ${a.danger ? "menu-item-danger" : ""}`}
              onClick={() => { if (a.disabled) return; setOpen(false); a.onSelect(); btn.current?.focus(); }}
            >
              {a.icon}{a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
