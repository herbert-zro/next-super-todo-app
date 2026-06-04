"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";

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
import type { UpdateTodoResult } from "../actions/todos.actions";

type Props = {
  todoId: string;
  defaultValues: TodoFormValues;
  onUpdate: (input: {
    id: string;
    title: string;
    description: string;
  }) => Promise<UpdateTodoResult>;
};

const TodoEditForm: React.FC<Props> = ({ todoId, defaultValues, onUpdate }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<TodoFormValues>({
    resolver: zodResolver(todoFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const onSubmit = (data: TodoFormValues) => {
    startTransition(async () => {
      const result = await onUpdate({
        id: todoId,
        title: data.title,
        description: data.description,
      });
      if (result.ok) {
        router.push("/todos");
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
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} disabled={isPending} />
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
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} rows={4} disabled={isPending} />
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

        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" type="button" disabled={isPending}>
            <Link href="/todos">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            <Save className="size-4" />
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
};
export default TodoEditForm;
