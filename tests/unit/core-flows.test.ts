import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types";
import { freshDb, createUser } from "../support/db";
import { listLiveDeals, getHomeSections, getDealDetail } from "@/server/services/discovery";
import { claimDeal, cancelClaim, getVoucher } from "@/server/services/claims";
import { lookupVoucher, confirmRedemption } from "@/server/services/redemption";
import { getSavingsSummary } from "@/server/services/savings";
import { dispatchNewDeal, dispatchDueDeals } from "@/server/services/notify";
import { saveDeal, publishDeal, pauseDeal, createBusiness, duplicateDeal, endDeal } from "@/server/services/merchant";
import { activateDemoSubscription, cancelDemoSubscription } from "@/server/services/billing";
import { setFollow, setFollowNotify, updatePreferences } from "@/server/services/engagement";
import { DomainError, normalizeManualCode, extractQrToken } from "@/server/services/common";
import { dateToZonedInput, zonedDayAndMinutes } from "@/lib/time";

const AUSTIN = { lat: 30.2672, lng: -97.7431 };
const TZ = "America/Chicago";
const local = (hoursFromNow: number) => dateToZonedInput(new Date(Date.now() + hoursFromNow * 3600000), TZ);

let db: Db;
let ids: Record<string, string>;
let businessIds: Record<string, string>;
let dealIds: Record<string, string>;
let bakery: string;

async function expectError(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(code);
    return err as DomainError;
  }
  throw new Error(`Expected DomainError ${code}`);
}

async function newSurplus(title = "Test croissants", qty = 3) {
  const { id } = await saveDeal(db, ids.owner!, bakery, {
    type: "surplus", title, description: "Fresh", images: [], original_price: "10", deal_price: "4",
    quantity_total: qty, starts_at: local(-1), ends_at: local(5), per_customer_limit: 1,
  });
  await publishDeal(db, ids.owner!, id);
  return id;
}

beforeAll(async () => {
  const s = await freshDb();
  db = s.db;
  ids = s.ids;
  businessIds = s.businessIds;
  dealIds = s.dealIds;
  bakery = businessIds["main-street-bakery"]!;
});

