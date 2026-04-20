"use server";

import { revalidatePath } from "next/cache";
import { reviewSchema } from "@/lib/schemas/trip";
import { nextSequentialId } from "@/lib/ids";
import {
  createReview as dbCreate,
  updateReview as dbUpdate,
  deleteReview as dbDelete,
  toggleReviewField as dbToggle,
} from "@/lib/db/reviews";
import { revalidateHome } from "@/lib/revalidate";
import { logActivity } from "@/lib/audit";

export async function createReview(
  formData: Record<string, unknown>,
): Promise<{ success: boolean; error?: string | Record<string, unknown> }> {
  const parsed = reviewSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  try {
    const id = await nextSequentialId("reviews", "review_id", "REV");
    const displayOrder =
      typeof formData.display_order === "number" ? formData.display_order : 0;

    await dbCreate({
      review_id: id,
      ...parsed.data,
      trip_id: parsed.data.trip_id ?? null,
      reviewer_location: parsed.data.reviewer_location ?? null,
      reviewer_image_url: parsed.data.reviewer_image_url ?? null,
      trip_location: parsed.data.trip_location ?? null,
      customer_id: null,
      display_order: displayOrder,
    });

    await logActivity({ table_name: "reviews", record_id: id, action: "INSERT", new_values: { reviewer_name: parsed.data.reviewer_name } });
    revalidatePath("/reviews");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function updateReview(
  id: string,
  formData: Record<string, unknown>,
): Promise<{ success: boolean; error?: string | Record<string, unknown> }> {
  const parsed = reviewSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  try {
    const displayOrder =
      typeof formData.display_order === "number" ? formData.display_order : 0;

    await dbUpdate(id, {
      ...parsed.data,
      trip_id: parsed.data.trip_id ?? null,
      reviewer_location: parsed.data.reviewer_location ?? null,
      reviewer_image_url: parsed.data.reviewer_image_url ?? null,
      trip_location: parsed.data.trip_location ?? null,
      display_order: displayOrder,
    });

    await logActivity({ table_name: "reviews", record_id: id, action: "UPDATE", new_values: { reviewer_name: parsed.data.reviewer_name } });
    revalidatePath("/reviews");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteReview(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbDelete(id);
    await logActivity({ table_name: "reviews", record_id: id, action: "DELETE" });
    revalidatePath("/reviews");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function toggleReviewField(
  id: string,
  field: "is_approved" | "is_featured" | "show_on_homepage",
  value: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbToggle(id, field, value);
    await logActivity({ table_name: "reviews", record_id: id, action: "TOGGLE", new_values: { [field]: value } });
    revalidatePath("/reviews");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
