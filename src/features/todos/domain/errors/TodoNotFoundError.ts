export class TodoNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Todo with id ${id} not found`);
    this.name = "TodoNotFoundError";
  }
}
