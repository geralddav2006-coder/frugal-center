"use client";
import { useTransition } from "react";
import { switchBusinessAction } from "@/app/actions/merchant";

export function BusinessSwitcher({ current, options }: { current: string; options: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  if (options.length < 2) return null;
  return (
    <label className="block">
      <span className="sr-only">Switch business</span>
      <select
        value={current}
        disabled={pending}
        onChange={(e) => start(() => switchBusinessAction(e.target.value))}
        className="mt-2 h-9 w-full rounded-lg border border-line bg-white px-2 text-sm font-semibold"
      >
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>
  );
}
