// Screenshots at 375/768/1024/1440 in light and dark, plus reports overflow and touch targets under 44px.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.env.SHOTS ?? path.resolve("scripts/out/shots");
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
fs.mkdirSync(OUT, { recursive: true });
const sizes = [[375, 812], [768, 1024], [1024, 768], [1440, 900]];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const small = [];

async function audit(page, label) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 1) small.push(`${label}: horizontal overflow ${over}px`);
  const bad = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('a[href], button, select, input:not([type="hidden"]), summary, [role="tab"], [role="radio"], textarea')) {
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.bottom < 0 || r.top > 1e5) continue;
      if (el.closest("[inert], [aria-hidden='true']")) continue;
      // inline text links inside prose are exempt (WCAG 2.5.8 inline exception)
      if (el.tagName === "A" && el.closest("p, li") && cs.display === "inline") continue;
      if (el.closest("label.seg-opt, label.switch")) { if (el.tagName === "INPUT" && r.width >= 44 && r.height >= 44) continue; }
      if (r.width < 43.5 || r.height < 43.5) out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 28)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out.slice(0, 12);
  });
  if (bad.length) small.push(`${label}: ${bad.join("; ")}`);
}

for (const scheme of ["light", "dark"]) {
  for (const [w, h] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const page = await ctx.newPage();
    const tag = `${w}-${scheme}`;
    for (const [name, url] of [["landing", "/"], ["templates", "/templates"], ["editor", "/editor"]]) {
      await page.goto(BASE + url);
      await page.waitForTimeout(600);
      if (name === "landing") { await page.getByRole("button", { name: "What an ATS reads" }).click(); await page.waitForTimeout(900); }
      await page.screenshot({ path: `${OUT}/${name}-${tag}.png`, fullPage: name !== "editor" });
      await audit(page, `${name} ${tag}`);
    }
    // editor states
    await page.goto(BASE + "/editor");
    await page.waitForSelector("[data-resume]", { state: "attached" });
    if (w < 768) {
      await page.getByRole("button", { name: "Design", exact: true }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/editor-design-${tag}.png`, fullPage: true });
      await audit(page, `editor-design ${tag}`);
      await page.getByRole("button", { name: "Preview", exact: true }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/editor-preview-${tag}.png` });
      await audit(page, `editor-preview ${tag}`);
    } else if (w < 1024) {
      await page.getByRole("button", { name: "Edit resume" }).first().click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/editor-drawer-${tag}.png` });
      await audit(page, `editor-drawer ${tag}`);
      await page.getByRole("tab", { name: "Design" }).click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/editor-drawer-design-${tag}.png` });
    } else {
      await page.getByRole("tab", { name: "Design" }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/editor-design-${tag}.png` });
      await audit(page, `editor-design ${tag}`);
      await page.getByRole("tab", { name: /ATS check/ }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/editor-ats-${tag}.png` });
      await page.getByRole("tab", { name: "Content" }).click();
      await page.getByRole("button", { name: "Actions for Summary" }).click();
      await page.screenshot({ path: `${OUT}/editor-menu-${tag}.png` });
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Download PDF" }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/editor-export-${tag}.png` });
    }
    await ctx.close();
  }
}
await browser.close();
console.log(small.length ? "ISSUES:\n" + small.join("\n") : "no overflow or small targets found");
