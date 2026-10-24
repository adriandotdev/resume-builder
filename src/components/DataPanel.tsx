"use client";
import { useRef, useState } from "react";
import { newId, parseResumeDoc, type ResumeDoc } from "@/lib/schema";
import { resumeStore, useStoreStatus } from "@/lib/store";
import { fileSlug, isBundle } from "@/lib/versions";
import { parseApplications, remapVersions } from "@/lib/applications";
import { applicationsStore, useApplications } from "@/lib/applicationsStore";
import { useVersionIndex, versionsStore } from "@/lib/versionsStore";
import { IconDownload, IconDoc, IconUndo } from "./icons";
import { useToast } from "./Toast";

export function DataPanel({ doc }: { doc: ResumeDoc }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const status = useStoreStatus();
  const toast = useToast();

  const index = useVersionIndex();
  const versionName = index.versions.find((v) => v.id === index.activeId)?.name ?? "resume";

  const download = (data: unknown, fileName: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNote(`Exported ${fileName}`);
  };
  const exportJson = () => download(doc, `${fileSlug(versionName)}.json`);
  const applications = useApplications();
  const exportAll = () => download(versionsStore.exportAll(applications), "resume-versions.json");

  /** Replace the resume, with an Undo toast instead of a blocking confirm. */
  const replaceWith = (message: string, apply: () => void) => {
    const previous = resumeStore.getState();
    apply();
    toast.show({ message, actionLabel: "Undo", onAction: () => { resumeStore.setDoc(previous); setNote("Restored your previous resume"); } });
  };

  /** Imports never overwrite: each file becomes a new version, and Undo removes it again. */
  const onFile = async (file: File | undefined) => {
    setErrors([]); setNote("");
    if (!file) return;
    if (file.size > 2_000_000) { setErrors(["File is larger than 2 MB"]); return; }
    let raw: unknown;
    try { raw = JSON.parse(await file.text()); } catch { setErrors(["File is not valid JSON"]); return; }

    const incoming: { name: string; doc: ResumeDoc; oldId?: string }[] = [];
    let incomingApps: ReturnType<typeof parseApplications> = [];
    let migratedFrom: number | undefined;
    if (isBundle(raw)) {
      const problems: string[] = [];
      raw.versions.forEach((v, i) => {
        const res = parseResumeDoc(typeof v === "object" && v !== null ? (v as { doc?: unknown }).doc : undefined);
        if (res.ok) {
          const { name, id } = v as { name?: unknown; id?: unknown };
          incoming.push({ name: String(name ?? ""), doc: res.doc, oldId: typeof id === "string" ? id : undefined });
        }
        else problems.push(...res.errors.map((e) => `Version ${i + 1}: ${e}`));
      });
      if (problems.length || !incoming.length) { setErrors(problems.length ? problems.slice(0, 8) : ["The file has no versions"]); return; }
      incomingApps = parseApplications(raw.applications);
    } else {
      const res = parseResumeDoc(raw);
      if (!res.ok) { setErrors(res.errors.slice(0, 8)); return; }
      incoming.push({ name: file.name.replace(/\.json$/i, ""), doc: res.doc });
      migratedFrom = res.migratedFrom;
    }

    const previousId = index.activeId;
    const addedIds = incoming.map((v) => versionsStore.create(v.name || "Imported resume", v.doc));
    // Imported versions get new ids, so applications are re-pointed at them. Application ids are
    // regenerated too, so importing the same file twice never collides with what is already here.
    const idMap = new Map(incoming.flatMap((v, i) => (v.oldId ? [[v.oldId, addedIds[i]] as const] : [])));
    const addedApps = remapVersions(incomingApps, idMap).map((a) => ({ ...a, id: newId("app") }));
    applicationsStore.addMany(addedApps);
    const label = (incoming.length === 1 ? "Imported as a new version" : `Imported ${incoming.length} versions`)
      + (addedApps.length ? ` and ${addedApps.length} ${addedApps.length === 1 ? "application" : "applications"}.` : ".");
    toast.show({
      message: label,
      actionLabel: "Undo",
      onAction: () => {
        versionsStore.switchTo(previousId);
        addedIds.forEach((id) => versionsStore.remove(id));
        addedApps.forEach((a) => applicationsStore.remove(a.id));
        setNote("Removed the imported data");
      },
    });
    setNote(migratedFrom !== undefined ? `${label} (upgraded from version ${migratedFrom})` : label);
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
        <p className="field-hint">Export saves the version you are editing (“{versionName}”). Import adds the file as a new version and never overwrites one. A file that does not validate changes nothing.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={exportJson}><IconDownload size={18} />Export JSON</button>
          {(index.versions.length > 1 || applications.length > 0) && <button type="button" className="btn" onClick={exportAll} data-testid="export-all"><IconDownload size={18} />Export all versions{applications.length > 0 && " and applications"}</button>}
          <label className="btn cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
            <IconDoc size={18} />Import JSON
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} data-testid="import-input" />
          </label>
        </div>
      </div>

      <div className="well space-y-3 p-4">
        <h3 className="font-semibold">Start over</h3>
        <p className="field-hint">Both actions replace what is in the editor for this version. You can undo right after.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => replaceWith("Started a blank resume.", () => resumeStore.resetToBlank())}><IconUndo size={18} />Start blank</button>
          <button type="button" className="btn" onClick={() => replaceWith("Loaded the sample resume.", () => resumeStore.resetToSample())}>Load sample</button>
        </div>
      </div>

      <div role="status" aria-live="polite">
        {note && <p className="text-[0.9375rem] font-medium text-[var(--tick-text)]">{note}</p>}
        {errors.length > 0 && (
          <div className="rounded-[var(--r-control)] border border-[var(--pen-text)] bg-[var(--pen-soft)] p-3 text-[0.9375rem]" role="alert" data-testid="import-error">
            <p className="font-semibold text-[var(--pen-text)]">Import failed. Nothing was changed.</p>
            <ul className="mt-1 list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}
      </div>
    </section>
  );
}
