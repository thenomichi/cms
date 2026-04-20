import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <span className="text-4xl">{icon}</span>
      <h3 className="mt-3 text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-mid">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
