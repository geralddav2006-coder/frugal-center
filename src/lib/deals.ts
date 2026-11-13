import { formatMoney } from "./utils";
import { formatDays, formatHHMM, hhmmToMinutes, zonedDayAndMinutes } from "./time";

export type DealType = "surplus" | "appointment" | "slow_hours";
export type DiscountKind = "fixed_price" | "percent" | "amount_off";
export type DealStatus = "draft" | "published" | "paused" | "ended";

export const DEAL_TYPE_META: Record<DealType, { label: string; short: string; blurb: string }> = {
  surplus: { label: "Surplus inventory", short: "Surplus", blurb: "Limited quantities, pick up in store" },
  appointment: { label: "Last-minute appointment", short: "Appointment", blurb: "A specific open time slot" },
  slow_hours: { label: "Off-peak offer", short: "Off-peak", blurb: "Valid during quieter hours" },
};

export const CATEGORIES = [
  { slug: "food-drink", name: "Food & Drink" },
  { slug: "beauty-wellness", name: "Beauty & Wellness" },
  { slug: "shopping", name: "Shopping" },
  { slug: "activities", name: "Activities" },
  { slug: "services", name: "Services" },
] as const;

export function categoryName(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

export interface PricingFields {
  discount_kind: DiscountKind;
  original_price_cents: number | null;
  deal_price_cents: number | null;
  percent_off: number | null;
  amount_off_cents: number | null;
}

export interface PriceDisplay {
  headline: string; // "$9" or "30% off" or "$10 off"
  original: string | null; // "$20"
  badge: string; // "55% OFF"
  savingsCents: number | null; // known savings for fixed-price deals
  variable: boolean; // total depends on the purchase; merchant confirms amounts at redemption
  pct: number | null;
}

export function priceDisplay(d: PricingFields): PriceDisplay {
  if (d.discount_kind === "fixed_price" && d.original_price_cents && d.deal_price_cents != null) {
    const pct = Math.round(((d.original_price_cents - d.deal_price_cents) / d.original_price_cents) * 100);
    return {
      headline: d.deal_price_cents === 0 ? "Free" : formatMoney(d.deal_price_cents),
      original: formatMoney(d.original_price_cents),
      badge: `${pct}% OFF`,
      savingsCents: d.original_price_cents - d.deal_price_cents,
      variable: false,
      pct,
    };
  }
  if (d.discount_kind === "percent" && d.percent_off) {
    return {
      headline: `${d.percent_off}% off`,
      original: null,
      badge: `${d.percent_off}% OFF`,
      savingsCents: null,
      variable: true,
      pct: d.percent_off,
    };
  }
  const off = d.amount_off_cents ?? 0;
  return {
    headline: `${formatMoney(off)} off`,
    original: null,
    badge: `${formatMoney(off)} OFF`,
    savingsCents: null,
    variable: true,
    pct: null,
  };
}

/** Server-trusted expected final amount for a variable discount. */
export function expectedFinalCents(d: PricingFields, originalCents: number) {
  if (d.discount_kind === "percent") return Math.round((originalCents * (100 - (d.percent_off ?? 0))) / 100);
  if (d.discount_kind === "amount_off") return Math.max(0, originalCents - (d.amount_off_cents ?? 0));
  return d.deal_price_cents ?? originalCents;
}

export interface WindowFields {
  recurring_days: number[] | null;
  window_start: string | null; // "14:00"
  window_end: string | null;
}

export function windowLabel(d: WindowFields) {
  if (!d.recurring_days?.length || !d.window_start || !d.window_end) return null;
  return `${formatDays(d.recurring_days)} · ${formatHHMM(d.window_start)}–${formatHHMM(d.window_end)}`;
}

export function isWithinWindow(d: WindowFields, tz: string, now = new Date()) {
  if (!d.recurring_days?.length || !d.window_start || !d.window_end) return true;
  const { dow, minutes } = zonedDayAndMinutes(now, tz);
  return (
    d.recurring_days.includes(dow) &&
    minutes >= hhmmToMinutes(d.window_start) &&
    minutes < hhmmToMinutes(d.window_end)
  );
}
