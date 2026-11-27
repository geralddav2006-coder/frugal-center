"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Crosshair, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setLocationAction } from "@/app/actions/customer";
import { areaLabel, cn, RADIUS_MILES } from "@/lib/utils";
import { MARKETS, nearestMarket } from "@/lib/markets";

export interface Area {
  zip: string;
  neighborhood: string;
  city: string;
  lat: number;
  lng: number;
}

export function LocationPicker({
  label,
  radius,
  areas,
  className,
  compact,
}: {
  label: string;
  radius: number;
  areas: Area[];
  className?: string;
  compact?: boolean | "tight";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [zip, setZip] = useState("");
  const [r, setR] = useState(radius);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [pending, start] = useTransition();

  const apply = (input: Parameters<typeof setLocationAction>[0]) =>
    start(async () => {
      setError(null);
      const res = await setLocationAction({ ...input, radius: r });
      if (!res.ok) return setError(res.error);
      toast.success(`Showing deals near ${res.label}`);
      setOpen(false);
      router.refresh();
    });

  const useGps = () => {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Your browser doesn't support location. Pick a town or enter a ZIP instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        apply({ lat: Number(pos.coords.latitude.toFixed(4)), lng: Number(pos.coords.longitude.toFixed(4)) });
      },
      (err) => {
        setLocating(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. No problem — pick a town or enter a ZIP below."
            : "We couldn't get your location. Pick a town or enter a ZIP below.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-full px-3 py-2 text-left text-sm font-semibold transition hover:bg-mist",
            className,
          )}
          aria-label={`Location: ${label}. Change location`}
        >
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span className={cn("truncate", compact === "tight" ? "max-w-[5.5rem] sm:max-w-[9.5rem]" : compact ? "max-w-[9.5rem]" : "max-w-[12rem]")}>{label}</span>
          <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent title="Where are you?" description="We'll show deals from businesses nearby.">
        <div className="grid gap-5">
          <Button variant="outline" size="lg" className="w-full justify-start" onClick={useGps} disabled={locating || pending}>
            {locating ? <Loader2 className="animate-spin" /> : <Crosshair />}
            Use my current location
          </Button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              apply({ zip });
            }}
          >
            <label htmlFor="zip" className="sr-only">ZIP code</label>
            <Input id="zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="ZIP code" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} />
            <Button type="submit" disabled={zip.length !== 5 || pending} className="h-12">Go</Button>
          </form>
          {error ? <p className="rounded-xl bg-[#fff4dc] p-3 text-sm font-medium text-warning" role="alert">{error}</p> : null}
          {MARKETS.map((m) => {
            const group = areas.filter((a) => nearestMarket(a).name === m.name);
            if (!group.length) return null;
            return (
              <div key={m.name}>
                <p className="mb-2 text-sm font-semibold">{m.name} & nearby towns</p>
                <div className="flex flex-wrap gap-2">
                  {group.map((a) => (
                    <button key={a.zip} type="button" disabled={pending} onClick={() => apply({ zip: a.zip })}
                      className="rounded-full border border-line px-3.5 py-2 text-sm font-medium hover:border-ink">
                      {areaLabel(a)} <span className="text-muted">{a.zip}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <div>
            <p className="mb-2 text-sm font-semibold">Search radius</p>
            <div className="flex gap-2" role="radiogroup" aria-label="Search radius">
              {RADIUS_MILES.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={r === m} onClick={() => setR(m)}
                  className={cn("h-10 flex-1 rounded-full border text-sm font-semibold transition", r === m ? "border-ink bg-ink text-white" : "border-line hover:border-ink")}>
                  {m} mi
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Radius applies the next time you pick a location.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
