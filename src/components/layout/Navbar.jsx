import { NavLink } from "react-router-dom";

export default function Navbar() {
  const linkClass = ({ isActive }) =>
    `px-4 py-2 rounded-lg transition ${
      isActive
        ? "bg-red-600 text-white"
        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
    }`;
  return (
    <nav className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-4">
      <h1 className="text-2xl font-bold text-white">ToDo</h1>
      <div className="flex gap-3">
        <NavLink to="/" end className={linkClass}>
          Active
        </NavLink>
        <NavLink to="/completed" className={linkClass}>
          Completed
        </NavLink>
      </div>
    </nav>
  );
}
