# PR 5 — Autosave + draft recovery

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a browser refresh during trip creation non-destructive. Server-side autosave + localStorage mirror, with a "pick up where you left off" prompt.

**Architecture:** New `autosaveTripAction` mutates an existing or newly-materialized `Draft` row, debounced 1500ms after the last keystroke. While the user is on `/trips/new` and hasn't yet picked a destination, autosave is localStorage-only (because `nextTripId` requires a destination). The moment a destination is picked, the row is materialized server-side and the URL is replaced. localStorage mirror runs in parallel as a failure backstop with retry/backoff/banner UX. Drafts get a quick-filter and badge in the trips list, and a daily cron purges drafts older than 30 days.

**Tech Stack:** Next.js 16, React 19, Vitest + RTL, Supabase, Vercel Cron.

**Depends on PR 1** (the centralized derived-fields hook) — autosave saves the post-derivation state.

---

## File map

- Create: `supabase/migrations/20260506T1200__add_trip_autosave_columns.sql`
- Modify: `lib/types.ts` (`DbTrip` adds `last_autosaved_at`, `autosave_owner`)
- Create: `app/(cms)/trips/_components/useAutosave.ts` (the hook)
- Create: `app/(cms)/trips/_components/__tests__/useAutosave.test.tsx`
- Create: `app/(cms)/trips/_components/AutosaveStatus.tsx` (status pill)
- Create: `app/(cms)/trips/_components/ResumeDraftModal.tsx`
- Modify: `app/(cms)/trips/actions.ts` (new `autosaveTripAction`)
- Modify: `lib/db/trips.ts` (helper `upsertAutosaveTrip`)
- Modify: `app/(cms)/trips/_components/TripEditor.tsx` (wire autosave + status pill)
- Modify: `app/(cms)/trips/_components/TripsClient.tsx` (Drafts filter + badge + completeness)
- Create: `app/api/cron/purge-drafts/route.ts` (daily cleanup)
- Modify: `vercel.ts` (cron schedule) — or `vercel.json` if that's what the repo uses

---

## Task 1: Migration

**Files:**
- Create: `supabase/migrations/20260506T1200__add_trip_autosave_columns.sql`

> **PERMISSION GATE:** Schema change. Additive, safe.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260506T1200__add_trip_autosave_columns.sql
-- PR 5: Autosave + draft recovery.

ALTER TABLE trips
  ADD COLUMN last_autosaved_at timestamptz NULL,
  ADD COLUMN autosave_owner    uuid        NULL;

CREATE INDEX idx_trips_drafts_by_owner
  ON trips (autosave_owner, last_autosaved_at DESC)
  WHERE status = 'Draft';
```

- [ ] **Step 2: Apply with permission**

> Pause. Tell the user: "Ready to apply migration `20260506T1200__add_trip_autosave_columns.sql` — adds `last_autosaved_at`, `autosave_owner` to `trips` plus a partial index on drafts. OK to apply?"

After approval, apply via Supabase MCP `apply_migration`.

- [ ] **Step 3: Verify**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'trips' AND column_name IN ('last_autosaved_at', 'autosave_owner');
```

Expected: 2 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260506T1200__add_trip_autosave_columns.sql
git commit -m "feat(db): add autosave tracking columns to trips"
```

---

## Task 2: Update DbTrip type

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add the fields to `DbTrip`**

In `lib/types.ts`, add inside the `DbTrip` interface near the existing tracking columns:
```ts
  last_autosaved_at: string | null;
  autosave_owner: string | null;
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(cms): add autosave columns to DbTrip type"
```

---

## Task 3: `autosaveTripAction` server action

**Files:**
- Modify: `lib/db/trips.ts` (add `upsertAutosaveTrip` helper)
- Modify: `app/(cms)/trips/actions.ts` (add `autosaveTripAction`)

- [ ] **Step 1: Add the DB helper**

In `lib/db/trips.ts`, add at the bottom:

```ts
/**
 * Materialize or update a draft trip in autosave mode.
 *
 * - If `tripId` is null AND the payload has a `destination_id`, generates
 *   a fresh trip_id and inserts a new Draft row.
 * - If `tripId` is null AND no destination yet, throws — the caller
 *   should keep autosaving to localStorage only.
 * - If `tripId` is set, partial-updates that row.
 *
 * Sets `last_autosaved_at = now()` and `autosave_owner = ownerId` on every call.
 * Skips slug regen unless trip_name changed (slug stays NULL until the row is
 * promoted out of autosave mode via the regular updateTripAction).
 */
