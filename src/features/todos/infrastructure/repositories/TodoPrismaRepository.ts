import { prisma } from "@/shared/infrastructure/database/prisma/prisma.client";

import type { TodoRepository } from "../../domain/repositories/TodoRepository";
import { toDomain, toPersistence } from "../mappers/todoMapper";

type TodoPrismaDatabase = Pick<typeof prisma, "todo">;

export const createTodoPrismaRepository = (
  db: TodoPrismaDatabase,
): TodoRepository => ({
  getTodos: async (userId) => {
    const rows = await db.todo.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    return rows.map(toDomain);
  },

  findById: async (id, userId) => {
    const row = await db.todo.findFirst({
      where: { id, userId },
    });

    return row ? toDomain(row) : null;
  },

  addTodo: async (todo) => {
    await db.todo.create({
      data: toPersistence(todo),
    });
  },

  updateTodo: async ({ id, userId, title, description, completed }) => {
    await db.todo.updateMany({
      where: { id, userId },
      data: {
        title,
        description,
        completed,
        updatedAt: new Date(),
      },
    });
  },

  deleteTodo: async (id, userId) => {
    await db.todo.deleteMany({
      where: { id, userId },
    });
  },
});

export const TodoPrismaRepository = createTodoPrismaRepository(prisma);
