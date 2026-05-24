"use client";

import { useState } from "react";
import { Todo } from "@/features/todos/domain/entities/Todo";
import TodoInput from "@/features/todos/components/TodoInput";
import TodoItem from "@/features/todos/components/TodoItem";

const TodosPage = () => {
  const [todos, setTodos] = useState<Todo[]>([]);

  const handleAdd = (title: string) => {
    setTodos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title, completed: false },
    ]);
  };

  const handleToggle = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const remaining = todos.filter((t) => !t.completed).length;

  return (
    <main className="min-h-dvh bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Todo List
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your tasks in one place.
          </p>
        </header>

        <div className="mb-6">
          <TodoInput onAdd={handleAdd} />
        </div>

        <ul className="divide-y divide-border rounded-lg border bg-card text-card-foreground shadow-sm">
          {todos.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              No todos yet. Add one above to get started.
            </li>
          ) : (
            todos.map((todo) => (
              <li key={todo.id}>
                <TodoItem todo={todo} onToggle={handleToggle} />
              </li>
            ))
          )}
        </ul>

        {todos.length > 0 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {remaining} of {todos.length} remaining
          </p>
        )}
      </div>
    </main>
  );
};
export default TodosPage;
