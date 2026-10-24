// Stress matrix: every template x A4/Letter x 5 font stacks x 3 accents x 3 size/spacing settings.
// Fails on broken text layer, order, U+FFFD, spaced letters, title-after-date, or low-contrast heading text in the NEW templates.
// Page counts above 1 are reported (not failed) when the PDF still extracts cleanly.
import { chromium } from "playwright-core";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = path.resolve("scripts/out/matrix");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FONTS = ["sans", "serif", "verdana", "trebuchet", "mono"];
const ACCENTS = ["#1f4e79", "#e8b923", "#a23b2a"];
const SETTINGS = [{ fontSize: 9, lineSpacing: 1.25 }, { fontSize: 12, lineSpacing: 1.25 }, { fontSize: 12, lineSpacing: 1.5 }];
const NEW = ["executive", "academic", "technical", "graduate", "softline", "ledger"];
const only = process.env.ONLY?.split(",");
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

const idPage = await browser.newPage();
await idPage.goto(`${BASE}/templates`);
await idPage.waitForSelector("[data-template]");
const IDS = (await idPage.locator("[data-template]").evaluateAll((els) => els.map((e) => e.getAttribute("data-template")))).filter((i) => !only || only.includes(i));
// Grab a persisted base doc by making one edit in the editor.
await idPage.goto(`${BASE}/editor`);
await idPage.waitForSelector("[data-resume]");
await idPage.getByRole("tab", { name: "Design" }).click();
await idPage.getByRole("radio", { name: "Modern", exact: true }).click();
await idPage.waitForTimeout(900);
const base = await idPage.evaluate(() => localStorage.getItem("resume-builder:doc:v1"));
if (!base) { console.log("FAIL could not read base doc"); process.exit(1); }
await idPage.close();

async function extract(file) {
  const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent();
    text += tc.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("") + "\n";
  }
  return { pages: pdf.numPages, text };
}
const ORDER = ["Elena Marchetti", "Operations Analyst", "elena.marchetti@example.com", "SUMMARY", "EXPERIENCE", "Senior Operations Analyst", "Harborline Logistics", "Brightwell Supplies", "EDUCATION", "Cascade State University", "SKILLS", "Analysis: SQL", "PROJECTS", "Depot Capacity Planner", "CERTIFICATIONS", "Lean Six Sigma Green Belt", "LANGUAGES", "Italian"];
const MUST = ["Mar 2022 – Present", "Jun 2019 – Feb 2022", "reducing late arrivals by 14 percent", "Professional working", "example.com/elena", "+1 555 0142"];

let total = 0, bad = 0;
const multi = [], contrastWarn = new Set();
for (const id of IDS) {
  for (const ps of ["a4", "letter"]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    for (const font of FONTS) for (const accent of ACCENTS) for (const st of SETTINGS) {
      const doc = JSON.parse(base);
      doc.style = { ...doc.style, template: id, pageSize: ps, font, accent, ...st };
      await page.addInitScript((j) => localStorage.setItem("resume-builder:doc:v1", j), JSON.stringify(doc)).catch(() => {});
      // init scripts accumulate; the latest one wins because they run in order
      await page.goto(`${BASE}/print`);
      await page.waitForSelector("[data-resume]");
      const cls = await page.locator("[data-resume]").getAttribute("class");
      const file = `${OUT}/${id}-${ps}-${font}-${accent.slice(1)}-${st.fontSize}-${st.lineSpacing}.pdf`;
      await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
      const { pages, text } = await extract(file);
      const flat = text.replace(/\s+/g, " ");
      const problems = [];
      if (!cls.includes(`tpl-${id}`)) problems.push("wrong template class");
      let pos = 0; const lower = flat.toLowerCase();
      for (const e of ORDER) { const i = lower.indexOf(e.toLowerCase(), pos); if (i < 0) { problems.push(`missing/out-of-order: ${e}`); break; } pos = i; }
      for (const m of MUST) if (!flat.includes(m)) problems.push(`missing text: ${m}`);
      if (flat.includes("�")) problems.push("U+FFFD");
      if (/\b(?:[A-Za-z] ){5,}[A-Za-z]\b/.test(flat)) problems.push("spaced letters");
      const t = flat.indexOf("Senior Operations Analyst"), d = flat.indexOf("Mar 2022 – Present");
      if (t < 0 || d < 0 || t > d) problems.push("title not before date");
      // contrast of heading text vs its own background (white unless filled)
      const c = await page.evaluate(() => {
        const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .0551) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
        const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return m; };
        const out = [];
        for (const sel of ["h1", "h2"]) {
          const el = document.querySelector(`[data-resume] ${sel}`); if (!el) continue;
          const cs = getComputedStyle(el); const fg = parse(cs.color); const bgp = parse(cs.backgroundColor);
          const bg = bgp.length === 4 && bgp[3] === 0 ? [255, 255, 255] : bgp;
          const L1 = lum(fg), L2 = lum(bg); out.push([sel, (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05)]);
        }
        return out;
      });
      for (const [sel, ratio] of c) {
        if (ratio < 3) { if (NEW.includes(id) || id === "bold") problems.push(`${sel} contrast ${ratio.toFixed(2)}`); else contrastWarn.add(`${id}:${accent} ${sel}`); }
      }
      total++;
      if (pages !== 1) multi.push(`${id}/${ps}/${font}/${accent}/${st.fontSize}pt/${st.lineSpacing} pages=${pages}`);
      if (problems.length) { bad++; console.log(`FAIL ${id}/${ps}/${font}/${accent}/${st.fontSize}/${st.lineSpacing}: ${problems.join("; ")}`); }
      fs.unlinkSync(file);
    }
    await ctx.close();
    console.log(`done ${id}/${ps}`);
  }
}
await browser.close();
console.log(`\n${total} PDFs, ${bad} failed`);
console.log(`multi-page (${multi.length}):`); for (const m of multi) console.log("  " + m);
console.log(`contrast warnings on existing templates (not failed): ${[...contrastWarn].join(", ") || "none"}`);
process.exit(bad ? 1 : 0);
