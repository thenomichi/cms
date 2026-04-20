import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

function TopBar({ title, subtitle, actions, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-[60px] items-center justify-between border-b border-line bg-surface px-6",
        className
      )}
    >
      <div>
        <h1 className="text-base font-semibold text-ink">{title}</h1>
        {subtitle && (
          <p className="text-xs text-mid">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export { TopBar };
export type { TopBarProps };
