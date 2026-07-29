import { useState } from "react";
import AddTaskCard from "../components/task/AddTaskCard";
import TaskList from "../components/task/TaskList";
import Navbar from "../components/layout/Navbar";
import useTaskFilter from "../hooks/useTaskFilter";
import SearchBar from "../components/task/SearchBar";
import TaskCounter from "../components/task/TaskCounter";
import FilterBar from "../components/task/FIlterBar";
import EmptyState from "../components/common/EmptyState";

export default function Home({ tasks, taskActions }) {
  const { addTask} = taskActions;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("newest");
  const activeTasks = useTaskFilter({
    tasks,
    search,
    filter,
    completed: false,
  });

  const hasActiveTasks = tasks.some((task) => !task.completed);

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-4xl">
        <Navbar />

        <h1 className="mb-2 text-center text-4xl font-bold">Todo List</h1>
        <p className="mb-8 text-center text-zinc-400">
          Focus on your active tasks.
        </p>

        <AddTaskCard onAddTask={addTask} />

        <div className="mt-8">
          <SearchBar value={search} onChange={setSearch} />
          <div className="mb-4 flex items-center justify-between gap-4">
            <TaskCounter total={activeTasks.length} label="Active" />
            <FilterBar filter={filter} onChange={setFilter} />
          </div>

          {activeTasks.length === 0 ? (
            <EmptyState
              title={hasActiveTasks ? "No matching tasks" : "No active tasks"}
              description={
                hasActiveTasks
                  ? "Try another search keyword."
                  : "Create your first task."
              }
            />
          ) : (
            <TaskList
              title="Active Tasks"
              tasks={activeTasks}
              taskActions={taskActions}
            />
          )}
        </div>
      </div>
    </main>
  );
}
