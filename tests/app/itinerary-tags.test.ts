import { describe, expect, it } from "vitest";
import {
  parseItineraryTags,
  stringifyItineraryTags,
} from "@/app/(cms)/trips/_components/tabs/itinerary-tags";

describe("itinerary tag helpers", () => {
  it("extracts meals and accommodation from reserved tags", () => {
    expect(
      parseItineraryTags(
        "Meals: Breakfast / Lunch / Dinner, Accommodation: Riverside Camp, Trekking, Bonfire",
      ),
    ).toEqual({
      meals: "Breakfast, Lunch, Dinner",
      accommodation: "Riverside Camp",
      genericTags: ["Trekking", "Bonfire"],
    });
  });

  it("keeps backward compatibility with the older prefixed format", () => {
    expect(
      parseItineraryTags(
        "Meals: Breakfast / Dinner, Accommodation: Riverside Camp, Trekking",
      ),
    ).toEqual({
      meals: "Breakfast, Dinner",
      accommodation: "Riverside Camp",
      genericTags: ["Trekking"],
    });
  });

  it("stringifies meals, accommodation, and generic tags into one tags field", () => {
    expect(
      stringifyItineraryTags({
        meals: "Breakfast, Dinner",
        accommodation: "Boutique Hotel",
        genericTags: ["Sunset point", "Local market"],
      }),
    ).toBe(
      "Meals: Breakfast / Dinner, Accommodation: Boutique Hotel, Sunset point, Local market",
    );
  });

  it("treats the full meals and accommodation values as one reserved tag each", () => {
    const serialized = stringifyItineraryTags({
      meals: "Breakfast, Lunch, Dinner",
      accommodation: "Hotel in Sohra",
      genericTags: [],
    });

    expect(serialized).toBe(
      "Meals: Breakfast / Lunch / Dinner, Accommodation: Hotel in Sohra",
    );
    expect(parseItineraryTags(serialized)).toEqual({
      meals: "Breakfast, Lunch, Dinner",
      accommodation: "Hotel in Sohra",
      genericTags: [],
    });
  });

  it("returns null when everything is empty", () => {
    expect(
      stringifyItineraryTags({
        meals: "",
        accommodation: "   ",
        genericTags: [],
      }),
    ).toBeNull();
  });

  it("keeps legacy generic tags untouched when no reserved tags are present", () => {
    expect(parseItineraryTags("Trekking, Monastery visit")).toEqual({
      meals: "",
      accommodation: "",
      genericTags: ["Trekking", "Monastery visit"],
    });
  });

  it("filters reserved-prefixed tags out of the generic list on save", () => {
    expect(
      stringifyItineraryTags({
        meals: "Breakfast",
        accommodation: "",
        genericTags: ["Meals: Should not duplicate", "Photo stop"],
      }),
    ).toBe("Meals: Breakfast, Photo stop");
  });
});
