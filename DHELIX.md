# DHELIX.md

This file provides guidance to dhelix (AI coding assistant) when working with code in this repository.

## Build / Test / Lint commands

- `npm install` – install dependencies (Node.js 20+ requirement). Package manager is npm.
- `npm run build` – bundle the CLI with `tsup` (entry `src/index.ts` → `dist/index.js`). Use `npm run dev` for watch mode.
- `npm run test` – run the full Vitest suite; `npm run test:watch` keeps Vitest in watch mode. For a single test target, use Vitest’s native filter: e.g., `npm run test -- --runInBand my-test-name` or `npx vitest run path/to/test.ts`.
- `npm run lint` – lint `src/**/*.{ts,tsx}` via ESLint & TypeScript ESLint rules. `npm run format` runs Prettier over `src/**/*.{ts,tsx}`.
- `npm run typecheck` – strict `tsc --noEmit` with module=ESNext, strict settings, and `jsxImportSource: "react"`. `npm run test:coverage` produces coverage via Vitest + V8.
- `npm run ci` / `npm run check` – compose sequences (`typecheck`, `lint`, `test:coverage`, `build`). `prepublishOnly` runs the same pipeline before publishing.

## High-level architecture

- **Entry point & CLI wiring:** `src/index.ts` boots Commander; commands live under `src/commands/*`, are registered via `commands/registry.ts`, and rely on shared `CommandTool` factories from `tools/registry.ts`. CLI flags feed `config/loader.ts`, `hooks`, and `skill` loading before running the agent loop.
- **Core agent stack:** `src/core` contains the agent loop (`agent-loop.ts`), context manager (`context-manager.ts`), checkpoint/session managers, guardrail hooks, and telemetry. The loop orchestrates LLM calls (via clients in `src/llm/`), tool extraction (`tools/executor.ts`), permissions (`permissions/manager.ts`), and auto-checkpointing before tool execution.
- **Tool abstraction:** `src/tools/definitions/*` define each permitted tool (file I/O, bash, glob/grep, network, helper tools such as `agent` and `todo-write`). Tools register with `ToolRegistry` so the agent loop can find, validate, and execute them consistently. Tool calls flow through strategies defined in `src/llm/tool-call-strategy.ts` to decide synchronous vs. contextual execution.
- **Configuration & hooks:** `src/config/loader.ts` resolves CLI overrides + dotenv, feeding into hook runners (`hooks/loader.ts`, `hooks/runner.ts`). Hooks (SessionStart, etc.) live alongside permission and telemetry events. `SkillManager` (under `src/skills/manager.ts`) loads optional `.dhelix/commands/`/`skills` extensions, keeping command discovery extensible.
- **Session/persistence:** `ContextManager` + `SessionManager` keep message logs, cold storage, compaction, checkpoints, and session metadata in `~/.dhelix/sessions/`. Auto-compaction steps are documented in `CORE_ARCHITECTURE_ANALYSIS.md` – cold storage for tool outputs, summaries at ~83.5% context, and rehydration for hot files. Agents use abort-aware loops with `UsageAggregator` metrics and guardrail filtering before streaming or non-streaming LLM calls.

## Code style conventions

- **ESM + imports:** Always use explicit `.js` extensions in relative imports (e.g., `import { foo } from "./foo.js"`) and prefer named exports (no `default`). Avoid circular dependencies by layering CLI → commands → core/ tools/ → utils/.
- **TypeScript rules:** `strict: true`, `noImplicitAny`, `noUnusedLocals/Parameters`, `exactOptionalPropertyTypes: false`, `isolatedModules`. No `any`—favor `unknown` with guards and Zod schemas for external inputs (configs, tool params, API responses). Async-only APIs; never use sync fs. AbortSignal/AbortController is pervasive for cancellable flows.
- **State & errors:** Immutable data (readonly props, spread copies), centralized error classes extend `BaseError` from `src/utils/error.ts`, and custom errors surface through telemetry events. Path handling uses helpers (e.g., `src/utils/path.ts`) to normalize across platforms.
- **Testing & formatting:** Vitest is the test runner; coverage leverages `@vitest/coverage-v8`. ESLint extends `@eslint/js` + `typescript-eslint` + `react-hooks` rules (hooks enforced even though Ink-based UI), forbidding unused vars/args unless prefixed with `_`. Prettier formatting is applied to `src/**/*.{ts,tsx}`.

## Key technical decisions

- **Commander + Ink CLI:** The CLI relies on `commander` for command parsing and `ink`/React for terminal UI components in `src/cli/`. Headless mode (`--print`, `--output-format`) bypasses interactive UI when needed.
- **LLM tooling & strategy:** `OpenAICompatibleClient` and `ResponsesAPIClient` in `src/llm/` encapsulate API calls. Tool call strategy selection (sync vs streaming) is abstracted in `src/llm/tool-call-strategy.ts` and is consumed by `AgentLoop` to balance LLM replies and tool invocations.
- **Session-aware autopilot:** Context + session managers collaborate with guardrails and checkpointing to support `/rewind`, `/compact`, `memory`, MCP transport layers, and auto-checkpointing mentioned in `CORE_ARCHITECTURE_ANALYSIS.md`. Guardrails live under `src/guardrails` (input/output filtering), while `telemetry` events trace key states.
- **Extensible skills/perms/hooks:** `SkillManager` unlocks custom commands in `.dhelix/commands` and `~/.dhelix/commands`; permission scopes set via `PermissionManager` allow per-tool approval workflows. Hooks (`HookRunner`) fire at SessionStart/ToolCall/etc. to let configs or external scripts react to state changes.
- **Packaging & deployment:** Bundling is handled by `tsup` (entry `src/index.ts`, emits `dist/index.js`). The CLI is published via the `bin/dhelix.mjs` entry point, relying on Node.js 20+ features and `type: module`. DHELIX.md is the canonical instructions file the CLI consumes at runtime to understand project-specific policies.
