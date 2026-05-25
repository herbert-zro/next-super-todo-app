"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { AddTodo } from "../application/use-cases/AddTodo";
import { ToggleTodoCompletion } from "../application/use-cases/ToggleTodoCompletion";
import { TodoPrismaRepository } from "../infrastructure/repositories/TodoPrismaRepository";
import { TodoValidationError } from "../domain/errors/TodoValidationError";
import {
  type TodoField,
  type TodoFormValues,
} from "../application/schemas/todoFormSchema";

export type AddTodoResult =
  | { ok: true }
  | {
      ok: false;
      errors: Partial<Record<keyof TodoFormValues | "form", string>>;
    };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function addTodoAction(
  title: string,
  description: string,
): Promise<AddTodoResult> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  try {
    await new AddTodo(TodoPrismaRepository).execute({
      id: crypto.randomUUID(),
      title,
      description,
      completed: false,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  } catch (e) {
    if (e instanceof TodoValidationError) {
      return {
        ok: false,
        errors: e.fieldErrors as Partial<Record<TodoField, string>>,
      };
    }
    return { ok: false, errors: { form: "Could not add todo. Try again." } };
  }

  revalidatePath("/todos");
  return { ok: true };
}

export async function toggleTodoAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await new ToggleTodoCompletion(TodoPrismaRepository).execute(id, userId);
  revalidatePath("/todos");
}
