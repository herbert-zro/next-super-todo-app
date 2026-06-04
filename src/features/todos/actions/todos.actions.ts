"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { AddTodo } from "../application/use-cases/AddTodo";
import { ToggleTodoCompletion } from "../application/use-cases/ToggleTodoCompletion";
import { UpdateTodo } from "../application/use-cases/UpdateTodo";
import { DeleteTodo } from "../application/use-cases/DeleteTodo";
import { TodoPrismaRepository } from "../infrastructure/repositories/TodoPrismaRepository";
import { TodoValidationError } from "../domain/errors/TodoValidationError";
import { TodoNotFoundError } from "../domain/errors/TodoNotFoundError";
import {
  type TodoField,
  type TodoFormValues,
} from "../application/schemas/todoFormSchema";

type TodoMutationResult =
  | { ok: true }
  | {
      ok: false;
      errors: Partial<Record<keyof TodoFormValues | "form", string>>;
    };

export type AddTodoResult = TodoMutationResult;
export type UpdateTodoResult = TodoMutationResult;

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
  try {
    await new AddTodo(TodoPrismaRepository).execute({ title, description, userId });
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

export async function updateTodoAction(input: {
  id: string;
  title: string;
  description: string;
}): Promise<UpdateTodoResult> {
  const userId = await requireUserId();
  try {
    await new UpdateTodo(TodoPrismaRepository).execute(
      { id: input.id, title: input.title, description: input.description },
      userId,
    );
  } catch (e) {
    if (e instanceof TodoValidationError) {
      return {
        ok: false,
        errors: e.fieldErrors as Partial<Record<TodoField, string>>,
      };
    }
    if (e instanceof TodoNotFoundError) {
      return { ok: false, errors: { form: "This todo no longer exists." } };
    }
    return { ok: false, errors: { form: "Could not update todo. Try again." } };
  }

  revalidatePath("/todos");
  revalidatePath(`/todos/${input.id}`);
  return { ok: true };
}

export async function deleteTodoAction(id: string): Promise<void> {
  const userId = await requireUserId();
  try {
    await new DeleteTodo(TodoPrismaRepository).execute(id, userId);
  } catch (e) {
    // Idempotent delete: if it's already gone, the desired state is achieved.
    if (!(e instanceof TodoNotFoundError)) throw e;
  }
  revalidatePath("/todos");
}
