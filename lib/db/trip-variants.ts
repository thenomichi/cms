import { getServiceClient } from "@/lib/supabase/server";
import { nextSequentialId } from "@/lib/ids";
import { toSlug } from "@/lib/slug";
import type { VariantAxisInput, VariantOptionInput } from "@/lib/schemas/trip-variants";

export interface DbVariantAxis {
  variant_axis_id: string;
  group_slug: string;
  axis_key: string;
  axis_label: string;
  axis_description: string | null;
  sort_order: number;
  is_required: boolean;
}

export interface DbVariantOption {
  variant_option_id: string;
  variant_axis_id: string;
  option_key: string;
  option_label: string;
  option_sublabel: string | null;
  mrp_per_pax: number;
  price_per_pax: number;
  discount_pct: number | null;
  discount_amount: number | null;
  discount_mode: "percent" | "flat" | "exact";
  sort_order: number;
  is_active: boolean;
}

export interface FullVariantAxis extends DbVariantAxis {
  options: DbVariantOption[];
}

export async function getVariantAxesForGroup(
  groupSlug: string,
): Promise<FullVariantAxis[]> {
  if (!groupSlug) return [];
  const db = getServiceClient();
  const { data: axes, error: aErr } = await db
    .from("trip_variant_axes")
    .select("*")
    .eq("group_slug", groupSlug)
    .order("sort_order", { ascending: true });
  if (aErr) throw new Error(`getVariantAxesForGroup (axes) failed: ${aErr.message}`);
  const axisRows = (axes ?? []) as DbVariantAxis[];
  if (axisRows.length === 0) return [];

  const axisIds = axisRows.map((a) => a.variant_axis_id);
  const { data: opts, error: oErr } = await db
    .from("trip_variant_options")
    .select("*")
    .in("variant_axis_id", axisIds)
    .order("sort_order", { ascending: true });
  if (oErr) throw new Error(`getVariantAxesForGroup (options) failed: ${oErr.message}`);

  const optionsByAxis = new Map<string, DbVariantOption[]>();
  for (const o of (opts ?? []) as DbVariantOption[]) {
    const list = optionsByAxis.get(o.variant_axis_id) ?? [];
    list.push(o);
    optionsByAxis.set(o.variant_axis_id, list);
  }
  return axisRows.map((a) => ({ ...a, options: optionsByAxis.get(a.variant_axis_id) ?? [] }));
}

export async function upsertVariantAxis(
  groupSlug: string,
  input: VariantAxisInput,
): Promise<string> {
  if (!groupSlug) {
    throw new Error("upsertVariantAxis: group_slug is required");
  }
  const db = getServiceClient();
  const axisKey = toSlug(input.axis_label);
  if (!axisKey) throw new Error("upsertVariantAxis: axis label produced an empty key");

  if (input.variant_axis_id) {
    const { error } = await db
      .from("trip_variant_axes")
      .update({
        axis_label: input.axis_label,
        axis_description: input.axis_description,
        is_required: input.is_required,
      })
      .eq("variant_axis_id", input.variant_axis_id);
    if (error) throw new Error(`upsertVariantAxis (update) failed: ${error.message}`);
    return input.variant_axis_id;
  }

  const { data: existing } = await db
    .from("trip_variant_axes")
    .select("sort_order")
    .eq("group_slug", groupSlug)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSortOrder =
    ((existing?.[0] as { sort_order?: number } | undefined)?.sort_order ?? -1) + 1;

  const newId = await nextSequentialId("trip_variant_axes", "variant_axis_id", "NM-VAX");
  const { error } = await db.from("trip_variant_axes").insert({
    variant_axis_id: newId,
    group_slug: groupSlug,
    axis_key: axisKey,
    axis_label: input.axis_label,
    axis_description: input.axis_description,
    sort_order: nextSortOrder,
    is_required: input.is_required,
  });
  if (error) throw new Error(`upsertVariantAxis (insert) failed: ${error.message}`);
  return newId;
}

export async function deleteVariantAxis(axisId: string): Promise<void> {
  const db = getServiceClient();
  const { error } = await db
    .from("trip_variant_axes")
    .delete()
    .eq("variant_axis_id", axisId);
  if (error) throw new Error(`deleteVariantAxis failed: ${error.message}`);
}

export async function upsertVariantOption(
  input: VariantOptionInput & { variant_axis_id: string },
): Promise<string> {
  const db = getServiceClient();
  const optionKey = toSlug(input.option_label);
  if (!optionKey) throw new Error("upsertVariantOption: option label produced an empty key");

  if (input.variant_option_id) {
    const { error } = await db
      .from("trip_variant_options")
      .update({
        option_label: input.option_label,
        option_sublabel: input.option_sublabel,
        mrp_per_pax: input.mrp_per_pax,
        price_per_pax: input.price_per_pax,
        discount_pct: input.discount_pct,
        discount_amount: input.discount_amount,
        discount_mode: input.discount_mode,
        is_active: input.is_active,
      })
      .eq("variant_option_id", input.variant_option_id);
    if (error) throw new Error(`upsertVariantOption (update) failed: ${error.message}`);
    return input.variant_option_id;
  }

  const { data: existing } = await db
    .from("trip_variant_options")
    .select("sort_order")
    .eq("variant_axis_id", input.variant_axis_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSortOrder =
    ((existing?.[0] as { sort_order?: number } | undefined)?.sort_order ?? -1) + 1;

  const newId = await nextSequentialId("trip_variant_options", "variant_option_id", "NM-VOP");
  const { error } = await db.from("trip_variant_options").insert({
    variant_option_id: newId,
    variant_axis_id: input.variant_axis_id,
    option_key: optionKey,
    option_label: input.option_label,
    option_sublabel: input.option_sublabel,
    mrp_per_pax: input.mrp_per_pax,
    price_per_pax: input.price_per_pax,
    discount_pct: input.discount_pct,
    discount_amount: input.discount_amount,
    discount_mode: input.discount_mode,
    sort_order: nextSortOrder,
    is_active: input.is_active,
  });
  if (error) throw new Error(`upsertVariantOption (insert) failed: ${error.message}`);
  return newId;
}

export async function deleteVariantOption(optionId: string): Promise<void> {
  const db = getServiceClient();
  const { error } = await db
    .from("trip_variant_options")
    .delete()
    .eq("variant_option_id", optionId);
  if (error) throw new Error(`deleteVariantOption failed: ${error.message}`);
}

export async function reorderVariantOptions(
  axisId: string,
  orderedIds: string[],
): Promise<void> {
  const db = getServiceClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await db
      .from("trip_variant_options")
      .update({ sort_order: i })
      .eq("variant_option_id", orderedIds[i])
      .eq("variant_axis_id", axisId);
    if (error) throw new Error(`reorderVariantOptions failed at ${i}: ${error.message}`);
  }
}
