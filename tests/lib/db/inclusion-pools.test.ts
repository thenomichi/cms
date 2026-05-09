import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../../_helpers/supabase-fake";

let current: SupabaseFake = makeSupabaseFake();

vi.mock("@/lib/supabase/server", () => ({ getServiceClient: () => current.client }));

import { addInclusionChip } from "@/lib/db/inclusion-chips";
import { addExclusion } from "@/lib/db/exclusions";

beforeEach(() => {
  current = makeSupabaseFake();
});

describe("inclusion pools db", () => {
  it("addInclusionChip falls back to a non-base id when the base slug is already taken", async () => {
    current = makeSupabaseFake({
      "inclusion_chips:select": { data: null, error: null, count: 1 },
      "inclusion_chips:insert": {
        data: {
          chip_id: "hot-air-balloon-1778336621000",
          name: "Hot Air Balloon",
          icon: "🎈",
          category: "Activities",
        },
        error: null,
      },
    });

    const row = await addInclusionChip({
      name: "Hot Air Balloon",
      icon: "🎈",
      category: "Activities",
    });

    expect(row.chip_id).toMatch(/^hot-air-balloon-/);
    expect(row.chip_id).not.toBe("hot-air-balloon");
    const insertLog = current.log.find(
      (entry) => entry.from === "inclusion_chips" && entry.op === "insert",
    ) as { payload: { chip_id: string } };
    expect(insertLog.payload.chip_id).toMatch(/^hot-air-balloon-/);
    expect(insertLog.payload.chip_id).not.toBe("hot-air-balloon");
  });

  it("addInclusionChip falls back when the name slugifies to empty", async () => {
    current = makeSupabaseFake({
      "inclusion_chips:select": { data: null, error: null, count: 0 },
      "inclusion_chips:insert": {
        data: {
          chip_id: "custom-inclusion",
          name: "!!!",
          icon: "✨",
          category: "Extras",
        },
        error: null,
      },
    });

    const row = await addInclusionChip({
      name: "!!!",
      icon: "✨",
      category: "Extras",
    });

    expect(row.chip_id).toBe("custom-inclusion");
  });

  it("addInclusionChip returns a friendly duplicate-name error", async () => {
    current = makeSupabaseFake({
      "inclusion_chips:select": { data: null, error: null, count: 0 },
      "inclusion_chips:insert": {
        data: null,
        error: { message: 'duplicate key value violates unique constraint "inclusion_chips_name_key"' },
      },
    });

    await expect(
      addInclusionChip({ name: "Airport Transfer", icon: "✈️", category: "Travel" }),
    ).rejects.toThrow('Inclusion "Airport Transfer" already exists');
  });

  it("addExclusion falls back to a non-base id when the base slug is already taken", async () => {
    current = makeSupabaseFake({
      "exclusions:select": { data: null, error: null, count: 1 },
      "exclusions:insert": {
        data: {
          exclusion_id: "tips-1778336621004",
          name: "Tips",
          category: "Personal",
        },
        error: null,
      },
    });

    const row = await addExclusion({
      name: "Tips",
      category: "Personal",
    });

    expect(row.exclusion_id).toMatch(/^tips-/);
    expect(row.exclusion_id).not.toBe("tips");
    const insertLog = current.log.find(
      (entry) => entry.from === "exclusions" && entry.op === "insert",
    ) as { payload: { exclusion_id: string } };
    expect(insertLog.payload.exclusion_id).toMatch(/^tips-/);
    expect(insertLog.payload.exclusion_id).not.toBe("tips");
  });

  it("addExclusion returns a friendly duplicate-name error", async () => {
    current = makeSupabaseFake({
      "exclusions:select": { data: null, error: null, count: 0 },
      "exclusions:insert": {
        data: null,
        error: { message: 'duplicate key value violates unique constraint "exclusions_name_key"' },
      },
    });

    await expect(
      addExclusion({ name: "Travel Insurance", category: "Safety & Health" }),
    ).rejects.toThrow('Exclusion "Travel Insurance" already exists');
  });
});
