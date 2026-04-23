---
participant_id: P04
persona: polyglot-solo
role: "Indie Developer (Python/Rust/TypeScript, 3 projects)"
simulated: true
interviewer: Claude Code (self-dogfood)
session_date: 2026-04-23
duration_min: 55
recorded: synthetic
---

# Session 1 — P04 Dana Lee (Polyglot Solo)

## Background (Q1-Q3)

### Q1. Customization 빈도

**응답**: b. 매주 (3 프로젝트 합산)
**Quote**: "각 프로젝트마다 언어 특성이 달라서 CLAUDE.md 도 다르게 써요."

### Q2. 최근 customization

**프로젝트 3개**:
1. `rust-cli` — "Cargo clippy 규칙 + unsafe 블록 주석 강제"
2. `py-scraper` — "Pydantic schema validation 규칙"
3. `ts-react-app` — "Tailwind 클래스 정렬 규칙"

**최근**: `py-scraper` 의 asyncio 관련 rule. 2일 전.

### Q3. 소요 시간

**평균**: 30-40분 per project. **하지만 세 프로젝트에 동일한 개념 (예: "error handling style") 적용 시 3x 중복 작업**.

---

## Workflow 시연 관찰

**Task**: "SQL parameterized rule 추가"

| 시각 | 행동 |
|-----|-----|
| 00:00 | "어느 프로젝트?" 고민 |
| 00:15 | `py-scraper/CLAUDE.md` 선택 (SQL 주로 여기) |
| 00:30 | Rule 추가 (빠름) |
| 02:00 | "근데 `rust-cli` 에도 sqlx 쓰는데 거기도 같은 rule 넣어야 하나..." |
| 02:30 | "나중에 하자 (실제로 까먹을 가능성 높음)" |

**관찰**: **DRY 위반 경험이 실시간 재현됨**. 프로젝트 간 sync 부재.

---

## Pain Points (Q4-Q8)

### Q4. 불편

**Quote**: "같은 rule 을 3 프로젝트에 복붙하는 거. 버전 drift 발생해요."
**Painpoint #1**: 프로젝트 간 rule DRY 위반

### Q5. 반영 확인

**응답**: "프로젝트마다 다르게 반응해서 혼란. `py-scraper` 는 rule 잘 먹는데 `rust-cli` 는 뭔가 안 먹어요. 왜 그런지 모르겠음."
**Painpoint #2**: 프로젝트별 rule 동작 불일관

### Q6. 되돌리기

**응답**: "있어요. `rust-cli` 에 Rust 전용 rule 넣었는데 `py-scraper` 에 copy 할 때 그 rule 까지 같이 옮겨서 Python 에 엉뚱하게 적용됨."
**Probe — 어떻게 감지?**: "Claude 가 Python 코드에 Rust 스타일 설명 달아서 '어?' 하고 역추적."
**Painpoint #3**: Cross-project leak (심각한 painpoint)

### Q7. 팀 공유

**응답**: "솔로. 패스."

### Q8. 실패 관리

**응답**: "`.claude-old/` 폴더에 백업. 유지 비용 많이 듦."

---

**Painpoint 카운트**: **3개 확인** (DRY, inconsistency, cross-leak) — H1 ✓

---

## Concept Exposure (Q9-Q12)

### Q9. 이해도: 4

**Quote**: "선언적이라서 좋은데, 3 프로젝트 공유는 어떻게 하나요?"

### Q10. 개선 여부: 4

**이유**: "`privacy: local-only` 같은 optional extension 이 흥미. 단 프로젝트 간 shared plasmid 메커니즘 있어야 진짜 쓸만."

### Q11. 당장 쓰기

**응답**: "조건부"
**조건**: "Multi-project shared plasmid 지원되면. 지금처럼 프로젝트당 독립이면 DRY 문제 해결 안 됨."

### Q12. 우려

- "프로젝트 간 plasmid 공유 어떻게? 전역 `~/.dhelix/plasmids/` 만으로 충분?"
- "언어별 artifact 차이 (Rust hook vs Python hook) 어떻게 관리?"

---

## POC Scheduling (Q13)

- **참여**: **No** (일정)
- **Alpha**: 참여 의향 yes (특히 multi-project 기능 알파)

---

## Interpretations

- H1 **강한 신호**: Cross-project leak 은 plasmid system 이 해결 가능한 범위 외부 (전역 plasmid 는 있지만 per-project override 없이는 "my-rust-rule 을 py-proj 에" 같은 leak 여전)
- H2 **중간-강한 신호**: Q10=4, Q11=conditional on multi-project
- **중요 feature request**: Phase 5-6 에 multi-project plasmid 공유 메커니즘 (GAL-2+) 구체화 필요
- POC 불참 — Dana persona 는 Phase 2+ multi-project 개발에 alpha 참여 가능

---

## Follow-up

- [x] POC 제외
- [ ] Phase 2 multi-project alpha 초대
- **Product insight**: "shared-plasmid library" (GAL-2 Marketplace 초기) Phase 5-6 우선순위 상향 검토
