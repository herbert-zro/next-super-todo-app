export class UserValidationError<TField extends string = string> extends Error {
  constructor(public readonly fieldErrors: Partial<Record<TField, string>>) {
    super("User validation failed");
    this.name = "UserValidationError";
  }
}
