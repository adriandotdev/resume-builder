"use client";
import { AnimatePresence, motion } from "motion/react";
import { SegButton } from "@/components/controls";
import { EASE } from "@/lib/motion";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useResumeDoc, resumeStore } from "@/lib/store";
import { toPlainText } from "@/lib/plaintext";
import { runAtsChecks } from "@/lib/ats";
import { runCoach } from "@/lib/coach";
import { runParseSim } from "@/lib/parsesim";
import { TEMPLATES } from "@/templates/registry";
import { PAGE_SIZES, type PageSizeId, type TemplateId } from "@/lib/schema";
import { patchStyle } from "@/lib/ops";
import { ResumePreview } from "@/components/ResumePreview";
import { SectionList } from "@/components/SectionList";
import { StylePanel } from "@/components/StylePanel";
import { AtsPanel } from "@/components/AtsPanel";
import type { BulletJump, FieldJump, WriteInTarget } from "@/lib/ops";
import { CoachPanel } from "@/components/CoachPanel";
import { ParsePanel } from "@/components/ParsePanel";
import { DataPanel } from "@/components/DataPanel";
import { CoverPanel } from "@/components/CoverPanel";
import { CoverLetterBody } from "@/components/CoverPreview";
import { useCoverLetter } from "@/lib/coverStore";
import { letterPlainText } from "@/lib/cover";
import { ExportDialog } from "@/components/ExportDialog";
import { SaveStatus } from "@/components/SaveStatus";
import { VersionSwitcher } from "@/components/VersionSwitcher";
import { IconClose, IconCoach, IconData, IconDoc, IconDownload, IconEdit, IconEye, IconPalette, IconParse, IconShield } from "@/components/icons";
import { useMediaQuery } from "@/components/useMediaQuery";
import { useDialogFocus } from "@/components/useDialogFocus";
import { useToast } from "@/components/Toast";
import { isSampleDoc } from "@/lib/ui";

type Tab = "content" | "design" | "ats" | "parse" | "coach" | "letter" | "data";
type View = "design" | "ats";
type Zoom = "fit" | "actual";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "content", label: "Content", icon: <IconEdit size={20} /> },
  { id: "design", label: "Design", icon: <IconPalette size={20} /> },
  { id: "ats", label: "ATS check", icon: <IconShield size={20} /> },
  { id: "parse", label: "Parser", icon: <IconParse size={20} /> },
  { id: "coach", label: "Coach", icon: <IconCoach size={20} /> },
  { id: "letter", label: "Letter", icon: <IconDoc size={20} /> },
  { id: "data", label: "Data", icon: <IconData size={20} /> },
];

