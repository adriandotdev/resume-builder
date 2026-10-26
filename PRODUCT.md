# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Any job seeker** who needs a clean, ATS-safe resume quickly, on desktop or phone. They pick a template, fill in their details, and leave with a PDF they can submit. No account and no prior setup.

## Product Purpose

A free, private resume builder. People choose a single-column template, edit content, style and section order with a live preview, check an ATS checklist and plain-text preview, and save a PDF through the browser's print dialog. Success is a resume that applicant tracking software can parse and a person can skim, produced without signing up or handing data to anyone.

## Positioning

Three promises, all binding (confirmed with the user):

1. **Free, no account.** No sign-up, no paywall, no watermark on the PDF.
2. **Nothing leaves the browser.** The resume lives only in this browser's localStorage. No upload, analytics, tracking or third-party request.
3. **ATS-safe, real text.** Single-column templates with standard headings, and a PDF whose text stays selectable because the page is printed, not rasterized.

## Operating Context

- Routes: `/` (landing), `/templates` (gallery of 12 templates with live thumbnails rendered from sample data), `/editor` (content, style, sections, ATS panel, data panel, live preview), `/print` (clean render of the saved resume).
- PDF export is `window.print()`: users pick "Save as PDF" and turn off headers and footers. `print.css` hides chrome; an injected `@page` rule sets paper size (A4 or US Letter) and margins.
- Backup and moving devices happen through JSON export/import in the editor's Data tab. Export saves the open version (or all versions as one bundle). Imports are validated and migrated, and always add a new version; a bad file changes nothing.
- Resume versions: a person keeps several named resumes (for example Frontend, Backend, QA), each with its own content, style, template and job posting, switched from the editor bar. The index is `resume-builder:versions:v1`; each version's doc is `resume-builder:doc:v1:<id>`. A resume saved before versions existed becomes "My resume" on first load (the old key is left in place, unused). The last version cannot be deleted; deleting offers Undo. If storage is blocked, the app still works (versions live in memory for the session) and warns that changes will not persist. Clearing site data removes every version.
- A job posting pasted into the ATS tab's "Match a job posting" section stays in localStorage under `resume-builder:jd:v1:<id>`, one per version, separate from the resume. Missing terms can be added to the resume's Skills with one click (an "Additional skills" group, with Undo) or jumped to in the summary or the first job's achievements, where the user writes the sentence. The posting itself is never exported or uploaded, and only its Clear button (or deleting its version) removes it.
- The Coach tab checks bullets in Experience, Projects and Education with local wording rules: weak openers, missing numbers, tense in past roles, repeated verbs, passive voice and filler. Each suggestion quotes the phrase it is about and jumps to that line in Content. It gives suggestions, never a score, and it only judges tense for roles that are no longer current.
- Works on phone widths as well as desktop (the e2e run covers a mobile pass).

## Capabilities and Constraints

- **No backend or network:** no database, API routes, analytics or third-party requests. Fonts are self-hosted at build time by `next/font`. Binding.
- **Single column only:** every template shares one semantic DOM (`h1` name, `h2` standard section headings, `h3` entries, real `ul/li`), with no tables, icons or images in the resume body. Binding. Avoid `position: relative` on text blocks and large `letter-spacing`; both scrambled or split text in the PDF text layer during testing.
- **Clean-room originality:** nothing copied from FlowCV or any other builder: no code, copy, fonts, icons or template artwork. Behavior comes only from `../resume-builder-spec.md`. Binding.
- Sections: contact, summary, experience, education, skills, projects, certifications, languages, custom. Reorder by drag and by keyboard up/down buttons.
- Style controls: accent color, font family, base font size, line spacing, margins, page size, date format, per-section visibility.
- Out of scope without a backend: PDF/DOCX import parsing, AI writing, cross-device sync, share links.
- Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Vitest; `playwright-core` and `pdfjs-dist` for e2e and PDF text-layer checks.

## Evidence on Hand

- Fictional sample resume in `src/lib/sample.ts`; 12 original templates in `src/templates/`.
- Verification scripts in `scripts/` (e2e, PDF text-layer check, contrast check).
- No testimonials, user counts, customer logos or benchmarks exist. Do not fabricate any, and do not claim guaranteed ATS results: templates "follow common ATS-safe practices".

## Product Principles

- Privacy is structural, not a setting: no feature may send resume data off the device.
- Output correctness over decoration: anything that risks the PDF text layer or ATS parsing loses.
- Get people to a finished PDF fast: no sign-up, no gate, sensible defaults.
- Never lose the user's work: validated imports, safe storage fallbacks, clear prompts to back up.

## Accessibility & Inclusion

WCAG 2.2 AA is required for the app UI. `scripts/contrast.mjs` checks token contrast in light and dark themes.
