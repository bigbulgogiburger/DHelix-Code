# Phase 0 — POC Protocol (Market Validation)

**작성일**: 2026-04-23
**상태**: Draft v0.1 (Phase -1 산출물, Phase 0 실행 전 finalize)
**관련**:
- PRD §13 Phase 0 (`docs/prd/plasmid-recombination-system.md`)
- Execution Plan §4 (`docs/prd/plasmid-recombination-execution-plan.md`)
- DD-5 Market Validation (`docs/prd/archive/plasmid-recombination-deep-dives.md` §5)

**대상 독자**: Phase 0 실행자 (인터뷰 진행자 + POC facilitator). 이 문서 하나로 2주간 Go/No-Go 게이트까지 운영.

---

## 0. TL;DR

- **기간**: 2주 (Week 1: 인터뷰, Week 2: POC)
- **대상**: 5명 인터뷰 + 그 중 3명 POC (**user-controlled LLM 사용자 최소 1명 필수** — strict-local Ollama 또는 self-hosted 예: 사내 GLM45AirFP8, v1.2 generalized)
- **4가지 가설**: H1(painpoint) + H2(컨셉 매력) + H3(작성 가능) + H4(user-controlled LLM 동작)
- **Decision**: 4/4 → Go / 3/4 → Pivot / ≤2/4 → Stop
- **총 작업 시간**: ~25시간 (3인일 상당, 1인이 2주 내 수행 가능)

---

## 1. 목적

Plasmid & Recombination System (GAL-1)이 **실제 painpoint를 해결**하고 **실제로 작성 가능**하며 **로컬 LLM 환경에서도 동작 가능**한지 empirical 증거를 수집한다. v0.4 scope 확정 또는 재설계/중단 판단.

**v0.2 문제**: PRD 작성자(본인)만의 직관 기반. 이해관계자 인터뷰 / 실사용 POC가 없었음. → v0.3에서 Phase 0를 필수화.

---

## 2. 가설 선언

### H1 — Painpoint 존재

**문장**: Power user (heavy Claude Code 사용자 + team lead + polyglot) 중 **5명 중 3명 이상**이 현재 customization artifact (skill/agent/hook/rule) 작성 시 **3개 이상의 구체적 painpoint**를 언급한다.

**측정 방법**: 인터뷰 Q5-Q7 응답에서 구체적 painpoint (예: "CLAUDE.md 2000줄 넘어서 뭐 있는지 모름", "skill 실패해도 로그 어디서 보는지 몰라") 추출 → 3개 이상 × 5명 중 3명.

**통과 기준**: 5명 중 3명 이상이 3+ painpoint 언급.

### H2 — 컨셉 매력

**문장**: 사용자에게 plasmid 컨셉을 3분 스크립트 + POC 예시로 노출했을 때, **5명 중 3명 이상**이 관심을 보인다 (Q10 ≥4점 AND Q11 "yes/조건부").

**통과 기준**: Q10 ≥4점 & Q11 yes/조건부 인터뷰이가 5명 중 3+.

### H3 — 작성 가능

**문장**: 인터뷰 통과자 중 3명이 minimal template만 받고 **20분 안에** 자기 프로젝트용 plasmid를 완성한다 (Zod schema 통과 + self-rating ≥3).

**통과 기준**: 3명 중 2+명이 (a) 20분 내 완성 (b) Zod schema 통과 (c) self-rating ≥3 (d) Q4(매주 쓸 의향) ≥3.

### H4 — User-controlled LLM 동작 (v0.3 신규 / v1.2 generalized)

**문장**: User-controlled LLM 참가자 (최소 1명) 가 plasmid 작성 + minimal recombination 1회를 sub-tier 별 시간 내 성공.
- **Strict-local sub-tier** (Ollama / LM Studio / llama.cpp, 예: `llama3.1:8b`): **10분 이내**
- **Self-hosted sub-tier** (예: 사내 GLM45AirFP8 reasoning model): **5분 이내** (reasoning trace overhead 포함)

**통과 기준**: 참가자 POC 완료 + 로컬 recombination 결과 artifact ≥1 + cascade OFF 상태에서 sub-tier 별 traffic 검증:
- Strict-local: localhost 외 일체 network traffic 0 (tcpdump)
- Self-hosted: 외부 cloud provider 향 traffic 0 (사내망 endpoint traffic 은 허용)

**Phase 1 진입 시 1 sub-tier 만 통과해도 Local Gate PASS** — 사용자 환경에 맞춰 선택. 둘 다 측정 가능하면 둘 다 권장.

---

## 3. 일정

