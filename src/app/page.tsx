import Link from "next/link";
import { SplitStory } from "@/components/HeroSheet";
import { Showcase } from "@/components/Showcase";
import { StartForm } from "@/components/StartForm";
import { Reveal } from "@/components/Reveal";
import { Thumbnail } from "@/components/Thumbnail";
import { IconAlert, IconDownload, IconGrip, IconTick, IconWarn } from "@/components/icons";
import { createSampleDoc } from "@/lib/sample";
import { runAtsChecks } from "@/lib/ats";
import type { TemplateId } from "@/lib/schema";

const PROMISES = ["Free, with no account", "Stays in this browser", "Real text in the PDF"];

const QUESTIONS: { q: string; a: string; id?: string }[] = [
  { id: "privacy", q: "Where is my resume stored?", a: "In this browser’s local storage, on this device only. Nothing is sent to a server, and there is no analytics or tracking." },
  { q: "Does it cost anything?", a: "No. There is no account to create, no paid tier and no watermark on the PDF." },
  { q: "How do I back it up or move it?", a: "In the editor’s Data tab, Export JSON downloads resume.json. Import JSON on another browser or device brings it back." },
  { q: "What if an import goes wrong?", a: "The file is checked before anything changes. A file that does not validate is rejected and your current resume stays exactly as it was." },
  { q: "What if my browser blocks storage?", a: "The editor still works, and it tells you that changes will not be kept. Export JSON before you close the tab." },
  { q: "How does the PDF get made?", a: "Download PDF opens your browser’s print dialog. Choose Save as PDF and turn off headers and footers. The paper size is already set." },
  { q: "Is the text in the PDF real?", a: "Yes. The page is printed, not turned into a picture, so every word can be selected, searched and copied." },
  { q: "A4 or US Letter?", a: "Both. Pick one in the editor and the preview, the page estimate and the PDF all follow it." },
  { q: "Will switching templates lose my work?", a: "No. Templates change how the page is set, never what it says. Everything you typed carries over." },
  { q: "What does the ATS check do?", a: "It runs rules drawn from common practice, such as standard headings and consistent dates. It is a checklist, not a score from a real tracking system." },
  { q: "Can I hide a section without deleting it?", a: "Yes. Switch it off and it stays saved in the editor but is left out of the preview and the PDF." },
  { q: "How do I know it fits on one page?", a: "The preview shows an estimate, such as “About 1 page”, that updates as you type, change the font size or change margins." },
];

const THUMBS: TemplateId[] = ["elegant", "modern", "compact"];

export default function Home() {
  const sample = createSampleDoc();
  const checks = runAtsChecks(sample).slice(0, 4);

  return (
    <>
      <Reveal />
      <SplitStory>
        <section className="hero-card" aria-labelledby="hero-h" data-scene="0">
          <div className="hero-mid">
            <h1 id="hero-h" className="display hero-h">One page, two readers</h1>
            <p className="hero-sub">A free resume builder with single-column templates, a live preview and a PDF with real, selectable text. Nothing leaves your browser.</p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <Link href="/editor" className="btn btn-accent btn-lg">Start your resume</Link>
              <Link href="/templates" className="text-link">Browse templates</Link>
            </div>
          </div>
          <ul className="hero-promises" aria-label="What you get">
            {PROMISES.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </section>

        <section className="how" aria-labelledby="how-h">
          <h2 id="how-h" className="display how-h" data-reveal>From template to PDF</h2>

          <div className="how-stage" data-scene="1" data-reveal>
            <p><strong>To begin,</strong> pick one of twelve single-column templates. They share one structure: your name as the title, standard section headings and real lists, so switching later keeps everything you typed.</p>
            <ul className="how-thumbs" aria-hidden="true">
              {THUMBS.map((id) => (
                <li key={id} className="paper-edge" data-ui><Thumbnail doc={{ ...sample, style: { ...sample.style, template: id } }} uid={`how-${id}`} /></li>
              ))}
            </ul>
          </div>

          <div className="how-stage" data-scene="2" data-reveal>
            <p><strong>As you type,</strong> the preview redraws beside the form. Drag sections into the order that suits you, or move them with the keyboard. Switch one off to leave it out of the PDF without deleting it.</p>
            <div className="how-frag" data-ui aria-hidden="true">
              {[["Contact", true], ["Summary", true], ["Experience", true], ["Certifications", false]].map(([t, on]) => (
                <div key={String(t)} className="frag-row">
                  <span className="text-[var(--text-muted)]"><IconGrip size={18} /></span>
                  <span className={`flex-1 font-semibold ${on ? "" : "text-[var(--text-muted)]"}`}>{t}</span>
                  {!on && <span className="text-sm text-[var(--text-muted)]">Hidden</span>}
                  <span className="frag-switch" data-on={on} />
                </div>
              ))}
              <p className="frag-foot">About 1 page</p>
            </div>
          </div>

          <div className="how-stage" data-scene="3" data-reveal>
            <p><strong>Before you save,</strong> the ATS check reruns on every change: standard headings, contact details in the body, consistent dates, no empty sections. It is a checklist from common practice, not a score from a real tracking system.</p>
            <ul className="how-frag" data-ui aria-hidden="true">
              {checks.map((c) => (
                <li key={c.id} className="frag-row items-start">
                  <span className={`mt-0.5 ${c.level === "pass" ? "text-[var(--tick-text)]" : "text-[var(--pen-text)]"}`}>{c.level === "pass" ? <IconTick size={18} /> : c.level === "fail" ? <IconAlert size={18} /> : <IconWarn size={18} />}</span>
                  <span className="flex-1 leading-snug">{c.message}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="how-stage" data-scene="4" data-reveal>
            <p><strong>To finish,</strong> Download PDF opens your browser’s print dialog. Choose Save as PDF and turn off headers and footers. The page is printed, not photographed, so every word in the file stays selectable.</p>
            <div className="how-frag" data-ui aria-hidden="true">
              <p className="frag-title">Save as PDF</p>
              <ol className="mt-3 space-y-2">
                {["Set the destination to Save as PDF.", "Turn off Headers and footers.", "Paper is already set to A4."].map((t) => (
                  <li key={t} className="flex gap-2.5"><span className="mt-0.5 text-[var(--tick-text)]"><IconTick size={18} /></span>{t}</li>
                ))}
              </ol>
              <span className="btn btn-primary mt-5"><IconDownload size={18} />Open print dialog</span>
            </div>
          </div>
        </section>
      </SplitStory>

      <Showcase />

      <section id="questions" className="faq" aria-labelledby="faq-h">
        <div data-reveal>
          <h2 id="faq-h" className="display faq-h">Questions</h2>
          <p className="faq-sub">Where your resume lives, and how you get it out.</p>
        </div>
        <div className="faq-cols" data-reveal>
          {QUESTIONS.map((x) => (
            <p key={x.q} id={x.id}><strong>{x.q}</strong> {x.a}</p>
          ))}
        </div>
      </section>

      <section className="cta" aria-labelledby="cta-h">
        <div className="cta-text" data-reveal>
          <h2 id="cta-h" className="display cta-h">Start with your name</h2>
          <p className="cta-sub">The editor opens with a blank page and your name at the top, or with the sample if you leave the name empty. Either way it is saved in this browser as you type.</p>
        </div>
        <div className="cta-form" data-reveal>
          <StartForm />
        </div>
      </section>
    </>
  );
}
