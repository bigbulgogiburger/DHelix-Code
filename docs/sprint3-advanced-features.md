# Sprint 3: 고급 기능 + 코어 보강 (Advanced Features + Core Hardening)

> **Version**: 2.0 (에이전트 심층 분석 반영)
> **Date**: 2026-03-14
> **Base**: Sprint 2 완료 — 3410 tests / 0 TS errors
> **Scope**: I5 Plan Mode + C4 MCP Streamable HTTP + I1 Worktree Isolation + Core Hardening
> **참고**: Claude Code 공식 구현, MCP spec 2025-06-18, Anthropic claude-code GitHub Issues 분석 기반

---

## 목차

1. [Sprint 3 범위 선정](#sprint-3-범위-선정)
2. [현재 인프라 현황 + 웹 리서치 결과](#현재-인프라-현황)
3. [I5. Plan Mode Auto-Execution](#i5-plan-mode-auto-execution)
4. [C4. MCP Streamable HTTP Transport](#c4-mcp-streamable-http-transport)
5. [I1. Worktree Isolation for Sub-agents](#i1-worktree-isolation)
6. [Core Hardening: 코어 보강](#core-hardening)
7. [구현 순서 및 일정](#구현-순서-및-일정)
8. [검증 기준](#검증-기준)

---

## Sprint 3 범위 선정

### 주요 기능 (로드맵 항목)

| #      | 기능                          | 실제 구현률                                                        | 복잡도 | 비고                                     |
| ------ | ----------------------------- | ------------------------------------------------------------------ | ------ | ---------------------------------------- |
| **I5** | Plan Mode Auto-Execution      | **45%** (권한 시스템에 plan 모드 존재, agent-loop 미연결)          | 중     | Claude Code 방식: 프롬프트 + 도구 필터링 |
| **C4** | MCP Streamable HTTP Transport | **95%** (SSE + HTTP transport 완성, 테스트/세션 관리 부족)         | 낮     | MCP spec 2025-06-18 기반                 |
| **I1** | Worktree Isolation            | **85%** (createWorktree 완성, agent tool 연결 + Windows 경로 미흡) | 중     | `.dhelix/worktrees/<name>` 패턴          |

### 코어 보강 (신규 발견)

프로젝트 분석에서 발견된 **핵심 취약점 5개**를 함께 수정합니다:

| #      | 취약점                               | 심각도 | 영향                              |
| ------ | ------------------------------------ | ------ | --------------------------------- |
| **H1** | Sub-agent에서 MCP 도구 필터링 미적용 | 높음   | MCP 도구가 권한 제한을 우회       |
| **H2** | Tool 실행 재시도 로직 없음           | 높음   | 네트워크 일시 장애 시 즉시 실패   |
| **H3** | Sub-agent 시간제한 없음 (wall-clock) | 중     | 무한 실행 에이전트가 부모 차단    |
| **H4** | 세션 승인 비영속                     | 중     | 매 세션마다 동일 도구 재승인 필요 |
| **H5** | Worktree 고아 정리 미흡              | 중     | 실패한 worktree가 누적            |

---

## 현재 인프라 현황

### I5 — Plan Mode (웹 리서치 + 코드 분석)

**Claude Code의 실제 구현 방식** (출처: [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts), [lucumr.pocoo.org](https://lucumr.pocoo.org/2025/12/17/what-is-plan-mode/)):

> Plan mode는 **시스템 프롬프트 강화 + 도구 필터링**으로 구현됨. 아키텍처 변경이 아닌 **프롬프트 레벨 제어**.

- 시스템 프롬프트에 "Plan mode is active. You MUST NOT make any edits, run any non-readonly tools..." 주입
- `safe` 권한 도구만 사용 가능 (`file_read`, `glob_search`, `grep_search`, `list_dir`)
- `confirm`/`dangerous` 도구는 모두 차단
- ExitPlanMode 도구가 자동 제공 → 사용자가 계획 승인 시 호출

**dhelix 현재 상태:**

- `/plan on|off` 커맨드 존재 (`src/commands/plan.ts`, 47줄) — 토글만
- 권한 시스템에 `plan` 모드 존재 (`src/permissions/modes.ts`) — `safe` 도구만 허용
- 시스템 프롬프트에 `buildPlanModeSection()` 존재 (`src/core/system-prompt-builder.ts`)
- **Gap**: plan 토글이 권한 모드에 연결되지 않음. `/plan on` → `permissionMode = "plan"` 전환이 없음

### C4 — MCP Streamable HTTP (웹 리서치 + 코드 분석)

**MCP Spec 2025-06-18** (출처: [modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)):

> Streamable HTTP는 단일 엔드포인트(POST/GET)에서 JSON-RPC + 선택적 SSE 스트리밍을 제공.

- 클라이언트: HTTP POST로 JSON-RPC 메시지 전송
- 서버 응답: `application/json` (단일) 또는 `text/event-stream` (SSE 스트리밍)
- 세션 관리: `Mcp-Session-Id` 헤더
- 인증: OAuth 2.1 + Bearer 토큰 (출처: [modelcontextprotocol.io/authorization](https://modelcontextprotocol.io/docs/tutorials/security/authorization))

**dhelix 현재 상태:**

- `src/mcp/transports/http.ts` (260줄) — HTTP + SSE 기반 transport **이미 구현됨**
- `src/mcp/transports/stdio.ts` — stdio transport
- `src/mcp/transports/sse.ts` — SSE transport
- `src/mcp/oauth.ts` (366줄) — OAuth 매니저 **이미 구현됨**
- **Gap**: transport 자동 감지 없음. 설정에서 transport 타입을 명시해야 함

### I1 — Worktree Isolation (웹 리서치 + 코드 분석)

**Claude Code 구현** (출처: [Claude Code Worktree Guide](https://claudefa.st/blog/guide/development/worktree-guide), [anthropics/claude-code#27023](https://github.com/anthropics/claude-code/issues/27023)):

> `isolation: "worktree"` 옵션으로 sub-agent가 독립 worktree에서 작업. 변경 없으면 자동 정리, 변경 있으면 브랜치 유지.

- Worktree 경로: `<repo>/.claude/worktrees/<n>`
- 브랜치명: `worktree-<n>` (자동 생성)
- 정리: 변경 없으면 자동 삭제, 변경 있으면 브랜치 + 경로 반환

**dhelix 현재 상태:**

- `src/subagents/spawner.ts` (635줄) — `createWorktree()`, `worktreeCleanup()` **이미 구현됨**
- `spawnParallelSubagents()` 존재
- **Gap**: agent tool에서 `isolation: "worktree"` 옵션이 연결되지 않음
- **Gap**: worktree cleanup 실패 시 고아 worktree 누적
- **Gap**: worktree에서 작업 결과를 부모에게 전달하는 merge 흐름 없음

---

## I5. Plan Mode Auto-Execution

### Claude Code 방식 채택 (프롬프트 레벨 제어)

복잡한 아키텍처 변경 대신, Claude Code와 동일한 **프롬프트 + 권한 모드 전환** 방식 사용.

### 구현 계획

#### A. /plan 커맨드 → 권한 모드 연동

**파일: `src/commands/plan.ts`**

현재 `/plan on|off`가 단순 플래그만 토글. 변경:

- `/plan on` → `permissionMode = "plan"` 전환 + 시스템 프롬프트에 plan mode 섹션 주입
- `/plan off` → 이전 권한 모드로 복원

```typescript
// CommandResult에 newPermissionMode 반환
return {
  output: "Plan mode enabled. Only read-only tools available.",
  success: true,
  newPermissionMode: "plan", // 권한 모드 직접 전환
  refreshInstructions: true, // 시스템 프롬프트 재빌드
};
```

#### B. Plan Mode 시스템 프롬프트 강화

**파일: `src/core/system-prompt-builder.ts`**

기존 `buildPlanModeSection()` 강화:

```
Plan mode is active.
You MUST NOT make any edits, run any non-readonly tools, or make changes to the system.
You CAN: read files, search code, list directories, ask questions.
You CANNOT: write files, edit files, run shell commands, execute tests.

Create a structured plan with:
1. Goal analysis
2. Step-by-step implementation plan
3. Files to modify and why
4. Risks and dependencies
5. Estimated complexity per step

When the user approves the plan, they will exit plan mode and you can execute.
```

#### C. useAgentLoop에서 plan mode exit 처리

`/plan off` 시 이전 모드로 복원 + 계획 실행 가능 알림.

### 영향 범위

| 파일                                | 변경                         | 규모       |
| ----------------------------------- | ---------------------------- | ---------- |
| `src/commands/plan.ts`              | 권한 모드 연동               | ~30줄 변경 |
| `src/commands/registry.ts`          | `newPermissionMode` 필드     | +2줄       |
| `src/core/system-prompt-builder.ts` | plan mode 프롬프트 강화      | ~20줄 변경 |
| `src/cli/hooks/useAgentLoop.ts`     | newPermissionMode 처리       | +10줄      |
| `src/cli/App.tsx`                   | permissionMode 상태 업데이트 | +5줄       |
| 테스트                              | 신규                         | ~60줄      |

---

## C4. MCP Streamable HTTP Transport

### 현재 상태: 60% 완료

`src/mcp/transports/http.ts`에 HTTP + SSE transport가 이미 있으나, **MCP config에서 transport 자동 감지가 없음**.

### 구현 계획

#### A. Transport 자동 감지

**파일: `src/mcp/client.ts` (또는 관련 팩토리)**

```typescript
/** Auto-detect transport type from server config */
async function detectTransport(config: MCPServerConfig): Promise<"stdio" | "http"> {
  if (config.command) return "stdio"; // 로컬 프로세스
  if (config.url) return "http"; // HTTP endpoint
  if (config.transport) return config.transport; // 명시적 지정
  return "stdio"; // fallback
}
```

#### B. MCP Config에 HTTP 서버 지원 추가

**파일: `src/mcp/managed-config.ts` (또는 config 관련)**

```typescript
interface MCPServerConfig {
  // 기존 stdio 필드:
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  // 신규 HTTP 필드:
  url?: string;
  headers?: Record<string, string>;
  transport?: "stdio" | "http";
}
```

#### C. Mcp-Session-Id 헤더 지원

**파일: `src/mcp/transports/http.ts`**

기존 구현에 세션 ID 관리 추가:

```typescript
// 초기화 응답에서 Mcp-Session-Id 추출
const sessionId = response.headers.get("Mcp-Session-Id");
// 이후 요청에 포함
headers["Mcp-Session-Id"] = sessionId;
```

#### D. OAuth 연결 (기존 코드 활성화)

`src/mcp/oauth.ts`가 이미 구현되어 있지만 미연결. HTTP transport에서 Bearer 토큰 자동 첨부:

```typescript
if (config.oauth) {
  const token = await oauthManager.getAccessToken(config.oauth);
  headers["Authorization"] = `Bearer ${token}`;
}
```

### 영향 범위

| 파일                         | 변경                 | 규모  |
| ---------------------------- | -------------------- | ----- |
| `src/mcp/client.ts`          | transport 자동 감지  | ~20줄 |
| `src/mcp/managed-config.ts`  | HTTP config 필드     | ~10줄 |
| `src/mcp/transports/http.ts` | 세션 ID + OAuth 연결 | ~30줄 |
| 테스트                       | 신규                 | ~80줄 |

---

## I1. Worktree Isolation

### 현재 상태: 70% 완료

`spawner.ts`에 `createWorktree()`가 있으나, agent tool 파라미터에서 연결이 안 됨.

### 구현 계획

#### A. Agent Tool에 isolation 파라미터 연결

**파일: `src/tools/definitions/agent.ts`**

파라미터 스키마에 `isolation` 추가:

```typescript
isolation: z.enum(["none", "worktree"]).default("none").optional(),
```

execute에서 `isolation === "worktree"` 시 `spawnSubagent()`에 worktree 옵션 전달.

#### B. Worktree Cleanup 강화

**파일: `src/subagents/spawner.ts`**

```typescript
/** Detect and clean orphaned worktrees on startup */
export async function cleanOrphanedWorktrees(repoRoot: string): Promise<number> {
  const worktreeDir = join(repoRoot, ".dhelix", "worktrees");
  if (!existsSync(worktreeDir)) return 0;

  const entries = await readdir(worktreeDir);
  let cleaned = 0;
  for (const entry of entries) {
    const worktreePath = join(worktreeDir, entry);
    try {
      execSync(`git worktree remove "${worktreePath}" --force`, {
        cwd: repoRoot,
        timeout: 5000,
        stdio: "pipe",
      });
      cleaned++;
    } catch {
      // 사용 중이면 스킵
    }
  }
  return cleaned;
}
```

#### C. Worktree 결과 머지 유틸리티

```typescript
/** Show diff between worktree branch and main, offer merge */
export function getWorktreeDiff(worktreePath: string, baseBranch: string): string {
  return execSync(`git diff ${baseBranch}...HEAD --stat`, {
    cwd: worktreePath,
    encoding: "utf-8",
  });
}
```

#### D. index.ts에서 startup 정리

```typescript
// App 시작 시 고아 worktree 정리
void cleanOrphanedWorktrees(process.cwd()).catch(() => {});
```

### 영향 범위

| 파일                             | 변경                      | 규모  |
| -------------------------------- | ------------------------- | ----- |
| `src/tools/definitions/agent.ts` | isolation 파라미터        | ~20줄 |
| `src/subagents/spawner.ts`       | cleanup 강화 + merge 유틸 | ~50줄 |
| `src/index.ts`                   | startup cleanup           | +2줄  |
| 테스트                           | 신규                      | ~60줄 |

---

## Core Hardening

### H1. Sub-agent MCP 도구 필터링

**문제**: sub-agent가 MCP 도구(`mcp__*`)를 무제한 사용 가능. `disallowedTools` 체크를 우회.

**수정: `src/subagents/spawner.ts`**

sub-agent의 ToolRegistry에서 `mcp__` prefix 도구에도 권한 체크 적용:

```typescript
// Sub-agent 생성 시 부모의 permission level 상속
if (parentPermissionMode === "plan") {
  // MCP 도구도 safe만 허용
  subToolRegistry.filterByPermission("safe");
}
```

### H2. Tool 실행 재시도 로직

**문제**: LLM 호출은 3회 재시도하지만, 도구 실행은 1회 시도 후 즉시 실패.

**수정: `src/tools/executor.ts`**

```typescript
const MAX_TOOL_RETRIES = 1; // 1회 재시도 (transient 에러만)

async function executeWithRetry(tool, params, context): Promise<ToolResult> {
  for (let attempt = 0; attempt <= MAX_TOOL_RETRIES; attempt++) {
    try {
      return await tool.execute(params, context);
    } catch (error) {
      if (attempt >= MAX_TOOL_RETRIES || !isTransientError(error)) throw error;
      await sleep(1000 * (attempt + 1));
    }
  }
}

function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /ECONNRESET|ETIMEDOUT|ENOTFOUND|EPIPE|EAI_AGAIN/.test(msg);
}
```

### H3. Sub-agent Wall-clock Timeout

**문제**: sub-agent에 `maxIterations`만 있고 시간 제한이 없음.

**수정: `src/subagents/spawner.ts`**

```typescript
// Sub-agent 실행 시 AbortController로 시간 제한
const timeout = options.timeout ?? 300_000; // 5분 기본
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeout);

try {
  return await runSubagent({ ...config, signal: controller.signal });
} finally {
  clearTimeout(timer);
}
```

### H4. 세션 승인 영속화

**문제**: 세션 내 "always allow" 승인이 재시작 시 사라짐.

**수정: `src/permissions/session-store.ts`**

```typescript
// 세션 종료 시 승인 내역을 ~/.dhelix/session-approvals.json에 저장
// 다음 세션 시작 시 로드하여 복원
export async function saveSessionApprovals(approvals: Map<string, boolean>): Promise<void> {
  const path = join(homedir(), ".dhelix", "session-approvals.json");
  await writeFile(path, JSON.stringify([...approvals]), "utf-8");
}
```

### H5. Worktree 고아 정리

I1의 `cleanOrphanedWorktrees()`로 해결 (위 참조).

### Core Hardening 영향 범위

| 파일                               | 변경               | 규모   |
| ---------------------------------- | ------------------ | ------ |
| `src/subagents/spawner.ts`         | MCP 필터 + timeout | ~30줄  |
| `src/tools/executor.ts`            | 재시도 로직        | ~25줄  |
| `src/permissions/session-store.ts` | 승인 영속화        | ~40줄  |
| 테스트                             | 신규               | ~100줄 |

---

## 구현 순서 및 일정

### 에이전트 배정 (4명)

```
Agent 1: "plan-mode"         → I5 (plan.ts, registry.ts, system-prompt-builder.ts, useAgentLoop.ts)
Agent 2: "mcp-http"          → C4 (mcp/client.ts, managed-config.ts, transports/http.ts)
Agent 3: "worktree"          → I1 + H5 (agent.ts, spawner.ts, index.ts)
Agent 4: "core-hardening"    → H1-H4 (executor.ts, spawner.ts, session-store.ts)
```

### 파일 충돌 분석

```
Agent 1: system-prompt-builder.ts, commands/plan.ts, commands/registry.ts  ← 독점
Agent 2: mcp/client.ts, mcp/managed-config.ts, mcp/transports/http.ts    ← 독점
Agent 3: tools/definitions/agent.ts, subagents/spawner.ts                 ← Agent 4와 공유 ⚠️
Agent 4: tools/executor.ts, permissions/session-store.ts, spawner.ts       ← Agent 3와 공유 ⚠️
```

**충돌 해결**: Agent 3/4의 spawner.ts 수정 위치가 다름:

- Agent 3: `createWorktree()`, `cleanOrphanedWorktrees()` (worktree 관련)
- Agent 4: MCP 필터링, timeout (sub-agent 실행 관련)
  → **순차 적용 가능** (Agent 3 먼저, Agent 4 이후)

### 일정

```
Day 1    │  Agent 1 (I5) + Agent 2 (C4) 병렬
Day 2    │  Agent 3 (I1+H5) 실행
Day 3    │  Agent 4 (H1-H4) 실행 (Agent 3 완료 후)
Day 4    │  통합 검증 + 충돌 해결
Day 5    │  벤치마크 + 커밋
```

**총 예상: 5-6일**

---

## 검증 기준

### 기능 검증

**I5 Plan Mode:**

- [ ] `/plan on` → 권한 모드가 "plan"으로 전환됨
- [ ] Plan mode에서 `file_write`, `bash_exec` 차단 확인
- [ ] Plan mode에서 `file_read`, `grep_search` 정상 동작
- [ ] `/plan off` → 이전 권한 모드로 복원
- [ ] 시스템 프롬프트에 plan mode 섹션 포함 확인

**C4 MCP Streamable HTTP:**

- [ ] HTTP URL로 MCP 서버 연결 가능
- [ ] `Mcp-Session-Id` 헤더 자동 관리
- [ ] SSE 스트리밍 응답 정상 처리
- [ ] transport 자동 감지 (command → stdio, url → http)

**I1 Worktree Isolation:**

- [ ] agent tool에서 `isolation: "worktree"` 설정 시 worktree 생성
- [ ] 변경 없는 worktree 자동 정리
- [ ] 변경 있는 worktree 브랜치 보존 + 경로 반환
- [ ] startup 시 고아 worktree 자동 정리

**Core Hardening:**

- [ ] Sub-agent에서 plan mode 시 MCP 도구 차단
- [ ] bash_exec 네트워크 에러 시 1회 재시도
- [ ] Sub-agent 5분 timeout 후 자동 중단
- [ ] 세션 승인이 재시작 후에도 유지

### 회귀 방지

- [ ] 기존 3410개 테스트 전부 통과
- [ ] TypeScript 에러 0개
- [ ] 빌드 성공

---

## Sprint 3 이후 전체 현황

Sprint 3 완료 시 dhelix vs Claude Code 격차:

```
해소된 격차 (Sprint 1-3):
  ✅ C1 Prompt Caching
  ✅ C2 Deferred Tool Loading
  ✅ C3 Tool Result Streaming
  ✅ C4 SSE MCP Transport
  ✅ I1 Worktree Isolation
  ✅ I2 Rich Markdown
  ✅ I3 Syntax Highlighting
  ✅ I4 Thinking Auto-Budget
  ✅ I5 Plan Mode Auto-Execution

남은 격차 (Sprint 4+):
  🟡 I6 OAuth/SSO 인증 (claude.ai 계정 기반)
  🟡 I7 /bug 자동 이슈 리포트
  🟡 I8 /doctor 포괄적 진단

코어 보강 (Sprint 3):
  ✅ H1 Sub-agent MCP 필터링
  ✅ H2 Tool 실행 재시도
  ✅ H3 Sub-agent Timeout
  ✅ H4 세션 승인 영속화
  ✅ H5 Worktree 고아 정리
```

**Sprint 3 완료 시 dhelix_develop_v2.md의 Critical + Important 격차가 100% 해소됩니다.**
남은 I6/I7/I8은 "Nice-to-have" 수준이며, 핵심 기능에는 영향이 없습니다.

---

## 아키텍처 결정 사항

### AD-1: Plan Mode 구현 방식

**결정: Claude Code 방식 — 프롬프트 강화 + 도구 필터링 (하드 블록 아님)**

> Armin Ronacher 분석: "Plan mode는 프롬프트 강화로 구현됨. 기술적으로는 충분히 강력한 프롬프트로 우회 가능하지만, 실용적으로는 잘 동작함."

- dhelix에서는 **프롬프트 + 권한 시스템 이중 보호**: 시스템 프롬프트에 read-only 지시 + 권한 모드 `plan`에서 `confirm`/`dangerous` 도구 차단
- Claude Code처럼 `.dhelix/plans/` 디렉토리에 계획 파일 저장 가능 (선택)
- `/plan off` 시 이전 모드로 자동 복원

### AD-2: MCP Transport 자동 감지

**결정: config 필드 기반 감지 (command → stdio, url → http)**

- MCP spec 2025-06-18에서 Streamable HTTP는 단일 엔드포인트 (POST+GET)
- JSON-RPC 배칭 제거됨 → 단일 메시지 처리만 구현
- `Mcp-Session-Id` 헤더로 세션 관리
- OAuth 2.1은 기존 `src/mcp/oauth.ts` 활용

### AD-3: Worktree 경로 규칙

**결정: Claude Code 패턴 — `.dhelix/worktrees/<name>`**

- `.gitignore`에 `.dhelix/worktrees/` 추가 권장
- 브랜치명: `dhelix-worktree-<name>`
- 변경 없으면 자동 정리, 변경 있으면 브랜치 + 경로 반환
- Windows: `process.platform === "win32"` 시 경로 정규화

---

## 웹 리서치 참조

### Claude Code Plan Mode

- [What Actually Is Claude Code's Plan Mode? — Armin Ronacher](https://lucumr.pocoo.org/2025/12/17/what-is-plan-mode/)
- [Claude Code system prompts — Piebald-AI](https://github.com/Piebald-AI/claude-code-system-prompts)
- [Claude Code's Plan Mode Isn't Read-Only — Sondera](https://blog.sondera.ai/p/claude-codes-plan-mode-isnt-read)
- [Plan Mode — ClaudeLog](https://claudelog.com/mechanics/plan-mode/)
- [Common Workflows — Claude Code Docs](https://code.claude.com/docs/en/common-workflows)

### MCP Streamable HTTP

- [MCP Spec 2025-06-18 Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [Why MCP Deprecated SSE — fka.dev](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/)
- [MCP 2025-06-18 Spec Update — Forge Code](https://forgecode.dev/blog/mcp-spec-updates/)
- [MCP Authorization Tutorial](https://modelcontextprotocol.io/docs/tutorials/security/authorization)

### Git Worktree Isolation

- [Claude Code Worktree Guide — claudefast.com](https://claudefa.st/blog/guide/development/worktree-guide)
- [Built-in worktree support — Boris Cherny (Anthropic)](https://www.threads.com/@boris_cherny/post/DVAAnexgRUj/)
- [Subagent isolation: worktree — GitHub Issue #27023](https://github.com/anthropics/claude-code/issues/27023)
- [Git Worktrees for AI Coding — DEV Community](https://dev.to/mashrulhaque/git-worktrees-for-ai-coding-run-multiple-agents-in-parallel-3pgb)
