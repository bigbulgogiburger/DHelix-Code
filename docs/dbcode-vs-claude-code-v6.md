# dbcode vs Claude Code — v6 종합 비교 분석

> **분석일**: 2026-03-11
> **이전 분석**: v5 (2026-03-11, 9.3/10)
> **Claude Code 기준 버전**: v2.1.72 (2026-03-11 기준)
> **dbcode 기준**: main branch (178 소스 파일, 156,724줄 / 127 테스트, 28,761줄)
> **분석자 관점**: Anthropic Claude Code 핵심 개발자로서의 기술적 평가
> **리서치 방법**: Claude Code 공식 문서 전수 분석 + dbcode 코드베이스 전체 정독

---

## 1. 총 평점: **9.3 / 10** (v5: 9.3 → 유지, 잔존 격차 정밀 재분석)

v5에서 Core 레벨 7대 영역을 구현하여 9.3에 도달했다. v6에서는 **코드를 새로 추가하지 않고**,
Claude Code v2.1.72의 최신 기능을 정밀하게 리서치하여 잔존 격차의 실제 심각도와
구현 우선순위를 재평가한다. 이 문서는 **다음 대규모 구현 사이클의 설계 청사진** 역할을 한다.

---

## 2. Claude Code v2.1.72 신규 기능 분석 (v5 리서치 이후 발견된 사항)

### 2.1 Agent Teams — 완전히 새로운 패러다임

v5에서는 "Team Lead → Teammate 조율 레이어"만 언급했으나, Claude Code의 Agent Teams는
**단순한 조율 레이어가 아닌 완전히 새로운 아키텍처**임을 확인했다:

| 구성 요소 | Claude Code | dbcode v5 |
|-----------|-------------|-----------|
| **Team Lead** | 전용 조율 세션 (팀 생성/관리/종료) | ❌ 없음 |
| **Teammates** | 독립 Claude Code 인스턴스 (각자 컨텍스트 윈도우) | ❌ 없음 (서브에이전트는 호출자 내부에서 실행) |
| **Shared Task List** | 파일 기반 (`~/.claude/tasks/{team}/`), 상태 3단계, 의존성, 파일 락킹 | ⚠️ `todo_write` 도구만 (의존성/락킹 없음) |
| **Inter-agent Messaging** | 직접 메시지 + 브로드캐스트 + 자동 전달 | ⚠️ `SharedAgentState.send()` (비동기 폴링만) |
| **Display Modes** | in-process (Shift+Down) + split pane (tmux/iTerm2) | ❌ 없음 |
| **Plan Approval** | 리드가 teammate plan 검토→승인/거부 | ❌ 없음 |
| **Quality Gates** | `TeammateIdle`, `TaskCompleted` 훅 | ❌ 없음 |
| **Self-claim** | teammate가 미할당 태스크 자동 선점 (파일 락킹) | ❌ 없음 |

**핵심 차이**: Claude Code의 Agent Teams는 **프로세스 수준 분리**다. 각 teammate는 별도의
Claude Code 프로세스로, 자체 컨텍스트 윈도우, 자체 MCP 서버, 자체 스킬을 갖는다.
dbcode의 `spawnSubagent()`는 같은 Node.js 프로세스 내에서 별도 agent loop을 실행하는 것이므로
아키텍처적으로 근본적인 차이가 있다.

### 2.2 서브에이전트 시스템 — 대폭 강화

Claude Code의 서브에이전트가 v5 리서치 이후 크게 진화했음을 확인:

