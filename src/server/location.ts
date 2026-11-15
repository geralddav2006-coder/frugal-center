import "server-only";
import { cookies } from "next/headers";
import type { Viewer } from "./auth";
import { RADIUS_MILES } from "@/lib/utils";

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
  if (fromCookie) return fromCookie;
  if (viewer?.homeLat != null && viewer.homeLng != null) {
    return {
      lat: viewer.homeLat,
      lng: viewer.homeLng,
      label: viewer.homeLabel ?? "Home",
      zip: viewer.homeZip,
      radius: RADIUS_OPTIONS.includes(viewer.radius) ? viewer.radius : 10,
      source: "profile",
    };
  }
  return DEFAULT_LOCATION;
}

export async function writeLocationCookie(loc: Omit<ViewerLocation, "source"> & { source: "zip" | "gps" }) {
  (await cookies()).set(LOCATION_COOKIE, JSON.stringify(loc), {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
  });
}
