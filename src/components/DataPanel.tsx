"use client";
import { useRef, useState } from "react";
import { parseResumeDoc, type ResumeDoc } from "@/lib/schema";
import { resumeStore, useStoreStatus } from "@/lib/store";
import { IconDownload, IconDoc, IconUndo } from "./icons";
import { useToast } from "./Toast";

export function DataPanel({ doc }: { doc: ResumeDoc }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const status = useStoreStatus();
  const toast = useToast();

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNote("Exported resume.json");
  };

  /** Replace the resume, with an Undo toast instead of a blocking confirm. */
  const replaceWith = (message: string, apply: () => void) => {
    const previous = resumeStore.getState();
    apply();
    toast.show({ message, actionLabel: "Undo", onAction: () => { resumeStore.setDoc(previous); setNote("Restored your previous resume"); } });
  };

  const onFile = async (file: File | undefined) => {
    setErrors([]); setNote("");
    if (!file) return;
    if (file.size > 2_000_000) { setErrors(["File is larger than 2 MB"]); return; }
    let raw: unknown;
    try { raw = JSON.parse(await file.text()); } catch { setErrors(["File is not valid JSON"]); return; }
    const res = parseResumeDoc(raw);
    if (!res.ok) { setErrors(res.errors.slice(0, 8)); return; }
    replaceWith("Imported your resume.", () => resumeStore.setDoc(res.doc));
    setNote(res.migratedFrom !== undefined ? `Imported (upgraded from version ${res.migratedFrom})` : "Imported successfully");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <section aria-labelledby="data-h" className="space-y-6">
      <div>
        <h2 id="data-h" className="serif text-2xl">Your data</h2>
        <p className="field-hint mt-1 measure">
          Everything is stored only in this browser and never uploaded. Export a JSON backup to keep your resume or move it to another device.
        </p>
      </div>
      {status === "unavailable" && <p className="rounded-[var(--r-control)] bg-[var(--pen-soft)] p-3 text-[0.9375rem] font-medium text-[var(--pen-text)]">Browser storage is unavailable, so changes will not persist. Export JSON to save your work.</p>}
      {status === "corrupt" && <p className="rounded-[var(--r-control)] bg-[var(--pen-soft)] p-3 text-[0.9375rem] font-medium text-[var(--pen-text)]">Saved data could not be read and was ignored.</p>}

      <div className="well space-y-3 p-4">
        <h3 className="font-semibold">Back up and restore</h3>
        <p className="field-hint">Import checks the file first. A file that does not validate never changes your current resume.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={exportJson}><IconDownload size={18} />Export JSON</button>
          <label className="btn cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
            <IconDoc size={18} />Import JSON
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} data-testid="import-input" />
          </label>
        </div>
      </div>

      <div className="well space-y-3 p-4">
        <h3 className="font-semibold">Start over</h3>
        <p className="field-hint">Both actions replace what is in the editor. You can undo right after.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => replaceWith("Started a blank resume.", () => resumeStore.resetToBlank())}><IconUndo size={18} />Start blank</button>
          <button type="button" className="btn" onClick={() => replaceWith("Loaded the sample resume.", () => resumeStore.resetToSample())}>Load sample</button>
        </div>
      </div>

      <div role="status" aria-live="polite">
        {note && <p className="text-[0.9375rem] font-medium text-[var(--tick-text)]">{note}</p>}
        {errors.length > 0 && (
          <div className="rounded-[var(--r-control)] border border-[var(--pen-text)] bg-[var(--pen-soft)] p-3 text-[0.9375rem]" role="alert" data-testid="import-error">
            <p className="font-semibold text-[var(--pen-text)]">Import failed. Your current resume was not changed.</p>
            <ul className="mt-1 list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}
      </div>
    </section>
  );
}
