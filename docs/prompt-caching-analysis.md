# 프롬프트 캐싱 완전 분석 — 클라우드 API vs Ollama 로컬

> dbcode AI 코딩 에이전트의 ReAct 루프 성능 최적화를 위한 기술 분석 문서

---

## 목차

1. [프롬프트 캐싱이란?](#1-프롬프트-캐싱이란)
2. [클라우드 API 캐싱 비교 (Anthropic / OpenAI / MiniMax)](#2-클라우드-api-캐싱-비교)
3. [Ollama KV Cache — 로컬 캐싱의 핵심](#3-ollama-kv-cache)
4. [dbcode 에이전트 루프에서의 캐싱 동작](#4-dbcode-에이전트-루프에서의-캐싱-동작)
5. [로컬 Ollama 환경의 실제 병목 분석](#5-로컬-ollama-환경의-실제-병목-분석)
6. [최적화 가이드](#6-최적화-가이드)
7. [부록: dbcode 현재 캐싱 구현 상태](#7-부록-dbcode-현재-캐싱-구현-상태)

---

## 1. 프롬프트 캐싱이란?

### 문제

dbcode의 에이전트 루프는 ReAct 패턴으로 동작합니다.
도구 하나를 실행할 때마다 LLM을 다시 호출하는데, **매번 시스템 프롬프트 전체가 재전송**됩니다.

```
                    시스템 프롬프트 (12,000 토큰)
                    ┌──────────────────────────────────────────┐
Iteration 1:        │████████████████████████████████████████████│ + 사용자 30 토큰
Iteration 2:        │████████████████████████████████████████████│ + 대화 200 토큰
Iteration 3:        │████████████████████████████████████████████│ + 대화 500 토큰
Iteration 4:        │████████████████████████████████████████████│ + 대화 800 토큰
  ...
Iteration 8:        │████████████████████████████████████████████│ + 대화 3,200 토큰

→ 8회 호출에서 시스템 프롬프트만 96,000 토큰 반복 처리
→ 전체 입력 토큰의 76%가 동일한 내용의 반복
```

### 해결: 프롬프트 캐싱

"이전 요청이랑 똑같은 앞부분은 다시 처리하지 말고, 이전에 계산한 결과를 재사용해라"

```
Iteration 1: [시스템 프롬프트 전체 처리 → 캐시에 저장] + 사용자 메시지 처리
Iteration 2: [캐시에서 꺼냄 — 처리 건너뜀!]            + 새 부분만 처리
Iteration 3: [캐시에서 꺼냄 — 처리 건너뜀!]            + 새 부분만 처리
```

---

## 2. 클라우드 API 캐싱 비교

### 2.1. Anthropic — 명시적 캐싱

개발자가 `cache_control: { type: "ephemeral" }` 을 직접 표시합니다.

**API 요청:**

```json
{
  "model": "claude-sonnet-4-20250514",
  "system": [
    {
      "type": "text",
      "text": "You are dbcode, an AI coding assistant...(도구 정의, 코딩 규칙 등)",
      "cache_control": { "type": "ephemeral" }
    },
    {
      "type": "text",
      "text": "# Environment\nGit branch: main..."
    }
  ],
  "messages": [...]
}
```

**API 응답 — 캐시 통계 포함:**

```json
{
  "usage": {
    "input_tokens": 1000,
    "cache_creation_input_tokens": 11000,
    "cache_read_input_tokens": 0
  }
}
```

2회차부터:

```json
{
  "usage": {
    "input_tokens": 1200,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 11000
  }
}
```

**비용 구조 (Sonnet 기준):**

```
일반 입력:    $3.00 / 1M tokens
캐시 쓰기:   $3.75 / 1M tokens  (1.25배 — 1회차만)
캐시 읽기:   $0.30 / 1M tokens  (0.1배 — 90% 할인!)
```

**모델별 최소 캐싱 토큰:**

| 모델              | 최소 토큰 |
| ----------------- | --------- |
| Claude Opus 4     | 4,096     |
| Claude Sonnet 4   | 2,048     |
| Claude Sonnet 3.7 | 1,024     |
| Claude Haiku 4.5  | 4,096     |
| Claude Haiku 3.5  | 2,048     |

**캐시 TTL:** 기본 5분 (1시간으로 연장 가능, 쓰기 비용 2배)

---

### 2.2. OpenAI — 자동 캐싱

설정 불필요. 서버가 요청의 prefix hash를 기반으로 자동 라우팅합니다.

```
요청 1: [System + Tools + Message A] → hash(prefix) → Machine #42 → 처리 + 캐시
요청 2: [System + Tools + Message B] → hash(prefix) → Machine #42 → 캐시 히트!
```

**API 응답:**

```json
{
  "usage": {
    "prompt_tokens": 14200,
    "cached_tokens": 12000,
    "completion_tokens": 95
  }
}
```

**비용 구조 (GPT-4o 기준):**

```
일반 입력:    $2.50 / 1M tokens
캐시 히트:   $1.25 / 1M tokens  (50% 할인)
캐시 쓰기:   추가 비용 없음
```

**최소 캐싱 토큰:** 1,024 (128 토큰 단위로 증가)

---

### 2.3. MiniMax — 둘 다 지원

자동 캐싱 + Anthropic 스타일 명시적 캐싱 모두 지원.

**엔드포인트:**

- OpenAI 호환: `https://api.minimax.io/v1`
- Anthropic 호환: `https://api.minimax.io/anthropic`

**비용 구조:**

```
일반 입력 (M2.5):   $0.20 / 1M tokens
캐시 히트:          $0.03 / 1M tokens  (85% 할인)
캐시 쓰기:          추가 비용 없음
최소 캐싱 토큰:      512 (가장 낮음)
```

---

### 2.4. 클라우드 API 비교 총표

|                      | Anthropic              | OpenAI             | MiniMax           |
| -------------------- | ---------------------- | ------------------ | ----------------- |
| **방식**             | 명시적 (cache_control) | 자동 (prefix hash) | 둘 다             |
| **할인율**           | 90%                    | 50%                | 85~90%            |
| **캐시 히트율**      | ~100% (개발자 제어)    | ~50-80% (자동)     | ~100% (명시적 시) |
| **최소 토큰**        | 1,024~4,096            | 1,024              | **512**           |
| **캐시 쓰기 추가비** | 1.25배                 | 없음               | 없음              |
| **TTL**              | 5분 / 1시간            | 5~10분             | 미공개            |
| **속도 향상**        | TTFT 80%+ 단축         | TTFT 50%+ 단축     | TTFT 상당         |

---

### 2.5. 비용 시뮬레이션 — 2턴 8회 호출 시나리오

아래 시나리오 기준: 시스템 프롬프트 12,000 토큰, 총 8회 LLM 호출, 입력 합계 125,250 토큰

**캐싱 없이:**

| Provider         | 입력 비용 | 출력 비용 | 합계       |
| ---------------- | --------- | --------- | ---------- |
| Anthropic Sonnet | $0.38     | $0.01     | **$0.39**  |
| OpenAI GPT-4o    | $0.31     | $0.01     | **$0.32**  |
| MiniMax M2.5     | $0.025    | $0.002    | **$0.027** |

**캐싱 적용:**

| Provider  | 1회차 (쓰기) | 2~8회차 (읽기)      | 합계       | 절감율 |
| --------- | ------------ | ------------------- | ---------- | ------ |
| Anthropic | $0.051       | 7 × $0.015 = $0.107 | **$0.16**  | 59%    |
| OpenAI    | $0.036       | 7 × $0.021 = $0.147 | **$0.18**  | 44%    |
| MiniMax   | $0.003       | 7 × $0.001 = $0.008 | **$0.011** | 59%    |

---

## 3. Ollama KV Cache

### 3.1. 클라우드 vs 로컬 — 근본적 차이

```
┌─────────────────────────────────────────────────────────────────┐
│ 클라우드 API (Anthropic / OpenAI)                                │
│                                                                 │
│  사용자 ──HTTP──→ [로드밸런서] ──→ [GPU 클러스터]                  │
│                                    ↑                            │
│                  수천 명의 요청이 경쟁                              │
│                  캐시는 서버 측에서 관리                            │
│                  TTL 5분 후 자동 만료                              │
│                  요청마다 다른 머신으로 갈 수 있음                    │
│                                                                 │
│  → "캐시해줘" 라고 명시해야 함                                     │
│  → 캐시 히트가 보장되지 않음 (OpenAI)                              │
│  → 비용은 줄지만 속도는 서버 상태에 의존                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Ollama 로컬                                                      │
│                                                                 │
│  사용자 ──HTTP──→ [localhost:11434] ──→ [내 GPU]                  │
│                                          ↑                      │
│                  나 혼자 쓰는 서버                                 │
│                  모델이 VRAM에 상주                                │
│                  KV Cache가 GPU 메모리에 계속 살아있음               │
│                  경쟁자 없음                                      │
│                                                                 │
│  → 아무 설정 안 해도 자동 캐싱                                     │
│  → 모델이 메모리에 있는 한 100% 캐시 히트                           │
│  → 비용 없음 (로컬)                                               │
│  → 속도는 GPU 성능에 의존                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2. KV Cache 작동 원리

LLM의 Transformer 아키텍처에서, 토큰을 생성할 때마다 **모든 이전 토큰에 대한 어텐션**을 계산합니다.

```
토큰 생성 과정 (캐시 없이):

  입력: "You are dbcode" (4 토큰)

  토큰 1 "You":    K₁, V₁ 계산
  토큰 2 "are":    K₁에 대해 어텐션 + K₂, V₂ 계산
  토큰 3 "dbcode": K₁,K₂에 대해 어텐션 + K₃, V₃ 계산
  토큰 4 ",":      K₁,K₂,K₃에 대해 어텐션 + K₄, V₄ 계산

  → 토큰이 늘어날수록 계산량이 O(n²)으로 증가
```

```
KV Cache 적용:

  1회차 요청:
    "You are dbcode..." (12,000 토큰) 전체 처리
    → K₁~K₁₂₀₀₀, V₁~V₁₂₀₀₀ 를 GPU VRAM에 저장

  2회차 요청:
    "You are dbcode..." (동일) + "테스트 작성해줘" (새 부분)
    → K₁~K₁₂₀₀₀ 이미 VRAM에 있음 → 건너뜀!
    → "테스트 작성해줘" 부분만 K₁₂₀₀₁~ 계산
    → 17배 빠름!
```

### 3.3. Prefix 매칭 규칙

Ollama(llama.cpp)의 KV Cache는 **바이트 단위 정확한 prefix 매칭**을 사용합니다.

```
요청 A: [System Prompt][Context][Question A]
요청 B: [System Prompt][Context][Question B]
         ↑────── 동일한 prefix ──────↑  ↑── 여기만 새로 계산

→ System Prompt + Context 부분의 KV 벡터를 재사용
→ Question 부분만 새로 계산
```

**캐시를 깨는 상황:**

```
요청 A: "You are dbcode. Time: 12:01 ..."
요청 B: "You are dbcode. Time: 12:02 ..."
                          ↑ 여기서 불일치!

→ "Time:" 이후 전체 재계산 (캐시 무효화)
```

**따라서**: 시스템 프롬프트의 앞부분에 동적 내용(시간, git status 등)을 넣으면 캐시가 깨집니다.
동적 내용은 반드시 **뒤쪽**에 배치해야 합니다.

### 3.4. keep_alive — 캐시 생존 시간

모델이 VRAM에서 내려가면 KV Cache도 함께 사라집니다.

```
keep_alive 설정:

  기본값:  5분    ← 마지막 요청 후 5분 지나면 모델 언로드
  "10m":   10분
  "1h":    1시간
  "-1":    무한   ← 수동으로 내리기 전까지 유지
  "0":     즉시 언로드
```

**에이전트 루프에서의 영향:**

```
keep_alive = 5m (기본):

  Iter 1 → LLM 호출 (모델 로드 + KV Cache 생성)  [8초]
  Iter 2 → LLM 호출 (캐시 히트!)                  [1초]  ✅
  Iter 3 → LLM 호출 (캐시 히트!)                  [1초]  ✅
  ...
  Turn 1 완료 → 사용자가 결과를 읽고 생각함 (6분)
  Turn 2 입력 → 모델 언로드됨! → 처음부터 다시 로드  [8초]  ❌

keep_alive = -1 (무한):

  모든 호출에서 캐시 히트 → 일관되게 빠름  ✅
  (대신 다른 모델 로드 시 VRAM 부족 가능)
```

### 3.5. VRAM 사용량

KV Cache는 GPU VRAM을 먹습니다. 컨텍스트가 길수록 더 많이.

```
KV Cache VRAM = 모델 레이어 수 × 2(K+V) × head_dim × context_length × dtype_size

실제 예시 (FP16 기준):

  모델          컨텍스트    KV Cache VRAM
  ──────────────────────────────────────
  7B  (32L)     4K         ~0.5 GB
  7B  (32L)     32K        ~4.5 GB
  14B (40L)     32K        ~8 GB
  32B (64L)     32K        ~16 GB
  70B (80L)     32K        ~32 GB
```

**KV Cache 양자화로 절약 가능:**

```
환경변수                    VRAM 절약    품질 영향
──────────────────────────────────────────────
OLLAMA_KV_CACHE_TYPE=f16   기본값       없음
OLLAMA_KV_CACHE_TYPE=q8_0  50% 절약    거의 없음 (추천)
OLLAMA_KV_CACHE_TYPE=q4_0  75% 절약    약간 있음
```

### 3.6. 성능 벤치마크

**프롬프트 평가 시간 (prompt eval):**

```
시나리오                    시간         비고
─────────────────────────────────────────────
콜드 스타트 (캐시 없음)     962 ms      전체 12K 토큰 처리
웜 (prefix 캐시 히트)       54 ms       새 부분만 처리
                            ─────
                            17.7배 빠름!
```

**하지만 프롬프트 평가는 전체 시간의 일부:**

```
전체 응답 시간 = 프롬프트 평가 + 토큰 생성

프롬프트 평가: 54ms (캐시 히트 시)     ← 캐싱으로 최적화됨
토큰 생성:    100 토큰 × 25ms/tok = 2.5초  ← 캐싱과 무관!
                                        ↑ 여기가 진짜 병목
```

---

## 4. dbcode 에이전트 루프에서의 캐싱 동작

### 4.1. Ollama에서의 실제 흐름

```
Turn 1: "깃 체크아웃 하고 init command 시작해줘"

Iteration 1 (첫 호출):
  ┌─────────────────────────────────────────────────────────┐
  │ System Prompt (12,000 토큰) → 전체 처리 (KV Cache 생성)  │
  │ User Message (30 토큰) → 처리                           │
  │ prompt_eval: ~960ms                                     │
  │ 토큰 생성: ~45 토큰 × 25ms = ~1.1초                      │
  │ 총: ~2.1초                                              │
  └─────────────────────────────────────────────────────────┘
                ↓ bash_exec("git checkout main") 실행 (0.5초)
                ↓ PostToolUse 훅 없음 (bash)

Iteration 2:
  ┌─────────────────────────────────────────────────────────┐
  │ System Prompt (12,000 토큰) → KV Cache 히트! (건너뜀)    │
  │ User + Assistant + Tool 결과 (200 토큰) → 새로 처리      │
  │ prompt_eval: ~54ms  ← 17배 빠름!                        │
  │ 토큰 생성: ~120 토큰 × 25ms = ~3초                       │
  │ 총: ~3.1초                                              │
  └─────────────────────────────────────────────────────────┘
                ↓ glob_search + list_dir 병렬 실행 (0.3초)

Iteration 3:
  ┌─────────────────────────────────────────────────────────┐
  │ System + 이전 대화 (12,500 토큰) → 대부분 캐시 히트      │
  │ 새로 추가된 부분 (300 토큰) → 처리                       │
  │ prompt_eval: ~80ms                                      │
  │ 토큰 생성: ~180 토큰 × 25ms = ~4.5초                     │
  │ 총: ~4.6초                                              │
  └─────────────────────────────────────────────────────────┘
                ↓ file_write("DBCODE.md") (50ms)
                ↓ ⚠️ PostToolUse: npx prettier (1~3초)

Iteration 4 (최종):
  ┌─────────────────────────────────────────────────────────┐
  │ prompt_eval: ~90ms (대부분 캐시 히트)                     │
  │ 토큰 생성: ~95 토큰 × 25ms = ~2.4초                      │
  │ 총: ~2.5초                                              │
  └─────────────────────────────────────────────────────────┘

Turn 1 합계 (이론적 최적):
  LLM 호출: 2.1 + 3.1 + 4.6 + 2.5 = ~12.3초
  도구 실행: ~0.8초
  Prettier: ~2초
  총: ~15초
```

### 4.2. 그런데 실제로는 50분 걸린다면?

**KV Cache는 이미 작동하고 있을 가능성이 높습니다.**
문제는 캐싱이 아니라 다른 곳에 있습니다.

---

## 5. 로컬 Ollama 환경의 실제 병목 분석

### 5.1. 병목 후보별 영향도

```
영향도: ■■■■■ = 매우 큼, ■ = 작음

■■■■■  [1] 토큰 생성 속도 (모델 크기 + GPU 성능)
■■■■■  [2] VRAM 부족 → CPU 스필 (offloading)
■■■    [3] keep_alive 만료 → 모델 재로드
■■■    [4] Observation Masking → 캐시 prefix 깨짐
■■     [5] Prettier 훅 (파일 쓸 때마다 1~3초)
■      [6] 시스템 프롬프트 크기 자체
```

### 5.2. [병목 1] 토큰 생성 속도 — 가장 큰 병목

KV Cache는 **프롬프트 평가(입력 처리)**를 빠르게 하지만,
**토큰 생성(출력)**은 캐싱으로 빨라지지 않습니다.

```
모델별 토큰 생성 속도 (일반적인 로컬 GPU 기준):

모델 크기    RTX 3060 12GB    RTX 4070 12GB    RTX 4090 24GB
──────────────────────────────────────────────────────────
7B           ~30 tok/s        ~45 tok/s        ~80 tok/s
14B          ~15 tok/s        ~25 tok/s        ~50 tok/s
32B          CPU 스필!        ~10 tok/s        ~25 tok/s
70B          CPU 스필!        CPU 스필!        ~12 tok/s
```

**dbcode 2턴 시나리오에서의 총 생성 시간:**

```
총 생성 토큰: ~1,100 토큰 (8회 호출 합계)

7B  + RTX 4070:  1,100 ÷ 45 = ~24초
14B + RTX 4070:  1,100 ÷ 25 = ~44초
32B + RTX 4090:  1,100 ÷ 25 = ~44초
32B + RTX 4070:  1,100 ÷ 10 = ~110초 (1분 50초!)
70B + RTX 4090:  1,100 ÷ 12 = ~92초 (1분 32초)
```

### 5.3. [병목 2] VRAM 부족 → CPU Offloading

GPU VRAM이 부족하면 모델 레이어 일부가 시스템 RAM으로 넘어갑니다.
이때 **성능이 5~20배 저하**됩니다.

```
VRAM 사용량 = 모델 가중치 + KV Cache + 오버헤드

예시: 32B 모델 (Q4_K_M 양자화)

  모델 가중치:  ~18 GB
  KV Cache:     ~4 GB (8K 컨텍스트, FP16)
  오버헤드:     ~1 GB
  총:           ~23 GB

  RTX 4070 (12GB): 11GB 부족! → 모델의 ~48%가 CPU로 넘어감
  RTX 4090 (24GB): 1GB 여유 → 전부 GPU에서 실행 ✅
```

**CPU 스필 시 증상:**

```
정상 (전부 GPU):
  eval rate: 25 tokens/sec

CPU 스필 (일부 CPU):
  eval rate: 2~5 tokens/sec  ← 10배 느림!

확인 명령:
  $ ollama ps
  NAME         SIZE     PROCESSOR     UNTIL
  qwen2.5:32b  18 GB   48% GPU/52% CPU  Forever    ← CPU 스필 발생!
                        ↑ 이 비율이 100% GPU가 아니면 스필
```

### 5.4. [병목 3] keep_alive 만료

```
기본 keep_alive = 5분

시나리오:
  13:00:00  Iter 1 완료 (모델 로드됨)
  13:00:05  Iter 2 (캐시 히트 ✅)
  13:00:10  Iter 3 (캐시 히트 ✅)
  13:00:15  Turn 1 완료 → 사용자가 결과를 읽음
  ...
  13:05:15  5분 경과 → Ollama가 모델을 VRAM에서 언로드!
  13:06:00  사용자가 Turn 2 입력
  13:06:00  → 모델 재로드 시작 (3~15초)
  13:06:10  → KV Cache도 처음부터 재생성 (~1초)

  → 불필요한 10~15초 낭비
```

### 5.5. [병목 4] Observation Masking → 캐시 깨짐

dbcode의 `applyObservationMasking()`이 오래된 도구 결과를 요약문으로 교체합니다.

```
Iter 3의 messages:
  [3] tool: "Already on 'main'\nYour branch is up to date."

Iter 5에서 masking 적용 후:
  [3] tool: "[Previous tool output summarized]"   ← 내용이 바뀜!
```

**문제**: KV Cache는 바이트 단위 prefix 매칭입니다.
메시지 [3]의 내용이 바뀌면, **[3] 이후의 모든 KV Cache가 무효화**됩니다.

```
캐시 상태:

  [0] system (캐시됨 ✅)
  [1] user (캐시됨 ✅)
  [2] assistant (캐시됨 ✅)
  [3] tool ← 내용 변경됨! → 여기서부터 캐시 깨짐 ❌
  [4] assistant (재계산 필요)
  [5] tool (재계산 필요)
  ...
```

→ 시스템 프롬프트는 캐시되지만, 대화 히스토리의 캐시가 깨지므로
컨텍스트가 길어질수록 재계산 부분이 커집니다.

### 5.6. [병목 5] Prettier 훅

```
파일 수정 (Edit/Write) 할 때마다:
  npx prettier --write "$FILEPATH"

npx 시작 오버헤드: ~1초
prettier 실행:     ~0.5~2초
합계:              ~1.5~3초 / 파일

10개 파일 수정 시: 15~30초 추가
```

---

## 6. 최적화 가이드

### 6.1. 즉시 적용 가능 (설정 변경만)

#### (a) keep_alive 무한으로 설정

```bash
# 방법 1: 환경변수
export OLLAMA_KEEP_ALIVE=-1
ollama serve

# 방법 2: 요청마다 전달 (dbcode 코드에서)
# POST /api/chat
{
  "model": "qwen2.5:14b",
  "keep_alive": -1,
  "messages": [...]
}
```

**효과**: 모델 재로드 방지 → 턴 간 10~15초 절약

#### (b) KV Cache 양자화

```bash
# 50% VRAM 절약, 품질 손실 거의 없음 (가장 추천)
export OLLAMA_KV_CACHE_TYPE=q8_0
ollama serve

# 더 공격적 (75% 절약, 약간의 품질 손실 가능)
export OLLAMA_KV_CACHE_TYPE=q4_0
ollama serve
```

**효과**: KV Cache VRAM이 반으로 줄어 CPU 스필 위험 감소

```
예: 14B 모델, 16K 컨텍스트

  FP16 KV Cache:  4 GB  → 총 VRAM 14 GB (RTX 4070에서 스필!)
  Q8_0 KV Cache:  2 GB  → 총 VRAM 12 GB (RTX 4070에서 겨우 맞음 ✅)
  Q4_0 KV Cache:  1 GB  → 총 VRAM 11 GB (여유 있음 ✅)
```

#### (c) Prettier 훅을 세션 끝으로 이동

현재 (`settings.local.json`):

```json
"hooks": {
  "PostToolUse": [{
    "matcher": "Edit|Write",
    "hooks": [{ "command": "npx prettier --write \"$FILEPATH\"" }]
  }]
}
```

변경 권장:

```json
"hooks": {
  "Stop": [{
    "matcher": ".*",
    "hooks": [{
      "command": "npx prettier --write $(git diff --name-only --diff-filter=M -- '*.ts' '*.tsx' '*.js' '*.json') 2>/dev/null || true"
    }]
  }]
}
```

**효과**: 매 편집마다 1~3초 → 세션 끝에 1번만 실행

### 6.2. 모델 선택 최적화

```
목표: GPU에 100% 올라가면서 가장 똑똑한 모델

RTX 3060 (12GB):
  추천: qwen2.5:7b-instruct-q8_0 (8 GB)
  KV Cache: q8_0으로 ~2 GB = 총 10 GB ✅

RTX 4070 (12GB):
  추천: qwen2.5:14b-instruct-q4_K_M (9 GB)
  KV Cache: q8_0으로 ~2 GB = 총 11 GB ✅

RTX 4070 Ti Super (16GB):
  추천: qwen2.5:14b-instruct-q6_K (12 GB)
  KV Cache: q8_0으로 ~3 GB = 총 15 GB ✅

RTX 4090 (24GB):
  추천: qwen2.5:32b-instruct-q4_K_M (18 GB)
  KV Cache: q8_0으로 ~3 GB = 총 21 GB ✅

2× RTX 4090 (48GB):
  추천: qwen2.5:72b-instruct-q4_K_M (40 GB) ✅
```

**핵심 원칙**: CPU 스필이 발생하면 모델이 아무리 좋아도 느립니다.
VRAM에 100% 들어가는 가장 큰 모델을 선택하세요.

### 6.3. 시스템 프롬프트 최적화 (캐시 효율)

**현재 dbcode의 시스템 프롬프트 구조와 캐시 영향:**

```
현재 (system-prompt-builder.ts의 섹션 순서):

  Priority 100: identity         (정적 ✅ — 캐시됨)
  Priority 95:  doing-tasks      (정적 ✅ — 캐시됨)
  Priority 90:  environment      (동적 ❌ — 여기서 캐시 끊김!)
  Priority 85:  tools            (정적 ✅ — 하지만 위의 동적 때문에 캐시 안 됨)
  Priority 80:  conventions      (정적 ✅ — 하지만 캐시 안 됨)
  Priority 78:  skills           (정적 ✅ — 하지만 캐시 안 됨)
  ...
```

**문제**: `environment` 섹션이 Priority 90으로 중간에 끼어 있어서,
그 뒤의 정적 섹션(tools, conventions, skills)도 Ollama KV Cache에서 캐시 안 됩니다.

**개선안**: 동적 섹션을 맨 뒤로 이동

```
개선 후:

  Priority 100: identity         (정적 ✅ — 캐시됨)
  Priority 95:  doing-tasks      (정적 ✅ — 캐시됨)
  Priority 85:  tools            (정적 ✅ — 캐시됨!)
  Priority 80:  conventions      (정적 ✅ — 캐시됨!)
  Priority 78:  skills           (정적 ✅ — 캐시됨!)
  Priority 77:  action-bias      (정적 ✅ — 캐시됨!)
  Priority 72:  auto-memory      (세션 내 정적 ✅ — 캐시됨!)
  Priority 70:  project          (세션 내 정적 ✅ — 캐시됨!)
  ...
  Priority 35:  repo-map         (세션 내 정적)
  Priority 30:  environment ←    (동적 — 맨 마지막! 여기만 재계산)
```

**효과**: 캐시되는 prefix가 ~10,000 토큰에서 ~11,500 토큰으로 증가

### 6.4. Observation Masking 개선

현재 문제: masking이 이전 메시지 내용을 변경하여 KV Cache prefix를 깨뜨림

```
개선안 A: masking 임계값 조정
  → keepRecentN을 5에서 더 크게 (예: 15)
  → 대부분의 대화에서 masking이 발동하지 않음
  → 캐시 무효화 방지

개선안 B: masking 대신 truncation
  → 오래된 메시지를 "변경"하지 말고 "제거"
  → prefix는 유지되므로 캐시가 살아남음
  → 단, 컨텍스트 정보 손실

개선안 C: masking을 맨 앞이 아닌 맨 뒤에서 적용
  → 가장 오래된 메시지(prefix 뒤쪽)를 masking
  → prefix의 앞부분(시스템 프롬프트)은 보존
```

---

## 7. 부록: dbcode 현재 캐싱 구현 상태

### 7.1. Anthropic Provider (이미 구현됨)

`src/llm/providers/anthropic.ts` line 951:

```typescript
private buildCachableSystemBlocks(system: string) {
  const parts = system.split("\n\n---\n\n");
  const dynamicPrefixes = ["# Environment"];  // 동적 섹션

  for (const part of parts) {
    if (isDynamic) {
      blocks.push({ type: "text", text: part });           // 캐시 안 함
    } else {
      staticBuffer += part;                                 // 정적 → 모아서
      blocks.push({ ..., cache_control: { type: "ephemeral" } }); // 캐시!
    }
  }
}
```

**Beta 헤더도 설정됨** (line 605):

```typescript
"anthropic-beta": "prompt-caching-2024-07-31"
```

**캐시 통계 이벤트 발행** (line 1015):

```typescript
private _emitCacheStats(usage) {
  if (cacheCreation > 0 || cacheRead > 0) {
    this.eventEmitter?.emit("llm:cache-stats", {
      cacheCreationInputTokens: cacheCreation,
      cacheReadInputTokens: cacheRead,
      model
    });
  }
}
```

### 7.2. OpenAI Provider (자동 캐싱에 의존)

별도 캐싱 코드 없음. OpenAI API의 자동 prefix 캐싱에 의존합니다.

### 7.3. Ollama (OpenAI 호환 모드)

dbcode는 Ollama를 OpenAI 호환 API로 호출합니다.
Ollama의 KV Cache는 서버 레벨에서 자동 작동하므로 클라이언트 코드 불필요.

**단, keep_alive 파라미터 전달 여부 확인 필요:**

```typescript
// 현재 client.ts에서 keep_alive를 보내고 있는지?
// 안 보내면 기본 5분 → 세션 중간에 모델 언로드 위험
```

### 7.4. Model Capabilities 플래그

`src/llm/model-capabilities.ts`:

```typescript
interface ModelCapabilities {
  supportsCaching: boolean; // Anthropic 모델만 true
}
```

현재는 Anthropic 모델에만 `supportsCaching: true`가 설정되어 있습니다.
Ollama 모델은 서버 레벨 자동 캐싱이므로 이 플래그와 무관합니다.

---

## 부록: 진단 명령어 모음

```bash
# 현재 GPU VRAM 상태
nvidia-smi

# Ollama에 로드된 모델 + GPU/CPU 비율
ollama ps

# Ollama 서버 로그 (KV cache hit 등 확인)
ollama logs

# 특정 모델의 상세 정보
ollama show qwen2.5:14b --verbose

# 실시간 VRAM 모니터링 (1초 간격)
watch -n 1 nvidia-smi

# Ollama API로 모델 상태 확인
curl http://localhost:11434/api/ps
```
