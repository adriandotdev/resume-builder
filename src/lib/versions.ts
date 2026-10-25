import { newId } from "./schema";
import type { KeyValueStorage } from "./store";

/** Keys from before versions existed. Read once to migrate, then left in place as a rollback copy. */
export const LEGACY_DOC_KEY = "resume-builder:doc:v1";
export const LEGACY_JD_KEY = "resume-builder:jd:v1";
export const VERSIONS_KEY = "resume-builder:versions:v1";

/** Id used when browser storage is blocked and nothing can be listed. */
export const MEMORY_VERSION_ID = "default";
export const DEFAULT_VERSION_NAME = "My resume";
export const MAX_NAME_LENGTH = 60;
const BUNDLE_KIND = "resume-builder-bundle";

export interface VersionMeta { id: string; name: string; updatedAt: number }
export interface VersionIndex { activeId: string; versions: VersionMeta[] }

export const docKey = (id: string) => `${LEGACY_DOC_KEY}:${id}`;
export const jdKey = (id: string) => `${LEGACY_JD_KEY}:${id}`;
export const coverKey = (id: string) => `resume-builder:cover:v1:${id}`;

export function memoryIndex(): VersionIndex {
  return { activeId: MEMORY_VERSION_ID, versions: [{ id: MEMORY_VERSION_ID, name: DEFAULT_VERSION_NAME, updatedAt: 0 }] };
}

export function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

/** `base` if free, otherwise "base 2", "base 3", ... (case-insensitive). */
export function uniqueName(existing: string[], base: string): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  const root = normalizeName(base) || DEFAULT_VERSION_NAME;
  if (!taken.has(root.toLowerCase())) return root;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const candidate = root.slice(0, MAX_NAME_LENGTH - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** A safe download file name (no extension) from a version name. */
export function fileSlug(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "resume";
}

/** Validate an untrusted index. Never throws; returns null when nothing usable is left. */
export function parseIndex(raw: string | null): VersionIndex | null {
  if (raw == null) return null;
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return null; }
  if (typeof data !== "object" || data === null) return null;
  const { activeId, versions } = data as { activeId?: unknown; versions?: unknown };
  if (!Array.isArray(versions)) return null;
  const seen = new Set<string>();
  const clean: VersionMeta[] = [];
  for (const v of versions) {
    if (typeof v !== "object" || v === null) continue;
    const { id, name, updatedAt } = v as { id?: unknown; name?: unknown; updatedAt?: unknown };
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    seen.add(id);
    clean.push({
      id,
      name: (typeof name === "string" && normalizeName(name)) || DEFAULT_VERSION_NAME,
      updatedAt: typeof updatedAt === "number" && Number.isFinite(updatedAt) ? updatedAt : 0,
    });
  }
  if (!clean.length) return null;
  return { activeId: typeof activeId === "string" && seen.has(activeId) ? activeId : clean[0].id, versions: clean };
}

export function readIndex(storage: KeyValueStorage | null): VersionIndex | null {
  if (!storage) return null;
  try { return parseIndex(storage.getItem(VERSIONS_KEY)); } catch { return null; }
}

/** Returns false when the write failed (blocked or full storage). */
export function writeIndex(storage: KeyValueStorage | null, index: VersionIndex): boolean {
  if (!storage) return false;
  try { storage.setItem(VERSIONS_KEY, JSON.stringify(index)); return true; } catch { return false; }
}

/**
 * The id of the active version, creating the index on first run. The single resume and job
 * posting saved before versions existed become "My resume". Safe to call more than once.
 */
export function bootActiveId(storage: KeyValueStorage | null): string {
  if (!storage) return MEMORY_VERSION_ID;
  const existing = readIndex(storage);
  if (existing) return existing.activeId;
  const id = newId("v");
  try {
    const doc = storage.getItem(LEGACY_DOC_KEY);
    if (doc != null) storage.setItem(docKey(id), doc);
    const jd = storage.getItem(LEGACY_JD_KEY);
    if (jd != null) storage.setItem(jdKey(id), jd);
  } catch { /* the version starts empty; legacy keys are untouched */ }
  writeIndex(storage, { activeId: id, versions: [{ id, name: DEFAULT_VERSION_NAME, updatedAt: Date.now() }] });
  return id;
}

/** `id`, `cover` and `applications` are optional so older bundles still import. */
export interface BundleVersion { name: string; doc: unknown; id?: string; cover?: unknown }
export interface ResumeBundle { kind: typeof BUNDLE_KIND; versions: BundleVersion[]; applications?: unknown }

export function isBundle(raw: unknown): raw is ResumeBundle {
  return typeof raw === "object" && raw !== null && (raw as { kind?: unknown }).kind === BUNDLE_KIND && Array.isArray((raw as { versions?: unknown }).versions);
}

export function makeBundle(versions: BundleVersion[], applications?: unknown[]): ResumeBundle {
  return applications?.length ? { kind: BUNDLE_KIND, versions, applications } : { kind: BUNDLE_KIND, versions };
}
