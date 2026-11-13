"use client";
import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * next/image with a graceful branded fallback when a remote photo fails,
 * so a broken image never shows as a broken icon.
 */
export function SmartImage({
  src,
  alt,
  className,
  sizes = "(max-width: 768px) 100vw, 33vw",
  priority,
  fallbackLabel,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fallbackLabel?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cn("absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,#e6fbe3,#f0f1ed_60%)]", className)}>
        <div className="flex flex-col items-center gap-1.5 text-muted">
          <ImageOff className="size-5" aria-hidden />
          {fallbackLabel ? <span className="max-w-[80%] truncate text-xs font-semibold">{fallbackLabel}</span> : null}
        </div>
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={src.startsWith("/api/")}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
