import { z } from "zod";

const MIN_LENGTH = 8;

export const todoFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(MIN_LENGTH, `Title must be at least ${MIN_LENGTH} characters`),
  description: z
    .string()
    .trim()
    .min(MIN_LENGTH, `Description must be at least ${MIN_LENGTH} characters`),
});

export type TodoFormValues = z.infer<typeof todoFormSchema>;
export type TodoField = keyof TodoFormValues;
