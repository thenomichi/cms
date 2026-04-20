"use server";

import { revalidatePath } from "next/cache";
import { tripFaqSchema } from "@/lib/schemas/trip";
import { nextSequentialId } from "@/lib/ids";
import {
  createFaq as dbCreate,
  updateFaq as dbUpdate,
  deleteFaq as dbDelete,
} from "@/lib/db/trip-faqs";
import { getServiceClient } from "@/lib/supabase/server";
import { revalidateTrip, revalidateHome } from "@/lib/revalidate";
import { logActivity } from "@/lib/audit";

async function getTripSlug(tripId: string | null): Promise<string | null> {
  if (!tripId) return null;
  const sb = getServiceClient();
  const { data } = await sb
    .from("trips")
    .select("slug")
    .eq("trip_id", tripId)
    .single();
  return data?.slug ?? null;
}

export async function createFaq(
  formData: Record<string, unknown>,
): Promise<{ success: boolean; error?: string | Record<string, unknown> }> {
  const parsed = tripFaqSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  try {
    const tripId = (formData.trip_id as string) || null;
    const displayOrder =
      typeof formData.display_order === "number" ? formData.display_order : 0;
    const isActive =
      typeof formData.is_active === "boolean" ? formData.is_active : true;

    const id = await nextSequentialId("trip_faqs", "faq_id", "FAQ");
    await dbCreate({
      faq_id: id,
      trip_id: tripId ?? "",
      question: parsed.data.question,
      answer: parsed.data.answer,
      category: parsed.data.category ?? null,
      display_order: displayOrder,
      is_active: isActive,
    });

    await logActivity({ table_name: "trip_faqs", record_id: id, action: "INSERT", new_values: { question: parsed.data.question, trip_id: tripId } });
    revalidatePath("/faqs");
    const slug = await getTripSlug(tripId);
    if (slug) {
      await revalidateTrip(slug);
    } else {
      await revalidateHome();
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function updateFaq(
  id: string,
  formData: Record<string, unknown>,
): Promise<{ success: boolean; error?: string | Record<string, unknown> }> {
  const parsed = tripFaqSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  try {
    const tripId = (formData.trip_id as string) || null;
    const displayOrder =
      typeof formData.display_order === "number" ? formData.display_order : 0;
    const isActive =
      typeof formData.is_active === "boolean" ? formData.is_active : true;

    await dbUpdate(id, {
      trip_id: tripId ?? "",
      question: parsed.data.question,
      answer: parsed.data.answer,
      category: parsed.data.category ?? null,
      display_order: displayOrder,
      is_active: isActive,
    });

    await logActivity({ table_name: "trip_faqs", record_id: id, action: "UPDATE", new_values: { question: parsed.data.question, trip_id: tripId } });
    revalidatePath("/faqs");
    const slug = await getTripSlug(tripId);
    if (slug) {
      await revalidateTrip(slug);
    } else {
      await revalidateHome();
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function toggleFaqActive(
  id: string,
  isActive: boolean,
  tripId?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbUpdate(id, { is_active: isActive });
    await logActivity({ table_name: "trip_faqs", record_id: id, action: "TOGGLE", new_values: { is_active: isActive } });
    revalidatePath("/faqs");
    const slug = await getTripSlug(tripId ?? null);
    if (slug) await revalidateTrip(slug);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function reorderFaqs(
  orderedIds: string[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const sb = getServiceClient();
    for (let i = 0; i < orderedIds.length; i++) {
      await sb
        .from("trip_faqs")
        .update({ display_order: i })
        .eq("faq_id", orderedIds[i]);
    }
    await logActivity({ table_name: "trip_faqs", record_id: orderedIds.join(","), action: "UPDATE", new_values: { reordered: orderedIds } });
    revalidatePath("/faqs");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteFaq(
  id: string,
  tripId?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbDelete(id);
    await logActivity({ table_name: "trip_faqs", record_id: id, action: "DELETE" });
    revalidatePath("/faqs");
    const slug = await getTripSlug(tripId ?? null);
    if (slug) {
      await revalidateTrip(slug);
    } else {
      await revalidateHome();
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
