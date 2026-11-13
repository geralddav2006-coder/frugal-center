"use client";
import { useState, useTransition } from "react";
import { Check, Copy, Link2Off, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { shareSavingsAction } from "@/app/actions/customer";

export function ShareSavings({ initialUrl, totalLabel, count }: { initialUrl: string | null; totalLabel: string; count: number }) {
  const [url, setUrl] = useState(initialUrl);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const toggle = (enable: boolean) =>
    start(async () => {
      const res = await shareSavingsAction(enable);
      if (!res.ok) return void toast.error(res.error);
      setUrl(res.url);
    });
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="lime" disabled={count === 0}><Share2 /> Share my savings</Button>
      </DialogTrigger>
      <DialogContent title="Share your savings" description="Your share card shows only your first name, total saved and number of deals — never where you shopped or when.">
        <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white">
          <p className="text-sm text-white/70">I&apos;ve saved</p>
          <p className="text-5xl font-extrabold tracking-tight text-lime">{totalLabel}</p>
          <p className="mt-2 text-sm text-white/80">on {count} local {count === 1 ? "deal" : "deals"} with Frugal Center</p>
          <div aria-hidden className="absolute -right-10 -bottom-12 size-40 rounded-full bg-lime/20 blur-2xl" />
        </div>
        {url ? (
          <div className="mt-5 grid gap-2">
            <div className="flex gap-2">
              <input readOnly value={url} aria-label="Share link" className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-sm" />
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    if (navigator.share) await navigator.share({ title: "My Frugal Center savings", url });
                    else {
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                    }
                  } catch {}
                }}
              >
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Share"}
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="justify-self-start text-muted" onClick={() => toggle(false)} disabled={pending}>
              <Link2Off /> Turn off sharing link
            </Button>
          </div>
        ) : (
          <Button className="mt-5 w-full" onClick={() => toggle(true)} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Share2 />} Create share link
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
