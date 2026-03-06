import "dotenv/config";
import { Command } from "commander";
import { render } from "ink";
import { join } from "node:path";
import React from "react";
import { App } from "./cli/App.js";
import { OpenAICompatibleClient } from "./llm/client.js";
import { loadConfig } from "./config/loader.js";
import { VERSION, APP_NAME, LLM_DEFAULTS } from "./constants.js";
import { ToolRegistry } from "./tools/registry.js";
import { selectStrategy } from "./llm/tool-call-strategy.js";
import { PermissionManager } from "./permissions/manager.js";
import { fileReadTool } from "./tools/definitions/file-read.js";
import { fileWriteTool } from "./tools/definitions/file-write.js";
import { fileEditTool } from "./tools/definitions/file-edit.js";
import { bashExecTool } from "./tools/definitions/bash-exec.js";
import { globSearchTool } from "./tools/definitions/glob-search.js";
import { grepSearchTool } from "./tools/definitions/grep-search.js";
import { askUserTool } from "./tools/definitions/ask-user.js";
import { CommandRegistry } from "./commands/registry.js";
import { clearCommand } from "./commands/clear.js";
import { compactCommand } from "./commands/compact.js";
import { helpCommand, setHelpCommands } from "./commands/help.js";
import { modelCommand } from "./commands/model.js";
import { resumeCommand } from "./commands/resume.js";
import { rewindCommand } from "./commands/rewind.js";
import { effortCommand } from "./commands/effort.js";
import { fastCommand } from "./commands/fast.js";
import { simplifyCommand } from "./commands/simplify.js";
import { batchCommand } from "./commands/batch.js";
import { debugCommand } from "./commands/debug.js";
import { mcpCommand } from "./commands/mcp.js";
import { configCommand } from "./commands/config.js";
import { diffCommand } from "./commands/diff.js";
import { doctorCommand } from "./commands/doctor.js";
import { statsCommand } from "./commands/stats.js";
import { contextCommand } from "./commands/context.js";
import { copyCommand } from "./commands/copy.js";
import { exportCommand } from "./commands/export.js";
import { forkCommand } from "./commands/fork.js";
import { outputStyleCommand } from "./commands/output-style.js";
import { renameCommand } from "./commands/rename.js";
import { costCommand } from "./commands/cost.js";
import { updateCommand } from "./commands/update.js";
import { ContextManager } from "./core/context-manager.js";
import { SessionManager } from "./core/session-manager.js";
import { loadHookConfig } from "./hooks/loader.js";
import { HookRunner } from "./hooks/runner.js";
import { runHeadless } from "./cli/headless.js";

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
      const additionalDirs: string[] = [];
      if (opts.addDir) {
        const { resolve } = await import("node:path");
        for (const dir of opts.addDir) {
          additionalDirs.push(resolve(dir));
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

      render(
        React.createElement(App, {
          client,
          model: config.llm.model,
          toolRegistry,
          strategy,
          permissionManager,
          commandRegistry,
          contextManager,
          sessionId,
          showStatusBar: config.ui.statusBar,
        }),
      );
    },
  );

// Global error handler — user-friendly messages, zero stack traces
program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const cause =
    error && typeof error === "object" && "context" in error
      ? (error as { context: Record<string, unknown> }).context
      : undefined;

  // Classify and provide actionable guidance
  const lowerMsg = message.toLowerCase();
  const causeStr = cause ? JSON.stringify(cause).toLowerCase() : "";
  if (
    lowerMsg.includes("connection") ||
    lowerMsg.includes("econnrefused") ||
    causeStr.includes("connection")
  ) {
    const url = cause?.model ?? "the configured endpoint";
    process.stderr.write(
      `Error: Cannot connect to ${url}.\nIs the server running? Check with: dbcode --base-url <url>\n`,
    );
  } else if (lowerMsg.includes("401") || lowerMsg.includes("unauthorized")) {
    process.stderr.write(
      `Error: Invalid API key.\nSet with: dbcode --api-key <key> or OPENAI_API_KEY env var\n`,
    );
  } else if (lowerMsg.includes("404") || lowerMsg.includes("not found")) {
    const model = cause?.model ?? "unknown";
    process.stderr.write(`Error: Model '${model}' not found.\nTry: dbcode --model gpt-4o\n`);
  } else if (lowerMsg.includes("rate limit") || lowerMsg.includes("429")) {
    process.stderr.write(`Error: Rate limited. Please wait a moment and try again.\n`);
  } else {
    process.stderr.write(`Error: ${message}\n`);
    if (cause) {
      process.stderr.write(`Details: ${JSON.stringify(cause)}\n`);
    }
  }
  process.exit(1);
});
