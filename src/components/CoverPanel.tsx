"use client";
import { useDeferredValue, useMemo, useState } from "react";
import type { ResumeDoc } from "@/lib/schema";
import {
  addBodyBlock, appendSentence, insertBlock, KIND_LABELS, MAX_BLOCK, MAX_BLOCKS, MAX_FIELD, moveBlock, patchBlock,
  removeBlock, talkingPoints, talkingPointSentence, unfilledFields, type CoverBlock,
} from "@/lib/cover";
import { coverStore, useCoverLetter } from "@/lib/coverStore";
import { useJobPosting } from "@/lib/jobPostingStore";
import { useApplications } from "@/lib/applicationsStore";
import { ActionMenu, Switch } from "./controls";
import { SelectField, TextArea, TextField } from "./fields";
import { IconDown, IconPlus, IconTrash, IconUndo, IconUp } from "./icons";
import { useToast } from "./Toast";

const nf = new Intl.NumberFormat("en");
const count = (len: number, max: number) => (len >= max * 0.9 ? `${nf.format(len)} of ${nf.format(max)} characters${len >= max ? ". Limit reached." : "."}` : undefined);

/** Label for a block in lists and menus: "Body paragraph 2" when there is more than one. */
function blockLabel(blocks: CoverBlock[], b: CoverBlock): string {
  const same = blocks.filter((x) => x.kind === b.kind);
  return same.length > 1 ? `${KIND_LABELS[b.kind]} ${same.indexOf(b) + 1}` : KIND_LABELS[b.kind];
}

