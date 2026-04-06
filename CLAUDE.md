# CLAUDE.md — Dhelix Code

CLI AI coding assistant for local/external LLMs. (Double Helix = DNA of your code)
Node.js 20+ / TypeScript 5.x / ESM only / Ink 5.x (React for CLI) / Vitest / tsup / v0.7.0

## Architecture

```mermaid
graph TD
    subgraph CLI["Layer 1: CLI (Ink/React)"]
        APP[ShellLayout + DiffViewer + Accessibility WCAG]
        COMP[27 Components + Panels + AgentTabs]
        HOOKS[7 Hooks + Keyboard FocusManager]
    end
    subgraph CORE["Layer 2: Core (Zero UI imports)"]
        PIPE[RuntimePipeline — 9 Stages + Metrics Collector]
        CTX[Context — Async Compaction + gzip Cold Storage GC]
        SESSION[Sessions — SQLite + Fork/Branch/Merge + Checkpoint]
        SUBAG[Subagents — Manifest + P2P MessageBus + EventStore]
    end
    subgraph INFRA["Layer 3: Infrastructure"]
        LLM[LLM — 8 Providers + Registry + TaskClassifier + A/B + Pool]
        TOOLS[Tools — 29 built-in + 4-Stage Pipeline + Code Mode]
        GUARD[Guardrails — injection, secrets, output masking, ReDoS]
        PERM[Permissions — Policy Engine + Trust T0-T3 + Approval DB]
        MCP_[MCP — Health + A2A + Registry + OAuth PKCE + Streaming]
        LSP[LSP — On-Demand + IDE Integration v2]
        SANDBOX[Sandbox — Seatbelt + Bubblewrap + Container + Env]
    end
    subgraph LEAF["Layer 4: Leaf Modules"]
        UTILS[Utils — logger, events, OTLP, SIEM export]
        CONFIG["Config — 5-layer merge + Policy Bundles"]
        SKILLS[Skills — Typed Manifest + Composer + Plugin Platform]
        MEM[Memory — project-scoped persistence + Search API]
        IDX[Indexing — Tree-Sitter 10 langs + Semantic Vector Search]
    end
    subgraph PLATFORM["Layer 5: Platform Services"]
        DASH[Dashboard — REST API + SSE Event Bridge]
        CLOUD[Cloud — Job Queue + Agent Runner + Result Sync]
        AUTH[Auth — SSO/SAML + OAuth Token Store]
        CMD[Commands — Unified Graph (builtin/mcp/skill/plugin)]
    end

    APP --> PIPE
    PIPE --> LLM & TOOLS & PERM & CTX & SUBAG
    SUBAG --> LLM
    TOOLS --> GUARD & MCP_ & LSP & IDX & SANDBOX
    DASH --> SESSION & MCP_ & SUBAG
    CLOUD --> SUBAG & LLM
    LLM & CONFIG & MEM --> UTILS
```

**Dependency rule**: top -> bottom only. Circular deps forbidden (`madge --circular src/`).

## Commands

```bash
npm run dev          # tsup --watch
npm run build        # tsup (ESM output)
npm test             # vitest run (304 files, 6,475 tests)
npm run test:watch   # vitest
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src/
npm run format       # prettier --write
npm run check        # typecheck + lint + test + build (pre-commit)
npm run ci           # typecheck + lint + coverage + build
```

## Key Rules

- **Named exports only** — no default exports
- **Immutable state** — readonly properties, spread copy for mutations
- **ESM imports** — use `.js` extension (`import { foo } from './bar.js'`)
- **No circular deps** — top layers never import from bottom layers backwards
- **No `any`** — use `unknown` + type guards; Zod for external inputs
- **All async** — no sync fs; use `src/utils/path.ts` for cross-platform paths
- **AbortController** — all cancellable operations use AbortSignal
- **Commit**: `feat(module)`, `fix(module)`, `test(module)`, `refactor(module)` — all checks pass first

## Skills

| Skill                           | When to Use                                     |
| ------------------------------- | ----------------------------------------------- |
| `verify-tool-metadata-pipeline` | After tool definition/executor/display changes  |
| `verify-model-capabilities`     | After LLM model config or default model changes |
| `verify-architecture`           | After new module/import changes/refactoring     |
| `add-slash-command`             | When adding a new slash command                 |
| `add-tool`                      | When adding a new built-in tool                 |
| `debug-test-failure`            | When tests fail and need systematic diagnosis   |
| `sprint-execution`              | When executing improvement plans with agent teams |

## Compact Instructions

When compacting, always preserve:
- Current phase and deliverable progress (X/N complete)
- Recent test failures and their root causes
- Architecture decisions made during this session
- Files created/modified in this session
- Any blockers or workarounds discovered

## Reference Docs

| 문서 | 참조 시점 | 경로 |
|------|----------|------|
| Directory Structure | 파일 위치, 모듈 배치 | `.claude/docs/reference/directory-structure.md` |
| Architecture Deep | RuntimePipeline, 컨텍스트, 서브에이전트 | `.claude/docs/reference/architecture-deep.md` |
| Interfaces & Tools | Tool 추가 (29개), LLM 연동, MCP 브리지 | `.claude/docs/reference/interfaces-and-tools.md` |
| Config & Instructions | DHELIX.md, 설정 계층, MCP 스코프 | `.claude/docs/reference/config-system.md` |
| Skills & Commands | 스킬 개발, 슬래시 명령 | `.claude/docs/reference/skills-and-commands.md` |
| Coding Conventions | TS 설정, 이벤트 패턴, 팀 컨벤션 | `.claude/docs/reference/coding-conventions.md` |
| MCP System | Health + A2A + Registry + OAuth PKCE + Streaming | `.claude/docs/reference/mcp-system.md` |
| Subagents & Teams | P2P MessageBus, 팀 오케스트레이션 | `.claude/docs/reference/subagents-and-teams.md` |
| E2E Test Guide | headless QA, NEXUS.md 패턴 | `.claude/docs/reference/e2e-test-guide.md` |
| Naming & Brand | 네이밍 규칙, 브랜드 컬러, 키보드 단축키, 도구 목록 | `.claude/docs/reference/naming-and-brand.md` |
| LLM Providers | 8개 프로바이더 (Anthropic~Local), benchmark, A/B | `.claude/docs/reference/llm-providers.md` |
| Security & Sandbox | Trust tiers, Policy engine, Seatbelt/Container | `.claude/docs/reference/security-sandbox.md` |
| Dashboard & Cloud | REST API, SSE, Job queue, Agent runner | `.claude/docs/reference/dashboard-cloud.md` |
