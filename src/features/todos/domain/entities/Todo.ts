export interface Todo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string; // Almacenar como cadena ISO para serialización de Redux
  updatedAt: string; // Almacenar como cadena ISO para serialización de Redux
}

const MIN_LENGTH = 8;

export function createTodo(input: Todo): Todo {
  const title = input.title.trim();
  const description = input.description.trim();

  if (title.length < MIN_LENGTH) {
    throw new Error(`Title must be at least ${MIN_LENGTH} characters`);
  }
  if (description.length < MIN_LENGTH) {
    throw new Error(`Description must be at least ${MIN_LENGTH} characters`);
  }

  return { ...input, title, description };
}
