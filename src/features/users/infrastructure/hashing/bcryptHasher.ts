import bcrypt from "bcryptjs";

import type { PasswordHasher } from "../../domain/services/PasswordHasher";

const COST = 10;

export const bcryptHasher: PasswordHasher = {
  hash: (plain) => bcrypt.hash(plain, COST),
  verify: (plain, hashed) => bcrypt.compare(plain, hashed),
};
