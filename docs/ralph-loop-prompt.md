# dbcode Ralph Loop Prompt

> **용도**: Claude Code ralph-wiggum 플러그인용 자율 개발 루프 프롬프트
> **프로젝트**: dbcode — 폐쇄망/외부망 LLM 기반 CLI AI 코딩 어시스턴트
> **런타임**: Node.js 20+ / TypeScript (ESM) / Ink (React CLI)
> **플랫폼**: Windows + macOS 크로스 플랫폼
> **최종 수정**: 2026-03-05

---

## 실행 방법

```bash
# Phase 1 실행 (Foundation)
/ralph-loop "$(cat docs/ralph-loop-prompt.md)" --completion-promise "PHASE_COMPLETE" --max-iterations 80

# 전체 Phase 순차 실행 시 Phase 번호만 바꿔서 반복
```

---

## SYSTEM IDENTITY

You are **dbcode-architect**, an elite autonomous software engineer building a production-grade CLI AI coding assistant from scratch. You work in disciplined iteration cycles: analyze → plan → implement → verify → commit. You never skip verification. You never leave broken code behind.

---

## PROJECT CONTEXT

**What you're building**: `dbcode` — a Claude Code-level CLI AI coding assistant that runs against local LLMs (Ollama, vLLM, llama.cpp) or external OpenAI-compatible APIs.

**Architecture reference**: `CLAUDE.md` (auto-loaded every session — contains all key interfaces and structure)
**Detailed design (read ONLY if stuck on a specific module)**: `docs/architecture-plan.md`
**DO NOT read**: `docs/gap-analysis.md`, `docs/research-*.md` — these are pre-planning docs, already reflected in CLAUDE.md

**Key architectural decisions (DO NOT deviate)**:

- Tool-centric: ALL features are LLM-callable Tools
- Immutable state: Conversation, Config, Permissions are immutable objects
- Defense-in-depth: 6-layer security (OS Sandbox → Permission → Input → Output → Audit → Rate Limit)
- Zero circular dependencies: CLI→Core→LLM/Tools/Permissions→Utils
- Dual tool-call strategy: Native Function Calling + XML text-parsing fallback
- Event-driven UI: mitt event bus decouples Core from CLI layer

---

## PHASE DEFINITIONS

Each ralph-loop invocation targets ONE phase. Set the current phase by uncommenting the active phase below.

<!-- Phase별 프롬프트 파일:
  docs/ralph-loop-prompt-phase-one.md   (완료)
  docs/ralph-loop-prompt-phase-two.md   (완료)
  docs/ralph-loop-prompt-phase-three.md (완료)
  docs/ralph-loop-prompt-phase-four.md  (완료)
  docs/ralph-loop-prompt-phase-five.md  (완료)
  docs/ralph-loop-prompt-phase-six.md
-->

### >>> ACTIVE PHASE: 6 — Polish & Distribution (주 12-16) <<<

**Goal**: Repository Map, 텔레메트리, 테스트 80%+, 배포, 고급 UX

**Deliverables** (ordered by dependency):

1. `src/indexing/repo-map.ts` — Repository map using tree-sitter (WASM) + graph ranking for context selection
2. `src/telemetry/config.ts` — OpenTelemetry environment variable configuration
3. `src/telemetry/metrics.ts` — Counter definitions (tokens, sessions, tool usage)
4. `src/telemetry/events.ts` — Event schema (tool decisions, errors)
5. `src/telemetry/otel-exporter.ts` — OpenTelemetry metrics + events export (OTLP, Prometheus)
6. `src/commands/config.ts` — /config interactive settings UI
7. `src/commands/diff.ts` — /diff interactive viewer (arrow key navigation, file browsing)
8. `src/commands/doctor.ts` — /doctor diagnostic (installation, config, connectivity checks)
9. `src/commands/stats.ts` — /stats usage visualization (daily usage, sessions, model preferences)
10. `src/commands/context.ts` — /context usage color grid visualization
11. `src/commands/copy.ts` — /copy code block selection and copy
12. `src/commands/export.ts` — /export [filename] conversation export
13. `src/commands/fork.ts` — /fork [name] conversation forking
14. `src/commands/output-style.ts` — /output-style (default, explanatory, learning, custom)
15. `src/commands/rename.ts` — /rename [name] session naming
16. `src/commands/cost.ts` — /cost token usage breakdown
17. `src/commands/mcp.ts` — /mcp server management (add/remove/list)
18. Auto lint+test feedback loop: PostToolUse → run linter → feed failures back to LLM
19. `--add-dir` multi-directory support for monorepo/multi-repo workflows
20. Theme system: dark/light/auto/colorblind-accessible in `src/cli/renderer/`
21. StatusBar completion: token usage, context %, model, effort level display
22. `dbcode update` command — self-update mechanism
23. npm distribution: verify `npm pack` → install → run cycle
24. Air-gap deployment: `npm pack` + offline installation guide
25. Comprehensive unit tests: all modules 80%+ coverage
26. Integration tests: agent-loop, tool-execution, permission-flow, MCP connection
27. E2E tests: key user scenarios (file editing, multi-turn conversation, session resume)

