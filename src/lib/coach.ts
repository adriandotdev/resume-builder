import type { ResumeDoc } from "./schema";
import { normalize, stem, tokenize } from "./jobmatch";

export type CoachRule = "weak-opener" | "no-number" | "tense" | "repeated-verb" | "passive" | "filler";

/** One wording suggestion, pointing at the bullet it is about. There is no score. */
export interface CoachFinding {
  id: string;
  rule: CoachRule;
  level: "warn";
  message: string;
  sectionId: string;
  sectionTitle: string;
  itemId: string;
  itemLabel: string;
  bulletIndex: number;
  text: string;
}

export const RULE_LABEL: Record<CoachRule, string> = {
  "weak-opener": "Weak opener",
  "no-number": "No number",
  tense: "Tense",
  "repeated-verb": "Repeated verb",
  passive: "Passive",
  filler: "Filler",
};

const WEAK_OPENER = /^(responsible for|duties (?:included?|were)|tasked with|helped|help|worked (?:on|with)|work (?:on|with)|assisted|assist|involved in|participated in|in charge of|i|my|we)\b/;

const FILLER: [RegExp, string][] = [
  [/\bvarious\b/, "various"],
  [/\bnumerous\b/, "numerous"],
  [/\ba variety of\b/, "a variety of"],
  [/\ba number of\b/, "a number of"],
  [/\bin order to\b/, "in order to"],
  [/\bsuccessfully\b/, "successfully"],
  [/\bvery\b/, "very"],
  [/\breally\b/, "really"],
  [/\betc\b/, "etc."],
  [/\band so on\b/, "and so on"],
];

const QUANTITY = /\d|%|\$|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|hundred|thousand|million|billion|half|third|quarter|double|doubled|triple|tripled)\b/;

const IRREGULAR_PARTICIPLE = "known|given|made|done|seen|taken|written|built|led|run|held|chosen|shown|brought|sold|put|set|kept|found|paid";
const PASSIVE = new RegExp(`\\b(?:was|were|been|being|is|are)\\s+(?:\\w+ed|${IRREGULAR_PARTICIPLE})\\b`);
// Being on the receiving end of good news reads fine, so these are not flagged.
const PASSIVE_OK = /\b(?:promoted|selected|recognized|recognised|awarded|named|hired|certified|nominated|invited|accepted|ranked|trained)\b/;

// Common resume verbs: base form to simple past. A base form opening a bullet in a past role reads as present tense.
const PAST: Record<string, string> = {
  manage: "managed", lead: "led", build: "built", create: "created", develop: "developed",
  implement: "implemented", improve: "improved", reduce: "reduced", increase: "increased", launch: "launched",
  deliver: "delivered", analyze: "analyzed", analyse: "analysed", coordinate: "coordinated", train: "trained",
  write: "wrote", run: "ran", drive: "drove", organize: "organized", organise: "organised",
  maintain: "maintained", optimize: "optimized", optimise: "optimised", automate: "automated",
  negotiate: "negotiated", resolve: "resolved", mentor: "mentored",
  establish: "established", streamline: "streamlined", migrate: "migrated", ship: "shipped",
  oversee: "oversaw", prepare: "prepared", produce: "produced", reconcile: "reconciled", handle: "handled",
  perform: "performed", conduct: "conducted", collaborate: "collaborated",
  save: "saved", grow: "grew", generate: "generated", identify: "identified", define: "defined",
  initiate: "initiated", execute: "executed", evaluate: "evaluated", monitor: "monitored",
};

