import { Command } from "commander";
import { render } from "ink";
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
import { ContextManager } from "./core/context-manager.js";
import { SessionManager } from "./core/session-manager.js";

const program = new Command();

program
  .name(APP_NAME)
  .description("AI coding assistant for local/external LLMs")
  .version(VERSION)
  .option("-m, --model <model>", "LLM model name", LLM_DEFAULTS.model)
  .option("-u, --base-url <url>", "OpenAI-compatible API base URL", LLM_DEFAULTS.baseUrl)
  .option("-k, --api-key <key>", "API key")
  .option("-v, --verbose", "Enable verbose logging", false)
  .option("-c, --continue", "Continue the most recent session")
  .option("-r, --resume <session-id>", "Resume a specific session")
  .action(
    async (opts: {
      model: string;
      baseUrl: string;
      apiKey?: string;
      verbose: boolean;
      continue?: boolean;
      resume?: string;
    }) => {
      const resolved = await loadConfig({
        llm: {
          model: opts.model,
          baseUrl: opts.baseUrl,
          apiKey: opts.apiKey,
          temperature: LLM_DEFAULTS.temperature,
          maxTokens: LLM_DEFAULTS.maxTokens,
          contextWindow: 128_000,
          timeout: 60_000,
        },
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
      ];
      for (const cmd of commands) {
        commandRegistry.register(cmd);
      }
      setHelpCommands(commands);

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

program.parse();
