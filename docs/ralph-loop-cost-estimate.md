# dbcode Ralph Loop — 모델별 토큰 비용 추정

> 기준: Phase 1 (Foundation) 기준, Max 구독 사용자
> 추정일: 2026-03-05

---

## 1. Ralph Loop 1회 반복(Iteration)의 토큰 구조

Ralph Loop 한 바퀴는 다음 구간으로 나뉩니다:

```
┌─────────────────────────────────────────────────────────┐
│                  1 Iteration 토큰 구성                    │
├──────────────────┬──────────────────────────────────────┤
│ System Prompt    │ ~2,500 tok (ralph prompt + context)  │
│ Conversation     │ ~1,500~8,000 tok (누적, 압축 전)     │
│ Tool Definitions │ ~1,200 tok (7개 P0 도구 스키마)       │
│ User Prompt      │ ~3,000 tok (ralph prompt 원문 재주입) │
│ File Context     │ ~2,000~6,000 tok (읽은 파일들)       │
├──────────────────┼──────────────────────────────────────┤
│ Total INPUT      │ ~10K~20K tok / iteration             │
│ (평균)            │ ~15K tok / iteration                 │
├──────────────────┼──────────────────────────────────────┤
│ Reasoning/Think  │ 모델별 상이 (아래 참조)               │
│ Output (code)    │ ~2K~4K tok / iteration               │
│ Tool calls       │ ~500~1.5K tok / iteration            │
├──────────────────┼──────────────────────────────────────┤
│ Total OUTPUT     │ ~3K~8K tok / iteration               │
│ (평균)            │ ~5K tok / iteration                  │
└──────────────────┴──────────────────────────────────────┘
```

**핵심 포인트**: Ralph Loop는 매 iteration마다 동일한 프롬프트를 재주입하므로, conversation이 누적될수록 input 토큰이 선형 증가합니다. 다만 Claude Code의 auto-compaction이 95%에서 발동하므로 무한정 늘어나진 않습니다.

---

## 2. Phase 1 전체 예상 (Foundation: 15개 Deliverable)

| 항목                         | 보수적 추정 | 현실적 추정 | 최대치 |
| ---------------------------- | ----------- | ----------- | ------ |
| 총 Iteration 수              | 30회        | 50회        | 80회   |
| Deliverable당 평균 Iteration | 2회         | 3.3회       | 5.3회  |
| 실패/재시도 비율             | 10%         | 20%         | 35%    |

> **참고**: Deliverable 1개당 iteration 수가 달라집니다
>
> - 단순 파일(constants.ts, types.ts): 1~2회
> - 중간 복잡도(config loader, LLM client): 3~5회
> - 고 복잡도(streaming, Ink UI, agent loop): 5~8회
> - 검증/수정 사이클: 평균 1~3회 추가

---

## 3. 모델별 상세 비용 추정

### Claude Opus 4.6 (도훈님의 현재 선택)

```
┌────────────────────────────────────────────────────────────┐
│  Claude Opus 4.6 — Max 구독                                │
├────────────────────────────────────────────────────────────┤
│  Input:  $15.00 / MTok  (Max 5x pricing)                   │
│  Output: $75.00 / MTok  (Max 5x pricing)                   │
│  ※ Max 구독은 일반 API의 5배 가격이 내부 적용됩니다         │
│  ※ 단, 구독료($100~200/월)에 포함되므로 직접 과금 아님      │
├────────────────────────────────────────────────────────────┤
│  Thinking tokens: 매우 많음 (8K~32K/iteration)             │
│  Opus는 깊은 추론을 하므로 thinking이 output의 3~6배       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1 Iteration 평균:                                         │
│    Input:   ~18K tok (prompt cache 미적용 시)               │
│    Output:  ~6K tok  (code + tool calls)                   │
│    Think:   ~15K tok (Opus 특유의 깊은 사고)                │
│    합계:    ~39K tok / iteration                           │
│                                                            │
│  Phase 1 전체 (50 iterations):                             │
│    Input:   ~900K tok  (누적 증가 반영)                    │
│    Output:  ~300K tok                                      │
│    Think:   ~750K tok                                      │
│    합계:    ~1.95M tok                                     │
│                                                            │
│  프롬프트 캐시 적용 시 (-60% input):                       │
│    합계:    ~1.4M tok                                      │
│                                                            │
│  ⏱️ 속도: ~30~50 tok/s (느림, 하지만 품질 최고)            │
│  ⏱️ Phase 1 예상 소요: 3~5시간                             │
│  💰 Max 구독: 월정액에 포함 (별도 과금 없음)               │
│  💰 API 직접 사용 시: ~$22~35 / Phase 1                   │
└────────────────────────────────────────────────────────────┘
```

