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
  setTaskQuery,
  dataStatus,
  dataError,
  onRetry,
}) {
  const shared = {
    tasks,
    taskActions,
    lists,
    selectedListId,
    setSelectedListId,
    addList,
    renameList,
    deleteList,
    setTaskQuery,
    dataStatus,
    dataError,
    onRetry,
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inbox {...shared} />} />
        <Route path="/completed" element={<Completed {...shared} />} />
      </Routes>
    </BrowserRouter>
  );
}
