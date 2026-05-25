import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

export class ToggleTodoCompletion {
  constructor(private readonly todoRepository: TodoRepository) {}

  async execute(
    id: Todo["id"],
    userId: Todo["userId"],
  ): Promise<void> {
    const existing = await this.todoRepository.findById(id, userId);
    if (!existing) {
      throw new Error(`Todo with id ${id} not found`);
    }
    await this.todoRepository.updateTodo({
      ...existing,
      completed: !existing.completed,
      updatedAt: new Date().toISOString(),
    });
  }
}