### Claude Sonnet 4.5 (가성비 추천)

```
┌────────────────────────────────────────────────────────────┐
│  Claude Sonnet 4.5                                         │
├────────────────────────────────────────────────────────────┤
│  Input:  $3.00 / MTok  (API)                               │
│  Output: $15.00 / MTok (API)                               │
├────────────────────────────────────────────────────────────┤
│  Thinking tokens: 중간 (4K~16K/iteration)                  │
│  코딩 품질: Opus의 ~90% 수준, 속도 3배                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1 Iteration 평균:                                         │
│    Input:   ~15K tok                                       │
│    Output:  ~5K tok                                        │
│    Think:   ~8K tok                                        │
│    합계:    ~28K tok / iteration                           │
│                                                            │
│  Phase 1 전체 (50 iterations):                             │
│    Input:   ~750K tok                                      │
│    Output:  ~250K tok                                      │
│    Think:   ~400K tok                                      │
│    합계:    ~1.4M tok                                      │
│                                                            │
│  ⏱️ 속도: ~80~120 tok/s (빠름)                             │
│  ⏱️ Phase 1 예상 소요: 1.5~3시간                           │
│  💰 API: ~$6~10 / Phase 1                                  │
│  💰 Max: 월정액 포함                                       │
└────────────────────────────────────────────────────────────┘
```

### Claude Sonnet 4.6 (최신, 밸런스)

```
┌────────────────────────────────────────────────────────────┐
│  Claude Sonnet 4.6                                         │
├────────────────────────────────────────────────────────────┤
│  Input:  $3.00 / MTok  (API)                               │
│  Output: $15.00 / MTok (API)                               │
├────────────────────────────────────────────────────────────┤
│  Thinking tokens: 중간~높음 (6K~20K/iteration)             │
│  코딩 품질: Sonnet 4.5 대비 향상, Opus에 근접               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1 Iteration 평균:                                         │
│    Input:   ~16K tok                                       │
│    Output:  ~5.5K tok                                      │
│    Think:   ~10K tok                                       │
│    합계:    ~31.5K tok / iteration                         │
│                                                            │
│  Phase 1 전체 (50 iterations):                             │
│    Input:   ~800K tok                                      │
│    Output:  ~275K tok                                      │
│    Think:   ~500K tok                                      │
│    합계:    ~1.58M tok                                     │
│                                                            │
│  ⏱️ 속도: ~70~100 tok/s                                    │
│  ⏱️ Phase 1 예상 소요: 2~3.5시간                           │
│  💰 API: ~$7~12 / Phase 1                                  │
│  💰 Max: 월정액 포함                                       │
└────────────────────────────────────────────────────────────┘
```

### Claude Haiku 4.5 (속도 우선)

```
┌────────────────────────────────────────────────────────────┐
│  Claude Haiku 4.5                                          │
├────────────────────────────────────────────────────────────┤
│  Input:  $1.00 / MTok                                      │
│  Output: $5.00 / MTok                                      │
├────────────────────────────────────────────────────────────┤
│  Thinking tokens: 적음 (1K~4K/iteration)                   │
│  코딩 품질: 단순 파일은 OK, 복잡한 로직은 실수 잦음        │
│  ⚠️ Ralph Loop에서 iteration 수 40~70% 더 필요할 수 있음   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1 Iteration 평균:                                         │
│    Input:   ~12K tok                                       │
│    Output:  ~4K tok                                        │
│    Think:   ~2K tok                                        │
│    합계:    ~18K tok / iteration                           │
│                                                            │
│  Phase 1 전체 (70 iterations — 재시도 증가 반영):           │
│    Input:   ~840K tok                                      │
│    Output:  ~280K tok                                      │
│    Think:   ~140K tok                                      │
│    합계:    ~1.26M tok                                     │
│                                                            │
│  ⏱️ 속도: ~150~200 tok/s (매우 빠름)                       │
│  ⏱️ Phase 1 예상 소요: 1~2시간                             │
│  💰 API: ~$2~4 / Phase 1                                   │
│  💰 Max: 월정액 포함                                       │
│                                                            │
│  ⚠️ 권장하지 않음: 아키텍처 수준 코드에서 품질 이슈 다발   │
│  ⚠️ 특히 Ink/React JSX, 스트리밍 로직에서 실수 빈번       │
└────────────────────────────────────────────────────────────┘
```

