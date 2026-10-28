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
await page.waitForFunction(() => document.querySelectorAll("[data-template]").length === 1).catch(() => {});
check("filter chip Bold narrows to 1 template", await page.locator("[data-template]").count() === 1);
await page.getByTestId("filter-simple").click();
await page.waitForFunction(() => document.querySelectorAll("[data-template]").length === 5).catch(() => {});
check("filter chip Simple shows 5 templates", await page.locator("[data-template]").count() === 5);
await page.getByTestId("filter-all").click();
await page.waitForFunction(() => document.querySelectorAll("[data-template]").length === 12).catch(() => {});
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
await handle.scrollIntoViewIfNeeded(); // bounding boxes are viewport-relative, so bring the handle on screen first
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
await page.waitForTimeout(300); // the removed card fades out before it leaves the list
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
await page.getByTestId("jd-missing").getByText("Kubernetes", { exact: true }).waitFor();
check("job match summary counts key terms", /^\d+ of \d+ key terms from this posting appear in your resume\.$/.test(await page.getByTestId("jd-summary").innerText()), await page.getByTestId("jd-summary").innerText());
check("job match lists a missing term", await page.getByTestId("jd-missing").getByText("Kubernetes", { exact: true }).isVisible() && (await page.getByTestId("jd-found").innerText()).includes("Looker"));
const addBtn = page.getByTestId("jd-missing").getByRole("button", { name: /^Add to Skills\W+for .+$/ }).first();
const addedTerm = (await addBtn.getAttribute("data-add-term"));
await addBtn.click();
await page.getByTestId("jd-found").getByText(addedTerm, { exact: true }).waitFor();
await page.getByTestId("jd-missing").getByText(addedTerm, { exact: true }).waitFor({ state: "detached" }); // the row fades out first
check("Add to Skills moves the term to Found, in Skills", (await page.getByTestId("jd-found").innerText()).includes("in Skills") && !(await page.getByTestId("jd-missing").innerText()).includes(addedTerm));
await page.getByRole("button", { name: "Undo" }).click();
await page.getByTestId("jd-missing").getByText(addedTerm, { exact: true }).waitFor();
check("Undo puts the term back in Not found", true);
await page.getByTestId("jd-missing").getByRole("button", { name: /^Write in Experience\W+for .+$/ }).first().click();
await page.waitForFunction(() => document.activeElement?.tagName === "TEXTAREA" && document.activeElement.labels?.[0]?.textContent === "Achievements");
check("Write in Experience opens Content and focuses the first job's achievements", (await page.getByRole("tab", { name: "Content" }).getAttribute("aria-selected")) === "true");
await page.getByRole("tab", { name: /ATS check/ }).click();
await page.getByTestId("jd-missing").getByRole("button", { name: /^Write in Summary\W+for .+$/ }).first().click();
await page.waitForFunction(() => document.activeElement?.tagName === "TEXTAREA" && document.activeElement.labels?.[0]?.textContent === "Summary");
check("Write in Summary focuses the summary text box", true);
await page.getByRole("tab", { name: /ATS check/ }).click();
await page.getByRole("tab", { name: "Content" }).click();
await page.locator('[data-section-type="skills"]').getByRole("button", { expanded: false }).first().click();
const skillsField = page.locator('[data-section-type="skills"]').getByLabel("Skills (comma separated)").first();
await skillsField.fill((await skillsField.inputValue()) + ", Kubernetes");
await page.getByRole("tab", { name: /ATS check/ }).click();
await page.getByTestId("jd-found").getByText("Kubernetes", { exact: true }).waitFor();
check("a term added to Skills moves to Found, with its section", (await page.getByTestId("jd-found").innerText()).includes("in Skills") && !(await page.getByTestId("jd-missing").innerText()).includes("Kubernetes"));
check("job posting survives switching tabs", (await page.getByLabel("Paste the job posting").inputValue()) === POSTING);

