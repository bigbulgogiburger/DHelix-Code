# Recent Fixes

> 참조 시점: 최근 수정 이력 확인, 비슷한 이슈 디버깅 시

## 2026-03-18~19 수정 내역

| #   | 수정 내용                                             | 파일                                       |
| --- | ----------------------------------------------------- | ------------------------------------------ |
| 1   | `LOCAL_API_BASE_URL` / `LOCAL_MODEL` 최우선순위 적용  | `src/constants.ts`, `src/config/loader.ts` |
| 2   | URL 정규화 — `/chat/completions` 엔드포인트 자동 제거 | `src/llm/client.ts`                        |
| 3   | API 타임아웃 60s → 120s 연장                          | `src/config/defaults.ts`                   |
| 4   | MiniMax-M2.5 모델 capabilities 등록 (`/^minimax/i`)   | `src/llm/model-capabilities.ts`            |
| 5   | tsc/eslint/grep 등 항상 안전 명시                     | `src/core/system-prompt-builder.ts`        |

## QA 테스트 결과

- L1 129/150 (86%) · L2 122/150 (81.3%) · L3 81/100 (81%) = **332/400 (83.0%) Grade A**
- 상세: `.claude/docs/L1_L2_L3_qa-test.md`

## E2E 멀티턴 테스트 핵심

- **핵심 원칙**: QA 에이전트는 절대 코드를 직접 작성하지 않음. dbcode CLI가 파일 생성/수정/실행을 담당.
- **NEXUS.md 패턴**: headless 컨텍스트 제약 우회법. QA가 `NEXUS.md`에 프로젝트 사실을 기록 → 각 turn에서 dbcode에게 "NEXUS.md를 읽고 답하라" 지시 → 파일 기반 "메모리" 구현.
- TC-25 컨텍스트 유지 테스트 5/10 → **10/10** 달성.
