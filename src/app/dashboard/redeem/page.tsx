import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { recentRedemptions } from "@/server/services/redemption";
import { relativeAgo } from "@/lib/time";
import { formatMoney, privateName } from "@/lib/utils";
import { Redeemer } from "@/components/merchant/redeemer";

export const metadata = { title: "Redeem" };

export default async function RedeemPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const { membership } = await requireBusiness(t ? `/dashboard/redeem?t=${encodeURIComponent(t)}` : "/dashboard/redeem");
  const recent = await recentRedemptions(await getDb(), membership.business_id, 6);
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-extrabold">Redeem</h1>
      <p className="mt-1 mb-6 text-muted">Scan the customer&apos;s QR code or type their code. Every voucher is verified before you confirm.</p>
      <Redeemer initialToken={t ?? null} />
      {recent.length ? (
        <section className="mt-10">
          <h2 className="font-extrabold">Recently redeemed</h2>
          <ul className="mt-3 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.title}</p>
                  <p className="text-muted">{privateName(r.full_name)} · {r.method === "qr" ? "QR" : "Code"} · {relativeAgo(r.redeemed_at)}</p>
                </div>
                <span className="shrink-0 font-bold tabular">{formatMoney(r.final_amount_cents, { exact: true })}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
