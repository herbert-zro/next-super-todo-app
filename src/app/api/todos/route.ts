import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { TodoPrismaRepository } from "@/features/todos/infrastructure/repositories/TodoPrismaRepository";
import { GetTodos } from "@/features/todos/application/use-cases/GetTodos";
import { AddTodo } from "@/features/todos/application/use-cases/AddTodo";
import { todoFormSchema } from "@/features/todos/application/schemas/todoFormSchema";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const todos = await new GetTodos(TodoPrismaRepository).execute(
    session.user.id,
  );
  return NextResponse.json(todos);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  // Validate at the HTTP boundary: never trust the raw body. Only title and
  // description come from the client; the use case generates id/completed/
  // timestamps and the userId is taken from the session, so the client cannot
  // inject those fields.
  const parsed = todoFormSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      if (!errors[field]) errors[field] = issue.message;
    }
    return NextResponse.json(
      { message: "Validation failed", errors },
      { status: 400 },
    );
  }

  await new AddTodo(TodoPrismaRepository).execute({
    title: parsed.data.title,
    description: parsed.data.description,
    userId: session.user.id,
  });

  return NextResponse.json({ message: "Todo added" }, { status: 201 });
}