// job match v2: a variant spelling counts, key terms group by category, and coverage spans every saved posting
await page.getByLabel("Paste the job posting").fill("Requirements:\n- k8s\n- k8s");
await page.getByTestId("jd-found").getByText("k8s", { exact: true }).waitFor();
check("job match counts Kubernetes in the resume as k8s and says how it was written", (await page.getByTestId("jd-found").innerText()).includes('written as "Kubernetes"'), await page.getByTestId("jd-found").innerText());
await page.getByLabel("Paste the job posting").fill(POSTING);
await page.getByTestId("jd-missing").getByText("Docker", { exact: true }).waitFor();
await page.locator("label.seg-opt", { hasText: "By category" }).click();
await page.getByTestId("jd-categories").waitFor();
const cloud = page.locator('[data-category="Cloud & DevOps"]');
check("By category groups Docker and Kubernetes under Cloud & DevOps", (await cloud.innerText()).includes("Docker") && (await cloud.innerText()).includes("Kubernetes"), await cloud.innerText());
await cloud.getByRole("button", { name: /^Add to Skills\W+for Docker$/ }).click();
await page.getByText('Added "Docker" to Cloud & DevOps in Skills.').waitFor();
await cloud.getByTestId("jd-cat-found").getByText("Docker", { exact: true }).waitFor();
check("Add to Skills in the category view files the term under its category", (await cloud.getByTestId("jd-cat-found").innerText()).includes("in Skills"));
await page.getByRole("button", { name: "Undo" }).click();
await cloud.getByTestId("jd-cat-missing").getByText("Docker", { exact: true }).waitFor();
check("Undo in the category view puts the term back in Not found", true);
await page.locator("label.seg-opt", { hasText: "By status" }).click();
await page.getByTestId("jd-missing").waitFor();

// a term only in a hidden section is not counted as found, and can be shown again
await page.getByRole("tab", { name: "Content" }).click();
await page.getByRole("switch", { name: "Show Skills on resume" }).uncheck();
await page.getByRole("tab", { name: /ATS check/ }).click();
const hiddenRow = page.getByTestId("jd-hidden").locator('[data-hidden-term="Kubernetes"]');
await hiddenRow.waitFor();
check("a term only in a hidden section is listed as hidden, not found", (await hiddenRow.innerText()).includes("won't be in the PDF") && ((await page.getByTestId("jd-found").count()) === 0 || !(await page.getByTestId("jd-found").innerText()).includes("Kubernetes")), await hiddenRow.innerText());
check("the summary counts hidden-only terms apart from found ones", /only in a hidden section\.$/.test(await page.getByTestId("jd-summary").innerText()), await page.getByTestId("jd-summary").innerText());
await hiddenRow.getByRole("button", { name: /^Show Skills\b/ }).click();
await page.getByTestId("jd-found").getByText("Kubernetes", { exact: true }).waitFor();
check("Show section makes the term count as found again", (await page.getByTestId("jd-hidden").count()) === 0 && !(await page.getByTestId("jd-summary").innerText()).includes("hidden section"));

// skipping a missing term moves it to Skipped, survives a reload, and can be restored
const skipRow = page.getByTestId("jd-missing").locator("li", { hasText: "Docker" });
await skipRow.getByRole("button", { name: /^Skip\W+for Docker$/ }).click();
await page.getByTestId("jd-skipped").waitFor();
check("Skip moves the term out of Not found into Skipped", (await page.getByTestId("jd-missing").count()) === 0 || !(await page.getByTestId("jd-missing").innerText()).includes("Docker"));
await page.getByTestId("jd-skipped").locator("summary").click();
check("the skipped term is listed under Skipped", (await page.getByTestId("jd-skipped").innerText()).includes("Docker"), await page.getByTestId("jd-skipped").innerText());
await page.waitForTimeout(500);
await page.reload();
await page.waitForSelector("[data-resume]");
await page.getByRole("tab", { name: /ATS check/ }).click();
await page.getByTestId("jd-skipped").waitFor();
await page.getByTestId("jd-skipped").locator("summary").click();
check("a skipped term stays skipped after a reload", (await page.getByTestId("jd-skipped").innerText()).includes("Docker"), await page.getByTestId("jd-skipped").innerText());
await page.getByTestId("jd-skipped").getByRole("button", { name: /^Restore\W+for Docker$/ }).click();
await page.getByTestId("jd-missing").getByText("Docker", { exact: true }).waitFor();
check("Restore puts a skipped term back in Not found", (await page.getByTestId("jd-skipped").count()) === 0);

