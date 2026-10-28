# Roadmap

What gets built next, in order. Items are worked one at a time, top to bottom within each stage. No dates are promised.

## Where we stand

Shipped: 12 single-column templates, editor with reorder and hide, design controls, ATS checks, rule-based job match (write-in and add-to-Skills, synonym groups so k8s counts as Kubernetes, a by-category view that files added terms under a matching Skills group, and coverage across every saved posting), named resume versions with per-version job postings, JSON backup and import, a local application tracker, a template-driven cover letter per version (name and contact from the resume, company and role fields, talking points from job match, same print pipeline), version compare (per-section line diff and key-term coverage for two versions), a rule-based bullet coach (weak openers, missing numbers, tense, repeated verbs, passive, filler; each finding jumps to its bullet), an ATS parse simulator (reads the text layer into fields and flags where parsing fails; each finding jumps to its input), a one-page fit assistant (finds the smallest line-spacing, margin or font-size change that fits one page, checked on the real template, with Apply and Undo; lists where to cut when style alone is not enough), passphrase-encrypted JSON backup with a last-backup line and a 7-day reminder, print-to-PDF with a real text layer, light and dark themes, WCAG 2.2 AA.

Most builders compete on templates, AI writing and accounts. This one cannot and will not, so the roadmap leans into what that rules in: provable privacy, verifiable ATS output, rule-based tailoring per job, and work that never gets lost.

## Will not build

- **AI writing, accounts, cross-device sync, share links:** they need a backend or send resume data off the device (see `PRODUCT.md`).
- **A single ATS or match score:** checks and matches stay explainable. No score to chase.
- **Decorative templates:** no columns, icons, images, tables or photos in the resume body.

## Now

1. **Installable offline PWA:** works with the network off, with a visible "no network requests" self-check and a strict CSP, so the privacy promise can be tested by anyone.

## Later

2. **Standard formats:** JSON Resume import and export, plain-text and Markdown export, client-side DOCX export built from the same semantic DOM.
3. **Redacted share copy:** one click produces a version without contact details or identifying fields, for bias-blind applications.
4. **Locale support:** date formats, A4 and Letter defaults, RTL and non-Latin fonts checked against the PDF text layer (extends `scripts/pdf-matrix.mjs`).
5. **Verified-export report:** after printing, a local check that the PDF text layer reads in the right order, reusing the `pdfjs-dist` approach from the scripts.

## Exploring (needs a decision, not committed)

- **Local PDF/DOCX import:** `pdfjs-dist` runs in the browser, so this may not need a backend. `PRODUCT.md` lists import parsing as out of scope; revisit that line first.
- **On-device AI:** only if a model runs fully in the browser, is opt-in, and makes zero network requests after load. Conflicts with the "no AI writing" line, so it needs an explicit product decision.

## Housekeeping

- The e2e and PDF check scripts in `scripts/` (including `scripts/e2e-backup.mjs`) are not in CI. Decide whether to wire them in.
- `scripts/e2e.mjs` fails four checks on `main` as well as on this branch (found by running both): "Add to Skills moves the term to Found", "Delete removes the version and offers Undo", "migration: the old single resume opens unchanged" and "prefers-reduced-motion removes transitions". The versions step also races the section-list transition (two "Full name" fields coexist for a moment), which stops the run there unless it waits.
- `scripts/pdf-matrix.mjs` reads the unversioned `resume-builder:doc:v1` key and exits with "could not read base doc", because the key now carries a version id.
- No component or DOM tests exist. The bullet coach has pure-function tests in `tests/coach.test.ts` and an e2e step; the panel itself still has no DOM test. The Fit tab is the same: `tests/fit.test.ts` covers the pure logic and `scripts/e2e.mjs` step 4d covers the panel.

## How items get chosen

An item must pass all three tests:

1. It keeps resume data on the device.
2. It keeps the output ATS-safe.
3. It helps someone finish a better-targeted resume faster.
