"use client";
import * as React from "react";
import { DropdownMenu as M } from "radix-ui";
import { cn } from "@/lib/utils";

const DropdownMenu = M.Root;
const DropdownMenuTrigger = M.Trigger;

function DropdownMenuContent({ className, sideOffset = 8, ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-56 rounded-2xl border border-line bg-white p-1.5 shadow-[var(--shadow-lift)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </M.Portal>
  );
}

function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof M.Item>) {
  return (
    <M.Item
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium outline-none select-none data-[highlighted]:bg-mist [&_svg]:size-4 [&_svg]:text-muted",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator() {
  return <M.Separator className="my-1.5 h-px bg-line" />;
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof M.Label>) {
  return <M.Label className={cn("px-3 py-2 text-xs font-semibold text-muted", className)} {...props} />;
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel };
