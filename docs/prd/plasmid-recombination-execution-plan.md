# Execution Plan — Plasmid & Recombination System (GAL-1)

**작성일**: 2026-04-23
**상태**: v1.0 — Living document (각 Phase 완료 시 갱신)
**관련**: `docs/prd/plasmid-recombination-system.md` (PRD v0.3, SSOT)

**이 문서의 역할**:
PRD v0.3은 "**무엇을 만드나**"를 담는다. 이 문서는 "**어떻게 진행하나**"를 담는다.
PRD를 복제하지 않고, 참조(§번호)로만 연결한다.

**대상 독자**: Phase -1을 시작하는 본인(또는 팀원)이 이 문서 하나만 열고도 다음 액션을 알 수 있어야 한다.

---

## 0. How to Use This Document

1. **처음 열 때**: §1 Document Map → §2 Big Picture → §3 현재 Phase로 점프
2. **매 주 시작**: §3 또는 §4의 해당 주차 체크리스트 확인
3. **매일 시작**: 직전에 체크 못한 action item 이어서
4. **막힐 때**: §7 Reference Map에서 상황별 1차 참조 열기
5. **Phase 완료 시**: §3의 Exit Gate 체크 → 다음 Phase로 이동 + 이 문서 갱신

**원칙**:
- 날짜가 어긋나도 **순서**는 지킨다 (의존 관계 보호)
- 설계(Phase -1)는 **설계만**, 코드 작성은 Phase 1부터
- Entry Gate 통과 전 다음 Phase 진입 금지

---

## 1. Document Map

| 문서 | 역할 | 언제 참조 |
|-----|-----|---------|
| **`docs/prd/plasmid-recombination-system.md`** | **SSOT** — 무엇을 만드나 | 항상. 90% 여기서 끝 |
| `docs/prd/plasmid-recombination-execution-plan.md` | **(본 문서)** 어떻게 진행하나 | 매일 |
| `docs/prd/archive/plasmid-recombination-hardening.md` | v2.0 하드닝. P-1.XX 상세 근거, §19 action list 원본 | P-1 item 세부 볼 때 |
| `docs/prd/archive/plasmid-recombination-deep-dives.md` | DD-1~DD-6 구체 엔지니어링 해법 (Zod 코드, object store 등) | 구현 디테일 |
| `docs/prd/archive/plasmid-recombination-review.md` | 초기 판단 오류(F2/F3) 정정 기록 | 거의 안 봄 |
| `CLAUDE.md` | dhelix 프로젝트 전체 규칙 (layer, ESM, commit) | 코드 작성 시 항상 |
| `.claude/docs/reference/*.md` | dhelix 내부 13개 reference | 기존 모듈 파악 시 |

---

## 2. Big Picture Timeline

| Phase | 기간 | 목적 | 코드 작성? | 참조 PRD § |
|------|-----|-----|---------|----------|
| **Phase -1** | 3.5주 | 설계 확정 (23 remaining items) | ❌ (설계만) | §13, archive/hardening §19 |
| **Phase 0** | 2주 | POC + 시장 검증 (Go/No-Go) | 최소 (POC용) | §13, archive/deep-dives DD-5 |
| **Phase 1** | 5주 | Foundation (plasmid types, I-8, `/plasmid`) | ⭕ | §6.1, §6.2, §7, §10.1 |
| **Phase 2** | 5주 | Compile+Integrate (`/recombination` stage 0-5) | ⭕ | §6.3 (stage 0-5), §7 |
| **Phase 3** | 5주 | Verify + Cure v0 (stage 6-7, `/cure`) | ⭕ | §6.3 stage 6-7, §6.4, §8 |
| **Phase 4** | 4주 | Advanced generators + Cure v1 (3-way merge) | ⭕ | §13 |
| **Phase 5** | 3주 | Research-assisted + Foundational | ⭕ | §9, §22.4 |
| **Phase 6** | 2주 | Polish + dogfood | ⭕ | §13 |
| **합계** | **29.5주** | | | |

**현재 위치**: **Phase -1 진입 준비 완료**. P-1.24 (PRD v0.3 통합)는 이미 완료됨.

---

