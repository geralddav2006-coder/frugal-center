"use client";
import { useRef, useState } from "react";
import { SmartImage } from "../smart-image";
import { cn } from "@/lib/utils";

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const list = images.length ? images : [null];
  return (
    <div className="relative">
      {/* Mobile: swipeable */}
      <div
        ref={ref}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto md:hidden"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIdx(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {list.map((src, i) => (
          <div key={i} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-mist">
            <SmartImage src={src} alt={`${alt} — photo ${i + 1}`} priority={i === 0} sizes="100vw" fallbackLabel={alt} />
          </div>
        ))}
      </div>
      {list.length > 1 ? (
        <span className="absolute right-3 bottom-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur md:hidden">
          {idx + 1} / {list.length}
        </span>
      ) : null}
      {/* Desktop: editorial grid */}
      <div className={cn("hidden gap-2 overflow-hidden rounded-[22px] md:grid", list.length > 1 ? "h-[440px] grid-cols-[2fr_1fr]" : "h-[440px] grid-cols-1")}>
        <div className="relative bg-mist">
          <SmartImage src={list[0]} alt={alt} priority sizes="(max-width: 1280px) 66vw, 850px" fallbackLabel={alt} />
        </div>
        {list.length > 1 ? (
          <div className={cn("grid gap-2", list.length > 2 ? "grid-rows-2" : "grid-rows-1")}>
            {list.slice(1, 3).map((src, i) => (
              <div key={i} className="relative bg-mist">
                <SmartImage src={src} alt={`${alt} — photo ${i + 2}`} sizes="420px" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
