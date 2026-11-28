import { handOffToOwnerAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

/** Signs the current person out and opens sign-up for the business owner, continuing to `next`. */
export function HandOffButton({ next, children, variant = "outline" }: { next: string; children: React.ReactNode; variant?: "outline" | "lime" }) {
  return (
    <form action={handOffToOwnerAction}>
      <input type="hidden" name="next" value={next} />
      <Button type="submit" size="lg" variant={variant} className="w-full">{children}</Button>
    </form>
  );
}
