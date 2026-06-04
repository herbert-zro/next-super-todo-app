import { describe, expect, test } from "@jest/globals";

import { VerifyCredentials } from "./VerifyCredentials";
import type { UserWithPassword } from "../../domain/entities/UserWithPassword";
import type { UserRepository } from "../../domain/repositories/UserRepository";
import type { PasswordHasher } from "../../domain/services/PasswordHasher";

const userRow: UserWithPassword = {
  id: "user-1",
  name: "Herbert",
  email: "herbert@example.com",
  emailVerified: null,
  avatar: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  hashedPassword: "hashed:secret123",
};

const makeFakeUserRepository = (row: UserWithPassword | null) => {
  const lookups: string[] = [];
  const repo: UserRepository = {
    findById: async () => null,
    findByEmail: async () => null,
    findByEmailWithPassword: async (email) => {
      lookups.push(email);
      return row;
    },
    createWithCredentials: async ({ user }) => user,
  };
  return { repo, lookups };
};

const makeFakeHasher = (verifyResult: boolean): PasswordHasher => ({
  hash: async (plain) => `hashed:${plain}`,
  verify: async () => verifyResult,
});

describe("VerifyCredentials", () => {
  test("returns the user when email and password are correct", async () => {
    const { repo } = makeFakeUserRepository(userRow);

    const result = await new VerifyCredentials(repo, makeFakeHasher(true)).execute(
      { email: "herbert@example.com", password: "secret123" },
    );

    expect(result?.id).toBe("user-1");
    expect(result?.email).toBe("herbert@example.com");
  });

  test("never includes hashedPassword in the returned user", async () => {
    const { repo } = makeFakeUserRepository(userRow);

    const result = await new VerifyCredentials(repo, makeFakeHasher(true)).execute(
      { email: "herbert@example.com", password: "secret123" },
    );

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("hashedPassword");
  });

  test("returns null when the user does not exist", async () => {
    const { repo } = makeFakeUserRepository(null);

    const result = await new VerifyCredentials(repo, makeFakeHasher(true)).execute(
      { email: "ghost@example.com", password: "whatever" },
    );

    expect(result).toBeNull();
  });

  test("returns null when the password is incorrect", async () => {
    const { repo } = makeFakeUserRepository(userRow);

    const result = await new VerifyCredentials(repo, makeFakeHasher(false)).execute(
      { email: "herbert@example.com", password: "wrong-password" },
    );

    expect(result).toBeNull();
  });

  test("normalizes the email (trim + lowercase) before looking it up", async () => {
    const { repo, lookups } = makeFakeUserRepository(userRow);

    await new VerifyCredentials(repo, makeFakeHasher(true)).execute({
      email: "  HERBERT@EXAMPLE.COM  ",
      password: "secret123",
    });

    expect(lookups[0]).toBe("herbert@example.com");
  });
});
