// Private previews: builds each business's page and one example deal on the site, hidden from everyone
// except its secret /p/<token> link, so you can show the owner the real thing. The owner claims it there.
// Runs against FC_URL (default: the local app) as one holding account, signing it up the first time:
//   FC_URL=https://www.frugal.center FC_PREVIEW_EMAIL=... FC_PREVIEW_PASSWORD=... \
//     node scripts/pitch/preview.mjs businesses.json [links.json]
// Entries use the same shape as mockup.mjs (name, category, address, city?, zip, description, photo?, logo?, deal).
// Each entry's link is written to links.json. A business already built (same name) is skipped.
import { createRequire } from "node:module"; import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url); const { chromium } = require("playwright");
const B = (process.env.FC_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.FC_PREVIEW_EMAIL, PASSWORD = process.env.FC_PREVIEW_PASSWORD;
const [input, outArg] = process.argv.slice(2);
if (!input || !EMAIL || !PASSWORD) { console.error("Usage: FC_PREVIEW_EMAIL=... FC_PREVIEW_PASSWORD=... node scripts/pitch/preview.mjs businesses.json [links.json]"); process.exit(1); }
const list = JSON.parse(fs.readFileSync(input, "utf8"));
const OUT = path.resolve(outArg || "pitch-out/preview-links.json");
const links = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const TMP = path.resolve("pitch-out/.tmp"); fs.mkdirSync(TMP, { recursive: true });

const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function localFile(src, name) {
  if (!/^https?:/.test(src)) return path.resolve(src);
  const file = path.join(TMP, `${slug(name)}-${Date.now()}.jpg`);
  execFileSync("curl", ["-sSfL", "-o", file, src]);
  return file;
}
const nyDate = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
/** Monday-to-Saturday date at least `days` ahead, Dracut/Wakefield time. */
function workday(days) {
  let t = Date.now() + days * 86400000;
  while (new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date(t)) === "Sun") t += 86400000;
  return nyDate(t);
}

// The live site is only reachable through the HTTPS proxy in some environments.
const proxy = process.env.HTTPS_PROXY && !B.includes("localhost") ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch(proxy ? { proxy } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/New_York", ignoreHTTPSErrors: !!proxy });
await ctx.addInitScript(() => { try { localStorage.setItem("fc-demo-banner-dismissed", "1"); } catch {} });
const o = await ctx.newPage();

// Sign in as the holding account (create it the first time).
await o.goto(`${B}/login?next=/`);
await o.fill("input[name=email]", EMAIL); await o.fill("input[name=password]", PASSWORD); await o.click("button[type=submit]");
await o.waitForLoadState("networkidle"); await o.waitForTimeout(1500);
if (/\/login/.test(o.url())) {
  await o.goto(`${B}/signup?next=/`);
  await o.fill("input[name=fullName]", "Frugal Center Previews");
  await o.fill("input[name=email]", EMAIL); await o.fill("input[name=password]", PASSWORD); await o.click("button[type=submit]");
  await o.waitForURL((u) => !/\/signup/.test(u.pathname), { timeout: 60000 });
  console.log("created holding account", EMAIL);
}

for (const biz of list) {
  console.log("→", biz.name);
  if (links[biz.name]) { console.log("  already built:", links[biz.name]); continue; }
  await o.goto(`${B}/for-business/start?preview=1`); await o.waitForLoadState("networkidle");
  await o.fill("#b-name", biz.name);
  await o.selectOption("#b-cat", biz.category);
  if (biz.description) await o.fill("#b-desc", biz.description);
  await o.getByRole("button", { name: /Continue/ }).click();
  await o.fill("#b-addr", biz.address);
  await o.fill("#b-city", biz.city || "Wakefield");
  await o.fill("#b-state", biz.state || "MA");
  await o.fill("#b-zip", biz.zip || "01880");
  await o.getByRole("button", { name: /Continue/ }).click();
  if (biz.phone && (await o.locator("#b-phone").count())) await o.fill("#b-phone", biz.phone);
  await o.getByRole("button", { name: /Continue/ }).click();
  if (biz.photo) {
    await o.getByLabel("Upload Cover photo").setInputFiles(localFile(biz.photo, biz.name));
    await o.getByRole("button", { name: /Remove Cover photo/ }).waitFor({ timeout: 60000 });
  }
  if (biz.logo) {
    await o.getByLabel("Upload Logo").setInputFiles(localFile(biz.logo, `${biz.name}-logo`));
    await o.getByRole("button", { name: /Remove Logo/ }).waitFor({ timeout: 60000 });
  }
  await o.getByRole("button", { name: "Create business" }).click();
  await o.waitForURL(/\/dashboard\?preview=1/, { timeout: 90000 });
  const link = await o.locator('main a[href^="/p/"], a[href^="/p/"]').first().getAttribute("href");

  // The example deal.
  const d = biz.deal; const type = ["promotion", "slow_hours", "appointment"].includes(d.type) ? d.type : "surplus";
  await o.goto(`${B}/dashboard/deals/new?type=${type}`); await o.waitForLoadState("networkidle");
  await o.fill("#d-title", d.title);
  if (d.description) await o.fill("#d-desc", d.description);
  if (d.photo || biz.photo) {
    await o.getByLabel("Upload deal photos").setInputFiles(localFile(d.photo || biz.photo, `${biz.name}-deal`));
    await o.getByRole("button", { name: /Remove photo 1/ }).waitFor({ timeout: 60000 });
  }
  if (type === "appointment") {
    await o.fill("#d-orig", String(d.orig)); await o.fill("#d-price", String(d.price));
    if (d.minutes) await o.selectOption("#d-dur", String(d.minutes));
    const times = d.times?.length ? d.times : ["11:00"];
    for (let i = 0; i < times.length; i++) {
      if (i > 0) await o.getByRole("button", { name: /Add another time/ }).click();
      await o.fill(`#slot-${i}`, `${workday(2)}T${times[i]}`);
    }
  } else if (type !== "surplus") {
    const kind = d.pct ? "percent" : d.off ? "amount_off" : "fixed_price";
    await o.selectOption("#d-kind", kind);
    if (kind === "percent") await o.fill("#d-pct", String(d.pct));
    if (kind === "amount_off") await o.fill("#d-off", String(d.off));
    if (kind === "fixed_price") { await o.fill("#d-orig", String(d.orig)); await o.fill("#d-price", String(d.price)); }
    if (type === "slow_hours") {
      if (d.from) await o.fill("#d-ws", d.from);
      if (d.until) await o.fill("#d-we", d.until);
      if (d.days) for (const btn of await o.getByRole("button", { name: /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/ }).all()) {
        const want = d.days.includes((await btn.textContent()).trim()); const on = (await btn.getAttribute("aria-pressed")) === "true";
        if (want !== on) await btn.click();
      }
    }
  } else {
    // Leftovers: the deal stays up for a week so the preview still looks live when you visit.
    await o.fill("#d-orig", String(d.orig)); await o.fill("#d-price", String(d.price)); await o.fill("#d-qty", String(d.qty ?? 10));
    await o.fill("#d-end", `${workday(7)}T${d.until || "18:00"}`);
  }
  await o.getByRole("button", { name: /Publish now/ }).click();
  await o.waitForURL(/\/dashboard\/deals\/[0-9a-f-]{36}/, { timeout: 90000 });
  links[biz.name] = `${B.replace("frugal-center.vercel.app", "www.frugal.center")}${link}`;
  fs.writeFileSync(OUT, JSON.stringify(links, null, 2));
  console.log("  ", links[biz.name]);
}
await browser.close();
