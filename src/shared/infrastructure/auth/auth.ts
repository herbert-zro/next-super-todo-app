import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { bcryptHasher } from "@/features/users/infrastructure/hashing/bcryptHasher";
import { UserPrismaRepository } from "@/features/users/infrastructure/repositories/UserPrismaRepository";
import { VerifyCredentials } from "@/features/users/application/use-cases/VerifyCredentials";
import { loginFormSchema } from "@/features/users/application/schemas/loginFormSchema";

import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (raw) => {
        const parsed = loginFormSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await new VerifyCredentials(
          UserPrismaRepository,
          bcryptHasher,
        ).execute(parsed.data);

        if (!user) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
        };
      },
    }),
  ],
});
