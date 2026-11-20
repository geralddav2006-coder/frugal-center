// Pitch mockups: builds each business's profile and one deal in the LOCAL demo app,
// screenshots what neighbors would see, then ends the deal again.
// Run the app locally first (npm run dev), then: npm run pitch:mockup -- businesses.json [outDir]
// Add --cards-only to rebuild just the cards from screenshots already in outDir (after a copy change).
// Each entry: { name, category, address, zip?, description, photo? and logo? (file path or https URL),
//   pitch? (the card's benefit line; a default is picked from the category and deal),
//   deal: { type: "surplus" | "promotion", title, description?, orig?, price?, qty?, pct?, off? } }
import { createRequire } from "node:module"; import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url); const { chromium } = require("playwright");
const B = process.env.FC_URL || "http://localhost:3000";
const CARDS_ONLY = process.argv.includes("--cards-only");
const [input, outArg] = process.argv.slice(2).filter((a) => a !== "--cards-only");
if (!input) { console.error("Usage: npm run pitch:mockup -- businesses.json [outDir]"); process.exit(1); }
const list = JSON.parse(fs.readFileSync(input, "utf8"));
const OUT = path.resolve(outArg || "pitch-out/mockups"); fs.mkdirSync(OUT, { recursive: true });
const TMP = path.resolve("pitch-out/.tmp"); fs.mkdirSync(TMP, { recursive: true });
import { card, pitchCopy } from "./card.mjs";

const STOCK = {
  "food-drink": "1504674900247-0877df9cc836",
  "beauty-wellness": "1519014816548-bf5fe059798b",
  shopping: "1441986300917-64674bd600d8",
  activities: "1544367567-0f2fcb009e0b",
  services: "1607860108855-64acf2078ed9",
};
const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
async function localPhoto(src, name) {
  if (src && !/^https?:/.test(src)) return path.resolve(src);
  const url = src || `https://images.unsplash.com/photo-${STOCK[name.category] ?? STOCK["food-drink"]}?auto=format&fit=crop&w=1400&q=80`;
  const file = path.join(TMP, `${slug(name.name)}-${Date.now()}.jpg`);
  execFileSync("curl", ["-sSfL", "-o", file, url]); // curl honors the HTTPS proxy settings
  return file;
}
/** 6 PM Dracut time today, or tomorrow once it's after 4 PM. */
function pickupBy() {
  const part = (d, o) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", ...o }).format(d);
  const now = new Date();
  const day = Number(part(now, { hour: "2-digit", hour12: false })) >= 16 ? new Date(now.getTime() + 86400000) : now;
  return `${part(day, { year: "numeric", month: "2-digit", day: "2-digit" })}T18:00`;
}
const hide = (ctx) => ctx.addInitScript(() => {
  try { localStorage.setItem("fc-demo-banner-dismissed", "1"); } catch {}
  const s = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; (document.head || document.documentElement).appendChild(st); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", s); else s();
});
const settle = async (p) => {
  await p.waitForLoadState("networkidle");
  await p.evaluate(async () => { for (const i of document.images) i.loading = "eager"; await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))); });
  await p.waitForTimeout(1200);
};

