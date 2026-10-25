"use client";
import { motion } from "motion/react";
import { EASE } from "@/lib/motion";
import { memo } from "react";
import { DATE_FORMATS, FONTS, MARGINS, PAGE_SIZES, type FontId, type MarginId, type PageSizeId, type ResumeDoc, type TemplateId } from "@/lib/schema";
import { patchStyle } from "@/lib/ops";
import { resumeStore } from "@/lib/store";
import { TEMPLATES } from "@/templates/registry";
import { ACCENT_SWATCHES } from "@/lib/ui";
import { SelectField } from "./fields";
import { Segmented, onRadioGroupKey } from "./controls";

/** Schematic sketch of each template (not a real resume render, so the page keeps exactly one [data-resume]). */
const Sketch = memo(function Sketch({ id, accent }: { id: TemplateId; accent: string }) {
  const g = "#9aa5ae";
  const line = (y: number, w = 44, x = 8) => <rect key={`${y}-${x}`} x={x} y={y} width={w} height="2.4" rx="1.2" fill={g} />;
  const body = (ys: number[]) => ys.map((y, i) => line(y, i % 3 === 2 ? 30 : 44));
  let inner;
  switch (id) {
    case "classic":
      inner = <>
        <rect x="8" y="8" width="26" height="5" rx="1" fill={accent} />
        {[22, 44].map((y) => <g key={y}><rect x="8" y={y} width="18" height="2.6" fill={accent} /><rect x="8" y={y + 4} width="44" height="1" fill={accent} /></g>)}
        {body([29, 34, 39, 51, 56, 61])}
      </>; break;
    case "modern":
      inner = <>
        <rect x="8" y="8" width="26" height="5" rx="1" fill="#46525e" /><rect x="8" y="16" width="44" height="1.6" fill={accent} />
        {[24, 46].map((y) => <g key={y}><rect x="8" y={y} width="2" height="4" fill={accent} /><rect x="12" y={y + 0.6} width="16" height="2.6" fill={accent} /></g>)}
        {body([31, 36, 41, 53, 58, 63])}
      </>; break;
    case "compact":
      inner = <>
        <rect x="8" y="6" width="22" height="4" rx="1" fill={accent} />
        {[14, 38].map((y) => <g key={y}><rect x="8" y={y} width="16" height="2" fill="#46525e" /><rect x="8" y={y + 3} width="44" height="0.8" fill={g} /></g>)}
        {[20, 24, 28, 32, 44, 48, 52, 56, 60, 64].map((y, i) => line(y, i % 4 === 3 ? 28 : 44))}
      </>; break;
    case "elegant":
      inner = <>
        <rect x="16" y="8" width="28" height="4.5" rx="1" fill="#46525e" /><rect x="22" y="15" width="16" height="2" fill={g} />
        {[24, 46].map((y) => <g key={y}><rect x="8" y={y} width="44" height="0.8" fill={accent} /><rect x="22" y={y + 3} width="16" height="2.2" fill={accent} /><rect x="8" y={y + 7.5} width="44" height="0.8" fill={accent} /></g>)}
        {body([36, 41, 58, 63])}
      </>; break;
    case "bold":
      inner = <>
        <rect x="8" y="8" width="30" height="6" rx="1" fill={accent} />
        {[22, 44].map((y) => <rect key={y} x="8" y={y} width="44" height="5" fill={accent} />)}
        {body([31, 36, 41, 53, 58, 63])}
      </>; break;
    case "executive":
      inner = <>
        <rect x="8" y="7" width="30" height="4.5" rx="1" fill="#46525e" opacity="0.75" />
        <rect x="8" y="14" width="44" height="0.8" fill={accent} /><rect x="8" y="16" width="44" height="0.8" fill={accent} />
        {[24, 46].map((y) => <rect key={y} x="8" y={y} width="20" height="3" fill={accent} />)}
        {body([30, 35, 40, 52, 57, 62])}
      </>; break;
    case "academic":
      inner = <>
        <rect x="8" y="6" width="22" height="4" rx="1" fill="#46525e" />
        {[14, 40].map((y) => <g key={y}><rect x="8" y={y} width="14" height="2" fill={accent} /><rect x="8" y={y + 3} width="44" height="0.8" fill={g} /></g>)}
        {[20, 29, 46, 55].map((y) => <g key={y}><rect x="8" y={y} width="12" height="2.4" rx="1.2" fill="#46525e" /><rect x="23" y={y} width="29" height="2.4" rx="1.2" fill={g} /><rect x="23" y={y + 4} width="22" height="2.4" rx="1.2" fill={g} /></g>)}
      </>; break;
    case "technical":
      inner = <>
        <rect x="8" y="6" width="24" height="4.5" rx="1" fill="#46525e" /><rect x="8" y="12" width="16" height="2" fill={accent} />
        {[19, 41].map((y) => <g key={y}><rect x="8" y={y} width="44" height="1.6" fill={accent} /><rect x="8" y={y + 3} width="14" height="2.2" fill="#46525e" /></g>)}
        {[28, 32, 36].map((y) => <g key={y}><rect x="8" y={y} width="2" height="2" fill={g} /><rect x="12" y={y} width="38" height="2" rx="1" fill={g} /></g>)}
        {[50, 54, 58].map((y) => <g key={y}><rect x="8" y={y} width="10" height="2" fill={accent} /><rect x="20" y={y} width="30" height="2" rx="1" fill={g} /></g>)}
      </>; break;
    case "graduate":
      inner = <>
        <rect x="8" y="7" width="38" height="8" rx="1" fill="#2f3a45" /><rect x="8" y="18" width="20" height="2.4" fill={accent} />
        {[28, 50].map((y) => <rect key={y} x="8" y={y} width="24" height="3.6" fill={accent} />)}
        {body([35, 41, 47, 57, 63, 69])}
      </>; break;
    case "softline":
      inner = <>
        <rect x="8" y="8" width="28" height="5" rx="1" fill={accent} />
        {[22, 44].map((y) => <g key={y}><rect x="8" y={y} width="20" height="2.8" rx="1.4" fill={accent} /><rect x="8" y={y + 5} width="44" height="2" rx="1" fill={accent} opacity="0.3" /></g>)}
        {body([32, 38, 44, 54, 60, 66])}
      </>; break;
    case "ledger":
      inner = <>
        <rect x="8" y="5" width="44" height="2" fill={accent} /><rect x="8" y="10" width="26" height="5" rx="1" fill="#46525e" />
        {[22, 44].map((y) => <g key={y}><rect x="8" y={y} width="4" height="4" fill={accent} /><rect x="12" y={y} width="16" height="4" fill="none" /><rect x="12" y={y + 3.4} width="20" height="0.8" fill={g} /><rect x="14" y={y + 1} width="12" height="2" fill="#46525e" /></g>)}
        {[29, 34, 39, 51, 56, 61].map((y, i) => <g key={y}><rect x="10" y={y} width="0.8" height="2.4" fill={g} /><rect x="13" y={y} width={i % 3 === 2 ? 28 : 39} height="2.4" rx="1.2" fill={g} /></g>)}
      </>; break;
    default:
      inner = <>
        <rect x="8" y="8" width="24" height="5" rx="1" fill="#46525e" />
        {[22, 44].map((y) => <rect key={y} x="8" y={y} width="16" height="2.8" fill="#46525e" />)}
        {body([29, 34, 39, 51, 56, 61])}
      </>;
  }
  return (
    <svg viewBox="0 0 60 80" width="100%" style={{ aspectRatio: "60 / 80", background: "#fff", borderRadius: 2, outline: "1px solid var(--paper-edge)" }} aria-hidden="true" focusable="false">{inner}</svg>
  );
});

