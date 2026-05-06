# PR 4 — Departure cities table + searchable combobox

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text Departure City input with a searchable list seeded with popular Indian + international cities, extensible inline ("Add new city…").

**Architecture:** New `departure_cities` table (additive). New loader `lib/db/departure-cities.ts`. New combobox component at `components/ui/CityCombobox.tsx`. New server action `addDepartureCityAction`. The trips table keeps `departure_city` as text (denormalized `city_name`) — no FK in v1, so existing rows keep working with their current values as a free-text fallback selection.

**Tech Stack:** Next.js 16, React 19, Vitest + RTL, Supabase, Zod.

**Standalone — does not depend on other PRs.**

---

## File map

- Create: `supabase/migrations/20260506T1100__create_departure_cities.sql`
- Create: `lib/db/departure-cities.ts` (typed loader, list/add helpers)
- Create: `lib/types/departure-city.ts` (`DbDepartureCity` interface) — or add to `lib/types.ts`
- Create: `lib/schemas/departure-city.ts` (Zod schema for add)
- Create: `app/(cms)/trips/_components/CityCombobox.tsx` (the new UI component, scoped to trips for v1)
- Create: `app/(cms)/trips/_components/__tests__/CityCombobox.test.tsx`
- Create: `app/(cms)/departure-cities/actions.ts` (server action: addDepartureCity)
- Modify: `app/(cms)/trips/page.tsx` (load departure cities and pass to TripsClient/TripEditor)
- Modify: `app/(cms)/trips/[tripId]/edit/page.tsx` (same — load and pass)
- Modify: `app/(cms)/trips/new/page.tsx` (same)
- Modify: `app/(cms)/trips/_components/TripEditor.tsx` (accept `departureCities` prop, pass to BasicTab)
- Modify: `app/(cms)/trips/_components/tabs/BasicTab.tsx` (replace text input with `CityCombobox`)
- Create: `lib/constants/countries.ts` (ISO country list for the inline-add modal)

---

## Task 1: DB migration + seed

**Files:**
- Create: `supabase/migrations/20260506T1100__create_departure_cities.sql`

> **PERMISSION GATE:** Schema change. Migration is additive (new table) and safe.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260506T1100__create_departure_cities.sql
-- PR 4: Searchable departure-city list, extensible by admins.

