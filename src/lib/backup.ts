import type { KeyValueStorage } from "./store";

export const BACKUP_KEY = "resume-builder:backup:v1";
export const REMIND_AFTER_DAYS = 7;
const DAY_MS = 86_400_000;

export interface BackupState {
  /** When the last backup file was saved. Null if never. */
  lastBackupAt: number | null;
  /** Fingerprint of everything that was in that backup, so edits that are undone stop counting as changes. */
  lastBackupHash: string | null;
  /** When the first change after that backup (or after install) happened. Null when nothing changed since. */
  dirtySince: number | null;
}

export const EMPTY_BACKUP: BackupState = { lastBackupAt: null, lastBackupHash: null, dirtySince: null };

/** "none": nothing worth backing up yet. "ok": covered or changed recently. "due": changes are a week old. */
export type BackupStatus = "none" | "ok" | "due";

const time = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

export function parseBackup(raw: string | null): BackupState {
  if (raw == null) return EMPTY_BACKUP;
  try {
    const d = JSON.parse(raw) as Record<string, unknown> | null;
    if (typeof d !== "object" || d === null) return EMPTY_BACKUP;
    return { lastBackupAt: time(d.lastBackupAt), lastBackupHash: typeof d.lastBackupHash === "string" ? d.lastBackupHash : null, dirtySince: time(d.dirtySince) };
  } catch {
    return EMPTY_BACKUP;
  }
}

export function readBackup(storage: KeyValueStorage | null): BackupState {
  if (!storage) return EMPTY_BACKUP;
  try { return parseBackup(storage.getItem(BACKUP_KEY)); } catch { return EMPTY_BACKUP; }
}

/** Returns false when the write failed (blocked or full storage). */
export function writeBackup(storage: KeyValueStorage | null, state: BackupState): boolean {
  if (!storage) return false;
  try { storage.setItem(BACKUP_KEY, JSON.stringify({ version: 1, ...state })); return true; } catch { return false; }
}

/** FNV-1a over the UTF-16 code units. Not a security hash: it only detects "did the data change". */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}

/**
 * Compare the data now with the last backup. `hash` fingerprints all versions and applications;
 * `isBlank` is true while there is only the untouched sample, so a new visitor is not nagged.
 */
export function reconcile(state: BackupState, hash: string, isBlank: boolean, now: number): BackupState {
  const changed = state.lastBackupHash == null ? !isBlank : hash !== state.lastBackupHash;
  if (changed && state.dirtySince == null) return { ...state, dirtySince: now };
  if (!changed && state.dirtySince != null) return { ...state, dirtySince: null };
  return state;
}

export function markBackedUp(hash: string, now: number): BackupState {
  return { lastBackupAt: now, lastBackupHash: hash, dirtySince: null };
}

/** Due once there are changes the backup does not cover and the oldest of them is a week old. */
export function backupStatus(state: BackupState, now: number): BackupStatus {
  if (state.dirtySince == null) return state.lastBackupAt == null ? "none" : "ok";
  return now - state.dirtySince >= REMIND_AFTER_DAYS * DAY_MS ? "due" : "ok";
}

/** "Last backed up 3 days ago", "Never backed up". */
export function formatBackedUpAgo(lastBackupAt: number | null, now: number): string {
  if (lastBackupAt == null) return "Never backed up";
  const m = Math.max(0, Math.round((now - lastBackupAt) / 60_000));
  if (m < 1) return "Last backed up just now";
  if (m < 60) return `Last backed up ${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Last backed up ${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `Last backed up ${d} day${d === 1 ? "" : "s"} ago`;
}
