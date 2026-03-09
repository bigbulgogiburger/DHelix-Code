import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, rmSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type ChatMessage } from "../../src/llm/provider.js";
import { runAgentLoop, type AgentLoopConfig } from "../../src/core/agent-loop.js";
import { OpenAICompatibleClient } from "../../src/llm/client.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { selectStrategy } from "../../src/llm/tool-call-strategy.js";
import { createEventEmitter } from "../../src/utils/events.js";
import { buildSystemPrompt } from "../../src/core/system-prompt-builder.js";
import { fileReadTool } from "../../src/tools/definitions/file-read.js";
import { fileWriteTool } from "../../src/tools/definitions/file-write.js";
import { fileEditTool } from "../../src/tools/definitions/file-edit.js";
import { bashExecTool } from "../../src/tools/definitions/bash-exec.js";
import { globSearchTool } from "../../src/tools/definitions/glob-search.js";
import { grepSearchTool } from "../../src/tools/definitions/grep-search.js";

// ============================================================
// CONFIGURATION
// ============================================================

const STACK_NAME = "Spring Boot + React (TypeScript)";
const PROJECT_DIR_NAME = "springboot-react-taskboard";
const TOTAL_TURNS = 9;
const MODEL = process.env.E2E_MODEL ?? "gpt-4o";
const hasApiKey = !!process.env.OPENAI_API_KEY;

const projectDir = resolve(__dirname, `../../test-projects/${PROJECT_DIR_NAME}`);
const progressFile = resolve(projectDir, ".e2e-progress.json");

// ============================================================
// MONITORING & PROGRESS
// ============================================================

interface SessionMetrics {
  totalIterations: number;
  turnsCompleted: number;
  dbcodeReads: string[];
  toolCalls: Array<{ turn: number; tool: string }>;
  errors: string[];
}

const startTime = new Date().toISOString();

