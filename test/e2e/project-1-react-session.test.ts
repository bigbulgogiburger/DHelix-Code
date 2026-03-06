/**
 * E2E Multi-turn Session Test: React + TypeScript Dashboard
 *
 * Uses dbcode's agent-loop to build a React Dashboard project incrementally
 * across multiple conversation turns, verifying file system state after each turn.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { OpenAICompatibleClient } from "../../src/llm/client.js";
import { selectStrategy } from "../../src/llm/tool-call-strategy.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { runAgentLoop, type AgentLoopConfig } from "../../src/core/agent-loop.js";
import { createEventEmitter } from "../../src/utils/events.js";
import { type ChatMessage } from "../../src/llm/provider.js";
import { fileReadTool } from "../../src/tools/definitions/file-read.js";
import { fileWriteTool } from "../../src/tools/definitions/file-write.js";
import { fileEditTool } from "../../src/tools/definitions/file-edit.js";
import { bashExecTool } from "../../src/tools/definitions/bash-exec.js";
import { globSearchTool } from "../../src/tools/definitions/glob-search.js";
import { grepSearchTool } from "../../src/tools/definitions/grep-search.js";

const hasApiKey = !!process.env.OPENAI_API_KEY;
const projectRoot = process.cwd();
const projectDir = join(projectRoot, "test-projects", "react-dashboard");

/** Send a user turn to the agent loop and accumulate messages */
async function sendTurn(
  messages: ChatMessage[],
  userMessage: string,
  config: Omit<AgentLoopConfig, "maxIterations" | "maxTokens">,
): Promise<ChatMessage[]> {
  messages.push({ role: "user", content: userMessage });
  const result = await runAgentLoop(
    { ...config, maxIterations: 25, maxTokens: 16384 },
    messages,
  );
  // Replace messages array with result to maintain conversation context
  messages.length = 0;
  messages.push(...result.messages);
  return messages;
}

