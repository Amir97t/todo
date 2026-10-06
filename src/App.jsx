import Router from "./routes/Router";
import useAppData from "./hooks/useAppData";
import CelestialBackground from "./components/common/CelestialBackground";

export default function App() {
  const {
    status,
    error,
    retry,
    isPending,
    lists,
    tasks,
    taskActions,
    addList,
    renameList,
    deleteList,
    selectedListId,
    setSelectedListId,
    setTaskQuery,
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
        isPending={isPending}
        selectedListId={selectedListId}
        setSelectedListId={setSelectedListId}
        setTaskQuery={setTaskQuery}
        dataStatus={status}
        dataError={error}
        onRetry={retry}
      />
    </>
  );
}
