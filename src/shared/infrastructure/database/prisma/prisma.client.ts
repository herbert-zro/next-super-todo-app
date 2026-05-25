import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/shared/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });
}

type PrismaClientSingleton = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientSingleton;
};

const EXPECTED_MODELS = ["todo", "user", "credentials"] as const;

const isFresh = (client: PrismaClientSingleton | undefined) =>
  !!client &&
  EXPECTED_MODELS.every(
    (m) => (client as unknown as Record<string, unknown>)[m] !== undefined,
  );

export const prisma = isFresh(globalForPrisma.prisma)
  ? (globalForPrisma.prisma as PrismaClientSingleton)
  : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
