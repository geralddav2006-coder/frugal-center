// Pitch mockups: builds each business's profile and one deal in the LOCAL demo app,
// screenshots what neighbors would see, then ends the deal again.
// Run the app locally first (npm run dev), then: npm run pitch:mockup -- businesses.json [outDir]
// Each entry: { name, category, address, zip?, description, photo? (file path or https URL),
//   deal: { type: "surplus" | "promotion", title, description?, orig?, price?, qty?, pct?, off? } }
import { createRequire } from "node:module"; import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url); const { chromium } = require("playwright");
const B = process.env.FC_URL || "http://localhost:3000";
const [, , input, outArg] = process.argv;
if (!input) { console.error("Usage: npm run pitch:mockup -- businesses.json [outDir]"); process.exit(1); }
const list = JSON.parse(fs.readFileSync(input, "utf8"));
const OUT = path.resolve(outArg || "pitch-out/mockups"); fs.mkdirSync(OUT, { recursive: true });
const TMP = path.resolve("pitch-out/.tmp"); fs.mkdirSync(TMP, { recursive: true });
import { card } from "./card.mjs";

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
for (const biz of list) {
  const id = slug(biz.name); console.log("→", biz.name);
  const photo = await localPhoto(biz.photo, biz);
  // 1. Owner signs up and creates the business (the same steps a real owner takes).
  const octx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await hide(octx);
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
  const img = (f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`;
  await cctx.close();
  const cctx2 = await b.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  const p2 = await cctx2.newPage(); await p2.setContent(card({ title: biz.name, sub: "on Frugal Center, in front of Dracut neighbors", left: img(profile), right: img(deal), note: "Mockup preview<br>not live yet" }));
  await p2.waitForTimeout(800); await p2.screenshot({ path: path.join(OUT, `${id}-card.png`) }); await cctx2.close();
  // 5. Take the mockup back down so it doesn't stay live in the demo.
  await o.getByRole("button", { name: "End", exact: true }).click();
  const dlg = o.getByRole("dialog"); if (await dlg.count()) await dlg.getByRole("button", { name: /End/ }).last().click();
  await o.waitForTimeout(1500);
  await octx.close();
  console.log("  saved", path.join(OUT, `${id}-card.png`));
}
await b.close();

