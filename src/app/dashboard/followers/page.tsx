import { BellOff, Users } from "lucide-react";
import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { listFollowers } from "@/server/services/merchant";
import { formatDate } from "@/lib/time";
import { privateName } from "@/lib/utils";
import { requestTime } from "@/lib/request-time";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Followers" };

export default async function FollowersPage() {
  const { membership } = await requireBusiness("/dashboard/followers", ["owner", "manager"]);
  const followers = await listFollowers(await getDb(), membership.business_id);
  const notifying = followers.filter((f) => f.notify).length;
  const recent = followers.filter((f) => requestTime() - new Date(f.created_at).getTime() < 30 * 86400000).length;
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Followers</h1>
      <p className="mt-1 text-muted">People who follow {membership.name}. They&apos;re notified when you publish a new deal (if they opted in).</p>
      <section className="mt-6 grid grid-cols-3 gap-3">
        {[["Followers", followers.length], ["Get notifications", notifying], ["New in 30 days", recent]].map(([k, v]) => (
          <div key={k} className="rounded-[var(--radius-card)] border border-line bg-white p-4">
            <p className="text-2xl font-extrabold tabular">{v}</p>
            <p className="text-[13px] font-semibold text-muted">{k}</p>
          </div>
        ))}
      </section>
      {followers.length ? (
        <ul className="mt-6 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {followers.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-[15px]">
              <span className="font-semibold">{privateName(f.full_name)}</span>
              <span className="flex items-center gap-3 text-sm text-muted">
                {!f.notify ? <span className="flex items-center gap-1"><BellOff className="size-3.5" aria-hidden /> Muted</span> : null}
                Since {formatDate(f.created_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-6" icon={<Users />} title="No followers yet">Share your profile link with regulars — followers hear about every new deal first.</EmptyState>
      )}
      <p className="mt-4 text-xs text-muted">For privacy, customers&apos; contact details are never shared with businesses.</p>
    </div>
  );
}
