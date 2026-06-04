import { describe, expect, jest, test } from "@jest/globals";

// Replace the server-only Prisma singleton module so importing the adapter does
// not construct a real client (no "server-only" guard, no DATABASE_URL needed).
jest.mock("@/shared/infrastructure/database/prisma/prisma.client", () => ({
  prisma: { todo: {} },
}));

import { createTodoPrismaRepository } from "./TodoPrismaRepository";
import type { Todo } from "../../domain/entities/Todo";

type RepoDb = Parameters<typeof createTodoPrismaRepository>[0];

const todo: Todo = {
  id: "todo-1",
  title: "Comprar pan integral",
  description: "Pasar por la panadería de la esquina",
  completed: true,
  userId: "user-1",
  // Deliberately stale: the DB (@updatedAt) must own this on update.
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
};

type UpdateManyArgs = {
  where: { id: string; userId: string };
  data: Record<string, unknown>;
};

const makeFakeDb = () => {
  const updateMany = jest.fn<(args: UpdateManyArgs) => Promise<{ count: number }>>(
    async () => ({ count: 1 }),
  );
  const db = { todo: { updateMany } };
  return { db: db as unknown as RepoDb, updateMany };
};

describe("TodoPrismaRepository.updateTodo", () => {
  test("scopes the update to (id, userId) and persists title/description/completed", async () => {
    const { db, updateMany } = makeFakeDb();

    await createTodoPrismaRepository(db).updateTodo(todo);

    expect(updateMany).toHaveBeenCalledTimes(1);
    const arg = updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "todo-1", userId: "user-1" });
    expect(arg.data).toMatchObject({
      title: "Comprar pan integral",
      description: "Pasar por la panadería de la esquina",
      completed: true,
    });
  });

  test("delegates updatedAt to the database (@updatedAt) instead of overwriting it in the update data", async () => {
    const { db, updateMany } = makeFakeDb();

    await createTodoPrismaRepository(db).updateTodo(todo);

    const arg = updateMany.mock.calls[0][0];
    expect(arg.data).not.toHaveProperty("updatedAt");
  });
});
