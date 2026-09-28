import { Plus, Pencil } from "lucide-react";

export default function AddTaskFab({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add new task"
      className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition hover:scale-105 active:scale-95"
      style={{
        background: "var(--primary)",
        color: "white",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}
    >
      <span className="relative flex h-6 w-6 items-center justify-center">
        <Pencil size={18} strokeWidth={2.2} />
        <Plus
          size={12}
          strokeWidth={3}
          className="absolute -top-1 -right-1"
        />
      </span>
    </button>
  );
}