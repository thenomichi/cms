# PR 2 — NumberField: stepper buttons + allowNull enforcement

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every numeric input in the trip editor impossible to leave in an invalid empty state when null isn't allowed, and add stepper buttons for friendlier interaction.

**Architecture:** The existing `components/ui/NumericInput.tsx` already handles most of the desired behavior (clamps min on blur, no scroll-changes-value, no spinners, allows clearing). It has two gaps: (1) when the user clears a non-nullable field on blur it stays empty, and (2) no `[-] [+]` steppers. Extend `NumericInput` rather than create a new component — every consumer already uses it, and a parallel component would risk drift. Add `allowNull` and `showSteppers` props with sensible defaults.

**Tech Stack:** React 19, Vitest + RTL.

**No DB changes.**

---

## File map

- Modify: `components/ui/NumericInput.tsx` (add `allowNull`, `showSteppers`, `step` props; clamp on blur when `allowNull` is false)
- Create: `components/ui/__tests__/NumericInput.test.tsx`
- Modify: `app/(cms)/trips/_components/tabs/BasicTab.tsx` (set `allowNull` per field per Section 2 migration map)

---

## Task 1: Lock current behavior with characterization tests

**Files:**
- Create: `components/ui/__tests__/NumericInput.test.tsx`

- [ ] **Step 1: Write tests covering existing behavior**

```tsx
// components/ui/__tests__/NumericInput.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumericInput } from "../NumericInput";

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
    render(<NumericInput value={null} onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "12abc34");
    // Last call should be 1234
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
    // 150 > 100, so the final accepted value should be <= 100
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain(150);
  });
});
```

- [ ] **Step 2: Run tests — they pass against existing behavior**

Run: `npm test -- components/ui/__tests__/NumericInput.test.tsx`

Expected: PASS — these are characterization tests that document what's already there.

- [ ] **Step 3: Commit**

```bash
git add components/ui/__tests__/NumericInput.test.tsx
git commit -m "test(ui): characterize existing NumericInput behavior"
```

---

## Task 2: Add `allowNull` enforcement (red, then green)

**Files:**
- Modify: `components/ui/__tests__/NumericInput.test.tsx`
- Modify: `components/ui/NumericInput.tsx`

- [ ] **Step 1: Add tests for allowNull=false**

Append to `components/ui/__tests__/NumericInput.test.tsx`:

```tsx
describe("NumericInput — allowNull", () => {
  it("snaps empty back to min on blur when allowNull is false", async () => {
    const onChange = vi.fn();
    render(<NumericInput value={3} onChange={onChange} min={1} allowNull={false} />);
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    input.blur();
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("snaps empty to 0 when allowNull is false and no min set", async () => {
    const onChange = vi.fn();
    render(<NumericInput value={3} onChange={onChange} allowNull={false} />);
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    input.blur();
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("allows null on blur when allowNull is true (default)", async () => {
    const onChange = vi.fn();
    render(<NumericInput value={3} onChange={onChange} min={1} />);
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    input.blur();
    // userEvent.clear fires onChange(null) once during clear; blur shouldn't override
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
```

- [ ] **Step 2: Run — first two fail, third passes**

Run: `npm test -- components/ui/__tests__/NumericInput.test.tsx`

Expected: 2 FAIL (allowNull not enforced) + 1 PASS.

- [ ] **Step 3: Add the prop and the blur-clamp logic**

In `components/ui/NumericInput.tsx`:

Update the props interface:
```ts
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
  showSteppers?: boolean;    // default false (Task 3 will flip in BasicTab consumers as desired)
  suffix?: string;
  prefix?: string;
  disabled?: boolean;
}
```

Update the destructured props in `function NumericInput({ ... })`:
```ts
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
```

Update `handleBlur` to honor `allowNull`:
```ts
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
```

- [ ] **Step 4: Run — all allowNull tests pass**

Run: `npm test -- components/ui/__tests__/NumericInput.test.tsx`

Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add components/ui/NumericInput.tsx components/ui/__tests__/NumericInput.test.tsx
git commit -m "feat(ui): NumericInput honors allowNull on blur"
```

---

## Task 3: Add stepper buttons

**Files:**
- Modify: `components/ui/__tests__/NumericInput.test.tsx`
- Modify: `components/ui/NumericInput.tsx`

- [ ] **Step 1: Add stepper tests**

Append:

```tsx
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
```

- [ ] **Step 2: Run — all stepper tests fail**

Run: `npm test -- components/ui/__tests__/NumericInput.test.tsx`

Expected: FAIL — Decrease/Increase buttons don't exist yet.

- [ ] **Step 3: Implement steppers**

In `components/ui/NumericInput.tsx`, replace the entire JSX `return (...)` block with:

```tsx
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
```

- [ ] **Step 4: Run — all stepper tests pass**

Run: `npm test -- components/ui/__tests__/NumericInput.test.tsx`

Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add components/ui/NumericInput.tsx components/ui/__tests__/NumericInput.test.tsx
git commit -m "feat(ui): add optional +/- steppers to NumericInput"
```