## 3. Phase -1 — Design Consolidation (3.5주)

### 3.1 완료 현황 (1/24)

- [x] **P-1.24** PRD v0.3 통합 + 아카이빙 — *커밋 `166f3a0` 완료*

**남은 항목: 23개**. 아래 §3.3에서 주차별로 그룹핑.

### 3.2 Dependency Graph

```
                    ┌─→ P-1.14 (I-8 Hermeticity, Critical)
                    │       │
Week 1 기초     ────┤       ├─→ P-1.13 (Compression 4-layer)
                    │       ├─→ P-1.15 (Constitution Reorg)
                    │       └─→ P-1.19 (Strategy selector)
                    │                    ↑
                    └─→ P-1.18 (ModelCapabilities) ─┘

Week 2-3 검증   ────  P-1.16 (Validation framework, Critical)
                         ├─→ P-1.17 (eval harness 재사용)
                         ├─→ P-1.23 (eval-seeds schema)
                         └─→ P-1.21 (dual-model config)

Week 3 Local    ────  P-1.18 → P-1.20 (degradation matrix)
                              → P-1.22 (POC Ollama 필수)

Week 3 UX/철학  ────  P-1.5 (Quick-first) 병렬
                       P-1.10 (Foundational + /challenge)
                       P-1.7 (Fail-to-draft)

Week 3-4 Carryover ── P-1.1~4, P-1.6, P-1.8, P-1.9, P-1.11, P-1.12
```

### 3.3 주차별 체크리스트

#### Week 1 — 경계와 기반 (Critical 먼저)

**목표**: 모든 후속 설계의 **전제**가 되는 경계를 확정.

- [ ] **P-1.14** I-8 Compile-Runtime Hermeticity + 3층 방어 (1d)
  - 참조: PRD §10.1 I-8, §7.4, archive/hardening Part I §1 (3층 방어 코드)
  - 산출물: `RUNTIME_BLOCKED_PATTERNS` 정의, `src/instructions/loader.ts` 수정 계획, tool guardrail 스펙 (`src/tools/pipeline/preflight.ts` 또는 `src/tools/definitions/file-read.ts` 등), telemetry metric 명세
  - Done when: PR 없이도 "어느 파일에 어떤 가드를 넣는가" 문서로 확정

- [ ] **P-1.18** `ModelCapabilities` 확장 (0.5d)
  - 참조: PRD Part III §34, archive/hardening §4.2
  - 산출물: `src/llm/model-capabilities.ts` 확장 스펙 (isLocal, paramEstimate, reliableJson, supportsFormatJson, modelDigest 필드)
  - Done when: 신규 필드와 기본 모델 매핑 테이블 확정

- [ ] **P-1.19** Pipeline Strategy Selector matrix (1d) ← P-1.14, P-1.18 선행
  - 참조: PRD Part III §34.2, archive/hardening §4.3
  - 산출물: `selectStrategies(caps)` 명세 — interpreter/compression/reorg/validation 각 분기 표
  - Done when: Strategy 매트릭스가 코드 스텁 수준으로 완성

#### Week 1-2 — Compile 성분

- [ ] **P-1.13** Compression pipeline 4-layer 설계서 (1d) ← P-1.14 선행
  - 참조: PRD §6.3.2 Stage 2c, archive/hardening §6.3
  - 산출물: Layer A/B/C/D 각 입출력, tier-aware ratio, bucket 구조, token budget 재분배 (`system-prompt-builder.ts`)
  - Done when: "10 plasmid → 1500 tokens" 계산이 명시된 설계서

- [ ] **P-1.23** `eval-seeds` Zod schema + frontmatter 통합 (0.5d)
  - 참조: PRD §6.1.2, §10.3, `src/skills/creator/evals/types.ts` (기존 `evalCaseSchema`)
  - 산출물: `plasmidEvalSeedSchema` (extends `evalCaseSchema` + `tier` 필드), frontmatter parser 통합 지점
  - Done when: Sample plasmid에 eval-seeds 3개 (L1/L2/L4) 유효 검증 통과

