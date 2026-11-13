import type { DealCard } from "@/server/services/discovery";
import { formatDayTime, timeLeft } from "@/lib/time";
import { windowLabel } from "@/lib/deals";

/** One short line about availability, by deal type. */
export function availabilityLabel(d: Pick<DealCard, "type" | "quantity_total" | "claimed_count" | "next_slot_at" | "slots_remaining" | "timezone" | "recurring_days" | "window_start" | "window_end">) {
  if (d.type === "appointment") {
    if (!d.next_slot_at) return "Fully booked";
    const spots = d.slots_remaining ?? 0;
    return `${formatDayTime(d.next_slot_at, d.timezone)}${spots > 1 ? ` · ${spots} spots` : ""}`;
  }
  if (d.type === "slow_hours") return windowLabel(d) ?? "Off-peak hours";
  if (d.quantity_total == null) return "Limited quantities";
  const left = d.quantity_total - d.claimed_count;
  if (left <= 0) return "Sold out";
  return left <= 5 ? `Only ${left} left` : `${left} left`;
}

export function urgencyLabel(d: Pick<DealCard, "type" | "ends_at" | "next_slot_at">, now = new Date()) {
  const target = d.type === "appointment" ? d.next_slot_at : d.ends_at;
  if (!target) return null;
  const ms = new Date(target).getTime() - now.getTime();
  if (ms <= 0) return null;
  if (d.type === "appointment") return null;
  return ms < 48 * 3600000 ? `Ends in ${timeLeft(target, now)}` : null;
}
