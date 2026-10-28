"use client";
import { AnimatePresence, motion } from "motion/react";
import { fade } from "@/lib/motion";
import { useRef, useState } from "react";
import { newId, type ResumeDoc } from "@/lib/schema";
import { resumeStore, useStoreStatus } from "@/lib/store";
import { fileSlug } from "@/lib/versions";
import { remapVersions } from "@/lib/applications";
import { applicationsStore, useApplications } from "@/lib/applicationsStore";
import { useVersionIndex, versionsStore } from "@/lib/versionsStore";
import { decryptJson, encryptJson, isEncrypted, type EncryptedEnvelope } from "@/lib/crypto";
import { MAX_IMPORT_BYTES, parseImport, type ParsedImport } from "@/lib/importFile";
import { REMIND_AFTER_DAYS } from "@/lib/backup";
import { backupStore, useBackupAgeLabel, useBackupStatus } from "@/lib/backupStore";
import { IconDownload, IconDoc, IconUndo } from "./icons";
import { PassphraseDialog, type PassphraseMode } from "./PassphraseDialog";
import { useToast } from "./Toast";

/** The open passphrase prompt: what it is for, and what to do with the passphrase. Null error means success. */
interface PendingPassphrase { mode: PassphraseMode; run: (passphrase: string) => Promise<string | null> }

export function DataPanel({ doc }: { doc: ResumeDoc }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [encrypt, setEncrypt] = useState(false);
  const [pending, setPendingState] = useState<PendingPassphrase | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // The prompt is kept after it closes so its content does not change while the dialog fades out.
  const setPending = (p: PendingPassphrase | null) => { if (p) setPendingState(p); setDialogOpen(p !== null); };
  const status = useStoreStatus();
  const toast = useToast();
  const backupAge = useBackupAgeLabel();
  const due = useBackupStatus() === "due";

  const index = useVersionIndex();
  const versionName = index.versions.find((v) => v.id === index.activeId)?.name ?? "resume";

  const save = (json: string, fileName: string, coversAll: boolean) => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNote(coversAll ? `Exported ${fileName}` : `Exported ${fileName}. This is one version only, so "Last backed up" is unchanged. Use "Export all versions" to back up everything.`);
  };
  const applications = useApplications();
  /** `coversAll` is true when the file holds everything, so the backup reminder can reset. */
  const download = (data: unknown, fileName: string, coversAll: boolean) => {
    if (!encrypt) {
      save(JSON.stringify(data, null, 2), fileName, coversAll);
      if (coversAll) backupStore.markBackedUp();
      return;
    }
    setPending({
      mode: "set",
      run: async (passphrase) => {
        try {
          const envelope = await encryptJson(JSON.stringify(data), passphrase);
          save(JSON.stringify(envelope, null, 2), fileName.replace(/\.json$/i, ".encrypted.json"), coversAll);
        } catch {
          return "Could not encrypt in this browser. Nothing was saved.";
        }
        if (coversAll) backupStore.markBackedUp();
        setPending(null);
        return null;
      },
    });
  };
  const exportJson = () => download(doc, `${fileSlug(versionName)}.json`, index.versions.length === 1 && applications.length === 0);
  const exportAll = () => download(versionsStore.exportAll(applications), "resume-versions.json", true);

  /** Replace the resume, with an Undo toast instead of a blocking confirm. */
  const replaceWith = (message: string, apply: () => void) => {
    const previous = resumeStore.getState();
    apply();
    toast.show({ message, actionLabel: "Undo", onAction: () => { resumeStore.setDoc(previous); setNote("Restored your previous resume"); } });
  };

  /** Imports never overwrite: each file becomes a new version, and Undo removes it again. */
  const applyImport = (parsed: Extract<ParsedImport, { ok: true }>) => {
    const { versions: incoming, applications: incomingApps, migratedFrom } = parsed;
    const previousId = index.activeId;
    const addedIds = incoming.map((v) => versionsStore.create(v.name || "Imported resume", v.doc, "", v.cover));
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
  };

  const importParsed = (raw: unknown, fallbackName: string) => {
    const parsed = parseImport(raw, fallbackName);
    if (!parsed.ok) { setErrors(parsed.errors); return; }
    applyImport(parsed);
  };

  const askPassphrase = (envelope: EncryptedEnvelope, fallbackName: string) => setPending({
    mode: "enter",
    run: async (passphrase) => {
      const res = await decryptJson(envelope, passphrase);
      if (!res.ok) return res.reason === "unsupported" ? "This backup was made by a newer version and cannot be read." : "That passphrase did not open the backup, or the file is damaged.";
      setPending(null);
      if (res.plain.length > MAX_IMPORT_BYTES) { setErrors(["File is larger than 2 MB"]); return null; }
      let raw: unknown;
      try { raw = JSON.parse(res.plain); } catch { setErrors(["The decrypted backup is not valid JSON"]); return null; }
      importParsed(raw, fallbackName);
      return null;
    },
  });

  const onFile = async (file: File | undefined) => {
    setErrors([]); setNote("");
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";
    if (file.size > MAX_IMPORT_BYTES) { setErrors(["File is larger than 2 MB"]); return; }
    let raw: unknown;
    try { raw = JSON.parse(await file.text()); } catch { setErrors(["File is not valid JSON"]); return; }
    const fallbackName = file.name.replace(/(\.encrypted)?\.json$/i, "");
    if (isEncrypted(raw)) { askPassphrase(raw, fallbackName); return; }
    importParsed(raw, fallbackName);
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
        <p className="field-hint" data-testid="backup-age">
          {backupAge}.
          {due && <> <strong className="font-semibold text-[var(--text)]" data-testid="backup-due">You have changes from over {REMIND_AFTER_DAYS} days ago that are not in a backup.</strong></>}
        </p>
        <label className="check-row">
          <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} data-testid="encrypt-toggle" />
          Protect exports with a passphrase
        </label>
        {encrypt && <p className="field-hint">You will be asked for the passphrase when you export. Without it the file cannot be opened. Resumes stored in this browser are not encrypted.</p>}
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
        <AnimatePresence initial={false}>
        {note && <motion.p key="note" {...fade} className="text-[0.9375rem] font-medium text-[var(--tick-text)]">{note}</motion.p>}
        {errors.length > 0 && (
          <motion.div key="errors" {...fade} className="overflow-hidden rounded-[var(--r-control)] border border-[var(--pen-text)] bg-[var(--pen-soft)] p-3 text-[0.9375rem]" role="alert" data-testid="import-error">
            <p className="font-semibold text-[var(--pen-text)]">Import failed. Nothing was changed.</p>
            <ul className="mt-1 list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      <PassphraseDialog open={dialogOpen && pending !== null} mode={pending?.mode ?? "set"} onClose={() => setPending(null)} onSubmit={(p) => pending?.run(p) ?? Promise.resolve(null)} />
    </section>
  );
}