- [ ] **P-1.17** 기존 eval harness 재사용 통합 설계 (0.5d)
  - 참조: `src/skills/creator/evals/` (runner, grader, aggregator, workspace)
  - 산출물: 재사용 범위와 확장 지점 명시 (`src/recombination/validation/*`이 어느 함수를 호출할지)
  - Done when: 재사용 API surface 문서화

#### Week 2 — Integrate 성분

- [ ] **P-1.15** Constitution Reorganizer 설계 (marker 규약) (1d) ← P-1.14 선행
  - 참조: PRD §6.3.2 Stage 2d, archive/hardening §6.4
  - 산출물: BEGIN/END marker 구문, DHELIX.md section tree 파서 스펙, reorg LLM 프롬프트, deterministic fallback 알고리즘, I-9 invariance check 로직
  - Done when: 샘플 DHELIX.md로 reorg plan이 JSON으로 생성되는 예시

#### Week 2-3 — Verify 성분

- [ ] **P-1.16** 4-tier Validation framework + Volume governor (1d) ← P-1.17, P-1.23 선행
  - 참조: PRD §8.2~8.5, archive/hardening §10
  - 산출물: L1-L4 case generation 로직, volume governor 테이블 (cloud/local), grading cascade 스펙, rollback decision matrix, 10초 grace UX
  - Done when: "10 plasmid → 150 cases (cloud) / 50 (local)" 계산서

#### Week 3 — Local LLM 대응

- [ ] **P-1.20** Graceful degradation matrix (0.5d) ← P-1.18, P-1.19 선행
  - 참조: PRD Part III §35
  - 산출물: Stage × Capability tier 매트릭스 (cloud / local-large / local-small)
  - Done when: 각 cell에 구체 전략 기입 완료

- [ ] **P-1.21** Dual-model config 설계 (0.5d)
  - 참조: PRD Part III §36, archive/hardening §14
  - 산출물: `.dhelix/config.json` schema (models.runtime/recombination/validation), cloud cascade opt-in, privacy: local-only 시 cascade 금지 규칙
  - Done when: 3가지 예시 config (all-local, hybrid, all-cloud)

- [ ] **P-1.22** Phase 0 POC에 Ollama 참가자 필수화 (0.3d)
  - 참조: archive/deep-dives DD-5, PRD §13 Phase 0
  - 산출물: POC 프로토콜 수정본 — "5명 중 1명 이상 Ollama 사용자 필수, H4 hypothesis 추가"
  - Done when: §4 POC Protocol 업데이트 반영

#### Week 3 — UX/철학

- [ ] **P-1.5** `/plasmid` Quick-first 재작성 (1d)
  - 참조: PRD §6.2.1, archive/hardening P1
  - 산출물: 기본 Quick flow (3-step), Research mode opt-in, `--research` 플래그 명세
  - Done when: 사용자 플로우 예시 3개 (quick/edit/research)

- [ ] **P-1.10** Foundational + `/plasmid challenge` (1d)
  - 참조: PRD §22.4, archive/hardening Ph2
  - 산출물: `tier: foundational` + `challengeable-by: {...}` schema, `/plasmid challenge` 3-option (override/amend/revoke), `challenges.log` 포맷
  - Done when: 샘플 challenge flow 스크립트

- [ ] **P-1.7** Fail-to-draft recovery 확장 (1d)
  - 참조: PRD §7.3, §10.3 error catalog
  - 산출물: 각 error code에 recovery strategy 매핑 표 + UX 플로우
  - Done when: 7개 주요 에러에 대해 복구 제안 예시

#### Week 3-4 — Carryover (v1.0 Hardening 기존 12개)

짧은 것부터 병렬 처리:

- [ ] **P-1.1** I-1 two-file lock model 강화 (0.5d) — PRD §8.2, §10.1
- [ ] **P-1.2** §8.5 Concurrency section 추가 (0.5d) — PRD §8.6, archive/hardening §17
- [ ] **P-1.3** Static validation 3-tier 재작성 (0.5d) — PRD §8.1
- [ ] **P-1.4** Template 3-layer hierarchy 명시 (0.5d) — PRD §7.2, archive/hardening §4 (E4)
- [ ] **P-1.6** 3-mode share pattern 설계 (0.5d) — PRD §7.1, archive/hardening §8.3
- [ ] **P-1.8** I18n decision matrix (0.5d) — PRD §X (없으면 Appendix 추가), archive/hardening §16
- [ ] **P-1.9** "Intent-authored" 슬로건 재작성 (0.5d) — PRD §31.2 (이미 적용됨) — **검증만**
- [ ] **P-1.11** §21.2 biology table 3-column (0.5d) — PRD §21.2 (이미 적용됨) — **검증만**
- [ ] **P-1.12** Rhizome/Tier 사상 정합 (0.5d) — PRD §20.2, §27.2 (이미 적용됨) — **검증만**

