import { Skeleton } from "@/components/ui/skeleton";

export function DealGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[4/3] w-full rounded-[var(--radius-card)]" />
          <Skeleton className="mt-3 h-3.5 w-1/2" />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <Skeleton className="mt-2 h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}
