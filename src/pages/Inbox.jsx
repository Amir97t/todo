import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import AddTaskCard from "../components/task/AddTaskCard";
import AddTaskFab from "../components/task/AddTaskFab";
import TaskList from "../components/task/TaskList";
import Navbar from "../components/layout/Navbar";
import useTaskFilter from "../hooks/useTaskFilter";
import TaskCounter from "../components/task/TaskCounter";
import FilterBar from "../components/task/FilterBar";
import EmptyState from "../components/common/EmptyState";
import Sidebar from "../components/layout/Sidebar";

export default function Inbox({
  tasks,
  lists,
  selectedListId,
  setSelectedListId,
  taskActions,
  addList,
  renameList,
  deleteList,
  dataStatus = "ready",
  dataError = null,
  onRetry,
}) {
  const [editingId, setEditingId] = useState(null);
  const [islandOpen, setIslandOpen] = useState(false);
  const { addTask } = taskActions;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("newest");
  const activeTasks = useTaskFilter({
    tasks,
    completed: false,
    selectedListId,
    search,
    filter,
  });
  function handleAddTask(title, description, checklist) {
    addTask(title, description, checklist, selectedListId);
  }
  const selectedListName =
    lists.find((l) => l.id === selectedListId)?.name ?? "Inbox";
  return (
    <div className="flex min-h-screen">
      <Sidebar
        lists={lists}
        selectedListId={selectedListId}
        onSelect={setSelectedListId}
        addList={addList}
        renameList={renameList}
        deleteList={deleteList}
      />
      <main className="min-h-screen min-w-0 flex-1">
        <div className="w-full min-w-0 px-4 pb-10 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mx-auto min-w-0 max-w-350">
            <Navbar
              searchValue={search}
              onSearchChange={setSearch}
              onNewTask={() => setIslandOpen(true)}
            />
            <header className="mb-4 min-w-0 sm:mb-6">
              <h1
                className="truncate [font-family:var(--font-display)] text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl"
                style={{ color: "var(--text)" }}
              >
                {selectedListName}
              </h1>
              <p
                className="mt-1.5 hidden max-w-xl text-xs leading-relaxed min-[400px]:block sm:text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                {search.trim()
                  ? `Showing results for "${search.trim()}"`
                  : `Focus on your active tasks in ${selectedListName}.`}
              </p>
            </header>
            <div className="space-y-6">
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
                  <AddTaskCard
                    onAddTask={handleAddTask}
                    open={islandOpen}
                    onOpenChange={setIslandOpen}
                  />
                  <div className="space-y-4">
                    <div className="flex flex-col items-start gap-3">
                      <FilterBar filter={filter} onChange={setFilter} />
                      <TaskCounter total={activeTasks.length} label="Active" />
                    </div>
                    {activeTasks.length === 0 ? (
                      <EmptyState
                        icon={search.trim() ? FileText : Plus}
                        title={
                          search.trim() ? "No matching tasks" : "No active tasks"
                        }
                        description={
                          search.trim()
                            ? "Try another search keyword or clear the search."
                            : "Create your first task — it will appear on this paper."
                        }
                        actionLabel={search.trim() ? undefined : "Add task"}
                        onAction={
                          search.trim() ? undefined : () => setIslandOpen(true)
                        }
                      />
                    ) : (
                      <TaskList
                        tasks={activeTasks}
                        taskActions={taskActions}
                        editingId={editingId}
                        onStartEdit={setEditingId}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <AddTaskFab onClick={() => setIslandOpen(true)} />
      </main>
    </div>
  );
}