export async function upsertAutosaveTrip(
  tripId: string | null,
  ownerId: string,
  payload: Partial<DbTrip> & { trip_name?: string | null },
): Promise<DbTrip> {
  const db = getServiceClient();
  const stamped = {
    ...payload,
    last_autosaved_at: new Date().toISOString(),
    autosave_owner: ownerId,
  };
  if (tripId) {
    const { data, error } = await db
      .from("trips")
      .update(stamped)
      .eq("trip_id", tripId)
      .select("*")
      .single();
    if (error) throw error;
    return data as DbTrip;
  }
  // Materialize requires destination_id (existing nextTripId requirement).
  if (!payload.destination_id) {
    throw new Error("Cannot materialize draft without destination_id");
  }
  // Caller pre-computes trip_id via nextTripId (matches createTripAction
  // pattern). For autosave we delegate ID generation to the action layer
  // so this helper stays pure DB.
  if (!payload.trip_id) {
    throw new Error("upsertAutosaveTrip requires trip_id when materializing");
  }
  const { data, error } = await db
    .from("trips")
    .insert({ ...stamped, status: stamped.status ?? "Draft" })
    .select("*")
    .single();
  if (error) throw error;
  return data as DbTrip;
}
```

Note: import `DbTrip` at the top of the file if it isn't already.

- [ ] **Step 2: Add the server action**

In `app/(cms)/trips/actions.ts`, add at the bottom:

```ts
// ---------------------------------------------------------------------------
// Autosave
// ---------------------------------------------------------------------------

import { upsertAutosaveTrip } from "@/lib/db/trips";

export async function autosaveTripAction(
  tripId: string | null,
  formData: FormData,
): Promise<{ success: boolean; tripId?: string; savedAt?: string; error?: string }> {
  try {
    const payload = parseTripFormData(formData);
    const parsed = tripBasicSchema.partial().safeParse(payload.basic);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    // Owner: pull from server auth context.
    const { getServerUser } = await import("@/lib/supabase/server-auth");
    const user = await getServerUser();
    if (!user) return { success: false, error: "Not signed in" };

    let resolvedTripId = tripId;
    let row: DbTrip;

    if (!resolvedTripId) {
      // Materialize requires a destination.
      if (!parsed.data.destination_id) {
        return { success: false, error: "DESTINATION_REQUIRED" };
      }
      // Mirror createTripAction's id-generation logic.
      const db = getServiceClient();
      const { data: dest } = await db
        .from("destinations")
        .select("is_domestic, destination_code")
        .eq("destination_id", parsed.data.destination_id)
        .single();
      const isDomestic = dest?.is_domestic ?? true;
      const destCode = (dest?.destination_code ?? "GEN").replace(/-/g, "").slice(0, 3).toUpperCase();
      const tripType = parsed.data.trip_type ?? "Community";
      resolvedTripId = await nextTripId(isDomestic, tripType, destCode);
      row = await upsertAutosaveTrip(null, user.id, {
        ...parsed.data,
        trip_id: resolvedTripId,
        status: "Draft",
        is_listed: false,
        show_on_homepage: false,
      } as Partial<DbTrip>);
    } else {
      row = await upsertAutosaveTrip(resolvedTripId, user.id, parsed.data as Partial<DbTrip>);
    }

    return { success: true, tripId: row.trip_id, savedAt: row.last_autosaved_at ?? undefined };
  } catch (err) {
    console.error("[autosaveTripAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Autosave failed" };
  }
}
```

Note: import `DbTrip` and verify `getServerUser` exists at `@/lib/supabase/server-auth`. If it has a different name, search for the auth helper used by other server actions (`grep -rn "getServerUser\|currentUser" app/\(cms\)/`) and use that.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`

Expected: clean. If `getServerUser` doesn't exist under that name, fix the import.

- [ ] **Step 4: Commit**

