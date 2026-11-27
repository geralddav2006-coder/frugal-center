import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types";
import { freshDb, createUser } from "../support/db";
import {
  getBusinessByPreviewToken, getBusinessBySlug, getDealDetail, listLiveDeals, nearbyStats,
} from "@/server/services/discovery";
import { claimDeal } from "@/server/services/claims";
import { claimPreviewBusiness, createBusiness, listMemberships, publishDeal, saveDeal } from "@/server/services/merchant";
import { getSubscription } from "@/server/services/billing";
import { setFollow } from "@/server/services/engagement";
import { DomainError } from "@/server/services/common";
import { MARKET_TZ, dateToZonedInput } from "@/lib/time";

const WAKEFIELD = { lat: 42.5065, lng: -71.0723 };
const local = (h: number) => dateToZonedInput(new Date(Date.now() + h * 3600000), MARKET_TZ);

let db: Db;
let builder: string;
let customer: string;
let bizId: string;
let slug: string;
let token: string;
let dealId: string;

async function expectCode(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`Expected DomainError ${code}`);
}

beforeAll(async () => {
  ({ db } = await freshDb());
  builder = await createUser(db, "builder@test.dev", "Preview Builder");
  customer = await createUser(db, "shopper@test.dev", "Shopper");
  const biz = await createBusiness(db, builder, {
    name: "Wakefield Test Bakery", category_slug: "food-drink", address_line: "1 Main St", city: "Wakefield", state: "MA", zip: "01880",
  }, { preview: true });
  bizId = biz.id;
  slug = biz.slug;
  const [m] = (await listMemberships(db, builder)).filter((x) => x.business_id === bizId);
  token = m!.preview_token!;
  const deal = await saveDeal(db, builder, bizId, {
    type: "surplus", title: "Preview pastry box", images: [], original_price: 14, deal_price: 6, quantity_total: 8,
    starts_at: local(-1), ends_at: local(5),
  });
  dealId = deal.id;
  await publishDeal(db, builder, dealId);
});

describe("private previews", () => {
  it("places Wakefield on the map", async () => {
    const [area] = await db.query<{ city: string }>(`select city from public.launch_areas where zip = '01880'`);
    expect(area?.city).toBe("Wakefield");
  });

  it("are hidden from everyone without the link", async () => {
    expect(token).toMatch(/^[A-Za-z0-9]{16,40}$/);
    expect(await getBusinessBySlug(db, slug, WAKEFIELD, customer)).toBeNull();
    const nearby = await listLiveDeals(db, WAKEFIELD, { radiusMiles: 25 }, customer);
    expect(nearby.some((d) => d.business_id === bizId)).toBe(false);
    expect((await nearbyStats(db, WAKEFIELD, 3)).count).toBe(0);
    expect(await getDealDetail(db, dealId, WAKEFIELD, customer)).toBeNull();
    expect(await getDealDetail(db, dealId, WAKEFIELD, customer, "wrongTokenwrongToken")).toBeNull();
    await expectCode(setFollow(db, customer, bizId, true), "not_found");
  });

  it("show the page and deal with the link, but never let anyone claim", async () => {
    const page = await getBusinessByPreviewToken(db, token, WAKEFIELD, customer);
    expect(page?.business.name).toBe("Wakefield Test Bakery");
    expect(page?.deals.map((d) => d.id)).toEqual([dealId]);
    const deal = await getDealDetail(db, dealId, WAKEFIELD, customer, token);
    expect(deal?.is_preview).toBe(true);
    expect(deal?.is_live).toBe(false);
    expect(deal).not.toHaveProperty("preview_match");
    await expectCode(claimDeal(db, customer, dealId, null), "not_found");
  });

  it("let one account build several previews alongside its own business", async () => {
    const second = await createBusiness(db, builder, {
      name: "Wakefield Test Barber", category_slug: "beauty-wellness", address_line: "2 Main St", city: "Wakefield", state: "MA", zip: "01880",
    }, { preview: true });
    expect(second.id).toBeTruthy();
    await createBusiness(db, builder, {
      name: "Builder's Own Shop", category_slug: "shopping", address_line: "3 Main St", city: "Wakefield", state: "MA", zip: "01880",
    });
    await expectCode(createBusiness(db, builder, {
      name: "Another Shop", category_slug: "shopping", address_line: "4 Main St", city: "Wakefield", state: "MA", zip: "01880",
    }), "already_owner");
  });

  it("hand the page to the real owner, who reviews the paused deal before going live", async () => {
    await expectCode(claimPreviewBusiness(db, builder, token), "own_preview");
    const owner = await createUser(db, "realowner@test.dev", "Real Owner");
    await claimPreviewBusiness(db, owner, token);

    const members = await db.query<{ user_id: string; role: string }>(
      `select user_id, role from public.business_members where business_id = $1`, [bizId]);
    expect(members).toEqual([{ user_id: owner, role: "owner" }]);
    expect((await getSubscription(db, bizId))?.provider).toBe("founding");

    const pub = await getBusinessBySlug(db, slug, WAKEFIELD, customer);
    expect(pub?.business.name).toBe("Wakefield Test Bakery");
    const [d] = await db.query<{ status: string }>(`select status from public.deals where id = $1`, [dealId]);
    expect(d?.status).toBe("paused");
    expect(await getBusinessByPreviewToken(db, token, WAKEFIELD, customer)).toBeNull();
    await expectCode(claimPreviewBusiness(db, customer, token), "not_found");
  });
});
