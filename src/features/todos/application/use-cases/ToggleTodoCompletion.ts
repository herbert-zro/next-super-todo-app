import { Todo } from "../../domain/entities/Todo";
import { TodoNotFoundError } from "../../domain/errors/TodoNotFoundError";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

export class ToggleTodoCompletion {
  constructor(private readonly todoRepository: TodoRepository) {}

  async execute(
    id: Todo["id"],
    userId: Todo["userId"],
  ): Promise<void> {
    const existing = await this.todoRepository.findById(id, userId);
    if (!existing) {
      throw new TodoNotFoundError(id);
    }
    // `updatedAt` is owned by the database (@updatedAt), so we don't set it here.
    await this.todoRepository.updateTodo({
      ...existing,
      completed: !existing.completed,
    });
  }
}