```bash
git add lib/db/trips.ts app/\(cms\)/trips/actions.ts
git commit -m "feat(cms): autosaveTripAction with materialize-on-destination"
```

---

## Task 4: `useAutosave` hook (TDD on the state machine)

**Files:**
- Create: `app/(cms)/trips/_components/useAutosave.ts`
- Create: `app/(cms)/trips/_components/__tests__/useAutosave.test.tsx`

The hook's job is the state machine — debounce, retry, localStorage mirror, status. We test it with a mocked save function rather than hitting the real action.

- [ ] **Step 1: Write the failing tests**

```tsx
// app/(cms)/trips/_components/__tests__/useAutosave.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAutosave } from "../useAutosave";

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useAutosave", () => {
  it("starts in 'idle' status before any payload arrives", () => {
    const save = vi.fn();
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    expect(result.current.status).toBe("idle");
  });

  it("debounces the save call by debounceMs", async () => {
    const save = vi.fn().mockResolvedValue({ success: true, tripId: "T1", savedAt: new Date().toISOString() });
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A" }));
    expect(save).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1499));
    expect(save).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  });

  it("only fires the latest payload after rapid edits", async () => {
    const save = vi.fn().mockResolvedValue({ success: true, tripId: "T1", savedAt: "" });
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A" }));
    act(() => vi.advanceTimersByTime(500));
    act(() => result.current.queue({ trip_name: "AB" }));
    act(() => vi.advanceTimersByTime(500));
    act(() => result.current.queue({ trip_name: "ABC" }));
    act(() => vi.advanceTimersByTime(1500));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(null, expect.objectContaining({ trip_name: "ABC" }));
  });

  it("mirrors to localStorage on every queue", () => {
    const save = vi.fn();
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A" }));
    const raw = localStorage.getItem("nomichi.trip-draft.u1.NEW");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toMatchObject({ trip_name: "A" });
  });

  it("retries on save failure with backoff", async () => {
    const save = vi.fn()
      .mockResolvedValueOnce({ success: false, error: "boom" })
      .mockResolvedValueOnce({ success: true, tripId: "T1", savedAt: "" });
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A" }));
    act(() => vi.advanceTimersByTime(1500));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(result.current.status).toBe("retrying");
    // First retry at 2000ms backoff
    act(() => vi.advanceTimersByTime(2000));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe("saved");
  });

  it("transitions to 'localOnly' status when DESTINATION_REQUIRED is returned", async () => {
    const save = vi.fn().mockResolvedValue({ success: false, error: "DESTINATION_REQUIRED" });
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A" }));
    act(() => vi.advanceTimersByTime(1500));
    await waitFor(() => expect(result.current.status).toBe("localOnly"));
  });

  it("clears localStorage on successful save", async () => {
    const save = vi.fn().mockResolvedValue({ success: true, tripId: "T1", savedAt: "" });
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A" }));
    act(() => vi.advanceTimersByTime(1500));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(localStorage.getItem("nomichi.trip-draft.u1.NEW")).toBeNull();
  });

  it("flush() saves immediately and cancels pending debounce", async () => {
    const save = vi.fn().mockResolvedValue({ success: true, tripId: "T1", savedAt: "" });
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A" }));
    await act(async () => { await result.current.flush(); });
    expect(save).toHaveBeenCalledTimes(1);
    // Even after the debounce window, no second call.
    act(() => vi.advanceTimersByTime(1500));
    expect(save).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run — fails (hook doesn't exist)**

Run: `npm test -- app/\(cms\)/trips/_components/__tests__/useAutosave.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement the hook**

