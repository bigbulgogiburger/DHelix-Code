# Source Reference 미작성 모듈 문서화 계획

> 총 11개 모듈 | 작성 기준일: 2026-03-22
> 기존 완료 10개: agent-loop, context-manager, circuit-breaker, recovery-executor, token-counter, model-capabilities, secret-scanner, tool-registry, permission-manager, config-loader

---

## 목차

1. [Layer 2: Core (3개)](#layer-2-core)
   - [system-prompt-builder](#1-system-prompt-builder)
   - [checkpoint-manager](#2-checkpoint-manager)
   - [observation-masking](#3-observation-masking)
2. [Layer 3: Infrastructure (4개)](#layer-3-infrastructure)
   - [llm-client](#4-llm-client)
   - [dual-model-router](#5-dual-model-router)
   - [tool-executor](#6-tool-executor)
   - [mcp-manager](#7-mcp-manager)
3. [Layer 4: Leaf (2개)](#layer-4-leaf)
   - [skill-manager](#8-skill-manager)
   - [instruction-loader](#9-instruction-loader)
4. [Layer 1: CLI (2개)](#layer-1-cli)
   - [use-agent-loop](#10-use-agent-loop)
   - [activity-feed](#11-activity-feed)
5. [작업 우선순위 및 난이도 매트릭스](#작업-우선순위-및-난이도-매트릭스)

---

## Layer 2: Core

### 1. system-prompt-builder

| 항목           | 내용                                                                               |
| -------------- | ---------------------------------------------------------------------------------- |
| **파일**       | `src/core/system-prompt-builder.ts` (약 1,035줄)                                   |
| **레이어**     | Layer 2: Core                                                                      |
| **한 줄 설명** | 동적 시스템 프롬프트 조립 — 모듈식 섹션 + 우선순위 기반 토큰 예산 관리 + 캐시 힌트 |
| **복잡도**     | ★★★★★ (높음 — 가장 많은 export와 내부 함수)                                        |
| **예상 분량**  | 페이지 길이 상위 — 레퍼런스 섹션이 특히 클 것                                      |

#### 문서화할 Export 목록

**인터페이스 (4개)**
| 이름 | 용도 |
|------|------|
| `PromptSection` | 개별 프롬프트 섹션 (id, content, priority, condition?, tokenBudget?) |
| `SessionState` | 세션 모드/상태 (normal\|plan, isSubagent, availableTools, extendedThinkingEnabled, features) |
| `BuildSystemPromptOptions` | buildSystemPrompt 전체 설정 옵션 |
| `SystemPromptBlock` | 캐싱용 블록 (type, text, cache_control?) |
| `StructuredSystemPrompt` | 캐시 힌트 포함 전체 프롬프트 (text, blocks[]) |

**함수 (3개)**
| 이름 | 시그니처 | 용도 |
|------|---------|------|
| `buildSystemPrompt` | `(options?: BuildSystemPromptOptions) → string` | 메인 — 모듈식 섹션을 조립하여 완전한 시스템 프롬프트 생성 |
| `buildStructuredSystemPrompt` | `(options?: BuildSystemPromptOptions) → StructuredSystemPrompt` | 캐시 힌트 포함 구조화된 프롬프트 (Anthropic API용) |
| `buildSystemReminder` | `(type, context?) → string` | 대화 중간 시스템 리마인더 생성 |
| `compressToolDescription` | `(description, tier) → string` | 저성능 모델용 도구 설명 압축 |

**상수 (3개)**
| 이름 | 값 | 용도 |
|------|-----|------|
| `TIER_BUDGETS` | high:12K, medium:8K, low:4K | 모델 능력별 토큰 예산 |
| `DEFAULT_TOTAL_TOKEN_BUDGET` | 32,000 | 기본 시스템 프롬프트 토큰 한도 |
| `FEATURE_SECTIONS` | Map | 기능 플래그 → 프롬프트 섹션 매핑 |

#### 의존성 관계

```
Import 하는 모듈:
  ← utils/platform (getPlatform, getShellType)
  ← constants (APP_NAME, VERSION, getProjectConfigPaths)
  ← tools/registry (ToolRegistry 타입)
  ← llm/token-counter (estimateTokens)
  ← llm/model-capabilities (CapabilityTier)
  ← core/tone-profiles (getToneProfile)

Import 되는 곳:
  → cli/headless.ts (헤드리스 모드)
  → cli/hooks/useAgentLoop.ts (React 훅)
  → subagents/spawner.ts (서브에이전트 생성)
  → core/context-manager.ts (컨텍스트 관리)
```

#### Mermaid 다이어그램 계획

1. **아키텍처 위치** — Agent Loop ← System Prompt Builder → Token Counter, Tool Registry
2. **섹션 조립 플로우차트** — 수집 → 조건 필터 → 우선순위 정렬 → 예산 적용 → 결합
3. **구조화 프롬프트 블록 다이어그램** — static 블록(캐시) vs dynamic 블록(매번 갱신)

#### 핵심 알고리즘 설명 포인트

1. **모듈식 섹션 시스템**: identity(100), environment(90), tools(85) 등 우선순위
2. **Greedy Packing**: 높은 우선순위부터 토큰 예산에 맞을 때까지 포함
3. **조건부 포함**: SessionState에 따라 plan mode, subagent, extended thinking 섹션 on/off
4. **캐시 최적화**: static/dynamic 블록 분류 → Anthropic API의 `cache_control` 활용
5. **프로젝트 감지**: Git 컨텍스트, 프로젝트 타입(Node/Python/Go 등) 자동 탐지

#### Pitfall 후보

- "buildSystemPrompt()를 매 턴마다 호출하는 것은 정상입니다. 내부적으로 변경되지 않은 섹션은 캐시됩니다."
- "PromptSection의 priority 값이 높을수록 먼저 포함됩니다 (100이 최고 우선순위)."
- "TIER_BUDGETS는 모델의 CapabilityTier에 연동됩니다. 모델을 변경하면 예산도 자동 조정됩니다."

#### 트러블슈팅 후보

| 문제                                    | 원인                                                | 해결                                  |
| --------------------------------------- | --------------------------------------------------- | ------------------------------------- |
| "시스템 프롬프트가 너무 길어요"         | 총 토큰 예산 초과 → 낮은 우선순위 섹션 탈락         | TIER_BUDGETS 확인, 섹션 우선순위 조정 |
| "프로젝트 지시사항이 반영되지 않아요"   | DHELIX.md 경로가 detectProjectType()에서 인식 안 됨 | 프로젝트 루트에 DHELIX.md 배치 확인   |
| "서브에이전트가 다른 프롬프트를 받아요" | SessionState.isSubagent로 분기되어 다른 섹션 포함   | isSubagent + subagentType 조합 확인   |

#### SeeAlso 계획

| 모듈               | 관계    | 설명                                 |
| ------------------ | ------- | ------------------------------------ |
| agent-loop         | parent  | 시스템 프롬프트를 소비하는 메인 루프 |
| token-counter      | sibling | 토큰 예산 계산에 사용                |
| model-capabilities | sibling | 모델 능력 티어로 예산 결정           |
| context-manager    | sibling | 프롬프트 빌드 시 호출                |
| config-loader      | child   | 프로젝트 설정 경로 제공              |

---

### 2. checkpoint-manager

| 항목           | 내용                                                                              |
| -------------- | --------------------------------------------------------------------------------- |
| **파일**       | `src/core/checkpoint-manager.ts` (약 377줄)                                       |
| **레이어**     | Layer 2: Core                                                                     |
| **한 줄 설명** | 파일 변경 전 자동 상태 스냅샷 — SHA-256 해시 기반 변경 감지 + /undo, /rewind 지원 |
| **복잡도**     | ★★★☆☆ (중간)                                                                      |

#### 문서화할 Export 목록

**클래스 (1개)**
| 이름 | 용도 |
|------|------|
| `CheckpointManager` | 체크포인트 생성, 조회, 복원, diff 수행 |

**에러 클래스 (1개)**
| 이름 | 용도 |
|------|------|
| `CheckpointError` | 체크포인트 관련 에러 (BaseError 확장) |

**인터페이스 (3개)**
| 이름 | 용도 |
|------|------|
| `FileSnapshot` | 단일 파일 스냅샷 (relativePath, contentHash, size, exists) |
| `Checkpoint` | 체크포인트 메타데이터 (id, sessionId, createdAt, description, messageIndex, files[]) |
| `CreateCheckpointOptions` | 생성 옵션 (sessionId, description, messageIndex, workingDirectory, trackedFiles) |
| `RestoreResult` | 복원 결과 (restoredFiles, skippedFiles, checkpoint) |

**메서드 (5개)**
| 이름 | 시그니처 | 용도 |
|------|---------|------|
| `constructor` | `(sessionDir: string)` | 세션 디렉토리 기반 초기화 |
| `createCheckpoint` | `(options) → Promise<Checkpoint>` | 파일 스냅샷 생성 |
| `listCheckpoints` | `() → Promise<readonly Checkpoint[]>` | 전체 체크포인트 목록 |
| `getCheckpoint` | `(id) → Promise<Checkpoint>` | ID로 단일 체크포인트 조회 |
| `restoreCheckpoint` | `(id, workDir) → Promise<RestoreResult>` | 체크포인트 시점으로 파일 복원 |
| `diffFromCheckpoint` | `(id, workDir) → Promise<DiffResult[]>` | 현재와 체크포인트 비교 |

#### 의존성 관계

```
Import 하는 모듈:
  ← node:fs/promises (mkdir, readFile, writeFile, readdir, stat, copyFile)
  ← node:crypto (createHash — SHA-256)
  ← utils/error (BaseError)

Import 되는 곳:
  → commands/rewind.ts (/rewind, /undo 명령)
  → cli/hooks/useAgentLoop.ts (파일 수정 전 자동 스냅샷)
  → core/agent-loop.ts (도구 실행 중 자동 체크포인트)
```

#### Mermaid 다이어그램 계획

1. **아키텍처 위치** — Agent Loop → Checkpoint Manager → File System
2. **체크포인트 라이프사이클** — Create → List → Diff → Restore (stateDiagram)
3. **디렉토리 구조** — checkpoints/ 내부 cp-001.json + cp-001/ 폴더 구조

#### 핵심 알고리즘 설명 포인트

1. **SHA-256 해시 비교**: 파일 내용 변경 감지 (바이트 단위 정확)
2. **안전한 파일명 변환**: `/` → `__` (src/index.ts → src\_\_index.ts)
3. **증분 ID**: cp-001, cp-002... 순차적 3자리 패딩
4. **복원 시 부분 실패 허용**: restoredFiles + skippedFiles 분리

#### Pitfall 후보

- "체크포인트는 파일 내용만 저장합니다. 디렉토리 구조나 빈 디렉토리는 복원되지 않습니다."
- "trackedFiles에 명시적으로 포함된 파일만 스냅샷됩니다. 프로젝트 전체를 자동 추적하지 않습니다."
- "restoreCheckpoint()는 현재 파일을 덮어씁니다. 복원 전 현재 상태의 체크포인트를 먼저 만드세요."

#### 트러블슈팅 후보

| 문제                                             | 원인                                   | 해결                                  |
| ------------------------------------------------ | -------------------------------------- | ------------------------------------- |
| "/undo가 동작하지 않아요"                        | 해당 세션에 체크포인트가 없음          | 파일 수정 도구 실행 시 자동 생성 확인 |
| "복원 후 일부 파일이 누락돼요"                   | trackedFiles 목록에 포함되지 않은 파일 | agent-loop의 자동 추적 파일 목록 확인 |
| "diffFromCheckpoint가 모두 'unchanged'로 나와요" | 같은 내용으로 덮어쓴 경우 (해시 동일)  | 실제 diff 도구로 이중 확인            |

#### SeeAlso 계획

| 모듈              | 관계    | 설명                              |
| ----------------- | ------- | --------------------------------- |
| agent-loop        | parent  | 도구 실행 전 자동 체크포인트 생성 |
| recovery-executor | sibling | 에러 복구 시 체크포인트 활용 가능 |
| context-manager   | sibling | 같은 Core 레이어                  |

---

### 3. observation-masking

| 항목           | 내용                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| **파일**       | `src/core/observation-masking.ts` (약 256줄)                                             |
| **레이어**     | Layer 2: Core                                                                            |
| **한 줄 설명** | 재생성 가능한 도구 출력 마스킹 — 읽기 전용 도구 결과를 플레이스홀더로 대체하여 토큰 절약 |
| **복잡도**     | ★★☆☆☆ (낮음 — 순수 함수형, 상태 없음)                                                    |

#### 문서화할 Export 목록

**함수 (3개)**
| 이름 | 시그니처 | 용도 |
|------|---------|------|
| `isReadOnlyToolOutput` | `(message: ChatMessage) → boolean` | 메시지가 안전하게 마스킹 가능한지 판단 |
| `getOutputSize` | `(message: ChatMessage) → number` | 토큰 수 추정 (chars / 4) |
| `applyObservationMasking` | `(messages, options?) → ChatMessage[]` | 읽기 전용 도구 출력을 플레이스홀더로 대체 |

#### 의존성 관계

```
Import 하는 모듈:
  ← llm/provider (ChatMessage 타입만)

Import 되는 곳:
  → core/agent-loop.ts (컨텍스트 압축 전 마스킹 적용, keepRecentN=5)
```

#### 핵심 알고리즘 설명 포인트

1. **읽기 전용 판별**: file_read, grep_search, glob_search는 항상 안전 / bash_exec는 패턴 매칭 필요
2. **Mutation 감지**: rm, mv, cp, mkdir, git commit/push 등 13개 변경 패턴 → 마스킹 불가
3. **최근 보호**: keepRecentN (기본 3개)개의 최근 읽기 전용 출력은 마스킹하지 않음
4. **플레이스홀더**: `[Observation masked — {toolName} output ({size} tokens). Re-read if needed.]`

#### Mermaid 다이어그램 계획

1. **아키텍처 위치** — Agent Loop → Observation Masking → Context Manager
2. **판별 플로우차트** — role=tool? → tool 이름? → read-only? → 최근 N개? → 마스킹/유지
3. **패턴 분류 다이어그램** — Read-only vs Mutation 패턴 목록

#### Pitfall 후보

- "bash_exec 출력은 명령어 내용에 따라 마스킹 여부가 달라집니다. `cat file.txt`는 마스킹되지만 `npm install`은 마스킹되지 않습니다."
- "keepRecentN을 0으로 설정하면 모든 읽기 전용 출력이 마스킹됩니다. LLM이 최근 읽은 파일 내용을 잃을 수 있습니다."

#### 트러블슈팅 후보

| 문제                                        | 원인                                        | 해결                                       |
| ------------------------------------------- | ------------------------------------------- | ------------------------------------------ |
| "마스킹 후 LLM이 파일 내용을 모른다고 해요" | keepRecentN보다 오래된 file_read가 마스킹됨 | keepRecentN 값 증가 또는 파일 재읽기 유도  |
| "bash 출력이 마스킹되지 않아요"             | MUTATION_BASH_PATTERNS에 해당하는 명령어    | 의도된 동작 — 변경 명령어 결과는 보존 필수 |

#### SeeAlso 계획

| 모듈            | 관계    | 설명                            |
| --------------- | ------- | ------------------------------- |
| agent-loop      | parent  | 마스킹 적용 후 LLM에 전달       |
| context-manager | sibling | 마스킹은 압축 전 토큰 절약 단계 |
| token-counter   | child   | 토큰 수 추정에 간접 관련        |

---

## Layer 3: Infrastructure

### 4. llm-client

| 항목           | 내용                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| **파일**       | `src/llm/client.ts` (대규모)                                                          |
| **레이어**     | Layer 3: Infrastructure                                                               |
| **한 줄 설명** | OpenAI 호환 LLM API 클라이언트 — 스트리밍, 자동 재시도, Responses API 분기, 에러 분류 |
| **복잡도**     | ★★★★★ (높음 — 가장 많은 외부 API 연동)                                                |

#### 문서화할 Export 목록

**인터페이스 (1개)**
| 이름 | 용도 |
|------|------|
| `OpenAIClientConfig` | 클라이언트 설정 (baseURL, apiKey?, timeout?) |

**클래스 (1개)**
| 이름 | implements | 용도 |
|------|-----------|------|
| `OpenAICompatibleClient` | `LLMProvider` | OpenAI/Azure/Ollama/vLLM 등 호환 클라이언트 |

**메서드 (3개)**
| 이름 | 시그니처 | 용도 |
|------|---------|------|
| `chat` | `(request: ChatRequest) → Promise<ChatResponse>` | 동기 채팅 (자동 재시도 포함) |
| `stream` | `(request: ChatRequest) → AsyncIterable<ChatChunk>` | 스트리밍 응답 (자동 재시도 포함) |
| `countTokens` | `(text: string) → number` | 토큰 수 계산 |

#### 핵심 상수

| 이름                       | 값        | 용도                         |
| -------------------------- | --------- | ---------------------------- |
| `MAX_RETRIES_TRANSIENT`    | 3         | 500/502/503 에러 재시도 횟수 |
| `MAX_RETRIES_RATE_LIMIT`   | 0         | 429 에러는 재시도 안 함      |
| `BASE_RETRY_DELAY_MS`      | 1,000ms   | 기본 재시도 대기 시간        |
| `BASE_RATE_LIMIT_DELAY_MS` | 5,000ms   | 레이트 리밋 대기 시간        |
| `MAX_RATE_LIMIT_DELAY_MS`  | 60,000ms  | 최대 대기 시간               |
| 기본 timeout               | 120,000ms | 요청 타임아웃                |

#### 의존성 관계

```
Import 하는 모듈:
  ← openai (OpenAI SDK)
  ← llm/provider (LLMProvider, ChatRequest, ChatResponse 등)
  ← llm/token-counter (토큰 계산)
  ← llm/model-capabilities (모델 능력 감지)
  ← utils/error (BaseError, LLMError)

Import 되는 곳:
  → llm/client-factory.ts (클라이언트 생성 팩토리)
  → llm/model-router.ts (모델 라우터)
  → cli/hooks/useAgentLoop.ts (훅에서 직접 참조)
```

#### Mermaid 다이어그램 계획

1. **아키텍처 위치** — Agent Loop → LLM Client → OpenAI API / Azure / Ollama
2. **요청 흐름** — chat() → \_chatOnce() → Responses API 분기 → 결과 변환 (sequenceDiagram)
3. **에러 분류 트리** — Auth / Permission / RateLimit / Timeout / Connection → LLMError
4. **재시도 로직** — Transient(3회) vs RateLimit(0회) + 지수 백오프

#### 핵심 알고리즘 설명 포인트

1. **Responses API 분기**: Codex 모델 → OpenAI Responses API 사용 (별도 input/tool 포맷)
2. **지수 백오프 재시도**: delay = BASE \* 2^attempt (최대 60초)
3. **스트리밍 도구 호출 누적**: Map<index, toolCall>로 청크별 누적 후 완성
4. **에러 분류**: OpenAI SDK 에러 → 사용자 친화적 LLMError 변환
5. **Azure 호환**: baseURL 정규화 + API 버전 자동 추가

#### Pitfall 후보

- "429 Rate Limit 에러는 클라이언트에서 재시도하지 않습니다. 서버 측 제한이므로 요청 빈도를 줄이세요."
- "Azure OpenAI를 사용할 때는 baseURL에 `/openai/deployments/` 경로가 포함되어야 합니다."
- "stream()의 반환값은 AsyncIterable입니다. `for await...of`로 소비해야 합니다."

#### 트러블슈팅 후보

| 문제                             | 원인                            | 해결                                  |
| -------------------------------- | ------------------------------- | ------------------------------------- |
| "AuthenticationError가 발생해요" | API 키 누락 또는 만료           | 환경변수 또는 config의 apiKey 확인    |
| "타임아웃이 자주 발생해요"       | 큰 프롬프트 + 느린 네트워크     | timeout 값 증가, 프롬프트 크기 줄이기 |
| "Codex 모델이 동작하지 않아요"   | Responses API 포맷 불일치       | isResponsesApiModel() 감지 확인       |
| "스트리밍 중 도구 호출이 잘려요" | 네트워크 중단으로 불완전한 청크 | 자동 재시도로 복구됨                  |

#### SeeAlso 계획

| 모듈               | 관계    | 설명                                |
| ------------------ | ------- | ----------------------------------- |
| agent-loop         | parent  | LLM 클라이언트를 호출하는 메인 루프 |
| dual-model-router  | sibling | 모델별 클라이언트 선택              |
| model-capabilities | child   | 모델 능력 확인하여 파라미터 분기    |
| token-counter      | child   | 토큰 계산 위임                      |

---

### 5. dual-model-router

| 항목           | 내용                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| **파일**       | `src/llm/dual-model-router.ts` (소규모)                                                                  |
| **레이어**     | Layer 3: Infrastructure                                                                                  |
| **한 줄 설명** | Architect/Editor 모델 자동 전환 라우터 — 작업 페이즈(plan/execute/review)에 따라 고성능/저비용 모델 분기 |
| **복잡도**     | ★★☆☆☆ (낮음 — 간결한 라우팅 로직)                                                                        |

#### 문서화할 Export 목록

**인터페이스/타입 (2개)**
| 이름 | 용도 |
|------|------|
| `DualModelConfig` | 라우터 설정 (architectModel, editorModel, routingStrategy) |
| `TaskPhase` | `"plan" \| "execute" \| "review"` |

**클래스 (1개)**
| 이름 | 용도 |
|------|------|
| `DualModelRouter` | 페이즈 기반 모델/클라이언트 라우팅 |

**함수 (1개)**
| 이름 | 시그니처 | 용도 |
|------|---------|------|
| `detectPhase` | `(messages) → TaskPhase` | 메시지 키워드 분석으로 페이즈 자동 감지 |

#### 핵심 상수

```
PLAN_KEYWORDS (영어 + 한국어):
  "plan", "review", "architecture", "design", "analyze", "strategy",
  "approach", "proposal", "RFC", "설계", "분석", "리뷰"
```

#### 의존성 관계

```
Import 하는 모듈:
  ← llm/provider (LLMProvider 인터페이스)

Import 되는 곳:
  → core/agent-loop.ts (에이전트 루프에서 모델 선택)
```

#### Mermaid 다이어그램 계획

1. **아키텍처 위치** — Agent Loop → Dual Model Router → Architect Client / Editor Client
2. **라우팅 플로우** — User Message → detectPhase() → plan/review → Architect / execute → Editor
3. **키워드 매칭 다이어그램** — 메시지 스캔 → 키워드 발견? → phase 결정

#### 핵심 알고리즘 설명 포인트

1. **키워드 기반 감지**: 마지막 사용자 메시지에서 PLAN_KEYWORDS 포함 여부 확인
2. **역방향 스캔**: messages 배열을 뒤에서부터 탐색하여 가장 최근 사용자 메시지 선택
3. **기본값**: 사용자 메시지 없으면 "execute" (가장 빈번한 작업)
4. **Architect vs Editor**: plan/review → 고성능(Opus), execute → 비용 효율(Sonnet)

#### Pitfall 후보

- "detectPhase()는 키워드 기반이므로, '분석'이라는 단어가 포함된 코딩 요청도 plan 페이즈로 분류될 수 있습니다."
- "기본 페이즈는 'execute'입니다. setPhase()로 수동 전환하지 않으면 항상 Editor 모델이 사용됩니다."

#### 트러블슈팅 후보

| 문제                        | 원인                             | 해결                              |
| --------------------------- | -------------------------------- | --------------------------------- |
| "비싼 모델이 계속 사용돼요" | 메시지에 plan 키워드가 반복 포함 | setPhase("execute")로 수동 전환   |
| "코드 품질이 낮아졌어요"    | Editor 모델의 능력 한계          | routingStrategy를 "manual"로 변경 |

#### SeeAlso 계획

| 모듈               | 관계    | 설명                     |
| ------------------ | ------- | ------------------------ |
| agent-loop         | parent  | 라우터로 모델 선택       |
| llm-client         | sibling | 선택된 모델의 클라이언트 |
| model-capabilities | sibling | 모델별 능력 정보         |

---

### 6. tool-executor

| 항목           | 내용                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------- |
| **파일**       | `src/tools/executor.ts` (대규모)                                                            |
| **레이어**     | Layer 3: Infrastructure                                                                     |
| **한 줄 설명** | 도구 실행 파이프라인 — Zod 검증, 인자 자동 교정, 타임아웃, 재시도, 백그라운드 프로세스 관리 |
| **복잡도**     | ★★★★☆ (높음)                                                                                |

#### 문서화할 Export 목록

**인터페이스 (2개)**
| 이름 | 용도 |
|------|------|
| `BackgroundProcessStatus` | 백그라운드 프로세스 상태 (pid, processId, command, running, exitCode, outputFile) |
| `BackgroundProcessInfo` | 프로세스 요약 정보 |

**클래스 (1개)**
| 이름 | 용도 |
|------|------|
| `BackgroundProcessManager` | 장시간 실행 프로세스 관리 (start, getOutput, kill, list) |

**함수 (2개)**
| 이름 | 시그니처 | 용도 |
|------|---------|------|
| `executeTool` | `(tool, args, options?) → Promise<ToolResult>` | 단일 도구 실행 (검증+타임아웃+재시도) |
| `executeToolCall` | `(registry, call, options?) → Promise<ToolCallResult>` | 레지스트리에서 도구 찾아 실행 |

**BackgroundProcessManager 메서드**
| 이름 | 시그니처 | 용도 |
|------|---------|------|
| `start` | `(command, cwd) → {pid, processId, outputFile}` | 프로세스 시작 |
| `getStatus` | `(idOrPid) → BackgroundProcessStatus?` | 상태 조회 |
| `getOutput` | `(idOrPid) → string` | 전체 출력 |
| `getIncrementalOutput` | `(idOrPid) → {output, running, exitCode}` | 증분 출력 (마지막 읽기 이후) |
| `kill` | `(idOrPid, signal?) → boolean` | 프로세스 종료 |
| `list` | `() → BackgroundProcessInfo[]` | 전체 프로세스 목록 |
| `cleanup` | `() → void` | 모든 프로세스 종료 |

#### 핵심 상수

| 이름                | 값                                                 | 용도                    |
| ------------------- | -------------------------------------------------- | ----------------------- |
| `MAX_TOOL_RETRIES`  | 1                                                  | 일시적 에러 재시도 횟수 |
| Transient 에러 코드 | ECONNRESET, ETIMEDOUT, ENOTFOUND, EPIPE, EAI_AGAIN | 재시도 대상 에러        |

#### 의존성 관계

```
Import 하는 모듈:
  ← tools/types (ToolDefinition, ToolResult, ToolContext)
  ← tools/registry (ToolRegistry)
  ← tools/validation (parseToolArguments — Zod)
  ← tools/tool-call-corrector (correctToolCall)
  ← llm/model-capabilities (CapabilityTier)
  ← utils/platform, utils/events
  ← constants (TOOL_TIMEOUTS)

Import 되는 곳:
  → core/agent-loop.ts (도구 실행)
  → tools/definitions/bash-exec.ts (bash 실행 도구)
```

#### Mermaid 다이어그램 계획

1. **실행 파이프라인** — 인자 교정 → Zod 검증 → 실행 → 재시도 (flowchart)
2. **AbortController 체인** — 부모 signal → 자식 controller → 타임아웃
3. **BackgroundProcessManager** — start → stdout/stderr → logfile → incremental read (sequenceDiagram)

#### 핵심 알고리즘 설명 포인트

1. **인자 자동 교정**: 저성능 모델이 잘못된 타입/경로를 보내면 자동 수정
2. **AbortSignal 체이닝**: 부모 signal → 현재 controller → 타임아웃 3중 체인
3. **증분 출력 읽기**: 파일 offset 기반 — openSync + readSync로 새 바이트만 읽기
4. **프로세스 그룹 종료**: `-pid`로 자식 프로세스까지 일괄 종료

#### Pitfall 후보

- "executeTool()의 타임아웃은 도구별로 다릅니다. TOOL_TIMEOUTS 상수에서 확인하세요."
- "BackgroundProcessManager의 start()는 detached 모드로 실행합니다. 부모 프로세스 종료 후에도 계속 실행될 수 있습니다."
- "getIncrementalOutput()은 마지막 호출 이후의 출력만 반환합니다. 전체 출력이 필요하면 getOutput()을 사용하세요."

#### 트러블슈팅 후보

| 문제                                    | 원인                           | 해결                                              |
| --------------------------------------- | ------------------------------ | ------------------------------------------------- |
| "도구가 타임아웃으로 실패해요"          | 실행 시간이 TOOL_TIMEOUTS 초과 | timeout 설정 확인, 장시간 작업은 백그라운드 실행  |
| "Zod 검증 에러가 발생해요"              | LLM이 잘못된 타입의 인자 전달  | tool-call-corrector가 자동 수정 시도, 스키마 확인 |
| "백그라운드 프로세스가 종료되지 않아요" | 자식 프로세스가 signal 무시    | kill()에 SIGKILL 전달                             |

#### SeeAlso 계획

| 모듈               | 관계    | 설명              |
| ------------------ | ------- | ----------------- |
| agent-loop         | parent  | 도구 실행 요청    |
| tool-registry      | sibling | 도구 정의 조회    |
| permission-manager | sibling | 실행 전 권한 확인 |

---

### 7. mcp-manager

| 항목           | 내용                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------- |
| **파일**       | `src/mcp/manager.ts`                                                                        |
| **레이어**     | Layer 3: Infrastructure                                                                     |
| **한 줄 설명** | MCP 서버 수명주기 관리 — 3-Scope 설정(local>project>user), 병렬 연결, 도구 브리지 자동 등록 |
| **복잡도**     | ★★★☆☆ (중간)                                                                                |

#### 문서화할 Export 목록

**인터페이스 (2개)**
| 이름 | 용도 |
|------|------|
| `MCPManagerConfig` | 매니저 설정 (configPath?, workingDirectory?, toolRegistry) |
| `ConnectAllResult` | 연결 결과 (connected[], failed[]) |

**클래스 (2개)**
| 이름 | 용도 |
|------|------|
| `MCPManager` | MCP 서버 연결/해제/도구 등록 관리 |
| `MCPManagerError` | MCP 관련 에러 (BaseError 확장) |

**주요 메서드**
| 이름 | 시그니처 | 용도 |
|------|---------|------|
| `loadConfig` | `() → Promise<Record<string, MCPServerConfig>>` | mcp.json 로드 |
| `loadScopedConfigs` | `() → Promise<Record<string, MCPServerConfig>>` | 3-Scope 우선순위 적용 로드 |
| `connectAll` | `() → Promise<ConnectAllResult>` | 모든 서버 병렬 연결 |
| `connectServer` | `(name, config) → Promise<string[]>` | 단일 서버 연결 + 도구 등록 |
| `disconnectAll` | `() → Promise<void>` | 모든 서버 해제 |
| `getRegisteredTools` | `() → ReadonlyMap<string, readonly string[]>` | 서버→도구 매핑 조회 |
| `getConnectedServers` | `() → readonly string[]` | 연결된 서버 목록 |

#### 의존성 관계

```
Import 하는 모듈:
  ← mcp/client (MCPClient)
  ← mcp/scope-manager (MCPScopeManager)
  ← mcp/tool-bridge (MCPToolBridge)
  ← mcp/types (MCPServerConfig)
  ← tools/registry (ToolRegistry)
  ← utils/error (BaseError)

Import 되는 곳:
  → commands/registry.ts
  → cli/hooks/useAgentLoop.ts
  → cli/App.tsx
  → src/index.ts
  → commands/mcp.ts
```

#### Mermaid 다이어그램 계획

1. **아키텍처 위치** — App → MCPManager → MCPClient(s) → External MCP Servers
2. **3-Scope 설정** — User(~/.dhelix) < Project(.dhelix/) < Local (우선순위) (flowchart)
3. **연결 시퀀스** — loadScopedConfigs → connectAll (Promise.allSettled) → bridge.registerTools

#### 핵심 알고리즘 설명 포인트

1. **3-Scope 우선순위**: local > project > user (같은 이름의 서버는 상위 스코프가 덮어씀)
2. **병렬 연결**: Promise.allSettled → 부분 실패 허용 (일부 서버 실패해도 나머지 연결)
3. **도구 브리지**: MCP 서버의 도구를 dhelix의 ToolRegistry에 자동 등록
4. **재연결**: connectServer()에서 기존 연결이 있으면 disconnect 후 재연결

#### Pitfall 후보

- "connectAll()은 Promise.allSettled를 사용합니다. 일부 서버 연결 실패가 전체를 중단하지 않습니다."
- "같은 이름의 MCP 서버가 여러 스코프에 정의되면, local > project > user 순으로 덮어씁니다."
- "workingDirectory를 제공하지 않으면 스코프 매니저가 비활성화되어 글로벌 설정만 로드됩니다."

#### 트러블슈팅 후보

| 문제                       | 원인                          | 해결                                          |
| -------------------------- | ----------------------------- | --------------------------------------------- |
| "MCP 서버 연결이 실패해요" | 서버 프로세스가 시작되지 않음 | command/args 경로 확인, 서버 단독 실행 테스트 |
| "MCP 도구가 목록에 없어요" | bridge.registerTools() 실패   | getRegisteredTools()로 등록 상태 확인         |
| "mcp.json 파싱 에러"       | JSON 문법 오류                | 에러 메시지의 path 확인 후 JSON 검증          |

#### SeeAlso 계획

| 모듈          | 관계    | 설명                          |
| ------------- | ------- | ----------------------------- |
| tool-registry | sibling | MCP 도구를 등록하는 대상      |
| config-loader | child   | 설정 경로 체계 참고           |
| agent-loop    | parent  | MCP 도구를 사용하는 메인 루프 |

---

## Layer 4: Leaf

### 8. skill-manager

| 항목           | 내용                                                                               |
| -------------- | ---------------------------------------------------------------------------------- |
| **파일**       | `src/skills/manager.ts`                                                            |
| **레이어**     | Layer 4: Leaf                                                                      |
| **한 줄 설명** | 4개 디렉토리에서 스킬 로딩 — 우선순위 병합 + 시스템 프롬프트 섹션 생성 + 실행 위임 |
| **복잡도**     | ★★★☆☆ (중간)                                                                       |

#### 문서화할 Export 목록

**클래스 (1개)**
| 이름 | 용도 |
|------|------|
| `SkillManager` | 스킬 로딩, 조회, 실행, 프롬프트 생성 |

**주요 메서드**
| 이름 | 시그니처 | 용도 |
|------|---------|------|
| `loadAll` | `(workingDirectory: string) → Promise<void>` | 4개 디렉토리에서 스킬 로딩 |
| `getAll` | `() → readonly SkillDefinition[]` | 전체 스킬 목록 |
| `get` | `(name: string) → SkillDefinition?` | 이름으로 스킬 조회 |
| `has` | `(name: string) → boolean` | 스킬 존재 여부 |
| `getUserInvocable` | `() → readonly SkillDefinition[]` | 사용자 호출 가능 스킬 |
| `getModelVisible` | `() → readonly SkillDefinition[]` | 모델에 노출되는 스킬 |
| `execute` | `(name, args, options) → Promise<SkillExecutionResult?>` | 스킬 실행 |
| `buildPromptSection` | `() → string?` | 시스템 프롬프트에 포함할 스킬 섹션 |

#### 스킬 로딩 디렉토리 (우선순위 낮→높)

```
1. ~/.dhelix/skills/       (글로벌 스킬)
2. ~/.dhelix/commands/     (글로벌 명령)
3. {cwd}/.dhelix/skills/   (프로젝트 스킬)
4. {cwd}/.dhelix/commands/ (프로젝트 명령 — 최고 우선순위)
```

#### 의존성 관계

```
Import 하는 모듈:
  ← skills/loader (loadSkillsFromDirectory)
  ← skills/executor (executeSkill)
  ← skills/types (SkillDefinition, SkillContext, SkillExecutionResult)
  ← constants (APP_NAME)

Import 되는 곳:
  → cli/App.tsx (인스턴스 생성)
  → cli/hooks/useAgentLoop.ts (buildPromptSection, execute)
```

#### Mermaid 다이어그램 계획

1. **아키텍처 위치** — App → SkillManager → skills/loader, skills/executor
2. **4-Directory 로딩** — global/skills → global/commands → project/skills → project/commands (우선순위)
3. **실행 플로우** — name lookup → args parsing → context build → executeSkill()

#### Pitfall 후보

- "같은 이름의 스킬이 여러 디렉토리에 있으면, 프로젝트 commands가 항상 이깁니다."
- "execute()는 스킬이 없으면 null을 반환합니다. 에러를 던지지 않습니다."

#### SeeAlso 계획

| 모듈                  | 관계    | 설명                                      |
| --------------------- | ------- | ----------------------------------------- |
| config-loader         | sibling | 같은 Leaf 레이어, 유사한 계층적 로딩 패턴 |
| instruction-loader    | sibling | 유사한 다중 경로 로딩                     |
| system-prompt-builder | parent  | 스킬 섹션을 프롬프트에 포함               |

---

### 9. instruction-loader

| 항목           | 내용                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- |
| **파일**       | `src/instructions/loader.ts`                                                                  |
| **레이어**     | Layer 4: Leaf                                                                                 |
| **한 줄 설명** | 6단계 DHELIX.md 로딩 체인 — global → rules → parents → project → path-rules → local 계층 병합 |
| **복잡도**     | ★★★★☆ (높음 — 6단계 계층 + 패턴 매칭 + @import 처리)                                          |

#### 문서화할 Export 목록

**에러 클래스 (1개)**
| 이름 | 용도 |
|------|------|
| `InstructionLoadError` | 인스트럭션 로딩 에러 (BaseError 확장) |

**인터페이스 (2개)**
| 이름 | 용도 |
|------|------|
| `LoadedInstructions` | 로딩 결과 (6개 레이어 개별 + combined) |
| `LoadInstructionsOptions` | 옵션 (excludePatterns?) |

**함수 (1개)**
| 이름 | 시그니처 | 용도 |
|------|---------|------|
| `loadInstructions` | `(workingDirectory, options?) → Promise<LoadedInstructions>` | 6단계 인스트럭션 로딩 |

**클래스 (1개)**
| 이름 | 용도 |
|------|------|
| `LazyInstructionLoader` | 파일별 온디맨드 인스트럭션 로딩 (캐시 포함) |

#### 6단계 로딩 계층

```
우선순위 (낮→높):
1. ~/.dhelix/DHELIX.md              (글로벌 인스트럭션)
2. ~/.dhelix/rules/*.md             (글로벌 규칙 — 경로 조건부)
3. 부모 디렉토리의 DHELIX.md        (모노레포 지원)
4. {projectRoot}/DHELIX.md          (프로젝트 인스트럭션)
5. {projectRoot}/.dhelix/rules/*.md (프로젝트 규칙 — 경로 조건부)
6. DHELIX.local.md                  (개인 오버라이드, gitignore 대상)

결합: '\n\n---\n\n' 구분자로 병합
```

#### 의존성 관계

```
Import 하는 모듈:
  ← instructions/parser (parseInstructions — @import 처리)
  ← instructions/path-matcher (PathRule, collectMatchingContent, matchPath)
  ← constants (PROJECT_CONFIG_FILE, APP_NAME)
  ← utils/error (BaseError)

Import 되는 곳:
  → cli/hooks/useAgentLoop.ts (마운트 시 프로젝트 인스트럭션 로딩)
```

#### Mermaid 다이어그램 계획

1. **6-Layer 계층 다이어그램** — Global → Rules → Parent → Project → Path Rules → Local (flowchart)
2. **프로젝트 루트 탐색** — cwd → 상위 디렉토리 순회 → DHELIX.md 발견 (flowchart)
3. **Path Rule 매칭** — frontmatter patterns → matchPath() → 현재 경로에 해당하는 규칙만 포함

#### 핵심 알고리즘 설명 포인트

1. **프로젝트 루트 탐색**: cwd부터 위로 순회하며 DHELIX.md 또는 .dhelix/ 디렉토리 탐색
2. **Frontmatter 패턴**: rules/\*.md의 `paths:` 필드로 적용 경로 조건 지정
3. **@import 지시어**: parseInstructions()에서 외부 파일 인라인 포함
4. **LazyInstructionLoader**: 파일별 온디맨드 로딩 + 디렉토리별 캐시

#### Pitfall 후보

- "DHELIX.local.md는 gitignore에 추가해야 합니다. 개인 설정이 팀원에게 공유되면 안 됩니다."
- "rules/\*.md의 paths 패턴이 현재 작업 디렉토리와 일치하지 않으면 해당 규칙은 무시됩니다."
- "모노레포에서 부모 DHELIX.md가 있으면 자동으로 포함됩니다. 의도치 않은 상속에 주의하세요."

#### 트러블슈팅 후보

| 문제                                      | 원인                    | 해결                                            |
| ----------------------------------------- | ----------------------- | ----------------------------------------------- |
| "DHELIX.md 내용이 프롬프트에 안 나와요"   | 프로젝트 루트 탐지 실패 | findProjectRoot()가 올바른 경로 반환하는지 확인 |
| "규칙 파일이 적용되지 않아요"             | paths 패턴 불일치       | frontmatter의 `paths:` 필드와 cwd 확인          |
| "LazyInstructionLoader 캐시가 오래됐어요" | 캐시 무효화 안 됨       | invalidate(dirPath) 또는 clearCache() 호출      |

#### SeeAlso 계획

| 모듈                  | 관계    | 설명                                |
| --------------------- | ------- | ----------------------------------- |
| config-loader         | sibling | 유사한 계층적 설정 로딩 패턴        |
| skill-manager         | sibling | 같은 Leaf 레이어, 다중 경로 로딩    |
| system-prompt-builder | parent  | 로딩된 인스트럭션을 프롬프트에 포함 |

---

## Layer 1: CLI

### 10. use-agent-loop

| 항목           | 내용                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| **파일**       | `src/cli/hooks/useAgentLoop.ts` (대규모)                                                                  |
| **레이어**     | Layer 1: CLI                                                                                              |
| **한 줄 설명** | Agent Loop ↔ React 상태 연결 핵심 브릿지 — 사용자 입력 → LLM → 도구 실행 → 대화 저장 전체 오케스트레이션 |
| **복잡도**     | ★★★★★ (최고 — 가장 많은 상태 변수와 이벤트 핸들링)                                                        |

#### 문서화할 Export 목록

**인터페이스 (1개)**
| 이름 | 용도 |
|------|------|
| `UseAgentLoopOptions` | 훅 설정 (client, model, toolRegistry, strategy, commandRegistry?, contextManager?, hookRunner?, sessionManager?, skillManager?, checkPermission, mcpConnector?, thinkingEnabled? 등) |

**함수 (1개)**
| 이름 | 시그니처 | 용도 |
|------|---------|------|
| `useAgentLoop` | `(options: UseAgentLoopOptions) → AgentLoopState` | React 훅 — 에이전트 루프 전체 생명주기 관리 |

#### 반환값 (AgentLoopState)

| 프로퍼티                                     | 타입                                                                           | 용도                                |
| -------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------- |
| `isProcessing`                               | boolean                                                                        | 에이전트 루프 실행 중 여부          |
| `streamingText`                              | string                                                                         | 누적된 LLM 응답 텍스트              |
| `isStreamingFinal`                           | boolean                                                                        | 최종 응답 스트리밍 중 (스피너 숨김) |
| `agentPhase`                                 | "idle" \| "llm-thinking" \| "llm-streaming" \| "tools-running" \| "tools-done" | 현재 단계                           |
| `completedTurns`                             | TurnActivity[]                                                                 | 완료된 대화 턴                      |
| `currentTurn`                                | TurnActivity?                                                                  | 진행 중인 턴                        |
| `liveTurn`                                   | TurnActivity?                                                                  | 라이브 턴                           |
| `handleSubmit`                               | (input: string) → Promise<void>                                                | 사용자 입력 처리                    |
| `error`                                      | string?                                                                        | 에러 메시지                         |
| `commandOutput`                              | string?                                                                        | 슬래시 명령 출력                    |
| `tokenCount`                                 | number                                                                         | 누적 토큰 수                        |
| `activeModel`                                | string                                                                         | 현재 활성 모델                      |
| `events`                                     | EventEmitter                                                                   | 이벤트 버스                         |
| `inputTokens` / `outputTokens` / `totalCost` | number                                                                         | 토큰 및 비용 통계                   |
| `interactiveSelect`                          | InteractiveSelect?                                                             | 인터랙티브 선택 UI 데이터           |
| `retryInfo`                                  | RetryInfo?                                                                     | 재시도 카운트다운 정보              |
| `pendingAskUser`                             | AskUserData?                                                                   | ask_user 도구 대기 상태             |
| `messageQueueRef`                            | { current: string[] }                                                          | 처리 대기 메시지 큐                 |

#### 의존성 관계 (매우 많음)

```
Import 하는 모듈 (주요):
  ← react (useState, useCallback, useMemo, useRef, useEffect)
  ← cli/hooks/useConversation (대화 관리)
  ← cli/hooks/useTextBuffering (텍스트 버퍼링)
  ← llm/provider, llm/client-factory, llm/tool-call-strategy, llm/model-capabilities
  ← core/agent-loop (runAgentLoop)
  ← core/context-manager, core/checkpoint-manager, core/session-manager
  ← core/system-prompt-builder (buildSystemPrompt)
  ← core/activity (ActivityCollector, TurnActivity)
  ← skills/manager, instructions/loader
  ← commands/registry, hooks/runner
  ← mcp/manager-connector
  ← memory/manager, telemetry/metrics

Import 되는 곳:
  → cli/App.tsx (유일한 소비자)
```

#### Mermaid 다이어그램 계획

1. **아키텍처 위치** — App.tsx → useAgentLoop → { Agent Loop, System Prompt, Context Manager, ... }
2. **handleSubmit 플로우** — 슬래시 명령 분기 → 메시지 큐 → processMessage (sequenceDiagram)
3. **이벤트 와이어링** — tool:start, tool:complete, llm:text-delta, ask_user:prompt 등 이벤트 → 상태 업데이트
4. **agentPhase 상태머신** — idle → llm-thinking → llm-streaming → tools-running → tools-done → idle

#### 핵심 알고리즘 설명 포인트

1. **메시지 큐**: 처리 중 새 입력은 큐에 저장 → 완료 후 순차 처리
2. **이벤트 기반 UI 업데이트**: runAgentLoop의 이벤트를 구독하여 React 상태 동기화
3. **AbortController**: Escape 키 → abortControllerRef.abort() → 에이전트 루프 중단
4. **토큰/비용 추적**: usage-update 이벤트에서 delta 계산 → 모델별 가격 적용
5. **세션 영속화**: 턴 완료 시 sessionManager에 대화 저장

#### Pitfall 후보

- "useAgentLoop는 App.tsx에서만 사용해야 합니다. 다른 컴포넌트에서 호출하면 상태가 중복됩니다."
- "handleSubmit()은 비동기입니다. await 없이 호출하면 에러가 무시될 수 있습니다."
- "activeModel이 변경되면 clientRef도 자동으로 새 클라이언트로 교체됩니다."

#### 트러블슈팅 후보

| 문제                                | 원인                                        | 해결                                |
| ----------------------------------- | ------------------------------------------- | ----------------------------------- |
| "Escape를 눌러도 중단되지 않아요"   | AbortController가 도구 실행에 전파되지 않음 | AbortSignal 체인 확인               |
| "토큰 비용이 0으로 표시돼요"        | 모델 가격 정보 누락                         | model-capabilities에 가격 정보 확인 |
| "메시지가 순서대로 처리되지 않아요" | 큐 처리 로직 오류                           | messageQueueRef.current 확인        |

#### SeeAlso 계획

| 모듈                  | 관계    | 설명                             |
| --------------------- | ------- | -------------------------------- |
| agent-loop            | child   | 핵심 실행 로직 위임              |
| system-prompt-builder | child   | 프롬프트 빌드 호출               |
| context-manager       | child   | 컨텍스트 관리 위임               |
| activity-feed         | sibling | 턴 데이터를 표시하는 UI 컴포넌트 |

---

### 11. activity-feed

| 항목           | 내용                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| **파일**       | `src/cli/components/ActivityFeed.tsx`                                                                     |
| **레이어**     | Layer 1: CLI                                                                                              |
| **한 줄 설명** | Progressive Static Flushing — 완료된 항목은 Static으로 전환하여 재렌더링 방지, 진행 중 항목만 동적 렌더링 |
| **복잡도**     | ★★★★☆ (높음 — Ink의 Static + WeakSet 기반 최적화)                                                         |

#### 문서화할 Export 목록

**인터페이스 (1개)**
| 이름 | 용도 |
|------|------|
| `ActivityFeedProps` | 컴포넌트 Props (completedTurns, currentTurn?, isExpanded?) |

**함수 (1개)**
| 이름 | 시그니처 | 용도 |
|------|---------|------|
| `groupConsecutiveReads` | `(entries: ActivityEntry[]) → (ActivityEntry \| ReadGroup)[]` | 연속된 file_read를 그룹화 |

**컴포넌트 (1개)**
| 이름 | 용도 |
|------|------|
| `ActivityFeed` | React.memo 컴포넌트 — 터미널 활동 피드 렌더링 |

#### 핵심 상태 변수

| 변수                    | 타입                 | 용도                                         |
| ----------------------- | -------------------- | -------------------------------------------- |
| `nextIdRef`             | { current: number }  | Static 항목의 단조 증가 ID                   |
| `flushedSetRef`         | { current: WeakSet } | 이미 Static으로 플러시된 항목 추적 (GC 친화) |
| `processedTurnCountRef` | { current: number }  | 처리 완료된 턴 수                            |
| `staticItems`           | FlushedItem[]        | Static 렌더링 항목 (추가만 가능, 삭제 불가)  |
| `liveEntries`           | ActivityEntry[]      | 진행 중 항목 (동적 렌더링)                   |

#### 의존성 관계

```
Import 하는 모듈:
  ← ink (Box, Static, Text)
  ← react (useState, useEffect, useRef, useMemo, memo)
  ← core/activity (TurnActivity, ActivityEntry 타입)
  ← cli/components/ToolCallBlock, ReadGroupBlock, StreamingMessage, ThinkingBlock

Import 되는 곳:
  → cli/App.tsx (유일한 소비자)
```

#### Mermaid 다이어그램 계획

1. **아키텍처 위치** — App.tsx → ActivityFeed → { ToolCallBlock, StreamingMessage, ThinkingBlock }
2. **Progressive Static Flushing** — completedTurns → flush to Static / currentTurn → live render (flowchart)
3. **엔트리 타입별 렌더링** — user-message, assistant-text, thinking, tool-start/complete, error

#### 핵심 알고리즘 설명 포인트

1. **Progressive Static Flushing**: 완료된 항목 → Ink `<Static>`으로 이동 → 재렌더링 제외
2. **WeakSet 중복 방지**: 객체 ID 기반 → 같은 엔트리 두 번 플러시 방지 + 자동 GC
3. **Append-Only**: staticItems 배열은 절대 줄어들지 않음 (터미널 스크롤 안정성)
4. **그룹화**: 연속된 file_read 2개 이상 → ReadGroupBlock으로 묶어서 표시

#### Pitfall 후보

- "Static에 한번 들어간 항목은 수정할 수 없습니다. Ink의 Static은 append-only입니다."
- "groupConsecutiveReads()는 최소 2개 이상의 연속 file_read가 있어야 그룹화합니다."

#### 트러블슈팅 후보

| 문제                          | 원인                    | 해결                           |
| ----------------------------- | ----------------------- | ------------------------------ |
| "같은 항목이 두 번 표시돼요"  | WeakSet이 초기화됨      | flushedSetRef 참조 안정성 확인 |
| "실시간 스트리밍이 안 보여요" | liveEntries 필터링 오류 | currentTurn 데이터 확인        |

#### SeeAlso 계획

| 모듈            | 관계           | 설명                        |
| --------------- | -------------- | --------------------------- |
| use-agent-loop  | sibling        | 턴 데이터 제공자            |
| agent-loop      | parent (간접)  | 활동 데이터의 원천          |
| circuit-breaker | sibling (간접) | 무한 루프 감지 시 활동 표시 |

---

## 작업 우선순위 및 난이도 매트릭스

### 추천 작업 순서

| 순서 | 모듈                  | 난이도 | 이유                                       |
| ---- | --------------------- | ------ | ------------------------------------------ |
| 1    | observation-masking   | ★★     | 가장 작고 독립적. 기존 문서와 유사한 패턴  |
| 2    | dual-model-router     | ★★     | 간결한 로직. 빠르게 완성 가능              |
| 3    | checkpoint-manager    | ★★★    | 중간 크기. 명확한 API                      |
| 4    | skill-manager         | ★★★    | config-loader와 유사한 패턴                |
| 5    | mcp-manager           | ★★★    | 중간 복잡도. 외부 연동 설명 필요           |
| 6    | instruction-loader    | ★★★★   | 6단계 계층 설명 필요                       |
| 7    | tool-executor         | ★★★★   | 큰 파일. BackgroundProcessManager 포함     |
| 8    | llm-client            | ★★★★★  | 가장 복잡. 외부 API 연동 + 에러 분류       |
| 9    | system-prompt-builder | ★★★★★  | 가장 큰 파일. 수많은 내부 함수             |
| 10   | activity-feed         | ★★★★   | Ink 특화 패턴. Progressive Static Flushing |
| 11   | use-agent-loop        | ★★★★★  | 가장 많은 의존성. 전체 오케스트레이션      |

### 작업량 예측

| 그룹                  | 모듈 수                                                                          | 예상 난이도                        |
| --------------------- | -------------------------------------------------------------------------------- | ---------------------------------- |
| 빠른 완성 (★★)        | 2개 (observation-masking, dual-model-router)                                     | 기존 문서와 구조 동일, 빠르게 완성 |
| 중간 (★★★)            | 3개 (checkpoint, skill, mcp)                                                     | 표준 문서 구조, 적당한 분량        |
| 고난이도 (★★★★~★★★★★) | 6개 (instruction, executor, client, prompt-builder, activity-feed, useAgentLoop) | 대규모 파일 또는 복잡한 알고리즘   |

### 기존 완료 문서 참고용 패턴

| 기존 문서          | 참고할 패턴                                                 |
| ------------------ | ----------------------------------------------------------- |
| agent-loop         | 대규모 모듈 문서 구조, 상태머신 다이어그램                  |
| context-manager    | 임계값/상수 설명 방식, Deep Dive 활용                       |
| circuit-breaker    | 간결한 모듈 문서, 상태 다이어그램                           |
| config-loader      | 계층적 로딩 설명 (instruction-loader, skill-manager 참고용) |
| tool-registry      | 도구 시스템 설명 (tool-executor 참고용)                     |
| permission-manager | 의사결정 트리 다이어그램                                    |

---

## 부록: 모듈 간 전체 의존성 그래프

```
Layer 1 (CLI)
├── useAgentLoop ────→ agent-loop, system-prompt-builder, context-manager,
│                      checkpoint-manager, llm-client, skill-manager,
│                      instruction-loader, mcp-manager
└── ActivityFeed ───→ core/activity (타입만)

Layer 2 (Core)
├── system-prompt-builder ──→ token-counter, model-capabilities, tool-registry
├── checkpoint-manager ─────→ utils/error (독립적)
└── observation-masking ────→ llm/provider (타입만, 가장 독립적)

Layer 3 (Infrastructure)
├── llm-client ────→ openai SDK, token-counter, model-capabilities
├── dual-model-router ──→ llm/provider (가장 독립적)
├── tool-executor ──→ tool-registry, validation, corrector, model-capabilities
└── mcp-manager ───→ mcp/client, scope-manager, tool-bridge, tool-registry

Layer 4 (Leaf)
├── skill-manager ──→ skills/loader, skills/executor
└── instruction-loader ──→ instructions/parser, path-matcher
```
