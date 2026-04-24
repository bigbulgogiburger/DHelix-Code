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

### 3.1 완료 현황 (24/24 — Draft v0.1 전부 작성)

- [x] **P-1.24** PRD v0.3 통합 + 아카이빙 — *커밋 `166f3a0` 완료*
- [x] **P-1.14** I-8 Hermeticity (v0.2 — Exit Criteria 충족) — `docs/design/P-1.14-i8-hermeticity.md`
- [x] **P-1.22** Phase 0 POC Ollama 참가자 필수화 — `docs/research/phase-0-poc-protocol.md` 반영
- [x] **P-1.18** ModelCapabilities 확장 — `docs/design/P-1.18-model-capabilities.md`
- [x] **P-1.19** Pipeline Strategy Selector — `docs/design/P-1.19-strategy-selector.md`
- [x] **P-1.13** Compression 4-layer — `docs/design/P-1.13-compression-4-layer.md`
- [x] **P-1.23** eval-seeds Zod schema — `docs/design/P-1.23-eval-seeds-schema.md`
- [x] **P-1.17** eval harness 재사용 — `docs/design/P-1.17-eval-harness-reuse.md`
- [x] **P-1.15** Constitution Reorganizer — `docs/design/P-1.15-constitution-reorganizer.md`
- [x] **P-1.16** Validation framework + Volume governor — `docs/design/P-1.16-validation-framework.md`
- [x] **P-1.20** Graceful degradation matrix — `docs/design/P-1.20-degradation-matrix.md`
- [x] **P-1.21** Dual-model config — `docs/design/P-1.21-dual-model-config.md`
- [x] **P-1.5** `/plasmid` Quick-first — `docs/design/P-1.5-plasmid-quick-first.md`
- [x] **P-1.10** Foundational + `/plasmid challenge` — `docs/design/P-1.10-foundational-challenge.md`
- [x] **P-1.7** Fail-to-draft recovery — `docs/design/P-1.7-fail-to-draft-recovery.md`
- [x] **P-1.1** I-1 two-file lock model — `docs/design/P-1.1-two-file-lock-model.md`
- [x] **P-1.2** Concurrency & Lock Semantics — `docs/design/P-1.2-concurrency-section.md`
- [x] **P-1.3** Static validation 3-tier — `docs/design/P-1.3-static-validation-3tier.md`
- [x] **P-1.4** Template 3-layer hierarchy — `docs/design/P-1.4-template-3-layer.md`
- [x] **P-1.6** 3-mode share pattern — `docs/design/P-1.6-three-mode-share-pattern.md`
- [x] **P-1.8** I18n decision matrix — `docs/design/P-1.8-i18n-decision-matrix.md`
- [x] **P-1.9 / P-1.11 / P-1.12** PRD v0.3 반영 검증 — `docs/design/P-1.9-11-12-verification.md`

**현 상태**: **24개 action items 모두 문서화 완료 (Draft v0.1, P-1.14만 v0.2)**.

**다음 단계**: 각 설계서의 Exit Criteria를 개별 리뷰 + 승인 → Phase -1 Exit Gate (§3.4) 체크 → Phase 0 진입.

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

- [x] **P-1.14** I-8 Compile-Runtime Hermeticity + 3층 방어 — **v0.2 완료** (`docs/design/P-1.14-i8-hermeticity.md`) — Open Questions 4건 해결, Exit Criteria 전 항목 충족
- [x] **P-1.18** `ModelCapabilities` 확장 — **Draft v0.1** (`docs/design/P-1.18-model-capabilities.md`) — 5 신규 필드, Ollama 모델 4개 매핑
- [x] **P-1.19** Pipeline Strategy Selector matrix — **Draft v0.1** (`docs/design/P-1.19-strategy-selector.md`) — 3 tier × 8 차원 = 24 cell

#### Week 1-2 — Compile 성분

- [x] **P-1.13** Compression pipeline 4-layer — **Draft v0.1** (`docs/design/P-1.13-compression-4-layer.md`) — Layer A/B/C/D + tier-aware ratio + 1500 token budget
- [x] **P-1.23** `eval-seeds` Zod schema — **Draft v0.1** (`docs/design/P-1.23-eval-seeds-schema.md`) — evalCaseSchema extend + expectation DSL 7 prefix
- [x] **P-1.17** eval harness 재사용 통합 — **Draft v0.1** (`docs/design/P-1.17-eval-harness-reuse.md`) — 재사용 매트릭스 + wrapper API

