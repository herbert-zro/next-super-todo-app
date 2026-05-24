"use client";

import { useTransition } from "react";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Todo } from "../domain/entities/Todo";

type Props = {
  todo: Todo;
  onToggle?: (id: string) => Promise<void>;
};

const TodoItem: React.FC<Props> = ({ todo, onToggle }) => {
  const [isPending, startTransition] = useTransition();

  const handleChange = () => {
    if (!onToggle) return;
    startTransition(() => onToggle(todo.id));
  };

  return (
    <label
      htmlFor={`todo-${todo.id}`}
      className={
        isPending
          ? "flex cursor-wait items-start gap-3 px-4 py-3 opacity-60 transition-colors"
          : "flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
      }
    >
      <Checkbox
        id={`todo-${todo.id}`}
        checked={todo.completed}
        onCheckedChange={handleChange}
        disabled={isPending}
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={
            todo.completed
              ? "text-sm text-muted-foreground line-through"
              : "text-sm text-foreground"
          }
        >
          {todo.title}
        </span>
        {todo.description && (
          <p
            className={
              todo.completed
                ? "whitespace-pre-wrap wrap-break-word text-xs text-muted-foreground/70 line-through"
                : "whitespace-pre-wrap wrap-break-word text-xs text-muted-foreground"
            }
          >
            {todo.description}
          </p>
        )}
      </div>
    </label>
  );
};
export default TodoItem;
