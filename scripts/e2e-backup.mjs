// End-to-end check of encrypted backup and backup reminders against a running server (default http://localhost:3100).
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3100";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rb-backup-"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const external = [];
page.on("request", (r) => { const u = new URL(r.url()); if (!["localhost", "127.0.0.1"].includes(u.hostname) && u.protocol.startsWith("http")) external.push(r.url()); });

const openData = async () => {
  await page.goto(`${BASE}/editor`);
  await page.getByRole("tab", { name: /Data/ }).click();
  await page.getByTestId("encrypt-toggle").waitFor();
};

await openData();
check("never backed up is shown first", (await page.getByTestId("backup-age").innerText()).includes("Never backed up"));

// Encrypted export of the open version.
await page.getByTestId("encrypt-toggle").check();
await page.getByRole("button", { name: "Export JSON" }).click();
await page.getByTestId("passphrase-dialog").waitFor();
await page.getByLabel("Passphrase", { exact: true }).fill("short");
await page.getByLabel("Repeat the passphrase").fill("short");
await page.getByTestId("passphrase-submit").click();
check("a short passphrase is refused", (await page.getByTestId("passphrase-error").innerText()).includes("at least 8"));
await page.getByLabel("Passphrase", { exact: true }).fill("correct horse battery");
await page.getByLabel("Repeat the passphrase").fill("correct horse batterx");
await page.getByTestId("passphrase-submit").click();
check("mismatched passphrases are refused", (await page.getByTestId("passphrase-error").innerText()).includes("do not match"));
await page.getByLabel("Repeat the passphrase").fill("correct horse battery");
const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("passphrase-submit").click()]);
const file = path.join(tmp, download.suggestedFilename());
await download.saveAs(file);
const text = fs.readFileSync(file, "utf8");
check("file name ends .encrypted.json", file.endsWith(".encrypted.json"), path.basename(file));
check("file holds no readable resume text", !text.includes("Elena") && JSON.parse(text).kind === "resume-builder-encrypted");
await page.getByTestId("passphrase-dialog").waitFor({ state: "hidden" });
check("single-version export marks the backup", (await page.getByTestId("backup-age").innerText()).includes("just now"));

// Import: wrong passphrase, then the right one.
await page.getByTestId("encrypt-toggle").uncheck();
await page.getByTestId("import-input").setInputFiles(file);
await page.getByTestId("passphrase-dialog").waitFor();
await page.getByLabel("Passphrase", { exact: true }).fill("not the passphrase");
await page.getByTestId("passphrase-submit").click();
await page.getByTestId("passphrase-error").filter({ hasText: "did not open" }).waitFor();
check("wrong passphrase keeps the dialog open with an error", await page.getByTestId("passphrase-dialog").isVisible());
await page.getByLabel("Passphrase", { exact: true }).fill("correct horse battery");
await page.getByTestId("passphrase-submit").click();
await page.getByTestId("passphrase-dialog").waitFor({ state: "hidden" });
await page.getByTestId("toast").filter({ hasText: "Imported as a new version" }).waitFor();
check("right passphrase imports as a new version", true);

// Reminder: age the changes by 8 days and reload.
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const k = "resume-builder:backup:v1";
  const s = JSON.parse(localStorage.getItem(k));
  s.dirtySince = Date.now() - 8 * 86_400_000;
  localStorage.setItem(k, JSON.stringify(s));
});
await openData();
await page.getByTestId("backup-due").waitFor({ timeout: 5000 }).then(() => check("reminder appears after 7 days of unbacked changes", true), () => check("reminder appears after 7 days of unbacked changes", false));
check("Data tab carries a backup badge", (await page.getByRole("tab", { name: /Data/ }).innerText()).includes("backup due") || (await page.getByRole("tab", { name: /Data/ }).locator(".sr-only").count()) > 0);
await page.getByRole("button", { name: /Export all versions/ }).click();
await page.waitForTimeout(300);
check("a full export clears the reminder", (await page.getByTestId("backup-due").count()) === 0);

check("no requests left localhost", external.length === 0, external.join(", "));
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(results.every(Boolean) ? 0 : 1);
