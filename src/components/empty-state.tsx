import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-paper px-6 py-12 text-center", className)}>
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-white text-ink shadow-[var(--shadow-soft)] [&_svg]:size-6">{icon}</div>
      <h3 className="text-lg font-extrabold">{title}</h3>
      {children ? <div className="mt-1.5 max-w-sm text-[15px] text-muted">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
