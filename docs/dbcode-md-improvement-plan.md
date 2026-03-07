# DBCODE.md 처리 개선 기획서

> Date: 2026-03-07
> Author: Claude Opus 4.6 (Anthropic AI Coding CLI Agent 전문가)
> Status: Draft

---

## 1. Claude Code의 CLAUDE.md 처리 방식 (역공학 분석)

### 1.1 핵심 원칙: "인프라 수준 주입, 도구 호출 불필요"

Claude Code에서 CLAUDE.md는 **agent가 tool로 읽는 파일이 아니다**.
시스템 인프라가 자동으로 로드하여 **모든 LLM 호출의 system context에 포함**한다.

```
┌─────────────────────────────────────────────────────────────┐
│  Claude Code의 CLAUDE.md 처리 아키텍처                        │
│                                                             │
│  [Startup]                                                  │
│    ├─ Scan: ~/.claude/CLAUDE.md              (global)       │
│    ├─ Scan: ~/.claude/rules/*.md             (global rules) │
│    ├─ Scan: {project}/CLAUDE.md              (project)      │
│    ├─ Scan: {project}/.claude/rules/*.md     (project rules)│
│    └─ Scan: {project}/CLAUDE.local.md        (local, git-   │
│                                                ignored)     │
│                                                             │
│  [Every LLM Call]                                           │
│    └─ System prompt에 전체 내용 포함 (# claudeMd 섹션)         │
│       ├─ 파일 경로 + 출처 레이블 표시                          │
│       │   "Contents of ~/.claude/rules/git.md               │
│       │    (user's private global instructions)"            │
│       └─ 우선순위: global < global rules < project < local   │
│                                                             │
│  [Compaction 발생 시]                                        │
│    └─ 디스크에서 CLAUDE.md를 다시 읽음                         │
│       (세션 중 agent가 수정했을 수 있으므로)                     │
│                                                             │
│  [Agent의 역할]                                              │
│    └─ file_read로 CLAUDE.md를 읽을 필요 없음                  │
│       (이미 system context에 있으므로)                         │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 실제 동작 관찰 (현재 세션 기준)

현재 이 대화의 system prompt에서 관찰되는 CLAUDE.md 처리:

```
# claudeMd
Codebase and user instructions are shown below.
IMPORTANT: These instructions OVERRIDE any default behavior...

