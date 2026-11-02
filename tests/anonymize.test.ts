import { describe, expect, it } from "vitest";
import { anonymizeDoc } from "@/lib/anonymize";
import { parseResumeDoc, type ResumeDoc } from "@/lib/schema";
import { createSampleDoc } from "@/lib/sample";
import { toPlainText } from "@/lib/plaintext";

const LEAKS = [
  "Elena", "Marchetti", "elena.marchetti@example.com", "555 0142", "example.com", "Portland", "Seattle", "Eugene",
  "Harborline", "Brightwell", "Cascade State", "Example Quality",
];

/** Sample doc with identifying details mentioned inside free text. */
function leakyDoc(): ResumeDoc {
  const d = createSampleDoc();
  for (const s of d.sections) {
    if (s.type === "summary") s.content.text = "Elena Marchetti here. Reach me at elena.marchetti@example.com or +1 555 0142, linkedin.com/in/elenam, @elena_m.";
    if (s.type === "experience") {
      s.content.items[0].bullets.push("Saved Harborline Logistics $2M; harborline is a Portland, OR firm. See https://example.com/elena/case");
      s.content.items[1].bullets.push("Moved from Brightwell Supplies to Harborline Logistics.");
    }
    if (s.type === "education") s.content.items[0].details.push("Dean's list at Cascade State University.");
  }
  return d;
}

describe("anonymizeDoc", () => {
  it("removes every personal detail from structured fields and free text", () => {
    const { doc } = anonymizeDoc(leakyDoc());
    const blob = JSON.stringify(doc) + "\n" + toPlainText(doc);
    for (const leak of LEAKS) expect(blob.toLowerCase(), leak).not.toContain(leak.toLowerCase());
  });

  it("does not mutate the input", () => {
    const d = leakyDoc();
    const before = JSON.stringify(d);
    anonymizeDoc(d);
    expect(JSON.stringify(d)).toBe(before);
  });

  it("clears contact fields but keeps a neutral name", () => {
    const { doc, report } = anonymizeDoc(createSampleDoc());
    const c = doc.sections.find((s) => s.type === "contact");
    expect(c?.type === "contact" && c.content).toMatchObject({ fullName: "Candidate", email: "", phone: "", location: "", links: [] });
    expect(report.contactFields).toBe(5);
  });

  it("uses one stable label per organisation, including mentions in text", () => {
    const { doc, report } = anonymizeDoc(leakyDoc());
    const exp = doc.sections.find((s) => s.type === "experience");
    if (exp?.type !== "experience") throw new Error("no experience");
    expect(exp.content.items.map((i) => i.org)).toEqual(["Company A", "Company B"]);
    expect(exp.content.items[1].bullets.at(-1)).toBe("Moved from Company B to Company A.");
    expect(report.organizations).toBe(4); // two companies, one school, one issuer
  });

  it("keeps dates, roles and skills, and does not mistake year ranges for phone numbers", () => {
    const d = createSampleDoc();
    const s = d.sections.find((x) => x.type === "summary");
    if (s?.type === "summary") s.content.text = "Worked 2019 - 2022 - 2023 on ASP.NET and Node.js.";
    const { doc } = anonymizeDoc(d);
    const text = toPlainText(doc);
    expect(text).toContain("2019 - 2022 - 2023 on ASP.NET and Node.js");
    expect(text).toContain("Senior Operations Analyst");
    expect(text).toContain("SQL, Excel");
    const exp = doc.sections.find((x) => x.type === "experience");
    expect(exp?.type === "experience" && exp.content.items[0].start).toBe("2022-03");
  });

  it("drops hidden sections and produces a valid document", () => {
    const d = createSampleDoc();
    d.sections.find((s) => s.type === "languages")!.visible = false;
    const { doc, report } = anonymizeDoc(d);
    expect(doc.sections.some((s) => s.type === "languages")).toBe(false);
    expect(report.hiddenSections).toBe(1);
    expect(parseResumeDoc(doc).ok).toBe(true);
  });
});
