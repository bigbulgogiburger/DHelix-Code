---
name: sprint-execution
description: |
  개선 계획(improvement plan)으로부터 스프린트를 실행합니다. Claude Agent Teams를 사용하여 병렬 개발팀을 구성하고 파일 충돌 분석, 태스크 분배, worktree 격리 실행, 결과 검증, 머지/커밋까지 자동 오케스트레이션합니다.
  사용자가 "스프린트 실행", "개선 계획 구현", "팀으로 개발", "병렬로 구현해줘", "revolution 실행", "Phase 1 시작", "v0.3 구현" 등을 요청할 때 사용하세요.
  docs/revolution/ 의 개선 문서, 마일스톤 문서, 또는 사용자가 지정하는 임의의 계획 문서를 입력으로 받습니다.
argument-hint: "[plan file path or version target] [--dry-run] [--max-agents N] [--worktree]"
---

# Sprint Execution with Agent Teams

대규모 개선 계획을 분석 → 파일 충돌 해결 → 병렬 에이전트 팀 구성 → 격리 실행 → 통합 검증 → 커밋까지 자동화하는 오케스트레이션 스킬입니다.

## Why This Skill Exists

개선 계획에는 수십 개의 작업이 있고, 순차 처리는 비효율적이며 무작위 병렬화는 파일 충돌을 일으킵니다. 이 스킬은 **의존성 그래프 분석**으로 충돌 없는 최적 병렬 배치를 수행하고, **git worktree 격리**로 안전한 병렬 실행을 보장합니다.

---

## Phase 0: Input Resolution (입력 해석)

`$ARGUMENTS`를 파싱하여 계획 파일과 실행 범위를 결정합니다.

### 입력 유형별 해석

| 사용자 입력                                           | 해석                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| `docs/revolution/01-core-runtime-improvement-plan.md` | 특정 계획 파일의 전체 Phase                                           |
| `v0.3` 또는 `v0.3.0`                                  | 마스터 로드맵(`99-master-roadmap.md`)에서 해당 버전 섹션 추출         |
| `Phase 1` 또는 `Wave 1`                               | 마스터 로드맵의 해당 Wave 항목 추출                                   |
| `01 Phase 2`                                          | 01 문서의 Phase 2 섹션만 추출                                         |
| 경로 미지정                                           | `docs/revolution/99-master-roadmap.md`에서 다음 미완료 항목 자동 선택 |

### 진행 상태 파일

`docs/revolution/.sprint-state.json`에 스프린트 진행 상태를 저장합니다. 이전 세션에서 중단된 작업을 이어갈 수 있습니다.

```json
{
  "currentVersion": "v0.3.0",
  "completedItems": ["runtime-pipeline-extraction", "async-compaction"],
  "inProgressItems": ["sqlite-session-store"],
  "lastSprintDate": "2026-04-04",
  "lastCommitHash": "abc1234"
}
```

시작 시 이 파일을 확인하고, 이전 진행 상태가 있으면 사용자에게 알립니다:

- "이전 스프린트에서 3/8 항목이 완료되었습니다. 이어서 진행할까요?"

### Dry Run 모드

`--dry-run` 전달 시 Phase 0-2만 실행합니다 (분석만, 실행 없음). 팀 구성 계획과 파일 충돌 분석을 보여주고 사용자 검토를 기다립니다.

---

## Phase 1: Plan Analysis (계획 분석)

계획 문서를 읽고 구현할 항목을 구조화합니다.

### 1.1 문서 파싱

Revolution 문서의 일반적인 구조:

- `## N. Section` → 대주제
- `### N.N Phase/Subsection` → 구현 단위
- 테이블 (`| 작업 | 우선순위 | LOC | 대상 파일 |`) → 작업 항목 추출
- 코드 블록 (TypeScript 인터페이스) → 구현 가이드

각 작업 항목에서 추출할 정보:

1. **작업명** (예: "Agent loop pipeline 분리")
2. **우선순위** (P0/P1/P2)
3. **예상 LOC** (문서에 있으면)
4. **대상 파일** (신규 생성 vs 기존 수정)
5. **의존 항목** (다른 작업이 먼저 완료되어야 하는 경우)

