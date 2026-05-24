import { NextResponse } from "next/server";
import { TodoPrismaRepository } from "@/features/todos/infrastructure/repositories/TodoPrismaRepository";
import { GetTodos } from "@/features/todos/application/use-cases/GetTodos";
import { AddTodo } from "@/features/todos/application/use-cases/AddTodo";

export async function GET() {
  const todos = await new GetTodos(TodoPrismaRepository).execute();
  return NextResponse.json(todos);
}

export async function POST(req: Request) {
  const todo = await req.json();
  await new AddTodo(TodoPrismaRepository).execute(todo);
  return NextResponse.json({ message: "Todo added" });
}
