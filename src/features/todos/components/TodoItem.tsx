"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

import { Checkbox } from "@/shared/components/ui/checkbox";
import { Button } from "@/shared/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import { Todo } from "../domain/entities/Todo";

type Props = {
  todo: Todo;
  onToggle: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const TodoItem: React.FC<Props> = ({ todo, onToggle, onDelete }) => {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(() => onToggle(todo.id));
  };

  const handleDelete = () => {
    startTransition(() => onDelete(todo.id));
  };

  return (
    <div
      className={
        isPending
          ? "flex items-start gap-2 px-4 py-3 opacity-60 transition-colors"
          : "flex items-start gap-2 px-4 py-3 transition-colors hover:bg-accent/50"
      }
    >
      <label
        htmlFor={`todo-${todo.id}`}
        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3"
      >
        <Checkbox
          id={`todo-${todo.id}`}
          checked={todo.completed}
          onCheckedChange={handleToggle}
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

      <div className="flex shrink-0 items-center gap-1">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Edit todo">
          <Link href={`/todos/${todo.id}`}>
            <Pencil className="size-4" />
          </Link>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete todo"
              disabled={isPending}
            >
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this todo?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
export default TodoItem;
