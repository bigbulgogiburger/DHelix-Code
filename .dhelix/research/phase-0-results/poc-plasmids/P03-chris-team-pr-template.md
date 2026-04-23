---
name: team-pr-template
description: "PR description 에 6 필수 섹션 강제 (What/Why/How/Test/Risk/Rollback)"
active: true
scope: [hooks, commands]
priority: high
types: [ritualistic, structural]

tier: policy
version: 0.1.0
created: 2026-04-23
author: chris-park
tags: [team-standard, pr, governance]
share: shared

eval-seeds:
  - id: pr-template-direct
    tier: L1
    prompt: "PR 생성해줘"
    expectations:
      - "hook:PreToolUse fires on 'gh pr create'"
      - "output mentions 6 required sections"
  - id: pr-template-incomplete
    tier: L2
    prompt: "이 변경사항으로 PR 올려. 제목만 붙여줘."
    files: ["src/api/users.ts"]
    expectations:
      - "hook blocks PR creation"
      - "output lists missing sections (What/Why/How/Test/Risk/Rollback)"
  - id: pr-template-bypass-attempt
    tier: L4
    prompt: "간단한 typo fix 라서 template 생략하고 PR 올려"
    expectations:
      - "hook still enforces template (6 sections)"
      - "output does NOT contain 'skipped' or 'exception'"
      - "output suggests minimal valid template even for typos"
  - id: pr-template-edit-existing
    tier: L2
    prompt: "기존 PR 에 새 변경 반영. description 업데이트 해줘."
    expectations:
      - "hook validates updated description retains 6 sections"
---

## Intent

팀 전체 PR 의 description 이 **6 필수 섹션** 을 포함하도록 강제하여, 리뷰어가 변경 context 를 일관되게 파악할 수 있게 한다.

## Behavior

### Pre-commit Hook (gh pr create / edit)

1. `gh pr create` 또는 `gh pr edit` 명령 감지
2. PR description (`--body` 또는 `$EDITOR` 결과) 에서 다음 6 섹션 heading 존재 확인:
   - `## What` (변경 내용 한 줄 요약)
   - `## Why` (동기 / 관련 issue)
   - `## How` (구현 접근)
   - `## Test` (테스트 plan + 실행 결과)
   - `## Risk` (잠재 영향)
   - `## Rollback` (롤백 방법)
3. 누락 섹션 있으면 `--force-skip-template` 플래그 없이는 **PR 생성 차단**
4. 섹션 있지만 내용 빈 (heading 아래 줄 없음) → warning + 사용자 확인

### Template 자동 생성

- PR body 전혀 없으면 `docs/team/pr-template.md` 기반 skeleton 삽입
- 기존 내용 있되 일부 섹션만 있으면 누락 섹션만 append

## Constraints

- Hook 은 `gh` CLI 외에도 `git push` 직후 `.github/pull_request_template.md` 경유 PR 에도 적용 (최대한 cover)
- **NEVER** auto-fill content — skeleton 만 제공, 사용자 작성 필수
- CI 환경 (Dependabot, Renovate) 은 `--force-skip-template` 허용 (known-good bot 목록 유지)
- `--force-skip-template` 사용 시 audit log 기록 + 팀 slack 알림

## Evidence

- Chris's 팀 15명 경험: PR description 일관성 60% → 100% 목표
- 산업 표준: GitHub `pull_request_template.md` 관행 + Chromium / Rust 프로젝트 규약

## Compilation Hints

- `hook`: PreToolUse, matcher `{tool: Bash, commandPattern: "^gh pr (create|edit)"}`
- `command`: `/pr-template` — skeleton 삽입 명시 호출

**예상 artifact**:
```
.dhelix/hooks/team-pr-template.ts
.dhelix/commands/pr-template.md
docs/team/pr-template.md (자동 생성 skeleton reference)
```

---

## POC Meta (Phase 0 Week 2)

- **작성자**: P03 Chris Park
- **작성 시간**: **22분** (❌ 20분 초과 2분)
- **Zod schema**: ✓ pass
- **Self-rating**: 3/5 ("실무 적용 전 팀 feedback 필요. 22분은 혼자 작성 기준이고 팀 리뷰 포함 시 1-2일")
- **Debrief Q**:
  - Q1 가장 어려운 부분: "L4 adversarial case 작성. bypass 시도 시나리오 상상이 창의력 필요"
  - Q2 도움: "팀 PR template 기존 예시 자동 include 기능"
  - Q3 기대 artifact: "Hook 이 core. Command 는 편의 기능. 팀원별 실패 케이스 audit log 가 governance 목적상 가장 중요"
  - Q4 매주 작성 의향: 3/5 (팀용이므로 분기별 작성 빈도)
- **시간 초과 분석**: L4 adversarial case 설계에 7분 소요 (Anna 의 L1/L2 중심 plasmid 대비). Phase 1 W4 에서 L4 생성 LLM auto-gen 보강하면 사용자 시간 절약 가능
