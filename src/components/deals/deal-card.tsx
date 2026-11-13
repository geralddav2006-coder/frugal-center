import Link from "next/link";
import { Clock3, MapPin } from "lucide-react";
import type { DealCard as Deal } from "@/server/services/discovery";
import { DEAL_TYPE_META, priceDisplay } from "@/lib/deals";
import { cn, formatDistance } from "@/lib/utils";
import { SmartImage } from "../smart-image";
import { ExclusiveBadge } from "./exclusive-badge";
import { FavoriteButton } from "./favorite-button";
import { availabilityLabel, urgencyLabel } from "./deal-labels";

export function DealCard({
  deal,
  signedIn,
  className,
  priority,
  size = "default",
}: {
  deal: Deal;
  signedIn: boolean;
  className?: string;
  priority?: boolean;
  size?: "default" | "rail";
}) {
  const price = priceDisplay(deal);
  const distance = formatDistance(deal.distance_miles);
  const urgency = urgencyLabel(deal);
  return (
    <Link
      href={`/deals/${deal.id}`}
      className={cn("group block rounded-[var(--radius-card)] outline-offset-4", size === "rail" && "w-[78vw] max-w-[300px] shrink-0 snap-start sm:w-[290px]", className)}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] bg-mist">
        <SmartImage
          src={deal.images[0] ?? deal.business_cover}
          alt={deal.title}
          priority={priority}
          sizes="(max-width: 640px) 80vw, (max-width: 1024px) 45vw, 300px"
          fallbackLabel={deal.business_name}
          className="transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute top-3 right-14 left-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-lime px-2.5 py-1 text-[12px] font-extrabold tracking-wide text-ink shadow-sm">{price.badge}</span>
          {deal.type === "exclusive" ? <ExclusiveBadge /> : null}
        </div>
        <FavoriteButton dealId={deal.id} initial={deal.is_favorite} signedIn={signedIn} className="absolute top-2.5 right-2.5" />
        {deal.type !== "exclusive" ? (
          <span className="absolute bottom-3 left-3 rounded-full bg-ink/75 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
            {DEAL_TYPE_META[deal.type].short}
          </span>
        ) : null}
      </div>
      <div className="px-0.5 pt-3">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
          <span className="truncate">{deal.business_name}</span>
          {distance ? (
            <>
              <span aria-hidden>·</span>
              <span className="flex shrink-0 items-center gap-0.5">
                <MapPin className="size-3" aria-hidden />
                {distance}
              </span>
            </>
          ) : null}
        </div>
        <h3 className="mt-0.5 line-clamp-1 text-[16px] font-bold tracking-tight text-ink">{deal.title}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[17px] font-extrabold text-ink">{price.headline}</span>
          {price.original ? <span className="text-sm text-muted line-through decoration-muted/60">{price.original}</span> : null}
          {price.variable ? <span className="text-sm text-muted">your bill</span> : null}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted">
          <Clock3 className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{urgency ?? availabilityLabel(deal)}</span>
        </div>
      </div>
    </Link>
  );
}
