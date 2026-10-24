"use client";
import { useSyncExternalStore } from "react";
import { createDefaultDoc, parseResumeDoc, type ResumeDoc } from "./schema";
import { createSampleDoc } from "./sample";

export const STORAGE_KEY = "resume-builder:doc:v1";

export interface KeyValueStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export interface StoreOptions {
  storage?: KeyValueStorage | null;
  debounceMs?: number;
  initial?: () => ResumeDoc;
}

export type StoreStatus = "idle" | "saved" | "unavailable" | "restored" | "corrupt";

/** Framework-free store so it can be unit tested without a DOM. */
export function createResumeStore(opts: StoreOptions = {}) {
  const debounceMs = opts.debounceMs ?? 300;
  const makeInitial = opts.initial ?? createSampleDoc;
  let storage: KeyValueStorage | null = opts.storage ?? null;
  let state: ResumeDoc = makeInitial();
  let status: StoreStatus = "idle";
  let loaded = false;
  let savedAt: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  function save() {
    timer = null;
    if (!storage) { status = "unavailable"; emit(); return; }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      status = "saved";
      savedAt = Date.now();
    } catch {
      status = "unavailable";
    }
    emit();
  }
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, debounceMs);
  }

  /** Read persisted state once. Never throws. */
  function load() {
    if (loaded) return;
    loaded = true;
    if (!storage) { status = "unavailable"; return; }
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw == null) return;
      const res = parseResumeDoc(JSON.parse(raw));
      if (res.ok) { state = res.doc; status = "restored"; } else status = "corrupt";
    } catch {
      status = "corrupt";
    }
    emit();
  }

  return {
    getState: () => state,
    getStatus: () => status,
    getSavedAt: () => savedAt,
    isPending: () => timer !== null,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
    load,
    setStorage(s: KeyValueStorage | null) { storage = s; },
    /** Replace the doc (already validated). */
    setDoc(doc: ResumeDoc) { loaded = true; state = doc; schedule(); emit(); },
    update(fn: (d: ResumeDoc) => ResumeDoc) { loaded = true; state = fn(state); schedule(); emit(); },
    resetToBlank() { this.setDoc(createDefaultDoc()); },
    resetToSample() { this.setDoc(createSampleDoc()); },
    /** Write immediately (used before navigation/unload and in tests). */
    flush() { if (timer) { clearTimeout(timer); save(); } },
  };
}

function browserStorage(): KeyValueStorage | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    const probe = "__rb_probe__";
    s.setItem(probe, "1");
    s.removeItem?.(probe);
    return s;
  } catch {
    return null;
  }
}

export const resumeStore = createResumeStore();
let started = false;
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  resumeStore.setStorage(browserStorage());
  resumeStore.load();
  window.addEventListener("pagehide", () => resumeStore.flush());
}

const SERVER_DOC = createSampleDoc();

export function useResumeDoc(): ResumeDoc {
  return useSyncExternalStore(
    (l) => { start(); return resumeStore.subscribe(l); },
    resumeStore.getState,
    () => SERVER_DOC,
  );
}
export function useStoreStatus(): StoreStatus {
  return useSyncExternalStore(
    (l) => { start(); return resumeStore.subscribe(l); },
    resumeStore.getStatus,
    () => "idle" as StoreStatus,
  );
}

export function useSavedAt(): number | null {
  return useSyncExternalStore(
    (l) => { start(); return resumeStore.subscribe(l); },
    resumeStore.getSavedAt,
    () => null,
  );
}
export function usePending(): boolean {
  return useSyncExternalStore(
    (l) => { start(); return resumeStore.subscribe(l); },
    resumeStore.isPending,
    () => false,
  );
}