const ctx2 = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page2 = await ctx2.newPage();
await page2.addInitScript(() => {
  if (localStorage.getItem("resume-builder:versions:v1") !== null) return;
  localStorage.setItem("resume-builder:versions:v1", JSON.stringify({ activeId: "va", versions: [{ id: "va", name: "Backend", updatedAt: 1 }, { id: "vb", name: "Platform", updatedAt: 2 }] }));
  localStorage.setItem("resume-builder:jd:v1:va", "Requirements:\n- Kubernetes\n- Terraform\n- Kubernetes\n- Terraform");
  localStorage.setItem("resume-builder:jd:v1:vb", "Requirements:\n- k8s\n- Terraform\n- k8s\n- Terraform");
});
await page2.goto(`${BASE}/editor`);
await page2.waitForSelector("[data-resume]");
await page2.getByRole("tab", { name: /ATS check/ }).click();
await page2.getByTestId("jd-all").locator("summary").click();
check("Across all postings lists a row for each saved posting", (await page2.getByTestId("jd-all-list").locator("li").count()) === 2, await page2.getByTestId("jd-all-list").innerText());
const sharedText = await page2.getByTestId("jd-shared").innerText();
check("a term missing from both postings is listed once, even spelled Kubernetes and k8s", sharedText.includes("Terraform") && /Kubernetes|k8s/.test(sharedText) && (await page2.getByTestId("jd-shared").locator("li").count()) === 2, sharedText);
await page2.getByTestId("jd-shared").getByRole("button", { name: /^Add to Skills\W+for Terraform$/ }).click();
await page2.waitForFunction(() => !document.querySelector('[data-testid="jd-shared"]')?.textContent?.includes("Terraform"));
check("Add to Skills from the shared list removes the term from it", (await page2.getByTestId("jd-shared").locator("li").count()) === 1);
await ctx2.close();

