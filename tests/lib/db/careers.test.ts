import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../../_helpers/supabase-fake";
let current: SupabaseFake = makeSupabaseFake();
vi.mock("@/lib/supabase/server", () => ({ getServiceClient: () => current.client }));
import { getCareerListings, createCareerListing, updateCareerListing, deleteCareerListing } from "@/lib/db/careers";
beforeEach(() => { current = makeSupabaseFake(); });

describe("careers db", () => {
  it("getCareerListings returns rows", async () => {
    current = makeSupabaseFake({ "career_listings:select": { data: [{ career_id: "CAR-001" }], error: null } });
    expect(await getCareerListings()).toHaveLength(1);
  });
  it("getCareerListings throws on error", async () => {
    current = makeSupabaseFake({ "career_listings:select": { data: null, error: { message: "x" } } });
    await expect(getCareerListings()).rejects.toThrow();
  });
  it("createCareerListing inserts with generated id", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "CAR-007", error: null },
      "career_listings:insert": { data: { career_id: "CAR-007" }, error: null },
    });
    const r = await createCareerListing({ title: "Eng", department: "Eng" } as any);
    expect(r.career_id).toBe("CAR-007");
  });
  it("createCareerListing throws on error", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "CAR-007", error: null },
      "career_listings:insert": { data: null, error: { message: "x" } },
    });
    await expect(createCareerListing({} as any)).rejects.toThrow();
  });
  it("updateCareerListing throws / succeeds", async () => {
    current = makeSupabaseFake({ "career_listings:update": { data: null, error: { message: "x" } } });
    await expect(updateCareerListing("CAR-1", { title: "x" } as any)).rejects.toThrow();
    current = makeSupabaseFake({ "career_listings:update": { data: { career_id: "CAR-1" }, error: null } });
    await expect(updateCareerListing("CAR-1", { title: "x" } as any)).resolves.toBeDefined();
  });
  it("deleteCareerListing throws / succeeds", async () => {
    current = makeSupabaseFake({ "career_listings:delete": { data: null, error: { message: "x" } } });
    await expect(deleteCareerListing("CAR-1")).rejects.toThrow();
    current = makeSupabaseFake({ "career_listings:delete": { data: null, error: null } });
    await expect(deleteCareerListing("CAR-1")).resolves.toBeUndefined();
  });
});