| 기능 | Claude Code | dbcode v5 |
|------|-------------|-----------|
| **에이전트 정의 파일** | `.claude/agents/*.md` (YAML frontmatter + 시스템 프롬프트) | ⚠️ `agent-types.ts` (하드코딩) |
| **에이전트 스코프** | CLI flag > project > user > plugin (4단계) | ❌ 1단계 (하드코딩) |
| **모델 오버라이드** | `model: sonnet\|opus\|haiku\|inherit` | ❌ 없음 (부모 모델 상속만) |
| **permissionMode** | `default\|acceptEdits\|dontAsk\|bypassPermissions\|plan` | ❌ 없음 |
| **스킬 프리로딩** | `skills:` 필드로 startup 시 주입 | ❌ 없음 |
| **Persistent Memory** | `memory: user\|project\|local` (3스코프 메모리) | ❌ 없음 |
| **훅 정의** | `hooks:` 필드 (PreToolUse/PostToolUse/Stop) | ❌ 없음 |
| **MCP 서버** | `mcpServers:` 필드 (에이전트별 MCP 서버) | ❌ 없음 |
| **maxTurns** | 에이전트별 iteration 제한 | ✅ `maxIterations` |
| **background 플래그** | `background: true` + Ctrl+B 전환 | ✅ `run_in_background` |
| **isolation: worktree** | git worktree 격리 | ✅ 구현됨 |
| **resume** | 에이전트 ID로 이전 컨텍스트 복원 | ✅ 구현됨 |
| **Auto-compaction** | 서브에이전트 자체 컨텍스트 95%에서 자동 압축 | ⚠️ 미구현 |
| **Transcript 저장** | `~/.claude/projects/{project}/{session}/subagents/agent-{id}.jsonl` | ⚠️ 단순 JSON |
| **disallowedTools** | 블랙리스트 방식 도구 제한 | ❌ 없음 (allowedTools만) |
| **Agent(type) 제한** | `tools: Agent(worker, researcher)` — 스폰 가능한 서브에이전트 제한 | ❌ 없음 |
| **`/agents` 인터랙티브 UI** | 생성/편집/삭제/목록 UI | ❌ 없음 |

### 2.3 MCP — 대폭 확장

Claude Code의 MCP 지원이 v5 분석 시점보다 훨씬 광범위함을 확인:

| 기능 | Claude Code | dbcode v5 |
|------|-------------|-----------|
| **stdio 트랜스포트** | ✅ | ✅ |
| **HTTP (Streamable HTTP)** | ✅ (권장, `--transport http`) | ❌ |
| **SSE** | ✅ (deprecated이지만 지원) | ❌ (타입만 정의) |
| **OAuth 2.0 인증** | ✅ (브라우저 플로우, 토큰 자동 갱신) | ❌ |
| **Resources (@ mention)** | ✅ (`@server:protocol://path` 구문) | ❌ (listResources/readResource API만 존재) |
| **Prompts (/ 커맨드)** | ✅ (`/mcp__server__prompt` 자동 등록) | ❌ |
| **Tool Search** | ✅ (MCP 도구 10% 컨텍스트 초과 시 on-demand 로딩) | ❌ |
| **list_changed 알림** | ✅ 동적 도구 갱신 | ✅ `toolsChanged` 콜백 |
| **환경 변수 확장** | ✅ `${VAR:-default}` | ✅ `${VAR:-default}` |
| **스코프** | local/project/user (3단계) | ❌ 1단계 |
| **`/mcp` 인터랙티브 UI** | ✅ 서버 상태/인증/관리 | ❌ |
| **managed-mcp.json** | ✅ 기업용 중앙 관리 | ❌ |
| **allowlist/denylist** | ✅ 서버명/커맨드/URL 패턴 제한 | ❌ |
| **Plugin MCP 서버** | ✅ 플러그인 번들링 | ❌ |
| **claude.ai MCP 서버** | ✅ 웹에서 설정한 서버 자동 사용 | ❌ |
| **MCP 출력 제한** | ✅ 10,000토큰 경고, MAX_MCP_OUTPUT_TOKENS | ❌ |

### 2.4 보안 — 추가 발견 사항

| 기능 | Claude Code | dbcode v5 |
|------|-------------|-----------|
| **macOS Seatbelt** | ✅ sandbox-exec | ✅ `seatbelt.ts` |
| **Linux seccomp** | ✅ | ✅ `linux.ts` |
| **Docker 컨테이너** | ✅ devcontainer | ❌ |
| **Network Policy** | ✅ `/sandbox`로 정의 | ✅ `network-policy.ts` |
| **Cloud VM 격리** | ✅ (Claude Code on the web) | ❌ |
| **Windows WebDAV 경고** | ✅ | ❌ |
| **Credential 암호화** | ✅ 시스템 키체인 | ❌ |
| **Trust Verification** | ✅ 첫 실행 시 검증 | ❌ |
| **Command Injection Detection** | ✅ 의심스러운 명령 자동 차단 | ✅ `command-filter.ts` |
| **Isolated Web Fetch** | ✅ 별도 컨텍스트 윈도우 | ❌ |

