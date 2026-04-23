# Phase 0 — Sample Plasmids

**작성일**: 2026-04-23
**용도**: Phase 0 POC에서 참가자에게 보여줄 예시 plasmid 3종

각 파일은 **PRD §6.1.2 Core 6 필드 + §6.1.2 Optional Extensions** 스펙에 맞춰 작성되었다. Phase 1 Zod schema 구현 전이므로 문법 검증은 수동이며, Phase 0 POC 이후 Phase 1 schema와 대조하여 사후 검증한다.

## 파일 목록

| 파일 | 용도 | 페르소나 | Tier |
|-----|-----|--------|-----|
| `01-secure-commit-gate.md` | Concept Exposure에서 보여줄 **대표 예시** (복합 artifact — hook + rule + agent) | Heavy Claude Code | policy |
| `02-minimal-template.md` | POC task에서 **참가자가 채워 넣을 템플릿** (6 필드 + Intent + Behavior 골격만) | 모든 참가자 | (비워둠) |
| `03-core-values.md` | Foundational tier 개념 이해용 (challenge 메커니즘 예시) | 팀 리드 / 철학적 사용자 | foundational |

## 사용 시나리오

### Week 1 인터뷰 Concept Exposure (15분)

1. `01-secure-commit-gate.md` 열기 → "이 한 파일로 아래 세 개가 생성됩니다" 설명
   - `.dhelix/hooks/secure-commit-gate.js` (PreToolUse hook)
   - `.dhelix/rules/secure-commit-gate.md` (project rule)
   - `.dhelix/agents/secure-commit-gate.md` (agent override)
2. `03-core-values.md` 열기 → "foundational tier" 개념 + `/plasmid challenge` 흐름 소개
3. `02-minimal-template.md` 열기 → "POC에서는 이 템플릿만큼만 채우시면 됩니다"

### Week 2 POC (20분)

- 참가자에게 `02-minimal-template.md` 복사본 제공
- 6 frontmatter 필드 + `## Intent` + `## Behavior` 완성 목표
- 진행자는 `01`, `03`을 참고자료로 옆에 열어둠

## 주의

- 이 파일들은 **실제 recombination에 입력되지 않는다** (Phase 1+ 구현 전). 문서적 예시.
- Ollama 참가자 H4 실측에서는 **참가자가 작성한 자신의 plasmid**를 minimal generator 스크립트에 입력.
- Phase 1 Zod schema가 나오면 이 3개 파일을 회귀 테스트 픽스처로 이전.

## 검증 체크리스트 (Phase 0 실행 전)

- [ ] 3개 파일 모두 PRD §6.1.2 6 필수 필드 존재
- [ ] `scope` / `types` 값이 PRD enum과 일치
- [ ] `01`, `03`의 `eval-seeds`가 PRD §10.3 schema 준수
- [ ] 3개 파일 모두 참가자가 30초 안에 읽고 이해 가능한 분량 (~1 스크린)
