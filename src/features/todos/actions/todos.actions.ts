"use server";

import { revalidatePath } from "next/cache";
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

export async function addTodoAction(
  title: string,
  description: string,
): Promise<AddTodoResult> {
  const now = new Date().toISOString();
  try {
    await new AddTodo(TodoPrismaRepository).execute({
      id: crypto.randomUUID(),
      title,
      description,
      completed: false,
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
  await new ToggleTodoCompletion(TodoPrismaRepository).execute(id);
  revalidatePath("/todos");
}
