import { Command } from "commander";
import { render } from "ink";
import React from "react";
import { App } from "./cli/App.js";
import { OpenAICompatibleClient } from "./llm/client.js";
import { loadConfig } from "./config/loader.js";
import { VERSION, APP_NAME, LLM_DEFAULTS } from "./constants.js";

const program = new Command();

program
  .name(APP_NAME)
  .description("AI coding assistant for local/external LLMs")
  .version(VERSION)
  .option("-m, --model <model>", "LLM model name", LLM_DEFAULTS.model)
  .option("-u, --base-url <url>", "OpenAI-compatible API base URL", LLM_DEFAULTS.baseUrl)
  .option("-k, --api-key <key>", "API key")
  .option("-v, --verbose", "Enable verbose logging", false)
  .action(async (opts: { model: string; baseUrl: string; apiKey?: string; verbose: boolean }) => {
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

    render(
      React.createElement(App, {
        client,
        model: config.llm.model,
        showStatusBar: config.ui.statusBar,
      }),
    );
  });

program.parse();
