import path from "node:path";
import { fileURLToPath } from "node:url";

// The live migration test must never share todo_dev: that database holds
// unknown data, and migration would rightly refuse to run over it. It gets a
// dedicated database and port instead.
export const TEST_DB_NAME = "todo_test";
export const LIVE_PORT = 3001;
export const LIVE_BASE_URL = `http://localhost:${LIVE_PORT}`;

const here = path.dirname(fileURLToPath(import.meta.url));

/** The backend checkout that owns the schema and the Prisma CLI. */
export const BACKEND_DIR = path.resolve(here, "..", "..", "todo-api");

/** Strips credentials so a URL can safely appear in an error message. */
export function redactUrl(url) {
  return String(url).replace(/\/\/[^@]+@/, "//***@");
}
