"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { DbInclusionChip, DbExclusion } from "@/lib/types";
import { addInclusionChipAction } from "@/app/(cms)/inclusion-chips/actions";
import { addExclusionAction } from "@/app/(cms)/exclusions/actions";

const CUSTOM_CATEGORY_VALUE = "__custom__";

type AddChipModalProps =
  | {
      mode: "inclusion";
      existingCategories: string[];
      onClose: () => void;
      onAdded: (chip: DbInclusionChip) => void;
    }
  | {
      mode: "exclusion";
      existingCategories: string[];
      onClose: () => void;
      onAdded: (exclusion: DbExclusion) => void;
    };

export function AddChipModal(props: AddChipModalProps) {
  const { mode, existingCategories, onClose } = props;
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [categoryChoice, setCategoryChoice] = useState<string>(
    existingCategories[0] ?? CUSTOM_CATEGORY_VALUE,
  );
  const [customCategory, setCustomCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resolvedCategory =
    categoryChoice === CUSTOM_CATEGORY_VALUE
      ? customCategory.trim()
      : categoryChoice;

  const canSubmit =
    name.trim().length >= 2 &&
    resolvedCategory.length >= 1 &&
    (mode === "exclusion" || icon.trim().length >= 1);

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      if (mode === "inclusion") {
        const res = await addInclusionChipAction({
          name: name.trim(),
          icon: icon.trim(),
          category: resolvedCategory,
        });
        if (res.success && res.chip) {
          props.onAdded(res.chip);
        } else {
          toast.error(res.error ?? "Failed to add chip");
        }
      } else {
        const res = await addExclusionAction({
          name: name.trim(),
          category: resolvedCategory,
        });
        if (res.success && res.exclusion) {
          props.onAdded(res.exclusion);
        } else {
          toast.error(res.error ?? "Failed to add exclusion");
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    mode === "inclusion" ? "Add a new inclusion" : "Add a new exclusion";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-xl">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-mid">
              Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                mode === "inclusion" ? "e.g. Hot Air Balloon" : "e.g. Tips"
              }
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust/20"
              autoFocus
            />
          </label>

          {mode === "inclusion" && (
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-mid">
                Icon (emoji)
              </span>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🎯"
                className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust/20"
              />
              <span className="mt-1 block text-[11px] text-fog">
                Paste an emoji from your OS picker.
              </span>
            </label>
          )}

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-mid">
              Category
            </span>
            <select
              value={categoryChoice}
              onChange={(e) => setCategoryChoice(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust/20"
            >
              {existingCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value={CUSTOM_CATEGORY_VALUE}>+ New category…</option>
            </select>
          </label>

          {categoryChoice === CUSTOM_CATEGORY_VALUE && (
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-mid">
                New category name
              </span>
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="e.g. Wellness"
                className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust/20"
              />
            </label>
          )}
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
            disabled={!canSubmit || submitting}
            className="rounded-lg bg-rust px-3 py-1.5 text-sm font-medium text-white hover:bg-rust/90 disabled:opacity-50"
          >
            {submitting ? "Adding…" : mode === "inclusion" ? "Add chip" : "Add exclusion"}
          </button>
        </div>
      </div>
    </div>
  );
}