---

## Task 4: Apply allowNull + steppers to BasicTab fields per migration map

**Files:**
- Modify: `app/(cms)/trips/_components/tabs/BasicTab.tsx`

The migration map from the spec (Section 2):

| Field | min | max | allowNull | showSteppers |
|---|---|---|---|---|
| `duration_days` | 1 | 90 | false | true |
| `mrp_price` | 0 | — | true | false |
| `quoted_price` | 0 | — | true | false |
| `discount_pct` | 0 | 100 | true | false |
| `advance_pct` | 0 | 100 | false | false |
| `total_slots` | 1 | — | true | true |

(`duration_nights` is rendered as a read-only div, not a NumericInput. `selling_price` is derived. `discount_amount` is added in PR 3.)

- [ ] **Step 1: Update each NumericInput in BasicTab.tsx**

In `app/(cms)/trips/_components/tabs/BasicTab.tsx`:

Duration days (around line 90-101):
```tsx
              <NumericInput
                value={form.duration_days}
                onChange={(val) => {
                  const days = val ?? 1;
                  updateField("duration_days", days);
                  updateField("duration_nights", Math.max(0, days - 1));
                }}
                min={1}
                max={90}
                allowNull={false}
                showSteppers
              />
```

Quoted price (around line 156-162):
```tsx
                <NumericInput
                  value={form.quoted_price}
                  onChange={(val) => updateField("quoted_price", val)}
                  placeholder="e.g. 85000"
                  min={0}
                  prefix="₹"
                />
```
(Already correct — `allowNull` defaults to true.)

Advance % (around lines 165-172, both branches — custom and non-custom paths):
```tsx
                <NumericInput
                  value={form.advance_pct}
                  onChange={(val) => updateField("advance_pct", val ?? 50)}
                  min={0}
                  max={100}
                  allowNull={false}
                  suffix="%"
                />
```

MRP price (around line 180-191):
```tsx
                <NumericInput
                  value={form.mrp_price}
                  onChange={(val) => updateField("mrp_price", val)}
                  placeholder="e.g. 28000"
                  min={0}
                  prefix="₹"
                />
```

Discount % (around line 194-207):
```tsx
                <NumericInput
                  value={form.discount_pct}
                  onChange={(val) => updateField("discount_pct", val)}
                  placeholder="0"
                  min={0}
                  max={100}
                  suffix="%"
                />
```

Total slots (around line 235-241):
```tsx
            <NumericInput
              value={form.total_slots}
              onChange={(val) => updateField("total_slots", val)}
              placeholder="e.g. 16"
              min={1}
              showSteppers
            />
```

- [ ] **Step 2: Smoke test**

```bash
npm run dev
```

Open `/trips/new` and verify:
1. **Duration days:** type "5", select all, delete → blur → snaps back to 1. Use the steppers; can't go below 1 or above 90.
2. **Advance %:** clear → blur → snaps back to 50 (the `?? 50` in onChange) but the test for allowNull=false also enforces min on blur; verify the field shows 50.
3. **Discount %:** clear it → stays empty (allowNull=true). Type 25 → fine. Try to type 150 → blocked by max.
4. **Total slots:** the steppers work.

- [ ] **Step 3: Commit**

```bash
git add app/\(cms\)/trips/_components/tabs/BasicTab.tsx
git commit -m "fix(cms): require non-null for duration and advance %, add steppers"
```

---

## Task 5: Audit other tabs for numeric inputs

**Files:**
- Read-only: every file under `app/(cms)/trips/_components/tabs/`

The trips area also has `ItineraryTab`, `InclusionsTab`, `SettingsTab`, `DetailsTab`, `GalleryTab`. We need to verify none of them have numeric inputs that should be migrated.

- [ ] **Step 1: Grep for NumericInput and `type="number"` outside BasicTab**

```bash
grep -rn "NumericInput\|type=\"number\"" app/\(cms\)/trips/_components/ | grep -v BasicTab
```

- [ ] **Step 2: For each match, decide: allowNull true or false?**

Open each match. If the field semantically can be empty (e.g., optional capacity, optional price), leave `allowNull` as default (true). If it must always have a value (rare in this codebase outside BasicTab), set `allowNull={false}`.

If no matches exist, the audit is complete.

- [ ] **Step 3: Commit any updates from the audit**

```bash
git add -p
git commit -m "fix(cms): apply NumericInput allowNull defaults across trip tabs"
```

(Skip this commit if no changes were needed — record "no other numeric inputs need migration" in the PR description.)

---

## Ready to merge

- [ ] All Vitest tests pass: `npm test`
- [ ] `npx tsc --noEmit` is clean
- [ ] Manual smoke test of every numeric input in `BasicTab` (Task 4 step 2)
- [ ] Audit of other tabs complete (Task 5)
- [ ] Branch: `git checkout -b feat/cms-pr2-number-field`
- [ ] PR opened against `main`
