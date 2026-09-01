import { BrowserRouter, Routes, Route } from "react-router-dom";
import Inbox from "../pages/Inbox";
import Completed from "../pages/Completed";

export default function Router({
  tasks,
  taskActions,
  lists,
  selectedListId,
  setSelectedListId,
  addList,
  renameList,
  deleteList,
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
              addList={addList}
              renameList={renameList}
              deleteList={deleteList}
            />
          }
        />

        <Route
          path="/completed"
          element={<Completed tasks={tasks} taskActions={taskActions} />}
        />
      </Routes>
    </BrowserRouter>
  );
}
