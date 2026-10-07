import { useEffect, useRef, useState } from "react";
import ListItem from "../list/ListItem";
import NewListForm from "../list/NewListForm";
import ConfirmDialog from "../common/ConfirmDialog";
import useLocalStorage from "../../hooks/useLocalStorage";
import useDialogFocus from "../../hooks/useDialogFocus";
import {
  BookMarked,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
} from "lucide-react";

import ListIcon from "../common/ListIcon";
import { getSuggestedListIcon } from "../../lib/listIcons";
import { INBOX_LIST_ID } from "../../lib/constants";
import { mutationKeys } from "../../lib/mutationKeys";

function ListsBlock({
  lists,
  selectedListId,
  onSelect,
  editingId,
  onStartEdit,
  onRename,
  onCancel,
  onDelete,
  onAfterSelect,
  isPending,
}) {
  return (
    <div className="space-y-2">
      {lists.map((list) => (
        <ListItem
          key={list.id}
          list={list}
          selected={selectedListId === list.id}
          onSelect={(id) => {
            onSelect(id);
            onAfterSelect?.();
          }}
          editingId={editingId}
          onStartEdit={onStartEdit}
          onRename={onRename}
          onCancel={onCancel}
          onDelete={onDelete}
          collapsed={false}
          isPending={isPending}
        />
      ))}
    </div>
  );
}

