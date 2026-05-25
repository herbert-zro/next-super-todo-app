import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { GetTodos } from "@/features/todos/application/use-cases/GetTodos";
import { TodoPrismaRepository } from "@/features/todos/infrastructure/repositories/TodoPrismaRepository";
import {
  addTodoAction,
  toggleTodoAction,
} from "@/features/todos/actions/todos.actions";
import { logoutAction } from "@/features/users/actions/auth.actions";
import TodoInput from "@/features/todos/components/TodoInput";
import TodoItem from "@/features/todos/components/TodoItem";
import { Button } from "@/shared/components/ui/button";

const TodosPage = async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const todos = await new GetTodos(TodoPrismaRepository).execute(
    session.user.id,
  );
  const remaining = todos.filter((t) => !t.completed).length;

  return (
    <main className="min-h-dvh bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Todo List
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Signed in as {session.user.email}
            </p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </header>

        <div className="mb-6">
          <TodoInput onAdd={addTodoAction} />
        </div>

        <ul className="divide-y divide-border rounded-lg border bg-card text-card-foreground shadow-sm">
          {todos.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              No todos yet. Add one above to get started.
            </li>
          ) : (
            todos.map((todo) => (
              <li key={todo.id}>
                <TodoItem todo={todo} onToggle={toggleTodoAction} />
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
