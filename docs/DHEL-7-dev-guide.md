# [DHEL-7] Hook event adapter 초기화 (createHookAdapter → attach) — 개발 가이드

> 생성일: 2026-04-19
> 스택: Node.js / TypeScript (ESM) — Ink CLI + Headless
> 페르소나: **Node.js/TypeScript CLI Architect** — event-driven architecture, AbortSignal lifecycle, per-session state에 정통. dhelix의 4-Layer(CLI ↔ Core ↔ Infrastructure ↔ Leaf)에서 부트스트랩/라이프사이클 경계 설계를 우선시함.

---

## 1. 요구사항 요약

### 비즈니스 목표
`AppEventEmitter`가 발행하는 런타임 이벤트(`tool:start`, `tool:complete`, `context:pre-compact`, `permission:mode-change` 등)를 `HookRunner`로 전달하여, `.dhelix/hooks/*`에 선언된 사용자 훅(PreToolUse/PostToolUse/PreCompact 등)이 실제로 트리거되도록 한다.

### 인수조건
- [x] **AC1** — Ink 대화형 CLI 세션에서 hook adapter가 attach된다 (이미 구현됨: `src/cli/hooks/useAgentLoop.ts:425-433`)
- [ ] **AC2** — 헤드리스(`-p`) 모드 세션에서도 hook adapter가 attach된다
- [ ] **AC3** — 세션 종료 시 `adapter.detach()`가 호출되어 리스너 메모리 누수가 없다
- [ ] **AC4** — 헤드리스 경로에서 `PreToolUse` / `PostToolUse` 훅이 실제 이벤트에 반응해 실행된다 (integration test로 검증)
- [ ] **AC5** — hook adapter 미주입(`hookRunner === undefined`) 시에도 헤드리스 세션이 정상 종료된다 (후방 호환)

### 제약사항 / 주의사항
- `AppEventEmitter`는 **세션 단위로 생성**되므로 adapter 부착 지점은 **세션 진입점**(useAgentLoop, runHeadless)이 맞다. `app-factory.ts`에 옮기면 세션이 공유되어 리스너가 중복 등록되는 리스크가 있음.
- `hookRunner`는 `AppContext`에 이미 존재(`src/bootstrap/app-factory.ts:107`) — 새로 생성하지 말고 주입 체인만 연결.
- Ink 쪽은 React의 `useEffect` cleanup으로 detach 보장. 헤드리스는 `try/finally` 패턴으로 대칭 처리.
- 현재 아키텍처상 createHookAdapter는 `src/hooks/event-emitter-adapter.ts:381`의 factory를 사용 (named export, 절대 default export 금지 — CLAUDE.md 규칙).

---

## 2. 영향 범위 분석

### 수정 대상 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/cli/headless.ts` | 수정 | `HeadlessOptions`에 `hookRunner` 추가 + `createHookAdapter/attach/detach` wiring |
| `src/index.ts` | 수정 | `runHeadless({...})` 호출 시 `hookRunner: ctx.hookRunner` 전달 (L114-L125) |

### 연관 파일 (읽기 전용)

| 파일 | 참조 이유 |
|------|----------|
| `src/cli/hooks/useAgentLoop.ts:420-434` | Ink 경로의 attach/detach 구현 — 동일 패턴을 헤드리스에 적용 |
| `src/hooks/event-emitter-adapter.ts` | `createHookAdapter()` / `HookEventAdapter` 시그니처 |
| `src/hooks/runner.ts` | `HookRunner` 타입 |
| `src/bootstrap/app-factory.ts:92-107` | `hookRunner`가 `AppContext`에 주입되는 지점 (추가 변경 불필요) |
| `src/utils/events.ts` | `AppEventEmitter` 정의 및 `createEventEmitter()` |

### 신규 테스트 파일

| 파일 | 용도 |
|------|------|
| `test/unit/cli/headless-hook-adapter.test.ts` | 헤드리스 세션이 adapter를 attach/detach하는지 단위 검증 (mock HookRunner) |

### DB 변경
없음.

---

## 3. 구현 계획

### Phase 1: `HeadlessOptions` 확장 (5분)

**목표**: `runHeadless`가 `hookRunner`를 옵션으로 받도록 시그니처 확장.

1. `src/cli/headless.ts` — import 추가
   ```ts
   import { createHookAdapter } from "../hooks/event-emitter-adapter.js";
   import { type HookRunner } from "../hooks/runner.js";
   ```
2. `HeadlessOptions` 인터페이스(L45-68)에 필드 추가:
   ```ts
   /** Hook event adapter를 attach하기 위한 공유 HookRunner */
   readonly hookRunner?: HookRunner;
   ```
3. L96-109의 구조 분해 할당에 `hookRunner` 추가.

**검증**: `npm run typecheck` 통과.

---

### Phase 2: 헤드리스 경로에 adapter wiring (15분)

**목표**: `events` 생성 직후 adapter를 attach, 세션 종료 시 try/finally로 detach.

1. `src/cli/headless.ts:111` — `createEventEmitter()` 호출 직후:
   ```ts
   const events = createEventEmitter();

   const hookAdapter = hookRunner
     ? createHookAdapter(events, hookRunner, {
         sessionId,
         workingDirectory: cwd,
       })
     : undefined;
   hookAdapter?.attach();
   ```
