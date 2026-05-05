import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../../_helpers/supabase-fake";
let current: SupabaseFake = makeSupabaseFake();
vi.mock("@/lib/supabase/server", () => ({ getServiceClient: () => current.client }));
import { getDashboardStats } from "@/lib/db/dashboard";

beforeEach(() => { current = makeSupabaseFake(); });

describe("dashboard db", () => {
  it("returns zeros when DB is empty", async () => {
    // All counts default to null in our fake → DashboardStats coerces to 0
    current = makeSupabaseFake({
      "trips:select": { data: [], error: null, count: 0 } as any,
      "reviews:select": { data: [], error: null, count: 0 } as any,
      "customized_trip_requests:select": { data: [], error: null, count: 0 } as any,
      "trip_gallery:select": { data: [], error: null, count: 0 } as any,
    });
    const r = await getDashboardStats();
    expect(r.activeTrips).toBe(0);
    expect(r.totalTrips).toBe(0);
    expect(r.pendingReviews).toBe(0);
    expect(r.totalReviews).toBe(0);
    expect(r.newSuggestions).toBe(0);
    expect(r.totalSuggestions).toBe(0);
    expect(r.totalGalleryImages).toBe(0);
    expect(r.upcomingDepartures).toEqual([]);
    expect(r.recentTrips).toEqual([]);
    expect(r.tripsNeedingImages).toEqual([]);
    expect(r.draftTrips).toEqual([]);
  });
  it("flattens destinations onto upcoming + recent trips", async () => {
    current = makeSupabaseFake({
      "trips:select": {
        data: [{ trip_id: "T1", destinations: { destination_name: "Hampi" } }],
        error: null,
      },
      "reviews:select": { data: [], error: null } as any,
      "customized_trip_requests:select": { data: [], error: null } as any,
      "trip_gallery:select": { data: [], error: null } as any,
    });
    const r = await getDashboardStats();
    expect(r.upcomingDepartures[0]?.destination_name).toBe("Hampi");
  });
});
