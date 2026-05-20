/**
 * Allowlist of supported variant axes and their permitted option labels.
 * Both the "Add a price choice" modal and the per-option editor read from
 * this single source so the founder can never type a free-form label and
 * the website only ever sees values it knows how to render.
 */

export interface VariantAxisPreset {
  /** axis_key written to the DB. Stable across renames of axis_label. */
  axis_key: string;
  axis_label: string;
  axis_description: string;
  /** Permitted option labels for this axis, in display order. */
  allowed_option_labels: readonly string[];
  /** Default starter options (a subset of allowed_option_labels). */
  starter_options: ReadonlyArray<{ label: string; price: number }>;
}

export const VARIANT_AXIS_PRESETS = {
  room_sharing: {
    axis_key: "room_sharing",
    axis_label: "Room sharing",
    axis_description: "Pick how you'd like to share your room",
    allowed_option_labels: ["Double sharing", "Triple sharing"],
    starter_options: [
      { label: "Double sharing", price: 0 },
      { label: "Triple sharing", price: 0 },
    ],
  },
  travel_mode: {
    axis_key: "travel_mode",
    axis_label: "Travel mode",
    axis_description: "Choose how you'd like to travel",
    allowed_option_labels: [
      "Tempo traveller",
      "XL Cab",
      "Car",
      "Solo Bike Ride",
      "Pillion Bike Ride",
    ],
    starter_options: [
      { label: "Tempo traveller", price: 0 },
      { label: "XL Cab", price: 0 },
    ],
  },
} as const satisfies Record<string, VariantAxisPreset>;

export type VariantAxisPresetKey = keyof typeof VARIANT_AXIS_PRESETS;

/**
 * Look up the preset definition for a given axis_key (DB value). Returns
 * undefined for legacy axes that no longer match a known preset — caller
 * should fall back to the option's existing label as the only choice.
 */
export function getPresetByAxisKey(
  axisKey: string,
): VariantAxisPreset | undefined {
  for (const k of Object.keys(VARIANT_AXIS_PRESETS) as VariantAxisPresetKey[]) {
    if (VARIANT_AXIS_PRESETS[k].axis_key === axisKey) {
      return VARIANT_AXIS_PRESETS[k];
    }
  }
  return undefined;
}
