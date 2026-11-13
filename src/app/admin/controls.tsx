"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeDealAction, resetDemoAction, resolveReportAction, reviewBusinessAction, suspendBusinessAction } from "@/app/actions/admin";

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(msg);
      router.refresh();
    });
  return { pending, act };
}

export function BusinessControls({ id, review, suspended }: { id: string; review: string; suspended: boolean }) {
  const { pending, act } = useAct();
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {review === "pending" ? (
        <>
          <Button size="sm" variant="lime" disabled={pending} onClick={() => act(() => reviewBusinessAction(id, "approved"), "Approved")}>Approve</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => reviewBusinessAction(id, "rejected"), "Rejected")}>Reject</Button>
        </>
      ) : null}
      {suspended ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => suspendBusinessAction(id, false), "Reinstated")}>Unsuspend</Button>
      ) : (
        <Button size="sm" variant="ghost" className="text-danger" disabled={pending}
          onClick={() => { const reason = window.prompt("Reason for suspension (shown in audit log):"); if (reason) act(() => suspendBusinessAction(id, true, reason), "Business suspended"); }}>
          Suspend
        </Button>
      )}
    </div>
  );
}

export function DealControls({ id, removed }: { id: string; removed: boolean }) {
  const { pending, act } = useAct();
  return removed ? (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => removeDealAction(id, false), "Restored")}>Restore</Button>
  ) : (
    <Button size="sm" variant="ghost" className="text-danger" disabled={pending}
      onClick={() => { const note = window.prompt("Why is this listing being disabled?"); if (note) act(() => removeDealAction(id, true, note), "Listing disabled"); }}>
      Disable
    </Button>
  );
}

export function ReportControls({ id }: { id: string }) {
  const { pending, act } = useAct();
  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => resolveReportAction(id, "resolved"), "Marked resolved")}>Resolve</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => resolveReportAction(id, "dismissed"), "Dismissed")}>Dismiss</Button>
    </div>
  );
}

export function ResetDemo() {
  const { pending, act } = useAct();
  return (
    <Button variant="outline" size="sm" disabled={pending}
      onClick={() => window.confirm("Wipe the local demo database and reseed it? You'll need to sign in again.") && act(resetDemoAction, "Demo data reset. Sign in again.")}>
      Reset demo data
    </Button>
  );
}
