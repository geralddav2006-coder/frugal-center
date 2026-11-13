"use client";
import { useOptimistic, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { setFollowNotifyAction } from "@/app/actions/customer";

export function NotifyToggle({ businessId, name, initial }: { businessId: string; name: string; initial: boolean }) {
  const [on, setOn] = useOptimistic(initial);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Mute notifications from ${name}` : `Turn on notifications from ${name}`}
      title={on ? "Notifications on" : "Muted"}
      className="grid size-9 place-items-center rounded-full border border-line hover:bg-paper"
      onClick={() =>
        start(async () => {
          setOn(!on);
          const res = await setFollowNotifyAction(businessId, !on);
          if (!res.ok) toast.error(res.error);
          else toast.success(res.notify ? `Notifications on for ${name}` : `${name} muted`);
        })
      }
    >
      {on ? <Bell className="size-4" /> : <BellOff className="size-4 text-muted" />}
    </button>
  );
}
