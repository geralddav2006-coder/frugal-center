import Link from "next/link";
import { LayoutGrid, ShoppingBag, Sparkles, Ticket, UtensilsCrossed, Wrench, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export const CATEGORY_TABS = [
  { key: "all", label: "All", icon: LayoutGrid },
  { key: "food-drink", label: "Food & Drink", icon: UtensilsCrossed },
  { key: "beauty-wellness", label: "Beauty & Wellness", icon: Sparkles },
  { key: "shopping", label: "Shopping", icon: ShoppingBag },
  { key: "activities", label: "Activities", icon: Ticket },
  { key: "services", label: "Services", icon: Wrench },
  { key: "last-minute", label: "Last-Minute", icon: Zap },
] as const;

/** Icon tabs (Airbnb-style). Links preserve the other query params. */
export function CategoryBar({
  basePath,
  params,
  active,
  className,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  active: string;
  className?: string;
}) {
  const hrefFor = (key: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "category" && k !== "lastMinute") p.set(k, v);
    if (key === "last-minute") p.set("lastMinute", "1");
    else if (key !== "all") p.set("category", key);
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav aria-label="Categories" className={cn("no-scrollbar flex gap-1 overflow-x-auto", className)}>
      {CATEGORY_TABS.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <Link
            key={key}
            href={hrefFor(key)}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group flex shrink-0 flex-col items-center gap-1.5 border-b-2 px-3 pt-2 pb-2.5 text-[12.5px] font-semibold whitespace-nowrap transition",
              isActive ? "border-ink text-ink" : "border-transparent text-muted hover:border-line hover:text-ink",
            )}
          >
            <span className={cn("grid size-9 place-items-center rounded-full transition", isActive ? (key === "last-minute" ? "bg-lime" : "bg-mist") : "group-hover:bg-mist")}>
              <Icon className="size-[19px]" strokeWidth={isActive ? 2.3 : 1.9} aria-hidden />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
