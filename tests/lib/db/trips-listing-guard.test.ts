import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../../_helpers/supabase-fake";

let current: SupabaseFake = makeSupabaseFake();
vi.mock("@/lib/supabase/server", () => ({ getServiceClient: () => current.client }));

import { toggleTripField, isPubliclyListable, TripNotListableError } from "@/lib/db/trips";

beforeEach(() => { current = makeSupabaseFake(); });

describe("isPubliclyListable", () => {
  it.each(["Upcoming", "Ongoing", "Completed"])("allows %s", (s) => {
    expect(isPubliclyListable(s)).toBe(true);
  });
  it.each(["Draft", "Cancelled", null, undefined, "Random"])("rejects %s", (s) => {
    expect(isPubliclyListable(s as string | null | undefined)).toBe(false);
  });
});

describe("toggleTripField listing guard", () => {
  it.each(["is_listed", "show_on_homepage"] as const)("rejects setting %s=true on a Draft trip", async (field) => {
    current = makeSupabaseFake({
      "trips:select": { data: { status: "Draft" }, error: null },
    });
    await expect(toggleTripField("T1", field, true)).rejects.toBeInstanceOf(TripNotListableError);
    // Should NOT have called update
    expect(current.log.find((l) => l.op === "update")).toBeUndefined();
  });

  it("rejects setting flag=true on a Cancelled trip", async () => {
    current = makeSupabaseFake({
      "trips:select": { data: { status: "Cancelled" }, error: null },
    });
    await expect(toggleTripField("T1", "is_listed", true)).rejects.toBeInstanceOf(TripNotListableError);
  });

  it("allows setting flag=true on an Upcoming trip", async () => {
    current = makeSupabaseFake({
      "trips:select": { data: { status: "Upcoming" }, error: null },
      "trips:update": { data: null, error: null },
    });
    await expect(toggleTripField("T1", "is_listed", true)).resolves.toBeUndefined();
    expect(current.log.find((l) => l.op === "update")).toBeDefined();
  });

  it("ALWAYS allows setting flag=false (un-listing) regardless of status", async () => {
    current = makeSupabaseFake({
      // no trips:select needed — guard short-circuits when value=false
      "trips:update": { data: null, error: null },
    });
    await expect(toggleTripField("T1", "is_listed", false)).resolves.toBeUndefined();
    // Confirm we did NOT pre-read the trip status
    expect(current.log.find((l) => l.op === "select" && l.from === "trips")).toBeUndefined();
  });

  it("propagates DB read errors as plain Error (not TripNotListableError)", async () => {
    current = makeSupabaseFake({
      "trips:select": { data: null, error: { message: "rls denied" } },
    });
    await expect(toggleTripField("T1", "is_listed", true)).rejects.toThrow(/read failed/);
  });

  it("propagates DB update errors as plain Error", async () => {
    current = makeSupabaseFake({
      "trips:select": { data: { status: "Upcoming" }, error: null },
      "trips:update": { data: null, error: { message: "boom" } },
    });
    await expect(toggleTripField("T1", "is_listed", true)).rejects.toThrow(/toggleTripField failed/);
  });

  it("TripNotListableError carries the offending status", async () => {
    current = makeSupabaseFake({
      "trips:select": { data: { status: "Draft" }, error: null },
    });
    try {
      await toggleTripField("T1", "is_listed", true);
      expect.fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(TripNotListableError);
      expect((err as TripNotListableError).status).toBe("Draft");
      expect((err as Error).message).toMatch(/Upcoming, Ongoing, or Completed/);
    }
  });
});
