"use server";

import { revalidatePath } from "next/cache";
import { AddTodo } from "../application/use-cases/AddTodo";
import { ToggleTodoCompletion } from "../application/use-cases/ToggleTodoCompletion";
import { TodoPrismaRepository } from "../infrastructure/repositories/TodoPrismaRepository";

export async function addTodoAction(
  title: string,
  description: string
): Promise<void> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;

  const now = new Date().toISOString();
  await new AddTodo(TodoPrismaRepository).execute({
    id: crypto.randomUUID(),
    title: trimmedTitle,
    description: description.trim(),
    completed: false,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/todos");
}

export async function toggleTodoAction(id: string): Promise<void> {
  await new ToggleTodoCompletion(TodoPrismaRepository).execute(id);
  revalidatePath("/todos");
}