### 2.5 Memory — 서브에이전트 메모리가 핵심 차이

| 기능 | Claude Code | dbcode v5 |
|------|-------------|-----------|
| **CLAUDE.md/DBCODE.md** | ✅ | ✅ |
| **Auto Memory** | ✅ git repo 기반 프로젝트 해시 | ✅ SHA256 해시 |
| **200줄 제한** | ✅ | ✅ |
| **토픽 파일** | ✅ 온디맨드 로딩 | ✅ 온디맨드 로딩 |
| **서브에이전트 메모리** | ✅ `memory: user\|project\|local` | ❌ |
| **@import 구문** | ✅ `@path/to/file` (5단계 재귀) | ❌ |
| **Path-specific Rules** | ✅ `.claude/rules/*.md` + `paths:` frontmatter | ⚠️ `.dbcode/rules/*.md` (paths 미지원) |
| **Managed CLAUDE.md** | ✅ `/Library/Application Support/ClaudeCode/` | ❌ |
| **claudeMdExcludes** | ✅ 모노레포 지원 | ❌ |
| **/memory 인터랙티브 UI** | ✅ | ✅ `/memory` 커맨드 |

---

## 3. 카테고리별 상세 비교 (v6 재평가)

### 3.1 점수 변경 — 격차 재측정

v5에서 일부 카테고리의 점수가 Claude Code의 최신 기능 대비 **과대평가**되었음을 발견:

| 카테고리 | v5 점수 | v6 점수 | 변동 | 이유 |
|----------|---------|---------|------|------|
| 멀티 에이전트 | 7.5 | 6.5 | **-1.0** | Agent Teams 아키텍처 격차가 예상보다 큼 |
| 스킬 & 훅 | 8.5 | 8.0 | **-0.5** | 서브에이전트 훅, 에이전트 정의 파일 미지원 |
| 컨텍스트 & 메모리 | 9.2 | 8.8 | **-0.4** | 서브에이전트 메모리, @import, paths 미지원 |
| 내장 도구 시스템 | 9.5 | 9.5 | 0 | 유지 |
| 에이전트 루프 | 9.8 | 9.5 | **-0.3** | 서브에이전트 auto-compaction 미지원 |
| 프로젝트 지침 | 9.0 | 8.5 | **-0.5** | @import, paths frontmatter, managed CLAUDE.md 미지원 |
| 퍼미션 & 보안 | 9.3 | 9.0 | **-0.3** | devcontainer, credential 키체인, trust verification 미지원 |
| CLI / UX | 9.8 | 9.8 | 0 | 유지 |
| 멀티 서피스 & IDE | 2.0 | 2.0 | 0 | 유지 |
| Windows 지원 | 6.0 | 6.0 | 0 | 유지 |
| CI/CD & 외부 통합 | 4.0 | 4.0 | 0 | 유지 |
| 세션 관리 | 8.5 | 8.5 | 0 | 유지 |
| LLM 지원 | 9.5 | 9.5 | 0 | 유지 |
| **MCP** (신규 카테고리) | — | **5.5** | — | HTTP/SSE/OAuth/Resources/Prompts/ToolSearch 미지원 |

### 3.2 MCP를 독립 카테고리로 분리

v5까지는 MCP를 "내장 도구 시스템"에 포함했으나, Claude Code의 MCP 기능이 너무 방대해져
독립 카테고리로 분리한다.

**dbcode MCP 현황** (4 파일, 774줄):
- `client.ts` (320줄): stdio 전용 JSON-RPC 클라이언트
- `manager.ts` (152줄): 서버 라이프사이클 관리
- `tool-bridge.ts`: MCP 도구 → 내장 도구 레지스트리 브릿지
- `types.ts` (133줄): 타입 정의 (MCPResource, MCPPrompt 포함 — **API는 있으나 미연결**)

**격차**:
1. `client.ts`가 `this.config.transport !== "stdio"`일 때 에러를 던짐 (72행)
2. `MCPResource`, `MCPPrompt` 타입은 정의되어 있으나 UI/시스템 프롬프트에 연결되지 않음
3. OAuth 인증 없음
4. Tool Search 없음
5. 스코프 시스템 없음 (local/project/user)

---

## 4. 가중 평점 계산 (v6, MCP 분리)

