"use server";

import { revalidatePath } from "next/cache";
import { makeDestinationId } from "@/lib/ids";
import {
  createDestination as dbCreate,
  updateDestination as dbUpdate,
  deleteDestination as dbDelete,
  generateUniqueDestCode,
} from "@/lib/db/destinations";
import { revalidateHome } from "@/lib/revalidate";
import { logActivity } from "@/lib/audit";

export async function createDestination(
  formData: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const name = formData.destination_name as string;
    if (!name || name.length < 2) return { success: false, error: "Destination name is required" };

    const country = formData.country as string;
    if (!country) return { success: false, error: "Country is required" };

    const code = await generateUniqueDestCode(name);
    // Build destination ID: DEST-{COUNTRY_3LETTER}-{CODE}
    const id = makeDestinationId(country, code);

    await dbCreate({
      destination_id: id,
      destination_code: code,
      destination_name: name,
      country,
      is_domestic: formData.is_domestic === true,
      is_active: formData.is_active !== false,
      icon: (formData.icon as string) || null,
      description: (formData.description as string) || null,
      display_order: typeof formData.display_order === "number" ? formData.display_order : 0,
    });

    await logActivity({ table_name: "destinations", record_id: id, action: "INSERT", new_values: { destination_name: name, country } });
    revalidatePath("/destinations");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function updateDestination(
  id: string,
  formData: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const name = formData.destination_name as string;
    if (!name || name.length < 2) return { success: false, error: "Destination name is required" };

    const country = formData.country as string;
    if (!country) return { success: false, error: "Country is required" };

    // Regenerate code from name (unique, excluding this destination)
    const code = await generateUniqueDestCode(name, id);

    await dbUpdate(id, {
      destination_code: code,
      destination_name: name,
      country,
      is_domestic: formData.is_domestic === true,
      is_active: formData.is_active !== false,
      icon: (formData.icon as string) || null,
      description: (formData.description as string) || null,
      display_order: typeof formData.display_order === "number" ? formData.display_order : 0,
    });

    await logActivity({ table_name: "destinations", record_id: id, action: "UPDATE", new_values: { destination_name: name, country } });
    revalidatePath("/destinations");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function toggleDestinationActive(
  id: string,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbUpdate(id, { is_active: isActive });
    await logActivity({ table_name: "destinations", record_id: id, action: "TOGGLE", new_values: { is_active: isActive } });
    revalidatePath("/destinations");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteDestination(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await dbDelete(id);
    await logActivity({ table_name: "destinations", record_id: id, action: "DELETE" });
    revalidatePath("/destinations");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
