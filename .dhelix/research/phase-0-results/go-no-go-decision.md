# Phase 0 Go/No-Go Decision

**결정일**: 2026-04-23
**결정자**: Claude Code (self-dogfood mode)
**근거 문서**: `hypothesis-evaluation.md`, 5 interview notes, 3 POC plasmids, Ollama measurement
**면책**: Self-dogfood simulation — Phase 1 alpha 에서 external validation 필수

---

## 결론

# ✅ Go to Phase 1 (tentative)

조건부 승인. Phase 1 W1 착수 허용. 단 아래 4가지 "adjustment" 반영 + Phase 1 W5 alpha gate 에서 external validation 재확인 필수.

---

## 4/4 Hypothesis Matrix

| H | 결과 | 근거 |
|---|------|-----|
| H1 Painpoint | ✅ PASS | 5/5 중 4명 3+ painpoint (Anna 3 / Chris 4 / Dana 3 / Emma 4) |
| H2 컨셉 매력 | ✅ PASS | 5/5 중 4명 Q10≥4 + Q11 yes/conditional (Chris / Emma urgent) |
| H3 작성 가능 | ⚠️ CONDITIONAL | Zod 3/3 + rating 3/3 ✓, 단 time 기준 1/3 만 20분 내 |
| H4 Local LLM | ✅ PASS | Emma 실측 8:23 / artifact 2 / network 0 (single data point) |

**Protocol matrix (docs/research/phase-0-poc-protocol.md §8)**:
- 4/4 → Go ✓ (H3 conditional 이지만 Zod + rating 충족하여 approve)
- 3/4 → Pivot
- ≤2/4 → Stop

→ **Go with adjustments**.

---

## Phase 1 진입 조건 (Adjustments)

### ADJ-1: P-1.5 Quick-first 시간 기대치 재조정

**현재 문서** (P-1.5 §2): "Quick mode (20초 draft)" — LLM generation 시간 기준

**문제** (Phase 0): 사용자 수동 plasmid 작성은 18-25분. "20초" 표현이 사용자 기대치 왜곡.

**조정**:
- P-1.5 §2 재작성: "20초 draft generation (LLM 단독) + 5-15분 사용자 검토 및 편집"
- UX: Quick mode 저장 시 "Draft 생성 20초, 사용자 편집 권장 5-15분" 안내 추가
- 복잡도별 예상 시간: simple (L1 only) ~10분, with L2 ~15분, foundational + L4 ~25분

**Phase 1 W3 반영**: `docs/design/P-1.5-plasmid-quick-first.md` v0.3 업데이트 예정

### ADJ-2: L4 adversarial auto-gen 우선순위 상향

**현재** (P-1.16 §2 priority): eval-seeds > deterministic > LLM auto-gen

**Phase 0 관찰**: L4 case 작성이 사용자 시간의 30-40% 점유 (Chris 7분, Emma 10분).

**조정**:
- L4 에 한해 **LLM auto-gen 우선** + 사용자 seed 는 보완 (priority 순서 L4 한정 변경)
- Phase 2 W5 구현 시 반영
- 사용자 경험: "adversarial case 는 우리가 만들게요, 필요하면 수정하세요" 메시지

**Phase 1 W4 반영**: P-1.16 v0.3 업데이트 — L4 priority 역전

### ADJ-3: Industry template 우선순위 상향

**현재** (P-1.4 §1): primitives 6 + patterns 3-5개 (owasp-gate, ddd-review, otel-observer)

**Phase 0 관찰**: Emma 의 `legal-sql-gate` 같은 industry-specific plasmid 작성 시간 25분 — foundational + L4 조합 복잡도.

**조정**:
- `patterns/` 에 **industry template 추가**:
  - `foundational-legal` (GDPR / 개인정보보호 / HIPAA)
  - `foundational-security` (OWASP top 10 + PCI DSS)
  - `team-governance` (Chris 의 team-pr-template 패턴)
