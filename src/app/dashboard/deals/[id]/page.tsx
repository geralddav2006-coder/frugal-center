import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";
import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { getMerchantBusiness, getMerchantDeal } from "@/server/services/merchant";
import { formatDateTime } from "@/lib/time";
import { DealEditor } from "@/components/merchant/deal-editor";
import { editorValueFromDeal } from "@/components/merchant/editor-values";
import { DealActions } from "@/components/merchant/deal-actions";
import { DealStateBadge } from "@/components/merchant/deal-state-badge";
import { FlashToast } from "@/components/welcome-toast";
import { Suspense } from "react";

export const metadata = { title: "Deal" };

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { viewer, membership } = await requireBusiness(`/dashboard/deals/${id}`);
  const db = await getDb();
  const deal = await getMerchantDeal(db, viewer.id, id);
  if (!deal || deal.business_id !== membership.business_id) notFound();
  const biz = await getMerchantBusiness(db, membership.business_id);
  const canEdit = membership.role !== "staff";
  const tz = biz.timezone;

  return (
    <div>
      <Suspense><FlashToast param="duplicated" message="Copied as a new draft. Review the dates, then publish." /></Suspense>
      <Link href="/dashboard/deals" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> All deals</Link>
      <div className="mb-6 rounded-[var(--radius-card)] border border-line bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <DealStateBadge state={deal.state} />
          <p className="text-sm text-muted">
            {deal.published_at ? `Published ${formatDateTime(deal.published_at, tz)}` : "Not published yet"}
            {deal.followers_notified_at ? ` · followers notified ${formatDateTime(deal.followers_notified_at, tz)}` : ""}
          </p>
          <Link href={`/deals/${deal.id}`} className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline" target="_blank">
            <ExternalLink className="size-4" aria-hidden /> {deal.state === "live" ? "View live listing" : "Preview listing"}
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-paper p-3"><p className="text-xl font-extrabold tabular">{deal.claims_total}</p><p className="text-xs text-muted">Claims</p></div>
          <div className="rounded-xl bg-paper p-3"><p className="text-xl font-extrabold tabular">{deal.redemptions_total}</p><p className="text-xs text-muted">Redemptions</p></div>
          <div className="rounded-xl bg-paper p-3"><p className="text-xl font-extrabold tabular">{deal.quantity_total != null ? Math.max(0, deal.quantity_total - deal.claimed_count) : deal.type === "appointment" ? deal.slots.reduce((n, s) => n + s.capacity - s.claimed_count, 0) : "∞"}</p><p className="text-xs text-muted">Remaining</p></div>
        </div>
        {deal.moderation_removed_at ? (
          <p className="mt-4 flex gap-2 rounded-xl bg-[#fde8e7] p-3 text-sm text-danger"><Info className="size-4 shrink-0" aria-hidden /> Removed by Frugal Center moderation. It can&apos;t be edited or republished.</p>
        ) : null}
        <div className="mt-4"><DealActions dealId={deal.id} state={deal.state} canEdit={canEdit} /></div>
      </div>
      {canEdit && !deal.moderation_removed_at && deal.state !== "ended" ? (
        <DealEditor
          initial={editorValueFromDeal(deal, tz)}
          dealId={deal.id}
          businessName={biz.name}
          businessCover={biz.cover_url}
          timezone={tz}
          locked={deal.claims_total > 0}
          status={deal.status}
        />
      ) : (
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
          <h1 className="text-2xl font-extrabold">{deal.title}</h1>
          {deal.description ? <p className="mt-2 text-muted">{deal.description}</p> : null}
          <p className="mt-4 text-sm text-muted">{deal.state === "ended" ? "This deal has ended. Duplicate it to run it again." : "You can view this deal but not edit it."}</p>
        </div>
      )}
    </div>
  );
}