### 1.2 파일 영향 분석

각 작업에 대해 실제 코드베이스를 탐색하여 변경 파일을 파악합니다:

1. 문서에 명시된 파일 경로 → 존재 여부 확인 (`Glob`)
2. 관련 import/export 체인 추적 → 간접 영향 파일 도출
3. 테스트 파일 매핑 (`src/X.ts` → `test/unit/X.test.ts`)

```
출력 예시:
┌─────────────────────────────────┬──────┬──────────────────────────────────────┬─────────┐
│ 작업                             │ 우선  │ 변경 파일                             │ 유형     │
├─────────────────────────────────┼──────┼──────────────────────────────────────┼─────────┤
│ RuntimePipeline extraction       │ P0   │ src/core/runtime-pipeline.ts (NEW)   │ 신규    │
│                                 │      │ src/core/agent-loop.ts (MODIFY)      │ 수정    │
│                                 │      │ test/unit/core/runtime-pipeline.test.ts (NEW) │ 신규  │
│ AsyncCompactionEngine            │ P0   │ src/core/async-compaction.ts (NEW)   │ 신규    │
│                                 │      │ src/core/context-manager.ts (MODIFY) │ 수정    │
│ SQLite SessionStore              │ P0   │ src/storage/session-db.ts (NEW)      │ 신규    │
│                                 │      │ src/core/session-manager.ts (MODIFY) │ 수정    │
└─────────────────────────────────┴──────┴──────────────────────────────────────┴─────────┘
```

---

## Phase 2: Dependency Graph & Conflict Resolution (의존성 그래프)

### 2.1 충돌 매트릭스 생성

모든 작업 쌍에 대해 파일 충돌을 계산합니다:

```
충돌 매트릭스:
              Task A    Task B    Task C    Task D
Task A        -         CONFLICT  safe      safe
Task B        CONFLICT  -         safe      CONFLICT
Task C        safe      safe      -         safe
Task D        safe      CONFLICT  safe      -

CONFLICT: Task A ↔ Task B (공유 파일: src/core/agent-loop.ts)
CONFLICT: Task B ↔ Task D (공유 파일: src/core/context-manager.ts)
```

### 2.2 그룹화 알고리즘

1. 충돌 그래프를 구성 (노드=작업, 엣지=파일 충돌)
2. 그래프 컬러링으로 최소 그룹 수 결정
3. 같은 색의 작업들 = 하나의 에이전트 그룹 (또는 순차 실행)
4. P0 우선순위 항목이 먼저 실행되도록 위상 정렬

### 2.3 충돌 해결 전략

| 상황                                       | 전략                                    |
| ------------------------------------------ | --------------------------------------- |
| 새 파일만 생성                             | 항상 병렬 안전                          |
| 소스+해당 테스트 동시 수정                 | 같은 에이전트 배정                      |
| 공통 허브 파일 (`index.ts`, `registry.ts`) | **Integration Agent**가 마지막에 처리   |
| 같은 파일의 다른 함수                      | 같은 에이전트 (위험)                    |
| `--worktree` 모드                          | worktree 격리로 대부분의 충돌 해소 가능 |

### 2.4 사용자 확인

분석 결과를 테이블로 보여주고 확인을 받습니다:

```
## Sprint Plan — v0.3.0 Phase 1 (4 agents, 8 tasks)

Agent 1: runtime-pipeline     [worktree: wt-runtime]
  ├── RuntimePipeline extraction (P0, ~800 LOC)
  └── RuntimeStage enum (P0, ~200 LOC)

Agent 2: async-compaction     [worktree: wt-compaction]
  ├── AsyncCompactionEngine (P0, ~400 LOC)
  └── Compaction invariants (P1, ~200 LOC)

Agent 3: session-storage      [worktree: wt-session]
  └── SQLite SessionStore (P0, ~600 LOC)

Agent 4: tool-pipeline        [worktree: wt-tools]
  ├── ToolExecutionPipeline (P0, ~500 LOC)
  └── Tool error hierarchy (P0, ~200 LOC)

Integration Agent: (after all complete)
  └── Wire new modules into agent-loop.ts, update imports

이 계획으로 진행할까요? (y/n/수정 사항)
```

