import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExclusionCombobox } from "../ExclusionCombobox";
import type { DbExclusion } from "@/lib/types";

const exclusions: DbExclusion[] = [
  { exclusion_id: "personal-expenses", name: "Personal expenses", is_popular: true, is_active: true, display_order: 0, created_at: "", updated_at: "" },
  { exclusion_id: "visa-fees", name: "Visa fees", is_popular: true, is_active: true, display_order: 0, created_at: "", updated_at: "" },
  { exclusion_id: "laundry", name: "Laundry", is_popular: false, is_active: true, display_order: 0, created_at: "", updated_at: "" },
];

describe("ExclusionCombobox", () => {
  it("shows the current value when one is set", () => {
    render(<ExclusionCombobox value="Personal expenses" onChange={() => {}} exclusions={exclusions} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Personal expenses");
  });

  it("shows placeholder when value is empty", () => {
    render(<ExclusionCombobox value="" onChange={() => {}} exclusions={exclusions} />);
    expect(screen.getByRole("combobox")).toHaveTextContent(/select an exclusion/i);
  });

  it("opens the listbox on click and shows popular entries first", async () => {
    render(<ExclusionCombobox value="" onChange={() => {}} exclusions={exclusions} />);
    await userEvent.click(screen.getByRole("combobox"));
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent(/Personal expenses/);
    expect(options[1]).toHaveTextContent(/Visa fees/);
    expect(options[2]).toHaveTextContent(/Laundry/);
  });

  it("filters by name (case-insensitive)", async () => {
    render(<ExclusionCombobox value="" onChange={() => {}} exclusions={exclusions} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(screen.getByPlaceholderText(/search/i), "laun");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Laundry");
  });

  it("selecting an option calls onChange with the name", async () => {
    const onChange = vi.fn();
    render(<ExclusionCombobox value="" onChange={onChange} exclusions={exclusions} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByText("Laundry"));
    expect(onChange).toHaveBeenCalledWith("Laundry");
  });

  it("shows 'Add new exclusion' option when search has no match", async () => {
    render(<ExclusionCombobox value="" onChange={() => {}} exclusions={exclusions} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(screen.getByPlaceholderText(/search/i), "Drone fees");
    expect(screen.getByText(/Add "Drone fees"/i)).toBeInTheDocument();
  });

  it("preserves a legacy free-text value not in the list", () => {
    render(<ExclusionCombobox value="Some legacy item" onChange={() => {}} exclusions={exclusions} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Some legacy item");
  });
});
