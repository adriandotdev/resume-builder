"use client";
import type { CSSProperties } from "react";
import { FONTS, type ResumeDoc } from "@/lib/schema";
import { renderBlocks, contactOf, type CoverLetter } from "@/lib/cover";

/**
 * The letter as one semantic DOM, styled by the resume's template, accent and font so the two
 * documents match: an h1 name, the contact list, then plain paragraphs. No tables, icons or images.
 */
export function CoverLetterBody({ doc, letter }: { doc: ResumeDoc; letter: CoverLetter }) {
  const { style } = doc;
  const vars = {
    "--r-accent": style.accent,
    "--r-font": FONTS[style.font].stack,
    "--r-size": `${style.fontSize}pt`,
    "--r-lh": String(style.lineSpacing),
  } as CSSProperties;
  const c = contactOf(doc);
  const bits = c ? [c.email, c.phone, c.location, ...c.links].filter((x) => x.trim()) : [];
  const blocks = renderBlocks(doc, letter);
  return (
    <article className={`resume tpl-${style.template}`} style={vars} data-resume data-letter>
      <header className="resume-head">
        {c?.fullName && <h1>{c.fullName}</h1>}
        {c?.headline && <p className="headline">{c.headline}</p>}
        {bits.length > 0 && <ul className="contact-list">{bits.map((b, i) => <li key={i}>{b}</li>)}</ul>}
      </header>
      <div className="letter-body">
        {blocks.map((b) => (
          <div key={b.id} className="letter-block">
            {b.lines.map((l, i) => (l ? <p key={i}>{l}</p> : null))}
          </div>
        ))}
      </div>
    </article>
  );
}
