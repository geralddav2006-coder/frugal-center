"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "Copy", variant = "outline" }: { text: string; label?: string; variant?: "outline" | "default" }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          toast.success("Copied");
          setTimeout(() => setDone(false), 1800);
        } catch {
          toast.error("Couldn't copy. Select the text and copy it instead.");
        }
      }}
    >
      {done ? <Check /> : <Copy />} {done ? "Copied" : label}
    </Button>
  );
}
