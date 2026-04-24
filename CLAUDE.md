# CLAUDE.md — Dhelix Code

CLI AI coding assistant for local/external LLMs. (Double Helix = DNA of your code)
Node.js 20+ / TypeScript 5.8 / ESM only / Ink 5.1 (React for CLI) / Vitest 3 / tsup 8
`package.json: v0.2.0` (internal v0.7 — GAL-1 Phase 2 Recombination MVP merged)

## Architecture

```mermaid
graph TD
    subgraph CLI["Layer 1: CLI (Ink/React)"]
        LAYOUT[ShellLayout + TranscriptFrame + FooterBar]
        COMP[29 Components + 3 Panels + Accessibility WCAG]
        HOOKS[8 Hooks — useAgentLoop / useVoice / useKeybindings …]
    end
    subgraph CORE["Layer 2: Core (Zero UI imports)"]
        PIPE[RuntimePipeline — 9 Stages + Metrics Collector]
        CTX[Context — Async Compaction + Cold Storage GC]
        SESSION[Session — SQLite + Fork/Branch + Checkpoint]
        SUBAG[Subagents — Manifest + P2P MessageBus + Memory]
        RECOV[Recovery Executor + Circuit Breaker]
        RECOMB[Recombination — /recombination 8-stage · 5 team modules · I-8/9]
    end
    subgraph INFRA["Layer 3: Infrastructure"]
        LLM[LLM — 8 Providers + Registry + TaskClassifier + CostTracker]
        TOOLS[Tools — 29 built-in + 4-Stage Pipeline + Adaptive Schema]
        GUARD[Guardrails — injection / secrets / ReDoS / entropy]
        PERM[Permissions — Trust T0-T3 + ApprovalDB + SIEM Export]
        MCP_[MCP — 3-Scope + Bridge + OAuth PKCE + A2A + Streaming]
        LSP[LSP — On-Demand + IDE Bridge]
        SANDBOX[Sandbox — Seatbelt / Bubblewrap / Container / Env]
    end
    subgraph LEAF["Layer 4: Leaf Modules"]
        UTILS[Utils — logger / events / OTLP / notifications]
        CONFIG[Config — 5-layer merge + Zod schema]
        SKILLS[Skills — Manifest + Composer + Command Bridge]
        MEM[Memory — project-scoped persistence]
        IDX[Indexing — Tree-Sitter 10 langs + Semantic Search]
        AUTH[Auth — Bearer/API-Key + OAuth Token Store]
        PLASMID[Plasmids — Zod schema + loader + runtime-guard I-8]
    end
    subgraph PLATFORM["Layer 5: Platform Services"]
        DASH[Dashboard — REST + WebSocket + SSE Bridge]
        CLOUD[Cloud — Job Queue + Agent Runner + Result Sync]
        CMD[Commands — 40+ builtin incl. /plasmid & /recombination]
        BOOT[Bootstrap — AppFactory + ToolReg + CommandReg]
    end

    BOOT --> PIPE & TOOLS & CMD
    LAYOUT --> PIPE
    PIPE --> LLM & TOOLS & PERM & CTX & SUBAG & RECOV
    SUBAG --> LLM
    TOOLS --> GUARD & MCP_ & LSP & IDX & SANDBOX
    DASH --> SESSION & MCP_ & SUBAG
    CLOUD --> SUBAG & LLM
    RECOMB --> LLM & PLASMID & SKILLS & SUBAG
    CMD --> RECOMB & PLASMID
    LLM & CONFIG & MEM & AUTH & PLASMID --> UTILS
```

**Dependency rule**: top → bottom only. Circular deps forbidden (`madge --circular src/`).

## Commands

```bash
npm run dev          # tsup --watch
npm run build        # tsup (ESM output, code splitting)
npm test             # vitest run (~407 files / ~7,297 tests)
npm run test:watch   # vitest
npm run test:coverage# vitest --coverage
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src/ --ext .ts,.tsx
npm run format       # prettier --write
npm run check        # typecheck + lint + test + build (pre-commit)
npm run quality      # check + madge --circular (full gate)
npm run ci           # typecheck + lint + coverage + build
```

## Key Rules

- **NEVER** add default exports — named exports only (ESM + tree-shaking)
- **NEVER** import from `cli/` inside `core/` / `llm/` / `tools/` / `utils/` — layer violation
- **NEVER** omit `.js` extension on relative imports — ESM requires it (`from './bar.js'`)
- **NEVER** mutate state — return spread copies; entities are `readonly`
- **NEVER** use `any` — use `unknown` + type guards; Zod for all external inputs
- **NEVER** block with sync fs — all I/O async; use `src/utils/path.ts` for cross-platform paths
- **NEVER** omit `AbortSignal` on cancellable operations — propagate to all network/tool calls
- **NEVER** introduce circular deps — verify with `npm run quality` before commit
- **NEVER** let plasmid bodies or `.dhelix/recombination/` contents flow into runtime prompt — I-8 hermeticity is enforced by `src/plasmids/runtime-guard.ts` + loader + tool guardrail
- **Commit**: `feat(module)`, `fix(module)`, `test(module)`, `refactor(module)` — `npm run check` passes first

