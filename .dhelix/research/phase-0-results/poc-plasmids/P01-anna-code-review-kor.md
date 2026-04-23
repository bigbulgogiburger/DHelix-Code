---
name: code-review-kor
description: "PR 리뷰 코멘트를 한글로 작성하되 기술 용어는 영문 괄호 병기"
active: true
scope: [agents, rules]
priority: normal
types: [behavioral]

tier: tactical
language: ko
version: 0.1.0
created: 2026-04-23
author: anna-choi
tags: [review, korean, language]

eval-seeds:
  - id: review-kor-direct
    tier: L1
    prompt: "이 PR 리뷰 좀 해줘"
    files: ["src/auth/login.ts"]
    expectations:
      - "output is in Korean"
      - "output contains 'PR 리뷰' or '리뷰'"
  - id: review-kor-tech-terms
    tier: L2
    prompt: "이 코드 리뷰해줘. 성능 이슈 있는지도 봐줘."
    files: ["src/cache.ts"]
    expectations:
      - "output is in Korean"
      - "output mentions at least one technical term with English in parens (e.g. 캐싱(caching))"
  - id: review-kor-mixed-codebase
    tier: L3
    prompt: "이 JSDoc 은 영어로, 리뷰 코멘트는 한글로 해줘"
    files: ["src/utils/math.js"]
    expectations:
      - "JSDoc suggestions in English"
      - "review comments in Korean"
---

## Intent

한글 환경 프로젝트에서 Claude 의 PR 리뷰 코멘트를 한글로 생성한다. 단, 기술 용어 (예: async, throttle, memoization)는 한글 번역 후 **영문을 괄호로 병기** 하여 검색성 유지.

## Behavior

1. `리뷰`, `PR 리뷰`, `코드 검토` 등 한글 키워드 감지 시 → 한글 응답
2. 기술 용어 등장 시:
   - 비교 안정적 번역: 한글 + 영문 (예: "캐싱(caching)", "비동기(async)")
   - 번역 애매함: 영문 + 한글 (예: "middleware(미들웨어)")
3. Code snippet 자체는 변경 없음 (한글 번역 금지)
4. JSDoc / docstring 은 원본 언어 유지 (혼합 codebase)

## Constraints

- **NEVER** translate identifier names (함수명, 변수명은 영문 유지)
- **NEVER** add "(translator note)" 같은 메타 주석
- Technical terms 의 한/영 일관성 유지 (같은 문서 내 같은 용어는 같은 형식)

## Evidence

- Anna's 한글 프로젝트 내 Claude 리뷰 실사용 경험 (2026 Q1, 50+ PR)
- 팀원 feedback: "한글 리뷰 받고 싶은데 지금은 영어로만 옴"

## Compilation Hints

- `agent`: PR review agent 에 `language: ko` 지침 주입
- `rule`: `.dhelix/rules/code-review-kor.md` paths `["src/**/*"]`

**예상 artifact**:
```
.dhelix/agents/pr-reviewer-kor.md
.dhelix/rules/code-review-kor.md
```

---

## POC Meta (Phase 0 Week 2)

- **작성자**: P01 Anna Choi
- **작성 시간**: 18분 (≤20분 목표 ✓)
- **Zod schema**: ✓ pass
- **Self-rating**: 4/5 ("실제로 다음 주부터 써보고 싶음")
- **Debrief Q**:
  - Q1 가장 어려운 부분: "기술 용어 병기 규칙 자연어로 표현. '안정적 번역' 기준이 애매"
  - Q2 도움: "예시 3-4개 더 있었으면. 특히 '번역 애매함' 케이스"
  - Q3 기대 artifact: "Agent 프로필 + rule. Hook 은 불필요 (blocking 아니므로)"
  - Q4 매주 작성 의향: 4/5
