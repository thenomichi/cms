import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { useDerivedTripFields } from "../useDerivedTripFields";
import type { TripFormState } from "../types";

function makeState(overrides: Partial<TripFormState> = {}): TripFormState {
  return {
    trip_name: "", slug: "", trip_type: "Community", trip_sub_type: "",
    trip_category: "", destination_id: "", duration_days: 1, duration_nights: 0,
    start_date: "", end_date: "", mrp_price: null, selling_price: null,
    discount_pct: null, quoted_price: null, advance_pct: 50, total_slots: null,
    batch_number: "", group_slug: null, departure_city: "", departure_airport: "",
    booking_kind: "trip", currency_code: "INR",
    overview: "", description: "", tagline: "", highlights: [],
    itinerary: [], inclusions: [], exclusions: [],
    status: "Draft", is_listed: false, show_on_homepage: false,
    dossier_url: "",
    ...overrides,
  };
}

function useTestHarness(initial: TripFormState) {
  const [form, setForm] = useState(initial);
  useDerivedTripFields(form, setForm);
  return { form, setForm };
}

describe("useDerivedTripFields — end_date", () => {
  it("recomputes end_date when duration_days changes after start_date is set", () => {
    const { result } = renderHook(() =>
      useTestHarness(makeState({ start_date: "2026-06-01", duration_days: 3 })),
    );
    expect(result.current.form.end_date).toBe("2026-06-03");
    act(() => {
      result.current.setForm((p) => ({ ...p, duration_days: 7 }));
    });
    expect(result.current.form.end_date).toBe("2026-06-07");
  });

  it("recomputes end_date when start_date changes after duration is set", () => {
    const { result } = renderHook(() =>
      useTestHarness(makeState({ duration_days: 5 })),
    );
    act(() => {
      result.current.setForm((p) => ({ ...p, start_date: "2026-07-10" }));
    });
    expect(result.current.form.end_date).toBe("2026-07-14");
  });

  it("clears end_date when start_date is cleared", () => {
    const { result } = renderHook(() =>
      useTestHarness(makeState({ start_date: "2026-06-01", duration_days: 3, end_date: "2026-06-03" })),
    );
    act(() => {
      result.current.setForm((p) => ({ ...p, start_date: "" }));
    });
    expect(result.current.form.end_date).toBe("");
  });

  it("does not loop — stable end_date does not retrigger setForm", () => {
    let renderCount = 0;
    const { rerender } = renderHook(() => {
      renderCount++;
      return useTestHarness(makeState({ start_date: "2026-06-01", duration_days: 3 }));
    });
    rerender();
    rerender();
    expect(renderCount).toBeLessThanOrEqual(4);
  });
});
