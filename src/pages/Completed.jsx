import { useState } from "react";
import Navbar from "../components/layout/Navbar";
import SearchBar from "../components/task/SearchBar";
import FilterBar from "../components/task/FilterBar";
import TaskCounter from "../components/task/TaskCounter";
import TaskList from "../components/task/TaskList";
import useTaskFilter from "../hooks/useTaskFilter";
import EmptyState from "../components/common/EmptyState";

export default function Completed({ tasks, taskActions }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("newest");

  const completedTasks = useTaskFilter({
    tasks,
    search,
    filter,
    completed: true,
  });

  const hasCompletedTasks = tasks.some((task) => task.completed);

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-4xl">
        <Navbar />

        <h1 className="mb-2 text-center text-4xl font-bold">Completed Tasks</h1>
        <p className="mb-8 text-center text-zinc-400">
          Review what you have finished.
        </p>

        <SearchBar value={search} onChange={setSearch} />

        <div className="mb-4 flex items-center justify-between gap-4">
          <TaskCounter total={completedTasks.length} label="Completed" />
          <FilterBar filter={filter} onChange={setFilter} />
        </div>
        {completedTasks.length === 0 ? (
          <EmptyState
            title={
              hasCompletedTasks ? "No matching tasks" : "No completed tasks"
            }
            description={
              hasCompletedTasks
                ? "Try another search keyword."
                : "Complete a task to see it here."
            }
          />
        ) : (
          <TaskList
            title="Completed Tasks"
            tasks={completedTasks}
            taskActions={taskActions}
          />
        )}
      </div>
    </main>
  );
}
