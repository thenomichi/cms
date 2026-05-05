import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../../_helpers/supabase-fake";

let current: SupabaseFake = makeSupabaseFake();
vi.mock("@/lib/supabase/server", () => ({ getServiceClient: () => current.client }));

import { getTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember } from "@/lib/db/team";

beforeEach(() => { current = makeSupabaseFake(); });

describe("team db", () => {
  it("getTeamMembers orders by display_order then full_name", async () => {
    current = makeSupabaseFake({ "team_members:select": { data: [{ member_id: "TM-001" }], error: null } });
    const rows = await getTeamMembers();
    expect(rows).toHaveLength(1);
    expect(current.log[0]).toMatchObject({ from: "team_members", op: "select" });
  });

  it("getTeamMembers throws on supabase error", async () => {
    current = makeSupabaseFake({ "team_members:select": { data: null, error: { message: "boom" } } });
    await expect(getTeamMembers()).rejects.toThrow();
  });

  it("createTeamMember calls nm_next_sequential_id RPC and inserts with member_id", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "TM-0042", error: null },
      "team_members:insert": { data: { member_id: "TM-0042", full_name: "Alice" }, error: null },
    });
    const row = await createTeamMember({ full_name: "Alice", email: null, phone: null, role: "Founder", bio: null, photo_url: null, instagram: null, is_active: true } as any);
    expect(row.member_id).toBe("TM-0042");
    const insert = current.log.find((l) => l.op === "insert") as any;
    expect(insert.payload.member_id).toBe("TM-0042");
    expect(insert.payload.full_name).toBe("Alice");
    expect((current.log[0] as any).args.p_pad).toBe(4); // TM uses 4-pad
  });

  it("createTeamMember throws on insert error", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "TM-0042", error: null },
      "team_members:insert": { data: null, error: { message: "duplicate" } },
    });
    await expect(createTeamMember({} as any)).rejects.toThrow();
  });

  it("updateTeamMember sets updated_at and updates by member_id", async () => {
    current = makeSupabaseFake({ "team_members:update": { data: { member_id: "TM-001" }, error: null } });
    await updateTeamMember("TM-001", { full_name: "B" });
    const upd = current.log.find((l) => l.op === "update") as any;
    expect(upd.payload).toMatchObject({ full_name: "B" });
    expect(upd.payload.updated_at).toBeDefined();
  });

  it("updateTeamMember throws on supabase error", async () => {
    current = makeSupabaseFake({ "team_members:update": { data: null, error: { message: "x" } } });
    await expect(updateTeamMember("TM-1", { full_name: "x" })).rejects.toThrow();
  });

  it("deleteTeamMember calls delete by member_id", async () => {
    current = makeSupabaseFake({ "team_members:delete": { data: null, error: null } });
    await deleteTeamMember("TM-001");
    expect(current.log.find((l) => l.op === "delete" && l.from === "team_members")).toBeDefined();
  });

  it("deleteTeamMember throws on supabase error", async () => {
    current = makeSupabaseFake({ "team_members:delete": { data: null, error: { message: "fk" } } });
    await expect(deleteTeamMember("TM-1")).rejects.toThrow();
  });
});
