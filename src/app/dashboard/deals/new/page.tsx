import { requireBusiness } from "@/server/auth";
import { getDb } from "@/server/db";
import { getMerchantBusiness } from "@/server/services/merchant";
import { DEAL_TYPES, type DealType } from "@/lib/deals";
import { DealEditor } from "@/components/merchant/deal-editor";
import { newEditorValue } from "@/components/merchant/editor-values";

export const metadata = { title: "Create Deal" };

export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { membership } = await requireBusiness("/dashboard/deals/new", ["owner", "manager"]);
  const { type } = await searchParams;
  const biz = await getMerchantBusiness(await getDb(), membership.business_id);
  const t = DEAL_TYPES.includes(type as DealType) ? (type as DealType) : null;
  return (
    <DealEditor
      initial={newEditorValue(t, biz.timezone)}
      dealId={null}
      businessName={biz.name}
      businessCover={biz.cover_url}
      timezone={biz.timezone}
      locked={false}
      status={null}
    />
  );
}
