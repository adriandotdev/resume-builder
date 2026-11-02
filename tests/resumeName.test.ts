import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createSampleDoc } from "@/lib/sample";
import { defaultLetter } from "@/lib/cover";
import { CoverLetterBody } from "@/components/CoverPreview";
import { ResumeBody } from "@/templates/ResumeBody";
import { TEMPLATES } from "@/templates/registry";

// The name is an h1 in the editor, print and cover letter, and a styled p in marketing thumbnails.
// The template CSS targets .resume-name, so every name element must carry that class.
describe("resume name element", () => {
  const doc = createSampleDoc();

  it("renders the resume name as an h1 by default", () => {
    const html = renderToStaticMarkup(createElement(ResumeBody, { doc, className: "tpl-classic" }));
    expect(html).toMatch(/<h1 class="resume-name">/);
  });

  it("renders the resume name as a p when decorative, with no h1", () => {
    const html = renderToStaticMarkup(createElement(ResumeBody, { doc, className: "tpl-classic", decorative: true }));
    expect(html).toMatch(/<p class="resume-name">/);
    expect(html).not.toMatch(/<h1/);
  });

  it("gives the cover letter name the resume-name class", () => {
    const html = renderToStaticMarkup(createElement(CoverLetterBody, { doc, letter: defaultLetter() }));
    expect(html).toMatch(/<h1 class="resume-name">/);
  });

  it("gives every template's name element the resume-name class", () => {
    for (const t of TEMPLATES) {
      const html = renderToStaticMarkup(createElement(t.Component, { doc: { ...doc, style: { ...doc.style, template: t.id } } }));
      expect(html, t.id).toMatch(/<h1 class="resume-name">/);
    }
  });
});
