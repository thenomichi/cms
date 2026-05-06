import { getServiceClient } from "@/lib/supabase/server";
import type { DbDepartureCity } from "@/lib/types";
import { slugify } from "@/lib/utils";

export async function listDepartureCities(): Promise<DbDepartureCity[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("departure_cities")
    .select("*")
    .eq("is_active", true)
    .order("is_popular", { ascending: false })
    .order("display_order", { ascending: true })
    .order("city_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbDepartureCity[];
}

export async function addDepartureCity(input: {
  city_name: string;
  country_code: string;
  country_name: string;
  is_popular?: boolean;
}): Promise<DbDepartureCity> {
  const db = getServiceClient();
  // Generate a stable id from the slug + country code (e.g. "pokhara-np").
  // The dashboard seed used IATA codes for major cities; user-added cities
  // use the slug-based form. Both shapes coexist fine — id is opaque to
  // consumers.
  const idCandidate = `${slugify(input.city_name)}-${input.country_code.toLowerCase()}`;
  const { data, error } = await db
    .from("departure_cities")
    .insert({
      departure_city_id: idCandidate,
      city_name: input.city_name,
      country_code: input.country_code,
      country_name: input.country_name,
      is_popular: input.is_popular ?? false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DbDepartureCity;
}
