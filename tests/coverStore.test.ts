import { describe, expect, it, vi } from "vitest";
import { createCoverStore } from "@/lib/coverStore";
import { createResumeStore, type KeyValueStorage } from "@/lib/store";
import { createJobPostingStore } from "@/lib/jobPostingStore";
import { createVersionsStore } from "@/lib/versionsStore";
import { bootActiveId, coverKey, docKey, isBundle, jdKey } from "@/lib/versions";
import { defaultLetter, parseCoverLetter } from "@/lib/cover";

function mem(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}
function boot(st: KeyValueStorage | null) {
  const id = bootActiveId(st);
  const resume = createResumeStore({ storage: st, debounceMs: 0, key: docKey(id) });
  const posting = createJobPostingStore({ storage: st, debounceMs: 0, key: jdKey(id) });
  const cover = createCoverStore({ storage: st, debounceMs: 0, key: coverKey(id) });
  resume.load(); posting.load(); cover.load();
  const versions = createVersionsStore({ storage: st, resume, posting, cover });
  versions.load();
  return { cover, versions };
}
const company = (c: ReturnType<typeof boot>["cover"]) => c.getState().company;
const setCompany = (c: ReturnType<typeof boot>["cover"], v: string) => c.update((l) => ({ ...l, company: v }));

describe("cover store", () => {
  it("debounces saves and flushes on demand", () => {
    vi.useFakeTimers();
    const st = mem();
    const s = createCoverStore({ storage: st, key: "k", debounceMs: 300 });
    s.update((l) => ({ ...l, company: "A" }));
    expect(st.data.has("k")).toBe(false);
    s.flush();
    expect(parseCoverLetter(JSON.parse(st.data.get("k")!))!.company).toBe("A");
    vi.useRealTimers();
  });
  it("starts from the template when nothing, or garbage, is stored", () => {
    const st = mem();
    st.setItem("k", "{nope");
    const s = createCoverStore({ storage: st, key: "k" });
    s.load();
    expect(s.getState().blocks).toHaveLength(defaultLetter().blocks.length);
  });
  it("keeps working when storage throws", () => {
    const bad: KeyValueStorage = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    const s = createCoverStore({ storage: bad, key: "k", debounceMs: 0 });
    s.load();
    s.update((l) => ({ ...l, role: "R" }));
    expect(() => s.flush()).not.toThrow();
    expect(s.getState().role).toBe("R");
  });
});

describe("cover letters per version", () => {
  it("keeps each version's letter separate across switches", () => {
    const { cover, versions } = boot(mem());
    const first = versions.getIndex().activeId;
    setCompany(cover, "Acme");
    versions.create("Second");
    expect(company(cover)).toBe("");
    setCompany(cover, "Beta");
    versions.switchTo(first);
    expect(company(cover)).toBe("Acme");
  });
  it("copies the letter when duplicating", () => {
    const { cover, versions } = boot(mem());
    setCompany(cover, "Acme");
    versions.duplicate();
    expect(company(cover)).toBe("Acme");
    setCompany(cover, "Changed");
    versions.switchTo(versions.getIndex().versions[0].id);
    expect(company(cover)).toBe("Acme");
  });
  it("restores the letter with Undo, and erases it on delete", () => {
    const st = mem();
    const { cover, versions } = boot(st);
    const first = versions.getIndex().activeId;
    versions.create("Second");
    const second = versions.getIndex().activeId;
    setCompany(cover, "Beta");
    const removed = versions.remove(second)!;
    expect(st.data.has(coverKey(second))).toBe(false);
    expect(versions.getIndex().activeId).toBe(first);
    versions.restore(removed);
    expect(versions.getIndex().activeId).toBe(second);
    expect(company(cover)).toBe("Beta");
  });
  it("works in memory mode when storage is blocked", () => {
    const { cover, versions } = boot(null);
    const first = versions.getIndex().activeId;
    setCompany(cover, "Acme");
    versions.create("Second");
    expect(company(cover)).toBe("");
    versions.switchTo(first);
    expect(company(cover)).toBe("Acme");
  });
  it("exports letters in the bundle, and older bundles without them stay valid", () => {
    const { cover, versions } = boot(mem());
    setCompany(cover, "Acme");
    const bundle = versions.exportAll();
    expect(isBundle(bundle)).toBe(true);
    expect(parseCoverLetter(bundle.versions[0].cover)!.company).toBe("Acme");
    expect(isBundle({ kind: "resume-builder-bundle", versions: [{ name: "x", doc: {} }] })).toBe(true);
  });
});
