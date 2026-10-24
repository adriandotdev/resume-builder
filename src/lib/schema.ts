/**
 * ResumeDoc: the single versioned JSON document that holds everything.
 * Includes defaults, a hand-written validator and migrations.
 */

export const CURRENT_VERSION = 1;

export const SECTION_TYPES = [
  "contact",
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "languages",
  "custom",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const FONTS = {
  sans: { label: "Sans (Arial / Helvetica)", stack: 'Arial, Helvetica, "Liberation Sans", sans-serif' },
  serif: { label: "Serif (Georgia / Times)", stack: 'Georgia, "Times New Roman", Times, serif' },
  verdana: { label: "Verdana / Tahoma", stack: 'Verdana, Tahoma, "DejaVu Sans", sans-serif' },
  trebuchet: { label: "Trebuchet", stack: '"Trebuchet MS", "Lucida Grande", Arial, sans-serif' },
  mono: { label: "Monospace (Courier)", stack: '"Courier New", Courier, monospace' },
} as const;
export type FontId = keyof typeof FONTS;

export const MARGINS = { narrow: 12, normal: 18, wide: 25 } as const; // mm
export type MarginId = keyof typeof MARGINS;
export const PAGE_SIZES = { a4: { label: "A4", w: 210, h: 297 }, letter: { label: "US Letter", w: 215.9, h: 279.4 } } as const;
export type PageSizeId = keyof typeof PAGE_SIZES;
export const DATE_FORMATS = ["MMM YYYY", "MM/YYYY", "YYYY"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];
export const TEMPLATE_IDS = ["classic", "modern", "compact", "elegant", "bold", "minimal", "executive", "academic", "technical", "graduate", "softline", "ledger"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface Style {
  template: TemplateId;
  accent: string; // #rrggbb
  font: FontId;
  fontSize: number; // pt, 9-12
  lineSpacing: number; // 1.0-1.5
  margins: MarginId;
  pageSize: PageSizeId;
  dateFormat: DateFormat;
}

export interface ContactData {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
}
export interface ExperienceItem { id: string; role: string; org: string; location: string; start: string; end: string; current: boolean; bullets: string[] }
export interface EducationItem { id: string; degree: string; school: string; location: string; start: string; end: string; details: string[] }
export interface SkillGroup { id: string; label: string; skills: string }
export interface ProjectItem { id: string; name: string; link: string; start: string; end: string; bullets: string[] }
export interface CertItem { id: string; name: string; issuer: string; date: string }
export interface LanguageItem { id: string; name: string; level: string }
export interface CustomItem { id: string; text: string }

interface Base<T extends SectionType, C> { id: string; type: T; title: string; visible: boolean; content: C }
export type ContactSection = Base<"contact", ContactData>;
export type SummarySection = Base<"summary", { text: string }>;
export type ExperienceSection = Base<"experience", { items: ExperienceItem[] }>;
export type EducationSection = Base<"education", { items: EducationItem[] }>;
export type SkillsSection = Base<"skills", { items: SkillGroup[] }>;
export type ProjectsSection = Base<"projects", { items: ProjectItem[] }>;
export type CertificationsSection = Base<"certifications", { items: CertItem[] }>;
export type LanguagesSection = Base<"languages", { items: LanguageItem[] }>;
export type CustomSection = Base<"custom", { items: CustomItem[] }>;
export type Section =
  | ContactSection | SummarySection | ExperienceSection | EducationSection | SkillsSection
  | ProjectsSection | CertificationsSection | LanguagesSection | CustomSection;

export interface ResumeDoc { version: number; style: Style; sections: Section[] }

export const STANDARD_TITLES: Record<SectionType, string> = {
  contact: "Contact",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  languages: "Languages",
  custom: "Additional Information",
};

let counter = 0;
export function newId(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const DEFAULT_STYLE: Style = {
  template: "classic",
  accent: "#1f4e79",
  font: "sans",
  fontSize: 10.5,
  lineSpacing: 1.25,
  margins: "normal",
  pageSize: "a4",
  dateFormat: "MMM YYYY",
};

export function emptyContent(type: SectionType): Section["content"] {
  switch (type) {
    case "contact": return { fullName: "", headline: "", email: "", phone: "", location: "", links: [] };
    case "summary": return { text: "" };
    default: return { items: [] };
  }
}

export function createSection(type: SectionType, title?: string): Section {
  return { id: newId("sec"), type, title: title ?? STANDARD_TITLES[type], visible: true, content: emptyContent(type) } as Section;
}

export function createEmptyItem(type: SectionType): unknown {
  switch (type) {
    case "experience": return { id: newId("it"), role: "", org: "", location: "", start: "", end: "", current: false, bullets: [] } satisfies ExperienceItem;
    case "education": return { id: newId("it"), degree: "", school: "", location: "", start: "", end: "", details: [] } satisfies EducationItem;
    case "skills": return { id: newId("it"), label: "", skills: "" } satisfies SkillGroup;
    case "projects": return { id: newId("it"), name: "", link: "", start: "", end: "", bullets: [] } satisfies ProjectItem;
    case "certifications": return { id: newId("it"), name: "", issuer: "", date: "" } satisfies CertItem;
    case "languages": return { id: newId("it"), name: "", level: "" } satisfies LanguageItem;
    case "custom": return { id: newId("it"), text: "" } satisfies CustomItem;
    default: return undefined;
  }
}

/** A blank starter document: all standard sections, empty. */
export function createDefaultDoc(): ResumeDoc {
  return {
    version: CURRENT_VERSION,
    style: { ...DEFAULT_STYLE },
    sections: SECTION_TYPES.filter((t) => t !== "custom").map((t) => createSection(t)),
  };
}

/* ------------------------------ validation ------------------------------ */

export type ParseResult = { ok: true; doc: ResumeDoc; migratedFrom?: number } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_STR = 20000;

/** Migrate older versions up to CURRENT_VERSION. Returns null if version is unsupported. */
export function migrate(raw: unknown): { data: unknown; from: number } | null {
  if (!isObj(raw)) return null;
  const v = raw.version === undefined ? 0 : raw.version;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > CURRENT_VERSION) return null;
  let data: Record<string, unknown> = { ...raw };
  for (let cur = v; cur < CURRENT_VERSION; cur++) {
    if (cur === 0) {
      // v0 (unversioned prototype): flat style fields on the root, sections used `enabled` and `items`.
      const style = isObj(data.style) ? { ...data.style } : {};
      if (typeof data.accentColor === "string") style.accent = data.accentColor;
      if (typeof data.template === "string") style.template = data.template;
      if (typeof data.paper === "string") style.pageSize = data.paper;
      const sections = Array.isArray(data.sections)
        ? data.sections.map((s) => {
            if (!isObj(s)) return s;
            const n: Record<string, unknown> = { ...s };
            if (n.visible === undefined && typeof n.enabled === "boolean") n.visible = n.enabled;
            delete n.enabled;
            return n;
          })
        : data.sections;
      data = { version: 1, style, sections };
    }
  }
  return { data, from: v };
}

function str(v: unknown, path: string, errors: string[], fallback = ""): string {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "string") { errors.push(`${path} must be a string`); return fallback; }
  if (v.length > MAX_STR) { errors.push(`${path} is too long`); return v.slice(0, MAX_STR); }
  return v;
}
function strArr(v: unknown, path: string, errors: string[]): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) { errors.push(`${path} must be an array`); return []; }
  return v.map((x, i) => str(x, `${path}[${i}]`, errors));
}
function items<T>(v: unknown, path: string, errors: string[], f: (o: Record<string, unknown>, p: string) => T): T[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) { errors.push(`${path} must be an array`); return []; }
  const out: T[] = [];
  v.forEach((o, i) => {
    if (!isObj(o)) { errors.push(`${path}[${i}] must be an object`); return; }
    out.push(f(o, `${path}[${i}]`));
  });
  return out;
}
const idOf = (o: Record<string, unknown>) => (typeof o.id === "string" && o.id ? o.id : newId("it"));

