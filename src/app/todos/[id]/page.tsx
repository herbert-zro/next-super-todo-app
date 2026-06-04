import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/auth";
import { GetTodoById } from "@/features/todos/application/use-cases/GetTodoById";
import { TodoPrismaRepository } from "@/features/todos/infrastructure/repositories/TodoPrismaRepository";
import { updateTodoAction } from "@/features/todos/actions/todos.actions";
import TodoEditForm from "@/features/todos/components/TodoEditForm";
import { Button } from "@/shared/components/ui/button";

const TodoDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const todo = await new GetTodoById(TodoPrismaRepository).execute(
    id,
    session.user.id,
  );
  if (!todo) notFound();

  return (
    <main className="min-h-dvh bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link href="/todos">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>

        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">
          Edit todo
        </h1>

        <TodoEditForm
          todoId={todo.id}
          defaultValues={{ title: todo.title, description: todo.description }}
          onUpdate={updateTodoAction}
        />
      </div>
    </main>
  );
};
export default TodoDetailPage;
