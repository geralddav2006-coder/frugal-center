import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../support/db";

/**
 * Verifies the row-level-security policies that protect Supabase's
 * auto-generated REST API, by executing queries as the `anon` and
 * `authenticated` roles exactly as PostgREST would.
 */
let pg: PGlite;
let ids: Record<string, string>;
let dealIds: Record<string, string>;
let businessIds: Record<string, string>;

async function as<T = Record<string, unknown>>(role: "anon" | "authenticated", userId: string | null, sql: string, params: unknown[] = []) {
  return pg.transaction(async (tx) => {
    await tx.query(`select set_config('role', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [role, userId ?? ""]);
    return (await tx.query<T>(sql, params)).rows;
  });
}

beforeAll(async () => {
  const s = await freshDb();
  pg = s.pg;
  ids = s.ids;
  dealIds = s.dealIds;
  businessIds = s.businessIds;
});

describe("row level security", () => {
  it("sign scans are private to the business, and customers can't fake where a follow came from", async () => {
    const bakery = businessIds["main-street-bakery"]!;
    await pg.query(`insert into public.promo_scans (business_id, piece) values ($1, 'counter'), ($2, 'tent')`, [bakery, businessIds["sakura-bowl"]]);
    const own = await as<{ business_id: string }>("authenticated", ids.owner!, `select business_id from public.promo_scans`);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((r) => r.business_id === bakery)).toBe(true);
    expect(await as("authenticated", ids.customer!, `select * from public.promo_scans`)).toHaveLength(0);
    await expect(as("anon", null, `select * from public.promo_scans`)).rejects.toThrow();
    await expect(as("authenticated", ids.owner!, `insert into public.promo_scans (business_id, piece) values ($1, 'counter')`, [bakery])).rejects.toThrow();
    // Following directly through the API still works, but only the server can credit a sign.
    await as("authenticated", ids.customer!, `insert into public.follows (user_id, business_id) values ($1, $2) on conflict do nothing`, [ids.customer, businessIds["clay-hour-studio"]]);
    await expect(
      as("authenticated", ids.customer!, `insert into public.follows (user_id, business_id, source) values ($1, $2, 'sign')`, [ids.customer, businessIds["boulder-yard"]]),
    ).rejects.toThrow();
  });

  it("anon can browse published deals and businesses but not drafts or private tables", async () => {
    await pg.query(`update public.deals set status = 'draft' where id = $1`, [dealIds["sakura-bowl/dinner"]]);
    const deals = await as<{ id: string }>("anon", null, `select id from public.deals`);
    expect(deals.length).toBeGreaterThan(5);
    expect(deals.map((d) => d.id)).not.toContain(dealIds["sakura-bowl/dinner"]);
    expect((await as("anon", null, `select id from public.businesses`)).length).toBeGreaterThan(5);
    expect(await as("anon", null, `select * from public.claims`)).toHaveLength(0);
    expect(await as("anon", null, `select * from public.profiles`)).toHaveLength(0);
    await expect(as("anon", null, `select * from public.email_outbox`)).rejects.toThrow();
    await expect(as("anon", null, `insert into public.follows (user_id, business_id) values ($1, $2)`, [ids.customer, businessIds["sakura-bowl"]])).rejects.toThrow();
  });

  it("customers only see their own claims, redemptions and notifications", async () => {
    const mine = await as<{ user_id: string }>("authenticated", ids.customer!, `select user_id from public.claims`);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((c) => c.user_id === ids.customer)).toBe(true);
    const red = await as<{ user_id: string }>("authenticated", ids.customer!, `select user_id from public.redemptions`);
    expect(red.every((r) => r.user_id === ids.customer)).toBe(true);
    const notes = await as<{ user_id: string }>("authenticated", ids.customer!, `select user_id from public.notifications`);
    expect(notes.every((n) => n.user_id === ids.customer)).toBe(true);
    const profiles = await as<{ id: string }>("authenticated", ids.customer!, `select id from public.profiles`);
    expect(profiles.map((p) => p.id)).toEqual([ids.customer]);
  });

  it("customers cannot forge claims, redemptions or escalate their role", async () => {
    await expect(
      as("authenticated", ids.customer!, `insert into public.claims (deal_id, business_id, user_id, code, qr_token, expires_at, terms)
        values ($1, $2, $3, 'AAAA-BBBB', repeat('x', 43), now() + interval '1 day', '{}')`,
        [dealIds["main-street-bakery/pastry-box"], businessIds["main-street-bakery"], ids.customer]),
    ).rejects.toThrow();
    const updated = await as("authenticated", ids.customer!, `update public.claims set status = 'redeemed', redeemed_at = now() where user_id = $1 returning id`, [ids.customer]);
    expect(updated).toHaveLength(0);
    await expect(as("authenticated", ids.customer!, `update public.profiles set role = 'admin' where id = $1`, [ids.customer])).rejects.toThrow();
    await expect(
      as("authenticated", ids.customer!, `insert into public.redemptions (claim_id, business_id, deal_id, user_id, method, original_amount_cents, final_amount_cents)
        select id, business_id, deal_id, user_id, 'code', 100000, 0 from public.claims where user_id = $1 limit 1`, [ids.customer]),
    ).rejects.toThrow();
    // Allowed: harmless profile fields and own follows
    await as("authenticated", ids.customer!, `update public.profiles set full_name = 'Maya C' where id = $1`, [ids.customer]);
    await as("authenticated", ids.customer!, `insert into public.follows (user_id, business_id) values ($1, $2) on conflict do nothing`, [ids.customer, businessIds["sakura-bowl"]]);
    await expect(as("authenticated", ids.customer!, `insert into public.follows (user_id, business_id) values ($1, $2)`, [ids.owner, businessIds["sakura-bowl"]])).rejects.toThrow();
  });

  it("business staff see their business's claims but not other businesses'", async () => {
    const rows = await as<{ business_id: string }>("authenticated", ids.staff!, `select business_id from public.claims`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.business_id === businessIds["main-street-bakery"])).toBe(true);
    const subs = await as<{ business_id: string }>("authenticated", ids.staff!, `select business_id from public.business_subscriptions`);
    expect(subs.map((s) => s.business_id)).toEqual([businessIds["main-street-bakery"]]);
  });
});
