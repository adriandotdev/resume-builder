"use client";
import { useSyncExternalStore } from "react";
import { browserStorage, type KeyValueStorage } from "./store";
import { bootActiveId, jdKey, LEGACY_JD_KEY } from "./versions";

/** Separate from the resume key: the posting is never part of the resume document or its export. Each version has its own, under `jdKey(id)`. */
export const JOB_POSTING_KEY = LEGACY_JD_KEY;

/** Added to a posting's key for the list of terms skipped in it. */
export const SKIPPED_SUFFIX = ":skipped";

export interface JobPostingStoreOptions {
  storage?: KeyValueStorage | null;
  key?: string;
  debounceMs?: number;
}

/** Framework-free store for the pasted job posting. Falls back to memory when storage is unavailable. */
export function createJobPostingStore(opts: JobPostingStoreOptions = {}) {
  const debounceMs = opts.debounceMs ?? 300;
  let storage: KeyValueStorage | null = opts.storage ?? null;
  let key = opts.key ?? JOB_POSTING_KEY;
  let text = "";
  /** Term keys the user decided not to pursue for this posting. Saved beside the posting under `<key>:skipped`. */
  let skipped: string[] = [];
  let loaded = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  function save() {
    timer = null;
    if (!storage) return;
    try { storage.setItem(key, text); } catch { /* keep the text in memory */ }
  }

  const skipKey = () => `${key}${SKIPPED_SUFFIX}`;
  function saveSkipped() {
    if (!storage) return;
    try {
      if (skipped.length === 0) storage.removeItem?.(skipKey());
      else storage.setItem(skipKey(), JSON.stringify(skipped));
    } catch { /* keep the skips in memory */ }
  }
  function readSkipped(): string[] {
    try {
      const parsed: unknown = JSON.parse(storage?.getItem(skipKey()) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
    } catch { return []; }
  }

  /** Read persisted text once. Never throws. */
  function load() {
    if (loaded) return;
    loaded = true;
    if (!storage) return;
    skipped = readSkipped();
    try {
      const raw = storage.getItem(key);
      if (raw == null || raw === text) { emit(); return; }
      text = raw;
    } catch {
      return;
    }
    emit();
  }

  return {
    getText: () => text,
    getSkipped: () => skipped,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
    load,
    setStorage(s: KeyValueStorage | null) { storage = s; },
    /** Choose the key before the first load (the active version's). */
    setKey(k: string) { key = k; },
    /** Move to another version's posting. Pending text is written to the old key first. A `seed` replaces the stored text. */
    switchKey(next: string, seed?: string) {
      this.flush();
      if (timer) { clearTimeout(timer); timer = null; }
      key = next;
      skipped = [];
      if (seed !== undefined) {
        text = seed;
        loaded = true;
        save();
      } else {
        text = "";
        loaded = false;
        load();
      }
      emit();
    },
    setText(next: string) {
      loaded = true;
      text = next;
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, debounceMs);
      emit();
    },
    /** Mark a term as not wanted for this posting. */
    skip(termKey: string) {
      if (skipped.includes(termKey)) return;
      skipped = [...skipped, termKey];
      saveSkipped();
      emit();
    },
    unskip(termKey: string) {
      if (!skipped.includes(termKey)) return;
      skipped = skipped.filter((k) => k !== termKey);
      saveSkipped();
      emit();
    },
    /** Empty the posting and its skips and write that at once, so a quick reload cannot bring them back. */
    clear() {
      loaded = true;
      text = "";
      skipped = [];
      saveSkipped();
      if (timer) { clearTimeout(timer); timer = null; }
      save();
      emit();
    },
    /** Write immediately (used before navigation/unload and in tests). */
    flush() { if (timer) { clearTimeout(timer); save(); } },
  };
}

export const jobPostingStore = createJobPostingStore();
let started = false;
/** Point the store at the active version's posting and read it. Runs once, in the browser. */
export function startJobPosting() {
  if (started || typeof window === "undefined") return;
  started = true;
  const storage = browserStorage();
  jobPostingStore.setStorage(storage);
  jobPostingStore.setKey(jdKey(bootActiveId(storage)));
  jobPostingStore.load();
  window.addEventListener("pagehide", () => jobPostingStore.flush());
}
const start = startJobPosting;

const EMPTY: string[] = [];

export function useJobPosting() {
  const text = useSyncExternalStore(
    (l) => { start(); return jobPostingStore.subscribe(l); },
    jobPostingStore.getText,
    () => "",
  );
  const skipped = useSyncExternalStore(jobPostingStore.subscribe, jobPostingStore.getSkipped, () => EMPTY);
  return { text, setText: jobPostingStore.setText, clear: jobPostingStore.clear, skipped, skip: jobPostingStore.skip, unskip: jobPostingStore.unskip };
}
