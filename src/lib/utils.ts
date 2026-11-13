import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(cents: number, opts: { exact?: boolean } = {}) {
  const dollars = cents / 100;
  const whole = Number.isInteger(dollars);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole && !opts.exact ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

export function formatDistance(miles: number | null | undefined) {
  if (miles == null || Number.isNaN(miles)) return null;
  if (miles < 0.1) return "Nearby";
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** "Maya Chen" -> "Maya C." — enough for staff to greet someone, no more. */
export function privateName(name?: string | null) {
  if (!name) return "Frugal Center member";
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first!;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
