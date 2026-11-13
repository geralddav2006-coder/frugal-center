"use client";
import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markNotificationsReadAction } from "@/app/actions/customer";

export function MarkAllRead() {
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => void (await markNotificationsReadAction()))}>
      <CheckCheck /> Mark all read
    </Button>
  );
}
