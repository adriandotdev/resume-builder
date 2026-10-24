import { describe, expect, it } from "vitest";
import type { KeyValueStorage } from "@/lib/store";
import { createApplicationsStore } from "@/lib/applicationsStore";
import { APPLICATIONS_KEY, MAX_FIELD, parseApplications, remapVersions } from "@/lib/applications";

function mem(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}
const boot = (st: KeyValueStorage | null) => {
  const store = createApplicationsStore({ storage: st });
  store.load();
  return store;
};
const saved = (st: ReturnType<typeof mem>) => JSON.parse(st.data.get(APPLICATIONS_KEY) ?? "{}").items as { id: string }[];

describe("parseApplications", () => {
  it("returns nothing for corrupt input", () => {
    expect(parseApplications(null)).toEqual([]);
    expect(parseApplications("{not json")).toEqual([]);
    expect(parseApplications('"text"')).toEqual([]);
    expect(parseApplications({ items: "no" })).toEqual([]);
  });

  it("drops bad and duplicate entries and repairs fields", () => {
    const out = parseApplications({
      version: 1,
      items: [
        null,
        { id: "", company: "No id" },
        { id: "a", company: "  Acme   Inc ", role: "Dev", status: "bogus", versionId: 5, createdAt: "x" },
        { id: "a", company: "Duplicate" },
        { id: "b" },
        { id: "c", company: "x".repeat(MAX_FIELD + 50), status: "applied", appliedAt: 7 },
      ],
    });
    expect(out.map((a) => a.id)).toEqual(["a", "c"]);
    expect(out[0]).toMatchObject({ company: "Acme Inc", status: "saved", versionId: null, createdAt: 0 });
    expect(out[1].company).toHaveLength(MAX_FIELD);
    expect(out[1].appliedAt).toBe(7);
  });
});

describe("applications store", () => {
  it("adds, persists and reloads", () => {
    const st = mem();
    const a = boot(st);
    a.add({ company: "Acme", role: "Engineer", posting: "Build things" });
    expect(saved(st)).toHaveLength(1);
    const b = boot(st);
    expect(b.getAll()[0]).toMatchObject({ company: "Acme", role: "Engineer", posting: "Build things", status: "saved" });
  });

  it("sets appliedAt the first time the status leaves saved, and keeps it", () => {
    const store = boot(mem());
    const { id } = store.add({ company: "Acme", role: "Engineer" });
    expect(store.getAll()[0].appliedAt).toBeUndefined();
    store.update(id, { status: "applied" });
    const first = store.getAll()[0].appliedAt;
    expect(first).toBeTypeOf("number");
    store.update(id, { status: "interviewing" });
    expect(store.getAll()[0].appliedAt).toBe(first);
  });

  it("removes and restores at the same position", () => {
    const store = boot(mem());
    store.add({ company: "A", role: "r" });
    const mid = store.add({ company: "B", role: "r" });
    store.add({ company: "C", role: "r" });
    const order = store.getAll().map((x) => x.company);
    const removed = store.remove(mid.id)!;
    expect(store.getAll()).toHaveLength(2);
    store.restore(removed);
    expect(store.getAll().map((x) => x.company)).toEqual(order);
    expect(store.remove("missing")).toBeNull();
  });

  it("keeps the version name when a link is cleared", () => {
    const store = boot(mem());
    const { id } = store.add({ company: "Acme", role: "Dev", versionId: "v1", versionName: "Backend" });
    expect(store.linkedTo("v1")).toHaveLength(1);
    store.update(id, { versionId: null });
    expect(store.linkedTo("v1")).toHaveLength(0);
    expect(store.getAll()[0].versionName).toBe("Backend");
  });

  it("works in memory when storage is missing or throws", () => {
    const none = boot(null);
    none.add({ company: "Acme", role: "Dev" });
    expect(none.getAll()).toHaveLength(1);
    const broken: KeyValueStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
    const store = boot(broken);
    store.add({ company: "Acme", role: "Dev" });
    expect(store.getAll()).toHaveLength(1);
  });

  it("addMany skips ids that already exist", () => {
    const store = boot(mem());
    const a = store.add({ company: "Acme", role: "Dev" });
    store.addMany([a, { ...a, id: "other" }]);
    expect(store.getAll().map((x) => x.id).sort()).toEqual([a.id, "other"].sort());
  });
});

describe("remapVersions", () => {
  it("points links at new ids and unlinks the rest", () => {
    const [a, b] = parseApplications([
      { id: "1", company: "A", versionId: "old1", versionName: "One" },
      { id: "2", company: "B", versionId: "gone", versionName: "Two" },
    ]);
    const out = remapVersions([a, b], new Map([["old1", "new1"]]));
    expect(out[0].versionId).toBe("new1");
    expect(out[1]).toMatchObject({ versionId: null, versionName: "Two" });
  });
});
