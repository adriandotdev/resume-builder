"use client";
import { AnimatePresence, motion } from "motion/react";
import { EASE } from "@/lib/motion";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { SECTION_TYPES, STANDARD_TITLES, type ResumeDoc, type SectionType } from "@/lib/schema";
import { addSection, insertSection, moveSection, patchSection, removeSection, type BulletJump, type FieldJump, type WriteInTarget } from "@/lib/ops";
import { resumeStore } from "@/lib/store";
import { dragTargetIndex } from "@/lib/ui";
import { SectionEditor } from "./SectionEditor";
import { TextField } from "./fields";
import { ActionMenu, Switch } from "./controls";
import { IconChevron, IconDown, IconGrip, IconPlus, IconTrash, IconUp, SectionIcon } from "./icons";
import { useToast } from "./Toast";

interface Geom { tops: number[]; heights: number[] }
interface DragState { from: number; dy: number; target: number; geom: Geom; dropping?: boolean }

const ROW_GAP = 8; // space-y-2
const DROP_MS = 180;

/** Where the dragged row will land, as an offsetTop inside the list. */
function slotTop({ from, target, geom }: Pick<DragState, "from" | "target" | "geom">) {
  return target > from ? geom.tops[target] + geom.heights[target] - geom.heights[from] : geom.tops[target];
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

/** The textarea that holds sentences for a write-in target: the summary, or the first job's achievements. */
function writeInField(panel: HTMLElement, target: WriteInTarget): HTMLTextAreaElement | null {
  const label = target === "summary" ? "Summary" : "Achievements";
  return [...panel.querySelectorAll("textarea")].find((t) => t.labels?.[0]?.textContent === label) ?? null;
}

export function SectionList({ doc, writeIn = null, onWriteInDone, jump = null, onJumpDone }: { doc: ResumeDoc; writeIn?: WriteInTarget | null; onWriteInDone?: () => void; jump?: BulletJump | FieldJump | null; onJumpDone?: () => void }) {
  const toast = useToast();
  // undefined = "first section open" (the default); null = user closed everything.
  const [open, setOpen] = useState<string | null | undefined>(undefined);
  const openId = open === undefined ? doc.sections[0]?.id ?? null : open;
  const [drag, setDrag] = useState<DragState | null>(null);
  const writeInId = writeIn ? doc.sections.find((x) => x.type === writeIn)?.id ?? null : null;
  if (writeIn && writeInId && open !== writeInId) setOpen(writeInId); // open the target before the focus effect runs
  const done = useRef(onWriteInDone);
  useEffect(() => { done.current = onWriteInDone; });
  useEffect(() => {
    if (!writeIn) return;
    const field = writeInId ? writeInField(document.getElementById(`panel-${writeInId}`) ?? document.body, writeIn) : null;
    if (field) { field.focus(); field.setSelectionRange(field.value.length, field.value.length); }
    done.current?.();
  }, [writeIn, writeInId]);
  if (jump && open !== jump.sectionId) setOpen(jump.sectionId);
  const jumped = useRef(onJumpDone);
  useEffect(() => { jumped.current = onJumpDone; });
  useEffect(() => {
    if (!jump) return;
    if ("label" in jump) {
      const scope = `#panel-${CSS.escape(jump.sectionId)}${jump.itemId ? ` li[data-item-id="${CSS.escape(jump.itemId)}"]` : ""}`;
      const label = [...document.querySelectorAll<HTMLLabelElement>(`${scope} label`)].find((l) => l.textContent?.trim() === jump.label);
      const input = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) { input.focus(); input.select(); } // select(), not setSelectionRange: that throws on type="email"
      jumped.current?.();
      return;
    }
    const field = document.querySelector<HTMLTextAreaElement>(`#panel-${CSS.escape(jump.sectionId)} li[data-item-id="${CSS.escape(jump.itemId)}"] textarea`);
    if (field) {
      const lines = field.value.split("\n");
      const start = lines.slice(0, jump.bulletIndex).reduce((n, l) => n + l.length + 1, 0);
      field.focus();
      field.setSelectionRange(start, start + (lines[jump.bulletIndex]?.length ?? 0));
    }
    jumped.current?.();
  }, [jump]);
  const [msg, setMsg] = useState("");
  const [settled, setSettled] = useState<string | null>(null); // row that just moved or came back, for the wash
  const [addType, setAddType] = useState<SectionType>("custom");
  const n = doc.sections.length;
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const pointer = useRef({ startY: 0, y: 0, startScroll: 0, from: -1, scroller: null as HTMLElement | null, mids: [] as number[], geom: { tops: [], heights: [] } as Geom });
  const dropTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(dropTimer.current), []);
  const dragging = drag !== null;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= n || from === to) return;
    const id = doc.sections[from].id;
    resumeStore.update((d) => moveSection(d, from, to));
    setSettled(id);
    setMsg(`${doc.sections[from].title} moved to position ${to + 1} of ${n}`);
  };
  const remove = (index: number) => {
    const s = doc.sections[index];
    resumeStore.update((d) => removeSection(d, s.id));
    toast.show({ message: `Removed ${s.title}.`, actionLabel: "Undo", onAction: () => { resumeStore.update((d) => insertSection(d, s, index)); setSettled(s.id); setMsg(`${s.title} restored`); } });
  };

  // Pointer-event drag: works for mouse, pen and touch (the handle has touch-action: none).
  const recompute = () => {
    const p = pointer.current;
    const scroll = p.scroller ? p.scroller.scrollTop : window.scrollY;
    const dy = p.y - p.startY + (scroll - p.startScroll);
    // Rows slide out of the way while dragging, so compare against midpoints measured at pickup (in scroll space).
    setDrag({ from: p.from, dy, target: dragTargetIndex(p.mids, p.from, p.y + scroll), geom: p.geom });
  };
  const onDown = (e: PointerEvent<HTMLButtonElement>, i: number) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const scroller = scrollParent(rows.current[i]);
    const startScroll = scroller ? scroller.scrollTop : window.scrollY;
    const els = rows.current.slice(0, n);
    const mids = els.map((el) => { const r = el?.getBoundingClientRect(); return r ? r.top + r.height / 2 + startScroll : 0; });
    const geom = { tops: els.map((el) => el?.offsetTop ?? 0), heights: els.map((el) => el?.offsetHeight ?? 0) };
    pointer.current = { startY: e.clientY, y: e.clientY, startScroll, from: i, scroller, mids, geom };
    clearTimeout(dropTimer.current);
    setDrag({ from: i, dy: 0, target: i, geom });
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.dropping) return;
    pointer.current.y = e.clientY;
    recompute();
  };
  const finish = (commit: boolean) => {
    const d = drag;
    if (!d || d.dropping) return;
    if (!commit) { setDrag(null); return; }
    // Glide the card into its slot, then commit the reorder once it has landed.
    setDrag({ ...d, dy: slotTop(d) - d.geom.tops[d.from], dropping: true });
    dropTimer.current = setTimeout(() => {
      setDrag(null);
      if (d.target !== d.from) move(d.from, d.target);
    }, DROP_MS);
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
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { clearTimeout(dropTimer.current); setDrag(null); } };
    window.addEventListener("keydown", esc);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", esc); };
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
        <p className="rounded-[var(--r-inset)] border border-dashed border-[var(--line-strong)] p-5 text-[var(--text-muted)]" data-testid="sections-empty">
          Your resume has no sections yet. Start with Contact so recruiters can reach you, then add Experience.
        </p>
      )}
      <ol className="relative isolate space-y-2" data-testid="section-list" data-reordering={dragging || undefined}>
        <AnimatePresence initial={false} mode="popLayout">
        {doc.sections.map((s, i) => {
          const isOpen = openId === s.id;
          const isDrag = drag?.from === i;
          // Rows between the pickup and the drop slot slide over by one row to open the gap.
          let shift = 0;
          if (drag && !isDrag) {
            const h = drag.geom.heights[drag.from] + ROW_GAP;
            if (drag.target > drag.from && i > drag.from && i <= drag.target) shift = -h;
            else if (drag.target < drag.from && i >= drag.target && i < drag.from) shift = h;
          }
          return (
            <motion.li
              key={s.id}
              layout={dragging ? false : "position"}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15, ease: EASE } }}
              transition={{ layout: { duration: 0.22, ease: EASE } }}
              ref={(el) => { rows.current[i] = el; }}
              data-section-type={s.type}
              data-dragging={isDrag}
              data-dropping={(isDrag && drag.dropping) || undefined}
              data-hidden={!s.visible}
              data-settled={settled === s.id || undefined}
              onAnimationEnd={(e) => { if (e.target === e.currentTarget) setSettled((c) => (c === s.id ? null : c)); }}
              className="sec-card relative"
              style={isDrag ? { y: drag.dy, scale: drag.dropping ? 1 : 1.015 } : shift ? { y: shift } : undefined}
            >
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
                  <motion.span className="text-[var(--text-muted)]" animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2, ease: EASE }}><IconChevron size={18} /></motion.span>
                </button>
                <Switch checked={s.visible} label={`Show ${s.title} on resume`} onChange={(v) => resumeStore.update((d) => patchSection(d, s.id, (x) => ({ ...x, visible: v })))} />
                <ActionMenu label={`Actions for ${s.title}`} testId={`menu-${s.type}`} actions={[
                  { label: `Move ${s.title} up`, onSelect: () => move(i, i - 1), disabled: i === 0, icon: <IconUp size={18} /> },
                  { label: `Move ${s.title} down`, onSelect: () => move(i, i + 1), disabled: i === n - 1, icon: <IconDown size={18} /> },
                  { label: `Remove ${s.title}`, onSelect: () => remove(i), danger: true, icon: <IconTrash size={18} /> },
                ]} />
              </div>
              <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="body" style={{ overflow: "hidden" }}
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: EASE }}
                >
                <div id={`panel-${s.id}`} className="sec-body space-y-4 border-t border-[var(--line)] p-3.5">
                  {s.type !== "contact" && <TextField label="Section heading" value={s.title} onChange={(v) => resumeStore.update((d) => patchSection(d, s.id, (x) => ({ ...x, title: v })))} hint="Standard names (Experience, Education, Skills) work best with ATS." />}
                  <SectionEditor section={s} onChange={(next) => resumeStore.update((d) => patchSection(d, s.id, () => next))} />
                </div>
                </motion.div>
              )}
              </AnimatePresence>
            </motion.li>
          );
        })}
        </AnimatePresence>
        {drag && <div className="drop-slot" style={{ height: drag.geom.heights[drag.from], transform: `translateY(${slotTop(drag)}px)` }} aria-hidden="true" />}
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
