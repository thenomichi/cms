# PR 3 — Absolute discount field (either/or with %)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `trips.discount_amount` as an alternative to `trips.discount_pct`. UI is a three-way radio toggle (None / Percentage / Flat amount) with mutually-exclusive value entry. Selling price recompute supports both paths.

**Architecture:** Additive DB migration with a CHECK constraint enforcing either/or at the DB level. Type/schema/UI plumbing in lockstep. The selling-price effect from PR 1 gets one extension to handle the absolute-amount path. UI sits inside `BasicTab.tsx` Pricing section, non-custom-trip branch only — Signature/Customized trips don't use discounts.

**Tech Stack:** Next.js 16, Zod, Vitest, Supabase.

**Depends on PR 1** (centralized derived-fields hook) and **PR 2** (NumberField with `allowNull`).

---

## File map

- Create: `supabase/migrations/20260506T1000__add_trip_discount_amount.sql`
- Modify: `lib/types.ts` (`DbTrip` adds `discount_amount`)
- Modify: `lib/schemas/trip.ts` (`tripBasicSchema` adds `discount_amount` + cross-field refinement)
- Modify: `lib/db/trips.ts` (`createTrip` / `updateTrip` / `cloneAsBatch` / `TripFull` propagate the field)
- Modify: `app/(cms)/trips/_components/types.ts` (`TripFormState`, `buildInitialState`)
- Modify: `app/(cms)/trips/_components/useDerivedTripFields.ts` (selling price now considers `discount_amount`)
- Modify: `app/(cms)/trips/_components/__tests__/useDerivedTripFields.test.tsx` (new selling-price branch)
- Modify: `app/(cms)/trips/_components/tabs/BasicTab.tsx` (radio toggle + flat-amount input + badge logic)
- Modify: `app/(cms)/trips/actions.ts` (payload includes `discount_amount`)

---

## Task 1: DB migration (additive, CHECK constraint)

**Files:**
- Create: `supabase/migrations/20260506T1000__add_trip_discount_amount.sql`

> **PERMISSION GATE:** This task applies a schema change to the live Supabase project. Per CLAUDE.md, ask the user before running. The migration is additive (new nullable column) and safe.

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260506T1000__add_trip_discount_amount.sql
-- PR 3: Add absolute discount as an alternative to discount_pct.
-- Either/or constraint enforces UI invariant at the DB level.

ALTER TABLE trips
  ADD COLUMN discount_amount numeric(10, 2) NULL;

ALTER TABLE trips
  ADD CONSTRAINT trips_discount_either_or
  CHECK (discount_pct IS NULL OR discount_amount IS NULL);
```

- [ ] **Step 2: Ask the user for permission to apply, then apply via Supabase MCP**

> Pause here. Tell the user: "Ready to apply migration `20260506T1000__add_trip_discount_amount.sql` — adds nullable `trips.discount_amount` and the either/or CHECK constraint. OK to apply?"

After explicit approval, apply via Supabase MCP `apply_migration`. If MCP isn't available, paste the SQL into the Supabase dashboard's SQL editor.

- [ ] **Step 3: Verify in DB**

Run via Supabase MCP `execute_sql` (read):
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'trips' AND column_name = 'discount_amount';
```

Expected: one row, `numeric`, nullable.

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'trips'::regclass AND conname = 'trips_discount_either_or';
```

Expected: returns the CHECK definition.

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/20260506T1000__add_trip_discount_amount.sql
git commit -m "feat(db): add trips.discount_amount with either/or constraint"
```

---

## Task 2: Type + schema plumbing

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/schemas/trip.ts`
- Modify: `lib/db/trips.ts`
- Modify: `app/(cms)/trips/_components/types.ts`

- [ ] **Step 1: Add `discount_amount` to `DbTrip`**

In `lib/types.ts`, find the `DbTrip` interface and add the field next to `discount_pct`:

```ts
  discount_pct: number | null;
  discount_amount: number | null;   // PR 3: absolute discount, mutually exclusive with discount_pct
