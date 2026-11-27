import "server-only";
import { cookies, headers } from "next/headers";
import type { Viewer } from "./auth";
import { RADIUS_MILES } from "@/lib/utils";
import { MARKETS, milesBetween, nearestMarket } from "@/lib/markets";

export interface ViewerLocation {
  lat: number;
  lng: number;
  label: string;
  zip: string | null;
  radius: number;
  source: "default" | "zip" | "gps" | "profile";
}

export const LOCATION_COOKIE = "fc_loc";
export const RADIUS_OPTIONS = RADIUS_MILES;

export const DEFAULT_LOCATION: ViewerLocation = {
  lat: 42.6708,
  lng: -71.3028,
  label: "Dracut Center",
  zip: "01826",
  radius: 10,
  source: "default",
};

/** Saved locations farther than this from every launch town (e.g. left over from an
 * earlier launch city) are ignored, so the app falls back to the nearest launch town. */
export const MARKET_RADIUS_MILES = 40;

export function inMarket(lat: number, lng: number) {
  return MARKETS.some((m) => milesBetween({ lat, lng }, m) <= MARKET_RADIUS_MILES);
}

/** First visit with no saved location: start at the launch town nearest the visitor's IP location (Vercel sets these headers). */
async function defaultLocation(): Promise<ViewerLocation> {
  const h = await headers();
  const lat = Number(h.get("x-vercel-ip-latitude")), lng = Number(h.get("x-vercel-ip-longitude"));
  if (!h.get("x-vercel-ip-latitude") || !Number.isFinite(lat) || !Number.isFinite(lng) || !inMarket(lat, lng)) return DEFAULT_LOCATION;
  const m = nearestMarket({ lat, lng });
  return { lat: m.lat, lng: m.lng, label: m.label, zip: m.zip, radius: DEFAULT_LOCATION.radius, source: "default" };
}

export function parseLocationCookie(raw: string | undefined): ViewerLocation | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (typeof v.lat !== "number" || typeof v.lng !== "number" || Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180) return null;
    return {
      lat: v.lat,
      lng: v.lng,
      label: String(v.label ?? "Your location").slice(0, 60),
      zip: typeof v.zip === "string" ? v.zip : null,
      radius: RADIUS_OPTIONS.includes(v.radius) ? v.radius : 10,
      source: v.source === "gps" ? "gps" : "zip",
    };
  } catch {
    return null;
  }
}

export async function getViewerLocation(viewer: Viewer | null): Promise<ViewerLocation> {
  const fromCookie = parseLocationCookie((await cookies()).get(LOCATION_COOKIE)?.value);
  if (fromCookie && inMarket(fromCookie.lat, fromCookie.lng)) return fromCookie;
  if (viewer?.homeLat != null && viewer.homeLng != null && inMarket(viewer.homeLat, viewer.homeLng)) {
    return {
      lat: viewer.homeLat,
      lng: viewer.homeLng,
      label: viewer.homeLabel ?? "Home",
      zip: viewer.homeZip,
      radius: RADIUS_OPTIONS.includes(viewer.radius) ? viewer.radius : 10,
      source: "profile",
    };
  }
  return defaultLocation();
}

export async function writeLocationCookie(loc: Omit<ViewerLocation, "source"> & { source: "zip" | "gps" }) {
  (await cookies()).set(LOCATION_COOKIE, JSON.stringify(loc), {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
  });
}
