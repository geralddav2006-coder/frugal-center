"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-extrabold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-muted">We couldn&apos;t load this page. Please try again in a moment.</p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </div>
  );
}