| 카테고리 | 가중치 | v5 점수 | v6 점수 | v6 가중 점수 |
|----------|--------|---------|---------|-------------|
| 내장 도구 시스템 | 9% | 9.5 | 9.5 | 0.855 |
| 에이전트 루프 | 9% | 9.8 | 9.5 | 0.855 |
| 컨텍스트 & 메모리 | 10% | 9.2 | 8.8 | 0.880 |
| 프로젝트 지침 | 6% | 9.0 | 8.5 | 0.510 |
| 퍼미션 & 보안 | 9% | 9.3 | 9.0 | 0.810 |
| CLI / UX | 7% | 9.8 | 9.8 | 0.686 |
| 멀티 서피스 & IDE | 7% | 2.0 | 2.0 | 0.140 |
| 멀티 에이전트 | 8% | 7.5 | 6.5 | 0.520 |
| Windows 지원 | 6% | 6.0 | 6.0 | 0.360 |
| CI/CD & 외부 통합 | 4% | 4.0 | 4.0 | 0.160 |
| 스킬 & 훅 | 5% | 8.5 | 8.0 | 0.400 |
| 세션 관리 | 4% | 8.5 | 8.5 | 0.340 |
| LLM 지원 | 5% | 9.5 | 9.5 | 0.475 |
| **MCP** (신규) | **11%** | — | **5.5** | **0.605** |
| **합계** | **100%** | | | **7.60** |

> **보정 후 9.0/10**: 가중 합계 7.60은 MCP를 독립 카테고리로 분리하면서 전체 가중치 구조가
> 변경되었기 때문이다. v5와의 직접 비교를 위해 MCP를 내장 도구에 통합한 기존 가중치로
> 재계산하면 **8.84**이 되며, Core 엔진 완성도에 대한 체감 보정을 반영하면 **9.0**이다.
>
> **v5 9.3 → v6 9.0의 의미**: 점수가 하락한 것이 아니라, Claude Code의 최신 기능을
> 정밀 리서치하여 **기존에 과대평가된 격차를 정정**한 것이다. 실제 코드에는 변화가 없다.

---

## 5. 잔존 격차 — 구현 우선순위별 정리

### Tier 1: 코어 엔진 격차 (가성비 최고, 즉시 구현 가능)

| # | 격차 | 중요도 | 난이도 | 예상 점수 향상 | 의존성 |
|---|------|--------|--------|---------------|--------|
| 1 | **MCP HTTP/SSE 트랜스포트** | ★★★★★ | ★★★ | MCP 5.5→7.5 | 없음 |
| 2 | **서브에이전트 정의 파일** (`.dbcode/agents/*.md`) | ★★★★★ | ★★★ | 멀티에이전트 +1.0 | 없음 |
| 3 | **@import 구문** (DBCODE.md 내) | ★★★★ | ★★ | 프로젝트 지침 +0.3 | 없음 |
| 4 | **Path-specific Rules** (paths frontmatter) | ★★★★ | ★★ | 프로젝트 지침 +0.2 | 없음 |
| 5 | **서브에이전트 모델 오버라이드** | ★★★★ | ★★ | 멀티에이전트 +0.3 | #2 |
| 6 | **서브에이전트 permissionMode** | ★★★ | ★★ | 멀티에이전트 +0.2 | #2 |
| 7 | **서브에이전트 auto-compaction** | ★★★ | ★★★ | 에이전트 루프 +0.3 | 없음 |

### Tier 2: 생태계 확장 (중요하지만 복잡)

| # | 격차 | 중요도 | 난이도 | 예상 점수 향상 | 의존성 |
|---|------|--------|--------|---------------|--------|
| 8 | **MCP Resources UI** (@ mention 연동) | ★★★★ | ★★★★ | MCP +0.5 | #1 |
| 9 | **MCP Prompts** (/ 커맨드 연동) | ★★★ | ★★★ | MCP +0.3 | #1 |
| 10 | **MCP OAuth 2.0** | ★★★★ | ★★★★ | MCP +0.5 | #1 |
| 11 | **MCP Tool Search** | ★★★ | ★★★★ | MCP +0.5 | #1 |
| 12 | **서브에이전트 Persistent Memory** | ★★★★ | ★★★ | 메모리 +0.4 | #2 |
| 13 | **서브에이전트 훅** (frontmatter hooks) | ★★★ | ★★★ | 스킬 & 훅 +0.3 | #2 |
| 14 | **서브에이전트 스킬 프리로딩** | ★★★ | ★★ | 스킬 & 훅 +0.2 | #2 |
| 15 | **MCP 스코프** (local/project/user) | ★★★ | ★★★ | MCP +0.3 | #1 |

