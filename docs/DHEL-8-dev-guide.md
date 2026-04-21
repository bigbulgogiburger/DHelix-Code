# [DHEL-8] ToolPipeline → agent-loop.ts 통합 — 개발 가이드

> 생성일: 2026-04-19
> 스택: Node.js / TypeScript (ESM)
> 페르소나: **Node.js/TypeScript CLI Architect** — 파이프라인 아키텍처, 스테이지 분리, 권한/가드레일 레이어링에 정통.

---

## 판정 요약 (TL;DR)

**DHEL-8은 "등가 구현"으로 이미 완료된 상태로 판정합니다. 신규 구현 불필요, 검증 + 데드코드 정리만 수행합니다.**

### 근거 (정밀 추적)

| 항목 | 실제 상태 |
|------|----------|
| `agent-loop.ts`가 `executeToolCall()`을 직접 호출하는가 | **아니오** — `src/core/agent-loop.ts:99, 127`에서 `createPipeline({})` → `pipeline.executeIteration(ctx)`로 일원화됨 |
| ToolPipeline(4-stage)이 실제 실행 경로에 있는가 | **예** — `src/core/runtime/stages/execute-tools.ts:59`에서 `new ToolPipeline(config.toolRegistry)` 생성 후 `.execute(group, ...)` 호출 (L109) |
| 4-stage 모두 작동하는가 | **예** — `src/tools/pipeline.ts:105-207`에서 Preflight / Schedule / Execute / Postprocess 순차 실행. RuntimePipeline의 `preflight-policy` 스테이지와 중복되는 부분만 옵션으로 skip (`preflightChecks: []`, `enableGuardrails: false`) |
| 보안 갭이 있는가 | **없음** — RuntimePipeline의 `preflight-policy` 스테이지가 권한/가드레일을 선행 처리하고, ToolPipeline은 이를 신뢰하고 실행·후처리만 담당 (관심사 분리 설계) |

따라서 Jira 설명서의 "`executeToolCall()` 대신 `executeToolCallsWithPipeline()` 사용" 요구사항은 **상위 설계가 바뀌어** RuntimePipeline + 내부 ToolPipeline 조합으로 이미 충족된 상태입니다.

---

## 1. 요구사항 요약

### 비즈니스 목표
agent-loop 실행 경로에서 4-stage ToolPipeline(preflight → schedule → execute → postprocess)이 실제로 활성화되어 도구 실행의 검증·스케줄링·후처리 단계가 일관되게 적용되어야 한다.

### 인수조건
- [x] **AC1** — agent-loop가 4-stage 파이프라인 경로를 통해 도구를 실행한다 (RuntimePipeline → ExecuteToolsStage → ToolPipeline으로 달성)
- [x] **AC2** — preflight 단계에서 권한/가드레일 검증이 수행된다 (`preflight-policy` stage가 선행, ToolPipeline은 `preflightChecks: []`로 중복 방지)
- [x] **AC3** — 실행 결과가 postprocess로 truncation/메타데이터 첨부된다 (`src/tools/pipeline.ts:176` `postprocess()` 호출)
- [x] **AC4** — 그룹 실행 스케줄링(읽기 병렬 / 쓰기 순차)이 적용된다 (`scheduleCalls()` → `Promise.allSettled(group.calls...)`)
- [ ] **AC5 (신규)** — 데드코드 `executeToolCall`, `executeToolCallsWithPipeline` 정리 (아래 §3 Phase 2)

### 제약사항 / 주의사항
- RuntimePipeline과 ToolPipeline의 **책임 분리는 유지**한다. preflight를 중복 실행하지 않는 현재 설계가 옳다.
- 레이어 규칙: `core/` → `tools/` 방향만 허용. 반대 방향 import 금지.
- 데드코드 제거 시 테스트가 해당 함수를 직접 호출하고 있는지 먼저 확인 (있으면 삭제 대상에서 제외하거나 테스트도 함께 정리).

---

## 2. 영향 범위 분석