---

## Phase 3: Agent Teams Formation & Execution (팀 구성 및 실행)

> Claude Code의 **Agent Teams** 기능을 활용합니다.
> Agent Teams는 단순 subagent 병렬 스폰과 달리, **peer-to-peer 메시징**, **공유 태스크 리스트**,
> **선언적 의존성**, **자율 조율**을 지원하는 멀티에이전트 시스템입니다.

### 3.1 팀 생성

Phase 2의 분석 결과를 기반으로 Agent Team을 생성합니다:

```
/team create "dhelix-sprint-v0.3-phase1"
```

팀에 다음 teammate들을 스폰합니다. 각 teammate는 독립 Claude Code 세션으로 실행되며,
서로 직접 메시지를 주고받을 수 있습니다.

```
Teammate 구성 예시:

1. runtime-pipeline (architect)
   - 작업: RuntimePipeline extraction, RuntimeStage enum
   - dependsOn: [] (의존 없음 — Level 1)

2. async-compaction (developer)
   - 작업: AsyncCompactionEngine, Compaction invariants
   - dependsOn: [] (Level 1)

3. session-storage (developer)
   - 작업: SQLite SessionStore
   - dependsOn: [] (Level 1)

4. tool-pipeline (developer)
   - 작업: ToolExecutionPipeline, Tool error hierarchy
   - dependsOn: [] (Level 1)

5. integration-wiring (integrator)
   - 작업: Wire new modules into agent-loop.ts, update imports
   - dependsOn: [runtime-pipeline, async-compaction, session-storage, tool-pipeline] (Level 2)
```

**의존성 스케줄링**: Level 1 teammate들이 모두 병렬 실행되고, 완료 후 Level 2(integration)가 자동 시작됩니다.
Kahn 알고리즘(위상 정렬)으로 실행 순서가 결정되며, `maxConcurrency`로 동시 실행 수를 제어합니다.

### 3.2 Teammate 프롬프트

각 teammate에게 다음 정보를 전달합니다:

```
당신은 DHelix Code 프로젝트의 [{역할명}] 개발자입니다.
팀 이름: dhelix-sprint-v0.3-phase1
당신의 이름: {teammate-name}

## 프로젝트 컨텍스트
- Node.js 20+ / TypeScript 5.x / ESM only / Vitest
- Named exports only, no default exports
- .js 확장자 필수 (ESM imports)
- No `any` — use `unknown` + type guards
- Immutable state — readonly properties, spread copy
- AbortController for cancellable operations

## 작업
{개선 계획에서 추출한 구체적 작업 내용}

## 구현 가이드
{계획 문서의 관련 TypeScript 인터페이스/코드 블록}

## 변경 대상 파일
{파일 목록 — NEW(신규 생성) / MODIFY(기존 수정) 구분}

## 팀 협업
- 다른 teammate에게 메시지를 보낼 수 있습니다 (SendMessage 사용)
- 공유 태스크 리스트에서 작업을 claim/complete하세요
- 다른 teammate가 담당하는 파일은 수정하지 마세요:
  {다른 teammate의 파일 목록}
- 인터페이스 결정이 필요하면 관련 teammate에게 직접 물어보세요
  예: "runtime-pipeline에게: RuntimeStage enum의 export 이름이 뭔가요?"

## 완료 조건
1. 모든 새 파일에 JSDoc 주석 포함
2. 관련 테스트 파일 작성 (80%+ coverage 목표)
3. `npx vitest run {관련 테스트 경로}` 통과
4. `npx tsc --noEmit` 타입 체크 통과
5. 공유 태스크 리스트에서 작업을 완료 상태로 표시
```

### 3.3 Peer-to-Peer 협업 활용

