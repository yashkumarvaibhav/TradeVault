import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      // Next strips these markers when bundling; in jsdom tests they'd throw on import.
      "server-only": new URL("./src/test/empty-module.ts", import.meta.url).pathname,
      "client-only": new URL("./src/test/empty-module.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