### 수정 대상 파일 (데드코드 정리만)

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/tools/executor.ts` | 수정(삭제) | `executeToolCall` (L172~), `executeToolCallsWithPipeline` (L589~) — 호출처 없음 확인 후 제거 |
| `src/tools/pipeline/index.ts` | 수정(삭제 또는 유지) | 배럴 export. `src/` 내부 import 없음 — 외부 소비자(테스트) 확인 후 판단 |

### 연관 파일 (읽기 전용 — 검증용)

| 파일 | 참조 이유 |
|------|----------|
| `src/core/agent-loop.ts:98-99, 127` | RuntimePipeline 진입점 |
| `src/core/runtime/pipeline.ts` | 9-stage 파이프라인 구성 |
| `src/core/runtime/stages/execute-tools.ts:59, 109` | ToolPipeline 호출 지점 |
| `src/tools/pipeline.ts:70-214` | 4-stage ToolPipeline 본체 |
| `src/tools/pipeline/{preflight,scheduler,postprocess}.ts` | 각 스테이지 구현 |
| `test/unit/tools/pipeline.test.ts` | ToolPipeline 단위 테스트 (회귀 방지) |
| `test/unit/core/runtime/stages/execute-tools.test.ts` | 통합 지점 테스트 |
| `test/e2e/tool-pipeline-scenarios.test.ts` | 실제 시나리오 검증 |

### DB 변경
없음.

---

## 3. 구현 계획

### Phase 1: 통합 경로 회귀 검증 (10분)

**목표**: 현재 구현이 AC1-AC4를 실제로 만족함을 재확인하여 커밋 전 신뢰도 확보.

1. 기존 테스트 실행:
   ```bash
   npm test -- test/unit/tools/pipeline.test.ts \
                test/unit/core/runtime/stages/execute-tools.test.ts \
                test/e2e/tool-pipeline-scenarios.test.ts --run
   ```
2. 통과 시 구현 경로가 회귀 없이 작동함을 문서화 (커밋 메시지에 포함).

**검증**: 3개 테스트 파일 모두 PASS.

---

### Phase 2: 데드코드 정리 (15분)

**목표**: agent-loop가 더 이상 사용하지 않는 executor 레거시 함수를 제거해 코드베이스를 줄인다.

1. `src/tools/executor.ts`의 `executeToolCall` / `executeToolCallsWithPipeline` 호출처 확정:
   ```bash
   # src/ 내부 호출처 (없음을 확인)
   # test/ 호출처 점검 — 있으면 아래 하위 단계에서 함께 정리
   ```
   Grep 도구로 `executeToolCall\b`, `executeToolCallsWithPipeline` 검색.
2. src 참조가 0이고 test 참조도 레거시 회귀 목적일 뿐이면 두 함수를 삭제. 함수가 참조하는 헬퍼들도 함께 고아가 되는지 확인.
3. `src/tools/pipeline/index.ts` 배럴 export는 `src/`에서 미사용. 외부(스킬 스크립트 등) 의존이 없으면 파일 삭제. 불확실하면 유지.
4. 타입·린트·빌드 통과 확인:
   ```bash
   npm run typecheck && npm run lint && npm run build
   ```

**검증**: 
- `npm run check` 전부 통과
- `madge --circular src/` 순환 의존 없음
- 삭제된 심볼 외에 모든 테스트 PASS

---

### Phase 3: 아키텍처 문서 보강 (10분)

**목표**: "RuntimePipeline의 preflight-policy stage와 ToolPipeline.preflight는 관심사가 다르며 의도적으로 중복을 피한다"는 설계 결정을 코드로만 남기지 않고 명시적으로 남긴다.

1. `src/core/runtime/stages/execute-tools.ts:109` 위 주석을 한 줄 정비:
   ```ts
   // preflight-policy stage가 권한/가드레일을 선행 처리하므로 파이프라인 preflight는 skip
   ```
   (이미 유사 주석이 있으면 그대로 둔다. 문서만 보강해도 됨.)
2. `.claude/docs/reference/architecture-deep.md`에 "Tool execution layering" 1~2 문단 추가 여부 판단 — 이미 문서가 완비되어 있다면 생략.

**검증**: 코드 변경 없음 시 스킵 가능. 변경 있으면 `npm run typecheck`.

---

### Phase 4: Jira 마감 및 커밋 (5분)

1. 커밋 메시지:
   ```
   chore(tools): DHEL-8 verify ToolPipeline integration, drop legacy executor entrypoints

   - Confirmed agent-loop → RuntimePipeline → ExecuteToolsStage → ToolPipeline (4-stage) path
   - Removed unused executeToolCall / executeToolCallsWithPipeline from tools/executor.ts
   - (optional) Removed unused src/tools/pipeline/index.ts barrel
   ```
2. Jira DHEL-8 코멘트(한글):
   > 추적 결과 agent-loop.ts는 `createPipeline()`(RuntimePipeline)을 통해 `execute-tools` stage에서 `new ToolPipeline(registry).execute()`로 4-stage 파이프라인을 이미 경유하고 있음을 확인했습니다. preflight는 `preflight-policy` stage가 선행 처리하므로 ToolPipeline.preflight는 의도적으로 skip됩니다(중복 제거). 본 티켓은 검증·데드코드 정리로 마감합니다.
3. 상태를 QA/완료로 전환.

---

## 4. 기술 상세

### 핵심 설계 결정
- **책임 분리**: RuntimePipeline은 "에이전트 루프 한 이터레이션 전체"를 9-stage로 오케스트레이션하고, 그중 `execute-tools` 한 스테이지 안에서 `ToolPipeline`이 도구 호출 묶음의 4-stage 실행을 수행한다.
- **중복 preflight 회피**: `preflight-policy` stage(권한/가드레일)가 이미 결과를 `ctx.toolResults`(거부분)와 `ctx.extractedCalls`(통과분)으로 분리했기 때문에, ToolPipeline에서는 `preflightChecks: []`, `enableGuardrails: false`로 재검증을 끈다. 이것이 현재의 "통합" 형태이다.
- **출력 가드레일 위치**: ToolPipeline은 postprocess(truncation/메타데이터)만 담당하고, output guardrail은 `execute-tools.ts:123`에서 stage가 직접 적용한다. 이 배치를 유지한다.

### 위험 요소

| 위험 | 영향도 | 대응 방안 |
|------|--------|----------|
| 데드코드 삭제가 외부 스킬/플러그인을 깨뜨림 | 낮음 | public barrel/패키지 export 경로인지 확인 후 삭제 |
| 테스트가 삭제 대상 함수를 직접 호출 | 낮음 | 테스트 업데이트 or 삭제 대상에서 제외 |
| Jira 설명서와 실제 구현의 간극으로 추후 혼동 | 중간 | Jira 코멘트 + 커밋 메시지에 "등가 구현" 판정 근거를 남긴다 |

### 외부 연동
없음.

---

## 5. 병렬 작업 가이드
**생략** — 작업 규모가 검증 + 삭제 2개 파일 수준이며, 병렬 이점 없음.
