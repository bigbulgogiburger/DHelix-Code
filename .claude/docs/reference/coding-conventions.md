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
  - `llm:cache-stats` — prompt cache hit/miss monitoring (Sprint 6, emitted from `anthropic.ts`)

## Commit Style

- Conventional: `feat(module)`, `fix(module)`, `test(module)`, `refactor(module)`, `chore(module)`
- One logical change per commit
- All checks pass before commit: `npm run check`

### Error Boundary Pattern (Sprint 6)

- **ErrorBoundary.tsx** (`src/cli/`): React error boundary wrapping the root App component
- Catches render errors and displays crash recovery UI instead of crashing the CLI
- Pattern: `componentDidCatch` → log error → render fallback UI with session resume option

### Logger Redaction (Sprint 6)

- `logger.ts` configures pino with redaction paths for 16 API key patterns
- Prevents accidental secret leakage in log output
- Add new sensitive paths to the redaction list when introducing new auth integrations

### Sandbox Warning (Sprint 6)

- `sandbox/index.ts` emits a warning when running without OS-level sandboxing enabled
- Non-blocking — execution continues, but warning is logged and shown to user

## 주의사항

- `jsxImportSource`는 `react` (ink가 아님) — tsconfig.json에서 확인
- `noUnusedParameters: true` — 미사용 파라미터는 `_` 접두사 필수
- platform-specific 코드는 `src/utils/platform.ts`에 격리
- ErrorBoundary는 App.tsx를 감싸야 함 — Ink render 호출부에서 적용
- `llm:cache-stats` 이벤트 리스너 등록 시 cleanup 필수 (mitt unsubscribe)