function writeProgress(
  metrics: SessionMetrics,
  currentTurn: number,
  turnName: string,
  status: "running" | "completed" | "failed",
) {
  try {
    writeFileSync(
      progressFile,
      JSON.stringify(
        {
          currentTurn,
          totalTurns: TOTAL_TURNS,
          turnName,
          status,
          iterations: metrics.totalIterations,
          turnsCompleted: metrics.turnsCompleted,
          dbcodeReads: metrics.dbcodeReads.length,
          dbcodeReadTurns: metrics.dbcodeReads,
          lastToolCall: metrics.toolCalls.at(-1)?.tool ?? "none",
          totalToolCalls: metrics.toolCalls.length,
          errors: metrics.errors,
          startedAt: startTime,
          lastUpdatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch {
    // Progress file is best-effort, don't fail the test
  }
}

// ============================================================
// HELPERS
// ============================================================

function validateBuild(command: string, cwd: string): { success: boolean; output: string } {
  try {
    const output = execSync(command, {
      cwd,
      timeout: 120_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output };
  } catch (err) {
    const error = err as { stderr?: string; stdout?: string };
    return {
      success: false,
      output: `STDOUT: ${error.stdout ?? ""}\nSTDERR: ${error.stderr ?? ""}`,
    };
  }
}

// ============================================================
// TEST SUITE
// ============================================================

describe.skipIf(!hasApiKey)(
  `E2E: ${STACK_NAME} Multi-Turn Session`,
  () => {
    const messages: ChatMessage[] = [];
    let config: AgentLoopConfig;
    let currentTurn = 0;
    const metrics: SessionMetrics = {
      totalIterations: 0,
      turnsCompleted: 0,
      dbcodeReads: [],
      toolCalls: [],
      errors: [],
    };

    // ---- Setup ----
    beforeAll(async () => {
      if (existsSync(projectDir)) {
        rmSync(projectDir, { recursive: true, force: true });
      }
      mkdirSync(projectDir, { recursive: true });

      const client = new OpenAICompatibleClient({
        baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY!,
      });

      const toolRegistry = new ToolRegistry();
      toolRegistry.registerAll([
        fileReadTool,
        fileWriteTool,
        fileEditTool,
        bashExecTool,
        globSearchTool,
        grepSearchTool,
      ]);

      const events = createEventEmitter();

      // Monitor DBCODE.md reads and all tool calls
      events.on(
        "tool:start",
        ({ name, args }: { name: string; id: string; args?: Record<string, unknown> }) => {
          metrics.toolCalls.push({ turn: currentTurn, tool: name });
          if (name === "file_read" && args?.file_path?.toString().includes("DBCODE.md")) {
            metrics.dbcodeReads.push(`Turn ${currentTurn}`);
          }
        },
      );

      const strategy = selectStrategy(MODEL);

      const systemPrompt = buildSystemPrompt({
        toolRegistry,
        workingDirectory: projectDir,
      });

      config = {
        client,
        model: MODEL,
        toolRegistry,
        strategy,
        events,
        workingDirectory: projectDir,
        useStreaming: false,
        maxContextTokens: 128_000,
        maxIterations: 25,
        maxTokens: 16384,
        checkPermission: async () => ({ allowed: true }),
      };

      messages.push({ role: "system", content: systemPrompt });
      writeProgress(metrics, 0, "Setup", "running");
    }, 60_000);

    // ---- sendTurn Helper ----
    async function sendTurn(
      userMessage: string,
      turnName?: string,
    ): Promise<{
      iterations: number;
      lastContent: string;
    }> {
      currentTurn++;
      const name = turnName ?? `Turn ${currentTurn}`;

      // Rate limit avoidance: wait between turns (skip for first turn)
      if (currentTurn > 1) {
        const delay = 5_000; // 5 seconds between turns
        console.log(`  Waiting ${delay / 1000}s before next turn...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      console.log(`\n--- Turn ${currentTurn}/${TOTAL_TURNS}: ${name} ---`);
      console.log(`User: ${userMessage.slice(0, 120)}...`);

      writeProgress(metrics, currentTurn, name, "running");

      // Inject DBCODE.md reference for turns after initial setup
      let enrichedMessage = userMessage;
      const dbcodePath = resolve(projectDir, "DBCODE.md");
      if (currentTurn > 1 && existsSync(dbcodePath)) {
        const dbcodeContent = readFileSync(dbcodePath, "utf-8");
        enrichedMessage = `[Project conventions from DBCODE.md]\n${dbcodeContent}\n\n---\n\n${userMessage}`;
      }

      messages.push({ role: "user", content: enrichedMessage });

      try {
        // Retry wrapper for rate limit errors
        let result;
        let lastError: unknown;
        for (let retry = 0; retry < 3; retry++) {
          try {
            result = await runAgentLoop(config, messages);
            break;
          } catch (error) {
            lastError = error;
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.toLowerCase().includes("rate limit") || msg.includes("429")) {
              const wait = 15_000 * (retry + 1); // 15s, 30s, 45s
              console.log(`  Rate limited, waiting ${wait / 1000}s before retry ${retry + 1}/3...`);
              await new Promise((resolve) => setTimeout(resolve, wait));
              continue;
            }
            throw error; // Non-rate-limit error, don't retry
          }
        }
        if (!result) {
          metrics.errors.push(
            `Turn ${currentTurn} (${name}): ${lastError instanceof Error ? lastError.message : String(lastError)}`,
          );
          writeProgress(metrics, currentTurn, name, "failed");
          throw lastError;
        }

        messages.length = 0;
        messages.push(...result.messages);

        metrics.totalIterations += result.iterations;
        metrics.turnsCompleted++;

        console.log(`  Iterations: ${result.iterations}`);
        console.log(`  Total iterations so far: ${metrics.totalIterations}`);

        writeProgress(metrics, currentTurn, name, "completed");

        const lastMsg = result.messages[result.messages.length - 1];
        return {
          iterations: result.iterations,
          lastContent: lastMsg?.content ?? "",
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        metrics.errors.push(`Turn ${currentTurn} (${name}): ${errorMsg}`);
        writeProgress(metrics, currentTurn, name, "failed");
        throw error;
      }
    }

    // ================================================================
    // TURNS — dbcode does ALL the work via runAgentLoop()
    // ================================================================

    // ---- Turn 0: /init — Create DBCODE.md ----
    it("Turn 0: Initialize project with DBCODE.md", async () => {
      await sendTurn(
        `Run /init to initialize this project at ${projectDir}. Create a DBCODE.md for a Task Board application using Spring Boot 3.2 (Gradle Kotlin DSL, Java 17, H2, Spring Data JPA) as backend and React 18 (TypeScript 5, Vite, Tailwind CSS) as frontend. Monorepo with backend/ and frontend/. Testing: JUnit 5 + JaCoCo (backend), Vitest + React Testing Library (frontend). Target 80% coverage. Include directory structure, build commands, test commands, and coding conventions (RESTful under /api/v1/, functional components only, TypeScript strict, typed fetch wrapper, Tailwind only).`,
        "Initialize DBCODE.md",
      );

      expect(existsSync(resolve(projectDir, "DBCODE.md"))).toBe(true);
      const content = readFileSync(resolve(projectDir, "DBCODE.md"), "utf-8");
      expect(content.toLowerCase()).toContain("task board");
      expect(content.toLowerCase()).toContain("spring boot");
      expect(content.toLowerCase()).toContain("react");
    }, 180_000);

    // ---- Turn 1: Backend scaffold ----
    it("Turn 1: Create Spring Boot backend scaffold", async () => {
      await sendTurn(
        `Create the backend/ directory with a Spring Boot 3.2 Gradle (Kotlin DSL) project. Include dependencies: spring-boot-starter-web, spring-boot-starter-data-jpa, h2, lombok. Add JaCoCo plugin. Create application.yml with H2 in-memory config (spring.datasource.url=jdbc:h2:mem:taskboard). Follow DBCODE.md directory structure exactly.

IMPORTANT: Do NOT use \`gradle init\` or interactive Gradle commands. Write build.gradle.kts and settings.gradle.kts files manually. You may run \`gradle wrapper\` AFTER writing build.gradle.kts to generate the Gradle wrapper.`,
        "Backend scaffold",
      );

      expect(existsSync(resolve(projectDir, "backend/build.gradle.kts"))).toBe(true);
      expect(existsSync(resolve(projectDir, "backend/src/main/java"))).toBe(true);
    }, 180_000);

    // ---- Turn 2: Backend REST API ----
    it("Turn 2: Implement Task REST API", async () => {
      await sendTurn(
        `Implement the REST API for a Task entity with fields: id (Long, auto-generated), title (String, required), description (String), status (enum: TODO, IN_PROGRESS, DONE, default TODO), priority (enum: LOW, MEDIUM, HIGH, default MEDIUM), createdAt (LocalDateTime), updatedAt (LocalDateTime). Create: entity, repository (Spring Data JPA), service, DTOs (CreateTaskDTO, UpdateTaskDTO, TaskResponseDTO), and @RestController with full CRUD under /api/v1/tasks. Refer to DBCODE.md — use @RestController, not @Controller.`,
        "Backend REST API",
      );

      expect(existsSync(resolve(projectDir, "backend/src/main/java"))).toBe(true);
    }, 180_000);

    // ---- Turn 3: Frontend scaffold ----
    it("Turn 3: Create React + TypeScript frontend scaffold", async () => {
      await sendTurn(
        `Create frontend/ with Vite + React + TypeScript project. Create it manually (don't use npm create vite — write the files directly). Install dependencies: react, react-dom, typescript, @vitejs/plugin-react, tailwindcss, postcss, autoprefixer, vitest, @testing-library/react, @testing-library/jest-dom, jsdom. Configure TypeScript strict mode in tsconfig.json. Set up Vitest in vite.config.ts. Add vite proxy: '/api' -> 'http://localhost:8080'. Follow DBCODE.md directory structure: src/components/, src/hooks/, src/services/, src/types/, src/pages/.`,
        "Frontend scaffold",
      );

      expect(existsSync(resolve(projectDir, "frontend/package.json"))).toBe(true);
      expect(existsSync(resolve(projectDir, "frontend/tsconfig.json"))).toBe(true);
    }, 180_000);

    // ---- Turn 4: Frontend components ----
    it("Turn 4: Build Task Board UI components", async () => {
      await sendTurn(
        `Build the Task Board UI components in frontend/src/: 1) types/task.ts — TypeScript interfaces matching backend DTOs. 2) services/api.ts — typed fetch wrapper (not raw fetch) for /api/v1/tasks CRUD. 3) components/TaskCard.tsx — displays one task with status badge and priority indicator. 4) components/TaskList.tsx — renders list of TaskCards grouped by status columns. 5) components/TaskForm.tsx — form for creating/editing tasks. 6) components/StatusFilter.tsx — filter tasks by status. Use Tailwind CSS only (no CSS modules per DBCODE.md). Functional components only.`,
        "Frontend components",
      );

      expect(existsSync(resolve(projectDir, "frontend/src/components"))).toBe(true);
      expect(existsSync(resolve(projectDir, "frontend/src/services"))).toBe(true);
    }, 180_000);

    // ---- Turn 5: Integration ----
    it("Turn 5: Connect frontend to backend + state management", async () => {
      await sendTurn(
        `Connect the frontend to the backend API. 1) Create a custom hook useTaskBoard() in hooks/ that manages task CRUD state. 2) Wire up TaskList to fetch tasks on mount and refresh after mutations. 3) TaskForm should POST/PUT to the API. 4) Add a simple status change dropdown on each TaskCard (no drag-drop needed). 5) Handle loading spinner and error states. 6) Update App.tsx to compose the full page. Refer to DBCODE.md for conventions.`,
        "Frontend integration",
      );

      expect(existsSync(resolve(projectDir, "frontend/src/hooks"))).toBe(true);
    }, 180_000);

    // ---- Turn 6: Build both ----
    it("Turn 6: Build backend and frontend", async () => {
      await sendTurn(
        `Build both projects and fix any errors:
1. cd ${projectDir}/backend && ./gradlew build -x test
2. cd ${projectDir}/frontend && npm install && npm run build
If any build fails, analyze the error, fix the code, and rebuild. Repeat until both succeed.`,
        "Build validation",
      );

      // Verify backend build
      const backendBuild = validateBuild("./gradlew build -x test", resolve(projectDir, "backend"));
      if (!backendBuild.success) {
        console.log("Backend build failed:", backendBuild.output.slice(0, 500));
      }
      expect(backendBuild.success).toBe(true);

      // Verify frontend build
      const frontendBuild = validateBuild("npm run build", resolve(projectDir, "frontend"));
      if (!frontendBuild.success) {
        console.log("Frontend build failed:", frontendBuild.output.slice(0, 500));
      }
      expect(frontendBuild.success).toBe(true);
    }, 600_000);

    // ---- Turn 7: Tests + Coverage ----
    it("Turn 7: Write tests and achieve 80% coverage", async () => {
      await sendTurn(
        `Write comprehensive tests targeting 80%+ coverage for BOTH projects:

Backend (JUnit 5 + Mockito + MockMvc):
- TaskControllerTest: MockMvc tests for all CRUD endpoints (GET, POST, PUT, DELETE)
- TaskServiceTest: Mockito-based unit tests for service methods
Run: cd ${projectDir}/backend && ./gradlew test jacocoTestReport

Frontend (Vitest + React Testing Library):
- TaskCard.test.tsx: render, status badge, priority display
- TaskForm.test.tsx: form submission, validation
- TaskList.test.tsx: renders tasks, empty state
- api.test.ts: mock fetch, test API client methods
Run: cd ${projectDir}/frontend && npx vitest run --coverage

Fix any failing tests and re-run until all pass with 80%+ coverage.`,
        "Tests + coverage",
      );

      // Verify backend tests pass
      const backendTest = validateBuild("./gradlew test", resolve(projectDir, "backend"));
      expect(backendTest.success).toBe(true);

      // Verify frontend tests pass
      const frontendTest = validateBuild("npx vitest run", resolve(projectDir, "frontend"));
      expect(frontendTest.success).toBe(true);
    }, 600_000);

    // ---- Turn 8: DBCODE.md compliance ----
    it("Turn 8: DBCODE.md compliance review", async () => {
      await sendTurn(
        `Read DBCODE.md and review the entire project for compliance. Check and fix:
1. All REST endpoints are under /api/v1/
2. Frontend uses functional components only (no class components)
3. TypeScript strict mode is enabled
4. API client uses a typed fetch wrapper (not raw fetch())
5. Styling uses Tailwind CSS only (no CSS modules, no .css imports except Tailwind)
6. Directory structure matches DBCODE.md specification
List any violations found and fix them.`,
        "DBCODE.md compliance",
      );

      // Verify agent actually read DBCODE.md during the session
      expect(metrics.dbcodeReads.length).toBeGreaterThanOrEqual(2);
    }, 180_000);

    // ---- Final Evaluation ----
    afterAll(() => {
      const report = `
========== E2E SESSION REPORT ==========
Stack: ${STACK_NAME}
Project: ${projectDir}
Model: ${MODEL}
Turns Completed: ${metrics.turnsCompleted} / ${TOTAL_TURNS}
Total Iterations: ${metrics.totalIterations}
Avg Iterations/Turn: ${(metrics.totalIterations / Math.max(metrics.turnsCompleted, 1)).toFixed(1)}
DBCODE.md Reads: ${metrics.dbcodeReads.length} (${metrics.dbcodeReads.join(", ") || "none"})
Total Tool Calls: ${metrics.toolCalls.length}
Errors: ${metrics.errors.length}
${metrics.errors.length > 0 ? "Error Details:\n" + metrics.errors.map((e) => `  - ${e}`).join("\n") : ""}
==========================================`;
      console.log(report);

      writeProgress(metrics, currentTurn, "Complete", "completed");
    });
  },
  { timeout: 1_800_000 },
); // 30 minute total timeout
