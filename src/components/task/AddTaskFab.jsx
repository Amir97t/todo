import { Pencil } from "lucide-react";

export default function AddTaskFab({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add new task"
      title="Add new task"
      className="fixed z-40 flex h-13 w-13 items-center justify-center rounded-full shadow-lg transition hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary)"
      style={{
        right: "max(1rem, env(safe-area-inset-right))",
        bottom: "max(1rem, env(safe-area-inset-bottom))",
        background: "var(--primary)",
        color: "white",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}
    >
      <Pencil size={20} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}
