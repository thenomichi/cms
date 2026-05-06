# PR 1 — Latency fixes + end-date auto-calc bug

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce perceived latency on Save/content updates in the trip editor and fix the end-date auto-calc bug + related stale-closure pricing bugs.

**Architecture:** Replace `JSON.stringify` dirty check with a dirty-key Set in `useRef`. Make `logActivity` fire-and-forget in trip server actions (revalidate is already non-awaited via `revalidateWebsite`). Hoist the bucket allowlist check out of the upload action's hot path. Centralize derived-field calculations (end_date, selling_price) into `useEffect` hooks in `TripEditor` to eliminate stale-closure bugs.

**Tech Stack:** React 19, Next.js 16, Vitest + RTL.

**No DB changes.**

---

## File map

- Modify: `app/(cms)/trips/_components/TripEditor.tsx` (dirty check, derived effects, removal of inline recompute logic)
- Modify: `app/(cms)/trips/_components/tabs/BasicTab.tsx` (remove inline end_date / selling_price recompute from onChange)
- Modify: `app/(cms)/trips/actions.ts` (fire-and-forget logActivity, hoist bucket check)
- Create: `app/(cms)/trips/_components/useTripDirty.ts` (small hook for dirty tracking)
- Create: `app/(cms)/trips/_components/useDerivedTripFields.ts` (effects for end_date, selling_price)
- Create: `app/(cms)/trips/_components/__tests__/useDerivedTripFields.test.tsx`
- Create: `app/(cms)/trips/_components/__tests__/useTripDirty.test.tsx`

---

## Task 1: Add a unit test for the end-date bug (red)

**Files:**
- Create: `app/(cms)/trips/_components/__tests__/useDerivedTripFields.test.tsx`

- [ ] **Step 1: Write the failing test for end-date recompute on duration change**

```tsx
// app/(cms)/trips/_components/__tests__/useDerivedTripFields.test.tsx
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { useDerivedTripFields } from "../useDerivedTripFields";
import type { TripFormState } from "../types";

function makeState(overrides: Partial<TripFormState> = {}): TripFormState {
  return {
    trip_name: "", slug: "", trip_type: "Community", trip_sub_type: "",
    trip_category: "", destination_id: "", duration_days: 1, duration_nights: 0,
    start_date: "", end_date: "", mrp_price: null, selling_price: null,
    discount_pct: null, quoted_price: null, advance_pct: 50, total_slots: null,
    batch_number: "", group_slug: null, departure_city: "", departure_airport: "",
    booking_kind: "trip", currency_code: "INR",
    overview: "", description: "", tagline: "", highlights: [],
    itinerary: [], inclusions: [], exclusions: [],
    status: "Draft", is_listed: false, show_on_homepage: false,
    dossier_url: "",
    ...overrides,
  };
}

function useTestHarness(initial: TripFormState) {
  const [form, setForm] = useState(initial);
  useDerivedTripFields(form, setForm);
  return { form, setForm };
}

describe("useDerivedTripFields — end_date", () => {
  it("recomputes end_date when duration_days changes after start_date is set", () => {
    const { result } = renderHook(() =>
      useTestHarness(makeState({ start_date: "2026-06-01", duration_days: 3 })),
    );
    // Initial: start 2026-06-01, 3 days => end 2026-06-03
    expect(result.current.form.end_date).toBe("2026-06-03");

    // Change duration to 7 — end_date should follow
    act(() => {
      result.current.setForm((p) => ({ ...p, duration_days: 7 }));
    });
    expect(result.current.form.end_date).toBe("2026-06-07");
  });

  it("recomputes end_date when start_date changes after duration is set", () => {
    const { result } = renderHook(() =>
      useTestHarness(makeState({ duration_days: 5 })),
    );
    act(() => {
      result.current.setForm((p) => ({ ...p, start_date: "2026-07-10" }));
    });
    expect(result.current.form.end_date).toBe("2026-07-14");
  });

  it("clears end_date when start_date is cleared", () => {
    const { result } = renderHook(() =>
      useTestHarness(makeState({ start_date: "2026-06-01", duration_days: 3, end_date: "2026-06-03" })),
    );
    act(() => {
      result.current.setForm((p) => ({ ...p, start_date: "" }));
    });
    expect(result.current.form.end_date).toBe("");
  });

  it("does not loop — stable end_date does not retrigger setForm", () => {
    let renderCount = 0;
    const { rerender } = renderHook(() => {
      renderCount++;
      return useTestHarness(makeState({ start_date: "2026-06-01", duration_days: 3 }));
    });
    rerender();
    rerender();
    // 1 initial + 1 effect-driven update + 2 manual rerenders = 4 max
    expect(renderCount).toBeLessThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/\(cms\)/trips/_components/__tests__/useDerivedTripFields.test.tsx`

