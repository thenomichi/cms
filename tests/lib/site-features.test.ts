import {
  DEFAULT_SITE_FEATURES,
  SITE_FEATURE_GROUPS,
  SITE_FEATURE_FIELDS,
  normalizeSiteFeatures,
} from "@/lib/site-features";

describe("cms site-features", () => {
  it("keeps the field definitions aligned with the defaults", () => {
    expect(SITE_FEATURE_FIELDS.map((field) => field.key).sort()).toEqual(
      Object.keys(DEFAULT_SITE_FEATURES).sort(),
    );
  });

  it("assigns every feature field to a valid group", () => {
    expect(new Set(SITE_FEATURE_FIELDS.map((field) => field.group))).toEqual(
      new Set(SITE_FEATURE_GROUPS.map((group) => group.key)),
    );
  });

  it("normalizes invalid data back to defaults", () => {
    expect(normalizeSiteFeatures(undefined)).toEqual(DEFAULT_SITE_FEATURES);
    expect(normalizeSiteFeatures(null)).toEqual(DEFAULT_SITE_FEATURES);
    expect(normalizeSiteFeatures("bad")).toEqual(DEFAULT_SITE_FEATURES);
  });

  it("accepts both raw booleans and nested enabled objects", () => {
    expect(
      normalizeSiteFeatures({
        join_a_trip: false,
        beyond_ordinary: { enabled: false },
        signature_journeys: true,
        plan_a_trip: { enabled: true },
        gift_a_trip: false,
        about: { enabled: false },
        careers: true,
      }),
    ).toEqual({
      join_a_trip: false,
      beyond_ordinary: false,
      signature_journeys: true,
      plan_a_trip: true,
      gift_a_trip: false,
      about: false,
      careers: true,
    });
  });

  it("falls back to defaults when nested enabled values are not booleans", () => {
    expect(
      normalizeSiteFeatures({
        join_a_trip: { enabled: "yes" },
        beyond_ordinary: { enabled: null },
        signature_journeys: { enabled: 1 },
      }),
    ).toEqual({
      ...DEFAULT_SITE_FEATURES,
      join_a_trip: true,
      beyond_ordinary: true,
      signature_journeys: true,
    });
  });
});
