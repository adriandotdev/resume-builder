# Resume Builder

A free, private, ATS-friendly resume builder. Next.js (App Router) + TypeScript + Tailwind. No database, no API routes, no analytics and no third-party network calls. System fonts only.

Everything is original: templates, sample data (a fictional person), copy and styling were written from a behavior spec (`../resume-builder-spec.md`) only.

## Run

Requires Node 20+ (developed on Node 24.12 via nvm).

```bash
export PATH=~/.nvm/versions/node/v24.12.0/bin:$PATH   # if you use nvm like the rest of this workspace
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
npm test             # Vitest: schema, migration, store, import validation, ATS rules
npm run typecheck    # tsc --noEmit
npm run lint
```

Optional end-to-end checks (need a running server and a local Chrome; uses `playwright-core` and `pdfjs-dist`, no browser download):

```bash
npm run build && npm start -- -p 3100 &
npm run e2e          # gallery -> editor -> style -> reorder -> reload -> JSON round trip -> PDFs -> mobile
npm run pdf-check    # prints every template at A4 and Letter and verifies the PDF text layer
```

Set `CHROME=/path/to/chrome` if Chrome is not at the macOS default path.

## Using it

- `/templates`: gallery of 12 single-column templates with live thumbnails from sample data.
- `/editor`: edit content, style and sections, with a live preview and an ATS text preview.
- `/print`: clean view of the saved resume (same renderer). The editor's "Print / Save as PDF" calls `window.print()`; `print.css` hides all chrome and an injected `@page` rule sets paper size and margins. Choose "Save as PDF" and turn off headers and footers. Text stays selectable.
- Export/import JSON in "Your data" to back up or move a resume. Imports are validated and migrated; a bad file never changes your current resume.

## Privacy

The resume lives in `localStorage` (key `resume-builder:doc:v1`) in your browser only. Nothing is uploaded. Clearing site data removes it, so export JSON for a backup. If storage is blocked the app still works and warns that changes will not persist.

## Layout

```
src/lib/schema.ts      ResumeDoc types, defaults, validator, migrations (v0 -> v1), date formatting
src/lib/store.ts       framework-free store + useSyncExternalStore hooks, debounced localStorage, SSR-safe
src/lib/ops.ts         pure reorder/add/remove/patch helpers
src/lib/ats.ts         ATS checklist rules + page-length estimate
src/lib/plaintext.ts   plain-text (ATS) rendering
src/lib/sample.ts      fictional sample document
src/templates/         ResumeBody (shared semantic DOM), 12 template components, registry
src/styles/            resume.css (template variants), print.css
src/components/        editor panels, preview, thumbnails
src/app/               /, /templates, /editor, /print
tests/                 Vitest suites
scripts/               e2e.mjs, pdf-check.mjs, pdftext.mjs (dev verification tools)
```

## ATS-safety notes

All templates share one DOM: `h1` name, `h2` sections with standard headings, `h3` entries, real `ul/li`, no tables, images or icons. Avoid `position: relative` on text blocks and large `letter-spacing`: both were found to scramble or split text in the PDF text layer during testing.
