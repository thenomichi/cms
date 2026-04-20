"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
  badge?: ReactNode;
  onClick?: () => void;
  className?: string;
}

function StatCard({ icon, value, label, badge, onClick, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface p-5",
        onClick && "cursor-pointer hover:border-fog transition-colors",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <span className="text-2xl">{icon}</span>
      <p className="mt-3 text-2xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-mid">{label}</p>
      {badge && <div className="mt-2">{badge}</div>}
    </div>
  );
}

export { StatCard };
export type { StatCardProps };
