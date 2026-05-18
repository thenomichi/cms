import { describe, expect, it } from "vitest";
import {
  screeningOptionInputSchema,
  screeningQuestionInputSchema,
  catalogDraftPatchSchema,
  SCREENING_TAGS,
  SCREENING_KINDS,
} from "@/lib/schemas/screening";

describe("screeningOptionInputSchema", () => {
  it("accepts a minimal valid option", () => {
    const r = screeningOptionInputSchema.safeParse({
      label: "Adventure",
      tag: "green",
      is_deal_breaker: false,
    });
    expect(r.success).toBe(true);
  });
  it("rejects empty label", () => {
    const r = screeningOptionInputSchema.safeParse({
      label: "",
      tag: "green",
      is_deal_breaker: false,
    });
    expect(r.success).toBe(false);
  });
  it("allows tag = null when unscored", () => {
    const r = screeningOptionInputSchema.safeParse({
      label: "Some text",
      tag: null,
      is_deal_breaker: false,
    });
    expect(r.success).toBe(true);
  });
  it("rejects is_deal_breaker=true when tag is not red", () => {
    const r = screeningOptionInputSchema.safeParse({
      label: "Adventure",
      tag: "green",
      is_deal_breaker: true,
    });
    expect(r.success).toBe(false);
  });
  it("accepts is_deal_breaker=true when tag=red", () => {
    const r = screeningOptionInputSchema.safeParse({
      label: "Not a fit",
      tag: "red",
      is_deal_breaker: true,
    });
    expect(r.success).toBe(true);
  });
});

describe("screeningQuestionInputSchema", () => {
  const baseSingle = {
    prompt: "What kind of trip excites you?",
    kind: "single" as const,
    is_scored: true,
    is_required: true,
    options: [
      { label: "Adventure", tag: "green" as const, is_deal_breaker: false },
      { label: "Relaxed", tag: "red" as const, is_deal_breaker: false },
    ],
  };
  it("accepts a minimal valid single question", () => {
    expect(screeningQuestionInputSchema.safeParse(baseSingle).success).toBe(true);
  });
  it("rejects empty prompt", () => {
    const r = screeningQuestionInputSchema.safeParse({ ...baseSingle, prompt: "" });
    expect(r.success).toBe(false);
  });
  it("requires >=2 options for kind=single", () => {
    const r = screeningQuestionInputSchema.safeParse({
      ...baseSingle,
      options: [{ label: "only one", tag: "green", is_deal_breaker: false }],
    });
    expect(r.success).toBe(false);
  });
  it("requires >=2 options for kind=multi", () => {
    const r = screeningQuestionInputSchema.safeParse({
      ...baseSingle,
      kind: "multi",
      options: [],
    });
    expect(r.success).toBe(false);
  });
  it("requires every option to have a tag when is_scored=true", () => {
    const r = screeningQuestionInputSchema.safeParse({
      ...baseSingle,
      options: [
        { label: "a", tag: "green", is_deal_breaker: false },
        { label: "b", tag: null, is_deal_breaker: false },
      ],
    });
    expect(r.success).toBe(false);
  });
  it("allows options with tag=null when is_scored=false", () => {
    const r = screeningQuestionInputSchema.safeParse({
      ...baseSingle,
      is_scored: false,
      options: [
        { label: "a", tag: null, is_deal_breaker: false },
        { label: "b", tag: null, is_deal_breaker: false },
      ],
    });
    expect(r.success).toBe(true);
  });
  it("accepts kind=textarea with zero options", () => {
    const r = screeningQuestionInputSchema.safeParse({
      prompt: "Anything else to share?",
      kind: "textarea",
      is_scored: false,
      is_required: false,
      options: [],
    });
    expect(r.success).toBe(true);
  });
});

describe("catalogDraftPatchSchema", () => {
  it("accepts a minimal patch", () => {
    const r = catalogDraftPatchSchema.safeParse({
      flag_if_red_at_least: 1,
      flag_if_yellow_at_least: 2,
      questions: [],
    });
    expect(r.success).toBe(true);
  });
  it("rejects flag thresholds < 1", () => {
    expect(
      catalogDraftPatchSchema.safeParse({
        flag_if_red_at_least: 0,
        flag_if_yellow_at_least: 2,
        questions: [],
      }).success,
    ).toBe(false);
  });
});

describe("constants", () => {
  it("exposes SCREENING_TAGS", () => {
    expect(SCREENING_TAGS).toEqual(["green", "yellow", "red"]);
  });
  it("exposes SCREENING_KINDS", () => {
    expect(SCREENING_KINDS).toEqual(["single", "multi", "textarea"]);
  });
});
