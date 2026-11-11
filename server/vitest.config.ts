import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve Node-style JavaScript import extensions to TypeScript source.
  resolve: { alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1.ts" }] },
  test: {
    include: ["tests/**/*.test.ts"],
    env: { DATABASE_PATH: ":memory:" },
  },
});
