# Roadmap

What gets built next, in order. Items are worked one at a time, top to bottom within each stage. No dates are promised.

## Where we stand

Shipped: 12 single-column templates, editor with reorder and hide, design controls, ATS checks, rule-based job match (write-in and add-to-Skills), named resume versions with per-version job postings, JSON backup and import, print-to-PDF with a real text layer, light and dark themes, WCAG 2.2 AA.

Most builders compete on templates, AI writing and accounts. This one cannot and will not, so the roadmap leans into what that rules in: provable privacy, verifiable ATS output, rule-based tailoring per job, and work that never gets lost.

## Will not build

- **AI writing, accounts, cross-device sync, share links:** they need a backend or send resume data off the device (see `PRODUCT.md`).
- **A single ATS or match score:** checks and matches stay explainable. No score to chase.
- **Decorative templates:** no columns, icons, images, tables or photos in the resume body.

## Now

1. **Application tracker (local):** each application links a resume version, a saved job posting, a status and dates. Competitors gate this behind accounts. Builds on `src/lib/versions.ts` and `src/lib/jobPostingStore.ts`.
2. **Cover letter, template-driven:** name and contact come from the resume, company and role from the posting, matched terms from job match as suggested talking points. Editable blocks, exported through the existing print pipeline. No AI.
3. **Version diff:** compare two versions side by side (sections, bullets, keywords covered) so tailoring is visible.

## Next

4. **Bullet coach (rules, not AI):** flags weak openers, missing numbers, tense mismatch, repeated verbs, passive phrasing and filler. Same pattern as `src/lib/ats.ts`.
5. **ATS parse simulator:** shows how a parser would split the real text layer into fields (name, employers, titles, dates, skills), so users see failures instead of a score. Extends `src/lib/plaintext.ts`.
6. **One-page fit assistant:** suggests the smallest change that fits a page (spacing, margins, trim candidates) without breaking the layout.
7. **Job match v2:** synonym and variant groups (for example k8s and Kubernetes), a skills-category view, and coverage across every saved posting. Still no score.
8. **Encrypted backup:** passphrase-protected JSON using WebCrypto, plus backup reminders. Extends `DataPanel.tsx`.

## Later

9. **Installable offline PWA:** works with the network off, with a visible "no network requests" self-check and a strict CSP, so the privacy promise can be tested by anyone.
10. **Standard formats:** JSON Resume import and export, plain-text and Markdown export, client-side DOCX export built from the same semantic DOM.
11. **Redacted share copy:** one click produces a version without contact details or identifying fields, for bias-blind applications.
12. **Locale support:** date formats, A4 and Letter defaults, RTL and non-Latin fonts checked against the PDF text layer (extends `scripts/pdf-matrix.mjs`).
13. **Verified-export report:** after printing, a local check that the PDF text layer reads in the right order, reusing the `pdfjs-dist` approach from the scripts.

## Exploring (needs a decision, not committed)

- **Local PDF/DOCX import:** `pdfjs-dist` runs in the browser, so this may not need a backend. `PRODUCT.md` lists import parsing as out of scope; revisit that line first.
- **On-device AI:** only if a model runs fully in the browser, is opt-in, and makes zero network requests after load. Conflicts with the "no AI writing" line, so it needs an explicit product decision.

## Housekeeping

- `README.md` says "System fonts only" but `PRODUCT.md` and `DESIGN.md` use self-hosted Young Serif and Source Serif 4. Fix the README.
- The e2e and PDF check scripts in `scripts/` are not in CI. Decide whether to wire them in.
- No component or DOM tests exist. Add them as the tracker and bullet coach land.

## How items get chosen

An item must pass all three tests:

1. It keeps resume data on the device.
2. It keeps the output ATS-safe.
3. It helps someone finish a better-targeted resume faster.