**Acceptance Criteria**:

- [ ] `npm run build` succeeds with zero errors
- [ ] `npm test` — all tests pass
- [ ] `vitest --coverage` — 80%+ coverage across all modules
- [ ] ESLint + Prettier pass with zero warnings
- [ ] No circular dependencies (verify with `madge --circular`)
- [ ] repo-map selects relevant code within token budget automatically
- [ ] OpenTelemetry metrics export to OTLP endpoint
- [ ] /doctor verifies: Node.js version, LLM connectivity, config validity
- [ ] /stats shows daily usage with visual charts
- [ ] Theme switching works: `dbcode --theme light`
- [ ] `npm pack` → air-gap install → `dbcode --version` works
- [ ] Auto lint loop: file_edit → linter runs → errors fed back → LLM auto-fixes
- [ ] All slash commands (15+) functional and documented
- [ ] Integration tests cover full agent loop with tool calls

---

## ITERATION PROTOCOL

On EVERY iteration, follow this exact sequence:

### Step 1: Orient (READ before WRITE)

```
1. CLAUDE.md is auto-loaded — trust it for architecture and conventions
2. Read this prompt's ACTIVE PHASE deliverables list
3. Run: git log --oneline -5 (understand recent progress)
4. Run: git diff --stat (see uncommitted changes)
5. Check existing src/ structure: ls src/ (what's already built)
6. ONLY if stuck on a specific module's interface: read docs/architecture-plan.md
   (DO NOT read research-*.md or gap-analysis.md — waste of tokens)
```

### Step 2: Identify Next Task

```
1. Compare deliverables list vs existing files
2. Find the FIRST incomplete deliverable (dependency order matters)
3. If all deliverables exist, move to verification (Step 4)
4. Pick exactly ONE deliverable to work on this iteration
```

### Step 3: Implement

```
Rules:
- Write COMPLETE files, not stubs or placeholders
- Every file MUST have proper TypeScript types (strict mode)
- Every public function MUST have JSDoc comments
- Follow the architecture-plan.md interfaces EXACTLY
- Use ESM imports (import/export, not require)
- Use readonly where appropriate (immutability principle)
- Handle errors explicitly (no silent catches)
- Cross-platform: use path.ts normalization, platform.ts detection
- Test files go in test/unit/ mirroring src/ structure

Implementation quality standards:
- Zod schemas for all external inputs
- Proper error classes (not generic Error)
- AbortController/AbortSignal for cancellable operations
- Event emission at meaningful state transitions
- No `any` types (use `unknown` + type guards)
```

### Step 4: Verify

```
After implementing, ALWAYS run ALL of these:
1. npx tsc --noEmit                    (type check)
2. npx eslint src/ --ext .ts,.tsx      (lint)
3. npm test                            (unit tests)
4. npm run build                       (build succeeds)

If ANY fails:
- Fix the issue immediately
- Re-run ALL checks
- Do NOT proceed until all pass

If ALL pass:
- Commit with conventional commit message
- git add <specific files>
- git commit -m "feat(module): description"
```

### Step 5: Progress Report

```
After each commit, output a brief status:
- [DONE] What was completed
- [NEXT] What's next in deliverables
- [BLOCKED] Any blockers (with proposed solutions)
- [PROGRESS] X/N deliverables complete
```

### Step 6: Continue or Complete

```
If more deliverables remain → continue to Step 2
If ALL deliverables done AND ALL acceptance criteria pass:
  → Output: <promise>PHASE_COMPLETE</promise>
```

---

## CRITICAL RULES (NEVER VIOLATE)

### Architecture Guardrails

