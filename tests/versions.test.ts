import { describe, expect, it } from "vitest";
import { createResumeStore, STORAGE_KEY, type KeyValueStorage } from "@/lib/store";
import { createJobPostingStore, JOB_POSTING_KEY } from "@/lib/jobPostingStore";
import { createVersionsStore } from "@/lib/versionsStore";
import { bootActiveId, docKey, fileSlug, isBundle, jdKey, parseIndex, readIndex, uniqueName, VERSIONS_KEY } from "@/lib/versions";
import { createDefaultDoc, type ResumeDoc } from "@/lib/schema";
import { patchStyle } from "@/lib/ops";

function mem(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

/** Stores wired the way the app does at startup: pointed at the active version, then loaded. */
function boot(st: KeyValueStorage | null) {
  const id = bootActiveId(st);
  const resume = createResumeStore({ storage: st, debounceMs: 0, key: docKey(id) });
  const posting = createJobPostingStore({ storage: st, debounceMs: 0, key: jdKey(id) });
  resume.load();
  posting.load();
  const versions = createVersionsStore({ storage: st, resume, posting });
  versions.load();
  return { resume, posting, versions };
}
const accent = (r: ReturnType<typeof boot>["resume"]) => r.getState().style.accent;
const edit = (r: ReturnType<typeof boot>["resume"], color: string) => r.update((d) => patchStyle(d, { accent: color }));
const names = (v: ReturnType<typeof boot>["versions"]) => v.getIndex().versions.map((x) => x.name);

describe("version index helpers", () => {
  it("rejects unusable indexes and repairs the active id", () => {
    expect(parseIndex(null)).toBeNull();
    expect(parseIndex("{nope")).toBeNull();
    expect(parseIndex(JSON.stringify({ activeId: "a", versions: [] }))).toBeNull();
    expect(parseIndex(JSON.stringify({ activeId: "a", versions: "x" }))).toBeNull();
    const idx = parseIndex(JSON.stringify({ activeId: "gone", versions: [{ id: "a", name: "  Front   end ", updatedAt: 5 }, { id: "a", name: "dup" }, null, { name: "no id" }] }))!;
    expect(idx.versions).toEqual([{ id: "a", name: "Front end", updatedAt: 5 }]);
    expect(idx.activeId).toBe("a");
  });
  it("makes names unique and file names safe", () => {
    expect(uniqueName(["QA"], "Backend")).toBe("Backend");
    expect(uniqueName(["QA"], "qa")).toBe("qa 2");
    expect(uniqueName(["QA", "QA 2"], "QA")).toBe("QA 3");
    expect(uniqueName([], "   ")).toBe("My resume");
    expect(uniqueName(["x".repeat(60)], "x".repeat(60)).length).toBeLessThanOrEqual(60);
    expect(fileSlug("Front-end / React Dev!")).toBe("front-end-react-dev");
    expect(fileSlug("???")).toBe("resume");
  });
  it("recognises export bundles", () => {
    expect(isBundle({ kind: "resume-builder-bundle", versions: [] })).toBe(true);
    expect(isBundle({ version: 1, sections: [] })).toBe(false);
    expect(isBundle(null)).toBe(false);
  });
});

describe("migration from a single resume", () => {
  it("moves the old resume and posting into 'My resume' and leaves the old keys alone", () => {
    const st = mem();
    const old = createDefaultDoc();
    st.setItem(STORAGE_KEY, JSON.stringify(old));
    st.setItem(JOB_POSTING_KEY, "Senior frontend engineer");
    const { resume, posting, versions } = boot(st);
    expect(names(versions)).toEqual(["My resume"]);
    expect(resume.getStatus()).toBe("restored");
    expect(resume.getState().sections).toEqual(old.sections);
    expect(posting.getText()).toBe("Senior frontend engineer");
    expect(st.data.get(STORAGE_KEY)).toBe(JSON.stringify(old));
    expect(st.data.get(JOB_POSTING_KEY)).toBe("Senior frontend engineer");
  });
  it("starts with one version and the sample when nothing was saved", () => {
    const st = mem();
    const { resume, versions } = boot(st);
    expect(names(versions)).toEqual(["My resume"]);
    expect(resume.getStatus()).toBe("idle");
    expect(resume.getState().sections.length).toBeGreaterThan(3);
  });
  it("runs once: a second boot keeps the same version and ignores later legacy writes", () => {
    const st = mem();
    st.setItem(STORAGE_KEY, JSON.stringify(createDefaultDoc()));
    const first = bootActiveId(st);
    st.setItem(STORAGE_KEY, "changed after migration");
    expect(bootActiveId(st)).toBe(first);
    expect(readIndex(st)!.versions).toHaveLength(1);
  });
});

describe("versions", () => {
  it("keeps each version's content separate across switches", () => {
    const { resume, versions } = boot(mem());
    const first = versions.getIndex().activeId;
    edit(resume, "#111111");
    const qa = versions.create("QA");
    expect(accent(resume)).toBe(createDefaultDoc().style.accent);
    edit(resume, "#222222");
    versions.switchTo(first);
    expect(accent(resume)).toBe("#111111");
    versions.switchTo(qa);
    expect(accent(resume)).toBe("#222222");
    expect(versions.getIndex().activeId).toBe(qa);
  });
  it("gives each version its own job posting", () => {
    const { posting, versions } = boot(mem());
    const first = versions.getIndex().activeId;
    posting.setText("frontend posting");
    const qa = versions.create("QA");
    expect(posting.getText()).toBe("");
    posting.setText("qa posting");
    versions.switchTo(first);
    expect(posting.getText()).toBe("frontend posting");
    versions.switchTo(qa);
    expect(posting.getText()).toBe("qa posting");
  });
  it("persists edits made just before a switch, and survives a reload", () => {
    const st = mem();
    const a = boot(st);
    const first = a.versions.getIndex().activeId;
    a.posting.setText("fe job");
    edit(a.resume, "#abcdef");
    const be = a.versions.create("Backend");
    edit(a.resume, "#123456");
    a.resume.flush();
    const b = boot(st);
    expect(b.versions.getIndex().activeId).toBe(be);
    expect(names(b.versions)).toEqual(["My resume", "Backend"]);
    expect(accent(b.resume)).toBe("#123456");
    b.versions.switchTo(first);
    expect(accent(b.resume)).toBe("#abcdef");
    expect(b.posting.getText()).toBe("fe job");
  });
  it("duplicates content and posting into an independent copy", () => {
    const { resume, posting, versions } = boot(mem());
    edit(resume, "#0a0a0a");
    posting.setText("original posting");
    const copy = versions.duplicate()!;
    expect(names(versions)).toEqual(["My resume", "Copy of My resume"]);
    expect(versions.getIndex().activeId).toBe(copy);
    expect(accent(resume)).toBe("#0a0a0a");
    expect(posting.getText()).toBe("original posting");
    edit(resume, "#f0f0f0");
    versions.switchTo(versions.getIndex().versions[0].id);
    expect(accent(resume)).toBe("#0a0a0a");
  });
  it("can duplicate a version that is not open", () => {
    const { resume, versions } = boot(mem());
    const first = versions.getIndex().activeId;
    edit(resume, "#010101");
    versions.create("QA");
    versions.duplicate(first, "Frontend copy");
    expect(accent(resume)).toBe("#010101");
    expect(names(versions)).toContain("Frontend copy");
  });
  it("renames with unique names and refuses empty ones", () => {
    const { versions } = boot(mem());
    const qa = versions.create("QA");
    expect(versions.rename(qa, "  My   resume ")).toBe("My resume 2");
    expect(versions.rename(qa, "   ")).toBeNull();
    expect(versions.rename("missing", "x")).toBeNull();
    expect(versions.rename(qa, "QA engineer")).toBe("QA engineer");
    expect(names(versions)).toEqual(["My resume", "QA engineer"]);
  });
  it("never deletes the last version", () => {
    const { versions } = boot(mem());
    expect(versions.remove(versions.getIndex().activeId)).toBeNull();
    expect(versions.getIndex().versions).toHaveLength(1);
  });
  it("deletes the open version, opens a neighbour, and undo restores it with its place and posting", () => {
    const st = mem();
    const { resume, posting, versions } = boot(st);
    const first = versions.getIndex().activeId;
    const qa = versions.create("QA");
    versions.create("Backend");
    versions.switchTo(qa);
    edit(resume, "#777777");
    posting.setText("qa job");

    const removed = versions.remove(qa)!;
    expect(names(versions)).toEqual(["My resume", "Backend"]);
    expect(versions.getIndex().activeId).not.toBe(qa);
    expect(st.data.has(docKey(qa))).toBe(false);
    expect(st.data.has(jdKey(qa))).toBe(false);

    versions.restore(removed);
    expect(names(versions)).toEqual(["My resume", "QA", "Backend"]);
    expect(versions.getIndex().activeId).toBe(qa);
    expect(accent(resume)).toBe("#777777");
    expect(posting.getText()).toBe("qa job");
    expect(versions.getIndex().versions[0].id).toBe(first);
  });
  it("deletes a version that is not open without moving the editor", () => {
    const { resume, versions } = boot(mem());
    const first = versions.getIndex().activeId;
    edit(resume, "#333333");
    const qa = versions.create("QA");
    versions.switchTo(first);
    const removed = versions.remove(qa)!;
    expect(versions.getIndex().activeId).toBe(first);
    expect(accent(resume)).toBe("#333333");
    versions.restore(removed);
    expect(versions.getIndex().activeId).toBe(first);
    expect(names(versions)).toEqual(["My resume", "QA"]);
  });
  it("exports every version's doc and never the posting", () => {
    const { posting, versions } = boot(mem());
    posting.setText("secret posting text");
    versions.create("QA");
    const bundle = versions.exportAll();
    expect(isBundle(bundle)).toBe(true);
    expect(bundle.versions.map((v) => v.name)).toEqual(["My resume", "QA"]);
    expect(JSON.stringify(bundle)).not.toContain("secret posting text");
  });
  it("exports version ids and applications, and plain bundles omit them", () => {
    const { versions } = boot(mem());
    const [only] = versions.getIndex().versions;
    expect(versions.exportAll().applications).toBeUndefined();
    const bundle = versions.exportAll([{ id: "app_1", company: "Acme" }]);
    expect(isBundle(bundle)).toBe(true);
    expect(bundle.versions[0].id).toBe(only.id);
    expect(bundle.applications).toHaveLength(1);
  });
  it("adds an imported doc as a new version without touching the others", () => {
    const { resume, versions } = boot(mem());
    const first = versions.getIndex().activeId;
    edit(resume, "#444444");
    const imported: ResumeDoc = patchStyle(createDefaultDoc(), { accent: "#555555" });
    versions.create("resume", imported);
    expect(accent(resume)).toBe("#555555");
    versions.switchTo(first);
    expect(accent(resume)).toBe("#444444");
  });
});

describe("getVersion (for comparing)", () => {
  it("reads the active version live and inactive ones from storage", () => {
    const { resume, posting, versions } = boot(mem());
    const first = versions.getIndex().activeId;
    edit(resume, "#111111");
    posting.setText("one");
    const qa = versions.create("QA");
    edit(resume, "#222222");
    posting.setText("two");
    // Active (qa) is live, even before any autosave; the first version was stashed on switch.
    expect(versions.getVersion(qa)!.doc!.style.accent).toBe("#222222");
    expect(versions.getVersion(qa)!.jd).toBe("two");
    expect(versions.getVersion(first)!.doc!.style.accent).toBe("#111111");
    expect(versions.getVersion(first)!.jd).toBe("one");
    expect(versions.getVersion(first)!.meta.id).toBe(first);
  });
  it("returns null for an unknown id and a null doc when saved data is unreadable", () => {
    const st = mem();
    const { versions } = boot(st);
    const first = versions.getIndex().activeId;
    const qa = versions.create("QA");
    expect(versions.getVersion("nope")).toBeNull();
    st.setItem(docKey(first), "{broken");
    expect(versions.getVersion(first)!.doc).toBeNull();
    expect(versions.getVersion(qa)!.doc).not.toBeNull();
  });
  it("works from memory when storage is blocked", () => {
    const { resume, versions } = boot(null);
    const first = versions.getIndex().activeId;
    edit(resume, "#101010");
    versions.create("QA");
    expect(versions.getVersion(first)!.doc!.style.accent).toBe("#101010");
  });
});

describe("versions without usable storage", () => {
  it("keeps versions in memory for the session when storage is blocked", () => {
    const { resume, posting, versions } = boot(null);
    const first = versions.getIndex().activeId;
    edit(resume, "#111111");
    posting.setText("one");
    const qa = versions.create("QA");
    edit(resume, "#222222");
    versions.switchTo(first);
    expect(accent(resume)).toBe("#111111");
    expect(posting.getText()).toBe("one");
    versions.switchTo(qa);
    expect(accent(resume)).toBe("#222222");
    expect(resume.getStatus()).toBe("unavailable");
  });
  it("does not throw when storage rejects every read and write", () => {
    const boom: KeyValueStorage = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); } };
    let b!: ReturnType<typeof boot>;
    expect(() => { b = boot(boom); }).not.toThrow();
    edit(b.resume, "#101010");
    const qa = b.versions.create("QA");
    b.versions.switchTo(b.versions.getIndex().versions[0].id);
    expect(accent(b.resume)).toBe("#101010");
    expect(b.versions.getIndex().versions.map((v) => v.id)).toContain(qa);
  });
  it("starts fresh, without touching other keys, when the index is corrupt", () => {
    const st = mem();
    st.setItem(VERSIONS_KEY, "{corrupt");
    const { versions } = boot(st);
    expect(names(versions)).toEqual(["My resume"]);
    expect(readIndex(st)).not.toBeNull();
  });
});
