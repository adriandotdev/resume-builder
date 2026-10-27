import { describe, expect, it } from "vitest";
import { runParseSim } from "@/lib/parsesim";
import { createSampleDoc } from "@/lib/sample";
import { createDefaultDoc, type ContactSection, type EducationSection, type ExperienceSection, type ResumeDoc, type SkillsSection } from "@/lib/schema";

const exp = (d: ResumeDoc) => (d.sections.find((s) => s.type === "experience") as ExperienceSection).content.items[0];
const ids = (d: ResumeDoc) => runParseSim(d).findings.map((f) => f.id.split(":")[2]);

describe("parse simulator", () => {
  it("reads the sample doc cleanly", () => {
    const r = runParseSim(createSampleDoc());
    expect(r.findings).toEqual([]);
    expect(r.contact?.name).toBe("Elena Marchetti");
    expect(r.contact?.email).toMatch(/@/);
    const e = r.sections.find((s) => s.type === "experience")!.entries[0];
    expect(e.fields.map((x) => x.label)).toEqual(["Job title", "Employer", "Location", "Start", "End"]);
    expect(e.fields[0].value).toBe("Senior Operations Analyst");
    expect(e.fields[2].value).toBe("Portland, OR");
    expect(e.fields[3].value).toBe("Mar 2022");
    expect(e.fields[4].value).toBe("Present");
  });
  it("does not crash on a blank doc", () => {
    expect(() => runParseSim(createDefaultDoc())).not.toThrow();
  });
  it("skips hidden sections", () => {
    const d = createSampleDoc();
    d.sections.find((s) => s.type === "education")!.visible = false;
    expect(runParseSim(d).sections.some((s) => s.type === "education")).toBe(false);
  });
  it("reads all three date formats", () => {
    for (const fmt of ["MMM YYYY", "MM/YYYY", "YYYY"] as const) {
      const d = createSampleDoc();
      d.style.dateFormat = fmt;
      expect(ids(d), fmt).toEqual([]);
      const e = runParseSim(d).sections.find((s) => s.type === "experience")!.entries[0];
      expect(e.fields[3].value).not.toBe("");
    }
  });
  it("flags a date a parser cannot read", () => {
    const d = createSampleDoc();
    exp(d).start = "Spring 2022";
    expect(ids(d)).toContain("date");
  });
  it("flags an end before a start", () => {
    const d = createSampleDoc();
    Object.assign(exp(d), { current: false, start: "2022-03", end: "2020-01" });
    expect(ids(d)).toContain("range");
  });
  it("flags a missing end date when not current", () => {
    const d = createSampleDoc();
    Object.assign(exp(d), { current: false, end: "" });
    expect(ids(d)).toContain("open-end");
  });
  it("flags an entry with no dates", () => {
    const d = createSampleDoc();
    Object.assign(exp(d), { start: "", end: "", current: false });
    expect(ids(d)).toContain("no-date");
  });
  it("flags a missing employer", () => {
    const d = createSampleDoc();
    Object.assign(exp(d), { org: "", location: "" });
    expect(ids(d)).toContain("pair");
  });
  it("flags a blank employer when a location fills its slot", () => {
    const d = createSampleDoc();
    Object.assign(exp(d), { org: "" });
    const f = runParseSim(d).findings.find((x) => x.id.endsWith(":pair"))!;
    expect(f.fieldLabel).toBe("Employer");
    expect(f.message).toMatch(/No employer/);
  });
  it("flags a blank school when a location fills its slot", () => {
    const d = createSampleDoc();
    const edu = (d.sections.find((s) => s.type === "education") as EducationSection).content.items[0];
    Object.assign(edu, { school: "", location: edu.location || "Portland, OR" });
    expect(ids(d)).toContain("pair");
  });
  it("labels every skills group, not just the first", () => {
    const r = runParseSim(createSampleDoc());
    const groups = r.sections.find((s) => s.type === "skills")!.entries;
    expect(groups.length).toBeGreaterThan(1);
    for (const g of groups) {
      expect(g.itemId).not.toBeNull();
      expect(g.fields[0].value).not.toBe("");
      expect(g.fields[1].value).not.toContain(": ");
    }
  });
  it("flags a second skills group that is not comma separated", () => {
    const d = createSampleDoc();
    const items = (d.sections.find((s) => s.type === "skills") as SkillsSection).content.items;
    items[1].skills = "Looker; Airtable; Notion";
    expect(ids(d)).toContain("separators");
  });
  it("rejects a month outside 01-12", () => {
    const d = createSampleDoc();
    Object.assign(exp(d), { current: false, start: "2022-13", end: "2023-01" });
    expect(ids(d)).toContain("month");
  });
  it("flags an unrecognised heading and names the field", () => {
    const d = createSampleDoc();
    d.sections.find((s) => s.type === "experience")!.title = "Where I've been";
    const f = runParseSim(d).findings.find((x) => x.id.endsWith(":heading"))!;
    expect(f.fieldLabel).toBe("Section heading");
  });
  it("flags a missing email and a contact that is not first", () => {
    const d = createSampleDoc();
    (d.sections[0] as ContactSection).content.email = "";
    expect(ids(d)).toContain("email");
    const e = createSampleDoc();
    e.sections.push(e.sections.shift()!);
    expect(ids(e)).toContain("not-first");
  });
  it("flags skills that are not comma separated", () => {
    const d = createSampleDoc();
    (d.sections.find((s) => s.type === "skills") as SkillsSection).content.items[0].skills = "Excel; SQL; Tableau; Python";
    expect(ids(d)).toContain("separators");
  });
  it("accepts a graduation year alone for education", () => {
    const d = createSampleDoc();
    Object.assign((d.sections.find((s) => s.type === "education") as EducationSection).content.items[0], { start: "", end: "2019" });
    expect(ids(d)).toEqual([]);
  });
});
