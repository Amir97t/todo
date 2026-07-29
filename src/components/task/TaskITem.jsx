import Button from "../ui/Button";
import { Card } from "../ui/Card";

export default function TaskItem({ task, taskActions }) {
  const { deleteTask, toggleTask } = taskActions;

  return (
    <Card className="flex items-center justify-between p-5">
      <div className="flex gap-4">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => toggleTask(task.id)}
        />

        <div>
          <h3 className="font-semibold">{task.title}</h3>

          <p className="text-sm text-zinc-400">{task.description}</p>
        </div>
      </div>

      <Button
        className="bg-red-600 hover:bg-red-500"
        onClick={() => deleteTask(task.id)}
      >
        Delete
      </Button>
    </Card>
  );
}