// 4b bullet coach
await page.getByRole("tab", { name: "Content" }).click();
await page.locator('[data-section-type="experience"]').getByRole("button", { expanded: false }).first().click();
const achievements = page.locator('[data-section-type="experience"]').getByLabel("Achievements").first();
await achievements.fill("Built a weekly report that saved 6 hours.\nResponsible for various reports.");
await page.getByRole("tab", { name: /Coach/ }).click();
await page.getByTestId("coach-list").getByText("Weak opener").first().waitFor();
check("Coach lists a weak opener and filler for the second bullet", (await page.getByTestId("coach-list").innerText()).includes("Responsible for") && (await page.getByTestId("coach-list").innerText()).includes("various"));
check("Coach summary counts suggestions", /^\d+ suggestions? to review\.$/.test(await page.getByTestId("coach-summary").innerText()), await page.getByTestId("coach-summary").innerText());
await page.getByTestId("coach-list").getByRole("button", { name: /Go to bullet 2 of .*Weak opener/ }).click();
await page.waitForFunction(() => document.activeElement?.tagName === "TEXTAREA" && document.activeElement.labels?.[0]?.textContent === "Achievements");
check("Go to bullet opens Content and selects that line", await page.evaluate(() => { const t = document.activeElement; return t.value.slice(t.selectionStart, t.selectionEnd) === "Responsible for various reports."; }));
await achievements.fill("Built a weekly report that saved 6 hours.\nCut late arrivals by 14 percent.");
await page.getByRole("tab", { name: /Coach/ }).click();
check("Coach clears once the bullets are fixed", (await page.getByTestId("coach-summary").innerText()) === "No wording issues found.", await page.getByTestId("coach-summary").innerText());
// 4c parser view
await page.getByRole("tab", { name: "Content" }).click();
const expBtn = page.locator('[data-section-type="experience"]').getByRole("button", { expanded: false }).first();
if (await expBtn.count()) await expBtn.click();
const startInput = page.locator('[data-section-type="experience"]').getByLabel("Start (YYYY-MM)").first();
const startWas = await startInput.inputValue();
await startInput.fill("Spring 2022");
await page.getByRole("tab", { name: /Parser/ }).click();
await page.getByTestId("parse-findings").getByText("not a date format").first().waitFor();
check("Parser flags a date it cannot read", /^\d+ things? to review\.$/.test(await page.getByTestId("parse-summary").innerText()), await page.getByTestId("parse-summary").innerText());
await page.getByTestId("parse-findings").getByRole("button", { name: /Go to Start \(YYYY-MM\)/ }).first().click();
await page.waitForFunction(() => document.activeElement?.tagName === "INPUT" && document.activeElement.labels?.[0]?.textContent === "Start (YYYY-MM)");
check("Go to field focuses that input", await page.evaluate(() => document.activeElement.value === "Spring 2022"));
await startInput.fill(startWas);
await page.getByRole("tab", { name: /Parser/ }).click();
check("Parser clears once the date is fixed", (await page.getByTestId("parse-summary").innerText()) === "Everything was read into a field.", await page.getByTestId("parse-summary").innerText());
// 4d one-page fit
await page.getByRole("button", { name: "Design preview" }).click(); // the page count only updates in the design preview
const bulletsOf = (n) => Array.from({ length: n }, (_, i) => `Cut handling time ${i + 1} percent on queue ${i + 1}.`).join("\n");
const twoBullets = "Built a weekly report that saved 6 hours.\nCut late arrivals by 14 percent.";
const openExperience = async () => { // the section list resets to its first section whenever the Content tab remounts
  await page.getByRole("tab", { name: "Content" }).click();
  const closed = page.locator('[data-section-type="experience"]').getByRole("button", { expanded: false }).first();
  if (await closed.count()) await closed.click();
};
await page.getByRole("tab", { name: "Design" }).click();
const fitStyleBefore = { fs: await page.getByTestId("fs-value").innerText(), ls: await page.getByTestId("ls-value").innerText() };
await openExperience();
for (let n = 2; n < 80; n++) { // add one bullet at a time until the preview says 2 pages, so the overflow is as small as it gets
  await achievements.fill(bulletsOf(n));
  await page.waitForTimeout(120);
  if ((await page.getByTestId("page-count").innerText()).includes("2 pages")) break;
}
check("preview reports 2 pages once the bullets overflow", (await page.getByTestId("page-count").innerText()).includes("2 pages"), await page.getByTestId("page-count").innerText());
await page.getByRole("tab", { name: /^Fit/ }).click();
await page.getByTestId("fit-suggestion").waitFor();
check("Fit summary says it is over one page", /^Runs to 2 pages, about \d+ lines? over one page\.$/.test(await page.getByTestId("fit-summary").innerText()), await page.getByTestId("fit-summary").innerText());
check("Fit suggests a style change with before and after", /→/.test(await page.getByTestId("fit-suggestion").innerText()), await page.getByTestId("fit-suggestion").innerText());
check("the measuring copy leaves nothing in the page", (await page.locator("[data-resume]").count()) === 1);
await page.getByTestId("fit-suggestion").getByRole("button", { name: /^Adjust/ }).first().click();
await page.waitForFunction(() => ["fs", "ls"].includes(document.activeElement?.id) || document.activeElement?.closest("#margins-control"));
check("Adjust opens Design and focuses that control", await page.getByRole("tab", { name: "Design" }).getAttribute("aria-selected") === "true");
await page.getByRole("tab", { name: /^Fit/ }).click();
await page.getByTestId("fit-apply").click();
await page.waitForFunction(() => document.querySelector('[data-testid="page-count"]')?.textContent?.includes("1 page"));
check("Apply brings the resume to one page", (await page.getByTestId("page-count").innerText()).includes("About 1 page"), await page.getByTestId("page-count").innerText());
await page.getByTestId("fit-summary").getByText("Fits on 1 page.").waitFor();
check("Fit summary says it fits", true);
await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
await page.waitForFunction(() => document.querySelector('[data-testid="page-count"]')?.textContent?.includes("2 pages"));
await page.getByRole("tab", { name: "Design" }).click();
check("Undo restores the previous font size and line spacing", (await page.getByTestId("fs-value").innerText()) === fitStyleBefore.fs && (await page.getByTestId("ls-value").innerText()) === fitStyleBefore.ls, `${await page.getByTestId("fs-value").innerText()} / ${await page.getByTestId("ls-value").innerText()}`);
// far too long: style alone cannot fix it, so it lists where to cut
await openExperience();
await achievements.fill(bulletsOf(90));
await page.getByRole("tab", { name: /^Fit/ }).click();
await page.getByTestId("fit-none").waitFor();
check("cuts that cannot reach one page stay folded", (await page.getByTestId("fit-trims").getByRole("button", { name: /^Edit / }).count()) === 0);
await page.getByTestId("fit-trims").getByRole("button", { name: "Show where I could cut" }).click();
check("Fit says style alone cannot do it and lists where to cut", (await page.getByTestId("fit-none").innerText()).includes("cannot reach one page") && (await page.getByTestId("fit-trims").getByRole("button", { name: /^Edit / }).count()) > 0);
await page.getByTestId("fit-trims").getByRole("button", { name: /^Edit / }).first().click();
await page.waitForFunction(() => document.activeElement?.tagName === "TEXTAREA" && document.activeElement.labels?.[0]?.textContent === "Achievements");
check("a cut suggestion jumps to that bullet", true);
await achievements.fill(twoBullets);
// overflow from a long summary instead: no bullet is cuttable, so whole sections are what it lists
const summarySec = page.locator('[data-section-type="summary"]');
if (await summarySec.getByRole("button", { expanded: false }).count()) await summarySec.getByRole("button", { expanded: false }).first().click();
const summaryBox = summarySec.getByLabel("Summary", { exact: true });
const summaryWas = await summaryBox.inputValue();
const longSummary = Array.from({ length: 80 }, (_, i) => `Led project ${i + 1} across the team and shipped it on time.`).join(" ");
await summaryBox.fill(longSummary);
await page.getByRole("tab", { name: /^Fit/ }).click();
await page.getByTestId("fit-trims").waitFor();
const foldedCuts = page.getByTestId("fit-trims").getByRole("button", { name: "Show where I could cut" });
if (await foldedCuts.count()) await foldedCuts.click();
const openSection = page.getByTestId("fit-trims").getByRole("button", { name: /^Open / }).first();
check("with no cuttable bullets Fit lists a whole section to open", (await openSection.count()) > 0, await page.getByTestId("fit-trims").innerText());
await openSection.click();
await page.waitForFunction(() => document.activeElement?.getAttribute("aria-controls")?.startsWith("panel-"));
check("Open section focuses that section's header", await page.evaluate(() => document.activeElement?.getAttribute("aria-expanded") === "true"));
await openExperience();
if (await summarySec.getByRole("button", { expanded: false }).count()) await summarySec.getByRole("button", { expanded: false }).first().click();
await summaryBox.fill(summaryWas);
await page.getByRole("tab", { name: /^Fit/ }).click();
await page.getByTestId("fit-summary").getByText("Fits on 1 page.").waitFor();
check("Fit clears once the resume is short again", true);
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
// Done closes the dialog after a short exit animation; until then it is modal and typing behind it is lost
await page.getByTestId("versions-dialog").waitFor({ state: "hidden" });
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

