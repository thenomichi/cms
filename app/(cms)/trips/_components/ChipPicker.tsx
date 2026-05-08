"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

interface ChipLike {
  name: string;
  category: string;
  icon?: string;
}

interface ChipPickerProps<T extends ChipLike> {
  /** Master pool, grouped + searchable. */
  pool: T[];
  /** Currently selected names (from form state). Filters them out of the picker. */
  selectedNames: Set<string>;
  /** When a pool chip is clicked, adds to form state. */
  onPick: (chip: T) => void;
  /** When + custom is clicked, opens parent's add modal. */
  onAddCustom: () => void;
  /** Pretty placeholder e.g. "Search inclusions or pick from the list..." */
  searchPlaceholder: string;
  /** Whether to render the chip's icon (true for inclusions, false for exclusions). */
  renderIcon?: boolean;
}

export function ChipPicker<T extends ChipLike>({
  pool,
  selectedNames,
  onPick,
  onAddCustom,
  searchPlaceholder,
  renderIcon = false,
}: ChipPickerProps<T>) {
  const [query, setQuery] = useState("");

  // Filter out selected, then optionally narrow by query.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((c) => {
      if (selectedNames.has(c.name)) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    });
  }, [pool, selectedNames, query]);

  // Group by category, preserving the order categories first appear in
  // the (server-sorted) pool.
  const grouped = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const c of visible) {
      const list = map.get(c.category);
      if (list) list.push(c);
      else map.set(c.category, [c]);
    }
    return Array.from(map.entries());
  }, [visible]);

  return (
    <div className="rounded-lg border border-line bg-surface3/40">
      {/* Search bar */}
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Search className="h-4 w-4 text-mid" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-fog"
        />
        <button
          type="button"
          onClick={onAddCustom}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs text-rust hover:bg-rust-tint"
        >
          <Plus className="h-3.5 w-3.5" />
          Custom
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto p-3 space-y-3">
        {grouped.length === 0 && (
          <div className="flex items-center justify-between gap-3 py-4 text-sm text-mid">
            <span>No matches.</span>
            <button
              type="button"
              onClick={onAddCustom}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs text-rust hover:bg-rust-tint"
            >
              <Plus className="h-3.5 w-3.5" />
              Add custom
            </button>
          </div>
        )}

        {grouped.map(([category, chips]) => (
          <details key={category} open className="group">
            <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wider text-mid mb-1.5 select-none">
              {category}{" "}
              <span className="ml-1 font-normal text-fog">({chips.length})</span>
            </summary>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip.name}
                  type="button"
                  onClick={() => onPick(chip)}
                  className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink hover:bg-rust-tint hover:text-rust hover:border-rust/20 transition-colors"
                >
                  {renderIcon && chip.icon ? `${chip.icon} ` : ""}
                  {chip.name}
                </button>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
