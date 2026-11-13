"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/** Shows a one-time toast for ?welcome=1 style flags, then cleans the URL. */
export function FlashToast({ param, message }: { param: string; message: string }) {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (params.get(param)) {
      toast.success(message);
      const next = new URLSearchParams(params.toString());
      next.delete(param);
      const qs = next.toString();
      router.replace(`${location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    }
  }, [params, param, message, router]);
  return null;
}
