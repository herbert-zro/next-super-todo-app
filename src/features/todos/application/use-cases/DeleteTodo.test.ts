import { describe, expect, test } from "@jest/globals";

import { DeleteTodo } from "./DeleteTodo";
import { TodoNotFoundError } from "../../domain/errors/TodoNotFoundError";
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
  const deletes: { id: string; userId: string }[] = [];
  const repo: TodoRepository = {
    getTodos: async (userId) => items.filter((t) => t.userId === userId),
    findById: async (id, userId) =>
      items.find((t) => t.id === id && t.userId === userId) ?? null,
    addTodo: async (t) => {
      items.push(t);
    },
    updateTodo: async () => {},
    deleteTodo: async (id, userId) => {
      deletes.push({ id, userId });
    },
  };
  return { repo, deletes };
};

describe("DeleteTodo", () => {
  test("deletes an existing todo scoped to the user", async () => {
    const { repo, deletes } = makeFakeRepo([baseTodo]);

    await new DeleteTodo(repo).execute("todo-1", "user-1");

    expect(deletes).toEqual([{ id: "todo-1", userId: "user-1" }]);
  });

  test("throws TodoNotFoundError when the todo does not exist", async () => {
    const { repo, deletes } = makeFakeRepo([]);

    await expect(
      new DeleteTodo(repo).execute("missing", "user-1"),
    ).rejects.toBeInstanceOf(TodoNotFoundError);
    expect(deletes).toHaveLength(0);
  });

  test("does not delete a todo that belongs to another user (multi-tenant scoping)", async () => {
    const { repo, deletes } = makeFakeRepo([{ ...baseTodo, userId: "owner" }]);

    await expect(
      new DeleteTodo(repo).execute("todo-1", "intruder"),
    ).rejects.toBeInstanceOf(TodoNotFoundError);
    expect(deletes).toHaveLength(0);
  });
});
