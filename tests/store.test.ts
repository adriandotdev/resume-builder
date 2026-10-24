import { describe, expect, it, vi } from "vitest";
import { createResumeStore, STORAGE_KEY, type KeyValueStorage } from "@/lib/store";
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
