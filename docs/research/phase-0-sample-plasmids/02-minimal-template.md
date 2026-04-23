---
name: <your-plasmid-name>
description: "<한 줄 설명 — 10~500자 사이>"
active: true
scope: [<하나 이상: hooks | rules | skills | commands | agents | harness>]
priority: normal
types: [<하나 이상: behavioral | structural | ritualistic | epistemic | value>]
---

## Intent

<자연어로 의도를 쓰세요. "나는 ~를 원한다" 문장으로 시작하면 좋습니다.
 예: 나는 모든 PR description에 영향도 분석 섹션이 자동으로 포함되기를 원한다.>

## Behavior

<원하는 동작을 구체적으로 쓰세요. 언제, 어디서, 어떻게 일어나야 하는지.
 예:
 - PR 생성 시 agent가 변경된 파일을 분석
 - 영향받는 모듈/테스트를 자동 탐지
 - description 섹션 "## Impact Analysis" 에 결과 자동 삽입>

<!--
POC 참가자를 위한 힌트:

■ scope 선택 가이드:
  - hooks    : git / PreToolUse 등 자동 발화가 필요하면
  - rules    : 특정 경로/파일 대상 AI 가이드
  - skills   : 사용자가 /command로 명시 호출할 기능
  - commands : 새로운 슬래시 커맨드
  - agents   : 특정 역할의 서브에이전트
  - harness  : 리뷰/게이트 등 파이프라인 훅

■ types 선택 가이드:
  - behavioral  : AI의 응답 스타일/동작
  - structural  : 파일/artifact 생성
  - ritualistic : 정해진 단계/체크리스트
  - epistemic   : 정보 출처/검증 기준
  - value       : 원칙/가치관 (foundational tier와 자주 함께)

■ description은 10자 이상 500자 이하.
■ name은 kebab-case (소문자 + 하이픈), 파일명과 일치.

■ 이 템플릿의 frontmatter 6 필드 + Intent + Behavior 만 채워도 완성입니다.
   Optional extensions (tier, eval-seeds, privacy 등)은 Phase 1 이후 추가 가능.
-->