describe("discovery", () => {
  it("lists live deals near the viewer and supports filters", async () => {
    const all = await listLiveDeals(db, AUSTIN, { radiusMiles: 25 }, null);
    expect(all.length).toBeGreaterThan(10);
    expect(all.every((d) => d.status === "published")).toBe(true);
    const sorted = all.map((d) => d.distance_miles!);
    expect([...sorted].sort((a, b) => a - b)).toEqual(sorted);

    const food = await listLiveDeals(db, AUSTIN, { category: "food-drink" }, null);
    expect(food.every((d) => d.category_slug === "food-drink")).toBe(true);

    const search = await listLiveDeals(db, AUSTIN, { q: "pastry" }, null);
    expect(search.map((d) => d.title)).toContain("Surprise Pastry Box");

    const cheap = await listLiveDeals(db, AUSTIN, { maxPriceCents: 1000 }, null);
    expect(cheap.every((d) => d.deal_price_cents! <= 1000)).toBe(true);

    const appts = await listLiveDeals(db, AUSTIN, { type: "appointment", lastMinute: true }, null);
    expect(appts.length).toBeGreaterThan(0);
    expect(appts.every((d) => d.next_slot_at)).toBe(true);

    const sections = await getHomeSections(db, { ...AUSTIN, radiusMiles: 10 }, ids.customer!);
    expect(sections.following.length).toBeGreaterThan(0);
    expect(sections.nearYou.length).toBeGreaterThan(0);
  });

  it("lets businesses post a Frugal Center exclusive promo that gets its own section", async () => {
    const seeded = await listLiveDeals(db, AUSTIN, { exclusive: true, radiusMiles: 25 }, null);
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.every((d) => d.type === "exclusive")).toBe(true);

    // A plain promotional discount: no leftovers, slots or time window, valid any time between the dates.
    const { id } = await saveDeal(db, ids.owner!, bakery, {
      type: "exclusive", title: "10% off for Frugal Center members", images: [], discount_kind: "percent", percent_off: 10,
      starts_at: local(-1), ends_at: local(24 * 10), per_customer_limit: 1,
    });
    await publishDeal(db, ids.owner!, id);
    const exclusives = await listLiveDeals(db, AUSTIN, { exclusive: true, radiusMiles: 25 }, null);
    expect(exclusives.map((d) => d.id)).toContain(id);
    const sections = await getHomeSections(db, { ...AUSTIN, radiusMiles: 25 }, null);
    expect(sections.exclusives.map((d) => d.id)).toContain(id);
    expect(sections.exclusives.every((d) => d.type === "exclusive")).toBe(true);
    expect((await listLiveDeals(db, AUSTIN, { type: "surplus", radiusMiles: 25 }, null)).map((d) => d.id)).not.toContain(id);

    // Claim and redeem it like any other voucher; the merchant confirms the bill for a percentage discount.
    const user = await createUser(db, "exclusive@test.dev");
    const claim = await claimDeal(db, user, id, null);
    await expectError(confirmRedemption(db, { staffId: ids.staff!, businessId: bakery, claimId: claim.claimId, method: "code" }), "amounts_required");
    const r = await confirmRedemption(db, { staffId: ids.staff!, businessId: bakery, claimId: claim.claimId, method: "code", originalCents: 3000, finalCents: 2700 });
    expect(r.savingsCents).toBe(300);

    // Special-price exclusives validate like other fixed-price deals, and duplicates keep the type.
    await expectError(
      saveDeal(db, ids.owner!, bakery, {
        type: "exclusive", title: "Bad price", images: [], discount_kind: "fixed_price", original_price: "10", deal_price: "12",
        starts_at: local(-1), ends_at: local(48),
      }),
      "invalid",
    );
    const copy = await duplicateDeal(db, ids.owner!, id);
    const [dup] = await db.query<{ type: string }>(`select type from public.deals where id = $1`, [copy.id]);
    expect(dup!.type).toBe("exclusive");
  });

  it("hides drafts from the public but shows them to the business", async () => {
    const { id } = await saveDeal(db, ids.owner!, bakery, {
      type: "surplus", title: "Secret draft", images: [], original_price: 10, deal_price: 5, quantity_total: 2,
      starts_at: local(-1), ends_at: local(3),
    });
    expect(await getDealDetail(db, id, AUSTIN, null)).toBeNull();
    expect(await getDealDetail(db, id, AUSTIN, ids.customer!)).toBeNull();
    expect(await getDealDetail(db, id, AUSTIN, ids.owner!)).not.toBeNull();
    const live = await listLiveDeals(db, AUSTIN, { q: "Secret draft" }, null);
    expect(live).toHaveLength(0);
  });
});

