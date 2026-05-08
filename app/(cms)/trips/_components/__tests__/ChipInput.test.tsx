import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChipInput } from "../ChipInput";

describe("ChipInput", () => {
  it("renders existing chips", () => {
    render(<ChipInput value={["Trekking", "Photography"]} onChange={() => {}} />);
    expect(screen.getByText("Trekking")).toBeInTheDocument();
    expect(screen.getByText("Photography")).toBeInTheDocument();
  });

  it("shows placeholder when empty", () => {
    render(<ChipInput value={[]} onChange={() => {}} placeholder="Add a tag" />);
    expect(screen.getByPlaceholderText("Add a tag")).toBeInTheDocument();
  });

  it("commits a chip on Enter", async () => {
    const onChange = vi.fn();
    render(<ChipInput value={[]} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "Trekking{Enter}");
    expect(onChange).toHaveBeenCalledWith(["Trekking"]);
  });

  it("commits a chip on comma", async () => {
    const onChange = vi.fn();
    render(<ChipInput value={[]} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "Trekking,");
    expect(onChange).toHaveBeenCalledWith(["Trekking"]);
  });

  it("ignores duplicate chips", async () => {
    const onChange = vi.fn();
    render(<ChipInput value={["Trekking"]} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "Trekking{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("trims whitespace on commit", async () => {
    const onChange = vi.fn();
    render(<ChipInput value={[]} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "  Trekking  {Enter}");
    expect(onChange).toHaveBeenCalledWith(["Trekking"]);
  });

  it("removes a chip via the × button", async () => {
    const onChange = vi.fn();
    render(<ChipInput value={["Trekking", "Photography"]} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Remove Trekking"));
    expect(onChange).toHaveBeenCalledWith(["Photography"]);
  });

  it("Backspace on empty input removes the last chip", async () => {
    const onChange = vi.fn();
    render(<ChipInput value={["Trekking", "Photography"]} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await userEvent.click(input);
    await userEvent.keyboard("{Backspace}");
    expect(onChange).toHaveBeenCalledWith(["Trekking"]);
  });

  it("respects maxChips cap", async () => {
    const onChange = vi.fn();
    render(<ChipInput value={["A", "B", "C"]} onChange={onChange} maxChips={3} />);
    await userEvent.type(screen.getByRole("textbox"), "D{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits on blur", async () => {
    const onChange = vi.fn();
    render(<ChipInput value={[]} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "Trekking");
    input.blur();
    expect(onChange).toHaveBeenCalledWith(["Trekking"]);
  });
});
