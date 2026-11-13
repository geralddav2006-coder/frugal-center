"use client";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleFollowAction } from "@/app/actions/customer";

export function FollowButton({
  businessId,
  businessName,
  initial,
  signedIn,
  size = "default",
  className,
}: {
  businessId: string;
  businessName: string;
  initial: boolean;
  signedIn: boolean;
  size?: "sm" | "default";
  className?: string;
}) {
  const router = useRouter();
  const [following, setFollowing] = useOptimistic(initial);
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size={size}
      variant={following ? "outline" : "default"}
      aria-pressed={following}
      disabled={pending}
      className={className}
      onClick={() => {
        if (!signedIn) {
          router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
          return;
        }
        start(async () => {
          setFollowing(!following);
          const res = await toggleFollowAction(businessId, !following);
          if (!res.ok) toast.error(res.error);
          else toast.success(res.following ? `Following ${businessName}. We'll notify you about new deals.` : `Unfollowed ${businessName}`);
        });
      }}
    >
      {following ? <Check /> : <Plus />}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
