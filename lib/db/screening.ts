import { getServiceClient } from "@/lib/supabase/server";
import { nextSequentialId } from "@/lib/ids";
import { toSlug } from "@/lib/slug";
import type {
  CatalogDraftPatch,
  ScreeningKind,
  ScreeningTag,
} from "@/lib/schemas/screening";

// ---------- Row types ----------

export interface DbScreeningCatalogVersion {
  catalog_version_id: string;
  version_label: string;
  is_active: boolean;
  flag_if_red_at_least: number;
  flag_if_yellow_at_least: number;
  is_immutable: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbScreeningQuestion {
  question_id: string;
  catalog_version_id: string;
  question_key: string;
  prompt: string;
  prompt_highlight: string | null;
  step: number;
  kind: ScreeningKind;
  is_scored: boolean;
  is_required: boolean;
  multi_select_rule: string | null;
  placeholder: string | null;
  max_length: number | null;
  sort_order: number;
}

export interface DbScreeningOption {
  option_id: string;
  question_id: string;
  option_key: string;
  label: string;
  tag: ScreeningTag | null;
  is_deal_breaker: boolean;
  sort_order: number;
}

export interface FullCatalogVersion {
  version: DbScreeningCatalogVersion;
  questions: Array<DbScreeningQuestion & { options: DbScreeningOption[] }>;
}

// ---------- Public API ----------

export async function getActiveCatalog(): Promise<FullCatalogVersion | null> {
  const db = getServiceClient();
  const { data: v, error: vErr } = await db
    .from("screening_catalog_versions")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (vErr) throw new Error(`getActiveCatalog (version) failed: ${vErr.message}`);
  if (!v) return null;
  return loadFullVersion(v as DbScreeningCatalogVersion);
}

export async function getOrCreateDraftCatalog(): Promise<FullCatalogVersion> {
  const db = getServiceClient();
  const { data: existing, error: dErr } = await db
    .from("screening_catalog_versions")
    .select("*")
    .eq("is_active", false)
    .eq("is_immutable", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dErr) throw new Error(`getOrCreateDraftCatalog (lookup) failed: ${dErr.message}`);
  if (existing) return loadFullVersion(existing as DbScreeningCatalogVersion);
  return cloneActiveIntoDraft();
}

export async function saveDraftCatalog(
  draftVersionId: string,
  patch: CatalogDraftPatch,
): Promise<void> {
  const db = getServiceClient();
  const { data: v, error: vErr } = await db
    .from("screening_catalog_versions")
    .select("catalog_version_id, is_immutable, is_active")
    .eq("catalog_version_id", draftVersionId)
    .single();
  if (vErr || !v) throw new Error(`saveDraftCatalog: version not found`);
  if (v.is_immutable || v.is_active) {
    throw new Error(
      "saveDraftCatalog: this version is no longer editable. Reload the page.",
    );
  }

  const { error: upErr } = await db
    .from("screening_catalog_versions")
    .update({
      flag_if_red_at_least: patch.flag_if_red_at_least,
      flag_if_yellow_at_least: patch.flag_if_yellow_at_least,
    })
    .eq("catalog_version_id", draftVersionId);
  if (upErr) throw new Error(`saveDraftCatalog (version update) failed: ${upErr.message}`);

  // Replace-and-upsert: delete all questions for this draft, then re-insert.
  // The draft is short (~12 questions) so this is simple and correct.
  const { error: delErr } = await db
    .from("screening_questions")
    .delete()
    .eq("catalog_version_id", draftVersionId);
  if (delErr) throw new Error(`saveDraftCatalog (delete questions) failed: ${delErr.message}`);

  for (let qi = 0; qi < patch.questions.length; qi++) {
    const q = patch.questions[qi];
    const questionId = await nextSequentialId(
      "screening_questions",
      "question_id",
      "NM-SCRQ",
    );
    const questionKey = toSlug(q.prompt) || `q${qi + 1}`;
    const { error: qErr } = await db.from("screening_questions").insert({
      question_id: questionId,
      catalog_version_id: draftVersionId,
      question_key: questionKey,
      prompt: q.prompt,
      prompt_highlight: null,
      step: 1,
      kind: q.kind,
      is_scored: q.is_scored,
      is_required: q.is_required,
      multi_select_rule: q.kind === "multi" ? "worst_color" : null,
      placeholder: null,
      max_length: q.kind === "textarea" ? 500 : null,
      sort_order: qi,
    });
    if (qErr) throw new Error(`saveDraftCatalog (insert question ${qi}) failed: ${qErr.message}`);

    for (let oi = 0; oi < q.options.length; oi++) {
      const o = q.options[oi];
      const optionId = await nextSequentialId(
        "screening_options",
        "option_id",
        "NM-SCRO",
      );
      const optionKey = toSlug(o.label) || `opt${oi + 1}`;
      const { error: oErr } = await db.from("screening_options").insert({
        option_id: optionId,
        question_id: questionId,
        option_key: optionKey,
        label: o.label,
        tag: o.tag,
        is_deal_breaker: o.is_deal_breaker,
        sort_order: oi,
      });
      if (oErr) {
        throw new Error(`saveDraftCatalog (insert option ${qi}.${oi}) failed: ${oErr.message}`);
      }
    }
  }
}

export async function publishCatalog(
  draftVersionId: string,
): Promise<{ newDraftId: string }> {
  const db = getServiceClient();
  const { error: rpcErr } = await db.rpc("nm_publish_screening_catalog", {
    p_catalog_version_id: draftVersionId,
  });
  if (rpcErr) throw new Error(`publishCatalog: RPC failed: ${rpcErr.message}`);
  const fresh = await cloneActiveIntoDraft();
  return { newDraftId: fresh.version.catalog_version_id };
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const db = getServiceClient();
  const { error } = await db.from("screening_questions").delete().eq("question_id", questionId);
  if (error) throw new Error(`deleteQuestion failed: ${error.message}`);
}

export async function deleteOption(optionId: string): Promise<void> {
  const db = getServiceClient();
  const { error } = await db.from("screening_options").delete().eq("option_id", optionId);
  if (error) throw new Error(`deleteOption failed: ${error.message}`);
}

export async function countTripsWithScreeningEnabled(): Promise<number> {
  const db = getServiceClient();
  const { count, error } = await db
    .from("trips")
    .select("trip_id", { count: "exact", head: true })
    .eq("trip_type", "Community")
    .eq("screening_enabled", true);
  if (error) throw new Error(`countTripsWithScreeningEnabled failed: ${error.message}`);
  return count ?? 0;
}

// ---------- Internals ----------

async function loadFullVersion(
  v: DbScreeningCatalogVersion,
): Promise<FullCatalogVersion> {
  const db = getServiceClient();
  const { data: qs, error: qErr } = await db
    .from("screening_questions")
    .select("*")
    .eq("catalog_version_id", v.catalog_version_id)
    .order("sort_order", { ascending: true });
  if (qErr) throw new Error(`loadFullVersion (questions) failed: ${qErr.message}`);

  const questions = (qs ?? []) as DbScreeningQuestion[];
  const questionIds = questions.map((q) => q.question_id);
  const optionsByQuestion = new Map<string, DbScreeningOption[]>();
  if (questionIds.length > 0) {
    const { data: opts, error: oErr } = await db
      .from("screening_options")
      .select("*")
      .in("question_id", questionIds)
      .order("sort_order", { ascending: true });
    if (oErr) throw new Error(`loadFullVersion (options) failed: ${oErr.message}`);
    for (const o of (opts ?? []) as DbScreeningOption[]) {
      const list = optionsByQuestion.get(o.question_id) ?? [];
      list.push(o);
      optionsByQuestion.set(o.question_id, list);
    }
  }

  return {
    version: v,
    questions: questions.map((q) => ({
      ...q,
      options: optionsByQuestion.get(q.question_id) ?? [],
    })),
  };
}

async function cloneActiveIntoDraft(): Promise<FullCatalogVersion> {
  const db = getServiceClient();
  const { data: active, error: aErr } = await db
    .from("screening_catalog_versions")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (aErr) throw new Error(`cloneActiveIntoDraft (lookup active) failed: ${aErr.message}`);

  const newVersionId = await nextSequentialId(
    "screening_catalog_versions",
    "catalog_version_id",
    "NM-SCRV",
  );
  const versionLabel = `draft @ ${new Date().toISOString()}`;
  const flagRed = active?.flag_if_red_at_least ?? 1;
  const flagYellow = active?.flag_if_yellow_at_least ?? 2;

  const { error: insErr } = await db.from("screening_catalog_versions").insert({
    catalog_version_id: newVersionId,
    version_label: versionLabel,
    is_active: false,
    flag_if_red_at_least: flagRed,
    flag_if_yellow_at_least: flagYellow,
    is_immutable: false,
  });
  if (insErr) throw new Error(`cloneActiveIntoDraft (insert version) failed: ${insErr.message}`);

  if (active) {
    const { data: oldQs } = await db
      .from("screening_questions")
      .select("*")
      .eq("catalog_version_id", active.catalog_version_id)
      .order("sort_order", { ascending: true });
    for (const q of (oldQs ?? []) as DbScreeningQuestion[]) {
      const newQId = await nextSequentialId("screening_questions", "question_id", "NM-SCRQ");
      await db.from("screening_questions").insert({
        question_id: newQId,
        catalog_version_id: newVersionId,
        question_key: q.question_key,
        prompt: q.prompt,
        prompt_highlight: q.prompt_highlight,
        step: q.step,
        kind: q.kind,
        is_scored: q.is_scored,
        is_required: q.is_required,
        multi_select_rule: q.multi_select_rule,
        placeholder: q.placeholder,
        max_length: q.max_length,
        sort_order: q.sort_order,
      });
      const { data: oldOpts } = await db
        .from("screening_options")
        .select("*")
        .eq("question_id", q.question_id)
        .order("sort_order", { ascending: true });
      for (const o of (oldOpts ?? []) as DbScreeningOption[]) {
        const newOId = await nextSequentialId("screening_options", "option_id", "NM-SCRO");
        await db.from("screening_options").insert({
          option_id: newOId,
          question_id: newQId,
          option_key: o.option_key,
          label: o.label,
          tag: o.tag,
          is_deal_breaker: o.is_deal_breaker,
          sort_order: o.sort_order,
        });
      }
    }
  }

  const { data: freshV } = await db
    .from("screening_catalog_versions")
    .select("*")
    .eq("catalog_version_id", newVersionId)
    .single();
  return loadFullVersion(freshV as DbScreeningCatalogVersion);
}
