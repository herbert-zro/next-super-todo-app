"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import {
  todoFormSchema,
  type TodoFormValues,
} from "../application/schemas/todoFormSchema";
import type { AddTodoResult } from "../actions/todos.actions";

type Props = {
  onAdd: (title: string, description: string) => Promise<AddTodoResult>;
};

const TodoInput: React.FC<Props> = ({ onAdd }) => {
  const [isPending, startTransition] = useTransition();
  const form = useForm<TodoFormValues>({
    resolver: zodResolver(todoFormSchema),
    defaultValues: { title: "", description: "" },
    mode: "onSubmit",
  });

  const onSubmit = (data: TodoFormValues) => {
    startTransition(async () => {
      const result = await onAdd(data.title, data.description);
      if (result.ok) {
        form.reset();
        return;
      }
      if (result.errors.title) {
        form.setError("title", { message: result.errors.title });
      }
      if (result.errors.description) {
        form.setError("description", { message: result.errors.description });
      }
      if (result.errors.form) {
        form.setError("root", { message: result.errors.form });
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full flex-col gap-3"
        noValidate
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Task title</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Task title..."
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Task description</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Description"
                  rows={3}
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <p className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </form>
    </Form>
  );
};
export default TodoInput;