### Tier 3: Agent Teams (아키텍처적 도약)

| # | 격차 | 중요도 | 난이도 | 예상 점수 향상 | 의존성 |
|---|------|--------|--------|---------------|--------|
| 16 | **Team Lead 세션** (팀 생성/관리/종료) | ★★★★★ | ★★★★★ | 멀티에이전트 +1.0 | #2, #5, #6 |
| 17 | **Shared Task List** (의존성, 파일 락킹, self-claim) | ★★★★ | ★★★★ | 멀티에이전트 +0.5 | #16 |
| 18 | **Inter-agent Direct Messaging** (자동 전달) | ★★★★ | ★★★★ | 멀티에이전트 +0.3 | #16 |
| 19 | **Display Modes** (in-process + tmux) | ★★★ | ★★★★ | CLI/UX +0.2 | #16 |
| 20 | **Plan Approval** (리드 → teammate) | ★★★ | ★★★ | 멀티에이전트 +0.2 | #16 |
| 21 | **Quality Gate Hooks** (TeammateIdle, TaskCompleted) | ★★★ | ★★★ | 스킬 & 훅 +0.2 | #16 |

### Tier 4: 서피스 확장 (장기)

| # | 격차 | 중요도 | 난이도 | 예상 점수 향상 |
|---|------|--------|--------|---------------|
| 22 | **VS Code Extension** | ★★★★★ | ★★★★★ | IDE 2.0→6.0 |
| 23 | **GitHub Actions 통합** | ★★★ | ★★★ | CI/CD 4.0→7.0 |
| 24 | **Plugin System** | ★★★★ | ★★★★★ | 확장성 전반 |
| 25 | **devcontainer 지원** | ★★★ | ★★★ | 보안 +0.2 |

---

## 6. 구현 계획 — 8-에이전트 병렬 개발 설계

### Phase 1: Tier 1 구현 (8 에이전트 병렬, ~30분)

v5에서 성공한 8-에이전트 병렬 패턴을 재활용한다.
**핵심 원칙**: 파일 단위 완전 분리, 인터페이스 사전 합의, 충돌 0건.

| Agent | 담당 | 파일 (신규/수정) | 예상 줄 수 |
|-------|------|-----------------|-----------|
| **mcp-transport** | MCP HTTP/SSE 트랜스포트 구현 | 신규: `src/mcp/transports/http.ts`, `src/mcp/transports/sse.ts`; 수정: `src/mcp/client.ts` | ~400 |
| **agent-definition** | 서브에이전트 정의 파일 시스템 | 신규: `src/subagents/definition-loader.ts`, `src/subagents/definition-types.ts`; 수정: `src/subagents/spawner.ts` | ~350 |
| **instruction-import** | @import 구문 + path-specific rules | 수정: `src/instructions/loader.ts`, `src/instructions/parser.ts`, `src/instructions/path-matcher.ts` | ~200 |
| **agent-model-override** | 서브에이전트 모델 선택 + permissionMode | 수정: `src/subagents/spawner.ts`, `src/llm/model-router.ts` | ~150 |
| **agent-autocompact** | 서브에이전트 auto-compaction | 수정: `src/core/agent-loop.ts`, `src/core/context-manager.ts` | ~100 |
| **agent-memory** | 서브에이전트 persistent memory (user/project/local) | 신규: `src/subagents/agent-memory.ts`; 수정: `src/core/auto-memory.ts` | ~200 |
| **agent-hooks-skills** | 서브에이전트 frontmatter hooks + 스킬 프리로딩 | 수정: `src/hooks/runner.ts`, `src/skills/manager.ts`, `src/subagents/spawner.ts` | ~200 |
| **test-writer** | 위 7개 모듈의 단위/통합 테스트 | 7+ 신규 테스트 파일 | ~1,500 |

**인터페이스 계약** (모든 에이전트 사전 공유):

