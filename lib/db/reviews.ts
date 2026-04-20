import { getServiceClient } from "@/lib/supabase/server";
import type { DbReview } from "@/lib/types";

export async function getReviews(): Promise<DbReview[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("reviews")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DbReview[];
}

export async function getReviewById(id: string): Promise<DbReview | null> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("reviews")
    .select("*")
    .eq("review_id", id)
    .single();

  if (error) return null;
  return data as DbReview;
}

export async function createReview(
  payload: Omit<DbReview, "created_at" | "updated_at">,
): Promise<DbReview> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("reviews")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as DbReview;
}

export async function updateReview(
  id: string,
  payload: Partial<Omit<DbReview, "review_id" | "created_at" | "updated_at">>,
): Promise<DbReview> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("reviews")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("review_id", id)
    .select()
    .single();

  if (error) throw error;
  return data as DbReview;
}

export async function deleteReview(id: string): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb.from("reviews").delete().eq("review_id", id);
  if (error) throw error;
}

export async function toggleReviewField(
  id: string,
  field: "is_approved" | "is_featured" | "show_on_homepage",
  value: boolean,
): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("reviews")
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq("review_id", id);

  if (error) throw error;
}
