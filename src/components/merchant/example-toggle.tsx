"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setExampleListedAction } from "@/app/actions/merchant";

/** On a preview's dashboard: show it publicly as a labeled, unclaimable example, or keep it private. */
export function ExampleToggle({ listed }: { listed: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => {
        const res = await setExampleListedAction(!listed);
        if (res && !res.ok) toast.error(res.error);
        else toast.success(listed ? "Hidden. Only people with the link can see it." : "Listed publicly as an example.");
      })}
      className="rounded-full border border-white/30 px-3 py-1 text-xs font-bold hover:bg-white/10 disabled:opacity-50"
    >
      {pending ? "Saving…" : listed ? "Hide public example" : "Show publicly as an example"}
    </button>
  );
}
