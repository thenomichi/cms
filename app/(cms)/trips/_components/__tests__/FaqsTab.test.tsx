import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FaqsTab } from "../tabs/FaqsTab";
import type { TripFormState } from "../types";

function makeForm(faqs: TripFormState["faqs"] = []): TripFormState {
  return {
    trip_name: "", slug: "", trip_type: "Community", trip_sub_type: "",
    trip_category: "", destination_id: "", duration_days: 1, duration_nights: 0,
    start_date: "", end_date: "", mrp_price: null, selling_price: null,
    discount_pct: null, discount_amount: null, quoted_price: null,
    advance_pct: 50, total_slots: null,
    batch_number: "", group_slug: null, departure_city: "", departure_airport: "",
    booking_kind: "trip", currency_code: "INR",
    overview: "", tagline: "", highlights: [],
    itinerary: [], inclusions: [], exclusions: [], faqs,
    status: "Draft", is_listed: false, show_on_homepage: false,
    dossier_url: "",
  };
}

describe("FaqsTab", () => {
  it("shows empty state when no FAQs", () => {
    const updateField = vi.fn();
    render(<FaqsTab form={makeForm()} updateField={updateField} />);
    expect(screen.getByText(/No FAQs yet/i)).toBeInTheDocument();
  });

  it("Add FAQ pushes a blank row", async () => {
    const updateField = vi.fn();
    render(<FaqsTab form={makeForm()} updateField={updateField} />);
    await userEvent.click(screen.getByRole("button", { name: /Add FAQ/i }));
    expect(updateField).toHaveBeenCalledWith("faqs", [
      { question: "", answer: "", category: null },
    ]);
  });

  it("renders existing FAQs", () => {
    const updateField = vi.fn();
    render(
      <FaqsTab
        form={makeForm([{ question: "Q1", answer: "A1", category: null }])}
        updateField={updateField}
      />,
    );
    expect(screen.getByDisplayValue("Q1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A1")).toBeInTheDocument();
  });

  it("editing question updates form state", async () => {
    const updateField = vi.fn();
    render(
      <FaqsTab
        form={makeForm([{ question: "Q1", answer: "A1", category: null }])}
        updateField={updateField}
      />,
    );
    const input = screen.getByDisplayValue("Q1");
    await userEvent.type(input, "?");
    expect(updateField).toHaveBeenLastCalledWith("faqs", [
      { question: "Q1?", answer: "A1", category: null },
    ]);
  });

  it("Remove drops the row", async () => {
    const updateField = vi.fn();
    render(
      <FaqsTab
        form={makeForm([
          { question: "Q1", answer: "A1", category: null },
          { question: "Q2", answer: "A2", category: null },
        ])}
        updateField={updateField}
      />,
    );
    const removeButtons = screen.getAllByRole("button", { name: /Remove/i });
    await userEvent.click(removeButtons[0]);
    expect(updateField).toHaveBeenCalledWith("faqs", [
      { question: "Q2", answer: "A2", category: null },
    ]);
  });
});
