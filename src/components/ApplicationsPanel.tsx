"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUSES, STATUS_LABELS, type AppStatus, type Application } from "@/lib/applications";
import { applicationsStore, useApplications } from "@/lib/applicationsStore";
import { jobPostingStore } from "@/lib/jobPostingStore";
import { browserStorage } from "@/lib/store";
import { jdKey } from "@/lib/versions";
import { useVersionIndex, versionsStore } from "@/lib/versionsStore";
import { Modal } from "./Modal";
import { Segmented } from "./controls";
import { SelectField, TextArea, TextField } from "./fields";
import { IconClose, IconEdit, IconPlus, IconTrash } from "./icons";
import { useToast } from "./Toast";

type Filter = "all" | AppStatus;
type Draft = { company: string; role: string; url: string; status: AppStatus; versionId: string; posting: string; notes: string };

const NO_VERSION = "";
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
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);

  const versionName = (id: string) => index.versions.find((v) => v.id === id)?.name ?? "";
  const counts = useMemo(() => {
    const c = new Map<AppStatus, number>();
    apps.forEach((a) => c.set(a.status, (c.get(a.status) ?? 0) + 1));
    return c;
  }, [apps]);
  const shown = filter === "all" ? apps : apps.filter((a) => a.status === filter);

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
    setEditing(null);
  };
  const remove = (a: Application) => {
    const removed = applicationsStore.remove(a.id);
    if (!removed) return;
    toast.show({ message: `Deleted ${a.company || a.role}.`, actionLabel: "Undo", onAction: () => applicationsStore.restore(removed) });
  };
  const openResume = (versionId: string) => { versionsStore.switchTo(versionId); router.push("/editor"); };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, [k]: v } } : e));
  const canSave = !!editing && (editing.draft.company.trim() !== "" || editing.draft.role.trim() !== "");

  return (
    <div className="app-sheet">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[60ch]">
          <h1 className="app-title">Applications</h1>
          <p className="mt-2 text-[var(--text-muted)]">
            Track where each resume version went. A copy of the job posting is kept with every application. Everything stays in this browser and is never uploaded.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ id: null, draft: blank() })} data-testid="add-application">
          <IconPlus size={18} />Add application
        </button>
      </div>

      {apps.length > 0 && (
        <div className="mt-6">
          <Segmented
            legend="Show"
            value={filter}
            onChange={setFilter}
            options={[{ value: "all", label: `All (${apps.length})` }, ...STATUSES.filter((s) => counts.get(s)).map((s) => ({ value: s, label: `${STATUS_LABELS[s]} (${counts.get(s)})` }))]}
          />
        </div>
      )}

      {apps.length === 0 ? (
        <div className="well mt-8 max-w-[60ch] space-y-2 p-5" data-testid="applications-empty">
          <h2 className="serif text-xl">No applications yet</h2>
          <p className="field-hint">Add one when you apply. Pick the resume version you used and paste the posting, so you can see later what you sent and what they asked for.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3" aria-label="Applications" data-testid="applications-list">
          {shown.map((a) => {
            const linked = a.versionId ? versionName(a.versionId) : "";
            return (
              <li key={a.id} className="well space-y-3 p-4" data-testid="application">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="serif text-xl">{a.role || "Untitled role"}{a.company && <span className="text-[var(--text-muted)]"> at {a.company}</span>}</h2>
                    <p className="field-hint mt-1">
                      Status: <strong>{STATUS_LABELS[a.status]}</strong>
                      {a.appliedAt ? ` · Applied ${fmt(a.appliedAt)}` : ""} · Updated {fmt(a.updatedAt)}
                    </p>
                    <p className="field-hint">
                      Resume: {linked || (a.versionName ? `${a.versionName} (version deleted)` : "none linked")}
                    </p>
                    {a.url && /^https?:\/\//i.test(a.url) && (
                      <p className="field-hint"><a href={a.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Posting link</a></p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {linked && a.versionId && <button type="button" className="btn" onClick={() => openResume(a.versionId!)}>Open resume</button>}
                    <button type="button" className="btn" onClick={() => setEditing({ id: a.id, draft: fromApp(a) })}><IconEdit size={18} />Edit<span className="sr-only"> {a.company || a.role}</span></button>
                    <button type="button" className="btn btn-quiet btn-icon" aria-label={`Delete ${a.company || a.role}`} onClick={() => remove(a)}><IconTrash size={18} /></button>
                  </div>
                </div>
                {a.notes && <p className="measure whitespace-pre-wrap text-[0.9375rem]">{a.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} labelledBy="app-modal-h" testId="application-dialog">
        {editing && (
          <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); if (canSave) save(); }}>
            <div className="flex items-start justify-between gap-3">
              <h2 id="app-modal-h" className="serif text-2xl">{editing.id ? "Edit application" : "Add application"}</h2>
              <button type="button" className="btn btn-quiet btn-icon -mr-2" aria-label="Close" onClick={() => setEditing(null)}><IconClose /></button>
            </div>
            <TextField label="Company" value={editing.draft.company} onChange={(v) => set("company", v)} />
            <TextField label="Role" value={editing.draft.role} onChange={(v) => set("role", v)} hint="Company or role is required." />
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
            <TextField label="Posting link" type="url" value={editing.draft.url} onChange={(v) => set("url", v)} placeholder="https://" />
            <TextArea label="Job posting" rows={6} value={editing.draft.posting} onChange={(v) => set("posting", v)} hint="A copy is saved with this application. It starts from the posting saved on the chosen version." />
            <TextArea label="Notes" rows={3} value={editing.draft.notes} onChange={(v) => set("notes", v)} />
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!canSave} data-testid="save-application">Save</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
