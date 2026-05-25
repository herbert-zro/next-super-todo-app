export class TodoValidationError<TField extends string = string> extends Error {
  constructor(
    public readonly fieldErrors: Partial<Record<TField, string>>,
  ) {
    super("Todo validation failed");
    this.name = "TodoValidationError";
  }
}
