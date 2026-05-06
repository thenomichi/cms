"use server";

import { departureCityCreateSchema } from "@/lib/schemas/departure-city";
import { addDepartureCity } from "@/lib/db/departure-cities";
import type { DbDepartureCity } from "@/lib/types";
import { logActivity } from "@/lib/audit";

export async function addDepartureCityAction(input: {
  city_name: string;
  country_code: string;
  country_name: string;
  is_popular?: boolean;
}): Promise<{ success: boolean; city?: DbDepartureCity; error?: string }> {
  try {
    const parsed = departureCityCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const city = await addDepartureCity(parsed.data);
    void logActivity({
      table_name: "departure_cities",
      record_id: city.departure_city_id,
      action: "INSERT",
      new_values: { city_name: city.city_name, country_code: city.country_code },
    }).catch((err) => console.error("[logActivity] swallowed:", err));
    return { success: true, city };
  } catch (err) {
    console.error("[addDepartureCityAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to add city" };
  }
}