```ts
// app/(cms)/trips/_components/useAutosave.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "saving" | "saved" | "retrying" | "localOnly";

interface SaveResult {
  success: boolean;
  tripId?: string;
  savedAt?: string;
  error?: string;
}

interface UseAutosaveOpts {
  tripId: string | null;
  userId: string;
  save: (tripId: string | null, payload: Record<string, unknown>) => Promise<SaveResult>;
  debounceMs?: number;
  /** Backoff schedule for retries (ms). Caps at last value indefinitely. */
  backoffMs?: readonly number[];
}

const DEFAULT_BACKOFF = [2000, 5000, 15000, 30000, 60000] as const;

/**
 * Debounced autosave with localStorage mirror + retry.
 * Status transitions:
 *   idle -> saving -> saved
 *   saving -> retrying (on failure) -> saving (next attempt) -> saved
 *   saving -> localOnly (if server reports DESTINATION_REQUIRED)
 */
export function useAutosave({
  tripId: initialTripId,
  userId,
  save,
  debounceMs = 1500,
  backoffMs = DEFAULT_BACKOFF,
}: UseAutosaveOpts) {
  const [status, setStatus] = useState<Status>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string | null>(initialTripId);

  const tripIdRef = useRef(initialTripId);
  const pendingRef = useRef<Record<string, unknown> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttempt = useRef(0);

  const lsKey = useCallback(
    (id: string | null) => `nomichi.trip-draft.${userId}.${id ?? "NEW"}`,
    [userId],
  );

  const writeMirror = useCallback(
    (payload: Record<string, unknown>) => {
      try {
        localStorage.setItem(lsKey(tripIdRef.current), JSON.stringify(payload));
      } catch {
        // Quota or access errors — non-fatal; server save still tries.
      }
    },
    [lsKey],
  );

  const clearMirror = useCallback(() => {
    try {
      localStorage.removeItem(lsKey(tripIdRef.current));
    } catch {}
  }, [lsKey]);

  const performSave = useCallback(async () => {
    const payload = pendingRef.current;
    if (!payload) return;
    setStatus("saving");
    const res = await save(tripIdRef.current, payload);
    if (res.success) {
      retryAttempt.current = 0;
      if (res.tripId && res.tripId !== tripIdRef.current) {
        // Migrate localStorage key NEW -> <id>
        clearMirror();
        tripIdRef.current = res.tripId;
        setTripId(res.tripId);
      } else {
        clearMirror();
      }
      pendingRef.current = null;
      setLastSavedAt(res.savedAt ?? new Date().toISOString());
      setStatus("saved");
      return;
    }
    if (res.error === "DESTINATION_REQUIRED") {
      setStatus("localOnly");
      return;
    }
    // Schedule retry.
    setStatus("retrying");
    const delay = backoffMs[Math.min(retryAttempt.current, backoffMs.length - 1)];
    retryAttempt.current += 1;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      void performSave();
    }, delay);
  }, [save, backoffMs, clearMirror]);

  const queue = useCallback(
    (payload: Record<string, unknown>) => {
      pendingRef.current = payload;
      writeMirror(payload);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        void performSave();
      }, debounceMs);
    },
    [debounceMs, performSave, writeMirror],
  );

  const flush = useCallback(async () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    await performSave();
  }, [performSave]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  return { status, lastSavedAt, tripId, queue, flush };
}
```

- [ ] **Step 4: Run tests — all pass**

Run: `npm test -- app/\(cms\)/trips/_components/__tests__/useAutosave.test.tsx`

Expected: PASS — all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add app/\(cms\)/trips/_components/useAutosave.ts app/\(cms\)/trips/_components/__tests__/useAutosave.test.tsx
git commit -m "feat(cms): useAutosave hook with debounce, retry, localStorage mirror"
```

---

## Task 5: AutosaveStatus pill component

**Files:**
- Create: `app/(cms)/trips/_components/AutosaveStatus.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/(cms)/trips/_components/AutosaveStatus.tsx
"use client";

import { useEffect, useState } from "react";

interface Props {
  status: "idle" | "saving" | "saved" | "retrying" | "localOnly";
  lastSavedAt: string | null;
}

function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

export function AutosaveStatus({ status, lastSavedAt }: Props) {
  // Tick once a second so "just now" -> "5s ago" updates without keystrokes.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const config = (() => {
    switch (status) {
      case "saving":  return { color: "bg-mid",       text: "Saving…",                    title: "Autosaving your changes." };
      case "saved":   return { color: "bg-sem-green", text: `Saved · ${relTime(lastSavedAt)}`, title: "Your work is autosaved." };
      case "retrying":return { color: "bg-rust",      text: "Couldn't save — retrying",   title: "Your changes are safe in this browser." };
      case "localOnly":return { color: "bg-sem-amber", text: "Saved on this device",      title: "Pick a destination to start syncing to the server." };
      default:        return { color: "bg-fog",       text: "",                           title: "" };
    }
  })();

  if (!config.text) return null;
  return (
    <span title={config.title} className="flex items-center gap-1.5 text-[11px] font-medium text-mid whitespace-nowrap">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.color}`} />
      {config.text}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(cms\)/trips/_components/AutosaveStatus.tsx
git commit -m "feat(cms): AutosaveStatus pill"
```