const b = await chromium.launch();
const img = (f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`;
async function makeCard(biz, profile, deal, out) {
  const ctx = await b.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); await p.setContent(card({ title: biz.name, ...pitchCopy(biz), left: img(profile), right: img(deal) }));
  await p.waitForTimeout(800); await p.screenshot({ path: out }); await ctx.close();
}
for (const biz of list) {
  const id = slug(biz.name); console.log("→", biz.name);
  if (CARDS_ONLY) {
    const [profile, deal] = ["profile", "deal"].map((k) => path.join(OUT, `${id}-${k}.png`));
    if (!fs.existsSync(profile) || !fs.existsSync(deal)) { console.log("  no screenshots yet; run without --cards-only first"); continue; }
    await makeCard(biz, profile, deal, path.join(OUT, `${id}-card.png`)); console.log("  saved", path.join(OUT, `${id}-card.png`));
    continue;
  }
  const photo = await localPhoto(biz.photo, biz);
  // 1. Owner signs up and creates the business (the same steps a real owner takes).
  const octx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/New_York" }); await hide(octx);
  const o = await octx.newPage();
  await o.goto(`${B}/signup?next=/for-business/start`);
  await o.fill("input[name=fullName]", "Mockup Owner");
  await o.fill("input[name=email]", `mockup-${id}-${Date.now()}@example.com`);
  await o.fill("input[name=password]", "mockup-password-123");
  await o.click("button[type=submit]");
  await o.waitForURL(/\/for-business\/start/, { timeout: 60000 });
  await o.fill("#b-name", biz.name);
  await o.selectOption("#b-cat", biz.category);
  if (biz.description) await o.fill("#b-desc", biz.description);
  await o.getByRole("button", { name: /Continue/ }).click();
  await o.fill("#b-addr", biz.address);
  await o.fill("#b-city", biz.city || "Dracut");
  await o.fill("#b-state", biz.state || "MA");
  await o.fill("#b-zip", biz.zip || "01826");
  await o.getByRole("button", { name: /Continue/ }).click();
  await o.getByRole("button", { name: /Continue/ }).click();
  await o.getByLabel("Upload Cover photo").setInputFiles(photo);
  await o.getByRole("button", { name: /Remove Cover photo/ }).waitFor({ timeout: 30000 });
  if (biz.logo) {
    // The business's own logo replaces the initials on its page and deal.
    await o.getByLabel("Upload Logo").setInputFiles(await localPhoto(biz.logo, { ...biz, name: `${biz.name}-logo` }));
    await o.getByRole("button", { name: /Remove Logo/ }).waitFor({ timeout: 30000 });
  }
  await o.getByRole("button", { name: "Create business" }).click();
  await o.waitForURL(/\/dashboard\/billing/, { timeout: 60000 });
  // 2. Post the deal.
  const d = biz.deal; const type = d.type === "promotion" ? "promotion" : "surplus";
  await o.goto(`${B}/dashboard/deals/new?type=${type}`); await o.waitForLoadState("networkidle");
  await o.fill("#d-title", d.title);
  if (d.description) await o.fill("#d-desc", d.description);
  await o.getByLabel("Upload deal photos").setInputFiles(d.photo ? await localPhoto(d.photo, biz) : photo);
  await o.getByRole("button", { name: /Remove photo 1/ }).waitFor({ timeout: 30000 });
  if (type === "promotion") {
    const kind = d.pct ? "percent" : d.off ? "amount_off" : "fixed_price";
    await o.selectOption("#d-kind", kind);
    if (kind === "percent") await o.fill("#d-pct", String(d.pct));
    if (kind === "amount_off") await o.fill("#d-off", String(d.off));
    if (kind === "fixed_price") { await o.fill("#d-orig", String(d.orig)); await o.fill("#d-price", String(d.price)); }
    if (d.qty && (await o.locator("#d-qty").count())) await o.fill("#d-qty", String(d.qty));
  } else {
    await o.fill("#d-orig", String(d.orig)); await o.fill("#d-price", String(d.price)); await o.fill("#d-qty", String(d.qty ?? 10));
    await o.fill("#d-end", pickupBy()); // a normal end-of-day pickup, whatever time the mockup is made
  }
  await o.getByRole("button", { name: /Publish now/ }).click();
  await o.waitForURL(/\/dashboard\/deals\/[0-9a-f-]{36}/, { timeout: 60000 });
  await o.getByText("Live", { exact: true }).first().waitFor();
  const dealPath = new URL(o.url()).pathname.replace("/dashboard", "");
  const bizSlug = await o.evaluate(() => document.querySelector('a[href^="/business/"]')?.getAttribute("href")) || null;
  // 3. What neighbors see.
  const cctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); await hide(cctx);
  const c = await cctx.newPage();
  const profile = path.join(OUT, `${id}-profile.png`), deal = path.join(OUT, `${id}-deal.png`);
  await c.goto(`${B}${dealPath}`); await settle(c); await c.screenshot({ path: deal });
  const href = bizSlug || (await c.locator('a[href^="/business/"]').first().getAttribute("href"));
  await c.goto(`${B}${href}`); await settle(c); await c.screenshot({ path: profile });
  // 4. One shareable card.
  await cctx.close();
  await makeCard(biz, profile, deal, path.join(OUT, `${id}-card.png`));
  // 5. Take the mockup back down so it doesn't stay live in the demo.
  await o.getByRole("button", { name: "End", exact: true }).click();
  const dlg = o.getByRole("dialog"); if (await dlg.count()) await dlg.getByRole("button", { name: /End/ }).last().click();
  await o.waitForTimeout(1500);
  await octx.close();
  console.log("  saved", path.join(OUT, `${id}-card.png`));
}
await b.close();

