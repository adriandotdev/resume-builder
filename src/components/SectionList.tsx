"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { SECTION_TYPES, STANDARD_TITLES, type ResumeDoc, type SectionType } from "@/lib/schema";
import { addSection, insertSection, moveSection, patchSection, removeSection } from "@/lib/ops";
import { resumeStore } from "@/lib/store";
import { dragTargetIndex } from "@/lib/ui";
import { SectionEditor } from "./SectionEditor";
import { TextField } from "./fields";
import { ActionMenu, Switch } from "./controls";
import { IconChevron, IconDown, IconGrip, IconPlus, IconTrash, IconUp, SectionIcon } from "./icons";
import { useToast } from "./Toast";

interface DragState { from: number; dy: number; target: number }

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

export function SectionList({ doc }: { doc: ResumeDoc }) {
  const toast = useToast();
  // undefined = "first section open" (the default); null = user closed everything.
  const [open, setOpen] = useState<string | null | undefined>(undefined);
  const openId = open === undefined ? doc.sections[0]?.id ?? null : open;
  const [drag, setDrag] = useState<DragState | null>(null);
  const [msg, setMsg] = useState("");
  const [addType, setAddType] = useState<SectionType>("custom");
  const n = doc.sections.length;
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const pointer = useRef({ startY: 0, y: 0, startScroll: 0, from: -1, scroller: null as HTMLElement | null });
  const dragging = drag !== null;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= n || from === to) return;
    resumeStore.update((d) => moveSection(d, from, to));
    setMsg(`${doc.sections[from].title} moved to position ${to + 1} of ${n}`);
  };
  const remove = (index: number) => {
    const s = doc.sections[index];
    resumeStore.update((d) => removeSection(d, s.id));
    toast.show({ message: `Removed ${s.title}.`, actionLabel: "Undo", onAction: () => { resumeStore.update((d) => insertSection(d, s, index)); setMsg(`${s.title} restored`); } });
  };

  // Pointer-event drag: works for mouse, pen and touch (the handle has touch-action: none).
  const recompute = () => {
    const p = pointer.current;
    const scroll = p.scroller ? p.scroller.scrollTop : window.scrollY;
    const dy = p.y - p.startY + (scroll - p.startScroll);
    const mids = rows.current.slice(0, n).map((el) => { const r = el?.getBoundingClientRect(); return r ? r.top + r.height / 2 : 0; });
    // The dragged row is excluded from the comparison, others have not moved.
    setDrag({ from: p.from, dy, target: dragTargetIndex(mids, p.from, p.y) });
  };
  const onDown = (e: PointerEvent<HTMLButtonElement>, i: number) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const scroller = scrollParent(rows.current[i]);
    pointer.current = { startY: e.clientY, y: e.clientY, startScroll: scroller ? scroller.scrollTop : window.scrollY, from: i, scroller };
    setDrag({ from: i, dy: 0, target: i });
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    pointer.current.y = e.clientY;
    recompute();
  };
  const finish = (commit: boolean) => {
    const d = drag;
    setDrag(null);
    if (commit && d && d.target !== d.from) move(d.from, d.target);
  };

  // Edge auto-scroll while dragging.
  useEffect(() => {
    if (!dragging) return;
    let raf = 0;
    const tick = () => {
      const p = pointer.current;
      const box = p.scroller ? p.scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const top = Math.max(box.top, 0) + 56, bottom = Math.min(box.bottom, window.innerHeight) - 56;
      const speed = p.y < top ? -Math.min(18, (top - p.y) / 4) : p.y > bottom ? Math.min(18, (p.y - bottom) / 4) : 0;
      if (speed) {
        if (p.scroller) p.scroller.scrollTop += speed; else window.scrollBy(0, speed);
        recompute();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setDrag(null); };
    window.addEventListener("keydown", esc);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", esc); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === "ArrowUp") { e.preventDefault(); move(i, i - 1); }
    if (e.key === "ArrowDown") { e.preventDefault(); move(i, i + 1); }
  };

  const add = () => {
    resumeStore.update((d) => addSection(d, addType));
    const created = resumeStore.getState().sections.at(-1);
    if (created) setOpen(created.id);
  };

  return (
    <section aria-labelledby="sections-h" className="space-y-4">
      <div>
        <h2 id="sections-h" className="serif text-2xl">Sections</h2>
        <p className="field-hint mt-1">Drag the handle to reorder, or use the … menu to move a section up or down. Hidden sections stay saved but are not printed.</p>
      </div>
      <p role="status" aria-live="polite" className="sr-only">{msg}</p>
      {n === 0 && (
        <p className="rounded-[12px] border border-dashed border-[var(--line-strong)] p-5 text-[var(--text-muted)]" data-testid="sections-empty">
          Your resume has no sections yet. Start with Contact so recruiters can reach you, then add Experience.
        </p>
      )}
      <ol className="space-y-2" data-testid="section-list">
        {doc.sections.map((s, i) => {
          const isOpen = openId === s.id;
          const isDrag = drag?.from === i;
          const showLine = drag && drag.target !== drag.from && drag.target === i;
          const lineBelow = drag ? drag.target > drag.from : false;
          return (
            <li
              key={s.id}
              ref={(el) => { rows.current[i] = el; }}
              data-section-type={s.type}
              data-dragging={isDrag}
              data-hidden={!s.visible}
              className="sec-card relative"
              style={isDrag ? { transform: `translateY(${drag.dy}px)` } : undefined}
            >
              {showLine && <div className="drop-line absolute left-0 right-0" style={lineBelow ? { bottom: -6 } : { top: -6 }} aria-hidden="true" />}
              <div className="flex items-center gap-0.5 p-1 pr-1.5">
                <button
                  type="button" className="btn btn-quiet btn-icon drag-handle text-[var(--text-muted)]"
                  aria-label={`Reorder ${s.title}`} aria-describedby="drag-help" data-testid="drag-handle"
                  onPointerDown={(e) => onDown(e, i)} onPointerMove={onMove}
                  onPointerUp={() => finish(true)} onPointerCancel={() => finish(false)} onLostPointerCapture={() => { if (drag) finish(false); }}
                  onKeyDown={(e) => onHandleKey(e, i)}
                >
                  <IconGrip />
                </button>
                <button
                  type="button" className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[var(--r-control)] px-1.5 text-left"
                  aria-expanded={isOpen} aria-controls={`panel-${s.id}`} onClick={() => setOpen(isOpen ? null : s.id)}
                >
                  <span className="text-[var(--text-muted)]"><SectionIcon type={s.type} size={18} /></span>
                  <span className="sec-title min-w-0 flex-1 truncate font-semibold">{s.title}</span>
                  {!s.visible && <span className="text-xs text-[var(--text-muted)]" aria-hidden="true">Hidden</span>}
                  <span className={`text-[var(--text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}><IconChevron size={18} /></span>
                </button>
                <Switch checked={s.visible} label={`Show ${s.title} on resume`} onChange={(v) => resumeStore.update((d) => patchSection(d, s.id, (x) => ({ ...x, visible: v })))} />
                <ActionMenu label={`Actions for ${s.title}`} testId={`menu-${s.type}`} actions={[
                  { label: `Move ${s.title} up`, onSelect: () => move(i, i - 1), disabled: i === 0, icon: <IconUp size={18} /> },
                  { label: `Move ${s.title} down`, onSelect: () => move(i, i + 1), disabled: i === n - 1, icon: <IconDown size={18} /> },
                  { label: `Remove ${s.title}`, onSelect: () => remove(i), danger: true, icon: <IconTrash size={18} /> },
                ]} />
              </div>
              {isOpen && (
                <div id={`panel-${s.id}`} className="space-y-4 border-t border-[var(--line)] p-3.5">
                  {s.type !== "contact" && <TextField label="Section heading" value={s.title} onChange={(v) => resumeStore.update((d) => patchSection(d, s.id, (x) => ({ ...x, title: v })))} hint="Standard names (Experience, Education, Skills) work best with ATS." />}
                  <SectionEditor section={s} onChange={(next) => resumeStore.update((d) => patchSection(d, s.id, () => next))} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p id="drag-help" className="sr-only">Press the up or down arrow key to move this section, or drag with a pointer.</p>
      <div className="well flex flex-wrap items-end gap-3 p-3.5">
        <div className="field min-w-[10rem] flex-1">
          <label htmlFor="add-type">Section type</label>
          <select id="add-type" value={addType} onChange={(e) => setAddType(e.target.value as SectionType)}>
            {SECTION_TYPES.map((t) => <option key={t} value={t}>{STANDARD_TITLES[t]}{t === "custom" ? " (custom)" : ""}</option>)}
          </select>
        </div>
        <button type="button" className="btn" onClick={add}><IconPlus size={18} />Add section</button>
      </div>
    </section>
  );
}
