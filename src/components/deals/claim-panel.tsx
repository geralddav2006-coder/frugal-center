"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { claimDealAction } from "@/app/actions/customer";
import { formatDay, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface SlotOption {
  id: string;
  startsAt: string;
  left: number;
  past: boolean;
}

export function ClaimPanel({
  dealId,
  isAppointment,
  slots,
  timezone,
  durationMinutes,
  state,
  activeClaimId,
  signedIn,
  isMember,
  priceHeadline,
  priceOriginal,
  savingsLabel,
  compact,
  demoHref,
}: {
  dealId: string;
  isAppointment: boolean;
  slots: SlotOption[];
  timezone: string;
  durationMinutes: number | null;
  state: { claimable: boolean; reason: string | null };
  activeClaimId: string | null;
  signedIn: boolean;
  isMember: boolean;
  priceHeadline: string;
  priceOriginal: string | null;
  savingsLabel: string | null;
  compact?: boolean;
  /** On an owner's private preview: claiming opens a demo voucher instead (nothing is really claimed). */
  demoHref?: string;
}) {
  const available = slots.filter((s) => !s.past && s.left > 0);
  const [slotId, setSlotId] = useState<string | null>(available[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const cta = (() => {
    if (demoHref) {
      return (
        <Button asChild size="lg" variant="lime" className="w-full">
          <Link href={isAppointment && slotId ? `${demoHref}?slot=${slotId}` : demoHref}>Claim Deal (demo)</Link>
        </Button>
      );
    }
    if (activeClaimId) {
      return (
        <Button asChild size="lg" variant="default" className="w-full">
          <Link href={`/vouchers/${activeClaimId}`}><Ticket /> View your voucher</Link>
        </Button>
      );
    }
    if (isMember) {
      return <Button size="lg" variant="secondary" className="w-full" disabled>This is your business</Button>;
    }
    if (!state.claimable) {
      return <Button size="lg" variant="secondary" className="w-full" disabled>{state.reason ?? "Unavailable"}</Button>;
    }
    if (!signedIn) {
      return (
        <Button asChild size="lg" variant="lime" className="w-full">
          <Link href={`/login?next=${encodeURIComponent(`/deals/${dealId}`)}`}>Claim Deal</Link>
        </Button>
      );
    }
    return (
      <Button
        size="lg"
        variant="lime"
        className="w-full text-[17px] font-extrabold"
        disabled={pending || (isAppointment && !slotId)}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await claimDealAction(dealId, isAppointment ? slotId : null);
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Claiming…" : "Claim Deal"}
      </Button>
    );
  })();

  return (
    <div className="grid gap-4">
      {!compact ? (
        <div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl font-extrabold tracking-tight">{priceHeadline}</span>
            {priceOriginal ? <span className="text-lg text-muted line-through">{priceOriginal}</span> : null}
          </div>
          {savingsLabel ? <p className="mt-1 inline-block rounded-md bg-lime-soft px-2 py-0.5 text-sm font-bold text-lime-ink">{savingsLabel}</p> : null}
        </div>
      ) : null}

      {isAppointment && !compact ? (
        <fieldset>
          <legend className="mb-2 text-sm font-bold">Choose a time</legend>
          {slots.length === 0 ? <p className="text-sm text-muted">No times listed.</p> : null}
          <div className="grid grid-cols-2 gap-2">
            {slots.map((s) => {
              const disabled = s.past || s.left <= 0 || (!state.claimable && !demoHref);
              return (
                <label
                  key={s.id}
                  className={cn(
                    "cursor-pointer rounded-xl border p-3 text-left transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink",
                    slotId === s.id && !disabled ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                    disabled && "cursor-not-allowed opacity-45 hover:border-line",
                  )}
                >
                  <input type="radio" name="slot" value={s.id} className="sr-only" disabled={disabled} checked={slotId === s.id} onChange={() => setSlotId(s.id)} />
                  <span className="block text-xs font-semibold opacity-75">{formatDay(s.startsAt, timezone)}</span>
                  <span className="block text-[15px] font-bold">{formatTime(s.startsAt, timezone)}</span>
                  <span className="block text-xs opacity-75">
                    {s.past ? "Passed" : s.left <= 0 ? "Booked" : `${durationMinutes ?? 60} min · ${s.left} ${s.left === 1 ? "spot" : "spots"}`}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {cta}
      {error ? <p className="rounded-xl bg-[#fde8e7] p-3 text-sm font-medium text-danger" role="alert">{error}</p> : null}
      {!compact ? (
        <p className="text-center text-xs text-muted">Free to claim. You pay the business directly when you redeem.</p>
      ) : null}
    </div>
  );
}
