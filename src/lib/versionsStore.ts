"use client";
import { useSyncExternalStore } from "react";
import { createDefaultDoc, newId, parseResumeDoc, type ResumeDoc } from "./schema";
import { browserStorage, resumeStore, startResumeStore, type KeyValueStorage, type createResumeStore } from "./store";
import { jobPostingStore, startJobPosting, type createJobPostingStore } from "./jobPostingStore";
import { coverStore, startCoverStore, type createCoverStore } from "./coverStore";
import { parseCoverLetter, type CoverLetter } from "./cover";
import {
  bootActiveId, coverKey, DEFAULT_VERSION_NAME, docKey, jdKey, makeBundle, memoryIndex, normalizeName, readIndex, uniqueName, writeIndex,
  type VersionIndex, type VersionMeta,
} from "./versions";

type ResumeStore = ReturnType<typeof createResumeStore>;
type PostingStore = ReturnType<typeof createJobPostingStore>;
type CoverStore = ReturnType<typeof createCoverStore>;

/** Everything needed to put a deleted version back (the Undo toast). */
export interface RemovedVersion { meta: VersionMeta; position: number; doc: ResumeDoc; jd: string; cover: CoverLetter | null; wasActive: boolean }

export interface VersionsStoreDeps { storage?: KeyValueStorage | null; resume: ResumeStore; posting: PostingStore; cover?: CoverStore }

/**
 * The list of resume versions. Each version is a resume doc plus its job posting, stored under
 * its own keys. The resume and posting stores always hold the *active* version, so the rest of
 * the app never needs to know versions exist. When storage is blocked, versions live in memory
 * for the session.
 */
