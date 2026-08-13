import { useState } from "react";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../ui/Card";

export default function AddTaskCard({ onAddTask }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit() {
    // Let the parent decide which list the task belongs to.
    // AddTaskCard only manages the form itself.
    if (!title.trim()) return;

    onAddTask(title, description);

    setTitle("");
    setDescription("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Task</CardTitle>
        <CardDescription>Add a new task.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Input
          placeholder="Task title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Textarea
          placeholder="Description..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </CardContent>

      <CardFooter>
        <Button onClick={handleSubmit}>Add Task</Button>
      </CardFooter>
    </Card>
  );
}
