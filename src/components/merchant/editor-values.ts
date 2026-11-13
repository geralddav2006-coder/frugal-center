import type { MerchantDeal } from "@/server/services/merchant";
import type { DealType } from "@/lib/deals";
import { dateToZonedInput } from "@/lib/time";
import type { EditorValue } from "./deal-editor";

const dollars = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(/\.00$/, ""));

function flooredNow() {
  const d = new Date();
  d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

function roundedNow(addHours = 0) {
  const d = new Date(Date.now() + addHours * 3600000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

export function newEditorValue(type: DealType | null, tz: string): EditorValue {
  const isSlow = type === "slow_hours";
  return {
    type,
    title: "", description: "", images: [], redemption_instructions: "", restrictions: "", per_customer_limit: 1, is_exclusive: false,
    original_price: "", deal_price: "", quantity_total: type === "surplus" ? "10" : "",
    starts_at: dateToZonedInput(flooredNow(), tz),
    ends_at: dateToZonedInput(roundedNow(isSlow ? 24 * 14 : 4), tz),
    duration_minutes: "60",
    slots: [{ starts_at: dateToZonedInput(roundedNow(2), tz), capacity: "1" }],
    discount_kind: "percent", percent_off: "20", amount_off: "", recurring_days: [1, 2, 3, 4], window_start: "14:00", window_end: "17:00",
  };
}

export function editorValueFromDeal(d: MerchantDeal & { slots: { id: string; starts_at: Date; capacity: number; claimed_count: number }[] }, tz: string): EditorValue {
  return {
    type: d.type as DealType,
    title: d.title, description: d.description ?? "", images: d.images,
    redemption_instructions: d.redemption_instructions ?? "", restrictions: d.restrictions ?? "", per_customer_limit: d.per_customer_limit, is_exclusive: d.is_exclusive,
    original_price: dollars(d.original_price_cents), deal_price: dollars(d.deal_price_cents),
    quantity_total: d.quantity_total == null ? "" : String(d.quantity_total),
    starts_at: dateToZonedInput(d.starts_at, tz), ends_at: dateToZonedInput(d.ends_at, tz),
    duration_minutes: String(d.duration_minutes ?? 60),
    slots: d.slots.length
      ? d.slots.map((s) => ({ id: s.id, starts_at: dateToZonedInput(s.starts_at, tz), capacity: String(s.capacity), claimed: s.claimed_count }))
      : [{ starts_at: dateToZonedInput(roundedNow(2), tz), capacity: "1" }],
    discount_kind: (d.discount_kind as EditorValue["discount_kind"]) ?? "percent",
    percent_off: d.percent_off ? String(d.percent_off) : "", amount_off: dollars(d.amount_off_cents),
    recurring_days: d.recurring_days ?? [1, 2, 3, 4], window_start: d.window_start ?? "14:00", window_end: d.window_end ?? "17:00",
  };
}
