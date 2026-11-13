"use client";
import * as React from "react";
import { Tabs as T } from "radix-ui";
import { cn } from "@/lib/utils";

const Tabs = T.Root;

function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("inline-flex rounded-full bg-mist p-1", className)} {...props} />;
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-muted transition-all data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-[var(--shadow-soft)] [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

const TabsContent = T.Content;

export { Tabs, TabsList, TabsTrigger, TabsContent };
