import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "out", "build"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "lib/site-features.ts",
        "lib/revalidate.ts",
        "app/(cms)/settings/actions.ts",
        "app/(cms)/settings/_components/SettingsClient.tsx",
      ],
      exclude: ["**/*.test.*", "**/*.spec.*"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
