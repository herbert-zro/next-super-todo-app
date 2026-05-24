"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

type Props = {
  onAdd: (title: string) => void;
};

const TodoInput: React.FC<Props> = ({ onAdd }) => {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a new task..."
        aria-label="New task title"
        className="flex-1"
      />
      <Button type="submit" disabled={!value.trim()}>
        <Plus className="size-4" />
        Add
      </Button>
    </form>
  );
};
export default TodoInput;
