import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { TodoPrismaRepository } from "@/features/todos/infrastructure/repositories/TodoPrismaRepository";
import { GetTodos } from "@/features/todos/application/use-cases/GetTodos";
import { AddTodo } from "@/features/todos/application/use-cases/AddTodo";

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

  const body = await req.json();
  await new AddTodo(TodoPrismaRepository).execute({
    ...body,
    userId: session.user.id,
  });
  return NextResponse.json({ message: "Todo added" });
}
