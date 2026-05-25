import type {
  CredentialsModel,
  UserModel,
} from "@/shared/generated/prisma/models";

import type { User } from "../../domain/entities/User";
import type { UserWithPassword } from "../../domain/entities/UserWithPassword";

type UserRow = UserModel;
type UserRowWithCredentials = UserModel & { credentials: CredentialsModel };

export const toDomain = (row: UserRow): User => ({
  id: row.id,
  name: row.name ?? "",
  email: row.email,
  emailVerified: row.emailVerified ? row.emailVerified.toISOString() : null,
  avatar: row.avatar ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toDomainWithPassword = (
  row: UserRowWithCredentials,
): UserWithPassword => ({
  ...toDomain(row),
  hashedPassword: row.credentials.hashedPassword,
});

export const toPersistence = (user: User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
  avatar: user.avatar,
  createdAt: new Date(user.createdAt),
  updatedAt: new Date(user.updatedAt),
});