### 3.4 Phase -1 Exit Gate

다음이 모두 충족되면 Phase 0 진입:

- [ ] 23 remaining action items 100% 완료
- [ ] I-8 enforcement 설계서가 구현 가능 수준으로 상세
- [ ] `selectStrategies(caps)` 매트릭스 완성
- [ ] Graceful degradation matrix 9개 row (Stage) × 3개 col (capability) 완전 기입
- [ ] `/plasmid challenge` 3-option flow 스크립트 확정
- [ ] Phase 0 POC 프로토콜 업데이트 완료 (Ollama 참가자 포함)
- [ ] Validation volume governor 수치 확정 (cloud / local / local-small)
- [ ] 설계 중 발견한 새 균열 → PRD v0.4 또는 Hardening v2.1로 기록 (if any)

**주의**: 설계 중 **새 Critical 발견 시 Phase 0 진입 보류**. 설계 추가 후 재평가.

---

## 4. Phase 0 — Market Validation (2주)

### 4.1 POC Protocol (Hardening DD-5 기반)

**Week 1 — 인터뷰 (1시간 × 5명)**

- [ ] 참가자 선정: 5명 중 **최소 1명 Ollama 사용자**
  - 구성: Heavy Claude Code 2, Team lead 1, Solo polyglot 1, Ollama local 1
- [ ] 인터뷰 플로우 실행:
  - Background (10분) — Q1-Q3
  - Current workflow 시연 (15분) — 관찰
  - Pain points (15분) — Q4-Q8
  - Concept exposure + POC 예시 (15분) — Q9-Q12
  - POC scheduling (5분) — Q13
- [ ] 각 인터뷰 노트 저장: `.dhelix/research/phase-0-results/interview-notes/<id>-session-1.md`

**Week 2 — POC 실험 (30분 × 3명)**

- [ ] 3명 중 1명 Ollama 환경
- [ ] Plasmid 작성 태스크 (minimal template 제공)
- [ ] 관찰 항목: name/description 시간, scope 선택, types 어려움, 자연어 섹션, 첫 시도 완성 여부
- [ ] Debrief Q1-Q4

### 4.2 Go/No-Go Gate

4가지 hypothesis 평가:

- [ ] **H1 Painpoint 존재**: 5명 중 3+명이 Q5-Q7에서 3+개 구체 painpoint 언급
- [ ] **H2 컨셉 매력**: Q10 ≥4점 & Q11 "yes/조건부" 5명 중 3+명
- [ ] **H3 작성 가능**: 3명 중 2+명이 20분 내 완성 + Zod schema 통과 + self-rating ≥3
- [ ] **H4 Local LLM 동작**: Ollama 참가자가 plasmid 완성 + 로컬에서 minimal recombination 10분 내

**Decision**:
- 4/4 → Phase 1 Go
- 3/4 → Pivot (2주 재실행 또는 scope 축소)
- ≤2/4 → Stop

---

## 5. Phase 1 Entry Gate (Phase 0 → Phase 1)

Phase 0가 Go면 Phase 1 착수 전 다음 확인:

### 5.1 Setup
- [ ] Feature flag `DHELIX_PLASMID_ENABLED` 추가
- [ ] `src/plasmids/`, `src/recombination/`, `src/recombination/validation/` 스캐폴딩 (빈 파일 + README)
- [ ] Phase 0 결과를 PRD v0.4 (optional) 또는 execution-plan.md v2로 반영

### 5.2 Phase 1 Week-by-Week (5주)

