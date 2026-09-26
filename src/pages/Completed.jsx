import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Sidebar from "../components/layout/Sidebar";
import FilterBar from "../components/task/FilterBar";
import TaskCounter from "../components/task/TaskCounter";
import TaskList from "../components/task/TaskList";
import useTaskFilter from "../hooks/useTaskFilter";
import EmptyState from "../components/common/EmptyState";

export default function Completed({
  tasks,
  taskActions,
  lists,
  selectedListId,
  setSelectedListId,
  addList,
  renameList,
  deleteList,
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("newest");
  const [editingId, setEditingId] = useState(null);

  const navigate = useNavigate();

  const completedTasks = useTaskFilter({
    tasks,
    search,
    filter,
    completed: true,
  });

  const hasCompletedTasks = tasks.some((task) => task.completed);

  function handleSelectList(listId) {
    setSelectedListId(listId);
    navigate("/");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        lists={lists}
        selectedListId={selectedListId}
        onSelect={handleSelectList}
        addList={addList}
        renameList={renameList}
        deleteList={deleteList}
      />

      <main className="min-h-screen flex-1">
        <div className="w-full px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:px-8">
          <Navbar searchValue={search} onSearchChange={setSearch} />

          <header className="mb-6 text-center sm:mb-8">
            <h1
              className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl"
              style={{ color: "var(--text)" }}
            >
              Completed
            </h1>

            <p
              className="mx-auto mt-2 max-w-xl text-sm leading-relaxed sm:text-[15px]"
              style={{ color: "var(--text-muted)" }}
            >
              Review what you have finished.
            </p>
          </header>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                editingId={editingId}
                onStartEdit={setEditingId}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
