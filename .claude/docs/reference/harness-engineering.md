# Harness Engineering Integration

> 참조 시점: `HARNESS_MODE` 설정 변경, Jira/Harness 스킬 체인 수행, 프로젝트 에이전트 디스패치 규칙 확인, `.claude/runtime/` 아티팩트 점검.

## 개요

Harness Engineering은 Jira 이슈 실행 워크플로(`/jira-start` → `/jira-plan` → `/jira-execute` → `/jira-test` → `/jira-commit` → `/jira-complete`)에 Sprint Contract · 다중 리뷰어 fan-out · aggregate verdict gate를 추가하는 레이어이다. 기존 Jira 스킬의 각 단계 사이에 `harness-*` 스킬을 섞어 자동화한다.

## 운영 모드 (`HARNESS_MODE`)

환경 변수는 `.claude/settings.local.json` 의 `env` 섹션에서 관리한다.

| 모드 | 행동 |
|------|------|
| `auto` | UserPromptSubmit hook이 harness 단계를 강제 주입. `git commit` 전 `.claude/runtime/aggregate-verdict.md` 가 PASS가 아니면 커밋 차단 |
| `suggest` (기본) | Hook이 제안만, 차단하지 않음 |
| `off` | Harness 완전 비활성 |

## 워크플로 규칙

- `/jira-plan` 완료 후 `/harness-plan` 실행을 제안
- `/jira-execute` 각 Phase 완료 후 `/harness-review` 제안
- `/jira-commit` 전 `.claude/runtime/aggregate-verdict.md` verdict 확인 권장

## 에이전트 디스패치 (프로젝트 > 글로벌)

`dhelix-*` 로 시작하는 프로젝트 에이전트는 동일 역할의 글로벌 에이전트보다 **우선** 선택.

| 작업 | 우선 에이전트 |
|------|--------------|
| 코드베이스 탐색 | `dhelix-explorer` |
| 보안 리뷰 | `dhelix-security-reviewer` |
| 테스트 드래프트 | `dhelix-test-writer` |
| 빌드/타입 에러 | `dhelix-build-resolver` |
| 새 모듈 / import / 리팩토링 | `dhelix-architecture-reviewer` |
| 새·수정된 built-in tool | `dhelix-tool-reviewer` |
| LLM provider · capabilities · registry 변경 | `dhelix-llm-adapter-reviewer` |
| `src/cli/` Ink 컴포넌트·훅·레이아웃 | `dhelix-ink-ui-reviewer` |
| RuntimePipeline · Recovery · Compaction · Session | `dhelix-agent-loop-reviewer` |
| MCP (3-scope · OAuth · A2A) | `dhelix-mcp-reviewer` |
| `src/guardrails/` | `dhelix-guardrails-reviewer` |
| Trust tier · ApprovalDB · SIEM · Sandbox | `dhelix-permissions-reviewer` |
| Skills · 슬래시 커맨드 · Command Bridge | `dhelix-skills-reviewer` |

## 아티팩트 경로

| 용도 | 경로 |
|------|------|
| dev-guide | `docs/{ISSUE-KEY}-dev-guide.md` |
| Sprint Contract | `.claude/runtime/sprint-contract/{ISSUE-KEY}.md` |
| Verdict | `.claude/runtime/aggregate-verdict.md` |
| Workflow State | `.claude/runtime/workflow-state.json` |
| Checkpoint | `.claude/runtime/checkpoint.md` |
| Metrics Scorecard | `.claude/runtime/harness-metrics/scorecard.md` (`aggregate.sh` 로 갱신) |

## 관련 스킬

| 스킬 | 용도 |
|------|------|
| `harness-setup` | 프로젝트 최초 harness 구성 |
| `harness-plan` | Sprint Contract 작성 |
| `harness-review` | 다중 리뷰어 fan-out |
| `harness-gate` | 커밋 전 품질 게이트 (aggregate verdict + 빌드/타입/린트) |
| `harness-score` | Post-merge VALID/INVALID 사후 채점 |
| `harness-shadow` | Baseline vs harness counterfactual 비교 |
| `harness-workflow` | Jira + harness 통합 오케스트레이터 |
| `harness-resume` | 체크포인트 복원 |

## 주의사항

- `aggregate-verdict.md` 가 PASS가 아닌데 `auto` 모드에서 `--no-verify` 로 커밋 우회하지 말 것 — 우회가 반복되면 harness 신뢰도 붕괴
- `dhelix-*` 에이전트가 존재해도 역할이 정확히 일치하지 않으면 글로벌로 fallback 허용 (억지로 매핑 금지)
- Shadow run은 5개 이슈 중 1개 주기로 수행 — 매번이면 비용 과다, 전혀 안 하면 baseline 우월 증거 없음
