"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from "motion/react";
import { EASE } from "@/lib/motion";
import { createSampleDoc } from "@/lib/sample";
import type { AtsCheck } from "@/lib/ats";
import type { TemplateId } from "@/lib/schema";
import { GROUPS } from "./featureData";
import { IconAlert, IconTick, IconWarn } from "./icons";
import { Thumbnail } from "./Thumbnail";

const N = GROUPS.length;
const T = { duration: 0.4, ease: EASE };
const TEMPLATES: { id: TemplateId; name: string }[] = [
  { id: "classic", name: "Classic" }, { id: "elegant", name: "Elegant" }, { id: "modern", name: "Modern" }, { id: "compact", name: "Compact" },
];
const TERMS = ["SQL", "Forecasting", "Dashboards", "Root-cause analysis", "Stakeholder reporting", "Looker"];
const POSTING: (string | { t: number })[] = [
  "We need an operations analyst to own weekly reporting. You will write ", { t: 0 }, ", build ", { t: 2 }, " in ", { t: 5 },
  ", run ", { t: 1 }, " for each depot, lead ", { t: 3 }, " on late deliveries and deliver ", { t: 4 }, " to the regional managers.",
];
type Doc = ReturnType<typeof createSampleDoc>;

/** Rewrites the sample for another role: new headline, summary and skills, the rest untouched. */
const rewrite = (headline: string, summary: string, analysis: string, tools: string) => (d: Doc): Doc => ({
  ...d,
  sections: d.sections.map((sec) =>
    sec.type === "contact" ? { ...sec, content: { ...sec.content, headline } }
    : sec.type === "summary" ? { ...sec, content: { text: summary } }
    : sec.type === "skills" ? { ...sec, content: { items: sec.content.items.map((it) => it.id === "k1" ? { ...it, skills: analysis } : it.id === "k2" ? { ...it, skills: tools } : it) } }
    : sec),
});

const ROLES: { name: string; tpl: TemplateId; edit?: (d: Doc) => Doc; changed: string }[] = [
  { name: "Operations", tpl: "classic", changed: "The version you started with." },
  { name: "Analytics", tpl: "modern", changed: "Headline, summary and skills differ from Operations.",
    edit: rewrite("Analytics Analyst", "Analyst who builds weekly dashboards and forecasts for operations teams. Works in SQL and Looker and explains the numbers in plain language.", "SQL, forecasting, dashboards, root-cause analysis", "Looker, Excel, Jira, Google Sheets") },
  { name: "Logistics", tpl: "compact", changed: "Headline, summary and skills differ from Operations.",
    edit: rewrite("Logistics Coordinator", "Coordinator with six years in warehouse and route operations, cutting stock discrepancies and late arrivals across four depots.", "Inventory control, route planning, cycle counts, SOPs", "Airtable, Excel, Jira, Google Sheets") },
];
const CHANGED = ".headline, .summary-text, [aria-labelledby$='-s-skills'] li";
const APPLICATIONS = [
  { company: "Northgate Freight", role: "Operations Analyst", status: "Interviewing" },
  { company: "Calder & Moss", role: "Data Analyst", status: "Applied" },
  { company: "Fenwick Retail", role: "Logistics Coordinator", status: "Offer" },
];

/** A step that lights up once the scroll has reached it. */
function Step({ on, icon, title, note }: { on: boolean; icon: ReactNode; title: string; note?: string }) {
  return (
    <motion.div className="frag-row" animate={{ opacity: on ? 1 : 0.4, x: on ? 0 : -10 }} transition={T}>
      <motion.span animate={{ scale: on ? 1 : 0.8, color: on ? "var(--tick-text)" : "var(--text-muted)" }} transition={T} className="inline-flex">{icon}</motion.span>
      <span className="flex-1 font-semibold">{title}</span>
      {note && <span className="text-[var(--text-muted)]">{note}</span>}
    </motion.div>
  );
}

