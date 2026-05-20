"use client";

import { useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { Button } from "@/components/ui/Button";
import { FilterPills } from "@/components/ui/FilterPills";
import { VARIANT_AXIS_PRESETS, type VariantAxisPresetKey } from "./variant-presets";

export interface AxisPresetResult {
  axis_label: string;
  axis_description: string;
  starter_options: Array<{ label: string; price: number }>;
}

export type AddAxisResult = AxisPresetResult;

interface AddVariantAxisModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (preset: AddAxisResult) => void;
  /**
   * Axis keys already used on this trip group. Presets in this list are
   * hidden — a group can only ever have one "Room sharing" axis.
   */
  usedAxisKeys: string[];
}

export function AddVariantAxisModal({
  open,
  onClose,
  onAdd,
  usedAxisKeys,
}: AddVariantAxisModalProps) {
  const availablePresets = (Object.keys(VARIANT_AXIS_PRESETS) as VariantAxisPresetKey[]).filter(
    (k) => !usedAxisKeys.includes(VARIANT_AXIS_PRESETS[k].axis_key),
  );
  const [selected, setSelected] = useState<VariantAxisPresetKey | "">(
    availablePresets[0] ?? "",
  );

  const handleAdd = () => {
    if (!selected) return;
    const preset = VARIANT_AXIS_PRESETS[selected];
    onAdd({
      axis_label: preset.axis_label,
      axis_description: preset.axis_description,
      starter_options: preset.starter_options.slice(0, 2),
    });
    setSelected(availablePresets[0] ?? "");
    onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Add a price choice"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!selected}>Add</Button>
        </>
      }
    >
      <div className="space-y-4">
        {availablePresets.length === 0 ? (
          <p className="text-sm text-mid">
            All available price choices are already set up on this trip group.
          </p>
        ) : (
          <>
            <p className="text-sm text-mid">What kind of choice?</p>
            <FilterPills
              options={availablePresets.map((k) => ({
                value: k,
                label: VARIANT_AXIS_PRESETS[k].axis_label,
              }))}
              value={selected || availablePresets[0]}
              onChange={(v) => setSelected(v as VariantAxisPresetKey)}
            />
          </>
        )}
      </div>
    </FormModal>
  );
}
