// General example pitch set from the demo bakery. Run the app locally first, then: npm run pitch:example
import { createRequire } from "node:module"; import fs from "node:fs"; import path from "node:path";
import { card } from "./card.mjs";
const require = createRequire(import.meta.url); const { chromium } = require("playwright");
const B = "http://localhost:3000";
const OUT = path.resolve("pitch-out/example"); fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const mk = async () => {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await c.addInitScript(() => {
    try { localStorage.setItem("fc-demo-banner-dismissed", "1"); } catch {}
    const f = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(st);
      for (const el of document.querySelectorAll("p")) if (/^Demo mode · sample data/.test(el.textContent || "")) el.style.display = "none"; };
    document.addEventListener("DOMContentLoaded", f);
  });
  return c;
};
const settle = async (p) => {
  await p.waitForLoadState("networkidle");
  await p.evaluate(async () => { for (const i of document.images) i.loading = "eager"; await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))); });
  await p.waitForTimeout(1500);
};
const shot = async (p, url, name) => { await p.goto(B + url); await settle(p); const f = path.join(OUT, name); await p.screenshot({ path: f }); return f; };

// Customer side, signed out
const cc = await mk(); const c = await cc.newPage();
const profile = await shot(c, "/business/broadway-bakery", "raw-profile.png");
const pie = await c.locator('a[href^="/deals/"]', { hasText: "Thanksgiving pies" }).first().getAttribute("href");
const deal = await shot(c, pie, "raw-deal.png");
await cc.close();
// Owner side
const oc = await mk(); const o = await oc.newPage();
await o.goto(B + "/login?next=/dashboard");
await o.fill("input[name=email]", "owner@demo.frugal.center"); await o.fill("input[name=password]", "frugal-demo");
await Promise.all([o.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }), o.click("button[type=submit]")]);
await o.goto(B + "/dashboard/deals/new?type=surplus"); await settle(o);
await o.fill("#d-title", "Day-old bagels, half dozen"); await o.fill("#d-orig", "9"); await o.fill("#d-price", "4"); await o.fill("#d-qty", "10");
await o.locator("#d-title").blur(); await o.evaluate(() => window.scrollTo(0, 0)); await o.waitForTimeout(600);
const post = path.join(OUT, "raw-post.png"); await o.screenshot({ path: post });
const redeem = await shot(o, "/dashboard/redeem", "raw-redeem.png");
const results = await shot(o, "/dashboard/analytics", "raw-results.png");
const free = await shot(o, "/dashboard/billing", "raw-free.png");
await oc.close();

const img = (f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`;
const kc = await b.newContext({ viewport: { width: 1080, height: 1350 } }); const k = await kc.newPage();
for (const [file, opts] of [
  ["card-example.png", { title: "Broadway Bakery", sub: "Example: how your business shows up", left: img(profile), right: img(deal) }],
  ["card-how-it-works.png", { title: "Post a deal in 2 minutes", sub: "and see every customer it brings in", left: img(post), right: img(results) }],
]) {
  await k.setContent(card({ ...opts, note: "Example business<br>sample data" })); await k.waitForTimeout(800);
  await k.screenshot({ path: path.join(OUT, file) });
}
await b.close();
console.log(JSON.stringify({ profile, deal, post, redeem, results, free }));
