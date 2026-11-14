"use client";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setPublicStatsAction } from "@/app/actions/merchant";

export function PublicStatsToggle({ initial, preview }: { initial: boolean; preview: string }) {
  const [show, setShow] = useOptimistic(initial);
  const [, start] = useTransition();
  return (
    <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl bg-paper p-4">
      <div className="min-w-0">
        <label htmlFor="public-stats" className="block cursor-pointer font-bold">Show my stats on my public profile</label>
        <p className="mt-0.5 text-sm text-muted">{preview}</p>
      </div>
      <Switch
        id="public-stats"
        checked={show}
        onCheckedChange={(on) =>
          start(async () => {
            setShow(on);
            const res = await setPublicStatsAction(on);
            if (!res.ok) toast.error(res.error);
            else toast.success(on ? "Your stats are visible on your profile" : "Your stats are hidden");
          })
        }
      />
    </div>
  );
}
