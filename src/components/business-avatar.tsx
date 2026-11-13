import { cn, initials } from "@/lib/utils";
import { SmartImage } from "./smart-image";

const TONES = ["bg-lime text-ink", "bg-ink text-lime", "bg-mist text-ink", "bg-[#e9f0ff] text-[#1d3a8a]", "bg-[#ffece3] text-[#8a2f0b]"];

export function BusinessAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const tone = TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];
  return (
    <div className={cn("relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl font-extrabold", tone, className)}>
      {src ? <SmartImage src={src} alt="" sizes="96px" /> : <span className="text-[0.85em] tracking-tight">{initials(name)}</span>}
    </div>
  );
}