Contents of /Users/pyeondohun/.claude/rules/agents.md
  (user's private global instructions for all projects):
  → Agent Orchestration 설정, 사용법 등

Contents of /Users/pyeondohun/.claude/rules/coding-style.md
  → PEP 8, type annotations, black/isort/ruff

Contents of /Users/pyeondohun/development/dbcode/CLAUDE.md
  (project instructions, checked into the codebase):
  → 프로젝트 전체 아키텍처, 코딩 컨벤션, 레이어 구조
```

핵심 관찰:
1. **매 호출마다 포함** — agent가 file_read 없이도 컨벤션 인지
2. **출처 레이블** — "(user's private global)" vs "(project instructions)" 구분
3. **Override 명시** — "These instructions OVERRIDE any default behavior"
4. **병합 순서** — global rules → project CLAUDE.md 순서로 제시
5. **변경 감지** — compaction 시 디스크에서 재로드

### 1.3 Claude Code가 CLAUDE.md를 읽지 않아도 되는 이유

| 측면 | 설명 |
|------|------|
| 항상 존재 | System prompt에 포함되어 있으므로 매 iteration에서 참조 가능 |
| 토큰 효율 | file_read tool call = 1 iteration 소모. 시스템 주입은 0 iteration |
| 일관성 | Agent가 "읽을지 말지" 판단할 필요 없음. 항상 최신 상태 |
| 컨텍스트 우선순위 | System prompt에 있으므로 compaction에서 절대 제거되지 않음 |

---

## 2. 현재 dbcode의 DBCODE.md 처리 현황

### 2.1 현재 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  dbcode 현재 DBCODE.md 처리                                  │
│                                                             │
│  [Startup — 1회만]                                          │
│    └─ buildSystemPrompt(workingDirectory)                   │
│       └─ loadProjectInstructions(cwd)                       │
│          ├─ {cwd}/.dbcode/DBCODE.md 확인                    │
│          └─ {cwd}/DBCODE.md 확인                            │
│          → system message에 포함                             │
│                                                             │
│  [Agent Loop — 매 iteration]                                │
│    └─ system message는 초기 값 그대로 사용                    │
│       (DBCODE.md 변경/생성 반영 안 됨)                        │
│                                                             │
│  [Compaction 발생 시]                                        │
│    └─ reloadSystemPrompt()                                  │
│       └─ loadInstructions(workingDirectory)                  │
│          → 5-layer 병합 (global → rules → project → local)  │
│          → 새 system message 생성                            │
│                                                             │
│  [/init 명령 실행 시]                                        │
│    └─ DBCODE.md 파일 생성                                    │
│       → 시스템 프롬프트에 반영 안 됨 ← ★ 핵심 문제            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 발견된 문제점

#### Problem 1: /init 후 시스템 프롬프트 미갱신

```typescript
// App.tsx — 시스템 프롬프트는 세션 시작 시 1회 빌드
const systemPrompt = buildSystemPrompt({ ... });
messages.push({ role: "system", content: systemPrompt });

// /init이 DBCODE.md를 생성해도, systemPrompt는 그대로
```

**영향**: /init으로 DBCODE.md를 생성한 후에도 agent가 프로젝트 컨벤션을 인식하지 못함.

#### Problem 2: Agent가 DBCODE.md를 자발적으로 읽지 않음

E2E 테스트 로그 증거:
```json
{
  "dbcodeReads": 0,
  "dbcodeReadTurns": [],
  "totalToolCalls": 67
}
```

67번의 tool call 중 DBCODE.md를 file_read한 횟수: **0회**.
프롬프트에 "Refer to DBCODE.md"라고 요청해도 읽지 않음.

#### Problem 3: Compaction에서만 갱신

DBCODE.md가 시스템 프롬프트에 반영되는 유일한 경로는 **context compaction**.
그런데 compaction은 토큰 사용량이 95%를 초과해야 발생 → 초기 턴에서는 작동하지 않음.

#### Problem 4: E2E 테스트의 편법적 우회

```typescript
// sendTurn() — user message에 DBCODE.md 내용을 직접 주입
if (currentTurn > 1 && existsSync(dbcodePath)) {
  const dbcodeContent = readFileSync(dbcodePath, "utf-8");
  enrichedMessage = `[Project conventions from DBCODE.md]\n${dbcodeContent}\n\n---\n\n${userMessage}`;
}
```

이 방식의 문제:
- user message에 삽입 → compaction 시 제거될 수 있음
- tool call로 추적되지 않음 (dbcodeReads = 0)
- 실제 프로덕션 동작과 다른 테스트 환경

#### Problem 5: 5-layer 병합이 buildSystemPrompt에서는 미작동

`loadInstructions()`는 5계층 병합을 완벽 구현:
```
1. ~/.dbcode/DBCODE.md          (global)
2. ~/.dbcode/rules/*.md         (global rules)
3. {project}/DBCODE.md          (project)
4. {project}/.dbcode/rules/*.md (project rules)
5. {project}/DBCODE.local.md    (local override)
```

그러나 `buildSystemPrompt()`는 `loadProjectInstructions()`만 사용 — 1,2,5 계층 무시.

---

## 3. 개선 설계

### 3.1 설계 원칙

Claude Code의 접근법을 참고하되 dbcode의 아키텍처에 맞게 적용:

| 원칙 | Claude Code 방식 | dbcode 적용 |
|------|-----------------|-------------|
| 항상 존재 | 매 LLM call에 포함 | system message를 동적으로 갱신 |
| 인프라 주입 | 프레임워크가 로드 | agent loop가 iteration마다 확인 |
| 변경 감지 | compaction 시 재로드 | 파일 변경 시 즉시 반영 |
| 출처 표시 | 경로 + 레이블 | 동일하게 구현 |
| 5-layer 병합 | 계층적 override | 기존 loadInstructions() 활용 |

### 3.2 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  개선된 DBCODE.md 처리 아키텍처                                │
│                                                             │
│  [InstructionManager — 새로운 모듈]                          │
│    ├─ loadAll(cwd): LoadedInstructions                      │
│    │   └─ 기존 loadInstructions() 래핑                       │
│    │                                                        │
│    ├─ getSystemSection(): string                            │
│    │   └─ Claude Code 스타일 레이블 + 병합                    │
│    │                                                        │
│    ├─ isDirty(): boolean                                    │
│    │   └─ DBCODE.md mtime 비교로 변경 감지                   │
│    │                                                        │
│    └─ refresh(): void                                       │
│        └─ 디스크에서 재로드 + 캐시 갱신                       │
│                                                             │
│  [Agent Loop 변경]                                           │
│    └─ 매 iteration 시작 시                                   │
│       if (instructionManager.isDirty()) {                   │
│         instructionManager.refresh();                       │
│         messages[0] = rebuildSystemMessage();               │
│       }                                                     │
│                                                             │
│  [/init 연동]                                                │
│    └─ initProject() 완료 후                                  │
│       events.emit("instructions:changed")                   │
│       → instructionManager.refresh()                        │
│       → system message 즉시 갱신                             │
│                                                             │
│  [Compaction 연동]                                           │
│    └─ compact() 시 instructionManager.refresh() 호출         │
│       (기존 reloadSystemPrompt() 대체)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 구현 계획

### Phase 1: InstructionManager 모듈 (핵심)

**파일**: `src/instructions/instruction-manager.ts`

```typescript
/**
 * InstructionManager — DBCODE.md 라이프사이클 관리자
 *
 * Claude Code가 CLAUDE.md를 처리하는 방식을 dbcode에 적용:
 * - 5-layer 계층적 로딩 (global → rules → project → path-rules → local)
 * - 변경 감지 (mtime 기반)
 * - system prompt 섹션 생성 (출처 레이블 포함)
 * - 이벤트 기반 갱신
 */
export class InstructionManager {
  private cachedInstructions: LoadedInstructions | null;
  private lastMtimes: Map<string, number>;  // 파일별 mtime 캐시
  private readonly workingDirectory: string;

  constructor(workingDirectory: string);

  /** 최초 로드 또는 캐시 반환 */
  async load(): Promise<LoadedInstructions>;

  /** DBCODE.md 변경 여부 확인 (mtime 비교, I/O 최소화) */
  isDirty(): boolean;

  /** 디스크에서 재로드 + 캐시 갱신 */
  async refresh(): Promise<LoadedInstructions>;

  /**
   * Claude Code 스타일의 system prompt 섹션 생성
   *
   * 출력 예:
   *   # Project Instructions
   *
   *   Contents of ~/.dbcode/DBCODE.md (global user instructions):
   *   ... content ...
   *
   *   Contents of /project/DBCODE.md (project instructions):
   *   ... content ...
   */
  buildSection(): string;
}
```

**핵심 기능:**
- `isDirty()`: `fs.statSync().mtimeMs` 비교 — I/O 최소화 (파일 읽기 없이 변경 감지)
- `buildSection()`: 각 계층의 내용을 출처 레이블과 함께 포맷팅
- `refresh()`: `loadInstructions()` 재호출 + mtime 캐시 갱신

**작업 항목:**

| # | 작업 | 파일 | 난이도 |
|---|------|------|--------|
| 1-1 | InstructionManager 클래스 구현 | `src/instructions/instruction-manager.ts` | M |
| 1-2 | isDirty() — mtime 기반 변경 감지 | 위 파일 내 | S |
| 1-3 | buildSection() — 레이블 포맷팅 | 위 파일 내 | S |
| 1-4 | 단위 테스트 | `test/unit/instructions/instruction-manager.test.ts` | M |

### Phase 2: Agent Loop 연동

**파일**: `src/core/agent-loop.ts`

변경 사항:
```typescript
export async function runAgentLoop(config, initialMessages) {
  // NEW: InstructionManager 초기화
  const instructionManager = new InstructionManager(
    config.workingDirectory ?? process.cwd()
  );

  while (iterations < maxIterations) {
    // NEW: 매 iteration에서 DBCODE.md 변경 확인
    if (instructionManager.isDirty()) {
      await instructionManager.refresh();
      // system message (messages[0]) 갱신
      const freshSystemPrompt = rebuildSystemPromptWith(
        instructionManager.buildSection(),
        config
      );
      updateSystemMessage(messages, freshSystemPrompt);
      config.events.emit("instructions:refreshed", {
        iteration: iterations
      });
    }

    // ... 기존 로직 계속 ...
  }
}
```

**성능 고려사항:**
- `isDirty()`는 `fs.statSync()` 1회 호출 (< 0.1ms)
- 실제 파일 읽기(`refresh()`)는 변경 시에만 발생
- 매 iteration 오버헤드: 무시할 수 있는 수준

**작업 항목:**

| # | 작업 | 파일 | 난이도 |
|---|------|------|--------|
| 2-1 | AgentLoopConfig에 instructionManager 옵션 추가 | `agent-loop.ts` | S |
| 2-2 | iteration 시작 시 isDirty() 체크 + refresh 로직 | `agent-loop.ts` | M |
| 2-3 | system message 갱신 헬퍼 함수 | `agent-loop.ts` 또는 별도 유틸 | S |
| 2-4 | `instructions:refreshed` 이벤트 추가 | `events.ts` | S |
| 2-5 | 기존 테스트 업데이트 | `test/unit/core/agent-loop.test.ts` | M |

### Phase 3: buildSystemPrompt 개선

**파일**: `src/core/system-prompt-builder.ts`

변경 사항:
- `loadProjectInstructions()` → `InstructionManager.buildSection()` 으로 교체
- 5-layer 병합을 시스템 프롬프트에 반영
- 출처 레이블 포함

```typescript
export function buildSystemPrompt(options?: {
  instructionManager?: InstructionManager;  // NEW
  // ... 기존 옵션
}): string {
  // ...

  // 기존: loadProjectInstructions(cwd) — 단일 파일만 읽음
  // 변경: InstructionManager의 5-layer 병합 결과 사용
  if (options?.instructionManager) {
    const section = options.instructionManager.buildSection();
    if (section) {
      sections.push({
        id: "project-instructions",
        content: section,
        priority: 70,
      });
    }
  } else {
    // fallback: 기존 동작 유지 (하위 호환)
    const projectInstructions = options?.projectInstructions
      ?? loadProjectInstructions(cwd);
    if (projectInstructions) {
      sections.push({
        id: "project",
        content: `# Project Instructions\n\n${projectInstructions}`,
        priority: 70,
      });
    }
  }
}
```

**작업 항목:**

| # | 작업 | 파일 | 난이도 |
|---|------|------|--------|
| 3-1 | buildSystemPrompt에 InstructionManager 연동 | `system-prompt-builder.ts` | S |
| 3-2 | 출처 레이블 포맷 구현 | `system-prompt-builder.ts` | S |
| 3-3 | 기존 테스트 호환성 확인 | 관련 테스트 파일들 | S |

### Phase 4: ContextManager 정리

**파일**: `src/core/context-manager.ts`

변경 사항:
- `reloadSystemPrompt()` 내부에서 `InstructionManager.refresh()` 사용
- 중복 로직 제거

```typescript
// 기존: compact() 내에서 직접 loadInstructions() 호출
// 변경: InstructionManager를 주입받아 사용

export class ContextManager {
  constructor(config?: ContextManagerConfig & {
    instructionManager?: InstructionManager;
  });

  async compact(messages, focusTopic?) {
    // ...
    if (this.instructionManager) {
      await this.instructionManager.refresh();
      const freshSystemContent = this.instructionManager.buildSection();
      // ...
    }
  }
}
```

**작업 항목:**

| # | 작업 | 파일 | 난이도 |
|---|------|------|--------|
| 4-1 | ContextManager에 InstructionManager 주입 | `context-manager.ts` | S |
| 4-2 | reloadSystemPrompt()을 InstructionManager로 교체 | `context-manager.ts` | M |
| 4-3 | 기존 테스트 업데이트 | `test/unit/core/context-manager.test.ts` | M |

### Phase 5: /init 연동 + 이벤트 기반 갱신

**파일**: `src/commands/init.ts`, `src/cli/App.tsx`

/init 실행 후 시스템 프롬프트가 즉시 갱신되도록:

```typescript
// init.ts
export async function initProject(cwd: string, events?: AppEventEmitter) {
  // ... DBCODE.md 생성 ...

  // NEW: 생성 완료 이벤트 발행
  events?.emit("instructions:changed", { path: dbcodePath });
}

// App.tsx (또는 agent loop 내)
events.on("instructions:changed", () => {
  instructionManager.refresh();
  // 다음 iteration에서 자동 반영
});
```

**작업 항목:**

| # | 작업 | 파일 | 난이도 |
|---|------|------|--------|
| 5-1 | initProject에 이벤트 발행 추가 | `commands/init.ts` | S |
| 5-2 | App.tsx에서 이벤트 수신 + 갱신 | `cli/App.tsx` | S |
| 5-3 | E2E 테스트에서 주입 로직 제거 | `test/e2e/project-*.test.ts` | M |

### Phase 6: 출처 레이블 포맷

Claude Code가 사용하는 정확한 레이블 형식:

```markdown
# Project Instructions

Codebase and user instructions are shown below.
IMPORTANT: These instructions OVERRIDE any default behavior
and you MUST follow them exactly as written.

Contents of /Users/user/.dbcode/DBCODE.md
  (user's global instructions for all projects):

  [global DBCODE.md 내용]

---

Contents of /Users/user/.dbcode/rules/git-workflow.md
  (user's global rule):

  [rule 내용]

---

Contents of /Users/user/project/DBCODE.md
  (project instructions, checked into the codebase):

  [project DBCODE.md 내용]
```

**작업 항목:**

| # | 작업 | 파일 | 난이도 |
|---|------|------|--------|
| 6-1 | 레이블 포맷 함수 구현 | `instruction-manager.ts` | S |
| 6-2 | 계층별 레이블 정의 | 위 파일 내 | S |

---

## 5. 구현 우선순위

```
Phase 1 (InstructionManager)
    │
    ▼
Phase 2 (Agent Loop 연동)  ←── 가장 임팩트 큰 변경
    │
    ├──→ Phase 3 (buildSystemPrompt)  ── 병렬 가능
    │
    ├──→ Phase 4 (ContextManager)     ── 병렬 가능
    │
    └──→ Phase 5 (/init 연동)         ── 병렬 가능
              │
              ▼
         Phase 6 (레이블 포맷)
```

### 추정 작업량

| Phase | 작업 수 | 핵심 변경 파일 |
|-------|---------|---------------|
| 1 | 4 | instruction-manager.ts (NEW) |
| 2 | 5 | agent-loop.ts |
| 3 | 3 | system-prompt-builder.ts |
| 4 | 3 | context-manager.ts |
| 5 | 3 | init.ts, App.tsx, E2E tests |
| 6 | 2 | instruction-manager.ts |
| **합계** | **20** | |

---

## 6. 개선 전후 비교

### Before (현재)

```
Session start
  └─ buildSystemPrompt() → DBCODE.md 1회 읽기 시도
      └─ 파일 없으면? → 시스템 프롬프트에 포함 안 됨

/init 실행
  └─ DBCODE.md 생성됨
      └─ 시스템 프롬프트? → 변경 없음 (stale)

Turn 2~N
  └─ Agent가 DBCODE.md를 file_read? → 안 함 (0회 관찰)
  └─ 컨벤션 인식? → 우연에 의존

Compaction (토큰 95% 초과 시)
  └─ reloadSystemPrompt() → 이때서야 DBCODE.md 반영
```

### After (개선 후)

```
Session start
  └─ InstructionManager.load()
      └─ 5-layer 전부 로드 (있는 것만)
      └─ 시스템 프롬프트에 레이블과 함께 포함

/init 실행
  └─ DBCODE.md 생성
  └─ events.emit("instructions:changed")
  └─ InstructionManager.refresh() → 즉시 반영

매 Iteration
  └─ isDirty()? (statSync, < 0.1ms)
      └─ 변경됨 → refresh() → system message 갱신
      └─ 변경 안 됨 → skip (오버헤드 없음)

Compaction
  └─ InstructionManager.refresh() 호출
      └─ 항상 최신 DBCODE.md 보장
```

---

## 7. 성공 지표

| 지표 | 현재 | 목표 |
|------|------|------|
| /init 후 첫 턴에서 컨벤션 인식 | NO | YES |
| Agent의 DBCODE.md file_read 필요 | 의존 (0회 실행) | 불필요 (시스템 주입) |
| E2E 테스트 user message 주입 필요 | YES (편법) | NO (인프라 수준) |
| 5-layer 병합 in system prompt | 1-layer만 | 5-layer 전체 |
| DBCODE.md 변경 반영 시점 | Compaction 시 | 다음 iteration |
| 레이블/출처 표시 | 없음 | Claude Code 스타일 |

---

## 8. 리스크 및 고려사항

### 8.1 토큰 비용 증가

DBCODE.md 내용이 매 LLM 호출에 포함되므로 토큰 소비가 증가한다.
하지만 Claude Code도 동일한 트레이드오프를 선택했다.

**완화**: 대형 DBCODE.md (> 2000 tokens)는 경고 메시지 표시.

### 8.2 하위 호환성

기존 `buildSystemPrompt()`의 `projectInstructions` 파라미터는 유지.
InstructionManager가 없을 때는 기존 `loadProjectInstructions()` fallback.

### 8.3 성능

`isDirty()`의 `statSync()` 호출은 iteration당 1회.
벤치마크: 일반적으로 0.01~0.1ms — LLM API 호출 (1~30초)에 비하면 무시 가능.

### 8.4 E2E 테스트 영향

Phase 5 완료 후:
- `sendTurn()`의 DBCODE.md 주입 로직 제거 가능
- `dbcodeReads` 추적 방식 변경 → `instructions:refreshed` 이벤트 기반
- 테스트 assertion: `expect(refreshEvents).toBeGreaterThanOrEqual(1)`

---

## 9. 부록: Claude Code vs dbcode 상세 비교

| 항목 | Claude Code | dbcode (현재) | dbcode (개선 후) |
|------|------------|--------------|----------------|
| 설정 파일명 | CLAUDE.md | DBCODE.md | DBCODE.md |
| 로딩 시점 | 대화 시작 전 | buildSystemPrompt() 1회 | InstructionManager 연속 |
| 갱신 주기 | 매 LLM call | Compaction 시만 | 매 iteration (isDirty) |
| 계층 수 | 5 | 1 (system-prompt-builder) | 5 (loadInstructions) |
| 출처 레이블 | 있음 (경로+타입) | 없음 | 있음 |
| Agent가 읽어야? | 불필요 | 필요 (하지만 안 함) | 불필요 |
| /init 후 반영 | 즉시 | 반영 안 됨 | 이벤트 → 즉시 |
| user msg 주입 | 안 함 | E2E에서 필요 | 불필요 |
| Override 선언 | 명시적 | 없음 | 명시적 |
