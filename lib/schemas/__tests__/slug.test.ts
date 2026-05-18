import { describe, expect, it } from "vitest";
import { toSlug } from "@/lib/slug";

describe("toSlug", () => {
  it("converts spaces to underscores", () => {
    expect(toSlug("Room sharing")).toBe("room_sharing");
  });
  it("lowercases", () => {
    expect(toSlug("DOUBLE Sharing")).toBe("double_sharing");
  });
  it("strips punctuation", () => {
    expect(toSlug("What's the vibe?")).toBe("whats_the_vibe");
  });
  it("collapses repeated separators", () => {
    expect(toSlug("solo  ---  traveller")).toBe("solo_traveller");
  });
  it("trims leading/trailing separators", () => {
    expect(toSlug(" hello world ")).toBe("hello_world");
  });
  it("returns empty string for empty input", () => {
    expect(toSlug("")).toBe("");
    expect(toSlug("   ")).toBe("");
  });
  it("strips leading digits to satisfy ^[a-z]", () => {
    expect(toSlug("3 day trek")).toBe("day_trek");
  });
});
