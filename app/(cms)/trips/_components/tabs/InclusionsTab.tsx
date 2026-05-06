"use client";

import { useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { Button } from "@/components/ui/Button";
import { SortableList } from "@/components/ui/SortableList";
import { INCLUSION_REPOSITORY, EXCLUSION_REPOSITORY } from "@/lib/constants";
import type { TripFormState } from "../types";
import type { InclusionInput, ExclusionInput } from "@/lib/db/trip-inclusions";

const INPUT =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";
const SELECT =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";

interface InclusionsTabProps {
  form: TripFormState;
  updateField: <K extends keyof TripFormState>(key: K, val: TripFormState[K]) => void;
}

// Wrap items with stable IDs for dnd-kit
type InclusionWithId = InclusionInput & { _id: string };
type ExclusionWithId = ExclusionInput & { _id: string };

export function InclusionsTab({ form, updateField }: InclusionsTabProps) {
  const { inclusions, exclusions } = form;

  // Add stable IDs
  const inclusionsWithIds: InclusionWithId[] = inclusions.map((item, idx) => ({
    ...item,
    _id: `inc-${idx}`,
  }));
  const exclusionsWithIds: ExclusionWithId[] = exclusions.map((item, idx) => ({
    ...item,
    _id: `exc-${idx}`,
  }));

  // --- Inclusion helpers ---
  function updateInclusion(index: number, patch: Partial<InclusionInput>) {
    const next = [...inclusions];
    next[index] = { ...next[index], ...patch };
    updateField("inclusions", next);
  }

  function addInclusion() {
    updateField("inclusions", [...inclusions, { icon: "", name: "", note: "" }]);
  }

  function addFromRepository(item: { icon: string; name: string }) {
    if (inclusions.some((inc) => inc.name === item.name)) return;
    updateField("inclusions", [...inclusions, { icon: item.icon, name: item.name, note: "" }]);
  }

  function removeInclusion(index: number) {
    updateField("inclusions", inclusions.filter((_, i) => i !== index));
  }

  const handleReorderInclusions = useCallback(
    (reordered: InclusionWithId[]) => {
      updateField("inclusions", reordered.map(({ _id, ...rest }) => rest));
    },
    [updateField],
  );

  // --- Exclusion helpers ---
  function updateExclusion(index: number, patch: Partial<ExclusionInput>) {
    const next = [...exclusions];
    next[index] = { ...next[index], ...patch };
    updateField("exclusions", next);
  }

  function addExclusion() {
    updateField("exclusions", [...exclusions, { name: "" }]);
  }

  function addExclusionFromRepository(name: string) {
    if (exclusions.some((exc) => exc.name === name)) return;
    updateField("exclusions", [...exclusions, { name }]);
  }

  function removeExclusion(index: number) {
    updateField("exclusions", exclusions.filter((_, i) => i !== index));
  }

  const handleReorderExclusions = useCallback(
    (reordered: ExclusionWithId[]) => {
      updateField("exclusions", reordered.map(({ _id, ...rest }) => rest));
    },
    [updateField],
  );

  return (
    <div className="space-y-8">
      {/* ═══ Inclusions ═══ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Inclusions</h3>
          <Button variant="secondary" size="sm" onClick={addInclusion}>
            <Plus className="h-3.5 w-3.5" />
            Custom
          </Button>
        </div>

        {/* Quick-add from repository */}
        <div className="flex flex-wrap gap-1.5">
          {INCLUSION_REPOSITORY.map((item) => {
            const alreadyAdded = inclusions.some((inc) => inc.name === item.name);
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => addFromRepository(item)}
                disabled={alreadyAdded}
                className={
                  alreadyAdded
                    ? "rounded-lg px-2.5 py-1 text-xs bg-surface3 text-fog cursor-not-allowed"
                    : "rounded-lg px-2.5 py-1 text-xs bg-surface3 text-ink border border-line hover:bg-rust-tint hover:text-rust hover:border-rust/20 transition-colors"
                }
              >
                {item.icon} {item.name}
              </button>
            );
          })}
        </div>

        {/* Sortable inclusions list */}
        {inclusionsWithIds.length > 0 && (
          <SortableList
            items={inclusionsWithIds}
            getId={(item) => item._id}
            onReorder={handleReorderInclusions}
            renderItem={(item) => {
              const idx = inclusions.findIndex(
                (inc) => inc.name === item.name && inc.icon === item.icon,
              );
              return (
                <div className="flex flex-1 items-start gap-2">
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                    <FormField label="Icon">
                      <EmojiPicker
                        value={item.icon ?? ""}
                        onChange={(v) => updateInclusion(idx, { icon: v || null })}
                      />
                    </FormField>
                    <FormField label="Name" required>
                      <input
                        type="text"
                        className={INPUT}
                        value={item.name}
                        onChange={(e) => updateInclusion(idx, { name: e.target.value })}
                        placeholder="e.g. Breakfast"
                      />
                    </FormField>
                    <FormField label="Note">
                      <input
                        type="text"
                        className={INPUT}
                        value={item.note ?? ""}
                        onChange={(e) => updateInclusion(idx, { note: e.target.value || null })}
                        placeholder="Optional note"
                      />
                    </FormField>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInclusion(idx)}
                    className="mt-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mid hover:bg-sem-red-bg hover:text-sem-red transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            }}
          />
        )}
      </div>

      <hr className="border-line" />

      {/* ═══ Exclusions ═══ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Exclusions</h3>
          <Button variant="secondary" size="sm" onClick={addExclusion}>
            <Plus className="h-3.5 w-3.5" />
            Custom
          </Button>
        </div>

        {/* Quick-add from repository */}
        <div className="flex flex-wrap gap-1.5">
          {EXCLUSION_REPOSITORY.map((name) => {
            const alreadyAdded = exclusions.some((exc) => exc.name === name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => addExclusionFromRepository(name)}
                disabled={alreadyAdded}
                className={
                  alreadyAdded
                    ? "rounded-lg px-2.5 py-1 text-xs bg-surface3 text-fog cursor-not-allowed"
                    : "rounded-lg px-2.5 py-1 text-xs bg-surface3 text-ink border border-line hover:bg-sem-red-bg hover:text-sem-red hover:border-sem-red/20 transition-colors"
                }
              >
                {name}
              </button>
            );
          })}
        </div>

        {/* Sortable exclusions list */}
        {exclusionsWithIds.length > 0 && (
          <SortableList
            items={exclusionsWithIds}
            getId={(item) => item._id}
            onReorder={handleReorderExclusions}
            renderItem={(item) => {
              const idx = exclusions.findIndex((exc) => exc.name === item.name);
              return (
                <div className="flex flex-1 items-center gap-2">
                  <div className="flex-1">
                    <FormField label="Name" required>
                      <select
                        className={SELECT}
                        value={item.name}
                        onChange={(e) => updateExclusion(idx, { name: e.target.value })}
                      >
                        <option value="">Select or type...</option>
                        {EXCLUSION_REPOSITORY.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExclusion(idx)}
                    className="mt-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mid hover:bg-sem-red-bg hover:text-sem-red transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
