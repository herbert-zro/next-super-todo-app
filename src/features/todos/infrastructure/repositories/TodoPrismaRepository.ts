import { prisma } from "@/shared/infrastructure/database/prisma/prisma.client";

import type { TodoRepository } from "../../domain/repositories/TodoRepository";
import { toDomain, toPersistence } from "../mappers/todoMapper";

type TodoPrismaDatabase = Pick<typeof prisma, "todo">;

export const createTodoPrismaRepository = (
  db: TodoPrismaDatabase,
): TodoRepository => ({
  getTodos: async () => {
    const rows = await db.todo.findMany({
      orderBy: {
        createdAt: "asc",
      },
    });

    return rows.map(toDomain);
  },

  findById: async (id) => {
    const row = await db.todo.findUnique({
      where: {
        id,
      },
    });

    return row ? toDomain(row) : null;
  },

  addTodo: async (todo) => {
    await db.todo.create({
      data: toPersistence(todo),
    });
  },

  updateTodo: async ({ id, title, description, completed }) => {
    await db.todo.updateMany({
      where: {
        id,
      },
      data: {
        title,
        description,
        completed,
        updatedAt: new Date(),
      },
    });
  },

  deleteTodo: async (id) => {
    await db.todo.deleteMany({
      where: {
        id,
      },
    });
  },
});

export const TodoPrismaRepository = createTodoPrismaRepository(prisma);
