"use client";
import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

/** Horizontal, snap-scrolling section with desktop arrow controls. */
export function DealRail({
  title,
  subtitle,
  href,
  children,
  icon,
}: {
  title: string;
  subtitle?: string | null;
  href?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });
  return (
    <section className="py-5" aria-label={title}>
      <div className="mb-3 flex items-end justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-extrabold sm:text-[22px]">
            {icon}
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {href ? (
            <Link href={href} className="flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold underline-offset-4 hover:underline">
              See all <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
          <div className="hidden gap-1.5 md:flex">
            <button type="button" onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`} className="grid size-8 place-items-center rounded-full border border-line bg-white hover:bg-paper">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={() => scroll(1)} aria-label={`Scroll ${title} right`} className="grid size-8 place-items-center rounded-full border border-line bg-white hover:bg-paper">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <div ref={ref} className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:scroll-px-6 sm:px-6 lg:scroll-px-8 lg:px-8">
        {children}
      </div>
    </section>
  );
}
