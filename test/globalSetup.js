import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import {
  BACKEND_DIR,
  LIVE_BASE_URL,
  LIVE_PORT,
  TEST_DB_NAME,
  redactUrl,
} from "./liveBackend.js";
import { INBOX_LIST_ID } from "../src/lib/constants.js";

const API_BASE = `${LIVE_BASE_URL}/api/v1`;

function readBackendEnv() {
  const file = path.join(BACKEND_DIR, ".env");

  if (!existsSync(file)) return {};

  const values = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["'](.*)["']$/, "$1");
  }
  return values;
}

/**
 * Derives the test database from the developer's own DATABASE_URL so no
 * credential is ever committed. TEST_DATABASE_URL wins when set.
 */
function resolveTestDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const dev = readBackendEnv().DATABASE_URL;
  if (!dev) {
    throw new Error(
      "Cannot derive the test database URL: set TEST_DATABASE_URL, or add DATABASE_URL to todo-api/.env.",
    );
  }

  const derived = dev.replace(
    /^([^:]+:\/\/[^/]+\/)([^/?]+)(.*)$/,
    (_match, head, _database, tail) => `${head}${TEST_DB_NAME}${tail}`,
  );

  if (derived === dev) {
    throw new Error(
      `DATABASE_URL has no database name to replace: ${redactUrl(dev)}`,
    );
  }

  return derived;
}

function runInBackend(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: BACKEND_DIR,
    encoding: "utf8",
    shell: process.platform === "win32",
    ...options,
  });
}

async function isHealthy() {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(4000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForBackend(child, captured) {
  // Generous: a cold start compiles Prisma's query engine and opens a
  // connection pool, which is slow on a loaded machine.
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    // Our own process exiting means someone else owns the port, so anything
    // answering now is a server whose database we cannot verify.
    if (child && child.exitCode !== null) {
      throw new Error(
        `Test backend exited with code ${child.exitCode}: ${captured.stderr.trim()}`,
      );
    }
    if (await isHealthy()) return;
    await delay(250);
  }

  throw new Error(
    `Test backend never became healthy at ${LIVE_BASE_URL} after 60s ` +
      `(exitCode=${child ? child.exitCode : "n/a"}, ` +
      `stderr=${(captured.stderr || "<empty>").trim()})`,
  );
}

async function resetToInboxOnly() {
  const lists = await (await fetch(`${API_BASE}/lists`)).json();
  for (const list of lists) {
    if (list.id === INBOX_LIST_ID) continue;
    await fetch(`${API_BASE}/lists/${list.id}?strategy=delete`, {
      method: "DELETE",
    });
  }

  const tasks = await (await fetch(`${API_BASE}/tasks`)).json();
  for (const task of tasks) {
    await fetch(`${API_BASE}/tasks/${task.id}`, { method: "DELETE" });
  }
}

async function assertIsolated() {
  const lists = await (await fetch(`${API_BASE}/lists`)).json();
  const tasks = await (await fetch(`${API_BASE}/tasks`)).json();
  const foreign = lists.filter((list) => list.id !== INBOX_LIST_ID);

  if (foreign.length > 0 || tasks.length > 0) {
    throw new Error(
      `Test backend on ${LIVE_BASE_URL} is not isolated: ` +
        `${foreign.length} non-Inbox list(s), ${tasks.length} task(s).`,
    );
  }
}

/**
 * Brings up a backend bound to todo_test before any test module is imported,
 * so live-migration.test.js sees a database that is Inbox-only.
 *
 * todo_dev is never touched: the child process is spawned with the derived
 * test URL, and data is only reset on a server we spawned ourselves.
 */
export default async function globalSetup() {
  const databaseUrl = resolveTestDatabaseUrl();

  if (!existsSync(path.join(BACKEND_DIR, "dist", "main.js"))) {
    const built = runInBackend("npm", ["run", "build"]);
    if (built.status !== 0) {
      throw new Error(`Backend build failed:\n${built.stdout}\n${built.stderr}`);
    }
  }

  const applied = runInBackend("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  if (applied.status !== 0) {
    throw new Error(
      `prisma migrate deploy against ${TEST_DB_NAME} failed:\n${applied.stdout}\n${applied.stderr}`,
    );
  }

  let child = null;
  const captured = { stderr: "" };

  if (await isHealthy()) {
    throw new Error(
      `Port ${LIVE_PORT} at ${LIVE_BASE_URL} is already in use by a server this setup did not start. ` +
        "Refusing to reset data on a server whose database cannot be verified — free the port and retry.",
    );
  }

  child = spawn(process.execPath, ["dist/main.js"], {
    cwd: BACKEND_DIR,
    env: { ...process.env, PORT: String(LIVE_PORT), DATABASE_URL: databaseUrl },
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.on("data", (chunk) => {
    captured.stderr += chunk.toString();
  });

  try {
    await waitForBackend(child, captured);
    await resetToInboxOnly();
    await assertIsolated();
  } catch (error) {
    if (child && child.exitCode === null) child.kill();
    throw error;
  }

  return async () => {
    if (child && child.exitCode === null) child.kill();
  };
}
