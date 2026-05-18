"use client";

import { useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { Button } from "@/components/ui/Button";
import { FilterPills } from "@/components/ui/FilterPills";

export interface AxisPresetResult {
  axis_label: string;
  axis_description: string;
  starter_options: Array<{ label: string; price: number }>;
}

export type AddAxisResult = AxisPresetResult | { custom: true; axis_label: string };

const PRESETS: Record<string, AxisPresetResult> = {
  room_sharing: {
    axis_label: "Room sharing",
    axis_description: "Pick how you'd like to share your room",
    starter_options: [
      { label: "Double sharing", price: 0 },
      { label: "Triple sharing", price: 0 },
    ],
  },
  travel_mode: {
    axis_label: "Travel mode",
    axis_description: "Choose how you'd like to travel",
    starter_options: [
      { label: "Tempo traveller", price: 0 },
      { label: "Self drive", price: 0 },
    ],
  },
  departure_city: {
    axis_label: "Departure city",
    axis_description: "Where will you start your journey from?",
    starter_options: [
      { label: "Delhi", price: 0 },
      { label: "Mumbai", price: 0 },
    ],
  },
  trek_difficulty: {
    axis_label: "Trek difficulty",
    axis_description: "Pick your preferred difficulty level",
    starter_options: [
      { label: "Moderate", price: 0 },
      { label: "Challenging", price: 0 },
    ],
  },
};

interface AddVariantAxisModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (preset: AddAxisResult) => void;
}

export function AddVariantAxisModal({ open, onClose, onAdd }: AddVariantAxisModalProps) {
  const [selected, setSelected] = useState("room_sharing");
  const [customLabel, setCustomLabel] = useState("");

  const handleAdd = () => {
    if (selected === "custom") {
      const trimmed = customLabel.trim();
      if (!trimmed) return;
      onAdd({ custom: true, axis_label: trimmed });
    } else {
      onAdd(PRESETS[selected]);
    }
    setSelected("room_sharing");
    setCustomLabel("");
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
          <Button onClick={handleAdd}>Add</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-mid">What kind of choice?</p>
        <FilterPills
          options={[
            { value: "room_sharing", label: "Room sharing" },
            { value: "travel_mode", label: "Travel mode" },
            { value: "departure_city", label: "Departure city" },
            { value: "trek_difficulty", label: "Trek difficulty" },
            { value: "custom", label: "Custom…" },
          ]}
          value={selected}
          onChange={setSelected}
        />
        {selected === "custom" && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-mid">Label</label>
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="e.g. Add-on activity"
              maxLength={60}
              className="w-full rounded-lg border border-line bg-surface3 px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>
    </FormModal>
  );
}
