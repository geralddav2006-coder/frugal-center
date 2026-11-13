import { z } from "zod";

const money = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""))))
  .refine((n) => Number.isFinite(n) && n >= 0 && n <= 100000, "Enter a valid amount")
  .transform((n) => Math.round(n * 100));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const imageUrl = z.string().refine((u) => /^(https:\/\/|\/api\/uploads\/)/.test(u), "Invalid image").max(500);

const dayHours = z.object({ open: hhmm, close: hhmm }).nullable();
export const hoursSchema = z
  .object({ sun: dayHours, mon: dayHours, tue: dayHours, wed: dayHours, thu: dayHours, fri: dayHours, sat: dayHours })
  .partial();

export const businessSchema = z.object({
  name: z.string().trim().min(2, "Business name is required").max(80),
  category_slug: z.enum(["food-drink", "beauty-wellness", "shopping", "activities", "services"], {
    message: "Choose a category",
  }),
  description: optionalText(1000),
  address_line: z.string().trim().min(3, "Street address is required").max(120),
  city: z.string().trim().min(2, "City is required").max(60),
  state: z.string().trim().length(2, "Use a 2-letter state code").toUpperCase(),
  zip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit ZIP"),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  phone: optionalText(30),
  website: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? (/^https?:\/\//.test(v) ? v : `https://${v}`) : null))
    .refine((v) => !v || /^https?:\/\/[^\s.]+\.[^\s]+$/.test(v), "Enter a valid website"),
  contact_email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => !v || z.email().safeParse(v).success, "Enter a valid email"),
  hours: hoursSchema.default({}),
  logo_url: imageUrl.optional().nullable(),
  cover_url: imageUrl.optional().nullable(),
});
export type BusinessInput = z.input<typeof businessSchema>;

const common = {
  title: z.string().trim().min(3, "Add a title").max(90),
  description: optionalText(2000),
  images: z.array(imageUrl).max(6).default([]),
  redemption_instructions: optionalText(1000),
  restrictions: optionalText(1000),
  per_customer_limit: z.coerce.number().int().min(1).max(10).default(1),
};

export const surplusSchema = z.object({
  type: z.literal("surplus"),
  ...common,
  original_price: money,
  deal_price: money,
  quantity_total: z.coerce.number().int().min(1, "At least 1").max(10000),
  starts_at: localDateTime,
  ends_at: localDateTime,
});

export const appointmentSchema = z.object({
  type: z.literal("appointment"),
  ...common,
  original_price: money,
  deal_price: money,
  duration_minutes: z.coerce.number().int().min(5).max(600),
  slots: z
    .array(z.object({ id: z.string().optional(), starts_at: localDateTime, capacity: z.coerce.number().int().min(1).max(100) }))
    .min(1, "Add at least one time slot")
    .max(30),
});

export const slowHoursSchema = z.object({
  type: z.literal("slow_hours"),
  ...common,
  discount_kind: z.enum(["percent", "amount_off", "fixed_price"]),
  percent_off: z.coerce.number().int().min(1).max(100).optional().nullable(),
  amount_off: money.optional().nullable(),
  original_price: money.optional().nullable(),
  deal_price: money.optional().nullable(),
  recurring_days: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day"),
  window_start: hhmm,
  window_end: hhmm,
  quantity_total: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  starts_at: localDateTime,
  ends_at: localDateTime,
});

/** A general promotional discount offered only on Frugal Center. */
export const exclusiveSchema = z.object({
  type: z.literal("exclusive"),
  ...common,
  discount_kind: z.enum(["percent", "amount_off", "fixed_price"]),
  percent_off: z.coerce.number().int().min(1).max(100).optional().nullable(),
  amount_off: money.optional().nullable(),
  original_price: money.optional().nullable(),
  deal_price: money.optional().nullable(),
  quantity_total: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  starts_at: localDateTime,
  ends_at: localDateTime,
});

export const dealSchema = z.discriminatedUnion("type", [surplusSchema, appointmentSchema, slowHoursSchema, exclusiveSchema]);
export type DealInput = z.input<typeof dealSchema>;
export type DealParsed = z.output<typeof dealSchema>;

export function firstIssue(err: z.ZodError) {
  const i = err.issues[0];
  if (!i) return "Invalid input";
  const field = i.path.join(".");
  return field ? `${i.message} (${field.replace(/_/g, " ")})` : i.message;
}