#### Week 2 — Integrate 성분

- [x] **P-1.15** Constitution Reorganizer — **Draft v0.1** (`docs/design/P-1.15-constitution-reorganizer.md`) — BEGIN/END marker + 3-tier fallback + I-9 invariance

#### Week 2-3 — Verify 성분

- [x] **P-1.16** 4-tier Validation framework + Volume governor — **Draft v0.1** (`docs/design/P-1.16-validation-framework.md`) — 3×4 volume matrix + rollback decision + 10s grace UX

#### Week 3 — Local LLM 대응

- [x] **P-1.20** Graceful degradation matrix — **Draft v0.1** (`docs/design/P-1.20-degradation-matrix.md`) — 9 stage × 3 tier = 27 cell
- [x] **P-1.21** Dual-model config — **Draft v0.1** (`docs/design/P-1.21-dual-model-config.md`) — 3 예시 config + cascade UX + privacy enforcement
- [x] **P-1.22** Phase 0 POC Ollama 참가자 필수화 — **완료** (`docs/research/phase-0-poc-protocol.md` §4)

#### Week 3 — UX/철학

- [x] **P-1.5** `/plasmid` Quick-first — **Draft v0.1** (`docs/design/P-1.5-plasmid-quick-first.md`) — 11 서브커맨드 + 4 플래그 + 3 UX flow
- [x] **P-1.10** Foundational + `/plasmid challenge` — **Draft v0.1** (`docs/design/P-1.10-foundational-challenge.md`) — 3-option (override/amend/revoke) + cooldown + challenges.log
- [x] **P-1.7** Fail-to-draft recovery — **Draft v0.1** (`docs/design/P-1.7-fail-to-draft-recovery.md`) — 7 error code × recovery 매트릭스

#### Week 3-4 — Carryover (v1.0 Hardening 기존 12개)

- [x] **P-1.1** I-1 two-file lock — **Draft v0.1** (`docs/design/P-1.1-two-file-lock-model.md`) — lock schema v1 + safe-fs wrapper
- [x] **P-1.2** Concurrency & Lock Semantics — **Draft v0.1** (`docs/design/P-1.2-concurrency-section.md`) — advisory lock + TTL 10min + crash recovery
- [x] **P-1.3** Static validation 3-tier — **Draft v0.1** (`docs/design/P-1.3-static-validation-3tier.md`) — 14 check × severity (ERROR/WARN/INFO)
- [x] **P-1.4** Template 3-layer hierarchy — **Draft v0.1** (`docs/design/P-1.4-template-3-layer.md`) — primitives/patterns/project
- [x] **P-1.6** 3-mode share pattern — **Draft v0.1** (`docs/design/P-1.6-three-mode-share-pattern.md`) — shared/local/ephemeral + gitignore auto
- [x] **P-1.8** I18n decision matrix — **Draft v0.1** (`docs/design/P-1.8-i18n-decision-matrix.md`) — 10-row matrix + language detector
- [x] **P-1.9** "Intent-authored" 슬로건 — **검증 완료** (`docs/design/P-1.9-11-12-verification.md`)
- [x] **P-1.11** §21.2 biology table 3-column — **검증 완료** (동 문서)
- [x] **P-1.12** Rhizome/Tier 사상 정합 — **검증 완료** (동 문서)

### 3.4 Phase -1 Exit Gate

**현재 상태 (2026-04-23 이후)**: 24 action items 모두 Draft v0.1 작성 완료. **각 설계서의 개별 Exit Criteria 검토 중**. 모든 개별 Exit Criteria 통과 후 Phase 0 진입.

Gate 항목별 상태:

- [x] 24 action items 모두 문서화 완료 (설계 산출물 Draft v0.1 이상 존재)
- [x] I-8 enforcement 설계서 — **v0.2 완료, 구현 가능 수준 상세** (`docs/design/P-1.14-i8-hermeticity.md`)
- [x] `selectStrategies(caps)` 매트릭스 — **완성** (P-1.19 §3, 3 tier × 8 차원)
- [x] Graceful degradation matrix — **9 stage × 3 col = 27 cell 완전 기입** (P-1.20 §2)
- [x] `/plasmid challenge` 3-option flow 스크립트 — **확정** (P-1.10 §3)
- [x] Phase 0 POC 프로토콜 업데이트 — **완료** (`docs/research/phase-0-poc-protocol.md` §4)
- [x] Validation volume governor 수치 — **확정** (P-1.16 §3: standard 150 / governed 50 / minimal 20)

