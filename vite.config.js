import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.js"],
    // Boots a backend against todo_test before any test file is imported, so
    // the live migration test never depends on (or disturbs) todo_dev.
    globalSetup: ["./test/globalSetup.js"],
  },
});