| 주 | Focus | 주요 산출물 |
|---|------|----------|
| W1 | Plasmid schema + loader | Zod schema, parser, loader (`src/plasmids/*`) |
| W2 | I-8 enforcement 구현 | `RUNTIME_BLOCKED_PATTERNS` in loader + guardrail in tools + telemetry |
| W3 | `/plasmid` command (list/show/validate/activate/deactivate/edit) | 5 서브커맨드 구현 |
| W4 | `/plasmid` Quick mode + Interview mode skeleton | 3-step quick flow 동작 |
| W5 | Template 10종 + ModelCapabilities 확장 + Entry Gate 검증 | Phase 2 진입 준비 |

### 5.3 Phase 1 Exit Gate (Phase 2 진입)

**Cloud Gate**:
- [ ] 10 plasmid recombination (단, Phase 1은 Validation 없이 Compile까지만) < 3분
- [ ] Static validation (stage 5) pass ≥90%

**Local Gate (Ollama llama3.1:8b)**:
- [ ] 동일 시나리오 < 10분
- [ ] Static validation pass ≥85%
- [ ] Network traffic 0 (cascade OFF 상태에서 tcpdump 확인)

**Hermeticity Gate**:
- [ ] I-8 3층 방어 동작 검증 (manual: agent에게 `cat .dhelix/plasmids/*.md` 시도 → 차단 확인)
- [ ] `plasmid.runtime_access_attempt` metric 발행 확인

**셋 다 통과 시에만 Phase 2 진입**.

---

## 6. 일상 루틴

### 6.1 매일 시작 (10분)

1. 이 문서 §3 현재 주차로 점프
2. 다음 unchecked item 1개 pick
3. 해당 item의 참조 PRD § 열기
4. 산출물 Done criteria 확인
5. 작업 시작

### 6.2 매 주 시작 (30분)

1. 이 문서 Week 체크리스트 리뷰
2. 지난 주 carryover 있으면 이번 주 상단에
3. 예상 완료 일정 재산정 (slack 수용)
4. Entry/Exit gate 진행률 확인

### 6.3 매 Phase 종료

1. Exit Gate 전 항목 체크
2. 이 문서 §3 (또는 §4, §5)에 실제 소요 시간 기록
3. 다음 Phase 섹션 업데이트 (배운 것 반영)
4. git commit: `docs(gal-1): phase-X complete`

---

## 7. Reference Map — 상황별 참조 문서

| 상황 | 1차 | 2차 | 3차 |
|-----|----|-----|-----|
| 현재 Phase/주차 확인 | 본 문서 §3-§5 | — | — |
| 전체 개념 복기 | PRD §0, §4 | PRD Part II | — |
| 불변식 확인 | PRD §10.1 (I-1~I-10) | PRD Appendix E | archive/hardening Part I |
| Plasmid 파일 포맷 | PRD §6.1 | PRD Appendix A | — |
| `/plasmid` 구현 | PRD §6.2 | archive/hardening §7 | — |
| `/recombination` 8-stage | PRD §6.3 | archive/hardening Part II | archive/deep-dives DD-1 |
| `/cure` 구현 | PRD §6.4 | archive/deep-dives DD-2 | — |
| Zod schema | PRD §6.1.2 | archive/deep-dives DD-3 | — |
| Interpreter | PRD §6.3.2 Stage 2a | archive/deep-dives DD-1 | archive/hardening §6.1 |
| Compression | PRD §6.3.2 Stage 2c | archive/hardening §6.3 | — |
| Constitution reorg | PRD §6.3.2 Stage 2d | archive/hardening §6.4 | — |
| Validation (L1-L4) | PRD §8.2-8.5 | archive/hardening §10 | `src/skills/creator/evals/` 코드 |
| I-8 enforcement | PRD §10.1 I-8 | archive/hardening Part I §1 | — |
| Local LLM 대응 | **PRD Part III (§33-38)** | archive/hardening Part III | — |
| 에러 처리 | PRD §10.3 | PRD §7.3 fail-to-draft | — |
| dhelix layer 규칙 | **CLAUDE.md** | `.claude/docs/reference/directory-structure.md` | `.claude/docs/reference/architecture-deep.md` |
| 기존 모듈 재사용 | PRD §7.3 | 해당 `src/` 코드 | — |
| Foundational / challenge | PRD §22.4 | archive/hardening Ph2 | — |
| Threat model | PRD §10.4 | — | — |
| Metrics | PRD Appendix F | archive/hardening §18 | — |