describe.skipIf(!hasApiKey)("Project 1: React Dashboard Multi-turn Session", () => {
  let client: OpenAICompatibleClient;
  let toolRegistry: ToolRegistry;
  let config: Omit<AgentLoopConfig, "maxIterations" | "maxTokens">;
  let messages: ChatMessage[];
  let totalToolCalls = 0;

  beforeAll(() => {
    // Clean up any existing project
    if (existsSync(projectDir)) {
      rmSync(projectDir, { recursive: true, force: true });
    }
    mkdirSync(projectDir, { recursive: true });

    client = new OpenAICompatibleClient({
      baseURL: "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY!,
      timeout: 120_000,
    });

    toolRegistry = new ToolRegistry();
    toolRegistry.registerAll([
      fileReadTool,
      fileWriteTool,
      fileEditTool,
      bashExecTool,
      globSearchTool,
      grepSearchTool,
    ]);

    const events = createEventEmitter();
    events.on("tool:complete", () => { totalToolCalls++; });

    const strategy = selectStrategy("gpt-4o");

    config = {
      client,
      model: "gpt-4o",
      toolRegistry,
      strategy,
      events,
      workingDirectory: projectDir,
      useStreaming: false,
      maxContextTokens: 128_000,
    };

    messages = [
      {
        role: "system",
        content: `You are a skilled coding assistant. You create files using tools. Working directory: ${projectDir}
Rules:
- Use file_write to create files, bash_exec to run commands.
- Always create complete, working files — no placeholders.
- When running npm/bash commands, set the working directory to ${projectDir}.
- Be concise. Create files directly without lengthy explanations.`,
      },
    ];
  });

  afterAll(() => {
    // Log stats
    console.log(`\n[Project 1 Stats] Total tool calls: ${totalToolCalls}, Final messages: ${messages.length}`);
  });

  it(
    "Turn 1: Initialize React + TypeScript + Vite project with Tailwind",
    async () => {
      await sendTurn(
        messages,
        `In ${projectDir}, run these commands:
1. npm create vite@latest . -- --template react-ts (use . for current dir)
2. npm install
3. npm install react-router-dom
4. npm install -D @tailwindcss/vite tailwindcss vitest happy-dom @testing-library/react @testing-library/jest-dom

Then update vite.config.ts to include tailwindcss plugin and vitest config with happy-dom.
Update src/index.css to just contain: @import "tailwindcss";
Do NOT explain, just execute.`,
        config,
      );

      expect(existsSync(join(projectDir, "package.json"))).toBe(true);
      expect(existsSync(join(projectDir, "vite.config.ts"))).toBe(true);
      expect(existsSync(join(projectDir, "src", "main.tsx"))).toBe(true);
    },
    300_000,
  );

  it(
    "Turn 2: Create Sidebar navigation component",
    async () => {
      await sendTurn(
        messages,
        `Create src/components/Sidebar.tsx — a sidebar navigation with 3 menu items: Dashboard (/), Users (/users), Settings (/settings). Use NavLink from react-router-dom. Style with Tailwind: dark sidebar (bg-gray-900), active item highlighted with bg-indigo-600. Named export only.`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "components", "Sidebar.tsx"))).toBe(true);
      const content = readFileSync(join(projectDir, "src", "components", "Sidebar.tsx"), "utf-8");
      expect(content).toContain("NavLink");
      expect(content).toContain("Dashboard");
      expect(content).toContain("Users");
      expect(content).toContain("Settings");
    },
    120_000,
  );

  it(
    "Turn 3: Set up React Router with layout",
    async () => {
      await sendTurn(
        messages,
        `Update src/App.tsx to use the Sidebar component (from Turn 2) and React Router. Layout: flex row with Sidebar on left and Routes on right. Define 3 routes: / → Dashboard, /users → Users, /settings → Settings. Create placeholder page components in src/pages/ (Dashboard.tsx, Users.tsx, Settings.tsx) that just show the page name. Update src/main.tsx to wrap App with BrowserRouter. Named exports only.`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "App.tsx"))).toBe(true);
      expect(existsSync(join(projectDir, "src", "pages", "Dashboard.tsx"))).toBe(true);
      expect(existsSync(join(projectDir, "src", "pages", "Users.tsx"))).toBe(true);
      expect(existsSync(join(projectDir, "src", "pages", "Settings.tsx"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 4: Create Dashboard page with stat cards",
    async () => {
      await sendTurn(
        messages,
        `Create src/components/StatCard.tsx — a card component that takes label, value, change (number), icon (string emoji). Shows value prominently, change as green (+) or red (-) percentage. Tailwind styling.

Create src/types.ts with StatData interface (label, value, change, icon) and User interface (name, email, role, status).

Create src/data/mock.ts with dashboardStats array (4 items: Total Users 12345 +12.5%, Active Sessions 1234 -3.2%, Revenue $45678 +8.1%, Conversion 3.24% +1.2%).

Update src/pages/Dashboard.tsx to show a 4-column grid of StatCards using mock data. Named exports only.`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "components", "StatCard.tsx"))).toBe(true);
      expect(existsSync(join(projectDir, "src", "types.ts"))).toBe(true);
      expect(existsSync(join(projectDir, "src", "data", "mock.ts"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 5: Create sortable Users table",
    async () => {
      await sendTurn(
        messages,
        `Create src/components/SortableTable.tsx with:
1. A generic sortData<T> function (exported, named export) that sorts an array by a key in asc/desc/null direction using localeCompare.
2. A SortableTable<T> component with columns config, data, and optional renderCell prop. Clicking headers toggles sort (asc → desc → null).

Add mockUsers (5 users with name, email, role, status) to src/data/mock.ts.
Update src/pages/Users.tsx to render SortableTable with user data and columns: name, email, role, status. Use renderCell for status to show a colored badge.

IMPORTANT: Use Record<string, any> as the generic constraint for T to avoid TypeScript index signature issues with interfaces. Named exports only.`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "components", "SortableTable.tsx"))).toBe(true);
      const content = readFileSync(join(projectDir, "src", "components", "SortableTable.tsx"), "utf-8");
      expect(content).toContain("sortData");
      expect(content).toContain("SortableTable");
    },
    120_000,
  );

  it(
    "Turn 6: Create Settings page with form",
    async () => {
      await sendTurn(
        messages,
        `Update src/pages/Settings.tsx with a form containing:
- Dark mode toggle (custom switch button)
- Email notifications checkbox
- Push notifications checkbox
- Save Changes button (indigo colored)
Use React useState for all form state. Tailwind styling. Named export.`,
        config,
      );

      const content = readFileSync(join(projectDir, "src", "pages", "Settings.tsx"), "utf-8");
      expect(content).toContain("useState");
      expect(content.toLowerCase()).toContain("dark");
    },
    120_000,
  );

  it(
    "Turn 7: Write Vitest tests for sortable table (context retention test)",
    async () => {
      await sendTurn(
        messages,
        `Write src/__tests__/SortableTable.test.tsx with Vitest tests for the sortData function and SortableTable component you created in Turn 5.

Test sortData:
- Returns copy when config is null
- Sorts ascending by string key
- Sorts descending by string key
- Returns unsorted when direction is null

Test SortableTable:
- Renders all rows
- Renders column headers
- Sorts on header click

Use @testing-library/react for component tests. Import from the correct path "../components/SortableTable".`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "__tests__", "SortableTable.test.tsx"))).toBe(true);
      const content = readFileSync(join(projectDir, "src", "__tests__", "SortableTable.test.tsx"), "utf-8");
      expect(content).toContain("sortData");
      expect(content).toContain("describe");
    },
    120_000,
  );

  it(
    "Turn 8: Build the project and fix errors",
    async () => {
      await sendTurn(
        messages,
        `Run 'npm run build' in ${projectDir}. If there are TypeScript or build errors, fix them and rebuild until it succeeds. Common issues: missing vitest reference types in vite.config.ts, index signature problems. Fix all of them.`,
        config,
      );

      // Verify build actually works
      const buildResult = execSync("npm run build 2>&1", {
        cwd: projectDir,
        timeout: 60_000,
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
      }).toString();
      expect(buildResult).not.toContain("error TS");
    },
    300_000,
  );

  it(
    "Turn 9: Run tests and fix failures",
    async () => {
      await sendTurn(
        messages,
        `Run 'npx vitest run' in ${projectDir}. If tests fail, read the error, fix the test or source code, and re-run until all tests pass.`,
        config,
      );

      // Verify tests actually pass
      const testResult = execSync("npx vitest run 2>&1", {
        cwd: projectDir,
        timeout: 60_000,
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
      }).toString();
      expect(testResult).toContain("passed");
      expect(testResult).not.toContain("failed");
    },
    300_000,
  );

  it(
    "Turn 10: Show project structure and verify completeness",
    async () => {
      await sendTurn(
        messages,
        `List all .tsx and .ts files in ${projectDir}/src/ recursively. Count the total files. The project should have at least 12 source files.`,
        config,
      );

      // Final verification: count files
      const output = execSync("find src -name '*.tsx' -o -name '*.ts' | wc -l", {
        cwd: projectDir,
      }).toString().trim();
      const fileCount = parseInt(output, 10);
      expect(fileCount).toBeGreaterThanOrEqual(10);

      // Verify context was maintained: check that the agent's messages reference earlier turns
      expect(messages.length).toBeGreaterThanOrEqual(20); // system + 10 user + 10+ assistant + tool calls
    },
    120_000,
  );
});