export function CoverPanel({ doc }: { doc: ResumeDoc }) {
  const letter = useCoverLetter();
  const toast = useToast();
  const { text: posting } = useJobPosting();
  const applications = useApplications();
  const [targetId, setTargetId] = useState("");
  const [moved, setMoved] = useState("");

  const deferredPosting = useDeferredValue(posting);
  const points = useMemo(() => talkingPoints(doc, deferredPosting), [doc, deferredPosting]);
  const missing = unfilledFields(doc, letter);

  const targets = letter.blocks.filter((b) => b.kind === "opening" || b.kind === "body");
  const target = targets.find((b) => b.id === targetId) ?? targets.find((b) => b.kind === "body") ?? targets[0];
  const used = (term: string) => letter.blocks.some((b) => b.text.toLowerCase().includes(term.toLowerCase()));

  const set = (patch: Partial<Pick<typeof letter, "company" | "role" | "hiringManager">>) => coverStore.update((l) => ({ ...l, ...patch }));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= letter.blocks.length) return;
    const b = letter.blocks[from];
    coverStore.update((l) => moveBlock(l, from, to));
    setMoved(`${blockLabel(letter.blocks, b)} moved to position ${to + 1} of ${letter.blocks.length}`);
  };
  const remove = (b: CoverBlock, n: number) => {
    const label = blockLabel(letter.blocks, b);
    coverStore.update((l) => removeBlock(l, b.id));
    // Undo reads the latest letter, so edits made after removing are kept.
    toast.show({ message: `Removed ${label}.`, actionLabel: "Undo", onAction: () => coverStore.update((l) => insertBlock(l, b, n)) });
  };
  const reset = () => {
    const previous = coverStore.getState();
    coverStore.reset();
    toast.show({ message: "Letter reset to the template.", actionLabel: "Undo", onAction: () => coverStore.setLetter(previous) });
  };
  const addPoint = (term: string) => {
    if (!target) return;
    coverStore.update((l) => patchBlock(l, target.id, { text: appendSentence(l.blocks.find((b) => b.id === target.id)?.text ?? "", talkingPointSentence(term)) }));
    toast.show({ message: `Added a sentence about "${term}" to ${blockLabel(letter.blocks, target)}. Make it specific.` });
  };

  return (
    <section aria-labelledby="cover-h" className="space-y-6" data-testid="cover-panel">
      <div>
        <h2 id="cover-h" className="serif text-2xl">Cover letter</h2>
        <p className="field-hint mt-1 measure">
          Your name and contact details come from the resume. The letter is saved with this version and downloads as a PDF with the same template, font and paper size. Nothing is written for you.
        </p>
      </div>

      <div className="well space-y-3 p-4">
        <TextField label="Company" value={letter.company} onChange={(v) => set({ company: v })} maxLength={MAX_FIELD} placeholder="Northgate Freight" />
        <TextField label="Role" value={letter.role} onChange={(v) => set({ role: v })} maxLength={MAX_FIELD} placeholder="Operations Analyst" />
        <TextField label="Hiring manager (optional)" value={letter.hiringManager} onChange={(v) => set({ hiringManager: v })} maxLength={MAX_FIELD} hint="Leave empty to greet “Hiring Manager”." />
        {applications.length > 0 && (
          <div className="field">
            <label htmlFor="cover-fill">Fill from a tracked application</label>
            <select id="cover-fill" className="input" value="" onChange={(e) => { const a = applications.find((x) => x.id === e.target.value); if (a) set({ company: a.company, role: a.role }); }}>
              <option value="">Choose an application</option>
              {applications.map((a) => <option key={a.id} value={a.id}>{[a.company, a.role].filter(Boolean).join(" - ") || "Untitled application"}</option>)}
            </select>
          </div>
        )}
        {missing.length > 0 && (
          <p className="field-hint font-medium text-[var(--pen-text)]" data-testid="cover-missing">
            Add the {missing.join(" and ")} so the letter does not show a placeholder.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold">Letter blocks</h3>
        <p className="sr-only" role="status" aria-live="polite">{moved}</p>
        <ul className="space-y-3">
          {letter.blocks.map((b, n) => {
            const label = blockLabel(letter.blocks, b);
            return (
              <li key={b.id} className="rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface-2)] p-3" data-testid="cover-block">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[0.9375rem] font-semibold">{label}{!b.visible && <span className="ml-2 font-normal text-[var(--text-muted)]">(hidden)</span>}</span>
                  <div className="flex items-center gap-2">
                    <Switch checked={b.visible} onChange={(v) => coverStore.update((l) => patchBlock(l, b.id, { visible: v }))} label={`Show ${label}`} />
                    <ActionMenu label={`Actions for ${label}`} actions={[
                      { label: `Move ${label} up`, onSelect: () => move(n, n - 1), disabled: n === 0, icon: <IconUp size={18} /> },
                      { label: `Move ${label} down`, onSelect: () => move(n, n + 1), disabled: n === letter.blocks.length - 1, icon: <IconDown size={18} /> },
                      { label: `Remove ${label}`, onSelect: () => remove(b, n), danger: true, icon: <IconTrash size={18} /> },
                    ]} />
                  </div>
                </div>
                <TextArea label={`${label} text`} rows={b.kind === "body" ? 5 : 3} value={b.text} maxLength={MAX_BLOCK} onChange={(v) => coverStore.update((l) => patchBlock(l, b.id, { text: v }))} hint={count(b.text.length, MAX_BLOCK)} />
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => coverStore.update(addBodyBlock)} disabled={letter.blocks.length >= MAX_BLOCKS}><IconPlus size={18} />Add paragraph</button>
          <button type="button" className="btn" onClick={reset}><IconUndo size={18} />Reset to template</button>
        </div>
        <p className="field-hint">Use {"{company}"}, {"{role}"}, {"{manager}"} and {"{name}"} to fill in details automatically.</p>
      </div>

      <div className="well space-y-3 p-4" data-testid="cover-points">
        <h3 className="text-base font-semibold">Talking points from the job posting</h3>
        {!posting.trim() ? (
          <p className="field-hint">Paste a job posting in the ATS check tab and the skills your resume already covers show up here.</p>
        ) : points.length === 0 ? (
          <p className="field-hint">None of the posting’s key terms appear in your visible resume sections yet.</p>
        ) : (
          <>
            <p className="field-hint">Terms from the posting that your resume covers. Adding one drops in a plain sentence for you to rewrite with a real example.</p>
            {targets.length > 1 && (
              <SelectField label="Add to" value={target?.id ?? ""} options={targets.map((b) => ({ value: b.id, label: blockLabel(letter.blocks, b) }))} onChange={setTargetId} />
            )}
            <ul className="flex flex-wrap gap-2">
              {points.slice(0, 12).map((t) => (
                <li key={t.term}>
                  <button type="button" className="btn" disabled={!target} onClick={() => addPoint(t.term)} aria-label={`Add a sentence about ${t.term}${used(t.term) ? " (already mentioned)" : ""}`}>
                    <IconPlus size={16} />{t.term}{used(t.term) && <span className="badge ml-1" aria-hidden="true">used</span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
