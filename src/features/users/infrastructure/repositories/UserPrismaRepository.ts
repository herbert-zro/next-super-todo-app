import { prisma } from "@/shared/infrastructure/database/prisma/prisma.client";

import type { UserRepository } from "../../domain/repositories/UserRepository";
import {
  toDomain,
  toDomainWithPassword,
  toPersistence,
} from "../mappers/userMapper";

type UserPrismaDatabase = Pick<typeof prisma, "user">;

export const createUserPrismaRepository = (
  db: UserPrismaDatabase,
): UserRepository => ({
  findById: async (id) => {
    const row = await db.user.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  },

  findByEmail: async (email) => {
    const row = await db.user.findUnique({ where: { email } });
    return row ? toDomain(row) : null;
  },

  findByEmailWithPassword: async (email) => {
    const row = await db.user.findUnique({
      where: { email },
      include: { credentials: true },
    });
    if (!row || !row.credentials) return null;
    return toDomainWithPassword({ ...row, credentials: row.credentials });
  },

  createWithCredentials: async ({ user, hashedPassword }) => {
    const created = await db.user.create({
      data: {
        ...toPersistence(user),
        credentials: {
          create: {
            hashedPassword,
          },
        },
      },
    });
    return toDomain(created);
  },
});

export const UserPrismaRepository = createUserPrismaRepository(prisma);
