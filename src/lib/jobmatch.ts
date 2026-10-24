import { sectionPlainText } from "./plaintext";
import { STANDARD_TITLES, type ResumeDoc } from "./schema";

/** Longest posting the matcher reads. Anything past this is ignored. */
export const MAX_JD_CHARS = 20_000;
const MAX_TERMS = 25;
const MAX_PHRASE_WORDS = 3;

export interface JobTerm { term: string; key: string; weight: number }
export interface TermMatch { term: string; found: boolean; where: string[]; hiddenOnly: boolean }

const ENGLISH_STOPWORDS = `a an the and or but if of to in on at by for with from as is are was were be been being have has had do does did
will would can could should may might must shall this that these those it its we our you your they their them he she his her who whom which what
when where why how not no nor so than then too very just also such into over under about across per via within without between among through
during before after above below up down out off again further once here there all any both each few more most other some own same only e.g i.e
etc us i me my well new get make use using used like join looking seeking candidate ideal opportunity company work working works help helping
ensure ensuring provide providing able need needs needed will want etc youll youre youve weve theyre dont doesnt cant wont isnt arent thats`.split(/\s+/);

/** Words that fill every job posting without naming a skill. */
const POSTING_FILLER = `experience experienced years year team teams strong ability responsibilities responsibility requirements requirement required
requires require benefits including include includes environment fast-paced skills skill knowledge understanding proven track record excellent good
great solid preferred plus nice bonus qualifications qualification minimum relevant related equivalent demonstrated passion passionate motivated
self-starter eager successful effectively effective responsible duties key various multiple variety wide range highly based level apply applicants
applicant equal employer salary days day full home hybrid onsite on-site setup set-up location shift contract mid schedule remote
renewal subject advantage best practices least basic compensation competitive overview description job title department role position self-motivated detail-oriented
ability abilities proficiency proficient familiarity familiar working capable candidate candidates seeking expert expertise comfortable hands-on
build builds building built maintain maintains offer offers analyze`.split(/\s+/);

/** Stopwords allowed inside a phrase ("quality of service") but never at its edges. */
const INNER_WORDS = new Set(["of", "to", "as"]);
const SINGLE_LETTER_TERMS = new Set(["c", "r"]);

const REQUIREMENT_LINE = /\b(required|requirements?|must|proficien\w*|mandatory|essential|minimum|expertise|expert)\b/;
const BULLET_LINE = /^\s*[-*•·▪◦]\s/;
const REQUIREMENT_HEADING = /\b(requirements?|qualifications?|must[- ]haves?|what youll need|what you bring|you have)\b/;
// "Label: value" lines that describe the job's logistics, not its skills.
const LOGISTICS_LINE = /^\W*(work set-?up|work schedule|work arrangement|schedule|shift|location|employment type|job type|salary|pay|compensation|contract|start date)\b[^:]*:/;
const OTHER_HEADING = /^(benefits|perks|about|what we offer|why join|compensation|salary|the role|responsibilities|our (?:team|company|mission))\b/;

/** NFKC, lowercase, curly quotes and every dash unified, apostrophes inside words dropped. */
export function normalize(text: string): string {
  return fold(text).toLowerCase();
}

