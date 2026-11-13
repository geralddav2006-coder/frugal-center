import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db, Queryable } from "../db/types";
import { env, integrations, sessionSecret } from "../env";
import { priceDisplay, type PricingFields } from "@/lib/deals";
import { LIVE_DEAL_SQL } from "./discovery";

// Anti-spam caps for outbound channels. In-app notifications are deduped per deal.
const MAX_EMAILS_PER_BUSINESS_PER_DAY = 2;
const MAX_PUSH_PER_DAY = 5;

// ---------------------------------------------------------------------------
// Unsubscribe tokens (HMAC, no login required, one click from the email)
// ---------------------------------------------------------------------------
function sign(value: string) {
  return createHmac("sha256", Buffer.from(sessionSecret())).update(`unsub:${value}`).digest("base64url");
}

export function unsubscribeUrl(userId: string, businessId?: string, oneClick = false) {
  const scope = businessId ? `${userId}.${businessId}` : userId;
  return `${env.appUrl}${oneClick ? "/api/unsubscribe" : "/unsubscribe"}?s=${encodeURIComponent(scope)}&sig=${sign(scope)}`;
}

export function verifyUnsubscribe(scope: string, sig: string) {
  const expected = Buffer.from(sign(scope));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const [userId, businessId] = scope.split(".");
  return { userId: userId!, businessId: businessId ?? null };
}

