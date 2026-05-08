"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { SortableList } from "@/components/ui/SortableList";
import type { TripFormState } from "../types";
import type { InclusionInput, ExclusionInput } from "@/lib/db/trip-inclusions";
import type { DbExclusion, DbInclusionChip } from "@/lib/types";
import { ChipPicker } from "../ChipPicker";
import { AddChipModal } from "../AddChipModal";

const NOTE_INPUT =
  "h-8 w-full rounded-md border border-line bg-surface px-2.5 text-xs text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";

interface InclusionsTabProps {
  form: TripFormState;
  updateField: <K extends keyof TripFormState>(key: K, val: TripFormState[K]) => void;
  inclusionChips: DbInclusionChip[];
  exclusions: DbExclusion[];
}

// Wrap items with stable IDs for dnd-kit
type InclusionWithId = InclusionInput & { _id: string };
type ExclusionWithId = ExclusionInput & { _id: string };

export function InclusionsTab({
  form,
  updateField,
  inclusionChips,
  exclusions: exclusionsList,
}: InclusionsTabProps) {
  const { inclusions, exclusions } = form;

  // Local pool mirrors so inline-adds reflect without a reload.
  const [localChips, setLocalChips] = useState<DbInclusionChip[]>(inclusionChips);
  useEffect(() => setLocalChips(inclusionChips), [inclusionChips]);
  const [localExclusions, setLocalExclusions] = useState<DbExclusion[]>(exclusionsList);
  useEffect(() => setLocalExclusions(exclusionsList), [exclusionsList]);

  const [addingInclusion, setAddingInclusion] = useState(false);
  const [addingExclusion, setAddingExclusion] = useState(false);

  const selectedInclusionNames = useMemo(
    () => new Set(inclusions.map((i) => i.name)),
    [inclusions],
  );
  const selectedExclusionNames = useMemo(
    () => new Set(exclusions.map((e) => e.name)),
    [exclusions],
  );

  const inclusionCategories = useMemo(
    () => Array.from(new Set(localChips.map((c) => c.category))),
    [localChips],
  );
  const exclusionCategories = useMemo(
    () => Array.from(new Set(localExclusions.map((e) => e.category))),
    [localExclusions],
  );

  // Wrap items with stable IDs
  const inclusionsWithIds: InclusionWithId[] = inclusions.map((item, idx) => ({
    ...item,
    _id: `inc-${idx}`,
  }));
  const exclusionsWithIds: ExclusionWithId[] = exclusions.map((item, idx) => ({
    ...item,
    _id: `exc-${idx}`,
  }));

  // --- Inclusion helpers ---
  function addInclusionFromChip(chip: DbInclusionChip) {
    if (inclusions.some((inc) => inc.name === chip.name)) return;
    updateField("inclusions", [
      ...inclusions,
      { icon: chip.icon, name: chip.name, note: "" },
    ]);
  }

  function removeInclusion(index: number) {
    updateField(
      "inclusions",
      inclusions.filter((_, i) => i !== index),
    );
  }

  function updateInclusionNote(index: number, note: string) {
    updateField(
      "inclusions",
      inclusions.map((it, i) => (i === index ? { ...it, note: note || null } : it)),
    );
  }

  const handleReorderInclusions = useCallback(
    (reordered: InclusionWithId[]) => {
      updateField(
        "inclusions",
        reordered.map(({ _id: _drop, ...rest }) => rest),
      );
    },
    [updateField],
  );

  // --- Exclusion helpers ---
  function addExclusionFromChip(exc: { name: string }) {
    if (exclusions.some((e) => e.name === exc.name)) return;
    updateField("exclusions", [...exclusions, { name: exc.name }]);
  }

  function removeExclusion(index: number) {
    updateField(
      "exclusions",
      exclusions.filter((_, i) => i !== index),
    );
  }

  const handleReorderExclusions = useCallback(
    (reordered: ExclusionWithId[]) => {
      updateField(
        "exclusions",
        reordered.map(({ _id: _drop, ...rest }) => rest),
      );
    },
    [updateField],
  );

  return (
    <div className="space-y-8">
      {/* ═══ Inclusions ═══ */}
      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">
            Inclusions{" "}
            <span className="ml-1 rounded-full bg-surface3 px-2 py-0.5 text-xs font-normal text-mid">
              {inclusions.length}
            </span>
          </h3>
        </header>

        <ChipPicker<DbInclusionChip>
          pool={localChips}
          selectedNames={selectedInclusionNames}
          onPick={addInclusionFromChip}
          onAddCustom={() => setAddingInclusion(true)}
          searchPlaceholder="Search inclusions or pick from the list…"
          renderIcon
        />

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
                <div className="flex flex-1 items-center gap-2">
                  <div className="flex flex-1 items-center gap-2">
                    <span className="inline-flex h-9 min-w-[6.5rem] items-center gap-1.5 rounded-md border border-line bg-surface3 px-2.5 text-sm text-ink">
                      {item.icon ? <span>{item.icon}</span> : null}
                      <span className="truncate">{item.name}</span>
                    </span>
                    <input
                      type="text"
                      className={NOTE_INPUT}
                      value={item.note ?? ""}
                      onChange={(e) => updateInclusionNote(idx, e.target.value)}
                      placeholder="Optional note"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInclusion(idx)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mid hover:bg-sem-red-bg hover:text-sem-red transition-colors"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            }}
          />
        )}
      </section>

      <hr className="border-line" />

      {/* ═══ Exclusions ═══ */}
      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">
            Exclusions{" "}
            <span className="ml-1 rounded-full bg-surface3 px-2 py-0.5 text-xs font-normal text-mid">
              {exclusions.length}
            </span>
          </h3>
        </header>

        <ChipPicker<DbExclusion>
          pool={localExclusions}
          selectedNames={selectedExclusionNames}
          onPick={addExclusionFromChip}
          onAddCustom={() => setAddingExclusion(true)}
          searchPlaceholder="Search exclusions or pick from the list…"
        />

        {exclusionsWithIds.length > 0 && (
          <SortableList
            items={exclusionsWithIds}
            getId={(item) => item._id}
            onReorder={handleReorderExclusions}
            renderItem={(item) => {
              const idx = exclusions.findIndex((exc) => exc.name === item.name);
              return (
                <div className="flex flex-1 items-center gap-2">
                  <span className="inline-flex h-9 flex-1 items-center rounded-md border border-line bg-surface3 px-2.5 text-sm text-ink">
                    <span className="truncate">{item.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeExclusion(idx)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mid hover:bg-sem-red-bg hover:text-sem-red transition-colors"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            }}
          />
        )}
      </section>

      {addingInclusion && (
        <AddChipModal
          mode="inclusion"
          existingCategories={inclusionCategories}
          onClose={() => setAddingInclusion(false)}
          onAdded={(chip) => {
            setLocalChips((prev) =>
              prev.some((c) => c.chip_id === chip.chip_id) ? prev : [...prev, chip],
            );
            addInclusionFromChip(chip);
            setAddingInclusion(false);
          }}
        />
      )}

      {addingExclusion && (
        <AddChipModal
          mode="exclusion"
          existingCategories={exclusionCategories}
          onClose={() => setAddingExclusion(false)}
          onAdded={(exc) => {
            setLocalExclusions((prev) =>
              prev.some((e) => e.exclusion_id === exc.exclusion_id) ? prev : [...prev, exc],
            );
            addExclusionFromChip(exc);
            setAddingExclusion(false);
          }}
        />
      )}
    </div>
  );
}
