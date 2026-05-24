"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";

type Props = {
  onAdd: (title: string, description: string) => Promise<void>;
};

const TodoInput: React.FC<Props> = ({ onAdd }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    startTransition(async () => {
      await onAdd(trimmedTitle, description.trim());
      setTitle("");
      setDescription("");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title..."
        aria-label="Task title"
        disabled={isPending}
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        aria-label="Task description"
        rows={3}
        disabled={isPending}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={!title.trim() || isPending}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
    </form>
  );
};
export default TodoInput;