// Compare: the active copy against the Elena version, then against its identical original
await page.getByTestId("version-compare").click();
await page.getByTestId("compare-view").waitFor();
await page.getByTestId("compare-b").selectOption({ index: 1 });
check("Compare shows the changed contact name as removed and added lines", (await page.locator('[data-diff="removed"]').filter({ hasText: "Name: Quinn QA" }).count()) === 1 && (await page.locator('[data-diff="added"]').filter({ hasText: "Name: Elena Marchetti-Rossi" }).count()) === 1);
check("Compare states changes in words and counts", /sections? differ/.test(await page.getByTestId("compare-summary").innerText()) && (await page.locator('[data-testid="diff-section"][data-status="changed"]').first().innerText()).includes("Changed"));
await page.getByTestId("compare-b").selectOption({ label: "New resume" });
check("Comparing identical versions says so and hides unchanged sections", (await page.getByTestId("compare-summary").innerText()).includes("same content") && (await page.getByTestId("diff-section").count()) === 0);
await page.getByTestId("compare-show-same").click();
check("Show unchanged lists the sections", (await page.getByTestId("diff-section").count()) > 0);
await page.getByTestId("compare-back").click();
check("Back returns to the versions list", await page.getByTestId("versions-dialog").isVisible());
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

// application tracker
await page.goto(`${BASE}/applications`);
await page.getByTestId("applications-empty").waitFor();
check("applications: empty state explains the tracker", true);
await page.getByTestId("add-application").click();
await page.getByLabel("Company").fill("Acme");
await page.getByLabel("Role", { exact: true }).fill("Engineer");
await page.getByLabel("Status").selectOption("applied");
await page.getByLabel("Job posting").fill("We need TypeScript experience.");
await page.getByTestId("save-application").click();
await page.getByTestId("application").first().waitFor();
const appText = await page.getByTestId("application").first().innerText();
check("applications: added row shows role, company and status in words", appText.includes("Engineer") && appText.includes("Acme") && appText.includes("Status: Applied"), appText.slice(0, 80));
await page.reload();
await page.getByTestId("application").first().waitFor();
check("applications: persists across reload", await page.getByTestId("application").count() === 1);
const storedApps = await page.evaluate(() => JSON.parse(localStorage.getItem("resume-builder:applications:v1") ?? "{}"));
check("applications: stored with posting snapshot and appliedAt", storedApps.items?.[0]?.posting === "We need TypeScript experience." && typeof storedApps.items?.[0]?.appliedAt === "number");
await page.getByRole("button", { name: "Delete Acme" }).click();
check("applications: delete shows Undo, not a confirm", await page.getByTestId("applications-empty").isVisible() && await page.getByTestId("toast").getByRole("button", { name: "Undo" }).isVisible());
await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
check("applications: Undo restores the row", await page.getByTestId("application").count() === 1);
await page.getByTestId("add-application").click();
check("applications: dialog opens with Company focused", await page.evaluate(() => document.activeElement?.closest("label,.field")?.querySelector("label")?.textContent === "Company"));
await page.getByTestId("save-application").click();
check("applications: Save with no company or role explains why", await page.getByRole("alert").filter({ hasText: "Enter a company or a role" }).isVisible());
await page.getByLabel("Company").fill("Draft Co");
await page.keyboard.press("Escape");
check("applications: Esc on a changed draft asks before discarding", await page.getByTestId("discard-confirm").isVisible());
await page.getByRole("button", { name: "Keep editing" }).click();
check("applications: Keep editing keeps the draft", await page.getByLabel("Company").inputValue() === "Draft Co");
await page.getByRole("button", { name: "Cancel" }).click();
await page.getByTestId("discard-application").click();
check("applications: Discard closes without adding", await page.getByTestId("application").count() === 1);
await page.getByRole("button", { name: "Delete Acme" }).click();
await page.waitForTimeout(100);
check("applications: focus moves to Add after deleting the last row", await page.evaluate(() => document.activeElement?.getAttribute("data-testid")) === "add-application");
await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
await page.getByTestId("application").first().waitFor();
await page.getByRole("button", { name: "Edit Acme" }).click();
await page.getByLabel("Status").selectOption("offer");
await page.getByTestId("save-application").click();
await page.getByLabel("Offer (1)").check();
await page.getByRole("button", { name: "Edit Acme" }).click();
await page.getByLabel("Status").selectOption("rejected");
await page.getByTestId("save-application").click();
check("applications: filter falls back to All when its last row moves", await page.getByTestId("application").count() === 1 && await page.getByLabel(/^All \(1\)/).isChecked());

