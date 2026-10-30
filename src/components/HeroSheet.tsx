"use client";
import { createContext, memo, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { EASE } from "@/lib/motion";
import { SegButton } from "./controls";
import { createSampleDoc } from "@/lib/sample";
import { getTemplate } from "@/templates/registry";
import type { ResumeDoc, TemplateId } from "@/lib/schema";

const PAGE_W = 794;
const PAGE_H = 1123;
const MARGIN = 64;
const SETTLE = [0.16, 1, 0.3, 1] as const;

/** The pages the stage can show. */
export const SHOW_TEMPLATES: TemplateId[] = ["classic", "elegant", "modern"];
const LAYERS = SHOW_TEMPLATES;

/** Story beats. Scene n is the reading block marked data-scene="n"; p is how far through it the reader is (0 to 1). */
export const TYPED = " & SQL";
export const MOVE_AT = 0.42;
export const HIDE_AT = 0.74;
export const ss = (p: number, a: number, b: number) => { const t = Math.min(1, Math.max(0, (p - a) / (b - a))); return t * t * (3 - 2 * t); };
export const beatOf = (p: number, n: number) => Math.min(n - 1, Math.floor(p * n));
export const typedChars = (p: number) => Math.round(ss(p, 0.04, 0.3) * TYPED.length);

export interface StoryCheck { id: string; message: string }
interface Pos { scene: number; p: number }
const StoryCtx = createContext<Pos>({ scene: 0, p: 0 });
/** Where the reader is in the story: which scene is on stage and how far through it. */
export const useStory = () => useContext(StoryCtx);

const templateFor = (scene: number, p: number): TemplateId =>
  scene === 1 ? SHOW_TEMPLATES[beatOf(p, SHOW_TEMPLATES.length)] : scene === 2 ? "modern" : "classic";

/** The sample as the stage shows it: in scene 2 the headline is typed, Experience is dragged up and Certifications switched off. */
function buildDoc(typed: number, moved: boolean, hidden: boolean): ResumeDoc {
  const d = createSampleDoc();
  let sections = d.sections.map((sec) =>
    sec.type === "contact" && typed ? { ...sec, content: { ...sec.content, headline: sec.content.headline + TYPED.slice(0, typed) } }
    : sec.type === "certifications" && hidden ? { ...sec, visible: false }
    : sec);
  if (moved) {
    const exp = sections.findIndex((s) => s.type === "experience");
    const sum = sections.findIndex((s) => s.type === "summary");
    if (exp > sum && sum >= 0) sections = [...sections.slice(0, sum), sections[exp], ...sections.slice(sum, exp), ...sections.slice(exp + 1)];
  }
  return { ...d, sections };
}

/** What each ATS check looks at on the page. */
const CHECK_TARGETS: Record<string, string> = {
  "contact-fields": "h1, .contact-list li",
  headings: "h2",
  "bullet-length": ".bullets li",
  dates: ".dates",
};

interface MarkSpec { key: string; sel: string; block?: boolean; sweep?: boolean; tone?: "warn" | "select" }

/** What the stage highlights at this point of the story. */
function markSpec(scene: number, p: number, checks: StoryCheck[]): MarkSpec | null {
  if (scene === 2) {
    if (p < MOVE_AT - 0.06) return { key: "head", sel: ".headline" };
    if (p >= MOVE_AT && p < HIDE_AT - 0.1) return { key: "moved", sel: "[aria-labelledby$='-s-exp']", block: true };
    if (p >= HIDE_AT - 0.1 && p < HIDE_AT) return { key: "cert", sel: "[aria-labelledby$='-s-cert']", block: true, tone: "warn" };
    return null;
  }
  if (scene === 3) {
    const c = checks[beatOf(p, Math.max(1, checks.length))];
    const sel = c && CHECK_TARGETS[c.id];
    return sel ? { key: c.id, sel } : null;
  }
  if (scene === 4) return { key: "select", sel: "h1, h2, h3, p, li", sweep: true, tone: "select" };
  return null;
}

interface Mark { x: number; y: number; w: number; h: number }

/** Line boxes (or whole boxes) of what the spec points at, as percentages of the page so they survive resizing. */
function useStageMarks(page: RefObject<HTMLElement | null>, spec: MarkSpec | null, template: string, docKey: string) {
  const [marks, setMarks] = useState<Mark[]>([]);
  // A template swap crossfades two pages: measure only once the new one has settled.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 650);
    return () => clearTimeout(t);
  }, [template]);
  const specRef = useRef(spec);
  specRef.current = spec;
  const key = spec?.key ?? "";
  useEffect(() => {
    const box = page.current;
    const root = box?.querySelector<HTMLElement>('.stage-layer[data-shown="true"] .resume');
    const s = specRef.current;
    if (!box || !root || !s || !settled) { setMarks([]); return; }
    const measure = () => {
      const base = box.getBoundingClientRect();
      if (!base.width) return;
      const out: Mark[] = [];
      root.querySelectorAll(s.sel).forEach((node) => {
        const rects = s.block ? [node.getBoundingClientRect()] : (() => { const r = document.createRange(); r.selectNodeContents(node); return Array.from(r.getClientRects()); })();
        for (const r of rects) {
          if (r.width < 2 || r.height < 2) continue;
          out.push({ x: ((r.left - base.left) / base.width) * 100, y: ((r.top - base.top) / base.height) * 100, w: (r.width / base.width) * 100, h: (r.height / base.height) * 100 });
        }
      });
      setMarks(out);
    };
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [page, key, settled, docKey]);
  return marks;
}

function useBoxSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * The split page: a reading column on the left and the stage, one sample resume
 * that stays in view and answers what the column says. Elements in the column
 * marked data-scene="n" put scene n on stage, and how far the reader has scrolled
 * through one gives its beats (the fragments in HowFrags read the same position).
 */
export function SplitStory({ children, checks }: { children: ReactNode; checks: StoryCheck[] }) {
  const colRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos>({ scene: 0, p: 0 });
  const [ats, setAts] = useState(false);

  useEffect(() => {
    const marks = Array.from(colRef.current?.querySelectorAll<HTMLElement>("[data-scene]") ?? []);
    if (!marks.length) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = window.innerHeight * 0.6;
      const rects = marks.map((m) => m.getBoundingClientRect());
      let n = 0;
      rects.forEach((r, i) => { if (r.top <= line) n = i; });
      // A scene's beats run from its own top reaching the reading line to the next one's doing so.
      const span = rects[n + 1] ? rects[n + 1].top - rects[n].top : rects[n].height + 160;
      const p = Math.round(Math.min(1, Math.max(0, (line - rects[n].top) / span)) * 100) / 100;
      const scene = Number(marks[n].dataset.scene);
      setPos((s) => (s.scene === scene && s.p === p ? s : { scene, p }));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // A new scene starts from the plain view again.
  useEffect(() => { setAts(false); }, [pos.scene]);

  return (
    <MotionConfig reducedMotion="user">
      <StoryCtx.Provider value={pos}>
        <div className="story">
          <div ref={colRef} className="story-col">{children}</div>
          <Stage scene={pos.scene} p={pos.p} checks={checks} ats={ats} onAts={setAts} />
        </div>
      </StoryCtx.Provider>
    </MotionConfig>
  );
}

/** One page of the stack: only re-renders when its own document or view changes, not on every scroll step. */
const Layer = memo(function Layer({ id, doc, scale, ats, shown, beat }: { id: TemplateId; doc: ResumeDoc; scale: number; ats: boolean; shown: boolean; beat: number }) {
  const { Component } = getTemplate(id);
  // A section moving or leaving reflows the page at once; a short settle makes it read as one change.
  const body = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!shown || !body.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    animate(body.current, { opacity: [0.35, 1], y: [8, 0] }, { duration: 0.55, ease: EASE });
  }, [beat, shown]);
  return (
    <motion.div
      className="stage-layer" data-shown={shown} style={{ zIndex: shown ? 1 : 0 }}
      initial={false}
      animate={shown ? "in" : "out"}
      variants={{
        in: { opacity: 1, filter: "blur(0px)", scale: 1, visibility: "visible", transition: { opacity: { duration: 0.8, ease: EASE }, filter: { duration: 0.6, ease: EASE }, scale: { duration: 1.1, ease: SETTLE }, visibility: { duration: 0 } } },
        out: { opacity: 0, filter: "blur(3px)", scale: 1.006, visibility: "hidden", transition: { duration: 0, delay: 0.9 } },
      }}
    >
      <div className="ats-lens" data-on={ats} data-testid={id === "classic" ? "hero-lens" : undefined}>
        <div ref={(el) => { if (el) el.setAttribute("inert", ""); }} style={{ width: PAGE_W, height: PAGE_H, padding: MARGIN, boxSizing: "border-box", transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <div ref={body}><Component doc={{ ...doc, style: { ...doc.style, template: id } }} idPrefix={`stage-${id}`} /></div>
        </div>
      </div>
    </motion.div>
  );
});

function captionFor(scene: number, p: number, name: string, checks: StoryCheck[]) {
  if (scene === 1) return `The ${name} template. Same words, set as a new page.`;
  if (scene === 2) return p >= HIDE_AT ? "Certifications is switched off, so it leaves the page. It stays saved in the editor." : p >= MOVE_AT ? "Experience dragged above Summary. Nothing was retyped." : "The headline redraws as you type.";
  if (scene === 3) { const c = checks[beatOf(p, Math.max(1, checks.length))]; return c ? `Checking: ${c.message}` : "The ATS check reruns on every change."; }
  if (scene === 4) return p > 0.08 ? "Every line is selected here to show it is real text in the PDF, not a picture." : "Saved as a PDF, the page stays real text.";
  return `A sample resume for a fictional person, in the ${name} template. Switch the view to see what software extracts from it.`;
}

function Stage({ scene, p, checks, ats, onAts }: { scene: number; p: number; checks: StoryCheck[]; ats: boolean; onAts: (v: boolean) => void }) {
  const template = templateFor(scene, p);
  const typed = scene === 2 ? typedChars(p) : 0;
  const moved = scene === 2 && p >= MOVE_AT;
  const hidden = scene === 2 && p >= HIDE_AT;
  const docKey = `${typed}-${moved}-${hidden}`;
  const doc = useMemo(() => buildDoc(typed, moved, hidden), [typed, moved, hidden]);
  const [boxRef, box] = useBoxSize<HTMLDivElement>();
  const pageRef = useRef<HTMLDivElement>(null);
  const scale = box.w && box.h ? Math.min(box.w / PAGE_W, box.h / PAGE_H) : 0;
  const name = getTemplate(template).name;
  const [announce, setAnnounce] = useState("");
  const pick = (v: boolean) => { onAts(v); setAnnounce(v ? "Showing the text an ATS extracts, in reading order." : "Showing the sample resume as it looks."); };
  const reduce = useReducedMotion();

  const spec = markSpec(scene, p, checks);
  const marks = useStageMarks(pageRef, spec, template, docKey);
  // The selection wipes down the page on a spring, so a stepped scroll still moves as one stroke.
  const sweepTo = useMotionValue(0);
  sweepTo.set(spec?.sweep ? ss(p, 0.08, 0.92) * 104 : 0);
  const sweep = useSpring(sweepTo, { stiffness: 90, damping: 22, mass: 0.5 });
  const clip = useTransform(sweep, (v) => `inset(0 0 ${Math.max(0, 100 - v)}% 0)`);
  const caption = ats
    ? "Plain text, in reading order. Every highlighted line is real text a parser can pull out: no columns, tables or images in the way."
    : captionFor(scene, p, name, checks);

  return (
    <aside className="stage" aria-label="Sample resume">
      <div className="stage-bar">
        <div className="seg" role="group" aria-label="Sample resume view">
          <SegButton group="stage-view" pressed={!ats} onClick={() => pick(false)} testId="view-looks">How it looks</SegButton>
          <SegButton group="stage-view" pressed={ats} onClick={() => pick(true)} testId="view-ats">What an ATS reads</SegButton>
        </div>
      </div>
      <div ref={boxRef} className="stage-box">
        <motion.div
          ref={pageRef}
          className="stage-page" data-ui data-ready={scale > 0} style={{ width: PAGE_W * scale, height: PAGE_H * scale }} aria-hidden="true"
          initial={false} animate={scale > 0 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 12, scale: 0.985 }}
          transition={{ opacity: { duration: 0.9, ease: EASE, delay: 0.2 }, y: { duration: 1.4, ease: SETTLE, delay: 0.2 }, scale: { duration: 1.4, ease: SETTLE, delay: 0.2 } }}
        >
          {LAYERS.map((id) => <Layer key={id} id={id} doc={doc} scale={scale} ats={ats} shown={id === template} beat={Number(moved) + Number(hidden)} />)}
          <AnimatePresence>
            {spec && marks.length > 0 && (
              <motion.div key={spec.key} className="stage-marks" style={spec.sweep ? { clipPath: clip } : undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                {marks.map((m, i) => (
                  <motion.span
                    key={i} className="stage-mark" data-tone={spec.tone}
                    style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%`, transformOrigin: "left center" }}
                    initial={{ scaleX: spec.sweep ? 1 : 0 }} animate={{ scaleX: 1 }}
                    transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE, delay: spec.sweep ? 0 : (i % 5) * 0.06 }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      {/* Keyed so each new caption fades in with its beat. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={caption} className="stage-caption" data-testid="hero-caption" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.28, ease: EASE }}>
          {caption}
        </motion.p>
      </AnimatePresence>
    </aside>
  );
}
