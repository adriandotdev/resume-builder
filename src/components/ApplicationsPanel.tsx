"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { MAX_FIELD, MAX_NOTES, MAX_POSTING, MAX_URL, STATUSES, STATUS_LABELS, type AppStatus, type Application } from "@/lib/applications";
import { applicationsStore, useApplications, useApplicationsStatus } from "@/lib/applicationsStore";
import { jobPostingStore } from "@/lib/jobPostingStore";
import { browserStorage } from "@/lib/store";
import { jdKey } from "@/lib/versions";
import { useVersionIndex, versionsStore } from "@/lib/versionsStore";
import { Modal } from "./Modal";
import { Segmented } from "./controls";
import { SelectField, TextArea, TextField } from "./fields";
import { IconClose, IconEdit, IconPlus, IconTrash, IconWarn } from "./icons";
import { useToast } from "./Toast";

type Filter = "all" | AppStatus;
type Draft = { company: string; role: string; url: string; status: AppStatus; versionId: string; posting: string; notes: string };

const NO_VERSION = "";
const EASE = [0.23, 1, 0.32, 1] as const;
/** Fade-up entrance. Only the first few steps are staggered so a long list never lags. */
const enter = (i = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.26, ease: EASE, delay: Math.min(i, 7) * 0.04 },
});
const nf = new Intl.NumberFormat();
/** Counter text once a field is within 10% of its limit; undefined while there is plenty of room. */
const nearLimit = (len: number, max: number) => (len >= max * 0.9 ? `${nf.format(len)} of ${nf.format(max)} characters${len >= max ? ". Limit reached." : "."}` : undefined);
const withCount = (hint: string | undefined, len: number, max: number) => [hint, nearLimit(len, max)].filter(Boolean).join(" ") || undefined;
const fmt = (t?: number) => (t ? new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "");

/** The posting saved with a version. The active version's text may still be waiting on its save debounce. */
function postingOf(versionId: string, activeId: string): string {
  if (!versionId) return "";
  if (versionId === activeId) return jobPostingStore.getText();
  try { return browserStorage()?.getItem(jdKey(versionId)) ?? ""; } catch { return ""; }
}

