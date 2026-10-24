"use client";
import { useId } from "react";
import { patchSection } from "@/lib/ops";
import { resumeStore } from "@/lib/store";
import { insertAt } from "@/lib/ui";
import { ActionMenu } from "./controls";
import { IconDown, IconPlus, IconTrash, IconUp } from "./icons";
import { useToast } from "./Toast";

export function TextField({ label, value, onChange, placeholder, type = "text", hint, autoComplete = "off" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; hint?: string; autoComplete?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-h` : undefined} autoComplete={autoComplete} />
      {hint && <span id={`${id}-h`} className="field-hint">{hint}</span>}
    </div>
  );
}

export function TextArea({ label, value, onChange, rows = 4, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-h` : undefined} />
      {hint && <span id={`${id}-h`} className="field-hint">{hint}</span>}
    </div>
  );
}

/** One bullet per line. */
export function BulletsField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return <TextArea label={label} rows={4} value={value.join("\n")} onChange={(v) => onChange(v.split("\n"))} hint="One bullet per line. Do not type bullet symbols." />;
}

export function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/** Generic ordered list of items with add, a move/remove menu, undo on remove and an empty state. */
export function ItemsEditor<T extends { id: string }>({ sectionId, items, onChange, makeEmpty, itemLabel, addLabel, emptyText, render }: {
  sectionId: string; items: T[]; onChange: (items: T[]) => void; makeEmpty: () => T; itemLabel: (i: T, n: number) => string; addLabel: string; emptyText?: string;
  render: (item: T, update: (p: Partial<T>) => void) => React.ReactNode;
}) {
  const toast = useToast();
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = items.slice();
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };
  const remove = (it: T, n: number) => {
    const label = itemLabel(it, n);
    onChange(items.filter((x) => x.id !== it.id));
    // Undo reads the latest store state, so edits made after removing are kept.
    toast.show({ message: `Removed ${label}.`, actionLabel: "Undo", onAction: () => {
      resumeStore.update((d) => patchSection(d, sectionId, (sec) => {
        const content = sec.content as unknown as { items: T[] };
        return { ...sec, content: { ...content, items: insertAt(content.items, it, n) } } as unknown as typeof sec;
      }));
    } });
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="rounded-[var(--r-control)] border border-dashed border-[var(--line-strong)] p-4 text-[0.9375rem] text-[var(--text-muted)]" data-testid="items-empty">
          {emptyText ?? `Nothing here yet. Choose “${addLabel}” to start.`}
        </p>
      )}
      <ul className="space-y-3">
        {items.map((it, n) => {
          const label = itemLabel(it, n);
          return (
            <li key={it.id} className="rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[0.9375rem] font-semibold">{label}</span>
                <ActionMenu label={`Actions for ${label}`} actions={[
                  { label: `Move ${label} up`, onSelect: () => move(n, n - 1), disabled: n === 0, icon: <IconUp size={18} /> },
                  { label: `Move ${label} down`, onSelect: () => move(n, n + 1), disabled: n === items.length - 1, icon: <IconDown size={18} /> },
                  { label: `Remove ${label}`, onSelect: () => remove(it, n), danger: true, icon: <IconTrash size={18} /> },
                ]} />
              </div>
              <div className="grid gap-3 @md:grid-cols-2">{render(it, (p) => onChange(items.map((x) => (x.id === it.id ? { ...x, ...p } : x))))}</div>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn" onClick={() => onChange([...items, makeEmpty()])}><IconPlus size={18} />{addLabel}</button>
    </div>
  );
}
