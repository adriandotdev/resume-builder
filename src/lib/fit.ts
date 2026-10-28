import { MARGINS, type MarginId, type ResumeDoc, type Style } from "./schema";

export const PX_PER_MM = 96 / 25.4;

/** Slider ranges for the Design controls, shared with the fit assistant. */
export const FONT_SIZE_RANGE = { min: 9, max: 12, step: 0.5 } as const;
export const LINE_SPACING_RANGE = { min: 1, max: 1.5, step: 0.05 } as const;

/** The assistant never goes below these, even though the sliders can. Smaller text or tighter lines get hard to read. */
export const FIT_FONT_FLOOR = 9.5;
export const FIT_LINE_FLOOR = 1.1;

/** Pages the sheet spans, from its rendered height. All values in px. */
export function pagesFor(sheetH: number, pageH: number, marginPx: number): number {
  if (!sheetH) return 1;
  return Math.max(1, Math.ceil((sheetH - 2 * marginPx - 2) / (pageH - 2 * marginPx)));
}

/** About how many lines of text spill past the first page. 0 when it fits. The margins cancel out: content height minus one page of content area. */
export function overflowLines(sheetH: number, pageH: number, style: Pick<Style, "fontSize" | "lineSpacing">): number {
  const over = sheetH - 2 - pageH;
  if (over <= 0) return 0;
  const linePx = style.fontSize * (96 / 72) * style.lineSpacing;
  return Math.ceil(over / linePx);
}

export type FitPatch = Partial<Pick<Style, "fontSize" | "lineSpacing" | "margins">>;
export interface FitCandidate { patch: FitPatch; cost: number }

const MARGIN_ORDER: MarginId[] = ["wide", "normal", "narrow"]; // widest to tightest

const round = (n: number, step: number) => Math.round(n / step) * step;

/**
 * Style changes that only ever make the page tighter, smallest visible change first.
 * Each line-spacing step costs 1, a margin step 2 and a half-point of font size 3, so the cheapest
 * way to gain room comes first. Values already past a floor are left alone, never raised.
 */
export function fitCandidates(style: Pick<Style, "fontSize" | "lineSpacing" | "margins">): FitCandidate[] {
  const lineSteps: number[] = [];
  for (let v = round(style.lineSpacing, 0.05); v >= FIT_LINE_FLOOR - 1e-9; v = round(v - LINE_SPACING_RANGE.step, 0.05)) lineSteps.push(Number(v.toFixed(2)));
  if (!lineSteps.length) lineSteps.push(style.lineSpacing);
  const fontSteps: number[] = [];
  for (let v = style.fontSize; v >= FIT_FONT_FLOOR - 1e-9; v -= FONT_SIZE_RANGE.step) fontSteps.push(v);
  if (!fontSteps.length) fontSteps.push(style.fontSize);
  const marginSteps = MARGIN_ORDER.slice(MARGIN_ORDER.indexOf(style.margins));

  const out: FitCandidate[] = [];
  lineSteps.forEach((ls, a) => marginSteps.forEach((m, b) => fontSteps.forEach((fs, c) => {
    if (a === 0 && b === 0 && c === 0) return; // the current style is not a change
    const patch: FitPatch = {};
    if (a > 0) patch.lineSpacing = ls;
    if (b > 0) patch.margins = m;
    if (c > 0) patch.fontSize = fs;
    out.push({ patch, cost: a + 2 * b + 3 * c });
  })));
  // Stable sort: ties keep the generated order, which tries line spacing before margins before font size.
  return out.sort((x, y) => x.cost - y.cost);
}

export interface FitResult { patch: FitPatch; pages: number }

/**
 * The first candidate whose measured page count is 1, or null when none fits. `measure` is injected so this stays pure.
 * Every candidate only tightens, so the tightest one (the last, sorted by cost) is measured first:
 * if even that spills over, none of the rest can fit and the search stops after one layout.
 */