---

## 8. 첫날 구체 시작 (Phase -1 Day 1)

**AM (2-3시간)**:
1. PRD v0.3 §0 TL;DR (10분)
2. PRD v0.3 §4 Core Concepts (15분)
3. PRD v0.3 §6.3 8-stage 전체 통독 (30분) — **심장부**
4. PRD v0.3 §10.1 불변식 I-1~I-10 꼼꼼히 (20분)
5. PRD v0.3 Part III (§33-38) Local LLM (20분)
6. 본 문서 §3.2 Dependency graph 숙지 (10분)

**PM (P-1.14 착수)**:
1. PRD §10.1 I-8 원문 + archive/hardening Part I §1 (3층 방어 코드 스니펫) 정독 (30분)
2. `src/instructions/loader.ts` 현 구조 파악 (20분)
3. `src/tools/definitions/file-read.ts` 및 `src/tools/pipeline/preflight.ts` 등 경로 검증 지점 파악 (30분)
4. I-8 설계서 초안 작성 시작:
   - `RUNTIME_BLOCKED_PATTERNS` 확정
   - `loader.ts` 어디에 검사를 넣을지
   - `file-read.ts` / tool pipeline의 guardrail 반환 에러 포맷
   - Telemetry metric 이름/필드
   - Command handler 예외 처리 (§1.5)
5. Day 1 End: P-1.14 설계서 draft 50%

**Day 1 성공 기준**: I-8에 대해 "어느 파일의 어느 함수를 수정하는가"가 문서로 정리됨.

---

## 9. Anti-Patterns — 하지 말 것

| ❌ 안 됨 | ✅ 대신 |
|---------|------|
| Phase -1에서 `src/plasmids/*.ts` 코드 쓰기 | 설계 문서만. 코드는 Phase 1 W1부터 |
| Local Gate 무시하고 Cloud만 검증 | 두 gate 모두 통과해야 진입 |
| I-8 예외로 "이번만" 허용 | Guardrail은 한번 뚫리면 0번 뚫린 것과 동등하지 않음 — 무조건 차단 |
| PRD에 없는 기능 추가 | v0.4 개정을 PRD에 반영 후 진행 |
| 새 Critical 발견하고 덮어두기 | Phase -1 일정 늘리고 action item 추가 |
| Constitution reorg에서 user 영역 건드리기 | I-9 위반. Plan reject |
| Auto-rollback 기본값 off로 | I-10 위반. 사용자 opt-out은 per-run 플래그로만 |
| `privacy: local-only` plasmid를 cloud cascade로 | 절대 금지. Audit log로 적발 시 설계 결함 |

---

## 10. Living Document — 갱신 규칙

이 문서는 **각 Phase 완료 시마다 갱신**한다. 갱신 트리거:

| 트리거 | 갱신 내용 |
|-------|---------|
| Action item 완료 | 체크박스 on + (필요시) 주석 추가 |
| Phase 완료 | Exit gate 체크 + 실제 소요 기록 + 다음 Phase 섹션 업데이트 |
| 새 Critical 발견 | §3-§5에 새 action item 삽입 + dependency graph 갱신 |
| PRD 개정 | 참조 § 번호 업데이트 |
| Reference 변경 | §7 Reference Map 수정 |

**갱신 로그는 문서 끝에 append** (아래 §11).

---

## 11. Changelog

| 버전 | 날짜 | 변경 |
|-----|-----|-----|
| v1.0 | 2026-04-23 | 초안. P-1.24 완료 반영. Phase -1 23 remaining 주차별 그룹핑. Phase 0 POC protocol. Phase 1 Entry Gate (Cloud + Local + Hermeticity). Reference Map. 첫날 구체 시작. |

---

**이 문서의 성공 조건**: Phase -1 Day 1 아침에 본인이 이것만 열고 작업을 시작할 수 있다. 헷갈리면 본 문서의 결함이므로, 즉시 갱신한다.
