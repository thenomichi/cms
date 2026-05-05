import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../_helpers/supabase-fake";

let current: SupabaseFake = makeSupabaseFake();

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient: () => current.client,
}));

import { logActivity } from "@/lib/audit";

beforeEach(() => {
  current = makeSupabaseFake();
});

describe("logActivity", () => {
  it.each(["INSERT", "UPDATE", "DELETE"] as const)("inserts row with action=%s and the right columns", async (action) => {
    await logActivity({
      table_name: "reviews",
      record_id: "REV-001",
      action,
      new_values: { reviewer_name: "Alice" },
    });
    const insert = current.log.find((l) => l.op === "insert" && l.from === "audit_log") as any;
    expect(insert).toBeDefined();
    expect(insert.payload).toMatchObject({
      table_name: "reviews",
      record_id: "REV-001",
      action,
      new_values: { reviewer_name: "Alice" },
      old_values: null,
      performed_by: "cms-admin",
    });
    expect(insert.payload.log_id).toBeUndefined(); // log_id is DB-generated
  });

  it("uses null new_values when not provided", async () => {
    await logActivity({ table_name: "reviews", record_id: "REV-001", action: "DELETE" });
    const insert = current.log.find((l) => l.op === "insert" && l.from === "audit_log") as any;
    expect(insert.payload.new_values).toBeNull();
  });

  it("respects an explicit performed_by", async () => {
    await logActivity({ table_name: "x", record_id: "y", action: "INSERT", performed_by: "system" });
    const insert = current.log.find((l) => l.op === "insert") as any;
    expect(insert.payload.performed_by).toBe("system");
  });

  it("swallows DB errors instead of throwing", async () => {
    current = makeSupabaseFake({ "audit_log:insert": { data: null, error: { message: "denied" } } });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      logActivity({ table_name: "x", record_id: "y", action: "INSERT" }),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("swallows thrown exceptions instead of bubbling", async () => {
    // Force getServiceClient throw via a programmed fake that replaces .from with a throw
    const fake = makeSupabaseFake();
    fake.client.from = () => {
      throw new Error("client unavailable");
    };
    current = fake;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      logActivity({ table_name: "x", record_id: "y", action: "INSERT" }),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
