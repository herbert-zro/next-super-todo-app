import { describe, expect, test } from "@jest/globals";

import { ToggleTodoCompletion } from "./ToggleTodoCompletion";
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

const makeFakeRepo = (seed: Todo[]) => {
  const items = [...seed];
  const updates: Todo[] = [];
  const repo: TodoRepository = {
    getTodos: async (userId) => items.filter((t) => t.userId === userId),
    findById: async (id, userId) =>
      items.find((t) => t.id === id && t.userId === userId) ?? null,
    addTodo: async (t) => {
      items.push(t);
    },
    updateTodo: async (t) => {
      updates.push(t);
    },
    deleteTodo: async () => {},
  };
  return { repo, updates };
};

describe("ToggleTodoCompletion", () => {
  test("flips completed from false to true and persists it", async () => {
    const { repo, updates } = makeFakeRepo([{ ...baseTodo, completed: false }]);

    await new ToggleTodoCompletion(repo).execute("todo-1", "user-1");

    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("todo-1");
    expect(updates[0].completed).toBe(true);
  });

  test("flips completed from true to false", async () => {
    const { repo, updates } = makeFakeRepo([{ ...baseTodo, completed: true }]);

    await new ToggleTodoCompletion(repo).execute("todo-1", "user-1");

    expect(updates[0].completed).toBe(false);
  });

  test("throws when the todo does not exist", async () => {
    const { repo } = makeFakeRepo([]);

    await expect(
      new ToggleTodoCompletion(repo).execute("missing", "user-1"),
    ).rejects.toThrow();
  });

  test("does not toggle a todo that belongs to another user (multi-tenant scoping)", async () => {
    const { repo, updates } = makeFakeRepo([{ ...baseTodo, userId: "owner" }]);

    await expect(
      new ToggleTodoCompletion(repo).execute("todo-1", "intruder"),
    ).rejects.toThrow();
    expect(updates).toHaveLength(0);
  });
});