export function pickFit(candidates: FitCandidate[], measure: (patch: FitPatch) => number): FitResult | null {
  if (!candidates.length) return null;
  const tightest = candidates.reduce((a, b) => (b.cost > a.cost ? b : a));
  if (measure(tightest.patch) > 1) return null;
  for (const c of candidates) {
    const pages = measure(c.patch);
    if (pages <= 1) return { patch: c.patch, pages };
  }
  return null;
}

const marginLabel = (id: MarginId) => `${id[0].toUpperCase()}${id.slice(1)}`; // same labels as the Design panel

/** "Line spacing 1.25 → 1.15", for the Apply button and the confirmation toast. */
export function describePatch(style: Pick<Style, "fontSize" | "lineSpacing" | "margins">, patch: FitPatch): string[] {
  const out: string[] = [];
  if (patch.lineSpacing !== undefined) out.push(`Line spacing ${style.lineSpacing.toFixed(2)} → ${patch.lineSpacing.toFixed(2)}`);
  if (patch.margins !== undefined) out.push(`Margins ${marginLabel(style.margins)} (${MARGINS[style.margins]} mm) → ${marginLabel(patch.margins)} (${MARGINS[patch.margins]} mm)`);
  if (patch.fontSize !== undefined) out.push(`Font size ${style.fontSize} pt → ${patch.fontSize} pt`);
  return out;
}

/** Only the style fields the patch touches, as they are now, so Undo restores exactly those. */
export function currentFor(style: Style, patch: FitPatch): FitPatch {
  const out: FitPatch = {};
  if (patch.lineSpacing !== undefined) out.lineSpacing = style.lineSpacing;
  if (patch.margins !== undefined) out.margins = style.margins;
  if (patch.fontSize !== undefined) out.fontSize = style.fontSize;
  return out;
}

/* ------------------------------ trim candidates ------------------------------ */

export type TrimKind = "bullet" | "detail" | "section";

/** Something the person could cut, ranked best-first. Listed only, never removed automatically. */
export interface TrimCandidate {
  id: string;
  kind: TrimKind;
  reason: string;
  sectionId: string;
  sectionTitle: string;
  itemId?: string;
  itemLabel?: string;
  bulletIndex?: number;
  text?: string;
}

const MAX_TRIMS = 8;
const KEEP_RECENT_BULLETS = 4; // the most recent role keeps its bullets
const KEEP_OLDER_BULLETS = 3;
const KEEP_PROJECT_BULLETS = 2;
const OPTIONAL_SECTIONS = ["projects", "certifications", "languages", "custom"] as const;

/**
 * Where to cut if style changes alone cannot reach one page. Order of suggestion:
 * trailing bullets of older roles, education details, project bullets, then whole optional sections.
 * Blank bullets are skipped: they are not drawn, so cutting them frees nothing.
 */
