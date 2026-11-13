import Link from "next/link";
import { List, Map } from "lucide-react";
import { cn } from "@/lib/utils";

export function ViewToggle({ view, listHref, mapHref, className }: { view: "list" | "map"; listHref: string; mapHref: string; className?: string }) {
  const item = (active: boolean) =>
    cn("flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition", active ? "bg-ink text-white" : "text-ink hover:bg-white");
  return (
    <div className={cn("inline-flex rounded-full bg-mist p-1", className)} role="group" aria-label="View">
      <Link href={listHref} className={item(view === "list")} aria-current={view === "list" ? "page" : undefined}>
        <List className="size-4" aria-hidden /> List
      </Link>
      <Link href={mapHref} className={item(view === "map")} aria-current={view === "map" ? "page" : undefined}>
        <Map className="size-4" aria-hidden /> Map
      </Link>
    </div>
  );
}