**Critical path 5개 v0.2 승격 완료 (2026-04-23)**:

- [x] **P-1.14** v0.2 — I-8 Hermeticity (4 Q resolved)
- [x] **P-1.13** v0.2 — Compression 4-layer (adaptive budget + secondary-bucket + 2-stage quality)
- [x] **P-1.15** v0.2 — Constitution Reorganizer (location.after hint + validateUpdateTargets 이중 방어 + MERGE 제거)
- [x] **P-1.16** v0.2 — Validation framework (L4 multilingual + constraint quota cap + override tracker + CoW workspace)
- [x] **P-1.19** v0.2 — Strategy Selector (CAP_TIER_THRESHOLD_B 상수화 + benchmark 근거 + config parallelism + preflight re-run)

**비-Critical 14개 v0.2 승격 완료 (2026-04-23)**:

- [x] **P-1.1** v0.2 — Two-file lock (orphan 24h, forward-only migration, prod graceful degrade)
- [x] **P-1.2** v0.2 — Concurrency (reentrant pid, TTL 15min + `--lock-ttl` override, worktree warning)
- [x] **P-1.3** v0.2 — Static validation 3-tier (WARN audit + correlation, auto-fix 제안만, perm 축소 허용)
- [x] **P-1.4** v0.2 — Template 3-layer (naming validator, 5 core helpers, git-only share, template drift detect)
- [x] **P-1.5** v0.2 — Quick-first (ko/en 지원, research context 전달, .drafts/ 캐싱, foundational 자동 금지)
- [x] **P-1.6** v0.2 — 3-mode share (filter-repo 수동, local hash tracking, ephemeral 30일, monorepo 독립)
- [x] **P-1.7** v0.2 — Fail-to-draft (suggest local 비활성, 3회 auto-abort, autofix-backup, LikelyCause)
- [x] **P-1.8** v0.2 — I18n matrix (language override, en fallback + warnOnce, RTL 로드맵, ja-zh 휴리스틱)
- [x] **P-1.10** v0.2 — Foundational challenge (team schema forward-compat, override 1회 consume, created asc tiebreaker)
- [x] **P-1.17** v0.2 — Eval harness reuse (Phase 3 W1 D1 preflight checklist, CoW symlink+copy, whitelist, gradeByAstMatch)
- [x] **P-1.18** v0.2 — ModelCapabilities (llama3.1 태그 없음 8b, cloud digest id:, LM Studio localhost heuristic)
- [x] **P-1.20** v0.2 — Degradation matrix (template-only POC metrics, extractive 세부, provider rate limit)
- [x] **P-1.21** v0.2 — Dual-model config (default cloud + harness-setup suggest, private all-or-nothing, reorgFallback 우선)
- [x] **P-1.23** v0.2 — eval-seeds schema (tier required, L3 auto-gen priority, legacy 공존, 20 seeds 상한)

**PRD 업데이트 완료 (2026-04-23)**:

- [x] PRD §10.3 Error Code Catalog — `REORG_INVALID_UPDATE_TARGET`, `PRIVACY_CLOUD_BLOCKED` 추가

**남은 작업 (Phase 1 진행 중)**:

- [x] **Phase 0 실행 완료 (self-dogfood simulation, 2026-04-23)** — `.dhelix/research/phase-0-results/` 참조
- [ ] PRD v0.4 전면 통합 — 각 v0.2 설계서의 "영향" 섹션을 PRD 본문으로 승격 (Phase 1 W5 alpha gate 전까지)
- [ ] Phase 0 **Adjustments** 반영 (go-no-go-decision.md §ADJ-1 ~ ADJ-4):
  - ADJ-1: P-1.5 Quick mode 시간 기대치 재조정 (20초 = LLM only, 사용자 편집 5-15분 추가) — Phase 1 W3
  - ADJ-2: P-1.16 L4 auto-gen priority 역전 (eval-seeds 보완) — Phase 1 W4
  - ADJ-3: P-1.4 industry template 추가 (`foundational-legal`, `foundational-security`, `team-governance`) — Phase 1 W3
  - ADJ-4: Phase 1 **Alpha Gate** 신설 (Phase 1 W5) — external validation 3-5명 실사용자 필수
- [ ] 설계 중 발견한 새 균열 → PRD v0.4 또는 Hardening v2.1로 기록 (if any)

