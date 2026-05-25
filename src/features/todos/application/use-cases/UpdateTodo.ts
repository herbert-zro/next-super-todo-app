import { Todo } from "../../domain/entities/Todo";
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
      throw new Error(`Todo with id ${input.id} not found`);
    }
    const updated = createTodo({
      ...existing,
      title: input.title,
      description: input.description,
      updatedAt: new Date().toISOString(),
    });
    await this.todoRepository.updateTodo(updated);
  }
}
