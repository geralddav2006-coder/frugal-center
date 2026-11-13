"use client";
import { useSyncExternalStore } from "react";

let current = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 15000);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Current time that ticks every 15s on the client; null during SSR (avoids hydration mismatches). */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
