import { newId, type ContactData, type ResumeDoc } from "./schema";
import { matchJobDescription, type TermMatch } from "./jobmatch";

export const COVER_VERSION = 1;
export const MAX_FIELD = 120;
export const MAX_BLOCK = 2000;
export const MAX_BLOCKS = 12;

export type CoverKind = "greeting" | "opening" | "body" | "closing" | "signoff";
export const COVER_KINDS: CoverKind[] = ["greeting", "opening", "body", "closing", "signoff"];
export const KIND_LABELS: Record<CoverKind, string> = {
  greeting: "Greeting", opening: "Opening", body: "Body paragraph", closing: "Closing", signoff: "Sign-off",
};

export interface CoverBlock { id: string; kind: CoverKind; text: string; visible: boolean }
export interface CoverLetter { version: 1; company: string; role: string; hiringManager: string; blocks: CoverBlock[] }

export interface CoverVars { name: string; company: string; role: string; manager: string }

const block = (kind: CoverKind, text: string): CoverBlock => ({ id: newId("cb"), kind, text, visible: true });

/** Starting blocks. Placeholders are filled from the letter fields when shown, so editing the company updates every block. */
export function defaultLetter(): CoverLetter {
  return {
    version: COVER_VERSION,
    company: "",
    role: "",
    hiringManager: "",
    blocks: [
      block("greeting", "Dear {manager},"),
      block("opening", "I am writing to apply for the {role} position at {company}. My background lines up closely with what the role asks for, and I would like to bring it to your team."),
      block("body", "In my recent work I have delivered results that matter for this kind of role. Replace this paragraph with one or two specific achievements, with numbers where you have them."),
      block("closing", "Thank you for your time and consideration. I would welcome the chance to talk about how I can contribute to {company}."),
      block("signoff", "Sincerely,\n{name}"),
    ],
  };
}

/** A visible reminder when a field is empty, so a letter is never sent with a silent gap. */
const FALLBACKS = { company: "[Company]", role: "[Role]", manager: "Hiring Manager", name: "" } as const;

export function contactOf(doc: ResumeDoc): ContactData | null {
  const s = doc.sections.find((x) => x.type === "contact");
  return s && s.type === "contact" ? s.content : null;
}

export function coverVars(doc: ResumeDoc, letter: CoverLetter): CoverVars {
  const c = contactOf(doc);
  return {
    name: c?.fullName.trim() || FALLBACKS.name,
    company: letter.company.trim() || FALLBACKS.company,
    role: letter.role.trim() || FALLBACKS.role,
    manager: letter.hiringManager.trim() || FALLBACKS.manager,
  };
}

/** Replace `{name}`, `{company}`, `{role}` and `{manager}`. Unknown braces are left alone. */
export function fillTemplate(text: string, vars: CoverVars): string {
  return text.replace(/\{(name|company|role|manager)\}/g, (_, k: keyof CoverVars) => vars[k]);
}

/** The contact line under the name: email, phone, location and links that the resume has. */
export function contactLine(doc: ResumeDoc): string {
  const c = contactOf(doc);
  return c ? [c.email, c.phone, c.location, ...c.links].map((x) => x.trim()).filter(Boolean).join(" | ") : "";
}

/** Blocks as shown on the page: hidden ones dropped, placeholders filled. */
export function renderBlocks(doc: ResumeDoc, letter: CoverLetter): { id: string; kind: CoverKind; lines: string[] }[] {
  const vars = coverVars(doc, letter);
  return letter.blocks
    .filter((b) => b.visible && b.text.trim() !== "")
    .map((b) => ({ id: b.id, kind: b.kind, lines: fillTemplate(b.text, vars).split("\n").map((l) => l.trimEnd()) }));
}

/** Terms from the posting that the resume really covers (visible sections only), most important first. */
export function talkingPoints(doc: ResumeDoc, jd: string): TermMatch[] {
  if (!jd.trim()) return [];
  return matchJobDescription(doc, jd).terms.filter((t) => t.found && !t.hiddenOnly);
}