---

## Task 6: Wire autosave into TripEditor + URL replace on materialization

**Files:**
- Modify: `app/(cms)/trips/_components/TripEditor.tsx`

- [ ] **Step 1: Accept `userId` prop and add the hook**

The trip editor needs the current user's id to scope localStorage keys. Pass it from the page (Step 4 below).

In `TripEditor.tsx`, update the props:
```ts
interface TripEditorProps {
  trip: TripFull | null;
  destinations: DbDestination[];
  departureCities: DbDepartureCity[];   // from PR 4
  websiteUrl: string;
  userId: string;
}
```

Add imports:
```ts
import { useAutosave } from "./useAutosave";
import { AutosaveStatus } from "./AutosaveStatus";
import { autosaveTripAction } from "../actions";
```

Inside the component, after the `useState` declarations:

```ts
const buildPayload = useCallback((f: TripFormState) => ({
  basic: {
    trip_name: f.trip_name, trip_type: f.trip_type,
    trip_sub_type: f.trip_sub_type || null, trip_category: f.trip_category || null,
    destination_id: f.destination_id || null,
    duration_days: f.duration_days, duration_nights: f.duration_nights,
    start_date: f.start_date || null, end_date: f.end_date || null,
    mrp_price: f.mrp_price, selling_price: f.selling_price,
    discount_pct: f.discount_pct, discount_amount: f.discount_amount,
    quoted_price: f.quoted_price,
    advance_pct: f.advance_pct, total_slots: f.total_slots,
    batch_number: f.batch_number || null, group_slug: f.group_slug,
    tagline: f.tagline || null,
    departure_city: f.departure_city || null,
    departure_airport: f.departure_airport || null,
    booking_kind: f.booking_kind, currency_code: f.currency_code,
  },
  overview: f.overview, description: f.description, tagline: f.tagline,
  highlights: f.highlights,
  itinerary: f.itinerary, inclusions: f.inclusions, exclusions: f.exclusions,
  settings: {
    status: f.status, is_listed: f.is_listed,
    show_on_homepage: f.show_on_homepage,
    dossier_url: f.dossier_url || null,
  },
}), []);

const saveFn = useCallback(async (id: string | null, payload: Record<string, unknown>) => {
  const fd = new FormData();
  fd.set("payload", JSON.stringify(payload));
  return autosaveTripAction(id, fd);
}, []);

const { status: autosaveStatus, lastSavedAt, tripId: autosaveTripId, queue: queueAutosave, flush: flushAutosave } = useAutosave({
  tripId: trip?.trip_id ?? null,
  userId,
  save: saveFn,
});

// Queue a save whenever the form changes after the first render.
const isFirstRenderRef = useRef(true);
useEffect(() => {
  if (isFirstRenderRef.current) {
    isFirstRenderRef.current = false;
    return;
  }
  queueAutosave(buildPayload(form));
}, [form, queueAutosave, buildPayload]);

// On materialization, replace the URL so refresh lands on the edit page.
useEffect(() => {
  if (!trip && autosaveTripId) {
    router.replace(`/trips/${autosaveTripId}/edit`, { scroll: false });
  }
}, [trip, autosaveTripId, router]);
```

Add `useRef`, `useEffect` to the React imports if not present.

- [ ] **Step 2: Replace the "Unsaved changes" text with `<AutosaveStatus />`**

In the top bar (currently lines 191-193):

```tsx
<AutosaveStatus status={autosaveStatus} lastSavedAt={lastSavedAt} />
```

Remove the `isDirty` "Unsaved changes" text. (`isDirty` from PR 1 still drives the navigate-away confirm dialog.)

