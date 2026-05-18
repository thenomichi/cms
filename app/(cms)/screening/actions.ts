"use server";

import { revalidatePath } from "next/cache";
import { catalogDraftPatchSchema, type CatalogDraftPatch } from "@/lib/schemas/screening";
import {
  saveDraftCatalog,
  publishCatalog,
  deleteQuestion,
  deleteOption,
} from "@/lib/db/screening";
import { revalidateScreeningCatalog } from "@/lib/revalidate";
import { logActivity } from "@/lib/audit";

function logAsync(input: Parameters<typeof logActivity>[0]): void {
  void logActivity(input).catch((err) => {
    console.error("[logActivity] swallowed:", err);
  });
}

export async function saveDraftAction(
  draftVersionId: string,
  rawPatch: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = catalogDraftPatchSchema.safeParse(rawPatch);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `${issue.path.join(".") || "form"}: ${issue.message}`,
    };
  }
  try {
    await saveDraftCatalog(draftVersionId, parsed.data as CatalogDraftPatch);
    revalidatePath("/screening");
    logAsync({
      table_name: "screening_catalog_versions",
      record_id: draftVersionId,
      action: "UPDATE",
      new_values: { question_count: parsed.data.questions.length },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function publishCatalogAction(
  draftVersionId: string,
): Promise<{ ok: true; newDraftId: string } | { ok: false; error: string }> {
  try {
    const { newDraftId } = await publishCatalog(draftVersionId);
    await revalidateScreeningCatalog();
    revalidatePath("/screening");
    logAsync({
      table_name: "screening_catalog_versions",
      record_id: draftVersionId,
      action: "UPDATE",
      new_values: { published: true },
    });
    return { ok: true, newDraftId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteQuestionAction(
  questionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deleteQuestion(questionId);
    revalidatePath("/screening");
    logAsync({
      table_name: "screening_questions",
      record_id: questionId,
      action: "DELETE",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteOptionAction(
  optionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deleteOption(optionId);
    revalidatePath("/screening");
    logAsync({
      table_name: "screening_options",
      record_id: optionId,
      action: "DELETE",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
