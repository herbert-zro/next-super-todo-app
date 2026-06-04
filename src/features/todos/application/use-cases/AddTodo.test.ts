import { describe, expect, jest, test } from "@jest/globals";

import { AddTodo } from "./AddTodo";
import { TodoValidationError } from "../../domain/errors/TodoValidationError";
import type { Todo } from "../../domain/entities/Todo";
import type { TodoRepository } from "../../domain/repositories/TodoRepository";

const makeFakeTodoRepository = () => {
  const added: Todo[] = [];
  const repo: TodoRepository = {
    getTodos: async () => [],
    findById: async () => null,
    addTodo: async (todo) => {
      added.push(todo);
    },
    updateTodo: async () => {},
    deleteTodo: async () => {},
  };
  return { repo, added };
};

describe("AddTodo", () => {
  test("builds a complete todo (generated id, completed=false, equal ISO timestamps) and persists it", async () => {
    // Arrange
    const { repo, added } = makeFakeTodoRepository();

    // Act
    await new AddTodo(repo).execute({
      title: "Comprar pan integral",
      description: "Pasar por la panadería de la esquina",
      userId: "user-1",
    });

    // Assert
    expect(added).toHaveLength(1);
    const todo = added[0];
    expect(todo.title).toBe("Comprar pan integral");
    expect(todo.description).toBe("Pasar por la panadería de la esquina");
    expect(todo.userId).toBe("user-1");
    expect(todo.completed).toBe(false);
    expect(todo.id).toEqual(expect.any(String));
    expect(todo.id.length).toBeGreaterThan(0);
    // Timestamps are generated server-side, identical at creation, and valid ISO.
    expect(todo.createdAt).toBe(todo.updatedAt);
    expect(new Date(todo.createdAt).toISOString()).toBe(todo.createdAt);
  });

  test("trims title and description before persisting", async () => {
    const { repo, added } = makeFakeTodoRepository();

    await new AddTodo(repo).execute({
      title: "   Comprar pan integral   ",
      description: "   Pasar por la panadería   ",
      userId: "user-1",
    });

    expect(added[0].title).toBe("Comprar pan integral");
    expect(added[0].description).toBe("Pasar por la panadería");
  });

  test("throws TodoValidationError and does not persist when the title is too short", async () => {
    const { repo, added } = makeFakeTodoRepository();
    const addSpy = jest.spyOn(repo, "addTodo");

    await expect(
      new AddTodo(repo).execute({
        title: "corto",
        description: "Pasar por la panadería de la esquina",
        userId: "user-1",
      }),
    ).rejects.toBeInstanceOf(TodoValidationError);

    expect(addSpy).not.toHaveBeenCalled();
    expect(added).toHaveLength(0);
  });
});