Expected: FAIL with `Cannot find module '../useDerivedTripFields'` or similar.

- [ ] **Step 3: Commit the failing test**

```bash
git add app/\(cms\)/trips/_components/__tests__/useDerivedTripFields.test.tsx
git commit -m "test(cms): add failing tests for end_date auto-calc"
```

---

## Task 2: Implement `useDerivedTripFields` (green for end-date)

**Files:**
- Create: `app/(cms)/trips/_components/useDerivedTripFields.ts`

- [ ] **Step 1: Write the hook — end-date logic only**

```ts
// app/(cms)/trips/_components/useDerivedTripFields.ts
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
}
```

- [ ] **Step 2: Run test to verify all four end_date cases pass**

Run: `npm test -- app/\(cms\)/trips/_components/__tests__/useDerivedTripFields.test.tsx`

Expected: PASS — all 4 tests green.

- [ ] **Step 3: Commit**

```bash
git add app/\(cms\)/trips/_components/useDerivedTripFields.ts
git commit -m "feat(cms): centralize end_date derivation in useDerivedTripFields"
```

---

## Task 3: Add selling_price tests and extend the hook

**Files:**
- Modify: `app/(cms)/trips/_components/__tests__/useDerivedTripFields.test.tsx`
- Modify: `app/(cms)/trips/_components/useDerivedTripFields.ts`

- [ ] **Step 1: Add selling_price tests**

Append to the test file:

```tsx
describe("useDerivedTripFields — selling_price", () => {
  it("computes selling_price from mrp_price + discount_pct", () => {
    const { result } = renderHook(() => useTestHarness(makeState()));
    act(() => {
      result.current.setForm((p) => ({ ...p, mrp_price: 10000, discount_pct: 20 }));
    });
    expect(result.current.form.selling_price).toBe(8000);
  });

  it("falls back to mrp_price when discount is null", () => {
    const { result } = renderHook(() => useTestHarness(makeState()));
    act(() => {
      result.current.setForm((p) => ({ ...p, mrp_price: 10000, discount_pct: null }));
    });
    expect(result.current.form.selling_price).toBe(10000);
  });

  it("recomputes when mrp_price changes (no stale closure)", () => {
    const { result } = renderHook(() =>
      useTestHarness(makeState({ mrp_price: 10000, discount_pct: 10, selling_price: 9000 })),
    );
    act(() => {
      result.current.setForm((p) => ({ ...p, mrp_price: 20000 }));
    });
    expect(result.current.form.selling_price).toBe(18000);
  });

  it("does not touch selling_price when mrp_price is null", () => {
    const { result } = renderHook(() =>
      useTestHarness(makeState({ mrp_price: null, selling_price: null })),
    );
    expect(result.current.form.selling_price).toBeNull();
  });
});
```

- [ ] **Step 2: Run new tests — they fail**

Run: `npm test -- app/\(cms\)/trips/_components/__tests__/useDerivedTripFields.test.tsx`

Expected: FAIL — selling_price tests fail because the hook doesn't compute it yet.