export function ApplicationsPanel() {
  const router = useRouter();
  const toast = useToast();
  const apps = useApplications();
  const index = useVersionIndex();
  const [filter, setFilter] = useState<Filter>("all");
  const { loaded, saveFailed } = useApplicationsStatus();
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft; initial: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showError, setShowError] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  // The cascade plays once per visit; after that rows fade in on their own (filter change, undo).
  const [intro, setIntro] = useState(true);
  useEffect(() => { if (!loaded) return; const t = setTimeout(() => setIntro(false), 700); return () => clearTimeout(t); }, [loaded]);

  const versionName = (id: string) => index.versions.find((v) => v.id === id)?.name ?? "";
  const counts = useMemo(() => {
    const c = new Map<AppStatus, number>();
    apps.forEach((a) => c.set(a.status, (c.get(a.status) ?? 0) + 1));
    return c;
  }, [apps]);
  // A status with no applications has no option, so fall back to All instead of an empty list.
  const active: Filter = filter !== "all" && !counts.get(filter) ? "all" : filter;
  const shown = active === "all" ? apps : apps.filter((a) => a.status === active);

  const open = (id: string | null, draft: Draft) => { setShowError(false); setConfirmDiscard(false); setEditing({ id, draft, initial: JSON.stringify(draft) }); };
  const close = () => { setEditing(null); setConfirmDiscard(false); setShowError(false); };
  // Esc, the backdrop and Close all ask first when the draft has changes.
  const requestClose = () => {
    if (editing && JSON.stringify(editing.draft) !== editing.initial) setConfirmDiscard(true);
    else close();
  };
  const focusRow = (id: string) => setTimeout(() => listRef.current?.querySelector<HTMLElement>(`[data-app-id="${id}"] h2`)?.focus(), 0);

  const blank = (): Draft => {
    const versionId = index.activeId;
    return { company: "", role: "", url: "", status: "saved", versionId, posting: postingOf(versionId, index.activeId), notes: "" };
  };
  const fromApp = (a: Application): Draft => ({
    company: a.company, role: a.role, url: a.url, status: a.status,
    versionId: a.versionId && versionName(a.versionId) ? a.versionId : NO_VERSION, posting: a.posting, notes: a.notes,
  });

  const save = () => {
    if (!editing) return;
    const d = editing.draft;
    const input = { company: d.company, role: d.role, url: d.url, status: d.status, versionId: d.versionId || null, versionName: d.versionId ? versionName(d.versionId) : "", posting: d.posting, notes: d.notes };
    if (editing.id) applicationsStore.update(editing.id, input);
    else applicationsStore.add(input);
    const savedId = editing.id;
    close();
    if (savedId) focusRow(savedId);
  };
  const remove = (a: Application) => {
    const at = shown.findIndex((x) => x.id === a.id);
    const removed = applicationsStore.remove(a.id);
    if (!removed) return;
    toast.show({ message: `Deleted ${a.company || a.role}.`, actionLabel: "Undo", onAction: () => { applicationsStore.restore(removed); focusRow(a.id); } });
    // The focused Delete button is gone: hand focus to the neighbouring row, or to Add when none is left.
    const next = shown[at + 1] ?? shown[at - 1];
    if (next) focusRow(next.id);
    else setTimeout(() => addRef.current?.focus(), 0);
  };
  const openResume = (versionId: string) => { versionsStore.switchTo(versionId); router.push("/editor"); };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, [k]: v } } : e));
  const canSave = !!editing && (editing.draft.company.trim() !== "" || editing.draft.role.trim() !== "");
  const needsName = showError && !canSave;
  const trySave = () => {
    if (canSave) { save(); return; }
    setShowError(true);
    formRef.current?.querySelector<HTMLElement>("input")?.focus();
  };

  if (!loaded) return <div className="app-sheet"><h1 className="app-title">Applications</h1></div>;

  return (
    <MotionConfig reducedMotion="user">
    <div className="app-sheet">
      <motion.div className="flex flex-wrap items-start justify-between gap-4" {...enter()}>
        <div className="max-w-[60ch]">
          <h1 className="app-title">Applications</h1>
          <p className="mt-2 text-[var(--text-muted)]">
            Track where each resume version went. A copy of the job posting is kept with every application. Everything stays in this browser and is never uploaded.
          </p>
        </div>
        <button ref={addRef} type="button" className="btn btn-primary" onClick={() => open(null, blank())} data-testid="add-application">
          <IconPlus size={18} />Add application
        </button>
      </motion.div>

      {saveFailed && (
        <motion.p role="alert" {...enter()} className="mt-6 flex max-w-[60ch] items-start gap-2 rounded-[var(--r-control)] bg-[var(--pen-soft)] p-3 text-[0.9375rem] font-medium text-[var(--pen-text)]" data-testid="applications-save-failed">
          <span className="mt-0.5 shrink-0"><IconWarn size={18} /></span>
          <span>Not saved: browser storage is blocked or full. These applications will be lost when you close this tab. Shorten or delete saved postings, or export your data from the editor&apos;s Data tab.</span>
        </motion.p>
      )}

      {apps.length > 0 && (
        <motion.div className="mt-6" {...enter(intro ? 1 : 0)}>
          <Segmented
            legend="Show"
            value={active}
            onChange={setFilter}
            options={[{ value: "all", label: `All (${apps.length})` }, ...STATUSES.filter((s) => counts.get(s)).map((s) => ({ value: s, label: `${STATUS_LABELS[s]} (${counts.get(s)})` }))]}
          />
        </motion.div>
      )}

      {apps.length === 0 ? (
        <motion.div className="well mt-8 max-w-[60ch] space-y-2 p-5" {...enter(1)} data-testid="applications-empty">
          <h2 className="serif text-xl">No applications yet</h2>
          <p className="field-hint">Add one when you apply. Pick the resume version you used and paste the posting, so you can see later what you sent and what they asked for.</p>
        </motion.div>
      ) : (
        <ul ref={listRef} className="mt-6 flex flex-col gap-3" aria-label="Applications" data-testid="applications-list">
          <AnimatePresence mode="popLayout" initial>
          {shown.map((a, i) => {
            const linked = a.versionId ? versionName(a.versionId) : "";
            return (
              <motion.li
                key={a.id}
                layout="position"
                {...enter(intro ? i + 2 : 0)}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15, ease: EASE } }}
                data-app-id={a.id}
                className="well space-y-3 p-4"
                data-testid="application"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 tabIndex={-1} className="serif text-xl">{a.role || "Untitled role"}{a.company && <span className="text-[var(--text-muted)]"> at {a.company}</span>}</h2>
                    <p className="field-hint mt-1">
                      Status: <strong>{STATUS_LABELS[a.status]}</strong>
                      {a.appliedAt ? ` · Applied ${fmt(a.appliedAt)}` : ""}{a.updatedAt ? ` · Updated ${fmt(a.updatedAt)}` : ""}
                    </p>
                    <p className="field-hint">
                      Resume: {linked || (a.versionName ? `${a.versionName} (version deleted)` : "none linked")}
                    </p>
                    {a.url && /^https?:\/\//i.test(a.url) && (
                      <p className="field-hint"><a href={a.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Posting link<span className="sr-only"> for {a.company || a.role} (opens in a new tab)</span></a></p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {linked && a.versionId && <button type="button" className="btn" onClick={() => openResume(a.versionId!)}>Open resume<span className="sr-only"> for {a.company || a.role}</span></button>}
                    <button type="button" className="btn" onClick={() => open(a.id, fromApp(a))}><IconEdit size={18} />Edit<span className="sr-only"> {a.company || a.role}</span></button>
                    <button type="button" className="btn btn-quiet btn-icon" aria-label={`Delete ${a.company || a.role}`} onClick={() => remove(a)}><IconTrash size={18} /></button>
                  </div>
                </div>
                {a.notes && <p className="measure whitespace-pre-wrap text-[0.9375rem]">{a.notes}</p>}
              </motion.li>
            );
          })}
          </AnimatePresence>
        </ul>
      )}

      <Modal open={!!editing} onClose={requestClose} labelledBy="app-modal-h" testId="application-dialog">
        {editing && (
          <form ref={formRef} noValidate className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); trySave(); }}>
            <div className="flex items-start justify-between gap-3">
              <h2 id="app-modal-h" className="serif text-2xl">{editing.id ? "Edit application" : "Add application"}</h2>
              <button type="button" className="btn btn-quiet btn-icon -mr-2" aria-label="Close" onClick={requestClose}><IconClose /></button>
            </div>
            <TextField label="Company" autoFocus maxLength={MAX_FIELD} value={editing.draft.company} onChange={(v) => set("company", v)} hint="Add a company, a role, or both." error={needsName ? "Enter a company or a role to save this application." : undefined} />
            <TextField label="Role" maxLength={MAX_FIELD} value={editing.draft.role} onChange={(v) => set("role", v)} />
            <SelectField label="Status" value={editing.draft.status} options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} onChange={(v) => set("status", v)} />
            <SelectField
              label="Resume version used"
              value={editing.draft.versionId}
              options={[{ value: NO_VERSION, label: "None" }, ...index.versions.map((v) => ({ value: v.id, label: v.name }))]}
              onChange={(v) => setEditing((e) => {
                if (!e) return e;
                // Follow the version's posting only while the user has not typed or pasted their own.
                const prevPosting = postingOf(e.draft.versionId, index.activeId);
                const posting = e.draft.posting.trim() === "" || e.draft.posting === prevPosting ? postingOf(v, index.activeId) : e.draft.posting;
                return { ...e, draft: { ...e.draft, versionId: v, posting } };
              })}
            />
            <TextField label="Posting link" type="url" maxLength={MAX_URL} value={editing.draft.url} onChange={(v) => set("url", v)} placeholder="https://" />
            <TextArea label="Job posting" rows={6} value={editing.draft.posting} onChange={(v) => set("posting", v)} maxLength={MAX_POSTING} hint={withCount("A copy is saved with this application. It starts from the posting saved on the chosen version.", editing.draft.posting.length, MAX_POSTING)} />
            <TextArea label="Notes" rows={3} maxLength={MAX_NOTES} value={editing.draft.notes} onChange={(v) => set("notes", v)} hint={nearLimit(editing.draft.notes.length, MAX_NOTES)} />
            {confirmDiscard ? (
              <div role="alertdialog" aria-labelledby="app-discard-h" className="well space-y-3 p-4" data-testid="discard-confirm">
                <p id="app-discard-h" className="font-medium">Discard your changes? Anything you typed or pasted here will be lost.</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className="btn" onClick={() => setConfirmDiscard(false)} autoFocus>Keep editing</button>
                  <button type="button" className="btn btn-danger" onClick={close} data-testid="discard-application">Discard</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className="btn" onClick={requestClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" data-testid="save-application">Save</button>
              </div>
            )}
          </form>
        )}
      </Modal>
    </div>
    </MotionConfig>
  );
}
