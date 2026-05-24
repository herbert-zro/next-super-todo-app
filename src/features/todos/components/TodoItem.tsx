"use client";

import { Checkbox } from "@/shared/components/ui/checkbox";
import { Todo } from "../domain/entities/Todo";

type Props = {
  todo: Todo;
  onToggle?: (id: string) => void;
};

const TodoItem: React.FC<Props> = ({ todo, onToggle }) => {
  return (
    <label
      htmlFor={`todo-${todo.id}`}
      className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
    >
      <Checkbox
        id={`todo-${todo.id}`}
        checked={todo.completed}
        onCheckedChange={() => onToggle?.(todo.id)}
      />
      <span
        className={
          todo.completed
            ? "flex-1 text-sm text-muted-foreground line-through"
            : "flex-1 text-sm text-foreground"
        }
      >
        {todo.title}
      </span>
    </label>
  );
};
export default TodoItem;
