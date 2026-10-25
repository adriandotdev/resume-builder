import { describe, expect, it } from "vitest";
import {
  addBodyBlock, appendSentence, contactLine, coverVars, defaultLetter, fillTemplate, insertBlock, letterPlainText, moveBlock,
  parseCoverLetter, patchBlock, removeBlock, renderBlocks, talkingPoints, unfilledFields, MAX_BLOCKS, MAX_FIELD,
} from "@/lib/cover";
import { createSampleDoc } from "@/lib/sample";
import { OPS_ANALYST } from "./fixtures/postings";

const doc = createSampleDoc();
const filled = () => ({ ...defaultLetter(), company: "Northgate Freight", role: "Operations Analyst", hiringManager: "Sam Lee" });

describe("fillTemplate", () => {
  it("fills known placeholders and leaves other braces alone", () => {
    const v = { name: "Ana", company: "Acme", role: "Dev", manager: "Kim" };
    expect(fillTemplate("Dear {manager}, {role} at {company}. {name} {other}", v)).toBe("Dear Kim, Dev at Acme. Ana {other}");
  });
  it("shows visible fallbacks for empty fields", () => {
    const v = coverVars(doc, defaultLetter());
    expect(v.company).toBe("[Company]");
    expect(v.role).toBe("[Role]");
    expect(v.manager).toBe("Hiring Manager");
    expect(unfilledFields(doc, defaultLetter())).toEqual(["company", "role"]);
    expect(unfilledFields(doc, filled())).toEqual([]);
  });
});

describe("rendering", () => {
  it("takes the name and contact from the resume and drops hidden blocks", () => {
    const l = filled();
    const hidden = patchBlock(l, l.blocks[2].id, { visible: false });
    const text = letterPlainText(doc, hidden);
    expect(text.startsWith(coverVars(doc, l).name)).toBe(true);
    expect(text).toContain(contactLine(doc));
    expect(text).toContain("Dear Sam Lee,");
    expect(text).toContain("Operations Analyst position at Northgate Freight");
    expect(text).not.toContain("Replace this paragraph");
    expect(renderBlocks(doc, hidden)).toHaveLength(l.blocks.length - 1);
  });
});

describe("talking points", () => {
  it("returns only terms the resume covers, and nothing without a posting", () => {
    expect(talkingPoints(doc, "   ")).toEqual([]);
    const pts = talkingPoints(doc, OPS_ANALYST);
    expect(pts.every((t) => t.found && !t.hiddenOnly)).toBe(true);
  });
  it("appends a sentence", () => {
    expect(appendSentence("", "A.")).toBe("A.");
    expect(appendSentence("One. ", "Two.")).toBe("One. Two.");
  });
});

describe("block edits", () => {
  it("moves, removes, inserts and adds body paragraphs", () => {
    const l = defaultLetter();
    expect(moveBlock(l, 1, 2).blocks.map((b) => b.id)).toEqual([l.blocks[0].id, l.blocks[2].id, l.blocks[1].id, l.blocks[3].id, l.blocks[4].id]);
    expect(moveBlock(l, 0, 99)).toBe(l);
    expect(removeBlock(l, l.blocks[0].id).blocks).toHaveLength(4);
    expect(insertBlock(l, l.blocks[0], 99).blocks).toHaveLength(6);
    const added = addBodyBlock(l);
    expect(added.blocks.map((b) => b.kind)).toEqual(["greeting", "opening", "body", "body", "closing", "signoff"]);
    let many = l;
    for (let i = 0; i < 30; i++) many = addBodyBlock(many);
    expect(many.blocks.length).toBe(MAX_BLOCKS);
  });
});

describe("parseCoverLetter", () => {
  it("round-trips a letter", () => {
    const l = filled();
    expect(parseCoverLetter(JSON.parse(JSON.stringify(l)))).toEqual(l);
  });
  it("rejects junk and newer versions, and repairs bad blocks", () => {
    expect(parseCoverLetter(null)).toBeNull();
    expect(parseCoverLetter("x")).toBeNull();
    expect(parseCoverLetter({ blocks: "x" })).toBeNull();
    expect(parseCoverLetter({ version: 2, blocks: [] })).toBeNull();
    const l = parseCoverLetter({
      company: "x".repeat(500),
      blocks: [{ id: "a", kind: "body", text: "ok" }, { id: "a", kind: "body", text: "dup id", visible: false }, { kind: "nope", text: "x" }, null, { kind: "body", text: 5 }],
    })!;
    expect(l.company).toHaveLength(MAX_FIELD);
    expect(l.blocks).toHaveLength(3);
    expect(new Set(l.blocks.map((b) => b.id)).size).toBe(3);
    expect(l.blocks[1].visible).toBe(false);
    expect(l.blocks[2].text).toBe("");
  });
});
