"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createBusinessAction, updateBusinessAction } from "@/app/actions/merchant";
import { CATEGORIES } from "@/lib/deals";
import { DAY_NAMES } from "@/lib/time";
import { cn } from "@/lib/utils";
import { SingleImageUpload } from "./image-upload";
import { PinPicker } from "./pin-picker";

const DAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

import { DAY_KEYS, type BusinessFormValue } from "./business-defaults";
export type { BusinessFormValue };

const STEPS = ["Basics", "Location", "Hours", "Photos"];

export function BusinessForm({
  mode,
  initial,
  areas,
}: {
  mode: "onboarding" | "edit";
  initial: BusinessFormValue;
  areas: { zip: string; lat: number; lng: number; neighborhood: string }[];
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof BusinessFormValue>(k: K, val: BusinessFormValue[K]) => setV((x) => ({ ...x, [k]: val }));
  const area = areas.find((a) => a.zip === v.zip);
  const pin = useMemo(() => (v.lat != null && v.lng != null ? { lat: v.lat, lng: v.lng } : area ? { lat: area.lat, lng: area.lng } : null), [v.lat, v.lng, area]);
  const onboarding = mode === "onboarding";

  const stepValid = [
    v.name.trim().length >= 2 && !!v.category_slug,
    v.address_line.trim().length >= 3 && v.city.trim().length >= 2 && v.state.trim().length === 2 && /^\d{5}$/.test(v.zip),
    true,
    true,
  ];

  const submit = () =>
    start(async () => {
      setError(null);
      const payload = { ...v, lat: pin?.lat ?? null, lng: pin?.lng ?? null } as unknown as Parameters<typeof createBusinessAction>[0];
      const res = onboarding ? await createBusinessAction(payload) : await updateBusinessAction(payload);
      if (res && !res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      if (!onboarding) {
        toast.success("Business profile saved");
        router.refresh();
      }
    });

  const sections = [
    <div key="basics" className="grid gap-5">
      <Field label="Business name" htmlFor="b-name">
        <Input id="b-name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="Main Street Bakery" required />
      </Field>
      <Field label="Category" htmlFor="b-cat">
        <NativeSelect id="b-cat" value={v.category_slug} onChange={(e) => set("category_slug", e.target.value)} required>
          <option value="" disabled>Choose a category</option>
          {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Description" htmlFor="b-desc" hint="What makes your place great? Shown on your public profile.">
        <Textarea id="b-desc" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={1000} rows={4} />
      </Field>
    </div>,
    <div key="location" className="grid gap-5">
      <Field label="Street address" htmlFor="b-addr">
        <Input id="b-addr" value={v.address_line} onChange={(e) => set("address_line", e.target.value)} autoComplete="street-address" placeholder="412 Congress Ave" />
      </Field>
      <div className="grid grid-cols-[1fr_80px_110px] gap-3">
        <Field label="City" htmlFor="b-city"><Input id="b-city" value={v.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" /></Field>
        <Field label="State" htmlFor="b-state"><Input id="b-state" value={v.state} maxLength={2} onChange={(e) => set("state", e.target.value.toUpperCase())} autoComplete="address-level1" /></Field>
        <Field label="ZIP" htmlFor="b-zip"><Input id="b-zip" inputMode="numeric" value={v.zip} maxLength={5} onChange={(e) => { set("zip", e.target.value.replace(/\D/g, "")); set("lat", null); set("lng", null); }} autoComplete="postal-code" /></Field>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-semibold">Map location</p>
        {pin ? (
          <>
            <PinPicker lat={pin.lat} lng={pin.lng} onChange={(p) => setV((x) => ({ ...x, lat: p.lat, lng: p.lng }))} />
            <p className="mt-1.5 text-[13px] text-muted">Drag the pin or tap the map to mark your exact entrance. Customers use this for distance and directions.</p>
          </>
        ) : (
          <p className="rounded-xl bg-paper p-3 text-sm text-muted">Enter a ZIP code to place your business on the map. During our Austin launch we support {areas.map((a) => a.zip).join(", ")}.</p>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone" htmlFor="b-phone"><Input id="b-phone" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" /></Field>
        <Field label="Public email" htmlFor="b-email"><Input id="b-email" type="email" value={v.contact_email} onChange={(e) => set("contact_email", e.target.value)} /></Field>
      </div>
      <Field label="Website" htmlFor="b-web"><Input id="b-web" value={v.website} onChange={(e) => set("website", e.target.value)} placeholder="yourbusiness.com" /></Field>
    </div>,
    <div key="hours" className="divide-y divide-line rounded-2xl border border-line">
      {DAY_KEYS.map((d) => {
        const h = v.hours[d];
        return (
          <div key={d} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="w-24 font-semibold">{DAY_NAMES[DAY_INDEX[d]]}</span>
            <Switch checked={!!h} aria-label={`Open on ${DAY_NAMES[DAY_INDEX[d]]}`} onCheckedChange={(on) => set("hours", { ...v.hours, [d]: on ? { open: "09:00", close: "18:00" } : null })} />
            {h ? (
              <div className="ml-auto flex items-center gap-2">
                <input type="time" aria-label={`${d} opening time`} value={h.open} onChange={(e) => set("hours", { ...v.hours, [d]: { ...h, open: e.target.value } })} className="h-10 rounded-lg border border-line px-2 text-sm" />
                <span className="text-muted">–</span>
                <input type="time" aria-label={`${d} closing time`} value={h.close} onChange={(e) => set("hours", { ...v.hours, [d]: { ...h, close: e.target.value } })} className="h-10 rounded-lg border border-line px-2 text-sm" />
              </div>
            ) : <span className="ml-auto text-sm text-muted">Closed</span>}
          </div>
        );
      })}
    </div>,
    <div key="photos" className="grid gap-5 sm:grid-cols-[160px_1fr]">
      <div>
        <p className="mb-1.5 text-sm font-semibold">Logo</p>
        <SingleImageUpload value={v.logo_url} onChange={(u) => set("logo_url", u)} folder="logos" label="Logo" aspect="aspect-square" />
      </div>
      <div>
        <p className="mb-1.5 text-sm font-semibold">Cover photo</p>
        <SingleImageUpload value={v.cover_url} onChange={(u) => set("cover_url", u)} folder="covers" label="Cover photo" />
      </div>
      <p className="text-sm text-muted sm:col-span-2">JPG, PNG or WebP up to 5 MB. Bright, wide photos of your storefront or products work best. You can add these later.</p>
    </div>,
  ];

  if (!onboarding) {
    return (
      <form className="grid gap-8" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {STEPS.map((title, i) => (
          <section key={title} className="rounded-[var(--radius-card)] border border-line p-5 sm:p-6">
            <h2 className="mb-5 text-lg font-extrabold">{title}</h2>
            {sections[i]}
          </section>
        ))}
        {error ? <p className="rounded-xl bg-[#fde8e7] p-3 text-sm font-medium text-danger" role="alert">{error}</p> : null}
        <div className="sticky bottom-20 z-10 md:bottom-4">
          <Button type="submit" size="lg" className="w-full shadow-[var(--shadow-lift)] sm:w-auto" disabled={pending || !stepValid[0] || !stepValid[1]}>
            {pending ? <Loader2 className="animate-spin" /> : <Check />} Save changes
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <ol className="mb-8 flex gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={cn("h-1.5 rounded-full transition-colors", i <= step ? "bg-ink" : "bg-mist")} />
            <p className={cn("mt-2 text-xs font-semibold", i === step ? "text-ink" : "text-muted")} aria-current={i === step ? "step" : undefined}>{s}</p>
          </li>
        ))}
      </ol>
      <h2 className="mb-5 text-2xl font-extrabold">{["Tell us about your business", "Where can customers find you?", "When are you open?", "Add some photos"][step]}</h2>
      {sections[step]}
      {error ? <p className="mt-5 rounded-xl bg-[#fde8e7] p-3 text-sm font-medium text-danger" role="alert">{error}</p> : null}
      <div className="mt-8 flex gap-3">
        {step > 0 ? <Button type="button" variant="outline" size="lg" onClick={() => setStep(step - 1)}><ArrowLeft /> Back</Button> : null}
        {step < STEPS.length - 1 ? (
          <Button type="button" size="lg" className="ml-auto" disabled={!stepValid[step]} onClick={() => setStep(step + 1)}>Continue <ArrowRight /></Button>
        ) : (
          <Button type="button" size="lg" variant="lime" className="ml-auto" disabled={pending} onClick={submit}>
            {pending ? <Loader2 className="animate-spin" /> : null} Create business
          </Button>
        )}
      </div>
    </div>
  );
}
