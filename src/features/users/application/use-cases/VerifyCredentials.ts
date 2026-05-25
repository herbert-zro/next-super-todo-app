import { User } from "../../domain/entities/User";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { PasswordHasher } from "../../domain/services/PasswordHasher";

type Input = {
  email: string;
  password: string;
};

export class VerifyCredentials {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute({ email, password }: Input): Promise<User | null> {
    const row = await this.userRepository.findByEmailWithPassword(
      email.trim().toLowerCase(),
    );
    if (!row) return null;

    const ok = await this.passwordHasher.verify(password, row.hashedPassword);
    if (!ok) return null;

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: row.emailVerified,
      avatar: row.avatar,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
