import type { Metadata } from "next";
import Link from "next/link";
import { Bell, PiggyBank, Sparkles } from "lucide-react";
import { requireViewer } from "@/server/auth";
import { getDb } from "@/server/db";
import { listNotifications } from "@/server/services/notify";
import { relativeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { MarkAllRead } from "./mark-read";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const viewer = await requireViewer("/notifications");
  const items = await listNotifications(await getDb(), viewer.id);
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold">Notifications</h1>
        {unread ? <MarkAllRead /> : null}
      </div>
      {items.length ? (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={n.url ?? "/"} className={cn("flex gap-4 p-4 transition hover:bg-paper", !n.read_at && "bg-lime-soft/50")}>
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", n.type === "voucher_redeemed" ? "bg-lime" : "bg-mist")}>
                  {n.type === "voucher_redeemed" ? <PiggyBank className="size-5" aria-hidden /> : n.type === "new_deal" ? <Sparkles className="size-5" aria-hidden /> : <Bell className="size-5" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{n.title}</p>
                  {n.body ? <p className="text-[15px] text-ink/80">{n.body}</p> : null}
                  <p className="mt-1 text-xs text-muted">{relativeAgo(n.created_at)}</p>
                </div>
                {!n.read_at ? <span className="mt-2 size-2.5 shrink-0 rounded-full bg-ink" aria-label="Unread" /> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-6" icon={<Bell />} title="You're all caught up" action={<Link className="font-semibold underline-offset-4 hover:underline" href="/following">Follow businesses</Link>}>
          Follow businesses to hear about new deals as soon as they&apos;re posted.
        </EmptyState>
      )}
    </div>
  );
}