- [ ] **Step 3: Show a non-blocking banner after 30s of retrying**

After the top bar, before the main content split, add:

```tsx
{autosaveStatus === "retrying" && (
  <div className="border-b border-sem-amber/40 bg-sem-amber-bg px-4 py-2 text-xs text-sem-amber">
    We&apos;re having trouble saving to the server. Your changes are safe in this browser — don&apos;t close this tab.
  </div>
)}
```

(For v1 the banner appears as soon as `retrying` status is reached, since the hook only enters that state after the first retry attempt has been scheduled.)

- [ ] **Step 4: Update manual `handleSave` to flush autosave first**

In `handleSave`, before the `startTransition(...)` block, add:

```ts
await flushAutosave();
```

This ensures any pending debounce gets included; the explicit save uses the full createTrip/updateTrip path with revalidate + log activity.

- [ ] **Step 5: Pass `userId` from each page that mounts `TripEditor`**

In `app/(cms)/trips/new/page.tsx`, `app/(cms)/trips/[tripId]/edit/page.tsx`:

```ts
import { getServerUser } from "@/lib/supabase/server-auth";

const user = await getServerUser();
if (!user) redirect("/auth/sign-in");

return <TripEditor trip={...} destinations={...} departureCities={...} websiteUrl={...} userId={user.id} />;
```

Adjust to match the actual auth helper name found in Step 3 of Task 3.

- [ ] **Step 6: Smoke test**

```bash
npm run dev
```

1. Open `/trips/new`. Status pill is empty.
2. Type a name. Wait 2 seconds. Pill shows "Saved on this device" (since no destination yet).
3. Pick a destination. Within 2 seconds, pill shows "Saving…" then "Saved · just now". URL changes to `/trips/<id>/edit`.
4. Refresh. Editor loads with everything intact, status pill shows "Saved · 1m ago".
5. Open dev tools → Network → set offline. Type more. Pill shows "Saving…" then "Couldn't save — retrying" + amber banner.
6. Set online again. Within ~2 seconds, pill returns to "Saved".

- [ ] **Step 7: Commit**

```bash
git add app/\(cms\)/trips/_components/TripEditor.tsx app/\(cms\)/trips/new/page.tsx app/\(cms\)/trips/\[tripId\]/edit/page.tsx
git commit -m "feat(cms): wire autosave into TripEditor with status pill and URL replace"
```

---

## Task 7: Resume modal on `/trips/new`

**Files:**
- Create: `app/(cms)/trips/_components/ResumeDraftModal.tsx`
- Modify: `app/(cms)/trips/new/page.tsx` (load most-recent draft for the user)
- Modify: `lib/db/trips.ts` (helper `findResumableDraft`)

- [ ] **Step 1: DB helper**

In `lib/db/trips.ts`, add:

```ts
export async function findResumableDraft(userId: string): Promise<DbTrip | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("trips")
    .select("*")
    .eq("status", "Draft")
    .eq("autosave_owner", userId)
    .not("last_autosaved_at", "is", null)
    .order("last_autosaved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as DbTrip | null;
}
```

- [ ] **Step 2: Resume modal**

```tsx
// app/(cms)/trips/_components/ResumeDraftModal.tsx
"use client";

import { useRouter } from "next/navigation";
import type { DbTrip } from "@/lib/types";

interface Props {
  draft: DbTrip;
  onDismiss: () => void;
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)} days ago`;
}

export function ResumeDraftModal({ draft, onDismiss }: Props) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-xl">
        <h3 className="text-base font-semibold text-ink">Pick up where you left off?</h3>
        <p className="mt-1 text-sm text-mid">You have an unfinished trip from {relTime(draft.last_autosaved_at)}.</p>
        <div className="mt-4 rounded-lg border border-line bg-surface3 p-3 text-sm">
          <div className="font-medium text-ink">{draft.trip_name || "Untitled draft"}</div>
          <div className="mt-0.5 text-xs text-mid">
            {draft.duration_days ? `${draft.duration_days} days` : "No duration set"}
            {draft.start_date ? ` · starts ${draft.start_date}` : ""}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-mid hover:bg-surface3"
          >
            Start fresh
          </button>
          <button
            type="button"
            onClick={() => router.push(`/trips/${draft.trip_id}/edit`)}
            className="rounded-lg bg-rust px-3 py-1.5 text-sm font-medium text-white hover:bg-rust/90"
          >
            Resume editing
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Surface in `/trips/new`**

