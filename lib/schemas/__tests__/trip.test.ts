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
