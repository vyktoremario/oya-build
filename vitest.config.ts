import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "packages/*/test/**/*.test.ts", "eval/src/**/*.test.ts", "apps/web/src/**/*.test.ts"],
  },
});