In `app/(cms)/trips/new/page.tsx`, after fetching the user, also fetch the resumable draft and pass to a small wrapper client component that shows the modal on mount:

```ts
import { findResumableDraft } from "@/lib/db/trips";
// ...
const resumable = await findResumableDraft(user.id);
return (
  <NewTripWrapper
    user={user}
    destinations={destinations}
    departureCities={departureCities}
    websiteUrl={websiteUrl}
    resumable={resumable}
  />
);
```

Create `app/(cms)/trips/new/NewTripWrapper.tsx`:

```tsx
"use client";

import { useState } from "react";
import { TripEditor } from "../_components/TripEditor";
import { ResumeDraftModal } from "../_components/ResumeDraftModal";
import type { DbTrip, DbDestination, DbDepartureCity } from "@/lib/types";

interface User { id: string; }
interface Props {
  user: User;
  destinations: DbDestination[];
  departureCities: DbDepartureCity[];
  websiteUrl: string;
  resumable: DbTrip | null;
}

export function NewTripWrapper({ user, destinations, departureCities, websiteUrl, resumable }: Props) {
  const [showResume, setShowResume] = useState(!!resumable);
  return (
    <>
      {showResume && resumable && (
        <ResumeDraftModal draft={resumable} onDismiss={() => setShowResume(false)} />
      )}
      <TripEditor
        trip={null}
        destinations={destinations}
        departureCities={departureCities}
        websiteUrl={websiteUrl}
        userId={user.id}
      />
    </>
  );
}
```

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

1. Start a trip on `/trips/new`. Type a name. Pick a destination. Wait for autosave. Note the URL changed to `/trips/<id>/edit`.
2. Click Back to `/trips`, then "New Trip". The Resume modal appears with that draft.
3. Click "Resume editing". You're back on the same draft.
4. Click Back, "New Trip" again. Resume modal appears. Click "Start fresh". A blank editor opens. The original draft is still in the trips list (Task 8).

- [ ] **Step 5: Commit**

```bash
git add lib/db/trips.ts app/\(cms\)/trips/_components/ResumeDraftModal.tsx app/\(cms\)/trips/new/page.tsx app/\(cms\)/trips/new/NewTripWrapper.tsx
git commit -m "feat(cms): resume-draft prompt on /trips/new"
```

---

## Task 8: Drafts filter + badge in trips list

**Files:**
- Modify: `app/(cms)/trips/_components/TripsClient.tsx`

- [ ] **Step 1: Add a Drafts filter pill alongside existing FILTER_OPTIONS**

Today the trip-type filter doesn't include status. Add a separate status filter or a "Drafts" boolean toggle. Simplest: add a new state filter chip row above the existing one, controlling status filter.

In `TripsClient.tsx`, near the top of the component state, add:

```ts
const [showDrafts, setShowDrafts] = useState(false);
```

In the filtering logic (search for `useMemo` around the trip filter), add:

```ts
const filtered = useMemo(() => {
  let list = initialTrips;
  if (showDrafts) list = list.filter((t) => t.status === "Draft");
  // ... existing filters
  return list;
}, [initialTrips, showDrafts /* existing deps */]);
```

In the JSX, near the existing `FilterPills`, add a button:

```tsx
<button
  type="button"
  onClick={() => setShowDrafts((s) => !s)}
  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
    showDrafts
      ? "bg-rust/10 border-rust text-rust"
      : "bg-surface border-line text-mid hover:bg-surface3"
  }`}
>
  Drafts ({initialTrips.filter((t) => t.status === "Draft").length})
</button>
```

- [ ] **Step 2: Show "Last edited" relative time in the row when status is Draft**

Add a small column or extend the existing status column to show `last_autosaved_at` relative time for drafts. The exact placement depends on the existing `Column[]` definition — search for `columns: Column[]` and add to the Status cell:

```tsx
{trip.status === "Draft" && trip.last_autosaved_at && (
  <span className="ml-2 text-[10px] text-mid">edited {relTime(trip.last_autosaved_at)}</span>
)}
```

(Add a `relTime` helper at module scope if `formatDate` doesn't already cover relative formatting.)

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```

