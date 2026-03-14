# Sprint 5: Core Maturity + Model Efficiency (Production Readiness & Low-Model Optimization)

> **Version**: 1.0
> **Date**: 2026-03-14
> **Base**: Sprint 4 완료 — /doctor 8+체크, /bug, /stats 강화, /diff 직접출력, /context 실데이터, /export 보강, /cost 상세
> **Scope**: 코어 성숙도 + 상용화 준비 + 저성능 모델 최적화 + 개발 효율 극대화

---

## 목차

1. [Sprint 5 범위 선정](#sprint-5-범위-선정)
2. [M1. Dual-Model Architecture (Architect/Editor 패턴)](#m1-dual-model-architecture)
3. [M2. Smart Context Engineering](#m2-smart-context-engineering)
4. [M3. Repo Map — 저성능 모델을 위한 코드베이스 인덱싱](#m3-repo-map)
5. [M4. Adaptive Prompt Compression](#m4-adaptive-prompt-compression)
6. [M5. Production Hardening](#m5-production-hardening)
7. [M6. CI/CD Pipeline + npm Publish 준비](#m6-cicd-pipeline)
8. [M7. Model-Aware Tool Optimization](#m7-model-aware-tool-optimization)
9. [구현 순서 및 일정](#구현-순서-및-일정)
10. [검증 기준](#검증-기준)

---

## Sprint 5 범위 선정

### 프로젝트 현황 (Sprint 4 완료 후)

| 항목 | 수치 | 비고 |
|------|------|------|
| 소스 파일 | ~230개 | src/ 전체 |
| 테스트 파일 | ~180개 | test/ 전체 |
| 커맨드 수 | **36개** | /bug 추가 |
| 테스트 커버리지 | ~70% | commands 갭 대폭 축소 |
| 지원 프로바이더 | Anthropic + OpenAI Compatible | 2개 |

### 핵심 과제: "낮은 성능 모델에서도 최대 효율"

웹 리서치 결과, 2026년 AI 코딩 에이전트 트렌드는 다음과 같습니다:

1. **Dual-Model Architecture**: Aider의 Architect/Editor 패턴 — 추론 모델이 계획하고, 저렴한 모델이 실행
2. **Context Engineering**: Martin Fowler가 강조 — "에이전트의 효과성은 너무 많은 컨텍스트에서 떨어진다"
3. **Repo Map**: Aider의 핵심 기술 — 전체 코드베이스 구조를 토큰-효율적으로 LLM에 전달
4. **Token Economy**: 턴당 비용, 출력 비율, 첫 패스 성공률이 핵심 메트릭
5. **Adaptive Reasoning**: 작업 복잡도에 따라 thinking budget을 동적 조정

> 참조:
> - [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)
> - [Context Engineering for Coding Agents (Martin Fowler)](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html)
> - [Aider Architecture](https://aider.chat/)
> - [Claude Code Model Configuration](https://code.claude.com/docs/en/model-config)
> - [State of AI Coding Agents 2026](https://medium.com/@dave-patten/the-state-of-ai-coding-agents-2026)
> - [Local AI Models 2026](https://almira19.medium.com/local-ai-models-that-can-compete-with-premium-coding-assistants-in-2026)

### 로드맵

| # | 기능 | 설명 | 핵심 가치 | 복잡도 |
|---|------|------|----------|--------|
| **M1** | Dual-Model Architecture | Architect(추론) + Editor(실행) 분리 | 저렴한 모델로 고품질 결과 | 높음 |
| **M2** | Smart Context Engineering | 시스템 프롬프트 섹션별 토큰 예산 + 동적 트리밍 | 컨텍스트 효율 30%+ 향상 | 중 |
| **M3** | Repo Map | 코드베이스 구조 인덱싱 + 요약 | 저성능 모델의 코드 이해도 극대화 | 중-높 |
| **M4** | Adaptive Prompt Compression | 모델 tier별 프롬프트 압축 전략 | 저성능 모델 토큰 절약 | 중 |
| **M5** | Production Hardening | 에러 복구, 그레이스풀 셧다운, 시그널 핸들링 | 상용화 안정성 | 중 |
| **M6** | CI/CD + npm Publish | GitHub Actions, 자동 테스트, npm 배포 준비 | 배포 자동화 | 중 |
| **M7** | Model-Aware Tool Optimization | 모델별 도구 설명 압축, 디퍼드 도구 최적화 | 저성능 모델 도구 사용 정확도 향상 | 중 |

---

## M1. Dual-Model Architecture

### 배경 (웹 리서치)

Aider의 **Architect/Editor 패턴**은 SOTA 벤치마크 결과를 달성합니다:

> "For models that aren't able to propose coding solutions and specify detailed file edits all in one go, architect mode can produce better results by pairing them with an editor model."

Claude Code의 `opusplan` 설정도 유사한 접근: Opus로 계획하고 Sonnet으로 실행.

### 구현 계획

**파일: `src/llm/dual-model-router.ts` (신규)**

```typescript
interface DualModelConfig {
  /** Model for planning/reasoning (architect) */
  readonly architectModel: string;
  /** Model for code generation/editing (editor) */
  readonly editorModel: string;
  /** When to use architect vs editor */
  readonly routingStrategy: "auto" | "plan-execute" | "manual";
}

interface ModelRole {
  readonly role: "architect" | "editor";
  readonly model: string;
  readonly reason: string;
}

/**
 * Determine which model to use based on the current task phase.
 *
 * Routing logic:
 * 1. Planning phase → architect model (higher reasoning)
 * 2. Code generation → editor model (faster, cheaper)
 * 3. Code review → architect model
 * 4. Simple edits → editor model
 */
function routeToModel(
  phase: "plan" | "execute" | "review" | "edit",
  config: DualModelConfig,
): ModelRole { ... }
```

**파일: `src/commands/architect.ts` (신규)**

```
/architect <model>    — Set the architect (planning) model
/editor <model>       — Set the editor (execution) model
/dual                 — Toggle dual-model mode
```

### 동작 방식

```
User: "이 모듈을 리팩터링해줘"

[Phase 1: Architect — claude-3-opus]
→ 코드 분석, 리팩터링 계획 수립
→ 변경할 파일, 순서, 의존성 분석

[Phase 2: Editor — claude-3-haiku / local model]
→ 계획에 따라 코드 수정 실행
→ 파일별 diff 생성

[Phase 3: Architect — 결과 검증]
→ 변경 사항 리뷰
→ 추가 수정 필요 시 Editor에 재지시
```

### 영향 범위

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/llm/dual-model-router.ts` | **신규** | ~120줄 |
| `src/commands/architect.ts` | **신규** | ~60줄 |
| `src/core/agent-loop.ts` | phase tracking 추가 | ~30줄 변경 |
| `src/config/schema.ts` | dualModel config 추가 | ~10줄 |
| 테스트 | 신규 | ~80줄 |

---

## M2. Smart Context Engineering

### 배경

Martin Fowler의 컨텍스트 엔지니어링 원칙:

> "An agent's effectiveness goes down when it gets too much context, and too much context is a cost factor as well."

Claude Code Best Practices:

> "Most best practices are based on one constraint: Claude's context window fills up fast, and performance degrades as it fills."

### 구현 계획

**파일: `src/core/system-prompt-builder.ts` (확장)**

#### M2-1. 섹션별 토큰 예산 강화

```typescript
interface PromptSection {
  readonly id: string;
  readonly priority: number;       // 100 = identity, 10 = optional
  readonly maxTokens: number;      // 섹션별 토큰 한도
  readonly content: string;
  readonly condition?: () => boolean;
  readonly compressible: boolean;  // NEW: 토큰 부족 시 압축 가능 여부
}

/**
 * Tier-based budget allocation:
 * - HIGH tier (128K+): 모든 섹션 포함, 12K 시스템 프롬프트
 * - MEDIUM tier (32K-128K): 핵심 섹션만, 8K 시스템 프롬프트
 * - LOW tier (<32K): 최소 섹션, 4K 시스템 프롬프트 + 도구 설명 압축
 */
function allocateBudget(tier: CapabilityTier, totalBudget: number): BudgetAllocation { ... }
```

#### M2-2. 동적 인스트럭션 트리밍

작업 컨텍스트에 따라 불필요한 DBCODE.md 섹션 자동 제거:

```typescript
/**
 * 현재 대화에서 사용된 도구/파일 기반으로 관련 인스트럭션만 포함.
 * 예: Python 파일만 편집 중이면 JavaScript 관련 규칙 제외.
 */
function trimInstructions(
  instructions: string,
  activeFiles: readonly string[],
  usedTools: readonly string[],
): string { ... }
```

#### M2-3. 컨텍스트 사용량 실시간 모니터링

StatusBar에 컨텍스트 사용률 표시:

```typescript
interface ContextBudgetStatus {
  readonly systemPromptTokens: number;
  readonly messagesTokens: number;
  readonly toolResultsTokens: number;
  readonly totalUsed: number;
  readonly totalBudget: number;
  readonly usagePercent: number;
  readonly compactionThreshold: number;
  readonly turnsUntilCompaction: number;  // 예측값
}
```

### 영향 범위

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/core/system-prompt-builder.ts` | 확장 | ~60줄 변경 |
| `src/core/context-manager.ts` | 실시간 모니터링 | ~30줄 |
| `src/cli/components/StatusBar.tsx` | 사용률 표시 | ~15줄 |
| 테스트 | 신규 | ~50줄 |

---

## M3. Repo Map — 저성능 모델을 위한 코드베이스 인덱싱

### 배경

Aider의 핵심 기능:

> "Aider makes a map of your entire codebase, which helps it work well in larger projects. This repository mapping helps even simpler models understand code structure more effectively."

### 현재 상태

`src/indexing/repo-map.ts`가 이미 존재하지만, 실제 사용되는지 확인 필요.

### 구현 계획

**파일: `src/indexing/repo-map.ts` (확장)**

#### M3-1. 구조 인덱싱

```typescript
interface RepoMapEntry {
  readonly filePath: string;
  readonly language: string;
  readonly symbols: readonly SymbolSummary[];
  readonly imports: readonly string[];
  readonly exports: readonly string[];
  readonly lineCount: number;
}

interface SymbolSummary {
  readonly name: string;
  readonly kind: "class" | "function" | "interface" | "type" | "const" | "enum";
  readonly signature: string;  // 시그니처만, 구현 제외
  readonly lineNumber: number;
}

/**
 * Build a token-efficient repo map.
 *
 * LOW tier: 파일명 + export 목록만 (~500 토큰)
 * MEDIUM tier: 파일명 + 심볼 시그니처 (~2000 토큰)
 * HIGH tier: 파일명 + 심볼 시그니처 + import 관계 (~5000 토큰)
 */
function buildRepoMap(
  rootDir: string,
  tier: CapabilityTier,
): Promise<string> { ... }
```

#### M3-2. 증분 업데이트

파일 수정 시 전체 인덱스 재구축 대신 변경 파일만 업데이트:

```typescript
interface RepoMapCache {
  readonly entries: ReadonlyMap<string, RepoMapEntry>;
  readonly lastUpdated: number;
  readonly fileHashes: ReadonlyMap<string, string>;
}

function updateRepoMap(
  cache: RepoMapCache,
  changedFiles: readonly string[],
): Promise<RepoMapCache> { ... }
```

#### M3-3. 시스템 프롬프트 통합

Repo map을 시스템 프롬프트에 자동 주입:

```
# Project Structure
src/
  core/
    agent-loop.ts — AgentLoop class, runIteration(), handleToolCalls()
    context-manager.ts — ContextManager, autoCompact(), coldStorage()
  llm/
    client.ts — OpenAICompatibleClient, chat(), stream()
    model-router.ts — ModelRouter, routeWithFallback()
  commands/ (36 commands)
    doctor.ts — 8 diagnostic checks
    bug.ts — GitHub issue reporter
    ...
```

### 영향 범위

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/indexing/repo-map.ts` | 대폭 확장 | ~200줄 |
| `src/core/system-prompt-builder.ts` | repo map 섹션 추가 | ~20줄 |
| `src/core/agent-loop.ts` | 증분 업데이트 트리거 | ~10줄 |
| 테스트 | 신규 | ~80줄 |

---

## M4. Adaptive Prompt Compression

### 배경

저성능 모델(8K-32K 컨텍스트)에서 dbcode를 사용할 때, 시스템 프롬프트 + 도구 정의만으로도 컨텍스트의 30-50%를 차지할 수 있습니다.

### 구현 계획

**파일: `src/llm/prompt-compressor.ts` (신규)**

#### M4-1. 도구 설명 압축

```typescript
/**
 * Tier-based tool description compression:
 *
 * HIGH: 전체 도구 설명 (기존 그대로)
 * MEDIUM: 도구 이름 + 1줄 설명 + 필수 파라미터만
 * LOW: 도구 이름 + 파라미터 스키마만 (설명 제거)
 */
function compressToolDescriptions(
  tools: readonly ToolDefinition[],
  tier: CapabilityTier,
): readonly ToolDefinition[] { ... }
```

#### M4-2. 메시지 히스토리 압축

```typescript
/**
 * Compress message history for low-tier models:
 *
 * 1. 오래된 도구 결과 → 1줄 요약으로 대체
 * 2. 긴 코드 블록 → 시그니처 + "... (N lines)"
 * 3. 반복 패턴 → "Similar to above" 참조
 */
function compressMessageHistory(
  messages: readonly ChatMessage[],
  tier: CapabilityTier,
  targetTokens: number,
): readonly ChatMessage[] { ... }
```

#### M4-3. Few-Shot Example 최적화

저성능 모델에게 도구 사용 예시를 제공하되, 토큰 효율적으로:

```typescript
/**
 * 모델 tier에 따라 few-shot 예시 수 조정:
 * HIGH: 0 예시 (모델이 자체적으로 이해)
 * MEDIUM: 1 예시 (가장 대표적인 것)
 * LOW: 2-3 예시 (도구 사용법 + 출력 형식)
 */
function getFewShotExamples(
  tier: CapabilityTier,
  toolName: string,
): readonly ChatMessage[] { ... }
```

### 영향 범위

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/llm/prompt-compressor.ts` | **신규** | ~150줄 |
| `src/core/system-prompt-builder.ts` | 압축 통합 | ~20줄 |
| `src/core/agent-loop.ts` | few-shot 주입 | ~15줄 |
| 테스트 | 신규 | ~80줄 |

---

## M5. Production Hardening

### M5-1. Graceful Shutdown

```typescript
/**
 * 시그널 핸들링:
 * SIGINT (Ctrl+C): 현재 작업 완료 후 세션 저장 + 종료
 * SIGTERM: 즉시 세션 저장 + 종료
 * SIGHUP: 세션 저장 + 재시작 가능 상태로 종료
 */
function setupGracefulShutdown(
  sessionManager: SessionManager,
  hookRunner: HookRunner,
): void { ... }
```

### M5-2. 에러 복구 강화

```typescript
/**
 * 자동 복구 전략:
 * 1. 도구 실행 실패 → 재시도 (최대 2회)
 * 2. LLM 응답 파싱 실패 → 텍스트 파싱 폴백
 * 3. 컨텍스트 오버플로우 → 자동 compaction + 재시도
 * 4. 네트워크 단절 → 지수 백오프 재연결
 * 5. 파일 잠금 충돌 → stale lock 감지 + 해제
 */
interface RecoveryStrategy {
  readonly errorType: string;
  readonly maxRetries: number;
  readonly action: "retry" | "fallback" | "compact" | "abort";
  readonly backoffMs: number;
}
```

### M5-3. 세션 자동 저장

```typescript
/**
 * 주기적 자동 저장 (30초 간격):
 * - 대화 메시지
 * - 수정된 파일 목록
 * - 체크포인트 메타데이터
 * - 토큰 사용량
 */
function setupAutoSave(
  sessionManager: SessionManager,
  intervalMs: number,
): { stop: () => void } { ... }
```

### 영향 범위

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/index.ts` | 시그널 핸들링 | ~30줄 |
| `src/core/agent-loop.ts` | 에러 복구 강화 | ~40줄 |
| `src/core/session-manager.ts` | 자동 저장 | ~30줄 |
| 테스트 | 신규 | ~60줄 |

---

## M6. CI/CD Pipeline + npm Publish 준비

### M6-1. GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:coverage
      - run: npm run build

  publish:
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci && npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### M6-2. npm Publish 준비

```json
{
  "name": "dbcode",
  "version": "0.1.0",
  "description": "AI coding assistant for local/external LLMs",
  "keywords": ["ai", "coding", "assistant", "cli", "llm"],
  "license": "MIT",
  "files": ["dist/", "bin/", "README.md", "LICENSE"],
  "engines": { "node": ">=20" }
}
```

### M6-3. 릴리스 자동화

```
/release patch   — 0.1.0 → 0.1.1
/release minor   — 0.1.0 → 0.2.0
/release major   — 0.1.0 → 1.0.0
```

### 영향 범위

| 파일 | 변경 | 규모 |
|------|------|------|
| `.github/workflows/ci.yml` | **신규** | ~60줄 |
| `package.json` | publish 설정 | ~10줄 변경 |
| `LICENSE` | **신규** | MIT 라이선스 |
| `src/commands/release.ts` | **신규** | ~80줄 |

---

## M7. Model-Aware Tool Optimization

### 배경

Claude Code의 Deferred Tool Loading은 이미 구현되어 있지만, 저성능 모델에서 도구 사용 정확도가 낮을 수 있습니다.

### 구현 계획

#### M7-1. 도구 우선순위 + 자동 선택

```typescript
/**
 * 모델 tier에 따른 도구 노출 전략:
 *
 * HIGH: 모든 도구 (18개 + MCP)
 * MEDIUM: Hot tools (6개) + 자주 사용하는 3-4개 추가
 * LOW: Hot tools만 (6개) — 나머지는 요청 시 동적 로드
 */
function getToolsForTier(
  allTools: readonly ToolDefinition[],
  tier: CapabilityTier,
  usageHistory: ReadonlyMap<string, number>,
): readonly ToolDefinition[] { ... }
```

#### M7-2. 도구 사용 가이드 자동 주입

저성능 모델이 도구를 올바르게 호출하도록 시스템 프롬프트에 가이드 추가:

```typescript
/**
 * LOW tier 모델에 대한 도구 사용 가이드:
 *
 * "Available tools: file_read, file_write, file_edit, bash_exec, glob_search, grep_search
 *
 *  To read a file: call file_read with {"path": "/absolute/path/to/file"}
 *  To search: call grep_search with {"pattern": "search term", "path": "/dir"}
 *
 *  Always use absolute paths. Always check file exists before editing."
 */
function buildToolGuide(
  tools: readonly ToolDefinition[],
  tier: CapabilityTier,
): string { ... }
```

#### M7-3. 도구 호출 교정

```typescript
/**
 * 저성능 모델의 일반적인 도구 호출 오류 자동 교정:
 *
 * 1. 상대 경로 → 절대 경로 변환
 * 2. 잘못된 파라미터명 → fuzzy matching으로 교정
 * 3. 누락된 필수 파라미터 → 디폴트값 주입
 * 4. 잘못된 타입 → 자동 캐스팅 (string "true" → boolean true)
 */
function correctToolCall(
  call: ToolCall,
  definition: ToolDefinition,
  workingDirectory: string,
): ToolCall { ... }
```

### 영향 범위

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/tools/registry.ts` | tier 기반 필터링 | ~30줄 |
| `src/core/system-prompt-builder.ts` | 도구 가이드 | ~25줄 |
| `src/tools/executor.ts` | 호출 교정 | ~60줄 |
| 테스트 | 신규 | ~80줄 |

---

## 구현 순서 및 일정

### 에이전트 배정 (7명)

```
Agent 1: "dual-model"       → M1 Dual-Model Architecture
Agent 2: "context-eng"      → M2 Smart Context Engineering
Agent 3: "repo-map"         → M3 Repo Map 인덱싱
Agent 4: "prompt-compress"  → M4 Adaptive Prompt Compression
Agent 5: "prod-harden"      → M5 Production Hardening
Agent 6: "cicd"             → M6 CI/CD + npm Publish
Agent 7: "tool-optimize"    → M7 Model-Aware Tool Optimization
```

### 의존성 그래프

```
M3 (Repo Map) ──→ M2 (Context Eng) ──→ M4 (Prompt Compress)
                                   ──→ M7 (Tool Optimize)
M1 (Dual Model) ──→ 독립 (agent-loop 확장)
M5 (Prod Harden) ──→ 독립 (core 강화)
M6 (CI/CD) ──→ 독립 (인프라)
```

### 일정

```
Day 1    │  M1 + M3 + M5 + M6 병렬 시작
Day 2    │  M2 + M7 (M3 의존) + M1 계속
Day 3    │  M4 (M2 의존) + 통합
Day 4    │  통합 테스트 + 벤치마크 + 커밋
```

**총 예상: 4일**

---

## 검증 기준

### 기능 검증

- [ ] Dual-Model: `/architect` + `/editor` + `/dual` 커맨드 동작
- [ ] Dual-Model: plan → execute 자동 모델 전환
- [ ] Context Eng: tier별 시스템 프롬프트 크기 차등
- [ ] Repo Map: 프로젝트 구조 자동 인덱싱 + 시스템 프롬프트 주입
- [ ] Prompt Compress: LOW tier에서 도구 설명 50% 압축
- [ ] Production: SIGINT/SIGTERM graceful shutdown
- [ ] CI/CD: GitHub Actions 파이프라인 성공
- [ ] Tool Optimize: LOW tier에서 도구 호출 교정 동작

### 성능 검증

- [ ] LOW tier 모델 (8K context): 기본 코딩 태스크 수행 가능
- [ ] MEDIUM tier 모델 (32K): 멀티파일 편집 가능
- [ ] 시스템 프롬프트 크기: HIGH ≤12K, MEDIUM ≤8K, LOW ≤4K 토큰
- [ ] 도구 호출 교정 성공률: ≥80%

### 벤치마크

| 시나리오 | 측정 항목 | 목표 |
|---------|----------|------|
| 단일 파일 수정 (LOW tier) | 성공률 | ≥70% |
| 멀티파일 리팩터링 (MEDIUM tier) | 성공률 | ≥80% |
| 복잡 기능 구현 (HIGH tier) | 성공률 | ≥90% |
| 첫 패스 성공률 (all tiers) | 재시도 없이 성공 | ≥60% |
| 턴당 비용 (MEDIUM tier) | USD | ≤$0.05 |

### 회귀 방지

- [ ] 기존 테스트 전부 통과
- [ ] TypeScript 에러 0개
- [ ] 빌드 성공
- [ ] Circular dependency 없음

---

## Sprint 5 이후 — v1.0 릴리스 체크리스트

```
Sprint 1: 비용 최적화           ✅ C1+C2
Sprint 2: UX 완성               ✅ I2+I3+C3+I4
Sprint 3: 고급 기능 + 코어 보강 ✅ I5+C4+I1+H1-H5
Sprint 4: 완성도 + DX           ✅ I6+I7+P1+DX1
Sprint 5: 코어 성숙도 + 효율    ✅ M1-M7

v1.0 릴리스 준비 상태:
  ✅ Core Architecture — 4-layer, zero circular deps
  ✅ LLM Integration — Multi-provider, dual-model, adaptive
  ✅ Tool System — 18+ built-in, MCP, deferred loading
  ✅ Context Management — 3-layer compaction, cold storage, rehydration
  ✅ Developer Experience — 36+ commands, skills, hooks
  ✅ Production Ready — Graceful shutdown, auto-save, error recovery
  ✅ CI/CD — GitHub Actions, npm publish
  ✅ Model Efficiency — Repo map, prompt compression, tool optimization

남은 작업 (Post v1.0):
  - OAuth Device Flow 인증
  - Plugin Marketplace
  - VS Code Extension
  - 사용자 문서 (Getting Started, Configuration Guide)
  - 국제화 (i18n) 완성
```

---

## 웹 리서치 참조

### Dual-Model Architecture
- [Claude Code Model Configuration](https://code.claude.com/docs/en/model-config)
- [Aider Architect/Editor Mode](https://aider.chat/)
- [Choosing the Right Claude Model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)

### Context Engineering
- [Context Engineering for Coding Agents — Martin Fowler](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html)
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)
- [7 Claude Code Best Practices 2026](https://www.eesel.ai/blog/claude-code-best-practices)

### Model Efficiency
- [Local AI Models 2026](https://almira19.medium.com/local-ai-models-that-can-compete-with-premium-coding-assistants-in-2026)
- [State of AI Coding Agents 2026](https://medium.com/@dave-patten/the-state-of-ai-coding-agents-2026)
- [Best AI Model for Coding 2026](https://www.morphllm.com/best-ai-model-for-coding)

### CLI Performance
- [Claude Code CLI Guide 2026](https://blakecrosley.com/guides/claude-code)
- [Agentic CLI Tools Compared](https://aimultiple.com/agentic-cli)
- [7 Best CLI AI Coding Agents 2026](https://www.scriptbyai.com/best-cli-ai-coding-agents/)

### Production Readiness
- [10 Must-Have Skills for Coding Agents 2026](https://medium.com/@unicodeveloper/10-must-have-skills-for-claude-and-any-coding-agent-in-2026)
- [Claude Code Complete Guide 2026](https://claude-world.com/articles/claude-code-complete-guide-2026/)
