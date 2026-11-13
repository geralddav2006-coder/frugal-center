"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { timeLeft } from "@/lib/time";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cancelClaimAction } from "@/app/actions/customer";

/** Re-fetches the voucher while it's active so the screen flips to "Redeemed" when staff confirm. */
export function VoucherAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}

export function Countdown({ to, prefix = "Expires in" }: { to: string; prefix?: string }) {
  const now = useNow();
  if (now == null) return <span>&nbsp;</span>;
  const left = timeLeft(to, new Date(now));
  return <span>{left === "ended" ? "Expired" : `${prefix} ${left}`}</span>;
}

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted hover:bg-mist hover:text-ink"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy — read the code to staff instead.");
        }
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copied" : "Copy code"}
    </button>
  );
}

export function CancelVoucher({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-muted">Cancel voucher</Button>
      </DialogTrigger>
      <DialogContent title="Cancel this voucher?" description="Your spot is released so someone else can claim it. You can't undo this.">
        <div className="grid gap-2 sm:grid-cols-2">
          <DialogClose asChild><Button variant="outline">Keep voucher</Button></DialogClose>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await cancelClaimAction(claimId);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Voucher canceled");
                router.refresh();
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : null} Cancel voucher
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
