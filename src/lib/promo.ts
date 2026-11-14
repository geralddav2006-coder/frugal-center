import type { DealType } from "./deals";

/** Printable pieces a business can put up in store, plus the shareable link. */
export const PROMO_PIECES = ["counter", "tent", "decal", "sticker", "link"] as const;
export type PromoPiece = (typeof PROMO_PIECES)[number];
export type PrintPiece = Exclude<PromoPiece, "link">;
export const PRINT_PIECES: PrintPiece[] = ["counter", "tent", "decal", "sticker"];

export const PIECE_META: Record<PromoPiece, { label: string; size: string; where: string }> = {
  counter: { label: "Counter card", size: "5 × 7 in", where: "Next to the register" },
  tent: { label: "Table tent", size: "Letter paper, fold in half", where: "Café and restaurant tables" },
  decal: { label: "Window sign", size: "6 × 6 in", where: "Front door or window" },
  sticker: { label: "Sticker sheet", size: "Letter, 12 round stickers", where: "Bags, boxes and receipts" },
  link: { label: "Share link", size: "", where: "Instagram bio, website, emails" },
};

export function isPromoPiece(v: string | null | undefined): v is PromoPiece {
  return !!v && (PROMO_PIECES as readonly string[]).includes(v);
}

export function isPrintPiece(v: string | null | undefined): v is PrintPiece {
  return !!v && (PRINT_PIECES as readonly string[]).includes(v);
}

/** Sign copy. The best message names the kind of deal the business actually runs. */
export const PROMO_MESSAGES = {
  follow: { label: "Follow us", headline: "Scan to follow us on Frugal Center", sub: "Be the first to know about our deals." },
  exclusive: { label: "Exclusive deals", headline: "Deals you won't find at the counter", sub: "Scan to follow us on Frugal Center for our exclusive offers." },
  surplus: { label: "Leftovers", headline: "Our leftovers go out at a discount", sub: "Scan to follow us and catch them before they're gone." },
  appointment: { label: "Open slots", headline: "Cancellations happen. Grab the open slot.", sub: "Scan to follow us and get last-minute openings at a discount." },
  slow_hours: { label: "Quiet hours", headline: "Quiet hours, better prices", sub: "Scan to follow us and get our off-peak deals." },
} as const;
export type PromoMessage = keyof typeof PROMO_MESSAGES;

export function isPromoMessage(v: string | null | undefined): v is PromoMessage {
  return !!v && v in PROMO_MESSAGES;
}

/** Default sign message: the deal type a business posts most, or a plain "follow us". */
export function defaultMessage(topType: DealType | null): PromoMessage {
  return topType ?? "follow";
}

/** What a staff member can say at checkout. */
export function checkoutLine(message: PromoMessage) {
  switch (message) {
    case "surplus":
      return "We post our leftovers on Frugal Center at a discount. Scan this and you'll get a ping.";
    case "appointment":
      return "When someone cancels, we post the slot on Frugal Center at a discount. Scan this to hear first.";
    case "slow_hours":
      return "We run quiet-hour deals on Frugal Center. Scan this and you'll get a ping when they're on.";
    case "exclusive":
      return "We post deals on Frugal Center you can't get at the counter. Scan this to follow us.";
    default:
      return "We post deals on Frugal Center. Scan this and you'll get a ping when there's a new one.";
  }
}

/** Short-lived cookie set when someone scans a sign, so a follow that follows is credited to the sign. */
export const SIGN_COOKIE = "fc_sign";

/** The QR target for a piece: a short link that counts the scan, then opens the business page. */
export function promoUrl(appUrl: string, slug: string, piece: PromoPiece) {
  return `${appUrl}/f/${slug}?p=${piece}`;
}

// ---------------------------------------------------------------------------
// Public stats on business profiles
// ---------------------------------------------------------------------------

/** Below this many redemptions we don't show a count (it would make a business look empty). */
export const PUBLIC_STATS_MIN = 10;
/** Businesses younger than this, without enough redemptions yet, get a "New" badge. */
export const NEW_BUSINESS_DAYS = 120;

const COUNT_STEPS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

/** 137 → "100+". Rounded down to a friendly step so exact volume isn't public. */
export function roundCount(n: number) {
  let step = 0;
  for (const s of COUNT_STEPS) if (n >= s) step = s;
  return step ? `${step.toLocaleString("en-US")}+` : null;
}

/** 123456 cents → "$1,200+". Rounded down; null below $100. */
export function roundSavings(cents: number) {
  const dollars = Math.floor(cents / 100);
  if (dollars < 100) return null;
  const unit = dollars < 1000 ? 50 : dollars < 10000 ? 100 : 1000;
  return `$${(Math.floor(dollars / unit) * unit).toLocaleString("en-US")}+`;
}

export interface PublicStatsInput {
  show_public_stats: boolean;
  redeemed_count: number;
  saved_cents: number;
  created_at: Date | string;
}

export function publicStats(b: PublicStatsInput, now = Date.now()) {
  const ageDays = (now - new Date(b.created_at).getTime()) / 86400000;
  const isNew = b.redeemed_count < PUBLIC_STATS_MIN && ageDays <= NEW_BUSINESS_DAYS;
  if (!b.show_public_stats || b.redeemed_count < PUBLIC_STATS_MIN) return { redeemed: null, saved: null, isNew };
  return { redeemed: roundCount(b.redeemed_count), saved: roundSavings(b.saved_cents), isNew: false };
}
