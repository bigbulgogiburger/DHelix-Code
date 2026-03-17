# Sprint 1: 비용 최적화 (Cost Optimization)

> **Version**: 2.0
> **Date**: 2026-03-14
> **Base**: v1 완료 — 3372 tests / 0 TS errors / 0 circular deps
> **Scope**: C2 Deferred Tool Loading (메인) + C1 Anthropic Prompt Caching (보조)

---

## 목차

1. [배경 및 기존 계획 수정 사유](#배경-및-기존-계획-수정-사유)
2. [기존 인프라 발견 사항](#기존-인프라-발견-사항)
3. [C2. Deferred Tool Loading (메인)](#c2-deferred-tool-loading)
4. [C1. Anthropic Prompt Caching (보조)](#c1-anthropic-prompt-caching)
5. [구현 순서 및 일정](#구현-순서-및-일정)
6. [검증 기준](#검증-기준)

---

## 배경 및 기존 계획 수정 사유

기존 계획은 **C1 Prompt Caching**을 Sprint 1 메인으로 잡았으나, 분석 결과:

| 프로바이더             | Prompt Caching 상태                                                    | 추가 구현 필요? |
| ---------------------- | ---------------------------------------------------------------------- | --------------- |
| OpenAI (GPT-4o, GPT-5) | **자동 캐싱** — 동일 prefix 1024+ 토큰이면 서버 측 자동 적용, 50% 할인 | ❌ 불필요       |
| DeepSeek               | 자동 prefix 캐싱 (서버 측)                                             | ❌ 불필요       |
| Anthropic (Claude)     | 명시적 `cache_control` 필요                                            | ✅ 구현 필요    |
| Ollama / 로컬          | 비용 $0, 캐싱 불필요                                                   | ❌ 해당 없음    |

→ **OpenAI 사용자(주요 타겟)에게는 이미 무료로 작동 중**이므로, C1보다 **C2 Deferred Tool Loading**이 모든 프로바이더에 범용적으로 효과적.

**수정된 Sprint 1 구성:**

- **메인 (80%)**: C2 Deferred Tool Loading — 전 프로바이더 토큰 절감
- **보조 (20%)**: C1 Anthropic Prompt Caching — Anthropic 전용 비용 90% 절감

---

## 기존 인프라 발견 사항

심층 분석 결과, **Deferred Tool Loading의 핵심 인프라가 이미 구현되어 있으나 미연결** 상태:

| 파일                     | 클래스/함수          | 상태                 | 내용                                                                                                |
| ------------------------ | -------------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| `src/mcp/tool-search.ts` | `MCPToolSearch`      | ✅ 구현됨, ❌ 미사용 | deferred 등록, fuzzy 검색, `select:Name` 구문, `resolveByNames()`, `generateDeferredToolsSummary()` |
| `src/mcp/tool-filter.ts` | `MCPToolFilter`      | ✅ 구현됨, ❌ 미사용 | 서버별 allowlist/denylist, `loadFromConfig()`                                                       |
| `src/mcp/tool-bridge.ts` | `shouldDeferTools()` | ✅ 구현됨, ❌ 미사용 | 임계값 로직: MCP 토큰 > context의 10%이면 defer                                                     |

**MCPToolSearch 핵심 메서드 (이미 존재):**

- `registerDeferredTools(client, serverName)` — MCP 도구를 이름+설명만 등록, 전체 스키마는 캐시
- `search(query, maxResults)` — fuzzy 검색 + `select:Name1,Name2` 구문 지원
- `resolveByNames(names)` — 정확한 이름으로 전체 스키마 반환
- `generateDeferredToolsSummary()` — `<available-deferred-tools>` XML 태그 생성
- `getToolDefinition(name)` — 단일 도구 전체 스키마 반환
- `estimateTokens()` — 요약 토큰 추정

**→ Sprint 1의 실제 작업은 "새로 구현"이 아니라 "기존 인프라를 agent-loop에 연결"하는 것.**

이로 인해 예상 일정이 **8일 → 4-5일**로 단축됨.

---

## C2. Deferred Tool Loading

### 문제

현재 **매 LLM 호출마다 15개 도구의 전체 JSON Schema가 전송**됨.

```
agent-loop.ts:346  →  toolDefs = config.toolRegistry.getDefinitionsForLLM()  ← 전체 15개
agent-loop.ts:347  →  strategy.prepareRequest(messages, toolDefs)            ← 전부 전송
```

현재 토큰 소비 (추정):

| 구분                  | 도구 수 | 토큰/도구 | 합계              |
| --------------------- | ------- | --------- | ----------------- |
| Built-in tools        | 15      | ~120      | ~1,800            |
| MCP tools (10개 서버) | 50-200+ | ~100      | ~5,000-20,000     |
| **합계**              | 65-215+ | —         | **~7,000-22,000** |

MCP 도구가 많아지면 **시스템 프롬프트의 40-70%가 도구 스키마**에 소비됨.
매 턴마다 이 전체가 반복 전송 → 비용 + 지연 모두 증가.

### 해결 전략

Claude Code의 **Deferred Tool Loading** 패턴:

1. 시스템 프롬프트에는 **도구 이름 + 한 줄 설명만** 나열 (토큰 절감)
2. LLM이 도구를 호출하려 할 때 **전체 스키마를 lazy-load**
3. 자주 쓰는 핵심 도구(file_read, file_edit, bash_exec 등)는 **항상 전체 포함** (hot tools)

### 아키텍처

```
Before (현재):
  System Prompt:  [15개 도구 전체 JSON Schema]
  LLM Request:    tools: [15개 전체 definition]
  Agent Loop:     toolDefs = registry.getDefinitionsForLLM()  ← 전부

After (변경):
  System Prompt:  [6개 hot tools 전체 Schema] + [9개 deferred 이름만]
  LLM Request:    tools: [6개 hot] + [resolve된 deferred]
  Agent Loop:     toolDefs = registry.getDefinitionsForLLM({ deferred: true })
                  → 호출 시: registry.resolveDeferred(toolName) → 전체 스키마 반환
```

### 상세 구현 계획 (기존 MCPToolSearch 활용)

#### Phase A: ToolRegistry에 MCPToolSearch 연결

**핵심**: `MCPToolSearch`가 이미 deferred 등록/검색/resolve 기능을 갖추고 있으므로, ToolRegistry에 참조만 추가.

**파일: `src/tools/registry.ts`**

```typescript
import { type MCPToolSearch } from "../mcp/tool-search.js";

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<any>>();

  // 신규: deferred tool 검색 엔진 (MCPToolSearch 재사용)
  private toolSearch: MCPToolSearch | null = null;

  // 신규: hot tool 목록 (항상 전체 스키마 전송)
  private readonly hotTools = new Set<string>([
    "file_read",
    "file_write",
    "file_edit",
    "bash_exec",
    "glob_search",
    "grep_search",
  ]);

  /** MCPToolSearch 인스턴스 연결 (MCP 초기화 후 호출) */
  setToolSearch(search: MCPToolSearch): void {
    this.toolSearch = search;
  }

  /** Deferred 모드 활성 여부 */
  get isDeferredMode(): boolean {
    return this.toolSearch !== null && this.toolSearch.size > 0;
  }

  /** Hot tools만 전체 스키마, deferred tools는 MCPToolSearch가 관리 */
  getDefinitionsForLLM(options?: { deferred?: boolean }): readonly ToolDefinitionForLLM[] {
    const allDefs = this.getAll().map(/* 기존 변환 */);

    if (!options?.deferred || !this.isDeferredMode) {
      return allDefs; // 기존 동작 100% 유지
    }

    // Hot tools + built-in(non-MCP)만 전체 스키마 반환
    return allDefs.filter(
      (d) => this.hotTools.has(d.function.name) || !d.function.name.startsWith("mcp__"),
    );
  }

  /** Deferred tools 요약 (시스템 프롬프트용) — MCPToolSearch에 위임 */
  getDeferredToolsSummary(): string {
    return this.toolSearch?.generateDeferredToolsSummary() ?? "";
  }

  /** Deferred tool 스키마 resolve — MCPToolSearch에 위임 */
  resolveDeferredTool(name: string): ToolDefinitionForLLM | undefined {
    const result = this.toolSearch?.getToolDefinition(name);
    if (!result) return undefined;
    return {
      type: "function",
      function: {
        name: result.namespacedName,
        description: result.tool.description,
        parameters: result.tool.inputSchema ?? {},
      },
    };
  }

  /** Deferred tool 검색 (ToolSearch 커맨드용) */
  searchDeferredTools(query: string, maxResults?: number) {
    return this.toolSearch?.search(query, maxResults) ?? [];
  }
}
```

**변경 범위**: `src/tools/registry.ts` +40줄, 기존 API 하위 호환

#### Phase B: 시스템 프롬프트에 deferred 요약 주입

**파일: `src/core/system-prompt-builder.ts`**

기존 `buildToolsSection()`은 변경 없이 유지. **새 섹션만 추가:**

```typescript
// buildSystemPrompt() 내에서:
if (options?.toolRegistry?.isDeferredMode) {
  const deferredSummary = options.toolRegistry.getDeferredToolsSummary();
  if (deferredSummary) {
    sections.push({
      id: "deferred-tools",
      content: deferredSummary, // <available-deferred-tools>...</available-deferred-tools>
      priority: 84, // tools(85)와 mcp(82) 사이
    });
  }
}
```

MCPToolSearch의 `generateDeferredToolsSummary()`가 이미 `<available-deferred-tools>` XML 포맷을 생성하므로 그대로 사용.

#### Phase C: Agent Loop에서 deferred tool 동적 resolve

**파일: `src/core/agent-loop.ts`**

```typescript
// 현재 (line 346-347):
const toolDefs = config.toolRegistry.getDefinitionsForLLM();
const prepared = config.strategy.prepareRequest(managedMessages, toolDefs);

// 변경:
const toolDefs = config.toolRegistry.getDefinitionsForLLM({
  deferred: config.toolRegistry.isDeferredMode,
});

// 이전 턴에서 사용된 deferred tool 스키마를 추가로 resolve
if (config.toolRegistry.isDeferredMode) {
  const resolvedDeferred = resolveDeferredFromHistory(managedMessages, config.toolRegistry);
  toolDefs = [...toolDefs, ...resolvedDeferred];
}

const prepared = config.strategy.prepareRequest(managedMessages, toolDefs);
```

`resolveDeferredFromHistory()`는 메시지 히스토리에서 MCP tool_calls를 감지하여 스키마를 동적으로 추가.

#### Phase D: MCP 초기화 시 자동 연결

**파일: `src/index.ts`**

```typescript
// MCP 매니저 초기화 후:
const mcpToolSearch = new MCPToolSearch();
// MCP 서버별로 deferred 등록
for (const server of mcpServers) {
  await mcpToolSearch.registerDeferredTools(server.client, server.name);
}
// ToolRegistry에 연결
if (mcpToolSearch.size > 0) {
  toolRegistry.setToolSearch(mcpToolSearch);
}
```

기존 `shouldDeferTools()` 임계값 로직(context의 10% 초과 시)도 활용 가능.

### 토큰 절감 효과

| 시나리오          | Before  | After                            | 절감     |
| ----------------- | ------- | -------------------------------- | -------- |
| Built-in만 (15개) | ~1,800  | ~1,800 (MCP 없으면 defer 비활성) | 0%       |
| +MCP 50개         | ~7,000  | ~1,800 + 500 (요약) = ~2,300     | **-67%** |
| +MCP 200개        | ~22,000 | ~1,800 + 2,000 (요약) = ~3,800   | **-83%** |

Built-in 도구만 있을 때는 변경 없음 (deferredMode가 비활성이므로).

### 영향 범위

| 파일                                | 변경 유형                      | 규모   |
| ----------------------------------- | ------------------------------ | ------ |
| `src/tools/registry.ts`             | MCPToolSearch 연결 메서드 추가 | +40줄  |
| `src/core/system-prompt-builder.ts` | deferred-tools 섹션 추가       | +10줄  |
| `src/core/agent-loop.ts`            | deferred resolve 로직          | +25줄  |
| `src/index.ts`                      | MCPToolSearch 초기화 + 연결    | +10줄  |
| 테스트 3~4개 파일                   | 신규 + 기존 수정               | +150줄 |

**기존 동작 영향 ZERO**: `isDeferredMode = false`가 기본 (MCPToolSearch 미연결 시).

---

## C1. Anthropic Prompt Caching

### 문제

Anthropic API는 자동 캐싱이 없음. 매 턴마다 시스템 프롬프트 ~6,000 토큰을 전액 과금.
50턴 세션: 6K × 50 × $3/M = **$0.90** (시스템 프롬프트만)

### 해결

시스템 프롬프트의 **정적 부분**에 `cache_control` breakpoint 설정.

### 시스템 프롬프트 정적/동적 분류

| 섹션            | Priority | 정적?        | 이유                         |
| --------------- | -------- | ------------ | ---------------------------- |
| identity        | 100      | ✅ 정적      | 매 호출 동일                 |
| doing-tasks     | 95       | ✅ 정적      | 매 호출 동일                 |
| locale          | 94       | ✅ 세션 정적 | 세션 중 불변                 |
| **environment** | 90       | ❌ **동적**  | 날짜, git 상태 매번 변경     |
| tools           | 85       | ✅ 세션 정적 | 도구 목록 불변               |
| mcp             | 82       | ✅ 세션 정적 | MCP 서버 불변                |
| conventions     | 80       | ✅ 정적      | 매 호출 동일                 |
| cot-scaffolding | 79       | ✅ 정적      | 모델 tier 불변               |
| skills          | 78       | ✅ 세션 정적 | 스킬 목록 불변               |
| tone            | 76       | ⚠️ 준정적    | /tone으로 변경 가능하나 드묾 |
| auto-memory     | 72       | ⚠️ 준정적    | 세션 중 드물게 변경          |
| project         | 70       | ⚠️ 준정적    | /compact 시 재로드 가능      |

**전략**: environment 섹션을 **마지막**으로 이동하고, 그 앞 모든 섹션에 `cache_control` breakpoint 설정.

### 구현

#### Phase A: system-prompt-builder 반환 타입 확장

```typescript
/** 캐싱 지원 시스템 프롬프트 */
export interface StructuredSystemPrompt {
  /** 단일 string (OpenAI/Ollama용 — 기존 동작) */
  readonly text: string;
  /** Anthropic cache_control용 분리 블록 */
  readonly blocks: readonly SystemPromptBlock[];
}

export interface SystemPromptBlock {
  readonly type: "text";
  readonly text: string;
  readonly cache_control?: { type: "ephemeral" };
}
```

새 함수: `buildStructuredSystemPrompt()` — 기존 `buildSystemPrompt()`는 그대로 유지 (하위 호환).

#### Phase B: Anthropic provider에 cache_control 적용

**파일: `src/llm/providers/anthropic.ts` — `_buildRequestBody()` 수정**

```typescript
// Before
if (system) {
  body.system = system;
}

// After
if (structuredPrompt) {
  body.system = structuredPrompt.blocks; // [{type, text, cache_control}, ...]
} else if (system) {
  body.system = system;
}
```

**API 헤더 추가:**

```typescript
headers: {
  'anthropic-beta': 'prompt-caching-2024-07-31',
}
```

### 비용 효과

| 시나리오              | 캐싱 전 | 캐싱 후                        | 절감    |
| --------------------- | ------- | ------------------------------ | ------- |
| Claude Sonnet 4, 50턴 | $0.90   | ~$0.09 (캐시 히트 시 90% 할인) | **90%** |
| Claude Opus 4, 50턴   | $4.50   | ~$0.45                         | **90%** |

### 영향 범위

| 파일                                | 변경                                 | 규모       |
| ----------------------------------- | ------------------------------------ | ---------- |
| `src/core/system-prompt-builder.ts` | `buildStructuredSystemPrompt()` 추가 | +40줄      |
| `src/llm/providers/anthropic.ts`    | `_buildRequestBody()` 수정 + 헤더    | ~15줄 변경 |
| `src/llm/model-capabilities.ts`     | `supportsCaching` 필드 추가          | +5줄       |
| 테스트 2~3개 파일                   | 신규                                 | +100줄     |

---

## 구현 순서 및 일정 (수정: MCPToolSearch 재사용으로 단축)

```
Day 1    │  C2 Phase A: ToolRegistry에 MCPToolSearch 연결 + 테스트
Day 2    │  C2 Phase B+C: SystemPrompt deferred 섹션 + Agent Loop resolve + 테스트
Day 3    │  C2 Phase D: MCP 초기화 연결 + 통합 테스트
Day 4    │  C1 Phase A+B: Anthropic 캐싱 (StructuredPrompt + provider) + 테스트
Day 5    │  통합 검증 + 성능 벤치마크
```

**총 예상: 5일 (실작업 기준)** — 기존 MCPToolSearch 활용으로 8일 → 5일 단축

### 의존성 그래프

```
C2 Phase A (ToolRegistry ← MCPToolSearch)
    ↓
C2 Phase B+C (SystemPrompt + AgentLoop)  ──→  C1 Phase A+B (Anthropic 캐싱)
    ↓
C2 Phase D (MCP 초기화)
```

C2와 C1은 독립적이므로 병렬 가능. Day 3-4를 병렬로 진행하면 **4일**로도 가능.

---

## 검증 기준

### 기능 검증

- [ ] `deferredMode = false` (기본): 기존 동작과 100% 동일
- [ ] `deferredMode = true`: hot tools만 전체 스키마, 나머지는 이름만
- [ ] Deferred tool 호출 시 스키마 자동 resolve → 정상 실행
- [ ] MCP 도구 50개 등록 시 시스템 프롬프트 토큰 74% 감소 확인
- [ ] Anthropic 캐싱: 두 번째 턴부터 `cache_read_input_tokens` > 0 확인

### 회귀 방지

- [ ] 기존 3372개 테스트 전부 통과
- [ ] TypeScript 에러 0개
- [ ] 빌드 성공

### 성능 벤치마크

- [ ] 시스템 프롬프트 토큰 수 before/after 측정 (built-in only / +MCP 50 / +MCP 200)
- [ ] Anthropic 세션 비용 before/after 측정 (10턴 기준)

---

## 리스크

| 리스크                                             | 확률 | 영향 | 완화                                             |
| -------------------------------------------------- | ---- | ---- | ------------------------------------------------ |
| LLM이 deferred tool 이름만 보고 잘못된 인자로 호출 | 중   | 중   | 첫 호출 실패 시 스키마 포함하여 재시도           |
| Hot tool 선정이 사용 패턴과 불일치                 | 낮   | 낮   | 사용 빈도 기반 자동 조절 (v2)                    |
| Anthropic cache_control이 TTL 만료로 miss          | 낮   | 낮   | ephemeral 캐시 기본 5분 — 대화 중엔 충분         |
| 기존 테스트 깨짐                                   | 낮   | 중   | deferredMode = false가 기본, 기존 경로 변경 없음 |
