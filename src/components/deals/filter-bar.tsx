"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SORTS = [
  { v: "nearest", label: "Nearest" },
  { v: "ending", label: "Ending soon" },
  { v: "newest", label: "Newest" },
  { v: "discount", label: "Biggest discount" },
];
const PRICES = [
  { v: "10", label: "Under $10" },
  { v: "25", label: "Under $25" },
  { v: "50", label: "Under $50" },
];
const RADII = ["1", "3", "5", "10", "25"];
const TYPES = [
  { v: "surplus", label: "Surplus" },
  { v: "appointment", label: "Appointments" },
  { v: "slow_hours", label: "Off-peak" },
];

export function FilterBar({ defaultRadius }: { defaultRadius: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v == null || p.get(k) === v) p.delete(k);
    else p.set(k, v);
    p.delete("focus");
    router.push(`/explore?${p.toString()}`, { scroll: false });
  };
  const chip = (active: boolean) =>
    cn(
      "h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition",
      active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink",
    );
  const sort = params.get("sort") ?? "nearest";
  const radius = params.get("radius") ?? String(defaultRadius);
  const active = ["maxPrice", "type", "radius", "sort"].some((k) => params.get(k));

  return (
    <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Filters">
      <span className="flex shrink-0 items-center gap-1.5 pr-1 text-sm font-semibold text-muted">
        <SlidersHorizontal className="size-4" aria-hidden /> Sort
      </span>
      <label className="sr-only" htmlFor="sort">Sort by</label>
      <select
        id="sort"
        value={sort}
        onChange={(e) => set("sort", e.target.value === "nearest" ? null : e.target.value)}
        className="h-9 shrink-0 rounded-full border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-ink"
      >
        {SORTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
      </select>
      <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden />
      {PRICES.map((p) => (
        <button key={p.v} type="button" className={chip(params.get("maxPrice") === p.v)} aria-pressed={params.get("maxPrice") === p.v} onClick={() => set("maxPrice", p.v)}>
          {p.label}
        </button>
      ))}
      <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden />
      {TYPES.map((t) => (
        <button key={t.v} type="button" className={chip(params.get("type") === t.v)} aria-pressed={params.get("type") === t.v} onClick={() => set("type", t.v)}>
          {t.label}
        </button>
      ))}
      <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden />
      <label className="sr-only" htmlFor="radius">Distance</label>
      <select
        id="radius"
        value={radius}
        onChange={(e) => set("radius", e.target.value)}
        className="h-9 shrink-0 rounded-full border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-ink"
      >
        {RADII.map((r) => <option key={r} value={r}>Within {r} mi</option>)}
      </select>
      {active ? (
        <button
          type="button"
          onClick={() => {
            const p = new URLSearchParams();
            for (const k of ["q", "category", "lastMinute", "view"]) if (params.get(k)) p.set(k, params.get(k)!);
            router.push(`/explore?${p.toString()}`, { scroll: false });
          }}
          className="flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-muted hover:text-ink"
        >
          <X className="size-4" aria-hidden /> Clear
        </button>
      ) : null}
    </div>
  );
}
