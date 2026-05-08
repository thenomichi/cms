import { z } from "zod";

export const inclusionChipCreateSchema = z.object({
  name: z.string().min(2, "Name is required"),
  icon: z.string().min(1, "Icon is required"),
  category: z.string().min(1, "Category is required"),
});

export type InclusionChipCreateInput = z.infer<typeof inclusionChipCreateSchema>;
