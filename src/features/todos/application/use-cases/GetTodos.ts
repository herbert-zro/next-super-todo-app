import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

export class GetTodos {
  constructor(private readonly todoRepository: TodoRepository) {}

  execute(): Promise<Todo[]> {
    return this.todoRepository.getTodos();
  }
}
