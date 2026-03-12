---
name: sprint-execution
description: 개선 계획(improvement plan)으로부터 스프린트를 실행합니다. Claude Agent Teams를 사용하여 병렬 개발팀을 구성하고 파일 충돌 분석, 태스크 분배, 동시 실행, 결과 검증, 커밋까지 자동 오케스트레이션합니다. 사용자가 "스프린트 실행", "개선 계획 구현", "팀으로 개발", "병렬로 구현해줘" 등을 요청할 때 사용하세요.
argument-hint: "[plan file path] [sprint number] [--dry-run]"
---

# Sprint Execution with Agent Teams

이 스킬은 개선 계획(improvement plan) 문서의 항목들을 분석하고, Claude Agent Teams를 활용하여 병렬로 구현하는 전체 워크플로우를 제공합니다.

## Why This Skill Exists

대규모 개선 계획에는 수십 개의 작업 항목이 있습니다. 이를 순차적으로 처리하면 비효율적이고, 무작위로 병렬화하면 파일 충돌이 발생합니다. 이 스킬은 **파일 의존성 분석**을 통해 충돌 없는 최적의 병렬 분배를 자동으로 수행합니다.

## Execution Phases

### Phase 1: Plan Analysis (계획 분석)

개선 계획 문서를 읽고 구현할 항목을 파악합니다.

1. `$ARGUMENTS`에서 계획 파일 경로와 스프린트 번호를 추출합니다
   - 경로 미지정 시 `docs/UI_IMPROVEMENT_PLAN_v2.md` 또는 유사 파일을 탐색
   - 스프린트 번호 미지정 시 다음 미완료 스프린트를 자동 선택
2. 계획에서 해당 스프린트의 작업 항목을 추출합니다
3. 각 항목에 대해 예상 변경 파일 목록을 도출합니다

```
예시 출력:
┌──────────────────────────────┬────────────────────────────────────────┐
│ 작업 항목                     │ 예상 변경 파일                          │
├──────────────────────────────┼────────────────────────────────────────┤
│ Fix 35 failing tests          │ test/unit/**/*.test.ts                  │
│ Diff default display          │ src/cli/components/ToolCallBlock.tsx    │
│ Retry logic                   │ src/llm/responses-client.ts             │
│ grep → ripgrep                │ src/tools/definitions/grep-search.ts   │
│ /commit command               │ src/commands/commit.ts                  │
└──────────────────────────────┴────────────────────────────────────────┘
```

### Phase 2: Dependency Analysis (의존성 분석)

파일 충돌을 사전에 탐지하고 그룹을 나눕니다. 이 단계가 핵심입니다.

**규칙:**

- 두 작업이 **같은 파일을 수정**하면 → 같은 에이전트에 배정하거나 순차 실행
- 테스트 파일은 소스 파일과 함께 묶음 (test fix → 해당 소스 담당 에이전트)
- `src/index.ts` 같은 공통 진입점 수정은 **마지막에 통합 에이전트**가 처리
- 새 파일 생성은 항상 안전하게 병렬 가능

**분석 방법:**

```
1. 각 작업 항목의 변경 대상 파일 나열
2. 파일 간 교차점(intersection) 계산
3. 교차가 없는 그룹끼리 병렬 그룹 형성
4. 교차가 있는 항목은 같은 에이전트에 합치거나 순서 지정
```

**충돌 해결 전략:**
| 상황 | 전략 |
|------|------|
| 소스+테스트 동시 수정 | 같은 에이전트에 배정 |
| 공통 파일(index.ts) 수정 | 통합 에이전트가 마지막에 처리 |
| 같은 디렉토리 내 다른 파일 | 병렬 가능 |
| 같은 파일 다른 함수 | 위험 → 같은 에이전트 배정 |

### Phase 3: Team Formation (팀 구성)

분석 결과를 바탕으로 Claude Agent Team을 구성합니다.

**팀 구성 원칙:**

- 에이전트 수는 병렬 그룹 수와 일치 (보통 5-10개)
- 각 에이전트에 명확한 역할명 부여 (예: `test-fixer-config`, `ripgrep-developer`)
- 에이전트명은 작업 내용을 직관적으로 반영

**팀 생성 절차:**

1. `TeamCreate`로 팀 생성 (이름: `dbcode-sprint-{N}`)
2. 각 작업 그룹에 대해 `TaskCreate`로 태스크 등록
3. 각 태스크에 대해 `Agent` 도구로 팀원 스폰

**에이전트 스폰 시 설정:**

