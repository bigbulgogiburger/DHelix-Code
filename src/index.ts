/**
 * 애플리케이션 진입점(Entry Point) — CLI 명령 파싱부터 UI 렌더링까지의 부트스트랩
 *
 * 이 파일은 dhelix 애플리케이션의 메인 실행 파일입니다.
 * Commander.js로 CLI 인자를 파싱하고, 필요한 모듈을 동적 import하여
 * 최종적으로 Ink(React for CLI) 앱을 렌더링합니다.
 *
 * 부트스트랩 흐름:
 * 1. CLI 인자 파싱 (commander)
 * 2. dotenv 로드 (.env 파일에서 환경변수 읽기)
 * 3. 초기 설정 마법사 (첫 실행 시)
 * 4. 동적 import — 필요한 모듈만 로드 (--help, --version은 빠르게 응답)
 * 5. 설정 로드 (5단계 계층 병합)
 * 6. LLM 클라이언트 생성
 * 7. 도구(Tool) 등록
 * 8. 스킬/커맨드 로드 및 등록
 * 9. MCP 서버 연결
 * 10. Ink 앱 렌더링 또는 헤드리스 모드 실행
 *
 * 성능 최적화:
 * - 동적 import로 --help / --version 응답 시간 최소화
 * - Promise.all로 독립 모듈 병렬 로드
 * - 구문 강조, worktree 정리 등은 논블로킹(non-blocking)으로 처리
 */

import { Command } from "commander";
import { VERSION, APP_NAME, LLM_DEFAULTS } from "./constants.js";

/** 시작 시간 기록 — 부트스트랩 성능 프로파일링용 */
const _startupT0 = performance.now();
/** 상세 모드 여부 — DHELIX_VERBOSE 환경변수로 제어 */
const _verbose = !!process.env.DHELIX_VERBOSE;

/**
 * 성능 프로파일링 로그 출력 — 각 초기화 단계의 소요 시간 측정
 *
 * DHELIX_VERBOSE=true일 때만 stderr에 출력됩니다.
 * 부트스트랩이 느릴 때 병목 지점을 찾는 데 유용합니다.
 *
 * @param label - 단계 이름 (예: "dotenv", "dynamic imports")
 * @param since - 이전 단계의 타임스탬프
 * @returns 현재 타임스탬프 (다음 단계 측정용)
 */
function _profileLog(label: string, since: number): number {
  const now = performance.now();
  if (_verbose) {
    process.stderr.write(
      `[startup] ${label}: ${(now - since).toFixed(1)}ms (total: ${(now - _startupT0).toFixed(1)}ms)\n`,
    );
  }
  return now;
}

// Commander.js 인스턴스 생성 — CLI 명령줄 파서
const program = new Command();

// 서브커맨드: dhelix init — 프로젝트 초기화
program
  .command("init")
  .description("Initialize a dhelix project in the current directory")
  .action(async () => {
    const { initProject } = await import("./commands/init.js");
    const result = await initProject(process.cwd());
    if (result.created) {
      process.stdout.write(`Initialized ${APP_NAME} project at ${result.path}\n`);
    } else {
      process.stdout.write(`${APP_NAME} project already initialized at ${result.path}\n`);
    }
  });

