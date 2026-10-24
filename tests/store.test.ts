import { describe, expect, it, vi } from "vitest";
import { createResumeStore, STORAGE_KEY, type KeyValueStorage } from "@/lib/store";
import { createJobPostingStore, JOB_POSTING_KEY } from "@/lib/jobPostingStore";
import { createDefaultDoc } from "@/lib/schema";
import { moveSection, patchStyle, removeSection, addSection } from "@/lib/ops";

function mem(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe("store", () => {
  it("starts with a sample doc and no storage access before load", () => {
    const s = createResumeStore({ storage: mem() });
    expect(s.getState().sections.length).toBeGreaterThan(3);
    expect(s.getStatus()).toBe("idle");
  });
  it("debounces saves and persists after flush", () => {
    vi.useFakeTimers();
    const st = mem();
    const s = createResumeStore({ storage: st, debounceMs: 100 });
    s.update((d) => patchStyle(d, { accent: "#112233" }));
    s.update((d) => patchStyle(d, { fontSize: 11 }));
    expect(st.data.has(STORAGE_KEY)).toBe(false);
    vi.advanceTimersByTime(150);
    expect(JSON.parse(st.data.get(STORAGE_KEY)!).style).toMatchObject({ accent: "#112233", fontSize: 11 });
    expect(s.getStatus()).toBe("saved");
    vi.useRealTimers();
  });
  it("restores previous state on load (reload persistence)", () => {
    const st = mem();
    const a = createResumeStore({ storage: st, debounceMs: 0 });
    a.update((d) => moveSection(d, 0, 2));
    a.flush();
    const b = createResumeStore({ storage: st });
    b.load();
    expect(b.getStatus()).toBe("restored");
    expect(b.getState().sections.map((x) => x.id)).toEqual(a.getState().sections.map((x) => x.id));
  });
  it("migrates stored legacy data", () => {
    const st = mem();
    st.setItem(STORAGE_KEY, JSON.stringify({ accentColor: "#00ff00", sections: [] }));
    const s = createResumeStore({ storage: st });
    s.load();
    expect(s.getState().style.accent).toBe("#00ff00");
    expect(s.getState().version).toBe(1);
  });
  it("ignores corrupt storage and keeps defaults", () => {
    const st = mem();
    st.setItem(STORAGE_KEY, "{not json");
    const s = createResumeStore({ storage: st });
    expect(() => s.load()).not.toThrow();
    expect(s.getStatus()).toBe("corrupt");
    st.setItem(STORAGE_KEY, JSON.stringify({ version: 1, sections: "nope" }));
    const s2 = createResumeStore({ storage: st });
    s2.load();
    expect(s2.getStatus()).toBe("corrupt");
  });
  it("survives storage that throws on read and write", () => {
    const boom: KeyValueStorage = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); } };
    const s = createResumeStore({ storage: boom, debounceMs: 0 });
    expect(() => s.load()).not.toThrow();
    s.update((d) => patchStyle(d, { accent: "#000000" }));
    expect(() => s.flush()).not.toThrow();
    expect(s.getStatus()).toBe("unavailable");
    expect(s.getState().style.accent).toBe("#000000");
  });
  it("works with no storage (SSR)", () => {
    const s = createResumeStore({ storage: null });
    s.load();
    expect(s.getStatus()).toBe("unavailable");
  });
  it("notifies subscribers and unsubscribes", () => {
    const s = createResumeStore({ storage: mem() });
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.resetToBlank();
    expect(fn).toHaveBeenCalled();
    off(); fn.mockClear();
    s.resetToSample();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("ops", () => {
  it("reorders, adds and removes sections", () => {
    const d = createDefaultDoc();
    const ids = d.sections.map((s) => s.id);
    const m = moveSection(d, 0, 2);
    expect(m.sections.map((s) => s.id)).toEqual([ids[1], ids[2], ids[0], ...ids.slice(3)]);
    expect(moveSection(d, 0, 99)).toBe(d);
    const a = addSection(d, "custom");
    expect(a.sections.at(-1)?.type).toBe("custom");
    expect(removeSection(a, a.sections.at(-1)!.id).sections.length).toBe(d.sections.length);
  });
});

describe("job posting store", () => {
  it("is separate from the resume key and persists after flush", () => {
    const st = mem();
    const a = createJobPostingStore({ storage: st, debounceMs: 100 });
    a.setText("Kubernetes engineer");
    expect(st.data.has(JOB_POSTING_KEY)).toBe(false);
    a.flush();
    expect(st.data.get(JOB_POSTING_KEY)).toBe("Kubernetes engineer");
    expect(JOB_POSTING_KEY).not.toBe(STORAGE_KEY);
    expect(st.data.has(STORAGE_KEY)).toBe(false);
    const b = createJobPostingStore({ storage: st });
    b.load();
    expect(b.getText()).toBe("Kubernetes engineer");
  });
  it("debounces writes", () => {
    vi.useFakeTimers();
    const st = mem();
    const s = createJobPostingStore({ storage: st, debounceMs: 100 });
    s.setText("a");
    s.setText("ab");
    vi.advanceTimersByTime(150);
    expect(st.data.get(JOB_POSTING_KEY)).toBe("ab");
    vi.useRealTimers();
  });
  it("is not touched by Start blank or Load sample", () => {
    const st = mem();
    const posting = createJobPostingStore({ storage: st, debounceMs: 0 });
    const resume = createResumeStore({ storage: st, debounceMs: 0 });
    posting.setText("keep me");
    posting.flush();
    resume.resetToBlank();
    resume.resetToSample();
    resume.flush();
    expect(posting.getText()).toBe("keep me");
    expect(st.data.get(JOB_POSTING_KEY)).toBe("keep me");
  });
  it("clear empties the posting and writes at once", () => {
    const st = mem();
    const s = createJobPostingStore({ storage: st });
    s.setText("something");
    s.clear();
    expect(s.getText()).toBe("");
    expect(st.data.get(JOB_POSTING_KEY)).toBe("");
    const b = createJobPostingStore({ storage: st });
    b.load();
    expect(b.getText()).toBe("");
  });
  it("works in memory when storage is unavailable", () => {
    vi.useFakeTimers();
    const s = createJobPostingStore({ storage: null, debounceMs: 10 });
    s.load();
    s.setText("hello");
    vi.advanceTimersByTime(50);
    expect(s.getText()).toBe("hello");
    s.clear();
    expect(s.getText()).toBe("");
    vi.useRealTimers();
  });
  it("survives setItem and getItem throwing", () => {
    vi.useFakeTimers();
    const boom: KeyValueStorage = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); } };
    const s = createJobPostingStore({ storage: boom, debounceMs: 10 });
    expect(() => s.load()).not.toThrow();
    s.setText("still here");
    expect(() => vi.advanceTimersByTime(50)).not.toThrow();
    expect(() => s.clear()).not.toThrow();
    s.setText("again");
    expect(s.getText()).toBe("again");
    vi.useRealTimers();
  });
  it("notifies subscribers and unsubscribes", () => {
    const s = createJobPostingStore({ storage: mem() });
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.setText("x");
    expect(fn).toHaveBeenCalledTimes(1);
    off(); fn.mockClear();
    s.clear();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("switching the storage key (resume versions)", () => {
  it("writes pending edits to the old key before moving to the new one", () => {
    const st = mem();
    const s = createResumeStore({ storage: st, debounceMs: 1000, key: "doc:a" });
    s.update((d) => patchStyle(d, { accent: "#aa0000" }));
    s.switchKey("doc:b");
    expect(JSON.parse(st.data.get("doc:a")!).style.accent).toBe("#aa0000");
    expect(st.data.has("doc:b")).toBe(false);
    expect(s.isPending()).toBe(false);
  });
  it("loads what is stored under the new key, and the sample when there is nothing", () => {
    const st = mem();
    const other = createDefaultDoc();
    st.setItem("doc:b", JSON.stringify(patchStyle(other, { accent: "#00bb00" })));
    const s = createResumeStore({ storage: st, key: "doc:a" });
    s.switchKey("doc:b");
    expect(s.getState().style.accent).toBe("#00bb00");
    expect(s.getStatus()).toBe("restored");
    s.switchKey("doc:empty");
    expect(s.getState().sections.length).toBeGreaterThan(3);
    expect(s.getStatus()).toBe("idle");
  });
  it("uses and saves a seed doc at once, and notifies subscribers", () => {
    const st = mem();
    const s = createResumeStore({ storage: st, key: "doc:a" });
    let calls = 0;
    s.subscribe(() => { calls += 1; });
    s.switchKey("doc:b", patchStyle(createDefaultDoc(), { accent: "#123123" }));
    expect(s.getState().style.accent).toBe("#123123");
    expect(JSON.parse(st.data.get("doc:b")!).style.accent).toBe("#123123");
    expect(calls).toBeGreaterThan(0);
  });
  it("treats unreadable data under the new key as corrupt without losing the old key", () => {
    const st = mem();
    st.setItem("doc:b", "{bad");
    const s = createResumeStore({ storage: st, key: "doc:a" });
    s.update((d) => patchStyle(d, { accent: "#0000aa" }));
    s.switchKey("doc:b");
    expect(s.getStatus()).toBe("corrupt");
    expect(JSON.parse(st.data.get("doc:a")!).style.accent).toBe("#0000aa");
  });
  it("moves the job posting with the key and saves the old text first", () => {
    const st = mem();
    st.setItem("jd:b", "backend posting");
    const p = createJobPostingStore({ storage: st, debounceMs: 1000, key: "jd:a" });
    p.setText("frontend posting");
    p.switchKey("jd:b");
    expect(st.data.get("jd:a")).toBe("frontend posting");
    expect(p.getText()).toBe("backend posting");
    p.switchKey("jd:c", "");
    expect(p.getText()).toBe("");
    p.switchKey("jd:never-saved");
    expect(p.getText()).toBe("");
  });
});
