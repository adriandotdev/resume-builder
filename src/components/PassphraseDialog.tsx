"use client";
import { useState, type FormEvent } from "react";
import { MIN_PASSPHRASE, validatePassphrase } from "@/lib/crypto";
import { Modal } from "./Modal";
import { TextField } from "./fields";
import { IconClose } from "./icons";

export type PassphraseMode = "set" | "enter";

interface Props {
  open: boolean;
  mode: PassphraseMode;
  onClose: () => void;
  /** Runs the encryption or decryption. Resolve with an error message to keep the dialog open, or null when done. */
  onSubmit: (passphrase: string) => Promise<string | null>;
}

const COPY = {
  set: { title: "Protect this backup", action: "Encrypt and download", busy: "Encrypting…", testId: "passphrase-dialog" },
  enter: { title: "Enter the passphrase", action: "Decrypt and import", busy: "Decrypting…", testId: "passphrase-dialog" },
} as const;

/** The form lives inside the modal's children, so closing it discards the typed passphrase. */
function PassphraseForm({ mode, onClose, onSubmit }: Omit<Props, "open">) {
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = COPY[mode];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (mode === "set") {
      const problems = validatePassphrase(passphrase, confirm);
      if (problems.length) { setError(problems[0]); return; }
    } else if (!passphrase) { setError("Enter the passphrase."); return; }
    setError("");
    setBusy(true);
    const failure = await onSubmit(passphrase);
    setBusy(false);
    if (failure) setError(failure);
  };

  return (
    <form className="p-5 sm:p-6" onSubmit={submit} noValidate>
      <div className="flex items-start justify-between gap-3">
        <h2 id="passphrase-h" className="display text-3xl">{copy.title}</h2>
        <button type="button" className="btn btn-quiet btn-icon -mr-2" aria-label="Close" onClick={onClose}><IconClose /></button>
      </div>
      {mode === "set" ? (
        <p className="mt-2 text-[var(--text-muted)]">
          The file can only be opened with this passphrase. If you lose it, the backup cannot be opened and we cannot recover it. Your resumes in this browser stay as they are.
        </p>
      ) : (
        <p className="mt-2 text-[var(--text-muted)]">This backup is encrypted. Enter the passphrase it was saved with.</p>
      )}
      <div className="mt-5 space-y-4">
        <TextField label="Passphrase" type="password" value={passphrase} onChange={setPassphrase} autoComplete={mode === "set" ? "new-password" : "current-password"} autoFocus hint={mode === "set" ? `At least ${MIN_PASSPHRASE} characters. A few random words work well.` : undefined} />
        {mode === "set" && <TextField label="Repeat the passphrase" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />}
      </div>
      <p role="alert" className="mt-3 min-h-[1.25rem] text-[0.9375rem] font-medium text-[var(--pen-text)]" data-testid="passphrase-error">{error}</p>
      <div role="status" className="sr-only">{busy ? copy.busy : ""}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy} data-testid="passphrase-submit">{busy ? copy.busy : copy.action}</button>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

export function PassphraseDialog({ open, mode, onClose, onSubmit }: Props) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="passphrase-h" testId={COPY[mode].testId}>
      <PassphraseForm mode={mode} onClose={onClose} onSubmit={onSubmit} />
    </Modal>
  );
}