/** Like normalize, but keeps the case, so a term can be shown the way the posting wrote it. */
function fold(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’‛′`´]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/(\p{L})'(\p{L})/gu, "$1$2");
}

// Keeps c++, c#, .net, node.js, ci/cd, a/b and hyphenated words whole.
const TOKEN = /\.net\b|[\p{L}\p{N}]+(?:[./-][\p{L}\p{N}]+)*(?:\+\+|#|\+)?/giu;
// Places a phrase must not span: punctuation, bullets and a dash standing alone.
const BREAK = /[\n\r\t,;:()[\]{}!?|•·▪◦"*]+|\.(?=\s|$)|(?:^|\s)-+(?=\s|$)/g;

export function tokenize(text: string): string[] {
  return text.match(TOKEN) ?? [];
}

const RULES: [string, string][] = [["ment", ""], ["ion", ""], ["ing", ""], ["ed", ""], ["ies", "y"], ["es", ""], ["s", ""]];

/** Light suffix trimming. Words with symbols or of 4 characters or fewer are left alone. */
export function stem(token: string): string {
  if (token.length <= 4 || !/^\p{L}+$/u.test(token)) return token;
  let s = token;
  for (const [suffix, repl] of RULES) {
    if (!s.endsWith(suffix) || (suffix === "s" && s.endsWith("ss"))) continue;
    const next = s.slice(0, -suffix.length) + repl;
    if (next.length < 4) continue;
    s = next;
    break;
  }
  return s.length > 4 && s.endsWith("e") ? s.slice(0, -1) : s;
}

const STOP = new Set([...ENGLISH_STOPWORDS, ...POSTING_FILLER]);
const STOP_STEMS = new Set([...STOP].map(stem));
const isNumber = (t: string) => /^\d[\d.,]*\+?$/.test(t);
const isStop = (t: string) => STOP.has(t) || STOP_STEMS.has(stem(t)) || isNumber(t) || (t.length === 1 && !SINGLE_LETTER_TERMS.has(t));

function segments(text: string): string[][] {
  return normalize(text).split(BREAK).map(tokenize).filter((t) => t.length > 0);
}

function contains(hay: string[], needle: string[]): boolean {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

interface Candidate { forms: Map<string, number>; stems: string[]; n: number; count: number; weight: number; first: number }

/** The spelling used most often in the posting; the first one seen wins a tie. */
function displayForm(forms: Map<string, number>): string {
  let best = "";
  let max = 0;
  for (const [form, n] of forms) if (n > max) { best = form; max = n; }
  return best;
}

/** Key terms of a job posting, most important first. */
export function extractTerms(jd: string): JobTerm[] {
  const raw = fold(jd.slice(0, MAX_JD_CHARS));
  const rawLines = raw.split("\n");
  const lines = raw.toLowerCase().split("\n");
  const cands = new Map<string, Candidate>();
  let pos = 0;
  let inRequirements = false;
  let sawContent = false; // since the last heading, so a blank line right after one does not end its block
  for (const [li, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed) { if (sawContent) inRequirements = false; continue; }
    if (LOGISTICS_LINE.test(trimmed)) continue;
    const head = trimmed.replace(/^[^\p{L}]+/u, "");
    if (trimmed.split(/\s+/).length <= 6 && !/[.;]$/.test(trimmed) && (REQUIREMENT_HEADING.test(head) || OTHER_HEADING.test(head))) {
      inRequirements = REQUIREMENT_HEADING.test(head);
      sawContent = false;
    } else sawContent = true;
    const w = 1 + (inRequirements || REQUIREMENT_LINE.test(line) ? 1 : 0) + (BULLET_LINE.test(line) ? 0.5 : 0);
    for (const rawSeg of rawLines[li].split(BREAK).map(tokenize)) {
      const seg = rawSeg.map((x) => x.toLowerCase());
      const stop = seg.map(isStop);
      for (let n = 1; n <= MAX_PHRASE_WORDS; n++) {
        for (let i = 0; i + n <= seg.length; i++) {
          if (stop[i] || stop[i + n - 1]) continue;
          let ok = true;
          for (let j = i + 1; j < i + n - 1; j++) if (stop[j] && !INNER_WORDS.has(seg[j])) { ok = false; break; }
          if (!ok) continue;
          const words = seg.slice(i, i + n);
          const stems = words.map(stem);
          const key = stems.join(" ");
          const form = rawSeg.slice(i, i + n).join(" ");
          const c = cands.get(key);
          if (c) { c.count++; c.weight += w; c.forms.set(form, (c.forms.get(form) ?? 0) + 1); }
          else cands.set(key, { forms: new Map([[form, 1]]), stems, n, count: 1, weight: w, first: pos + i });
        }
      }
      pos += seg.length;
    }
  }

  // Longest phrases first. A phrase seen only once in plain prose is probably not a term, so it
  // must reach weight 2. A shorter candidate is dropped when longer kept phrases account for
  // every one of its occurrences.
  const kept: Candidate[] = [];
  const all = [...cands.values()];
  for (let n = MAX_PHRASE_WORDS; n >= 1; n--) {
    for (const c of all) {
      if (c.n !== n || (n > 1 && c.weight < 2)) continue;
      // Phrases nested in each other share occurrences, so only the shortest ones are summed.
      const supers = kept.filter((k) => k.n > n && contains(k.stems, c.stems));
      const covered = supers.reduce((sum, k) => (supers.some((o) => o.n < k.n && contains(k.stems, o.stems)) ? sum : sum + k.count), 0);
      if (covered >= c.count) continue;
      kept.push(c);
    }
  }
  return kept
    .sort((a, b) => b.weight - a.weight || b.n - a.n || a.first - b.first)
    .slice(0, MAX_TERMS)
    .map((c) => ({ term: displayForm(c.forms), key: c.stems.join(" "), weight: c.weight }));
}

/** Which key terms of the posting appear in the resume, and in which sections. */
export function matchJobDescription(doc: ResumeDoc, jd: string): { terms: TermMatch[] } {
  const f = doc.style.dateFormat;
  const sections = doc.sections.map((s) => {
    let text = sectionPlainText(s, f);
    if (s.type !== "contact") text = text.split("\n").slice(1).join("\n"); // heading line
    return { title: s.title.trim() || STANDARD_TITLES[s.type], visible: s.visible, segs: segments(text).map((t) => t.map(stem)) };
  });
  const terms = extractTerms(jd).map(({ term, key }): TermMatch => {
    const needle = key.split(" ");
    const where: string[] = [];
    let hidden = false;
    for (const s of sections) {
      if (!s.segs.some((seg) => contains(seg, needle))) continue;
      if (s.visible) { if (!where.includes(s.title)) where.push(s.title); }
      else hidden = true;
    }
    return { term, found: where.length > 0, where, hiddenOnly: where.length === 0 && hidden };
  });
  return { terms };
}
