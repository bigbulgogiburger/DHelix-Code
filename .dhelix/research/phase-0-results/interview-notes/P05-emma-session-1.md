---
participant_id: P05
persona: ollama-privacy
role: "Senior Backend (Legal SaaS, 6yr) — Ollama/llama3.1:8b user"
simulated: true
interviewer: Claude Code (self-dogfood)
session_date: 2026-04-23
duration_min: 68
recorded: synthetic
---

# Session 1 — P05 Emma Yoon (Ollama / Privacy)

## Background (Q1-Q3)

### Q1. Customization 빈도

**응답**: d. 드물게 (지금은)
**Quote**: "제 상황에서 AI coding tool 이 잘 안 먹어요. Cloud 못 쓰고, Ollama 는 품질 아쉬워서."

**Context**: 회사 보안 정책 — 고객 PII 데이터 다루는 repo 에서 cloud LLM 호출 금지 (GDPR + 국내 개인정보보호법). Ollama llama3.1:8b 가 유일한 옵션. Aider + continue.dev 일부 사용하지만 불만족.

### Q2. 최근 customization

**상황**: 최근 `claude-code` Ollama 연동 시도했으나:
- Function calling 불안정 (JSON parse fail 2회/10 호출)
- Rule 적용 빈도 낮음 (모델 attention 부족)
- 결국 포기하고 Aider 로 돌아감

**현재**: `~/legal-saas/CLAUDE.md` 20줄만 (기본 conventions)

### Q3. 소요 시간

**응답**: "한 달 전 도입 시도 4시간. 현재 거의 안 씀."

---

## Workflow 시연 관찰

**Task**: "SQL parameterized rule 추가"

| 시각 | 행동 |
|-----|-----|
| 00:00 | CLAUDE.md 열음 |
| 00:15 | Rule 추가 (단순) |
| 01:00 | Ollama 재시작 (rule reload 불확실) |
| 02:00 | 테스트: Ollama 에 SQL 작성 요청 — **rule 무시됨** (llama3.1:8b 가 긴 CLAUDE.md attention 잃음) |
| 03:00 | "이게 문제에요. Rule 이 있어도 로컬 모델이 까먹어요." |

**관찰**: **H4 motivation** — 로컬 LLM 환경에서 기존 rule 전달 방식 (CLAUDE.md prompt 주입) 이 신뢰할 수 없음. Plasmid system 의 artifact (hook) 기반 발현이 더 안정적 경로.

---

## Pain Points (Q4-Q8)

### Q4. 불편

**Quote**: "Rule 이 local LLM 응답에 반영되지 않는 게 가장 큰 문제. hook 같은 기술적 강제 외에는 신뢰 못해요."
**Painpoint #1**: Prompt-level rule 의 local LLM 무시

### Q5. 반영 확인

**응답**: "체계적 방법 없음. Claude 응답 보고 추정만."
**Painpoint #2**: Validation 부재 (cloud 환경 대비 심함 — 모델 noise 많음)

### Q6. 되돌리기

**응답**: "Rule 지웠는데 캐시에 남아있을까 걱정돼요. Ollama 가 prompt 캐싱 하는지 확인 못함."
**Painpoint #3**: Cache 불확실성 + privacy 민감도 (지운 rule 이 PII 데이터와 같이 LLM memory 에 남았다면?)

### Q7. 팀 공유

**응답**: "팀 5명 모두 Ollama 로 독립 작업. 회사 policy 상 중앙 공유 불가."
**Painpoint #4**: 팀 협업 mechanism 부재 (privacy 제약)

### Q8. 실패 관리

**응답**: "`.archive/` 에 보관. 하지만 PII 포함된 rule 도 있어서 백업 자체가 위험."

---

**Painpoint 카운트**: **4개 강한 signal** — H1 ✓

---

## Concept Exposure (Q9-Q12)

### Q9. 이해도: 5

**Quote**: "로컬 LLM first-class 는 저희 같은 사람한테 game-changer 에요. `privacy: local-only` 필드는 제가 딱 원하던 거."
**Expert understanding + emotional response**.

### Q10. 개선 여부: 5

**이유**: "Hook 기반 artifact 가 prompt-level rule 보다 reliable. `/cure` 전체 제거 메커니즘이 PII 걱정 해소."

### Q11. 당장 쓰기

**응답**: "**Yes, 절박하게**. 6개월 AI coding tool 대안 찾다가 이거 발견."

### Q12. 우려

- "Ollama JSON output fail 시 cascade 강제로 cloud 가는 시나리오 없나요?" → ("`privacy: local-only` 로 cascade 차단 가능") → "안도"
- "Model drift (`ollama pull` 재실행) 자동 감지 된다니 훌륭"
- "Recombination 시간 10분 이내 가능하다는 건 실제로 재현돼야 믿음. POC 에서 직접 측정하고 싶음"
- "Team 5명 공유 — `privacy: local-only` plasmid 도 팀 내 git 공유는 되겠죠?" → ("shared 모드 선택 가능, git commit 에 포함") → "OK"

---

## POC Scheduling (Q13)

- **참여**: **Yes, high priority** (H4 critical participant)
- **선호 시간**: 목요일 오전 + Ollama 실측 별도 1시간
- **Ollama**: **llama3.1:8b (1차 테스트)**, qwen2.5-coder:32b (2차)
- **프로젝트**: legal-saas (비공개, 화면공유만)
- **H4 task**: legal-sql-gate plasmid 작성 → minimal recombination Ollama 실행 → artifact 생성 + network 0 확인

---

## Interpretations

- H1 **매우 강한 신호**: 4 painpoint 모두 구체적, 현재 AI tool 대안 없음 상태
- H2 **매우 강한 신호**: Q10=5 + Q11=yes + "absolutely" level urgency
- **Emma 같은 페르소나 = dhelix "Privacy Guardian" 정확 매치 (PRD §31.3 v0.3 신규 추가된 페르소나)**
- **H4 critical**: Emma 의 Ollama 실측이 Phase 0 에서 유일한 empirical H4 데이터 포인트
- **Product priority insight**: Privacy 의 **심층** — 단순 "데이터 local" 이 아니라 "cache / backup / team share 까지 privacy-consistent" 필요. PRD §10.4 Threat Model 확장 고려

---

## Follow-up

- [x] POC 세션 초대 (Week 2 Day 4 + Ollama 실측 Day 5)
- [x] **H4 실측 후 결과 `ollama-measurement/` 에 기록**
- [ ] Alpha release 우선 초대 (Privacy Guardian 페르소나 first)
- **Product insight**: Phase 1 W1 부터 Ollama CI 테스트 확보 (Emma 같은 사용자가 바로 alpha 활용 가능하게)