export function trimCandidates(doc: ResumeDoc): TrimCandidate[] {
  const bullets: TrimCandidate[] = [];
  const details: TrimCandidate[] = [];
  const projects: TrimCandidate[] = [];
  const sections: TrimCandidate[] = [];

  for (const s of doc.sections) {
    if (!s.visible) continue;
    if (s.type === "experience") {
      // Items run most recent first, so the later ones are older. Walk oldest first, last bullet first.
      for (let i = s.content.items.length - 1; i >= 0; i--) {
        const it = s.content.items[i];
        const keep = i === 0 ? KEEP_RECENT_BULLETS : KEEP_OLDER_BULLETS;
        const label = [it.role, it.org].filter((x) => x.trim()).join(" at ") || "Untitled role";
        const filled = it.bullets.map((text, bulletIndex) => ({ text, bulletIndex })).filter((b) => b.text.trim());
        for (let k = filled.length - 1; k >= keep; k--) {
          bullets.push({ id: `${s.id}:${it.id}:${filled[k].bulletIndex}`, kind: "bullet", reason: i === 0 ? `Bullet ${k + 1} of your most recent role` : `Bullet ${k + 1} of an older role`, sectionId: s.id, sectionTitle: s.title, itemId: it.id, itemLabel: label, bulletIndex: filled[k].bulletIndex, text: filled[k].text });
        }
      }
    } else if (s.type === "education") {
      for (const it of s.content.items) {
        const label = [it.degree, it.school].filter((x) => x.trim()).join(", ") || "Untitled education";
        it.details.forEach((text, bulletIndex) => {
          if (text.trim()) details.push({ id: `${s.id}:${it.id}:${bulletIndex}`, kind: "detail", reason: "Education detail", sectionId: s.id, sectionTitle: s.title, itemId: it.id, itemLabel: label, bulletIndex, text });
        });
      }
    } else if (s.type === "projects") {
      for (const it of s.content.items) {
        const filled = it.bullets.map((text, bulletIndex) => ({ text, bulletIndex })).filter((b) => b.text.trim());
        for (let k = filled.length - 1; k >= KEEP_PROJECT_BULLETS; k--) {
          projects.push({ id: `${s.id}:${it.id}:${filled[k].bulletIndex}`, kind: "bullet", reason: `Bullet ${k + 1} of a project`, sectionId: s.id, sectionTitle: s.title, itemId: it.id, itemLabel: it.name.trim() || "Untitled project", bulletIndex: filled[k].bulletIndex, text: filled[k].text });
        }
      }
    }
    const optional = (OPTIONAL_SECTIONS as readonly string[]).includes(s.type);
    const hasContent = "items" in s.content && s.content.items.length > 0;
    if (optional && hasContent) sections.push({ id: s.id, kind: "section", reason: "Hide the whole section with its switch, or remove entries", sectionId: s.id, sectionTitle: s.title });
  }
  return [...bullets, ...details, ...projects, ...sections].slice(0, MAX_TRIMS);
}


/**
 * The doc as it would be with these trims made: bullets and details removed, whole sections hidden.
 * Used only to measure whether the suggested cuts are enough; the real doc is never changed.
 */
export function withoutTrims(doc: ResumeDoc, trims: TrimCandidate[]): ResumeDoc {
  const cut = new Set(trims.filter((t) => t.kind !== "section").map((t) => `${t.sectionId}:${t.itemId}:${t.bulletIndex}`));
  const hide = new Set(trims.filter((t) => t.kind === "section").map((t) => t.sectionId));
  return {
    ...doc,
    sections: doc.sections.map((sec) => {
      if (hide.has(sec.id)) return { ...sec, visible: false };
      if (sec.type === "experience") return { ...sec, content: { ...sec.content, items: sec.content.items.map((it) => ({ ...it, bullets: it.bullets.filter((_, i) => !cut.has(`${sec.id}:${it.id}:${i}`)) })) } };
      if (sec.type === "education") return { ...sec, content: { ...sec.content, items: sec.content.items.map((it) => ({ ...it, details: it.details.filter((_, i) => !cut.has(`${sec.id}:${it.id}:${i}`)) })) } };
      if (sec.type === "projects") return { ...sec, content: { ...sec.content, items: sec.content.items.map((it) => ({ ...it, bullets: it.bullets.filter((_, i) => !cut.has(`${sec.id}:${it.id}:${i}`)) })) } };
      return sec;
    }),
  };
}

/** How many of the best-first trims it takes to reach one page, or null when even all of them are not enough. `pagesOf` is injected so this stays pure. */
export function trimsNeeded(doc: ResumeDoc, trims: TrimCandidate[], pagesOf: (d: ResumeDoc) => number): number | null {
  if (!trims.length || pagesOf(withoutTrims(doc, trims)) > 1) return null;
  for (let k = 1; k < trims.length; k++) if (pagesOf(withoutTrims(doc, trims.slice(0, k))) <= 1) return k;
  return trims.length;
}
