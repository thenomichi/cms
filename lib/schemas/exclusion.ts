import { z } from "zod";

export const exclusionCreateSchema = z.object({
  name: z.string().min(2, "Name is required"),
  category: z.string().min(1).default("Other"),
  is_popular: z.boolean().default(false),
});

export type ExclusionCreateInput = z.infer<typeof exclusionCreateSchema>;
