import { z } from "zod";

const MIN_NAME = 2;
const MIN_PASSWORD = 8;

export const registerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(MIN_NAME, `Name must be at least ${MIN_NAME} characters`),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z
    .string()
    .min(MIN_PASSWORD, `Password must be at least ${MIN_PASSWORD} characters`),
});

export type RegisterFormValues = z.infer<typeof registerFormSchema>;
export type RegisterField = keyof RegisterFormValues;
