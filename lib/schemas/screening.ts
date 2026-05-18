import { z } from "zod";

export const SCREENING_TAGS = ["green", "yellow", "red"] as const;
// "text" is the long-answer kind in the live DB; "textarea" is its alias
// historically used in some specs. The website's CHECK constraint accepts
// "text" — we mirror that to avoid round-trip rejection of seeded questions.
export const SCREENING_KINDS = ["single", "multi", "text"] as const;

export type ScreeningTag = (typeof SCREENING_TAGS)[number];
export type ScreeningKind = (typeof SCREENING_KINDS)[number];

export const screeningOptionInputSchema = z
  .object({
    option_id: z.string().optional(),
    label: z.string().min(1, "Please enter an answer choice").max(120),
    tag: z.enum(SCREENING_TAGS).nullable(),
    is_deal_breaker: z.boolean(),
  })
  .refine((v) => !v.is_deal_breaker || v.tag === "red", {
    message: "Only 'Not a fit' answers can block payment",
    path: ["is_deal_breaker"],
  });

export const screeningQuestionInputSchema = z
  .object({
    question_id: z.string().optional(),
    prompt: z.string().min(1, "Please enter the question").max(300),
    kind: z.enum(SCREENING_KINDS),
    is_scored: z.boolean(),
    is_required: z.boolean(),
    options: z.array(screeningOptionInputSchema),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "single" || v.kind === "multi") {
      if (v.options.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "This question needs at least two answer choices",
        });
      }
    }
    if (v.kind === "text" && v.options.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Long-answer questions don't have answer choices",
      });
    }
    if (v.is_scored) {
      const untagged = v.options.findIndex((o) => o.tag === null);
      if (untagged >= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["options", untagged, "tag"],
          message: "Pick a colour for every answer choice",
        });
      }
    }
  });

export const catalogDraftPatchSchema = z.object({
  flag_if_red_at_least: z.coerce.number().int().min(1),
  flag_if_yellow_at_least: z.coerce.number().int().min(1),
  questions: z.array(screeningQuestionInputSchema),
});

export type ScreeningOptionInput = z.infer<typeof screeningOptionInputSchema>;
export type ScreeningQuestionInput = z.infer<typeof screeningQuestionInputSchema>;
export type CatalogDraftPatch = z.infer<typeof catalogDraftPatchSchema>;
