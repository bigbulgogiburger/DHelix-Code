# Coding Conventions

> 참조 시점: TypeScript 설정 변경, 코딩 패턴 확인, 이벤트 시스템 작업 시

## TypeScript Config

```json
{
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "bundler",
  "jsx": "react-jsx",
  "jsxImportSource": "react",
  "strict": true,
  "noImplicitAny": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

## Import Rules

- ESM only: `.js` extension in relative imports (`import { foo } from './bar.js'`)
- No circular dependencies — verify with `madge --circular src/`
- Layer boundary: no importing from `cli/` inside `core/`, `llm/`, `tools/`, or `utils/`

## Core Patterns

### Immutability

```typescript
// CORRECT: spread copy
function updateUser(user: User, name: string): User {
  return { ...user, name };
}

// WRONG: mutation
function updateUser(user: User, name: string): User {
  user.name = name; // NEVER
  return user;
}
```

### Error Handling

- Error classes extend `BaseError` from `src/utils/error.ts`
- Zod schemas for all external inputs (config, tool params, API responses)

### Async & Cancellation

- All async — no sync fs operations ever
- Cross-platform paths: always use `src/utils/path.ts` (normalizes to `/`)
- `AbortController`/`AbortSignal` for all cancellable operations

### Event System

- `mitt` library for event emission
- Emit at meaningful state transitions (tool start/complete, agent message, etc.)
- Key events:
  - `agent:assistant-message` — intermediate messages during agent loop
  - `llm:cache-stats` — prompt cache hit/miss monitoring (emitted from `anthropic.ts`)
  - Team coordination events via `src/hooks/team-events.ts`

## Commit Style

- Conventional: `feat(module)`, `fix(module)`, `test(module)`, `refactor(module)`, `chore(module)`
- One logical change per commit
- All checks pass before commit: `npm run check`

## Error Boundary Pattern

- **ErrorBoundary.tsx** (`src/cli/`): React error boundary wrapping the root App component
- Catches render errors and displays crash recovery UI
- Pattern: `componentDidCatch` → log error → render fallback UI with session resume option

## Logger Redaction

- `logger.ts` configures pino with redaction paths for 16 API key patterns
- Prevents accidental secret leakage in log output
- Add new sensitive paths to the redaction list when introducing new auth integrations

## Sandbox Warning

- `sandbox/index.ts` emits a warning when running without OS-level sandboxing enabled
- Non-blocking — execution continues, but warning is logged and shown to user

## MCP Type Patterns

- MCP 타입은 `src/mcp/types.ts`에 정의 — JSON-RPC 2.0 메시지 타입 포함
- 스코프 설정 파일은 `MCPScopeConfigFile` 인터페이스 (`scope-manager.ts`)
- MCP 서버 설정은 `MCPServerConfig` 인터페이스 (`types.ts`)

## Naming Conventions

- 서브에이전트: `agent-types.ts`의 `AgentType` 타입 사용 (explore, plan, general)
- MCP 도구 이름: `mcp__{server}__{tool}` (더블 언더스코어 구분)
- 메모리 파일: `~/.dbcode/projects/{hash}/memory/` 아래 프로젝트 해시 기반

## 주의사항

- `jsxImportSource`는 `react` (ink가 아님) — tsconfig.json에서 확인
- `noUnusedParameters: true` — 미사용 파라미터는 `_` 접두사 필수
- platform-specific 코드는 `src/utils/platform.ts`에 격리
- ErrorBoundary는 App.tsx를 감싸야 함 — Ink render 호출부에서 적용
- `llm:cache-stats` 이벤트 리스너 등록 시 cleanup 필수 (mitt unsubscribe)
