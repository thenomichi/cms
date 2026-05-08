"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { DbExclusion } from "@/lib/types";
import { addExclusionAction } from "@/app/(cms)/exclusions/actions";

interface ExclusionComboboxProps {
  value: string;
  onChange: (name: string) => void;
  exclusions: DbExclusion[];
  placeholder?: string;
}

export function ExclusionCombobox({
  value,
  onChange,
  exclusions,
  placeholder = "Select an exclusion",
}: ExclusionComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...exclusions].sort((a, b) => {
      if (a.is_popular !== b.is_popular) return a.is_popular ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    if (!q) return sorted;
    return sorted.filter((e) => e.name.toLowerCase().includes(q));
  }, [exclusions, query]);

  const exactMatch = useMemo(
    () =>
      filtered.some(
        (e) => e.name.toLowerCase() === query.trim().toLowerCase(),
      ),
    [filtered, query],
  );

  const trimmed = query.trim();

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-line bg-surface px-3 text-left text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20"
      >
        <span className={value ? "" : "text-fog"}>{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 text-mid" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search className="h-4 w-4 text-mid" />
            <input
              autoFocus
              placeholder="Search exclusions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-fog"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {filtered.map((e) => (
              <li
                key={e.exclusion_id}
                role="option"
                aria-selected={value === e.name}
                onClick={() => {
                  onChange(e.name);
                  setOpen(false);
                  setQuery("");
                }}
                className="cursor-pointer px-3 py-2 text-sm text-ink hover:bg-surface3"
              >
                <span className="font-medium">{e.name}</span>
              </li>
            ))}
            {trimmed && !exactMatch && (
              <li
                role="option"
                onClick={() => setShowAddModal(true)}
                className="flex cursor-pointer items-center gap-2 border-t border-line px-3 py-2 text-sm text-rust hover:bg-surface3"
              >
                <Plus className="h-4 w-4" />
                {`Add "${trimmed}" as a new exclusion`}
              </li>
            )}
          </ul>
        </div>
      )}

      {showAddModal && (
        <AddExclusionModal
          initialName={trimmed}
          onClose={() => setShowAddModal(false)}
          onAdded={(exclusion) => {
            onChange(exclusion.name);
            setShowAddModal(false);
            setOpen(false);
            setQuery("");
            toast.success(`Added ${exclusion.name}`);
          }}
        />
      )}
    </div>
  );
}

interface AddExclusionModalProps {
  initialName: string;
  onClose: () => void;
  onAdded: (exclusion: DbExclusion) => void;
}

function AddExclusionModal({ initialName, onClose, onAdded }: AddExclusionModalProps) {
  const [name, setName] = useState(initialName);
  const [isPopular, setIsPopular] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    const res = await addExclusionAction({
      name: name.trim(),
      is_popular: isPopular,
    });
    setSubmitting(false);
    if (res.success && res.exclusion) {
      onAdded(res.exclusion);
    } else {
      toast.error(res.error ?? "Failed to add exclusion");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-xl">
        <h3 className="text-base font-semibold text-ink">Add a new exclusion</h3>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-mid">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust/20"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={isPopular}
              onChange={(e) => setIsPopular(e.target.checked)}
            />
            Mark as popular
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-mid hover:bg-surface3"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || name.trim().length < 2}
            className="rounded-lg bg-rust px-3 py-1.5 text-sm font-medium text-white hover:bg-rust/90 disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add exclusion"}
          </button>
        </div>
      </div>
    </div>
  );
}
