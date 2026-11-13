/**
 * End-to-end flow test against a running Frugal Center (local demo mode).
 *   npm run dev            # or: npm run build && npm start
 *   npm run test:e2e       # BASE_URL defaults to http://localhost:3000
 *
 * Covers: sign-up, location (incl. denied geolocation), discovery, follow, merchant
 * publish, follower notification, claim, voucher QR + code, camera QR scan
 * (Chromium fake camera fed with the real voucher QR), manual code entry,
 * invalid / reused codes, savings, merchant dashboard, subscription gating and
 * unauthorized access.
 */
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
}
const { chromium } = pw;

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = "frugal-demo";
const stamp = Date.now().toString(36);
const results = [];
const tmp = mkdtempSync(path.join(tmpdir(), "fc-e2e-"));

async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t });
    console.log(`  ✓ ${name} (${Date.now() - t}ms)`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log(`  ✗ ${name}\n    ${err.message.split("\n").slice(0, 6).join("\n    ")}`);
    throw err;
  }
}

async function login(page, email, password = PASSWORD, next = "/") {
  await page.goto(`${BASE}/login?next=${encodeURIComponent(next)}`);
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }), page.click("button[type=submit]")]);
}

async function signup(page, name, email, next) {
  await page.goto(`${BASE}/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.fill("input[name=fullName]", name);
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", PASSWORD);
  await page.click("button[type=submit]");
  const outcome = await Promise.race([
    page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 60000 }).then(() => null),
    page.locator("form [role=alert]").waitFor({ timeout: 60000 }).then(() => page.locator("form [role=alert]").innerText()),
  ]);
  if (outcome) throw new Error(`Sign-up failed: ${outcome} (tip: start the server with FC_SIGNUP_LIMIT_PER_HOUR=1000 for repeated e2e runs)`);
}

async function text(page) {
  return page.locator("body").innerText();
}

async function createSurplusDeal(page, title, orig, price, qty) {
  await page.goto(`${BASE}/dashboard/deals/new?type=surplus`);
  await page.fill("#d-title", title);
  await page.fill("#d-desc", "Created by the end-to-end test.");
  await page.fill("#d-orig", String(orig));
  await page.fill("#d-price", String(price));
  await page.fill("#d-qty", String(qty));
  await page.getByRole("button", { name: /Publish now/ }).click();
  await page.waitForURL(/\/dashboard\/deals\/[0-9a-f-]{36}/, { timeout: 60000 });
  return page.url().split("/").pop().split("?")[0];
}

/** Render the voucher's QR SVG to a 640x480 grayscale frame; also decode it with jsQR to verify its payload. */
async function qrFrameFromVoucher(page) {
  await page.addScriptTag({ path: require.resolve("jsqr/dist/jsQR.js") });
  return page.evaluate(async () => {
    const svg = document.querySelector('[aria-label="QR code for staff to scan"] svg');
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 480;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 640, 480);
    ctx.drawImage(img, 170, 90, 300, 300);
    const data = ctx.getImageData(0, 0, 640, 480).data;
    const decoded = window.jsQR(data, 640, 480)?.data ?? null;
    const y = new Uint8Array(640 * 480);
    for (let i = 0; i < y.length; i++) y[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
    let bin = "";
    for (let i = 0; i < y.length; i += 8192) bin += String.fromCharCode(...y.subarray(i, i + 8192));
    return { decoded, yPlane: btoa(bin) };
  });
}

function writeY4m(yPlaneB64) {
  const y = Buffer.from(yPlaneB64, "base64");
  const uv = Buffer.alloc((640 / 2) * (480 / 2), 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, uv, uv]);
  const file = path.join(tmp, "qr.y4m");
  writeFileSync(file, Buffer.concat([Buffer.from("YUV4MPEG2 W640 H480 F10:1 Ip A1:1 C420jpeg\n"), frame, frame, frame]));
  return file;
}

async function main() {
  console.log(`Frugal Center e2e against ${BASE}`);
  const browser = await chromium.launch();
  const customerCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const customer = await customerCtx.newPage();
  const owner = await ownerCtx.newPage();
  const customerEmail = `e2e-${stamp}@example.com`;
  const dealTitle = `E2E Croissant Bag ${stamp}`;
  let dealId, deal2Id, voucherUrl, voucherCode, qrPayload, qrFrame, sourdoughCode, baseline;

  await step("1. Customer signs up", async () => {
    await signup(customer, "Erin Tester", customerEmail);
    assert.match(customer.url(), /\/(\?welcome=1)?$/);
    await customer.getByRole("heading", { name: /Good deals/ }).waitFor();
  });

  await step("2. Customer chooses a location (and denied geolocation is handled)", async () => {
    await customer.getByRole("button", { name: /Change location/ }).first().click();
    await customer.getByRole("dialog").waitFor();
    await customer.getByRole("button", { name: "Use my current location" }).click();
    await customer.getByText(/permission was denied|couldn't get your location|doesn't support location/).waitFor();
    await customer.getByRole("button", { name: /South Congress/ }).click();
    await customer.getByRole("button", { name: /Location: South Congress/ }).first().waitFor({ timeout: 20000 });
  });

  await step("3. Customer discovers a deal", async () => {
    await customer.goto(`${BASE}/explore?q=pastry&radius=25`);
    await customer.getByRole("link", { name: /Surprise Pastry Box/ }).first().click();
    await customer.waitForURL(/\/deals\//);
    await customer.getByRole("heading", { name: "Surprise Pastry Box" }).waitFor();
    assert.ok((await text(customer)).includes("You save $11"));
  });

  await step("4. Customer follows the business", async () => {
    await customer.getByRole("button", { name: "Follow" }).first().click();
    await customer.getByRole("button", { name: "Following" }).first().waitFor();
    await customer.goto(`${BASE}/following`);
    await customer.getByText("Main Street Bakery").first().waitFor();
  });

  await step("5. Merchant publishes a new offer", async () => {
    await login(owner, "owner@demo.frugal.center", PASSWORD, "/dashboard");
    await owner.goto(`${BASE}/dashboard`);
    await owner.getByText("Completed Redemptions").waitFor();
    const t = await text(owner);
    baseline = Number(/(\d+)\s*Completed Redemptions/.exec(t)?.[1] ?? NaN);
    assert.ok(Number.isFinite(baseline), "read redemption KPI");
    dealId = await createSurplusDeal(owner, dealTitle, 12, 5, 3);
    await owner.getByText("Live", { exact: true }).first().waitFor();
    deal2Id = await createSurplusDeal(owner, `E2E Bagel Dozen ${stamp}`, 10, 4, 3);
  });

  await step("6. Opted-in follower receives a notification", async () => {
    for (let i = 0; i < 15; i++) {
      await customer.goto(`${BASE}/notifications`);
      if ((await text(customer)).includes(dealTitle)) return;
      await customer.waitForTimeout(1000);
    }
    throw new Error("notification not found");
  });

  await step("7. Customer claims the deal (from the notification deep link)", async () => {
    await customer.getByRole("link", { name: new RegExp(dealTitle) }).click();
    await customer.waitForURL(new RegExp(`/deals/${dealId}`));
    await customer.getByRole("button", { name: "Claim Deal" }).last().click();
    await customer.waitForURL(/\/vouchers\/[0-9a-f-]{36}\?new=1/, { timeout: 60000 });
    voucherUrl = customer.url().split("?")[0];
    await customer.getByText("Deal claimed!").waitFor();
  });

  await step("8. Voucher shows both a QR code and a manual code", async () => {
    await customer.locator('[aria-label="QR code for staff to scan"] svg').waitFor();
    voucherCode = (await customer.locator("p.font-mono").first().innerText()).trim();
    assert.match(voucherCode, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    const frame = await qrFrameFromVoucher(customer);
    qrPayload = frame.decoded;
    qrFrame = frame.yPlane;
    assert.match(qrPayload ?? "", /\/dashboard\/redeem\?t=[A-Za-z0-9_-]{43}$/, "QR encodes a redeem deep link with an unguessable token");
  });

  await step("9a. Merchant rejects an invalid code with a helpful error", async () => {
    await owner.goto(`${BASE}/dashboard/redeem`);
    await owner.getByRole("tab", { name: /Enter Code/ }).click();
    await owner.fill("#code", "ZZZZ-ZZZZ");
    await owner.getByRole("button", { name: "Look up voucher" }).click();
    await owner.getByText(/couldn't find a voucher/).waitFor();
    await owner.fill("#code", "O0O0-1111");
    await owner.getByRole("button", { name: "Look up voucher" }).click();
    await owner.getByText(/never contain 0, 1, I, L or O/).waitFor();
  });

  await step("9b/10. Merchant scans the QR with the camera and confirms", async () => {
    const y4m = writeY4m(qrFrame);
    const camBrowser = await chromium.launch({
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${y4m}`],
    });
    const camCtx = await camBrowser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["camera"] });
    const cam = await camCtx.newPage();
    try {
      await login(cam, "staff@demo.frugal.center", PASSWORD, "/dashboard/redeem");
      await cam.goto(`${BASE}/dashboard/redeem`);
      await cam.getByText("Valid voucher").waitFor({ timeout: 30000 });
      assert.ok((await text(cam)).includes(dealTitle));
      assert.ok((await text(cam)).includes("Found by QR scan"));
      await cam.getByRole("button", { name: "Confirm redemption" }).click();
      await cam.getByText("Redemption Successful").waitFor();
      assert.ok((await text(cam)).includes("$5.00"));
    } finally {
      await camBrowser.close();
    }
  });

  await step("11. Voucher becomes unusable (same code is rejected, customer sees Redeemed)", async () => {
    await owner.goto(`${BASE}/dashboard/redeem`);
    await owner.getByRole("tab", { name: /Enter Code/ }).click();
    await owner.fill("#code", voucherCode);
    await owner.getByRole("button", { name: "Look up voucher" }).click();
    await owner.getByText("This voucher has already been redeemed.").first().waitFor();
    assert.equal(await owner.getByRole("button", { name: "Confirm redemption" }).count(), 0);
    // QR deep link path resolves to the same voucher and is also refused
    await owner.goto(qrPayload.replace(/^https?:\/\/[^/]+/, BASE));
    await owner.getByText("This voucher has already been redeemed.").first().waitFor();
    await customer.goto(voucherUrl);
    await customer.getByText("Redeemed", { exact: true }).first().waitFor();
    await customer.getByText("You saved $7").waitFor();
  });

  await step("10b. Manual code entry redeems a second voucher", async () => {
    await customer.goto(`${BASE}/deals/${deal2Id}`);
    await customer.getByRole("button", { name: "Claim Deal" }).last().click();
    await customer.waitForURL(/\/vouchers\//, { timeout: 60000 });
    sourdoughCode = (await customer.locator("p.font-mono").first().innerText()).trim();
    await owner.goto(`${BASE}/dashboard/redeem`);
    await owner.getByRole("tab", { name: /Enter Code/ }).click();
    await owner.fill("#code", sourdoughCode.toLowerCase().replace("-", ""));
    assert.equal(await owner.inputValue("#code"), sourdoughCode, "input auto-formats the code");
    await owner.getByRole("button", { name: "Look up voucher" }).click();
    await owner.getByText("Found by code").waitFor();
    await owner.getByRole("button", { name: "Confirm redemption" }).click();
    await owner.getByText("Redemption Successful").waitFor();
  });

  await step("12. Customer savings increase by exactly the redeemed amounts", async () => {
    await customer.goto(`${BASE}/savings`);
    const t = await text(customer);
    assert.ok(t.includes("$13"), "total = $7 + $6");
    assert.ok(t.includes("+$7 saved") && t.includes("+$6 saved"));
  });

  await step("13. Merchant dashboard updates", async () => {
    await owner.goto(`${BASE}/dashboard`);
    await owner.getByText("Completed Redemptions").waitFor();
    const t = await text(owner);
    const now = Number(/(\d+)\s*Completed Redemptions/.exec(t)?.[1]);
    assert.equal(now, baseline + 2);
    assert.ok(t.includes(`redeemed ${dealTitle}`) || t.includes("redeemed"));
    await owner.goto(`${BASE}/dashboard/analytics?range=7d`);
    await owner.getByText(dealTitle).first().waitFor();
  });

  await step("14. Subscription status controls publishing (new business onboarding)", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await signup(p, "Nia Owner", `owner-${stamp}@example.com`, "/for-business/start");
    await p.waitForURL(/\/for-business\/start/);
    await p.fill("#b-name", `E2E Cafe ${stamp}`);
    await p.selectOption("#b-cat", "food-drink");
    await p.getByRole("button", { name: /Continue/ }).click();
    await p.fill("#b-addr", "200 Test Ave");
    await p.fill("#b-zip", "78702");
    await p.getByRole("button", { name: /Continue/ }).click();
    await p.getByRole("button", { name: /Continue/ }).click();
    await p.getByRole("button", { name: "Create business" }).click();
    await p.waitForURL(/\/dashboard\/billing/, { timeout: 60000 });
    await p.getByText(/isn't active|Activate plan/).first().waitFor();
    // Publishing without a plan saves a draft only
    await p.goto(`${BASE}/dashboard/deals/new?type=surplus`);
    await p.fill("#d-title", "Grand opening muffins");
    await p.fill("#d-orig", "6");
    await p.fill("#d-price", "2");
    await p.fill("#d-qty", "5");
    await p.getByRole("button", { name: /Publish now/ }).click();
    await p.waitForURL(/\/dashboard\/deals\/[0-9a-f-]{36}/);
    await p.getByText("Draft", { exact: true }).first().waitFor();
    await p.getByText(/subscription is required/).first().waitFor();
    const draftUrl = p.url();
    await p.goto(`${BASE}/dashboard/billing`);
    await p.getByRole("button", { name: /Activate demo plan/ }).click();
    await p.getByText("Demo plan — no payment taken").waitFor();
    await p.goto(draftUrl);
    await p.getByRole("button", { name: "Publish", exact: true }).click();
    await p.getByText("Live", { exact: true }).first().waitFor();
    await ctx.close();
  });

  await step("Security: unauthorized access is blocked", async () => {
    await customer.goto(`${BASE}/admin`);
    assert.equal(new URL(customer.url()).pathname, "/");
    await customer.goto(`${BASE}/dashboard`);
    assert.match(customer.url(), /\/for-business\/start/);
    const staffCtx = await browser.newContext();
    const s = await staffCtx.newPage();
    await login(s, "staff@demo.frugal.center", PASSWORD, "/dashboard/billing");
    await s.goto(`${BASE}/dashboard/billing`);
    await s.waitForURL(/denied=1/, { timeout: 15000 });
    assert.equal(await s.getByText("Frugal Center for Business", { exact: true }).count(), 0, "billing content never rendered for staff");
    await staffCtx.close();
    const anonCtx = await browser.newContext();
    const res = await anonCtx.request.get(voucherUrl);
    assert.ok(!(await res.text()).includes(voucherCode), "voucher code never sent to anonymous users");
    const anon = await anonCtx.newPage();
    await anon.goto(voucherUrl);
    await anon.waitForURL(/\/login\?next=/, { timeout: 15000 });
  });

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} steps passed`);
  process.exit(failed ? 1 : 0);
}

main().catch(() => {
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} steps passed — stopped at first failure`);
  process.exit(1);
});
