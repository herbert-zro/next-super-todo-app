import { Todo } from "../../domain/entities/Todo";
import { TodoNotFoundError } from "../../domain/errors/TodoNotFoundError";
import { TodoRepository } from "../../domain/repositories/TodoRepository";
import { createTodo } from "../validation/createTodo";

type UpdateTodoInput = Pick<Todo, "id" | "title" | "description">;

export class UpdateTodo {
  constructor(private readonly todoRepository: TodoRepository) {}

  async execute(
    input: UpdateTodoInput,
    userId: Todo["userId"],
  ): Promise<void> {
    const existing = await this.todoRepository.findById(input.id, userId);
    if (!existing) {
      throw new TodoNotFoundError(input.id);
    }
    // `updatedAt` is owned by the database (@updatedAt), so we don't set it here.
    const updated = createTodo({
      ...existing,
      title: input.title,
      description: input.description,
    });
    await this.todoRepository.updateTodo(updated);
  }
}
