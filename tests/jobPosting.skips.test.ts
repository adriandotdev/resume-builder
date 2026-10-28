import { describe, expect, it } from "vitest";
import { createJobPostingStore, SKIPPED_SUFFIX } from "@/lib/jobPostingStore";

function memory() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe("skipped terms", () => {
  it("are saved beside the posting and reloaded", () => {
    const s = memory();
    const a = createJobPostingStore({ storage: s, key: "jd:1" });
    a.skip("kubernet"); a.skip("kubernet"); a.skip("rust");
    expect(JSON.parse(s.m.get(`jd:1${SKIPPED_SUFFIX}`)!)).toEqual(["kubernet", "rust"]);
    const b = createJobPostingStore({ storage: s, key: "jd:1" });
    b.load();
    expect(b.getSkipped()).toEqual(["kubernet", "rust"]);
    b.unskip("rust");
    expect(b.getSkipped()).toEqual(["kubernet"]);
  });
  it("belong to one posting and are removed by clear", () => {
    const s = memory();
    const a = createJobPostingStore({ storage: s, key: "jd:1" });
    a.skip("rust");
    a.switchKey("jd:2");
    expect(a.getSkipped()).toEqual([]);
    a.switchKey("jd:1");
    expect(a.getSkipped()).toEqual(["rust"]);
    a.clear();
    expect(s.m.has(`jd:1${SKIPPED_SUFFIX}`)).toBe(false);
  });
  it("ignore a corrupt saved list", () => {
    const s = memory();
    s.m.set(`jd:1${SKIPPED_SUFFIX}`, "{nope");
    const a = createJobPostingStore({ storage: s, key: "jd:1" });
    a.load();
    expect(a.getSkipped()).toEqual([]);
  });
});
