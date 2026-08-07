import { BrowserRouter, Routes, Route } from "react-router-dom";
import Inbox from "../pages/Inbox";

export default function Router({
  tasks,
  taskActions,
  lists,
  selectedListId,
  setSelectedListId,
}) {
  return (
    // <=====
    <BrowserRouter> 
      <Routes>
        <Route
          path="/"
          element={
            <Inbox
              tasks={tasks}
              taskActions={taskActions}
              lists={lists}
              selectedListId={selectedListId}
              setSelectedListId={setSelectedListId}
            />
          }
        />

        <Route
          path="/completed"
          element={
            <Inbox
              tasks={tasks}
              taskActions={taskActions}
              lists={lists}
              selectedListId={selectedListId}
              setSelectedListId={setSelectedListId}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
