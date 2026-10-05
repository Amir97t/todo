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
  dataStatus = "ready",
  dataError = null,
  onRetry,
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

      <main className="min-h-screen min-w-0 flex-1">
        <div className="w-full min-w-0 px-4 pb-10 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mx-auto min-w-0 max-w-350">
            <Navbar searchValue={search} onSearchChange={setSearch} />

            <header className="mb-4 min-w-0 sm:mb-6">
              <h1
                className="truncate [font-family:var(--font-display)] text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl"
                style={{ color: "var(--text)" }}
              >
                Completed
              </h1>

              <p
                className="mt-1.5 hidden max-w-xl text-xs leading-relaxed min-[400px]:block sm:text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Review what you have finished.
              </p>
            </header>

            <div className="space-y-4">
              {dataStatus === "loading" ? (
                <EmptyState
                  title="Loading your tasks…"
                  description="Fetching your data from the server."
                />
              ) : dataStatus === "error" ? (
                <EmptyState
                  title="Could not load your data"
                  description={
                    dataError || "Something went wrong while loading your data."
                  }
                  actionLabel="Try again"
                  onAction={onRetry}
                />
              ) : (
                <>
                  <div className="flex flex-col items-start gap-3">
                    <FilterBar filter={filter} onChange={setFilter} />
                    <TaskCounter
                      total={completedTasks.length}
                      label="Completed"
                    />
                  </div>

                  {completedTasks.length === 0 ? (
                    <EmptyState
                      title={
                        hasCompletedTasks
                          ? "No matching tasks"
                          : "No completed tasks"
                      }
                      description={
                        hasCompletedTasks
                          ? "Try another search keyword."
                          : "Complete a task to see it here."
                      }
                    />
                  ) : (
                    <TaskList
                      tasks={completedTasks}
                      taskActions={taskActions}
                      editingId={editingId}
                      onStartEdit={setEditingId}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
