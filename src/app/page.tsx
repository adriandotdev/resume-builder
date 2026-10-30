import { Fragment, type CSSProperties } from "react";
import Link from "next/link";
import { SplitStory } from "@/components/HeroSheet";
import { Features } from "@/components/Features";
import { Showcase } from "@/components/Showcase";
import { StartForm } from "@/components/StartForm";
import { Reveal } from "@/components/Reveal";
import { HowChecks, HowPrint, HowSections, HowThumbs } from "@/components/HowFrags";
import { createSampleDoc } from "@/lib/sample";
import { runAtsChecks } from "@/lib/ats";

const HERO = "One page, two readers".split(" ");
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

export default function Home() {
  const sample = createSampleDoc();
  const checks = runAtsChecks(sample).slice(0, 4);

  return (
    <>
      <Reveal />
      <SplitStory checks={checks}>
        <section className="hero-card" aria-labelledby="hero-h" data-scene="0">
          <div className="hero-mid">
            <h1 id="hero-h" className="display hero-h">{HERO.map((w, i) => <Fragment key={i}><span className="hw" style={{ "--i": i } as CSSProperties}>{w}</span>{" "}</Fragment>)}</h1>
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
            <HowThumbs />
          </div>

          <div className="how-stage" data-scene="2" data-reveal>
            <p><strong>As you type,</strong> the preview redraws beside the form. Drag sections into the order that suits you, or move them with the keyboard. Switch one off to leave it out of the PDF without deleting it.</p>
            <HowSections />
          </div>

          <div className="how-stage" data-scene="3" data-reveal>
            <p><strong>Before you save,</strong> the ATS check reruns on every change: standard headings, contact details in the body, consistent dates, no empty sections. It is a checklist from common practice, not a score from a real tracking system.</p>
            <HowChecks checks={checks} />
          </div>

          <div className="how-stage" data-scene="4" data-reveal>
            <p><strong>To finish,</strong> Download PDF opens your browser’s print dialog. Choose Save as PDF and turn off headers and footers. The page is printed, not photographed, so every word in the file stays selectable.</p>
            <HowPrint />
          </div>
        </section>
      </SplitStory>

      <Features checks={checks} />

      <Showcase />

      <section id="questions" className="faq" aria-labelledby="faq-h">
        <div data-reveal>
          <h2 id="faq-h" className="display faq-h">Questions</h2>
          <p className="faq-sub">Where your resume lives, and how you get it out.</p>
        </div>
        <div className="faq-cols" data-reveal>
          {QUESTIONS.map((x, i) => (
            <p key={x.q} id={x.id} style={{ "--i": i } as CSSProperties}><strong>{x.q}</strong> {x.a}</p>
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
