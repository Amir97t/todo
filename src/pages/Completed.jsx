import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Sidebar from "../components/layout/Sidebar";
import FilterBar from "../components/task/FilterBar";
import TaskCounter from "../components/task/TaskCounter";
import TaskList from "../components/task/TaskList";
import EmptyState from "../components/common/EmptyState";
import { buildTaskQuery } from "../lib/taskQuery";

const SEARCH_DEBOUNCE_MS =
  typeof globalThis !== "undefined" && globalThis.process?.env?.VITEST
    ? 0
    : 250;

export default function Completed({
  tasks,
  taskActions,
  lists,
  selectedListId,
  setSelectedListId,
  addList,
  renameList,
  deleteList,
  isPending,
  setTaskQuery,
  dataStatus = "ready",
  dataError = null,
  onRetry,
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("newest");
  const [editingId, setEditingId] = useState(null);

  const navigate = useNavigate();

  const isSearching = search.trim().length > 0;

  // Completed is always global: no listId is ever sent from this page.
  // Debounced search query to reduce request volume while keeping the input
  // immediately responsive. The local state updates on every keystroke; the
  // server query is published after a short pause. Clearing the search
  // updates promptly because the timeout is cleared on value change.
  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setTaskQuery(buildTaskQuery({ completed: true, q: search, sort: filter }));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [setTaskQuery, search, filter]);

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
        isPending={isPending}
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
                  showActionLabel
                />
              ) : (
                <>
                  <div className="flex flex-col items-start gap-3">
                    <FilterBar filter={filter} onChange={setFilter} />
                    <TaskCounter
                      total={tasks.length}
                      label="Completed"
                    />
                  </div>

                  {tasks.length === 0 ? (
                    <EmptyState
                      title={
                        isSearching
                          ? "No matching tasks"
                          : "No completed tasks"
                      }
                      description={
                        isSearching
                          ? "Try another search keyword."
                          : "Complete a task to see it here."
                      }
                    />
                  ) : (
                    <TaskList
                      tasks={tasks}
                      taskActions={taskActions}
                      editingId={editingId}
                      onStartEdit={setEditingId}
                      isPending={isPending}
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
