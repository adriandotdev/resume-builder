// For every template: seed the sample doc, print /print to PDF with headless Chrome, extract the text layer with pdfjs-dist,
// then assert reading order, standard headings and that no sample text is missing. (pdftotext not installed.)
import { chromium } from "playwright-core";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = path.resolve("scripts/out/templates");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
// Template ids come from the gallery UI, so new templates are covered automatically.
const idPage = await browser.newPage();
await idPage.goto(`${BASE}/templates`);
await idPage.waitForSelector("[data-template]");
const IDS = await idPage.locator("[data-template]").evaluateAll((els) => els.map((e) => e.getAttribute("data-template")));
await idPage.close();
if (IDS.length < 12) { console.log(`FAIL  expected >= 12 templates, found ${IDS.length}`); process.exit(1); }

async function extract(file) {
  const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent();
    text += tc.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("") + "\n";
  }
  return { pages: pdf.numPages, text };
}
const TEMPLATE_NAMES = Object.fromEntries(IDS.map((i) => [i, i[0].toUpperCase() + i.slice(1)]));
let bad = 0;
for (const id of IDS) {
  for (const [ps] of [["a4"], ["letter"]]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/editor`);
    await page.waitForSelector("[data-resume]");
    await page.getByRole("tab", { name: "Design" }).click();
    await page.getByRole("radio", { name: TEMPLATE_NAMES[id] ?? id, exact: true }).click();
    await page.getByLabel("Page size").selectOption(ps);
    await page.waitForTimeout(700);
    await page.goto(`${BASE}/print`);
    await page.waitForSelector("[data-resume]");
    const file = `${OUT}/${id}-${ps}.pdf`;
    await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
    const { pages, text } = await extract(file);
    const flat = text.replace(/\s+/g, " ");
    const problems = [];
    if (pages !== 1) problems.push(`pages=${pages}`);
    const expectInOrder = ["Elena Marchetti", "Operations Analyst", "elena.marchetti@example.com", "SUMMARY", "EXPERIENCE", "Senior Operations Analyst", "Harborline Logistics", "Operations Analyst", "Brightwell Supplies", "EDUCATION", "Cascade State University", "SKILLS", "Analysis: SQL", "PROJECTS", "Depot Capacity Planner", "CERTIFICATIONS", "Lean Six Sigma Green Belt", "LANGUAGES", "Italian"];
    // headings may render in original case for the minimal template; compare case-insensitively
    const lower = flat.toLowerCase();
    let pos = 0;
    for (const e of expectInOrder) {
      const i = lower.indexOf(e.toLowerCase(), pos);
      if (i < 0) { problems.push(`missing/out-of-order: ${e}`); break; }
      pos = i;
    }
    for (const s of ["Mar 2022 – Present", "Jun 2019 – Feb 2022", "reducing late arrivals by 14 percent", "Professional working", "example.com/elena", "+1 555 0142"]) {
      if (!flat.includes(s)) problems.push(`missing text: ${s}`);
    }
    {
      // first entry: title must come before its date range in the extracted text
      const t = flat.indexOf("Senior Operations Analyst"), d = flat.indexOf("Mar 2022 – Present");
      if (t < 0 || d < 0 || t > d) problems.push("first entry: title not before date");
    }
    if (flat.includes("�")) problems.push("replacement char present");
    if (!(await page.locator(`[data-resume].tpl-${id}`).count())) problems.push(`print route not using tpl-${id}`);
    if (/\b(?:[A-Za-z] ){5,}[A-Za-z]\b/.test(flat)) problems.push("spaced-letter extraction");
    if (/Templates Editor|Print \/ Save/.test(flat)) problems.push("chrome leaked into PDF");
    console.log(`${problems.length ? "FAIL" : "PASS"}  ${id}/${ps}  pages=${pages} chars=${flat.length}${problems.length ? "  " + problems.join("; ") : ""}`);
    bad += problems.length ? 1 : 0;
    await ctx.close();
  }
}
await browser.close();
process.exit(bad ? 1 : 0);
