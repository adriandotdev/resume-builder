"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES } from "@/templates/registry";
import { Thumbnail } from "@/components/Thumbnail";
import { Modal } from "@/components/Modal";
import { IconClose, IconTick } from "@/components/icons";
import { createSampleDoc } from "@/lib/sample";
import { patchStyle } from "@/lib/ops";
import { resumeStore, useResumeDoc } from "@/lib/store";
import { filterByTag, TEMPLATE_FILTERS, type TemplateFilter } from "@/lib/ui";

type Tpl = (typeof TEMPLATES)[number];
const CHIP_LABEL: Record<TemplateFilter, string> = { all: "All", simple: "Simple", modern: "Modern", compact: "Compact", bold: "Bold", formal: "Formal", "first-job": "First job" };

export default function TemplatesPage() {
  const router = useRouter();
  const doc = useResumeDoc();
  const sample = useMemo(() => createSampleDoc(), []);
  const [filter, setFilter] = useState<TemplateFilter>("all");
  const [preview, setPreview] = useState<Tpl | null>(null);
  const shown = filterByTag(TEMPLATES, filter);
  const current = doc.style.template;

  const choose = (id: Tpl["id"]) => {
    resumeStore.update((d) => patchStyle(d, { template: id }));
    resumeStore.flush();
    router.push("/editor");
  };
  const docFor = (t: Tpl) => ({ ...sample, style: { ...sample.style, template: t.id } });

  return (
    <div className="app-sheet">
      <div className="max-w-[60ch]">
        <h1 className="app-title">Templates</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          {TEMPLATES.length} single-column templates with real text and standard headings, following common ATS-safe practice. Previews use a fictional person, and your own content is kept when you switch.
        </p>
      </div>

      <div className="tab-row mt-6" role="group" aria-label="Filter templates">
        {TEMPLATE_FILTERS.map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)} data-testid={`filter-${f}`}>
            {CHIP_LABEL[f]}<span className="chip-count">{filterByTag(TEMPLATES, f).length}</span>
          </button>
        ))}
      </div>
      <p className="sr-only" role="status" aria-live="polite">Showing {shown.length} of {TEMPLATES.length} templates</p>

      <ul className="tpl-grid mt-6">
        {shown.map((t) => {
          const selected = current === t.id;
          return (
            <li key={t.id} className="tpl-card" data-template={t.id} data-selected={selected}>
              <div className="tpl-well">
                <button type="button" className="paper-thumb" onClick={() => setPreview(t)} aria-label={`Preview the ${t.name} template larger`}>
                  <Thumbnail doc={docFor(t)} uid={t.id} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[1.0625rem] font-semibold">{t.name}</h2>
                {selected && <span className="badge" data-testid="selected-badge"><IconTick size={14} />In use</span>}
              </div>
              <p className="-mt-1.5 text-[0.9375rem] leading-snug text-[var(--text-muted)]">{t.description}</p>
              <div className="mt-auto flex flex-wrap gap-2">
                <button type="button" className={`btn ${selected ? "btn-primary" : ""}`} onClick={() => choose(t.id)} aria-label={`${selected ? "Open in editor" : "Use this template"}: ${t.name}`}>
                  {selected ? "Open in editor" : "Use this template"}
                </button>
                <button type="button" className="btn btn-quiet" onClick={() => setPreview(t)}>Preview</button>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal open={!!preview} onClose={() => setPreview(null)} labelledBy="tpl-modal-h" wide testId="template-modal">
        {preview && (
          <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="rounded-[12px] bg-[var(--surface-2)] p-3 sm:p-6">
              <div className="paper-edge mx-auto max-w-[520px]"><Thumbnail doc={docFor(preview)} uid={`m-${preview.id}`} /></div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <h2 id="tpl-modal-h" className="serif text-[2rem] leading-tight">{preview.name}</h2>
                <button type="button" className="btn btn-quiet btn-icon -mr-2" aria-label="Close preview" onClick={() => setPreview(null)}><IconClose /></button>
              </div>
              <p className="mt-3 leading-relaxed text-[var(--text-muted)]">{preview.description}</p>
              <ul className="mt-5 space-y-2 text-[0.9375rem]">
                {["Single column, so text reads top to bottom", "Standard section headings", "Real, selectable text in the PDF"].map((x) => (
                  <li key={x} className="flex gap-2"><span className="mt-0.5 text-[var(--tick-text)]"><IconTick size={18} /></span>{x}</li>
                ))}
              </ul>
              <div className="mt-auto flex flex-wrap gap-2 pt-8">
                <button type="button" className="btn btn-primary" data-autofocus onClick={() => choose(preview.id)}>Use this template</button>
                <button type="button" className="btn" onClick={() => setPreview(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
