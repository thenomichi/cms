import { z } from "zod";

export const departureCityCreateSchema = z.object({
  city_name: z.string().min(2, "City name is required"),
  country_code: z.string().length(2, "Use 2-letter ISO country code (e.g. IN)"),
  country_name: z.string().min(2, "Country name is required"),
  is_popular: z.boolean().default(false),
});

export type DepartureCityCreateInput = z.infer<typeof departureCityCreateSchema>;
