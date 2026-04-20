"use client";

import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListBuilderProps {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  className?: string;
}

function ListBuilder({
  items,
  onChange,
  placeholder = "Enter item...",
  className,
}: ListBuilderProps) {
  function handleItemChange(index: number, value: string) {
    const next = [...items];
    next[index] = value;
    onChange(next);
  }

  function handleRemove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function handleAdd() {
    onChange([...items, ""]);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            value={item}
            onChange={(e) => handleItemChange(idx, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (item.trim()) {
                  const container = (e.target as HTMLElement).closest(".space-y-2");
                  onChange([...items, ""]);
                  setTimeout(() => {
                    const inputs = container?.querySelectorAll("input");
                    if (inputs) inputs[inputs.length - 1]?.focus();
                  }, 0);
                }
              }
            }}
            placeholder={placeholder}
            className="h-9 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20"
          />
          <button
            type="button"
            onClick={() => handleRemove(idx)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mid hover:bg-sem-red-bg hover:text-sem-red transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-rust hover:bg-rust-tint transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add item
      </button>
    </div>
  );
}

export { ListBuilder };
export type { ListBuilderProps };