```
- mode: bypassPermissions (자동 실행)
- run_in_background: true (병렬)
- team_name: dbcode-sprint-{N}
```

**에이전트 프롬프트 템플릿:**

```
당신은 dbcode 프로젝트의 [{역할명}] 개발자입니다.

## 작업
{구체적 작업 내용}

## 변경 대상 파일
{파일 목록}

## 주의사항
- 다른 에이전트가 수정 중인 파일은 절대 건드리지 마세요: {충돌 파일 목록}
- 테스트 실행 시 LLM을 호출하지 마세요
- TypeScript strict mode 준수
- ESM import에 .js 확장자 필수

## 완료 조건
- 관련 테스트 통과
- TypeScript 타입 체크 통과
- 변경사항 요약 보고
```

### Phase 4: Execution & Monitoring (실행 및 모니터링)

모든 에이전트를 동시에 실행하고 완료를 기다립니다.

**모니터링:**

- 백그라운드 에이전트의 완료 알림을 수신
- 각 에이전트 완료 시 결과 요약을 기록
- 모든 에이전트 완료 후 다음 단계로 진행

**실패 처리:**

- 에이전트가 실패하면 → 에러 내용 분석 → 재시도 또는 수동 수정
- 파일 충돌 발생 시 → `git diff`로 충돌 확인 → 통합 에이전트가 해결
- 테스트 실패 시 → 실패한 테스트에 대해 추가 수정 에이전트 스폰

### Phase 5: Verification (검증)

모든 에이전트가 완료되면 전체 프로젝트를 검증합니다.

**검증 순서 (하나라도 실패 시 수정 후 재검증):**

```bash
# 1. 전체 테스트 실행
npx vitest run

# 2. 타입 체크
npm run typecheck

# 3. 린트
npm run lint

# 4. 빌드
npm run build
```

**검증 실패 시:**

- 테스트 실패: 실패 원인 분석 → 직접 수정 또는 수정 에이전트 추가 스폰
- 린트 에러: 직접 수정 (보통 간단한 수정)
- 타입 에러: 타입 관련 파일 분석 → 수정
- 빌드 에러: 임포트/익스포트 문제 확인 → 수정

### Phase 6: Commit & Push (커밋 및 푸시)

검증 통과 후 변경사항을 커밋합니다.

**커밋 메시지 형식:**

```
feat(sprint{N}): {스프린트 요약}

{각 작업 항목별 요약}

- Item 1: {설명}
- Item 2: {설명}
- ...

All {테스트 수} tests pass, typecheck clean, build succeeds.
```

**커밋 절차:**

1. `git status`로 변경 파일 확인
2. Sprint 관련 파일만 선별적으로 `git add` (unrelated 파일 제외)
3. 커밋 메시지 생성 및 커밋
4. `git push origin {branch}`

### Phase 7: Cleanup (정리)

- 팀 삭제: `TeamDelete` (팀 이름)
- 결과 요약 테이블 출력

## Output Format

스프린트 완료 시 아래 형식으로 결과를 보고합니다:

```markdown
## Sprint {N} Results — {X}/{Y} Items Delivered

| #   | Task     | Agent        | Status | Tests       |
| --- | -------- | ------------ | ------ | ----------- |
| 1   | {작업명} | {에이전트명} | {상태} | {통과/실패} |
| 2   | ...      | ...          | ...    | ...         |

**Commit**: `{hash}` — pushed to `origin/{branch}`
**Files changed**: {N} files, +{additions} / -{deletions} lines
**Quality gates**: typecheck {상태}, lint {상태}, build {상태}, tests {통과수}/{전체수}
```

## Dry Run Mode

`--dry-run` 플래그 사용 시:

- Phase 1-2만 실행 (분석만 수행)
- 팀 구성 계획을 출력하되 실제 에이전트는 스폰하지 않음
- 파일 충돌 분석 결과와 제안된 에이전트 배정 표시
- 사용자가 계획을 검토하고 조정할 수 있음

## Best Practices

1. **10개 이하의 에이전트** — 너무 많으면 관리 오버헤드가 커짐
2. **에이전트당 1-3개 파일** — 범위를 작게 유지해야 정확도가 높음
3. **테스트와 소스 함께** — 테스트 수정은 반드시 해당 소스와 같은 에이전트
4. **공통 파일은 마지막** — `index.ts`, `registry.ts` 같은 허브 파일은 통합 단계에서
5. **LLM 호출 금지** — 테스트 시 실제 LLM API 호출하지 않음 (모킹 사용)
6. **린트 에러는 직접 수정** — 에이전트 재스폰보다 빠름
