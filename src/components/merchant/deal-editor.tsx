"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Clock, Eye, Gem, Loader2, Lock, Package, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveDealAction } from "@/app/actions/merchant";
import { DEAL_TYPE_META, type DealType, type DiscountKind } from "@/lib/deals";
import { DAY_SHORT, zonedInputToDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/use-now";
import type { DealCard as DealCardData } from "@/server/services/discovery";
import { DealCard } from "@/components/deals/deal-card";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { MultiImageUpload } from "./image-upload";

export interface EditorValue {
  type: DealType | null;
  title: string;
  description: string;
  images: string[];
  redemption_instructions: string;
  restrictions: string;
  per_customer_limit: number;
  is_exclusive: boolean;
  original_price: string;
  deal_price: string;
  quantity_total: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: string;
  slots: { id?: string; starts_at: string; capacity: string; claimed?: number }[];
  discount_kind: DiscountKind;
  percent_off: string;
  amount_off: string;
  recurring_days: number[];
  window_start: string;
  window_end: string;
}

const TYPES: { type: DealType; icon: typeof Package; examples: string }[] = [
  { type: "surplus", icon: Package, examples: "Bakery leftovers, extra flowers, unsold retail" },
  { type: "appointment", icon: CalendarClock, examples: "Canceled nail, hair, massage or training slots" },
  { type: "slow_hours", icon: Clock, examples: "Afternoon specials, off-peak services" },
];

export function DealEditor({
  initial,
  dealId,
  businessName,
  businessCover,
  timezone,
  locked,
  status,
}: {
  initial: EditorValue;
  dealId: string | null;
  businessName: string;
  businessCover: string | null;
  timezone: string;
  locked: boolean; // customers have claimed: terms locked
  status: string | null;
}) {
  const router = useRouter();
  const [v, setV] = useState<EditorValue>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof EditorValue>(k: K, val: EditorValue[K]) => setV((x) => ({ ...x, [k]: val }));
  const isPublished = status === "published" || status === "paused";

  const now = useNow();
  const startsInFuture = useMemo(() => {
    if (v.type === "appointment" || !v.starts_at || now == null) return false;
    try {
      return zonedInputToDate(v.starts_at, timezone).getTime() > now + 60000;
    } catch {
      return false;
    }
  }, [v.starts_at, v.type, timezone, now]);

  if (!v.type) {
    return (
      <div>
        <h1 className="text-3xl font-extrabold">Create a deal</h1>
        <p className="mt-1 text-muted">What would you like to fill?</p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {TYPES.map(({ type, icon: Icon, examples }) => (
            <button key={type} type="button" onClick={() => set("type", type)}
              className="group rounded-[var(--radius-card)] border border-line bg-white p-6 text-left transition hover:border-ink hover:shadow-[var(--shadow-soft)]">
              <span className="grid size-12 place-items-center rounded-2xl bg-mist transition group-hover:bg-lime"><Icon className="size-6" aria-hidden /></span>
              <p className="mt-4 text-lg font-extrabold">{DEAL_TYPE_META[type].label}</p>
              <p className="mt-1 text-sm text-muted">{examples}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const payload = () => {
    const common = {
      title: v.title,
      description: v.description || undefined,
      images: v.images,
      redemption_instructions: v.redemption_instructions || undefined,
      restrictions: v.restrictions || undefined,
      per_customer_limit: v.per_customer_limit,
      is_exclusive: v.is_exclusive,
    };
    if (v.type === "surplus") {
      return { type: "surplus" as const, ...common, original_price: v.original_price, deal_price: v.deal_price, quantity_total: Number(v.quantity_total), starts_at: v.starts_at, ends_at: v.ends_at };
    }
    if (v.type === "appointment") {
      return { type: "appointment" as const, ...common, original_price: v.original_price, deal_price: v.deal_price, duration_minutes: Number(v.duration_minutes), slots: v.slots.map((s) => ({ id: s.id, starts_at: s.starts_at, capacity: Number(s.capacity) })) };
    }
    return {
      type: "slow_hours" as const, ...common, discount_kind: v.discount_kind,
      percent_off: v.discount_kind === "percent" ? Number(v.percent_off) : null,
      amount_off: v.discount_kind === "amount_off" ? v.amount_off : null,
      original_price: v.discount_kind === "fixed_price" ? v.original_price : null,
      deal_price: v.discount_kind === "fixed_price" ? v.deal_price : null,
      recurring_days: v.recurring_days, window_start: v.window_start, window_end: v.window_end,
      quantity_total: v.quantity_total ? Number(v.quantity_total) : null, starts_at: v.starts_at, ends_at: v.ends_at,
    };
  };

  const save = (intent: "draft" | "publish") =>
    start(async () => {
      setError(null);
      const res = await saveDealAction(payload() as never, dealId, intent);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      if (res.publishError) {
        toast.warning(`Saved as draft. ${res.publishError}`);
      } else if (res.published) {
        toast.success(res.live ? "Deal is live! Followers are being notified." : "Deal scheduled. Followers will be notified when it starts.");
      } else {
        toast.success(isPublished ? "Changes saved" : "Draft saved");
      }
      router.push(`/dashboard/deals/${res.id}`);
      router.refresh();
    });

  const preview = previewDeal(v, businessName, businessCover, timezone);
  const lockNote = locked ? (
    <p className="flex items-start gap-2 rounded-xl bg-paper p-3 text-sm text-muted"><Lock className="mt-0.5 size-4 shrink-0" aria-hidden />Customers have claimed this deal, so its price and schedule are locked. You can still edit the description, photos, quantity and instructions.</p>
  ) : null;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <form className="grid min-w-0 gap-6" onSubmit={(e) => { e.preventDefault(); save(isPublished ? "publish" : "draft"); }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted">{DEAL_TYPE_META[v.type].label}</p>
            <h1 className="text-3xl font-extrabold">{dealId ? "Edit deal" : "New deal"}</h1>
          </div>
          {!dealId ? <Button type="button" variant="ghost" size="sm" onClick={() => set("type", null)}>Change type</Button> : null}
        </div>
        {lockNote}

        <Card title="The offer">
          <Field label={v.type === "appointment" ? "Service" : v.type === "surplus" ? "Product title" : "Offer title"} htmlFor="d-title">
            <Input id="d-title" value={v.title} maxLength={90} onChange={(e) => set("title", e.target.value)}
              placeholder={v.type === "appointment" ? "Gel manicure — canceled slot" : v.type === "surplus" ? "Surprise Pastry Box" : "30% off your bill, 2–5 PM"} required />
          </Field>
          <Field label="Description" htmlFor="d-desc">
            <Textarea id="d-desc" value={v.description} maxLength={2000} rows={3} onChange={(e) => set("description", e.target.value)} placeholder="What's included? Why is it a great deal?" />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-semibold">Photos</p>
            <MultiImageUpload value={v.images} onChange={(u) => set("images", u)} />
            {!v.images.length && businessCover ? <p className="mt-1.5 text-[13px] text-muted">No photos? We&apos;ll use your business cover photo.</p> : null}
          </div>
        </Card>

        <Card title="Price">
          {v.type === "slow_hours" ? (
            <Field label="Discount type" htmlFor="d-kind">
              <NativeSelect id="d-kind" value={v.discount_kind} disabled={locked} onChange={(e) => set("discount_kind", e.target.value as DiscountKind)}>
                <option value="percent">Percentage off the bill</option>
                <option value="amount_off">Fixed amount off the bill</option>
                <option value="fixed_price">Special price for an item or service</option>
              </NativeSelect>
            </Field>
          ) : null}
          {v.type !== "slow_hours" || v.discount_kind === "fixed_price" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Regular price" htmlFor="d-orig"><MoneyInput id="d-orig" value={v.original_price} disabled={locked} onChange={(x) => set("original_price", x)} /></Field>
              <Field label="Discounted price" htmlFor="d-price"><MoneyInput id="d-price" value={v.deal_price} disabled={locked} onChange={(x) => set("deal_price", x)} /></Field>
            </div>
          ) : v.discount_kind === "percent" ? (
            <Field label="Percent off" htmlFor="d-pct" hint="Staff will confirm the bill total when redeeming.">
              <div className="relative"><Input id="d-pct" inputMode="numeric" value={v.percent_off} disabled={locked} onChange={(e) => set("percent_off", e.target.value.replace(/\D/g, "").slice(0, 3))} className="pr-10" /><span className="absolute top-1/2 right-4 -translate-y-1/2 text-muted">%</span></div>
            </Field>
          ) : (
            <Field label="Amount off" htmlFor="d-off" hint="Staff will confirm the bill total when redeeming.">
              <MoneyInput id="d-off" value={v.amount_off} disabled={locked} onChange={(x) => set("amount_off", x)} />
            </Field>
          )}
          {preview.badge ? <p className="text-sm font-semibold text-lime-ink">Customers see: {preview.badge}</p> : null}
        </Card>

        {v.type === "surplus" ? (
          <Card title="Availability">
            <Field label="Available quantity" htmlFor="d-qty"><Input id="d-qty" inputMode="numeric" value={v.quantity_total} onChange={(e) => set("quantity_total", e.target.value.replace(/\D/g, ""))} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Starts" htmlFor="d-start"><Input id="d-start" type="datetime-local" value={v.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></Field>
              <Field label="Pick up by (expires)" htmlFor="d-end"><Input id="d-end" type="datetime-local" value={v.ends_at} onChange={(e) => set("ends_at", e.target.value)} /></Field>
            </div>
            <Field label="Pickup instructions" htmlFor="d-instr"><Textarea id="d-instr" rows={2} value={v.redemption_instructions} onChange={(e) => set("redemption_instructions", e.target.value)} placeholder="Show your voucher at the counter between 4 and 6 PM." /></Field>
          </Card>
        ) : null}

        {v.type === "appointment" ? (
          <Card title="Open time slots">
            <Field label="Duration" htmlFor="d-dur">
              <NativeSelect id="d-dur" value={v.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)}>
                {[15, 20, 30, 40, 45, 60, 75, 90, 120, 180].map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </NativeSelect>
            </Field>
            <div className="grid gap-2">
              {v.slots.map((s, i) => (
                <div key={s.id ?? i} className="grid grid-cols-[1fr_96px_40px] items-end gap-2">
                  <Field label={i === 0 ? "Date & time" : ""} htmlFor={`slot-${i}`}>
                    <Input id={`slot-${i}`} type="datetime-local" value={s.starts_at} disabled={!!s.claimed} onChange={(e) => set("slots", v.slots.map((x, j) => (j === i ? { ...x, starts_at: e.target.value } : x)))} />
                  </Field>
                  <Field label={i === 0 ? "Capacity" : ""} htmlFor={`cap-${i}`}>
                    <Input id={`cap-${i}`} inputMode="numeric" value={s.capacity} onChange={(e) => set("slots", v.slots.map((x, j) => (j === i ? { ...x, capacity: e.target.value.replace(/\D/g, "") } : x)))} />
                  </Field>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove slot ${i + 1}`} disabled={!!s.claimed || v.slots.length === 1}
                    onClick={() => set("slots", v.slots.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                  {s.claimed ? <p className="col-span-3 -mt-1 text-xs text-muted">{s.claimed} booked — time can&apos;t change</p> : null}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={v.slots.length >= 30}
                onClick={() => set("slots", [...v.slots, { starts_at: v.slots.at(-1)?.starts_at ?? "", capacity: "1" }])}>
                <Plus /> Add another time
              </Button>
            </div>
            <Field label="Booking conditions" htmlFor="d-cond"><Textarea id="d-cond" rows={2} value={v.restrictions} onChange={(e) => set("restrictions", e.target.value)} placeholder="24-hour cancellation policy. Removal of existing gel is $10 extra." /></Field>
            <Field label="Check-in instructions" htmlFor="d-instr2"><Textarea id="d-instr2" rows={2} value={v.redemption_instructions} onChange={(e) => set("redemption_instructions", e.target.value)} placeholder="Arrive 5 minutes early and show your voucher at the front desk." /></Field>
          </Card>
        ) : null}

        {v.type === "slow_hours" ? (
          <Card title="When it's valid">
            <fieldset disabled={locked}>
              <legend className="mb-2 text-sm font-semibold">Days</legend>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const on = v.recurring_days.includes(d);
                  return (
                    <button key={d} type="button" aria-pressed={on} onClick={() => set("recurring_days", on ? v.recurring_days.filter((x) => x !== d) : [...v.recurring_days, d])}
                      className={cn("h-10 w-12 rounded-full border text-sm font-semibold transition disabled:opacity-50", on ? "border-ink bg-ink text-white" : "border-line hover:border-ink")}>
                      {DAY_SHORT[d]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" htmlFor="d-ws"><Input id="d-ws" type="time" value={v.window_start} disabled={locked} onChange={(e) => set("window_start", e.target.value)} /></Field>
              <Field label="Until" htmlFor="d-we"><Input id="d-we" type="time" value={v.window_end} disabled={locked} onChange={(e) => set("window_end", e.target.value)} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date range starts" htmlFor="d-start2"><Input id="d-start2" type="datetime-local" value={v.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></Field>
              <Field label="Date range ends" htmlFor="d-end2"><Input id="d-end2" type="datetime-local" value={v.ends_at} onChange={(e) => set("ends_at", e.target.value)} /></Field>
            </div>
            <Field label="Total vouchers (optional)" htmlFor="d-qty2" hint="Leave blank for no limit."><Input id="d-qty2" inputMode="numeric" value={v.quantity_total} onChange={(e) => set("quantity_total", e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Limits and restrictions" htmlFor="d-restr"><Textarea id="d-restr" rows={2} value={v.restrictions} onChange={(e) => set("restrictions", e.target.value)} placeholder="Dine-in only. Excludes alcohol." /></Field>
            <Field label="Redemption instructions" htmlFor="d-instr3"><Textarea id="d-instr3" rows={2} value={v.redemption_instructions} onChange={(e) => set("redemption_instructions", e.target.value)} placeholder="Show your voucher before paying." /></Field>
          </Card>
        ) : null}

        <Card title="Limits">
          <Field label="Per customer" htmlFor="d-limit">
            <NativeSelect id="d-limit" value={v.per_customer_limit} onChange={(e) => set("per_customer_limit", Number(e.target.value))}>
              {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n} per customer</option>)}
            </NativeSelect>
          </Field>
          {v.type === "surplus" ? <Field label="Other restrictions" htmlFor="d-restr2"><Textarea id="d-restr2" rows={2} value={v.restrictions} onChange={(e) => set("restrictions", e.target.value)} placeholder="Contents vary. May contain nuts." /></Field> : null}
        </Card>

        <section className={cn("rounded-[var(--radius-card)] border p-5 transition-colors sm:p-6", v.is_exclusive ? "border-ink bg-ink text-white" : "border-line bg-white")}>
          <div className="flex items-start gap-4">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", v.is_exclusive ? "bg-lime text-ink" : "bg-lime-soft text-lime-ink")}>
              <Gem className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <label htmlFor="d-exclusive" className="block cursor-pointer text-lg font-extrabold">Make it a Frugal Center exclusive</label>
              <p className={cn("mt-1 text-sm", v.is_exclusive ? "text-white/75" : "text-muted")}>
                Only offer this deal through Frugal Center. Exclusives get an &ldquo;Exclusive&rdquo; badge and appear in the Exclusives section customers browse.
              </p>
            </div>
            <Switch id="d-exclusive" checked={v.is_exclusive} onCheckedChange={(on) => set("is_exclusive", on)} className={v.is_exclusive ? "data-[state=checked]:bg-white/20" : undefined} />
          </div>
        </section>

        {error ? <p className="rounded-xl bg-[#fde8e7] p-3 text-sm font-medium text-danger" role="alert">{error}</p> : null}

        <div className="sticky bottom-20 z-10 flex flex-wrap gap-2 rounded-2xl border border-line bg-white/95 p-3 shadow-[var(--shadow-lift)] backdrop-blur lg:bottom-4">
          <Dialog>
            <DialogTrigger asChild><Button type="button" variant="outline" className="xl:hidden"><Eye /> Preview</Button></DialogTrigger>
            <DialogContent title="Preview" description="How customers will see your deal card.">
              <div className="pointer-events-none"><DealCard deal={preview.card} signedIn={false} /></div>
            </DialogContent>
          </Dialog>
          {isPublished ? (
            <Button type="submit" className="ml-auto" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : null} Save changes</Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="ml-auto" disabled={pending} onClick={() => save("draft")}>Save draft</Button>
              <Button type="button" variant="lime" disabled={pending} onClick={() => save("publish")}>
                {pending ? <Loader2 className="animate-spin" /> : <Send />} {startsInFuture ? "Schedule" : "Publish now"}
              </Button>
            </>
          )}
        </div>
      </form>

      <aside className="hidden xl:block">
        <div className="sticky top-8">
          <p className="mb-3 text-sm font-bold text-muted">Live preview</p>
          <div className="pointer-events-none rounded-[var(--radius-card)] bg-white p-3 shadow-[var(--shadow-soft)]"><DealCard deal={preview.card} signedIn={false} /></div>
          <p className="mt-3 text-xs text-muted">Distance is shown from each customer&apos;s location.</p>
        </div>
      </aside>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
      <h2 className="text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function MoneyInput({ id, value, onChange, disabled }: { id: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="relative">
      <span className="absolute top-1/2 left-4 -translate-y-1/2 text-muted">$</span>
      <Input id={id} inputMode="decimal" value={value} disabled={disabled} className="pl-8" placeholder="0.00"
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 9))} />
    </div>
  );
}

function cents(s: string) {
  const n = Number(s);
  return Number.isFinite(n) && s !== "" ? Math.round(n * 100) : null;
}

function previewDeal(v: EditorValue, businessName: string, cover: string | null, timezone: string) {
  const fixed = v.type !== "slow_hours" || v.discount_kind === "fixed_price";
  const orig = cents(v.original_price);
  const price = cents(v.deal_price);
  const kind: DiscountKind = v.type === "slow_hours" ? v.discount_kind : "fixed_price";
  let badge: string | null = null;
  if (fixed && orig && price != null && price < orig) badge = `${Math.round(((orig - price) / orig) * 100)}% OFF · saves $${((orig - price) / 100).toFixed(2).replace(/\.00$/, "")}`;
  if (kind === "percent" && v.percent_off) badge = `${v.percent_off}% OFF`;
  if (kind === "amount_off" && v.amount_off) badge = `$${v.amount_off} OFF`;
  const safeDate = (s: string) => {
    try { return s ? zonedInputToDate(s, timezone) : new Date(Date.now() + 3 * 3600000); } catch { return new Date(Date.now() + 3 * 3600000); }
  };
  const slot = v.slots[0]?.starts_at ? safeDate(v.slots[0].starts_at) : null;
  const card: DealCardData = {
    id: "preview", type: v.type ?? "surplus", status: "published", title: v.title || "Your deal title", images: v.images,
    discount_kind: kind,
    original_price_cents: fixed ? (orig ?? 2000) : null, deal_price_cents: fixed ? (price ?? 1000) : null,
    percent_off: kind === "percent" ? Number(v.percent_off) || 20 : null, amount_off_cents: kind === "amount_off" ? cents(v.amount_off) ?? 500 : null,
    quantity_total: v.quantity_total ? Number(v.quantity_total) : null, claimed_count: 0,
    starts_at: safeDate(v.starts_at), ends_at: v.type === "slow_hours" ? new Date(Date.now() + 30 * 86400000) : safeDate(v.ends_at), published_at: new Date(),
    duration_minutes: Number(v.duration_minutes) || 60, recurring_days: v.recurring_days, window_start: v.window_start, window_end: v.window_end,
    business_id: "preview", business_name: businessName, business_slug: "", business_logo: null, business_cover: cover, category_slug: "food-drink",
    lat: 0, lng: 0, timezone, distance_miles: 0.6, next_slot_at: slot, slots_remaining: v.slots.reduce((n, s) => n + (Number(s.capacity) || 0), 0), is_favorite: false,
    is_exclusive: v.is_exclusive,
  };
  return { card, badge };
}
