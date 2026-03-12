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
- Key event: `agent:assistant-message` — intermediate messages during agent loop

## Commit Style

- Conventional: `feat(module)`, `fix(module)`, `test(module)`, `refactor(module)`, `chore(module)`
- One logical change per commit
- All checks pass before commit: `npm run check`

## 주의사항

- `jsxImportSource`는 `react` (ink가 아님) — tsconfig.json에서 확인
- `noUnusedParameters: true` — 미사용 파라미터는 `_` 접두사 필수
- platform-specific 코드는 `src/utils/platform.ts`에 격리
