# 02 — Tools and Execution Improvement Plan

> **Status**: v2.0 — Competitive Analysis Rewrite (2026-04-04)
> **Scope**: Tool inventory audit, competitive gap analysis, execution pipeline redesign, new tool roadmap, plugin system
> **Benchmarks**: OpenCode (47 tools), Codex (40+ tools), DHelix (23 tools)

---

## Table of Contents

1. [Current Tool Inventory Analysis](#1-current-tool-inventory-analysis)
2. [Competitive Gap Matrix](#2-competitive-gap-matrix)
3. [Critical Improvements](#3-critical-improvements)
4. [New Tools Roadmap](#4-new-tools-roadmap)
5. [Tool Discovery & Plugin System](#5-tool-discovery--plugin-system)
6. [Tool Schema Evolution](#6-tool-schema-evolution)
7. [Success Metrics](#7-success-metrics)

---

## 1. Current Tool Inventory Analysis

### 1.1 Full Inventory (23 Tools Rated)

Rating scale: **A** = production-solid, **B** = functional with gaps, **C** = needs significant work, **D** = broken/stub

#### File I/O Tools (5)

| Tool         | Rating | LOC  | Strengths                                           | Weaknesses                                                |
| ------------ | ------ | ---- | --------------------------------------------------- | --------------------------------------------------------- |
| `file_read`  | **A**  | ~670 | offset/limit 지원, 이진 파일 감지, AbortSignal 연동 | 대용량 파일(>10MB) 스트리밍 없음, PDF/이미지 미지원       |
| `file_write` | **A**  | ~76  | 원자적 쓰기(rename), 디렉토리 자동 생성             | 부분 쓰기(append) 미지원, 인코딩 옵션 없음                |
| `file_edit`  | **B+** | ~145 | old_string/new_string 패턴, replace_all 지원        | 멀티 편집 미지원 (1회 호출 = 1개 변경), diff preview 없음 |
| `list_dir`   | **A**  | ~234 | depth 옵션, .gitignore 존중                         | tree 출력 형식 미지원, 파일 크기/날짜 메타데이터 없음     |
| `mkdir`      | **A**  | ~62  | recursive, 간결한 구현                              | -                                                         |

#### Shell Tools (3)

| Tool          | Rating | LOC  | Strengths                                                | Weaknesses                                                                       |
| ------------- | ------ | ---- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `bash_exec`   | **A-** | ~292 | 실시간 스트리밍, BackgroundProcessManager, detached 모드 | arity 기반 권한 분석 없음 (OpenCode는 162개 명령어 사전 보유), named task 미지원 |
| `bash_output` | **B+** | ~90  | 증분 읽기(incremental read), byte offset 추적            | 프로세스 완료 대기(await) 미지원, 구조화된 polling 없음                          |
| `kill_shell`  | **A**  | ~113 | 프로세스 그룹 시그널, SIGTERM/SIGKILL 지원               | -                                                                                |

#### Search Tools (2)

| Tool          | Rating | LOC  | Strengths                                    | Weaknesses                                        |
| ------------- | ------ | ---- | -------------------------------------------- | ------------------------------------------------- |
| `glob_search` | **A**  | ~101 | fast-glob 기반, .gitignore 존중              | 결과 카운트 제한 없음 (수천 개 결과 시 토큰 폭발) |
| `grep_search` | **A**  | ~401 | ripgrep fallback, 정규식 지원, 컨텍스트 라인 | semantic search 없음 (OpenCode CodeSearch 대비)   |

#### Code Intelligence Tools — Tier 1: tree-sitter (3)

| Tool                | Rating | LOC    | Strengths                              | Weaknesses                                        |
| ------------------- | ------ | ------ | -------------------------------------- | ------------------------------------------------- |
| `symbol_search`     | **B**  | ~398   | 7개 언어 쿼리, 퍼지 매칭               | Go/Java 쿼리 불완전, 대규모 코드베이스에서 느림   |
| `code_outline`      | **B-** | ~1,278 | 파일 구조 요약, 클래스/함수/인터페이스 | Go/Java 파싱 broken, 중첩 구조(nested class) 누락 |
| `find_dependencies` | **B**  | ~733   | import/require 분석                    | 동적 import 미감지, monorepo workspace 미지원     |

#### Code Intelligence Tools — Tier 2: LSP On-Demand (4)

| Tool              | Rating | LOC  | Strengths                           | Weaknesses                                       |
| ----------------- | ------ | ---- | ----------------------------------- | ------------------------------------------------ |
| `goto_definition` | **B+** | ~302 | 5분 idle shutdown, 위치 변환 수정됨 | 서버 cold-start 지연(~2-5초), multi-root 미지원  |
| `find_references` | **B+** | ~300 | cross-file 참조 검색                | 결과 truncation 정책 없음 (수백 개 참조 시 문제) |
| `get_type_info`   | **B**  | ~281 | hover 기반 타입 정보                | generic 타입 해석 불완전, union 타입 표시 부족   |
| `safe_rename`     | **B**  | ~410 | workspace edit 적용, 다중 파일 수정 | undo/rollback 미지원, 프리뷰(dry-run) 없음       |

#### Web Tools (2)

| Tool         | Rating | LOC  | Strengths                        | Weaknesses                                  |
| ------------ | ------ | ---- | -------------------------------- | ------------------------------------------- |
| `web_search` | **B+** | ~304 | Brave + DuckDuckGo dual provider | rate limiting 처리 미흡, 결과 캐싱 없음     |
| `web_fetch`  | **B**  | ~442 | HTML→Markdown 변환               | JavaScript 렌더링 미지원, robots.txt 미존중 |

#### Meta Tools (4)

| Tool            | Rating | LOC  | Strengths                        | Weaknesses                     |
| --------------- | ------ | ---- | -------------------------------- | ------------------------------ |
| `agent`         | **A**  | ~222 | Worktree isolation, team spawner | 서브에이전트 간 통신 채널 없음 |
| `ask_user`      | **A**  | ~105 | 간결, 목적 명확                  | -                              |
| `todo_write`    | **B+** | ~152 | todo 항목 관리                   | 우선순위/상태 필터링 없음      |
| `notebook_edit` | **B**  | ~262 | Jupyter 셀 조작                  | 실행 기능 없음, 출력 미표시    |

### 1.2 Summary Statistics

```
Total Tools:           23
Rating A/A-:          10  (43%)  — file_read, file_write, list_dir, mkdir, bash_exec(A-), kill_shell, glob_search, grep_search, agent, ask_user
Rating B+:             6  (26%)  — file_edit, bash_output, goto_definition, find_references, web_search, todo_write
Rating B/B-:           7  (30%)  — symbol_search, code_outline(B-), find_dependencies, get_type_info, safe_rename, web_fetch, notebook_edit
Rating C or below:     0  (0%)
Average:               B+
```

### 1.3 Architecture Strengths (DHelix Unique)

DHelix의 도구 시스템에는 경쟁 제품에 없는 고유한 장점이 있다:

**1. Adaptive Schema (`src/tools/adaptive-schema.ts`)**
모델 성능 등급(high/medium/low)에 따라 도구 스키마를 자동 조정한다.

- HIGH: 전체 스키마 + 모든 optional 파라미터
- MEDIUM: 핵심 파라미터만 + 설명 2문장
- LOW: 필수 파라미터만 + few-shot 예시
  OpenCode/Codex 모두 이 기능이 없다. 모든 모델에 동일한 스키마를 제공한다.

**2. Tool Call Corrector (`src/tools/tool-call-corrector.ts`)**
저성능 모델의 흔한 인수 오류를 자동 교정한다:

- 상대 경로 → 절대 경로 변환
- Git Bash 경로 → Windows 경로 변환
- 문자열 "true" → boolean true 타입 교정
  이것도 DHelix만의 독자 기능이다.

**3. Tool Retry with Correction (`src/tools/tool-retry.ts`)**
Levenshtein 거리 기반 파일명 오타 교정, 잘못된 JSON 인수 자동 수리.
경쟁 제품은 단순 재시도만 하지만, DHelix는 교정 후 재시도한다.

**4. Lazy Tool Loader (`src/tools/lazy-tool-loader.ts`)**
모델 등급별 스키마 지연 로딩으로 토큰 비용 최적화.
MEDIUM은 상위 10개만 즉시 로드, LOW는 이름만 제공.

**5. Hot Tool System**
6개 핵심 도구(file_read, file_write, file_edit, bash_exec, glob_search, grep_search)를
항상 전체 스키마로 제공하여 호출 정확도를 높인다.

---

## 2. Competitive Gap Matrix

### 2.1 Feature-by-Feature Comparison

| Feature                          |      DHelix (23)       |                   OpenCode (47)                   |      Codex (40+)       |   Gap Level   |
| -------------------------------- | :--------------------: | :-----------------------------------------------: | :--------------------: | :-----------: |
| **Tool Registration**            |                        |                                                   |                        |               |
| Zod schema validation            |          Yes           |                        Yes                        |      JSON Schema       |    Parity     |
| Plugin tool discovery            |           No           |                 Yes (npm + file)                  |  Yes (MCP + dynamic)   | **CRITICAL**  |
| Tool filtering pipeline          |  Partial (hot tools)   | Full (capability + permission + flags + disabled) |  Full (registry plan)  |   **HIGH**    |
| Dynamic tool loading             |        MCP only        |          npm packages + file convention           |    MCP + code mode     |   **HIGH**    |
| **Execution Pipeline**           |                        |                                                   |                        |               |
| Preflight validation             |        Zod only        |        Zod + permission + capability check        | JSON Schema + approval |  **MEDIUM**   |
| Parallel execution               |    Agent loop level    |               Batch tool for files                |   Concurrent handler   |   **HIGH**    |
| Result truncation                |          None          |       Configurable limits + file spillover        |      Token-aware       | **CRITICAL**  |
| Streaming output                 |     bash_exec only     |              All long-running tools               |        Partial         |   **HIGH**    |
| Error retry                      | Transient + correction |                  Transient only                   |     Timeout-based      | **Advantage** |
| **Schema Intelligence**          |                        |                                                   |                        |               |
| Adaptive schema per model        |      Yes (3-tier)      |                        No                         |           No           | **Advantage** |
| Tool call correction             | Yes (path, type, JSON) |                        No                         |           No           | **Advantage** |
| Few-shot examples for low models |          Yes           |                        No                         |           No           | **Advantage** |
| Lazy schema loading              |          Yes           |                        No                         |           No           | **Advantage** |
| **Shell & System**               |                        |                                                   |                        |               |
| Background process mgmt          |       Yes (full)       |                        Yes                        |          Yes           |    Parity     |
| Shell command arity analysis     |           No           |             Yes (162-cmd dictionary)              |  tree-sitter AST scan  |   **HIGH**    |
| Named shell tasks                |           No           |                      Partial                      |           No           |  **MEDIUM**   |
| Docker execution                 |           No           |                        No                         |    Yes (sandboxed)     |   **HIGH**    |
| **Code Intelligence**            |                        |                                                   |                        |               |
| Tree-sitter parsing              |     Yes (7 langs)      |                        No                         | Yes (permission scan)  |    Partial    |
| LSP integration                  |    Yes (on-demand)     |         Yes (diagnostics, hover, symbols)         |           No           |    Parity     |
| Semantic code search             |           No           |                 Yes (CodeSearch)                  |           No           |   **HIGH**    |
| **Missing Tool Categories**      |                        |                                                   |                        |               |
| Git operations tool              |           No           |                        No                         |          Yes           |   **HIGH**    |
| Apply patch / multi-edit         |           No           |                 Yes (apply_patch)                 |    Yes (code_mode)     | **CRITICAL**  |
| Plan mode tool                   |           No           |                  Yes (plan tool)                  |           No           |  **MEDIUM**   |
| Database query                   |           No           |                        No                         |           No           |    Future     |
| SSH remote exec                  |           No           |                        No                         |           No           |    Future     |
| Package manager                  |           No           |                        No                         |           No           |    Future     |

### 2.2 Gap Priority Summary

```
CRITICAL (must-fix for competitiveness):
  1. Plugin tool discovery — 사용자/커뮤니티 도구 확장 불가
  2. Result truncation — 대용량 결과가 컨텍스트를 폭파시킴
  3. Apply patch / multi-edit — 대규모 변경 시 file_edit 수십 번 호출 필요

HIGH (significant competitive disadvantage):
  4. Tool filtering pipeline — 모델/권한/실험적 플래그 기반 필터링 부족
  5. Parallel batch operations — 파일 일괄 처리 불가
  6. Shell arity analysis — bash 명령어 권한 패턴 매칭 없음
  7. Streaming for all tools — bash_exec 외 도구는 블로킹
  8. Semantic code search — 의미 기반 코드 검색 없음
  9. Git operations tool — git 작업마다 bash_exec 사용 강제
  10. Docker execution — 샌드박스 실행 환경 없음

MEDIUM (nice-to-have improvements):
  11. Named shell tasks — 백그라운드 작업 이름 지정
  12. Plan mode tool — 계획 수립 전용 도구
  13. Tool usage analytics — 도구 사용 패턴 분석
```

### 2.3 Architectural Comparison

**OpenCode Tool Pipeline:**

```
Registration → Filtering → Scheduling → Execution → Truncation → Storage
     |              |            |            |            |           |
  Zod + npm     capability   concurrent   with hooks   configurable  file
  discovery     + perms      batching     + policy     limits       spillover
               + flags
               + disabled
```

**Codex Tool Pipeline:**

```
Registration → Discovery → Approval → Execution → Result
     |             |           |           |          |
  JSON Schema   MCP scan    preset      120s       token-
  + dynamic     + code      approval    timeout    aware
  handlers      mode        system
```

**DHelix Current Pipeline:**

```
Registration → Hot/Deferred Split → Execution → Return
     |                |                  |           |
  Zod schema      hot tools vs       timeout +    raw result
  + MCP bridge    MCP deferred       retry +      (no truncation)
                                     correction
```

DHelix의 파이프라인은 실행 전후 단계가 부족하다. Filtering, scheduling, truncation, storage 레이어가 없다.

---

## 3. Critical Improvements

### 3.A Tool Execution Pipeline Extraction

**현재 문제**: `executor.ts` (583 LOC)에 검증, 교정, 실행, 재시도가 모두 섞여 있다.
`agent-loop.ts`에 권한 검사와 후크(hook) 로직이 분산되어 있다.

**목표**: 4단계 파이프라인으로 분리한다.

```
src/tools/
  pipeline/
    preflight.ts      — 권한 검사, capability 필터링, guardrail 검증
    scheduler.ts      — 동시성 관리, 배치 그룹핑, 의존성 해석
    executor.ts       — 순수 실행 (validation + correction + execute + retry)
    postprocess.ts    — 결과 truncation, metadata 부착, 이벤트 발행
  pipeline.ts         — 4단계를 연결하는 ToolPipeline 클래스
```

#### 3.A.1 Preflight Stage

```typescript
// src/tools/pipeline/preflight.ts
export interface PreflightResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly transformedArgs?: Record<string, unknown>;
}

export interface PreflightCheck {
  readonly name: string;
  readonly check: (call: ExtractedToolCall, context: ToolContext) => Promise<PreflightResult>;
}

// 등록 가능한 preflight 체크 목록
const DEFAULT_CHECKS: readonly PreflightCheck[] = [
  { name: "capability-filter", check: checkModelCapability }, // 모델이 이 도구를 지원하는가?
  { name: "permission-check", check: checkPermissionLevel }, // 권한 수준이 충분한가?
  { name: "experimental-flag", check: checkExperimentalFlag }, // 실험적 도구가 활성화되었는가?
  { name: "user-disabled", check: checkUserDisabled }, // 사용자가 비활성화했는가?
  { name: "guardrail-scan", check: runGuardrailScan }, // 보안 가드레일 통과하는가?
  { name: "arity-check", check: checkBashArity }, // bash 명령어 위험도 분석
];
```

OpenCode의 `toolOrchestration.ts`에서 영감을 받되, DHelix의 기존 guardrail 시스템과 통합한다.

#### 3.A.2 Scheduler Stage

```typescript
// src/tools/pipeline/scheduler.ts
export interface ScheduleResult {
  readonly groups: readonly ToolCallGroup[];
  readonly order: "parallel" | "sequential" | "mixed";
}

export interface ToolCallGroup {
  readonly calls: readonly ExtractedToolCall[];
  readonly mode: "parallel" | "sequential";
  readonly reason: string; // 왜 이 그룹핑인지 설명
}

export class ToolScheduler {
  /**
   * 도구 호출 목록을 분석하여 실행 그룹으로 나눈다.
   *
   * 규칙:
   * 1. file_read 끼리는 parallel 가능
   * 2. 같은 파일에 대한 write/edit는 sequential
   * 3. bash_exec는 독립 실행 (다른 도구와 parallel 불가)
   * 4. LSP 도구는 서버당 sequential (LSP는 단일 요청 처리)
   */
  schedule(calls: readonly ExtractedToolCall[]): ScheduleResult;
}
```

#### 3.A.3 Executor Stage (Refactored)

기존 `executor.ts`에서 preflight/postprocess 로직을 제거하고 순수 실행에 집중한다.

```typescript
// 현재: executeTool이 모든 것을 처리
// 개선: execute만 담당, 나머지는 pipeline 단계에서 처리

export async function executePure(
  tool: ToolDefinition<unknown>,
  validatedArgs: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  // 재시도 루프만 남김
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_TOOL_RETRIES; attempt++) {
    try {
      return await tool.execute(validatedArgs, context);
    } catch (execError) {
      lastError = execError;
      if (attempt < MAX_TOOL_RETRIES && isTransientError(execError)) {
        await backoff(attempt);
        continue;
      }
      throw execError;
    }
  }
  throw lastError;
}
```

#### 3.A.4 Postprocess Stage

```typescript
// src/tools/pipeline/postprocess.ts
export interface PostprocessConfig {
  readonly maxOutputLength: number; // 기본 100KB
  readonly truncationStrategy: "head" | "tail" | "head-tail" | "summary";
  readonly spilloverEnabled: boolean; // 초과분 파일 저장
  readonly spilloverDir: string; // 임시 파일 디렉토리
  readonly metadataAttach: boolean; // 실행 시간, 바이트 크기 등 부착
}

export async function postprocess(
  result: ToolResult,
  config: PostprocessConfig,
  context: ToolContext,
): Promise<ToolResult> {
  // 1. Result truncation
  if (result.output.length > config.maxOutputLength) {
    const truncated = truncateResult(result.output, config);
    const spilloverPath = config.spilloverEnabled
      ? await spillToFile(result.output, config.spilloverDir)
      : undefined;

    return {
      output:
        truncated +
        (spilloverPath
          ? `\n\n[Full output saved to: ${spilloverPath}]`
          : `\n\n[Output truncated from ${result.output.length} to ${config.maxOutputLength} chars]`),
      isError: result.isError,
      metadata: {
        ...result.metadata,
        truncated: true,
        originalLength: result.output.length,
        spilloverPath,
      },
    };
  }

  // 2. Metadata attachment
  return {
    ...result,
    metadata: {
      ...result.metadata,
      executionTimeMs: Date.now() - (context as any).__startTime,
      outputBytes: Buffer.byteLength(result.output, "utf-8"),
    },
  };
}
```

**구현 난이도**: HIGH (기존 agent-loop과의 통합이 핵심)
**예상 공수**: 3-4일
**파일 영향**: `src/tools/executor.ts`, `src/core/agent-loop.ts`, `src/tools/pipeline/*.ts` (신규)

---

### 3.B Standardized Error Handling + Retry

**현재 문제**:

- `executor.ts`의 재시도는 transient 에러(ECONNRESET 등)만 처리
- `tool-retry.ts`의 교정 재시도는 executor와 분리되어 있어 실제로 사용되지 않는 코드 경로가 있음
- 도구별 에러 형식이 제각각 (문자열 에러 vs Error 객체 vs isError 플래그)

**개선 방향**:

#### 3.B.1 Unified Error Type

```typescript
// src/tools/errors.ts
export type ToolErrorKind =
  | "validation" // Zod 검증 실패
  | "permission_denied" // EACCES, 권한 부족
  | "not_found" // ENOENT, 파일/리소스 없음
  | "timeout" // AbortSignal 만료
  | "transient" // 네트워크 일시 오류
  | "tool_not_found" // 레지스트리에 없는 도구
  | "aborted" // 사용자 취소
  | "internal" // 예상치 못한 에러
  | "rate_limited" // API rate limit
  | "output_too_large"; // 결과 초과

export class ToolExecutionError extends Error {
  constructor(
    readonly kind: ToolErrorKind,
    readonly toolName: string,
    message: string,
    readonly originalError?: unknown,
    readonly retryable: boolean = false,
    readonly correctable: boolean = false,
  ) {
    super(message);
    this.name = "ToolExecutionError";
  }
}
```

#### 3.B.2 Retry Strategy Matrix

| Error Kind          | Retry? | Correction? | Max Attempts | Backoff                  |
| ------------------- | ------ | ----------- | :----------: | ------------------------ |
| `transient`         | Yes    | No          |      3       | Exponential (1s, 2s, 4s) |
| `not_found`         | Yes    | Levenshtein |      1       | Immediate                |
| `validation`        | Yes    | JSON repair |      1       | Immediate                |
| `timeout`           | Yes    | No          |      1       | +50% timeout             |
| `rate_limited`      | Yes    | No          |      3       | Retry-After header       |
| `permission_denied` | No     | No          |      0       | -                        |
| `aborted`           | No     | No          |      0       | -                        |
| `tool_not_found`    | No     | No          |      0       | -                        |
| `internal`          | No     | No          |      0       | -                        |
| `output_too_large`  | No     | Truncation  |      0       | -                        |

#### 3.B.3 통합 재시도 엔진

```typescript
// src/tools/retry-engine.ts
export class RetryEngine {
  constructor(
    private readonly corrector: ToolCallCorrector, // 기존 tool-call-corrector.ts
    private readonly retrier: ToolRetrier, // 기존 tool-retry.ts
  ) {}

  async executeWithRetry(
    tool: ToolDefinition<unknown>,
    args: Record<string, unknown>,
    context: ToolContext,
    config: RetryConfig,
  ): Promise<ToolResult> {
    // Phase 1: Pre-correction (tier 기반)
    const correctedArgs = this.corrector.correct(args, context);

    // Phase 2: Execution with retry
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await tool.execute(correctedArgs, context);
      } catch (error) {
        const classified = classifyError(error, tool.name);

        if (!classified.retryable || attempt >= config.maxRetries) {
          // Phase 3: Post-correction attempt (Levenshtein, JSON repair)
          if (classified.correctable) {
            const correction = await this.retrier.attemptCorrection(
              tool.name,
              correctedArgs,
              error as Error,
              context.workingDirectory,
            );
            if (correction) {
              return await tool.execute(correction.args, context);
            }
          }
          throw classified;
        }

        await this.backoff(attempt, classified);
      }
    }
    throw new ToolExecutionError("internal", tool.name, "All retries exhausted");
  }
}
```

**구현 난이도**: MEDIUM
**예상 공수**: 2일
**파일 영향**: `src/tools/executor.ts`, `src/tools/tool-retry.ts`, `src/tools/retry-engine.ts` (신규)

---

### 3.C Tool Streaming for All Long-Running Operations

**현재 문제**:

- `bash_exec`만 `tool:output-delta` 이벤트로 실시간 스트리밍 지원
- `web_fetch`, `grep_search`, `find_references` 등은 완료될 때까지 블로킹
- 대용량 검색 결과가 한 번에 반환되어 UI 응답성 저하

**목표**: 모든 도구에 ToolContext.events를 통한 스트리밍 프로토콜 적용

#### 3.C.1 Streaming Protocol

```typescript
// src/tools/streaming.ts
export interface ToolStreamEvent {
  readonly type: "progress" | "chunk" | "warning" | "complete";
  readonly toolCallId: string;
  readonly data: string;
  readonly metadata?: {
    readonly bytesProcessed?: number;
    readonly totalBytes?: number;
    readonly itemsFound?: number;
    readonly elapsedMs?: number;
  };
}

export function emitToolStream(events: AppEventEmitter | undefined, event: ToolStreamEvent): void {
  if (!events) return;
  events.emit("tool:stream", event);
}
```

#### 3.C.2 Streaming 적용 대상

| Tool              | Streaming 방식                       | 예상 효과                               |
| ----------------- | ------------------------------------ | --------------------------------------- |
| `grep_search`     | 매칭 결과를 10개 단위로 chunk 발행   | 대규모 코드베이스에서 첫 결과 즉시 표시 |
| `glob_search`     | 파일 경로를 20개 단위로 chunk 발행   | 수천 파일 glob에서 응답성 개선          |
| `web_fetch`       | HTML 청크 단위로 progress 발행       | 대용량 페이지 다운로드 중 진행률 표시   |
| `web_search`      | 각 검색 결과를 개별 chunk으로 발행   | 검색 중 실시간 결과 표시                |
| `find_references` | LSP 응답을 파일별로 chunk 발행       | 수백 개 참조에서 즉시 표시 시작         |
| `symbol_search`   | tree-sitter 파싱 결과를 파일별 chunk | 대규모 프로젝트에서 응답성 개선         |
| `file_read`       | 대용량 파일(>1MB)은 블록 단위 chunk  | 큰 로그 파일 읽기 시 점진적 표시        |

#### 3.C.3 UI 연동

```typescript
// CLI에서의 스트리밍 표시
// src/cli/components/ToolStreamingView.tsx (신규)

// 진행률 바:
// grep_search: ████████░░ 80% (127 matches found in 45 files)
// web_fetch:   ██████░░░░ 60% (1.2MB / 2.0MB downloaded)

// 실시간 청크:
// grep_search results:
//   src/tools/executor.ts:72  export async function executeTool(
//   src/tools/registry.ts:61  register(tool: ToolDefinition<any>): void {
//   ... (streaming)
```

**구현 난이도**: MEDIUM-HIGH
**예상 공수**: 3일
**파일 영향**: 각 도구 정의 파일, `src/tools/streaming.ts` (신규), UI 컴포넌트

---

### 3.D Batch/Parallel File Operations

**현재 문제**:

- 10개 파일을 동시에 읽으려면 LLM이 `file_read`를 10번 호출해야 함
- 각 호출이 개별 LLM turn을 소비하여 레이턴시 10배 증가
- OpenCode의 `batch` 도구는 이를 단일 호출로 처리

**해결**: `batch_file_ops` 도구 도입

```typescript
// src/tools/definitions/batch-file-ops.ts
import { z } from "zod";

const batchFileOpsSchema = z.object({
  operations: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("read"),
          file_path: z.string(),
          offset: z.number().optional(),
          limit: z.number().optional(),
        }),
        z.object({
          type: z.literal("write"),
          file_path: z.string(),
          content: z.string(),
        }),
        z.object({
          type: z.literal("edit"),
          file_path: z.string(),
          old_string: z.string(),
          new_string: z.string(),
        }),
        z.object({
          type: z.literal("delete"),
          file_path: z.string(),
        }),
      ]),
    )
    .min(1)
    .max(20), // 최소 1개, 최대 20개 동시 처리
  parallel: z.boolean().default(true),
});

export const batchFileOpsTool: ToolDefinition<z.infer<typeof batchFileOpsSchema>> = {
  name: "batch_file_ops",
  description: `Execute multiple file operations in a single call. Supports read, write, edit, and delete.
Operations run in parallel by default. Use parallel=false for sequential execution when order matters.
Maximum 20 operations per batch. Each operation returns its own result.`,
  parameterSchema: batchFileOpsSchema,
  permissionLevel: "confirm", // write/edit/delete 포함이므로 confirm
  async execute(params, context) {
    const results = params.parallel
      ? await Promise.allSettled(params.operations.map((op) => executeOp(op, context)))
      : await executeSequential(params.operations, context);

    return formatBatchResults(results);
  },
};
```

**동시성 제어**:

- 같은 파일에 대한 read + write는 자동으로 sequential로 전환
- 파일 시스템 동시 접근 제한: 최대 10 concurrent I/O
- 하나의 operation 실패가 전체를 중단하지 않음 (Promise.allSettled)

**구현 난이도**: MEDIUM
**예상 공수**: 2일
**파일 영향**: `src/tools/definitions/batch-file-ops.ts` (신규), `src/tools/registry.ts`

---

### 3.E Code Mode Tool (Structured Editing)

**현재 문제**:

- `file_edit`은 텍스트 패턴 매칭 방식이라 AST-aware가 아님
- 대규모 리팩토링(함수 추출, 시그니처 변경 등)에 취약
- Codex의 code_mode는 구조화된 편집 연산(structured editor operations)을 제공

**해결**: `apply_patch` 도구 + `code_mode` 도구 2단계 도입

#### Stage 1: apply_patch (Unified Diff 적용)

```typescript
// src/tools/definitions/apply-patch.ts
const applyPatchSchema = z.object({
  patch: z
    .string()
    .describe(
      "Unified diff format patch. Supports multiple files. " +
        "Use --- a/path and +++ b/path headers. " +
        "Context lines recommended for accurate matching.",
    ),
  dry_run: z
    .boolean()
    .default(false)
    .describe("If true, returns what would change without modifying files."),
  fuzz_factor: z
    .number()
    .min(0)
    .max(3)
    .default(0)
    .describe("Number of context lines that can mismatch (0 = exact match required)."),
});
```

이 도구는 LLM이 여러 파일의 변경사항을 하나의 unified diff로 생성하여 한 번에 적용할 수 있게 한다.
OpenCode의 apply_patch와 유사하지만, DHelix는 dry_run과 fuzz_factor를 추가한다.

#### Stage 2: code_mode (AST-Aware Editing)

```typescript
// src/tools/definitions/code-mode.ts (Phase 2 — tree-sitter 기반)
const codeModeSchema = z.object({
  file_path: z.string(),
  operation: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("extract_function"),
      start_line: z.number(),
      end_line: z.number(),
      function_name: z.string(),
    }),
    z.object({
      type: z.literal("rename_symbol"),
      symbol: z.string(),
      new_name: z.string(),
      scope: z.enum(["file", "project"]).default("file"),
    }),
    z.object({
      type: z.literal("change_signature"),
      function_name: z.string(),
      new_params: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          default_value: z.string().optional(),
        }),
      ),
    }),
    z.object({
      type: z.literal("inline_variable"),
      variable_name: z.string(),
      line: z.number(),
    }),
    z.object({
      type: z.literal("move_symbol"),
      symbol: z.string(),
      target_file: z.string(),
    }),
  ]),
});
```

code_mode는 tree-sitter AST를 활용하여 구조적으로 안전한 편집을 수행한다.
텍스트 패턴 매칭이 아닌 AST 노드 조작이므로 부작용이 적다.

**구현 난이도**: apply_patch = MEDIUM, code_mode = VERY HIGH
**예상 공수**: apply_patch 2일, code_mode 5-7일
**의존성**: code_mode는 tree-sitter 엔진의 Go/Java 파싱 수정이 선행되어야 함

---

## 4. New Tools Roadmap

### 4.1 Priority 1: 즉시 필요 (1-2주 내 구현)

#### 4.1.1 git_operations

```typescript
// src/tools/definitions/git-operations.ts
const gitOpsSchema = z.object({
  operation: z.discriminatedUnion("type", [
    z.object({ type: z.literal("status") }),
    z.object({
      type: z.literal("diff"),
      ref: z.string().optional(),
      staged: z.boolean().optional(),
    }),
    z.object({
      type: z.literal("log"),
      count: z.number().default(10),
      format: z.enum(["oneline", "full"]).default("oneline"),
    }),
    z.object({
      type: z.literal("blame"),
      file_path: z.string(),
      start_line: z.number().optional(),
      end_line: z.number().optional(),
    }),
    z.object({ type: z.literal("show"), ref: z.string() }),
    z.object({ type: z.literal("branch"), list: z.boolean().default(true) }),
    z.object({
      type: z.literal("stash"),
      action: z.enum(["list", "push", "pop", "apply"]).default("list"),
    }),
    z.object({
      type: z.literal("commit"),
      message: z.string(),
      files: z.array(z.string()).optional(),
    }),
    z.object({ type: z.literal("checkout"), ref: z.string(), create: z.boolean().default(false) }),
  ]),
  cwd: z.string().optional(),
});
```

**왜 필요한가**:

- 현재 모든 git 작업이 `bash_exec("git status")` 등으로 수행됨
- 매번 LLM이 git 명령어를 생성해야 하고, 출력 파싱도 LLM이 담당
- 전용 도구는 구조화된 JSON 출력을 제공하여 파싱 에러 제거
- 권한 수준 세분화 가능: status/log는 safe, commit/checkout은 confirm

**Permission 매핑**:
| Operation | Level | 이유 |
|-----------|-------|------|
| status, diff, log, blame, show, branch (list) | safe | 읽기 전용 |
| stash list | safe | 읽기 전용 |
| stash push/pop/apply | confirm | 작업 트리 변경 |
| commit | confirm | 히스토리 변경 |
| checkout, branch (create) | confirm | HEAD 변경 |

#### 4.1.2 apply_patch

(3.E Stage 1에서 상세 설명됨)

Unified diff 기반 다중 파일 패치. `file_edit`의 상위 도구로,
한 번의 호출로 여러 파일의 여러 위치를 동시에 수정할 수 있다.

#### 4.1.3 docker_exec

```typescript
// src/tools/definitions/docker-exec.ts
const dockerExecSchema = z.object({
  operation: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("run"),
      image: z.string(),
      command: z.string(),
      volumes: z.array(z.string()).optional(), // host:container 바인드 마운트
      env: z.record(z.string()).optional(), // 환경 변수
      timeout_ms: z.number().default(120_000),
      network: z.enum(["none", "host", "bridge"]).default("none"),
    }),
    z.object({
      type: z.literal("build"),
      dockerfile: z.string().default("Dockerfile"),
      tag: z.string(),
      context: z.string().default("."),
    }),
    z.object({
      type: z.literal("ps"),
      all: z.boolean().default(false),
    }),
    z.object({
      type: z.literal("logs"),
      container: z.string(),
      tail: z.number().default(100),
    }),
  ]),
});
```

**왜 필요한가**:

- 코드를 안전한 샌드박스에서 실행하는 유일한 방법
- Codex는 Docker 기반 샌드박스를 기본 제공
- 테스트 실행, 빌드 검증, 보안 취약점 스캔 등에 필수
- network=none 기본값으로 네트워크 접근을 차단하여 보안 강화

**Permission**: 모든 operation이 `confirm` (호스트 시스템과의 볼륨 마운트 위험)

### 4.2 Priority 2: 경쟁력 강화 (3-4주 내 구현)

#### 4.2.1 package_manager

```typescript
const packageManagerSchema = z.object({
  operation: z.discriminatedUnion("type", [
    z.object({ type: z.literal("info"), package: z.string() }), // 패키지 정보 조회
    z.object({ type: z.literal("search"), query: z.string() }), // 패키지 검색
    z.object({ type: z.literal("outdated") }), // 업데이트 필요 패키지 목록
    z.object({
      type: z.literal("install"),
      packages: z.array(z.string()),
      dev: z.boolean().default(false),
    }),
    z.object({ type: z.literal("uninstall"), packages: z.array(z.string()) }),
    z.object({ type: z.literal("audit") }), // 보안 취약점 스캔
  ]),
  manager: z.enum(["npm", "yarn", "pnpm", "pip", "cargo", "go"]).optional(), // 자동 감지
});
```

**자동 감지 로직**:

- `package-lock.json` → npm
- `yarn.lock` → yarn
- `pnpm-lock.yaml` → pnpm
- `requirements.txt` / `pyproject.toml` → pip
- `Cargo.toml` → cargo
- `go.mod` → go

#### 4.2.2 db_query

```typescript
const dbQuerySchema = z.object({
  connection: z.object({
    type: z.enum(["sqlite", "postgres", "mysql"]),
    path: z.string().optional(), // SQLite 파일 경로
    url: z.string().optional(), // 연결 URL
  }),
  query: z.string(),
  params: z.array(z.unknown()).optional(), // 파라미터화된 쿼리
  readonly: z.boolean().default(true), // 기본 읽기 전용
  limit: z.number().default(100), // 결과 행 제한
});
```

**보안 고려사항**:

- readonly=true가 기본값: SELECT만 허용, INSERT/UPDATE/DELETE는 readonly=false 필요
- readonly=false일 때 permission level이 dangerous로 상승
- 연결 URL에 비밀번호 포함 시 경고 (guardrail)
- 쿼리 결과는 자동으로 limit 적용 (토큰 폭발 방지)

#### 4.2.3 ssh_exec

```typescript
const sshExecSchema = z.object({
  host: z.string(),
  command: z.string(),
  user: z.string().optional(),
  key_path: z.string().optional(),
  port: z.number().default(22),
  timeout_ms: z.number().default(30_000),
});
```

**보안**: 항상 dangerous 권한. SSH 키 경로는 guardrail로 검증 (홈 디렉토리 외부 키 차단).

### 4.3 Priority 3: 차별화 기능 (4-8주 내 구현)

#### 4.3.1 Refactoring Tools (AST-based)

tree-sitter Tier 1 엔진 위에 구축하는 고급 리팩토링 도구:

| Tool               | Operation                        | AST Requirement         |
| ------------------ | -------------------------------- | ----------------------- |
| `extract_function` | 선택 범위를 새 함수로 추출       | 변수 스코프 분석 필요   |
| `extract_variable` | 표현식을 변수로 추출             | 표현식 노드 식별 필요   |
| `inline_variable`  | 변수 사용처를 값으로 대체        | 참조 추적 필요          |
| `change_signature` | 함수 시그니처 변경 + 호출부 갱신 | 전체 프로젝트 참조 검색 |
| `move_to_file`     | 심볼을 다른 파일로 이동          | import 자동 갱신 필요   |

이 도구들은 code_mode의 연산으로 통합되거나, 독립 도구로 제공될 수 있다.
tree-sitter만으로 부족한 경우 LSP Tier 2와 결합한다 (예: change_signature는 LSP rename 활용).

#### 4.3.2 plan_mode Tool

```typescript
const planModeSchema = z.object({
  action: z.enum(["enter", "exit", "update"]),
  plan: z.string().optional(), // enter/update 시 계획 내용
  checkpoints: z.array(z.string()).optional(), // 계획의 체크포인트
});
```

OpenCode의 Plan 도구에서 영감. LLM이 복잡한 작업 전에 명시적으로 계획을 수립하고,
계획 모드에서는 도구 호출이 차단되어 사고(reasoning)에 집중한다.

#### 4.3.3 semantic_search Tool

```typescript
const semanticSearchSchema = z.object({
  query: z.string(), // 자연어 질의
  scope: z.enum(["file", "directory", "project"]).default("project"),
  path: z.string().optional(), // scope가 file/directory일 때
  language: z.string().optional(), // 특정 언어 파일만
  max_results: z.number().default(20),
  include_context: z.boolean().default(true), // 주변 코드 포함
});
```

tree-sitter 심볼 인덱스 + TF-IDF 또는 임베딩 기반 의미 검색.
OpenCode의 CodeSearch에 대응하는 기능이다.

### 4.4 Tool Roadmap Timeline

```
Week 1-2 (Priority 1):
  ├── git_operations      ██████████ → 2일
  ├── apply_patch         ██████████ → 2일
  ├── docker_exec         ████████████ → 3일
  └── batch_file_ops      ████████ → 2일

Week 3-4 (Priority 2):
  ├── package_manager     ██████████ → 2일
  ├── db_query            ████████████ → 3일
  └── ssh_exec            ████████ → 2일

Week 5-8 (Priority 3):
  ├── code_mode (AST)     ████████████████████████ → 7일
  ├── plan_mode           ██████ → 1일
  └── semantic_search     ████████████████ → 5일

Target: 23 → 33 tools (+10)
After all phases: 33 tools (vs OpenCode 47, Codex 40+)
```

---

## 5. Tool Discovery & Plugin System

### 5.1 현재 상태

DHelix는 현재 두 가지 도구 등록 경로만 가진다:

1. **Built-in**: `src/tools/definitions/*.ts`에서 하드코딩 등록
2. **MCP**: MCP 서버 연결 시 tool-bridge를 통해 동적 등록

**부족한 것**: 사용자 정의 도구, 커뮤니티 도구, npm 패키지 도구

### 5.2 Plugin Tool Architecture

OpenCode는 프로젝트 내 `{tool,tools}/*.{js,ts}` 파일을 자동 감지하여 도구로 등록한다.
DHelix도 유사한 시스템을 도입하되, 5개 소스로 확장한다.

```
Tool Loading Hierarchy (5 sources):
  1. Built-in tools       — src/tools/definitions/*.ts (23개, 컴파일 타임)
  2. Project tools        — {project}/.dhelix/tools/*.{js,ts,mjs} (프로젝트별)
  3. User tools           — ~/.dhelix/tools/*.{js,ts,mjs} (사용자 전역)
  4. NPM package tools    — node_modules/@dhelix-tools/* (npm 패키지)
  5. MCP tools            — MCP 서버 연결 (기존)
```

#### 5.2.1 Plugin Tool Interface

```typescript
// @dhelix/tool-sdk (npm 패키지로 배포)
export interface DhelixToolPlugin {
  /** 플러그인 메타데이터 */
  readonly name: string;
  readonly version: string;
  readonly description: string;

  /** 도구 정의 목록 */
  readonly tools: readonly DhelixToolDefinition[];
}

export interface DhelixToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameterSchema: z.ZodSchema; // Zod 스키마
  readonly permissionLevel: "safe" | "confirm" | "dangerous";
  readonly execute: (params: unknown, context: ToolContext) => Promise<ToolResult>;

  // 선택적 메타데이터
  readonly timeoutMs?: number;
  readonly examples?: readonly string[]; // few-shot 예시
  readonly tags?: readonly string[]; // 카테고리 태그
  readonly requiredCapabilities?: readonly string[]; // 필요한 시스템 기능
}
```

#### 5.2.2 Discovery Pipeline

```typescript
// src/tools/plugin-discovery.ts

export class ToolPluginDiscovery {
  /**
   * 5개 소스에서 플러그인 도구를 탐색하고 등록한다.
   *
   * 탐색 순서:
   * 1. 프로젝트 .dhelix/tools/ — 프로젝트별 커스텀 도구
   * 2. 사용자 ~/.dhelix/tools/ — 사용자 전역 커스텀 도구
   * 3. npm @dhelix-tools/* — 설치된 npm 도구 패키지
   * 4. MCP 서버 — 기존 MCP tool-bridge
   *
   * 이름 충돌 시: 나중에 로드된 도구가 경고와 함께 무시됨 (built-in 우선)
   */
  async discover(projectDir: string, registry: ToolRegistry): Promise<DiscoveryReport> {
    const report: DiscoveryReport = { loaded: [], skipped: [], errors: [] };

    // Phase 1: File-based discovery
    const fileTools = await this.discoverFromFiles([
      join(projectDir, ".dhelix", "tools"),
      join(homedir(), ".dhelix", "tools"),
    ]);

    // Phase 2: NPM package discovery
    const npmTools = await this.discoverFromNpm(projectDir);

    // Phase 3: Validation & registration
    for (const tool of [...fileTools, ...npmTools]) {
      if (registry.has(tool.name)) {
        report.skipped.push({ name: tool.name, reason: "name conflict with built-in" });
        continue;
      }

      // Security: 플러그인 도구는 최소 confirm 권한
      // 사용자가 safe로 선언해도 강제로 confirm으로 승격
      const secureTool = {
        ...tool,
        permissionLevel: tool.permissionLevel === "safe" ? "confirm" : tool.permissionLevel,
      };

      try {
        registry.register(secureTool);
        report.loaded.push(secureTool.name);
      } catch (err) {
        report.errors.push({ name: tool.name, error: String(err) });
      }
    }

    return report;
  }

  /**
   * 파일 시스템에서 도구 파일을 탐색하고 동적 import로 로드한다.
   *
   * 지원 파일 형식:
   * - .mjs (ESM module — 권장)
   * - .js (CommonJS — default export 또는 module.exports)
   * - .ts (TypeScript — tsx/jiti로 런타임 트랜스파일)
   *
   * 파일 명명 규칙:
   * - 파일명이 도구 이름이 됨: my-tool.mjs → "my-tool"
   * - 또는 파일 내 name 속성으로 명시적 지정
   */
  private async discoverFromFiles(dirs: readonly string[]): Promise<DhelixToolDefinition[]>;

  /**
   * node_modules에서 @dhelix-tools/* 패키지를 탐색한다.
   *
   * 각 패키지의 package.json에서 "dhelix-tools" 필드를 확인:
   * {
   *   "name": "@dhelix-tools/docker",
   *   "dhelix-tools": {
   *     "entry": "./dist/index.mjs"
   *   }
   * }
   */
  private async discoverFromNpm(projectDir: string): Promise<DhelixToolDefinition[]>;
}
```

#### 5.2.3 Security Considerations for Plugin Tools

| Risk                                 | Mitigation                                        |
| ------------------------------------ | ------------------------------------------------- |
| 악성 도구가 시스템 파일 삭제         | 플러그인 도구는 항상 confirm 이상 권한            |
| 도구가 무한 루프 실행                | 플러그인 도구에 기본 60초 타임아웃 강제           |
| 도구가 네트워크 요청으로 데이터 유출 | guardrail에 플러그인 도구 네트워크 접근 감사 로그 |
| 이름 충돌으로 built-in 도구 덮어쓰기 | built-in 이름 예약, 충돌 시 플러그인 무시         |
| 도구가 다른 도구의 레지스트리 조작   | ToolContext에 registry 미노출, 격리된 실행        |

### 5.3 Tool Marketplace Concept (Phase 3)

장기적으로 커뮤니티 도구 생태계를 구축한다:

```
dhelix-marketplace.dev (웹사이트)
  ├── Featured Tools
  │   ├── @dhelix-tools/docker — Docker container management
  │   ├── @dhelix-tools/k8s — Kubernetes operations
  │   └── @dhelix-tools/aws — AWS CLI wrapper
  ├── Categories
  │   ├── DevOps (docker, k8s, terraform)
  │   ├── Database (postgres, redis, mongo)
  │   ├── Testing (playwright, cypress)
  │   └── AI/ML (jupyter, huggingface)
  └── Publish Your Tool (npm publish 가이드)
```

CLI에서의 도구 설치:

```bash
# npm 패키지로 설치
npm install --save-dev @dhelix-tools/docker

# 또는 dhelix CLI에서 직접 설치
dhelix tool install docker
dhelix tool list
dhelix tool remove docker
```

**구현 난이도**: Discovery = MEDIUM, Marketplace = HIGH (별도 프로젝트)
**예상 공수**: Discovery 3일, Marketplace 2-3주 (웹사이트 + CLI 통합)

---

## 6. Tool Schema Evolution

### 6.1 Enhance Existing Adaptive Schema

DHelix의 적응형 스키마(`src/tools/adaptive-schema.ts`)는 이미 경쟁 우위이다.
이를 더 강화한다.

#### 6.1.1 Context-Aware Schema Adaptation

현재는 모델 등급(high/medium/low)만 고려한다. 추가 요소를 반영한다:

```typescript
export interface SchemaAdaptationContext {
  readonly tier: CapabilityTier;
  readonly remainingContextTokens: number; // 남은 컨텍스트 윈도우
  readonly toolCallHistory: readonly string[]; // 최근 호출한 도구 목록
  readonly currentTask: string; // 현재 작업 종류 (coding, debugging, etc.)
  readonly providerName: string; // LLM 제공자 (openai, anthropic, etc.)
}

export function adaptToolSchemaV2(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  ctx: SchemaAdaptationContext,
): AdaptedToolInfo {
  // 1. 기본 tier 기반 적응 (기존 로직)
  let adapted = adaptToolSchema(name, description, parameters, ctx.tier, "");

  // 2. 컨텍스트 윈도우 잔여량 기반 추가 축소
  if (ctx.remainingContextTokens < 4000) {
    // 위기 모드: 필수 파라미터 + 이름만
    adapted = emergencyMinimize(adapted);
  }

  // 3. 최근 사용 기반 스키마 강화
  if (ctx.toolCallHistory.slice(-5).includes(name)) {
    // 최근 5회 내 사용된 도구는 전체 스키마 유지
    return { name, description, parameters };
  }

  // 4. 작업 종류 기반 도구 우선순위
  const relevantTools = getRelevantToolsForTask(ctx.currentTask);
  if (!relevantTools.has(name)) {
    // 현재 작업과 무관한 도구는 최소 스키마
    adapted = minimizeSchema(adapted);
  }

  return adapted;
}
```

#### 6.1.2 Provider-Specific Schema Tuning

각 LLM 제공자의 도구 호출 특성에 맞게 스키마를 미세 조정한다:

```typescript
const PROVIDER_SCHEMA_OVERRIDES: Record<string, SchemaOverride> = {
  anthropic: {
    // Anthropic은 description을 더 잘 활용함
    descriptionMaxLength: 500,
    // tool_use 블록에 최적화된 스키마 생성
    preferObjectParams: true,
  },
  openai: {
    // OpenAI는 짧은 description 선호
    descriptionMaxLength: 200,
    // function calling에 최적화된 스키마
    preferFlatParams: true,
  },
  ollama: {
    // 로컬 모델은 최소 스키마
    descriptionMaxLength: 100,
    alwaysIncludeExamples: true,
    preferRequiredOnly: true,
  },
};
```

#### 6.1.3 JSON Schema ↔ Zod Round-Tripping

현재는 Zod → JSON Schema 단방향 변환만 지원한다 (`zod-to-json-schema`).
플러그인 도구가 JSON Schema로 스키마를 제공할 수 있으므로 역방향 변환도 필요하다.

```typescript
// src/tools/schema-converter.ts

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Zod → JSON Schema (기존)
 */
export function zodToJson(schema: z.ZodSchema): Record<string, unknown> {
  const result = zodToJsonSchema(schema, { target: "openApi3" });
  const { $schema, ...rest } = result as Record<string, unknown>;
  return rest;
}

/**
 * JSON Schema → Zod (신규)
 *
 * 플러그인 도구가 JSON Schema로 스키마를 정의한 경우,
 * 런타임 검증을 위해 Zod 스키마로 변환한다.
 *
 * 지원하는 JSON Schema 타입:
 * - string, number, integer, boolean, null
 * - object (properties, required, additionalProperties)
 * - array (items)
 * - enum
 * - oneOf, anyOf (z.union으로 변환)
 */
export function jsonToZod(jsonSchema: Record<string, unknown>): z.ZodSchema {
  const type = jsonSchema["type"] as string;

  switch (type) {
    case "string":
      return buildStringSchema(jsonSchema);
    case "number":
    case "integer":
      return buildNumberSchema(jsonSchema);
    case "boolean":
      return z.boolean();
    case "null":
      return z.null();
    case "object":
      return buildObjectSchema(jsonSchema);
    case "array":
      return buildArraySchema(jsonSchema);
    default:
      // oneOf/anyOf 처리
      if (jsonSchema["oneOf"] || jsonSchema["anyOf"]) {
        return buildUnionSchema(jsonSchema);
      }
      // enum 처리
      if (jsonSchema["enum"]) {
        return z.enum(jsonSchema["enum"] as [string, ...string[]]);
      }
      return z.unknown();
  }
}

/**
 * 왕복 검증: Zod → JSON → Zod → JSON이 동일한 결과를 내는지 확인
 * 플러그인 도구 등록 시 스키마 무결성 검증에 사용
 */
export function verifyRoundTrip(zodSchema: z.ZodSchema): boolean {
  const json1 = zodToJson(zodSchema);
  const zod2 = jsonToZod(json1);
  const json2 = zodToJson(zod2);
  return JSON.stringify(json1) === JSON.stringify(json2);
}
```

### 6.2 Tool Schema Versioning

도구 스키마가 진화할 때 하위 호환성을 유지하는 방법:

```typescript
// src/tools/schema-version.ts

export interface VersionedToolDefinition extends ToolDefinition<unknown> {
  readonly schemaVersion: number; // 1, 2, 3, ...
  readonly deprecated?: {
    readonly since: string; // "v0.3.0"
    readonly message: string; // 마이그레이션 안내
    readonly removedIn?: string; // "v1.0.0"
  };
  readonly migrations?: readonly SchemaMigration[];
}

export interface SchemaMigration {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly migrate: (args: Record<string, unknown>) => Record<string, unknown>;
}

// 예: file_edit v1 → v2 마이그레이션
// v1: { file_path, find, replace }
// v2: { file_path, old_string, new_string }
const fileEditMigration: SchemaMigration = {
  fromVersion: 1,
  toVersion: 2,
  migrate: (args) => ({
    file_path: args["file_path"],
    old_string: args["find"], // 'find' → 'old_string'으로 이름 변경
    new_string: args["replace"], // 'replace' → 'new_string'으로 이름 변경
  }),
};
```

---

## 7. Success Metrics

### 7.1 Quantitative Metrics

| Metric                                 | Current (Baseline) |  Target (3 months)   |   Target (6 months)   |
| -------------------------------------- | :----------------: | :------------------: | :-------------------: |
| **Tool Count**                         |         23         |       33 (+10)       |       40+ (+17)       |
| **Tool Success Rate**                  |  ~85% (estimated)  |         >92%         |         >95%          |
| **Median Execution Time**              |       ~500ms       |        <400ms        |        <300ms         |
| **Context Overflow from Tool Results** |     Unmeasured     |     <5% of calls     |     <2% of calls      |
| **Tool Call Correction Rate**          |  ~12% (estimated)  |         <8%          |          <5%          |
| **Plugin Tools Available**             |         0          |   5 (first-party)    |    20+ (community)    |
| **Parallel Batch Efficiency**          | N/A (no batching)  | 3x faster for 5+ ops | 5x faster for 10+ ops |
| **Streaming Coverage**                 |     1/23 (4%)      |      8/33 (24%)      |      20/40 (50%)      |

### 7.2 Qualitative Metrics

| Metric                              | Measurement Method                                | Target                   |
| ----------------------------------- | ------------------------------------------------- | ------------------------ |
| **Developer Satisfaction**          | 도구 실행 후 사용자 피드백 (implicit: retry 횟수) | Retry rate <3%           |
| **Error Message Quality**           | ToolExecutionError의 actionable 정보 포함률       | >90% with fix suggestion |
| **Plugin Developer Experience**     | 첫 번째 커스텀 도구 생성까지 소요 시간            | <15분 (가이드 포함)      |
| **Schema Adaptation Effectiveness** | Low-tier 모델의 도구 호출 정확도 개선             | +15% vs no adaptation    |

### 7.3 Competitive Parity Checklist

```
Phase 1 (Week 1-2): Foundation
  [ ] Tool execution pipeline 4-stage 분리
  [ ] Standardized error types (ToolExecutionError)
  [ ] Result truncation + file spillover
  [ ] batch_file_ops tool
  [ ] git_operations tool
  [ ] apply_patch tool

Phase 2 (Week 3-4): Expansion
  [ ] docker_exec tool
  [ ] package_manager tool
  [ ] Plugin tool discovery (file-based)
  [ ] Tool streaming protocol
  [ ] Shell arity analysis (bash 권한 패턴)
  [ ] db_query tool
  [ ] ssh_exec tool

Phase 3 (Week 5-8): Differentiation
  [ ] code_mode (AST-based editing)
  [ ] semantic_search tool
  [ ] plan_mode tool
  [ ] NPM package tool discovery
  [ ] Context-aware schema adaptation v2
  [ ] Provider-specific schema tuning
  [ ] JSON Schema ↔ Zod round-tripping

Phase 4 (Week 9-12): Polish
  [ ] Tool usage analytics dashboard
  [ ] Tool marketplace concept
  [ ] Schema versioning + migration
  [ ] Comprehensive tool benchmarks
  [ ] Plugin SDK documentation
```

### 7.4 Risk Assessment

| Risk                                        | Probability | Impact | Mitigation                                 |
| ------------------------------------------- | :---------: | :----: | ------------------------------------------ |
| Pipeline 분리가 기존 agent-loop 안정성 저하 |    HIGH     |  HIGH  | Feature flag로 점진적 전환, 병렬 실행 유지 |
| 플러그인 도구의 보안 취약점                 |   MEDIUM    |  HIGH  | 강제 confirm 권한, 타임아웃, guardrail     |
| code_mode AST 편집의 edge case              |    HIGH     | MEDIUM | dry_run 기본 활성화, undo/rollback         |
| 도구 수 증가로 LLM 토큰 비용 증가           |   MEDIUM    | MEDIUM | Lazy loading 강화, 동적 도구 제거          |
| npm 패키지 도구의 의존성 충돌               |     LOW     |  LOW   | 격리된 import, peer dependency             |

---

## Appendix A: File Impact Map

```
src/tools/
  pipeline/
    preflight.ts          ← 신규: preflight 검사 체인
    scheduler.ts          ← 신규: 동시성/배치 스케줄링
    executor.ts           ← 리팩토링: 순수 실행만 담당
    postprocess.ts        ← 신규: truncation, metadata, spillover
  pipeline.ts             ← 신규: 4단계 연결 오케스트레이터
  errors.ts               ← 신규: ToolExecutionError, ToolErrorKind
  retry-engine.ts         ← 신규: 통합 재시도 엔진
  streaming.ts            ← 신규: 스트리밍 프로토콜
  schema-converter.ts     ← 신규: JSON Schema ↔ Zod 변환
  schema-version.ts       ← 신규: 스키마 버전 관리
  plugin-discovery.ts     ← 신규: 플러그인 도구 탐색
  definitions/
    batch-file-ops.ts     ← 신규: 배치 파일 연산
    git-operations.ts     ← 신규: Git 전용 도구
    apply-patch.ts        ← 신규: Unified diff 패치
    docker-exec.ts        ← 신규: Docker 실행
    package-manager.ts    ← 신규: 패키지 관리자
    db-query.ts           ← 신규: 데이터베이스 쿼리
    ssh-exec.ts           ← 신규: SSH 원격 실행
    code-mode.ts          ← 신규: AST 기반 구조 편집
    plan-mode.ts          ← 신규: 계획 모드
    semantic-search.ts    ← 신규: 의미 검색
  executor.ts             ← 수정: pipeline으로 로직 이전
  registry.ts             ← 수정: plugin tool 등록 지원
  adaptive-schema.ts      ← 수정: v2 context-aware 확장
  validation.ts           ← 수정: JSON Schema → Zod 역변환 추가

src/core/
  agent-loop.ts           ← 수정: pipeline 통합, preflight 로직 이전

Total new files: ~17
Total modified files: ~5
Estimated total LOC: ~3,000-4,000 (new), ~500 (modified)
```

## Appendix B: OpenCode Tool List Reference (47 tools)

OpenCode가 제공하는 도구 전체 목록과 DHelix 대응 현황:

| #     | OpenCode Tool       | DHelix Equivalent    | Gap                       |
| ----- | ------------------- | -------------------- | ------------------------- |
| 1     | file_read           | file_read            | Parity                    |
| 2     | file_write          | file_write           | Parity                    |
| 3     | file_edit           | file_edit            | Parity                    |
| 4     | list_dir            | list_dir             | Parity                    |
| 5     | mkdir               | mkdir                | Parity                    |
| 6     | bash                | bash_exec            | Parity                    |
| 7     | glob                | glob_search          | Parity                    |
| 8     | grep                | grep_search          | Parity                    |
| 9     | batch               | (none)               | **Gap → batch_file_ops**  |
| 10    | apply_patch         | (none)               | **Gap → apply_patch**     |
| 11    | agent               | agent                | Parity                    |
| 12    | plan                | (none)               | **Gap → plan_mode**       |
| 13    | skill               | (via slash commands) | Partial                   |
| 14    | ask_user            | ask_user             | Parity                    |
| 15    | todo                | todo_write           | Parity                    |
| 16    | notebook_edit       | notebook_edit        | Parity                    |
| 17    | web_search          | web_search           | Parity                    |
| 18    | web_fetch           | web_fetch            | Parity                    |
| 19    | code_search         | (none)               | **Gap → semantic_search** |
| 20    | lsp_diagnostics     | (via LSP)            | Partial                   |
| 21    | lsp_hover           | get_type_info        | Parity                    |
| 22    | lsp_symbols         | symbol_search        | Parity                    |
| 23-47 | (plugin-discovered) | (none)               | **Gap → plugin system**   |

---

_End of document. Last updated: 2026-04-04_
