"use client";

import { useEffect, useState } from "react";
import { Todo } from "@/features/todos/domain/entities/Todo";
import TodoItem from "@/features/todos/components/TodoItem";
const TodosPage = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  useEffect(() => {
    fetch("/api/todos")
      .then((res) => res.json())
      .then(setTodos);
  }, []);
  return (
    <div>
      <h1 className="text-2xl">Todo List</h1>
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  );
};
export default TodosPage;