/** A plain sentence to start from. The user rewrites it; nothing is generated. */
export function talkingPointSentence(term: string): string {
  return `I have hands-on experience with ${term.trim()}, which I would bring to this role.`;
}

export function appendSentence(text: string, sentence: string): string {
  const t = text.trimEnd();
  return t ? `${t} ${sentence}` : sentence;
}

/** The letter as text a parser or a plain-text paste would see. */
export function letterPlainText(doc: ResumeDoc, letter: CoverLetter): string {
  const c = contactOf(doc);
  const head = [c?.fullName.trim() ?? "", contactLine(doc)].filter(Boolean);
  const body = renderBlocks(doc, letter).map((b) => b.lines.join("\n"));
  return [head.join("\n"), ...body].filter(Boolean).join("\n\n");
}

/** Placeholders and empty fields still in the visible text, for a "fix before sending" hint. */
export function unfilledFields(doc: ResumeDoc, letter: CoverLetter): string[] {
  const text = renderBlocks(doc, letter).flatMap((b) => b.lines).join("\n");
  const out: string[] = [];
  if (text.includes(FALLBACKS.company)) out.push("company");
  if (text.includes(FALLBACKS.role)) out.push("role");
  return out;
}

// --- block edits (pure, like ops.ts) ---

export function moveBlock(l: CoverLetter, from: number, to: number): CoverLetter {
  if (from === to || from < 0 || to < 0 || from >= l.blocks.length || to >= l.blocks.length) return l;
  const blocks = l.blocks.slice();
  const [b] = blocks.splice(from, 1);
  blocks.splice(to, 0, b);
  return { ...l, blocks };
}
export function patchBlock(l: CoverLetter, id: string, patch: Partial<Pick<CoverBlock, "text" | "visible" | "kind">>): CoverLetter {
  return { ...l, blocks: l.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) };
}
export function removeBlock(l: CoverLetter, id: string): CoverLetter {
  return { ...l, blocks: l.blocks.filter((b) => b.id !== id) };
}
export function insertBlock(l: CoverLetter, b: CoverBlock, index: number): CoverLetter {
  const i = Math.max(0, Math.min(l.blocks.length, index));
  return { ...l, blocks: [...l.blocks.slice(0, i), b, ...l.blocks.slice(i)] };
}
/** A new body paragraph, placed before the closing blocks. */
export function addBodyBlock(l: CoverLetter): CoverLetter {
  if (l.blocks.length >= MAX_BLOCKS) return l;
  const lastBody = l.blocks.map((b) => b.kind).lastIndexOf("body");
  const at = lastBody >= 0 ? lastBody + 1 : Math.max(0, l.blocks.length - 2);
  return insertBlock(l, block("body", ""), at);
}

// --- untrusted input ---

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Validate a stored or imported letter. Never throws; bad blocks are dropped, null when nothing usable. */
export function parseCoverLetter(raw: unknown): CoverLetter | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.version === "number" && r.version > COVER_VERSION) return null;
  if (!Array.isArray(r.blocks)) return null;
  const seen = new Set<string>();
  const blocks: CoverBlock[] = [];
  for (const b of r.blocks.slice(0, MAX_BLOCKS)) {
    if (typeof b !== "object" || b === null) continue;
    const x = b as Record<string, unknown>;
    if (!COVER_KINDS.includes(x.kind as CoverKind)) continue;
    let id = typeof x.id === "string" && x.id ? x.id.slice(0, 64) : newId("cb");
    if (seen.has(id)) id = newId("cb");
    seen.add(id);
    blocks.push({ id, kind: x.kind as CoverKind, text: str(x.text, MAX_BLOCK), visible: x.visible !== false });
  }
  return {
    version: COVER_VERSION,
    company: str(r.company, MAX_FIELD),
    role: str(r.role, MAX_FIELD),
    hiringManager: str(r.hiringManager, MAX_FIELD),
    blocks,
  };
}