Agent Teams의 핵심 장점은 teammate 간 **직접 통신**입니다:

**활용 시나리오:**

| 상황                                | 통신 패턴                                                            |
| ----------------------------------- | -------------------------------------------------------------------- |
| runtime-pipeline이 새 타입을 export | → async-compaction에 SendMessage: "RuntimeStage 타입을 import하세요" |
| session-storage가 스키마 결정       | → integration-wiring에 broadcast: "SessionTable 스키마 확정됨"       |
| tool-pipeline에서 인터페이스 변경   | → runtime-pipeline에 질문: "ToolResult 타입 호환 확인"               |
| 두 teammate가 같은 유틸 함수 필요   | → 한 쪽이 구현 후 상대에게 알림                                      |

Lead(오케스트레이터)는 개입하지 않아도 teammate들이 스스로 조율합니다.

### 3.4 실행 모니터링

```bash
# 팀 상태 확인
/team status

# 출력 예시:
# dhelix-sprint-v0.3-phase1
# ├── runtime-pipeline    ✅ completed (2m 34s)
# ├── async-compaction     ✅ completed (3m 12s)
# ├── session-storage      🔄 in progress...
# ├── tool-pipeline        🔄 in progress...
# └── integration-wiring   ⏳ waiting (depends on: session-storage, tool-pipeline)
```

**Split pane 모드** (tmux/iTerm2): 각 teammate를 별도 패널에서 실시간 모니터링 가능.

### 3.5 실패 처리

| 상황                      | 대응                                          |
| ------------------------- | --------------------------------------------- |
| Teammate 타임아웃         | 작업 범위 축소 후 재스폰                      |
| 테스트 실패               | Lead가 fix-teammate 추가 스폰                 |
| 의존 teammate 실패        | **자동 전파** — 의존하는 teammate들 자동 취소 |
| 파일 충돌                 | integration-wiring teammate가 머지 시 해결    |
| Teammate가 금지 파일 수정 | Lead가 해당 변경 revert 후 재지시             |

### 3.6 팀 관리 명령어

```bash
/team status           # 전체 진행 상황
/team summary          # 상세 결과 리포트
/team cancel           # 긴급 중단
```

---

## Phase 4: Integration (통합)

모든 Level 1 teammate 완료 후, integration-wiring teammate가 자동으로 시작됩니다 (`dependsOn` 의존성).

### 4.1 Integration Teammate

Agent Teams의 의존성 시스템으로 자동 트리거되는 통합 teammate:

```
integration-wiring teammate 작업:
1. 각 teammate가 생성한 새 모듈의 export 확인
2. 기존 코드에 연결 (import/export wiring)
3. index.ts, registry.ts 등 공통 허브 파일 업데이트
4. 새 모듈 간 cross-dependency 연결
5. 파일 충돌이 있으면 해결
```

### 4.2 통합 검증

Integration teammate가 완료되면, Lead가 전체 통합 상태를 확인합니다:

```bash
/team summary   # 모든 teammate 작업 결과 확인
```

---

## Phase 5: Verification (검증)

전체 프로젝트 상태를 검증합니다. **하나라도 실패하면 수정 후 재검증**.

### 5.1 검증 체인

```bash
# 1. 전체 테스트
npx vitest run

# 2. 타입 체크
npm run typecheck

# 3. 린트
npm run lint

# 4. 빌드
npm run build

# 5. 순환 의존성 (있다면)
npx madge --circular src/
```

### 5.2 아키텍처 검증

`/verify-architecture` 스킬이 사용 가능하면 실행합니다:

- 4-Layer 규칙 위반 확인 (CLI → Core → Infra → Leaf, 역방향 import 금지)
- 파일 크기 제한 (1,500 LOC 경고, 2,000 LOC 에러)
- Named export 규칙 준수

### 5.3 실패 수정 루프

검증 실패 시 최대 3회 수정을 시도합니다:

1. 에러 메시지 분석 → 원인 파일 특정
2. 간단한 수정 (lint, import) → 직접 수정
3. 복잡한 수정 (로직 에러) → fix-agent 스폰
4. 3회 실패 시 → 사용자에게 보고하고 수동 개입 요청

