import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { randomBytes } from "node:crypto";
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

// Pin this test harness to the dedicated Neon branch. Update intentionally if
// that branch/endpoint is ever replaced; never infer a target from todo_dev.
const EXPECTED_TEST_DB_HOST =
  "ep-wild-lab-b25v1scx.c-6.eu-central-1.aws.neon.tech";

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
 * Requires an explicit URL for the dedicated test database. It intentionally
 * does not derive a database name from DATABASE_URL, which may be todo_dev or
 * a production connection.
 */
function resolveTestDatabaseUrl() {
  const fileEnv = readBackendEnv();
  const rawUrl = process.env.TEST_DATABASE_URL || fileEnv.TEST_DATABASE_URL;

  if (!rawUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required in the process environment or todo-api/.env. Refusing to infer a test database.",
    );
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid URL. Check todo-api/.env.");
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("TEST_DATABASE_URL must use the PostgreSQL protocol.");
  }
  if (parsed.hostname !== EXPECTED_TEST_DB_HOST) {
    throw new Error(
      `Refusing test setup: TEST_DATABASE_URL host is not the dedicated test endpoint (received ${parsed.hostname || "<empty>"}).`,
    );
  }
  if (databaseName !== TEST_DB_NAME) {
    throw new Error(
      `Refusing test setup: expected database ${TEST_DB_NAME}, received ${databaseName || "<empty>"}.`,
    );
  }
  if (!parsed.username || !parsed.password) {
    throw new Error("TEST_DATABASE_URL must include database credentials.");
  }
  if (parsed.searchParams.get("sslmode") !== "require") {
    throw new Error("TEST_DATABASE_URL must include sslmode=require.");
  }

  return rawUrl;
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

/** Check the port itself, not just whether a healthy API answers on it. */
async function assertPortAvailable() {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${LIVE_PORT} is already occupied. Refusing to migrate or reset any database; stop the process using this port and retry.`,
          ),
        );
      } else {
        reject(error);
      }
    });
    server.listen(LIVE_PORT, "127.0.0.1", () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
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
        `Test backend exited with code ${child.exitCode}: ${redactUrl(captured.stderr.trim())}`,
      );
    }
    if (await isHealthy()) return;
    await delay(250);
  }

  throw new Error(
    `Test backend never became healthy at ${LIVE_BASE_URL} after 60s ` +
      `(exitCode=${child ? child.exitCode : "n/a"}, ` +
      `stderr=${redactUrl((captured.stderr || "<empty>").trim())})`,
  );
}

async function resetToInboxOnly() {
  const listsResponse = await fetch(`${API_BASE}/lists`);
  if (!listsResponse.ok) {
    throw new Error(`Cannot list test lists (HTTP ${listsResponse.status}); refusing cleanup.`);
  }
  const lists = await listsResponse.json();
  for (const list of lists) {
    if (list.id === INBOX_LIST_ID) continue;
    const response = await fetch(
      `${API_BASE}/lists/${list.id}?strategy=delete`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      throw new Error(`Failed to delete test list ${list.id} (HTTP ${response.status}).`);
    }
  }

  const tasksResponse = await fetch(`${API_BASE}/tasks`);
  if (!tasksResponse.ok) {
    throw new Error(`Cannot list test tasks (HTTP ${tasksResponse.status}); refusing cleanup.`);
  }
  const tasks = await tasksResponse.json();
  for (const task of tasks) {
    const response = await fetch(`${API_BASE}/tasks/${task.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Failed to delete test task ${task.id} (HTTP ${response.status}).`);
    }
  }
}

async function assertIsolated() {
  const listsResponse = await fetch(`${API_BASE}/lists`);
  const tasksResponse = await fetch(`${API_BASE}/tasks`);
  if (!listsResponse.ok || !tasksResponse.ok) {
    throw new Error("Cannot verify test database isolation because the API returned an error.");
  }

  const lists = await listsResponse.json();
  const tasks = await tasksResponse.json();
  const foreign = lists.filter((list) => list.id !== INBOX_LIST_ID);

  if (foreign.length > 0 || tasks.length > 0) {
    throw new Error(
      `Test backend on ${LIVE_BASE_URL} is not isolated: ` +
        `${foreign.length} non-Inbox list(s), ${tasks.length} task(s).`,
    );
  }
}

/**
 * Starts a backend against the explicitly pinned todo_test database. All
 * target and port checks happen before migrations or data cleanup.
 */
export default async function globalSetup() {
  const databaseUrl = resolveTestDatabaseUrl();

  if (await isHealthy()) {
    throw new Error(
      `Port ${LIVE_PORT} at ${LIVE_BASE_URL} is already serving a healthy API. ` +
        "Refusing to migrate or reset data on a server this setup did not start.",
    );
  }
  await assertPortAvailable();

  if (!existsSync(path.join(BACKEND_DIR, "dist", "main.js"))) {
    const built = runInBackend("npm", ["run", "build"]);
    if (built.status !== 0) {
      throw new Error(`Backend build failed:\n${redactUrl(built.stdout)}\n${redactUrl(built.stderr)}`);
    }
  }

  const applied = runInBackend(
    "npx",
    ["prisma", "migrate", "deploy", "--config", "prisma7.config.ts"],
    {
    env: {
      ...process.env,
      TEST_DATABASE_URL: databaseUrl,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
    },
  });
  if (applied.status !== 0) {
    throw new Error(
      `prisma migrate deploy against ${TEST_DB_NAME} failed:\n${redactUrl(applied.stdout)}\n${redactUrl(applied.stderr)}`,
    );
  }

  let child = null;
  const captured = { stderr: "" };
  // Use a process-local test-only secret; never borrow a production JWT secret.
  const testJwtSecret =
    process.env.TEST_JWT_SECRET || randomBytes(32).toString("hex");

  child = spawn(process.execPath, ["dist/main.js"], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      PORT: String(LIVE_PORT),
      TEST_DATABASE_URL: databaseUrl,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      JWT_SECRET: testJwtSecret,
      // Test the frontend against a disposable local-mode API. Valid Bearer
      // tokens are still validated, but anonymous legacy-data setup/cleanup
      // works even if the developer's .env defaults to REQUIRE_AUTH=enforce.
      REQUIRE_AUTH: "off",
      RATE_LIMIT: "off",
    },
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