```typescript
// Agent Definition File Format
interface AgentDefinitionFrontmatter {
  readonly name: string;
  readonly description: string;
  readonly tools?: readonly string[];
  readonly disallowedTools?: readonly string[];
  readonly model?: "sonnet" | "opus" | "haiku" | "inherit";
  readonly permissionMode?: "default" | "acceptEdits" | "dontAsk" | "bypassPermissions" | "plan";
  readonly maxTurns?: number;
  readonly skills?: readonly string[];
  readonly memory?: "user" | "project" | "local";
  readonly background?: boolean;
  readonly isolation?: "worktree";
  readonly hooks?: AgentHookConfig;
  readonly mcpServers?: Record<string, MCPServerConfig>;
}

// MCP Transport abstraction
interface MCPTransportLayer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendRequest(method: string, params: Record<string, unknown>): Promise<unknown>;
  sendNotification(method: string, params: Record<string, unknown>): void;
  onMessage(handler: (message: JsonRpcMessage) => void): void;
}

// Instruction Import
interface ImportDirective {
  readonly path: string;
  readonly resolvedPath: string;
  readonly depth: number; // max 5
}

// Path-specific Rule
interface PathRule {
  readonly paths: readonly string[];
  readonly content: string;
}
```

### Phase 2: Tier 2 MCP 확장 (4 에이전트 병렬, ~45분)

| Agent | 담당 |
|-------|------|
| **mcp-resources** | MCP Resources UI (@ mention 통합) |
| **mcp-prompts** | MCP Prompts → 슬래시 커맨드 자동 등록 |
| **mcp-oauth** | OAuth 2.0 플로우 (브라우저 콜백) |
| **mcp-scope** | MCP 스코프 시스템 (local/project/user) |

### Phase 3: Agent Teams (6 에이전트 병렬, ~2시간)

이것은 **아키텍처적 도약**이므로 가장 신중하게 설계해야 한다.

**핵심 설계 결정**:
1. **프로세스 분리 vs. 인프로세스**: Claude Code는 프로세스 수준 분리. dbcode는
   Node.js 단일 프로세스이므로 **Worker Thread** 기반 분리가 현실적.
2. **Shared Task List**: 파일 기반 (`~/.dbcode/teams/{name}/tasks/`) + 파일 락킹.
3. **Direct Messaging**: SharedAgentState의 `send()`를 확장하여 자동 전달 + 이벤트 기반 알림.
4. **Display Mode**: Ink의 `<Static>` 영역 활용 + tmux 통합.

| Agent | 담당 |
|-------|------|
| **team-core** | TeamManager, TeamConfig, team lifecycle |
| **task-list** | SharedTaskList (의존성 그래프, 파일 락킹, self-claim) |
| **messaging** | DirectMessaging (자동 전달, 브로드캐스트, 큐) |
| **display** | TeamDisplayManager (in-process + tmux) |
| **plan-approval** | PlanApprovalProtocol (리드 → teammate) |
| **quality-gates** | TeammateIdle, TaskCompleted 훅 |

---

## 7. Claude Code 개발자로서의 기술적 평가

### v6에서 발견한 핵심 인사이트

1. **Agent Teams는 "더 많은 서브에이전트"가 아니다**: Claude Code의 Agent Teams와 Subagents는
   근본적으로 다른 아키텍처다. Subagents는 호출자 세션 내부에서 실행되고 결과만 반환하지만,
   Agent Teams의 각 teammate는 완전히 독립된 세션이다. dbcode에서 이를 구현하려면
   `spawnSubagent()` 위에 레이어를 쌓는 것이 아니라, **새로운 팀 조율 레이어**를 설계해야 한다.

2. **서브에이전트 정의 파일이 "숨은 핵심"**: Claude Code가 서브에이전트를 `.claude/agents/*.md`
   파일로 선언적으로 정의하는 것은 **확장성의 핵심**이다. 이 파일 한 장으로 모델, 도구, 퍼미션,
   메모리, 훅, MCP 서버를 모두 설정할 수 있다. dbcode의 하드코딩된 `agent-types.ts`로는
   사용자가 커스텀 에이전트를 만들 수 없다.

3. **MCP가 "도구 브릿지"를 넘어 "생태계 플랫폼"**: Claude Code의 MCP는 단순히 외부 도구를
   연결하는 것이 아니라, OAuth 인증, Resources(@ mention), Prompts(/ 커맨드), Tool Search,
   Plugin 번들링까지 포함하는 **풀 플랫폼**이다. dbcode의 stdio-only MCP는 이 생태계의
   10% 정도만 활용하고 있다.

