import { User } from "./User";

export interface UserWithPassword extends User {
  hashedPassword: string;
}