## Skills

| Skill                           | When to Use                                        |
| ------------------------------- | -------------------------------------------------- |
| `verify-tool-metadata-pipeline` | After tool definition / executor / display changes |
| `verify-model-capabilities`     | After LLM model config or default model changes    |
| `verify-architecture`           | After new module / import / refactor               |
| `verify-implementation`         | General implementation correctness gate            |
| `add-slash-command`             | When adding a new slash command                    |
| `add-tool`                      | When adding a new built-in tool                    |
| `debug-test-failure`            | When tests fail and need systematic diagnosis      |
| `sprint-execution`              | Executing improvement plans with agent teams       |
| `manage-skills` / `create-skill`| Create / modify / organize skills                  |
| `generate-class-docs`           | Generate class/module docs into `guide/`           |
| `dhelix-e2e-test`               | E2E validation (project + conversation quality)    |
| `create-pptx`                   | Generate DB Inc. branded PPTX presentations        |

## Compact Instructions

When compacting, always preserve:

- Current phase and deliverable progress (X/N complete)
- Recent test failures and their root causes
- Architecture decisions made during this session
- Files created/modified in this session
- Any blockers or workarounds discovered

## Reference Docs

| 문서                       | 참조 시점                                                | 경로                                             |
| -------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| Directory Structure        | 파일 위치, 모듈 배치, 신규 디렉토리                      | `.claude/docs/reference/directory-structure.md`  |
| Architecture Deep          | Agent loop, Context compaction, Subagents, Rendering     | `.claude/docs/reference/architecture-deep.md`    |
| Interfaces & Tools         | Tool 추가 (29개), LLM 인터페이스, Tool-Call 전략         | `.claude/docs/reference/interfaces-and-tools.md` |
| Config & Instructions      | DHELIX.md, 5-layer 설정, MCP 3-scope                     | `.claude/docs/reference/config-system.md`        |
| Skills & Commands          | 스킬 개발, 43개 슬래시 명령, Input 히스토리              | `.claude/docs/reference/skills-and-commands.md`  |
| Coding Conventions         | TS 설정, Immutability, Event 시스템, 네이밍              | `.claude/docs/reference/coding-conventions.md`   |
| MCP System                 | 3-Scope, Tool Bridge, Transport, OAuth PKCE, A2A         | `.claude/docs/reference/mcp-system.md`           |
| Subagents & Teams          | Spawner, Worktree 격리, Team Manager, Agent Memory       | `.claude/docs/reference/subagents-and-teams.md`  |
| E2E Test Guide             | headless QA, NEXUS.md 패턴, 채점 가이드                  | `.claude/docs/reference/e2e-test-guide.md`       |
| Naming & Brand             | 네이밍, 브랜드 컬러, 키보드 단축키, 29 도구 카테고리     | `.claude/docs/reference/naming-and-brand.md`     |
| LLM Providers              | 8개 프로바이더, Registry, TaskClassifier, DualModel      | `.claude/docs/reference/llm-providers.md`        |
| Security & Sandbox         | Trust T0-T3, Sandbox 5-layer, Guardrails, SIEM           | `.claude/docs/reference/security-sandbox.md`     |
| Dashboard & Cloud          | REST / SSE, Job Queue, Agent Runner, SSO/SAML            | `.claude/docs/reference/dashboard-cloud.md`      |
| Recent Fixes               | 최근 수정 이력, QA 결과, Local 프로바이더 이슈           | `.claude/docs/reference/recent-fixes.md`         |
| **Recombination Pipeline** | `/recombination` · 8-stage · I-1/3/5/7/8/9/10 · marker grammar · 5 team modules | `.claude/docs/reference/recombination-pipeline.md` |
| **Harness Engineering**    | `HARNESS_MODE`, Jira+harness 워크플로, dhelix-* 에이전트 디스패치 규칙, `.claude/runtime/` 아티팩트 | `.claude/docs/reference/harness-engineering.md` |

## Harness (one-liner)

`HARNESS_MODE` (settings.local.json env)은 `auto|suggest|off`. 상세 워크플로/디스패치/아티팩트 경로는 위 **Harness Engineering** 참조 문서.

---

Last Updated: 2026-04-24
