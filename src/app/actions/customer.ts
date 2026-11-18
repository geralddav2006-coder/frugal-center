"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { getViewer } from "@/server/auth";
import { run, requireSignedIn } from "@/server/action";
import { DomainError } from "@/server/services/common";
import { claimDeal, cancelClaim } from "@/server/services/claims";
import {
  markNotificationsRead,
  reportListing,
  setFavorite,
  setFollow,
  setFollowNotify,
  updatePreferences,
  updateProfile,
  savePushSubscription,
  removePushSubscription,
  type Preferences,
} from "@/server/services/engagement";
import { enableSavingsShare, disableSavingsShare } from "@/server/services/savings";
import { RADIUS_OPTIONS, inMarket, writeLocationCookie } from "@/server/location";
import { areaLabel } from "@/lib/utils";
import { env } from "@/server/env";
import { SIGN_COOKIE } from "@/lib/promo";

export async function toggleFavoriteAction(dealId: string, save: boolean) {
  return run(async () => {
    const v = requireSignedIn(await getViewer());
    await setFavorite(await getDb(), v.id, dealId, save);
    revalidatePath("/my-deals");
    return { saved: save };
  });
}

export async function toggleFollowAction(businessId: string, follow: boolean) {
  return run(async () => {
    const v = requireSignedIn(await getViewer());
    // Credit the follow to the business's in-store sign if the viewer just scanned it.
    const jar = await cookies();
    const fromSign = follow && jar.get(SIGN_COOKIE)?.value === businessId;
    await setFollow(await getDb(), v.id, businessId, follow, fromSign ? "sign" : null);
    if (fromSign) jar.delete(SIGN_COOKIE);
    revalidatePath("/", "layout");
    return { following: follow };
  });
}

export async function setFollowNotifyAction(businessId: string, notify: boolean) {
  return run(async () => {
    const v = requireSignedIn(await getViewer());
    await setFollowNotify(await getDb(), v.id, businessId, notify);
    revalidatePath("/following");
    return { notify };
  });
}

export async function claimDealAction(dealId: string, slotId: string | null) {
  const result = await run(async () => {
    const v = requireSignedIn(await getViewer());
    return claimDeal(await getDb(), v.id, dealId, slotId);
  });
  if (result.ok) redirect(`/vouchers/${result.claimId}?new=1`);
  if (result.code === "already_claimed" && result.meta?.claimId) redirect(`/vouchers/${result.meta.claimId}`);
  return result;
}

export async function cancelClaimAction(claimId: string) {
  return run(async () => {
    const v = requireSignedIn(await getViewer());
    await cancelClaim(await getDb(), v.id, claimId);
    revalidatePath(`/vouchers/${claimId}`);
    revalidatePath("/my-deals");
    return {};
  });
}

export async function setLocationAction(input: { zip?: string; lat?: number; lng?: number; label?: string; radius?: number }) {
  return run(async () => {
    const db = await getDb();
    const radius = RADIUS_OPTIONS.includes(Number(input.radius)) ? Number(input.radius) : 10;
    let loc: { lat: number; lng: number; label: string; zip: string | null; source: "zip" | "gps" };
    if (input.zip) {
      const zip = input.zip.trim();
      if (!/^\d{5}$/.test(zip)) throw new DomainError("invalid", "Enter a 5-digit ZIP code.");
      const [area] = await db.query<{ lat: number; lng: number; neighborhood: string; city: string }>(`select * from public.launch_areas where zip = $1`, [zip]);
      if (!area) {
        throw new DomainError(
          "not_launched",
          "Frugal Center is starting in Dracut and nearby towns, and we're not in that ZIP yet. Pick a town from the list or use your current location.",
        );
      }
      loc = { lat: area.lat, lng: area.lng, label: areaLabel(area), zip, source: "zip" };
    } else if (typeof input.lat === "number" && typeof input.lng === "number" && Math.abs(input.lat) <= 90 && Math.abs(input.lng) <= 180) {
      if (!inMarket(input.lat, input.lng)) {
        throw new DomainError(
          "not_launched",
          "You're outside the area Frugal Center serves so far. It's starting in Dracut and nearby towns. Pick a town from the list to look around.",
        );
      }
      loc = { lat: input.lat, lng: input.lng, label: "Current location", zip: null, source: "gps" };
    } else {
      throw new DomainError("invalid", "Choose a location.");
    }
    await writeLocationCookie({ ...loc, radius });
    const v = await getViewer();
    if (v) {
      await updateProfile(db, v.id, {
        home_zip: loc.zip, home_label: loc.label, home_lat: loc.lat, home_lng: loc.lng, search_radius_miles: radius,
      });
    }
    revalidatePath("/", "layout");
    return { label: loc.label };
  });
}

export async function updatePreferencesAction(prefs: Preferences) {
  return run(async () => {
    const v = requireSignedIn(await getViewer());
    await updatePreferences(await getDb(), v.id, prefs);
    revalidatePath("/profile");
    return {};
  });
}

export async function updateNameAction(fullName: string) {
  return run(async () => {
    const v = requireSignedIn(await getViewer());
    if (fullName.trim().length < 2) throw new DomainError("invalid", "Enter your name.");
    await updateProfile(await getDb(), v.id, { full_name: fullName });
    revalidatePath("/profile");
    return {};
  });
}

export async function markNotificationsReadAction(id?: string) {
  return run(async () => {
    const v = requireSignedIn(await getViewer());
    await markNotificationsRead(await getDb(), v.id, id);
    revalidatePath("/", "layout");
    return {};
  });
}

export async function reportAction(input: { dealId?: string; businessId?: string; reason: string; details?: string }) {
  return run(async () => {
    const v = requireSignedIn(await getViewer());
    await reportListing(await getDb(), v.id, input);
    return {};
  });
}

export async function shareSavingsAction(enable: boolean) {
  return run(async () => {
    const v = requireSignedIn(await getViewer());
    const db = await getDb();
    if (!enable) {
      await disableSavingsShare(db, v.id);
      revalidatePath("/savings");
      return { url: null as string | null };
    }
    const token = await enableSavingsShare(db, v.id);
    revalidatePath("/savings");
    return { url: `${env.appUrl}/s/${token}` as string | null };
  });
}

export async function savePushSubscriptionAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  return run(async () => {
    const v = requireSignedIn(await getViewer());
    const db = await getDb();
    await savePushSubscription(db, v.id, sub);
    await db.query(`update public.notification_preferences set push_new_deals = true where user_id = $1`, [v.id]);
    revalidatePath("/profile");
    return {};
  });
}

export async function removePushSubscriptionAction(endpoint: string) {
  return run(async () => {
    const v = requireSignedIn(await getViewer());
    const db = await getDb();
    await removePushSubscription(db, v.id, endpoint);
    await db.query(`update public.notification_preferences set push_new_deals = false where user_id = $1`, [v.id]);
    revalidatePath("/profile");
    return {};
  });
}
