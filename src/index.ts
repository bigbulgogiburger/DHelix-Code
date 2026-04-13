/**
 * 애플리케이션 진입점(Entry Point) — CLI 파싱 → AppContext 생성 → 렌더링
 *
 * 부트스트랩 로직은 src/bootstrap/app-factory.ts에 위임합니다.
 * 이 파일은 CLI 인자 파싱과 최종 렌더링/헤드리스 분기만 담당합니다.
 *
 * @module index
 */

import { Command } from "commander";
import { VERSION, APP_NAME } from "./constants.js";

const program = new Command();

// 서브커맨드: dhelix init
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

// 메인 커맨드
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
      // ── dotenv 로드 ──
      const { config: dotenvConfig } = await import("dotenv");
      const { fileURLToPath } = await import("node:url");
      const { dirname, join } = await import("node:path");
      const __pkgDir = dirname(dirname(fileURLToPath(import.meta.url)));
      dotenvConfig({ path: join(__pkgDir, ".env") });

      // ── 초기 설정 마법사 ──
      if (!opts.print && !opts.apiKey) {
        const { needsSetup, runSetupWizard } = await import("./cli/setup-wizard.js");
        if (await needsSetup()) {
          const wizardResult = await runSetupWizard();
          if (!opts.model && wizardResult.llm.model) opts.model = wizardResult.llm.model;
          if (!opts.baseUrl && wizardResult.llm.baseUrl) opts.baseUrl = wizardResult.llm.baseUrl;
          if (wizardResult.llm.apiKey) opts.apiKey = wizardResult.llm.apiKey;
        }
      }

      // ── AppContext 생성 (전체 부트스트랩) ──
      const { createAppContext } = await import("./bootstrap/app-factory.js");
      const ctx = await createAppContext(opts);

      // ── 헤드리스 모드 ──
      if (opts.print) {
        const { runHeadless } = await import("./cli/headless.js");
        await runHeadless({
          prompt: opts.print,
          client: ctx.client,
          model: ctx.model,
          strategy: ctx.strategy,
          toolRegistry: ctx.toolRegistry,
          outputFormat: opts.outputFormat as "text" | "json" | "stream-json",
          workingDirectory: process.cwd(),
        });
        return;
      }

      // ── 세션 관리 ──
      let sessionId: string | undefined;
      if (opts.continue) {
        sessionId = (await ctx.sessionManager.getMostRecentSessionId()) ?? undefined;
      } else if (opts.resume) {
        sessionId = opts.resume;
      }
      if (!sessionId) {
        sessionId = await ctx.sessionManager.createSession({
          workingDirectory: process.cwd(),
          model: ctx.model,
        });
      }

      // ── Ink 렌더링 ──
      const [{ render }, React, { App }, { printStartupLogo }, { patchInkRendering }] =
        await Promise.all([
          import("ink"),
          import("react"),
          import("./cli/App.js"),
          import("./cli/components/Logo.js"),
          import("./cli/renderer/synchronized-output.js"),
        ]);

      // 논블로킹 초기화
      import("./cli/renderer/syntax.js").then((m) => m.initHighlighter()).catch(() => {});
      printStartupLogo(ctx.model);
      import("./subagents/spawner.js")
        .then((m) => m.cleanOrphanedWorktrees(process.cwd()))
        .catch(() => {});

      // 세션 자동 저장
      const { setupAutoSave } = await import("./core/session-auto-save.js");
      const autoSave = setupAutoSave(ctx.sessionManager, sessionId);

      // 우아한 종료
      let shuttingDown = false;
      const shutdown = async (signal: string): Promise<void> => {
        if (shuttingDown) return;
        shuttingDown = true;
        autoSave.stop();
        if (ctx.mcpManager) {
          await ctx.mcpManager.disconnectAll().catch(() => {});
        }
        if (ctx.mcpConnector) {
          await ctx.mcpConnector.disconnectAll().catch(() => {});
        }
        await ctx.hookRunner
          .run("Stop", { event: "Stop", workingDirectory: process.cwd() })
          .catch(() => {});
        process.exit(signal === "SIGTERM" ? 143 : 130);
      };
      process.on("SIGINT", () => void shutdown("SIGINT"));
      process.on("SIGTERM", () => void shutdown("SIGTERM"));

      patchInkRendering();

      render(
        React.createElement(App, {
          client: ctx.client,
          model: ctx.model,
          toolRegistry: ctx.toolRegistry,
          strategy: ctx.strategy,
          permissionManager: ctx.permissionManager,
          commandRegistry: ctx.commandRegistry,
          contextManager: ctx.contextManager,
          sessionManager: ctx.sessionManager,
          sessionId,
          showStatusBar: ctx.config.ui.statusBar,
          skillManager: ctx.skillManager,
          initialLocale: ctx.config.locale,
          initialTone: ctx.config.tone,
          mcpConnector: ctx.mcpConnector,
          mcpManager: ctx.mcpManager,
        }),
        { exitOnCtrlC: false },
      );
    },
  );

/**
 * 사용자 친화적 에러 핸들러
 */
function handleError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const cause =
    error && typeof error === "object" && "context" in error
      ? (error as { context: Record<string, unknown> }).context
      : undefined;

  const lowerMsg = message.toLowerCase();
  const causeStr = cause ? JSON.stringify(cause).toLowerCase() : "";
  const combined = lowerMsg + " " + causeStr;

  if (
    combined.includes("econnrefused") ||
    (combined.includes("connection") && !combined.includes("401"))
  ) {
    const url = cause?.model ?? "the configured endpoint";
    process.stderr.write(
      `Error: Cannot connect to ${url}.\nIs the server running? Check with: dhelix --base-url <url>\n`,
    );
  } else if (
    combined.includes("401") ||
    combined.includes("unauthorized") ||
    combined.includes("incorrect api key")
  ) {
    process.stderr.write(
      `Error: Invalid API key.\nSet with: dhelix --api-key <key> or OPENAI_API_KEY env var\n`,
    );
  } else if (
    combined.includes("404") ||
    (combined.includes("not found") && combined.includes("model"))
  ) {
    const model = cause?.model ?? "unknown";
    process.stderr.write(`Error: Model '${model}' not found.\nTry: dhelix --model gpt-4o\n`);
  } else if (combined.includes("rate limit") || combined.includes("429")) {
    process.stderr.write(`Error: Rate limited. Please wait a moment and try again.\n`);
  } else {
    process.stderr.write(`Error: ${message}\n`);
    if (cause) {
      process.stderr.write(`Details: ${JSON.stringify(cause)}\n`);
    }
  }
  process.exit(1);
}

program.parseAsync().catch(handleError);
