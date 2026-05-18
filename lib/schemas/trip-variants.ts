import { z } from "zod";

export const variantAxisInputSchema = z.object({
  variant_axis_id: z.string().optional(),
  axis_label: z.string().min(1, "Please enter a label for this price choice").max(80),
  axis_description: z.string().max(200).nullable(),
  is_required: z.boolean(),
});

export const variantOptionInputSchema = z.object({
  variant_option_id: z.string().optional(),
  variant_axis_id: z.string().optional(),
  option_label: z.string().min(1, "Please enter a label for this option").max(60),
  option_sublabel: z.string().max(120).nullable(),
  price_per_pax: z
    .number()
    .int("Price must be a whole number of rupees")
    .min(0, "Price cannot be negative")
    .max(1_000_000, "Price seems too high — please double-check"),
  is_active: z.boolean(),
});

export type VariantAxisInput = z.infer<typeof variantAxisInputSchema>;
export type VariantOptionInput = z.infer<typeof variantOptionInputSchema>;
