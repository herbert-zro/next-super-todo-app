import { User } from "../../domain/entities/User";
import { EmailAlreadyTakenError } from "../../domain/errors/EmailAlreadyTakenError";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { PasswordHasher } from "../../domain/services/PasswordHasher";
import { createUserRegistration } from "../validation/createUserRegistration";
import { RegisterFormValues } from "../schemas/registerFormSchema";

export class RegisterUser {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: RegisterFormValues): Promise<User> {
    const { name, email, password } = createUserRegistration(input);

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new EmailAlreadyTakenError(email);
    }

    const now = new Date().toISOString();
    const hashedPassword = await this.passwordHasher.hash(password);

    return this.userRepository.createWithCredentials({
      user: {
        id: crypto.randomUUID(),
        name,
        email,
        emailVerified: null,
        avatar: null,
        createdAt: now,
        updatedAt: now,
      },
      hashedPassword,
    });
  }
}
