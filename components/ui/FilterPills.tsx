"use client";

import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterPillsProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function FilterPills({ options, value, onChange, className }: FilterPillsProps) {
  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-rust text-white"
              : "bg-surface3 text-ink border border-line hover:bg-line2"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export { FilterPills };
export type { FilterPillsProps, FilterOption };
