// lib/storage/image-presets.ts
import type { TransformOpts } from "./provider";

export const IMAGE_PRESETS = {
  thumbnail: { width: 400, quality: 70, format: "auto" },
  card:      { width: 800, quality: 75, format: "auto" },
  hero:      { width: 1920, quality: 80, format: "auto" },
  full:      { width: 2400, quality: 85, format: "auto" },
} as const satisfies Record<string, TransformOpts>;

export type ImagePreset = keyof typeof IMAGE_PRESETS;
