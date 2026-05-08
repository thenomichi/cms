import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FaqsTab } from "../tabs/FaqsTab";
import type { TripFormState } from "../types";

// jsdom doesn't implement scrollIntoView; stub it so the auto-scroll
// branch of the component runs without throwing in tests.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

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

  it("scrolls and focuses the new FAQ when Add FAQ is clicked", async () => {
    function ControlledHarness({ initial }: { initial: TripFormState["faqs"] }) {
      const [form, setForm] = useState(makeForm(initial));
      const updateField = <K extends keyof TripFormState>(
        key: K,
        value: TripFormState[K],
      ) => setForm((prev) => ({ ...prev, [key]: value }));
      return <FaqsTab form={form} updateField={updateField} />;
    }

    render(
      <ControlledHarness
        initial={[
          { question: "Old Q1", answer: "Old A1", category: null },
          { question: "Old Q2", answer: "Old A2", category: null },
        ]}
      />,
    );
    const scrollSpy = vi.mocked(Element.prototype.scrollIntoView);
    scrollSpy.mockClear();

    await userEvent.click(screen.getByRole("button", { name: /Add FAQ/i }));

    // The new row mounts at index 2. Wait for it to render.
    const newRow = await waitFor(() => {
      const el = document.querySelector('[data-faq-index="2"]');
      if (!el) throw new Error("not yet");
      return el;
    });
    expect(newRow).toBeInTheDocument();
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    // The newly-mounted question input should have focus.
    const focused = document.activeElement as HTMLInputElement | null;
    expect(focused?.tagName).toBe("INPUT");
    expect(focused?.closest('[data-faq-index="2"]')).toBe(newRow);
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
