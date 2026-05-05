import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../../_helpers/supabase-fake";

let current: SupabaseFake = makeSupabaseFake();
vi.mock("@/lib/supabase/server", () => ({ getServiceClient: () => current.client }));

import {
  getDestinations,
  getDestinationById,
  generateUniqueDestCode,
  createDestination,
  updateDestination,
  deleteDestination,
} from "@/lib/db/destinations";

beforeEach(() => { current = makeSupabaseFake(); });

describe("destinations db", () => {
  it("getDestinations returns rows", async () => {
    current = makeSupabaseFake({ "destinations:select": { data: [{ destination_id: "DEST-IND-HMP" }], error: null } });
    expect(await getDestinations()).toHaveLength(1);
  });

  it("getDestinations throws on supabase error", async () => {
    current = makeSupabaseFake({ "destinations:select": { data: null, error: { message: "x" } } });
    await expect(getDestinations()).rejects.toThrow();
  });

  it("getDestinationById returns null on missing", async () => {
    current = makeSupabaseFake({ "destinations:select": { data: null, error: { message: "no rows" } } });
    const r = await getDestinationById("DEST-MISSING");
    expect(r).toBeNull();
  });

  it("getDestinationById returns the row", async () => {
    current = makeSupabaseFake({ "destinations:select": { data: { destination_id: "DEST-IND-HMP" }, error: null } });
    const r = await getDestinationById("DEST-IND-HMP");
    expect(r?.destination_id).toBe("DEST-IND-HMP");
  });

  it("generateUniqueDestCode returns base when not taken", async () => {
    current = makeSupabaseFake({ "destinations:select": { data: null, error: null, count: 0 } as any });
    const code = await generateUniqueDestCode("Hampi");
    expect(code).toBe("HAMPI");
  });

  it("generateUniqueDestCode returns DEST-{ts} when name has no alphanumerics", async () => {
    const code = await generateUniqueDestCode("!!!");
    expect(code).toMatch(/^DEST-\d+$/);
  });

  it("createDestination inserts and returns the row", async () => {
    current = makeSupabaseFake({ "destinations:insert": { data: { destination_id: "DEST-IND-HMP" }, error: null } });
    const r = await createDestination({ destination_id: "DEST-IND-HMP", destination_code: "HMP", destination_name: "Hampi", country: "India", is_domestic: true, is_active: true } as any);
    expect(r.destination_id).toBe("DEST-IND-HMP");
  });

  it("createDestination throws on supabase error", async () => {
    current = makeSupabaseFake({ "destinations:insert": { data: null, error: { message: "dup" } } });
    await expect(createDestination({} as any)).rejects.toThrow();
  });

  it("updateDestination throws on error", async () => {
    current = makeSupabaseFake({ "destinations:update": { data: null, error: { message: "x" } } });
    await expect(updateDestination("DEST-X", { destination_name: "y" })).rejects.toThrow();
  });

  it("updateDestination updates and sets updated_at", async () => {
    current = makeSupabaseFake({ "destinations:update": { data: { destination_id: "DEST-X" }, error: null } });
    await updateDestination("DEST-X", { destination_name: "Y" });
    const upd = current.log.find((l) => l.op === "update") as any;
    expect(upd.payload.updated_at).toBeDefined();
  });

  it("deleteDestination throws on FK violation", async () => {
    current = makeSupabaseFake({ "destinations:delete": { data: null, error: { message: "fk" } } });
    await expect(deleteDestination("DEST-X")).rejects.toThrow();
  });

  it("deleteDestination succeeds without error", async () => {
    current = makeSupabaseFake({ "destinations:delete": { data: null, error: null } });
    await expect(deleteDestination("DEST-X")).resolves.toBeUndefined();
  });
});