export async function applyUnsubscribe(q: Queryable, userId: string, businessId: string | null) {
  if (businessId) {
    await q.query(`update public.follows set notify = false where user_id = $1 and business_id = $2`, [userId, businessId]);
  } else {
    await q.query(
      `update public.notification_preferences set email_new_deals = false, updated_at = now() where user_id = $1`,
      [userId],
    );
  }
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------
export async function sendEmail(args: { to: string; subject: string; html: string; text: string; unsubscribe?: string }) {
  if (!integrations.resend) return { status: "not_configured" as const };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
        headers: args.unsubscribe
          ? { "List-Unsubscribe": `<${args.unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
          : undefined,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { status: "failed" as const, error: body.message ?? `HTTP ${res.status}` };
    return { status: "sent" as const, id: body.id };
  } catch (err) {
    return { status: "failed" as const, error: (err as Error).message };
  }
}

async function sendPush(q: Queryable, userId: string, payload: { title: string; body: string; url: string }) {
  if (!integrations.push) return 0;
  const subs = await q.query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
    `select id, endpoint, p256dh, auth from public.push_subscriptions where user_id = $1`,
    [userId],
  );
  if (!subs.length) return 0;
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey!, env.vapidPrivateKey!);
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 3600 },
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await q.query(`delete from public.push_subscriptions where id = $1`, [s.id]);
      }
    }
  }
  return sent;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function newDealEmail(a: { businessName: string; title: string; price: string; url: string; unsubAll: string; unsubBiz: string }) {
  const html = `<!doctype html><html><body style="margin:0;background:#FAFAF7;font-family:Helvetica,Arial,sans-serif;color:#191919">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid #F0F1ED" cellpadding="0" cellspacing="0">
  <tr><td style="padding:28px 28px 8px"><div style="display:inline-block;width:36px;height:36px;border-radius:8px;background:#5CE65C"></div></td></tr>
  <tr><td style="padding:8px 28px 0;font-size:14px;color:#6B6E66">New from ${escapeHtml(a.businessName)}</td></tr>
  <tr><td style="padding:6px 28px 0;font-size:24px;font-weight:800;line-height:1.2">${escapeHtml(a.title)}</td></tr>
  <tr><td style="padding:10px 28px 0;font-size:16px;font-weight:700">${escapeHtml(a.price)}</td></tr>
  <tr><td style="padding:24px 28px"><a href="${a.url}" style="display:inline-block;background:#191919;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">View deal</a></td></tr>
  <tr><td style="padding:0 28px 28px;font-size:12px;color:#6B6E66;line-height:1.6">
  You're receiving this because you follow ${escapeHtml(a.businessName)} on Frugal Center.<br>
  <a href="${a.unsubBiz}" style="color:#6B6E66">Mute ${escapeHtml(a.businessName)}</a> · <a href="${a.unsubAll}" style="color:#6B6E66">Unsubscribe from deal emails</a>
  </td></tr></table></td></tr></table></body></html>`;
  const text = `New from ${a.businessName}: ${a.title} (${a.price})\n\nView deal: ${a.url}\n\nMute ${a.businessName}: ${a.unsubBiz}\nUnsubscribe from deal emails: ${a.unsubAll}`;
  return { html, text };
}

// ---------------------------------------------------------------------------
// Fan-out
// ---------------------------------------------------------------------------
export interface DispatchResult {
  dealId: string;
  inApp: number;
  emails: { sent: number; notConfigured: number; failed: number; capped: number };
  push: number;
}

/**
 * Notify opted-in followers that a deal is live. Idempotent: the deal is
 * atomically marked as notified first, so concurrent or repeated calls (publish
 * action, cron, retries) never send twice. Drafts, paused, scheduled-but-not-
 * started, expired, sold-out and moderated deals are never announced.
 */
export async function dispatchNewDeal(db: Db, dealId: string): Promise<DispatchResult | null> {
  const [deal] = await db.query(
    `update public.deals d set followers_notified_at = now()
     from public.businesses b
     where d.id = $1 and b.id = d.business_id and d.followers_notified_at is null and ${LIVE_DEAL_SQL}
     returning d.id, d.title, d.business_id, d.discount_kind, d.original_price_cents, d.deal_price_cents,
               d.percent_off, d.amount_off_cents, b.name as business_name`,
    [dealId],
  );
  if (!deal) return null;

  const price = priceDisplay(deal as unknown as PricingFields);
  const priceLine = price.original ? `${price.headline} instead of ${price.original} · ${price.badge}` : price.badge;
  const url = `/deals/${deal.id}`;
  const result: DispatchResult = {
    dealId,
    inApp: 0,
    emails: { sent: 0, notConfigured: 0, failed: 0, capped: 0 },
    push: 0,
  };

  const followers = await db.query(
    `select f.user_id, u.email, np.in_app_new_deals, np.email_new_deals, np.push_new_deals, np.max_emails_per_day
     from public.follows f
     join public.notification_preferences np on np.user_id = f.user_id
     join auth.users u on u.id = f.user_id
     where f.business_id = $1 and f.notify = true
       and not exists (select 1 from public.business_members m where m.business_id = f.business_id and m.user_id = f.user_id)`,
    [deal.business_id],
  );

  for (const f of followers) {
    if (f.in_app_new_deals) {
      const rows = await db.query(
        `insert into public.notifications (user_id, type, title, body, url, business_id, deal_id)
         values ($1, 'new_deal', $2, $3, $4, $5, $6) on conflict do nothing returning id`,
        [f.user_id, `${deal.business_name} posted a new deal`, `${deal.title} — ${priceLine}`, url, deal.business_id, deal.id],
      );
      result.inApp += rows.length;
    }

    if (f.email_new_deals && f.email) {
      const [caps] = await db.query<{ total: number; biz: number }>(
        `select count(*)::int as total,
                count(*) filter (where o.deal_id in (select id from public.deals where business_id = $2))::int as biz
         from public.email_outbox o
         where o.user_id = $1 and o.kind = 'new_deal' and o.created_at > now() - interval '24 hours'`,
        [f.user_id, deal.business_id],
      );
      if (caps!.total >= f.max_emails_per_day || caps!.biz >= MAX_EMAILS_PER_BUSINESS_PER_DAY) {
        result.emails.capped++;
      } else {
        const subject = `${deal.business_name}: ${deal.title}`;
        // Reserve the outbox row first (unique per user+deal) so retries can't double-send.
        const reserved = await db.query<{ id: string }>(
          `insert into public.email_outbox (user_id, kind, to_email, subject, deal_id, status)
           values ($1, 'new_deal', $2, $3, $4, 'not_configured') on conflict do nothing returning id`,
          [f.user_id, f.email, subject, deal.id],
        );
        if (reserved.length) {
          const unsubAll = unsubscribeUrl(f.user_id);
          const mail = newDealEmail({
            businessName: deal.business_name,
            title: deal.title,
            price: priceLine,
            url: `${env.appUrl}${url}`,
            unsubAll,
            unsubBiz: unsubscribeUrl(f.user_id, deal.business_id),
          });
          const sent = await sendEmail({ to: f.email, subject, ...mail, unsubscribe: unsubscribeUrl(f.user_id, undefined, true) });
          await db.query(
            `update public.email_outbox set status = $2, provider_message_id = $3, error = $4 where id = $1`,
            [reserved[0]!.id, sent.status, "id" in sent ? sent.id : null, "error" in sent ? sent.error : null],
          );
          if (sent.status === "sent") result.emails.sent++;
          else if (sent.status === "failed") result.emails.failed++;
          else result.emails.notConfigured++;
        }
      }
    }

    if (f.push_new_deals && integrations.push) {
      const [pc] = await db.query<{ n: number }>(
        `select count(*)::int as n from public.rate_limit_events where key = $1 and created_at > now() - interval '24 hours'`,
        [`push:${f.user_id}`],
      );
      if (pc!.n < MAX_PUSH_PER_DAY) {
        const n = await sendPush(db, f.user_id, {
          title: `${deal.business_name} posted a new deal`,
          body: `${deal.title} — ${priceLine}`,
          url,
        });
        if (n) {
          await db.query(`insert into public.rate_limit_events (key) values ($1)`, [`push:${f.user_id}`]);
          result.push += n;
        }
      }
    }
  }
  return result;
}

/** Announce deals whose scheduled start time has arrived. Safe to call often. */
export async function dispatchDueDeals(db: Db) {
  const due = await db.query<{ id: string }>(
    `select d.id from public.deals d join public.businesses b on b.id = d.business_id
     where d.followers_notified_at is null and ${LIVE_DEAL_SQL}
     order by d.starts_at limit 50`,
  );
  const results: DispatchResult[] = [];
  for (const d of due) {
    const r = await dispatchNewDeal(db, d.id);
    if (r) results.push(r);
  }
  return results;
}

export async function listNotifications(q: Queryable, userId: string, limit = 50) {
  return q.query<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    url: string | null;
    read_at: Date | null;
    created_at: Date;
    business_logo: string | null;
  }>(
    `select n.id, n.type, n.title, n.body, n.url, n.read_at, n.created_at, b.logo_url as business_logo
     from public.notifications n left join public.businesses b on b.id = n.business_id
     where n.user_id = $1 order by n.created_at desc limit $2`,
    [userId, limit],
  );
}

export async function unreadCount(q: Queryable, userId: string) {
  const [r] = await q.query<{ n: number }>(
    `select count(*)::int as n from public.notifications where user_id = $1 and read_at is null`,
    [userId],
  );
  return r?.n ?? 0;
}
