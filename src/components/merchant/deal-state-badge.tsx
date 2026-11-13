import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { label: string; variant: "lime" | "soft" | "warning" | "danger" | "outline" | "ink" }> = {
  live: { label: "Live", variant: "lime" },
  scheduled: { label: "Scheduled", variant: "ink" },
  draft: { label: "Draft", variant: "outline" },
  paused: { label: "Paused", variant: "warning" },
  sold_out: { label: "Sold out", variant: "soft" },
  ended: { label: "Ended", variant: "soft" },
  removed: { label: "Removed by moderation", variant: "danger" },
};

export function DealStateBadge({ state }: { state: string }) {
  const m = MAP[state] ?? { label: state, variant: "soft" as const };
  return <Badge variant={m.variant} size="sm">{m.label}</Badge>;
}
