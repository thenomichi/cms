// tests/lib/storage/image-presets.test.ts
import { describe, it, expect } from "vitest";
import { IMAGE_PRESETS } from "@/lib/storage/image-presets";

describe("IMAGE_PRESETS", () => {
  it("declares the four standard presets", () => {
    for (const k of ["thumbnail", "card", "hero", "full"] as const) {
      expect(IMAGE_PRESETS[k]).toBeDefined();
    }
  });

  it("widths increase from thumbnail to full", () => {
    expect(IMAGE_PRESETS.thumbnail.width).toBeLessThan(IMAGE_PRESETS.card.width);
    expect(IMAGE_PRESETS.card.width).toBeLessThan(IMAGE_PRESETS.hero.width);
    expect(IMAGE_PRESETS.hero.width).toBeLessThan(IMAGE_PRESETS.full.width);
  });

  it("quality is in valid range", () => {
    for (const v of Object.values(IMAGE_PRESETS)) {
      expect(v.quality).toBeGreaterThanOrEqual(50);
      expect(v.quality).toBeLessThanOrEqual(95);
    }
  });
});
