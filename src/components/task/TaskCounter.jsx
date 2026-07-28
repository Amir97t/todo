export default function TaskCounter({ total, label = "Tasks" }) {
  return (
    <div className="text-sm text-zinc-400">
      {total} {label}
    </div>
  );
}
