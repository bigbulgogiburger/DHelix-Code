---
participant_id: P01
persona: heavy-claude-code
role: "Senior Fullstack Developer (Python/TypeScript, 8yr)"
simulated: true
interviewer: Claude Code (self-dogfood)
session_date: 2026-04-23
duration_min: 62
recorded: synthetic
---

# Session 1 — P01 Anna Choi (Heavy Claude Code)

## Background (Q1-Q3)

### Q1. Customization 빈도

**응답**: b. 매주
**Quote**: "CLAUDE.md는 거의 매주 수정해요. 새 규칙 추가하거나 기존 거 튜닝."

**Context**: Skill 4개 작성 경험 (PR 요약, code review style, test writer, migration helper). Hook 2개 (pre-commit secret scan, PostToolUse logger).

### Q2. 최근 customization

**파일**: `~/project/my-saas/CLAUDE.md` (320줄)
**내용**: "git commit messages 는 conventional commits + 한글 본문" rule 추가
**Probe — 참고 예시**: "reddit r/ClaudeCode 글 + 제 기존 rule 2개"
**Probe — 재수정**: 3회
- 1차: 너무 엄격해서 WIP 커밋도 막힘
- 2차: 한글 본문 지침이 영어 커밋 messages 와 충돌
- 3차: context-aware 조건 추가 (feature 브랜치만)

### Q3. 소요 시간

**응답**: 첫 draft 20분 + 재시도 3회 × 10분 = **총 50분**
**Self-quote**: "왜 이렇게 오래 걸리는지 모르겠는데 항상 오래 걸려요."

---

## Workflow 시연 관찰 (15분)

**Task**: "`모든 SQL은 parameterized 쿼리로만` 규칙 추가"

| 시각 | 행동 |
|-----|-----|
| 00:00 | CLAUDE.md 열음 (vscode) |
| 00:18 | 어디에 쓸지 망설임. `## Rules` 섹션 vs `## Constraints` |
| 01:05 | 구글 검색: "CLAUDE.md sql rule example" |
| 01:45 | Anthropic cookbook 링크 클릭, 예시 확인 |
| 02:40 | 결국 `## Constraints` 선택, 새 bullet 추가 |
| 04:15 | 저장 후 Claude 재시작 |
| 04:40 | 테스트 없이 다음 작업으로 이동 |
| 05:00 | "테스트는 나중에 SQL 작성할 일 있을 때 확인하려고요" |

**관찰 메모**:
- Painpoint 신호: scope 결정 망설임 + 테스트 스킵
- 참고 자료 탐색에 2-3분 소비 (매번 반복)

---

## Pain Points (Q4-Q8)

### Q4. 가장 불편

**응답**: "어디에 쓸지가 제일 답답해요. Rule? Skill? Hook? 각각 언제 쓰는지 경계가 모호해서."
**Quote**: "`## Rules` 에 썼는데 어느 scope 에 적용되는지 몰라서 다시 읽어봐야 해요."
**Painpoint #1**: Scope/artifact 결정 cognitive load

### Q5. 반영 확인

**응답**: "안 해요. 그냥 나중에 Claude 응답 보면서 '어 적용됐네' 확인하는 식."
**Probe**: "체크리스트는?"
**응답**: "없어요. 만들어야 하는데 귀찮."
**Painpoint #2**: Intent → 실제 행동 검증 부재

### Q6. 되돌리기 경험

**응답**: "있어요. 2주 전에 '모든 PR에 e2e 테스트 요구' 규칙 넣었다가 팀 feedback 와서 제거."
**Probe — 어떻게?**: "git revert. 한 줄만 돌려야 했는데 해당 commit 전체 revert."
**Probe — 깨끗?**: "찝찝했어요. `e2e` 라는 단어가 다른 rule 에 참조되는지 확인 못했거든요."
**Painpoint #3**: Rollback 완전성 의심 + orphan reference 우려

### Q7. 팀 공유

**응답**: "솔로에요. 패스."

### Q8. 실패한 customization 관리

**응답**: "`CLAUDE.md.archive` 파일에 copy-paste 해놓고 언젠가 다시 쓸까 해요."
**Probe — 실제로?**: "음... 아직 한 번도 안 꺼냈어요."

---

**Painpoint 카운트**: **3개 확인** (scope 결정, 반영 검증, rollback 완전성) — H1 ✓ 신호

---

## Concept Exposure (Q9-Q12)

### Q9. 이해도 (1-5): 4

**Quote**: "아 그러니까 `.md` 파일 하나 쓰면 여러 artifact 자동 생성, `/cure` 로 다 지워짐?"
**재설명 불필요**.

### Q10. 개선 여부 (1-5): 4

**이유**: "Rollback 자동이면 실험 부담 줄겠어요. 지금은 새 rule 넣을 때 항상 '롤백 가능한가' 먼저 고민."
**예상 time saving**: "주 30분 정도?"

### Q11. 당장 쓰기

**응답**: "조건부"
**조건**: "Beta 에서 1-2주 써보고 내 workflow 에 fit 하면."

### Q12. 우려

- "내 의도와 생성 artifact 가 다르면? Interpreter LLM 이 잘못 이해할 수도."
- "Validation 4-tier 가 얼마나 시간 걸릴지 (매번 10분씩이면 부담)."

---

## POC Scheduling (Q13)

- **참여**: yes
- **선호 시간**: 다음 주 화요일 오후 / 목요일 오전
- **Ollama**: 없음 (OpenAI API 만 사용)
- **프로젝트**: my-saas (오픈소스, 공유 OK)

---

## Interpretations (interviewer note)

- H1 **강한 신호**: Painpoint 3개 모두 구체적 + recent incident (e2e revert)
- H2 **중간 신호**: Q10=4 + Q11 conditional. "당장 쓰기" 보수적이지만 beta validation 후 전환 가능
- POC 후보로 적합 — **한글 PR 리뷰** 같은 본인 workflow 관련 plasmid 작성 유도

---

## Follow-up

- [x] POC 세션 초대 (Week 2 Day 1)
- [ ] Beta 초대 리스트 등록 (alpha gate 이후)
