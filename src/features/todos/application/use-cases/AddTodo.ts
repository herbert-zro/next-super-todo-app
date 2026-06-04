import { TodoRepository } from "../../domain/repositories/TodoRepository";
import { createTodo } from "../validation/createTodo";

/**
 * Minimal input a caller provides to create a todo. The use case owns the rest
 * of the entity (id, completed, timestamps) so every composition root builds a
 * todo the same way.
 */
export type NewTodoInput = {
  title: string;
  description: string;
  userId: string;
};

export class AddTodo {
  constructor(private readonly todoRepository: TodoRepository) {}

  async execute(input: NewTodoInput): Promise<void> {
    const now = new Date().toISOString();
    const todo = createTodo({
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description,
      completed: false,
      userId: input.userId,
      createdAt: now,
      updatedAt: now,
    });

    await this.todoRepository.addTodo(todo);
  }
}
