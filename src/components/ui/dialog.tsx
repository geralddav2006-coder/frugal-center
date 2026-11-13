"use client";
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = D.Root;
const DialogTrigger = D.Trigger;
const DialogClose = D.Close;

function DialogContent({
  className,
  children,
  title,
  description,
  hideTitle,
  ...props
}: React.ComponentProps<typeof D.Content> & { title: string; description?: string; hideTitle?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <D.Content
        className={cn(
          "fixed z-50 bg-white shadow-[var(--shadow-lift)] outline-none",
          "inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:data-[state=open]:slide-in-from-bottom-4 sm:data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-mist sm:hidden" aria-hidden />
        <D.Title className={cn("pr-8 text-xl font-extrabold", hideTitle && "sr-only")}>{title}</D.Title>
        {description ? (
          <D.Description className="mt-1 text-[15px] text-muted">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">{title}</D.Description>
        )}
        <div className={cn(!hideTitle && "mt-5")}>{children}</div>
        <D.Close className="absolute top-5 right-5 grid size-9 place-items-center rounded-full text-ink hover:bg-mist" aria-label="Close">
          <X className="size-5" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

export { Dialog, DialogTrigger, DialogContent, DialogClose };
