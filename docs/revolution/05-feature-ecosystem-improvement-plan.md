# 05 - Feature Ecosystem Improvement Plan

> DHelix Code v0.2.x -> v1.0 Feature Ecosystem 전략
> 경쟁사(OpenCode, Codex) 분석 기반 Gap-Close + DHelix 고유 차별화

---

## Table of Contents

1. [Feature Inventory](#1-feature-inventory)
2. [MCP Evolution Plan](#2-mcp-evolution-plan)
3. [Skills System Overhaul](#3-skills-system-overhaul)
4. [Command System Consolidation](#4-command-system-consolidation)
5. [LSP & Code Intelligence Enhancement](#5-lsp--code-intelligence-enhancement)
6. [Hook System Maturation](#6-hook-system-maturation)
7. [Plugin Platform Vision](#7-plugin-platform-vision)
8. [Memory & Config Evolution](#8-memory--config-evolution)
9. [Success Metrics](#9-success-metrics)

---

## 1. Feature Inventory

모든 feature subsystem을 현재 성숙도와 경쟁사 대비 gap으로 평가.

### 1.1 Rating Scale

| Rating | Meaning | Description |
|--------|---------|-------------|
| A (90%+) | Production-grade | 경쟁사 수준 이상, 안정적 |
| B (75-89%) | Functional | 핵심 동작하나 edge-case/polish 부족 |
| C (50-74%) | Partial | 기본 기능만 존재, 주요 gap 다수 |
| D (25-49%) | Skeletal | 구조만 존재, 실질 동작 미흡 |
| F (<25%) | Missing | 미구현 또는 placeholder |

### 1.2 Feature Matrix

| Feature | DHelix Rating | OpenCode | Codex | Gap Priority |
|---------|--------------|----------|-------|-------------|
| **MCP** | C (72%) | A (92%) | A (88%) | **P0** |
| **Skills** | C (65%) | A (90%) | B (78%) | **P0** |
| **Commands** | B (76%) | B (82%) | C (55%) | P1 |
| **LSP** | C (71%) | A (93%) | C (60%) | **P0** |
| **Hooks** | D (42%) | B (80%) | D (35%) | P1 |
| **Memory** | B (75%) | A (88%) | B (82%) | P1 |
| **Config** | B (78%) | A (85%) | B (76%) | P2 |
| **Indexing** | C (68%) | B (75%) | C (55%) | P1 |
| **Git** | B (77%) | A (91%) | B (80%) | P2 |
| **Plugin Platform** | F (10%) | B (80%) | D (40%) | P1 |

### 1.3 Critical Gap Summary

**Immediate P0 (v0.5 target):**
- MCP: health check, reconnection, streaming, granular filtering 강화
- Skills: typed manifest 없음, composition 불가, trust model 부재
- LSP: tree-sitter 5개 언어 (TS/JS, Python, Go, Rust, Java), incremental indexing 없음, semantic search 없음

**Short-term P1 (v0.5-0.6 target):**
- Hooks: event coverage 42%, typed backend 미구현
- Plugin: 플러그인 시스템 자체가 미존재
- Commands: 42개 명령어 sprawl, 통합 command graph 필요
- Indexing: file watcher 기반 incremental 재인덱싱 필요

**Medium-term P2 (v0.6+ target):**
- Config: managed preferences (MDM plist) 미지원
- Git: Effect-based safety flags 미구현
- Memory: SQLite migration, snapshot diffing

### 1.4 Competitive Landscape Detail

#### OpenCode의 강점 (DHelix가 배워야 할 것)
- **MCP**: Full SDK integration with OAuth 2.0, tool list change notifications (`notifications/tools/list_changed`), resource/prompt support, 3 transports (stdio/SSE/streamable HTTP). DHelix는 3 transport 구현 있으나 SSE/HTTP 안정성 미검증.
- **Skills**: SKILL.md frontmatter 기반 declarative manifest, recursive discovery (5+ directories), remote URL pulling, agent-filtered skill delivery. DHelix는 단순 파일 로딩만.
- **Commands**: Template-based unified system (config + MCP prompts + skills 3개 소스에서 merge), variable substitution (`{{selection}}`, `{{file}}`), subtask support. DHelix는 모놀리식 명령 모듈.
- **Plugins**: TypeScript plugin hooks (`tool.definition`, `chat.system.transform`, `chat.params`, `chat.headers`), TUI 플러그인, npm/local/git 3가지 로딩 경로. DHelix는 플러그인 시스템 자체가 없음.
- **LSP**: 20+ language server 지원, auto-launch per language, symbol discovery, hover, diagnostics, call hierarchy. DHelix는 TS/JS만 안정.

#### Codex의 강점 (DHelix가 배워야 할 것)
- **MCP**: rmcp Rust SDK 기반 고성능, tool aggregation with qualified names (`{server}_{tool}`), pagination, resource templates, elicitation flow. DHelix의 tool naming은 비표준.
- **Sandbox**: Platform-specific sandbox (Seatbelt macOS / Landlock Linux / restricted-token Windows). DHelix는 sandbox 없음.
- **Execution Policy**: TOML-based rules, pattern matching on executables, approval tracking with audit. DHelix는 5-mode permission만.
- **App Server**: REST API (Axum) over core runtime. DHelix는 CLI-only.

---

## 2. MCP Evolution Plan

### 2.1 Current State Analysis

```
src/mcp/
  client.ts           # MCP client
  manager.ts          # MCP server lifecycle manager
  manager-connector.ts # Manager connection logic
  scope-manager.ts    # 3-scope config (global/project/session)
  tool-bridge.ts      # Tool bridge for agent loop
  tool-filter.ts      # Tool filtering
  tool-search.ts      # Deferred tool search
  output-limiter.ts   # Output size limiting
  oauth.ts            # OAuth flow (partial)
  prompts.ts          # MCP prompt template support
  resources.ts        # MCP resource support
  managed-config.ts   # Managed configuration
  serve.ts            # MCP server mode
  types.ts            # Shared types
  transports/         # Transport implementations (stdio, sse, http)
```

**현재 동작하는 것:**
- stdio/SSE/HTTP transport를 통한 MCP 서버 연결
- 3-scope config merge (global > project > session)
- Tool bridge로 agent loop에 MCP 도구 노출
- Tool filtering 및 deferred tool search
- Output limiting on tool outputs

**동작하지 않거나 부족한 것:**
- Health check 메커니즘 없음 -- 서버가 죽어도 다음 호출 시점에야 발견
- Auto-reconnection 없음 -- 연결 끊기면 수동 재시작 필요
- SSE/Streamable HTTP transport 존재하나 안정성 미검증
- Granular tool filtering 기본 구현 있으나 glob 패턴 미지원
- MCP streaming (progressive result delivery) 미지원
- Resource & prompt template integration 기본 파일 존재하나 agent loop 연동 미완성
- OAuth 2.0 flow 부분 구현 (`oauth.ts` 존재)

### 2.2 Phase 1: Health & Resilience (v0.5)

**2.2.1 Health Check System**

```typescript
// src/mcp/health/health-monitor.ts
interface McpServerHealth {
  readonly serverId: string;
  readonly status: 'healthy' | 'degraded' | 'unreachable';
  readonly lastPingMs: number;
  readonly lastSuccessfulCall: Date;
  readonly consecutiveFailures: number;
  readonly averageLatencyMs: number;
  readonly uptimePercent: number;
}

interface HealthCheckConfig {
  readonly intervalMs: number;          // default: 30_000
  readonly timeoutMs: number;           // default: 5_000
  readonly degradedThreshold: number;   // consecutive failures before degraded
  readonly unreachableThreshold: number; // consecutive failures before unreachable
}
```

구현 세부사항:
- `ping` method를 MCP 프로토콜의 `ping` request로 구현
- Health status 변화 시 EventBus로 `mcp:health:changed` 이벤트 발행
- CLI에서 `dhelix mcp status` 명령으로 전체 서버 health 테이블 출력
- Degraded 상태에서는 경고 표시 후 계속 사용, unreachable에서는 fallback 또는 에러

**2.2.2 Auto-Reconnection**

```typescript
// src/mcp/client/reconnection-strategy.ts
interface ReconnectionStrategy {
  readonly maxRetries: number;           // default: 5
  readonly baseDelayMs: number;          // default: 1_000
  readonly maxDelayMs: number;           // default: 30_000
  readonly backoffMultiplier: number;    // default: 2.0
  readonly jitterPercent: number;        // default: 0.2
}
```

구현 세부사항:
- Exponential backoff with jitter
- 재연결 중 pending tool call은 queue에 보관, 연결 복구 후 replay
- 재연결 실패 시 사용자에게 `mcp:reconnect:failed` 이벤트로 알림
- 세션 state preservation -- 재연결 후 이전 context 유지 시도

**2.2.3 Failure State Persistence**

```typescript
// src/mcp/health/failure-store.ts
interface McpFailureRecord {
  readonly serverId: string;
  readonly timestamp: Date;
  readonly errorType: 'connection' | 'auth' | 'timeout' | 'protocol' | 'unknown';
  readonly errorMessage: string;
  readonly reconnectAttempts: number;
  readonly resolved: boolean;
}
```

- `.dhelix/mcp-health.json`에 failure history 저장
- 세션 간 failure pattern 분석 가능
- 반복 실패 서버에 대한 자동 비활성화 제안

### 2.3 Phase 2: Granular Tool Filtering (v0.5)

**현재 문제:** MCP 서버의 모든 도구가 한꺼번에 enable/disable됨. 특정 도구만 선택적으로 노출하려면 별도 MCP 서버 인스턴스를 만들어야 함.

**목표 설계:**

```yaml
# .dhelix/mcp.yml
servers:
  github:
    command: "npx @modelcontextprotocol/server-github"
    tools:
      allow:
        - "github_create_issue"
        - "github_search_*"          # glob pattern 지원
      deny:
        - "github_delete_*"          # deny가 allow보다 우선
    resources:
      allow: ["repo://*"]
    prompts:
      allow: ["*"]
```

구현 세부사항:
- `McpToolFilter` 클래스: allow/deny 리스트 + glob pattern matching
- Deny-first evaluation: deny 매치 시 무조건 차단, 이후 allow 매치 확인
- Dynamic re-filtering: MCP 서버가 `notifications/tools/list_changed` 보내면 필터 재적용
- Agent loop에 전달되는 tool schema에서 필터링된 도구는 완전히 제거 (이름조차 노출 안 함)
- Per-session override: `--mcp-allow github:github_delete_repo` CLI flag

### 2.4 Phase 3: MCP Streaming Support (v0.5)

**현재 문제:** MCP tool call은 전체 결과가 올 때까지 blocking. 대용량 결과(예: 파일 목록, 검색 결과)에서 UX 지연.

**목표:**
- Progressive result streaming via SSE/Streamable HTTP transport
- Partial result display in CLI (streaming table, streaming text)

```typescript
// src/mcp/client/streaming-handler.ts
interface McpStreamingResult {
  readonly requestId: string;
  readonly isPartial: boolean;
  readonly content: ReadonlyArray<McpContent>;
  readonly progress?: {
    readonly current: number;
    readonly total: number;
    readonly message: string;
  };
}
```

구현 세부사항:
- SSE transport 구현: `EventSource` 기반, reconnection 내장
- Streamable HTTP transport: HTTP/2 기반, bidirectional streaming
- Agent loop의 tool result handler에 streaming adapter 추가
- CLI renderer에 progressive output component (Ink `<StreamingText />`)

### 2.5 Phase 4: Resource & Prompt Template Integration (v0.5)

**현재 문제:** MCP resource와 prompt template이 구현은 되어있으나 agent loop에서 활용하지 않음.

**목표:**
- Resource를 context로 자동 주입 (agent가 필요 시 fetch)
- Prompt template을 slash command로 자동 노출
- Resource subscription으로 real-time context update

```typescript
// src/mcp/resource/resource-context-provider.ts
interface ResourceContextEntry {
  readonly uri: string;
  readonly mimeType: string;
  readonly content: string;
  readonly subscribed: boolean;
  readonly lastUpdated: Date;
  readonly sizeBytes: number;
}
```

구현 세부사항:
- `resources/list` -> UI에서 browsable resource tree 표시
- `resources/read` -> agent context에 resource content 주입
- `resources/subscribe` -> resource 변경 시 자동 context refresh
- `prompts/list` -> `/mcp:prompt:{name}` 형태의 동적 slash command 생성
- `prompts/get` -> prompt template에 argument 바인딩 후 agent에 전달

### 2.6 Phase 5: OAuth 2.1 + PKCE Upgrade (v0.6)

**2026 MCP 트렌드:** OAuth 2.1 + PKCE가 Q2 2026 표준으로 확정. 기존 OAuth 2.0 implicit flow는 deprecated 예정.

```typescript
// src/mcp/auth/oauth21-handler.ts
interface OAuth21Config {
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly clientId: string;
  readonly scopes: ReadonlyArray<string>;
  readonly pkce: {
    readonly codeVerifierLength: number;  // 43-128
    readonly codeChallengeMethod: 'S256'; // plain은 금지
  };
  readonly tokenStorage: 'keychain' | 'encrypted-file';
  readonly refreshStrategy: 'proactive' | 'on-demand';
}
```

구현 세부사항:
- PKCE S256 code challenge 생성 (crypto.subtle 사용)
- Token storage: macOS Keychain / Linux secret-service / Windows Credential Manager
- Proactive token refresh: 만료 5분 전 자동 갱신
- Multi-account support: 동일 MCP 서버에 대해 복수 계정 전환
- Device authorization flow: headless 환경(SSH 등)에서의 인증

### 2.7 Phase 6: Agent-to-Agent MCP Readiness (v0.6)

**2026 MCP 트렌드:** Q3 2026에 Agent-to-Agent MCP 프로토콜 draft 예상.

**준비 사항:**
- DHelix의 subagent가 MCP server로 동작 가능하도록 interface 설계
- Agent capability advertisement: 각 subagent가 자신의 tool/resource를 MCP로 노출
- Agent discovery: 로컬 네트워크 또는 registry에서 다른 agent 탐색
- Delegation protocol: agent가 다른 agent에게 task 위임

```typescript
// src/mcp/agent-to-agent/agent-mcp-server.ts
interface AgentMcpCapability {
  readonly agentId: string;
  readonly agentType: 'subagent' | 'external';
  readonly capabilities: ReadonlyArray<string>;
  readonly tools: ReadonlyArray<McpToolDefinition>;
  readonly resources: ReadonlyArray<McpResourceDefinition>;
  readonly trustLevel: 'local' | 'verified' | 'untrusted';
}
```

### 2.8 Phase 7: MCP Registry Client (v0.7)

**2026 MCP 트렌드:** Q4 2026에 MCP Registry 표준 예상.

```typescript
// src/mcp/registry/registry-client.ts
interface McpRegistryClient {
  search(query: string, filters: RegistryFilters): Promise<ReadonlyArray<McpServerEntry>>;
  install(serverId: string, version: string): Promise<McpServerConfig>;
  update(serverId: string): Promise<McpServerConfig>;
  verify(serverId: string): Promise<VerificationResult>;
  rate(serverId: string, rating: number, review: string): Promise<void>;
}

interface McpServerEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly author: string;
  readonly verified: boolean;
  readonly downloads: number;
  readonly rating: number;
  readonly transports: ReadonlyArray<'stdio' | 'sse' | 'http'>;
  readonly tools: ReadonlyArray<string>;
  readonly resources: ReadonlyArray<string>;
  readonly requiredAuth: 'none' | 'api-key' | 'oauth';
}
```

구현 세부사항:
- `dhelix mcp search <query>` -- registry 검색
- `dhelix mcp install <server>` -- 자동 config 생성 + 의존성 설치
- `dhelix mcp update` -- 전체 MCP 서버 업데이트 확인
- Verification: 서명 검증, known-vulnerability 체크
- Cache: registry 메타데이터 로컬 캐시 (1시간 TTL)

### 2.9 MCP Tool Naming Convention

**2026 표준:** `{service}_{action}_{resource}` 패턴.

DHelix bridge에서 MCP tool을 agent에 노출할 때:
- 원본 이름 보존 (MCP 서버가 정의한 이름)
- Qualified name 생성: `{serverName}:{originalToolName}`
- 충돌 시 qualified name 강제 사용
- Agent에게 tool description에 서버 출처 명시

---

## 3. Skills System Overhaul

### 3.1 Current State Analysis

```
src/skills/
  loader.ts         # 4개 디렉토리에서 .md 파일 로딩
  executor.ts       # Shell injection 방어 + fork 실행
  manager.ts        # Skill lifecycle management
  command-bridge.ts # Skill-to-command bridge
  types.ts          # Shared types
```

**현재 동작하는 것:**
- 4개 디렉토리에서 skill 파일 발견 (global, project, local, built-in)
- Skill-to-command bridge (command-bridge.ts)
- Fork execution으로 skill 격리 실행 (executor.ts)
- Skill lifecycle management (manager.ts)

**동작하지 않거나 부족한 것:**
- Typed manifest 없음 -- skill은 단순 markdown 파일
- Skill composition 불가 -- skill A가 skill B를 호출할 수 없음
- Trust model 없음 -- 모든 skill이 동일 권한으로 실행
- Remote skill loading 없음
- Marketplace 없음
- Agent-filtered delivery 없음 (OpenCode는 agent 유형에 따라 다른 skill set 제공)
- Version/dependency management 없음

### 3.2 Phase 1: Typed Skill Manifests (v0.5)

**목표:** Skill을 structured metadata가 있는 first-class entity로 격상.

```markdown
---
name: verify-architecture
version: 1.2.0
description: "4-Layer 아키텍처 규칙 검증"
author: "dhelix-team"
tags: [architecture, verification, ci]
triggers:
  - pattern: "아키텍처 검증"
  - pattern: "구조 체크"
  - pattern: "레이어 위반"
inputs:
  target_dir:
    type: string
    default: "src/"
    description: "검증 대상 디렉토리"
  strict:
    type: boolean
    default: false
    description: "strict 모드 (warning도 error로 취급)"
outputs:
  violations:
    type: array
    description: "발견된 위반 사항 목록"
  score:
    type: number
    description: "아키텍처 점수 (0-100)"
requires:
  tools: [bash_exec, glob_search, grep_search]
  permissions: [file_read]
agent_filter:
  include: [main, reviewer, architect]
  exclude: [minimal]
---

# verify-architecture

아키텍처 검증을 수행합니다...
```

구현 세부사항:
- Frontmatter parser: `gray-matter` 라이브러리로 YAML frontmatter 파싱
- Zod schema로 frontmatter 유효성 검증
- `SkillManifest` 타입 정의 -- immutable readonly interface
- 기존 skill 파일 backward compatibility: frontmatter 없는 skill도 계속 동작
- Migration tool: `dhelix skill migrate` -- 기존 skill에 최소 frontmatter 자동 생성

```typescript
// src/skills/manifest.ts
interface SkillManifest {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly tags: ReadonlyArray<string>;
  readonly triggers: ReadonlyArray<SkillTrigger>;
  readonly inputs: Readonly<Record<string, SkillInput>>;
  readonly outputs: Readonly<Record<string, SkillOutput>>;
  readonly requires: SkillRequirements;
  readonly agentFilter: SkillAgentFilter;
  readonly trustLevel?: 'built-in' | 'project' | 'community' | 'untrusted';
}
```

### 3.3 Phase 2: Skill Composition & Chaining (v0.5)

**목표:** Skill이 다른 skill을 호출하여 복합 워크플로우를 구성.

```markdown
---
name: full-verification
version: 1.0.0
compose:
  - skill: verify-architecture
    inputs:
      strict: true
  - skill: verify-tool-metadata-pipeline
    condition: "prev.score > 80"
  - skill: verify-model-capabilities
    parallel: true
  - skill: code-reviewer
    inputs:
      files: "{{changed_files}}"
    parallel: true
aggregate:
  strategy: "merge-outputs"
  fail_fast: false
---
```

구현 세부사항:
- `SkillComposer` 클래스: DAG 기반 skill 실행 그래프
- Sequential composition: `compose` 배열 순서대로 실행
- Parallel composition: `parallel: true`인 skill들은 동시 실행
- Conditional execution: `condition` 표현식으로 이전 skill 결과 기반 분기
- Output aggregation: `merge-outputs`, `first-success`, `all-must-pass` 전략
- Circular dependency 감지: skill graph에서 cycle 탐지 후 에러

```typescript
// src/skills/composer.ts
interface SkillComposition {
  readonly steps: ReadonlyArray<SkillStep>;
  readonly aggregate: AggregationStrategy;
  readonly failFast: boolean;
}

interface SkillStep {
  readonly skillName: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly condition?: string;
  readonly parallel: boolean;
  readonly timeout?: number;
}
```

### 3.4 Phase 3: Skill Marketplace Concept (v0.6)

**목표:** Community skill 공유 및 발견 플랫폼.

```
dhelix skill search "code review"
dhelix skill install @community/advanced-code-reviewer
dhelix skill publish ./my-skill.md
dhelix skill verify @community/advanced-code-reviewer
```

**Marketplace Architecture:**

```
[Skill Author] --publish--> [Registry API] --index--> [Search Index]
                                  |
[DHelix CLI] --search/install--> [Registry API] --download--> [CDN]
                                  |
                            [Trust Service] --verify--> [Signature DB]
```

구현 세부사항:
- Registry API: REST endpoint (GitHub Packages 또는 자체 호스팅)
- Skill package format: `.dhelix-skill` (tar.gz with manifest + content + signature)
- Namespace: `@{author}/{skill-name}` (npm 스타일)
- Version resolution: semver 기반, `^1.0.0` 범위 지정 가능
- Install location: `~/.dhelix/skills/community/{author}/{name}/`

### 3.5 Phase 4: Remote Skill Loading with Trust Tiers (v0.6)

**목표:** URL에서 skill을 동적으로 로드하되, trust 수준에 따라 권한 제한.

**Trust Tiers:**

| Tier | Source | Permissions | Review Required |
|------|--------|-------------|----------------|
| **T0: Built-in** | `src/skills/built-in/` | Full | No |
| **T1: Project** | `{project}/.dhelix/skills/` | Full (project scope) | No |
| **T2: Verified** | Marketplace (signed) | Declared permissions only | First install |
| **T3: Community** | Marketplace (unsigned) | Read-only + sandboxed | Every execution |
| **T4: Remote URL** | Arbitrary URL | Sandboxed, no file write | Every execution |

```typescript
// src/skills/trust/trust-evaluator.ts
interface TrustEvaluation {
  readonly tier: 0 | 1 | 2 | 3 | 4;
  readonly source: string;
  readonly signatureValid: boolean;
  readonly permissionsGranted: ReadonlyArray<string>;
  readonly permissionsDenied: ReadonlyArray<string>;
  readonly requiresApproval: boolean;
  readonly riskAssessment: 'low' | 'medium' | 'high';
}
```

구현 세부사항:
- Ed25519 서명 검증 (built-in + verified skill)
- Permission intersection: skill이 선언한 `requires` vs tier가 허용하는 권한
- Sandbox execution: T3/T4 skill은 별도 프로세스에서 실행, fs 접근 차단
- Approval tracking: `~/.dhelix/skill-approvals.json`에 사용자 승인 기록
- Revocation: 문제 발견 시 registry에서 revoke -> 로컬 캐시에서도 비활성화

---

## 4. Command System Consolidation

### 4.1 Current State Analysis

```
src/commands/
  42개 slash command 모듈 (각각 별도 파일)
  registry.ts (정적 등록)
```

**현재 동작하는 것:**
- 42개 slash command (`/help`, `/model`, `/mcp`, `/skill`, `/config`, `/memory` 등)
- Tab completion 기반 discoverability
- 명령어별 독립 handler

**문제점:**
- **Sprawl risk**: 42개 명령이 체계 없이 나열, 사용자가 원하는 명령을 찾기 어려움
- **Inconsistent parameter parsing**: 명령마다 다른 argument 파싱 방식
- **No unified source**: built-in 명령만 존재, MCP prompt이나 skill에서 생성된 명령은 별도 경로
- **No command metadata**: 사용 빈도, deprecation status, stability level 등 메타데이터 없음

### 4.2 Unified Command Graph (v0.5)

**목표:** 모든 명령 소스(built-in, MCP prompt, plugin, skill)를 단일 command graph로 통합.

```typescript
// src/commands/command-graph.ts
interface CommandNode {
  readonly id: string;                          // unique identifier
  readonly name: string;                        // display name (e.g., "mcp status")
  readonly aliases: ReadonlyArray<string>;       // alternative names
  readonly source: CommandSource;
  readonly category: CommandCategory;
  readonly parameters: ReadonlyArray<CommandParameter>;
  readonly description: string;
  readonly examples: ReadonlyArray<string>;
  readonly stability: 'stable' | 'beta' | 'experimental' | 'deprecated';
  readonly usageCount: number;                  // session-level analytics
  readonly children: ReadonlyArray<CommandNode>; // subcommands
}

type CommandSource =
  | { readonly type: 'built-in'; readonly module: string }
  | { readonly type: 'mcp-prompt'; readonly serverId: string; readonly promptName: string }
  | { readonly type: 'plugin'; readonly pluginId: string }
  | { readonly type: 'skill'; readonly skillName: string };

type CommandCategory =
  | 'navigation'    // /cd, /project
  | 'editing'       // /file, /edit
  | 'intelligence'  // /symbol, /outline, /references
  | 'agent'         // /model, /thinking, /verbose
  | 'extension'     // /mcp, /skill, /plugin
  | 'system'        // /config, /memory, /permissions
  | 'help'          // /help, /docs
  | 'workflow';     // /commit, /pr, /test
```

**Command Source Merge 전략:**

```
Built-in Commands (38)  ──┐
MCP Prompt Templates    ──┤──> Unified Command Graph ──> Tab Completion
Plugin Commands         ──┤                            ──> Fuzzy Search
Skill-generated Cmds    ──┘                            ──> Help System
```

구현 세부사항:
- Command registry를 static import에서 dynamic registration으로 전환
- MCP `prompts/list` 결과를 `/mcp:{promptName}` 명령으로 자동 등록
- Skill의 `triggers` 필드를 `/skill:{skillName}` 명령으로 자동 등록
- 충돌 해결: source priority (built-in > plugin > skill > mcp-prompt)
- Lazy loading: 명령 handler는 최초 실행 시점에 import

### 4.3 Consistent Parameter Parsing (v0.5)

**목표:** 모든 명령이 동일한 parameter 파싱 시스템 사용.

```typescript
// src/commands/parameters.ts
interface CommandParameter {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'enum' | 'file-path';
  readonly required: boolean;
  readonly default?: unknown;
  readonly description: string;
  readonly validation?: Zod.ZodType;
  readonly completions?: () => Promise<ReadonlyArray<string>>; // dynamic completions
}
```

구현 세부사항:
- Zod 기반 parameter validation (기존 프로젝트 패턴과 일관)
- Positional + named parameter 지원: `/search query --type=file --limit=10`
- Dynamic completions: parameter 값에 대한 tab completion (파일 경로, 모델 이름 등)
- Parsing 에러 시 사용 예시 자동 표시

### 4.4 Command Discovery & Search (v0.5)

**목표:** 사용자가 원하는 명령을 즉시 찾을 수 있는 UX.

```
> /help search
  Searching commands...

  Navigation:
    /cd <dir>                 Change working directory
    /project <name>           Switch project context

  Intelligence:
    /symbol <name>            Search for symbol definitions
    /references <symbol>      Find all references

  Found 4 commands matching "search"
```

구현 세부사항:
- **Fuzzy search**: Fuse.js 기반 명령어 이름 + 설명 + 태그 fuzzy matching
- **Category browsing**: `/help --category=intelligence` 로 카테고리별 탐색
- **Usage-based ranking**: 자주 사용하는 명령을 상위에 노출
- **Contextual suggestions**: 현재 작업 컨텍스트에 따라 관련 명령 추천
  - Git 변경사항이 있으면 `/commit`, `/diff` 추천
  - 에러 발생 시 `/debug`, `/test` 추천
- **Command deprecation**: deprecated 명령 사용 시 대체 명령 안내

### 4.5 Command Analytics & Pruning (v0.6)

```typescript
// src/commands/analytics.ts
interface CommandUsageStats {
  readonly commandId: string;
  readonly totalInvocations: number;
  readonly lastUsed: Date;
  readonly averageExecutionMs: number;
  readonly errorRate: number;
  readonly userSatisfaction: number; // 0-1, based on immediate re-invocation pattern
}
```

- Session-level 사용 통계 수집 (privacy: 로컬 전용, 외부 전송 없음)
- 30일 미사용 명령 자동 숨김 제안
- 에러율 높은 명령 자동 deprecation 후보 표시

---

## 5. LSP & Code Intelligence Enhancement

### 5.1 Current State Analysis

```
src/lsp/
  manager.ts              # On-demand LSP server lifecycle
  server-connection.ts    # LSP server connection (JSON-RPC)
  language-detector.ts    # Language detection for LSP
  ide-bridge.ts           # IDE bridge implementation
  ide-bridge-manager.ts   # IDE bridge lifecycle
  ide-bridge-protocol.ts  # IDE bridge protocol definitions
  index.ts                # Module exports
  types.ts                # Shared types

src/tools/definitions/    # LSP tools are defined here (not in src/lsp/tools/)
  goto-definition.ts      # goto_definition tool
  find-references.ts      # find_references tool
  get-type-info.ts        # get_type_info tool
  safe-rename.ts          # safe_rename tool

src/indexing/
  tree-sitter-engine.ts   # Tree-sitter indexing engine
  repo-map.ts             # Repository map generation
  queries/                # 5 language queries (TS, Python, Go, Rust, Java)
    index.ts              # Query registry
    typescript.ts         # TypeScript/JavaScript queries
    python.ts             # Python queries
    go.ts                 # Go queries
    rust.ts               # Rust queries
    java.ts               # Java queries
```

**현재 동작하는 것:**
- Tree-sitter: 5개 언어 구문 분석 (TypeScript/JavaScript, Python, Go, Rust, Java)
- LSP on-demand: 언어 서버를 필요 시 시작, 5분 idle 후 종료
- 4개 LSP tool: `goto_definition`, `find_references`, `get_type_info`, `safe_rename`
- `symbol_search`, `code_outline`, `find_dependencies` (tree-sitter 기반)

**동작하지 않거나 부족한 것:**
- TS/JS 외 언어의 LSP는 기본 수준 (Python: pyright 연동 불안정, Go: gopls 미테스트)
- Incremental indexing 없음 -- 파일 변경 시 전체 재인덱싱
- Semantic search (vector-based) 없음
- Call hierarchy, type hierarchy 미구현
- Refactoring support 미흡 (rename만 존재)
- Diagnostics integration 미완성
- 20+ language server 지원 필요 (OpenCode 수준)

### 5.2 Phase 1: Incremental Indexing (v0.5)

**목표:** 파일 변경 시 해당 파일만 재인덱싱, 의존 파일은 lazy invalidation.

```typescript
// src/indexing/incremental/incremental-engine.ts
interface IncrementalIndexState {
  readonly fileHashes: ReadonlyMap<string, string>;  // path -> content hash
  readonly dependencyGraph: ReadonlyMap<string, ReadonlySet<string>>; // path -> dependents
  readonly lastFullIndexTimestamp: Date;
  readonly staleFiles: ReadonlySet<string>;
  readonly indexVersion: number;
}

interface IndexUpdateResult {
  readonly filesReindexed: number;
  readonly filesInvalidated: number;
  readonly durationMs: number;
  readonly newSymbols: number;
  readonly removedSymbols: number;
}
```

구현 세부사항:
- **File watcher**: `chokidar` 기반 file system watcher
  - `.gitignore` + `.dhelixignore` 패턴 존중
  - Debounce: 500ms 내 중복 변경 무시
- **Content hash**: SHA-256 hash로 실제 내용 변경 여부 확인 (save 없이 닫은 파일 무시)
- **Dependency graph**: import/require 관계를 tree-sitter로 추출, 변경 전파
- **Lazy invalidation**: 변경 파일의 dependents는 즉시 재인덱싱하지 않고 `stale` 마킹, 조회 시 재인덱싱
- **Persistence**: `~/.dhelix/index-cache/{projectHash}/` 디렉토리에 인덱스 저장
  - 프로젝트 재오픈 시 인덱스 캐시 로드 -> warm start

### 5.3 Phase 2: Additional Language Support (v0.6)

**Target: 20+ languages**

| Priority | Language | LSP Server | Tree-sitter | Status |
|----------|----------|-----------|------------|--------|
| P0 | TypeScript/JS | typescript-language-server | tree-sitter-typescript | Stable |
| P0 | Python | pyright / pylsp | tree-sitter-python | Needs fixing |
| P0 | Go | gopls | tree-sitter-go | Needs testing |
| P0 | Rust | rust-analyzer | tree-sitter-rust | Needs testing |
| P1 | Java | jdtls | tree-sitter-java | Basic |
| P1 | C/C++ | clangd | tree-sitter-c / tree-sitter-cpp | Not implemented (no query file) |
| P1 | C# | OmniSharp | tree-sitter-c-sharp | Not implemented |
| P1 | Swift | sourcekit-lsp | tree-sitter-swift | Not implemented |
| P1 | Kotlin | kotlin-language-server | tree-sitter-kotlin | Not implemented |
| P2 | Ruby | solargraph | tree-sitter-ruby | Not implemented |
| P2 | PHP | intelephense | tree-sitter-php | Not implemented |
| P2 | Dart | dart analyze | tree-sitter-dart | Not implemented |
| P2 | Zig | zls | tree-sitter-zig | Not implemented |
| P2 | Elixir | elixir-ls | tree-sitter-elixir | Not implemented |
| P2 | Lua | lua-language-server | tree-sitter-lua | Not implemented |
| P2 | Haskell | haskell-language-server | tree-sitter-haskell | Not implemented |
| P3 | Scala | metals | tree-sitter-scala | Not implemented |
| P3 | OCaml | ocamllsp | tree-sitter-ocaml | Not implemented |
| P3 | Clojure | clojure-lsp | tree-sitter-clojure | Not implemented |
| P3 | Julia | LanguageServer.jl | tree-sitter-julia | Not implemented |

구현 세부사항:
- **Auto-detection**: 프로젝트 파일 확장자 스캔 -> 필요한 LSP 서버 자동 판별
- **Auto-install**: LSP 서버가 없으면 설치 제안 (npm/pip/go install/cargo 등)
- **Config template**: 각 언어별 기본 LSP config 내장
- **Health validation**: LSP 서버 시작 후 `initialize` 응답 검증

```typescript
// src/lsp/language-registry.ts
interface LanguageConfig {
  readonly languageId: string;
  readonly extensions: ReadonlyArray<string>;
  readonly lspServer: {
    readonly name: string;
    readonly command: string;
    readonly args: ReadonlyArray<string>;
    readonly installCommand: string;
    readonly initializationOptions?: Record<string, unknown>;
  };
  readonly treeSitterGrammar: string;
  readonly queryFile: string;
}
```

### 5.4 Phase 3: Semantic Search (v0.6)

**목표:** Code embedding 기반 의미적 코드 검색.

```
dhelix> "사용자 인증을 처리하는 함수 찾아줘"

  Semantic search results (confidence):
  1. [0.94] src/auth/authenticator.ts:42 - authenticateUser()
  2. [0.89] src/auth/token-validator.ts:15 - validateToken()
  3. [0.82] src/middleware/auth-guard.ts:8 - authGuard()
  4. [0.71] src/utils/jwt.ts:22 - verifyJwt()
```

구현 세부사항:
- **Embedding model**: local model 우선 (sentence-transformers 또는 ONNX runtime)
  - Fallback: OpenAI `text-embedding-3-small` (API key 있을 때)
- **Chunking strategy**: Function/class 단위 chunking (tree-sitter AST 기반)
  - 각 chunk에 메타데이터: file path, symbol name, docstring, imports
- **Vector store**: SQLite + custom vector extension (sqlite-vec) 또는 FAISS
  - `~/.dhelix/index-cache/{projectHash}/embeddings.db`
- **Incremental embedding**: 변경된 파일의 chunk만 re-embed
- **Query expansion**: 사용자 자연어 쿼리를 여러 변형으로 확장하여 recall 향상
- **Hybrid search**: vector similarity + keyword matching (BM25) 조합

```typescript
// src/indexing/semantic/semantic-search-engine.ts
interface SemanticSearchResult {
  readonly filePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly symbolName: string;
  readonly symbolType: string;
  readonly snippet: string;
  readonly confidence: number;
  readonly matchType: 'semantic' | 'keyword' | 'hybrid';
}
```

### 5.5 Phase 4: Refactoring Support (v0.6)

**목표:** LSP의 code action과 workspace edit 기능을 활용한 리팩토링 도구.

**지원할 리팩토링 작업:**

| Refactoring | LSP Method | Description |
|-------------|-----------|-------------|
| Rename | `textDocument/rename` | 이미 구현 (`safe_rename`) |
| Extract Function | `textDocument/codeAction` | 선택 영역을 함수로 추출 |
| Extract Variable | `textDocument/codeAction` | 표현식을 변수로 추출 |
| Inline Variable | `textDocument/codeAction` | 변수를 inline으로 치환 |
| Move Symbol | workspace edit | 심볼을 다른 파일로 이동 |
| Change Signature | `textDocument/codeAction` | 함수 시그니처 변경 |

```typescript
// src/lsp/tools/refactor-tool.ts
interface RefactorRequest {
  readonly type: RefactorType;
  readonly filePath: string;
  readonly range: Range;
  readonly newName?: string;        // for rename
  readonly targetPath?: string;     // for move
  readonly preview: boolean;        // dry-run으로 변경사항 미리보기
}

interface RefactorPreview {
  readonly changes: ReadonlyArray<{
    readonly filePath: string;
    readonly edits: ReadonlyArray<TextEdit>;
    readonly description: string;
  }>;
  readonly riskLevel: 'safe' | 'moderate' | 'risky';
  readonly affectedFiles: number;
  readonly affectedSymbols: number;
}
```

### 5.6 Phase 5: Advanced LSP Features (v0.6)

**Call Hierarchy:**
```typescript
// textDocument/prepareCallHierarchy + callHierarchy/incomingCalls + callHierarchy/outgoingCalls
interface CallHierarchyResult {
  readonly symbol: string;
  readonly incomingCalls: ReadonlyArray<CallHierarchyItem>;
  readonly outgoingCalls: ReadonlyArray<CallHierarchyItem>;
  readonly depth: number;
}
```

**Type Hierarchy:**
```typescript
// textDocument/prepareTypeHierarchy + typeHierarchy/supertypes + typeHierarchy/subtypes
interface TypeHierarchyResult {
  readonly symbol: string;
  readonly supertypes: ReadonlyArray<TypeHierarchyItem>;
  readonly subtypes: ReadonlyArray<TypeHierarchyItem>;
}
```

**Diagnostics Integration:**
- LSP `textDocument/publishDiagnostics`를 실시간 수신
- Agent에게 현재 파일의 diagnostics를 context로 제공
- Error/warning count를 CLI status bar에 표시
- `dhelix diagnostics` 명령으로 프로젝트 전체 diagnostics 요약

**Hover Information:**
- `textDocument/hover` 결과를 agent context에 활용
- 타입 정보, docstring, 정의 위치를 agent가 참조 가능

---

## 6. Hook System Maturation

### 6.1 Current State Analysis

```
src/hooks/
  runner.ts           # Hook execution engine
  loader.ts           # Hook configuration loading
  auto-lint.ts        # Auto-lint hook (PostToolUse)
  team-events.ts      # Team event hooks
  types.ts            # Shared types
```

**현재 동작하는 것:**
- PostToolUse hook (파일 편집 후 자동 lint/format)
- Event-driven hook runner
- Hook timeout (default 30초)

**동작하지 않거나 부족한 것:**
- Event coverage 42% -- 많은 lifecycle 이벤트에 hook 미지원
- Hook 실행 결과 추적/디버깅 없음
- Typed execution backend 없음 (모든 hook이 shell 기반)
- Hook composition 없음
- Hook 에러가 조용히 무시됨

### 6.2 Phase 1: Complete Event Coverage (v0.5)

**목표:** 모든 주요 lifecycle 이벤트에 hook point 제공.

| Event | Phase | Description | Current |
|-------|-------|-------------|---------|
| `session:start` | Pre/Post | 세션 시작 | Missing |
| `session:end` | Pre/Post | 세션 종료 | Missing |
| `message:send` | Pre/Post | 사용자 메시지 전송 | Missing |
| `message:receive` | Pre/Post | LLM 응답 수신 | Missing |
| `tool:call` | Pre/Post | 도구 호출 | Post only |
| `tool:result` | Pre/Post | 도구 결과 수신 | Missing |
| `file:read` | Pre/Post | 파일 읽기 | Missing |
| `file:write` | Pre/Post | 파일 쓰기 | Partial (lint) |
| `file:edit` | Pre/Post | 파일 편집 | Partial (lint) |
| `command:execute` | Pre/Post | 슬래시 명령 실행 | Missing |
| `mcp:connect` | Pre/Post | MCP 서버 연결 | Missing |
| `mcp:disconnect` | Pre/Post | MCP 서버 연결 해제 | Missing |
| `mcp:tool:call` | Pre/Post | MCP 도구 호출 | Missing |
| `agent:spawn` | Pre/Post | 서브에이전트 생성 | Missing |
| `agent:complete` | Pre/Post | 서브에이전트 완료 | Missing |
| `context:compact` | Pre/Post | 컨텍스트 압축 | Missing |
| `permission:request` | Pre/Post | 권한 요청 | Missing |
| `permission:grant` | Post | 권한 승인 | Missing |
| `error:recover` | Post | 에러 복구 | Missing |

구현 세부사항:
- 각 event에 `Pre`/`Post` 두 가지 hook point
- `Pre` hook은 실행을 취소하거나 입력을 변형 가능 (return `{ cancel: true }` 또는 `{ transform: newInput }`)
- `Post` hook은 결과를 관찰하거나 부수 효과 실행 (결과 변형 불가)
- EventBus에 hook dispatch 통합 -- 기존 이벤트 시스템 확장

### 6.3 Phase 2: Typed Execution Backends (v0.5)

**목표:** Shell 스크립트 외에 TypeScript 함수, WASM, MCP tool을 hook handler로 사용.

```yaml
# .dhelix/settings.json
{
  "hooks": {
    "file:write:post": [
      {
        "type": "shell",
        "command": "prettier --write {{file}}"
      },
      {
        "type": "typescript",
        "module": "./.dhelix/hooks/custom-validator.ts",
        "function": "validateOutput"
      },
      {
        "type": "mcp-tool",
        "server": "linter",
        "tool": "lint_file",
        "args": { "path": "{{file}}" }
      }
    ]
  }
}
```

```typescript
// src/hooks/backends/hook-backend.ts
interface HookBackend {
  readonly type: 'shell' | 'typescript' | 'mcp-tool' | 'wasm';
  execute(context: HookContext): Promise<HookResult>;
  validate(): Promise<boolean>;
  getTimeout(): number;
}

interface HookContext {
  readonly event: string;
  readonly phase: 'pre' | 'post';
  readonly data: Readonly<Record<string, unknown>>;
  readonly signal: AbortSignal;
}

interface HookResult {
  readonly success: boolean;
  readonly output?: string;
  readonly error?: string;
  readonly transform?: Record<string, unknown>; // pre-hook only
  readonly cancel?: boolean;                     // pre-hook only
  readonly durationMs: number;
}
```

### 6.4 Phase 3: Hook Debugging UX (v0.5)

**목표:** Hook 실행 과정을 투명하게 보여주는 디버깅 도구.

```
dhelix> /hooks status

  Active Hooks:
  ┌─────────────────────┬──────────┬──────────┬───────┬──────────┐
  │ Event               │ Type     │ Handler  │ Runs  │ Avg (ms) │
  ├─────────────────────┼──────────┼──────────┼───────┼──────────┤
  │ file:write:post     │ shell    │ prettier │ 142   │ 85       │
  │ file:write:post     │ shell    │ eslint   │ 142   │ 210      │
  │ tool:call:pre       │ ts       │ guard    │ 891   │ 3        │
  │ mcp:connect:post    │ mcp-tool │ notify   │ 12    │ 450      │
  └─────────────────────┴──────────┴──────────┴───────┴──────────┘

dhelix> /hooks trace file:write:post

  [12:34:56.001] file:write:post triggered for src/index.ts
  [12:34:56.002] → prettier --write src/index.ts
  [12:34:56.087] ← prettier: success (85ms)
  [12:34:56.088] → eslint --fix src/index.ts
  [12:34:56.298] ← eslint: success (210ms)
  [12:34:56.299] Hook chain complete (297ms total)
```

구현 세부사항:
- `/hooks status`: 전체 hook 등록 현황 + 실행 통계
- `/hooks trace <event>`: 특정 이벤트의 hook 실행 실시간 로그
- `/hooks dry-run <event>`: hook을 실제 실행하지 않고 어떤 handler가 트리거될지 미리보기
- `/hooks test <event>`: 테스트 데이터로 hook 체인 실행
- Verbose mode (`Ctrl+O`)에서 모든 hook 실행을 실시간 표시

---

## 7. Plugin Platform Vision

### 7.1 Current State

DHelix에는 현재 플러그인 시스템이 **존재하지 않음**. OpenCode는 이미 TypeScript plugin hooks, TUI plugins, npm/local/git 로딩을 갖추고 있어 가장 큰 feature gap 중 하나.

### 7.2 Plugin Architecture

**목표:** Multi-surface plugin system -- 하나의 플러그인이 여러 확장 지점에 동시 기여.

```typescript
// src/plugins/plugin-manifest.ts
interface PluginManifest {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly license: string;
  readonly dhelixVersion: string;           // 호환 DHelix 버전 범위
  readonly surfaces: ReadonlyArray<PluginSurface>;
  readonly permissions: ReadonlyArray<string>;
  readonly dependencies: Readonly<Record<string, string>>; // 다른 플러그인 의존
}

type PluginSurface =
  | PluginCommandSurface
  | PluginToolSurface
  | PluginHookSurface
  | PluginAgentSurface
  | PluginMcpSurface
  | PluginOutputSurface
  | PluginThemeSurface;
```

### 7.3 Plugin Surfaces

**7.3.1 Command Surface**
```typescript
interface PluginCommandSurface {
  readonly type: 'command';
  readonly commands: ReadonlyArray<{
    readonly name: string;
    readonly description: string;
    readonly handler: string; // module path within plugin
    readonly parameters: ReadonlyArray<CommandParameter>;
  }>;
}
```

**7.3.2 Tool Surface**
```typescript
interface PluginToolSurface {
  readonly type: 'tool';
  readonly tools: ReadonlyArray<{
    readonly name: string;
    readonly description: string;
    readonly schema: ZodSchema;
    readonly executor: string;
    readonly displayConfig: ToolDisplayConfig;
  }>;
}
```

**7.3.3 Hook Surface**
```typescript
interface PluginHookSurface {
  readonly type: 'hook';
  readonly hooks: ReadonlyArray<{
    readonly event: string;
    readonly phase: 'pre' | 'post';
    readonly handler: string;
    readonly priority: number;
  }>;
}
```

**7.3.4 Agent Surface**
```typescript
interface PluginAgentSurface {
  readonly type: 'agent';
  readonly agents: ReadonlyArray<{
    readonly name: string;
    readonly systemPrompt: string;
    readonly tools: ReadonlyArray<string>;  // available tool names
    readonly model?: string;
  }>;
}
```

**7.3.5 MCP Surface**
```typescript
interface PluginMcpSurface {
  readonly type: 'mcp';
  readonly servers: ReadonlyArray<{
    readonly name: string;
    readonly config: McpServerConfig;
    readonly autoStart: boolean;
  }>;
}
```

**7.3.6 Output/Theme Surface**
```typescript
interface PluginOutputSurface {
  readonly type: 'output';
  readonly formatters: ReadonlyArray<{
    readonly contentType: string;       // 'markdown' | 'code' | 'table' | 'diagram'
    readonly renderer: string;
  }>;
}

interface PluginThemeSurface {
  readonly type: 'theme';
  readonly theme: {
    readonly colors: Partial<ThemeColors>;
    readonly icons: Partial<ThemeIcons>;
    readonly layout: Partial<ThemeLayout>;
  };
}
```

### 7.4 Plugin Loading

```typescript
// src/plugins/loader/plugin-loader.ts
interface PluginLoader {
  loadFromNpm(packageName: string): Promise<Plugin>;
  loadFromLocal(dirPath: string): Promise<Plugin>;
  loadFromGit(repoUrl: string, ref: string): Promise<Plugin>;
  loadFromUrl(url: string): Promise<Plugin>;
}
```

**Loading sources:**

| Source | Format | Example |
|--------|--------|---------|
| npm | `dhelix-plugin-{name}` | `npm install dhelix-plugin-docker` |
| Local | Directory with `dhelix-plugin.json` | `.dhelix/plugins/my-plugin/` |
| Git | Repository URL | `git+https://github.com/user/plugin.git` |
| URL | Direct download | `https://registry.dhelix.dev/plugins/docker/v1.0.0` |

### 7.5 Trust Model & Security (v0.6)

```typescript
// src/plugins/security/plugin-sandbox.ts
interface PluginSecurityPolicy {
  readonly trustLevel: 'official' | 'verified' | 'community' | 'local';
  readonly permissions: {
    readonly fileSystem: 'none' | 'read-only' | 'project-only' | 'full';
    readonly network: 'none' | 'localhost' | 'allowlist' | 'full';
    readonly shell: 'none' | 'sandboxed' | 'full';
    readonly env: 'none' | 'allowlist' | 'full';
  };
  readonly resourceLimits: {
    readonly maxMemoryMb: number;
    readonly maxCpuPercent: number;
    readonly maxDiskMb: number;
    readonly timeoutMs: number;
  };
}
```

구현 세부사항:
- Official plugins: DHelix 팀 서명, 모든 권한 허용
- Verified plugins: 제3자 서명, 선언된 권한만 허용
- Community plugins: 서명 없음, 최소 권한 + 사용자 승인 필요
- Plugin isolation: 각 플러그인은 별도 V8 context 또는 worker thread에서 실행
- Permission audit: 플러그인의 실제 API 호출을 로깅하여 선언된 권한과 비교

### 7.6 Hot-Reload Support (v0.6)

```typescript
// src/plugins/lifecycle/hot-reload.ts
interface PluginHotReload {
  watch(pluginPath: string): void;
  reload(pluginId: string): Promise<void>;
  getState(pluginId: string): PluginState;
}

type PluginState =
  | 'loading'
  | 'active'
  | 'reloading'
  | 'error'
  | 'disabled';
```

구현 세부사항:
- File watcher on plugin source directory
- State preservation: reload 시 플러그인의 in-memory state 저장/복원
- Graceful reload: 진행 중인 hook/command 완료 후 reload
- Error recovery: reload 실패 시 이전 버전으로 자동 rollback
- Development mode: `dhelix plugin dev ./my-plugin` -- 변경 감지 + 자동 reload

---

## 8. Memory & Config Evolution

### 8.1 Memory System

**8.1.1 Current State**
- Project-scoped persistence (`~/.dhelix/memory/{projectHash}/`)
- Search API (keyword-based)
- Auto-memory from conversation

**8.1.2 Gaps vs Competitors**
- OpenCode: SQLite-backed with forking, snapshot diffing
- Codex: Built-in memory with structured storage

**8.1.3 Evolution Plan**

**Phase 1: SQLite Migration (v0.6)**

```typescript
// src/memory/sqlite-store.ts
interface MemoryStore {
  save(entry: MemoryEntry): Promise<void>;
  search(query: string, options: SearchOptions): Promise<ReadonlyArray<MemoryEntry>>;
  fork(sessionId: string): Promise<MemoryFork>;
  diff(forkA: string, forkB: string): Promise<MemoryDiff>;
  compact(strategy: CompactionStrategy): Promise<CompactionResult>;
}

interface MemoryEntry {
  readonly id: string;
  readonly type: 'fact' | 'preference' | 'decision' | 'context' | 'error-resolution';
  readonly content: string;
  readonly source: 'auto' | 'user' | 'agent';
  readonly confidence: number;          // 0-1
  readonly createdAt: Date;
  readonly lastAccessedAt: Date;
  readonly accessCount: number;
  readonly tags: ReadonlyArray<string>;
  readonly relatedEntries: ReadonlyArray<string>; // entry IDs
  readonly embedding?: ReadonlyArray<number>;     // for semantic search
}
```

구현 세부사항:
- `better-sqlite3` 사용 (synchronous API, 빠른 읽기)
- Full-text search: SQLite FTS5 extension
- Semantic search: embedding 컬럼 + cosine similarity
- Migration: 기존 JSON 파일 -> SQLite 자동 변환

**Phase 2: Memory Forking & Diffing (v0.6)**

```typescript
interface MemoryFork {
  readonly forkId: string;
  readonly parentSessionId: string;
  readonly createdAt: Date;
  readonly entries: ReadonlyArray<MemoryEntry>;
  readonly divergencePoint: Date;
}

interface MemoryDiff {
  readonly added: ReadonlyArray<MemoryEntry>;
  readonly removed: ReadonlyArray<MemoryEntry>;
  readonly modified: ReadonlyArray<{
    readonly before: MemoryEntry;
    readonly after: MemoryEntry;
  }>;
}
```

- 세션 시작 시 자동 fork 생성
- 세션 종료 시 fork를 main memory에 merge (conflict resolution)
- Diff 시각화: `/memory diff <sessionA> <sessionB>`

**Phase 3: Memory Quality & Freshness (v0.6)**

```typescript
interface MemoryQualityMetrics {
  readonly totalEntries: number;
  readonly duplicateRate: number;       // 중복 비율
  readonly contradictionCount: number;  // 모순 항목 수
  readonly staleEntries: number;        // 30일 이상 미접근
  readonly averageConfidence: number;
  readonly coverageScore: number;       // 프로젝트 주요 영역 커버리지
}
```

- Contradiction detection: 동일 주제에 대한 상반된 memory 자동 감지
- Staleness scoring: 오래된 memory의 confidence 자동 감소
- Consolidation: 유사 memory 항목 자동 병합 제안
- `/memory health` 명령으로 quality 대시보드

### 8.2 Config System

**8.2.1 Current State**
- 5-layer merge: default < global < project < local < env
- `.dhelix/` 디렉토리 기반 설정

**8.2.2 Gaps**
- Managed preferences (macOS MDM plist) 미지원 -- OpenCode는 지원
- Config validation이 runtime에서만 발생 (타입 에러가 늦게 발견)
- Config diff/debug 도구 없음

**8.2.3 Evolution Plan**

**Phase 1: Config Validation & Schema (v0.5)**

```typescript
// src/config/schema.ts
// Zod 기반 전체 config schema 정의
const DhelixConfigSchema = z.object({
  model: z.object({
    default: z.string(),
    fallback: z.string().optional(),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().positive().optional(),
  }),
  mcp: z.object({
    servers: z.record(McpServerConfigSchema),
    globalTimeout: z.number().positive().default(30000),
  }),
  hooks: z.record(z.array(HookConfigSchema)),
  permissions: PermissionConfigSchema,
  // ... 전체 config 영역
});
```

- `dhelix config validate` -- 전체 config 유효성 검증
- `dhelix config schema` -- JSON Schema 출력 (IDE integration)
- Config 파일 저장 시 자동 validation (hook)

**Phase 2: Config Debug & Provenance (v0.6)**

```
dhelix> /config debug model.default

  Effective value: "claude-sonnet-4-20250514"

  Resolution chain:
  1. [default]  "gpt-4o"
  2. [global]   "claude-sonnet-4-20250514"     ← ~/.dhelix/config.yml:3
  3. [project]  (not set)
  4. [local]    (not set)
  5. [env]      (not set)

  Final: "claude-sonnet-4-20250514" (from global)
```

- 각 config 값의 출처 추적 (어느 layer에서 왔는지)
- Config merge 과정 시각화
- Override 충돌 경고

**Phase 3: Managed Preferences (v0.6)**

```typescript
// src/config/managed/managed-preferences.ts
interface ManagedPreferences {
  loadFromMdm(): Promise<Partial<DhelixConfig>>;    // macOS MDM plist
  loadFromGpo(): Promise<Partial<DhelixConfig>>;    // Windows GPO
  loadFromLdap(): Promise<Partial<DhelixConfig>>;   // Enterprise LDAP
  getManagedKeys(): ReadonlyArray<string>;            // 관리자가 잠근 키 목록
  isLocked(key: string): boolean;                    // 사용자가 변경 불가한 키
}
```

- Enterprise deployment: 관리자가 특정 config를 강제 적용 가능
- `managed` layer를 config merge chain의 최상위에 추가
- Locked config는 UI에서 자물쇠 아이콘으로 표시

---

## 9. Success Metrics

### 9.1 Feature Completeness Targets

| Feature | Current | v0.5 Target | v0.6 Target | v1.0 Target |
|---------|---------|-------------|-------------|-------------|
| MCP | 72% | 82% | 90% | 95% |
| Skills | 65% | 78% | 88% | 93% |
| Commands | 76% | 82% | 88% | 92% |
| LSP | 71% | 80% | 88% | 95% |
| Hooks | 42% | 65% | 80% | 90% |
| Memory | 75% | 80% | 88% | 92% |
| Config | 78% | 85% | 90% | 95% |
| Indexing | 68% | 78% | 85% | 92% |
| Git | 77% | 82% | 88% | 93% |
| Plugin | 10% | 30% | 60% | 85% |

### 9.2 Quantitative KPIs

**MCP:**
- Reconnection success rate > 95%
- Health check false positive rate < 2%
- Tool filtering latency overhead < 5ms
- OAuth token refresh success rate > 99%

**Skills:**
- Typed manifest adoption > 80% of project skills
- Skill composition success rate > 90%
- Remote skill load time p95 < 2s
- Trust evaluation latency < 50ms

**Commands:**
- Command discovery time (user finds desired command) < 5s
- Parameter parse error rate < 3%
- Tab completion relevance score > 0.8

**LSP:**
- Language server startup time p95 < 3s
- Incremental re-index time p95 < 500ms (for single file change)
- Semantic search relevance (MRR@5) > 0.7
- 15+ languages with stable LSP support

**Hooks:**
- Event coverage > 90% of lifecycle events
- Hook execution overhead < 10% of total operation time
- Hook failure visibility: 100% (no silent failures)

**Plugins:**
- Plugin load time p95 < 1s
- Hot-reload downtime < 100ms
- Plugin isolation: 0 cross-plugin state leaks
- Marketplace: 20+ verified plugins at v1.0

**Memory:**
- Memory search latency p95 < 100ms
- Contradiction detection recall > 80%
- Memory consolidation quality score > 0.85
- Fork/merge conflict rate < 5%

### 9.3 Qualitative Goals

**Developer Experience:**
- 새 언어 프로젝트를 열었을 때 LSP + indexing이 30초 내 자동 활성화
- MCP 서버 장애 시 사용자가 인지하기 전에 자동 복구
- Skill 작성자가 typed manifest 덕분에 IDE autocomplete 지원 받음
- Plugin 개발자가 hot-reload로 edit-test cycle < 3초

**Competitive Parity:**
- OpenCode 대비 MCP feature 90% coverage (v0.5)
- OpenCode 대비 LSP feature 85% coverage (v0.5)
- Codex 대비 sandbox/security feature 80% coverage (v0.6)
- 고유 차별화: unified command graph, skill composition, multi-surface plugins

**Enterprise Readiness:**
- Managed preferences로 대규모 팀 배포 지원
- Plugin trust model로 supply-chain 보안 확보
- MCP OAuth 2.1로 enterprise SSO 연동
- Hook audit log로 compliance 요구사항 충족

### 9.4 Implementation Priority Matrix

```
                    HIGH IMPACT
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
    │  MCP Health       │  Incremental      │
    │  Typed Skills     │    Indexing        │
    │  Event Coverage   │  Semantic Search   │
    │                   │  Plugin Platform   │
    │   DO FIRST        │   DO NEXT          │
    │   (v0.5)          │   (v0.6)           │
LOW ├───────────────────┼───────────────────┤ HIGH
EFFORT                  │                     EFFORT
    │  Command Graph    │  Agent-to-Agent    │
    │  Config Validate  │  MCP Registry      │
    │  Hook Debug UX    │  Managed Prefs     │
    │                   │  Memory SQLite     │
    │   QUICK WINS      │   STRATEGIC        │
    │   (v0.5)          │   (v0.6-0.7)       │
    │                   │                   │
    └───────────────────┼───────────────────┘
                        │
                    LOW IMPACT
```

### 9.5 Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| MCP spec 변경 (OAuth 2.1 -> 2.2) | High | Medium | Abstraction layer로 격리, adapter pattern |
| Plugin security breach | Critical | Low | Sandbox isolation, permission audit, signing |
| LSP server compatibility issues | Medium | High | Fallback to tree-sitter, per-language test suite |
| Skill marketplace adoption 부진 | Medium | Medium | 풍부한 built-in skills, easy migration path |
| Memory SQLite corruption | High | Low | WAL mode, periodic backup, integrity checks |
| Hook performance overhead | Medium | Medium | Async execution, timeout enforcement, bypass flag |
| Plugin API breaking changes | High | Medium | Semantic versioning, deprecation period, compatibility shim |

---

## Appendix A: Implementation Timeline

```
v0.5 (Q2-Q3 2026) — Wave 3: UX & Features
├── MCP health checks & auto-reconnection
├── MCP granular tool filtering (glob patterns)
├── MCP streaming support
├── MCP resource & prompt integration
├── Typed skill manifests
├── Skill composition & chaining
├── Complete hook event coverage
├── Typed hook execution backends
├── Hook debugging UX
├── Unified command graph
├── Consistent parameter parsing
├── Command discovery & search
├── Config validation & schema
├── Incremental indexing
└── LSP stability fixes (Python, Go)

v0.6 (Q3-Q4 2026) — Wave 4: Platform Maturation
├── MCP OAuth 2.1 + PKCE
├── MCP Agent-to-Agent readiness
├── Skill marketplace concept
├── Remote skill loading with trust tiers
├── Plugin platform v1 (command + tool + hook surfaces)
├── Plugin trust model & security
├── Plugin hot-reload
├── Additional language support (C++, C#, Swift, Kotlin)
├── Semantic search (vector-based)
├── Refactoring support (extract, inline, move)
├── Advanced LSP (call hierarchy, type hierarchy, diagnostics)
├── Memory SQLite migration
├── Memory forking & diffing
├── Memory quality & freshness
├── Config debug & provenance
├── Managed preferences
├── Command analytics & pruning
└── Git safety flags (Effect-based)

v0.7 (Q1 2027) — Wave 5: GUI & Advanced
├── MCP Registry client
├── Plugin marketplace
├── Plugin agent + MCP + output surfaces
├── Full 20+ language LSP support
└── Enterprise features consolidation
```

## Appendix B: File-Level Change Map

| New/Modified File | Feature | Phase |
|-------------------|---------|-------|
| `src/mcp/health/health-monitor.ts` | MCP health checks | v0.5 |
| `src/mcp/health/failure-store.ts` | MCP failure persistence | v0.5 |
| `src/mcp/client/reconnection-strategy.ts` | MCP auto-reconnect | v0.5 |
| `src/mcp/tool-filter.ts` | Granular tool filtering (glob 패턴 확장) | v0.5 |
| `src/mcp/client/streaming-handler.ts` | MCP streaming | v0.5 |
| `src/mcp/resource/resource-context-provider.ts` | Resource integration | v0.5 |
| `src/mcp/auth/oauth21-handler.ts` | OAuth 2.1 + PKCE | v0.6 |
| `src/mcp/agent-to-agent/agent-mcp-server.ts` | Agent-to-Agent | v0.6 |
| `src/mcp/registry/registry-client.ts` | MCP Registry | v0.7 |
| `src/skills/manifest.ts` | Typed skill manifest | v0.5 |
| `src/skills/composer.ts` | Skill composition | v0.5 |
| `src/skills/marketplace/client.ts` | Marketplace client | v0.6 |
| `src/skills/trust/trust-evaluator.ts` | Trust tiers | v0.6 |
| `src/commands/command-graph.ts` | Unified command graph | v0.5 |
| `src/commands/parameters.ts` | Consistent parsing | v0.5 |
| `src/commands/discovery.ts` | Command discovery | v0.5 |
| `src/commands/analytics.ts` | Usage analytics | v0.6 |
| `src/indexing/incremental/incremental-engine.ts` | Incremental indexing | v0.5 |
| `src/indexing/semantic/semantic-search-engine.ts` | Semantic search | v0.6 |
| `src/lsp/language-registry.ts` | Multi-language config | v0.6 |
| `src/lsp/tools/refactor-tool.ts` | Refactoring support | v0.6 |
| `src/hooks/backends/hook-backend.ts` | Typed hook backends | v0.5 |
| `src/hooks/debug/hook-tracer.ts` | Hook debugging | v0.5 |
| `src/plugins/plugin-manifest.ts` | Plugin manifest | v0.6 |
| `src/plugins/loader/plugin-loader.ts` | Plugin loading | v0.6 |
| `src/plugins/security/plugin-sandbox.ts` | Plugin security | v0.6 |
| `src/plugins/lifecycle/hot-reload.ts` | Hot-reload | v0.6 |
| `src/memory/sqlite-store.ts` | SQLite migration | v0.6 |
| `src/config/schema.ts` | Config validation | v0.5 |
| `src/config/managed/managed-preferences.ts` | Managed prefs | v0.6 |

## Appendix C: Dependency Map

```
Plugin Platform ──depends on──> Hook System (mature)
                ──depends on──> Command Graph (unified)
                ──depends on──> Trust Model (from Skills)

Semantic Search ──depends on──> Incremental Indexing
                ──depends on──> Tree-sitter (existing)
                ──depends on──> Embedding Model (new)

MCP Registry    ──depends on──> OAuth 2.1 (auth for registry)
                ──depends on──> Health Checks (verify installed servers)

Skill Marketplace ──depends on──> Typed Manifests
                  ──depends on──> Trust Tiers
                  ──depends on──> Remote Loading

Memory Forking  ──depends on──> SQLite Migration
                ──depends on──> Memory Quality Metrics
```

이 dependency chain이 implementation timeline의 순서를 결정함.
Phase N의 feature는 Phase N-1의 dependency가 완료된 후에만 시작 가능.
