import bcrypt from "bcryptjs";
import type { Db, Queryable } from "./types";
import { generateManualCode, generateToken } from "../services/common";
import { dateToZonedInput, zonedInputToDate } from "@/lib/time";

/** A local business time `d` days from today; rolls forward a day if it has already passed. */
function localSlot(d: number, t: string) {
  const today = dateToZonedInput(new Date(), "America/Chicago").slice(0, 10);
  const base = new Date(`${today}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + d);
  let at = zonedInputToDate(`${base.toISOString().slice(0, 10)}T${t}`, "America/Chicago");
  if (at.getTime() < Date.now() + 30 * 60000) at = new Date(at.getTime() + 86400000);
  return at;
}

/**
 * Sample data for local development / demos. Everything here is fictional.
 * Run automatically on first start of the local PGlite database, or against
 * Supabase with `npm run db:seed`.
 */

export const DEMO_PASSWORD = "frugal-demo";
export const DEMO_ACCOUNTS = {
  customer: { email: "maya@demo.frugal.center", name: "Maya Chen" },
  owner: { email: "owner@demo.frugal.center", name: "Jordan Reyes" },
  staff: { email: "staff@demo.frugal.center", name: "Sam Patel" },
  admin: { email: "admin@demo.frugal.center", name: "Alex Admin" },
};

const img = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

type SeedDeal = {
  key: string;
  type: "surplus" | "appointment" | "slow_hours" | "exclusive";
  title: string;
  description: string;
  images: string[];
  kind?: "fixed_price" | "percent" | "amount_off";
  orig?: number;
  price?: number;
  pct?: number;
  off?: number;
  qty?: number;
  claimed?: number;
  startsH?: number; // hours from now
  endsH?: number;
  publishedH?: number; // hours ago
  slotsH?: { d: number; t: string; cap: number; taken?: number }[]; // day offset + local time
  duration?: number;
  days?: number[];
  window?: [string, string];
  instructions?: string;
  restrictions?: string;
  status?: "draft" | "published" | "paused" | "ended";
};

type SeedBusiness = {
  slug: string;
  name: string;
  category: string;
  zip: string;
  address: string;
  dLat: number;
  dLng: number;
  description: string;
  cover: string;
  phone: string;
  website?: string;
  hours: Record<string, [string, string] | null>;
  deals: SeedDeal[];
};

const H = (o: string, c: string): [string, string] => [o, c];
const weekdays = (o: string, c: string, sat: [string, string] | null = H(o, c), sun: [string, string] | null = null) => ({
  mon: H(o, c), tue: H(o, c), wed: H(o, c), thu: H(o, c), fri: H(o, c), sat, sun,
});

const BUSINESSES: SeedBusiness[] = [
  {
    slug: "main-street-bakery", name: "Main Street Bakery", category: "food-drink", zip: "78701", address: "412 Congress Ave",
    dLat: 0.0012, dLng: -0.0008, phone: "(512) 555-0142", website: "https://example.com/main-street-bakery",
    description: "Neighborhood bakery baking croissants, sourdough and seasonal pastries from 5am every day. What we don't sell, we'd rather you enjoy than see go to waste.",
    cover: img("1509440159596-0249088772ff"), hours: weekdays("06:30", "18:00", H("07:00", "16:00"), H("07:00", "14:00")),
    deals: [
      { key: "pastry-box", type: "surplus", title: "Surprise Pastry Box", description: "A box of 5–7 of today's pastries — usually croissants, morning buns, scones and a cookie or two. Contents vary by what's left on the shelf.", images: [img("1555507036-ab1f4038808a"), img("1509440159596-0249088772ff")], orig: 2000, price: 900, qty: 12, claimed: 4, startsH: -3, endsH: 7, publishedH: 3, instructions: "Show your voucher at the counter. Pick up between 4 and 6 PM.", restrictions: "Contents vary. May contain nuts, dairy and gluten." },
      { key: "sourdough", type: "surplus", title: "Day-old sourdough loaves", description: "Yesterday's naturally leavened country loaves — perfect for toast, French toast or croutons.", images: [img("1585478259715-876acc5be8eb")], orig: 900, price: 400, qty: 8, claimed: 2, startsH: -20, endsH: 30, publishedH: 20, instructions: "Ask for the day-old basket at the register." },
    ],
  },
  {
    slug: "bluebonnet-coffee", name: "Bluebonnet Coffee Co.", category: "food-drink", zip: "78702", address: "1801 E 6th St",
    dLat: -0.0021, dLng: 0.0034, phone: "(512) 555-0177",
    description: "Small-batch roaster and café on East 6th. Quiet afternoons, loud espresso machine.",
    cover: img("1501339847302-ac426a4a7cbb"), hours: weekdays("07:00", "19:00", H("08:00", "19:00"), H("08:00", "17:00")),
    deals: [
      { key: "latte", type: "slow_hours", kind: "fixed_price", title: "Afternoon latte happy hour", description: "Any 12 oz latte or cortado for $3 during our quiet afternoon stretch. Oat and almond milk included.", images: [img("1509042239860-f550ce710b93"), img("1495474472287-4d71bcdd2085")], orig: 550, price: 300, startsH: -48, endsH: 24 * 20, publishedH: 48, days: [1, 2, 3, 4, 5], window: ["14:00", "17:00"], instructions: "Show your voucher when you order.", restrictions: "One drink per voucher. Dine-in or to-go." },
      { key: "fc-25", type: "exclusive", kind: "percent", pct: 25, title: "25% off your whole order", description: "Our thank-you to Frugal Center neighbors: 25% off any drinks and pastries, any time we're open.", images: [img("1495474472287-4d71bcdd2085")], qty: 60, startsH: -30, endsH: 24 * 21, publishedH: 30, instructions: "Show your voucher when you order.", restrictions: "Excludes retail coffee beans and gift cards." },
    ],
  },
  {
    slug: "casa-verde-taqueria", name: "Casa Verde Taqueria", category: "food-drink", zip: "78704", address: "1500 S 1st St",
    dLat: 0.0018, dLng: 0.0052, phone: "(512) 555-0190",
    description: "Family-run taqueria with handmade tortillas, a shaded patio and the best salsa verde on South 1st.",
    cover: img("1565299585323-38d6b0865b47"), hours: weekdays("11:00", "22:00", H("10:00", "23:00"), H("10:00", "21:00")),
    deals: [
      { key: "bill", type: "slow_hours", kind: "percent", pct: 30, title: "30% off your bill, 2–5 PM", description: "Beat the dinner rush: 30% off your whole food bill on weekday afternoons.", images: [img("1565299585323-38d6b0865b47"), img("1504674900247-0877df9cc836")], startsH: -26, endsH: 24 * 30, publishedH: 26, days: [1, 2, 3, 4], window: ["14:00", "17:00"], qty: 60, claimed: 9, instructions: "Show your voucher before paying. Staff will apply the discount to your bill.", restrictions: "Food only, excludes alcohol. Dine-in only. Not combinable with other offers." },
      { key: "fc-reopen", type: "exclusive", kind: "amount_off", off: 500, title: "Grand reopening: $5 off $20+", description: "We just reopened with a bigger patio and a new salsa bar. Take $5 off any order of $20 or more.", images: [img("1565299585323-38d6b0865b47")], qty: 80, startsH: -18, endsH: 24 * 14, publishedH: 18, instructions: "Show your voucher before paying.", restrictions: "Minimum $20 food purchase. One per table." },
    ],
  },
  {
    slug: "hyde-park-pizza-kitchen", name: "Hyde Park Pizza Kitchen", category: "food-drink", zip: "78751", address: "4206 Duval St",
    dLat: 0.0009, dLng: -0.0015, phone: "(512) 555-0111",
    description: "Wood-fired Neapolitan pies and natural wine in the heart of Hyde Park.",
    cover: img("1513104890138-7c749659a591"), hours: weekdays("16:00", "22:00", H("12:00", "23:00"), H("12:00", "21:00")),
    deals: [
      { key: "pies", type: "surplus", title: "End-of-night whole pies", description: "Margherita or pepperoni pies made from our leftover dough — still blistered, still great.", images: [img("1574071318508-1cdbab80d002"), img("1513104890138-7c749659a591")], orig: 2200, price: 800, qty: 6, claimed: 1, startsH: -1, endsH: 5, publishedH: 1, instructions: "Pick up at the host stand between 9 and 10 PM." },
    ],
  },
  {
    slug: "sakura-bowl", name: "Sakura Bowl", category: "food-drink", zip: "78705", address: "2310 Guadalupe St",
    dLat: -0.0011, dLng: 0.0006, phone: "(512) 555-0123",
    description: "Fresh poke and rice bowls built to order across from campus.",
    cover: img("1546069901-ba9599a7e63c"), hours: weekdays("11:00", "21:00", H("11:00", "21:00"), H("12:00", "20:00")),
    deals: [
      { key: "poke", type: "surplus", title: "Poke bowl rescue", description: "Chef's-choice regular poke bowl made with today's remaining fish and toppings.", images: [img("1546069901-ba9599a7e63c"), img("1512621776951-a57141f2eefd")], orig: 1500, price: 700, qty: 10, claimed: 3, startsH: -5, endsH: 9, publishedH: 5, instructions: "Show your voucher at the pickup counter after 7 PM." },
      { key: "dinner", type: "slow_hours", kind: "amount_off", off: 1000, title: "$10 off dinner for two", description: "Take $10 off a dinner order of $30 or more on our slowest nights.", images: [img("1512621776951-a57141f2eefd")], startsH: -10, endsH: 24 * 25, publishedH: 10, days: [2, 3], window: ["17:00", "21:00"], instructions: "Show your voucher before paying.", restrictions: "Minimum $30 food purchase. Dine-in only." },
    ],
  },
  {
    slug: "the-nail-studio", name: "The Nail Studio", category: "beauty-wellness", zip: "78703", address: "1206 W Lynn St",
    dLat: 0.0014, dLng: 0.0011, phone: "(512) 555-0155", website: "https://example.com/the-nail-studio",
    description: "Clean, calm and precise. Gel, BIAB and classic manicures in Clarksville.",
    cover: img("1604654894610-df63bc536371"), hours: weekdays("10:00", "19:00", H("09:00", "18:00")),
    deals: [
      { key: "gel", type: "appointment", title: "Gel manicure — canceled slot", description: "A client canceled, so this gel manicure is yours for much less. Includes shaping, cuticle care and your choice of color.", images: [img("1604654894610-df63bc536371"), img("1519014816548-bf5fe059798b")], orig: 4500, price: 2500, duration: 45, startsH: -2, publishedH: 2, slotsH: [{ d: 0, t: "16:30", cap: 1 }, { d: 1, t: "11:00", cap: 1 }, { d: 1, t: "15:30", cap: 1, taken: 1 }], instructions: "Arrive 5 minutes early and show your voucher at the front desk.", restrictions: "Removal of existing gel is $10 extra. 24-hour cancellation policy applies." },
      { key: "fc-first", type: "exclusive", kind: "fixed_price", orig: 3000, price: 1800, title: "First-visit classic manicure", description: "New to The Nail Studio? Try our classic manicure (shape, cuticle care, polish) for $18.", images: [img("1519014816548-bf5fe059798b")], qty: 20, startsH: -40, endsH: 24 * 25, publishedH: 40, instructions: "Book by phone and mention Frugal Center, then show your voucher at check-in.", restrictions: "New clients only." },
    ],
  },
  {
    slug: "fade-and-co", name: "Fade & Co. Barbershop", category: "beauty-wellness", zip: "78702", address: "1100 E Cesar Chavez St",
    dLat: 0.0025, dLng: -0.002, phone: "(512) 555-0168",
    description: "Classic cuts, skin fades and hot towel shaves. Walk-ins welcome when the chairs are free.",
    cover: img("1503951914875-452162b0f3f1"), hours: weekdays("09:00", "19:00", H("09:00", "17:00")),
    deals: [
      { key: "cut", type: "appointment", title: "Haircut + hot towel finish", description: "Two chairs opened up this week. Any cut plus a hot towel and neck shave.", images: [img("1585747860715-2ba37e788b70"), img("1503951914875-452162b0f3f1")], orig: 3800, price: 2000, duration: 40, startsH: -6, publishedH: 6, slotsH: [{ d: 0, t: "17:00", cap: 1 }, { d: 1, t: "10:20", cap: 2 }], instructions: "Show your voucher when you check in." },
    ],
  },
  {
    slug: "stillwater-massage", name: "Stillwater Massage", category: "beauty-wellness", zip: "78756", address: "5350 Burnet Rd",
    dLat: 0.001, dLng: 0.0012, phone: "(512) 555-0133",
    description: "Licensed therapists specializing in deep tissue, sports and prenatal massage.",
    cover: img("1544161515-4ab6ce6db874"), hours: weekdays("10:00", "20:00", H("10:00", "18:00"), H("11:00", "17:00")),
    deals: [
      { key: "deep", type: "appointment", title: "60-minute deep tissue massage", description: "Last-minute openings with our senior therapists. Includes aromatherapy add-on.", images: [img("1544161515-4ab6ce6db874"), img("1540555700478-4be289fbecef")], orig: 11000, price: 6500, duration: 60, startsH: -4, publishedH: 4, slotsH: [{ d: 1, t: "13:00", cap: 1 }, { d: 2, t: "18:00", cap: 1 }], instructions: "Arrive 10 minutes early to fill out a short intake form." , restrictions: "Gratuity not included." },
    ],
  },
  {
    slug: "sunrise-yoga-loft", name: "Sunrise Yoga Loft", category: "activities", zip: "78704", address: "2002 S Lamar Blvd",
    dLat: -0.002, dLng: -0.0024, phone: "(512) 555-0109",
    description: "Vinyasa, yin and slow flow classes in a sunlit studio on South Lamar.",
    cover: img("1506126613408-eca07ce68773"), hours: weekdays("06:00", "21:00", H("08:00", "14:00"), H("08:00", "14:00")),
    deals: [
      { key: "midday", type: "slow_hours", kind: "fixed_price", title: "Midday class drop-in", description: "Any class that starts between 11 AM and 2 PM on weekdays for $10. Mats provided.", images: [img("1544367567-0f2fcb009e0b"), img("1506126613408-eca07ce68773")], orig: 2200, price: 1000, startsH: -72, endsH: 24 * 21, publishedH: 72, days: [1, 2, 3, 4, 5], window: ["11:00", "14:00"], instructions: "Show your voucher at check-in.", restrictions: "New and returning students welcome. One class per voucher." },
    ],
  },
  {
    slug: "petal-and-stem", name: "Petal & Stem Flowers", category: "shopping", zip: "78701", address: "800 W 5th St",
    dLat: -0.0016, dLng: -0.0041, phone: "(512) 555-0188",
    description: "Seasonal, locally grown flowers arranged loose and wild.",
    cover: img("1487530811176-3780de880c2d"), hours: weekdays("09:00", "18:00", H("09:00", "17:00")),
    deals: [
      { key: "bouquet", type: "surplus", title: "End-of-day market bouquet", description: "A hand-tied bouquet of today's remaining stems. Gorgeous for a few more days at home.", images: [img("1490750967868-88aa4486c946"), img("1487530811176-3780de880c2d")], orig: 3500, price: 1500, qty: 5, claimed: 2, startsH: -2, endsH: 4, publishedH: 2, instructions: "Pick up at the shop before close." },
    ],
  },
  {
    slug: "second-chapter-books", name: "Second Chapter Books", category: "shopping", zip: "78751", address: "4310 Avenue B",
    dLat: -0.0013, dLng: 0.0019, phone: "(512) 555-0102",
    description: "A cozy used and rare bookshop with a resident cat named Gatsby.",
    cover: img("1481627834876-b7833e8f5570"), hours: weekdays("10:00", "19:00", H("10:00", "19:00"), H("12:00", "17:00")),
    deals: [
      { key: "mornings", type: "slow_hours", kind: "percent", pct: 20, title: "20% off used books, weekday mornings", description: "Browse the stacks while it's quiet and take 20% off your used-book purchase.", images: [img("1481627834876-b7833e8f5570")], startsH: -96, endsH: 24 * 28, publishedH: 96, days: [1, 2, 3, 4, 5], window: ["10:00", "12:00"], instructions: "Show your voucher at checkout.", restrictions: "Used books only. Excludes rare and signed editions." },
      { key: "fc-15", type: "exclusive", kind: "percent", pct: 15, title: "15% off new releases", description: "Fresh hardcovers and paperbacks from this season's list, 15% off for Frugal Center members.", images: [img("1481627834876-b7833e8f5570")], startsH: -60, endsH: 24 * 30, publishedH: 60, instructions: "Show your voucher at checkout.", restrictions: "New releases shelf only." },
    ],
  },
  {
    slug: "thread-theory", name: "Thread Theory Boutique", category: "shopping", zip: "78704", address: "1612 S Congress Ave",
    dLat: 0.0007, dLng: 0.0009, phone: "(512) 555-0161",
    description: "Independent clothing boutique featuring Texas-made basics and small-batch designers.",
    cover: img("1441986300917-64674bd600d8"), hours: weekdays("11:00", "19:00", H("10:00", "20:00"), H("11:00", "18:00")),
    deals: [
      { key: "tees", type: "surplus", title: "Sample sale organic tees", description: "Overstock and sample organic cotton tees in assorted colors, sizes XS–XL while they last.", images: [img("1556905055-8f358a7a47b2"), img("1441986300917-64674bd600d8")], orig: 3200, price: 1200, qty: 20, claimed: 7, startsH: -30, endsH: 48, publishedH: 30, instructions: "Show your voucher at the register." },
    ],
  },
  {
    slug: "clay-hour-studio", name: "Clay Hour Studio", category: "activities", zip: "78702", address: "2400 E Cesar Chavez St",
    dLat: -0.0008, dLng: 0.0048, phone: "(512) 555-0150",
    description: "Beginner-friendly pottery classes, open studio time and date nights on the wheel.",
    cover: img("1565193566173-7a0ee3dbe261"), hours: weekdays("12:00", "21:00", H("10:00", "21:00"), H("10:00", "18:00")),
    deals: [
      { key: "wheel", type: "appointment", title: "Intro to the wheel — 2 open seats", description: "Two seats opened up in our 2-hour beginner class. Clay, glazing and firing included.", images: [img("1565193566173-7a0ee3dbe261")], orig: 6500, price: 3500, duration: 120, startsH: -8, publishedH: 8, slotsH: [{ d: 1, t: "18:30", cap: 2 }], instructions: "Arrive 10 minutes early and wear clothes that can get messy." },
    ],
  },
  {
    slug: "boulder-yard", name: "Boulder Yard Climbing", category: "activities", zip: "78756", address: "5700 N Lamar Blvd",
    dLat: -0.0035, dLng: -0.0012, phone: "(512) 555-0174",
    description: "Bouldering gym with 200+ problems, a training area and a friendly community.",
    cover: img("1522163182402-834f871fd851"), hours: weekdays("06:00", "23:00", H("09:00", "22:00"), H("09:00", "20:00")),
    deals: [
      { key: "daypass", type: "slow_hours", kind: "fixed_price", title: "Off-peak day pass", description: "Climb all day for $12 when the walls are quiet. Shoe rental 50% off with this pass.", images: [img("1522163182402-834f871fd851")], orig: 2200, price: 1200, startsH: -50, endsH: 24 * 30, publishedH: 50, days: [1, 2, 3, 4], window: ["10:00", "15:00"], instructions: "Show your voucher at the front desk." },
      { key: "fc-intro", type: "exclusive", kind: "fixed_price", orig: 6000, price: 3500, title: "Intro climb for two + gear", description: "Two day passes, shoe and harness rental, and a 20-minute belay intro with our staff.", images: [img("1522163182402-834f871fd851")], qty: 25, startsH: -20, endsH: 24 * 28, publishedH: 20, instructions: "Show your voucher at the front desk.", restrictions: "Both climbers must sign a waiver." },
    ],
  },
  {
    slug: "paws-and-suds", name: "Paws & Suds Grooming", category: "services", zip: "78751", address: "4500 Duval St",
    dLat: 0.0031, dLng: 0.0008, phone: "(512) 555-0128",
    description: "Low-stress grooming for dogs of every size, from puppy baths to full breed cuts.",
    cover: img("1516734212186-a967f81ad0d7"), hours: weekdays("08:00", "18:00", H("09:00", "16:00")),
    deals: [
      { key: "bath", type: "appointment", title: "Bath & brush — canceled slot", description: "Full bath, blow-dry, brush-out, nail trim and ear cleaning for dogs up to 50 lb.", images: [img("1516734212186-a967f81ad0d7")], orig: 5500, price: 3000, duration: 90, startsH: -3, publishedH: 3, slotsH: [{ d: 1, t: "09:30", cap: 1 }], instructions: "Bring proof of rabies vaccination." },
    ],
  },
  {
    slug: "spark-auto-spa", name: "Spark Auto Spa", category: "services", zip: "78756", address: "5900 Burnet Rd",
    dLat: 0.0042, dLng: 0.0021, phone: "(512) 555-0193",
    description: "Hand wash, interior detailing and ceramic coatings by a crew that sweats the details.",
    cover: img("1607860108855-64acf2078ed9"), hours: weekdays("08:00", "18:00", H("08:00", "17:00")),
    deals: [
      { key: "detail", type: "slow_hours", kind: "fixed_price", title: "Full interior detail, Tue–Thu mornings", description: "Vacuum, steam clean, leather conditioning and glass. Our mornings mid-week are wide open.", images: [img("1607860108855-64acf2078ed9")], orig: 12900, price: 7900, qty: 15, claimed: 2, startsH: -40, endsH: 24 * 18, publishedH: 40, days: [2, 3, 4], window: ["08:00", "12:00"], instructions: "Show your voucher at drop-off." },
      { key: "fc-20off", type: "exclusive", kind: "amount_off", off: 2000, title: "$20 off any full detail", description: "Interior, exterior or the works: take $20 off any full detail package, any day.", images: [img("1607860108855-64acf2078ed9")], qty: 30, startsH: -50, endsH: 24 * 20, publishedH: 50, instructions: "Show your voucher at drop-off.", restrictions: "Full detail packages only." },
    ],
  },
  {
    slug: "lucky-pixel-arcade", name: "Lucky Pixel Arcade", category: "activities", zip: "78701", address: "301 E 5th St",
    dLat: 0.0004, dLng: 0.0039, phone: "(512) 555-0185",
    description: "Retro arcade cabinets, pinball and board games. Free play wristbands, no quarters needed.",
    cover: img("1511512578047-dfb367046420"), hours: weekdays("15:00", "23:00", H("12:00", "23:30"), H("12:00", "22:00")),
    deals: [
      { key: "wristband", type: "slow_hours", kind: "fixed_price", title: "Unlimited play wristband, early evening", description: "All-you-can-play wristband during our early hours. Pinball included.", images: [img("1511512578047-dfb367046420")], orig: 2000, price: 1000, startsH: -12, endsH: 24 * 14, publishedH: 12, days: [0, 1, 2, 3, 4], window: ["15:00", "18:00"], instructions: "Show your voucher at the door." },
    ],
  },
  {
    slug: "fresh-press-juicery", name: "Fresh Press Juicery", category: "food-drink", zip: "78703", address: "1400 W 6th St",
    dLat: -0.0019, dLng: 0.0026, phone: "(512) 555-0117",
    description: "Cold-pressed juices, smoothies and açaí bowls made from Texas produce.",
    cover: img("1622597467836-f3285f2131b8"), hours: weekdays("07:00", "17:00", H("08:00", "16:00"), H("08:00", "15:00")),
    deals: [
      { key: "juice", type: "surplus", title: "Cold-pressed juice 3-pack", description: "Three 12 oz juices pressed this morning. Best enjoyed within 2 days.", images: [img("1622597467836-f3285f2131b8")], orig: 2400, price: 1000, qty: 9, claimed: 5, startsH: -6, endsH: 3, publishedH: 6, instructions: "Pick up at the counter before 5 PM." },
    ],
  },
];

const NEIGHBORS = [
  "Olivia Martinez", "Ethan Brooks", "Priya Shah", "Marcus Lee", "Sofia Rossi", "Daniel Kim",
  "Ava Johnson", "Noah Garcia", "Chloe Nguyen", "Liam Walker", "Isabella Cruz", "Ben Carter",
];

type CreateUser = (email: string, password: string, fullName: string) => Promise<string>;

export async function seedDemoData(db: Db, createUser: CreateUser) {
  const ids: Record<string, string> = {};
  for (const [k, a] of Object.entries(DEMO_ACCOUNTS)) ids[k] = await createUser(a.email, DEMO_PASSWORD, a.name);
  ids.partners = await createUser("partners@demo.frugal.center", DEMO_PASSWORD, "Riley Partner");
  const neighborIds: string[] = [];
  for (const [i, n] of NEIGHBORS.entries()) {
    neighborIds.push(await createUser(`neighbor${i + 1}@demo.frugal.center`, DEMO_PASSWORD, n));
  }

  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ids.admin]);
  await db.query(
    `update public.profiles set home_zip = '78701', home_label = 'Downtown Austin', home_lat = 30.2672, home_lng = -97.7431 where id = $1`,
    [ids.customer],
  );

  const areas = Object.fromEntries(
    (await db.query<{ zip: string; lat: number; lng: number }>(`select zip, lat, lng from public.launch_areas`)).map((a) => [a.zip, a]),
  );
  const hoursJson = (h: SeedBusiness["hours"]) =>
    JSON.stringify(Object.fromEntries(Object.entries(h).map(([d, v]) => [d, v ? { open: v[0], close: v[1] } : null])));

  const dealIds: Record<string, string> = {};
  const businessIds: Record<string, string> = {};
  const now = Date.now();
  const at = (hours: number) => new Date(now + hours * 3600000).toISOString();

  for (const [bi, b] of BUSINESSES.entries()) {
    const area = areas[b.zip]!;
    const owner = b.slug === "main-street-bakery" ? ids.owner! : ids.partners!;
    const [row] = await db.query<{ id: string }>(
      `insert into public.businesses (slug, name, category_slug, description, cover_url, address_line, city, state, zip,
         lat, lng, phone, website, hours, review_status, reviewed_at, created_by, created_at)
       values ($1,$2,$3,$4,$5,$6,'Austin','TX',$7,$8,$9,$10,$11,$12,$13, now(), $14, now() - make_interval(days => $15)) returning id`,
      [b.slug, b.name, b.category, b.description, b.cover, b.address, b.zip, area.lat + b.dLat, area.lng + b.dLng,
        b.phone, b.website ?? null, hoursJson(b.hours), bi === BUSINESSES.length - 1 ? "pending" : "approved", owner, 120 - bi * 5],
    );
    const bid = row!.id;
    businessIds[b.slug] = bid;
    await db.query(`insert into public.business_members (business_id, user_id, role) values ($1, $2, 'owner')`, [bid, owner]);
    if (b.slug === "main-street-bakery") {
      await db.query(`insert into public.business_members (business_id, user_id, role) values ($1, $2, 'staff')`, [bid, ids.staff]);
    }
    await db.query(
      `insert into public.business_subscriptions (business_id, provider, status, current_period_end) values ($1, 'demo', $2, now() + interval '24 days')`,
      [bid, b.slug === "thread-theory" ? "past_due" : "active"],
    );

    for (const d of b.deals) {
      const kind = d.kind ?? "fixed_price";
      const slots = (d.slotsH ?? []).map((s) => ({ ...s, at: localSlot(s.d, s.t) })).sort((a, b) => a.at.getTime() - b.at.getTime());
      const endsH = d.type === "appointment" ? Math.max(...slots.map((s) => (s.at.getTime() - now) / 3600000)) : d.endsH!;
      const [deal] = await db.query<{ id: string }>(
        `insert into public.deals (business_id, type, status, title, description, images, discount_kind, original_price_cents,
           deal_price_cents, percent_off, amount_off_cents, quantity_total, claimed_count, starts_at, ends_at, published_at,
           followers_notified_at, redemption_instructions, restrictions, duration_minutes, recurring_days, window_start, window_end, created_by)
         values ($1, $2::public.deal_type, 'published', $3, $4, $5::text[], $6::public.discount_kind, $7, $8, $9, $10, $11, 0,
           $12::timestamptz, $13::timestamptz, $14::timestamptz, $14::timestamptz, $15, $16, $17, $18::int[], $19::time, $20::time, $21) returning id`,
        [bid, d.type, d.title, d.description, d.images, kind, kind === "fixed_price" ? d.orig : null,
          kind === "fixed_price" ? d.price : null, d.pct ?? null, d.off ?? null,
          d.type === "appointment" ? null : (d.qty ?? null), at(d.startsH ?? -1), at(endsH), at(-(d.publishedH ?? 1)),
          d.instructions ?? null, d.restrictions ?? null, d.duration ?? null, d.days ?? null, d.window?.[0] ?? null,
          d.window?.[1] ?? null, owner],
      );
      dealIds[`${b.slug}/${d.key}`] = deal!.id;
      for (const s of slots) {
        await db.query(
          `insert into public.appointment_slots (deal_id, starts_at, capacity) values ($1, $2::timestamptz, $3)`,
          [deal!.id, s.at.toISOString(), s.cap],
        );
      }
      // Pre-existing claims by neighbors, so counts and "x left" are realistic.
      const prior = d.type === "appointment" ? slots.reduce((n, s) => n + (s.taken ?? 0), 0) : (d.claimed ?? 0);
      const slotRows = await db.query<{ id: string; starts_at: Date; capacity: number }>(
        `select id, starts_at, capacity from public.appointment_slots where deal_id = $1 order by starts_at`,
        [deal!.id],
      );
      for (let i = 0; i < prior; i++) {
        const slot = d.type === "appointment" ? slotRows.find((_, si) => (slots[si]?.taken ?? 0) > 0) : undefined;
        await insertClaim(db, {
          dealId: deal!.id, businessId: bid, userId: neighborIds[(i + bi) % neighborIds.length]!, slotId: slot?.id ?? null,
          createdAt: at(-Math.min(d.publishedH ?? 1, 1 + i * 0.3)), expiresAt: slot ? new Date(new Date(slot.starts_at).getTime() + (d.duration ?? 60) * 60000).toISOString() : at(endsH),
          terms: termsFor(b, d), status: "active",
        });
        if (slot) await db.query(`update public.appointment_slots set claimed_count = claimed_count + 1 where id = $1`, [slot.id]);
      }
      await db.query(`update public.deals set claimed_count = $2 where id = $1`, [deal!.id, prior]);
    }

    // Followers
    for (const [ni, nid] of neighborIds.entries()) {
      if ((ni + bi) % 3 !== 0) {
        await db.query(
          `insert into public.follows (user_id, business_id, created_at) values ($1, $2, now() - make_interval(days => $3))`,
          [nid, bid, (ni * 7 + bi * 3) % 40],
        );
      }
    }
  }

  // Maya follows a handful of places and has real history.
  for (const slug of ["main-street-bakery", "bluebonnet-coffee", "the-nail-studio", "casa-verde-taqueria", "sunrise-yoga-loft"]) {
    await db.query(`insert into public.follows (user_id, business_id, created_at) values ($1, $2, now() - interval '20 days')`, [
      ids.customer, businessIds[slug],
    ]);
  }
  for (const k of ["petal-and-stem/bouquet", "hyde-park-pizza-kitchen/pies", "stillwater-massage/deep"]) {
    await db.query(`insert into public.favorites (user_id, deal_id) values ($1, $2)`, [ids.customer, dealIds[k]]);
  }

  // Past (ended) deals with redemption history for Maya and for the bakery's analytics.
  const history: { slug: string; title: string; orig: number; price: number; daysAgo: number; user: string; method: "qr" | "code"; variable?: boolean }[] = [
    { slug: "main-street-bakery", title: "Surprise Pastry Box", orig: 2000, price: 900, daysAgo: 2, user: ids.customer!, method: "qr" },
    { slug: "the-nail-studio", title: "Gel manicure — canceled slot", orig: 4500, price: 2500, daysAgo: 6, user: ids.customer!, method: "code" },
    { slug: "casa-verde-taqueria", title: "30% off your bill, 2–5 PM", orig: 5400, price: 3780, daysAgo: 12, user: ids.customer!, method: "qr", variable: true },
    { slug: "bluebonnet-coffee", title: "Afternoon latte happy hour", orig: 550, price: 300, daysAgo: 16, user: ids.customer!, method: "qr" },
    { slug: "stillwater-massage", title: "60-minute deep tissue massage", orig: 11000, price: 6500, daysAgo: 38, user: ids.customer!, method: "code" },
    { slug: "petal-and-stem", title: "End-of-day market bouquet", orig: 3500, price: 1500, daysAgo: 55, user: ids.customer!, method: "qr" },
    { slug: "hyde-park-pizza-kitchen", title: "End-of-night whole pies", orig: 2200, price: 800, daysAgo: 71, user: ids.customer!, method: "qr" },
    { slug: "sunrise-yoga-loft", title: "Midday class drop-in", orig: 2200, price: 1000, daysAgo: 96, user: ids.customer!, method: "code" },
  ];
  for (let i = 0; i < 14; i++) {
    history.push({ slug: "main-street-bakery", title: i % 3 ? "Surprise Pastry Box" : "Day-old sourdough loaves", orig: i % 3 ? 2000 : 900, price: i % 3 ? 900 : 400, daysAgo: 1 + i * 2, user: neighborIds[i % neighborIds.length]!, method: i % 2 ? "qr" : "code" });
  }
  const pastDeals: Record<string, string> = {};
  for (const h of history) {
    const key = `${h.slug}/${h.title}`;
    const bid = businessIds[h.slug]!;
    const b = BUSINESSES.find((x) => x.slug === h.slug)!;
    if (!pastDeals[key]) {
      const [pd] = await db.query<{ id: string }>(
        h.variable
          ? `insert into public.deals (business_id, type, status, title, images, discount_kind, percent_off, starts_at, ends_at,
               published_at, followers_notified_at, recurring_days, window_start, window_end)
             values ($1, 'slow_hours', 'ended', $2, $3::text[], 'percent', 30, now() - interval '120 days', now() - interval '1 day',
               now() - interval '120 days', now() - interval '120 days', '{1,2,3,4}', '14:00', '17:00') returning id`
          : `insert into public.deals (business_id, type, status, title, images, discount_kind, original_price_cents, deal_price_cents,
               quantity_total, starts_at, ends_at, published_at, followers_notified_at)
             values ($1, 'surplus', 'ended', $2, $3::text[], 'fixed_price', $4, $5, 100, now() - interval '120 days', now() - interval '1 hour',
               now() - interval '120 days', now() - interval '120 days') returning id`,
        h.variable ? [bid, h.title, [b.cover]] : [bid, h.title, [b.cover], h.orig, h.price],
      );
      pastDeals[key] = pd!.id;
    }
    const created = new Date(now - h.daysAgo * 86400000 - 3 * 3600000).toISOString();
    const redeemed = new Date(now - h.daysAgo * 86400000).toISOString();
    const claimId = await insertClaim(db, {
      dealId: pastDeals[key]!, businessId: bid, userId: h.user, slotId: null, createdAt: created, expiresAt: redeemed,
      terms: { ...termsFor(b, { type: h.variable ? "slow_hours" : "surplus", title: h.title, kind: h.variable ? "percent" : "fixed_price", orig: h.variable ? undefined : h.orig, price: h.variable ? undefined : h.price, pct: h.variable ? 30 : undefined, days: h.variable ? [1, 2, 3, 4] : undefined, window: h.variable ? ["14:00", "17:00"] : undefined } as SeedDeal) },
      status: "redeemed", redeemedAt: redeemed,
    });
    await db.query(
      `insert into public.redemptions (claim_id, business_id, deal_id, user_id, redeemed_by, method, original_amount_cents,
         final_amount_cents, amounts_confirmed_by_merchant, redeemed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)`,
      [claimId, bid, pastDeals[key], h.user, h.slug === "main-street-bakery" ? ids.staff : ids.partners, h.method, h.orig, h.price, !!h.variable, redeemed],
    );
    await db.query(`update public.deals set claimed_count = claimed_count + 1 where id = $1`, [pastDeals[key]]);
  }

  // One active voucher for Maya so "My Deals" isn't empty.
  const sourdough = dealIds["main-street-bakery/sourdough"]!;
  const sb = BUSINESSES[0]!;
  await insertClaim(db, {
    dealId: sourdough, businessId: businessIds["main-street-bakery"]!, userId: ids.customer!, slotId: null,
    createdAt: at(-1), expiresAt: at(30), terms: termsFor(sb, sb.deals[1]!), status: "active",
  });
  await db.query(`update public.deals set claimed_count = claimed_count + 1 where id = $1`, [sourdough]);

  await db.query(
    `insert into public.notifications (user_id, type, title, body, url, business_id, deal_id, created_at)
     values ($1, 'new_deal', 'Main Street Bakery posted a new deal', 'Surprise Pastry Box — $9 instead of $20 · 55% OFF', $2, $3, $4, now() - interval '3 hours')`,
    [ids.customer, `/deals/${dealIds["main-street-bakery/pastry-box"]}`, businessIds["main-street-bakery"], dealIds["main-street-bakery/pastry-box"]],
  );

  await db.query(
    `insert into public.reports (reporter_id, deal_id, business_id, reason, details)
     values ($1, $2, $3, 'not_honored', 'Staff said the deal had ended even though the app showed it as live.')`,
    [neighborIds[2], dealIds["thread-theory/tees"], businessIds["thread-theory"]],
  );
  return { ids, businessIds, dealIds };
}

function termsFor(b: SeedBusiness, d: SeedDeal) {
  const kind = d.kind ?? "fixed_price";
  return {
    title: d.title, type: d.type, discount_kind: kind,
    original_price_cents: kind === "fixed_price" ? (d.orig ?? null) : null,
    deal_price_cents: kind === "fixed_price" ? (d.price ?? null) : null,
    percent_off: d.pct ?? null, amount_off_cents: d.off ?? null,
    recurring_days: d.days ?? null, window_start: d.window?.[0] ?? null, window_end: d.window?.[1] ?? null,
    slot_starts_at: null, duration_minutes: d.duration ?? null,
    redemption_instructions: d.instructions ?? null, restrictions: d.restrictions ?? null,
    business_name: b.name, timezone: "America/Chicago",
  };
}

async function insertClaim(
  q: Queryable,
  c: { dealId: string; businessId: string; userId: string; slotId: string | null; createdAt: string; expiresAt: string; terms: object; status: "active" | "redeemed"; redeemedAt?: string },
) {
  const [row] = await q.query<{ id: string }>(
    `insert into public.claims (deal_id, business_id, user_id, slot_id, status, code, qr_token, expires_at, terms, created_at, redeemed_at)
     values ($1, $2, $3, $4, $5::public.claim_status, $6, $7, $8::timestamptz, $9, $10::timestamptz, $11::timestamptz) returning id`,
    [c.dealId, c.businessId, c.userId, c.slotId, c.status, generateManualCode(), generateToken(32), c.expiresAt,
      JSON.stringify(c.terms), c.createdAt, c.redeemedAt ?? null],
  );
  return row!.id;
}

export async function localCreateUser(db: Db): Promise<CreateUser> {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return async (email, password, fullName) => {
    const h = password === DEMO_PASSWORD ? hash : await bcrypt.hash(password, 10);
    const [row] = await db.query<{ id: string }>(
      `insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, $2, $3) returning id`,
      [email, h, JSON.stringify({ full_name: fullName })],
    );
    return row!.id;
  };
}

/** Local demo: seed once, on an empty database. */
export async function ensureDemoSeed(db: Db) {
  if (process.env.FC_SKIP_SEED === "1") return;
  const [row] = await db.query<{ n: number }>(`select count(*)::int as n from public.businesses`);
  if (row!.n > 0) return;
  await seedDemoData(db, await localCreateUser(db));
}

/** Local demo: wipe and reseed (used by the admin "Reset demo data" button and `npm run db:reset`). */
export async function resetDemoData(db: Db) {
  await db.query(
    `truncate public.redemptions, public.claims, public.appointment_slots, public.favorites, public.follows,
       public.notifications, public.email_outbox, public.push_subscriptions, public.reports, public.audit_log,
       public.rate_limit_events, public.business_subscriptions, public.business_invites, public.business_members,
       public.deals, public.businesses, public.stripe_events, public.notification_preferences, public.profiles cascade`,
  );
  await db.query(`delete from auth.users`);
  await seedDemoData(db, await localCreateUser(db));
}
