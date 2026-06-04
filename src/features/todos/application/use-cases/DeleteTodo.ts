import { Todo } from "../../domain/entities/Todo";
import { TodoNotFoundError } from "../../domain/errors/TodoNotFoundError";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

export class DeleteTodo {
  constructor(private readonly todoRepository: TodoRepository) {}

  async execute(id: Todo["id"], userId: Todo["userId"]): Promise<void> {
    const existing = await this.todoRepository.findById(id, userId);
    if (!existing) {
      throw new TodoNotFoundError(id);
    }
    await this.todoRepository.deleteTodo(id, userId);
  }
}
