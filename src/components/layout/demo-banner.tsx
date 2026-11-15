"use client";
import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";

const KEY = "fc-demo-banner-dismissed";

function readDismissed() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function DemoBanner() {
  const stored = useSyncExternalStore(() => () => {}, readDismissed, () => true);
  const [dismissed, setDismissed] = useState(false);
  if (stored || dismissed) return null;
  return (
    <div className="relative bg-ink px-10 py-2 text-center text-[12.5px] font-medium text-white/90">
      <span className="mr-1.5 rounded bg-lime px-1.5 py-0.5 text-[10.5px] font-extrabold tracking-wide text-ink">DEMO</span>
      Local demo with sample Dracut, MA data. No real payments, emails or push notifications are sent.
      <button
        type="button"
        aria-label="Dismiss demo notice"
        className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full hover:bg-white/10"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(KEY, "1");
          } catch {}
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
