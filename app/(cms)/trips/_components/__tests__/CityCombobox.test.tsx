import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CityCombobox } from "../CityCombobox";
import type { DbDepartureCity } from "@/lib/types";

const cities: DbDepartureCity[] = [
  { departure_city_id: "DEL", city_name: "Delhi", country_code: "IN", country_name: "India", is_popular: true, is_active: true, display_order: 0, created_at: "", updated_at: "" },
  { departure_city_id: "BKK", city_name: "Bangkok", country_code: "TH", country_name: "Thailand", is_popular: true, is_active: true, display_order: 0, created_at: "", updated_at: "" },
  { departure_city_id: "MAA", city_name: "Chennai", country_code: "IN", country_name: "India", is_popular: false, is_active: true, display_order: 0, created_at: "", updated_at: "" },
];

describe("CityCombobox", () => {
  it("shows the current value when one is set", () => {
    render(<CityCombobox value="Delhi" onChange={() => {}} cities={cities} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Delhi");
  });

  it("shows placeholder when value is empty", () => {
    render(<CityCombobox value="" onChange={() => {}} cities={cities} />);
    expect(screen.getByRole("combobox")).toHaveTextContent(/select departure city/i);
  });

  it("opens the listbox on click and shows popular cities first", async () => {
    render(<CityCombobox value="" onChange={() => {}} cities={cities} />);
    await userEvent.click(screen.getByRole("combobox"));
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent(/Delhi/);
    expect(options[1]).toHaveTextContent(/Bangkok/);
    expect(options[2]).toHaveTextContent(/Chennai/);
  });

  it("filters by city name", async () => {
    render(<CityCombobox value="" onChange={() => {}} cities={cities} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(screen.getByPlaceholderText(/search/i), "che");
    const options = screen.getAllByRole("option");
    // Real match is present (Add-new option also renders alongside).
    expect(options[0]).toHaveTextContent("Chennai");
    // And the Add-new prompt is offered for the typed query.
    expect(screen.getByText(/Add "che"/i)).toBeInTheDocument();
  });

  it("filters by country name (case-insensitive)", async () => {
    render(<CityCombobox value="" onChange={() => {}} cities={cities} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(screen.getByPlaceholderText(/search/i), "thailand");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("Bangkok");
  });

  it("offers 'Add new' even when partial matches exist", async () => {
    render(<CityCombobox value="" onChange={() => {}} cities={cities} />);
    await userEvent.click(screen.getByRole("combobox"));
    // "Bang" matches Bangkok — but the user can still add a new city.
    await userEvent.type(screen.getByPlaceholderText(/search/i), "Bang");
    expect(screen.getByText(/Bangkok/)).toBeInTheDocument();
    expect(screen.getByText(/Add "Bang"/i)).toBeInTheDocument();
  });

  it("does not show Popular tags in the dropdown", async () => {
    render(<CityCombobox value="" onChange={() => {}} cities={cities} />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByText(/Popular/i)).not.toBeInTheDocument();
  });

  it("selecting an option calls onChange with the city_name", async () => {
    const onChange = vi.fn();
    render(<CityCombobox value="" onChange={onChange} cities={cities} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByText("Chennai"));
    expect(onChange).toHaveBeenCalledWith("Chennai");
  });

  it("shows 'Add new city' option when search has no match", async () => {
    render(<CityCombobox value="" onChange={() => {}} cities={cities} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(screen.getByPlaceholderText(/search/i), "Pokhara");
    expect(screen.getByText(/Add "Pokhara"/i)).toBeInTheDocument();
  });

  it("preserves a legacy free-text value not in the list", () => {
    render(<CityCombobox value="Mysore" onChange={() => {}} cities={cities} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Mysore");
  });
});
