import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function DealNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState icon={<SearchX />} title="This deal isn't available" action={<Button asChild><Link href="/">Explore deals nearby</Link></Button>}>
        It may have ended, been removed, or the link may be incorrect.
      </EmptyState>
    </div>
  );
}