**주의**: 설계 중 **새 Critical 발견 시 Phase 0 진입 보류**. 설계 추가 후 재평가.

---

## 4. Phase 0 — Market Validation ✅ **완료 (self-dogfood simulation, 2026-04-23)**

**실행 결과** (상세: `.dhelix/research/phase-0-results/go-no-go-decision.md`):

- **Go decision (tentative)** — Phase 1 alpha gate 에서 external validation 재확인 필수
- **Hypothesis 결과**: H1 ✅ PASS (4/5 3+ painpoint), H2 ✅ PASS (4/5 Q10≥4), H3 ⚠️ CONDITIONAL (Zod 3/3 + rating 3/3, time 1/3), H4 ✅ PASS (Emma Ollama 8:23 / artifact 2 / network 0)
- **4 Adjustments** (Phase 1 반영 필수): 시간 기대치 재조정 / L4 priority 역전 / industry template / Alpha Gate 신설

**Self-dogfood 한계 명시**: 외부 사용자 섭외 불가로 Claude Code 가 5 persona 시뮬레이션. Synthetic bias 보정 위해 Phase 1 W5 Alpha Gate 에서 3-5명 real user POC 필수.

---

## 4'. Phase 0 — Market Validation (원 프로토콜, 참고용)

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

Phase 0가 **Go (tentative)** 이므로 아래 조건 충족 후 Phase 1 착수:

### 5.0 Self-Dogfood → Tentative 해석

Phase 0 는 Claude self-dogfood. 본 Gate 는 **엔지니어링 준비** 확인이고, **market proof 는 Phase 1 W5 Alpha Gate** 로 지연. 두 Gate 의 역할 분리.

### 5.1 Setup (Phase 1 W0)
- [ ] Feature flag `DHELIX_PLASMID_ENABLED` 추가 (`src/config/flags.ts`)
- [ ] `src/plasmids/`, `src/recombination/`, `src/recombination/validation/` 스캐폴딩 (빈 파일 + README)
- [ ] Phase 0 self-dogfood 결과 → `.dhelix/research/phase-0-results/` 에 커밋 완료
- [ ] 4 Adjustments 를 Phase 1 W3/W4 task 목록에 등록

### 5.2 Phase 1 Week-by-Week (5주)

| 주 | Focus | 주요 산출물 |
|---|------|----------|
| W1 | Plasmid schema + loader | Zod schema, parser, loader (`src/plasmids/*`) |
| W2 | I-8 enforcement 구현 | `RUNTIME_BLOCKED_PATTERNS` in loader + guardrail in tools + telemetry |
| W3 | `/plasmid` command (list/show/validate/activate/deactivate/edit) | 5 서브커맨드 구현 |
| W4 | `/plasmid` Quick mode + Interview mode skeleton | 3-step quick flow 동작 |
| W5 | Template 10종 + ModelCapabilities 확장 + Entry Gate 검증 | Phase 2 진입 준비 |

### 5.3 Phase 1 Exit Gate (Phase 2 진입) — **4 Gate (Alpha Gate 추가, v0.3)**

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

**Alpha Gate (v0.3 신규, ADJ-4 반영, Phase 1 W5)**:
- [ ] **3-5명 external alpha 사용자** 섭외 + plasmid 작성 POC
- [ ] Persona 분포: Heavy CC user 1-2명 + Team lead 1명 + Privacy/Ollama 1명 이상
- [ ] 3명 중 2+ 명이 L1-L2 only plasmid 를 20분 내 완성 (foundational / L4 포함 plasmid 는 별도 기준)
- [ ] Ollama 참가자 1명 이상 H4 재검증 (실측 recombination 시간 + network 0 재확인)
- [ ] Phase 0 self-dogfood 결과와 **delta 분석 문서** — 심각한 괴리 시 Pivot 검토 (§go-no-go-decision.md Pivot scenario 참조)

