/** What a visitor picks on the first-visit welcome card. Each maps to a deal category. */
export const INTERESTS = [
  { slug: "food-drink", emoji: "☕", label: "Food & coffee" },
  { slug: "beauty-wellness", emoji: "💅", label: "Hair, nails & spa" },
  { slug: "activities", emoji: "🧘", label: "Fitness & classes" },
  { slug: "services", emoji: "🐶", label: "Pets & services" },
  { slug: "shopping", emoji: "🛍️", label: "Shopping" },
] as const;

export const INTEREST_COOKIE = "fc_interests";
export const WELCOMED_COOKIE = "fc_welcomed";

/** Valid category slugs from the cookie value ("food-drink,services"). */
export function parseInterests(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const known = new Set<string>(INTERESTS.map((i) => i.slug));
  return [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => known.has(s)))];
}
