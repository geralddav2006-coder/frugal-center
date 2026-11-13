"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { reportAction } from "@/app/actions/customer";

const REASONS = [
  { v: "misleading", label: "Misleading or inaccurate" },
  { v: "not_honored", label: "Business didn't honor it" },
  { v: "inappropriate", label: "Inappropriate content" },
  { v: "fraud", label: "Looks like fraud or a scam" },
  { v: "other", label: "Something else" },
];

export function ReportDialog({ dealId, businessId, signedIn }: { dealId?: string; businessId?: string; signedIn: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            if (!signedIn) {
              e.preventDefault();
              router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
            }
          }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          <Flag className="size-4" aria-hidden /> Report this listing
        </button>
      </DialogTrigger>
      <DialogContent title="Report this listing" description="Our team reviews every report. Reports are confidential.">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await reportAction({ dealId, businessId, reason, details });
              if (!res.ok) return void toast.error(res.error);
              toast.success("Thanks — our team will take a look.");
              setOpen(false);
            });
          }}
        >
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">What&apos;s wrong?</legend>
            {REASONS.map((r) => (
              <label key={r.v} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 has-[:checked]:border-ink">
                <input type="radio" name="reason" value={r.v} checked={reason === r.v} onChange={() => setReason(r.v)} className="size-4 accent-ink" />
                <span className="text-[15px] font-medium">{r.label}</span>
              </label>
            ))}
          </fieldset>
          <label className="grid gap-1.5 text-sm font-semibold">
            Details (optional)
            <Textarea value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} placeholder="Tell us what happened" />
          </label>
          <Button type="submit" disabled={!reason || pending}>Send report</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