// 메인 커맨드 정의 — dhelix [options] [prompt]
program
  .name(APP_NAME)
  .description("AI coding assistant for local/external LLMs")
  .version(VERSION)
  .option("-m, --model <model>", "LLM model name")
  .option("-u, --base-url <url>", "OpenAI-compatible API base URL")
  .option("-k, --api-key <key>", "API key")
  .option("-v, --verbose", "Enable verbose logging", false)
  .option("-c, --continue", "Continue the most recent session")
  .option("-r, --resume <session-id>", "Resume a specific session")
  .option("-p, --print <prompt>", "Headless mode: run prompt and print result")
  .option(
    "--output-format <format>",
    "Output format for headless mode: text, json, stream-json",
    "text",
  )
  .option("--add-dir <dirs...>", "Additional directories to include (monorepo/multi-repo)")
  .action(
    async (opts: {
      model?: string;
      baseUrl?: string;
      apiKey?: string;
      verbose: boolean;
      continue?: boolean;
      resume?: string;
      print?: string;
      outputFormat: string;
      addDir?: string[];
    }) => {
      // ── 단계 1: dotenv 로드 ──
      // 패키지 루트의 .env만 로드 (cwd의 .env는 읽지 않음)
      // dhelix 자체의 기본 설정(API 키, 모델, base URL)을 제공
      let _t = _profileLog("CLI parse", _startupT0);
      const { config: dotenvConfig } = await import("dotenv");
      const { fileURLToPath } = await import("node:url");
      const { dirname, join } = await import("node:path");
      const __pkgDir = dirname(dirname(fileURLToPath(import.meta.url)));
      dotenvConfig({ path: join(__pkgDir, ".env") });
      _t = _profileLog("dotenv", _t);

      // ── 단계 2: 초기 설정 마법사 ──
      // 첫 실행 시 모델과 API 키를 대화형으로 설정
      // 헤드리스 모드(-p)나 API 키가 이미 있으면 건너뜀
      if (!opts.print && !opts.apiKey) {
        const { needsSetup, runSetupWizard } = await import("./cli/setup-wizard.js");
        if (await needsSetup()) {
          const wizardResult = await runSetupWizard();
          // 마법사 결과를 현재 세션의 기본값으로 적용
          if (!opts.model && wizardResult.llm.model) opts.model = wizardResult.llm.model;
          if (!opts.baseUrl && wizardResult.llm.baseUrl) opts.baseUrl = wizardResult.llm.baseUrl;
          if (wizardResult.llm.apiKey) opts.apiKey = wizardResult.llm.apiKey;
        }
      }

      // ── 단계 3: 동적 import ──
      // 필요한 모든 모듈을 Promise.all로 병렬 로드
      // --help / --version일 때는 이 코드에 도달하지 않으므로 빠른 시작 보장
      _t = _profileLog("setup wizard check", _t);
      const [
        { loadConfig },
        { OpenAICompatibleClient },
        { ResponsesAPIClient, isResponsesOnlyModel },
        { ToolRegistry },
        { selectStrategy },
        { PermissionManager },
        { ContextManager },
        { SessionManager },
        { loadHookConfig },
        { HookRunner },
        { fileReadTool },
        { fileWriteTool },
        { fileEditTool },
        { bashExecTool },
        { bashOutputTool },
        { killShellTool },
        { globSearchTool },
        { grepSearchTool },
        { askUserTool },
        { mkdirTool },
        { webFetchTool },
        { webSearchTool },
        { listDirTool },
        { notebookEditTool },
        { createAgentTool },
        { todoWriteTool },
        { CommandRegistry },
        { clearCommand },
        { compactCommand },
        { helpCommand, setHelpCommands },
        { modelCommand },
        { resumeCommand },
        { rewindCommand },
        { effortCommand },
        { fastCommand },
        { simplifyCommand },
        { batchCommand },
        { debugCommand },
        { mcpCommand },
        { configCommand },
        { diffCommand },
        { doctorCommand },
        { statsCommand },
        { analyticsCommand },
        { statusCommand },
        { contextCommand },
        { copyCommand },
        { exportCommand },
        { forkCommand },
        { outputStyleCommand },
        { renameCommand },
        { costCommand },
        { updateCommand },
        { initCommand },
        { planCommand },
        { undoCommand },
        { memoryCommand },
        { keybindingsCommand },
        { reviewCommand },
        { commitCommand },
        { toneCommand },
        { bugCommand },
        { voiceCommand },
        { architectCommand, editorCommand, dualCommand },
      ] = await Promise.all([
        import("./config/loader.js"),
        import("./llm/client.js"),
        import("./llm/responses-client.js"),
        import("./tools/registry.js"),
        import("./llm/tool-call-strategy.js"),
        import("./permissions/manager.js"),
        import("./core/context-manager.js"),
        import("./core/session-manager.js"),
        import("./hooks/loader.js"),
        import("./hooks/runner.js"),
        import("./tools/definitions/file-read.js"),
        import("./tools/definitions/file-write.js"),
        import("./tools/definitions/file-edit.js"),
        import("./tools/definitions/bash-exec.js"),
        import("./tools/definitions/bash-output.js"),
        import("./tools/definitions/kill-shell.js"),
        import("./tools/definitions/glob-search.js"),
        import("./tools/definitions/grep-search.js"),
        import("./tools/definitions/ask-user.js"),
        import("./tools/definitions/mkdir.js"),
        import("./tools/definitions/web-fetch.js"),
        import("./tools/definitions/web-search.js"),
        import("./tools/definitions/list-dir.js"),
        import("./tools/definitions/notebook-edit.js"),
        import("./tools/definitions/agent.js"),
        import("./tools/definitions/todo-write.js"),
        import("./commands/registry.js"),
        import("./commands/clear.js"),
        import("./commands/compact.js"),
        import("./commands/help.js"),
        import("./commands/model.js"),
        import("./commands/resume.js"),
        import("./commands/rewind.js"),
        import("./commands/effort.js"),
        import("./commands/fast.js"),
        import("./commands/simplify.js"),
        import("./commands/batch.js"),
        import("./commands/debug.js"),
        import("./commands/mcp.js"),
        import("./commands/config.js"),
        import("./commands/diff.js"),
        import("./commands/doctor.js"),
        import("./commands/stats.js"),
        import("./commands/analytics.js"),
        import("./commands/status.js"),
        import("./commands/context.js"),
        import("./commands/copy.js"),
        import("./commands/export.js"),
        import("./commands/fork.js"),
        import("./commands/output-style.js"),
        import("./commands/rename.js"),
        import("./commands/cost.js"),
        import("./commands/update.js"),
        import("./commands/init.js"),
        import("./commands/plan.js"),
        import("./commands/undo.js"),
        import("./commands/memory.js"),
        import("./commands/keybindings.js"),
        import("./commands/review.js"),
        import("./commands/commit.js"),
        import("./commands/tone.js"),
        import("./commands/bug.js"),
        import("./commands/voice.js"),
        import("./commands/dual-model.js"),
      ]);

      _t = _profileLog("dynamic imports", _t);

      // ── 단계 4: 설정 로드 ──
      // CLI 플래그를 오버라이드로 전달하여 5단계 계층 병합 수행
      const llmOverrides: Record<string, unknown> = {
        temperature: LLM_DEFAULTS.temperature,
        maxTokens: LLM_DEFAULTS.maxTokens,
        contextWindow: 128_000,
        timeout: 60_000,
      };
      // CLI에서 명시적으로 전달된 옵션만 오버라이드에 추가
      if (opts.model) llmOverrides.model = opts.model;
      if (opts.baseUrl) llmOverrides.baseUrl = opts.baseUrl;
      if (opts.apiKey) llmOverrides.apiKey = opts.apiKey;

      const resolved = await loadConfig({
        llm: llmOverrides as typeof LLM_DEFAULTS & { contextWindow: number; timeout: number },
        verbose: opts.verbose,
      });

      const config = resolved.config;
      _t = _profileLog("config loaded", _t);

      // ── 단계 5: LLM 클라이언트 생성 ──
      // 모델 종류에 따라 적절한 클라이언트 선택:
      // - Responses API 전용 모델 → ResponsesAPIClient (OpenAI o1, o3 등)
      // - 그 외 → OpenAICompatibleClient (Chat Completions API)
      const client = isResponsesOnlyModel(config.llm.model)
        ? new ResponsesAPIClient({
            baseURL: config.llm.baseUrl,
            apiKey: config.llm.apiKey,
            timeout: config.llm.timeout,
          })
        : new OpenAICompatibleClient({
            baseURL: config.llm.baseUrl,
            apiKey: config.llm.apiKey,
            timeout: config.llm.timeout,
            apiKeyHeader: config.llm.apiKeyHeader,
          });

      // ── 단계 6: 도구(Tool) 등록 ──
      // 16개의 기본 도구를 레지스트리에 등록
      // 각 도구는 AI가 파일 읽기, 셸 명령 실행 등을 수행하는 데 사용
      const toolRegistry = new ToolRegistry();
      toolRegistry.registerAll([
        fileReadTool,
        fileWriteTool,
        fileEditTool,
        bashExecTool,
        bashOutputTool,
        killShellTool,
        globSearchTool,
        grepSearchTool,
        askUserTool,
        mkdirTool,
        webFetchTool,
        webSearchTool,
        listDirTool,
        notebookEditTool,
        todoWriteTool,
      ]);

      _t = _profileLog("tools registered", _t);

      // 모델에 맞는 도구 호출 전략(strategy) 선택
      // 모델마다 tool call 형식이 다를 수 있음 (function calling vs tool use)
      const strategy = selectStrategy(config.llm.model);

      // Agent 도구 등록 — 서브에이전트 생성 기능 (클라이언트, 모델, 전략, 도구 필요)
      // tone, autoMemoryContent, repoMapContent는 세션 시작 후
      // useAgentLoop에서 로드되므로 여기서는 초기값만 전달
      toolRegistry.register(
        createAgentTool({
          client,
          model: config.llm.model,
          strategy,
          toolRegistry,
          locale: config.locale,
          tone: config.tone,
          isHeadless: !!opts.print,
        }),
      );

      // ── 단계 7: 권한/컨텍스트/훅 매니저 초기화 ──
      // 도구 실행 시 사용자 확인을 관리하는 권한 매니저
      const permissionManager = new PermissionManager("default");

      // 컨텍스트 윈도우 관리자 — 토큰 사용량 추적, 자동 컴팩션
      const contextManager = new ContextManager({
        maxContextTokens: config.llm.contextWindow,
      });

      // 훅(Hook) 시스템 — 이벤트 기반 자동 작업 (예: 파일 저장 후 린트)
      const hookConfig = await loadHookConfig(join(process.cwd(), ".dhelix"));
      const hookRunner = new HookRunner(hookConfig);

      _t = _profileLog("hooks loaded", _t);

      // 세션 시작 훅 실행
      await hookRunner.run("SessionStart", {
        event: "SessionStart",
        workingDirectory: process.cwd(),
      });

      // 모노레포/멀티레포용 추가 디렉토리 처리
      if (opts.addDir) {
        const { resolve } = await import("node:path");
        for (const dir of opts.addDir) {
          void resolve(dir);
        }
      }

      // ── 단계 8: 스킬 로드 및 슬래시 명령 등록 ──
      // 4개 디렉토리에서 스킬을 로드
      const { SkillManager } = await import("./skills/manager.js");
      const skillManager = new SkillManager();
      await skillManager.loadAll(process.cwd());

      _t = _profileLog("skills loaded", _t);

      // 내장 슬래시 명령 + 스킬 기반 커스텀 명령 등록
      const commandRegistry = new CommandRegistry();
      const commands: import("./commands/registry.js").SlashCommand[] = [
        clearCommand,
        compactCommand,
        helpCommand,
        modelCommand,
        resumeCommand,
        rewindCommand,
        effortCommand,
        fastCommand,
        simplifyCommand,
        batchCommand,
        debugCommand,
        mcpCommand,
        configCommand,
        diffCommand,
        doctorCommand,
        statsCommand,
        analyticsCommand,
        statusCommand,
        contextCommand,
        copyCommand,
        exportCommand,
        forkCommand,
        outputStyleCommand,
        renameCommand,
        costCommand,
        updateCommand,
        initCommand,
        planCommand,
        undoCommand,
        memoryCommand,
        keybindingsCommand,
        reviewCommand,
        commitCommand,
        toneCommand,
        bugCommand,
        voiceCommand,
        architectCommand,
        editorCommand,
        dualCommand,
      ];
      // 사용자 정의 스킬을 /명령어로 변환하여 등록
      const { createSkillCommands } = await import("./skills/command-bridge.js");
      const skillCommands = createSkillCommands(skillManager);
      commands.push(...skillCommands);

      for (const cmd of commands) {
        commandRegistry.register(cmd);
      }
      // /help 명령에서 전체 명령어 목록을 보여주기 위해 설정
      setHelpCommands(commands);

      _t = _profileLog("commands registered", _t);

      // ── 헤드리스 모드: 프롬프트 실행 후 즉시 종료 ──
      // -p "프롬프트" 옵션으로 UI 없이 결과만 출력
      if (opts.print) {
        const { runHeadless } = await import("./cli/headless.js");
        await runHeadless({
          prompt: opts.print,
          client,
          model: config.llm.model,
          strategy,
          toolRegistry,
          outputFormat: opts.outputFormat as "text" | "json" | "stream-json",
          workingDirectory: process.cwd(),
        });
        return;
      }

      // ── 단계 9: 세션 관리 ──
      let sessionId: string | undefined;
      const sessionManager = new SessionManager();

      // -c (--continue): 가장 최근 세션 이어서 사용
      if (opts.continue) {
        sessionId = (await sessionManager.getMostRecentSessionId()) ?? undefined;
        // -r (--resume): 특정 세션 ID로 복원
      } else if (opts.resume) {
        sessionId = opts.resume;
      }

      // 세션이 지정되지 않으면 새 세션 생성
      if (!sessionId) {
        sessionId = await sessionManager.createSession({
          workingDirectory: process.cwd(),
          model: config.llm.model,
        });
      }

      // ── 단계 10: Ink(React for CLI) 앱 렌더링 ──
      const [{ render }, React, { App }, { printStartupLogo }, { patchInkRendering }] =
        await Promise.all([
          import("ink"),
          import("react"),
          import("./cli/App.js"),
          import("./cli/components/Logo.js"),
          import("./cli/renderer/synchronized-output.js"),
        ]);

      // 구문 강조기 사전 초기화 (논블로킹 — 실패해도 앱 시작에 영향 없음)
      import("./cli/renderer/syntax.js").then((m) => m.initHighlighter()).catch(() => {});

      // 시작 로고를 Ink 렌더링 전에 stdout에 출력 — 깜빡임 방지
      printStartupLogo(config.llm.model);

      // 고아 worktree 정리 (논블로킹 — 이전 세션에서 남은 임시 디렉토리 제거)
      import("./subagents/spawner.js")
        .then((m) => m.cleanOrphanedWorktrees(process.cwd()))
        .catch(() => {});

      // ── MCP(Model Context Protocol) 서버 연결 (비동기/논블로킹) ──
      // MCP는 외부 도구 서버와 연결하는 프로토콜
      // UI를 블록하지 않도록 백그라운드에서 연결하고, 완료되면 도구가 자동 등록됨
      let mcpConnector: import("./mcp/manager-connector.js").MCPManagerConnector | undefined;
      let mcpManager: import("./mcp/manager.js").MCPManager | undefined;
      try {
        const { MCPManagerConnector } = await import("./mcp/manager-connector.js");
        const { MCPManager } = await import("./mcp/manager.js");

        mcpManager = new MCPManager({
          workingDirectory: process.cwd(),
          toolRegistry,
        });

        // MCPManagerConnector를 먼저 생성하여 App에 전달 — 도구는 연결 완료 후 등록됨
        mcpConnector = new MCPManagerConnector();

        // MCP 연결은 App 컴포넌트의 useEffect에서 비동기로 수행됨
        // StatusBar에 연결 상태가 표시되고 3초 후 자동 제거됨
      } catch (err) {
        process.stderr.write(
          `Warning: MCP initialization failed: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }

      // 세션 자동 저장 설정 — 주기적으로 세션 메타데이터 갱신
      const { setupAutoSave } = await import("./core/session-auto-save.js");
      const autoSave = setupAutoSave(sessionManager, sessionId);

      // ── 우아한 종료(Graceful Shutdown) 설정 ──
      let shuttingDown = false;
      const shutdown = async (signal: string): Promise<void> => {
        if (shuttingDown) return; // 중복 종료 방지
        shuttingDown = true;

        // 자동 저장 타이머 중지
        autoSave.stop();

        // MCP 서버 연결 해제
        if (mcpManager) {
          await mcpManager.disconnectAll().catch(() => {});
        }
        if (mcpConnector) {
          await mcpConnector.disconnectAll().catch(() => {});
        }

        // Stop 훅 실행 (최선의 노력 — 실패해도 종료 진행)
        await hookRunner
          .run("Stop", {
            event: "Stop",
            workingDirectory: process.cwd(),
          })
          .catch(() => {});

        // 시그널에 따른 종료 코드: SIGTERM(143), SIGINT(130)
        process.exit(signal === "SIGTERM" ? 143 : 130);
      };

      // Ctrl+C (SIGINT)와 kill (SIGTERM) 시그널 처리
      process.on("SIGINT", () => void shutdown("SIGINT"));
      process.on("SIGTERM", () => void shutdown("SIGTERM"));

      // DEC Mode 2026 동기화 출력 패치 — 터미널 깜빡임 방지
      // Ghostty, iTerm2, WezTerm, VSCode 등 지원 터미널에서
      // 각 프레임을 원자적으로 출력하여 렌더링 깜빡임을 제거
      patchInkRendering();

      _profileLog("ready to render", _t);

      // 최종 Ink 앱 렌더링 — React 기반 CLI UI 시작
      render(
        React.createElement(App, {
          client,
          model: config.llm.model,
          toolRegistry,
          strategy,
          permissionManager,
          commandRegistry,
          contextManager,
          sessionManager,
          sessionId,
          showStatusBar: config.ui.statusBar,
          skillManager,
          initialLocale: config.locale,
          initialTone: config.tone,
          mcpConnector,
          mcpManager,
        }),
        { exitOnCtrlC: false },
      );
    },
  );

/**
 * 사용자 친화적 에러 핸들러 — 스택 트레이스 없이 실행 가능한 안내 제공
 *
 * 일반적인 에러 유형(연결 실패, 인증 실패, 모델 없음, 요청 제한)을
 * 감지하여 해결 방법을 함께 안내합니다.
 *
 * @param error - 처리할 에러 객체
 */
function handleError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const cause =
    error && typeof error === "object" && "context" in error
      ? (error as { context: Record<string, unknown> }).context
      : undefined;

  // 에러 메시지와 context를 합쳐서 패턴 매칭
  const lowerMsg = message.toLowerCase();
  const causeStr = cause ? JSON.stringify(cause).toLowerCase() : "";
  const combined = lowerMsg + " " + causeStr;

  // 연결 거부 에러 — 서버가 실행 중인지 확인 안내
  if (
    combined.includes("econnrefused") ||
    (combined.includes("connection") && !combined.includes("401"))
  ) {
    const url = cause?.model ?? "the configured endpoint";
    process.stderr.write(
      `Error: Cannot connect to ${url}.\nIs the server running? Check with: dhelix --base-url <url>\n`,
    );
    // 인증 에러 — API 키 설정 안내
  } else if (
    combined.includes("401") ||
    combined.includes("unauthorized") ||
    combined.includes("incorrect api key")
  ) {
    process.stderr.write(
      `Error: Invalid API key.\nSet with: dhelix --api-key <key> or OPENAI_API_KEY env var\n`,
    );
    // 모델 없음 에러 — 모델명 변경 안내
  } else if (
    combined.includes("404") ||
    (combined.includes("not found") && combined.includes("model"))
  ) {
    const model = cause?.model ?? "unknown";
    process.stderr.write(`Error: Model '${model}' not found.\nTry: dhelix --model gpt-4o\n`);
    // 요청 제한 에러 — 잠시 후 재시도 안내
  } else if (combined.includes("rate limit") || combined.includes("429")) {
    process.stderr.write(`Error: Rate limited. Please wait a moment and try again.\n`);
    // 기타 에러 — 원본 메시지와 상세 정보 출력
  } else {
    process.stderr.write(`Error: ${message}\n`);
    if (cause) {
      process.stderr.write(`Details: ${JSON.stringify(cause)}\n`);
    }
  }
  process.exit(1);
}

// 전역 에러 핸들러 — 처리되지 않은 에러를 사용자 친화적으로 표시
program.parseAsync().catch(handleError);
