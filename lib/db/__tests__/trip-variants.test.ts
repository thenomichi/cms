import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient: vi.fn(),
}));
vi.mock("@/lib/ids", () => ({
  nextSequentialId: vi.fn(),
}));

import { getServiceClient } from "@/lib/supabase/server";
import { upsertVariantAxis, deleteVariantAxis } from "@/lib/db/trip-variants";

type Mocked = ReturnType<typeof vi.fn>;

describe("upsertVariantAxis", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when groupSlug is missing", async () => {
    await expect(
      upsertVariantAxis("", { axis_label: "Room sharing", axis_description: null, is_required: true }),
    ).rejects.toThrow(/group/i);
  });
});

describe("deleteVariantAxis", () => {
  it("propagates DB errors", async () => {
    const from = vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: "boom" } }),
    });
    (getServiceClient as unknown as Mocked).mockReturnValue({ from });
    await expect(deleteVariantAxis("NM-VAX-001")).rejects.toThrow(/boom/);
  });
});
