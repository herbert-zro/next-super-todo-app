import { User } from "../entities/User";
import { UserWithPassword } from "../entities/UserWithPassword";

export interface UserRepository {
  findById: (id: User["id"]) => Promise<User | null>;
  findByEmail: (email: User["email"]) => Promise<User | null>;
  findByEmailWithPassword: (
    email: User["email"],
  ) => Promise<UserWithPassword | null>;
  createWithCredentials: (input: {
    user: User;
    hashedPassword: string;
  }) => Promise<User>;
}
