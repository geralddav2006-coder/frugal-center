import Link from "next/link";
import { Store } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function BusinessNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState icon={<Store />} title="Business not found" action={<Button asChild><Link href="/">Explore deals</Link></Button>}>
        This business may no longer be on Frugal Center.
      </EmptyState>
    </div>
  );
}