export default function EditorPage() {
  const doc = useResumeDoc();
  const letter = useCoverLetter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("content");
  const [toolsOpen, setToolsOpen] = useState(false); // tablet drawer
  const [pvOpen, setPvOpen] = useState(false); // phone full-screen preview
  const [exportOpen, setExportOpen] = useState(false);
  const [view, setView] = useState<View>("design");
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [pages, setPages] = useState(1);
  const [jump, setJump] = useState<BulletJump | FieldJump | null>(null); // asks Content to focus one bullet line
  const [writeIn, setWriteIn] = useState<WriteInTarget | null>(null); // asks Content to open and focus a field

  const isPhone = useMediaQuery("(max-width: 767.98px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023.98px)");
  const drawerActive = toolsOpen && isTablet;
  const sheetActive = pvOpen && isPhone;
  const isLetter = tab === "letter";

  const toolsRef = useRef<HTMLElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const closeTools = () => setToolsOpen(false);
  const closePv = () => setPvOpen(false);
  const toolsKeys = useDialogFocus(toolsRef, drawerActive, closeTools, '[role="tab"][aria-selected="true"]');
  const paneKeys = useDialogFocus(paneRef, sheetActive, closePv, "[data-autofocus]");

  useEffect(() => {
    if (!(drawerActive || sheetActive)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [drawerActive, sheetActive]);

  const issues = useMemo(() => runAtsChecks(doc).filter((c) => c.level !== "pass").length, [doc]);
  const parseCount = useMemo(() => runParseSim(doc).findings.length, [doc]);
  const coachCount = useMemo(() => runCoach(doc).length, [doc]);
  const isSample = isSampleDoc(doc);
  const contact = doc.sections.find((s) => s.type === "contact");
  const docName = contact?.type === "contact" ? contact.content.fullName.trim() : "";

  const onTabKey = (e: KeyboardEvent<HTMLElement>) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const n = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % TABS.length : (i - 1 + TABS.length) % TABS.length;
    setTab(TABS[n].id);
    requestAnimationFrame(() => document.getElementById(`tab-${TABS[n].id}`)?.focus());
  };
  const goTab = (t: Tab) => { setTab(t); setPvOpen(false); window.scrollTo({ top: 0 }); };

  const onWriteIn = (target: WriteInTarget, term: string) => {
    setWriteIn(target);
    setTab("content");
    toast.show({ message: `Write "${term}" into a sentence about work you have done.` });
  };

  const onJump = (target: BulletJump | FieldJump) => {
    setJump(target);
    setTab("content");
  };

  const startBlank = () => {
    const previous = resumeStore.getState();
    resumeStore.resetToBlank();
    toast.show({ message: "Started a blank resume.", actionLabel: "Undo", onAction: () => resumeStore.setDoc(previous) });
  };

  return (
    <div className="editor-root">
      <div className="editor-bar no-print z-30 md:sticky" style={{ top: "var(--header-h)", minHeight: "var(--bar-h)" }} inert={drawerActive || sheetActive}>
        <div className="flex min-h-[var(--bar-h)] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1 sm:px-6 md:flex-nowrap">
          <button type="button" className="btn hidden md:inline-flex lg:hidden" onClick={() => setToolsOpen(true)} aria-haspopup="dialog" data-testid="open-tools"><IconEdit size={18} />Edit resume</button>
          <div className="flex min-w-0 items-baseline gap-x-3 max-sm:basis-full max-sm:flex-col max-sm:gap-0">
            <h1 className="truncate text-base font-semibold" data-testid="doc-name">{docName || "Untitled resume"}<span className="sr-only">, resume editor</span></h1>
            <div className="min-w-0"><SaveStatus /></div>
          </div>
          <div className="flex items-center max-sm:basis-full md:ml-0 sm:ml-auto sm:shrink-0"><VersionSwitcher /></div>
          <button type="button" className="btn btn-primary hidden md:ml-auto md:inline-flex" onClick={() => setExportOpen(true)} data-testid="print-btn"><IconDownload size={18} />Download PDF</button>
        </div>
      </div>

      <div className="editor-grid">
        <AnimatePresence>
          {drawerActive && <motion.div className="drawer-scrim no-print" onClick={closeTools} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE }} />}
        </AnimatePresence>
        <aside ref={toolsRef} className="tools no-print" aria-label="Editing tools" data-open={drawerActive} onKeyDown={toolsKeys} role={drawerActive ? "dialog" : undefined} aria-modal={drawerActive || undefined} inert={sheetActive}>
          <div className="tools-head hidden items-center justify-between border-b border-[var(--line)] px-4 py-2 md:flex lg:hidden">
            <span className="serif text-xl">Edit resume</span>
            <button type="button" className="btn btn-quiet" onClick={closeTools}><IconClose size={18} />Close</button>
          </div>
          <div className="tools-tabs" role="tablist" aria-label="Editor sections" onKeyDown={onTabKey}>
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} className="rail-tab" aria-selected={tab === t.id} aria-controls="tools-panel" tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)}>
                {tab === t.id && <motion.span layoutId="rail-ind" className="rail-ind" transition={{ duration: 0.22, ease: EASE }} aria-hidden="true" />}
                {t.icon}<span>{t.label}</span>
                {t.id === "parse" && parseCount > 0 && <span className="badge badge-pen" style={{ minHeight: 22, padding: "0 .45rem" }}><span className="sr-only">{parseCount} to review</span><span aria-hidden="true">{parseCount}</span></span>}
                {t.id === "coach" && coachCount > 0 && <span className="badge badge-pen" style={{ minHeight: 22, padding: "0 .45rem" }}><span className="sr-only">{coachCount} to review</span><span aria-hidden="true">{coachCount}</span></span>}
                {t.id === "ats" && issues > 0 && <span className="badge badge-pen" style={{ minHeight: 22, padding: "0 .45rem" }}><span className="sr-only">{issues} to review</span><span aria-hidden="true">{issues}</span></span>}
              </button>
            ))}
          </div>
          <div className="tools-scroll">
            <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE }} id="tools-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="tools-body @container" tabIndex={-1}>
              {tab === "content" && (
                <div className="space-y-5">
                  {isSample && (
                    <div className="well p-4" data-testid="sample-notice">
                      <p className="font-semibold">This is sample content</p>
                      <p className="field-hint mt-1">Type over it with your own details, or clear it and start from empty sections.</p>
                      <button type="button" className="btn mt-3" onClick={startBlank}>Replace sample with a blank resume</button>
                    </div>
                  )}
                  <SectionList doc={doc} writeIn={writeIn} onWriteInDone={() => setWriteIn(null)} jump={jump} onJumpDone={() => setJump(null)} />
                </div>
              )}
              {tab === "design" && <StylePanel doc={doc} />}
              {tab === "ats" && <AtsPanel doc={doc} onWriteIn={onWriteIn} />}
              {tab === "parse" && <ParsePanel doc={doc} onJump={onJump} />}
              {tab === "coach" && <CoachPanel doc={doc} onJump={onJump} />}
              {tab === "letter" && <CoverPanel doc={doc} />}
              {tab === "data" && <DataPanel doc={doc} />}
            </motion.div>
          </div>
        </aside>

        <section ref={paneRef} className="pv-pane" data-open={sheetActive} aria-label={isLetter ? "Cover letter preview" : "Resume preview"} onKeyDown={paneKeys} role={sheetActive ? "dialog" : undefined} aria-modal={sheetActive || undefined} inert={drawerActive}>
          <div className="pv-toolbar no-print flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
            <button type="button" className="btn md:hidden" onClick={closePv} data-autofocus><IconClose size={18} />Back to editing</button>
            <div role="group" aria-label="Preview mode" className="seg">
              <SegButton group="pv-view" pressed={view === "design"} onClick={() => setView("design")}>Design preview</SegButton>
              <SegButton group="pv-view" pressed={view === "ats"} onClick={() => setView("ats")}>ATS text preview</SegButton>
            </div>
            {view === "design" && (
              <div role="group" aria-label="Zoom" className="seg">
                <SegButton group="pv-zoom" pressed={zoom === "fit"} onClick={() => setZoom("fit")}>Fit</SegButton>
                <SegButton group="pv-zoom" pressed={zoom === "actual"} onClick={() => setZoom("actual")}>100%</SegButton>
              </div>
            )}
            <span className="num text-sm text-[var(--text-muted)]" data-testid="page-count">About {pages} page{pages === 1 ? "" : "s"}</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 lg:ml-auto">
              <div className="field !flex-row items-center !gap-2">
                <label htmlFor="q-template" className="whitespace-nowrap">Template</label>
                <select id="q-template" className="input !w-auto" value={doc.style.template} onChange={(e) => resumeStore.update((d) => patchStyle(d, { template: e.target.value as TemplateId }))}>
                  {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="field !flex-row items-center !gap-2">
                <label htmlFor="q-page" className="whitespace-nowrap">Paper size</label>
                <select id="q-page" className="input !w-auto" value={doc.style.pageSize} onChange={(e) => resumeStore.update((d) => patchStyle(d, { pageSize: e.target.value as PageSizeId }))}>
                  {(Object.keys(PAGE_SIZES) as PageSizeId[]).map((k) => <option key={k} value={k}>{PAGE_SIZES[k].label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="pv-scroll" tabIndex={0} role="region" aria-label={isLetter ? "Cover letter preview, scrollable" : "Resume preview, scrollable"}>
            {view === "design" ? (
              <ResumePreview doc={doc} onPages={setPages} zoom={zoom} body={isLetter ? <CoverLetterBody doc={doc} letter={letter} /> : undefined} />
            ) : (
              <div className="no-print mx-auto max-w-[820px]">
                <p className="mb-3 text-[var(--text-muted)]">{isLetter ? "This is the letter as plain text, in reading order. Check that nothing is missing or out of order." : "This is the text an ATS would read, in reading order. Check that nothing is missing or out of order."}</p>
                <pre className="paper-edge whitespace-pre-wrap rounded-[var(--r-paper)] bg-white p-5 font-mono text-sm leading-relaxed text-[#17212b]" data-testid="ats-text"><mark className="text-[#17212b]" style={{ background: "var(--hl)", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{isLetter ? letterPlainText(doc, letter) : toPlainText(doc)}</mark></pre>
              </div>
            )}
            {view === "ats" && <div className="hidden print:block"><ResumePreview doc={doc} body={isLetter ? <CoverLetterBody doc={doc} letter={letter} /> : undefined} /></div>}
          </div>
        </section>
      </div>

      <nav className="bottom-bar no-print md:hidden" aria-label="Editor actions" inert={sheetActive}>
        <button type="button" className="bar-btn" aria-current={tab === "content" && !sheetActive ? "true" : undefined} onClick={() => goTab("content")}><IconEdit size={20} />Content</button>
        <button type="button" className="bar-btn" aria-current={tab === "design" && !sheetActive ? "true" : undefined} onClick={() => goTab("design")}><IconPalette size={20} />Design</button>
        <button type="button" className="bar-btn" onClick={() => setPvOpen(true)} aria-haspopup="dialog"><IconEye size={20} />Preview</button>
        <button type="button" className="bar-btn" onClick={() => setExportOpen(true)} aria-haspopup="dialog"><IconDownload size={20} />Export</button>
      </nav>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} doc={doc} kind={isLetter ? "letter" : "resume"} />
    </div>
  );
}
