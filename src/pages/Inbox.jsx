import { useState } from "react";
import AddTaskCard from "../components/task/AddTaskCard";
import TaskList from "../components/task/TaskList";
import Navbar from "../components/layout/Navbar";
import useTaskFilter from "../hooks/useTaskFilter";
import SearchBar from "../components/task/SearchBar";
import TaskCounter from "../components/task/TaskCounter";
import FilterBar from "../components/task/FIlterBar";
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

  const hasActiveTasks = tasks.some((task) => !task.completed);

  function handleAddTask(title, description, checklist) {
    // Inbox supplies the active list context.
    // AddTaskCard only manages task form data.
    addTask(title, description, checklist, selectedListId);
  }

  return (
    <main className="flex min-h-screen bg-zinc-950 text-white">
      <Sidebar
        lists={lists}
        selectedListId={selectedListId}
        onSelect={setSelectedListId}
        addList={addList}
        renameList={renameList}
        deleteList={deleteList}
      />
      <div className="flex-1 p-8">
        <div className="mx-auto max-w-4xl">
          <Navbar />
          <h1 className="mb-2 text-center text-4xl font-bold">Todo List</h1>
          <p className="mb-8 text-center text-zinc-400">
            Focus on your active tasks.
          </p>

          <AddTaskCard onAddTask={handleAddTask} />
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
                editingId={editingId}
                onStartEdit={setEditingId}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