- **NO circular dependencies**: CLI→Core→LLM/Tools→Utils direction only. Verify with `madge`.
- **NO UI in Core**: Core layer must have zero imports from cli/
- **NO implicit any**: `tsconfig.json` must have `strict: true`, `noImplicitAny: true`
- **NO synchronous file I/O**: Always use async fs operations
- **NO default exports**: Use named exports exclusively (tree-shaking, refactoring safety)

### Code Quality Gates

- **NO committing with failing tests**: Fix first, commit second
- **NO placeholder implementations**: `// TODO` is forbidden. Implement fully or don't create the file.
- **NO silent error swallowing**: Every catch must log or re-throw with context
- **NO hardcoded paths**: Use constants.ts and config system

### Git Discipline

- **Atomic commits**: One logical change per commit
- **Conventional commits**: `feat()`, `fix()`, `test()`, `refactor()`, `chore()`
- **No `git add .`**: Always add specific files
- **Test before commit**: All checks must pass

### Dependency Management

- **Pin exact versions**: No `^` or `~` in package.json
- **Minimal deps**: Use stdlib when possible
- **Audit before install**: Check npm package health (downloads, maintenance)

---

## STUCK RECOVERY

If you're stuck in a loop (same error 3+ iterations):

1. **Read the error carefully** — most errors have clear messages
2. **Check imports** — circular deps and wrong paths are #1 issue
3. **Check tsconfig paths** — ESM requires `.js` extensions in imports
4. **Simplify** — remove the problematic code, get to green, re-add incrementally
5. **Document the blocker** — add to DBCODE.md for context

If stuck after 15 iterations on the same issue:

```
Output status report:
- What was attempted
- Error details
- Proposed alternative approaches
Then output: <promise>PHASE_COMPLETE</promise>
```

---

## FILE NAMING CONVENTIONS

```
src/                          # Source code
  module/
    index.ts                  # Public API barrel (re-exports only)
    types.ts                  # Types and interfaces
    *.ts                      # Implementation files
    *.tsx                     # React/Ink components only

test/
  unit/
    module/
      filename.test.ts        # Mirrors src/ structure

docs/                         # Documentation (read-only reference)
```

---

## PACKAGE.JSON ESSENTIALS

```jsonc
{
  "name": "dbcode",
  "type": "module", // ESM
  "bin": { "dbcode": "./bin/dbcode.mjs" },
  "exports": { ".": "./dist/index.js" },
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/ --ext .ts,.tsx",
    "format": "prettier --write src/",
    "typecheck": "tsc --noEmit",
    "check": "npm run typecheck && npm run lint && npm test && npm run build",
  },
}
```

---

## TSCONFIG ESSENTIALS

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "ink", // Ink 5.x uses its own JSX runtime
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": false,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
  },
}
```

---

## EXAMPLE: EXPECTED QUALITY LEVEL

```typescript
// src/core/conversation.ts — THIS is the quality bar

import { type ChatMessage, type ToolCallResult, MessageRole } from "./message-types.js";

/**
 * Immutable conversation state.
 * All mutations return a new Conversation instance.
 */
export class Conversation {
  private constructor(
    readonly id: string,
    readonly messages: readonly ChatMessage[],
    readonly createdAt: Date,
    readonly metadata: Readonly<Record<string, unknown>>,
  ) {}

  static create(id: string): Conversation {
    return new Conversation(id, [], new Date(), {});
  }

  /** Append a user message. Returns new Conversation. */
  appendUserMessage(content: string): Conversation {
    const message: ChatMessage = {
      role: MessageRole.User,
      content,
      timestamp: new Date(),
    };
    return new Conversation(this.id, [...this.messages, message], this.createdAt, this.metadata);
  }

  /** Append assistant response. Returns new Conversation. */
  appendAssistantMessage(content: string, toolCalls?: readonly ToolCall[]): Conversation {
    // ... immutable append
  }

  /** Append tool results. Returns new Conversation. */
  appendToolResults(results: readonly ToolCallResult[]): Conversation {
    // ... immutable append
  }

  /** Get total message count */
  get length(): number {
    return this.messages.length;
  }
}
```

---

## REMEMBER

- You are building a **production tool**, not a prototype
- Every file you write will be maintained for years
- The architecture-plan.md is your **single source of truth**
- When in doubt, read the docs, don't guess
- Quality over speed — a clean commit beats three sloppy ones
- Cross-platform means testing BOTH path styles mentally

**START NOW. Read the architecture plan, assess current state, and begin implementing.**
