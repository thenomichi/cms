import { getServiceClient } from "@/lib/supabase/server";
import { nextSequentialId } from "@/lib/ids";
import type { DbTripFaq } from "@/lib/types";

export interface FaqInput {
  question: string;
  answer: string;
  category?: string | null;
}

export interface FaqWithTrip extends DbTripFaq {
  trip_name: string | null;
}

export async function getFaqs(tripId?: string): Promise<FaqWithTrip[]> {
  const sb = getServiceClient();
  let query = sb
    .from("trip_faqs")
    .select("*, trips!left(trip_name)")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (tripId) {
    query = query.eq("trip_id", tripId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...(row as unknown as DbTripFaq),
    trip_name:
      (row.trips as { trip_name: string | null } | null)?.trip_name ?? null,
  }));
}

export async function getFaqById(id: string): Promise<DbTripFaq | null> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("trip_faqs")
    .select("*")
    .eq("faq_id", id)
    .single();

  if (error) return null;
  return data as DbTripFaq;
}

export async function createFaq(
  payload: Omit<DbTripFaq, "created_at" | "updated_at">,
): Promise<DbTripFaq> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("trip_faqs")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as DbTripFaq;
}

export async function updateFaq(
  id: string,
  payload: Partial<Omit<DbTripFaq, "faq_id" | "created_at" | "updated_at">>,
): Promise<DbTripFaq> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("trip_faqs")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("faq_id", id)
    .select()
    .single();

  if (error) throw error;
  return data as DbTripFaq;
}

export async function deleteFaq(id: string): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb.from("trip_faqs").delete().eq("faq_id", id);
  if (error) throw error;
}

/**
 * Replace all FAQs for a trip in one round-trip. Mirrors saveTripItinerary:
 * delete existing rows, insert the new ones with sequential display_order.
 * IDs are minted via `nextSequentialId` because the existing standalone
 * createFaq path requires the caller to provide `faq_id` (no DB default).
 */
export async function saveTripFaqs(
  tripId: string,
  faqs: FaqInput[],
): Promise<void> {
  const sb = getServiceClient();

  const { error: delErr } = await sb
    .from("trip_faqs")
    .delete()
    .eq("trip_id", tripId);
  if (delErr) throw new Error(`saveTripFaqs delete failed: ${delErr.message}`);

  if (faqs.length === 0) return;

  // Allocate IDs sequentially — parallel allocation can race on the same id.
  const rows = [];
  for (let idx = 0; idx < faqs.length; idx++) {
    const f = faqs[idx];
    rows.push({
      faq_id: await nextSequentialId("trip_faqs", "faq_id", "FAQ"),
      trip_id: tripId,
      question: f.question,
      answer: f.answer,
      category: f.category ?? null,
      display_order: idx,
      is_active: true,
    });
  }

  const { error: insErr } = await sb.from("trip_faqs").insert(rows);
  if (insErr) throw new Error(`saveTripFaqs insert failed: ${insErr.message}`);
}
