import { describe, expect, test } from "@jest/globals";

import { RegisterUser } from "./RegisterUser";
import { EmailAlreadyTakenError } from "../../domain/errors/EmailAlreadyTakenError";
import { UserValidationError } from "../../domain/errors/UserValidationError";
import type { User } from "../../domain/entities/User";
import type { UserRepository } from "../../domain/repositories/UserRepository";
import type { PasswordHasher } from "../../domain/services/PasswordHasher";

const existingUser: User = {
  id: "user-existing",
  name: "Otro",
  email: "herbert@example.com",
  emailVerified: null,
  avatar: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const makeFakeUserRepository = (existing: User | null) => {
  const created: { user: User; hashedPassword: string }[] = [];
  const repo: UserRepository = {
    findById: async () => null,
    findByEmail: async () => existing,
    findByEmailWithPassword: async () => null,
    createWithCredentials: async (input) => {
      created.push(input);
      return input.user;
    },
  };
  return { repo, created };
};

const fakeHasher: PasswordHasher = {
  hash: async (plain) => `hashed:${plain}`,
  verify: async () => true,
};

const validInput = {
  name: "Herbert",
  email: "herbert@example.com",
  password: "supersecret",
};

describe("RegisterUser", () => {
  test("hashes the password before creating the user and never stores it in plain text", async () => {
    const { repo, created } = makeFakeUserRepository(null);

    await new RegisterUser(repo, fakeHasher).execute(validInput);

    expect(created).toHaveLength(1);
    expect(created[0].hashedPassword).toBe("hashed:supersecret");
    expect(created[0].hashedPassword).not.toBe("supersecret");
    expect(created[0].user).not.toHaveProperty("password");
  });

  test("throws EmailAlreadyTakenError and does not create the user when the email exists", async () => {
    const { repo, created } = makeFakeUserRepository(existingUser);

    await expect(
      new RegisterUser(repo, fakeHasher).execute(validInput),
    ).rejects.toBeInstanceOf(EmailAlreadyTakenError);

    expect(created).toHaveLength(0);
  });

  test("throws UserValidationError when the password is shorter than 8 characters", async () => {
    const { repo, created } = makeFakeUserRepository(null);

    await expect(
      new RegisterUser(repo, fakeHasher).execute({
        ...validInput,
        password: "short",
      }),
    ).rejects.toBeInstanceOf(UserValidationError);

    expect(created).toHaveLength(0);
  });

  test("normalizes the email to lowercase before persisting", async () => {
    const { repo, created } = makeFakeUserRepository(null);

    await new RegisterUser(repo, fakeHasher).execute({
      ...validInput,
      email: "  HERBERT@EXAMPLE.COM  ",
    });

    expect(created[0].user.email).toBe("herbert@example.com");
  });

  test("generates an id and equal ISO timestamps for the new user", async () => {
    const { repo, created } = makeFakeUserRepository(null);

    await new RegisterUser(repo, fakeHasher).execute(validInput);

    const user = created[0].user;
    expect(user.id).toEqual(expect.any(String));
    expect(user.id.length).toBeGreaterThan(0);
    expect(user.createdAt).toBe(user.updatedAt);
    expect(new Date(user.createdAt).toISOString()).toBe(user.createdAt);
  });
});
