"use client";
import { useSyncExternalStore } from "react";
import { browserStorage, type KeyValueStorage } from "./store";
import {
  applyUpdate, makeApplication, readApplications, sortApplications, writeApplications,
  type Application, type ApplicationInput,
} from "./applications";

export interface RemovedApplication { app: Application; position: number }

const EMPTY: Application[] = [];

/**
 * The list of job applications. Kept in memory and written through on every change. When
 * storage is blocked the list lives in memory for the session.
 */
export function createApplicationsStore({ storage: initialStorage = null }: { storage?: KeyValueStorage | null } = {}) {
  let storage = initialStorage;
  let items: Application[] = EMPTY;
  let loaded = false;
  let saveFailed = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const commit = (next: Application[]) => { items = next; saveFailed = !writeApplications(storage, items); emit(); };

  return {
    getAll: () => items,
    isLoaded: () => loaded,
    /** True when the last write did not reach browser storage (blocked or full). */
    didSaveFail: () => saveFailed,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
    setStorage(s: KeyValueStorage | null) { storage = s; },
    /** Read the saved list once the browser storage is known. Never throws. */
    load() { items = sortApplications(readApplications(storage)); loaded = true; emit(); },
    add(input: ApplicationInput): Application {
      const app = makeApplication(input);
      commit([app, ...items]);
      return app;
    },
    update(id: string, patch: ApplicationInput) {
      if (!items.some((a) => a.id === id)) return;
      commit(sortApplications(items.map((a) => (a.id === id ? applyUpdate(a, patch) : a))));
    },
    remove(id: string): RemovedApplication | null {
      const position = items.findIndex((a) => a.id === id);
      if (position < 0) return null;
      const app = items[position];
      commit(items.filter((a) => a.id !== id));
      return { app, position };
    },
    restore({ app, position }: RemovedApplication) {
      if (items.some((a) => a.id === app.id)) return;
      const next = [...items];
      next.splice(Math.min(position, next.length), 0, app);
      commit(next);
    },
    /** Add already-built records (an import). Ids that exist are skipped. */
    addMany(apps: Application[]) {
      const have = new Set(items.map((a) => a.id));
      const fresh = apps.filter((a) => !have.has(a.id));
      if (fresh.length) commit(sortApplications([...fresh, ...items]));
    },
    linkedTo: (versionId: string) => items.filter((a) => a.versionId === versionId),
  };
}

export const applicationsStore = createApplicationsStore();

let started = false;
export function startApplications() {
  if (started || typeof window === "undefined") return;
  started = true;
  applicationsStore.setStorage(browserStorage());
  applicationsStore.load();
}

export function useApplications(): Application[] {
  return useSyncExternalStore(
    (cb) => { startApplications(); return applicationsStore.subscribe(cb); },
    applicationsStore.getAll,
    () => EMPTY,
  );
}

/** False until the saved list has been read, so a returning user never sees the empty state first. */
export function useApplicationsStatus(): { loaded: boolean; saveFailed: boolean } {
  const sub = (cb: () => void) => { startApplications(); return applicationsStore.subscribe(cb); };
  const loaded = useSyncExternalStore(sub, applicationsStore.isLoaded, () => false);
  const saveFailed = useSyncExternalStore(sub, applicationsStore.didSaveFail, () => false);
  return { loaded, saveFailed };
}
