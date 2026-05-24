import { Todo } from "../domain/entities/Todo";

type Props = {
  todo: Todo;
};
const TodoItem: React.FC<Props> = ({ todo }) => {
  return (
    <div className="flex justify-between p-2 border-b">
      <span>{todo.title}</span>
      <input type="checkbox" checked={todo.completed} readOnly />
    </div>
  );
};
export default TodoItem;
