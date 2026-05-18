import { describe, expect, it } from "vitest";
import { variantAxisInputSchema, variantOptionInputSchema } from "@/lib/schemas/trip-variants";

describe("variantAxisInputSchema", () => {
  it("accepts a minimal axis", () => {
    const r = variantAxisInputSchema.safeParse({
      axis_label: "Room sharing",
      axis_description: "Pick how you'd like to share your room",
      is_required: true,
    });
    expect(r.success).toBe(true);
  });
  it("rejects empty label", () => {
    expect(
      variantAxisInputSchema.safeParse({
        axis_label: "",
        axis_description: null,
        is_required: true,
      }).success,
    ).toBe(false);
  });
  it("allows null description", () => {
    expect(
      variantAxisInputSchema.safeParse({
        axis_label: "Room sharing",
        axis_description: null,
        is_required: true,
      }).success,
    ).toBe(true);
  });
});

describe("variantOptionInputSchema", () => {
  const base = {
    option_label: "Double sharing",
    option_sublabel: null as string | null,
    price_per_pax: 45000,
    is_active: true,
  };
  it("accepts a minimal option", () => {
    expect(variantOptionInputSchema.safeParse(base).success).toBe(true);
  });
  it("rejects empty label", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, option_label: "" }).success).toBe(false);
  });
  it("rejects negative price", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, price_per_pax: -1 }).success).toBe(false);
  });
  it("rejects non-integer price", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, price_per_pax: 45000.5 }).success).toBe(false);
  });
  it("rejects price > 1_000_000", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, price_per_pax: 1_000_001 }).success).toBe(false);
  });
  it("accepts price = 0", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, price_per_pax: 0 }).success).toBe(true);
  });
});