```

- [ ] **Step 2: Add to `tripBasicSchema`**

In `lib/schemas/trip.ts`, modify `tripBasicSchema` (lines 75-99). Replace the schema definition with:

```ts
export const tripBasicSchema = z.object({
  trip_name: z.string().min(2, "Trip name is required"),
  trip_type: z.enum(TRIP_TYPES),
  trip_sub_type: z.string().nullable().optional(),
  trip_category: z.string().nullable().optional(),
  destination_id: z.string().nullable(),
  duration_days: z.coerce.number().min(1).max(90),
  duration_nights: z.coerce.number().min(0).max(89),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  mrp_price: z.coerce.number().min(0).nullable(),
  selling_price: z.coerce.number().min(0).nullable(),
  discount_pct: z.coerce.number().min(0).max(100).nullable(),
  discount_amount: z.coerce.number().min(0).nullable(),
  quoted_price: z.coerce.number().min(0).nullable(),
  advance_pct: z.coerce.number().min(0).max(100).default(50),
  total_slots: z.coerce.number().min(0).nullable(),
  batch_number: z.string().nullable(),
  group_slug: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
  departure_city: z.string().nullable().optional(),
  departure_airport: z.string().nullable().optional(),
  booking_kind: z.string().default("trip"),
  currency_code: z.string().default("INR"),
}).refine(
  (v) => v.discount_pct == null || v.discount_amount == null,
  { message: "Use either discount % or flat amount, not both", path: ["discount_amount"] },
);
```

- [ ] **Step 3: Propagate through `lib/db/trips.ts`**

The existing `createTrip` and `updateTrip` accept payloads typed against the trip schema. Search for `discount_pct` references and add `discount_amount` alongside each.

```bash
grep -n "discount_pct" lib/db/trips.ts
```

For each match (currently around line 325 in `cloneAsBatch`), add the corresponding `discount_amount` line:

```ts
    discount_pct: source.discount_pct,
    discount_amount: source.discount_amount,
```

If there are explicit insert/update column lists, add `discount_amount` to those as well.

- [ ] **Step 4: Update `TripFormState` and `buildInitialState`**

In `app/(cms)/trips/_components/types.ts`:

Add to the `TripFormState` interface, next to `discount_pct: number | null;`:
```ts
  discount_amount: number | null;
```

Add to the empty-state branch of `buildInitialState` (currently around line 49-60):
```ts
      discount_pct: null, discount_amount: null, quoted_price: null,
```

Add to the existing-trip branch (currently around line 78):
```ts
    discount_pct: trip.discount_pct, discount_amount: trip.discount_amount,
    quoted_price: trip.quoted_price,
```

- [ ] **Step 5: Pass through in actions.ts payload**

In `app/(cms)/trips/actions.ts`, find the `payload.basic` construction in `handleSave` of `TripEditor.tsx` — wait, that's client side. Server side, `parseTripFormData` reads the JSON blob and Zod validates it. No changes to actions.ts payload parsing required because Zod schema includes `discount_amount` already (from Step 2).

But the client `handleSave` in `TripEditor.tsx` builds the payload (lines 107-131). Add the field:

```ts
      mrp_price: form.mrp_price, selling_price: form.selling_price,
      discount_pct: form.discount_pct, discount_amount: form.discount_amount,
      quoted_price: form.quoted_price,
```

- [ ] **Step 6: TypeScript check**

Run: `npx tsc --noEmit`

Expected: clean. Any errors here mean a field reference was missed — fix before continuing.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/schemas/trip.ts lib/db/trips.ts app/\(cms\)/trips/_components/types.ts app/\(cms\)/trips/_components/TripEditor.tsx
git commit -m "feat(cms): plumb discount_amount through types, schema, db, form state"
```

---

## Task 3: Extend selling-price hook to honor `discount_amount`

**Files:**
- Modify: `app/(cms)/trips/_components/__tests__/useDerivedTripFields.test.tsx`
- Modify: `app/(cms)/trips/_components/useDerivedTripFields.ts`

- [ ] **Step 1: Add tests for the discount_amount branch**

Append to `useDerivedTripFields.test.tsx`:

