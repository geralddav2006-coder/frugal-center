"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crosshair, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { dismissWelcomeAction, reopenWelcomeAction, saveInterestsAction, setLocationAction } from "@/app/actions/customer";
import { LocationPicker, type Area } from "@/components/layout/location-picker";
import { Button } from "@/components/ui/button";
import { INTERESTS } from "@/lib/interests";
import { cn } from "@/lib/utils";

/**
 * First visit only: confirm where they are and what they're into, so the feed fits them right away.
 * Nothing is required: they can skip, and no account is needed.
 */
export function WelcomeCard({ label, radius, areas, initialPicks, className }: { label: string; radius: number; areas: Area[]; initialPicks: string[]; className?: string }) {
  const router = useRouter();
  const [picks, setPicks] = useState<string[]>(initialPicks);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (slug: string) => setPicks((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]));

  const useExactLocation = () => {
    setError(null);
    if (!("geolocation" in navigator)) return setError("Your browser can't share your location. Pick your town instead.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => start(async () => {
        const res = await setLocationAction({ lat: Number(pos.coords.latitude.toFixed(4)), lng: Number(pos.coords.longitude.toFixed(4)), radius });
        setLocating(false);
        if (!res.ok) return setError(res.error);
        toast.success("Showing deals closest to you");
        router.refresh();
      }),
      (err) => {
        setLocating(false);
        setError(err.code === err.PERMISSION_DENIED ? "No problem. Pick your town instead." : "We couldn't find you. Pick your town instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const save = () => start(async () => {
    await saveInterestsAction(picks);
    if (picks.length) toast.success("Your picks are first now");
    router.refresh();
  });
  const skip = () => start(async () => {
    await dismissWelcomeAction();
    router.refresh();
  });

  return (
    <section aria-labelledby="welcome-h" className={cn("rounded-[24px] border border-line bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="welcome-h" className="text-xl font-extrabold">Welcome to Frugal Center 👋</h2>
          <p className="mt-1 text-[15px] text-muted">Two quick taps and we&apos;ll show the deals that fit you.</p>
        </div>
        <button type="button" onClick={skip} disabled={pending} aria-label="Skip" className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink">
          <X className="size-5" />
        </button>
      </div>

      <div className="mt-5">
        <p className="text-sm font-bold">Where are you?</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <LocationPicker label={label} radius={radius} areas={areas} className="rounded-full border border-line px-3" />
          <Button type="button" variant="outline" size="sm" onClick={useExactLocation} disabled={locating || pending}>
            {locating ? <Loader2 className="animate-spin" /> : <Crosshair />} Use my exact location
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm font-medium text-warning" role="alert">{error}</p> : null}
      </div>

      <div className="mt-5">
        <p className="text-sm font-bold">What are you into? <span className="font-medium text-muted">Tap any</span></p>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const on = picks.includes(i.slug);
            return (
              <button key={i.slug} type="button" aria-pressed={on} onClick={() => toggle(i.slug)}
                className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition",
                  on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}>
                <span aria-hidden>{i.emoji}</span> {i.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="button" variant="lime" size="lg" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Show my deals
        </Button>
        <button type="button" onClick={skip} disabled={pending} className="text-sm font-semibold text-muted hover:text-ink">Skip for now</button>
      </div>
    </section>
  );
}

/** After the welcome card: what's being shown first, with a way to change it. */
export function PicksLine({ picks }: { picks: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const chosen = INTERESTS.filter((i) => picks.includes(i.slug));
  if (!chosen.length) return null;
  return (
    <p className="mx-4 mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted sm:mx-6 lg:mx-8">
      <span className="font-semibold text-ink">Your picks first:</span>
      {chosen.map((i) => <span key={i.slug}>{i.emoji} {i.label}</span>)}
      <button type="button" disabled={pending} onClick={() => start(async () => { await reopenWelcomeAction(); router.refresh(); })}
        className="font-bold text-lime-ink hover:underline">Change</button>
    </p>
  );
}
