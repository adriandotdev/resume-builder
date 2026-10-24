import { newId } from "./schema";
import type { KeyValueStorage } from "./store";

export const APPLICATIONS_KEY = "resume-builder:applications:v1";

export const STATUSES = ["saved", "applied", "interviewing", "offer", "rejected", "withdrawn"] as const;
export type AppStatus = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<AppStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const MAX_FIELD = 120;
export const MAX_URL = 500;
export const MAX_NOTES = 4000;
export const MAX_POSTING = 50_000;

export interface Application {
  id: string;
  company: string;
  role: string;
  url: string;
  status: AppStatus;
  /** The resume version used. Null when unlinked or the version was deleted. */
  versionId: string | null;
  /** The version's name when linked, so the row still reads after the version is deleted. */
  versionName: string;
  /** A copy of the job posting, independent of later edits to the version's posting. */
  posting: string;
  notes: string;
  createdAt: number;
  appliedAt?: number;
  updatedAt: number;
}

export type ApplicationInput = Partial<Omit<Application, "id" | "createdAt" | "updatedAt" | "appliedAt">>;

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const finite = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function isStatus(v: unknown): v is AppStatus {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

/** Build a full record from partial input, applying the same limits as parsing. */
export function makeApplication(input: ApplicationInput, now = Date.now()): Application {
  const status = isStatus(input.status) ? input.status : "saved";
  return {
    id: newId("app"),
    company: clean(input.company, MAX_FIELD),
    role: clean(input.role, MAX_FIELD),
    url: clean(input.url, MAX_URL),
    status,
    versionId: typeof input.versionId === "string" && input.versionId ? input.versionId : null,
    versionName: clean(input.versionName, MAX_FIELD),
    posting: typeof input.posting === "string" ? input.posting.slice(0, MAX_POSTING) : "",
    notes: typeof input.notes === "string" ? input.notes.slice(0, MAX_NOTES) : "",
    createdAt: now,
    appliedAt: status === "saved" ? undefined : now,
    updatedAt: now,
  };
}

/** Apply a change. `appliedAt` is set the first time the status leaves "saved" and never moves after. */
export function applyUpdate(app: Application, patch: ApplicationInput, now = Date.now()): Application {
  const next = makeApplication({ ...app, ...patch }, now);
  const status = isStatus(patch.status) ? patch.status : app.status;
  return {
    ...next,
    id: app.id,
    createdAt: app.createdAt,
    appliedAt: app.appliedAt ?? (status === "saved" ? undefined : now),
  };
}

/** Validate an untrusted list of applications. Never throws; drops what is unusable. */
export function parseApplications(raw: unknown): Application[] {
  let data = raw;
  if (typeof raw === "string") {
    try { data = JSON.parse(raw); } catch { return []; }
  }
  const items = Array.isArray(data) ? data : typeof data === "object" && data !== null ? (data as { items?: unknown }).items : null;
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: Application[] = [];
  for (const it of items) {
    if (typeof it !== "object" || it === null) continue;
    const r = it as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.id || seen.has(r.id)) continue;
    const company = clean(r.company, MAX_FIELD);
    const role = clean(r.role, MAX_FIELD);
    if (!company && !role) continue;
    seen.add(r.id);
    const base = makeApplication(r as ApplicationInput, 0);
    out.push({
      ...base,
      id: r.id,
      company,
      role,
      createdAt: finite(r.createdAt) ?? 0,
      appliedAt: base.status === "saved" ? undefined : finite(r.appliedAt),
      updatedAt: finite(r.updatedAt) ?? 0,
    });
  }
  return out;
}

export function readApplications(storage: KeyValueStorage | null): Application[] {
  if (!storage) return [];
  try { return parseApplications(storage.getItem(APPLICATIONS_KEY)); } catch { return []; }
}

/** Returns false when the write failed (blocked or full storage). */
export function writeApplications(storage: KeyValueStorage | null, items: Application[]): boolean {
  if (!storage) return false;
  try { storage.setItem(APPLICATIONS_KEY, JSON.stringify({ version: 1, items })); return true; } catch { return false; }
}

/** Newest activity first. */
export function sortApplications(items: Application[]): Application[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Point imported applications at the versions created by the same import. Links whose old id is
 * not in `idMap` become unlinked but keep their stored version name.
 */
export function remapVersions(items: Application[], idMap: Map<string, string>): Application[] {
  return items.map((a) => ({ ...a, versionId: a.versionId ? idMap.get(a.versionId) ?? null : null }));
}
