import { type LLMProvider, type ChatMessage } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { runAgentLoop } from "../core/agent-loop.js";
import { buildSystemPrompt } from "../core/system-prompt-builder.js";
import { loadInstructions } from "../instructions/loader.js";
import { createEventEmitter } from "../utils/events.js";

/** Output format for headless mode */
export type HeadlessOutputFormat = "text" | "json" | "stream-json";

/** Options for headless execution */
export interface HeadlessOptions {
  /** The user prompt */
  readonly prompt: string;
  /** LLM provider */
  readonly client: LLMProvider;
  /** Model name */
  readonly model: string;
  /** Tool call strategy */
  readonly strategy: ToolCallStrategy;
  /** Tool registry */
  readonly toolRegistry: ToolRegistry;
  /** Output format */
  readonly outputFormat: HeadlessOutputFormat;
  /** Working directory */
  readonly workingDirectory?: string;
  /** Maximum agent iterations */
  readonly maxIterations?: number;
}

/** Structured output for JSON format */
interface HeadlessJsonOutput {
  readonly result: string;
  readonly model: string;
  readonly iterations: number;
  readonly aborted: boolean;
}

/**
 * Run dbcode in headless mode (no interactive UI).
 * Used with `-p` flag for scripting and piped output.
 * Writes output directly to stdout and exits.
 */
export async function runHeadless(options: HeadlessOptions): Promise<void> {
  const {
    prompt,
    client,
    model,
    strategy,
    toolRegistry,
    outputFormat,
    workingDirectory,
    maxIterations,
  } = options;

  const events = createEventEmitter();
  const instructions = await loadInstructions(workingDirectory ?? process.cwd()).catch(() => null);
  const systemPrompt = buildSystemPrompt({
    toolRegistry,
    workingDirectory,
    projectInstructions: instructions?.combined,
  });

  const initialMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  // For stream-json, emit events as NDJSON lines
  if (outputFormat === "stream-json") {
    events.on("llm:text-delta", ({ text }) => {
      process.stdout.write(JSON.stringify({ type: "text-delta", text }) + "\n");
    });
    events.on("tool:start", ({ name, id }) => {
      process.stdout.write(JSON.stringify({ type: "tool-start", name, id }) + "\n");
    });
    events.on("tool:complete", ({ name, id, isError }) => {
      process.stdout.write(JSON.stringify({ type: "tool-complete", name, id, isError }) + "\n");
    });
  }

  const result = await runAgentLoop(
    {
      client,
      model,
      toolRegistry,
      strategy,
      events,
      maxIterations,
      workingDirectory,
    },
    initialMessages,
  );

  // Extract final assistant response
  const lastAssistant = [...result.messages].reverse().find((m) => m.role === "assistant");
  const responseText = lastAssistant?.content ?? "";

  switch (outputFormat) {
    case "text":
      process.stdout.write(responseText + "\n");
      break;
    case "json": {
      const output: HeadlessJsonOutput = {
        result: responseText,
        model,
        iterations: result.iterations,
        aborted: result.aborted,
      };
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
      break;
    }
    case "stream-json":
      // Final result event
      process.stdout.write(
        JSON.stringify({
          type: "result",
          text: responseText,
          iterations: result.iterations,
          aborted: result.aborted,
        }) + "\n",
      );
      break;
  }
}
