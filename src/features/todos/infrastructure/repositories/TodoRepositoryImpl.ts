import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

const todos: Todo[] = [];
export const TodoRepositoryImpl: TodoRepository = {
  getTodos: async () => todos,
  findById: async (id) => todos.find((t) => t.id === id) ?? null,
  addTodo: async (todo) => {
    todos.push(todo);
  },
  updateTodo: async (todo) => {
    const index = todos.findIndex((t) => t.id === todo.id);
    todos[index] = todo;
  },
  deleteTodo: async (id) => {
    const index = todos.findIndex((t) => t.id === id);
    todos.splice(index, 1);
  },
};
