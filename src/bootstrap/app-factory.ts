/**
 * AppFactory — 모든 팩토리를 조율하여 AppContext를 생성
 *
 * index.ts의 부트스트랩 로직을 구조화한 구성 루트(Composition Root).
 * Ink App과 headless mode 모두 동일한 AppContext를 소비합니다.
 *
 * @module bootstrap/app-factory
 */

import { LLM_DEFAULTS } from "../constants.js";
import { type AppContext, type CLIOptions, type ResolvedConfig } from "./types.js";
import { createToolRegistry } from "./tool-registry-factory.js";
import { createCommandRegistry } from "./command-registry-factory.js";

/** 성능 프로파일링용 시작 시간 */
const _startupT0 = performance.now();
const _verbose = !!process.env.DHELIX_VERBOSE;

function _profileLog(label: string, since: number): number {
  const now = performance.now();
  if (_verbose) {
    process.stderr.write(
      `[startup] ${label}: ${(now - since).toFixed(1)}ms (total: ${(now - _startupT0).toFixed(1)}ms)\n`,
    );
  }
  return now;
}

/**
 * CLI 옵션으로부터 완전한 AppContext를 생성합니다.
 *
 * 부트스트랩 순서:
 * 1. 설정 로드 (5단계 계층 병합)
 * 2. LLM 클라이언트 생성
 * 3. ToolRegistry 생성 (빌트인 + 에이전트)
 * 4. 권한/컨텍스트/훅 매니저 초기화
 * 5. 스킬 로드
 * 6. CommandRegistry 생성 (빌트인 + 스킬)
 * 7. MCP 연결 준비
 */
export async function createAppContext(opts: CLIOptions): Promise<AppContext> {
  let _t = performance.now();

  // ── 설정 로드 ──
  const { loadConfig } = await import("../config/loader.js");

  const llmOverrides: Record<string, unknown> = {
    temperature: LLM_DEFAULTS.temperature,
    maxTokens: LLM_DEFAULTS.maxTokens,
    contextWindow: 128_000,
    timeout: 60_000,
  };
  if (opts.model) llmOverrides.model = opts.model;
  if (opts.baseUrl) llmOverrides.baseUrl = opts.baseUrl;
  if (opts.apiKey) llmOverrides.apiKey = opts.apiKey;

  const resolved = await loadConfig({
    llm: llmOverrides as typeof LLM_DEFAULTS & { contextWindow: number; timeout: number },
    verbose: opts.verbose,
  });

  const config = resolved.config as ResolvedConfig;
  _t = _profileLog("config loaded", _t);

  // ── LLM 클라이언트 생성 ──
  const { createLLMClientForModel } = await import("../llm/client-factory.js");
  const client = createLLMClientForModel({
    model: config.llm.model,
    baseURL: config.llm.baseUrl ?? "",
    apiKey: config.llm.apiKey ?? "",
    timeout: config.llm.timeout,
    apiKeyHeader: config.llm.apiKeyHeader,
  });

  // ── 도구 호출 전략 ──
  const { selectStrategy } = await import("../llm/tool-call-strategy.js");
  const strategy = selectStrategy(config.llm.model);

  // ── ToolRegistry ──
  const toolRegistry = await createToolRegistry({
    client,
    model: config.llm.model,
    strategy,
    locale: config.locale,
    tone: config.tone,
    isHeadless: !!opts.print,
  });

  _t = _profileLog("tools registered", _t);

  // ── 권한/컨텍스트/훅 매니저 ──
  const [{ PermissionManager }, { ContextManager }, { loadHookConfig }, { HookRunner }] =
    await Promise.all([
      import("../permissions/manager.js"),
      import("../core/context-manager.js"),
      import("../hooks/loader.js"),
      import("../hooks/runner.js"),
    ]);

  const { join } = await import("node:path");

  const permissionManager = new PermissionManager("default");
  const contextManager = new ContextManager({
    maxContextTokens: config.llm.contextWindow,
  });
  const hookConfig = await loadHookConfig(join(process.cwd(), ".dhelix"));
  const hookRunner = new HookRunner(hookConfig);

  _t = _profileLog("hooks loaded", _t);

  await hookRunner.run("SessionStart", {
    event: "SessionStart",
    workingDirectory: process.cwd(),
  });

  // ── 스킬 로드 ──
  const { SkillManager } = await import("../skills/manager.js");
  const skillManager = new SkillManager();
  await skillManager.loadAll(process.cwd());

  _t = _profileLog("skills loaded", _t);

  // ── CommandRegistry ──
  const commandRegistry = await createCommandRegistry({ skillManager });

  _t = _profileLog("commands registered", _t);

  // ── 세션 매니저 ──
  const { SessionManager } = await import("../core/session-manager.js");
  const sessionManager = new SessionManager();

  // ── MCP 연결 준비 ──
  let mcpConnector: import("../mcp/manager-connector.js").MCPManagerConnector | undefined;
  let mcpManager: import("../mcp/manager.js").MCPManager | undefined;
  try {
    const { MCPManagerConnector } = await import("../mcp/manager-connector.js");
    const { MCPManager } = await import("../mcp/manager.js");

    mcpManager = new MCPManager({
      workingDirectory: process.cwd(),
      toolRegistry,
    });
    mcpConnector = new MCPManagerConnector();
  } catch (err) {
    process.stderr.write(
      `Warning: MCP initialization failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }

  _profileLog("app context ready", _t);

  return {
    client,
    model: config.llm.model,
    toolRegistry,
    strategy,
    permissionManager,
    contextManager,
    sessionManager,
    hookRunner,
    commandRegistry,
    skillManager,
    config,
    mcpConnector,
    mcpManager,
  };
}