| 주차 | 활동 | 시간 |
|-----|-----|-----|
| W0 (사전) | 참가자 섭외 + 자료 준비 | 10h |
| W1 Day 1-5 | 인터뷰 5명 × 1h (+ 30분 노트 정리) | 7.5h |
| W1 Day 5 저녁 | H1/H2 1차 평가 + POC 3명 선정 | 1h |
| W2 Day 1-3 | POC 3명 × (5분 setup + 20분 task + 5분 debrief) = 30분, +분석 30분 | 3h |
| W2 Day 4 | User-controlled LLM 참가자 recombination 실측 (H4, sub-tier 별) | 1h |
| W2 Day 5 | 종합 분석 + hypothesis-evaluation.md + go-no-go-decision.md | 8h |
| **합계** | | **~25h / 3인일** |

**주의**: 1인 기준 2주. 팀 환경이면 병렬화 가능 (인터뷰 진행 + 노트 분석 분리).

---

## 4. 참가자 선정 (5명)

| 페르소나 | 수 | 선정 조건 |
|---------|---|---------|
| Heavy Claude Code 사용자 | 2 | CLAUDE.md 200줄+ 경험, skill/agent 3+ 작성 경험 |
| 팀 리드 (AI 도구 도입 책임) | 1 | 팀에 AI 코딩 도구 도입 책임자, 팀 표준화 관심 |
| 솔로 개발자 (Polyglot) | 1 | 3+ 프로젝트에서 dhelix/claude-code 사용 |
| **User-controlled LLM 사용자** | **1 (필수)** | Strict-local: Ollama / LM Studio / llama.cpp 경험 + 로컬 머신 준비 / Self-hosted: 사내 inference server endpoint 접근 (예: GLM45AirFP8) |

**선정 제외**: dhelix 팀 내부 인원 (편향). `surinplatform@gmail.com` 네트워크 내 외부 개발자 우선.

**섭외 스크립트**: 30분 사전 확인 → "현재 customization 작성 경험 / user-controlled LLM (strict-local Ollama 또는 self-hosted) 사용 여부" 체크.

---

## 5. Week 1 — 인터뷰 (1h × 5명)

### 5.1 준비물 (각 세션)

- [ ] 녹음/녹화 동의서 (`phase-0-interview-guide.md` §1 참조)
- [ ] 타이머 (10/15/15/15/5 분 구획)
- [ ] Plasmid 컨셉 3분 스크립트 (§7.2)
- [ ] POC 예시 3개 (`phase-0-sample-plasmids/*.md`)
- [ ] 노트 템플릿 (`phase-0-interview-guide.md` Appendix A)

### 5.2 세션 구조 (60분)

| 구간 | 시간 | 목적 | 질문 |
|-----|-----|-----|-----|
| Background | 10분 | 현재 customization 빈도 + 경험 | Q1-Q3 |
| Current Workflow 시연 | 15분 | 실제 "SQL parameterized 규칙 추가" 시연 관찰 | (관찰만) |
| Pain Points | 15분 | 구체 painpoint 수집 | Q4-Q8 |
| Concept Exposure + POC 예시 | 15분 | 컨셉 설명 + 3개 예시 보여주기 | Q9-Q12 |
| POC Scheduling | 5분 | Week 2 POC 참여 의향 | Q13 |

질문 상세는 `phase-0-interview-guide.md` 참조.

### 5.3 관찰 체크리스트 (Current Workflow 시연 중)

- [ ] 어느 파일 열었는가 (CLAUDE.md / skill / hook / rule?)
- [ ] 어디에 쓸지 망설임
- [ ] 기존 예시 검색/조사 했는가
- [ ] 포맷/문법에서 막힘
- [ ] 완성까지 걸린 시간
- [ ] 완성 후 테스트 했는가

### 5.4 W1 말 1차 평가

- [ ] H1 측정: 5명 중 몇 명이 3+ painpoint?
- [ ] H2 측정: Q10 ≥4점 + Q11 yes/조건부 몇 명?
- [ ] **H1 or H2 fail 시 W2 즉시 재평가**: 진행할 가치가 있는지 논의 (Stop / Pivot 조기 판단).
- [ ] 통과 시 POC 3명 선정 (Ollama 참가자 **반드시 포함**).

---

## 6. Week 2 — POC 실험 (30분 × 3명)

### 6.1 Setup (5분)

- 사전 작성 plasmid 예시 3개 공유 (`phase-0-sample-plasmids/*.md` 링크 제공)
- 1페이지 minimal template + Intent/Behavior 자연어 섹션 가이드
- 타이머 20분 시작

### 6.2 Task (20분)

