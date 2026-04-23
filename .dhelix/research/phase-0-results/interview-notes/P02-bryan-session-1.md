---
participant_id: P02
persona: heavy-claude-code
role: "Senior Backend Developer (Go, 5yr)"
simulated: true
interviewer: Claude Code (self-dogfood)
session_date: 2026-04-23
duration_min: 58
recorded: synthetic
---

# Session 1 — P02 Bryan Kim (Heavy Claude Code, Go)

## Background (Q1-Q3)

### Q1. Customization 빈도

**응답**: c. 매월 (더 낮게)
**Quote**: "처음에 이것저것 시도했는데 지금은 안정화돼서 거의 안 건드려요."

### Q2. 최근 customization

**파일**: `~/work/api-gateway/CLAUDE.md` (180줄, 6개월 전 작성 후 거의 정적)
**내용**: 1달 전 "goroutine leak detection rule" 추가
**재수정**: 1회 (false positive 로 튜닝)

### Q3. 소요 시간

**응답**: 25분 (재시도 포함)
**Quote**: "요즘은 Claude API 꽤 똑똑해서 rule 대충 써도 알아들어요."

---

## Workflow 시연 관찰

| 시각 | 행동 |
|-----|-----|
| 00:00 | CLAUDE.md 열어 `## Rules` 하단에 추가 |
| 00:30 | 기존 rule 포맷 복사 + SQL 내용만 변경 |
| 01:45 | 저장 |
| 02:00 | "테스트 안 해요, SQL 작업 있을 때 확인할게요" |

**관찰**: Anna 대비 빠름. 이미 CLAUDE.md 에 충분한 rule 있어 "참고 예시 탐색" 없음.

---

## Pain Points (Q4-Q8)

### Q4. 불편

**응답**: "Skill 문법. SKILL.md format 쓸 때마다 docs 다시 읽음."
**Quote**: "hook / skill / command 차이를 아직도 헷갈려요."
**Painpoint #1 후보**: Skill 작성 learning curve

### Q5. 반영 확인

**응답**: "skill 은 `/skill-name` 으로 불러보면 확인되는데, rule 은 모르겠어요."
**Quote**: "어느 rule 이 이 응답에 영향 줬는지 역추적 불가."
**Painpoint #2**: Rule 기여도 불투명성

### Q6. 되돌리기 경험

**응답**: "없어요. Rule 넣고 별 문제 없으면 그대로 둬요. 문제 생기면 `active: false` 로 disable."
**Probe — 끄고 다시 켰는데 문제 있었나?**: "한 번도 없었어요."

### Q7. 팀 공유

**응답**: "팀 3명. 각자 작성 따로, 가끔 Slack 에 '이 rule 추가했어' 공유."
**Painpoint #3 후보**: 팀 공유 workflow 부재 (약한 신호 — 본인 bothered 아님)

### Q8. 실패 관리

**응답**: "`active: false` 로 두고 잊어버려요."

---

**Painpoint 카운트**: 2개 명확 (skill 문법, rule 역추적) + 1개 약함 (팀 공유) = **2-3 애매** — H1 weak-pass

---

## Concept Exposure (Q9-Q12)

### Q9. 이해도: 4

**Quote**: "요약하면 선언적 agent 구성 시스템이네요."

### Q10. 개선 여부: 3

**이유**: "제 workflow 이미 안정화돼서 plasmid 없이도 괜찮아요. 문제 생겨도 `active:false` 로 해결되고."

### Q11. 당장 쓰기

**응답**: "No. 지금 필요 없어요."

### Q12. 우려

- "Learning curve. 또 새 문법 배워야."
- "기존 skill / rule 전환 비용."

---

## POC Scheduling (Q13)

- **참여**: **No** — "다음 주 회사 프로젝트 데드라인. 30분도 없어요."
- **Ollama**: 없음
- **Follow-up**: Alpha 릴리스 후 초대 의향만 기록

---

## Interpretations

- H1 **weak signal**: Painpoint 있지만 본인은 bothered 아님 (workflow 안정화)
- H2 **negative signal**: Q10=3, Q11=no. "이미 해결된 문제" 인식
- **중요**: Bryan 같은 "solved it another way" persona 가 dhelix target market 약 30% 추정. Phase 1 에서 "이미 CC 잘 쓰는 사람" 에게 upgrade path 어필 전략 필요
- POC 불참 — 본 Phase 0 에서 P02 제외하고 3명 (Anna, Chris, Emma) 로 POC 진행

---

## Follow-up

- [x] POC 제외 (기록)
- [ ] Alpha 릴리스 초대 (Phase 1 W5+)
- **Note**: Bryan 같은 페르소나 대상으로 Phase 1 W3-W4 에 마케팅 메시지 A/B test — "already using CC? Here's what plasmid adds"
