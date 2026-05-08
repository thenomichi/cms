import { describe, it, expect } from "vitest";
import { tripBasicSchema } from "../trip";

const base = {
  trip_name: "Test trip",
  trip_type: "Community" as const,
  destination_id: null,
  duration_days: 3,
  duration_nights: 2,
  start_date: null,
  end_date: null,
  mrp_price: 10000,
  selling_price: 10000,
  discount_pct: null,
  discount_amount: null,
  quoted_price: null,
  total_slots: null,
  batch_number: null,
};

describe("tripBasicSchema discount refinement", () => {
  it("accepts discount_pct alone", () => {
    const r = tripBasicSchema.safeParse({ ...base, discount_pct: 10 });
    expect(r.success).toBe(true);
  });

  it("accepts discount_amount alone", () => {
    const r = tripBasicSchema.safeParse({ ...base, discount_amount: 500 });
    expect(r.success).toBe(true);
  });

  it("accepts neither", () => {
    const r = tripBasicSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("rejects both set", () => {
    const r = tripBasicSchema.safeParse({ ...base, discount_pct: 10, discount_amount: 500 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/either discount/i);
    }
  });
});

describe("tripBasicSchema robustness against missing/undefined keys", () => {
  // Bug regression: prior to nullableNumber preprocessing, a missing
  // discount_amount key produced "Invalid input: expected number, received NaN"
  // and silently failed saves. Each of these tests exercises a payload shape
  // that older client bundles (or partial autosave payloads) might emit.

  const minimal = {
    trip_name: "Test",
    trip_type: "Community" as const,
    duration_days: 1,
    duration_nights: 0,
  };

  it("accepts a minimal payload with no nullable numeric keys at all", () => {
    const r = tripBasicSchema.safeParse(minimal);
    expect(r.success).toBe(true);
  });

  it("treats missing discount_amount the same as null", () => {
    const r = tripBasicSchema.safeParse({ ...minimal, mrp_price: 10000, discount_pct: null });
    expect(r.success).toBe(true);
  });

  it("treats missing discount_pct the same as null", () => {
    const r = tripBasicSchema.safeParse({ ...minimal, mrp_price: 10000, discount_amount: 500 });
    expect(r.success).toBe(true);
  });

  it("treats NaN as null on numeric fields", () => {
    const r = tripBasicSchema.safeParse({ ...minimal, mrp_price: NaN });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mrp_price).toBeNull();
  });

  it("treats empty string as null on numeric fields", () => {
    const r = tripBasicSchema.safeParse({ ...minimal, mrp_price: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mrp_price).toBeNull();
  });

  it("still enforces min on real numeric values", () => {
    const r = tripBasicSchema.safeParse({ ...minimal, discount_pct: -5 });
    expect(r.success).toBe(false);
  });

  it("still enforces max on real numeric values", () => {
    const r = tripBasicSchema.safeParse({ ...minimal, discount_pct: 200 });
    expect(r.success).toBe(false);
  });
});