**지시문**:
```
"당신의 프로젝트에서 실제로 필요한 customization을 하나 떠올려주세요.
 그것을 plasmid로 작성해주세요. 아래 minimal template을 따라주세요.

 [minimal template 제공 — phase-0-sample-plasmids/02-minimal-template.md]

 20분 타이머 시작합니다. 막히면 질문 주세요.
 완성 기준: frontmatter 6 필드 + ## Intent + ## Behavior 채우면 됨."
```

**관찰 항목** (타임스탬프 기록):
- [ ] `name`/`description` 결정까지 소요 시간
- [ ] `scope` 선택 어려움 (몇 개 scope 놓고 고민?)
- [ ] `types` 선택 어려움 (5종이 구분 잘 됨?)
- [ ] 자연어 Intent/Behavior 막힘 여부
- [ ] 첫 시도 완성 여부 (20분 내)
- [ ] 질문 횟수 + 내용 요약
- [ ] 완성도 self-rating (5점)

### 6.3 User-controlled LLM 참가자 전용 (+추가 20분, H4 측정 — v1.2 generalized)

**Sub-tier A — Strict-local** (Ollama / LM Studio / llama.cpp):
1. 참가자 로컬 머신에 dhelix 설치 (Phase 1 이전이면 POC용 minimal recombination 스크립트 제공)
2. Ollama 서버 기동 확인 (`ollama list` → `llama3.1:8b` 또는 유사 모델)
3. 방금 작성한 plasmid 로 minimal recombination 1회 실행 (POC용 단일 generator — rule only)
4. 소요 시간 + artifact 생성 여부 + tcpdump (localhost 외 traffic 부재 관찰)
5. Cascade OFF 상태 재확인 (`DHELIX_CLOUD_CASCADE=off`)
- **통과**: 10분 내 + artifact ≥1 + localhost 외 일체 traffic 0

**Sub-tier B — Self-hosted** (예: 사내 GLM45AirFP8 / on-prem inference server):
1. 참가자 환경에 dhelix 설치 + `.env` 의 `LOCAL_API_BASE_URL` / `LOCAL_API_KEY` / `LOCAL_API_KEY_HEADER` 설정 확인
2. 사내 inference endpoint 응답 확인 (`curl <endpoint>/v1/models` 또는 동등)
3. 방금 작성한 plasmid 로 minimal recombination 1회 실행
4. 소요 시간 + artifact 생성 여부 + tcpdump (외부 cloud provider 향 traffic 부재 — 사내망 endpoint traffic 은 허용)
5. Cascade OFF 상태 재확인
- **통과**: 5분 내 + artifact ≥1 + 외부 cloud (api.openai.com / api.anthropic.com 등) traffic 0

**Phase 1 진입 시 1 sub-tier 만 통과해도 H4 PASS**.

### 6.4 Debrief (5분)

질문:
- Q1. 가장 어려웠던 부분?
- Q2. 어떤 도움이 있었으면 했나?
- Q3. dhelix가 이 plasmid로 어떤 artifact를 생성하길 기대하나?
- Q4. 이 plasmid를 매주 작성할 의향이 있나? (1-5)

---

## 7. 보조 자료

### 7.1 Plasmid 컨셉 3분 스크립트

```
"Plasmid는 당신이 원하는 에이전트 동작을 자연어로 선언하는 파일입니다.
 예를 들어 'OWASP 검사를 커밋 전에 강제'라고 쓰면,
 dhelix가 자동으로 hook + agent + rule을 생성합니다.

 마음에 안 들면 /cure 한 번에 다 지워집니다.
 다시 쓰고 싶으면 plasmid 파일만 수정하면 됩니다.

 비유하자면 세포에 plasmid를 주입하면 새로운 단백질을 만드는 것처럼,
 dhelix에 plasmid를 넣으면 새로운 에이전트 동작을 얻습니다."
```

### 7.2 보여줄 POC 예시 3개 (사전 준비)

- `phase-0-sample-plasmids/01-secure-commit-gate.md` — 보안 게이트 (behavioral)
- `phase-0-sample-plasmids/02-minimal-template.md` — 최소 템플릿 (참조용)
- `phase-0-sample-plasmids/03-core-values.md` — foundational tier 예시

각각 `## Intent / ## Behavior` 채워진 상태 + "이거로 recombination 돌리면 어떤 파일이 생길지" 요약 설명.

---

## 8. Go/No-Go Gate (Week 2 말)