---

## 4. 비교 요약표

| 모델           | Iteration당 토큰 | Phase 1 총 토큰 | Phase 1 시간 | Phase 1 API 비용 | 품질  | 권장도                        |
| -------------- | ---------------- | --------------- | ------------ | ---------------- | ----- | ----------------------------- |
| **Opus 4.6**   | ~39K             | ~1.95M          | 3~5h         | ~$22~35          | ★★★★★ | ✅ 최고 품질, 걸어다니기 적합 |
| **Sonnet 4.6** | ~31.5K           | ~1.58M          | 2~3.5h       | ~$7~12           | ★★★★☆ | ✅ 가성비 최고                |
| **Sonnet 4.5** | ~28K             | ~1.4M           | 1.5~3h       | ~$6~10           | ★★★★☆ | ✅ 안정적                     |
| **Haiku 4.5**  | ~18K             | ~1.26M          | 1~2h         | ~$2~4            | ★★★☆☆ | ⚠️ 단순 작업만                |

---

## 5. Max 구독자 특별 고려사항

도훈님은 Max 구독이므로:

### 월정액 내에서의 실질적 제약

- **Rate limit**: Max는 API 대비 넉넉하지만, Opus는 분당 토큰 한도 있음
- **5시간 연속 루프**: Opus로 Phase 1 전체를 한번에 돌리면 rate limit에 걸릴 수 있음
- **권장**: `--max-iterations 20`씩 끊어서 돌리고, 중간에 결과 확인

### Opus로 Ralph Loop 최적 전략

```
Phase 1을 3~4번의 ralph-loop 세션으로 나누기:

Session 1: Scaffolding + Config + Auth (Deliverable 1~5)
  --max-iterations 25

Session 2: LLM Client + Core (Deliverable 6~9)
  --max-iterations 25

Session 3: CLI Renderer + Components (Deliverable 10~13)
  --max-iterations 25

Session 4: Bootstrap + Tests + Verification (Deliverable 14~15 + acceptance)
  --max-iterations 20
```

### 왜 Opus를 추천하는가

1. **아키텍처 이해력**: 복잡한 다층 아키텍처를 정확히 이해하고 구현
2. **타입 시스템 정확도**: strict TypeScript에서 실수가 적음 → 재시도 감소
3. **크로스 플랫폼 감수성**: Windows/macOS 차이를 자발적으로 핸들링
4. **Self-correction 능력**: 테스트 실패 시 근본 원인을 빠르게 파악
5. **Ralph Loop 적합성**: 깊은 사고 → 한 iteration에서 더 많은 진전

---

## 6. 전체 프로젝트 (6 Phases) 총 비용 추정

| Phase            | Deliverables | 예상 Iterations | Opus 토큰  | API 비용  |
| ---------------- | ------------ | --------------- | ---------- | --------- |
| 1. Foundation    | 15           | 50              | ~2.0M      | ~$30      |
| 2. Tool System   | 10           | 60              | ~3.0M      | ~$45      |
| 3. Resilience    | 11           | 55              | ~3.2M      | ~$48      |
| 4. Security      | 8            | 40              | ~2.4M      | ~$36      |
| 5. Extensibility | 10           | 60              | ~4.0M      | ~$60      |
| 6. Polish        | 8            | 35              | ~2.0M      | ~$30      |
| **Total**        | **62**       | **~300**        | **~16.6M** | **~$249** |

> **Max 구독 기준**: 월 $200 구독료로 전체 프로젝트 커버 가능 (1~2개월)
> **API 직접 사용 시**: Opus ~$249, Sonnet ~$85, Haiku ~$30

---

## 7. 토큰 효율 최적화 팁

1. **프롬프트 캐시 활용**: 동일 프롬프트 반복이므로 캐시 히트율 80%+ 기대
2. **Compaction 설정**: `session.autoCompactPct: 90`으로 낮춰서 일찍 압축
3. **Phase별 분리**: 한 Phase가 끝나면 새 세션으로 시작 (context 초기화)
4. **git log/diff 최소화**: iteration마다 전체 diff 대신 최근 1커밋만
5. **파일 읽기 최소화**: 아키텍처 문서는 첫 iteration에서만 읽고 이후 참조
