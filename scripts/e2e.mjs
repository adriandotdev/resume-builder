// End-to-end check against a running server (default http://localhost:3100).
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.env.OUT ?? path.resolve("scripts/out");
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`); };

// Each version stores its doc and job posting under its own keys; the index names the active one.
const storedFor = (pg, kind) => pg.evaluate((k) => {
  const idx = JSON.parse(localStorage.getItem("resume-builder:versions:v1") || "null");
  return idx ? localStorage.getItem(`resume-builder:${k}:v1:${idx.activeId}`) : null;
}, kind);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const external = [];
const consoleErrors = [];
page.on("request", (r) => { const u = new URL(r.url()); if (!["localhost", "127.0.0.1"].includes(u.hostname) && u.protocol.startsWith("http")) external.push(r.url()); });
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text() + " " + (m.location().url || "")); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

// 1 gallery
await page.goto(`${BASE}/templates`);
await page.waitForSelector("[data-template]");
const cards = await page.locator("[data-template]").count();
check("gallery shows 12 template cards", cards === 12, String(cards));
const thumbText = await page.locator('[data-template="bold"]').innerText();
check("thumbnails render sample data (Elena Marchetti)", thumbText.includes("Elena Marchetti"));
await page.screenshot({ path: `${OUT}/gallery.png`, fullPage: true });
await page.getByTestId("filter-bold").click();
check("filter chip Bold narrows to 1 template", await page.locator("[data-template]").count() === 1);
await page.getByTestId("filter-simple").click();
check("filter chip Simple shows 5 templates", await page.locator("[data-template]").count() === 5);
await page.getByTestId("filter-all").click();
check("filter chip All restores 12", await page.locator("[data-template]").count() === 12);
check("current template shows a Selected badge", await page.getByTestId("selected-badge").count() === 1);
const openBtn = page.getByRole("button", { name: "Preview the Compact template larger" });
await openBtn.focus();
await openBtn.click();
await page.waitForSelector('dialog[open]');
check("preview modal opens with a labelled heading", (await page.locator("#tpl-modal-h").innerText()) === "Compact");
for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
check("modal traps focus after 8 Tab presses", await page.evaluate(() => !!document.activeElement?.closest("dialog[open]")));
await page.keyboard.press("Escape");
await page.waitForFunction(() => !document.querySelector("dialog[open]"));
check("Esc closes the modal and returns focus to the card", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Preview the Compact template larger"));

// 2 choose template -> editor
await page.getByRole("button", { name: "Use this template: Modern" }).click();
await page.waitForURL("**/editor");
check("gallery -> editor navigation", page.url().endsWith("/editor"));
await page.waitForSelector("[data-resume]");
check("editor renders modern template class", await page.locator("[data-resume].tpl-modern").count() === 1);

// 3 style controls (Design tab)
await page.getByRole("tab", { name: "Design" }).click();
await page.locator("#accent").evaluate((el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, "#b91c1c"); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); });
await page.getByLabel("Font", { exact: true }).selectOption("serif");
await page.locator("#q-page").selectOption("letter");
await page.getByLabel("Date format").selectOption("MM/YYYY");
await page.getByRole("radio", { name: "Wide" }).check();
await page.locator("#fs").evaluate((el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, "11"); el.dispatchEvent(new Event("input", { bubbles: true })); });
const vars = await page.locator("[data-resume]").evaluate((el) => ({ a: el.style.getPropertyValue("--r-accent"), f: el.style.getPropertyValue("--r-font"), s: el.style.getPropertyValue("--r-size") }));
check("accent/font/size applied live", vars.a === "#b91c1c" && vars.f.includes("Georgia") && vars.s === "11pt", JSON.stringify(vars));
check("date format applied (03/2022)", (await page.locator("[data-resume]").innerText()).includes("03/2022"));
await page.getByRole("button", { name: "100%", exact: true }).click();
await page.waitForTimeout(200);
const sheet = await page.getByTestId("preview-sheet").evaluate((el) => ({ w: el.getBoundingClientRect().width, p: getComputedStyle(el).paddingLeft }));
check("letter page + wide margins in preview", Math.abs(sheet.w - 215.9 * 96 / 25.4) < 2 && Math.abs(parseFloat(sheet.p) - 25 * 96 / 25.4) < 1, JSON.stringify(sheet));

// 4 reorder (Content tab)
await page.getByRole("tab", { name: "Content" }).click();
check("first section (Contact) is open by default", await page.getByLabel("Full name").isVisible());
const order = async () => (await page.locator('[data-testid="section-list"] > li').evaluateAll((els) => els.map((e) => e.getAttribute("data-section-type"))));
const before = await order();
await page.getByRole("button", { name: "Actions for Education" }).click();
check("menu holds Move up / Move down / Remove", (await page.getByRole("menuitem").allInnerTexts()).join("|") === "Move Education up|Move Education down|Remove Education");
await page.getByRole("menuitem", { name: "Move Education up" }).click();
const after = await order();
check("reorder via Up button", before.indexOf("education") - 1 === after.indexOf("education"), `${before.join(",")} => ${after.join(",")}`);
const h2s = await page.locator("[data-resume] h2").allTextContents();
check("preview follows new order (Education before Experience)", h2s.indexOf("Education") < h2s.indexOf("Experience"), h2s.join(","));
// pointer-event drag (mouse; same code path as touch)
const handle = page.locator('[data-testid="section-list"] > li').nth(1).getByTestId("drag-handle");
const hb = await handle.boundingBox();
const tb = await page.locator('[data-testid="section-list"] > li').nth(4).boundingBox();
await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
await page.mouse.down();
await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 30, { steps: 5 });
await page.mouse.move(hb.x + hb.width / 2, tb.y + tb.height - 4, { steps: 15 });
check("drop indicator is shown while dragging", await page.locator(".drop-slot").count() === 1);
await page.mouse.up();
await page.waitForTimeout(350); // card glides into its slot, then the order commits
const afterDrag = await order();
check("reorder via pointer drag", afterDrag.join() !== after.join(), afterDrag.join(","));
// remove -> undo toast (no window.confirm)
let dialogSeen = false;
page.on("dialog", (d) => { dialogSeen = true; d.dismiss(); });
const nBefore = (await order()).length;
await page.getByRole("button", { name: "Actions for Languages" }).click();
await page.getByRole("menuitem", { name: "Remove Languages" }).click();
check("Remove shows an Undo toast, not a confirm dialog", (await order()).length === nBefore - 1 && !dialogSeen && await page.getByTestId("toast").getByRole("button", { name: "Undo" }).isVisible());
await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
check("Undo restores the removed section at its position", (await order()).join() === afterDrag.join(), (await order()).join(","));
// visibility
await page.getByLabel("Show Languages on resume").uncheck();
check("hiding a section removes it from preview", !(await page.locator("[data-resume]").innerText()).includes("Languages"));
// edit text
await page.getByLabel("Full name").fill("Elena Marchetti-Rossi");
check("editing updates preview", (await page.locator("[data-resume] h1").innerText()) === "Elena Marchetti-Rossi");
// add custom section
await page.getByLabel("Section type").selectOption("custom");
await page.getByRole("button", { name: "Add section" }).click();
check("add section", (await order()).includes("custom"));

// ATS
await page.getByRole("button", { name: "ATS text preview" }).click();
const atsText = await page.getByTestId("ats-text").innerText();
check("ATS text preview shows plain text", atsText.startsWith("Elena Marchetti-Rossi") && atsText.includes("EXPERIENCE"));
await page.getByRole("tab", { name: /ATS check/ }).click();
const atsBefore = await page.getByTestId("ats-summary").innerText();
check("ATS panel warns about empty custom section", (await page.getByTestId("ats-list").innerText()).includes("Empty visible section"), atsBefore);
check("ATS panel groups items into To review and Passed", (await page.getByTestId("ats-list").innerText()).includes("To review") && (await page.getByTestId("ats-list").innerText()).includes("Passed"));

// job match: paste a posting, add a missing term to Skills, watch it move to Found
const POSTING = "Requirements:\n- Proficient in Kubernetes\n- Experience with Kubernetes and Docker\n- Looker";
await page.getByLabel("Paste the job posting").fill(POSTING);
await page.getByTestId("jd-missing").getByText("kubernetes", { exact: true }).waitFor();
check("job match summary counts key terms", /^\d+ of \d+ key terms from this posting appear in your resume\.$/.test(await page.getByTestId("jd-summary").innerText()), await page.getByTestId("jd-summary").innerText());
check("job match lists a missing term", await page.getByTestId("jd-missing").getByText("kubernetes", { exact: true }).isVisible() && (await page.getByTestId("jd-found").innerText()).includes("looker"));
await page.getByRole("tab", { name: "Content" }).click();
await page.locator('[data-section-type="skills"]').getByRole("button", { expanded: false }).first().click();
const skillsField = page.locator('[data-section-type="skills"]').getByLabel("Skills (comma separated)").first();
await skillsField.fill((await skillsField.inputValue()) + ", Kubernetes");
await page.getByRole("tab", { name: /ATS check/ }).click();
await page.getByTestId("jd-found").getByText("kubernetes", { exact: true }).waitFor();
check("a term added to Skills moves to Found, with its section", (await page.getByTestId("jd-found").innerText()).includes("in Skills") && !(await page.getByTestId("jd-missing").innerText()).includes("kubernetes"));
check("job posting survives switching tabs", (await page.getByLabel("Paste the job posting").inputValue()) === POSTING);
await page.getByRole("button", { name: "Design preview" }).click();

// 5 persistence
await page.waitForTimeout(800);
await page.reload();
await page.waitForSelector("[data-resume]");
const after2 = await order();
check("reload persists order/visibility/style", after2.join() === (await (async () => afterDrag.concat(["custom"]))()).join() && (await page.locator("[data-resume] h1").innerText()) === "Elena Marchetti-Rossi" && (await page.locator("[data-resume]").evaluate((e) => e.style.getPropertyValue("--r-accent"))) === "#b91c1c" && !(await page.locator("[data-resume]").innerText()).includes("Languages"));
const stored = await storedFor(page, "doc");
check("localStorage holds versioned JSON", JSON.parse(stored).version === 1);
await page.getByRole("tab", { name: /ATS check/ }).click();
check("pasted posting persisted across reload", (await page.getByLabel("Paste the job posting").inputValue()) === POSTING && (await storedFor(page, "jd")) === POSTING);
await page.setViewportSize({ width: 375, height: 800 });
await page.getByTestId("jd-found").waitFor();
const jdOver = await page.evaluate(() => { const box = document.querySelector('[data-testid="jd-match"]'); return Math.max(...[box, ...box.querySelectorAll("*")].map((e) => e.getBoundingClientRect().right)) - window.innerWidth; });
check("job match stays inside a 375px viewport", jdOver <= 1, `overflow=${Math.round(jdOver)}`);
await page.setViewportSize({ width: 1400, height: 900 });
await page.getByRole("tab", { name: "Content" }).click();

// 6 JSON round trip (Data tab)
await page.getByRole("tab", { name: "Data" }).click();
const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export JSON" }).click()]);
const jpath = `${OUT}/export.json`;
await dl.saveAs(jpath);
const exported = JSON.parse(fs.readFileSync(jpath, "utf8"));
check("JSON export downloads valid doc", exported.version === 1 && exported.sections.length > 5 && exported.style.pageSize === "letter", dl.suggestedFilename());
check("JSON export leaves the pasted posting out", !fs.readFileSync(jpath, "utf8").includes("Proficient in"));
await page.getByRole("button", { name: "Start blank" }).click();
check("Start blank offers Undo instead of confirm", await page.getByTestId("toast").getByRole("button", { name: "Undo" }).isVisible() && !dialogSeen);
await page.waitForTimeout(200);
check("start blank clears name", (await page.locator("[data-resume] h1").count()) === 0);
await page.getByTestId("import-input").setInputFiles(jpath);
await page.waitForTimeout(300);
check("JSON import restores doc", (await page.locator("[data-resume] h1").innerText()) === "Elena Marchetti-Rossi");
await page.waitForTimeout(600);
const rt2 = JSON.parse(await storedFor(page, "doc"));
check("round trip equal to export", JSON.stringify(rt2) === JSON.stringify(exported));
// invalid import
fs.writeFileSync(`${OUT}/bad.json`, JSON.stringify({ version: 1, style: { accent: "red" }, sections: [{ type: "nope" }] }));
await page.getByTestId("import-input").setInputFiles(`${OUT}/bad.json`);
await page.waitForSelector('[data-testid="import-error"]');
check("invalid import shows errors and keeps doc", (await page.locator('[data-testid="import-error"]').innerText()).includes("Import failed") && (await page.locator("[data-resume] h1").innerText()) === "Elena Marchetti-Rossi");
fs.writeFileSync(`${OUT}/bad2.json`, "{nope");
await page.getByTestId("import-input").setInputFiles(`${OUT}/bad2.json`);
await page.waitForFunction(() => document.body.innerText.includes("not valid JSON"));
check("non-JSON import rejected", true);

// The posting belongs to the version it was pasted for; Clear empties it and returns focus to the box
const versionOptions = () => page.getByTestId("version-select").locator("option").allInnerTexts();
check("import added a new version instead of overwriting", (await versionOptions()).length === 2, (await versionOptions()).join("|"));
await page.getByRole("tab", { name: /ATS check/ }).click();
check("an imported version starts with its own empty posting", (await page.getByLabel("Paste the job posting").inputValue()) === "");
await page.getByTestId("version-select").selectOption({ index: 0 });
check("job posting stays with its version through Start blank and an import", (await page.getByLabel("Paste the job posting").inputValue()) === POSTING);
await page.getByRole("button", { name: "Clear" }).click();
check("Clear empties the posting, storage and returns focus", (await page.getByLabel("Paste the job posting").inputValue()) === "" && (await storedFor(page, "jd")) === "" && await page.evaluate(() => document.activeElement?.tagName === "TEXTAREA"));
await page.getByTestId("version-select").selectOption({ index: 1 });
await page.getByRole("tab", { name: "Content" }).click();

// 6b resume versions
const names = async () => (await versionOptions());
await page.getByTestId("manage-versions").click();
check("Manage opens the versions dialog with a row per version", await page.getByTestId("versions-dialog").isVisible() && (await page.getByTestId("version-row").count()) === 2);
await page.getByTestId("version-new").click();
check("New blank version adds a row and opens it", (await page.getByTestId("version-row").count()) === 3 && await page.getByTestId("version-row").nth(2).getByText("Editing").isVisible());
await page.getByRole("button", { name: "Done" }).click();
check("the new version is blank and selected", (await page.locator("[data-resume] h1").count()) === 0 && (await page.getByTestId("version-select").inputValue()) !== "");
await page.getByLabel("Full name").fill("Quinn QA");
await page.waitForTimeout(500);
await page.getByTestId("version-select").selectOption({ index: 1 });
check("switching back shows the other version's own content", (await page.locator("[data-resume] h1").innerText()) === "Elena Marchetti-Rossi");
await page.getByTestId("version-select").selectOption({ index: 2 });
check("each version keeps its own edits", (await page.locator("[data-resume] h1").innerText()) === "Quinn QA");
await page.reload();
await page.waitForSelector("[data-resume]");
check("the active version survives a reload", (await page.locator("[data-resume] h1").innerText()) === "Quinn QA" && (await names()).length === 3);

await page.getByTestId("manage-versions").click();
await page.getByRole("button", { name: /^Duplicate New resume$/ }).click();
check("Duplicate copies the version and opens it", (await names()).includes("Copy of New resume") && (await page.locator("[data-resume] h1").innerText()) === "Quinn QA");
await page.getByRole("button", { name: /^Delete Copy of New resume$/ }).click();
check("Delete removes the version and offers Undo in the dialog", (await page.getByTestId("version-row").count()) === 3 && await page.getByTestId("version-undo").isVisible() && !dialogSeen);
await page.getByTestId("version-undo").click();
check("Undo puts the version back with its content", (await names()).includes("Copy of New resume") && (await page.locator("[data-resume] h1").innerText()) === "Quinn QA");
await page.getByRole("button", { name: "Done" }).click();

await page.getByRole("tab", { name: "Data" }).click();
const [dlAll] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-all").click()]);
const allPath = `${OUT}/export-all.json`;
await dlAll.saveAs(allPath);
const bundle = JSON.parse(fs.readFileSync(allPath, "utf8"));
check("Export all versions downloads every doc and no posting", bundle.kind === "resume-builder-bundle" && bundle.versions.length === 4 && !fs.readFileSync(allPath, "utf8").includes("Proficient in"), `${bundle.versions.length} versions`);
await page.getByTestId("import-input").setInputFiles(allPath);
await page.waitForTimeout(400);
check("Importing the bundle adds its versions without overwriting", (await names()).length === 8, String((await names()).length));
const [dlOne] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export JSON" }).click()]);
check("single export is named after the version", /\.json$/.test(dlOne.suggestedFilename()) && dlOne.suggestedFilename() !== "resume.json", dlOne.suggestedFilename());
await page.getByTestId("version-select").selectOption({ label: "export" });
await page.getByRole("tab", { name: "Content" }).click();
check("back on the imported resume for the checks below", (await page.locator("[data-resume] h1").innerText()) === "Elena Marchetti-Rossi");

// accessibility smoke
const unlabeled = await page.evaluate(() => [...document.querySelectorAll("input,select,textarea")].filter((el) => el.type !== "file" && !el.labels?.length && !el.getAttribute("aria-label")).length);
check("all form controls have labels", unlabeled === 0, String(unlabeled));
await page.keyboard.press("Tab");
check("focus is keyboard reachable", await page.evaluate(() => document.activeElement && document.activeElement !== document.body));
await page.screenshot({ path: `${OUT}/editor-desktop.png`, fullPage: true });

// PDF from editor (real print CSS)
await page.emulateMedia({ media: "print" });
const hidden = await page.evaluate(() => [...document.querySelectorAll(".no-print")].every((e) => getComputedStyle(e).display === "none"));
check("print CSS hides editor chrome", hidden);
await page.emulateMedia({ media: null });
await page.pdf({ path: `${OUT}/editor-letter.pdf`, preferCSSPageSize: true, printBackground: true });
await page.locator("#q-page").selectOption("a4");
await page.getByRole("tab", { name: "Design" }).click();
await page.getByRole("radio", { name: "Normal" }).check();
await page.getByLabel("Font", { exact: true }).selectOption("sans");
await page.pdf({ path: `${OUT}/editor-a4.pdf`, preferCSSPageSize: true, printBackground: true });
async function pdfInfo(file) {
  const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) text += (await (await pdf.getPage(i)).getTextContent()).items.map((it) => it.str).join(" ") + " ";
  return { pages: pdf.numPages, text };
}
for (const f of ["editor-letter", "editor-a4"]) {
  const info = await pdfInfo(`${OUT}/${f}.pdf`);
  check(`printing the editor yields one clean page (${f})`, info.pages === 1 && info.text.includes("Elena Marchetti-Rossi") && !/Download PDF|Content Design|Saved/.test(info.text), `pages=${info.pages}`);
}
// print route
await page.waitForTimeout(500);
await page.goto(`${BASE}/print`);
await page.waitForSelector("[data-resume]");
await page.pdf({ path: `${OUT}/print-route-a4.pdf`, preferCSSPageSize: true, printBackground: true });

// landing: hero sheet toggle (resume DOM must be identical in both views)
const lp = await ctx.newPage();
lp.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
await lp.goto(`${BASE}/`);
await lp.waitForSelector('[data-testid="hero-lens"] [data-resume]');
const heroHtmlA = await lp.locator('[data-testid="hero-lens"] [data-resume]').evaluate((e) => e.outerHTML);
const bgBefore = await lp.locator('[data-testid="hero-lens"] h1').evaluate((e) => getComputedStyle(e).backgroundSize);
await lp.getByRole("button", { name: "What an ATS reads" }).click();
await lp.waitForTimeout(900);
const heroHtmlB = await lp.locator('[data-testid="hero-lens"] [data-resume]').evaluate((e) => e.outerHTML);
const hl = await lp.locator('[data-testid="hero-lens"] h1').evaluate((e) => { const c = getComputedStyle(e); return { size: c.backgroundSize, img: c.backgroundImage }; });
check("ATS toggle highlights extracted text in the highlighter yellow", hl.img.includes("242, 209, 92") && hl.size.startsWith("100%") && bgBefore.startsWith("0%"), JSON.stringify({ bgBefore, ...hl }));
check("ATS toggle leaves the resume DOM untouched", heroHtmlA === heroHtmlB);
check("hero has Start your resume + Browse templates CTAs", await lp.getByRole("link", { name: "Start your resume" }).isVisible() && await lp.getByRole("link", { name: "Browse templates" }).isVisible());
const faq = await lp.locator("#questions").innerText();
check("FAQ covers storage, JSON backup and PDF export", ["Where is my resume stored?", "back it up", "How does the PDF get made?"].every((q) => faq.includes(q)));
check("landing never claims ATS-verified", !/ATS-verified/i.test(await lp.locator("body").innerText()));
await lp.close();

// a resume saved before versions existed becomes "My resume", posting included, and the old keys stay
const legacyCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const oldPage = await legacyCtx.newPage();
// seeded before any page script runs, as for a real user who saved a resume with the old build
await legacyCtx.addInitScript((doc) => {
  if (localStorage.getItem("resume-builder:versions:v1") === null) { localStorage.setItem("resume-builder:doc:v1", doc); localStorage.setItem("resume-builder:jd:v1", "Legacy posting text"); }
}, JSON.stringify(exported));
await oldPage.goto(BASE + "/editor");
await oldPage.waitForSelector("[data-resume]");
check("migration: the old single resume opens unchanged", (await oldPage.locator("[data-resume] h1").innerText()) === "Elena Marchetti-Rossi");
check("migration: it becomes the only version, 'My resume'", (await oldPage.getByTestId("version-select").locator("option").allInnerTexts()).join("|") === "My resume");
await oldPage.getByRole("tab", { name: /ATS check/ }).click();
check("migration: its job posting moved with it", (await oldPage.getByLabel("Paste the job posting").inputValue()) === "Legacy posting text");
check("migration: the old keys are left in place", await oldPage.evaluate(() => localStorage.getItem("resume-builder:doc:v1") !== null && localStorage.getItem("resume-builder:jd:v1") === "Legacy posting text"));
await legacyCtx.close();

// mobile
const m = await browser.newContext({ viewport: { width: 375, height: 800 } });
const mp = await m.newPage();
mp.on("console", (x) => { if (x.type() === "error") consoleErrors.push(x.text()); });
for (const url of ["/", "/templates", "/editor"]) {
  await mp.goto(BASE + url);
  await mp.waitForTimeout(500);
  const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`mobile 375px no horizontal scroll ${url}`, over <= 1, `overflow=${over}`);
}
check("phone: sticky bottom bar has Content, Design, Preview, Export", (await mp.locator(".bottom-bar button").allInnerTexts()).map((t) => t.trim()).join("|") === "Content|Design|Preview|Export");
const swBox = await mp.getByTestId("version-select").boundingBox();
const mgBox = await mp.getByTestId("manage-versions").boundingBox();
check("phone: version switcher is on screen", !!swBox && !!mgBox && swBox.x >= 0 && mgBox.x + mgBox.width <= 376, JSON.stringify({ swBox, mgBox }));
await mp.getByTestId("manage-versions").click();
const vdBox = await mp.getByTestId("versions-dialog").boundingBox();
check("phone: versions dialog fits the screen", vdBox.x >= 0 && vdBox.x + vdBox.width <= 376, JSON.stringify(vdBox));
await mp.keyboard.press("Escape");
await mp.getByRole("button", { name: "Preview", exact: true }).click();
await mp.waitForTimeout(400);
const over2 = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("mobile preview pane fits", over2 <= 1, `overflow=${over2}`);
const sheetBox = await mp.locator(".pv-pane").boundingBox();
check("phone preview opens as a full-screen sheet", sheetBox.width >= 374 && sheetBox.height >= 799, JSON.stringify(sheetBox));
await mp.screenshot({ path: `${OUT}/editor-mobile-preview.png` });
await mp.keyboard.press("Escape");
await mp.waitForTimeout(200);
check("Esc closes the phone preview sheet and returns focus to Preview", !(await mp.locator(".pv-pane").isVisible()) && (await mp.evaluate(() => document.activeElement?.textContent?.trim())) === "Preview");
await mp.getByRole("button", { name: "Export", exact: true }).click();
check("phone: Export opens the print tips dialog", await mp.getByRole("dialog").getByText("Headers and footers").isVisible());
await mp.keyboard.press("Escape");
await m.close();

// tablet 768: panel collapses to a drawer
const t = await browser.newContext({ viewport: { width: 768, height: 1024 } });
const tp = await t.newPage();
tp.on("console", (x) => { if (x.type() === "error") consoleErrors.push(x.text()); });
await tp.goto(`${BASE}/editor`);
await tp.waitForSelector("[data-resume]");
check("tablet: tools are hidden until 'Edit resume' is pressed", !(await tp.getByLabel("Full name").isVisible()));
await tp.getByRole("button", { name: "Edit resume" }).first().click();
await tp.waitForTimeout(350);
check("tablet: drawer shows the editing panel", await tp.getByLabel("Full name").isVisible());
await tp.keyboard.press("Escape");
await tp.waitForTimeout(350);
check("tablet: Esc closes the drawer and restores focus", !(await tp.getByLabel("Full name").isVisible()) && (await tp.evaluate(() => document.activeElement?.textContent?.includes("Edit resume"))));
const overT = await tp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("tablet 768px no horizontal scroll", overT <= 1, `overflow=${overT}`);
await t.close();

// dark scheme: chrome themes, paper stays white
const d = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
const dp = await d.newPage();
await dp.goto(`${BASE}/editor`);
await dp.waitForSelector("[data-resume]");
const dark = await dp.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, paper: getComputedStyle(document.querySelector("[data-resume]")).backgroundColor, ink: getComputedStyle(document.querySelector("[data-resume]")).color }));
check("dark: app chrome is #111111 while the resume paper stays white", dark.body === "rgb(17, 17, 17)" && dark.paper === "rgb(255, 255, 255)" && dark.ink === "rgb(17, 17, 17)", JSON.stringify(dark));
await d.close();

// reduced motion
const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const rp = await rm.newPage();
await rp.goto(`${BASE}/templates`);
await rp.waitForSelector("[data-template]");
const dur = await rp.locator("[data-template]").first().evaluate((e) => getComputedStyle(e).transitionDuration);
check("prefers-reduced-motion removes transitions", parseFloat(dur) < 0.01, dur);
await rm.close();

check("no external network requests", external.length === 0, external.join(", ") || "0 external");
check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