- [ ] **Step 3: Extend the hook with selling_price logic**

Append to `useDerivedTripFields.ts` inside the function body, after the end_date effect:

```ts
  // selling_price <- mrp_price - discount_pct (PR 3 will add discount_amount)
  useEffect(() => {
    const mrp = form.mrp_price;
    if (mrp == null) return; // null mrp => leave selling alone
    const pct = form.discount_pct ?? 0;
    const selling = pct > 0 ? Math.round(mrp * (1 - pct / 100)) : mrp;
    if (selling !== form.selling_price) {
      setForm((prev) => ({ ...prev, selling_price: selling }));
    }
  }, [form.mrp_price, form.discount_pct, form.selling_price, setForm]);
```

- [ ] **Step 4: Run tests — all pass**

Run: `npm test -- app/\(cms\)/trips/_components/__tests__/useDerivedTripFields.test.tsx`

Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add app/\(cms\)/trips/_components/useDerivedTripFields.ts app/\(cms\)/trips/_components/__tests__/useDerivedTripFields.test.tsx
git commit -m "feat(cms): centralize selling_price derivation"
```

---

## Task 4: Wire the hook into TripEditor and remove inline recompute

**Files:**
- Modify: `app/(cms)/trips/_components/TripEditor.tsx` (top of file + after state declarations)
- Modify: `app/(cms)/trips/_components/tabs/BasicTab.tsx` (remove inline recompute logic)

- [ ] **Step 1: Import and use the hook in TripEditor**

In `app/(cms)/trips/_components/TripEditor.tsx`, add the import near the existing `_components` imports:

```ts
import { useDerivedTripFields } from "./useDerivedTripFields";
```

Inside the `TripEditor` component, after the `useState` lines for `form` and `initialForm`, add:

```ts
useDerivedTripFields(form, setForm);
```

- [ ] **Step 2: Strip the inline recompute logic from BasicTab**

In `app/(cms)/trips/_components/tabs/BasicTab.tsx`:

Replace the duration-days `NumericInput` onChange (currently lines 92-100) with:

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
              />
```

