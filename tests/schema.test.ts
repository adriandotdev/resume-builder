import { describe, expect, it } from "vitest";
import { CURRENT_VERSION, SECTION_TYPES, createDefaultDoc, formatDate, formatRange, parseResumeDoc, migrate } from "@/lib/schema";
import { createSampleDoc } from "@/lib/sample";
import { TEMPLATES } from "@/templates/registry";
import { TEMPLATE_IDS } from "@/lib/schema";

describe("defaults", () => {
  it("default doc is current version with standard sections", () => {
    const d = createDefaultDoc();
    expect(d.version).toBe(CURRENT_VERSION);
    expect(d.sections.map((s) => s.type)).toEqual(SECTION_TYPES.filter((t) => t !== "custom"));
    expect(d.sections.every((s) => s.visible)).toBe(true);
  });
  it("sample doc validates and round-trips", () => {
    const d = createSampleDoc();
    const r = parseResumeDoc(JSON.parse(JSON.stringify(d)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.doc).toEqual(d);
  });
  it("registry covers every template id with unique ids", () => {
    expect(TEMPLATES.map((t) => t.id).sort()).toEqual([...TEMPLATE_IDS].sort());
    expect(TEMPLATES.length).toBe(12);
  });
});

describe("migration", () => {
  it("migrates unversioned v0 docs", () => {
    const v0 = { accentColor: "#AA0000", template: "modern", paper: "letter", sections: [{ id: "a", type: "summary", title: "Summary", enabled: false, content: { text: "hi" } }] };
    const r = parseResumeDoc(v0);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.migratedFrom).toBe(0);
      expect(r.doc.version).toBe(CURRENT_VERSION);
      expect(r.doc.style.accent).toBe("#aa0000");
      expect(r.doc.style.template).toBe("modern");
      expect(r.doc.style.pageSize).toBe("letter");
      expect(r.doc.sections[0].visible).toBe(false);
    }
  });
  it("rejects future and invalid versions", () => {
    expect(parseResumeDoc({ version: 99, style: {}, sections: [] }).ok).toBe(false);
    expect(migrate({ version: -1 })).toBeNull();
    expect(migrate({ version: "1" })).toBeNull();
  });
});

describe("import validation", () => {
  const bad = (x: unknown) => {
    const r = parseResumeDoc(x);
    expect(r.ok).toBe(false);
    return r.ok ? [] : r.errors;
  };
  it("rejects non-objects", () => { bad(null); bad([]); bad("x"); bad(5); });
  it("rejects missing sections", () => { expect(bad({ version: 1 }).join()).toMatch(/sections/); });
  it("rejects unknown section type", () => { expect(bad({ version: 1, sections: [{ type: "hax" }] }).join()).toMatch(/type/); });
  it("rejects bad style values", () => {
    const e = bad({ version: 1, style: { accent: "red", fontSize: 99, font: "comic", pageSize: "a0" }, sections: [] }).join("|");
    expect(e).toMatch(/accent/); expect(e).toMatch(/fontSize/); expect(e).toMatch(/font /); expect(e).toMatch(/pageSize/);
  });
  it("rejects wrong content types and never half-applies", () => {
    const e = bad({ version: 1, sections: [{ type: "experience", content: { items: [{ role: 5, bullets: "x" }] } }] }).join("|");
    expect(e).toMatch(/role/); expect(e).toMatch(/bullets/);
  });
  it("fills defaults and unique ids for a minimal doc", () => {
    const r = parseResumeDoc({ version: 1, sections: [{ type: "summary", id: "x" }, { type: "summary", id: "x" }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.doc.style.template).toBe("classic");
      expect(new Set(r.doc.sections.map((s) => s.id)).size).toBe(2);
      expect(r.doc.sections[0].title).toBe("Summary");
    }
  });
  it("ignores unknown extra keys (no prototype pollution carried)", () => {
    const r = parseResumeDoc(JSON.parse('{"version":1,"__proto__":{"polluted":1},"sections":[],"extra":1}'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.doc).sort()).toEqual(["sections", "style", "version"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("date formatting", () => {
  it("formats per setting", () => {
    expect(formatDate("2022-03", "MMM YYYY")).toBe("Mar 2022");
    expect(formatDate("2022-03", "MM/YYYY")).toBe("03/2022");
    expect(formatDate("2022-03", "YYYY")).toBe("2022");
    expect(formatDate("2022", "MMM YYYY")).toBe("2022");
    expect(formatDate("Spring 2020", "YYYY")).toBe("Spring 2020");
  });
  it("formats ranges", () => {
    expect(formatRange("2020-01", "", true, "MMM YYYY")).toContain("Present");
    expect(formatRange("", "", false, "YYYY")).toBe("");
    expect(formatRange("2019", "2021", false, "YYYY")).toBe("2019 – 2021");
  });
});
