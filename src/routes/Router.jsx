import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import Completed from "../pages/Completed";

export default function Router({ tasks, taskActions }) {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Home tasks={tasks} taskActions={taskActions} />}
        />

        <Route
          path="/completed"
          element={<Completed tasks={tasks} taskActions={taskActions} />}
        />
      </Routes>
    </BrowserRouter>
  );
}
