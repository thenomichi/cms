import type { FullCatalogVersion } from "@/lib/db/screening";
import type { ScreeningKind, ScreeningTag } from "@/lib/schemas/screening";

export interface OptionFormState {
  option_id?: string;
  label: string;
  tag: ScreeningTag | null;
  is_deal_breaker: boolean;
}

export interface QuestionFormState {
  question_id?: string;
  prompt: string;
  kind: ScreeningKind;
  is_scored: boolean;
  is_required: boolean;
  options: OptionFormState[];
}

export interface CatalogFormState {
  flag_if_red_at_least: number;
  flag_if_yellow_at_least: number;
  questions: QuestionFormState[];
}

export function buildCatalogFormState(c: FullCatalogVersion): CatalogFormState {
  return {
    flag_if_red_at_least: c.version.flag_if_red_at_least,
    flag_if_yellow_at_least: c.version.flag_if_yellow_at_least,
    questions: c.questions.map((q) => ({
      question_id: q.question_id,
      prompt: q.prompt,
      kind: q.kind,
      is_scored: q.is_scored,
      is_required: q.is_required,
      options: q.options.map((o) => ({
        option_id: o.option_id,
        label: o.label,
        tag: o.tag,
        is_deal_breaker: o.is_deal_breaker,
      })),
    })),
  };
}
