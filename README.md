# Resume Builder

A free, private, ATS-friendly resume builder. Next.js (App Router) + TypeScript + Tailwind. No database, no API routes, no analytics and no third-party network calls. The app's own fonts are self-hosted, and resumes use system fonts.

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
- Job match: in the ATS tab, paste a job posting to see which of its key terms already appear in your resume, which are missing, and which sections hold them. It uses plain rules, not AI, and shows counts and term lists, not a score. Each missing term has an "Add to Skills" button that puts it in an "Additional skills" group (with Undo). "Write in Summary" and "Write in Experience" take you to that text box so you can work the term into a sentence. Add only terms that truly describe your experience.
- Versions: keep one resume per role (Frontend, Backend, QA, ...). Use the Version picker in the editor bar and "Manage" to add, duplicate, rename or delete (with Undo). Each version has its own content, design and job posting. Your resume from before versions existed appears as "My resume".
- Compare versions: in "Manage", "Compare versions" shows what changed going from one version to another: per section, the lines added and removed (marked with +, − and words, not color alone), plus which key terms of a job posting each version covers (in both, only one, in neither). Counts and lists, no score. Read-only; nothing is stored.
- Applications: the Applications page tracks where each version went (company, role, status, dates, link, notes). Each application links a resume version and keeps its own copy of the job posting, so later edits to a version's posting do not change it. Deleting a version keeps the application and shows the version name as deleted.
- Export/import JSON in "Your data" to back up or move a resume. Export saves the open version, or all versions as one file that also includes your applications (and their posting copies). Importing that file re-links applications to the new versions. Imports are validated and migrated, and always add a new version; a bad file changes nothing.

## Privacy

Resumes live in `localStorage` in your browser only: a version list under `resume-builder:versions:v1` and each version's resume under `resume-builder:doc:v1:<id>`. Applications are kept under `resume-builder:applications:v1`. A pasted job posting is kept per version under `resume-builder:jd:v1:<id>`, is never part of the version export (the copy saved on an application is), and is removed only by its Clear button or by deleting its version. Nothing is uploaded. Clearing site data removes it, so export JSON for a backup. If storage is blocked the app still works and warns that changes will not persist.

## Layout

```
src/lib/schema.ts      ResumeDoc types, defaults, validator, migrations (v0 -> v1), date formatting
src/lib/store.ts       framework-free store + useSyncExternalStore hooks, debounced localStorage, SSR-safe; holds the open version's doc
src/lib/versions.ts    version index, storage keys, first-run migration of a pre-versions resume, name helpers
src/lib/versionsStore.ts  create/duplicate/rename/delete/switch versions on top of the stores
src/lib/ops.ts         pure reorder/add/remove/patch helpers
src/lib/ats.ts         ATS checklist rules + page-length estimate
src/lib/plaintext.ts   plain-text (ATS) rendering, per section and whole resume
src/lib/jobmatch.ts    job-posting key-term extraction and matching against the resume
src/lib/applications.ts  application records, validation and id remapping for imports
src/lib/applicationsStore.ts  store and hook for the application list
src/lib/jobPostingStore.ts  store for the open version's pasted posting (own localStorage key)
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