```tsx
describe("useDerivedTripFields — selling_price with discount_amount", () => {
  it("subtracts discount_amount from mrp_price when set", () => {
    const { result } = renderHook(() => useTestHarness(makeState()));
    act(() => {
      result.current.setForm((p) => ({ ...p, mrp_price: 30000, discount_amount: 5000 }));
    });
    expect(result.current.form.selling_price).toBe(25000);
  });

  it("clamps selling_price at 0 when discount_amount exceeds mrp", () => {
    const { result } = renderHook(() => useTestHarness(makeState()));
    act(() => {
      result.current.setForm((p) => ({ ...p, mrp_price: 5000, discount_amount: 8000 }));
    });
    expect(result.current.form.selling_price).toBe(0);
  });

  it("prefers discount_pct over discount_amount when both are set (defensive)", () => {
    const { result } = renderHook(() => useTestHarness(makeState()));
    act(() => {
      // The Zod refine + DB check prevent this in practice; the hook
      // resolves it deterministically rather than producing garbage.
      result.current.setForm((p) => ({ ...p, mrp_price: 10000, discount_pct: 50, discount_amount: 2000 }));
    });
    expect(result.current.form.selling_price).toBe(5000);
  });
});
```

- [ ] **Step 2: Run — fails because hook doesn't know about discount_amount**

Run: `npm test -- app/\(cms\)/trips/_components/__tests__/useDerivedTripFields.test.tsx`

Expected: FAIL on the new tests.

- [ ] **Step 3: Update the selling-price effect**

In `app/(cms)/trips/_components/useDerivedTripFields.ts`, replace the selling-price effect with:

```ts
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
```

- [ ] **Step 4: Run tests — all pass**

