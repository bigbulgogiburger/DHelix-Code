/**
 * E2E Multi-turn Session Test: FastAPI + SQLite Todo API
 *
 * Uses dbcode's agent-loop to build a FastAPI project incrementally
 * across multiple conversation turns.
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
const projectDir = join(projectRoot, "test-projects", "fastapi-todo");

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
  messages.length = 0;
  messages.push(...result.messages);
  return messages;
}

describe.skipIf(!hasApiKey)("Project 2: FastAPI Todo Multi-turn Session", () => {
  let config: Omit<AgentLoopConfig, "maxIterations" | "maxTokens">;
  let messages: ChatMessage[];
  let totalToolCalls = 0;

  beforeAll(() => {
    if (existsSync(projectDir)) {
      rmSync(projectDir, { recursive: true, force: true });
    }
    mkdirSync(projectDir, { recursive: true });

    const client = new OpenAICompatibleClient({
      baseURL: "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY!,
      timeout: 120_000,
    });

    const toolRegistry = new ToolRegistry();
    toolRegistry.registerAll([
      fileReadTool, fileWriteTool, fileEditTool,
      bashExecTool, globSearchTool, grepSearchTool,
    ]);

    const events = createEventEmitter();
    events.on("tool:complete", () => { totalToolCalls++; });

    config = {
      client,
      model: "gpt-4o",
      toolRegistry,
      strategy: selectStrategy("gpt-4o"),
      events,
      workingDirectory: projectDir,
      useStreaming: false,
      maxContextTokens: 128_000,
    };

    messages = [
      {
        role: "system",
        content: `You are a skilled Python developer. Create files using tools. Working directory: ${projectDir}
Rules:
- Use file_write to create files, bash_exec to run commands.
- Always create complete, working files.
- When running commands, cd to ${projectDir} first.
- Use hashlib+secrets for password hashing (NOT passlib/bcrypt - they have compatibility issues).
- Use PyJWT for JWT tokens.
- Be concise. Create files directly.`,
      },
    ];
  });

  afterAll(() => {
    console.log(`\n[Project 2 Stats] Total tool calls: ${totalToolCalls}, Final messages: ${messages.length}`);
  });

  it(
    "Turn 1: Create FastAPI project structure",
    async () => {
      await sendTurn(
        messages,
        `Create a Python FastAPI project in ${projectDir}:
1. requirements.txt with: fastapi, uvicorn, sqlalchemy, pyjwt, pytest, httpx. NO passlib, NO bcrypt.
2. main.py with a basic FastAPI app and health check endpoint GET /health returning {"status": "ok"}.
3. database.py with SQLAlchemy engine setup using SQLite (./todos.db), SessionLocal, Base, get_db dependency.
Create all files now.`,
        config,
      );

      expect(existsSync(join(projectDir, "requirements.txt"))).toBe(true);
      expect(existsSync(join(projectDir, "main.py"))).toBe(true);
      expect(existsSync(join(projectDir, "database.py"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 2: Create models and schemas",
    async () => {
      await sendTurn(
        messages,
        `Create:
1. models.py with SQLAlchemy models:
   - User: id (int PK), username (str unique), password_hash (str)
   - Todo: id (int PK), title (str), description (str optional), completed (bool default false), created_at (datetime), user_id (FK to users)
2. schemas.py with Pydantic models:
   - UserCreate(username, password), UserResponse(id, username), Token(access_token, token_type)
   - TodoCreate(title, description?), TodoUpdate(title?, description?, completed?), TodoResponse(id, title, description, completed, created_at), PaginatedTodos(items, total, page, per_page)`,
        config,
      );

      expect(existsSync(join(projectDir, "models.py"))).toBe(true);
      expect(existsSync(join(projectDir, "schemas.py"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 3: Create auth utilities and router",
    async () => {
      await sendTurn(
        messages,
        `Create:
1. auth_utils.py with:
   - get_password_hash(password) using hashlib.sha256 + secrets.token_hex(16) salt, returns "salt$hash"
   - verify_password(password, hashed) that splits on $ and compares
   - create_access_token(data, secret="secret-key", expires_minutes=30) using PyJWT
   - get_current_user(token) FastAPI dependency that decodes JWT and returns user from DB
2. routers/auth.py with:
   - POST /auth/register → create user, return UserResponse (201)
   - POST /auth/login → verify credentials, return Token
Include main.py update to register the auth router.`,
        config,
      );

      expect(existsSync(join(projectDir, "auth_utils.py"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 4: Create CRUD todo router",
    async () => {
      await sendTurn(
        messages,
        `Create routers/todos.py with CRUD endpoints (all require authentication via get_current_user dependency):
- POST /todos → create todo for current user (201)
- GET /todos → list current user's todos with pagination (page, per_page query params)
- GET /todos/{id} → get single todo (404 if not found or not owned)
- PUT /todos/{id} → update todo
- DELETE /todos/{id} → delete todo (204)
Register this router in main.py. Make sure main.py creates tables on startup with Base.metadata.create_all.`,
        config,
      );

      expect(existsSync(join(projectDir, "routers", "todos.py"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 5: Create pytest tests",
    async () => {
      await sendTurn(
        messages,
        `Create test_api.py with pytest tests using FastAPI TestClient:
1. Use an in-memory SQLite DB override for get_db dependency
2. Create autouse fixture that creates/drops tables for each test
3. Tests:
   - test_health: GET /health returns 200
   - test_register: POST /auth/register with valid data returns 201
   - test_login: register then login returns access_token
   - test_create_todo: authenticated POST /todos returns 201
   - test_list_todos: GET /todos returns paginated list
   - test_get_todo: GET /todos/{id} returns the todo
   - test_update_todo: PUT /todos/{id} updates fields
   - test_delete_todo: DELETE /todos/{id} returns 204
   - test_unauthorized: GET /todos without token returns 401
   - test_register_duplicate: registering same username twice returns 400
Use a helper function to register+login and get the auth header.`,
        config,
      );

      expect(existsSync(join(projectDir, "test_api.py"))).toBe(true);
      const content = readFileSync(join(projectDir, "test_api.py"), "utf-8");
      expect(content).toContain("def test_");
    },
    120_000,
  );

  it(
    "Turn 6: Install deps and run tests, fix failures",
    async () => {
      await sendTurn(
        messages,
        `In ${projectDir}:
1. Run: pip install -r requirements.txt
2. Run: python -m pytest test_api.py -v
3. If any tests fail, read the error, fix the code, and re-run until ALL tests pass.
Be sure to fix any import errors, missing modules, or logic bugs.`,
        config,
      );

      // Verify tests actually pass
      const result = execSync("python -m pytest test_api.py -q 2>&1", {
        cwd: projectDir,
        timeout: 60_000,
      }).toString();
      expect(result).toContain("passed");
    },
    300_000,
  );

  it(
    "Turn 7: Final verification and file count",
    async () => {
      await sendTurn(
        messages,
        `List all .py files in ${projectDir} and its subdirectories. Count the endpoints in main.py.`,
        config,
      );

      // Verify minimum files
      const files = execSync("find . -name '*.py' | wc -l", { cwd: projectDir }).toString().trim();
      expect(parseInt(files, 10)).toBeGreaterThanOrEqual(5);
      expect(messages.length).toBeGreaterThanOrEqual(14);
    },
    120_000,
  );
});
