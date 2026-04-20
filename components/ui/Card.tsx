import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

function Card({ title, subtitle, children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface p-5",
        className
      )}
    >
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
          )}
          {subtitle && (
            <p className="mt-0.5 text-xs text-mid">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export { Card };
export type { CardProps };
