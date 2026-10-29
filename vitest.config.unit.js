import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.js"],
    // These tests use mocked APIs. The live migration test requires a
    // separately provisioned backend and dedicated disposable database.
    // Keep it out of database-free unit CI.
    exclude: [...configDefaults.exclude, "test/live-migration.test.js"],
    testTimeout: 15000,
  },
});
