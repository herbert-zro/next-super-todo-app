import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

export class FindById {
  constructor(private readonly todoRepository: TodoRepository) {}

  execute(id: Todo["id"]): Promise<Todo | null> {
    return this.todoRepository.findById(id);
  }
}