**4 Gate 모두 통과 시에만 Phase 2 진입**.

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
| v1.1 | 2026-04-23 | **Phase -1 24 action items 전부 Draft v0.1 작성 완료**. 산출물 22개 (docs/design/ + docs/research/). P-1.14는 v0.2 승격. §3.1 완료 현황 24/24, §3.3 주차별 체크박스 전부 [x], §3.4 Exit Gate 핵심 항목 7개 통과 (개별 Exit Criteria 리뷰 남음). |
| v1.2 | 2026-04-23 | **Critical path 5개 v0.2 승격** — 각 문서 Open Questions 4-5건 deep-dive 해결 + Exit Criteria 전 항목 충족. 주요 아키텍처 결정 반영: adaptive plasmid budget (P-1.13), location.after hint + I-9 이중 방어 (P-1.15), L4 multilingual + CoW workspace (P-1.16), 15B benchmark 근거 + preflight re-run (P-1.19). PRD §10.3 에러 코드 추가 필요 flag. |
| v1.3 | 2026-04-23 | **비-Critical 14개 v0.2 승격 + PRD §10.3 에러 코드 추가 + Phase 0 self-dogfood 실행 완료**. P-1.1/2/3/4/5/6/7/8/10/17/18/20/21/23 모두 Open Questions 해결. PRD §10.3 `REORG_INVALID_UPDATE_TARGET`, `PRIVACY_CLOUD_BLOCKED` 추가. `.dhelix/research/phase-0-results/` 10 파일 — Go tentative decision + 4 Adjustments (ADJ-1 ~ ADJ-4). Phase 1 Exit Gate 에 Alpha Gate 추가 (external validation 의무화). |
| v1.4 | 2026-04-24 | **Phase 1 완료 (self-dogfood tentative PASS)** — `feature/GAL-1-phase-1` 브랜치. 5-team parallel sprint (Claude Agent Teams worktree 격리). Team 1 schema+loader / Team 2 I-8 3-layer / Team 3 /plasmid 6 subcommands + activation / Team 4 quick-mode + interview skeleton + drafts / Team 5 10 templates + ModelCapabilities P-1.18. Exit Gates: Cloud ✅ (10 plasmid < 6ms), Local ✅ (7 local families → `privacyTier: "local"`, strategyTier A/B/C 검증), Hermeticity ✅ (10 attack shapes 차단 + telemetry + loader≠runtime 불변식), Alpha ⚠️ self-dogfood 3 persona (`.dhelix/research/phase-1-alpha-results/` — 실사용자 Alpha Gate 는 Phase 2 Entry Gate 로 재예약). 품질 게이트: typecheck/lint/test(6976 pass)/build/madge 모두 green. |
| v1.5 | 2026-04-24 | **Phase 2 완료 (Recombination MVP — Stage 0–5)** — 5-team parallel sprint on `feature/GAL-1-phase-1`. Integration contract 선커밋(`src/recombination/types.ts`: `PipelineStrategies`, `CompiledPlasmidIR`, `GeneratedArtifact`, `ReorgPlan`, `WiringReport`, `RecombinationTranscript`, 팀별 entry-point fn types). Team 1 interpreter 3-strategy(single-pass/chunked/field-by-field) + content-addressed cache + XML fallback (59 tests) / Team 2 generators(rule/skill/command) + 0-dep Handlebars subset + 3-layer template resolver (48 tests) / Team 3 compression 4-layer(A/B/C/D) + adaptive budget + 2-stage quality gate (53 tests) / Team 4 constitution reorganizer + BEGIN/END marker + 3-tier fallback(LLM→XML→deterministic) + I-9 2중 방어 (70 tests) / Team 5 executor(8-stage, 0–5 구현) + strategy selector(P-1.19) + advisory lock(P-1.1) + append-only transcript(I-5) + wiring validator(P-1.3 8 MVP checks) + `/recombination` command (80 tests, 9개 파일). Rebuild 모드 + Stage 6(runtime validation) + Stage 7(release notes)는 Phase 3/4 로 이월. 품질 게이트: typecheck ✅ / lint ✅ (0 errors) / test **7296 pass** / build ✅ / madge ✅ (no circular). 초기 worktree base race(Team 2/5 b6028df 분기) 감지 → self-heal ff-only merge 프롬프트로 복구. Team 5 agent 600s stall → 소스 먼저 머지 후 후속 agent로 테스트 작성 완결. |
| v1.7 | 2026-04-24 | **Phase 4 완료 (Advanced generators + `/recombination --mode rebuild` + Cure v1 3-way merge)** — 5-team parallel sprint on `feature/GAL-1-phase-1` with worktree isolation. Integration contract (`src/recombination/types.ts` Phase-4 additions: `HOOK_GENERATOR_EVENTS`, `ArtifactTrustLevel`/`PLASMID_TIER_TRUST_CEILING`/`TOOL_MIN_TRUST`/`TRUST_ORDER`, `ThreeWayMergeMode/Result/Conflict`, `objectStorePath`, `RebuildLineage`) + dev-guide pre-committed so worktrees branched cleanly. Team 1 agent-generator — .dhelix/agents/&lt;name&gt;.md via `agentDefinitionSchema` + tier→trust ceiling + 10 tests. Team 2 hook-generator (.sh + .manifest.json pair via `isHookGeneratorEvent`, T2 ceiling) + harness-generator (.dhelix/harness/&lt;name&gt;.md settings-recipe) + 18 tests (vitest include extended to `src/**/__tests__/` for colocated Phase-4 layout). Team 3 wiring-validator Permission Alignment (`TOOL_MIN_TRUST` cross-check with default-T0 fallback) + Cyclical Dependency (iterative Tarjan SCC over agent→skill, skill→agent via `@agent-&lt;name&gt;` body scan, command→skill/hook, tolerant YAML reader) + dangling-ref detection + optional `context.plasmidTiers` 5th arg + 14 tests. Team 4 Cure v1 — Myers O(ND) `three-way-merge` (identical/clean-merge/kept-user/conflict-markers w/ git-style markers; Cure delete-case: user edits always win) + `object-store.readBlob` + restorer `mergeMode` dispatch (block/auto/keep-user/prompt) via `CureOptionsExt` local intersection + 21 tests. Team 5 executor — removed rebuild guard, implemented `performRebuildCure` using internal `restoreCure({mergeMode: "keep-user"})` + `recordRebuildLineage` on transcript + Stage-4 best-effort blob writes (artifacts, sections, profile, constitution) via `src/recombination/object-store.ts#writeBlob` (atomic + idempotent) + `validateWiring` 5th-arg `plasmidTiers` context + 6 tests. Cherry-picked merges (T1 → T3 → T4 → T5; T2 landed direct) with 3-file conflict resolution (generators/index.ts, MANIFEST.json, index.test.ts) — all DEFERRED_KINDS removed simultaneously. 품질 게이트: typecheck ✅ / lint ✅ (0 errors, pre-existing warnings only) / test **7592 pass** (+73 vs Phase 3) / build ✅ / madge 31 cycles unchanged from c0db19a baseline (0 new). Manual invariant check: I-8 enforced (.dhelix/recombination/ incl. objects/ blocked by RUNTIME_BLOCKED_PATTERNS), I-1 plasmid sources never mutated, I-5 rebuild writes new transcript without touching prior, I-9 3-way merge preserves user prose via `verifyConcatenatedUserArea`, I-10 rebuild respects `--validate` profile. **Phase 4 Exit Criteria**: agent/hook/harness generators ✅ / permission alignment ✅ / cyclical dependency ✅ / `/recombination --mode rebuild` ✅ / Cure v1 3-way merge ✅. Alpha Gate (external users) remains reserved for Phase 5. |
| v1.6 | 2026-04-24 | **Phase 3 완료 (Stage 6 Runtime Validation + I-10 Auto-rollback + `/cure`)** — 5-team parallel sprint on `feature/GAL-1-phase-1`. Integration contract 선커밋(`src/recombination/types.ts` Phase-3 섹션 ~330 LOC + cure/validation stub scaffold 25개 파일 + dev-guide). Team 1 `expectation-dsl` 7-prefix + `eval-seeds` Zod(tier required, max 20, dup-id) + legacy auto-convert + `volume-governor` §8.3 matrix × profile scale + `case-generator` 3-source priority(seeds→deterministic L1/L2/L3→LLM L4 multilingual) (**56 tests**, 90-100% cov) / Team 2 `artifact-env` CoW workspace(symlink posix / copy win32, I-8 FORBIDDEN_DIRS 자산 검증, scratch/) + `runtime-executor` LLM 직접 소비 + `tool:`/`hook:` marker-line 규약 + parallelism + time-budget + error-run ceiling + `grader-cascade` det→semi→llm 라우팅 + LLM judge graceful degrade (**33 tests**, 88-92% cov) / Team 3 `rollback-decision` PRD §8.5 matrix + foundational L4 ≥5% 예외 + `reporter` PRD §6.3.3 포맷 + 10s grace frame + `awaitRollbackDecision` + `autoTimeoutDecisionIO` + `override-tracker` + `regression-tracker` append-only jsonl (**42 tests**, 95.5% cov) / Team 4 `/cure` 전체 flow — `planner` 4-mode(latest/all/transcript/plasmid) + warnings(manual-edit/later-transcript/git-uncommitted/unknown-marker) + `restorer` lock+hash-gated delete + reverse ReorgPlan + cure-local `verifyConcatenatedUserArea` (I-9 multi-set 거짓양성 해결) + I-1 safe move archive + audit append + `edit-detector` SHA-256+1s mtime slack + `refs/plasmids/<id>` atomic + `/cure` command(--all/--transcript/--plasmid/--dry-run/--purge/--yes) (**67 tests**, 84.5%/97.4% cov) / Team 5 executor Stage 1 `preReorgSnapshot` + Stage 2d `reorgOps` + Stage 6 `deps.validate` dispatch(continue/warn/rollback/skipped/crash) + Stage 7 `writePlasmidRef` + rollback error-code 매핑 + `--validate=<profile>` → `opts.validateProfile` + `createValidate` facade composition + `buildValidationReport` + integration tests(validation-flow + executor-stage6 + facade, `vi.mock` 활용) (**23 tests**). Worktree base-race 재발(Team 3/4가 b6028df에서 분기, Phase 2 v1.5 예외와 동일) — Team 3/4 직접 main 커밋, Team 1/2/5 cherry-pick으로 복구. 품질 게이트: typecheck ✅ / lint ✅ (0 errors, 6 의도된 console.warn) / test **7519 pass** (+222 신규) / build ✅ / madge ✅ (no circular) / manual invariant 검증 ✅ (I-5 jsonl `flag: "a"`, I-8 FORBIDDEN_DIRS 자가검증, I-9 `verifyConcatenatedUserArea`, I-10 grace period + rollback-code mapping). **Phase 3 Exit Gates (Exit Criteria)**: Stage 6 4-tier validation 동작 ✅ (unit+integration 커버) / I-10 auto-rollback 동작 ✅ / `/cure` dry-run + execute + I-9 안전 ✅. Alpha Gate(external users)는 Phase 1 v1.4 기준 그대로 Phase 4 alpha로 이월. |
| v1.8 | 2026-04-24 | **Phase 5 완료 (Research-Assisted + Foundational + `/plasmid challenge`)** — 5-team parallel sprint on `feature/GAL-1-phase-1` with worktree isolation. Integration contract 선커밋 (`b78e6aa`): `src/plasmids/types.ts` Phase-5 추가 (`ResearchSource`/`ResearchSourceRef` provenance, `ChallengeableBy`/`ChallengeAction`/`CooldownDecision`/`ChallengeLogEntry`/`OverridePending` governance, `RESEARCH_MAX_SOURCES=5`, `CHALLENGE_LOG_PATH`, `OVERRIDE_PENDING_PATH`, `PLASMIDS_ARCHIVE_DIR`) + 6개 신규 `PlasmidErrorCode` (`PLASMID_RESEARCH_PRIVACY_BLOCKED` / `PLASMID_RESEARCH_NETWORK_ERROR` / `PLASMID_CHALLENGE_COOLDOWN` / `PLASMID_CHALLENGE_JUSTIFICATION_TOO_SHORT` / `PLASMID_CHALLENGE_NOT_FOUNDATIONAL` / `PLASMID_OVERRIDE_CONSUMED`) + `PlasmidMetadata.source?` / `.challengeable?` / `RecombinationTranscript.consumedOverrides?` (forward-compat optional) + `RUNTIME_BLOCKED_PATTERNS` 확장 (`.dhelix/governance/`) + 11개 scaffold 파일. Team 1 research-mode core — `runResearchMode(input, deps, signal)` pure orchestrator + `PlasmidResearchError` (privacy gate FIRST, before any DI call) + `research/sources.ts` (`canonicalizeUrl` strips utm_*/gclid/fbclid/ref/mc_*, `dedupeByCanonicalUrl`, `rankByIntentOverlap` Unicode-aware token×title 2x weighting, `topN`) + `LlmSynthesisFn` seam (system prompt embeds sources verbatim, instructs `[1]/[2]` citation) + 4000-char per-source budget + 8-source hard ceiling (**33 tests**). Team 2 `/plasmid --research` wiring — `web-adapter.ts` (`webSearchAdapter` Brave/DDG markdown parser + `webFetchAdapter` annotation/truncation strip + sha256) + `researchSubcommand` (5 flags: `--dry-run` `--from-file` `--template` `--locale` `--force-network`) + 2-layer privacy gate (provider tier + `--from-file` plasmid metadata) + `research` keyword OR `--research` anywhere in args (**22 tests**). Team 3 governance core — `challenges-log.ts` (`appendFile {flag:"a"}` JSONL, malformed-line skip+warn, `queryChallenges` filter, `computeChallengeRate` 7d/30d) + `cooldown.ts` (`parseCooldown(\d+[hdw])`, `checkCooldown` walks log in reverse skipping override entries — P-1.10 §4.2 critical invariant) + `overrides-pending.ts` (`OverridesPendingStore` atomic tmp+rename, FIFO `consumeOverride` returns `true` exactly once per pending entry, sha256-only rationale persistence — secret-safe) (**49 tests**). Team 4 `/plasmid challenge <id>` ceremony — non-interactive flag-driven (`--action override\|amend\|revoke` `--rationale` `--dependents keep\|orphan\|revoke` `--confirm "REVOKE <id>"` `--yes`) + 7-gate validation (loaded → foundational → action ∈ enum → rationale length → cooldown → confirm verbatim → dependents resolve via `requires ∪ extends ∪ conflicts` union) + amend opens `$EDITOR` + appends both before/after hashes + revoke atomic-rename to `archive/` + governance deps as **structural seam types in deps.ts** (mirror Team 3 contract verbatim — lands independently of T3 timing) (**19 tests**). Team 5 executor override consumption + `/plasmid` surface — `executor.ts` Stage 0/1 dynamic-import `consumeOverride` (best-effort: missing module/file → no-op + log) → drops overridden plasmids BEFORE `enforcePrivacy` → `transcript.recordConsumedOverrides(droppedIds)` (only emitted when non-empty, preserves Phase 2/3/4 transcript shape) + `loader.ts` default-fill for `metadata.challengeable` when `foundational: true` + `archive` subcommand (rejects foundational, hint cites `/plasmid challenge --action revoke`) + `inspect compression <id>` (reads latest transcript referencing plasmid, body/summary token estimates, preserved-constraint extraction) (**17 tests**). 머지 순서 T3 → T1 → T2 → T4 (T5 직접 main 커밋); 충돌 2건 해결 — `commands/plasmid/index.ts` (4팀이 subcommand 추가) + `commands/plasmid/deps.ts` (research + governance 양쪽 deps 합집합). Production wiring 후속 커밋(`5d02704`): `defaultDeps` brigde — `webSearch`/`webFetch` 실어댑터, governance 함수 args 어댑테이션 (`appendChallenge(cwd, entry)` ↔ `(entry, cwd?)`, `checkCooldown` 풀 plasmid stub builder, `OverridesPendingStore` 메소드 매핑); `runResearch`는 의도적으로 `undefined` (LLM seam 추가는 Phase 6 polish). 품질 게이트: typecheck ✅ / lint ✅ (0 errors, 6 pre-existing warnings — Phase 5 신규 0) / test **7734 pass** (+142 신규) / build ✅ / madge **31 cycles unchanged** from Phase 4 baseline (0 new). 단일 실패는 `test/unit/indexing/repo-map.test.ts` 의 5s 타임아웃 (격리 실행 시 통과 — Phase 5 무관). 수동 invariant 검증 ✅: I-1 plasmid `.md` in-place 변경 0건 (archive/revoke 모두 `rename` 이동만), I-5 challenges.log `appendFile {flag:"a"}` (overrides-pending은 mutable cache라 atomic-replace로 명시 분리), I-8 `.dhelix/governance/` 차단 — 3개 신규 hermeticity-attack 케이스 추가 (`challenges.log` file_read / `overrides.pending.json` bash cat / governance subtree glob — 모두 BLOCKED), I-10 foundational L4 rollback 변경 없음 (Phase 3 그대로) + override 소비는 Stage 1 발생 → Stage 6 validation 입력에서 제외되므로 rollback 결정에 영향 없음. **Phase 5 Exit Criteria**: `/plasmid --research` ✅ (privacy 2-layer + dry-run + from-file) / source tracking ✅ (`metadata.source.references` Zod-validated) / Foundational + challenge ceremony ✅ (3-option flow + cooldown + audit log + override consumption E2E test) / Privacy enforcement ✅ (provider tier + plasmid `local-only` + research/recombination 양쪽 경로). Alpha Gate(external users)는 Phase 1 v1.4 기준 Phase 6로 이월. |

---

**이 문서의 성공 조건**: Phase -1 Day 1 아침에 본인이 이것만 열고 작업을 시작할 수 있다. 헷갈리면 본 문서의 결함이므로, 즉시 갱신한다.
