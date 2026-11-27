"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { claimPreviewAction } from "@/app/actions/merchant";
import { Button } from "@/components/ui/button";

export function ClaimPreviewButton({ token, name }: { token: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button size="lg" disabled={pending} onClick={() => start(async () => {
        setError(null);
        const res = await claimPreviewAction(token);
        if (res && !res.ok) {
          setError(res.error);
          toast.error(res.error);
        }
      })}>
        {pending ? "Claiming…" : `Claim ${name}`}
      </Button>
      {error ? <p className="rounded-xl bg-[#fff4dc] p-3 text-sm font-medium text-warning" role="alert">{error}</p> : null}
    </>
  );
}
