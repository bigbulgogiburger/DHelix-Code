import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["dotenv/config"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.tsx",
        "src/index.ts",
        "src/cli/hooks/**",
        "src/cli/renderer/**",
        "src/cli/headless.ts",
        "src/**/types.ts",
        "src/types/**",
        "src/subagents/**",
        "src/mcp/tool-bridge.ts",
        "src/llm/client.ts",
        "src/llm/provider.ts",
        "src/utils/logger.ts",
      ],
    },
  },
});
