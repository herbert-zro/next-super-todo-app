export class EmailAlreadyTakenError extends Error {
  constructor(public readonly email: string) {
    super(`Email ${email} is already taken`);
    this.name = "EmailAlreadyTakenError";
  }
}