Open `/trips`. Click the "Drafts (N)" chip. Only drafts appear, with relative timestamps. Click again — all trips return.

- [ ] **Step 4: Commit**

```bash
git add app/\(cms\)/trips/_components/TripsClient.tsx
git commit -m "feat(cms): drafts filter + last-edited badge in trips list"
```

---

## Task 9: Daily purge cron

**Files:**
- Create: `app/api/cron/purge-drafts/route.ts`
- Modify: `vercel.ts` (or `vercel.json`)

- [ ] **Step 1: Implement the route**

```ts
// app/api/cron/purge-drafts/route.ts
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const db = getServiceClient();
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await db
    .from("trips")
    .delete()
    .eq("status", "Draft")
    .not("last_autosaved_at", "is", null)
    .lt("last_autosaved_at", cutoff)
    .select("trip_id");
  if (error) {
    console.error("[purge-drafts]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, purged: data?.length ?? 0 });
}
```

- [ ] **Step 2: Add the cron schedule**

Check whether the repo uses `vercel.ts` or `vercel.json`:
```bash
ls vercel.* 2>/dev/null
```

If `vercel.ts` exists, add to its `crons` array:
```ts
crons: [
  { path: "/api/cron/purge-drafts", schedule: "30 21 * * *" }, // 03:00 IST = 21:30 UTC
],
```

If neither file exists, create `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/purge-drafts", "schedule": "30 21 * * *" }
  ]
}
```

- [ ] **Step 3: Add `CRON_SECRET` to `.env.example`**

In `.env.example`, append:
```
CRON_SECRET=
```

- [ ] **Step 4: Manual verification — locally invoke**

```bash
npm run dev
curl -H "Authorization: Bearer test" http://localhost:3001/api/cron/purge-drafts
# Expected: 401
```

Set `CRON_SECRET=test` in `.env.local`, restart dev, retry — expect `{"ok":true,"purged":0}`.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/purge-drafts/route.ts vercel.ts vercel.json .env.example 2>/dev/null
git commit -m "feat(cms): daily cron to purge stale drafts (>30 days)"
```

---

## Task 10: beforeunload guard for unsynced local changes

**Files:**
- Modify: `app/(cms)/trips/_components/preview/useUnsavedChanges.ts` (extend) OR add a small new hook used by TripEditor

- [ ] **Step 1: Update the unsaved-changes hook to consider autosave status**

Read `useUnsavedChanges.ts` first to understand its current shape. Most likely it returns based on a single `isDirty` boolean. Extend the call site in `TripEditor.tsx` so it warns when `autosaveStatus !== "saved" && autosaveStatus !== "idle"`:

```ts
useUnsavedChanges(isDirty || autosaveStatus === "retrying" || autosaveStatus === "localOnly" || autosaveStatus === "saving");
```

- [ ] **Step 2: Smoke test**

```bash
npm run dev
```

1. Disable network in dev tools, type changes. Pill shows "Couldn't save — retrying".
2. Try to close the tab. Browser confirms ("Leave site?"). Cancel.
3. Re-enable network, wait for "Saved". Now closing the tab does not prompt.

- [ ] **Step 3: Commit**

```bash
git add app/\(cms\)/trips/_components/TripEditor.tsx
git commit -m "feat(cms): beforeunload guard considers autosave status"
```

---

## Ready to merge

- [ ] Migration applied + verified (Task 1)
- [ ] All Vitest tests pass: `npm test`
- [ ] `npx tsc --noEmit` clean
- [ ] Manual smoke tests passed: autosave (Task 6 step 6), resume modal (Task 7 step 4), drafts filter (Task 8 step 3), cron (Task 9 step 4), beforeunload (Task 10 step 2)
- [ ] `CRON_SECRET` configured in Vercel project env (preview + prod)
- [ ] Branch: `git checkout -b feat/cms-pr5-autosave`
- [ ] PR description includes: "Cross-tab editing safety + dedicated drafts admin screen are tracked as follow-ups."