Run: `npm test -- app/\(cms\)/trips/_components/__tests__/useDerivedTripFields.test.tsx`

Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add app/\(cms\)/trips/_components/useDerivedTripFields.ts app/\(cms\)/trips/_components/__tests__/useDerivedTripFields.test.tsx
git commit -m "feat(cms): selling_price honors discount_amount path"
```

---

## Task 4: UI — three-way discount radio in BasicTab

**Files:**
- Modify: `app/(cms)/trips/_components/tabs/BasicTab.tsx`

- [ ] **Step 1: Replace the single discount field with a radio + conditional input**

Locate the non-custom-trip pricing branch (currently around line 175-228, the `else` of the `isCustomTrip` ternary). Replace the inner content (the pricing grid + savings card) with:

```tsx
          // Community / Beyond Ordinary — fixed pricing with optional discount
          <div className="space-y-4">
            <FormField label="Trip Price" hint="Per person" required>
              <NumericInput
                value={form.mrp_price}
                onChange={(val) => updateField("mrp_price", val)}
                placeholder="e.g. 28000"
                min={0}
                prefix="₹"
              />
            </FormField>

            <FormField label="Offer Discount" hint="Optional — choose one type">
              <div className="flex flex-wrap gap-2 mb-2">
                {(["none", "percent", "amount"] as const).map((type) => {
                  const current =
                    form.discount_pct != null ? "percent" :
                    form.discount_amount != null ? "amount" : "none";
                  const checked = current === type;
                  const label = type === "none" ? "No discount" : type === "percent" ? "Percentage" : "Flat amount";
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        if (type === "none") {
                          updateField("discount_pct", null);
                          updateField("discount_amount", null);
                        } else if (type === "percent") {
                          updateField("discount_amount", null);
                          if (form.discount_pct == null) updateField("discount_pct", 0);
                        } else {
                          updateField("discount_pct", null);
                          if (form.discount_amount == null) updateField("discount_amount", 0);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        checked
                          ? "bg-rust/10 border-rust text-rust"
                          : "bg-surface border-line text-mid hover:bg-surface3"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {form.discount_pct != null && (
                <NumericInput
                  value={form.discount_pct}
                  onChange={(val) => updateField("discount_pct", val)}
                  placeholder="0"
                  min={0}
                  max={100}
                  suffix="%"
                />
              )}
              {form.discount_amount != null && (
                <NumericInput
                  value={form.discount_amount}
                  onChange={(val) => updateField("discount_amount", val)}
                  placeholder="0"
                  min={0}
                  prefix={form.currency_code === "INR" ? "₹" : form.currency_code}
                />
              )}
            </FormField>

            <FormField label="Advance Payment %" hint="Collected at booking (default 50%)">
              <NumericInput
                value={form.advance_pct}
                onChange={(val) => updateField("advance_pct", val ?? 50)}
                min={0}
                max={100}
                allowNull={false}
                suffix="%"
              />
            </FormField>

            {(((form.discount_pct ?? 0) > 0) || ((form.discount_amount ?? 0) > 0)) && (form.mrp_price ?? 0) > 0 && (
              <div className="rounded-lg border border-sem-green/20 bg-sem-green-bg px-4 py-2.5">
                <p className="text-sm text-sem-green">
                  <span className="line-through text-mid">₹{(form.mrp_price ?? 0).toLocaleString("en-IN")}</span>
                  {" → "}
                  <span className="font-bold">₹{(form.selling_price ?? 0).toLocaleString("en-IN")}</span>
                  <span className="ml-2 text-xs">
                    {form.discount_amount != null
                      ? `(₹${form.discount_amount.toLocaleString("en-IN")} off)`
                      : `(${form.discount_pct}% off — traveller saves ₹${((form.mrp_price ?? 0) - (form.selling_price ?? 0)).toLocaleString("en-IN")})`}
                  </span>
                </p>
              </div>
            )}
          </div>
```

- [ ] **Step 2: Smoke test**

```bash
npm run dev
```

Open `/trips/new`, pick a non-custom trip type:
1. Default state: "No discount" selected, no input shown.
2. Click "Percentage" → discount_pct field appears, set 25 → savings card appears with "25% off".
3. Click "Flat amount" → discount_pct cleared, discount_amount field appears, set 5000 → savings card shows "₹5,000 off".
4. Click "No discount" → both fields clear; savings card disappears.
5. Save the trip. Reload. The chosen discount type and value persist.

- [ ] **Step 3: Test the DB CHECK constraint manually (negative)**

Use Supabase MCP `execute_sql` (with explicit user permission for write):

```sql
UPDATE trips SET discount_pct = 10, discount_amount = 500 WHERE trip_id = '<some-existing-trip-id>';
```

Expected: ERROR — violates constraint `trips_discount_either_or`. (Then revert if the row was modified.)

- [ ] **Step 4: Commit**

```bash
git add app/\(cms\)/trips/_components/tabs/BasicTab.tsx
git commit -m "feat(cms): three-way discount toggle (none / percent / flat amount)"
```

---

## Task 5: Integration test for the Zod refinement

**Files:**
- Create: `lib/schemas/__tests__/trip.test.ts`

- [ ] **Step 1: Write the test**

```ts
// lib/schemas/__tests__/trip.test.ts
import { describe, it, expect } from "vitest";
import { tripBasicSchema } from "../trip";

const base = {
  trip_name: "Test trip",
  trip_type: "Community" as const,
  destination_id: null,
  duration_days: 3,
  duration_nights: 2,
  start_date: null,
  end_date: null,
  mrp_price: 10000,
  selling_price: 10000,
  discount_pct: null,
  discount_amount: null,
  quoted_price: null,
  total_slots: null,
  batch_number: null,
};

describe("tripBasicSchema discount refinement", () => {
  it("accepts discount_pct alone", () => {
    const r = tripBasicSchema.safeParse({ ...base, discount_pct: 10 });
    expect(r.success).toBe(true);
  });

  it("accepts discount_amount alone", () => {
    const r = tripBasicSchema.safeParse({ ...base, discount_amount: 500 });
    expect(r.success).toBe(true);
  });

  it("accepts neither", () => {
    const r = tripBasicSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("rejects both set", () => {
    const r = tripBasicSchema.safeParse({ ...base, discount_pct: 10, discount_amount: 500 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/either discount/i);
    }
  });
});
```

- [ ] **Step 2: Run — passes**

Run: `npm test -- lib/schemas/__tests__/trip.test.ts`

Expected: PASS — all 4 tests.

- [ ] **Step 3: Commit**

```bash
git add lib/schemas/__tests__/trip.test.ts
git commit -m "test(schemas): tripBasicSchema rejects double-discount payload"
```

---

## Ready to merge

- [ ] Migration applied and verified (Task 1 step 3)
- [ ] All Vitest tests pass: `npm test`
- [ ] `npx tsc --noEmit` is clean
- [ ] Manual smoke test: each radio state works, save persists, DB CHECK rejects double-set
- [ ] Branch: `git checkout -b feat/cms-pr3-absolute-discount`
- [ ] PR opened against `main` — note in description: "Website-side rendering of discount_amount is a follow-up ticket."