/** What each ATS check looks at on the page, as selectors into the real resume markup. */
const CHECK_TARGETS: Record<string, string> = {
  "contact-fields": "h1, .contact-list li",
  headings: "h2",
  "bullet-length": ".bullets li",
  dates: ".dates",
};

/** The sample with one more line filed under Skills, the way the editor's Add to Skills does. */
function withSkill(doc: Doc, term: string) {
  return { ...doc, sections: doc.sections.map((sec) => sec.type === "skills" ? { ...sec, content: { items: [...sec.content.items, { id: "added", label: "Additional skills", skills: term }] } } : sec) };
}

interface Mark { x: number; y: number; w: number; h: number }

/** Ranges over every element the selector matches, or over every occurrence of the given words in the resume text. */
function collect(el: HTMLElement, selector?: string, terms?: string[]): Range[] {
  const out: Range[] = [];
  if (selector) {
    el.querySelectorAll(selector).forEach((node) => { const r = document.createRange(); r.selectNodeContents(node); out.push(r); });
  }
  if (terms?.length) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
    for (const t of terms) {
      const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      for (const node of texts) for (const m of node.data.matchAll(re)) {
        const r = document.createRange();
        r.setStart(node, m.index!); r.setEnd(node, m.index! + m[0].length);
        out.push(r);
      }
    }
  }
  return out;
}

