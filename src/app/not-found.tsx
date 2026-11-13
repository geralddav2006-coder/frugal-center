import Link from "next/link";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <p className="mt-10 text-7xl font-extrabold tracking-tight">404</p>
      <h1 className="mt-2 text-2xl font-extrabold">This page doesn&apos;t exist</h1>
      <p className="mt-2 text-muted">The link may be broken, or the page may have been removed.</p>
      <Button asChild className="mt-6"><Link href="/">Explore deals</Link></Button>
    </div>
  );
}
