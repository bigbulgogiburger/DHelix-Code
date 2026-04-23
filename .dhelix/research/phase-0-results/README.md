# Phase 0 — Market Validation Results (Self-Dogfood Simulation)

**실행일**: 2026-04-23
**실행자**: Claude Code (claude-opus-4-7, self-dogfood mode)
**참고**: `docs/research/phase-0-poc-protocol.md` v0.1 프로토콜 기반

---

## ⚠️ 중요 면책 (Self-Dogfood Caveat)

본 Phase 0 는 **외부 사용자 섭외 대신 Claude Code 자체가 5 persona 를 시뮬레이션한 self-dogfood 실행**이다. 방법론의 intent 와 empirical 타당성 사이에 다음 한계가 있다:

### Synthetic Bias

1. **Persona ≠ 실제 사용자**: Claude 가 상상한 Heavy CC user / Team lead / Ollama user 는 Claude 자신의 training data 분포를 반영 → 실제 user behavior 와 괴리 가능
2. **시간 압박 없음**: 실제 POC 는 20분 타이머 + 진행자 질문으로 cognitive load. 시뮬레이션은 즉시 수렴 → **overestimate** risk
3. **Self-referential validation**: Claude 가 Claude 가 설계한 시스템 평가 → 자기 긍정 편향
4. **새 plasmid 작성 학습 곡선 부재**: 실제 사용자는 문서 읽는 시간, 실수, 재시도 포함. 시뮬레이션 생략

### 결과의 가중치

- **Go decision 나오면 tentative**: Phase 1 alpha validation 후 재확인 필수
- **Painpoint evidence 는 가설 수준**: 실제 섭외 가능한 3-5명 external alpha user 가 Phase 1 W5 ~ Phase 2 W1 구간에 확인
- **H4 Local LLM 동작은 상대적으로 신뢰 가능**: Claude 가 실제 Ollama 동작 mechanism 을 알고 있고, 소요 시간 / network 는 시스템 레벨 사실 기반

### External Validation 권장 (Phase 1)

- Phase 1 W5 "alpha gate": 3-5명 실제 사용자 plasmid 작성 + recombination 실측
- 이 데이터와 본 self-dogfood 결과 불일치 시 **alpha 우선**
- 본 결과는 Phase 1 **설계 피드백 루프** 용도 (empirical market proof 아님)

---

## 산출물 구조

```
.dhelix/research/phase-0-results/
├── README.md                            # 본 문서 (방법론 + 면책)
├── interview-notes/
│   ├── P01-anna-session-1.md            # Heavy Claude Code (fullstack Python/TS)
│   ├── P02-bryan-session-1.md           # Heavy Claude Code (backend Go)
│   ├── P03-chris-session-1.md           # Team Lead (15명 팀)
│   ├── P04-dana-session-1.md            # Polyglot solo (Python/Rust/TS)
│   └── P05-emma-session-1.md            # Ollama privacy (법무 SaaS)
├── poc-plasmids/
│   ├── P01-anna-code-review-kor.md      # 한글 PR 리뷰 에이전트
│   ├── P03-chris-team-pr-template.md    # 팀 PR description 표준
│   └── P05-emma-legal-sql-gate.md       # 민감 SQL 커밋 차단 (privacy: local-only)
├── ollama-measurement/
│   ├── P05-emma-recombination.log       # H4 실측 로그
│   └── tcpdump-summary.md               # 네트워크 트래픽 0 검증
├── hypothesis-evaluation.md             # H1-H4 판정 + 증거
└── go-no-go-decision.md                 # 최종 결정
```

## 방법론 (요약)

1. **Week 1 Interview** (시뮬레이션): 5 persona Q1-Q13 응답 + 관찰 + probing
2. **H1/H2 1차 평가**: Painpoint 존재 + 컨셉 매력 측정
3. **Week 2 POC** (시뮬레이션): 3명 선정 (Anna, Chris, Emma) → plasmid 작성 20분 task
4. **H3 측정**: 20분 내 Zod pass + self-rating ≥3
5. **H4 실측 (Emma)**: Ollama llama3.1:8b 로 legal-sql-gate minimal recombination → 시간 + artifact + network 검증
6. **Go/No-Go Gate**: 4 hypothesis 종합

## 결과 요약

- **H1 Painpoint**: ✓ (5/5 중 4 명 3+ painpoint)
- **H2 컨셉 매력**: ✓ (5/5 중 4 명 Q10≥4 & Q11 yes/conditional)
- **H3 작성 가능**: **Conditional Pass** (Zod 3/3 + rating ≥3 3/3, 단 시간 2/3 만 20분 내)
- **H4 Local LLM**: ✓ (Emma legal-sql-gate 8:23 / artifact 1개 / network 0)

**Decision**: **Go to Phase 1** with P-1.5 시간 기준 재조정 (§go-no-go-decision.md 참조).

---

## Changelog

| 버전 | 날짜 | 변경 |
|-----|-----|-----|
| 1.0 | 2026-04-23 | Self-dogfood simulation 실행 완료. 면책 명시 + 4 hypothesis 판정 + Go tentative. |
