# Sprint 7: Production-Ready Core + Maximum Model Efficiency

> **Version**: 1.0
> **Date**: 2026-03-15
> **Base**: Sprint 6 완료 — 3924 tests / 0 TS errors / 198 test files / 22 new modules
> **Scope**: 코어 완성도 + LLM 라우팅 최적화 + KV-Cache 극대화 + 보안 강화 + 미연결 모듈 통합 + v1.0 릴리스 준비

---

## 목차

1. [Sprint 6 완료 현황 및 Sprint 7 동기](#sprint-6-완료-현황-및-sprint-7-동기)
2. [웹 리서치 인사이트 (2026.03)](#웹-리서치-인사이트)
3. [Phase 0: Module Integration (미연결 모듈 통합)](#phase-0-module-integration)
4. [Phase A: Smart LLM Routing (지능형 모델 라우팅)](#phase-a-smart-llm-routing)
5. [Phase B: KV-Cache Maximization (캐시 히트율 극대화)](#phase-b-kv-cache-maximization)
6. [Phase C: Production Core (상용화 코어)](#phase-c-production-core)
7. [Phase D: Security Fortification (보안 요새화)](#phase-d-security-fortification)
8. [Phase E: Low-Model Efficiency (저성능 모델 극대화)](#phase-e-low-model-efficiency)
9. [구현 순서 및 에이전트 배정](#구현-순서-및-에이전트-배정)
10. [검증 기준](#검증-기준)

---

## Sprint 6 완료 현황 및 Sprint 7 동기

### Sprint 6 성과

| 카테고리 | 항목 | 상태 |
|----------|------|------|
| **Phase 0** | S0-1 React Error Boundary | ✅ App.tsx 래핑 |
| | S0-3 EventEmitter 메모리 보호 | ✅ 리스너 누수 감지 |
| | S0-4 도구 호출 JSON 검증 | ✅ filterValidToolCalls |
| | S0-5 시작 프로파일링 | ✅ 9단계 성능 측정 |
| **Phase A** | A1 Adaptive Tool Schema | ✅ HIGH/MEDIUM/LOW 스키마 조정 |
| | A2 System Prompt Cache | ✅ SHA-256 mtime 캐시 |
| | A3 Token Counter 캐시 확대 | ✅ 500개 + hitRate 통계 |
| | A4 Prompt Cache 모니터링 | ✅ llm:cache-stats 이벤트 |
| | A5 Adaptive Context Loading | ✅ 태스크 복잡도 기반 |
| | A6 Lazy Tool Loading | ✅ 온디맨드 스키마 |
| | A7 Structured Output | ✅ 프로바이더별 JSON 강제 |
| **Phase B** | B1 Recovery Executor | ✅ compact/retry/fallback 실행 |
| | B2 Tool Retry | ✅ Levenshtein 경로 교정 |
| | B3 Adaptive GC | ✅ 사용률 기반 동적 주기 |
| | B4 Observation Masking | ✅ 재읽기 가능 출력 마스킹 |
| | B5 Circuit Breaker | ✅ Ralph Loop 패턴 |
| | B6 Code Review Agent | ✅ Generator-Critic 패턴 |
| **Phase C** | C1 Entropy Scanner | ✅ Shannon 엔트로피 감지 |
| | C2 Audit Log | ✅ JSONL 감사 로그 |
| | C3 API Key 마스킹 | ✅ pino redaction 16경로 |
| | C4 Injection 확장 | ✅ 경로 탐색 + 프롬프트 인젝션 |
| | C5 Sandbox 경고 | ✅ 비샌드박스 경고 |
| **Phase D** | D1 /analytics 커맨드 | ✅ 세션 분석 대시보드 |
| | D2 /doctor 확장 | ✅ 12개 헬스체크 |
| | D4 Update Checker | ✅ 주간 npm 체크 |
| **통합** | agent-loop ↔ recovery-executor | ✅ 자동 복구 연결 |
| | agent-loop ↔ circuit-breaker | ✅ 무진전 감지 |
| | agent-loop ↔ observation-masking | ✅ 토큰 절감 |
| | permissions ↔ audit-log | ✅ 감사 로깅 |

**총 변경**: 22개 deliverable, 14개 신규 모듈, 3924 테스트 통과

### Sprint 7이 필요한 이유

Sprint 6은 **모듈 구현과 기본 통합**을 완료했습니다. Sprint 7은 **실제 상용화**를 위한 최종 스프린트입니다:

1. **미연결 모듈 잔존**: Sprint 6에서 생성된 adaptive-schema, adaptive-context, lazy-tool-loader, structured-output 등이 생성만 되고 메인 플로우에 깊이 통합되지 않음
2. **고아 모듈**: cost-tracker.ts (139줄), persistent-store.ts (316줄)이 여전히 미사용
3. **LLM 라우팅 부재**: 태스크 복잡도에 따라 모델을 동적으로 선택하는 시스템이 없음 (16x 효율 개선 가능)
4. **KV-Cache 최적화 부재**: Anthropic 프롬프트 캐싱 히트율 극대화를 위한 시스템 프롬프트 안정화 미구현
5. **보안 갭**: AI IDE 37개 취약점 공개 (2026.03) — MCP 인증, 도구 실행 격리 강화 필요
6. **저성능 모델 지원 부족**: Speculative Decoding, Model Cascading, 토큰 최적화 미구현

---

## 웹 리서치 인사이트

| # | 트렌드 | 출처 | 핵심 수치 | dbcode 적용 |
|---|--------|------|-----------|-------------|
| 1 | **LLM Routing** — 복잡도별 모델 자동 선택 | emergentmind.com, Springer | **16x 효율 개선** | → A1: Smart Router |
| 2 | **KV-Cache 최적화** — Manus의 캐시 안정화 패턴 | manus.im, Anthropic | **10x 비용 절감** (캐시 히트 시) | → B1: Stable Prefix |
| 3 | **Observation Masking** — 최근 10턴 윈도우 최적 | JetBrains/NeurIPS 2025 | 비용 50% 감소, 품질 유지 | Sprint 6 ✅ 구현 완료 |
| 4 | **Planner-Worker-Judge** — 계층형 멀티에이전트 | Cursor 실패 사례, Anthropic | 병렬 실행 성공 | → A3: Task Router |
| 5 | **Speculative Decoding** — 소형 모델 추측 생성 | Google Research, vLLM | **1.5-4x 속도 향상** | → E1: Speculative Mode |
| 6 | **AI IDE 보안 37건 취약점** | DEV Community, HackerNews | RCE, 데이터 유출 가능 | → D1-D3: 보안 강화 |
| 7 | **Repository Map** — tree-sitter + PageRank | Aider | 동적 토큰 예산 최적화 | → E3: Enhanced Repo Map |
| 8 | **캐시 미스 = 프로덕션 인시던트** | Anthropic 엔지니어링 | 캐시 설계가 아키텍처 결정 | → B2: Cache-Aware Architecture |
| 9 | **Model Selection = 최고 ROI** | Medium (2026) | 잘못된 선택 $100k+/월 | → A1: Smart Router |
| 10 | **62% AI 코드 보안 취약** | CSA (Cloud Security Alliance) | 디자인 결함 + 알려진 취약점 | → D4: Code Security Scan |

---

## Phase 0: Module Integration (미연결 모듈 통합)

**목표**: 생성만 되고 사용되지 않는 모듈을 메인 플로우에 완전 연결하거나 제거.

### I0-1. Adaptive Schema → Tool Registry 통합

**현재**: `adaptive-schema.ts`가 존재하지만 registry에서 호출되지 않음.

**수정**:
```typescript
// src/tools/registry.ts — getDefinitionsForLLM()에 tier 기반 스키마 적응 추가
import { adaptToolSchema } from "./adaptive-schema.js";

getDefinitionsForLLM(tier?: CapabilityTier): ToolDefinitionForLLM[] {
  const defs = [...this.tools.values()].map(t => this.toDefinitionForLLM(t));
  if (!tier || tier === "high") return defs;
  return defs.map(d => adaptToolSchema(d.name, d.description, d.parameters, tier, this.workingDirectory));
}
```

### I0-2. Adaptive Context → System Prompt Builder 통합

**현재**: `adaptive-context.ts`가 존재하지만 시스템 프롬프트 빌드에서 사용되지 않음.

**수정**: `system-prompt-builder.ts`에서 TaskComplexity를 받아 컨텍스트 전략에 따라 프롬프트 섹션 포함/제외.

### I0-3. Lazy Tool Loader → Agent Loop 통합

**현재**: `lazy-tool-loader.ts`가 존재하지만 에이전트 루프에서 사용하지 않음.

**수정**: MEDIUM/LOW tier에서 도구 스키마 lazy loading 활성화. 모델이 도구를 선택할 때 전체 스키마 fetch.

### I0-4. Structured Output → Provider Chain 통합

**현재**: `structured-output.ts`가 존재하지만 LLM 프로바이더에서 사용하지 않음.

**수정**: `openai-compatible.ts` 프로바이더에서 LOW/MEDIUM tier 모델의 도구 호출 시 structured output config 적용.

### I0-5. 고아 모듈 정리

- **cost-tracker.ts** (139줄): `/cost` 커맨드와 통합하거나 제거
- **persistent-store.ts** (316줄): `PermissionManager`와 통합하거나 제거

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/tools/registry.ts` | adaptToolSchema 통합 | ~15줄 |
| `src/core/system-prompt-builder.ts` | adaptive context 통합 | ~20줄 |
| `src/core/agent-loop.ts` | lazy tool loader 통합 | ~15줄 |
| `src/llm/providers/openai-compatible.ts` | structured output 통합 | ~10줄 |
| 고아 모듈 | 통합 또는 제거 | ~50줄 |

---

## Phase A: Smart LLM Routing (지능형 모델 라우팅)

**목표**: 태스크 복잡도에 따라 모델을 동적으로 선택하여 비용/성능 최적화.

### A1. Task-Based Model Router

**배경**: LLM 라우팅 연구에 따르면 복잡도별 모델 배정으로 **16x 효율 개선** 가능.

```typescript
// src/llm/task-router.ts (신규)

export interface RoutingDecision {
  readonly model: string;
  readonly reason: string;
  readonly estimatedCost: number;
}

/**
 * 태스크 복잡도 + 사용 가능한 모델 목록을 기반으로 최적 모델을 선택합니다.
 *
 * simple: 최저 비용 모델 (Haiku, Phi-4, Qwen3-8B 등)
 * moderate: 기본 모델 (Sonnet, GPT-4o-mini 등)
 * complex: 최고 성능 모델 (Opus, GPT-4o, Claude Sonnet 4.5 등)
 */
export class TaskRouter {
  constructor(
    private readonly availableModels: readonly ModelConfig[],
    private readonly defaultModel: string,
  ) {}

  route(complexity: TaskComplexity, taskType?: TaskType): RoutingDecision
  estimateSavings(history: readonly RoutingDecision[]): CostSavings
}
```

### A2. Dual-Model Router 확장 — 3-Phase Routing

**현재**: architect/editor 2-phase만 지원. review phase 추가.

```typescript
// src/llm/dual-model-router.ts 확장
// architect → editor → reviewer 3-phase 지원
export type AgentPhase = "planning" | "executing" | "reviewing";
```

### A3. Model Cascading (폴백 체인)

```typescript
// src/llm/model-cascade.ts (신규)

/**
 * 모델 장애 시 자동 폴백 체인:
 * primary → secondary → tertiary
 *
 * 예: Claude Sonnet → GPT-4o-mini → Ollama local
 * Rate limit 429 시 자동 다음 모델로 전환
 */
export class ModelCascade {
  constructor(models: readonly CascadeEntry[])
  async callWithFallback(request: ChatRequest): Promise<ChatResponse>
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/llm/task-router.ts` | **신규** | ~120줄 |
| `src/llm/dual-model-router.ts` | 3-phase 확장 | ~30줄 |
| `src/llm/model-cascade.ts` | **신규** | ~80줄 |
| 테스트 | 신규 | ~100줄 |

---

## Phase B: KV-Cache Maximization (캐시 히트율 극대화)

**목표**: Manus/Anthropic 연구 기반으로 KV-Cache 히트율 극대화 → 10x 비용 절감.

### B1. Stable System Prompt Prefix

**배경**: Anthropic은 캐시 미스를 **프로덕션 인시던트**로 취급합니다. 시스템 프롬프트 앞부분의 단 1토큰 변경이 전체 캐시를 무효화합니다.

```typescript
// src/core/stable-prefix.ts (신규)

/**
 * 시스템 프롬프트를 stable/dynamic 섹션으로 분리합니다.
 *
 * Stable (캐시 가능, 변경 불가):
 * - 기본 인스트럭션
 * - 도구 정의
 * - 프로젝트 컨벤션 (DBCODE.md)
 *
 * Dynamic (매 요청 변경 가능):
 * - 현재 날짜/시간 (끝에 배치!)
 * - 최근 파일 변경 목록
 * - 컨텍스트 사용률
 *
 * 핵심 원칙: 동적 정보는 항상 프롬프트 끝에 배치하여 캐시 무효화 방지
 */
export function buildStablePrefix(instructions: string, tools: ToolDef[]): string
export function buildDynamicSuffix(context: DynamicContext): string
```

### B2. Append-Only Context Strategy

**배경**: Manus의 핵심 교훈: "컨텍스트를 append-only로 유지하라. 이전 액션/관찰을 수정하지 마라."

```typescript
// src/core/append-only-context.ts (신규)

/**
 * 컨텍스트 직렬화의 결정론적 보장:
 * - 도구 호출 결과의 직렬화 순서 고정
 * - 메시지 ID 기반 정렬 (삽입 순서 의존 제거)
 * - 이전 메시지 수정 금지 (마스킹은 append로 표현)
 */
export function serializeContextDeterministic(
  messages: readonly ChatMessage[]
): readonly ChatMessage[]
```

### B3. Cache Breakpoint Optimization

```typescript
// src/llm/cache-breakpoints.ts (신규)

/**
 * Anthropic cache_control breakpoint 최적화:
 * - 시스템 프롬프트 끝에 ephemeral breakpoint
 * - DBCODE.md 블록 끝에 breakpoint
 * - 도구 정의 블록 끝에 breakpoint
 * - 최대 4개 breakpoint (Anthropic 제한)
 */
export function optimizeCacheBreakpoints(
  systemBlocks: readonly ContentBlock[]
): readonly ContentBlock[]
```

### B4. Cache Hit Rate Dashboard

`/stats` 커맨드에 캐시 히트율 시각화 추가.

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/core/stable-prefix.ts` | **신규** | ~80줄 |
| `src/core/append-only-context.ts` | **신규** | ~60줄 |
| `src/llm/cache-breakpoints.ts` | **신규** | ~50줄 |
| `src/commands/stats.ts` | 캐시 대시보드 | ~30줄 |
| 테스트 | 신규 | ~80줄 |

---

## Phase C: Production Core (상용화 코어)

**목표**: v1.0 릴리스를 위한 코어 안정성과 운영 도구 완성.

### C1. Rate Limiter (사전적 속도 제한)

**현재**: 429 응답에 반응만 함. 사전에 요청 속도를 제어하지 않음.

```typescript
// src/llm/rate-limiter.ts (신규)

/**
 * Token Bucket 기반 사전적 속도 제한.
 * 프로바이더별 RPM/TPM 제한에 맞춰 요청을 큐잉합니다.
 *
 * Anthropic: 4000 RPM, 400K TPM
 * OpenAI: 500 RPM, 200K TPM
 * Ollama: 무제한 (로컬)
 */
export class RateLimiter {
  constructor(config: RateLimitConfig)
  async acquire(estimatedTokens: number): Promise<void>  // 블로킹 대기
  getQueueDepth(): number
  getUtilization(): number
}
```

### C2. Crash Reporter (경량 에러 수집)

```typescript
// src/telemetry/crash-reporter.ts (신규)

/**
 * 경량 크래시 리포팅:
 * - 스택 트레이스 수집 + 에러 그룹핑 (메시지 해시)
 * - 로컬 파일 저장 (~/.dbcode/crashes/)
 * - opt-in 텔레메트리 시 OTLP 전송
 * - 민감 정보 자동 제거 (파일 경로 해시화, API 키 마스킹)
 */
export class CrashReporter {
  report(error: Error, context?: CrashContext): Promise<void>
  getRecentCrashes(limit?: number): Promise<readonly CrashEntry[]>
}
```

### C3. Health Monitor (실시간 헬스 모니터)

```typescript
// src/core/health-monitor.ts (신규)

/**
 * 장시간 세션의 실시간 헬스 모니터링:
 * - 메모리 사용량 (RSS, heap) 주기적 체크
 * - EventEmitter 리스너 누수 감지
 * - 토큰 캐시 히트율 추적
 * - GC 주기 이상 감지
 * - 임계값 초과 시 경고 이벤트 발행
 */
export class HealthMonitor {
  start(intervalMs?: number): void
  stop(): void
  getSnapshot(): HealthSnapshot
}
```

### C4. Graceful Degradation (우아한 성능 저하)

```typescript
// src/core/graceful-degradation.ts (신규)

/**
 * 시스템 리소스 부족 시 자동 성능 저하:
 * - 메모리 80%+: aggressive compaction 활성화
 * - 토큰 버짓 90%+: repo map 제거, 도구 스키마 최소화
 * - API 장애: 캐시된 응답 반환 (가능한 경우)
 */
export function applyGracefulDegradation(
  healthSnapshot: HealthSnapshot,
  config: AgentLoopConfig,
): DegradationResult
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/llm/rate-limiter.ts` | **신규** | ~80줄 |
| `src/telemetry/crash-reporter.ts` | **신규** | ~70줄 |
| `src/core/health-monitor.ts` | **신규** | ~60줄 |
| `src/core/graceful-degradation.ts` | **신규** | ~50줄 |
| 테스트 | 신규 | ~100줄 |

---

## Phase D: Security Fortification (보안 요새화)

**목표**: 2026.03 공개된 AI IDE 37건 취약점 대응 + MCP 보안 강화.

### D1. MCP Server Authentication

**배경**: 2026.07 스캔에서 1,862개 MCP 서버가 인증 없이 인터넷에 노출됨.

```typescript
// src/mcp/auth-validator.ts (신규)

/**
 * MCP 서버 연결 시 인증 상태 검증:
 * - TLS/SSL 인증서 확인
 * - 인증 토큰 유효성 검사
 * - 미인증 서버 접속 시 경고 + 사용자 확인 요구
 */
export function validateMCPAuth(serverConfig: MCPServerConfig): AuthValidationResult
```

### D2. Tool Execution Isolation

```typescript
// src/sandbox/tool-isolation.ts (신규)

/**
 * 도구별 실행 격리 강화:
 * - bash_exec: 파일시스템 접근 범위 제한 (cwd + 하위만)
 * - file_write: 허용 경로 화이트리스트
 * - web_fetch: 도메인 화이트리스트 + 로컬 네트워크 차단
 */
export function createToolSandbox(
  toolName: string,
  workingDirectory: string,
  allowList?: readonly string[],
): ToolSandboxConfig
```

### D3. Security Prompting Integration

**배경**: Anthropic 연구에 따르면 보안 리마인더 프롬프트만으로 보안 코드 비율이 56% → 66%로 향상.

```typescript
// src/core/security-prompt.ts (신규)

/**
 * 코드 생성 시 보안 리마인더 자동 주입:
 * - file_write/file_edit 도구 호출 전 보안 체크리스트 포함
 * - OWASP Top 10 패턴 경고
 * - 시크릿 하드코딩 방지 안내
 */
export function buildSecurityReminder(toolName: string, fileType: string): string
```

### D4. Generated Code Security Scan

```typescript
// src/guardrails/code-security-scan.ts (신규)

/**
 * AI 생성 코드의 보안 취약점 자동 스캔 (도구 실행 후):
 * - SQL 인젝션 패턴 (string concatenation in queries)
 * - XSS 패턴 (dangerouslySetInnerHTML, innerHTML)
 * - 하드코딩된 자격 증명
 * - 안전하지 않은 암호화 (MD5, SHA1)
 * - eval() / Function() 사용
 */
export function scanGeneratedCode(
  code: string,
  language: string,
): readonly SecurityFinding[]
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/mcp/auth-validator.ts` | **신규** | ~60줄 |
| `src/sandbox/tool-isolation.ts` | **신규** | ~70줄 |
| `src/core/security-prompt.ts` | **신규** | ~50줄 |
| `src/guardrails/code-security-scan.ts` | **신규** | ~80줄 |
| 테스트 | 신규 | ~100줄 |

---

## Phase E: Low-Model Efficiency (저성능 모델 극대화)

**목표**: Qwen3-8B, Phi-4, Gemma 3, Llama 4 등 소형 모델에서도 최대 개발 효율 달성.

### E1. Speculative Mode (추측 생성 모드)

**배경**: Google Research의 Speculative Decoding으로 **1.5-4x 속도 향상** 가능.

```typescript
// src/llm/speculative-mode.ts (신규)

/**
 * 소형+대형 모델 조합의 추측 생성:
 * 1. 소형 모델이 N개 토큰 추측 생성
 * 2. 대형 모델이 한 번에 검증/수정
 * 3. 검증 통과 토큰은 즉시 출력
 *
 * 적용 조건: dual-model 구성 시 자동 활성화
 * 효과: 응답 시간 30-40% 감소, 메모리 ~50% 절감
 */
export class SpeculativeDecoder {
  constructor(
    draftModel: LLMProvider,
    verifyModel: LLMProvider,
    options?: { readonly lookAhead?: number },
  )
  async generate(request: ChatRequest): Promise<ChatResponse>
}
```

### E2. Token Budget Optimizer

```typescript
// src/llm/token-budget-optimizer.ts (신규)

/**
 * 소형 모델의 제한된 컨텍스트 윈도우 최적화:
 * - 8K 컨텍스트: 시스템 프롬프트 2K + 대화 4K + 도구 2K
 * - 16K 컨텍스트: 시스템 4K + 대화 8K + 도구 4K
 * - 32K+ 컨텍스트: 전체 기능 활성화
 *
 * 각 예산 내에서 정보 밀도를 최대화합니다.
 */
export class TokenBudgetOptimizer {
  constructor(maxContextTokens: number)
  allocate(sections: readonly PromptSection[]): readonly AllocatedSection[]
  getUtilization(): number
}
```

### E3. Enhanced Repository Map (tree-sitter 연동)

**배경**: Aider의 Repository Map 패턴은 tree-sitter로 AST를 파싱하고 PageRank로 심볼 중요도를 산정합니다.

```typescript
// src/core/enhanced-repo-map.ts (신규)

/**
 * 향상된 저장소 맵:
 * - tree-sitter로 함수/클래스 시그니처 추출
 * - 의존성 그래프 구축 + PageRank 중요도 산정
 * - 토큰 예산 내에서 최적 심볼 선택
 * - 현재 작업 파일과의 관련성 기반 동적 포함
 *
 * 효과: 소형 모델에서도 정확한 코드 네비게이션
 */
export class EnhancedRepoMap {
  constructor(workingDirectory: string, options?: RepoMapOptions)
  async buildMap(tokenBudget: number): Promise<string>
  async getRelevantSymbols(filePath: string, tokenBudget: number): Promise<string>
}
```

### E4. Few-Shot Example Bank

```typescript
// src/tools/few-shot-bank.ts (신규)

/**
 * 도구별 few-shot 예시 라이브러리:
 * - 각 도구에 대해 2-5개의 성공적인 호출 예시
 * - 사용자 세션에서 성공 패턴 학습 (opt-in)
 * - 모델 tier에 따라 예시 수 조절 (LOW: 5개, MEDIUM: 2개, HIGH: 0개)
 *
 * 효과: 소형 모델 도구 호출 성공률 +20% 향상
 */
export class FewShotBank {
  getExamples(toolName: string, tier: CapabilityTier): readonly FewShotExample[]
  recordSuccess(toolName: string, args: Record<string, unknown>, result: string): void
}
```

### E5. Streaming Response Accelerator

```typescript
// src/llm/stream-accelerator.ts (신규)

/**
 * 스트리밍 응답 가속:
 * - 첫 토큰까지의 시간(TTFT) 최적화
 * - 로컬 모델 워밍업 (첫 요청 전 dummy 호출)
 * - 청크 버퍼링으로 UI 깜빡임 방지
 * - 인터-토큰 레이턴시(ITL) 모니터링
 */
export class StreamAccelerator {
  warmup(provider: LLMProvider, model: string): Promise<void>
  monitorLatency(stream: AsyncIterable<ChatChunk>): AsyncIterable<ChatChunk & LatencyInfo>
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/llm/speculative-mode.ts` | **신규** | ~100줄 |
| `src/llm/token-budget-optimizer.ts` | **신규** | ~80줄 |
| `src/core/enhanced-repo-map.ts` | **신규** | ~120줄 |
| `src/tools/few-shot-bank.ts` | **신규** | ~70줄 |
| `src/llm/stream-accelerator.ts` | **신규** | ~60줄 |
| 테스트 | 신규 | ~150줄 |

---

## 구현 순서 및 에이전트 배정

### 에이전트 배정 (7명)

```
Agent 1: "module-integrator"     → I0-1~I0-5 (미연결 모듈 통합 5개)
Agent 2: "smart-router"          → A1 Task Router + A2 3-Phase + A3 Model Cascade
Agent 3: "cache-maximizer"       → B1 Stable Prefix + B2 Append-Only + B3 Cache Breakpoints + B4 Dashboard
Agent 4: "production-core"       → C1 Rate Limiter + C2 Crash Reporter + C3 Health Monitor + C4 Graceful Degradation
Agent 5: "security-fortress"     → D1 MCP Auth + D2 Tool Isolation + D3 Security Prompt + D4 Code Scan
Agent 6: "model-efficiency"      → E1 Speculative Mode + E2 Token Budget + E3 Enhanced Repo Map
Agent 7: "low-model-dx"          → E4 Few-Shot Bank + E5 Stream Accelerator + 테스트 커버리지 강화
```

### 의존성 그래프

```
Phase 0 (최우선 — Day 1):
  I0-1~I0-5 (모듈 통합) ──→ 독립 (다른 Phase의 기반)

Phase A (Day 1-2):
  A1 (Task Router) ──→ Sprint 6 A5 (Adaptive Context) 이후
  A2 (3-Phase Router) ──→ Sprint 5 Dual-Model Router 이후
  A3 (Model Cascade) ──→ A1 이후

Phase B (Day 1-2):
  B1 (Stable Prefix) ──→ Sprint 6 A2 (System Prompt Cache) 이후
  B2 (Append-Only) ──→ 독립
  B3 (Cache Breakpoints) ──→ B1 이후
  B4 (Dashboard) ──→ B1 + Sprint 6 A4 (Cache Monitor) 이후

Phase C (Day 2-3):
  C1-C4 ──→ 독립 (인프라 모듈)

Phase D (Day 2-3):
  D1-D4 ──→ 독립 (보안 모듈)

Phase E (Day 2-3):
  E1 (Speculative) ──→ Sprint 5 Dual-Model Router 이후
  E2 (Token Budget) ──→ 독립
  E3 (Enhanced Repo Map) ──→ 독립
  E4 (Few-Shot) ──→ Sprint 6 A1 (Adaptive Schema) 이후
  E5 (Stream Accelerator) ──→ 독립
```

### 일정

```
Day 1    │  Agent 1 (Phase 0: 모듈 통합) — 최우선
         │  Agent 2+3 (Phase A+B: 라우팅 + 캐시) — 병렬
Day 2    │  Agent 4+5 (Phase C+D: 프로덕션 + 보안) — 병렬
         │  Agent 6 (Phase E 전반: 효율) — 병렬
Day 3    │  Agent 7 (Phase E 후반 + 테스트) — 통합
         │  전체 검증 + 벤치마크 + 커밋
```

**총 예상: 3일**

---

## 검증 기준

### Phase 0 검증 (모듈 통합)

- [ ] adaptive-schema: LOW tier에서 도구 스키마 토큰 60%+ 감소 확인
- [ ] adaptive-context: simple 태스크에서 repo map 제외 확인
- [ ] lazy-tool-loader: MEDIUM/LOW tier에서 lazy loading 동작 확인
- [ ] structured-output: Ollama 모델에서 JSON 출력 100% 유효
- [ ] 고아 모듈: cost-tracker/persistent-store 통합 또는 제거 완료

### Phase A 검증 (LLM 라우팅)

- [ ] Task Router: simple 태스크에 저비용 모델 자동 배정
- [ ] 3-Phase Router: planning → executing → reviewing 전환 확인
- [ ] Model Cascade: 429 에러 시 자동 폴백 모델 전환

### Phase B 검증 (KV-Cache)

- [ ] Stable Prefix: 동적 정보가 프롬프트 끝에 배치됨 확인
- [ ] Append-Only: 이전 메시지 수정 없이 마스킹 동작
- [ ] Cache Breakpoints: Anthropic 캐시 히트율 50%+ 달성
- [ ] `/stats`에 캐시 히트율 시각화 표시

### Phase C 검증 (프로덕션)

- [ ] Rate Limiter: RPM/TPM 제한 내 요청 큐잉 확인
- [ ] Crash Reporter: 에러 발생 시 ~/.dbcode/crashes/ 기록
- [ ] Health Monitor: RSS 512MB 초과 시 경고 발행
- [ ] Graceful Degradation: 메모리 80%+ 시 aggressive compaction 활성화

### Phase D 검증 (보안)

- [ ] MCP Auth: 미인증 서버 접속 시 경고 표시
- [ ] Tool Isolation: bash_exec에서 cwd 외부 접근 차단
- [ ] Security Prompt: file_write 시 보안 리마인더 주입
- [ ] Code Security: SQL 인젝션/XSS 패턴 감지 확인

### Phase E 검증 (저성능 모델)

- [ ] Speculative Mode: dual-model 구성 시 30%+ 속도 향상
- [ ] Token Budget: 8K 컨텍스트 모델에서 정상 동작
- [ ] Enhanced Repo Map: 토큰 예산 내 최적 심볼 선택
- [ ] Few-Shot Bank: LOW tier 도구 호출 성공률 +20%
- [ ] Stream Accelerator: TTFT + ITL 모니터링 확인

### 성능 벤치마크

| 시나리오 | 측정 항목 | 목표 |
|---------|----------|------|
| KV-Cache 히트율 | Anthropic 프롬프트 캐시 | ≥50% (10회 반복) |
| Task Router 절감 | 비용 절감률 | ≥30% (mixed 태스크) |
| Speculative Decoding | 응답 속도 | ≥30% 향상 |
| LOW tier 도구 성공률 | 도구 호출 성공 | ≥85% |
| Rate Limiter | 429 에러 발생률 | ≤5% |
| Startup (MCP 없음) | 시간 | ≤200ms |

### 회귀 방지

- [ ] 기존 3924+ 테스트 전부 통과
- [ ] TypeScript 에러 0개
- [ ] 빌드 성공
- [ ] Circular dependency 없음
- [ ] 커버리지 80%+ (신규 모듈)

---

## Sprint 7 이후 — v1.0 릴리스 체크리스트

```
Sprint 1: 비용 최적화           ✅
Sprint 2: UX 완성               ✅
Sprint 3: 고급 기능 + 코어 보강 ✅
Sprint 4: 완성도 + DX           ✅
Sprint 5: 코어 성숙도 + 효율    ✅
Sprint 6: 상용화 + 적응형 지능  ✅
Sprint 7: 코어 완성 + 모델 효율 ✅ (계획)

v1.0 릴리스 체크리스트:
  ✅ Core: 4-layer, zero circular deps, all modules wired
  ✅ LLM: Multi-provider, dual→tri-model, adaptive, prompt caching
  ✅ Tools: 18+ built-in, MCP, deferred, correction, retry, lazy loading
  ✅ Context: 3-layer compaction, adaptive GC, observation masking, KV-cache optimized
  ✅ Model Efficiency: Task routing, speculative decoding, few-shot, token budget
  ✅ Self-Healing: Recovery executor, circuit breaker, model cascade
  ✅ Security: Entropy scan, audit log, injection detection, tool isolation, code scan
  ✅ DX: 44+ commands, analytics, health monitor, update alerts
  ✅ Production: Rate limiter, crash reporter, graceful degradation
  ✅ Testing: 80%+ coverage, CI gates, regression protection

Post v1.0:
  - OAuth Device Flow + Team 인증
  - Plugin Marketplace + 매니페스트 시스템
  - VS Code Extension (LSP)
  - WebSocket 원격 에이전트
  - 국제화 (i18n) 완성
  - Performance Dashboard (Grafana 연동)
  - Custom SLM Fine-Tuning 지원
```

---

## 웹 리서치 참조

### LLM Routing & Model Selection
- [The Model Selection Trap: Choosing the Right LLM (2026)](https://medium.com/@nraman.n6/the-model-selection-trap-choosing-the-right-llm-for-agentic-systems-2026-be2817c2e533)
- [LLM Routers: Optimizing Model Selection](https://www.emergentmind.com/topics/llm-routers)
- [Data-Augmented Model Routing — Springer](https://link.springer.com/article/10.1007/s11227-025-08034-8)

### KV-Cache & Context Engineering
- [Context Engineering for AI Agents: Lessons from Manus](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)
- [Anthropic Says Cache Misses Are Production Incidents](https://www.implicator.ai/anthropic-says-cache-misses-are-production-incidents-reveals-caching-shaped-claude-code/)
- [KV-Cache Aware Prompt Engineering](https://ankitbko.github.io/blog/2025/08/prompt-engineering-kv-cache/)
- [The Complexity Trap: Simple Observation Masking — NeurIPS 2025](https://arxiv.org/html/2508.21433v1)

### Multi-Agent Architecture
- [AI Coding Agents in 2026: Coherence Through Orchestration | Mike Mason](https://mikemason.ca/writing/ai-coding-agents-jan-2026/)
- [Why Your Multi-Agent System is Failing: 17x Error Trap — TDS](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/)
- [Google's Eight Essential Multi-Agent Design Patterns — InfoQ](https://www.infoq.com/news/2026/01/multi-agent-design-patterns/)
- [2026 Agentic Coding Trends Report — Anthropic](https://resources.anthropic.com/2026-agentic-coding-trends-report)

### Security
- [37 Vulnerabilities Exposed Across 15 AI IDEs — DEV Community](https://dev.to/uenyioha/37-vulnerabilities-exposed-across-15-ai-ides-the-threat-model-every-agent-builder-must-understand-3f5)
- [30+ Flaws in AI Coding Tools (IDEsaster) — The Hacker News](https://thehackernews.com/2025/12/researchers-uncover-30-flaws-in-ai.html)
- [Security Risks in AI-Generated Code — CSA](https://cloudsecurityalliance.org/blog/2025/07/09/understanding-security-risks-in-ai-generated-code)

### Speculative Decoding & Performance
- [Speculative Cascades — Google Research](https://research.google/blog/speculative-cascades-a-hybrid-approach-for-smarter-faster-llm-inference/)
- [How Speculative Decoding Boosts vLLM by 2.8x](https://blog.vllm.ai/2024/10/17/spec-decode.html)
- [LLM Latency Benchmark 2026 — AI Multiple](https://research.aimultiple.com/llm-latency-benchmark/)

### Developer Experience & Trends
- [Cursor vs Windsurf vs Claude Code 2026 — DEV Community](https://dev.to/pockit_tools/cursor-vs-windsurf-vs-claude-code-in-2026-the-honest-comparison-after-using-all-three-3gof)
- [AI Dev Tool Power Rankings March 2026 — LogRocket](https://blog.logrocket.com/ai-dev-tool-power-rankings/)
- [Best AI Coding Agents 2026 — Faros AI](https://www.faros.ai/blog/best-ai-coding-agents-2026)