(Note: the end_date recompute is gone — the hook does it now. The `duration_nights` auto-suggest stays inline because it's user-overridable.)

Replace the start-date input onChange (currently lines 124-133) with:

```tsx
              <input
                type="date"
                className={INPUT}
                min={new Date().toISOString().split("T")[0]}
                value={form.start_date}
                onChange={(e) => updateField("start_date", e.target.value)}
              />
```

(end_date computation is gone — the hook does it.)

Replace the MRP-price `NumericInput` onChange (currently around line 182-187) with:

```tsx
                <NumericInput
                  value={form.mrp_price}
                  onChange={(val) => updateField("mrp_price", val)}
                  placeholder="e.g. 28000"
                  min={0}
                  prefix="₹"
                />
```

Replace the discount_pct `NumericInput` onChange (currently around line 195-201) with:

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

(selling_price recomputes via the hook.)

- [ ] **Step 3: Run the trip editor manually**

```bash
npm run dev
```

Open http://localhost:3001/trips/new. Verify:
1. Set duration to 5, start date to today → end date shows today + 4 days
2. Change duration to 10 → end date now shows today + 9 days
3. Clear start date → end date clears
4. Set MRP 10000, discount 25 → selling shows 7500
5. Change MRP to 20000 (without changing discount) → selling shows 15000

- [ ] **Step 4: Commit**

```bash
git add app/\(cms\)/trips/_components/TripEditor.tsx app/\(cms\)/trips/_components/tabs/BasicTab.tsx
git commit -m "fix(cms): recompute end_date and selling_price reactively (closes stale-closure bug)"
```

---

## Task 5: Replace JSON.stringify dirty check with dirty-key Set

**Files:**
- Create: `app/(cms)/trips/_components/useTripDirty.ts`
- Create: `app/(cms)/trips/_components/__tests__/useTripDirty.test.tsx`
- Modify: `app/(cms)/trips/_components/TripEditor.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// app/(cms)/trips/_components/__tests__/useTripDirty.test.tsx
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTripDirty } from "../useTripDirty";

describe("useTripDirty", () => {
  it("starts clean", () => {
    const { result } = renderHook(() => useTripDirty());
    expect(result.current.isDirty).toBe(false);
  });

  it("becomes dirty when a field is marked", () => {
    const { result } = renderHook(() => useTripDirty());
    act(() => result.current.markDirty("trip_name"));
    expect(result.current.isDirty).toBe(true);
  });

  it("returns to clean after reset", () => {
    const { result } = renderHook(() => useTripDirty());
    act(() => result.current.markDirty("trip_name"));
    act(() => result.current.reset());
    expect(result.current.isDirty).toBe(false);
  });

  it("multiple marks of the same key still produce one dirty entry", () => {
    const { result } = renderHook(() => useTripDirty());
    act(() => {
      result.current.markDirty("trip_name");
      result.current.markDirty("trip_name");
    });
    expect(result.current.dirtyKeys).toEqual(["trip_name"]);
  });
});
```

- [ ] **Step 2: Run — fails because hook doesn't exist**

Run: `npm test -- app/\(cms\)/trips/_components/__tests__/useTripDirty.test.tsx`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```ts
// app/(cms)/trips/_components/useTripDirty.ts
import { useCallback, useRef, useState } from "react";

/**
 * Tracks which fields the user has touched, so isDirty doesn't
 * require a full JSON.stringify of form state on every render.
 */
export function useTripDirty() {
  const setRef = useRef<Set<string>>(new Set());
  // Tick counter forces re-render when the set changes; the set itself
  // is mutated in place to keep markDirty O(1) and allocation-free.
  const [, setTick] = useState(0);

  const markDirty = useCallback((key: string) => {
    if (!setRef.current.has(key)) {
      setRef.current.add(key);
      setTick((t) => t + 1);
    }
  }, []);

  const reset = useCallback(() => {
    if (setRef.current.size > 0) {
      setRef.current = new Set();
      setTick((t) => t + 1);
    }
  }, []);

  return {
    isDirty: setRef.current.size > 0,
    dirtyKeys: Array.from(setRef.current),
    markDirty,
    reset,
  };
}
```

- [ ] **Step 4: Run — passes**

Run: `npm test -- app/\(cms\)/trips/_components/__tests__/useTripDirty.test.tsx`

Expected: PASS — all 4 tests.

- [ ] **Step 5: Wire into TripEditor**

In `app/(cms)/trips/_components/TripEditor.tsx`:

Remove these lines (currently 55-58):
```ts
const isDirty = useMemo(
  () => JSON.stringify(form) !== JSON.stringify(initialForm),
  [form, initialForm],
);
```

Replace with:
```ts
const { isDirty, markDirty, reset: resetDirty } = useTripDirty();
```

Update `updateField` (currently lines 74-79) to mark dirty:
```ts
const updateField = useCallback(
  <K extends keyof TripFormState>(key: K, value: TripFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    markDirty(String(key));
  },
  [markDirty],
);
```

In `handleSave`'s success branch (currently around line 141-147), reset dirty after a successful update:
```ts
if (res.success) {
  if (isEditing) {
    toast.success("Trip updated");
    setInitialForm({ ...form });
    resetDirty();
  } else {
    toast.success("Trip created!");
    router.push("/trips");
  }
}
```

Add `useTripDirty` to the imports at the top:
```ts
import { useTripDirty } from "./useTripDirty";
```

Remove `useMemo` from the React import if no longer used.

- [ ] **Step 6: Smoke test**

```bash
npm run dev
```

Open a trip in /trips/<id>/edit. Type in the trip name. Verify "Unsaved changes" pill appears. Save. Verify it disappears. Type more — it appears again.

- [ ] **Step 7: Commit**

```bash
git add app/\(cms\)/trips/_components/useTripDirty.ts app/\(cms\)/trips/_components/__tests__/useTripDirty.test.tsx app/\(cms\)/trips/_components/TripEditor.tsx
git commit -m "perf(cms): replace JSON.stringify dirty check with dirty-key set"
```

---

## Task 6: Make logActivity fire-and-forget in trip server actions

**Files:**
- Modify: `app/(cms)/trips/actions.ts`

- [ ] **Step 1: Add a fire-and-forget helper at the top of actions.ts**

After the existing imports in `app/(cms)/trips/actions.ts`, add:

```ts
/**
 * Fire `logActivity` without awaiting. Errors are logged but never
 * propagated to the caller — activity logging is best-effort and
 * should never block the user-visible save path.
 */
function logActivityAsync(input: Parameters<typeof logActivity>[0]): void {
  void logActivity(input).catch((err) => {
    console.error("[logActivity] swallowed error:", err);
  });
}
```

- [ ] **Step 2: Replace `await logActivity(...)` with `logActivityAsync(...)` in the four trip actions**

In `createTripAction` (currently line 144):
```ts
logActivityAsync({ table_name: "trips", record_id: tripId, action: "INSERT", new_values: { trip_name: parsed.data.trip_name, status: payload.settings.status, slug } });
```

In `updateTripAction` (currently line 221):
```ts
logActivityAsync({ table_name: "trips", record_id: tripId, action: "UPDATE", new_values: { trip_name: parsed.data.trip_name, status: payload.settings.status, slug } });
```

In `deleteTripAction` (currently line 243):
```ts
logActivityAsync({ table_name: "trips", record_id: tripId, action: "DELETE" });
```

In `toggleTripFieldAction` (currently line 317):
```ts
logActivityAsync({ table_name: "trips", record_id: tripId, action: "UPDATE", new_values: { [field]: value } });
```

In `cloneAsBatchAction` (currently line 373-378):
```ts
logActivityAsync({
  table_name: "trips",
  record_id: newTripId,
  action: "INSERT",
  new_values: { cloned_from: sourceTripId, trip_name: source.trip_name },
});
```

In `uploadTripItineraryAction` (currently line 292-297):
```ts
logActivityAsync({
  table_name: "trips",
  record_id: tripId,
  action: "UPDATE",
  new_values: { itinerary_uploaded: true, itinerary_path: path },
});
```

- [ ] **Step 3: Verify no compile errors**

Run: `npx tsc --noEmit`

Expected: no new errors related to actions.ts.

- [ ] **Step 4: Smoke test save in dev**

```bash
npm run dev
```

Open a trip, change the name, save. Verify the success toast appears as fast or faster than before. Check the server console: any swallowed-error logs printed there are expected behavior, not regressions.

- [ ] **Step 5: Commit**

```bash
git add app/\(cms\)/trips/actions.ts
git commit -m "perf(cms): fire-and-forget logActivity in trip server actions"
```

---

## Task 7: Hoist the bucket allowlist check out of the upload hot path

**Files:**
- Modify: `app/(cms)/trips/actions.ts`

Today `uploadTripItineraryAction` calls `ensureCmsMediaBucketAllowsItineraryUploads` on every upload via dynamic import (lines 284-287). The check is idempotent. We move it to a module-level promise so the cost is paid once per server lifetime.

- [ ] **Step 1: Replace the in-action call with a module-level memoized promise**

In `app/(cms)/trips/actions.ts`, near the top after the imports, add:

```ts
// Memoize the bucket allowlist check at module scope. The check is
// idempotent and read-mostly; running it once per server lifetime is
// safe and removes a hot-path import + roundtrip per upload.
let _bucketAllowlistReady: Promise<void> | null = null;
function ensureBucketAllowlistOnce(): Promise<void> {
  if (!_bucketAllowlistReady) {
    _bucketAllowlistReady = (async () => {
      const { ensureCmsMediaBucketAllowsItineraryUploads } = await import(
        "@/app/(cms)/settings/actions"
      );
      await ensureCmsMediaBucketAllowsItineraryUploads();
    })().catch((err) => {
      // If the check fails, clear the cache so the next upload retries
      // (rather than poisoning the cache for the rest of the process).
      _bucketAllowlistReady = null;
      throw err;
    });
  }
  return _bucketAllowlistReady;
}
```

In `uploadTripItineraryAction`, replace lines 282-288 (the dynamic import block) with:

```ts
    await ensureBucketAllowlistOnce();
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Smoke test — upload a PDF itinerary**

```bash
npm run dev
```

Open an existing trip → Settings tab → upload a PDF as the itinerary. First upload should succeed. Second upload should also succeed (and feel measurably faster — server logs show no second `ensureCmsMediaBucketAllowsItineraryUploads` invocation).

- [ ] **Step 4: Commit**

```bash
git add app/\(cms\)/trips/actions.ts
git commit -m "perf(cms): memoize cms-media bucket allowlist check at module scope"
```

---

## Task 8: Add dev-only timing instrumentation around save paths

**Files:**
- Modify: `app/(cms)/trips/actions.ts`

This gives us before/after numbers for the PR description and a way to spot future regressions without sticking timers in user-visible code.

- [ ] **Step 1: Add a tiny dev-only timer wrapper at the top of actions.ts**

After the imports:

```ts
const IS_DEV = process.env.NODE_ENV !== "production";
async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!IS_DEV) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    console.log(`[trips] ${label}: ${Math.round(performance.now() - start)}ms`);
  }
}
```

- [ ] **Step 2: Wrap the slow blocks in `createTripAction` and `updateTripAction`**

In `createTripAction`, wrap the `await Promise.all([... upsertTripContent ...])` block:
```ts
await timed("createTrip:content", () => Promise.all([
  payload.overview ? upsertTripContent(tripId, "overview", payload.overview) : Promise.resolve(),
  payload.description ? upsertTripContent(tripId, "description", payload.description) : Promise.resolve(),
  payload.tagline ? upsertTripContent(tripId, "tagline", payload.tagline) : Promise.resolve(),
  upsertHighlights(tripId, payload.highlights.filter(Boolean)),
]));
```

Wrap the itinerary save:
```ts
if (payload.itinerary.length > 0) {
  await timed("createTrip:itinerary", () => saveTripItinerary(tripId, payload.itinerary));
}
```

Wrap the inclusions save:
```ts
await timed("createTrip:inclusions", () => saveTripInclusions(tripId, payload.inclusions, payload.exclusions));
```

Apply the same three wraps in `updateTripAction`.

- [ ] **Step 3: Capture before/after numbers**

```bash
npm run dev
```

Open a trip with at least 5 itinerary days, edit and save. Server console should print numbers like:
```
[trips] updateTrip:content: 120ms
[trips] updateTrip:itinerary: 450ms
[trips] updateTrip:inclusions: 80ms
```

Record these in the PR description (replace the actual numbers with what you observe).

- [ ] **Step 4: Commit**

```bash
git add app/\(cms\)/trips/actions.ts
git commit -m "chore(cms): add dev-only timing for trip server actions"
```

---

## Ready to merge

- [ ] All Vitest tests pass: `npm test`
- [ ] `npx tsc --noEmit` is clean
- [ ] Manual smoke test passed:
  - End date recomputes when duration changes (Task 4 step 3)
  - Selling price recomputes when MRP changes (Task 4 step 3)
  - Save feels faster on a long trip (Task 8 step 3 numbers in PR description)
  - Itinerary PDF upload — second upload faster than first (Task 7 step 3)
- [ ] PR description includes before/after timing numbers from Task 8
- [ ] Branch created: `git checkout -b fix/cms-pr1-latency-and-end-date`
- [ ] PR opened against `main`
