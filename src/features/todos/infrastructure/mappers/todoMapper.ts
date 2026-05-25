import type { TodoModel } from "@/shared/generated/prisma/models";

import type { Todo } from "../../domain/entities/Todo";

type TodoRow = TodoModel;

export const toDomain = (row: TodoRow): Todo => ({
  id: row.id,
  title: row.title,
  description: row.description,
  completed: row.completed,
  userId: row.userId ?? "",
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toPersistence = (todo: Todo) => ({
  id: todo.id,
  title: todo.title,
  description: todo.description,
  completed: todo.completed,
  userId: todo.userId,
  createdAt: new Date(todo.createdAt),
  updatedAt: new Date(todo.updatedAt),
});