2. 에이전트 루프 실행을 감싸는 `try/finally`를 도입하여 정리를 보장. 현재 `runHeadless`의 본문이 try 블록으로 감싸져 있지 않으면 가장 바깥 레벨을 try로 감싸고 finally에서:
   ```ts
   try {
     // ...기존 로직 (루프 실행, 결과 출력)...
   } finally {
     hookAdapter?.detach();
   }
   ```
   이미 try/catch가 있으면 `finally`만 추가.
3. `SessionStart` 훅은 이미 `app-factory.ts:111`에서 한 번 실행되므로 재호출하지 않는다. (Ink 경로와 일관)

**검증**:
- `npm run typecheck && npm run lint`
- 수동: `DHELIX_VERBOSE=1 dhelix -p "hello" --output-format text` 실행 시 훅이 등록된 경우 `tool:*` 이벤트가 HookRunner까지 도달하는지 로그로 확인.

---

### Phase 3: `runHeadless` 호출부 연결 (2분)

**목표**: `AppContext.hookRunner`를 헤드리스로 전파.

1. `src/index.ts:114-125`의 `await runHeadless({...})`에 한 줄 추가:
   ```ts
   hookRunner: ctx.hookRunner,
   ```

**검증**: `npm run typecheck`.

---

### Phase 4: 테스트 (30분)

**목표**: 회귀 방지. mock HookRunner로 adapter 부착 여부를 단위 수준에서 검증.

1. `test/unit/cli/headless-hook-adapter.test.ts` 신규:
   - `createHookAdapter`를 `vi.mock`으로 감시.
   - 최소 옵션으로 `runHeadless({ hookRunner: mockRunner, ... })` 호출.
   - 기대:
     - `createHookAdapter`가 한 번 호출되고, 인자에 `sessionId`/`workingDirectory`가 전달됨.
     - 반환 adapter의 `attach()`가 호출됨.
     - 세션 종료 후 `detach()`가 호출됨(성공/예외 모두).
   - 반대 케이스: `hookRunner`가 `undefined`이면 `createHookAdapter`가 호출되지 않고 세션도 정상 종료.
2. (선택) integration: 실제 PreToolUse 훅 파일을 임시 디렉토리에 두고 `hookRunner.run("PreToolUse", ...)`이 트리거되는지 검증.

**검증**: `npm test -- test/unit/cli/headless-hook-adapter.test.ts --run`.

---

### Phase 5: 아키텍처 검증 및 커밋 (5분)

1. `npm run check` (typecheck + lint + test + build) 전체 통과.
2. `madge --circular src/` 순환 의존 없음 확인.
3. 커밋 메시지: `feat(hooks): wire HookEventAdapter in headless path (DHEL-7)`

---

## 4. 기술 상세

### 핵심 로직
- **Adapter 라이프사이클은 per-session**: `AppEventEmitter`와 1:1로 생성/소멸한다. `HookRunner`는 싱글톤이지만 adapter는 세션별로 별개 인스턴스여야 리스너 중복 등록이 안 생긴다. Ink 경로에서도 `useEffect([events, hookRunner, sessionId])` dependency로 재마운트 시 새 adapter를 만든다.
- **감싼 try/finally**: 헤드리스는 `process.exit()` 또는 예외로 일찍 종료되는 경로가 있어 명시적 `finally` 없이는 listener가 남는다. React는 unmount cleanup으로 자동 처리.
- **세션 훅과의 관계**: `SessionStart` 훅은 이미 부트스트랩(`app-factory.ts:111`)에서 한 번 발행. adapter는 루프 내 이벤트만 중계한다.

### 위험 요소

| 위험 | 영향도 | 대응 방안 |
|------|--------|----------|
| `detach()` 누락 → 리스너 누수 | 낮음 (헤드리스는 프로세스 종료로 회수) | `try/finally`로 대칭 호출 보장 |
| `hookRunner`가 옵셔널인데 호출부 누락 시 silent fail | 중간 | `runHeadless` 내부에서 `hookRunner === undefined`일 때 verbose 로그 1줄 (`[hooks] adapter disabled: no hookRunner`) |
| 이미 다른 경로에서 이중 attach | 낮음 | `useAgentLoop.ts`와 `headless.ts`는 상호 배타적 (if/else) — 교차 가능성 없음 |
| 사용자 훅에서 예외 발생 시 세션 중단 | 중간 | `HookRunner` 자체에 try/catch 있음 — adapter 변경 불필요, 기존 동작 보존 |

### 외부 연동
없음. 순수 내부 wiring.

---

## 5. 병렬 작업 가이드

**생략** — 전체 작업량이 ~1시간 규모의 단일 경로 수정이며, 파일 3개(`headless.ts`, `index.ts`, 테스트 1개)만 터치하는 순차 작업이 효율적.

---

## 참고: Ink 경로의 검증된 구현 (복사 레퍼런스)

`src/cli/hooks/useAgentLoop.ts:420-434`

```ts
// Wire up Hook Event Adapter — connects AppEventEmitter to HookRunner
useEffect(() => {
  if (!hookRunner) return;

  const adapter = createHookAdapter(events, hookRunner, {
    sessionId,
    workingDirectory: process.cwd(),
  });
  adapter.attach();

  return () => {
    adapter.detach();
  };
}, [events, hookRunner, sessionId]);
```

헤드리스 버전은 이 로직의 명령형(try/finally) 번역이다.
