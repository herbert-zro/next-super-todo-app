import { UserValidationError } from "../../domain/errors/UserValidationError";
import {
  registerFormSchema,
  type RegisterField,
  type RegisterFormValues,
} from "../schemas/registerFormSchema";

export function createUserRegistration(
  input: RegisterFormValues,
): RegisterFormValues {
  const parsed = registerFormSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Partial<Record<RegisterField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as RegisterField;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    throw new UserValidationError<RegisterField>(fieldErrors);
  }

  return parsed.data;
}
