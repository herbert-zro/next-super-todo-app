import { describe, expect, test } from "@jest/globals";

import { GetTodoById } from "./GetTodoById";
import type { Todo } from "../../domain/entities/Todo";
import type { TodoRepository } from "../../domain/repositories/TodoRepository";

const baseTodo: Todo = {
  id: "todo-1",
  title: "Comprar pan integral",
  description: "Pasar por la panadería de la esquina",
  completed: false,
  userId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const makeFakeRepo = (seed: Todo[]): TodoRepository => ({
  getTodos: async (userId) => seed.filter((t) => t.userId === userId),
  findById: async (id, userId) =>
    seed.find((t) => t.id === id && t.userId === userId) ?? null,
  addTodo: async () => {},
  updateTodo: async () => {},
  deleteTodo: async () => {},
});

describe("GetTodoById", () => {
  test("returns the todo when it exists and belongs to the user", async () => {
    const result = await new GetTodoById(makeFakeRepo([baseTodo])).execute(
      "todo-1",
      "user-1",
    );

    expect(result?.id).toBe("todo-1");
  });

  test("returns null when the todo does not exist", async () => {
    const result = await new GetTodoById(makeFakeRepo([])).execute(
      "missing",
      "user-1",
    );

    expect(result).toBeNull();
  });

  test("returns null for a todo that belongs to another user (multi-tenant scoping)", async () => {
    const result = await new GetTodoById(
      makeFakeRepo([{ ...baseTodo, userId: "owner" }]),
    ).execute("todo-1", "intruder");

    expect(result).toBeNull();
  });
});
