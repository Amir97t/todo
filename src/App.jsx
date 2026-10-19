import { useState } from "react";
import Router from "./routes/Router";
import useAppData from "./hooks/useAppData";
import CelestialBackground from "./components/common/CelestialBackground";
import MutationErrorBanner from "./components/common/MutationErrorBanner";
import AuthScreen from "./components/auth/AuthScreen.jsx";
import { useAuth } from "./context/AuthContext.js";

function LoadingScreen() {
  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div role="status" className="rounded-2xl border border-white/10 bg-slate-950/70 px-6 py-5 text-sm text-slate-300 shadow-xl">
        Restoring your secure session…
      </div>
    </main>
  );
}

export default function App() {
  const { status, isAuthenticated, logout } = useAuth();
  const [logoutError, setLogoutError] = useState("");

  if (status === "checking") {
    return (
      <>
        <CelestialBackground />
        <LoadingScreen />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <CelestialBackground />
        <AuthScreen />
      </>
    );
  }

  return (
    <>
      <CelestialBackground />
      {logoutError && (
        <div role="alert" className="fixed right-4 top-4 z-50 rounded-xl border border-rose-400/20 bg-slate-950/95 px-4 py-3 text-sm text-rose-200 shadow-xl">
          {logoutError}
        </div>
      )}
      <AuthenticatedApp
        onSignOut={() => {
          setLogoutError("");
          void logout().catch((cause) => {
            setLogoutError(cause?.message || "Sign out could not be completed.");
          });
        }}
      />
    </>
  );
}

function AuthenticatedApp({ onSignOut }) {
  const {
    status,
    error,
    retry,
    isPending,
    actionError,
    clearActionError,
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
      <MutationErrorBanner message={actionError} onDismiss={clearActionError} />
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
        onSignOut={onSignOut}
      />
    </>
  );
}
