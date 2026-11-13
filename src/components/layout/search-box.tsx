"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchBox({ size = "default", className, autoFocus }: { size?: "default" | "hero"; className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const hero = size === "hero";
  return (
    <form
      role="search"
      className={cn("relative flex items-center", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const next = new URLSearchParams(params.toString());
        if (q.trim()) next.set("q", q.trim());
        else next.delete("q");
        router.push(`/explore?${next.toString()}`);
      }}
    >
      <Search className={cn("pointer-events-none absolute text-muted", hero ? "left-4 size-5 sm:left-5" : "left-4 size-4")} aria-hidden />
      <label htmlFor={`search-${size}`} className="sr-only">Search deals, businesses, services</label>
      <input
        id={`search-${size}`}
        type="search"
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search deals, businesses, services..."
        className={cn(
          "w-full rounded-full border border-line bg-white text-ink placeholder:text-muted/80 outline-none transition focus:border-ink focus:shadow-[var(--shadow-soft)]",
          hero ? "h-14 pr-16 pl-12 text-base shadow-[var(--shadow-soft)] sm:h-16 sm:pr-[4.5rem] sm:pl-13 sm:text-[17px]" : "h-11 pr-4 pl-11 text-[15px]",
        )}
      />
      {hero ? (
        <button type="submit" aria-label="Search" className="absolute right-1.5 grid size-11 place-items-center rounded-full bg-ink text-lime transition hover:bg-ink-soft active:scale-95 sm:right-2 sm:size-12">
          <Search className="size-5" strokeWidth={2.5} />
        </button>
      ) : null}
    </form>
  );
}