CREATE TABLE departure_cities (
  departure_city_id text PRIMARY KEY,
  city_name         text NOT NULL,
  country_code      text NOT NULL,
  country_name      text NOT NULL,
  is_popular        boolean NOT NULL DEFAULT false,
  is_active         boolean NOT NULL DEFAULT true,
  display_order     integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_departure_cities_active_popular
  ON departure_cities (is_active, is_popular DESC, display_order, city_name);

-- Seed popular Indian cities
INSERT INTO departure_cities (departure_city_id, city_name, country_code, country_name, is_popular) VALUES
  ('DEL', 'Delhi',     'IN', 'India', true),
  ('BOM', 'Mumbai',    'IN', 'India', true),
  ('BLR', 'Bangalore', 'IN', 'India', true),
  ('MAA', 'Chennai',   'IN', 'India', true),
  ('CCU', 'Kolkata',   'IN', 'India', true),
  ('HYD', 'Hyderabad', 'IN', 'India', true),
  ('PNQ', 'Pune',      'IN', 'India', true),
  ('AMD', 'Ahmedabad', 'IN', 'India', true),
  ('GOI', 'Goa',       'IN', 'India', true),
  ('GAU', 'Guwahati',  'IN', 'India', true),
  ('IXL', 'Leh',       'IN', 'India', true),
  ('SXR', 'Srinagar',  'IN', 'India', true),
  ('JAI', 'Jaipur',    'IN', 'India', true),
  ('COK', 'Kochi',     'IN', 'India', true),
  ('TRV', 'Trivandrum','IN', 'India', true);

-- Seed international cities
INSERT INTO departure_cities (departure_city_id, city_name, country_code, country_name, is_popular) VALUES
  ('DPS', 'Bali (Denpasar)',  'ID', 'Indonesia',   true),
  ('BKK', 'Bangkok',           'TH', 'Thailand',    true),
  ('HKT', 'Phuket',            'TH', 'Thailand',    true),
  ('KTM', 'Kathmandu',         'NP', 'Nepal',       true),
  ('CMB', 'Colombo',           'LK', 'Sri Lanka',   true),
  ('DXB', 'Dubai',             'AE', 'UAE',         true),
  ('SIN', 'Singapore',         'SG', 'Singapore',   true),
  ('KUL', 'Kuala Lumpur',      'MY', 'Malaysia',    true),
  ('HAN', 'Hanoi',             'VN', 'Vietnam',     true),
  ('SGN', 'Ho Chi Minh City',  'VN', 'Vietnam',     true);
```

- [ ] **Step 2: Ask the user, then apply**

> Pause. Tell the user: "Ready to apply migration `20260506T1100__create_departure_cities.sql` — creates the table and seeds 25 popular cities. OK to apply?"

After approval, apply via Supabase MCP `apply_migration`.

- [ ] **Step 3: Verify**

```sql
SELECT count(*) FROM departure_cities;             -- expect 25
SELECT count(*) FROM departure_cities WHERE is_popular;  -- expect 25
SELECT city_name, country_name FROM departure_cities ORDER BY country_name, city_name LIMIT 5;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260506T1100__create_departure_cities.sql
git commit -m "feat(db): create departure_cities table, seed popular cities"
```

---

## Task 2: Types, schemas, loader

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/schemas/departure-city.ts`
- Create: `lib/db/departure-cities.ts`

- [ ] **Step 1: Add `DbDepartureCity` to `lib/types.ts`**

Append at the bottom of `lib/types.ts`:

```ts
export interface DbDepartureCity {
  departure_city_id: string;
  city_name: string;
  country_code: string;
  country_name: string;
  is_popular: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Add the Zod schema**

```ts
// lib/schemas/departure-city.ts
import { z } from "zod";

export const departureCityCreateSchema = z.object({
  city_name: z.string().min(2, "City name is required"),
  country_code: z.string().length(2, "Use 2-letter ISO country code (e.g. IN)"),
  country_name: z.string().min(2, "Country name is required"),
  is_popular: z.boolean().default(false),
});

export type DepartureCityCreateInput = z.infer<typeof departureCityCreateSchema>;
```

- [ ] **Step 3: Add the DB loader**

```ts
// lib/db/departure-cities.ts
import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import type { DbDepartureCity } from "@/lib/types";
import { slugify } from "@/lib/utils";

export async function listDepartureCities(): Promise<DbDepartureCity[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("departure_cities")
    .select("*")
    .eq("is_active", true)
    .order("is_popular", { ascending: false })
    .order("display_order", { ascending: true })
    .order("city_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbDepartureCity[];
}

export async function addDepartureCity(input: {
  city_name: string;
  country_code: string;
  country_name: string;
  is_popular?: boolean;
}): Promise<DbDepartureCity> {
  const db = getServiceClient();
  // Generate a stable id from the slug + country code, e.g. "pokhara-np".
  // If the user manually entered a known IATA code we'd prefer that, but
  // we don't ask for one in the inline-add flow — a derived id is good
  // enough and never collides for the admin's purposes.
  const idCandidate = `${slugify(input.city_name)}-${input.country_code.toLowerCase()}`;
  const { data, error } = await db
    .from("departure_cities")
    .insert({
      departure_city_id: idCandidate,
      city_name: input.city_name,
      country_code: input.country_code,
      country_name: input.country_name,
      is_popular: input.is_popular ?? false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DbDepartureCity;
}
```

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/schemas/departure-city.ts lib/db/departure-cities.ts
git commit -m "feat(cms): add departure-cities types, schema, and DB loader"
```

---

## Task 3: Server action

**Files:**
- Create: `app/(cms)/departure-cities/actions.ts`

- [ ] **Step 1: Write the action**

```ts
// app/(cms)/departure-cities/actions.ts
"use server";

import { departureCityCreateSchema } from "@/lib/schemas/departure-city";
import { addDepartureCity } from "@/lib/db/departure-cities";
import type { DbDepartureCity } from "@/lib/types";
import { logActivity } from "@/lib/audit";

export async function addDepartureCityAction(input: {
  city_name: string;
  country_code: string;
  country_name: string;
  is_popular?: boolean;
}): Promise<{ success: boolean; city?: DbDepartureCity; error?: string }> {
  try {
    const parsed = departureCityCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const city = await addDepartureCity(parsed.data);
    void logActivity({
      table_name: "departure_cities",
      record_id: city.departure_city_id,
      action: "INSERT",
      new_values: { city_name: city.city_name, country_code: city.country_code },
    }).catch((err) => console.error("[logActivity] swallowed:", err));
    return { success: true, city };
  } catch (err) {
    console.error("[addDepartureCityAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to add city" };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(cms\)/departure-cities/actions.ts
git commit -m "feat(cms): add departure city server action"
```

---

## Task 4: Country constants

**Files:**
- Create: `lib/constants/countries.ts`

- [ ] **Step 1: Create the constants file**

```ts
// lib/constants/countries.ts
// ISO 3166-1 alpha-2 codes + display names for the inline city-add modal.
// Trim list — only countries we plausibly run trips from. Easy to extend.
export const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "TH", name: "Thailand" },
  { code: "NP", name: "Nepal" },
  { code: "LK", name: "Sri Lanka" },
  { code: "AE", name: "UAE" },
  { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" },
  { code: "VN", name: "Vietnam" },
  { code: "BT", name: "Bhutan" },
  { code: "MV", name: "Maldives" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "TR", name: "Turkey" },
  { code: "GE", name: "Georgia" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "GB", name: "United Kingdom" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "PT", name: "Portugal" },
  { code: "GR", name: "Greece" },
  { code: "EG", name: "Egypt" },
  { code: "MA", name: "Morocco" },
  { code: "ZA", name: "South Africa" },
  { code: "TZ", name: "Tanzania" },
  { code: "KE", name: "Kenya" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "MX", name: "Mexico" },
  { code: "PE", name: "Peru" },
  { code: "AR", name: "Argentina" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
];
```

- [ ] **Step 2: Commit**

```bash
git add lib/constants/countries.ts
git commit -m "chore(cms): add country constants for inline city-add"
```

---

## Task 5: CityCombobox component (TDD)

**Files:**
- Create: `app/(cms)/trips/_components/CityCombobox.tsx`
- Create: `app/(cms)/trips/_components/__tests__/CityCombobox.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// app/(cms)/trips/_components/__tests__/CityCombobox.test.tsx
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
    // Delhi (popular) and Bangkok (popular) come before Chennai (not popular)
    expect(options[0]).toHaveTextContent(/Delhi/);
    expect(options[1]).toHaveTextContent(/Bangkok/);
    expect(options[2]).toHaveTextContent(/Chennai/);
  });

  it("filters by city name", async () => {
    render(<CityCombobox value="" onChange={() => {}} cities={cities} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(screen.getByPlaceholderText(/search/i), "che");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Chennai");
  });

  it("filters by country name (case-insensitive)", async () => {
    render(<CityCombobox value="" onChange={() => {}} cities={cities} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(screen.getByPlaceholderText(/search/i), "thailand");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Bangkok");
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
```

- [ ] **Step 2: Run — fails**

Run: `npm test -- app/\(cms\)/trips/_components/__tests__/CityCombobox.test.tsx`

Expected: FAIL (component doesn't exist).

- [ ] **Step 3: Implement the component**

```tsx
// app/(cms)/trips/_components/CityCombobox.tsx
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { DbDepartureCity } from "@/lib/types";
import { COUNTRIES } from "@/lib/constants/countries";
import { addDepartureCityAction } from "@/app/(cms)/departure-cities/actions";

interface CityComboboxProps {
  value: string;
  onChange: (cityName: string) => void;
  cities: DbDepartureCity[];
  placeholder?: string;
}

export function CityCombobox({
  value,
  onChange,
  cities,
  placeholder = "Select departure city",
}: CityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...cities].sort((a, b) => {
      if (a.is_popular !== b.is_popular) return a.is_popular ? -1 : 1;
      return a.city_name.localeCompare(b.city_name);
    });
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        c.city_name.toLowerCase().includes(q) ||
        c.country_name.toLowerCase().includes(q),
    );
  }, [cities, query]);

  const exactMatch = useMemo(
    () =>
      filtered.some(
        (c) => c.city_name.toLowerCase() === query.trim().toLowerCase(),
      ),
    [filtered, query],
  );

  const trimmed = query.trim();

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-line bg-surface px-3 text-left text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20"
      >
        <span className={value ? "" : "text-fog"}>{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 text-mid" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search className="h-4 w-4 text-mid" />
            <input
              autoFocus
              placeholder="Search cities or countries…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-fog"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {filtered.map((c) => (
              <li
                key={c.departure_city_id}
                role="option"
                aria-selected={value === c.city_name}
                onClick={() => {
                  onChange(c.city_name);
                  setOpen(false);
                  setQuery("");
                }}
                className="cursor-pointer px-3 py-2 text-sm text-ink hover:bg-surface3"
              >
                <span className="font-medium">{c.city_name}</span>
                <span className="ml-2 text-xs text-mid">{c.country_name}</span>
                {c.is_popular && (
                  <span className="ml-2 text-[10px] uppercase text-rust">Popular</span>
                )}
              </li>
            ))}
            {trimmed && !exactMatch && (
              <li
                role="option"
                onClick={() => setShowAddModal(true)}
                className="flex cursor-pointer items-center gap-2 border-t border-line px-3 py-2 text-sm text-rust hover:bg-surface3"
              >
                <Plus className="h-4 w-4" />
                Add &ldquo;{trimmed}&rdquo; as a new city
              </li>
            )}
          </ul>
        </div>
      )}

      {showAddModal && (
        <AddCityModal
          initialName={trimmed}
          onClose={() => setShowAddModal(false)}
          onAdded={(city) => {
            onChange(city.city_name);
            setShowAddModal(false);
            setOpen(false);
            setQuery("");
            toast.success(`Added ${city.city_name}`);
            // Caller is responsible for refetching the cities list
            // (e.g., via revalidatePath after the action). For now we
            // just select the newly-added value; the next page load
            // will surface it in the dropdown.
          }}
        />
      )}
    </div>
  );
}

interface AddCityModalProps {
  initialName: string;
  onClose: () => void;
  onAdded: (city: DbDepartureCity) => void;
}

function AddCityModal({ initialName, onClose, onAdded }: AddCityModalProps) {
  const [cityName, setCityName] = useState(initialName);
  const [countryCode, setCountryCode] = useState("IN");
  const [isPopular, setIsPopular] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    const country = COUNTRIES.find((c) => c.code === countryCode);
    if (!country) {
      toast.error("Pick a country");
      setSubmitting(false);
      return;
    }
    const res = await addDepartureCityAction({
      city_name: cityName.trim(),
      country_code: country.code,
      country_name: country.name,
      is_popular: isPopular,
    });
    setSubmitting(false);
    if (res.success && res.city) {
      onAdded(res.city);
    } else {
      toast.error(res.error ?? "Failed to add city");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-xl">
        <h3 className="text-base font-semibold text-ink">Add a new departure city</h3>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-mid">City name</span>
            <input
              type="text"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust/20"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-mid">Country</span>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-rust focus:ring-1 focus:ring-rust/20"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={isPopular}
              onChange={(e) => setIsPopular(e.target.checked)}
            />
            Mark as popular
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-mid hover:bg-surface3"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || cityName.trim().length < 2}
            className="rounded-lg bg-rust px-3 py-1.5 text-sm font-medium text-white hover:bg-rust/90 disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add city"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — all pass**

Run: `npm test -- app/\(cms\)/trips/_components/__tests__/CityCombobox.test.tsx`

Expected: PASS — all 8 tests.

> Note: the "Add new city" test only verifies the trigger appears. The modal flow is covered manually in Task 7 since it requires server-action mocking that's not worth setting up for this PR.

- [ ] **Step 5: Commit**

```bash
git add app/\(cms\)/trips/_components/CityCombobox.tsx app/\(cms\)/trips/_components/__tests__/CityCombobox.test.tsx
git commit -m "feat(cms): CityCombobox with search + inline add"
```

---

## Task 6: Wire into TripEditor + page loaders

**Files:**
- Modify: `app/(cms)/trips/page.tsx`
- Modify: `app/(cms)/trips/new/page.tsx`
- Modify: `app/(cms)/trips/[tripId]/edit/page.tsx`
- Modify: `app/(cms)/trips/_components/TripEditor.tsx`
- Modify: `app/(cms)/trips/_components/tabs/BasicTab.tsx`

- [ ] **Step 1: Update page loaders to fetch departure cities**

In each of the three page files, find the existing `await listDestinations()` (or similar) call and add a parallel fetch for departure cities. Example for `app/(cms)/trips/new/page.tsx`:

```ts
import { listDepartureCities } from "@/lib/db/departure-cities";

// Inside the page component, alongside existing data fetches:
const [destinations, departureCities] = await Promise.all([
  listDestinations(),
  listDepartureCities(),
]);

return <TripEditor trip={null} destinations={destinations} departureCities={departureCities} websiteUrl={websiteUrl} />;
```

Apply the same change in `[tripId]/edit/page.tsx` and `page.tsx` (if `page.tsx` renders the editor; otherwise skip).

- [ ] **Step 2: Update `TripEditor` props**

In `app/(cms)/trips/_components/TripEditor.tsx`:

Update the props interface (currently lines 31-35):
```ts
interface TripEditorProps {
  trip: TripFull | null;
  destinations: DbDestination[];
  departureCities: DbDepartureCity[];
  websiteUrl: string;
}
```

Add the import:
```ts
import type { DbDepartureCity } from "@/lib/types";
```

Update the destructuring + pass to BasicTab:
```ts
export function TripEditor({ trip, destinations, departureCities, websiteUrl }: TripEditorProps) {
  // ... existing code
```

In the BasicTab render call (currently around line 287):
```tsx
{activeStep === "basic" && (
  <BasicTab
    form={form}
    updateField={updateField}
    destinations={destinations}
    departureCities={departureCities}
  />
)}
```

- [ ] **Step 3: Update BasicTab to use the combobox**

In `app/(cms)/trips/_components/tabs/BasicTab.tsx`:

Add imports at the top:
```ts
import type { DbDepartureCity } from "@/lib/types";
import { CityCombobox } from "../CityCombobox";
```

Update the props interface (currently lines 16-20):
```ts
interface BasicTabProps {
  form: TripFormState;
  updateField: <K extends keyof TripFormState>(key: K, val: TripFormState[K]) => void;
  destinations: DbDestination[];
  departureCities: DbDepartureCity[];
}
```

Update the destructure:
```ts
export function BasicTab({ form, updateField, destinations, departureCities }: BasicTabProps) {
```

Replace the existing departure_city `<input>` (currently around lines 244-251) with:
```tsx
          <FormField label="Departure City">
            <CityCombobox
              value={form.departure_city}
              onChange={(name) => updateField("departure_city", name)}
              cities={departureCities}
            />
          </FormField>
```

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 5: Smoke test**

```bash
npm run dev
```

Open `/trips/new`:
1. Click the Departure City field → dropdown opens with Delhi, Mumbai, Bangalore, etc. at the top.
2. Type "thailand" → only Bangkok and Phuket appear.
3. Type "Pokhara" → "Add 'Pokhara' as a new city" appears.
4. Click → modal opens; pick Nepal, click Add → toast appears, dropdown closes, "Pokhara" is now the value.
5. Save the trip; verify `departure_city = "Pokhara"` in DB.
6. Open an existing trip whose `departure_city` is some legacy free-text value → field shows that value (legacy fallback works).

- [ ] **Step 6: Commit**

```bash
git add app/\(cms\)/trips/page.tsx app/\(cms\)/trips/new/page.tsx app/\(cms\)/trips/\[tripId\]/edit/page.tsx app/\(cms\)/trips/_components/TripEditor.tsx app/\(cms\)/trips/_components/tabs/BasicTab.tsx
git commit -m "feat(cms): replace departure city input with searchable combobox"
```

---

## Task 7: Manual end-to-end smoke run

- [ ] **Step 1: Run through the full flow**

```bash
npm run dev
```

Steps:
1. Create a new trip; pick "Bangalore" from the popular list → save → verify the row.
2. Edit that trip; change to "Goa" → save → verify the row.
3. On a third trip, add a brand-new city "Pokhara, Nepal" via the inline modal → save → verify the row in `trips` AND a new row in `departure_cities`.
4. Reload the page (full SSR). The new city now appears in the dropdown automatically.
5. Open an old trip with a legacy free-text city like "Bengaluru" — verify it shows that value as selected (fallback path).

- [ ] **Step 2: Note any UX issues; commit fixes if needed**

If the popover positioning is off, the search input loses focus, or the modal is jumpy, fix in a small follow-up commit.

---

## Ready to merge

- [ ] Migration applied + verified (Task 1)
- [ ] All Vitest tests pass: `npm test`
- [ ] `npx tsc --noEmit` clean
- [ ] Manual smoke test passed (Task 7)
- [ ] Branch: `git checkout -b feat/cms-pr4-departure-cities`
- [ ] PR opened against `main` — note in description: "Dedicated `/settings/departure-cities` admin screen is a follow-up; admins can add cities inline from the trip editor."
