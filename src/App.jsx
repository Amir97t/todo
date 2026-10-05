import Router from "./routes/Router";
import useAppData from "./hooks/useAppData";
import CelestialBackground from "./components/common/CelestialBackground";

export default function App() {
  const {
    status,
    error,
    retry,
    lists,
    tasks,
    taskActions,
    addList,
    renameList,
    deleteList,
    selectedListId,
    setSelectedListId,
  } = useAppData();

  return (
    <>
      <CelestialBackground />
      <Router
        tasks={tasks}
        taskActions={taskActions}
        lists={lists}
        addList={addList}
        renameList={renameList}
        deleteList={deleteList}
        selectedListId={selectedListId}
        setSelectedListId={setSelectedListId}
        dataStatus={status}
        dataError={error}
        onRetry={retry}
      />
    </>
  );
}
