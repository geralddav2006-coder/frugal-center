import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-muted/70 transition-colors outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-danger/15";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldClass, "h-12", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldClass, "min-h-24 py-3 leading-relaxed", className)} {...props} />;
}

function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        fieldClass,
        "h-12 appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23191919' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10",
        className,
      )}
      {...props}
    />
  );
}

export { Input, Textarea, NativeSelect };
