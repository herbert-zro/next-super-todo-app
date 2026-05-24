import { Todo } from "../entities/Todo";

export interface TodoRepository {
  getTodos: () => Promise<Todo[]>;
  findById: (id: Todo["id"]) => Promise<Todo | null>;
  addTodo: (todo: Todo) => Promise<void>;
  updateTodo: (todo: Todo) => Promise<void>;
  deleteTodo: (id: Todo["id"]) => Promise<void>;
}