export function StylePanel({ doc }: { doc: ResumeDoc }) {
  const s = doc.style;
  const set = (p: Parameters<typeof patchStyle>[1]) => resumeStore.update((d) => patchStyle(d, p));
  const isSwatch = ACCENT_SWATCHES.some((w) => w.value.toLowerCase() === s.accent.toLowerCase());
  return (
    <section aria-labelledby="style-h" className="space-y-7">
      <h2 id="style-h" className="serif text-2xl">Design</h2>

      <div role="radiogroup" aria-labelledby="layout-h" className="space-y-2" onKeyDown={onRadioGroupKey}>
        <h3 id="layout-h" className="text-sm font-medium">Template</h3>
        <div className="grid grid-cols-3 gap-2">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={s.template === t.id} tabIndex={s.template === t.id ? 0 : -1} aria-label={t.name} className="tpl-pick" onClick={() => set({ template: t.id })} data-testid={`pick-${t.id}`}>
              {s.template === t.id && <motion.span layoutId="tpl-ring" className="pick-ring" transition={{ duration: 0.22, ease: EASE }} aria-hidden="true" />}
              <Sketch id={t.id} accent={s.accent} />
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 id="accent-h" className="text-sm font-medium">Accent color</h3>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-labelledby="accent-h" onKeyDown={onRadioGroupKey}>
          {ACCENT_SWATCHES.map((w, wi) => (
            <button key={w.value} type="button" role="radio" aria-checked={s.accent.toLowerCase() === w.value} tabIndex={isSwatch ? (s.accent.toLowerCase() === w.value ? 0 : -1) : wi === 0 ? 0 : -1} aria-label={w.name} title={w.name} className="swatch" style={{ background: w.value }} onClick={() => set({ accent: w.value })}>
              {s.accent.toLowerCase() === w.value && <motion.span layoutId="swatch-ring" className="swatch-ring" transition={{ duration: 0.22, ease: EASE }} aria-hidden="true" />}
            </button>
          ))}
        </div>
        <div className="field mt-1 max-w-[16rem]">
          <label htmlFor="accent">Custom color</label>
          <div className="flex items-center gap-3">
            <input id="accent" type="color" value={s.accent} onChange={(e) => set({ accent: e.target.value })} className="h-11 w-16 cursor-pointer rounded-[var(--r-control)] border border-[var(--line-strong)] bg-[var(--surface)] p-1" />
            <code className="text-sm font-normal" data-testid="accent-value">{isSwatch ? ACCENT_SWATCHES.find((w) => w.value === s.accent.toLowerCase())?.name : s.accent}</code>
          </div>
        </div>
      </div>

      <div className="grid gap-4 @md:grid-cols-2">
        <SelectField<FontId> label="Font" value={s.font} options={(Object.keys(FONTS) as FontId[]).map((k) => ({ value: k, label: FONTS[k].label }))} onChange={(v) => set({ font: v })} />
        <SelectField label="Date format" value={s.dateFormat} options={DATE_FORMATS.map((d) => ({ value: d, label: d }))} onChange={(v) => set({ dateFormat: v })} />
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="fs" className="text-sm font-medium">Font size</label>
          <output htmlFor="fs" className="text-sm tabular-nums" data-testid="fs-value">{s.fontSize} pt</output>
        </div>
        <input id="fs" className="range" type="range" min={9} max={12} step={0.5} value={s.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })} />
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="ls" className="text-sm font-medium">Line spacing</label>
          <output htmlFor="ls" className="text-sm tabular-nums" data-testid="ls-value">{s.lineSpacing.toFixed(2)}</output>
        </div>
        <input id="ls" className="range" type="range" min={1} max={1.5} step={0.05} value={s.lineSpacing} onChange={(e) => set({ lineSpacing: Number(e.target.value) })} />
      </div>

      <Segmented<MarginId> legend="Margins" value={s.margins} onChange={(v) => set({ margins: v })}
        options={(Object.keys(MARGINS) as MarginId[]).map((k) => ({ value: k, label: `${k[0].toUpperCase()}${k.slice(1)}`, sub: `${MARGINS[k]} mm` }))} />
      <Segmented<PageSizeId> legend="Paper size" value={s.pageSize} onChange={(v) => set({ pageSize: v })}
        options={(Object.keys(PAGE_SIZES) as PageSizeId[]).map((k) => ({ value: k, label: PAGE_SIZES[k].label }))}
        hint="Pick the size your country uses. The PDF is set to match." />
    </section>
  );
}
