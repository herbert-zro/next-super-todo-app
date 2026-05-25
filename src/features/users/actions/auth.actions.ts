"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { RegisterUser } from "../application/use-cases/RegisterUser";
import {
  type RegisterField,
  type RegisterFormValues,
} from "../application/schemas/registerFormSchema";
import { type LoginField } from "../application/schemas/loginFormSchema";
import { UserValidationError } from "../domain/errors/UserValidationError";
import { EmailAlreadyTakenError } from "../domain/errors/EmailAlreadyTakenError";
import { UserPrismaRepository } from "../infrastructure/repositories/UserPrismaRepository";
import { bcryptHasher } from "../infrastructure/hashing/bcryptHasher";

export type RegisterResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<RegisterField | "form", string>> };

export type LoginResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<LoginField | "form", string>> };

export async function registerAction(
  input: RegisterFormValues,
): Promise<RegisterResult> {
  try {
    await new RegisterUser(UserPrismaRepository, bcryptHasher).execute(input);
  } catch (e) {
    if (e instanceof UserValidationError) {
      return {
        ok: false,
        errors: e.fieldErrors as Partial<Record<RegisterField, string>>,
      };
    }
    if (e instanceof EmailAlreadyTakenError) {
      return { ok: false, errors: { email: "Email is already taken" } };
    }
    console.error("[registerAction] unexpected error:", e);
    return {
      ok: false,
      errors: { form: "Could not create account. Try again." },
    };
  }

  try {
    await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirectTo: "/todos",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return {
        ok: false,
        errors: { form: "Account created but auto-login failed. Please log in." },
      };
    }
    throw e;
  }

  return { ok: true };
}

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  try {
    await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirectTo: "/todos",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, errors: { form: "Invalid credentials" } };
    }
    throw e;
  }
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
