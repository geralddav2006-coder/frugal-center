"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Check } from "lucide-react";
import { toast } from "sonner";
import { toggleFollowAction } from "@/app/actions/customer";
import { FollowButton } from "@/components/follow-button";
import { Button } from "@/components/ui/button";

/**
 * Shown when someone arrives by scanning one of the business's in-store signs.
 * Signed in: one tap to follow. New visitors sign up and are followed automatically on return.
 */
export function SignWelcome({
  businessId,
  businessName,
  slug,
  signedIn,
  following,
  autoFollow,
}: {
  businessId: string;
  businessName: string;
  slug: string;
  signedIn: boolean;
  following: boolean;
  autoFollow: boolean;
}) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!autoFollow || started.current) return;
    started.current = true;
    toggleFollowAction(businessId, true).then((res) => {
      if (res.ok) toast.success(`You're following ${businessName}. We'll let you know when they post a deal.`);
      else toast.error(res.error);
      router.replace(`/business/${slug}?from=sign`, { scroll: false });
    });
  }, [autoFollow, businessId, businessName, slug, router]);

  if (following) {
    return (
      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-lime-soft p-4 text-[15px]" role="status">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lime"><Check className="size-4" strokeWidth={3} aria-hidden /></span>
        <p><strong>You&apos;re following {businessName}.</strong> We&apos;ll let you know when they post a deal.</p>
      </div>
    );
  }

  const back = `/business/${slug}?from=sign&follow=1`;
  return (
    <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-ink p-4 text-white sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime text-ink sm:size-11 sm:rounded-2xl"><BellRing className="size-5" aria-hidden /></span>
        <div className="min-w-0">
          <p className="text-lg leading-tight font-extrabold">Thanks for scanning!</p>
          <p className="mt-0.5 text-[15px] text-white/75">Follow {businessName} and we&apos;ll tell you the moment they post a deal. Free, no spam.</p>
        </div>
      </div>
      {signedIn ? (
        <FollowButton businessId={businessId} businessName={businessName} initial={false} signedIn variant="lime" className="w-full sm:w-auto" />
      ) : (
        <div className="flex flex-col gap-2 sm:items-end">
          <Button asChild variant="lime" size="lg" className="w-full sm:w-auto">
            <Link href={`/signup?next=${encodeURIComponent(back)}`}>Sign up free to follow</Link>
          </Button>
          <Link href={`/login?next=${encodeURIComponent(back)}`} className="text-center text-sm text-white/75 underline-offset-2 hover:underline">
            Have an account? Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
