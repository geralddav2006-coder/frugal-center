"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pause, Play, Send, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { dealLifecycleAction } from "@/app/actions/merchant";
import { Button } from "@/components/ui/button";

export function DealActions({ dealId, state, canEdit }: { dealId: string; state: string; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!canEdit || state === "removed") return null;
  const run = (op: "publish" | "pause" | "end" | "duplicate" | "delete", msg: string, confirmText?: string) => () => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const res = await dealLifecycleAction(dealId, op);
      if (res && !res.ok) return void toast.error(res.error);
      toast.success(op === "publish" && res && res.ok && !res.live ? "Scheduled — it goes live at its start time" : msg);
      router.refresh();
    });
  };
  return (
    <div className="flex flex-wrap gap-2">
      {state === "draft" ? <Button size="sm" variant="lime" disabled={pending} onClick={run("publish", "Deal published")}><Send /> Publish</Button> : null}
      {state === "paused" ? <Button size="sm" variant="lime" disabled={pending} onClick={run("publish", "Deal resumed")}><Play /> Resume</Button> : null}
      {["live", "scheduled", "sold_out"].includes(state) ? <Button size="sm" variant="outline" disabled={pending} onClick={run("pause", "Deal paused")}><Pause /> Pause</Button> : null}
      {state !== "draft" && state !== "ended" ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={run("end", "Deal ended", "End this deal now? Customers who already claimed it can still redeem their vouchers.")}><Square /> End</Button>
      ) : null}
      <Button size="sm" variant="outline" disabled={pending} onClick={run("duplicate", "Copied as a new draft")}><Copy /> Duplicate</Button>
      {state === "draft" ? <Button size="sm" variant="ghost" disabled={pending} onClick={run("delete", "Draft deleted", "Delete this draft?")}><Trash2 /> Delete</Button> : null}
    </div>
  );
}
