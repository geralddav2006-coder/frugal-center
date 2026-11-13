import { Skeleton } from "@/components/ui/skeleton";
import { DealGridSkeleton } from "@/components/deals/deal-grid-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-12 w-3/4 max-w-xl" />
      <Skeleton className="mt-4 h-5 w-1/2 max-w-sm" />
      <Skeleton className="mt-8 h-16 w-full max-w-2xl rounded-full" />
      <div className="mt-12">
        <DealGridSkeleton count={4} />
      </div>
    </div>
  );
}