function parseContent(type: SectionType, c: unknown, p: string, e: string[]): Section["content"] {
  const o = isObj(c) ? c : {};
  if (c !== undefined && !isObj(c)) e.push(`${p} must be an object`);
  switch (type) {
    case "contact":
      return { fullName: str(o.fullName, `${p}.fullName`, e), headline: str(o.headline, `${p}.headline`, e), email: str(o.email, `${p}.email`, e), phone: str(o.phone, `${p}.phone`, e), location: str(o.location, `${p}.location`, e), links: strArr(o.links, `${p}.links`, e) };
    case "summary":
      return { text: str(o.text, `${p}.text`, e) };
    case "experience":
      return { items: items(o.items, `${p}.items`, e, (x, q) => ({ id: idOf(x), role: str(x.role, `${q}.role`, e), org: str(x.org, `${q}.org`, e), location: str(x.location, `${q}.location`, e), start: str(x.start, `${q}.start`, e), end: str(x.end, `${q}.end`, e), current: x.current === true, bullets: strArr(x.bullets, `${q}.bullets`, e) })) };
    case "education":
      return { items: items(o.items, `${p}.items`, e, (x, q) => ({ id: idOf(x), degree: str(x.degree, `${q}.degree`, e), school: str(x.school, `${q}.school`, e), location: str(x.location, `${q}.location`, e), start: str(x.start, `${q}.start`, e), end: str(x.end, `${q}.end`, e), details: strArr(x.details, `${q}.details`, e) })) };
    case "skills":
      return { items: items(o.items, `${p}.items`, e, (x, q) => ({ id: idOf(x), label: str(x.label, `${q}.label`, e), skills: str(x.skills, `${q}.skills`, e) })) };
    case "projects":
      return { items: items(o.items, `${p}.items`, e, (x, q) => ({ id: idOf(x), name: str(x.name, `${q}.name`, e), link: str(x.link, `${q}.link`, e), start: str(x.start, `${q}.start`, e), end: str(x.end, `${q}.end`, e), bullets: strArr(x.bullets, `${q}.bullets`, e) })) };
    case "certifications":
      return { items: items(o.items, `${p}.items`, e, (x, q) => ({ id: idOf(x), name: str(x.name, `${q}.name`, e), issuer: str(x.issuer, `${q}.issuer`, e), date: str(x.date, `${q}.date`, e) })) };
    case "languages":
      return { items: items(o.items, `${p}.items`, e, (x, q) => ({ id: idOf(x), name: str(x.name, `${q}.name`, e), level: str(x.level, `${q}.level`, e) })) };
    case "custom":
      return { items: items(o.items, `${p}.items`, e, (x, q) => ({ id: idOf(x), text: str(x.text, `${q}.text`, e) })) };
  }
}

