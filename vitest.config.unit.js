import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { configDefaults } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.js"],
    exclude: [...configDefaults.exclude, "**/live-migration.test.js"],
    testTimeout: 15000,
  },
});
