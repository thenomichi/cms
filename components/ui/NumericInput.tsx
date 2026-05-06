"use client";

import { cn } from "@/lib/utils";

interface NumericInputProps {
  value: number | string | null | undefined;
  onChange: (value: number | null) => void;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  allowDecimal?: boolean;
  allowNull?: boolean;       // default true (preserves existing behavior)
  step?: number;             // default 1, used by steppers (Task 3)
  showSteppers?: boolean;    // default false (Task 3 toggles this in BasicTab consumers)
  suffix?: string;
  prefix?: string;
  disabled?: boolean;
}

/**
 * Numeric input that avoids the UX pitfalls of type="number":
 * - No scroll-to-change (which accidentally changes values)
 * - No spinner arrows (confusing for non-tech users)
 * - Field can be fully cleared and retyped naturally
 * - Mobile shows numeric keyboard via inputMode
 * - Only accepts digits (and optionally a decimal point)
 */
export function NumericInput({
  value,
  onChange,
  placeholder = "",
  className,
  min,
  max,
  allowDecimal = false,
  allowNull = true,
  step = 1,
  showSteppers = false,
  suffix,
  prefix,
  disabled,
}: NumericInputProps) {
  const displayValue = value === null || value === undefined ? "" : String(value);

  const handleChange = (raw: string) => {
    // Allow empty field (user clearing the input)
    if (raw === "") {
      onChange(null);
      return;
    }

    // Strip non-numeric chars (keep decimal if allowed)
    const pattern = allowDecimal ? /[^0-9.]/g : /[^0-9]/g;
    const cleaned = raw.replace(pattern, "");

    // Prevent multiple decimal points
    if (allowDecimal) {
      const parts = cleaned.split(".");
      const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
      if (sanitized === "" || sanitized === ".") {
        onChange(null);
        return;
      }
      const num = parseFloat(sanitized);
      if (isNaN(num)) {
        onChange(null);
        return;
      }
      if (max !== undefined && num > max) return;
      onChange(num);
      return;
    }

    if (cleaned === "") {
      onChange(null);
      return;
    }

    const num = parseInt(cleaned, 10);
    if (isNaN(num)) {
      onChange(null);
      return;
    }
    if (max !== undefined && num > max) return;
    onChange(num);
  };

  // Validate on blur — apply min constraint only when user is done typing
  const handleBlur = () => {
    if (displayValue === "") {
      if (!allowNull) {
        onChange(min ?? 0);
      }
      return;
    }
    const num = allowDecimal ? parseFloat(displayValue) : parseInt(displayValue, 10);
    if (isNaN(num)) {
      onChange(allowNull ? null : (min ?? 0));
      return;
    }
    if (min !== undefined && num < min) {
      onChange(min);
    }
  };

  const numericValue = typeof value === "number" ? value : value ? Number(value) : 0;
  const decDisabled = disabled || (min !== undefined && numericValue <= min);
  const incDisabled = disabled || (max !== undefined && numericValue >= max);

  const stepBy = (delta: number) => {
    const base = typeof value === "number" ? value : 0;
    let next = base + delta;
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    onChange(next);
  };

  const pl = prefix ? "pl-10" : "pl-3";
  const pr = suffix ? "pr-10" : "pr-3";
  const inputClasses = cn(
    "h-9 w-full rounded-lg border border-line bg-surface text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20",
    showSteppers ? "text-center" : "",
    pl,
    pr,
    className,
  );

  const inputEl = (
    <div className="relative flex-1">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mid/60">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        pattern={allowDecimal ? "[0-9.]*" : "[0-9]*"}
        className={inputClasses}
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-mid/60">
          {suffix}
        </span>
      )}
    </div>
  );

  if (!showSteppers) return inputEl;

  return (
    <div className="flex items-stretch gap-1">
      <button
        type="button"
        aria-label="Decrease"
        disabled={decDisabled}
        onClick={() => stepBy(-step)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-mid hover:bg-surface3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        −
      </button>
      {inputEl}
      <button
        type="button"
        aria-label="Increase"
        disabled={incDisabled}
        onClick={() => stepBy(step)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-mid hover:bg-surface3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        +
      </button>
    </div>
  );
}
