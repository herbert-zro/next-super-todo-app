import { Todo } from "../entities/Todo";

export interface TodoRepository {
  getTodos: (userId: Todo["userId"]) => Promise<Todo[]>;
  findById: (
    id: Todo["id"],
    userId: Todo["userId"],
  ) => Promise<Todo | null>;
  addTodo: (todo: Todo) => Promise<void>;
  updateTodo: (todo: Todo) => Promise<void>;
  deleteTodo: (id: Todo["id"], userId: Todo["userId"]) => Promise<void>;
}
