import useLocalStorage from "./useLocalStorage";


const TASKS_STORAGE_KEY = "todo-app-tasks";

export default function useTasks() {
  return useLocalStorage(TASKS_STORAGE_KEY, []);
}