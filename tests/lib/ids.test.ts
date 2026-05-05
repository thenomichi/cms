import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../_helpers/supabase-fake";

let current: SupabaseFake = makeSupabaseFake();

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient: () => current.client,
}));

import { nextSequentialId, nextTripChildId, nextTripId, makeDestinationId } from "@/lib/ids";

beforeEach(() => {
  current = makeSupabaseFake();
});

describe("makeDestinationId", () => {
  it("composes country + dest code", () => {
    expect(makeDestinationId("India", "HMP")).toBe("DEST-IND-HMP");
    expect(makeDestinationId("Japan", "TYO")).toBe("DEST-JAP-TYO");
  });
  it("uppercases and truncates country to 3 chars", () => {
    expect(makeDestinationId("united states", "NYC")).toBe("DEST-UNI-NYC");
  });
});

describe("nextSequentialId", () => {
  it("calls nm_next_sequential_id RPC with the right args", async () => {
    current = makeSupabaseFake({ "rpc:nm_next_sequential_id": { data: "REV-007", error: null } });
    const id = await nextSequentialId("reviews", "review_id", "REV", 3);
    expect(id).toBe("REV-007");
    expect(current.log[0]).toMatchObject({
      rpc: "nm_next_sequential_id",
      args: { p_table: "reviews", p_column: "review_id", p_prefix: "REV", p_pad: 3 },
    });
  });

  it("uses default pad of 3 when not specified", async () => {
    current = makeSupabaseFake({ "rpc:nm_next_sequential_id": { data: "REV-001", error: null } });
    await nextSequentialId("reviews", "review_id", "REV");
    expect((current.log[0] as any).args.p_pad).toBe(3);
  });

  it("throws on RPC error", async () => {
    current = makeSupabaseFake({ "rpc:nm_next_sequential_id": { data: null, error: { message: "boom" } } });
    await expect(nextSequentialId("reviews", "review_id", "REV")).rejects.toThrow(/boom/);
  });
});

describe("nextTripChildId", () => {
  it("forwards destCode and pad to nm_next_trip_child_id", async () => {
    current = makeSupabaseFake({ "rpc:nm_next_trip_child_id": { data: "TC-HMP-04", error: null } });
    const id = await nextTripChildId("trip_content", "content_id", "TC", "HMP", 2);
    expect(id).toBe("TC-HMP-04");
    expect((current.log[0] as any).args).toEqual({
      p_table: "trip_content", p_column: "content_id", p_prefix: "TC", p_dest_code: "HMP", p_pad: 2,
    });
  });

  it("uses default pad of 2 when not specified", async () => {
    current = makeSupabaseFake({ "rpc:nm_next_trip_child_id": { data: "TC-HMP-01", error: null } });
    await nextTripChildId("trip_content", "content_id", "TC", "HMP");
    expect((current.log[0] as any).args.p_pad).toBe(2);
  });

  it("propagates RPC errors", async () => {
    current = makeSupabaseFake({ "rpc:nm_next_trip_child_id": { data: null, error: { message: "err" } } });
    await expect(nextTripChildId("trip_content", "content_id", "TC", "HMP")).rejects.toThrow(/err/);
  });
});

describe("nextTripId", () => {
  it.each([
    ["Community", true, "GT", "DOM"],
    ["Beyond Ordinary", true, "INV", "DOM"],
    ["Signature Journey", true, "SJ", "DOM"],
    ["Customized Trips Only", false, "CT", "INT"],
    ["unknown", true, "GT", "DOM"],
  ])("encodes trip_type=%s, isDomestic=%s -> typeCode=%s region=%s", async (tripType, isDom, typeCode, region) => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: `NM-TRIP-${region}-${typeCode}-HMP-0001`, error: null },
    });
    const id = await nextTripId(isDom as boolean, tripType as string, "HMP");
    expect(id).toContain(`${region}-${typeCode}-HMP`);
    expect((current.log[0] as any).args.p_prefix).toBe(`NM-TRIP-${region}-${typeCode}-HMP`);
    expect((current.log[0] as any).args.p_pad).toBe(4);
  });

  it("propagates RPC errors", async () => {
    current = makeSupabaseFake({ "rpc:nm_next_sequential_id": { data: null, error: { message: "rpc-err" } } });
    await expect(nextTripId(true, "Community", "HMP")).rejects.toThrow(/rpc-err/);
  });
});