const NOT_VERBS = new Set(["a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "by", "at"]);

/** The first word of a bullet, lowercased, or "" when there is none. */
function opener(text: string): string {
  return tokenize(normalize(text))[0] ?? "";
}

/** The base verb behind a present-tense opener ("manage" or "manages"), or "". Past forms and nouns return "". */
function presentVerb(word: string): string {
  for (const base of [word, word.replace(/ies$/, "y"), word.replace(/es$/, ""), word.replace(/s$/, "")]) {
    if (PAST[base]) return base;
  }
  return "";
}

function cap(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

interface Source { sectionId: string; sectionTitle: string; itemId: string; itemLabel: string; bullets: string[]; past: boolean; numbers: boolean; tense: boolean }

function sources(doc: ResumeDoc): Source[] {
  const out: Source[] = [];
  for (const s of doc.sections) {
    if (!s.visible) continue;
    if (s.type === "experience") {
      s.content.items.forEach((i, n) => out.push({ sectionId: s.id, sectionTitle: s.title, itemId: i.id, itemLabel: i.role || i.org || `Experience ${n + 1}`, bullets: i.bullets, past: !i.current, numbers: true, tense: true }));
    } else if (s.type === "projects") {
      s.content.items.forEach((i, n) => out.push({ sectionId: s.id, sectionTitle: s.title, itemId: i.id, itemLabel: i.name || `Project ${n + 1}`, bullets: i.bullets, past: false, numbers: true, tense: false }));
    } else if (s.type === "education") {
      s.content.items.forEach((i, n) => out.push({ sectionId: s.id, sectionTitle: s.title, itemId: i.id, itemLabel: i.degree || i.school || `Education ${n + 1}`, bullets: i.details, past: false, numbers: false, tense: false }));
    }
  }
  return out;
}

/**
 * Wording suggestions for every bullet in a visible section. Rule-based, local and explainable:
 * each finding names the phrase it is about. Rules lean towards staying quiet over crying wolf.
 */
export function runCoach(doc: ResumeDoc): CoachFinding[] {
  const findings: CoachFinding[] = [];
  const docOpeners = new Map<string, number>();

  for (const src of sources(doc)) {
    const add = (rule: CoachRule, bulletIndex: number, message: string) =>
      findings.push({ id: `${rule}:${src.itemId}:${bulletIndex}`, rule, level: "warn", message, sectionId: src.sectionId, sectionTitle: src.sectionTitle, itemId: src.itemId, itemLabel: src.itemLabel, bulletIndex, text: src.bullets[bulletIndex].trim() });

    const itemOpeners = new Map<string, number>();
    const unquantified: number[] = [];
    let quantified = 0;
    let filled = 0;

    src.bullets.forEach((raw, idx) => {
      const text = raw.trim();
      if (!text) return;
      filled++;
      const norm = normalize(text);

      const weak = WEAK_OPENER.exec(norm);
      if (weak) add("weak-opener", idx, `Starts with “${cap(weak[1])}”. Consider opening with what you did, such as “Led”, “Built” or “Reduced”.`);

      const first = opener(text);
      if (src.tense && src.past && !weak) {
        const base = presentVerb(first);
        if (base) add("tense", idx, `“${cap(first)}” reads as present tense in a role you have left. Consider “${cap(PAST[base])}”.`);
      }

      if (PASSIVE.test(norm)) {
        const phrase = PASSIVE.exec(norm)![0];
        if (!PASSIVE_OK.test(phrase.split(/\s+/)[1] ?? "")) add("passive", idx, `“${phrase}” is passive. Consider saying who did what, starting with a verb like “Led” or “Built”.`);
      }

      const filler = FILLER.find(([re]) => re.test(norm));
      if (filler) add("filler", idx, `“${filler[1]}” adds length without adding detail. Consider cutting it or naming the specific thing.`);

      if (QUANTITY.test(norm)) quantified++; else unquantified.push(idx);

      if (first && !NOT_VERBS.has(first) && !weak) {
        const key = stem(first);
        const inItem = (itemOpeners.get(key) ?? 0) + 1;
        itemOpeners.set(key, inItem);
        const inDoc = (docOpeners.get(key) ?? 0) + 1;
        docOpeners.set(key, inDoc);
        if (inItem >= 2) add("repeated-verb", idx, `“${cap(first)}” already opens another bullet in this entry. Consider a different verb.`);
        else if (inDoc >= 3) add("repeated-verb", idx, `“${cap(first)}” opens ${inDoc} bullets across your resume. Consider varying the verb.`);
      }
    });

    // One nudge per entry at most two bullets, and only when most bullets carry no quantity at all.
    if (src.numbers && filled > 0 && quantified * 2 < filled) {
      for (const idx of unquantified.slice(0, 2)) add("no-number", idx, "No number in this bullet. Consider adding a count, a percentage, a time or a size.");
    }
  }
  return findings;
}