export default function Sidebar({
  addList,
  lists,
  selectedListId,
  onSelect,
  renameList,
  deleteList,
  isPending,
}) {
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Desktop collapse preference is persisted; the mobile drawer is separate
  // state that never writes to it.
  const [isCollapsed, setIsCollapsed] = useLocalStorage(
    "todo-app-sidebar-collapsed",
    true,
  );

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile drawer when switching to desktop.
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    function handleMediaChange(event) {
      if (event.matches) {
        setIsMobileOpen(false);
      }
    }

    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, []);

  // Prevent page scrolling while the mobile drawer is open.
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  async function handleRename(id, name, icon) {
    const ok = await renameList(id, name, icon);

    if (ok) {
      setEditingId(null);
    }
  }

  function handleStartEdit(id) {
    setEditingId(id);
  }

  function handleCancelEdit() {
    setEditingId(null);
  }

  const drawerRef = useRef(null);

  // The drawer stays mounted so it can animate; `inert` removes it from the
  // tab order and the accessibility tree while closed, and this hands focus
  // in on open and back to the trigger on close.
  const { handleKeyDown } = useDialogFocus({
    open: isMobileOpen,
    dialogRef: drawerRef,
    onEscape: () => setIsMobileOpen(false),
  });

  return (
    <>
      {/* Mobile top bar trigger */}
      <button
        type="button"
        aria-label="Open notebook"
        title="Open notebook"
        onClick={() => setIsMobileOpen(true)}
        className="fixed left-5 top-2 z-40 inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-lg backdrop-blur-md transition hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary) sm:left-7 sm:top-2.5 lg:hidden"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <BookOpen size={18} aria-hidden="true" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Close notebook"
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* Mobile drawer */}
      <div
        ref={drawerRef}
        className={`fixed inset-y-0 left-0 z-50 flex w-[88%] max-w-[320px] flex-col transition-[transform,opacity] duration-300 lg:hidden ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!isMobileOpen}
        inert={!isMobileOpen}
        onKeyDown={handleKeyDown}
      >
        <div className="wood-texture relative flex h-full flex-col overflow-hidden rounded-r-[18px] p-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.5),0_2px_10px_rgba(0,0,0,0.35)]">
          {/* Book edge highlight */}
          <div className="pointer-events-none absolute inset-y-2 right-1.5 w-0.5 rounded-full bg-white/10" />

          {/* Spine binding */}
          <div className="pointer-events-none absolute bottom-2 left-4.5 top-2 flex flex-col justify-around">
            {Array.from({ length: 7 }).map((_, index) => (
              <span
                key={index}
                className="block h-4.5 w-2 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.6),0_1px_0_rgba(255,255,255,0.15)]"
                style={{
                  background:
                    "linear-gradient(180deg,#bba98f 0%,#8a7a6a 55%,#6b5d4f 100%)",
                  border: "1px solid rgba(0,0,0,0.25)",
                }}
              />
            ))}
          </div>

          {/* Bookmark ribbon */}
          <div
            className="pointer-events-none absolute right-10 top-0 h-10 w-4 rounded-b-sm bg-(--primary) shadow-md"
            style={{
              clipPath: "polygon(0 0,100% 0,100% 100%,50% 82%,0 100%)",
            }}
          />

          <div className="paper-texture relative ml-4.5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_8px_rgba(0,0,0,0.25)]">
            {/* Red margin line */}
            <div className="pointer-events-none absolute bottom-0 left-8 top-0 w-px bg-red-300/40 dark:bg-red-400/20" />

            {/* Holes */}
            <div className="pointer-events-none absolute bottom-0 left-2.5 top-0 flex flex-col justify-around py-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <span
                  key={index}
                  className="block h-3 w-3 rounded-full border border-black/10 bg-black/6 shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)] dark:bg-white/6"
                />
              ))}
            </div>

            {/* Mobile header */}
            <div
              className="flex items-center justify-between gap-2 border-b px-4 py-4 pl-10"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    background: "var(--primary-soft)",
                    color: "var(--primary)",
                  }}
                >
                  <BookMarked size={16} />
                </span>

                <div>
                  <h2
                    className="text-[11px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: "var(--text-faint)" }}
                  >
                    Notebook
                  </h2>

                  <p
                    className="text-sm font-semibold leading-none"
                    style={{ color: "var(--text)" }}
                  >
                    Lists
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                aria-label="Close notebook"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition hover:opacity-80"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Mobile lists */}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 pl-10">
              <ListsBlock
                lists={lists}
                selectedListId={selectedListId}
                onSelect={onSelect}
                editingId={editingId}
                onStartEdit={handleStartEdit}
                onRename={handleRename}
                onCancel={handleCancelEdit}
                onDelete={setDeleteTarget}
                onAfterSelect={() => setIsMobileOpen(false)}
                isPending={isPending}
              />
            </div>

            {/* Mobile new list form */}
            <div
              className="shrink-0 border-t p-3 pl-10"
              style={{
                borderColor: "var(--border)",
                background:
                  "color-mix(in srgb, var(--notebook-paper) 88%, transparent)",
              }}
            >
              <NewListForm onSave={addList} isPending={isPending} />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden transition-all duration-300 lg:flex ${
          isCollapsed ? "w-19" : "w-75"
        }`}
        style={{ perspective: "1200px" }}
      >
        <div
          className={`wood-texture relative flex h-full flex-col p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] ${
            isCollapsed ? "rounded-r-2xl" : "rounded-r-[18px]"
          }`}
          style={{
            transform: isCollapsed ? "rotateY(-6deg)" : "rotateY(0deg)",
            transformOrigin: "left center",
            transition: "transform 500ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {/* Spine rings */}
          {!isCollapsed && (
            <div className="pointer-events-none absolute bottom-3 left-4.5 top-3 flex flex-col justify-around">
              {Array.from({ length: 7 }).map((_, index) => (
                <span
                  key={index}
                  className="block h-5 w-2.25 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.6),0_1px_0_rgba(255,255,255,0.14)]"
                  style={{
                    background:
                      "linear-gradient(180deg,#c2b19a 0%,#8f7f6e 55%,#6e6052 100%)",
                    border: "1px solid rgba(0,0,0,0.28)",
                  }}
                />
              ))}
            </div>
          )}

          {/* Book fore-edge pages */}
          <div
            className="pointer-events-none absolute inset-y-2.5 right-1.5 w-1.5 rounded-full opacity-60"
            style={{
              background:
                "repeating-linear-gradient(180deg, #fffef8 0 2px, #e8e2d4 2px 3px)",
            }}
          />

          {isCollapsed ? (
            /* Collapsed desktop sidebar */
            <div className="flex h-full flex-col items-center">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/15 hover:text-white"
                aria-label="Open notebook"
              >
                <PanelLeftOpen size={16} />
              </button>

              <div className="mt-6 flex flex-1 flex-col items-center gap-2">
                {lists.map((list) => {
                  const isSelected = selectedListId === list.id;

                  return (
                    <button
                      key={list.id}
                      type="button"
                      title={list.name}
                      aria-label={list.name}
                      aria-current={isSelected ? "page" : undefined}
                      onClick={() => onSelect(list.id)}
                      className={`relative flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm transition hover:scale-[1.03] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                        isSelected
                          ? "shadow-md"
                          : "border-white/15 bg-white/10 text-white/70 backdrop-blur hover:bg-white/15 hover:text-white"
                      }`}
                      style={
                        isSelected
                          ? {
                              background: "var(--primary-soft)",
                              borderColor: "var(--primary)",
                              color: "var(--primary)",
                              outlineColor: "var(--primary)",
                            }
                          : undefined
                      }
                    >
                      <ListIcon
                        icon={
                          list.icon ??
                          (list.id === INBOX_LIST_ID
                            ? "inbox"
                            : getSuggestedListIcon(list.name))
                        }
                        size={17}
                        strokeWidth={1.9}
                      />

                      {isSelected && (
                        <span
                          className="absolute -left-1 h-5 w-0.75 rounded-full"
                          style={{ background: "var(--primary)" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mb-1 flex flex-col items-center gap-2">
                <div className="h-px w-8 bg-white/15" />

                <span
                  className="rotate-180 text-[9px] font-bold uppercase tracking-[0.2em] text-white/40"
                  style={{ writingMode: "vertical-rl" }}
                >
                  Notebook
                </span>

                <button
                  type="button"
                  onClick={() => setIsCollapsed(false)}
                  aria-label="New list"
                  title="New list"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-zinc-900 shadow-md transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            /* Expanded desktop sidebar */
            <div className="paper-texture relative ml-4.5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_4px_24px_rgba(0,0,0,0.22)]">
              <div className="pointer-events-none absolute bottom-0 left-9 top-0 w-px bg-red-300/40 dark:bg-red-400/20" />

              <div className="pointer-events-none absolute bottom-0 left-3 top-0 hidden flex-col justify-around py-8 sm:flex">
                {Array.from({ length: 6 }).map((_, index) => (
                  <span
                    key={index}
                    className="block h-3 w-3 rounded-full border border-black/10 bg-black/6 shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)] dark:border-white/10 dark:bg-white/6"
                  />
                ))}
              </div>

              {/* Bookmark */}
              <div
                className="pointer-events-none absolute right-10 top-0 h-12 w-3.5 rounded-b-sm bg-(--primary) shadow-[0_4px_10px_rgba(0,0,0,0.25)]"
                style={{
                  clipPath: "polygon(0 0,100% 0,100% 100%,50% 84%,0 100%)",
                }}
              />

              <div
                className="flex items-center justify-between gap-2 border-b px-4 py-4 pl-10"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl shadow-sm"
                    style={{
                      background: "var(--primary)",
                      color: "white",
                    }}
                  >
                    <BookMarked size={16} />
                  </span>

                  <div>
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.18em]"
                      style={{ color: "var(--text-faint)" }}
                    >
                      My Notebook
                    </p>

                    <h2
                      className="text-sm font-bold leading-none"
                      style={{ color: "var(--text)" }}
                    >
                      Lists
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Collapse notebook"
                  onClick={() => setIsCollapsed(true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition hover:opacity-80"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--bg-elevated)",
                    color: "var(--text-muted)",
                  }}
                >
                  <PanelLeftClose size={14} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 pl-10">
                <ListsBlock
                  lists={lists}
                  selectedListId={selectedListId}
                  onSelect={onSelect}
                  editingId={editingId}
                  onStartEdit={handleStartEdit}
                  onRename={handleRename}
                  onCancel={handleCancelEdit}
                  onDelete={setDeleteTarget}
                  isPending={isPending}
                />

                <p
                  className="mt-6 text-center text-[10px] font-medium uppercase tracking-widest"
                  style={{ color: "var(--text-faint)" }}
                >
                  {lists.length} {lists.length === 1 ? "list" : "lists"} • tap
                  to switch
                </p>
              </div>

              <div
                className="shrink-0 border-t p-3 pl-10"
                style={{
                  borderColor: "var(--border)",
                  background:
                    "color-mix(in srgb, var(--notebook-paper) 92%, transparent)",
                }}
              >
                <NewListForm onSave={addList} isPending={isPending} />
              </div>
            </div>
          )}
        </div>
      </aside>

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title={`Delete "${deleteTarget.name}"?`}
          description="Choose what should happen to the tasks inside this list."
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Delete List"
          pending={isPending?.(mutationKeys.deleteList(deleteTarget.id)) ?? false}
          onConfirm={async () => {
            if (await deleteList(deleteTarget.id, false)) setDeleteTarget(null);
          }}
          secondaryLabel="Delete List & Tasks"
          onSecondaryConfirm={async () => {
            if (await deleteList(deleteTarget.id, true)) setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
}
