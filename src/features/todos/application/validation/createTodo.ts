import { Todo } from "../../domain/entities/Todo";
import { TodoValidationError } from "../../domain/errors/TodoValidationError";
import { todoFormSchema, type TodoField } from "../schemas/todoFormSchema";

export function createTodo(input: Todo): Todo {
  const parsed = todoFormSchema.safeParse({
    title: input.title,
    description: input.description,
  });

  if (!parsed.success) {
    const fieldErrors: Partial<Record<TodoField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as TodoField;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    throw new TodoValidationError<TodoField>(fieldErrors);
  }

  return { ...input, ...parsed.data };
}
