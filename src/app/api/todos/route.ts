import { NextResponse } from "next/server";
import { TodoRepositoryImpl } from "@/features/todos/infrastructure/repositories/TodoRepositoryImpl";
import { GetTodos } from "@/features/todos/application/use-cases/GetTodos";
import { AddTodo } from "@/features/todos/application/use-cases/AddTodo";

export async function GET() {
  const todos = await new GetTodos(TodoRepositoryImpl).execute();
  return NextResponse.json(todos);
}

export async function POST(req: Request) {
  const todo = await req.json();
  await new AddTodo(TodoRepositoryImpl).execute(todo);
  return NextResponse.json({ message: "Todo added" });
}
