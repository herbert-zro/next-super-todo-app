import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

export class AddTodo {
  constructor(private readonly todoRepository: TodoRepository) {}

  execute(todo: Todo): Promise<void> {
    return this.todoRepository.addTodo(todo);
  }
}
