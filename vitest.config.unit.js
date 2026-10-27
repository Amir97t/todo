import { defineConfig } from "vite";

export default defineConfig({
  test: {
    // Use the same jsdom environment as the main config.
    environment: "jsdom",
    // Reuse the existing test setup utilities.
    setupFiles: ["./test/setup.js"],
    // Exclude the live‑migration integration test which requires the global
    // backend setup (database, server, etc.). All other test files are safe to
    // run in this fast, database‑free mode.
    exclude: ["**/live-migration.test.js"],

    // Disable any globalSetup that would start the live backend.
    globalSetup: [],
  },
});