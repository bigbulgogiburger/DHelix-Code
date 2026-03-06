import { Command } from "commander";
import { VERSION, APP_NAME, LLM_DEFAULTS } from "./constants.js";

const program = new Command();

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
      // Load dotenv only when running the action (not for --help / --version)
      await import("dotenv/config");

      // Dynamic imports — keep startup fast for --help / --version
      const { join } = await import("node:path");
      const [
        { loadConfig },
        { OpenAICompatibleClient },
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
        { globSearchTool },
        { grepSearchTool },
        { askUserTool },
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
        { contextCommand },
        { copyCommand },
        { exportCommand },
        { forkCommand },
        { outputStyleCommand },
        { renameCommand },
        { costCommand },
        { updateCommand },
      ] = await Promise.all([
        import("./config/loader.js"),
        import("./llm/client.js"),
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
        import("./tools/definitions/glob-search.js"),
        import("./tools/definitions/grep-search.js"),
        import("./tools/definitions/ask-user.js"),
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
        import("./commands/context.js"),
        import("./commands/copy.js"),
        import("./commands/export.js"),
        import("./commands/fork.js"),
        import("./commands/output-style.js"),
        import("./commands/rename.js"),
        import("./commands/cost.js"),
        import("./commands/update.js"),
      ]);

      // Only pass explicitly-set CLI options as overrides
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

      const config = resolved.config;

      const client = new OpenAICompatibleClient({
        baseURL: config.llm.baseUrl,
        apiKey: config.llm.apiKey,
        timeout: config.llm.timeout,
      });

      // Register tools
      const toolRegistry = new ToolRegistry();
      toolRegistry.registerAll([
        fileReadTool,
        fileWriteTool,
        fileEditTool,
        bashExecTool,
        globSearchTool,
        grepSearchTool,
        askUserTool,
      ]);

      // Select tool call strategy
      const strategy = selectStrategy(config.llm.model);

      // Create permission manager
      const permissionManager = new PermissionManager("default");

      // Create context manager
      const contextManager = new ContextManager({
        maxContextTokens: config.llm.contextWindow,
      });

      // Load hook configuration
      const hookConfig = await loadHookConfig(join(process.cwd(), ".dbcode"));
      const hookRunner = new HookRunner(hookConfig);

      // Run SessionStart hooks
      await hookRunner.run("SessionStart", {
        event: "SessionStart",
        workingDirectory: process.cwd(),
      });

      // Resolve additional directories for monorepo/multi-repo support
      if (opts.addDir) {
        const { resolve } = await import("node:path");
        for (const dir of opts.addDir) {
          void resolve(dir);
        }
      }

      // Register slash commands
      const commandRegistry = new CommandRegistry();
      const commands = [
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
        contextCommand,
        copyCommand,
        exportCommand,
        forkCommand,
        outputStyleCommand,
        renameCommand,
        costCommand,
        updateCommand,
      ];
      for (const cmd of commands) {
        commandRegistry.register(cmd);
      }
      setHelpCommands(commands);

      // Headless mode: run prompt and exit
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

      // Handle session resume
      let sessionId: string | undefined;
      const sessionManager = new SessionManager();

      if (opts.continue) {
        sessionId = (await sessionManager.getMostRecentSessionId()) ?? undefined;
      } else if (opts.resume) {
        sessionId = opts.resume;
      }

      // Create new session if none specified
      if (!sessionId) {
        sessionId = await sessionManager.createSession({
          workingDirectory: process.cwd(),
          model: config.llm.model,
        });
      }

      const [{ render }, React, { App }] = await Promise.all([
        import("ink"),
        import("react"),
        import("./cli/App.js"),
      ]);

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
        }),
      );
    },
  );

/**
 * User-friendly error handler — zero stack traces, actionable guidance.
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
      `Error: Cannot connect to ${url}.\nIs the server running? Check with: dbcode --base-url <url>\n`,
    );
  } else if (
    combined.includes("401") ||
    combined.includes("unauthorized") ||
    combined.includes("incorrect api key")
  ) {
    process.stderr.write(
      `Error: Invalid API key.\nSet with: dbcode --api-key <key> or OPENAI_API_KEY env var\n`,
    );
  } else if (
    combined.includes("404") ||
    (combined.includes("not found") && combined.includes("model"))
  ) {
    const model = cause?.model ?? "unknown";
    process.stderr.write(`Error: Model '${model}' not found.\nTry: dbcode --model gpt-4o\n`);
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

// Global error handler
program.parseAsync().catch(handleError);