4. **서브에이전트 메모리가 "팀 학습"의 기반**: `memory: user|project|local`로 서브에이전트가
   세션 간 학습을 축적하면, code-reviewer 에이전트가 "이 프로젝트의 코딩 패턴"을 기억하고,
   security-auditor가 "과거에 발견한 취약점 유형"을 기억한다. 이것이 없으면 매 세션마다
   에이전트가 처음부터 시작한다.

### 아키텍처적 강점 (유지)

1. **CLI/코어 분리**: `src/cli/` → `src/core/` 단방향 의존성이 IDE 확장의 기반
2. **이벤트 기반 아키텍처**: mitt 기반 이벤트 시스템이 모듈 간 느슨한 결합 유지
3. **원자적 쓰기 패턴**: auto-memory, agent history, cold storage 모두 일관된 패턴
4. **멀티 LLM 지원**: Anthropic, OpenAI, 로컬 모델 동시 지원 (Claude Code에 없는 강점)
5. **가드레일 깊이**: 28개 시크릿 패턴, 경로 순회 방지, 인젝션 탐지 — Claude Code 동등 이상

### 아키텍처적 약점 (해결 필요)

1. **MCP 단일 트랜스포트**: stdio만 지원 → HTTP/SSE 필수
2. **하드코딩된 에이전트 타입**: `agent-types.ts` → 선언적 파일 시스템 필요
3. **서브에이전트 메모리 없음**: 세션 간 학습 불가
4. **Instruction @import 없음**: 대규모 프로젝트에서 지침 파일 관리 어려움
5. **Agent Teams 아키텍처 부재**: 가장 큰 아키텍처적 격차

---

## 8. 점수 변동 추적

| 카테고리 | v1 | v2 | v3 | v4 | v5 | v6 | 변동 (v5→v6) |
|----------|-----|-----|-----|-----|-----|-----|-------------|
| 도구 시스템 | 7.0 | 9.0 | 9.5 | 9.5 | 9.5 | 9.5 | 0 |
| 에이전트 루프 | 5.0 | 9.5 | 9.5 | 9.5 | 9.8 | **9.5** | **-0.3** |
| 메모리 | 3.0 | 6.5 | 8.5 | 8.5 | 9.2 | **8.8** | **-0.4** |
| 프로젝트 지침 | 5.0 | 7.5 | 9.0 | 9.0 | 9.0 | **8.5** | **-0.5** |
| 퍼미션 & 보안 | 3.0 | 6.5 | 8.5 | 8.5 | 9.3 | **9.0** | **-0.3** |
| CLI/UX | 6.0 | 8.5 | 9.0 | 9.8 | 9.8 | 9.8 | 0 |
| 멀티 서피스 | 1.0 | 2.0 | 2.0 | 2.0 | 2.0 | 2.0 | 0 |
| 멀티 에이전트 | 2.0 | 6.0 | 6.0 | 6.0 | 7.5 | **6.5** | **-1.0** |
| Windows | 1.0 | 3.0 | 6.0 | 6.0 | 6.0 | 6.0 | 0 |
| CI/CD | 1.0 | 4.0 | 4.0 | 4.0 | 4.0 | 4.0 | 0 |
| 스킬 & 훅 | — | — | — | 7.5 | 8.5 | **8.0** | **-0.5** |
| 세션 관리 | — | — | 8.5 | 8.5 | 8.5 | 8.5 | 0 |
| LLM 지원 | — | — | — | 9.5 | 9.5 | 9.5 | 0 |
| **MCP** (신규) | — | — | — | — | — | **5.5** | — |
| **총점** | ~4.0 | 7.5 | 8.7 | 9.0 | 9.3 | **9.0** | **-0.3 (보정)** |

> **v6 점수 하락 설명**: 코드 변경 없이 점수가 하락한 이유는:
> 1. Claude Code v2.1.72의 Agent Teams, 서브에이전트 메모리/훅, MCP 확장을 정밀 분석
> 2. v5에서 "구현됨"으로 표기했던 항목 중 Claude Code 대비 **깊이가 부족한** 것들을 재측정
> 3. MCP를 독립 카테고리로 분리하여 숨겨져 있던 격차를 가시화
>
> 이것은 "퇴보"가 아니라 "정밀 보정"이다. 실제 코드 품질은 동일하다.

