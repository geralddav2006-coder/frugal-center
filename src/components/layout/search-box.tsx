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
      <Search className={cn("pointer-events-none absolute text-muted", hero ? "left-5 size-5" : "left-4 size-4")} aria-hidden />
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
          hero ? "h-16 pr-[4.5rem] pl-13 text-base shadow-[var(--shadow-soft)] sm:text-[17px]" : "h-11 pr-4 pl-11 text-[15px]",
        )}
      />
      {hero ? (
        <button type="submit" aria-label="Search" className="absolute right-2 grid size-12 place-items-center rounded-full bg-ink text-lime transition hover:bg-ink-soft active:scale-95">
          <Search className="size-5" strokeWidth={2.5} />
        </button>
      ) : null}
    </form>
  );
}
