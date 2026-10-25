"use client";
import { useSyncExternalStore } from "react";
import { browserStorage, type KeyValueStorage } from "./store";
import { bootActiveId, coverKey } from "./versions";
import { defaultLetter, parseCoverLetter, type CoverLetter } from "./cover";

export interface CoverStoreOptions {
  storage?: KeyValueStorage | null;
  key?: string;
  debounceMs?: number;
}

/**
 * Framework-free store for the active version's cover letter. Same shape as the posting store:
 * debounced save, flush on leave, memory fallback when storage is blocked. A version with no
 * saved letter starts from the template; a corrupt one does too, and is overwritten on the next edit.
 */
export function createCoverStore(opts: CoverStoreOptions = {}) {
  const debounceMs = opts.debounceMs ?? 300;
  let storage: KeyValueStorage | null = opts.storage ?? null;
  let key = opts.key ?? coverKey("default");
  let state: CoverLetter = defaultLetter();
  let loaded = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  function save() {
    timer = null;
    if (!storage) return;
    try { storage.setItem(key, JSON.stringify(state)); } catch { /* keep the letter in memory */ }
  }
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, debounceMs);
  }

  /** Read persisted letter once. Never throws. */
  function load() {
    if (loaded) return;
    loaded = true;
    if (!storage) return;
    try {
      const raw = storage.getItem(key);
      if (raw == null) return;
      const letter = parseCoverLetter(JSON.parse(raw));
      if (letter) state = letter;
    } catch {
      return;
    }
    emit();
  }

  return {
    getState: () => state,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
    load,
    setStorage(s: KeyValueStorage | null) { storage = s; },
    /** Choose the key before the first load (the active version's). */
    setKey(k: string) { key = k; },
    /** Move to another version's letter. Pending edits go to the old key first. A `seed` replaces the stored letter. */
    switchKey(next: string, seed?: CoverLetter) {
      this.flush();
      if (timer) { clearTimeout(timer); timer = null; }
      key = next;
      if (seed) {
        state = seed;
        loaded = true;
        save();
      } else {
        state = defaultLetter();
        loaded = false;
        load();
      }
      emit();
    },
    update(fn: (l: CoverLetter) => CoverLetter) { loaded = true; state = fn(state); schedule(); emit(); },
    setLetter(l: CoverLetter) { loaded = true; state = l; schedule(); emit(); },
    reset() { this.setLetter(defaultLetter()); },
    /** Write immediately (used before navigation/unload and in tests). */
    flush() { if (timer) { clearTimeout(timer); save(); } },
  };
}

export const coverStore = createCoverStore();
let started = false;
/** Point the store at the active version's letter and read it. Runs once, in the browser. */
export function startCoverStore() {
  if (started || typeof window === "undefined") return;
  started = true;
  const storage = browserStorage();
  coverStore.setStorage(storage);
  coverStore.setKey(coverKey(bootActiveId(storage)));
  coverStore.load();
  window.addEventListener("pagehide", () => coverStore.flush());
}
const start = startCoverStore;

const SERVER_LETTER = defaultLetter();

export function useCoverLetter(): CoverLetter {
  return useSyncExternalStore(
    (l) => { start(); return coverStore.subscribe(l); },
    coverStore.getState,
    () => SERVER_LETTER,
  );
}
