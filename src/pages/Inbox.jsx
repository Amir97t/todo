import { useState } from "react";
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
  const hasActiveTasks = search.trim()
    ? tasks.some((t) => !t.completed)
    : tasks.some((t) => !t.completed && t.listId === selectedListId);
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
      <main className="min-h-screen flex-1">
        <div className="w-full px-4 pb-10 pt-16 sm:px-6 sm:pt-8 lg:px-8 lg:pt-8">
          <div className="max-w-350 mx-auto">
            <Navbar
              searchValue={search}
              onSearchChange={setSearch}
              onNewTask={() => setIslandOpen(true)}
            />
            <header className="mb-6 text-center sm:mb-8">
              <h1
                className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl"
                style={{ color: "var(--text)" }}
              >
                {selectedListName}
              </h1>
              <p
                className="mx-auto mt-2 max-w-xl text-sm leading-relaxed sm:text-[15px]"
                style={{ color: "var(--text-muted)" }}
              >
                {search.trim()
                  ? `Showing results for "${search.trim()}"`
                  : `Focus on your active tasks in ${selectedListName}.`}
              </p>
            </header>
            <div className="space-y-6">
              <AddTaskCard
                onAddTask={handleAddTask}
                open={islandOpen}
                onOpenChange={setIslandOpen}
              />
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <TaskCounter total={activeTasks.length} label="Active" />
                  <FilterBar filter={filter} onChange={setFilter} />
                </div>
                {activeTasks.length === 0 ? (
                  <EmptyState
                    title={
                      hasActiveTasks ? "No matching tasks" : "No active tasks"
                    }
                    description={
                      hasActiveTasks
                        ? "Try another search keyword or clear the search."
                        : "Create your first task — it will appear on this paper."
                    }
                  />
                ) : (
                  <TaskList
                    title="Active Tasks"
                    tasks={activeTasks}
                    taskActions={taskActions}
                    editingId={editingId}
                    onStartEdit={setEditingId}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
        <AddTaskFab onClick={() => setIslandOpen(true)} />
      </main>
    </div>
  );
}
