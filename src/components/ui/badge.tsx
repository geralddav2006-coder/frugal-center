import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap [&_svg]:size-3.5", {
  variants: {
    variant: {
      lime: "bg-lime text-ink",
      ink: "bg-ink text-white",
      soft: "bg-mist text-ink",
      outline: "border border-line text-ink bg-white",
      success: "bg-lime-soft text-lime-ink",
      warning: "bg-[#fff4dc] text-warning",
      danger: "bg-[#fde8e7] text-danger",
      glass: "bg-ink/75 text-white backdrop-blur-md",
    },
    size: { sm: "h-6 px-2.5 text-[11px] tracking-wide", default: "h-7 px-3 text-xs" },
  },
  defaultVariants: { variant: "soft", size: "default" },
});

function Badge({ className, variant, size, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
