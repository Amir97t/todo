export default function TaskCounter({ total, active, completed }) {
  return (
    <div className="flex gap-6 text-zinc-400">
      <span>Total: {total}</span>
      <span>Active: {active}</span>
      <span>Completed: {completed}</span>
    </div>
  );
}
