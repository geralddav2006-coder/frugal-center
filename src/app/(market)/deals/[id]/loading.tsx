import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl md:px-6 md:pt-6 lg:px-8" aria-busy="true">
      <Skeleton className="aspect-[4/3] w-full rounded-none md:aspect-auto md:h-[440px] md:rounded-[22px]" />
      <div className="grid gap-10 px-4 pt-6 md:px-0 lg:grid-cols-[1fr_380px]">
        <div>
          <Skeleton className="h-7 w-40 rounded-full" />
          <Skeleton className="mt-4 h-10 w-3/4" />
          <Skeleton className="mt-5 h-12 w-64" />
          <Skeleton className="mt-6 h-28 w-full" />
        </div>
        <Skeleton className="hidden h-72 lg:block" />
      </div>
    </div>
  );
}
