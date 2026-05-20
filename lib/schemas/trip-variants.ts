import { z } from "zod";

// 'exact' is legacy: removed from the user-facing UI but kept on existing
// DB rows. The schema accepts it on read; new writes always use 'percent'
// or 'flat'. If we ever want to remove the DB CHECK, we'd backfill first.
export const VARIANT_DISCOUNT_MODES = ["percent", "flat", "exact"] as const;
export type VariantDiscountMode = (typeof VARIANT_DISCOUNT_MODES)[number];

export const variantAxisInputSchema = z.object({
  variant_axis_id: z.string().optional(),
  axis_label: z.string().min(1, "Please enter a label for this price choice").max(80),
  axis_description: z.string().max(200).nullable(),
  is_required: z.boolean(),
});

export const variantOptionInputSchema = z
  .object({
    variant_option_id: z.string().optional(),
    variant_axis_id: z.string().optional(),
    option_label: z.string().min(1, "Please enter a label for this option").max(60),
    option_sublabel: z.string().max(120).nullable(),
    /** MRP (strikethrough) per traveller in INR. Integer rupees, must be > 0 for active options. */
    mrp_per_pax: z
      .number()
      .int("MRP must be a whole number of rupees")
      .min(0, "MRP cannot be negative")
      .max(1_000_000, "MRP seems too high — please double-check"),
    /** Final selling price per traveller in INR. Must be <= mrp_per_pax. */
    price_per_pax: z
      .number()
      .int("Price must be a whole number of rupees")
      .min(0, "Price cannot be negative")
      .max(1_000_000, "Price seems too high — please double-check"),
    /** Discount percentage (0–99) when discount_mode='percent'. */
    discount_pct: z.number().min(0).max(99).nullable(),
    /** Flat discount in INR when discount_mode='flat'. */
    discount_amount: z
      .number()
      .int()
      .min(0)
      .max(1_000_000)
      .nullable(),
    /** Which input the founder used. Drives the CMS segmented control. */
    discount_mode: z.enum(VARIANT_DISCOUNT_MODES),
    is_active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.price_per_pax > v.mrp_per_pax) {
      ctx.addIssue({
        code: "custom",
        path: ["price_per_pax"],
        message: "Selling price can't be higher than MRP. Set the discount to 0 or raise the MRP.",
      });
    }
    if (v.is_active && v.mrp_per_pax === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["mrp_per_pax"],
        message: "Active options need an MRP above ₹0. Set a price or toggle Show off.",
      });
    }
    if (v.is_active && v.price_per_pax === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["price_per_pax"],
        message: "Active options need a selling price above ₹0. Set a price or toggle Show off.",
      });
    }
  });

export type VariantAxisInput = z.infer<typeof variantAxisInputSchema>;
export type VariantOptionInput = z.infer<typeof variantOptionInputSchema>;
