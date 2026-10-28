import { parseResumeDoc, type ResumeDoc } from "./schema";
import { isBundle } from "./versions";
import { parseApplications, type Application } from "./applications";
import { parseCoverLetter, type CoverLetter } from "./cover";

export interface ImportedVersion { name: string; doc: ResumeDoc; oldId?: string; cover?: CoverLetter | null }

export type ParsedImport =
  | { ok: true; versions: ImportedVersion[]; applications: Application[]; migratedFrom?: number }
  | { ok: false; errors: string[] };

/** Largest file (or decrypted text) an import will read. */
export const MAX_IMPORT_BYTES = 2_000_000;

/**
 * Validate the parsed JSON of a backup: either a bundle of versions (with optional applications)
 * or a single resume. Never throws. `fallbackName` names a single resume, which has no name of its own.
 */
export function parseImport(raw: unknown, fallbackName: string): ParsedImport {
  if (isBundle(raw)) {
    const versions: ImportedVersion[] = [];
    const problems: string[] = [];
    raw.versions.forEach((v, i) => {
      const res = parseResumeDoc(typeof v === "object" && v !== null ? (v as { doc?: unknown }).doc : undefined);
      if (res.ok) {
        const { name, id, cover } = v as { name?: unknown; id?: unknown; cover?: unknown };
        versions.push({ name: String(name ?? ""), doc: res.doc, oldId: typeof id === "string" ? id : undefined, cover: cover === undefined ? undefined : parseCoverLetter(cover) });
      } else problems.push(...res.errors.map((e) => `Version ${i + 1}: ${e}`));
    });
    if (problems.length || !versions.length) return { ok: false, errors: problems.length ? problems.slice(0, 8) : ["The file has no versions"] };
    return { ok: true, versions, applications: parseApplications(raw.applications) };
  }
  const res = parseResumeDoc(raw);
  if (!res.ok) return { ok: false, errors: res.errors.slice(0, 8) };
  return { ok: true, versions: [{ name: fallbackName, doc: res.doc }], applications: [], migratedFrom: res.migratedFrom };
}