export function createVersionsStore({ storage: initialStorage = null, resume, posting, cover }: VersionsStoreDeps) {
  let storage = initialStorage;
  let memoryMode = true;
  let index: VersionIndex = memoryIndex();
  const memDocs = new Map<string, ResumeDoc>();
  const memJd = new Map<string, string>();
  const memCovers = new Map<string, CoverLetter>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const commit = () => { if (!memoryMode) writeIndex(storage, index); emit(); };
  const names = (except?: string) => index.versions.filter((v) => v.id !== except).map((v) => v.name);

  /** Read the index once the browser storage is known. Never throws. */
  function load() {
    bootActiveId(storage); // creates the index (and migrates the pre-versions resume) on first run
    const found = readIndex(storage);
    memoryMode = !found;
    index = found ?? memoryIndex();
    emit();
  }

  function readDoc(id: string): ResumeDoc | null {
    if (id === index.activeId) return resume.getState();
    if (memoryMode) return memDocs.get(id) ?? null;
    try {
      const raw = storage?.getItem(docKey(id));
      if (raw == null) return null;
      const res = parseResumeDoc(JSON.parse(raw));
      return res.ok ? res.doc : null;
    } catch { return null; }
  }
  function readJd(id: string): string {
    if (id === index.activeId) return posting.getText();
    if (memoryMode) return memJd.get(id) ?? "";
    try { return storage?.getItem(jdKey(id)) ?? ""; } catch { return ""; }
  }
  /** The saved letter, or null when this version never had one (the template then applies). */
  function readCover(id: string): CoverLetter | null {
    if (id === index.activeId && cover) return cover.getState();
    if (memoryMode) return memCovers.get(id) ?? null;
    try {
      const raw = storage?.getItem(coverKey(id));
      return raw == null ? null : parseCoverLetter(JSON.parse(raw));
    } catch { return null; }
  }
  function writeData(id: string, doc: ResumeDoc, jd: string, letter?: CoverLetter | null) {
    if (memoryMode) { memDocs.set(id, doc); memJd.set(id, jd); if (letter) memCovers.set(id, letter); return; }
    try {
      storage?.setItem(docKey(id), JSON.stringify(doc));
      storage?.setItem(jdKey(id), jd);
      if (letter) storage?.setItem(coverKey(id), JSON.stringify(letter));
    } catch { /* the version stays in the index; its doc loads as the sample */ }
  }
  function eraseData(id: string) {
    memDocs.delete(id); memJd.delete(id); memCovers.delete(id);
    try { storage?.removeItem?.(docKey(id)); storage?.removeItem?.(jdKey(id)); storage?.removeItem?.(coverKey(id)); } catch { /* leaves a small orphan */ }
  }

  /** Save what the active version holds before leaving it. */
  function stash() {
    const id = index.activeId;
    resume.flush();
    posting.flush();
    cover?.flush();
    // Always write, not only when an edit is pending: an untouched version has no saved doc yet.
    writeData(id, resume.getState(), posting.getText(), cover?.getState());
    index = { ...index, versions: index.versions.map((v) => (v.id === id ? { ...v, updatedAt: Date.now() } : v)) };
  }

  /** Make `id` the active version. Seeds are used for new or copied versions; otherwise the data is read back. */
  function activate(id: string, seedDoc?: ResumeDoc, seedJd?: string, seedCover?: CoverLetter | null) {
    index = { ...index, activeId: id };
    if (!memoryMode) writeIndex(storage, index);
    resume.switchKey(docKey(id), seedDoc ?? (memoryMode ? memDocs.get(id) : undefined));
    posting.switchKey(jdKey(id), seedJd ?? (memoryMode ? memJd.get(id) ?? "" : undefined));
    cover?.switchKey(coverKey(id), seedCover ?? (memoryMode ? memCovers.get(id) : undefined));
    emit();
  }

  function switchTo(id: string): boolean {
    if (id === index.activeId || !index.versions.some((v) => v.id === id)) return false;
    stash();
    activate(id);
    return true;
  }

  /** Add a version and open it. Blank unless `doc` is given. Returns the new id. */
  function create(name?: string, doc?: ResumeDoc, jd = "", letter?: CoverLetter | null): string {
    stash();
    const id = newId("v");
    const meta: VersionMeta = { id, name: uniqueName(names(), name ?? "New resume"), updatedAt: Date.now() };
    index = { ...index, versions: [...index.versions, meta] };
    activate(id, doc ?? createDefaultDoc(), jd, letter);
    return id;
  }

  function duplicate(id: string = index.activeId, name?: string): string | null {
    const source = index.versions.find((v) => v.id === id);
    const doc = source && readDoc(id);
    if (!source || !doc) return null;
    const letter = readCover(id);
    return create(name ?? `Copy of ${source.name}`, JSON.parse(JSON.stringify(doc)) as ResumeDoc, readJd(id), letter && (JSON.parse(JSON.stringify(letter)) as CoverLetter));
  }

  /** Returns the name actually used (made unique), or null when nothing changed. */
  function rename(id: string, name: string): string | null {
    const clean = normalizeName(name);
    if (!clean || !index.versions.some((v) => v.id === id)) return null;
    const final = uniqueName(names(id), clean);
    index = { ...index, versions: index.versions.map((v) => (v.id === id ? { ...v, name: final } : v)) };
    commit();
    return final;
  }

  /** Delete a version. The last one cannot be deleted. Returns what is needed to undo it. */
  function remove(id: string): RemovedVersion | null {
    const position = index.versions.findIndex((v) => v.id === id);
    if (position < 0 || index.versions.length <= 1) return null;
    const wasActive = id === index.activeId;
    const removed: RemovedVersion = { meta: index.versions[position], position, doc: readDoc(id) ?? createDefaultDoc(), jd: readJd(id), cover: readCover(id), wasActive };
    const versions = index.versions.filter((v) => v.id !== id);
    index = { ...index, versions };
    if (wasActive) activate(versions[Math.min(position, versions.length - 1)].id);
    else commit();
    eraseData(id);
    return removed;
  }

  /** Undo a delete: put the version back where it was, and reopen it if it was the active one. */
  function restore(removed: RemovedVersion): string {
    const { meta, position, doc, jd, cover: letter, wasActive } = removed;
    if (index.versions.some((v) => v.id === meta.id)) return meta.id;
    const versions = [...index.versions];
    versions.splice(Math.min(position, versions.length), 0, { ...meta, name: uniqueName(names(), meta.name) });
    if (wasActive) {
      stash();
      index = { ...index, versions };
      activate(meta.id, doc, jd, letter);
    } else {
      writeData(meta.id, doc, jd, letter);
      index = { ...index, versions };
      commit();
    }
    return meta.id;
  }

  /** Every version's doc and cover letter for "Export all". Postings are never included. */
  function exportAll(applications?: unknown[]) {
    return makeBundle(index.versions.flatMap((v) => { const doc = readDoc(v.id); if (!doc) return []; const letter = readCover(v.id); return [letter ? { id: v.id, name: v.name, doc, cover: letter } : { id: v.id, name: v.name, doc }]; }), applications);
  }

  return {
    getIndex: () => index,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
    setStorage(s: KeyValueStorage | null) { storage = s; },
    load, switchTo, create, duplicate, rename, remove, restore, exportAll,
  };
}

export const versionsStore = createVersionsStore({ resume: resumeStore, posting: jobPostingStore, cover: coverStore });
let started = false;
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  startResumeStore();
  startJobPosting();
  startCoverStore();
  versionsStore.setStorage(browserStorage());
  versionsStore.load();
}

const SERVER_INDEX: VersionIndex = { activeId: "default", versions: [{ id: "default", name: DEFAULT_VERSION_NAME, updatedAt: 0 }] };

export function useVersionIndex(): VersionIndex {
  return useSyncExternalStore(
    (l) => { start(); return versionsStore.subscribe(l); },
    versionsStore.getIndex,
    () => SERVER_INDEX,
  );
}
