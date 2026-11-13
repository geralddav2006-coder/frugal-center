import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-9 w-64" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="mt-6 h-64 w-full" />
    </div>
  );
}
