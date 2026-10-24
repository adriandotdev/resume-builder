"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_NAME_LENGTH } from "@/lib/versions";
import { useVersionIndex, versionsStore, type RemovedVersion } from "@/lib/versionsStore";
import { Modal } from "./Modal";
import { IconClose } from "./icons";

/** Pick which version of the resume to edit, and open the dialog to manage them. */
export function VersionSwitcher() {
  const index = useVersionIndex();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="field !flex-row shrink-0 items-center !gap-2">
        <label htmlFor="version-select" className="whitespace-nowrap max-sm:sr-only">Version</label>
        <select id="version-select" className="input !w-auto max-w-[9rem] sm:max-w-[14rem]" value={index.activeId} onChange={(e) => versionsStore.switchTo(e.target.value)} data-testid="version-select">
          {index.versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <button type="button" className="btn" onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="manage-versions">Manage</button>
      </div>
      <VersionsDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function VersionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const index = useVersionIndex();
  const [removed, setRemoved] = useState<RemovedVersion | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const only = index.versions.length <= 1;

  const add = (id: string | null) => { setRemoved(null); setRenameId(id); };
  const close = () => { setRemoved(null); setRenameId(null); onClose(); };

  return (
    <Modal open={open} onClose={close} labelledBy="versions-h" testId="versions-dialog">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="versions-h" className="display text-3xl">Resume versions</h2>
          <button type="button" className="btn btn-quiet btn-icon -mr-2" aria-label="Close" onClick={close}><IconClose /></button>
        </div>
        <p className="mt-2 text-[var(--text-muted)]">Keep one resume per role, each with its own content, design and job posting. Everything stays in this browser.</p>

        <ul className="mt-4 space-y-2" aria-label="Your versions">
          {index.versions.map((v) => (
            <VersionRow
              key={v.id}
              id={v.id}
              name={v.name}
              active={v.id === index.activeId}
              canDelete={!only}
              focusName={renameId === v.id}
              onOpen={() => { versionsStore.switchTo(v.id); close(); }}
              onDuplicate={() => add(versionsStore.duplicate(v.id))}
              onDelete={() => { setRemoved(versionsStore.remove(v.id)); setRenameId(null); }}
            />
          ))}
        </ul>

        <div role="status" aria-live="polite" className="mt-3 min-h-[1.5rem]">
          {removed && (
            <p className="flex flex-wrap items-center gap-2 text-[0.9375rem]" data-testid="version-removed">
              <span>Deleted “{removed.meta.name}”.</span>
              <button type="button" className="btn" onClick={() => { versionsStore.restore(removed); setRemoved(null); }} data-testid="version-undo">Undo</button>
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => add(versionsStore.create())} data-autofocus data-testid="version-new">New blank version</button>
          <button type="button" className="btn" onClick={close}>Done</button>
        </div>
      </div>
    </Modal>
  );
}

function VersionRow({ id, name, active, canDelete, focusName, onOpen, onDuplicate, onDelete }: {
  id: string; name: string; active: boolean; canDelete: boolean; focusName: boolean;
  onOpen: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null); // null: not being edited, show the saved name
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusName) { ref.current?.focus(); ref.current?.select(); } }, [focusName]);

  const commit = () => {
    if (draft !== null) versionsStore.rename(id, draft);
    setDraft(null);
  };

  return (
    <li className="well flex flex-wrap items-center gap-2 p-3" data-testid="version-row">
      <label className="sr-only" htmlFor={`vname-${id}`}>Version name</label>
      <input
        ref={ref}
        id={`vname-${id}`}
        className="input min-w-0 flex-1 basis-40"
        value={draft ?? name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape" && draft !== null) { e.preventDefault(); e.stopPropagation(); setDraft(null); }
        }}
      />
      {active ? <span className="badge">Editing</span> : <button type="button" className="btn" onClick={onOpen} aria-label={`Open ${name}`}>Open</button>}
      <button type="button" className="btn" onClick={onDuplicate} aria-label={`Duplicate ${name}`}>Duplicate</button>
      <button type="button" className="btn" onClick={onDelete} disabled={!canDelete} aria-label={`Delete ${name}`}>Delete</button>
    </li>
  );
}
