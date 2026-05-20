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
    mrp_per_pax: 50000,
    price_per_pax: 45000,
    discount_pct: 10,
    discount_amount: null as number | null,
    discount_mode: "percent" as const,
    is_active: true,
  };
  it("accepts a minimal option (percent mode)", () => {
    expect(variantOptionInputSchema.safeParse(base).success).toBe(true);
  });
  it("accepts an exact-mode option (no discount)", () => {
    expect(
      variantOptionInputSchema.safeParse({
        ...base,
        mrp_per_pax: 45000,
        price_per_pax: 45000,
        discount_pct: 0,
        discount_amount: 0,
        discount_mode: "exact",
      }).success,
    ).toBe(true);
  });
  it("rejects selling > MRP", () => {
    expect(
      variantOptionInputSchema.safeParse({ ...base, price_per_pax: 55000 }).success,
    ).toBe(false);
  });
  it("rejects empty label", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, option_label: "" }).success).toBe(false);
  });
  it("rejects negative MRP", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, mrp_per_pax: -1 }).success).toBe(false);
  });
  it("rejects non-integer MRP", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, mrp_per_pax: 50000.5 }).success).toBe(false);
  });
  it("rejects MRP > 1_000_000", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, mrp_per_pax: 1_000_001 }).success).toBe(false);
  });
  it("rejects discount_pct > 99", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, discount_pct: 100 }).success).toBe(false);
  });
  it("rejects active option with MRP=0", () => {
    expect(
      variantOptionInputSchema.safeParse({
        ...base,
        mrp_per_pax: 0,
        price_per_pax: 0,
        is_active: true,
      }).success,
    ).toBe(false);
  });
  it("accepts inactive option with MRP=0 (placeholder for later)", () => {
    expect(
      variantOptionInputSchema.safeParse({
        ...base,
        mrp_per_pax: 0,
        price_per_pax: 0,
        discount_pct: 0,
        discount_mode: "exact",
        is_active: false,
      }).success,
    ).toBe(true);
  });
});
