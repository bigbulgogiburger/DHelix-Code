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

const STACK_NAME = "Spring Boot + Vue 3 (TypeScript)";
const PROJECT_DIR_NAME = "springboot-vue-taskmanager";
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

function validateBuild(
  command: string,
  cwd: string,
): { success: boolean; output: string } {
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
        ({
          name,
          args,
        }: {
          name: string;
          id: string;
          args?: Record<string, unknown>;
        }) => {
          metrics.toolCalls.push({ turn: currentTurn, tool: name });
          if (
            name === "file_read" &&
            args?.file_path?.toString().includes("DBCODE.md")
          ) {
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
            const msg =
              error instanceof Error ? error.message : String(error);
            if (
              msg.toLowerCase().includes("rate limit") ||
              msg.includes("429")
            ) {
              const wait = 15_000 * (retry + 1); // 15s, 30s, 45s
              console.log(
                `  Rate limited, waiting ${wait / 1000}s before retry ${retry + 1}/3...`,
              );
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
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        metrics.errors.push(`Turn ${currentTurn} (${name}): ${errorMsg}`);
        writeProgress(metrics, currentTurn, name, "failed");
        throw error;
      }
    }

    // ================================================================
    // TURNS — dbcode does ALL the work via runAgentLoop()
    // ================================================================

    // ---- Turn 0: /init — Create DBCODE.md ----
    it(
      "Turn 0: Initialize project with DBCODE.md",
      async () => {
        await sendTurn(
          `Run /init to initialize this project at ${projectDir}. Create a DBCODE.md for a Task Manager application using Spring Boot 3.2 (Gradle Kotlin DSL, Java 17, H2, Spring Data JPA) as backend and Vue 3 (TypeScript, Vite, Pinia, Tailwind CSS) as frontend. Monorepo structure with backend/ and frontend/ directories. Testing: JUnit 5 + JaCoCo (backend), Vitest + Vue Test Utils (frontend). Target 80% coverage. Include:
- Directory structure for both backend and frontend
- Build commands (./gradlew build, npm run build)
- Test commands (./gradlew test jacocoTestReport, npx vitest run --coverage)
- Coding conventions: RESTful endpoints under /api/v1/, Vue 3 Composition API with <script setup>, TypeScript strict mode, Pinia for state management, Tailwind CSS only (no scoped styles)`,
          "Initialize DBCODE.md",
        );

        expect(existsSync(resolve(projectDir, "DBCODE.md"))).toBe(true);
        const content = readFileSync(
          resolve(projectDir, "DBCODE.md"),
          "utf-8",
        );
        expect(content.toLowerCase()).toContain("task manager");
        expect(content.toLowerCase()).toContain("spring boot");
        expect(content.toLowerCase()).toContain("vue");
      },
      180_000,
    );

    // ---- Turn 1: Backend scaffold ----
    it(
      "Turn 1: Create Spring Boot backend scaffold",
      async () => {
        await sendTurn(
          `Create the backend/ directory with a Spring Boot 3.2 Gradle (Kotlin DSL) project. Include dependencies: spring-boot-starter-web, spring-boot-starter-data-jpa, spring-boot-starter-validation, h2, lombok. Add JaCoCo plugin for coverage. Create application.yml with H2 in-memory config (spring.datasource.url=jdbc:h2:mem:taskmanager). Add a main application class. Follow DBCODE.md directory structure exactly.

IMPORTANT: Do NOT use \`gradle init\` or interactive Gradle commands. Write build.gradle.kts and settings.gradle.kts files manually. You may run \`gradle wrapper\` AFTER writing build.gradle.kts to generate the Gradle wrapper.`,
          "Backend scaffold",
        );

        expect(existsSync(resolve(projectDir, "backend/build.gradle.kts"))).toBe(true);
        expect(existsSync(resolve(projectDir, "backend/src/main/java"))).toBe(true);
      },
      300_000,
    );

    // ---- Turn 2: Backend REST API ----
    it(
      "Turn 2: Implement Task REST API",
      async () => {
        await sendTurn(
          `Implement the Task Management REST API. Create a Task entity with fields: id (Long, auto-generated), title (String, required, max 100), description (String, max 500), status (enum: TODO, IN_PROGRESS, DONE, default TODO), priority (enum: LOW, MEDIUM, HIGH, default MEDIUM), dueDate (LocalDate, nullable), createdAt (LocalDateTime, auto-set), updatedAt (LocalDateTime, auto-set). Create: entity with JPA annotations, repository (Spring Data JPA), service layer, DTOs (CreateTaskRequest, UpdateTaskRequest, TaskResponse), and @RestController with full CRUD under /api/v1/tasks. Add @Valid on request bodies. Refer to DBCODE.md for API conventions.`,
          "Backend REST API",
        );

        expect(existsSync(resolve(projectDir, "backend/src/main/java"))).toBe(true);
      },
      300_000,
    );

    // ---- Turn 3: Frontend scaffold ----
    it(
      "Turn 3: Create Vue 3 + TypeScript frontend scaffold",
      async () => {
        await sendTurn(
          `Create frontend/ with a Vue 3 + TypeScript + Vite project. Create it manually (do NOT use npm create vite or any scaffolding CLI — write all files directly). Install dependencies: vue, vue-router, pinia, typescript, vite, @vitejs/plugin-vue, tailwindcss, postcss, autoprefixer, vitest, @vue/test-utils, jsdom, @vitest/coverage-v8. Configure:
- tsconfig.json with strict mode, paths alias (@/ -> src/)
- vite.config.ts with Vue plugin, Vitest setup, and proxy '/api' -> 'http://localhost:8080'
- tailwind.config.js scanning src/**/*.{vue,ts}
- postcss.config.js with tailwindcss and autoprefixer
- src/main.ts mounting the Vue app with router and Pinia
Follow DBCODE.md directory structure: src/components/, src/composables/, src/services/, src/types/, src/views/, src/stores/.`,
          "Frontend scaffold",
        );

        expect(existsSync(resolve(projectDir, "frontend/package.json"))).toBe(true);
        expect(existsSync(resolve(projectDir, "frontend/tsconfig.json"))).toBe(true);
      },
      300_000,
    );

    // ---- Turn 4: Frontend components ----
    it(
      "Turn 4: Build Task Manager Vue components",
      async () => {
        await sendTurn(
          `Build the Task Manager Vue 3 components in frontend/src/ using Composition API with <script setup lang="ts">:
1) types/task.ts — TypeScript interfaces matching backend DTOs (Task, CreateTaskRequest, UpdateTaskRequest, TaskStatus, TaskPriority)
2) services/api.ts — typed fetch wrapper for /api/v1/tasks CRUD operations (getAll, getById, create, update, delete)
3) stores/taskStore.ts — Pinia store for task state management (tasks array, loading, error, CRUD actions)
4) components/TaskCard.vue — displays one task with status badge (color-coded), priority indicator, due date, and action buttons
5) components/TaskList.vue — renders TaskCards in a responsive grid, supports filtering by status
6) components/TaskForm.vue — modal form for creating/editing tasks with validation
7) components/TaskFilter.vue — filter bar with status and priority dropdowns
8) views/TaskBoard.vue — main page composing TaskFilter, TaskList, and TaskForm
Use Tailwind CSS only (no scoped styles per DBCODE.md). All components must use Composition API.`,
          "Frontend components",
        );

        expect(existsSync(resolve(projectDir, "frontend/src/components"))).toBe(true);
        expect(existsSync(resolve(projectDir, "frontend/src/stores"))).toBe(true);
      },
      300_000,
    );

    // ---- Turn 5: Integration ----
    it(
      "Turn 5: Wire up routing, state management, and API integration",
      async () => {
        await sendTurn(
          `Complete the frontend integration:
1) Set up vue-router in src/router/index.ts with routes: / -> TaskBoard view, /tasks/:id -> TaskDetail view (create this view)
2) Create views/TaskDetail.vue — shows full task details with edit/delete capabilities
3) Wire the Pinia taskStore to the API service — all CRUD operations should call the API and update store state
4) Add loading spinners (a simple Tailwind CSS spinner) and error toast/banner for API failures
5) Update App.vue with <RouterView /> and a navigation header with app title
6) Ensure all API calls use the typed fetch wrapper from services/api.ts
Refer to DBCODE.md for conventions.`,
          "Frontend integration",
        );

        expect(existsSync(resolve(projectDir, "frontend/src/router"))).toBe(true);
        expect(existsSync(resolve(projectDir, "frontend/src/views"))).toBe(true);
      },
      300_000,
    );

    // ---- Turn 6: Build both ----
    it(
      "Turn 6: Build backend and frontend",
      async () => {
        await sendTurn(
          `Build both projects and fix any errors:
1. cd ${projectDir}/backend && ./gradlew build -x test
2. cd ${projectDir}/frontend && npm install && npm run build
If any build fails, analyze the error, fix the code, and rebuild. Repeat until both succeed.`,
          "Build validation",
        );

        // Verify backend build
        const backendBuild = validateBuild(
          "./gradlew build -x test",
          resolve(projectDir, "backend"),
        );
        if (!backendBuild.success) {
          console.log(
            "Backend build failed:",
            backendBuild.output.slice(0, 500),
          );
        }
        expect(backendBuild.success).toBe(true);

        // Verify frontend build
        const frontendBuild = validateBuild(
          "npm run build",
          resolve(projectDir, "frontend"),
        );
        if (!frontendBuild.success) {
          console.log(
            "Frontend build failed:",
            frontendBuild.output.slice(0, 500),
          );
        }
        expect(frontendBuild.success).toBe(true);
      },
      600_000,
    );

    // ---- Turn 7: Tests + Coverage ----
    it(
      "Turn 7: Write tests and achieve 80% coverage",
      async () => {
        await sendTurn(
          `Write comprehensive tests targeting 80%+ coverage for BOTH projects:

Backend (JUnit 5 + Mockito + MockMvc):
- TaskControllerTest: MockMvc tests for all CRUD endpoints (GET list, GET by id, POST, PUT, DELETE, validation errors)
- TaskServiceTest: Mockito-based unit tests for all service methods (findAll, findById, create, update, delete, not-found cases)
Run: cd ${projectDir}/backend && ./gradlew test jacocoTestReport

Frontend (Vitest + Vue Test Utils):
- TaskCard.test.ts: renders task info, status badge colors, priority display, emits events
- TaskForm.test.ts: form rendering, input binding, validation, submit/cancel events
- TaskList.test.ts: renders tasks, empty state, filter integration
- taskStore.test.ts: Pinia store actions, state mutations, error handling
- api.test.ts: mock fetch, test all API methods with success and error cases
Run: cd ${projectDir}/frontend && npx vitest run --coverage

Fix any failing tests and re-run until all pass with 80%+ coverage.`,
          "Tests + coverage",
        );

        // Verify backend tests pass
        const backendTest = validateBuild(
          "./gradlew test",
          resolve(projectDir, "backend"),
        );
        expect(backendTest.success).toBe(true);

        // Verify frontend tests pass
        const frontendTest = validateBuild(
          "npx vitest run",
          resolve(projectDir, "frontend"),
        );
        expect(frontendTest.success).toBe(true);
      },
      600_000,
    );

    // ---- Turn 8: DBCODE.md compliance ----
    it(
      "Turn 8: DBCODE.md compliance review",
      async () => {
        await sendTurn(
          `Read DBCODE.md and review the entire project for compliance. Check and fix:
1. All REST endpoints are under /api/v1/
2. Frontend uses Vue 3 Composition API with <script setup> only (no Options API)
3. TypeScript strict mode is enabled
4. State management uses Pinia (not Vuex or raw refs)
5. API client uses a typed fetch wrapper (not raw fetch())
6. Styling uses Tailwind CSS only (no scoped styles, no .css imports except Tailwind)
7. Directory structure matches DBCODE.md specification
List any violations found and fix them.`,
          "DBCODE.md compliance",
        );

        // Verify agent actually read DBCODE.md during the session
        expect(metrics.dbcodeReads.length).toBeGreaterThanOrEqual(2);
      },
      300_000,
    );

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