/** Line boxes of the collected ranges, as percentages of the sheet so they survive resizing. */
function useMarks(root: React.RefObject<HTMLElement | null>, key: string, tpl: string, selector?: string, terms?: string[]) {
  const [marks, setMarks] = useState<Mark[]>([]);
  const args = useRef({ selector, terms });
  args.current = { selector, terms };
  // A template swap crossfades two pages for a moment: only measure once the new one has settled.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 600);
    return () => clearTimeout(t);
  }, [tpl]);
  useEffect(() => {
    const el = root.current;
    if (!el || !key || !settled) { setMarks([]); return; }
    const measure = () => {
      const base = el.getBoundingClientRect();
      if (!base.width) return;
      const out: Mark[] = [];
      for (const range of collect(el, args.current.selector, args.current.terms)) {
        for (const r of Array.from(range.getClientRects())) {
          if (r.width < 2 || r.height < 2) continue;
          out.push({ x: ((r.left - base.left) / base.width) * 100, y: ((r.top - base.top) / base.height) * 100, w: (r.width / base.width) * 100, h: (r.height / base.height) * 100 });
        }
      }
      setMarks(out);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [root, key, settled]);
  return marks;
}

/** The sample resume as a sheet on the stage: swaps template with a blur, can show a second page behind it, or lock. */
function Sheet({ tpl, ghost, locked, mark, terms, extra, edit }: { tpl: TemplateId; ghost?: boolean; locked?: boolean; mark?: string; terms?: string[]; extra?: string; edit?: (d: Doc) => Doc }) {
  const base = useMemo(() => (edit ?? ((d: Doc) => d))(createSampleDoc()), [edit]);
  const sample = useMemo(() => extra ? withSkill(base, extra) : base, [base, extra]);
  const root = useRef<HTMLDivElement>(null);
  const key = [mark ?? "", terms?.join("|") ?? "", extra ?? ""].join("~");
  const marks = useMarks(root, mark || terms?.length ? key : "", tpl, mark, terms);
  return (
    <div className="vis-sheet" ref={root}>
      {ghost !== undefined && <motion.div className="vis-ghost" animate={{ opacity: ghost ? 0.8 : 0, y: ghost ? 0 : -36, scale: ghost ? 1 : 0.92 }} transition={T} />}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={tpl} initial={{ opacity: 0, x: 28, rotate: 2, filter: "blur(8px)" }} animate={{ opacity: 1, x: 0, rotate: 0, filter: locked ? "blur(7px)" : "blur(0px)" }} exit={{ opacity: 0, x: -28, rotate: -2, filter: "blur(8px)" }} transition={T}>
          <Thumbnail doc={{ ...sample, style: { ...sample.style, template: tpl } }} uid={`fs-${tpl}`} />
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {(mark || terms?.length) && (
          <motion.div key={mark ?? "terms"} className="vis-marks" aria-hidden="true" exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {marks.map((m, i) => (
              <motion.span key={i} className="vis-mark" style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%`, transformOrigin: "left center" }}
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.45, ease: EASE, delay: (i % 5) * 0.06 }} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A longer sample, so the three settings genuinely decide whether it fits. */
const MORE = [
  "Owned the weekly service review with depot managers and tracked every action to closure.",
  "Built a shared forecast of dock capacity that three regional teams now plan against.",
  "Trained new analysts on the reporting stack and wrote the onboarding guide they still use.",
];
function fuller(d: Doc): Doc {
  return { ...d, sections: d.sections.map((sec) => sec.type === "experience"
    ? { ...sec, content: { items: sec.content.items.map((it, i) => ({ ...it, bullets: [...it.bullets, ...MORE.slice(i * 2, i * 2 + 2)] })) } }
    : sec) };
}
const PAGE_W = 794, PAGE_H = 1123;
const ss = (p: number, a: number, b: number) => { const t = Math.min(1, Math.max(0, (p - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Eases a set of numbers toward their targets, so a stepped scroll position still moves smoothly. */
function useEased(target: number[]) {
  const [cur, setCur] = useState(target);
  const goal = useRef(target);
  goal.current = target;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setCur((c) => {
        if (c.every((v, i) => v === goal.current[i])) return c;
        return c.map((v, i) => { const d = goal.current[i] - v; return Math.abs(d) < 0.002 ? goal.current[i] : v + d * 0.16; });
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return cur;
}

/** The resume with its real Design settings moving: line spacing, then margins, then font size, each drawn on the actual template. */
function FitDemo({ p }: { p: number }) {
  const base = useMemo(() => fuller(createSampleDoc()), []);
  const [ls, mm, fs] = useEased([1.6 - 0.4 * ss(p, 0.08, 0.38), 28 - 13 * ss(p, 0.4, 0.68), 12.5 - 2 * ss(p, 0.7, 0.95)]);
  const pad = (mm * 96) / 25.4;
  const root = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1);
  useEffect(() => {
    const art = root.current?.querySelector<HTMLElement>("[data-resume]");
    if (art) setPages((art.offsetHeight + 2 * pad) / PAGE_H);
  }, [ls, mm, fs, pad]);
  const doc = useMemo(() => ({ ...base, style: { ...base.style, fontSize: fs, lineSpacing: ls } }), [base, fs, ls]);
  const over = pages > 1.03;
  const active = p < 0.39 ? 0 : p < 0.69 ? 1 : 2;
  const rows = [["Line spacing", ls.toFixed(2)], ["Margins", `${Math.round(mm)} mm`], ["Font size", `${fs.toFixed(1)} pt`]];
  const tint = { background: "var(--tick-fill)" };
  return (
    <div className="vis vis-split">
      <div className="vis-sheet" ref={root}>
        <motion.div className="vis-ghost" animate={{ opacity: over ? 0.8 : 0, y: over ? 0 : -36, scale: over ? 1 : 0.92 }} transition={T} />
        <Thumbnail doc={doc} uid="fit" pad={pad} />
        <motion.div className="vis-bands" aria-hidden="true" animate={{ opacity: active === 1 ? 0.16 : 0 }} transition={T}>
          <span style={{ ...tint, left: 0, right: 0, top: 0, height: `${(pad / PAGE_H) * 100}%` }} />
          <span style={{ ...tint, left: 0, right: 0, bottom: 0, height: `${(pad / PAGE_H) * 100}%` }} />
          <span style={{ ...tint, left: 0, top: 0, bottom: 0, width: `${(pad / PAGE_W) * 100}%` }} />
          <span style={{ ...tint, right: 0, top: 0, bottom: 0, width: `${(pad / PAGE_W) * 100}%` }} />
        </motion.div>
      </div>
      <div className="vis-body">
        <p className="vis-big" aria-hidden="true"><AnimatePresence mode="wait" initial={false}><motion.span key={over ? pages.toFixed(1) : "1"} className="inline-block" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2, ease: EASE }}>{over ? `About ${pages.toFixed(1)} pages` : "About 1 page"}</motion.span></AnimatePresence></p>
        <ul className="vis-fitrows">
          {rows.map(([n, v], i) => (
            <motion.li key={n} animate={{ opacity: i === active ? 1 : 0.4, x: i === active ? 8 : 0 }} transition={T}><span>{n}</span><strong className="tabular-nums">{v}</strong></motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const TYPED = " & SQL";
const CIPHER = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** Replaces the first `upTo` visible characters with ciphertext, keeping spaces and line breaks so the shape stays. */
const scramble = (text: string, upTo: number) => {
  let n = 0;
  return text.split("").map((ch, i) => {
    if (ch === " ") return ch;
    n++;
    return n <= upTo ? CIPHER[(i * 31 + n * 17) % CIPHER.length] : ch;
  }).join("");
};

/** Keep your work safe: typing saves, the data becomes resume.json, then the same file turns to ciphertext. */
function KeepDemo({ p }: { p: number }) {
  const stage = Math.min(2, Math.floor(p * 3));
  const lp = Math.min(1, Math.max(0, p * 3 - stage));
  const typed = stage > 0 ? TYPED.length : Math.floor(ss(lp, 0.08, 0.78) * TYPED.length);
  const headline = "Operations Analyst" + TYPED.slice(0, typed);
  const edit = useMemo(() => (d: Doc): Doc => ({ ...d, sections: d.sections.map((sec) => sec.type === "contact" ? { ...sec, content: { ...sec.content, headline } } : sec) }), [headline]);
  const lines = useMemo(() => {
    const d = createSampleDoc();
    const c = d.sections.find((x) => x.type === "contact");
    const who = c && c.type === "contact" ? c.content : null;
    return JSON.stringify({ name: who?.fullName, title: headline, city: who?.location, template: d.style.template, sections: d.sections.length, fontSize: d.style.fontSize }, null, 2).split("\n");
  }, [headline]);
  const shown = stage === 1 ? Math.ceil(ss(lp, 0, 0.75) * lines.length) : lines.length;
  const total = lines.reduce((n, ln) => n + ln.replace(/ /g, "").length, 0);
  const cut = stage === 2 ? Math.round(ss(lp, 0.12, 0.8) * total) : 0;
  let seen = 0;
  const text = lines.map((ln) => { const out = scramble(ln, Math.max(0, cut - seen)); seen += ln.replace(/ /g, "").length; return out; });
  const dots = stage === 2 ? Math.round(ss(lp, 0, 0.4) * 10) : 0;
  const saved = typed === TYPED.length;
  const caption = ["Saved as you type", "Export resume.json", "Encrypt with a passphrase"][stage];
  const status = stage === 0 ? (saved ? "Saved in this browser" : "Saving in this browser") : stage === 1 ? "Downloaded to this device" : cut >= total ? "Encrypted here. There is no recovery." : "Encrypting in the browser";
  return (
    <div className="vis vis-split">
      <Sheet tpl="classic" edit={edit} locked={stage === 2 && cut > total * 0.6} mark={stage === 1 ? "h1, .headline, .contact-list li" : undefined} />
      <div className="vis-body">
        <p className="vis-big" aria-hidden="true"><AnimatePresence mode="wait" initial={false}><motion.span key={stage} className="inline-block" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2, ease: EASE }}>{caption}</motion.span></AnimatePresence></p>
        {stage === 0 ? (
          <div className="vis-field"><span>Headline</span><strong>{headline}<i className="vis-caret" /></strong></div>
        ) : (
          <pre className="vis-code"><code>{text.map((ln, i) => <motion.span key={i} className="block" animate={{ opacity: i < shown ? 1 : 0, x: i < shown ? 0 : -8 }} transition={{ duration: 0.25, ease: EASE }}>{ln}</motion.span>)}</code></pre>
        )}
        {stage === 2 && <div className="vis-field"><span>Passphrase</span><strong className="tabular-nums">{"•".repeat(dots) || "\u00a0"}</strong></div>}
        <p className="vis-status" aria-hidden="true"><IconTick size={18} />{status}</p>
        {stage === 2 && <p className="vis-note">Last backup: just now. A reminder comes after seven days of unsaved changes.</p>}
      </div>
    </div>
  );
}

function Vis({ id, p, checks }: { id: string; p: number; checks: AtsCheck[] }) {
  const pick = (n: number) => Math.min(n - 1, Math.floor(p * n));
  if (id === "build") {
    const cur = TEMPLATES[pick(TEMPLATES.length)];
    return (
      <div className="vis vis-split">
        <Sheet tpl={cur.id} />
        <ul className="vis-side">
          {TEMPLATES.map((t) => <motion.li key={t.id} animate={{ opacity: t.id === cur.id ? 1 : 0.4, x: t.id === cur.id ? 8 : 0 }} transition={T}>{t.name}</motion.li>)}
          <li className="vis-note">Same words, new page. Twelve in all.</li>
        </ul>
      </div>
    );
  }
  if (id === "check") {
    const list = checks.slice(0, 4);
    const cur = pick(list.length);
    return (
      <div className="vis vis-split">
        <Sheet tpl="classic" mark={CHECK_TARGETS[list[cur]?.id]} />
        <ul className="vis-body vis-list">
          {list.map((c, i) => (
            <Step key={c.id} on={i <= cur} title={c.message} icon={c.level === "pass" ? <IconTick size={18} /> : c.level === "fail" ? <IconAlert size={18} /> : <IconWarn size={18} />} />
          ))}
        </ul>
      </div>
    );
  }
  if (id === "tailor") {
    const sample = createSampleDoc();
    const text = JSON.stringify(sample).toLowerCase();
    const has = TERMS.map((t) => text.includes(t.toLowerCase()));
    const gap = TERMS.findIndex((_, i) => !has[i]);
    const added = p > 0.72;
    const read = Math.min(TERMS.length, 1 + Math.floor((p / 0.72) * TERMS.length));
    const live = (i: number) => (has[i] || (added && i === gap)) && i < read;
    const found = TERMS.filter((_, i) => live(i));
    return (
      <div className="vis vis-split">
        <Sheet tpl="classic" terms={found} extra={added && gap >= 0 ? TERMS[gap] : undefined} />
        <div className="vis-body">
          <p className="vis-note">A sample job posting. Each key term is looked up in the resume.</p>
          <p className="vis-posting">
            {POSTING.map((part, i) => {
              if (typeof part === "string") return part;
              const ti = part.t;
              const state = ti >= read ? "idle" : live(ti) ? "found" : "missing";
              return <motion.span key={i} className="vis-term" data-state={state} animate={{ backgroundColor: state === "found" ? "var(--tick-fill)" : state === "missing" ? "var(--pen-soft)" : "rgba(0,0,0,0)", color: state === "found" ? "var(--on-tick)" : state === "missing" ? "var(--pen-text)" : "var(--text)" }} transition={T}>{TERMS[ti]}</motion.span>;
            })}
          </p>
          <p className="vis-note"><strong className="tabular-nums">{found.length} of {TERMS.length}</strong> terms are in the resume{gap >= 0 && !added && read === TERMS.length ? `. ${TERMS[gap]} is missing.` : "."}</p>
          <AnimatePresence initial={false}>
            {gap >= 0 && read === TERMS.length && (
              <motion.p key={String(added)} className="vis-act" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={T}>
                {added ? <><IconTick size={18} /><span>Added to Skills</span><span className="ml-2 text-[var(--text-muted)]">Undo</span></> : <span className="vis-btn">Add to Skills</span>}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }
  if (id === "versions") {
    const v = pick(ROLES.length);
    const role = ROLES[v];
    return (
      <div className="vis vis-split">
        <Sheet tpl={role.tpl} edit={role.edit} mark={v ? CHANGED : undefined} />
        <div className="vis-body">
          <div className="vis-tabs">
            {ROLES.map((r, i) => (
              <span key={r.name} className="vis-tab" data-on={i === v}>
                {i === v && <motion.span layoutId="vis-tab" className="vis-tab-bg" transition={T} />}
                <span className="relative">{r.name}</span>
              </span>
            ))}
          </div>
          <p className="vis-note">{role.changed} Its own template, too.</p>
          <ul className="vis-apps">
            {APPLICATIONS.map((a, i) => (
              <motion.li key={a.company} animate={{ opacity: i === v ? 1 : 0.4, x: i === v ? 8 : 0 }} transition={T}>
                <strong>{a.company}</strong>
                <span>{a.role}, sent with {ROLES[i].name}. <em>{a.status}</em></span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
  if (id === "finish") return <FitDemo p={p} />;
  return <KeepDemo p={p} />;
}

/**
 * Desktop scroll story: the section is pinned and scrolling steps through the six groups.
 * Inside a group, scroll lights up its features one by one and drives a small live demo.
 * Hidden by CSS on phones and under reduced motion, where the plain list below takes over.
 */
export function FeatureStory({ checks }: { checks: AtsCheck[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ g: 0, p: 0 });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const x = Math.min(Math.max(v, 0), 0.9999) * N;
    const g = Math.floor(x);
    const p = Math.round((x - g) * 50) / 50;
    setPos((s) => (s.g === g && s.p === p ? s : { g, p }));
  });
  const { g, p } = pos;
  const group = GROUPS[g];
  const jump = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (i / N) * (el.offsetHeight - window.innerHeight) + 4, behavior: "smooth" });
  };

  return (
    <div ref={ref} className="fs" style={{ "--n": N } as React.CSSProperties}>
      <div className="fs-pin">
        <div className="fs-nav">
          <div className="fs-track" aria-hidden="true"><motion.span style={{ scaleY: fill }} /></div>
          <ol>
            {GROUPS.map((x, i) => (
              <li key={x.id}>
                <button type="button" onClick={() => jump(i)} aria-current={i === g ? "step" : undefined}>
                  <motion.span className="inline-block origin-left" animate={{ opacity: i === g ? 1 : 0.4, scale: i === g ? 1 : 0.82 }} transition={T}>{x.title}</motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {i === g && (
                    <motion.p key="lead" className="fs-lead" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={T}>{x.lead}</motion.p>
                  )}
                </AnimatePresence>
              </li>
            ))}
          </ol>
        </div>

        <div className="fs-panel">
          <div className="fs-vis" data-ui aria-hidden="true">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={group.id} className="h-full" initial={{ opacity: 0, y: 28, scale: 0.98, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: -28, scale: 0.98, filter: "blur(6px)" }} transition={{ duration: 0.4, ease: EASE }}>
                <Vis id={group.id} p={p} checks={checks} />
              </motion.div>
            </AnimatePresence>
          </div>
          <h3 className="sr-only">{group.title}</h3>
          <ul className="fs-items" key={group.id}>
            {group.items.map((it, i) => {
              const on = p >= (i / group.items.length) * 0.8;
              return (
                <motion.li key={it.name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: on ? 1 : 0.3, y: on ? 0 : 10 }} transition={{ duration: 0.45, ease: EASE }}>
                  <strong>{it.name}</strong> {it.text}
                </motion.li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
