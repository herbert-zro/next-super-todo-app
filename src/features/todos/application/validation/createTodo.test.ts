import { describe, expect, test } from "@jest/globals";

import { createTodo } from "./createTodo";
import { TodoValidationError } from "../../domain/errors/TodoValidationError";
import type { Todo } from "../../domain/entities/Todo";

const baseTodo: Todo = {
  id: "id-1",
  title: "Comprar pan integral",
  description: "Pasar por la panadería de la esquina",
  completed: false,
  userId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("createTodo (validation + normalization)", () => {
  test("trims title and description, keeping the rest of the todo intact", () => {
    // Arrange
    const input: Todo = {
      ...baseTodo,
      title: "   Comprar pan integral   ",
      description: "   Pasar por la panadería   ",
    };

    // Act
    const result = createTodo(input);

    // Assert
    expect(result.title).toBe("Comprar pan integral");
    expect(result.description).toBe("Pasar por la panadería");
    expect(result.id).toBe("id-1");
    expect(result.userId).toBe("user-1");
    expect(result.completed).toBe(false);
    expect(result.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  test("accepts title and description of exactly 8 characters (lower boundary)", () => {
    const result = createTodo({
      ...baseTodo,
      title: "12345678",
      description: "12345678",
    });

    expect(result.title).toBe("12345678");
    expect(result.description).toBe("12345678");
  });

  test("throws TodoValidationError when title is shorter than 8 characters", () => {
    expect(() => createTodo({ ...baseTodo, title: "corto" })).toThrow(
      TodoValidationError,
    );
  });

  test("rejects a whitespace-only title (trim runs before the min check)", () => {
    expect(() => createTodo({ ...baseTodo, title: "          " })).toThrow(
      TodoValidationError,
    );
  });

  test("collects field errors for title and description at the same time", () => {
    // Arrange
    let captured: TodoValidationError | undefined;

    // Act
    try {
      createTodo({ ...baseTodo, title: "a", description: "b" });
    } catch (error) {
      captured = error as TodoValidationError;
    }

    // Assert
    expect(captured).toBeInstanceOf(TodoValidationError);
    expect(captured?.fieldErrors.title).toBeDefined();
    expect(captured?.fieldErrors.description).toBeDefined();
  });
});
