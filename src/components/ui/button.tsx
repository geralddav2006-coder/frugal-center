import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background,color,transform,box-shadow] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
  {
    variants: {
      variant: {
        default: "bg-ink text-white hover:bg-ink-soft",
        lime: "bg-lime text-ink hover:brightness-95 shadow-[inset_0_-2px_0_rgb(0_0_0/0.08)]",
        outline: "border border-line bg-white text-ink hover:bg-paper",
        secondary: "bg-mist text-ink hover:bg-[#e7e8e3]",
        ghost: "text-ink hover:bg-mist",
        danger: "bg-danger text-white hover:brightness-95",
        link: "text-ink underline-offset-4 hover:underline rounded-none px-0",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        default: "h-11 px-5 text-[15px]",
        lg: "h-14 px-7 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
