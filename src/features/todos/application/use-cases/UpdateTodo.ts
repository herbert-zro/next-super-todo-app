import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

export class UpdateTodo {
  constructor(private readonly todoRepository: TodoRepository) {}

  async execute(todo: Todo): Promise<void> {
    const existing = await this.todoRepository.findById(todo.id);
    if (!existing) {
      throw new Error(`Todo with id ${todo.id} not found`);
    }
    await this.todoRepository.updateTodo(todo);
  }
}
