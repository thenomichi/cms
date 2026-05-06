import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumericInput } from "../NumericInput";

function Controlled({
  initial = null,
  onChange,
  ...rest
}: {
  initial?: number | null;
  onChange?: (v: number | null) => void;
  min?: number;
  max?: number;
  allowNull?: boolean;
  showSteppers?: boolean;
  step?: number;
}) {
  const [val, setVal] = useState<number | null>(initial);
  return (
    <NumericInput
      value={val}
      onChange={(v) => {
        setVal(v);
        onChange?.(v);
      }}
      {...rest}
    />
  );
}

describe("NumericInput — existing behavior", () => {
  it("renders the value as a string", () => {
    render(<NumericInput value={42} onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveValue("42");
  });

  it("renders empty for null", () => {
    render(<NumericInput value={null} onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("strips non-numeric input", async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "12abc34");
    expect(onChange).toHaveBeenLastCalledWith(1234);
  });

  it("clamps to min on blur when below min (allowNull undefined defaults to existing behavior)", async () => {
    const onChange = vi.fn();
    render(<NumericInput value={2} onChange={onChange} min={5} />);
    const input = screen.getByRole("textbox");
    await userEvent.click(input);
    input.blur();
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it("blocks values above max while typing", async () => {
    const onChange = vi.fn();
    render(<NumericInput value={null} onChange={onChange} max={100} />);
    await userEvent.type(screen.getByRole("textbox"), "150");
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain(150);
  });
});

describe("NumericInput — allowNull", () => {
  it("snaps empty back to min on blur when allowNull is false", async () => {
    const onChange = vi.fn();
    render(<Controlled initial={3} min={1} allowNull={false} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    input.blur();
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("snaps empty to 0 when allowNull is false and no min set", async () => {
    const onChange = vi.fn();
    render(<Controlled initial={3} allowNull={false} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    input.blur();
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("allows null on blur when allowNull is true (default)", async () => {
    const onChange = vi.fn();
    render(<Controlled initial={3} min={1} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    input.blur();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe("NumericInput — steppers", () => {
  it("renders +/- buttons when showSteppers is true", () => {
    render(<NumericInput value={5} onChange={() => {}} showSteppers min={0} max={10} />);
    expect(screen.getByLabelText("Decrease")).toBeInTheDocument();
    expect(screen.getByLabelText("Increase")).toBeInTheDocument();
  });

  it("does not render steppers by default", () => {
    render(<NumericInput value={5} onChange={() => {}} />);
    expect(screen.queryByLabelText("Decrease")).not.toBeInTheDocument();
  });

  it("increments by step", async () => {
    const onChange = vi.fn();
    render(<NumericInput value={5} onChange={onChange} showSteppers step={2} />);
    await userEvent.click(screen.getByLabelText("Increase"));
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it("decrements by step", async () => {
    const onChange = vi.fn();
    render(<NumericInput value={5} onChange={onChange} showSteppers step={1} />);
    await userEvent.click(screen.getByLabelText("Decrease"));
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it("stops at min", async () => {
    const onChange = vi.fn();
    render(<NumericInput value={1} onChange={onChange} showSteppers min={1} />);
    const dec = screen.getByLabelText("Decrease");
    expect(dec).toBeDisabled();
  });

  it("stops at max", async () => {
    const onChange = vi.fn();
    render(<NumericInput value={10} onChange={onChange} showSteppers max={10} />);
    const inc = screen.getByLabelText("Increase");
    expect(inc).toBeDisabled();
  });

  it("treats null as 0 baseline for increment", async () => {
    const onChange = vi.fn();
    render(<NumericInput value={null} onChange={onChange} showSteppers step={5} />);
    await userEvent.click(screen.getByLabelText("Increase"));
    expect(onChange).toHaveBeenLastCalledWith(5);
  });
});
