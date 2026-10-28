"use client";
import { useSyncExternalStore } from "react";
import { browserStorage, resumeStore, type KeyValueStorage } from "./store";
import { applicationsStore, startApplications } from "./applicationsStore";
import { coverStore } from "./coverStore";
import { jobPostingStore } from "./jobPostingStore";
import { versionsStore } from "./versionsStore";
import { isPristineSample } from "./ui";
import {
  backupStatus, fingerprint, formatBackedUpAgo, markBackedUp, readBackup, reconcile, writeBackup,
  type BackupState, type BackupStatus, EMPTY_BACKUP,
} from "./backup";

const CHECK_DELAY_MS = 1000;

/** Fingerprint of everything "Export all" would save. */
function snapshotHash(): string {
  return fingerprint(JSON.stringify(versionsStore.exportAll(applicationsStore.getAll())));
}

function isBlank(): boolean {
  return versionsStore.getIndex().versions.length <= 1 && applicationsStore.getAll().length === 0 && isPristineSample(resumeStore.getState());
}

/**
 * Remembers when the data was last backed up and whether it has changed since. It compares a
 * fingerprint of the data rather than counting events, so loading the app or undoing an edit
 * never counts as a change. When storage is blocked the state lives in memory for the session.
 */
export function createBackupStore({ storage: initialStorage = null }: { storage?: KeyValueStorage | null } = {}) {
  let storage = initialStorage;
  let state: BackupState = EMPTY_BACKUP;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const commit = (next: BackupState) => {
    if (next === state) return;
    state = next;
    writeBackup(storage, state);
    emit();
  };

  return {
    getState: () => state,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
    setStorage(s: KeyValueStorage | null) { storage = s; },
    load() { state = readBackup(storage); emit(); },
    /** Compare with the last backup now. Skipped until the application list has been read. */
    check(now = Date.now()) {
      if (!applicationsStore.isLoaded()) return;
      commit(reconcile(state, snapshotHash(), isBlank(), now));
    },
    /** Check shortly after the last change, so typing does not hash the data on every key. */
    scheduleCheck() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; this.check(); }, CHECK_DELAY_MS);
    },
    /** Call after an "Export all" download (or a single export when it covers everything). */
    markBackedUp(now = Date.now()) {
      if (timer) { clearTimeout(timer); timer = null; }
      commit(markBackedUp(snapshotHash(), now));
    },
  };
}

export const backupStore = createBackupStore();

let started = false;
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  startApplications();
  backupStore.setStorage(browserStorage());
  backupStore.load();
  const onChange = () => backupStore.scheduleCheck();
  [resumeStore, coverStore, jobPostingStore, applicationsStore, versionsStore].forEach((s) => s.subscribe(onChange));
  backupStore.scheduleCheck();
}

const subscribe = (l: () => void) => { start(); return backupStore.subscribe(l); };

export function useBackupState(): BackupState {
  return useSyncExternalStore(subscribe, backupStore.getState, () => EMPTY_BACKUP);
}

/** "due" once changes the backup does not cover are a week old. The clock is read in the snapshot, not in render. */
export function useBackupStatus(): BackupStatus {
  return useSyncExternalStore(subscribe, () => backupStatus(backupStore.getState(), Date.now()), () => "none" as BackupStatus);
}

/** "Last backed up 3 days ago". Strings compare equal until the wording changes, so this does not re-render on its own. */
export function useBackupAgeLabel(): string {
  return useSyncExternalStore(subscribe, () => formatBackedUpAgo(backupStore.getState().lastBackupAt, Date.now()), () => "Never backed up");
}