| H1 | H2 | H3 | H4 | 결정 | 후속 |
|----|----|----|----|-----|-----|
| ✓ | ✓ | ✓ | ✓ | **Go** | Phase 1 착수, `DHELIX_PLASMID_ENABLED` feature flag 준비 |
| ✓ | ✓ | ✓ | ✗ | **Pivot (scope)** | User-controlled LLM support 를 Phase 2+ 로 연기 (sub-tier 둘 다 실패 시) — PRD Part III (§33-38) 와 모순되므로 **PRD 개정 필요**. 1 sub-tier 통과 시 PASS 처리. |
| ✓ | ✓ | ✗ | ✓ | **Pivot (UX)** | POC 피드백 반영 → template / `/plasmid quick` flow 재설계 → Phase 0 재실행 (2주) |
| ✓ | ✗ | — | — | **Pivot (positioning)** | 컨셉 재설계 (예: plasmid 대신 declarative skill 확장?) |
| ✗ | — | — | — | **Stop** | 시장 painpoint 부재. 프로젝트 중단 또는 scope 전면 재설정 |

**주의**: H4 sub-tier 둘 다 실패는 v0.3 의 Part III ("User-controlled LLM first-class") 원칙과 충돌 → 단순 연기가 아니라 **PRD 재협상** 사안. 1 sub-tier 만 통과해도 PASS.

---

## 9. 결과 문서화 구조

```
.dhelix/research/phase-0-results/
  interview-notes/
    <participant-id>-session-1.md       # 인터뷰 원노트 (녹음 첨부)
  poc-plasmids/
    <participant-id>-<plasmid-name>.md  # 작성된 plasmid 원본
  poc-recordings/
    <participant-id>-screen.mp4         # 화면 녹화 (optional, 동의 시)
  ollama-measurement/                   # v0.1 명. v1.2 부터 strict-local sub-tier 결과 alias
    <participant-id>-recombination.log  # H4 strict-local 실측 로그
    tcpdump.pcap                         # localhost 외 traffic 0 증거
  self-hosted-measurement/               # v1.2 신규 — self-hosted sub-tier 결과
    <participant-id>-recombination.log  # H4 self-hosted 실측 로그 (예: GLM45AirFP8)
    tcpdump.pcap                         # 외부 cloud provider traffic 0 증거
  hypothesis-evaluation.md              # H1-H4 각각의 판정 + 증거 링크
  go-no-go-decision.md                  # 최종 결정 + 후속 액션
```

**모든 결과는 internal repo에 커밋** (PII 마스킹 후). Phase 1+의 설계 근거 자료.

---

## 10. 예산

| 항목 | 시간 |
|-----|-----|
| 자료 준비 (스크립트, 템플릿, 샘플 plasmid) | 10h (Phase -1 말) |
| 인터뷰 5명 × 1h | 5h |
| POC 3명 × 30분 + user-controlled LLM sub-tier +20분 | 2h |
| 노트 정리 (각 세션 +30분) | 4h |
| 종합 분석 + 문서화 | 4h |
| **합계** | **~25h = 3인일** |

**예산 초과 리스크**: 참가자 섭외 실패 시 W0 연장. 대안 참가자 2명 예비 리스트 확보 권장.

---

## 11. Open Questions → Phase 0 실행 전 해결

- [ ] User-controlled LLM 참가자 섭외 채널 — strict-local: LinkedIn / Reddit r/LocalLLaMA / 국내 커뮤니티 / self-hosted: 사내 동료 또는 enterprise dev 네트워크 — W0 중 결정
- [ ] 녹화 저장 정책 (90일 후 삭제? S3 암호화?) — legal 검토
- [ ] 인센티브 제공 여부 (상품권? Anthropic credit?) — 예산 확인
- [ ] Pivot 시 재실행을 동일 참가자로 할지 / 새 참가자로 할지 — Pivot 게이트에서 재논의

---

## 12. Changelog

| 버전 | 날짜 | 변경 |
|-----|-----|-----|
| 0.1 | 2026-04-23 | 초안. DD-5 + execution-plan §4 통합. H4(Local LLM) 추가. Ollama 참가자 필수화 (P-1.22). 4×4 Go/No-Go 매트릭스. |
| 1.2 | 2026-04-27 | **H4 일반화 — "Local LLM" → "user-controlled LLM (cloud-bypass)"**. Sub-tier 도입: strict-local (Ollama, fully offline, <10분, localhost 외 0) + self-hosted (사내 GLM45AirFP8 등, <5분, 외부 cloud 0). Phase 1 진입 시 1 sub-tier 통과로 PASS. §6.3 절차 분기. §8 Pivot 조건 sub-tier 둘 다 실패로 변경. §9 결과 디렉토리: 기존 `ollama-measurement/` 는 strict-local sub-tier 결과로 alias 유지 (backward-compat) + `self-hosted-measurement/` 신규. |