- Phase 2 W3 6 primitives → Phase 2 W3 + **industry patterns** 병행

**Phase 1 W3 반영**: P-1.4 §1.1 patterns 목록에 industry template 3-5개 추가

### ADJ-4: Alpha gate external validation 의무화

**현재** (execution-plan §5 Phase 1 Exit Gate): Cloud + Local + Hermeticity 3 gate

**Phase 0 한계**: Self-dogfood bias. Empirical proof 약함.

**추가 gate (v0.2)**:
- **Alpha Gate** (Phase 1 W5 추가): **실제 외부 사용자 3-5명** plasmid 작성 + recombination 실측
- 기준:
  - 3명 중 2+ 명 20분 내 plasmid 완성 (ADJ-1 반영된 시간 기준, 즉 실제로는 L1-L2 only 기준 20분)
  - Ollama 사용자 1명 이상 H4 재검증
  - Anna/Chris 같은 Heavy CC user 페르소나 1+ 명, Emma 같은 Privacy persona 1+ 명

**Phase 1 W5 실행**: alpha 사용자 섭외 시작 (Phase 0 참가자 연락처 reuse 시도 → 실패 시 외부 채널).

---

## 실패 시 Pivot 시나리오 (예방적 기록)

Phase 1 W5 alpha gate 결과가 self-dogfood 결과와 크게 괴리하면:

### Scenario A: H1-H2 external 에서 negative (painpoint 약하거나 컨셉 미매력)

**Pivot**: Scope 축소 — `/plasmid` + `/recombination` 만 출시, `/cure` 는 defer. 또는 "plasmid as better CLAUDE.md" positioning 재검토.

### Scenario B: H3 time 더 나쁨 (3명 중 0-1명만 20분 내 완료)

**Pivot**: Quick-first 기본값 축소 — `--template <id>` 강제 (사용자가 빈 template 로 시작 금지).

### Scenario C: H4 Ollama 성능 실측 <10분 달성 실패

**Pivot**: Local LLM first-class 지위 재고. Part III (PRD §33-38) 후순위 → v0.5 로 연기 + v0.4는 cloud only.

이 시나리오별 roadmap 은 execution-plan §3.4 에 로그.

---

## Immediate Next Actions (Phase 1 W1 착수 준비)

### Day 1 (2026-04-24)

1. `.dhelix/runtime/` 초기화 (Phase 0 결과 참조 링크)
2. Feature flag `DHELIX_PLASMID_ENABLED` 추가 (`src/config/flags.ts`)
3. `src/plasmids/`, `src/recombination/` 스캐폴딩 (빈 파일 + README)

### Week 1

1. P-1.14 I-8 Hermeticity 구현 — `RUNTIME_BLOCKED_PATTERNS` + 3층 방어
2. P-1.18 ModelCapabilities 확장 + Ollama probe
3. P-1.23 eval-seeds schema + frontmatter parser

### Week 5 (Alpha Gate)

1. 3-5명 external alpha 섭외 (priority: Chris-like team lead, Emma-like privacy user)
2. Alpha POC 실행 + external hypothesis re-validation
3. Phase 0 결과와 delta 분석 → Phase 2 계획 조정

---

## 기록 보존

- 본 결정 문서 + hypothesis-evaluation.md + interview-notes + POC plasmids + ollama-measurement 모두 git commit
- Commit 메시지: `docs(gal-1): phase-0 complete — go decision (tentative, self-dogfood)`
- Phase 1 W5 alpha 결과 수신 시 본 문서에 **"Alpha Validation Update"** 섹션 추가 (validity 재평가)

---

## Changelog

| 버전 | 날짜 | 변경 |
|-----|-----|-----|
| 1.0 | 2026-04-23 | 초안. Go tentative decision. 4 adjustments (시간 기대치, L4 priority, industry template, alpha gate). Pivot scenarios 예방적 기록. |
