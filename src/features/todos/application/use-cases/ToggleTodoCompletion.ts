import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

export class ToggleTodoCompletion {
  constructor(private readonly todoRepository: TodoRepository) {}

  async execute(id: Todo["id"]): Promise<void> {
    const existing = await this.todoRepository.findById(id);
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
