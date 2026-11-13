import { Skeleton } from "@/components/ui/skeleton";
import { DealGridSkeleton } from "@/components/deals/deal-grid-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-40" />
      <div className="mt-5 flex gap-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-9 w-24 rounded-full" />)}</div>
      <div className="mt-8"><DealGridSkeleton /></div>
    </div>
  );
}
