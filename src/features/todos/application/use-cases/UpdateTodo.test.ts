import { describe, expect, test } from "@jest/globals";

import { UpdateTodo } from "./UpdateTodo";
import { TodoNotFoundError } from "../../domain/errors/TodoNotFoundError";
import { TodoValidationError } from "../../domain/errors/TodoValidationError";
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

describe("UpdateTodo", () => {
  test("updates title/description of an existing todo, preserving completed", async () => {
    const { repo, updates } = makeFakeRepo([{ ...baseTodo, completed: true }]);

    await new UpdateTodo(repo).execute(
      {
        id: "todo-1",
        title: "Comprar pan de centeno",
        description: "Mejor en la panadería nueva",
      },
      "user-1",
    );

    expect(updates).toHaveLength(1);
    expect(updates[0].title).toBe("Comprar pan de centeno");
    expect(updates[0].description).toBe("Mejor en la panadería nueva");
    expect(updates[0].completed).toBe(true);
    expect(updates[0].id).toBe("todo-1");
  });

  test("throws TodoNotFoundError when the todo does not exist", async () => {
    const { repo, updates } = makeFakeRepo([]);

    await expect(
      new UpdateTodo(repo).execute(
        { id: "missing", title: "Titulo valido", description: "Desc valida" },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(TodoNotFoundError);
    expect(updates).toHaveLength(0);
  });

  test("does not update a todo that belongs to another user (multi-tenant scoping)", async () => {
    const { repo, updates } = makeFakeRepo([{ ...baseTodo, userId: "owner" }]);

    await expect(
      new UpdateTodo(repo).execute(
        { id: "todo-1", title: "Titulo valido", description: "Desc valida" },
        "intruder",
      ),
    ).rejects.toBeInstanceOf(TodoNotFoundError);
    expect(updates).toHaveLength(0);
  });

  test("throws TodoValidationError and does not update when the title is too short", async () => {
    const { repo, updates } = makeFakeRepo([baseTodo]);

    await expect(
      new UpdateTodo(repo).execute(
        { id: "todo-1", title: "corto", description: "Descripción válida" },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(TodoValidationError);
    expect(updates).toHaveLength(0);
  });
});