---

## Phase 6: Commit & Report (커밋 및 보고)

### 6.1 커밋

```
feat(v0.3): {스프린트 요약} — {N}개 항목 구현

Phase 1 Core Runtime Foundation:
- RuntimePipeline: 8-stage agent loop pipeline 추출
- AsyncCompactionEngine: 동기 compaction → 비동기 백그라운드 워커
- SQLiteSessionStore: JSONL → Drizzle ORM 마이그레이션
- ToolExecutionPipeline: 4-stage 도구 실행 분리

All {N} tests pass, typecheck clean, build succeeds.
```

### 6.2 진행 상태 업데이트

`.sprint-state.json`을 업데이트하여 완료된 항목을 기록합니다.

### 6.3 결과 리포트

```markdown
## Sprint Results — v0.3.0 Phase 1

| #   | Task                       | Agent            | Duration | Tests    | LOC  |
| --- | -------------------------- | ---------------- | -------- | -------- | ---- |
| 1   | RuntimePipeline extraction | runtime-pipeline | 2m 34s   | 12/12 ✅ | +823 |
| 2   | AsyncCompactionEngine      | async-compaction | 3m 12s   | 8/8 ✅   | +412 |
| 3   | SQLite SessionStore        | session-storage  | 4m 01s   | 15/15 ✅ | +634 |
| 4   | ToolExecutionPipeline      | tool-pipeline    | 2m 55s   | 10/10 ✅ | +521 |
| 5   | Integration wiring         | integration      | 1m 20s   | -        | +45  |

**Total**: 5 agents, 45/45 tests pass, +2,435 LOC
**Quality**: typecheck ✅, lint ✅, build ✅, architecture ✅
**Commit**: `abc1234` on branch `main`
**Next**: v0.3.0 Phase 2 — Per-stage metrics, cold storage GC
```

---

## Configuration

### Max Agents

`--max-agents N` (기본: 8)으로 동시 에이전트 수를 제한합니다. 너무 많으면 컨텍스트 윈도우 관리가 어려워지고, 너무 적으면 병렬화 이점이 감소합니다. 작업 수가 max-agents를 초과하면 Wave로 나누어 순차 배치합니다.

### Model Selection

에이전트는 기본적으로 현재 세션의 모델을 상속합니다. 복잡한 작업에는 더 강력한 모델을, 간단한 작업에는 가벼운 모델을 배정할 수 있습니다:

```
Agent 1 (복잡): runtime-pipeline → model: opus (기본 상속)
Agent 2 (간단): error-types → model: sonnet
```

### Worktree vs In-Place

| 모드            | 장점                   | 단점                   | 권장 상황                  |
| --------------- | ---------------------- | ---------------------- | -------------------------- |
| `--worktree`    | 완벽한 격리, 충돌 불가 | 디스크 사용, 머지 필요 | 파일 충돌 감지 시          |
| in-place (기본) | 빠름, 단순             | 충돌 위험              | 모든 작업이 독립 파일일 때 |

충돌 매트릭스에서 CONFLICT가 1개 이상이면 자동으로 worktree 모드를 권장합니다.

---

## Best Practices

1. **10개 이하의 에이전트** — 관리 오버헤드가 커지고 context window 압박
2. **에이전트당 1-3개 파일** — 범위를 작게 유지해야 정확도가 높음
3. **테스트와 소스 함께** — 테스트는 반드시 해당 소스와 같은 에이전트에
4. **공통 파일은 마지막** — Integration Agent가 마지막에 허브 파일 처리
5. **P0 먼저** — 우선순위가 높은 항목부터 실행
6. **검증 실패 3회 = 중단** — 무한 루프 방지, 사용자에게 에스컬레이션
7. **LLM 호출 금지** — 테스트에서 실제 API 호출 안 함 (mock 사용)
8. **계획 문서의 코드 블록 활용** — TypeScript 인터페이스가 있으면 그대로 구현 가이드로 전달
