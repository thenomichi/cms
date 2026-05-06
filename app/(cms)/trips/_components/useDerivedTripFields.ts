import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TripFormState } from "./types";

/**
 * Centralizes derived-field calculations so they can't go stale.
 * Consumers pass the form state and its setter; this hook keeps
 * end_date and selling_price in sync with their inputs.
 */
export function useDerivedTripFields(
  form: TripFormState,
  setForm: Dispatch<SetStateAction<TripFormState>>,
) {
  // end_date <- start_date + duration_days
  useEffect(() => {
    if (!form.start_date) {
      if (form.end_date !== "") {
        setForm((prev) => ({ ...prev, end_date: "" }));
      }
      return;
    }
    if (form.duration_days <= 0) return;
    const end = new Date(form.start_date);
    end.setDate(end.getDate() + form.duration_days - 1);
    const newEnd = end.toISOString().split("T")[0];
    if (newEnd !== form.end_date) {
      setForm((prev) => ({ ...prev, end_date: newEnd }));
    }
  }, [form.start_date, form.duration_days, form.end_date, setForm]);

  // selling_price <- mrp_price minus (discount_pct OR discount_amount)
  // Pct takes precedence if both are set (defensive — DB CHECK enforces either/or).
  useEffect(() => {
    const mrp = form.mrp_price;
    if (mrp == null) return;
    let selling = mrp;
    if (form.discount_pct && form.discount_pct > 0) {
      selling = Math.round(mrp * (1 - form.discount_pct / 100));
    } else if (form.discount_amount && form.discount_amount > 0) {
      selling = Math.max(0, mrp - form.discount_amount);
    }
    if (selling !== form.selling_price) {
      setForm((prev) => ({ ...prev, selling_price: selling }));
    }
  }, [form.mrp_price, form.discount_pct, form.discount_amount, form.selling_price, setForm]);
}
