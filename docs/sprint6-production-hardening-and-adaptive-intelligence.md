# Sprint 6: Production Hardening + Adaptive Intelligence

> **Version**: 1.0
> **Date**: 2026-03-14
> **Base**: Sprint 5 완료 — 3619 tests / 0 TS errors / 39 commands / 7 new modules
> **Scope**: 프로덕션 안정성 강화 + 적응형 모델 최적화 + 자가 복구 에이전트 + 보안 강화 + 개발자 경험 완성

---

## 목차

1. [Sprint 5 완료 현황 및 Sprint 6 동기](#sprint-5-완료-현황-및-sprint-6-동기)
2. [코드베이스 심층 감사 결과 (28개 갭)](#코드베이스-심층-감사-결과)
3. [Phase 0: Stability Hardening (안정성 강화)](#phase-0-stability-hardening)
4. [Phase A: Adaptive Model Intelligence (적응형 모델 최적화)](#phase-a-adaptive-model-intelligence)
5. [Phase B: Self-Healing Agent Loop (자가 복구 에이전트)](#phase-b-self-healing-agent-loop)
6. [Phase C: Security & Observability (보안 + 관측성)](#phase-c-security--observability)
7. [Phase D: Developer Experience (개발자 경험)](#phase-d-developer-experience)
8. [구현 순서 및 일정](#구현-순서-및-일정)
9. [검증 기준](#검증-기준)

---

## Sprint 5 완료 현황 및 Sprint 6 동기

### Sprint 5 성과

| 카테고리 | 항목 | 상태 |
|----------|------|------|
| **Phase 0** | P0-1 AbortSignal 메모리 누수 | ✅ `{ once: true }` 패턴 |
| | P0-2 스트림 타임아웃 레이스 | ✅ idle timeout 패턴 |
| | P0-3 AbortController 전달 | ✅ signal 통합 |
| | P0-4 도구 호출 ID 충돌 | ✅ randomUUID 기반 |
| | P0-5 JSON 파싱 로깅 | ✅ verbose 모드 경고 |
| | P0-6 MCP 레이스 컨디션 | ✅ 동기 폴백 |
| | P0-7 세션 저장 안정성 | ✅ .catch() 에러 핸들링 |
| **Phase A** | A1 Repo Map 통합 | ✅ system prompt 섹션 (priority 35) |
| | A2 Thinking Budget 연결 | ✅ contextUsagePercent 전달 |
| | A3 MCP Connector 초기화 | ✅ 3-scope 설정 탐색 |
| | A4 Graceful Shutdown | ✅ SIGINT/SIGTERM + Auto-Save |
| **Phase B** | B1 Dual-Model Router | ✅ architect/editor 패턴 |
| | B2 Tier-Based Budget | ✅ HIGH/MEDIUM/LOW 예산 |
| | B3 Tool Call Corrector | ✅ 경로/타입/파라미터 교정 |
| | B4 LOW Tier 가이드 | ✅ 도구 사용 예시 포함 |
| **Phase C** | C1 CI/CD 개선 | ✅ Node 22, madge, tag publish |
| | C3 Recovery Strategy | ✅ 4-패턴 복구 전략 |

**총 변경**: 17개 deliverable, 7개 신규 모듈, 3619 테스트 통과

### Sprint 6이 필요한 이유

Sprint 5는 **기반 연결과 버그 수정**에 집중했습니다. Sprint 6은 **상용화를 위한 마지막 마일**입니다:

1. **안정성 갭**: 에러 바운더리 부재, 스트림 정리 미흡, 이벤트 리스너 무제한 → 장시간 세션 불안정
2. **저성능 모델 효율**: Sprint 5의 tool corrector/tier budget은 **수동적** 교정 → **능동적** 적응 필요
3. **자가 복구 부재**: Recovery strategy는 정의만 했지 **실제 실행 로직** 미구현 (compact, fallback-strategy)
4. **보안 갭**: 시크릿 스캐너가 패턴 기반만, 인젝션 탐지 불완전, 감사 로그 부재
5. **관측성 부재**: 텔레메트리 인프라는 있으나 **분석/대시보드** 없음

### 웹 리서치 인사이트

| 트렌드 | 적용 |
|--------|------|
| **Context Engineering** — "right info at right time" (Martin Fowler) | → Adaptive Context: 태스크 복잡도에 따른 동적 컨텍스트 로딩 |
| **Ralph Loop** — 반복 실행 시 외부 상태(git/파일)로 컨텍스트 유지 | → Self-Healing Loop: 실패 후 파일/git 상태 기반 복구 |
| **Small Model Boom** — MiMo-V2-Flash, SmolLM3-3B, Qwen3.5가 tool calling 지원 | → Adaptive Tool Schema: 모델 능력에 따른 도구 스키마 자동 조정 |
| **Multi-Agent Orchestration** — Claude Code Agent Teams/SDK (2026) | → 이미 구현됨, 더 깊은 통합 필요 |
| **npm Supply Chain Security** — provenance, lockfile 검증, SLSA | → CI/CD + publish 보안 강화 |
| **Prompt Caching** — Anthropic ephemeral cache (90분 TTL) | → 캐시 히트율 모니터링 + 블록 경계 최적화 |

---

## 코드베이스 심층 감사 결과

Sprint 6 계획을 위해 코드베이스를 전수 감사한 결과 **28개 갭**을 식별했습니다.

### 카테고리별 갭 요약

| 카테고리 | 갭 수 | 심각도 | 영향 |
|----------|-------|--------|------|
| 안정성 | 4 | HIGH | 크래시, 행, 데이터 유실 |
| 성능 | 5 | MEDIUM | 느린 시작, 토큰 낭비 |
| 프로덕션 기능 | 5 | MEDIUM | 관측성, 확장성 부재 |
| 테스트 | 4 | MEDIUM | 검증되지 않은 엣지 케이스 |
| 보안 | 5 | MEDIUM | 프라이버시, 감사, 샌드박싱 |
| 효율성 | 5 | LOW | 최적화 기회 |

### 주요 발견 상세

**안정성 (HIGH)**:
- `App.tsx`: React Error Boundary 부재 → 렌더링 크래시 시 터미널 행
- `executor.ts`: 도구 실행 중단 시 stdout/stderr 스트림 미정리 → 메모리 누수
- `events.ts`: EventEmitter 리스너 수 무제한 → LLM 스트리밍 시 메모리 증가
- `agent-loop.ts`: 부분 스트림 복구 시 불완전한 도구 호출 JSON 검증 없음

**성능 (MEDIUM)**:
- `index.ts`: 시작 시간 측정 없음 (29개 dynamic import, 프로파일링 불가)
- `token-counter.ts`: 캐시 100개 제한, 장시간 세션에서 히트율 저하
- `system-prompt-builder.ts`: 매 반복마다 시스템 프롬프트 재빌드 (캐싱 없음)
- `context-manager.ts`: GC 주기 고정 (10 compaction마다) → 적응형 아님
- `anthropic.ts`: SSE 스트림 백프레셔 모니터링 없음

**보안 (MEDIUM)**:
- `secret-scanner.ts`: 패턴 기반만 (엔트로피 검사 없음, 위양성/위음성)
- `injection-detector.ts`: 명령 인젝션만 감지, 프롬프트 인젝션/경로 탐색 미탐지
- `permissions/manager.ts`: 감사 로그 없음 (승인/거부 기록 부재)
- `sandbox/index.ts`: Windows에서 무경고 비샌드박스 실행
- `config/loader.ts`: API 키가 로그에 노출될 가능성 (pino redaction 미설정)

---

## Phase 0: Stability Hardening (안정성 강화)

**목표**: 장시간 세션에서도 안정적으로 동작하는 프로덕션 등급 안정성 확보.

### S0-1. React Error Boundary 추가

**문제**: `App.tsx`에 에러 바운더리가 없음. 컴포넌트 렌더링 크래시 시 터미널이 행에 걸림.

**수정**:
```typescript
// src/cli/components/ErrorBoundary.tsx (신규)
import React from "react";
import { Box, Text } from "ink";

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { readonly children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    process.stderr.write(
      `[ErrorBoundary] Render crash: ${error.message}\n${info.componentStack ?? ""}\n`
    );
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red" bold>Rendering error occurred</Text>
          <Text color="gray">{this.state.error?.message}</Text>
          <Text color="yellow">Press Ctrl+C to exit, or restart dbcode.</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}
```

```typescript
// src/cli/App.tsx — 최상위 래핑
import { ErrorBoundary } from "./components/ErrorBoundary.js";

export function App(props: AppProps): React.ReactElement {
  return (
    <ErrorBoundary>
      {/* 기존 App 내용 */}
    </ErrorBoundary>
  );
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/cli/components/ErrorBoundary.tsx` | **신규** | ~40줄 |
| `src/cli/App.tsx` | ErrorBoundary 래핑 | ~5줄 |
| 테스트 | 렌더링 에러 시나리오 | ~25줄 |

---

### S0-2. 도구 실행 스트림 정리 강화

**문제**: `executor.ts`에서 bash 실행 중단 시 stdout/stderr 스트림이 명시적으로 destroy되지 않음.

**수정**:
```typescript
// src/tools/executor.ts — bash 실행 정리 강화
// finally 블록에 스트림 정리 추가
finally {
  if (childProcess) {
    childProcess.stdout?.destroy();
    childProcess.stderr?.destroy();
    if (!childProcess.killed) {
      childProcess.kill("SIGTERM");
    }
  }
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/tools/executor.ts` | 스트림 정리 | ~10줄 |
| 테스트 | 중단 시나리오 | ~15줄 |

---

### S0-3. EventEmitter 메모리 보호

**문제**: `events.ts`의 EventEmitter가 리스너 수 제한 없음. LLM 스트리밍 시 text-delta 이벤트가 초당 수천 건.

**수정**:
```typescript
// src/utils/events.ts
import { EventEmitter } from "node:events";

export function createAppEventEmitter(): AppEventEmitter {
  const emitter = new EventEmitter() as AppEventEmitter;
  emitter.setMaxListeners(50); // 합리적 상한 (기본 10은 너무 낮음)
  return emitter;
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/utils/events.ts` | maxListeners 설정 | ~3줄 |

---

### S0-4. 부분 스트림 복구 시 도구 호출 검증

**문제**: `agent-loop.ts`에서 스트림 중단 후 축적된 부분 콘텐츠를 사용하지만, 불완전한 도구 호출 JSON을 검증하지 않음.

**수정**:
```typescript
// src/core/agent-loop.ts — 부분 스트림 복구 후
// 불완전한 도구 호출 필터링
const validToolCalls = accumulatedToolCalls.filter((tc) => {
  if (!tc.arguments) return false;
  try {
    JSON.parse(tc.arguments);
    return true;
  } catch {
    config.events.emit("llm:error", {
      error: new Error(`Incomplete tool call filtered: ${tc.name} (stream interrupted)`),
    });
    return false;
  }
});
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/core/agent-loop.ts` | 도구 호출 JSON 검증 | ~15줄 |
| 테스트 | 부분 스트림 시나리오 | ~20줄 |

---

### S0-5. 시작 시간 프로파일링

**문제**: 29개 dynamic import의 시작 시간 측정 없음. 병목 식별 불가.

**수정**:
```typescript
// src/index.ts — 시작 시 프로파일링
const startupStart = performance.now();

// 각 초기화 단계 후:
const configLoadEnd = performance.now();
const toolRegistryEnd = performance.now();
// ...

if (process.env.DBCODE_VERBOSE) {
  process.stderr.write(`[startup] Config: ${(configLoadEnd - startupStart).toFixed(0)}ms\n`);
  process.stderr.write(`[startup] Tools: ${(toolRegistryEnd - configLoadEnd).toFixed(0)}ms\n`);
  process.stderr.write(`[startup] Total: ${(performance.now() - startupStart).toFixed(0)}ms\n`);
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/index.ts` | performance.now() 계측 | ~20줄 |

---

## Phase A: Adaptive Model Intelligence (적응형 모델 최적화)

**목표**: 저성능 모델에서도 최대 효율을 내는 **능동적** 적응 시스템 구축.

### A1. Adaptive Tool Schema (모델 능력 기반 스키마 자동 조정)

**배경**: Sprint 5의 B3(Tool Call Corrector)는 **사후 교정**. A1은 **사전 예방** — 모델에 전달하는 도구 스키마 자체를 모델 능력에 맞게 조정.

```typescript
// src/tools/adaptive-schema.ts (신규)

import type { CapabilityTier } from "../llm/model-capabilities.js";
import type { ToolDefinition } from "./types.js";

/**
 * 모델 능력에 따라 도구 스키마를 적응적으로 조정합니다.
 *
 * HIGH tier: 전체 스키마 (모든 optional 파라미터 포함)
 * MEDIUM tier: 핵심 파라미터만 (optional 제거, 설명 축약)
 * LOW tier: 필수 파라미터만 + few-shot 예시 포함
 */
export function adaptToolSchema(
  tool: ToolDefinition,
  tier: CapabilityTier,
  workingDirectory: string,
): ToolDefinition {
  if (tier === "high") return tool;

  const adapted = { ...tool };

  if (tier === "medium") {
    // Optional 파라미터 제거, 설명 2문장으로 축약
    adapted.parameters = removeOptionalParams(tool.parameters);
    adapted.description = truncateDescription(tool.description, 2);
  }

  if (tier === "low") {
    // 필수 파라미터만 + few-shot 예시
    adapted.parameters = keepRequiredOnly(tool.parameters);
    adapted.description = truncateDescription(tool.description, 1);
    adapted.examples = generateFewShotExamples(tool, workingDirectory);
  }

  return adapted;
}
```

**효과**:
- LOW tier 모델의 도구 스키마 토큰 소모 **60% 감소**
- few-shot 예시로 도구 호출 성공률 **+20% 예상** (Anthropic 연구 기반)

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/tools/adaptive-schema.ts` | **신규** | ~120줄 |
| `src/tools/registry.ts` | adaptToolSchema 통합 | ~10줄 |
| 테스트 | 신규 | ~60줄 |

---

### A2. System Prompt 캐싱 (반복 빌드 방지)

**문제**: Agent loop 매 반복마다 시스템 프롬프트를 처음부터 재빌드. 50회 반복이면 50번 빌드.

**수정**:
```typescript
// src/core/system-prompt-cache.ts (신규)

/**
 * 시스템 프롬프트 캐시.
 * 인스트럭션 파일의 mtime이 변경되지 않으면 캐시된 프롬프트를 반환합니다.
 */
export class SystemPromptCache {
  private cached: string | null = null;
  private cacheKey: string | null = null;

  get(key: string): string | null {
    return this.cacheKey === key ? this.cached : null;
  }

  set(key: string, prompt: string): void {
    this.cacheKey = key;
    this.cached = prompt;
  }

  /** 인스트럭션 파일들의 mtime을 조합한 캐시 키 생성 */
  static buildKey(instructionFiles: readonly string[]): string {
    // stat()으로 mtime 수집 → 조합 해시
    return instructionFiles
      .map(f => { try { return statSync(f).mtimeMs; } catch { return 0; } })
      .join(":");
  }

  invalidate(): void {
    this.cached = null;
    this.cacheKey = null;
  }
}
```

**효과**: 50회 반복 세션에서 시스템 프롬프트 빌드 **49회 절약** (첫 빌드 후 캐시).

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/core/system-prompt-cache.ts` | **신규** | ~50줄 |
| `src/cli/hooks/useAgentLoop.ts` | 캐시 통합 | ~10줄 |
| 테스트 | 신규 | ~30줄 |

---

### A3. Token Counter 캐시 최적화

**문제**: 캐시 크기 100으로 장시간 세션에서 히트율 저하. 히트/미스 통계 없음.

**수정**:
```typescript
// src/llm/token-counter.ts 수정

// 1. 캐시 크기 500으로 증가
const TOKEN_CACHE_SIZE = 500;

// 2. 캐시 통계 추적
export interface TokenCacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly hitRate: number;
  readonly size: number;
}

let cacheHits = 0;
let cacheMisses = 0;

export function getTokenCacheStats(): TokenCacheStats {
  const total = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? cacheHits / total : 0,
    size: tokenCache.size,
  };
}
```

**통합**: `/stats` 커맨드에 토큰 캐시 히트율 표시.

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/llm/token-counter.ts` | 캐시 확대 + 통계 | ~20줄 |
| `src/commands/stats.ts` | 캐시 통계 표시 | ~10줄 |
| 테스트 | 신규 | ~15줄 |

---

### A4. Prompt Cache 히트율 모니터링

**문제**: Anthropic prompt caching은 `cache_control` 힌트를 사용하지만, 실제 히트율을 모니터링하지 않음.

**수정**:
```typescript
// src/llm/providers/anthropic.ts — 응답 헤더에서 캐시 통계 추출

// Anthropic 응답의 usage 필드에서:
// cache_creation_input_tokens: 새로 캐시된 토큰
// cache_read_input_tokens: 캐시에서 읽은 토큰
const cacheMetrics = {
  cacheCreated: response.usage?.cache_creation_input_tokens ?? 0,
  cacheRead: response.usage?.cache_read_input_tokens ?? 0,
  savingsPercent: /* 계산 */,
};

events.emit("llm:cache-stats", cacheMetrics);
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/llm/providers/anthropic.ts` | 캐시 통계 추출 | ~15줄 |
| `src/utils/events.ts` | 이벤트 타입 추가 | ~3줄 |
| `src/commands/stats.ts` | 캐시 절감 표시 | ~10줄 |

---

### A5. Adaptive Context Loading (태스크 복잡도 기반 컨텍스트)

**배경**: Context Engineering의 핵심 원칙: "right info at right time". 모든 정보를 항상 로드하지 않고, 태스크 복잡도에 따라 동적으로 결정.

```typescript
// src/core/adaptive-context.ts (신규)

export type TaskComplexity = "simple" | "moderate" | "complex";

/**
 * 사용자 입력을 분석하여 태스크 복잡도를 추정합니다.
 * 복잡도에 따라 시스템 프롬프트에 포함할 컨텍스트 레벨을 결정합니다.
 */
export function estimateTaskComplexity(input: string): TaskComplexity {
  const indicators = {
    simple: /fix typo|rename|update comment|change string|simple/i,
    complex: /refactor|architect|design|migrate|multi.?file|across.*files|전체|리팩터/i,
  };

  if (indicators.complex.test(input)) return "complex";
  if (indicators.simple.test(input)) return "simple";
  return "moderate";
}

/**
 * 복잡도에 따른 컨텍스트 로딩 전략:
 *
 * simple: 시스템 프롬프트 최소화, repo map 제외
 * moderate: 기본 시스템 프롬프트 + repo map
 * complex: 전체 시스템 프롬프트 + repo map + 연관 파일 힌트
 */
export function getContextStrategy(complexity: TaskComplexity): ContextStrategy {
  return CONTEXT_STRATEGIES[complexity];
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/core/adaptive-context.ts` | **신규** | ~80줄 |
| `src/cli/hooks/useAgentLoop.ts` | 복잡도 기반 프롬프트 조정 | ~15줄 |
| 테스트 | 신규 | ~40줄 |

---

## Phase B: Self-Healing Agent Loop (자가 복구 에이전트)

**목표**: Sprint 5의 recovery-strategy.ts를 **실제 실행**하는 자가 복구 루프 구현.

### B1. Recovery Strategy 실행 엔진

**현재 상태**: `recovery-strategy.ts`에 4개 패턴이 정의되어 있으나, `findRecoveryStrategy()`는 전략을 찾기만 하고 **실행하지 않음**.

```typescript
// src/core/recovery-executor.ts (신규)

import { type RecoveryStrategy, findRecoveryStrategy } from "./recovery-strategy.js";
import type { ContextManager } from "./context-manager.js";
import type { AgentLoopConfig } from "./agent-loop.js";

/**
 * 복구 전략을 실제로 실행합니다.
 *
 * "compact": 컨텍스트를 압축한 후 재시도
 * "retry": 지수 백오프로 재시도
 * "fallback-strategy": 도구 호출 전략을 text-parsing으로 전환
 */
export async function executeRecovery(
  strategy: RecoveryStrategy,
  error: Error,
  config: AgentLoopConfig,
  contextManager: ContextManager,
  messages: ChatMessage[],
): Promise<RecoveryResult> {
  switch (strategy.action) {
    case "compact": {
      // 컨텍스트 압축 실행
      const compacted = await contextManager.compact(messages, {
        aggressive: true,
        targetReduction: 0.5, // 50% 감소 목표
      });
      return { action: "retry", messages: compacted, strategyUsed: strategy.description };
    }

    case "fallback-strategy": {
      // text-parsing 전략으로 전환
      return {
        action: "retry",
        overrides: { strategy: "text-parsing" },
        strategyUsed: strategy.description,
      };
    }

    case "retry": {
      // 지수 백오프 대기 후 재시도 신호
      const delay = strategy.backoffMs ?? 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return { action: "retry", strategyUsed: strategy.description };
    }
  }
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/core/recovery-executor.ts` | **신규** | ~80줄 |
| `src/core/agent-loop.ts` | executeRecovery 통합 | ~20줄 |
| 테스트 | 복구 시나리오 | ~60줄 |

---

### B2. 도구 실행 자가 교정 (Tool Retry with Reflection)

**배경**: 저성능 모델이 도구를 잘못 호출하면 현재는 에러 메시지만 반환. 자가 교정 루프가 없음.

```typescript
// src/tools/tool-retry.ts (신규)

/**
 * 도구 실행 실패 시 에러를 분석하여 교정된 재호출을 시도합니다.
 *
 * 1단계: 에러 메시지에서 힌트 추출 (e.g., "file not found" → 경로 교정)
 * 2단계: 교정된 인자로 재시도 (최대 1회)
 * 3단계: 재시도도 실패하면 원본 에러 반환
 */
export async function retryWithCorrection(
  toolName: string,
  originalArgs: Record<string, unknown>,
  error: Error,
  workingDirectory: string,
): Promise<CorrectedToolCall | null> {
  // "No such file" → 글로벌 검색으로 올바른 경로 찾기
  if (/ENOENT|no such file|not found/i.test(error.message)) {
    const filePath = originalArgs.file_path as string | undefined;
    if (filePath) {
      const correctedPath = await findClosestFile(filePath, workingDirectory);
      if (correctedPath) {
        return { args: { ...originalArgs, file_path: correctedPath }, reason: "path-correction" };
      }
    }
  }

  // "Permission denied" → 권한 안내
  if (/EACCES|permission denied/i.test(error.message)) {
    return null; // 자동 교정 불가 — 사용자 안내
  }

  return null;
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/tools/tool-retry.ts` | **신규** | ~60줄 |
| `src/tools/executor.ts` | retry 통합 | ~15줄 |
| 테스트 | 교정 시나리오 | ~40줄 |

---

### B3. Adaptive Context GC (적응형 가비지 컬렉션)

**문제**: `context-manager.ts`의 GC가 고정 주기(10 compaction마다). 짧은 세션에서는 과잉, 긴 세션에서는 부족.

```typescript
// src/core/context-manager.ts 수정

/**
 * 적응형 GC 스케줄링:
 * - 컨텍스트 사용률 < 50%: GC 주기 15회
 * - 컨텍스트 사용률 50-80%: GC 주기 5회
 * - 컨텍스트 사용률 > 80%: 매 compaction마다 GC
 */
private getAdaptiveGcInterval(): number {
  const usage = this.getUsageRatio();
  if (usage > 0.8) return 1;
  if (usage > 0.5) return 5;
  return 15;
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/core/context-manager.ts` | 적응형 GC | ~15줄 |
| 테스트 | GC 주기 검증 | ~20줄 |

---

## Phase C: Security & Observability (보안 + 관측성)

### C1. 엔트로피 기반 시크릿 스캐닝

**문제**: 현재 패턴(regex) 기반만. 엔트로피가 높은 문자열을 놓칠 수 있음.

```typescript
// src/guardrails/entropy-scanner.ts (신규)

/**
 * Shannon 엔트로피로 시크릿 후보를 감지합니다.
 * 높은 엔트로피(>4.5) + 길이(>20) + 변수명 패턴 → 시크릿 의심
 */
export function shannonEntropy(str: string): number {
  const freq = new Map<string, number>();
  for (const ch of str) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function detectHighEntropySecrets(
  content: string,
): readonly SecretCandidate[] {
  const candidates: SecretCandidate[] = [];
  // 변수 할당 패턴에서 값 추출
  const assignmentPattern = /(?:key|secret|token|password|api_key)\s*[:=]\s*["']([^"']{20,})["']/gi;
  for (const match of content.matchAll(assignmentPattern)) {
    const value = match[1];
    const entropy = shannonEntropy(value);
    if (entropy > 4.5) {
      candidates.push({ value: value.slice(0, 8) + "...", entropy, line: getLineNumber(content, match.index!) });
    }
  }
  return candidates;
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/guardrails/entropy-scanner.ts` | **신규** | ~60줄 |
| `src/guardrails/secret-scanner.ts` | 엔트로피 스캔 통합 | ~10줄 |
| 테스트 | 신규 | ~40줄 |

---

### C2. 권한 감사 로그

**문제**: 도구 실행 권한 승인/거부가 기록되지 않음. 규정 준수 환경에서 문제.

```typescript
// src/permissions/audit-log.ts (신규)

export interface AuditEntry {
  readonly timestamp: string;
  readonly sessionId: string;
  readonly toolName: string;
  readonly decision: "approved" | "denied" | "auto-approved";
  readonly reason?: string;
  readonly args?: Record<string, unknown>;
}

/**
 * 권한 결정을 JSONL 파일에 기록합니다.
 * 파일: ~/.dbcode/audit.jsonl (append-only)
 */
export class AuditLogger {
  constructor(private readonly logPath: string) {}

  async log(entry: AuditEntry): Promise<void> {
    const line = JSON.stringify(entry) + "\n";
    await appendFile(this.logPath, line);
  }
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/permissions/audit-log.ts` | **신규** | ~40줄 |
| `src/permissions/manager.ts` | 감사 로그 통합 | ~10줄 |
| 테스트 | 신규 | ~25줄 |

---

### C3. API 키 로그 마스킹

**문제**: pino 로거에 API 키 redaction이 설정되지 않음.

```typescript
// src/utils/logger.ts 수정
import pino from "pino";

export const logger = pino({
  redact: {
    paths: ["apiKey", "*.apiKey", "headers.authorization", "*.token", "*.secret"],
    censor: "[REDACTED]",
  },
});
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/utils/logger.ts` | redaction 설정 | ~8줄 |

---

### C4. 인젝션 탐지 확장

**문제**: 명령 인젝션만 탐지. 프롬프트 인젝션, 경로 탐색 미탐지.

```typescript
// src/guardrails/injection-detector.ts 확장

// 경로 탐색 탐지
const PATH_TRAVERSAL = /\.\.[/\\]/;

// 프롬프트 인젝션 탐지 (LLM 출력에서 도구 호출 위장 시도)
const PROMPT_INJECTION = /(?:ignore.*(?:previous|above|prior)|you are now|new instructions?|system prompt)/i;
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/guardrails/injection-detector.ts` | 패턴 확장 | ~20줄 |
| 테스트 | 인젝션 시나리오 | ~30줄 |

---

### C5. 비샌드박스 실행 경고

**문제**: Windows/미지원 플랫폼에서 bash가 샌드박스 없이 실행되지만 사용자에게 경고하지 않음.

```typescript
// src/sandbox/index.ts 수정
if (!isSandboxAvailable()) {
  process.stderr.write(
    "[warning] Sandbox is not available on this platform. " +
    "Bash commands will execute without isolation. Use with caution.\n"
  );
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/sandbox/index.ts` | 경고 메시지 | ~5줄 |
| `src/commands/doctor.ts` | 샌드박스 상태 체크 추가 | ~10줄 |

---

## Phase D: Developer Experience (개발자 경험)

### D1. /analytics 커맨드 — 세션 분석 대시보드

```typescript
// src/commands/analytics.ts (신규)

/**
 * 세션별 분석 리포트:
 * - 총 토큰 사용량 및 비용
 * - 모델별 토큰 분포
 * - 도구별 사용 빈도 및 성공률
 * - 평균 반복 횟수
 * - 캐시 히트율
 */
export const analyticsCommand: SlashCommand = {
  name: "analytics",
  description: "Show session analytics and usage statistics",
  // ...
};
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/commands/analytics.ts` | **신규** | ~100줄 |
| `src/index.ts` | 커맨드 등록 | ~3줄 |

---

### D2. /doctor 확장 — 런타임 헬스체크

```typescript
// src/commands/doctor.ts 확장

// 추가 체크:
// 1. LLM 연결 테스트 (비스트리밍 API 호출)
// 2. MCP 서버 가용성
// 3. 메모리 사용량 (RSS, heap)
// 4. 세션 락 신선도
// 5. 샌드박스 가용성
// 6. 토큰 캐시 상태
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/commands/doctor.ts` | 런타임 체크 6개 추가 | ~60줄 |

---

### D3. 테스트 커버리지 강화

**목표**: 테스트 커버리지 80%+ 달성.

| 영역 | 현재 | 목표 | 추가 테스트 |
|------|------|------|------------|
| agent-loop 통합 | 기본 happy path | 에러 복구, compaction, 취소 | ~80줄 |
| permissions | 미측정 | 80%+ | ~40줄 |
| guardrails | 미측정 | 80%+ | ~40줄 |
| sandbox | 미측정 | 80%+ | ~30줄 |
| **합계** | | | **~190줄** |

**CI 커버리지 게이트**:
```yaml
# .github/workflows/ci.yml 추가
- name: Coverage gate
  run: |
    npx vitest run --coverage --reporter=json
    node -e "
      const c = require('./coverage/coverage-summary.json');
      const pct = c.total.lines.pct;
      if (pct < 80) { console.error('Coverage ${pct}% < 80%'); process.exit(1); }
    "
```

---

### D4. 업데이트 알림 시스템

```typescript
// src/core/update-checker.ts (신규)

/**
 * 주 1회 npm registry에서 최신 버전을 확인합니다.
 * 비차단, 백그라운드 실행.
 */
export async function checkForUpdates(currentVersion: string): Promise<UpdateInfo | null> {
  const lastCheck = await getLastCheckTimestamp();
  if (Date.now() - lastCheck < 7 * 24 * 60 * 60 * 1000) return null; // 7일 이내

  const latest = await fetchLatestVersion("dbcode");
  await setLastCheckTimestamp(Date.now());

  if (latest && semver.gt(latest, currentVersion)) {
    return { current: currentVersion, latest, updateCommand: "npm update -g dbcode" };
  }
  return null;
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/core/update-checker.ts` | **신규** | ~50줄 |
| `src/index.ts` | 시작 시 백그라운드 체크 | ~5줄 |

---

## 구현 순서 및 일정

### 에이전트 배정 (7명)

```
Agent 1: "stability-core"     → S0-1~S0-5 (안정성 강화 5개)
Agent 2: "adaptive-schema"    → A1 Adaptive Tool Schema + A5 Adaptive Context
Agent 3: "prompt-cache"       → A2 System Prompt Cache + A3 Token Counter + A4 Cache Monitor
Agent 4: "self-healing"       → B1 Recovery Executor + B2 Tool Retry + B3 Adaptive GC
Agent 5: "security-harden"    → C1 Entropy Scanner + C2 Audit Log + C3 Key Masking
Agent 6: "injection-sandbox"  → C4 Injection Extension + C5 Sandbox Warning
Agent 7: "dx-analytics"       → D1 Analytics + D2 Doctor + D3 Coverage + D4 Update Checker
```

### 의존성 그래프

```
Phase 0 (최우선 — Day 1):
  S0-1 (Error Boundary)    ──→ 독립
  S0-2 (Stream Cleanup)    ──→ 독립
  S0-3 (EventEmitter)      ──→ 독립
  S0-4 (Tool Call 검증)    ──→ 독립
  S0-5 (Startup Profiling) ──→ 독립

Phase A (Day 1-2):
  A1 (Adaptive Schema) ──→ Sprint 5 B2 (Tier Budget) 이후
  A2 (Prompt Cache)     ──→ 독립
  A3 (Token Cache)      ──→ 독립
  A4 (Cache Monitor)    ──→ 독립
  A5 (Adaptive Context) ──→ A1 이후

Phase B (Day 2):
  B1 (Recovery Executor) ──→ Sprint 5 C3 (Recovery Strategy) 이후
  B2 (Tool Retry)        ──→ Sprint 5 B3 (Tool Corrector) 이후
  B3 (Adaptive GC)       ──→ 독립

Phase C+D (Day 2-3):
  C1-C5 ──→ 독립 (보안은 다른 모듈에 의존 없음)
  D1-D4 ──→ 독립 (DX는 코어 변경 이후)
```

### 일정

```
Day 1    │  Agent 1 (Phase 0: Stability) — 최우선
         │  Agent 2+3 (Phase A: Adaptive Intelligence) — 병렬
         │  → 안정성 + 적응형 최적화
Day 2    │  Agent 4 (Phase B: Self-Healing)
         │  Agent 5+6 (Phase C: Security)
         │  → 자가 복구 + 보안 강화
Day 3    │  Agent 7 (Phase D: DX)
         │  통합 테스트 + 벤치마크 + 전체 검증
         │  → 3619+ 테스트 통과 + 커밋
```

**총 예상: 3일**

---

## 검증 기준

### Phase 0 검증 (안정성)

- [ ] Error Boundary: 컴포넌트 크래시 시 에러 메시지 표시, 터미널 행 없음
- [ ] Stream Cleanup: 도구 중단 후 child process 스트림 정리 확인
- [ ] EventEmitter: maxListeners 경고 없음 (50회 반복 세션)
- [ ] Tool Call 검증: 불완전한 JSON 도구 호출 필터링됨
- [ ] Startup Profiling: verbose 모드에서 시작 시간 breakdown 표시

### Phase A 검증 (적응형 최적화)

- [ ] LOW tier: 도구 스키마 토큰 60%+ 감소
- [ ] LOW tier: few-shot 예시 포함 확인
- [ ] System Prompt Cache: 두 번째 반복부터 캐시 히트 (재빌드 없음)
- [ ] Token Counter: 캐시 히트율 `/stats`에 표시
- [ ] Prompt Cache: Anthropic 캐시 히트/미스 통계 표시
- [ ] Adaptive Context: simple 태스크에서 repo map 제외

### Phase B 검증 (자가 복구)

- [ ] Context Overflow: 자동 compact 후 재시도 성공
- [ ] Parse Error: text-parsing 전략으로 자동 전환
- [ ] Tool ENOENT: 가장 가까운 파일로 자동 교정
- [ ] GC: 컨텍스트 80%+ 사용 시 매 compaction마다 GC

### Phase C 검증 (보안)

- [ ] Entropy Scanner: 고엔트로피 시크릿 감지 (Shannon > 4.5)
- [ ] Audit Log: 권한 결정이 `~/.dbcode/audit.jsonl`에 기록됨
- [ ] API Key Masking: 로그에 API 키 [REDACTED] 표시
- [ ] Injection: 경로 탐색 (`../../../etc/passwd`) 감지
- [ ] Sandbox Warning: 미지원 플랫폼에서 경고 표시

### Phase D 검증 (DX)

- [ ] `/analytics`: 토큰/비용/도구 사용 통계 표시
- [ ] `/doctor`: LLM 연결, MCP, 메모리, 샌드박스 체크 6개+
- [ ] 테스트 커버리지 80%+ (CI 게이트)
- [ ] 업데이트 알림: 7일마다 체크, 새 버전 시 알림

### 성능 벤치마크

| 시나리오 | 측정 항목 | 목표 |
|---------|----------|------|
| Startup (MCP 없음) | 시간 | ≤200ms |
| System Prompt 재빌드 | 캐시 히트율 | ≥95% (50회 세션) |
| Token Counter | 캐시 히트율 | ≥70% (장시간 세션) |
| Anthropic Prompt Cache | 절감률 | ≥30% |
| LOW tier 도구 스키마 | 토큰 절감 | ≥60% |
| Tool Call Correction + Retry | 성공률 | ≥85% |
| Context Overflow Recovery | 복구 성공률 | ≥90% |

### 회귀 방지

- [ ] 기존 3619+ 테스트 전부 통과
- [ ] TypeScript 에러 0개
- [ ] 빌드 성공
- [ ] Circular dependency 없음 (`madge --circular`)
- [ ] 커버리지 80%+ (신규 모듈)

---

## Sprint 6 이후 — v1.0 릴리스 로드맵

```
Sprint 1: 비용 최적화           ✅ Prompt Caching, Deferred Tools
Sprint 2: UX 완성               ✅ Markdown, Syntax, Streaming, Thinking
Sprint 3: 고급 기능 + 코어 보강 ✅ Plan Mode, MCP HTTP, Worktree, Core
Sprint 4: 완성도 + DX           ✅ Doctor, Bug, Performance, Commands
Sprint 5: 코어 성숙도 + 효율    ✅ Bug Fixes, Module Wiring, Dual-Model, Tier Budgets
Sprint 6: 상용화 + 적응형 지능  ✅ Stability, Adaptive AI, Self-Healing, Security

v1.0 릴리스 준비 상태:
  ✅ Core Architecture — 4-layer, zero circular deps, all modules wired
  ✅ LLM Integration — Multi-provider, dual-model, adaptive thinking, prompt caching
  ✅ Tool System — 18+ built-in, MCP live, deferred loading, call correction + retry
  ✅ Context Management — 3-layer compaction, adaptive GC, repo map, tier budgets
  ✅ Model Efficiency — Adaptive schema, few-shot, prompt cache, context loading
  ✅ Self-Healing — Recovery executor, tool retry, partial stream validation
  ✅ Security — Entropy scanning, audit logging, injection detection, key masking
  ✅ Developer Experience — 42+ commands, analytics, health check, update alerts
  ✅ Production Ready — Error boundary, graceful shutdown, auto-save, CI/CD
  ✅ Testing — 80%+ coverage, CI gates, regression protection

Post v1.0 로드맵:
  - OAuth Device Flow 인증
  - Plugin Marketplace + 매니페스트 시스템
  - VS Code Extension (Language Server Protocol)
  - 사용자 문서 (Getting Started, Configuration Guide)
  - 국제화 (i18n) 완성
  - Performance Dashboard (Grafana 연동)
  - WebSocket 기반 원격 에이전트
```

---

## 웹 리서치 참조

### Context Engineering
- [Context Engineering for Coding Agents — Martin Fowler](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html)
- [Context Engineering: Complete Guide — Vibehackers](https://vibehackers.io/blog/context-engineering-guide)
- [Context Engineering: Complete Guide — MorphLLM](https://www.morphllm.com/context-engineering)
- [Building AI Coding Agents for the Terminal — arXiv](https://arxiv.org/html/2603.05344v1)

### Self-Healing Agent Loop
- [Next-Level Self-Healing: Agents That Fix Their Own Bugs](https://www.sethserver.com/ai/next-level-self-healing-building-agents-that-fix-their-own-bugs.html)
- [How Agent Loop Works: Complete 2026 Guide](https://gleecus.com/blogs/agent-loop-adaptive-ai-agents-complete-guide-2026/)
- [Unrolling the Codex Agent Loop — OpenAI](https://openai.com/index/unrolling-the-codex-agent-loop/)
- [How to Build Self-Improving Coding Agents](https://ericmjl.github.io/blog/2026/1/17/how-to-build-self-improving-coding-agents-part-1/)

### Small Model Optimization
- [Best Open-Source Small Language Models 2026 — BentoML](https://www.bentoml.com/blog/the-best-open-source-small-language-models)
- [Best Local LLMs for Tool Calling & Coding — Clawctl](https://www.clawctl.com/blog/best-local-llm-coding-2026)
- [Best AI Models for Coding — JetBrains](https://blog.jetbrains.com/ai/2026/02/the-best-ai-models-for-coding-accuracy-integration-and-developer-fit/)

### Agent Architecture
- [Claude Code Multiple Agent Systems Guide](https://www.eesel.ai/blog/claude-code-multiple-agent-systems-complete-2026-guide)
- [Codex CLI vs Claude Code Architecture Deep Dive](https://blakecrosley.com/blog/codex-vs-claude-code-2026)
- [Claude AI Agents Architecture & Deployment Guide](https://dextralabs.com/blog/claude-ai-agents-architecture-deployment-guide/)

### Security & Production
- [NPM Security Best Practices — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/NPM_Security_Cheat_Sheet.html)
- [npm Security Best Practices — Snyk](https://snyk.io/articles/npm-security-best-practices-shai-hulud-attack/)
- [AGENTS.md Files Value Review — InfoQ](https://www.infoq.com/news/2026/03/agents-context-file-value-review/)