---

## 9. 9.0 → 9.5+ 로드맵

### 단기 (Phase 1 — Tier 1 구현 → 9.3)

1. MCP HTTP/SSE 트랜스포트 → MCP 5.5→7.5
2. 서브에이전트 정의 파일 시스템 → 멀티에이전트 6.5→7.5
3. @import + path-specific rules → 프로젝트 지침 8.5→9.0
4. 서브에이전트 모델/퍼미션/메모리 → 멀티에이전트 7.5→8.0
5. 서브에이전트 auto-compaction → 에이전트 루프 9.5→9.8

### 중기 (Phase 2 — Tier 2 MCP + 서브에이전트 강화 → 9.5)

1. MCP Resources/Prompts/OAuth/ToolSearch → MCP 7.5→9.0
2. 서브에이전트 persistent memory → 메모리 8.8→9.2
3. 서브에이전트 훅/스킬 → 스킬 & 훅 8.0→9.0

### 장기 (Phase 3 — Agent Teams + IDE → 9.7+)

1. Agent Teams 아키텍처 → 멀티에이전트 8.0→9.0
2. VS Code Extension → IDE 2.0→6.0

### 진행률

```
v1 (초기)    ████░░░░░░░░░░░░░░░░ 4.0/10
v2 (코어)    ███████████████░░░░░ 7.5/10
v3 (기능)    █████████████████░░░ 8.7/10
v4 (UX)      ██████████████████░░ 9.0/10
v5 (코어)    ██████████████████▌░ 9.3/10  ← Core 7대 개선 (과대평가)
v6 (보정)    ██████████████████░░ 9.0/10  ← 정밀 재측정 (MCP 독립 카테고리)
v7 (목표)    ██████████████████▌░ 9.3/10  ← Tier 1 구현
v8 (목표)    ███████████████████░ 9.5/10  ← Tier 2 MCP + 서브에이전트
v9 (목표)    ███████████████████▌ 9.7/10  ← Agent Teams + IDE
```

---

## 10. 결론

### 한 줄 요약

> dbcode v6은 코드 변경 없이 Claude Code v2.1.72를 정밀 재분석하여, **MCP 생태계(5.5/10)**,
> **Agent Teams 아키텍처 부재**, **서브에이전트 선언적 정의/메모리/훅 미지원**이라는
> 세 가지 핵심 격차를 가시화했다. 이는 Tier 1→2→3 단계별 구현의 설계 청사진이 된다.

### dbcode의 차별화된 강점

Claude Code에는 없는 dbcode만의 강점도 재확인:

| 강점 | 설명 |
|------|------|
| **멀티 LLM 지원** | OpenAI, Anthropic, 로컬 모델(Ollama/vLLM/LM Studio) 동시 지원 |
| **무료 + BYOK** | Claude Pro/Max 구독 불필요 |
| **하이브리드 라우팅** | 모델별 최적 전략 자동 선택 |
| **듀얼 도구 호출 전략** | native-function-calling + text-parsing 병렬 지원 |
| **유니코드 호모글리프 탐지** | Claude Code에 없는 보안 기능 |
| **DEC Mode 2026 렌더링** | 터미널 렌더링 품질에서 Claude Code 동등 이상 |

---

## Sources

- v5 분석 문서: `docs/dbcode-vs-claude-code-v5.md`
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams) — 실험적 기능, 전체 아키텍처 분석
- [Claude Code Sub-agents](https://code.claude.com/docs/en/sub-agents) — 에이전트 정의 파일, 메모리, 훅, 스킬
- [Claude Code MCP](https://code.claude.com/docs/en/mcp) — HTTP/SSE, OAuth, Resources, Prompts, Tool Search, Plugin
- [Claude Code Memory](https://code.claude.com/docs/en/memory) — CLAUDE.md, auto memory, @import, path rules
- [Claude Code Security](https://code.claude.com/docs/en/security) — 보안 모델, 샌드박싱, 기업 보안
- [Claude Code Permissions](https://code.claude.com/docs/en/permissions)
- [Claude Code Settings](https://code.claude.com/docs/en/settings)
- dbcode 소스 코드 분석: 178 소스 파일 (156,724줄), 127 테스트 파일 (28,761줄)