function pick<T extends string>(v: unknown, allowed: readonly T[], path: string, errors: string[], fallback: T): T {
  if (v === undefined) return fallback;
  if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as T;
  errors.push(`${path} must be one of: ${allowed.join(", ")}`);
  return fallback;
}
function num(v: unknown, min: number, max: number, path: string, errors: string[], fallback: number): number {
  if (v === undefined) return fallback;
  if (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max) return v;
  errors.push(`${path} must be a number between ${min} and ${max}`);
  return fallback;
}

/**
 * Validate (and migrate) untrusted data. Returns a fully-normalised doc or a list of errors.
 * Strict: any invalid field makes the whole import fail, so a bad file never half-applies.
 */
export function parseResumeDoc(raw: unknown): ParseResult {
  if (!isObj(raw)) return { ok: false, errors: ["Document must be a JSON object"] };
  if (raw.version !== undefined && typeof raw.version === "number" && raw.version > CURRENT_VERSION) {
    return { ok: false, errors: [`Document version ${raw.version} is newer than supported version ${CURRENT_VERSION}`] };
  }
  const m = migrate(raw);
  if (!m) return { ok: false, errors: ["Unsupported or invalid document version"] };
  const d = m.data as Record<string, unknown>;
  const errors: string[] = [];

  const s = isObj(d.style) ? d.style : {};
  if (d.style !== undefined && !isObj(d.style)) errors.push("style must be an object");
  let accent = DEFAULT_STYLE.accent;
  if (s.accent !== undefined) {
    if (typeof s.accent === "string" && HEX.test(s.accent)) accent = s.accent.toLowerCase();
    else errors.push("style.accent must be a #rrggbb hex color");
  }
  const style: Style = {
    template: pick(s.template, TEMPLATE_IDS, "style.template", errors, DEFAULT_STYLE.template),
    accent,
    font: pick(s.font, Object.keys(FONTS) as FontId[], "style.font", errors, DEFAULT_STYLE.font),
    fontSize: num(s.fontSize, 8, 14, "style.fontSize", errors, DEFAULT_STYLE.fontSize),
    lineSpacing: num(s.lineSpacing, 1, 2, "style.lineSpacing", errors, DEFAULT_STYLE.lineSpacing),
    margins: pick(s.margins, Object.keys(MARGINS) as MarginId[], "style.margins", errors, DEFAULT_STYLE.margins),
    pageSize: pick(s.pageSize, Object.keys(PAGE_SIZES) as PageSizeId[], "style.pageSize", errors, DEFAULT_STYLE.pageSize),
    dateFormat: pick(s.dateFormat, DATE_FORMATS, "style.dateFormat", errors, DEFAULT_STYLE.dateFormat),
  };

  if (!Array.isArray(d.sections)) {
    errors.push("sections must be an array");
    return { ok: false, errors };
  }
  if (d.sections.length > 60) errors.push("too many sections (max 60)");
  const seen = new Set<string>();
  const sections: Section[] = [];
  d.sections.forEach((sec, i) => {
    const p = `sections[${i}]`;
    if (!isObj(sec)) { errors.push(`${p} must be an object`); return; }
    if (typeof sec.type !== "string" || !(SECTION_TYPES as readonly string[]).includes(sec.type)) {
      errors.push(`${p}.type must be one of: ${SECTION_TYPES.join(", ")}`);
      return;
    }
    const type = sec.type as SectionType;
    let id = typeof sec.id === "string" && sec.id ? sec.id : newId("sec");
    if (seen.has(id)) id = newId("sec");
    seen.add(id);
    if (sec.visible !== undefined && typeof sec.visible !== "boolean") errors.push(`${p}.visible must be a boolean`);
    sections.push({
      id, type,
      title: str(sec.title, `${p}.title`, errors, STANDARD_TITLES[type]) || STANDARD_TITLES[type],
      visible: sec.visible !== false,
      content: parseContent(type, sec.content, `${p}.content`, errors),
    } as Section);
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, doc: { version: CURRENT_VERSION, style, sections }, migratedFrom: m.from !== CURRENT_VERSION ? m.from : undefined };
}

/* ------------------------------ formatting ------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Stored dates are "YYYY-MM" or "YYYY" (or free text, passed through). */
export function formatDate(value: string, fmt: DateFormat): string {
  const v = value.trim();
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(v);
  if (!m) return v;
  const year = m[1];
  const mon = m[2] ? Number(m[2]) : 0;
  if (fmt === "YYYY" || !mon || mon < 1 || mon > 12) return year;
  if (fmt === "MM/YYYY") return `${String(mon).padStart(2, "0")}/${year}`;
  return `${MONTHS[mon - 1]} ${year}`;
}

export function formatRange(start: string, end: string, current: boolean, fmt: DateFormat): string {
  const s = formatDate(start, fmt);
  const e = current ? "Present" : formatDate(end, fmt);
  if (s && e) return `${s} – ${e}`;
  return s || e;
}
