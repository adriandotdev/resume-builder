export interface Group { id: string; title: string; lead: string; items: { name: string; text: string }[] }

/** Every capability the app has, grouped by the job it does. Keep in step with PRODUCT.md. */
export const GROUPS: Group[] = [
  {
    id: "build",
    title: "Build the resume",
    lead: "Fill in one form and watch the page take shape.",
    items: [
      { name: "Twelve templates", text: "All single-column and built on one structure, so switching keeps everything you typed." },
      { name: "Live preview", text: "The page redraws beside the form as you type." },
      { name: "Nine kinds of section", text: "Contact, summary, experience, education, skills, projects, certifications, languages and custom." },
      { name: "Reorder and hide", text: "Drag sections into order or move them with the keyboard. Switch one off to leave it out of the PDF without deleting it." },
      { name: "Design controls", text: "Accent colour, font, text size, line spacing, margins and date format." },
      { name: "A4 or US Letter", text: "The preview, the page estimate and the PDF all follow the paper you pick." },
      { name: "Phone, desktop and dark mode", text: "The editor works at phone widths too, in light or dark." },
    ],
  },
  {
    id: "check",
    title: "Check how it reads",
    lead: "See the resume the way a tracking system might.",
    items: [
      { name: "ATS checklist", text: "Standard headings, contact details in the body, consistent dates and no empty sections, rechecked on every change." },
      { name: "Plain-text preview", text: "The exact lines a parser would pull from the text layer." },
      { name: "Parser simulation", text: "A naive parser reads your text into name, job title, employer, dates and skills, then lists where it goes wrong. Each finding jumps to the input to fix." },
      { name: "Bullet coach", text: "Flags weak openers, missing numbers, wrong tense, repeated verbs, passive voice and filler, quoting the phrase and jumping to that line." },
    ],
  },
  {
    id: "tailor",
    title: "Tailor it to a job",
    lead: "Rules and word lists, never a score to chase.",
    items: [
      { name: "Job match", text: "Paste a posting to see which key terms your resume already has, which are missing and which sections hold them." },
      { name: "Add to Skills", text: "One click files a missing term under Additional skills, with Undo. Or jump to the summary or first job to write the sentence yourself." },
      { name: "Spellings counted as one", text: "k8s and Kubernetes are the same skill, and it tells you which spelling you used." },
      { name: "By category", text: "Terms grouped into languages, cloud and DevOps and more, filed under the matching Skills group." },
      { name: "Across all your postings", text: "Found counts per posting, and the terms missing from more than one." },
    ],
  },
  {
    id: "versions",
    title: "Keep one for every role",
    lead: "Frontend, backend, QA: each its own resume.",
    items: [
      { name: "Named versions", text: "Each has its own content, design, template and job posting. Add, duplicate, rename or delete, with Undo." },
      { name: "Compare versions", text: "Lines added and removed per section, and which key terms each version covers." },
      { name: "Cover letters", text: "One per version, with your name and contact filled in from the resume, company and role fields, and talking points from job match." },
      { name: "Application tracker", text: "Company, role, status, dates, link and notes for each application, tied to the version you sent and a copy of its posting." },
    ],
  },
  {
    id: "finish",
    title: "Finish on one page",
    lead: "Then save a PDF that is text, not a picture.",
    items: [
      { name: "Fit to one page", text: "Finds the smallest change to line spacing, margins or font size that fits, checked on the real template. Apply it, or Undo. Never touches your wording." },
      { name: "Where to cut", text: "When style alone is not enough, it lists what to trim and jumps to the line." },
      { name: "Page estimate", text: "“About 1 page” updates as you type or change the layout." },
      { name: "PDF with real text", text: "Save as PDF from the print dialog. Every word can be selected, searched and copied, and there is no watermark." },
    ],
  },
  {
    id: "keep",
    title: "Keep your work safe",
    lead: "Stored here, on this device, and easy to move.",
    items: [
      { name: "Saved as you type", text: "In this browser’s local storage. If storage is blocked, the editor says so and keeps working." },
      { name: "JSON export and import", text: "Back up one version or all of them with your applications. Imports are checked first, and a bad file changes nothing." },
      { name: "Encrypted backups", text: "Protect an export with a passphrase, encrypted in the browser. There is no recovery, so keep the passphrase." },
      { name: "Backup reminders", text: "Shows when you last backed up and nudges you after seven days of unsaved changes." },
    ],
  },
];
