import { prisma } from "@/shared/infrastructure/database/prisma/prisma.client";
import { Todo } from "../../domain/entities/Todo";
import { TodoRepository } from "../../domain/repositories/TodoRepository";

type TodoRow = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const toDomain = (row: TodoRow): Todo => ({
  id: row.id,
  title: row.title,
  description: row.description,
  completed: row.completed,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const TodoPrismaRepository: TodoRepository = {
  getTodos: async () => {
    const rows = await prisma.todo.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toDomain);
  },

  findById: async (id) => {
    const row = await prisma.todo.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  },

  addTodo: async (todo) => {
    await prisma.todo.create({
      data: {
        id: todo.id,
        title: todo.title,
        description: todo.description,
        completed: todo.completed,
        createdAt: new Date(todo.createdAt),
        updatedAt: new Date(todo.updatedAt),
      },
    });
  },

  updateTodo: async ({ id, title, description, completed }) => {
    await prisma.todo.update({
      where: { id },
      data: { title, description, completed },
    });
  },

  deleteTodo: async (id) => {
    await prisma.todo.delete({ where: { id } });
  },
};
