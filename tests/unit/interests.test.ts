import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/types";
import { freshDb } from "../support/db";
import { getHomeSections, listLiveDeals } from "@/server/services/discovery";
import { parseInterests } from "@/lib/interests";

const DRACUT = { lat: 42.6708, lng: -71.3028 };
let db: Db;

beforeAll(async () => {
  ({ db } = await freshDb());
});

describe("visitor interests", () => {
  it("keeps only known categories from the cookie", () => {
    expect(parseInterests("food-drink, services,bogus,food-drink")).toEqual(["food-drink", "services"]);
    expect(parseInterests(undefined)).toEqual([]);
  });

  it("puts picked categories first without hiding anything else", async () => {
    const plain = await listLiveDeals(db, DRACUT, { radiusMiles: 25, sort: "nearest" }, null);
    const picked = await listLiveDeals(db, DRACUT, { radiusMiles: 25, sort: "nearest", preferCategories: ["beauty-wellness"] }, null);
    expect(picked.length).toBe(plain.length);
    const firstOther = picked.findIndex((d) => d.category_slug !== "beauty-wellness");
    expect(firstOther).toBeGreaterThan(0);
    expect(picked.slice(firstOther).every((d) => d.category_slug !== "beauty-wellness")).toBe(true);
    const sections = await getHomeSections(db, { ...DRACUT, radiusMiles: 25 }, null, undefined, ["beauty-wellness"]);
    expect(sections.nearYou[0]?.category_slug).toBe("beauty-wellness");
  });
});