// cover letter
await page.goto(`${BASE}/editor`);
await page.waitForSelector("[data-resume]");
await page.getByRole("tab", { name: /Letter/ }).click();
await page.getByTestId("cover-panel").waitFor();
check("letter: a fresh version starts from the template with a placeholder warning", await page.getByTestId("cover-block").count() === 5 && await page.getByTestId("cover-missing").isVisible());
await page.getByLabel("Company", { exact: true }).fill("Northgate Freight");
await page.getByLabel("Role", { exact: true }).fill("Operations Analyst");
await page.getByLabel("Hiring manager (optional)").fill("Sam Lee");
const letterSheet = await page.getByTestId("preview-sheet").innerText();
check("letter: preview takes name from the resume and company, role and manager from the fields", letterSheet.includes("Elena Marchetti") && letterSheet.includes("Dear Sam Lee,") && letterSheet.includes("Operations Analyst position at Northgate Freight") && !letterSheet.includes("[Company]"), letterSheet.slice(0, 80));
await page.getByRole("button", { name: "Actions for Opening" }).click();
await page.getByRole("menuitem", { name: "Remove Opening" }).click();
check("letter: removing a block shows Undo", await page.getByTestId("cover-block").count() === 4 && await page.getByTestId("toast").getByRole("button", { name: "Undo" }).isVisible());
await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
check("letter: Undo puts the block back", await page.getByTestId("cover-block").count() === 5);
await page.reload();
await page.getByRole("tab", { name: /Letter/ }).click();
check("letter: saved across reload", await page.getByLabel("Company", { exact: true }).inputValue() === "Northgate Freight");
const storedCover = JSON.parse((await storedFor(page, "cover")) ?? "{}");
check("letter: stored under the active version's cover key", storedCover.company === "Northgate Freight" && storedCover.blocks?.length === 5);
await page.getByTestId("print-btn").click();
await page.getByTestId("export-dialog").waitFor();
check("letter: export dialog says it saves the letter", await page.getByRole("heading", { name: "Save the letter as PDF" }).isVisible());
await page.keyboard.press("Escape");
await page.goto(`${BASE}/print/cover`);
await page.waitForSelector("[data-letter]");
await page.pdf({ path: `${OUT}/cover-a4.pdf`, preferCSSPageSize: true, printBackground: true });
const coverPdf = await pdfInfo(`${OUT}/cover-a4.pdf`);
const at = (t) => coverPdf.text.indexOf(t);
check("letter: PDF is one page with a real text layer in reading order", coverPdf.pages === 1 && at("Elena Marchetti") >= 0 && at("Elena Marchetti") < at("Dear Sam Lee") && at("Dear Sam Lee") < at("Operations Analyst position") && at("Operations Analyst position") < at("Sincerely"), `pages=${coverPdf.pages}`);
await page.goto(`${BASE}/editor`);
await page.getByRole("tab", { name: /Data/ }).click();
const bundleJson = await page.evaluate(() => { const raw = Object.keys(localStorage).find((k) => k.startsWith("resume-builder:cover:v1:")); return raw ? localStorage.getItem(raw) : null; });
check("letter: exists in storage for the Data export", !!bundleJson);

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
