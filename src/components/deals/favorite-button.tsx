"use client";
import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleFavoriteAction } from "@/app/actions/customer";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  dealId,
  initial,
  signedIn,
  className,
  variant = "overlay",
}: {
  dealId: string;
  initial: boolean;
  signedIn: boolean;
  className?: string;
  variant?: "overlay" | "plain";
}) {
  const router = useRouter();
  const [saved, setSaved] = useOptimistic(initial);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved deals" : "Save deal"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!signedIn) {
          router.push(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
          return;
        }
        start(async () => {
          setSaved(!saved);
          const res = await toggleFavoriteAction(dealId, !saved);
          if (!res.ok) toast.error(res.error);
          else if (!saved) toast.success("Saved to My Deals");
        });
      }}
      className={cn(
        "grid size-9 place-items-center rounded-full transition active:scale-90",
        variant === "overlay" ? "bg-white/90 shadow-sm backdrop-blur hover:bg-white" : "border border-line bg-white hover:bg-paper",
        className,
      )}
    >
      <Heart className={cn("size-[18px] transition", saved ? "animate-pop fill-ink text-ink" : "text-ink")} strokeWidth={2.2} />
    </button>
  );
}