describe("claiming", () => {
  it("issues a voucher with a QR token and a manual code", async () => {
    const user = await createUser(db, "claimer1@test.dev");
    const dealId = await newSurplus("Claimable buns", 2);
    const { claimId } = await claimDeal(db, user, dealId, null);
    const v = await getVoucher(db, user, claimId);
    expect(v!.code).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    expect(v!.qr_token.length).toBeGreaterThanOrEqual(40);
    expect(v!.state).toBe("active");
    expect(v!.terms.deal_price_cents).toBe(400);
    // nobody else can open it
    expect(await getVoucher(db, ids.customer!, claimId)).toBeNull();
    // a second claim of the same deal is refused and points at the existing voucher
    const err = await expectError(claimDeal(db, user, dealId, null), "already_claimed");
    expect(err.meta.claimId).toBe(claimId);
  });

  it("enforces capacity, ownership, pause and expiry", async () => {
    const dealId = await newSurplus("Only one left", 1);
    const a = await createUser(db, "cap-a@test.dev");
    const b = await createUser(db, "cap-b@test.dev");
    await claimDeal(db, a, dealId, null);
    await expectError(claimDeal(db, b, dealId, null), "sold_out");
    await expectError(claimDeal(db, ids.staff!, await newSurplus("Staff test"), null), "own_business");

    const paused = await newSurplus("Paused one");
    await pauseDeal(db, ids.owner!, paused);
    await expectError(claimDeal(db, b, paused, null), "paused");

    const expired = await newSurplus("Expired one");
    await db.query(`update public.deals set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 minute' where id = $1`, [expired]);
    await expectError(claimDeal(db, b, expired, null), "expired");
  });

  it("does not oversell under concurrent claims", async () => {
    const dealId = await newSurplus("Race buns", 2);
    const users = await Promise.all([1, 2, 3, 4, 5].map((i) => createUser(db, `race${i}@test.dev`)));
    const results = await Promise.allSettled(users.map((u) => claimDeal(db, u, dealId, null)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    const [d] = await db.query(`select claimed_count from public.deals where id = $1`, [dealId]);
    expect(d!.claimed_count).toBe(2);
  });

  it("books appointment slots and releases capacity on cancel", async () => {
    const dealId = dealIds["fade-and-co/cut"]!;
    const [slot] = await db.query(`select id, capacity from public.appointment_slots where deal_id = $1 and capacity = 1 order by starts_at limit 1`, [dealId]);
    const a = await createUser(db, "appt-a@test.dev");
    const b = await createUser(db, "appt-b@test.dev");
    await expectError(claimDeal(db, a, dealId, null), "slot_required");
    const { claimId } = await claimDeal(db, a, dealId, slot!.id);
    await expectError(claimDeal(db, b, dealId, slot!.id), "slot_full");
    await cancelClaim(db, a, claimId);
    const v = await getVoucher(db, a, claimId);
    expect(v!.state).toBe("canceled");
    await claimDeal(db, b, dealId, slot!.id); // capacity was released
  });
});

describe("redemption", () => {
  it("QR scan and manual code resolve to the same voucher and redeem exactly once", async () => {
    const user = await createUser(db, "redeemer@test.dev", "Riley Redeemer");
    const dealId = await newSurplus("Redeem me");
    const { claimId } = await claimDeal(db, user, dealId, null);
    const v = (await getVoucher(db, user, claimId))!;

    const byQr = await lookupVoucher(db, { staffId: ids.staff!, businessId: bakery, method: "qr", input: `http://localhost:3000/dashboard/redeem?t=${v.qr_token}` });
    const byCode = await lookupVoucher(db, { staffId: ids.staff!, businessId: bakery, method: "code", input: v.code.toLowerCase().replace("-", " ") });
    expect(byQr.claimId).toBe(claimId);
    expect(byCode.claimId).toBe(claimId);
    expect(byCode.canRedeem).toBe(true);
    expect(byCode.customerName).toBe("Riley R.");

    // Concurrent confirmations: exactly one succeeds.
    const results = await Promise.allSettled([
      confirmRedemption(db, { staffId: ids.staff!, businessId: bakery, claimId, method: "qr" }),
      confirmRedemption(db, { staffId: ids.owner!, businessId: bakery, claimId, method: "code" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const ok = results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ savingsCents: number }>;
    expect(ok.value.savingsCents).toBe(600);

    await expectError(confirmRedemption(db, { staffId: ids.staff!, businessId: bakery, claimId, method: "code" }), "already_redeemed");
    const again = await lookupVoucher(db, { staffId: ids.staff!, businessId: bakery, method: "code", input: v.code });
    expect(again.status).toBe("redeemed");
    expect(again.canRedeem).toBe(false);
    expect((await getVoucher(db, user, claimId))!.state).toBe("redeemed");
  });

  it("rejects invalid, wrong-business, expired and canceled vouchers, and unauthorized staff", async () => {
    const user = await createUser(db, "edge@test.dev");
    const dealId = await newSurplus("Edge cases");
    const { claimId } = await claimDeal(db, user, dealId, null);
    const v = (await getVoucher(db, user, claimId))!;

    await expectError(lookupVoucher(db, { staffId: ids.staff!, businessId: bakery, method: "code", input: "AAAA-1111" }), "invalid_format");
    await expectError(lookupVoucher(db, { staffId: ids.staff!, businessId: bakery, method: "code", input: "ZZZZ-ZZZZ" }), "invalid");
    await expectError(lookupVoucher(db, { staffId: ids.staff!, businessId: bakery, method: "qr", input: "https://evil.example/?t=short" }), "invalid");

    // Another business's staff (the partners account owns other businesses)
    await expectError(
      lookupVoucher(db, { staffId: ids.partners!, businessId: businessIds["sakura-bowl"]!, method: "code", input: v.code }),
      "wrong_business",
    );
    // A customer is not staff anywhere
    await expectError(lookupVoucher(db, { staffId: user, businessId: bakery, method: "code", input: v.code }), "forbidden");
    await expectError(confirmRedemption(db, { staffId: ids.partners!, businessId: bakery, claimId, method: "code" }), "forbidden");
    await expectError(
      confirmRedemption(db, { staffId: ids.partners!, businessId: businessIds["sakura-bowl"]!, claimId, method: "code" }),
      "wrong_business",
    );

    await db.query(`update public.claims set expires_at = now() - interval '1 minute' where id = $1`, [claimId]);
    const expired = await lookupVoucher(db, { staffId: ids.staff!, businessId: bakery, method: "code", input: v.code });
    expect(expired.status).toBe("expired");
    await expectError(confirmRedemption(db, { staffId: ids.staff!, businessId: bakery, claimId, method: "code" }), "expired");

    const d2 = await newSurplus("Cancel me");
    const c2 = await claimDeal(db, user, d2, null);
    await cancelClaim(db, user, c2.claimId);
    await expectError(confirmRedemption(db, { staffId: ids.staff!, businessId: bakery, claimId: c2.claimId, method: "code" }), "canceled");
  });

  it("rate-limits repeated invalid code attempts", async () => {
    const staff = await createUser(db, "ratelimit-staff@test.dev");
    await db.query(`insert into public.business_members (business_id, user_id, role) values ($1, $2, 'staff')`, [bakery, staff]);
    for (let i = 0; i < 10; i++) {
      await expectError(lookupVoucher(db, { staffId: staff, businessId: bakery, method: "code", input: "ZZZZ-ZZZZ" }), "invalid");
    }
    await expectError(lookupVoucher(db, { staffId: staff, businessId: bakery, method: "code", input: "ZZZZ-ZZZZ" }), "rate_limited");
  });

  it("requires merchant-confirmed amounts for percentage deals and enforces the time window", async () => {
    const { dow } = zonedDayAndMinutes(new Date(), TZ);
    await activateDemoSubscription(db, bakery, ids.owner!);
    const mk = async (days: number[]) => {
      const { id } = await saveDeal(db, ids.owner!, bakery, {
        type: "slow_hours", title: `Pct ${days.join()}`, images: [], discount_kind: "percent", percent_off: 25,
        recurring_days: days, window_start: "00:00", window_end: "23:59", starts_at: local(-1), ends_at: local(48),
      });
      await publishDeal(db, ids.owner!, id);
      return id;
    };
    const user = await createUser(db, "pct@test.dev");
    const open = await claimDeal(db, user, await mk([dow]), null);
    await expectError(confirmRedemption(db, { staffId: ids.staff!, businessId: bakery, claimId: open.claimId, method: "code" }), "amounts_required");
    await expectError(
      confirmRedemption(db, { staffId: ids.staff!, businessId: bakery, claimId: open.claimId, method: "code", originalCents: 4000, finalCents: 5000 }),
      "amounts_invalid",
    );
    const r = await confirmRedemption(db, { staffId: ids.staff!, businessId: bakery, claimId: open.claimId, method: "code", originalCents: 4000, finalCents: 3000 });
    expect(r.savingsCents).toBe(1000);

    const closed = await claimDeal(db, user, await mk([(dow + 2) % 7]), null);
    const look = await lookupVoucher(db, { staffId: ids.staff!, businessId: bakery, method: "code", input: (await getVoucher(db, user, closed.claimId))!.code });
    expect(look.canRedeem).toBe(false);
    await expectError(
      confirmRedemption(db, { staffId: ids.staff!, businessId: bakery, claimId: closed.claimId, method: "code", originalCents: 1000 }),
      "outside_window",
    );
  });
});

describe("savings", () => {
  it("counts only redeemed vouchers and is immune to later deal edits", async () => {
    const user = await createUser(db, "saver@test.dev");
    const dealId = await newSurplus("Savings test", 5);
    const before = await getSavingsSummary(db, user);
    expect(before.totalCents).toBe(0);

    const { claimId } = await claimDeal(db, user, dealId, null);
    expect((await getSavingsSummary(db, user)).totalCents).toBe(0); // claimed is not saved

    await confirmRedemption(db, { staffId: ids.staff!, businessId: bakery, claimId, method: "code" });
    const after = await getSavingsSummary(db, user);
    expect(after.totalCents).toBe(600);
    expect(after.count).toBe(1);
    expect(after.monthCents).toBe(600);
    expect(after.items[0]!.title).toBe("Savings test");

    // Merchant tries to change price after claims: locked. History stays the same regardless.
    await expectError(
      saveDeal(db, ids.owner!, bakery, {
        type: "surplus", title: "Savings test", images: [], original_price: 50, deal_price: 1, quantity_total: 5,
        starts_at: local(-1), ends_at: local(5),
      }, dealId),
      "locked_terms",
    );
    await db.query(`update public.deals set original_price_cents = 9900, deal_price_cents = 100 where id = $1`, [dealId]);
    expect((await getSavingsSummary(db, user)).totalCents).toBe(600);
  });

  it("seeded demo customer has a realistic history", async () => {
    const s = await getSavingsSummary(db, ids.customer!);
    expect(s.count).toBe(8);
    expect(s.totalCents).toBe(1100 + 2000 + 1620 + 250 + 4500 + 2000 + 1400 + 1200);
    expect(s.monthly).toHaveLength(6);
  });
});

describe("following & notifications", () => {
  it("notifies opted-in followers once when a deal goes live, never for drafts or scheduled deals", async () => {
    await dispatchDueDeals(db); // flush deals published by earlier tests
    const fan = await createUser(db, "fan@test.dev");
    const muted = await createUser(db, "muted@test.dev");
    const noInApp = await createUser(db, "noinapp@test.dev");
    for (const u of [fan, muted, noInApp]) await setFollow(db, u, bakery, true);
    await setFollowNotify(db, muted, bakery, false);
    await updatePreferences(db, noInApp, { in_app_new_deals: false, email_new_deals: false, push_new_deals: false, max_emails_per_day: 3 });

    const count = async (u: string, dealId: string) =>
      (await db.query(`select count(*)::int as n from public.notifications where user_id = $1 and deal_id = $2`, [u, dealId]))[0]!.n;

    // Draft: no notification
    const { id: draft } = await saveDeal(db, ids.owner!, bakery, {
      type: "surplus", title: "Draft only", images: [], original_price: 8, deal_price: 3, quantity_total: 3, starts_at: local(-1), ends_at: local(4),
    });
    expect(await dispatchNewDeal(db, draft)).toBeNull();
    expect(await count(fan, draft)).toBe(0);

    // Scheduled for later: published but not live yet
    const { id: later } = await saveDeal(db, ids.owner!, bakery, {
      type: "surplus", title: "Tomorrow's buns", images: [], original_price: 8, deal_price: 3, quantity_total: 3, starts_at: local(2), ends_at: local(6),
    });
    const pub = await publishDeal(db, ids.owner!, later);
    expect(pub.live).toBe(false);
    await dispatchDueDeals(db);
    expect(await count(fan, later)).toBe(0);

    // Live deal
    const live = await newSurplus("Fresh announcement");
    const result = await dispatchNewDeal(db, live);
    expect(result!.inApp).toBeGreaterThanOrEqual(1);
    expect(await count(fan, live)).toBe(1);
    expect(await count(muted, live)).toBe(0);
    expect(await count(noInApp, live)).toBe(0);
    // Emails are recorded honestly as not sent when Resend isn't configured
    const [mail] = await db.query(`select status from public.email_outbox where user_id = $1 and deal_id = $2`, [fan, live]);
    expect(mail!.status).toBe("not_configured");

    // Idempotent
    expect(await dispatchNewDeal(db, live)).toBeNull();
    await dispatchDueDeals(db);
    expect(await count(fan, live)).toBe(1);

    // Once the scheduled deal's start arrives, the cron sweep announces it
    await db.query(`update public.deals set starts_at = now() - interval '1 minute' where id = $1`, [later]);
    await dispatchDueDeals(db);
    expect(await count(fan, later)).toBe(1);
  });

  it("caps deal emails per business per day", async () => {
    await dispatchDueDeals(db);
    const fan = await createUser(db, "emailcap@test.dev");
    await setFollow(db, fan, bakery, true);
    await updatePreferences(db, fan, { in_app_new_deals: true, email_new_deals: true, push_new_deals: false, max_emails_per_day: 10 });
    for (let i = 0; i < 4; i++) await dispatchNewDeal(db, await newSurplus(`Burst ${i}`));
    const [r] = await db.query(`select count(*)::int as n from public.email_outbox where user_id = $1`, [fan]);
    expect(r!.n).toBe(2);
    const [n] = await db.query(`select count(*)::int as n from public.notifications where user_id = $1 and title like 'Main Street%'`, [fan]);
    expect(n!.n).toBe(4);
  });
});

describe("subscriptions gate publishing", () => {
  it("allows drafts without a subscription but blocks publishing", async () => {
    const owner = await createUser(db, "newowner@test.dev", "New Owner");
    const biz = await createBusiness(db, owner, {
      name: "Brand New Cafe", category_slug: "food-drink", address_line: "100 Test St", city: "Austin", state: "TX", zip: "78702",
    });
    const { id } = await saveDeal(db, owner, biz.id, {
      type: "surplus", title: "Grand opening muffins", images: [], original_price: 6, deal_price: 2, quantity_total: 10, starts_at: local(-1), ends_at: local(5),
    });
    await expectError(publishDeal(db, owner, id), "subscription_inactive");
    await activateDemoSubscription(db, biz.id, owner);
    expect((await publishDeal(db, owner, id)).live).toBe(true);
    await cancelDemoSubscription(db, biz.id, owner);
    const dup = await duplicateDeal(db, owner, id);
    await expectError(publishDeal(db, owner, dup.id), "subscription_inactive");
    // Ending is always allowed; a non-member can't touch the deal
    await expectError(endDeal(db, ids.customer!, id), "forbidden");
    await endDeal(db, owner, id);
  });
});

describe("codes", () => {
  it("normalizes manual codes and extracts QR tokens", () => {
    expect(normalizeManualCode(" k7qm x2pa ")).toBe("K7QM-X2PA");
    expect(normalizeManualCode("K7QM-X2P")).toBeNull();
    expect(normalizeManualCode("O0I1-LLLL")).toBeNull();
    const t = "a".repeat(43);
    expect(extractQrToken(`https://frugal.center/dashboard/redeem?t=${t}`)).toBe(t);
    expect(extractQrToken(t)).toBe(t);
    expect(extractQrToken("javascript:alert(1)")).toBeNull();
  });
});
