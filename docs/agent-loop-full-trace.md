# dbcode Agent Loop — 전체 LLM 요청/응답 추적 문서

> 시나리오: 사용자가 "깃 체크아웃 하고 init command 시작해줘"를 입력하고,
> 이후 "테스트코드 작성해줘"를 입력하는 2-턴 대화의 모든 LLM 호출 전문

---

## 목차

1. [전체 아키텍처 요약](#1-전체-아키텍처-요약)
2. [Turn 1: "깃 체크아웃 하고 init command 시작해줘"](#2-turn-1)
   - [Iteration 1: 시스템 프롬프트 조립 + 첫 LLM 호출](#21-iteration-1)
   - [Iteration 2: git checkout 결과 피드백 + /init 처리](#22-iteration-2)
   - [Iteration 3: DBCODE.md 생성](#23-iteration-3)
   - [Iteration 4: 최종 응답](#24-iteration-4)
3. [Turn 2: "테스트코드 작성해줘"](#3-turn-2)
   - [Iteration 1: 컨텍스트 폭발 + 파일 읽기](#31-iteration-1)
   - [Iteration 2: 테스트 파일 작성](#32-iteration-2)
   - [Iteration 3: 테스트 실행 + 최종 응답](#33-iteration-3)
4. [토큰 사용량 누적 분석](#4-토큰-사용량-누적-분석)
5. [병목 지점 시각화](#5-병목-지점-시각화)

---

## 1. 전체 아키텍처 요약

```
┌─────────────────────────────────────────────────────────┐
│                    사용자 입력                            │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│  useAgentLoop.ts: handleSubmit()                         │
│  ┌─────────────────────────────────────────────────┐     │
│  │ 1. 슬래시 명령 체크 (/model, /help 등)           │     │
│  │ 2. system-prompt-builder.ts → 시스템 프롬프트 조립│     │
│  │ 3. messages 배열 구성                            │     │
│  │ 4. runAgentLoop() 호출                           │     │
│  └─────────────────────────────────────────────────┘     │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│  agent-loop.ts: runAgentLoop()                           │
│                                                          │
│  while (iterations < maxIterations) {                    │
│    ┌────────────────────────────────────────────┐        │
│    │ A. observation masking (오래된 도구 결과 마스킹)│        │
│    │ B. context compaction (토큰 예산 초과시 압축) │        │
│    │ C. tool definitions 준비                    │        │
│    │ D. strategy.prepareRequest() → 최종 요청 조립│        │
│    │ E. LLM API 호출 (stream 또는 일반)          │        │
│    │ F. 응답에서 tool_calls 추출                  │        │
│    │ G. 병렬/순차 그룹 분류                      │        │
│    │ H. 각 도구: 퍼미션 → 실행 → 훅 → 결과 추가  │        │
│    │ I. tool_calls 없으면 → 루프 종료             │        │
│    └────────────────────────────────────────────┘        │
│  }                                                       │
└──────────────────────────────────────────────────────────┘
```

**핵심**: 매 iteration마다 **시스템 프롬프트 + 전체 대화 히스토리**가 LLM에 재전송됩니다.

---

## 2. Turn 1

> 사용자 입력: **"깃 체크아웃 하고 init command 시작해줘"**

### 2.1. Iteration 1

#### 단계 A: 시스템 프롬프트 조립 (`system-prompt-builder.ts`)

섹션들이 우선순위별로 조립됩니다. HIGH 티어 모델 기준 **총 12,000 토큰 예산**:

| 우선순위 | 섹션 ID     | 내용 요약                                         | 예상 토큰 |
| -------- | ----------- | ------------------------------------------------- | --------- |
| 100      | identity    | "You are dbcode, an AI coding assistant..."       | ~200      |
| 95       | doing-tasks | 작업 수행 지침 (파일 읽기 먼저, 최소한의 변경 등) | ~800      |
| 94       | locale      | 한국어 응답 지시 (locale="ko"일 때)               | ~50       |
| 90       | environment | git branch, OS, shell, 프로젝트 타입 감지 결과    | ~300      |
| 85       | tools       | 16개 빌트인 도구의 JSON Schema 전체               | ~3,500    |
| 82       | mcp         | MCP 서버 도구 목록 (연결된 경우)                  | ~200      |
| 80       | conventions | 코딩 컨벤션 (named exports, immutable 등)         | ~500      |
| 78       | skills      | 슬래시 명령 목록 (/help, /init, /model 등)        | ~400      |
| 77       | action-bias | "도구를 반드시 호출하라" 지시                     | ~100      |
| 72       | auto-memory | MEMORY.md 내용                                    | ~300      |
| 70       | project     | DBCODE.md (아직 없으면 생략)                      | 0         |
| 35       | repo-map    | 프로젝트 파일 구조 트리                           | ~2,000    |

**조립된 시스템 프롬프트 (실제 전문 시뮬레이션)**:

```
You are dbcode, an AI coding assistant for local development.
You help developers write, edit, debug, and understand code.
You have access to tools for file operations, shell commands, and code search.

---

# Doing Tasks

- Read files before editing them. Use file_read before file_edit.
- Make minimal, focused changes. Don't refactor unrelated code.
- Use tools to take action — don't just describe what you plan to do.
- Handle errors with try/catch. Validate external inputs with Zod.
- Use named exports only. No default exports.
- Immutable patterns: spread copy, never mutate.
- ESM imports with .js extensions.

---

# Environment

- Working directory: /c/Users/DBInc/myproject
- Platform: win32
- Shell: bash (Git Bash)
- Git branch: feature/auth
- Git status: 2 modified files
- Project type: Node.js (TypeScript)
- Package manager: npm
- Node version: v20.11.0

---

# Available Tools

## file_read
Read a file and return its contents with line numbers.
Parameters:
  - file_path (string, required): Absolute path to the file
  - offset (number, optional): Line number to start reading from
  - limit (number, optional): Maximum number of lines to read

## file_write
Write content to a file, creating it if it doesn't exist.
Parameters:
  - file_path (string, required): Absolute path to the file
  - content (string, required): Content to write

## file_edit
Find and replace a specific string in a file.
Parameters:
  - path (string, required): File path to edit
  - old_string (string, required): Exact string to find (must be unique)
  - new_string (string, required): Replacement string
  - replace_all (boolean, optional): Replace all occurrences

## bash_exec
Execute a shell command and return stdout/stderr.
Parameters:
  - command (string, required): The command to execute
  - timeout (number, optional): Timeout in milliseconds (max 600000)
  - working_directory (string, optional): Working directory
  - run_in_background (boolean, optional): Run in background

## grep_search
Search file contents using regex patterns.
Parameters:
  - pattern (string, required): Regex pattern to search for
  - path (string, optional): Directory or file to search in
  - include (string, optional): Glob pattern to filter files
  - max_results (number, optional): Maximum results to return

## glob_search
Find files by name pattern.
Parameters:
  - pattern (string, required): Glob pattern (e.g., "**/*.ts")
  - path (string, optional): Base directory to search in

## list_dir
List directory contents.
Parameters:
  - path (string, required): Directory path to list

## ask_user
Ask the user a question and wait for their response.
Parameters:
  - question (string, required): The question to ask

## todo_write
Create or update a task list for tracking progress.
Parameters:
  - todos (array, required): Array of {id, title, status} objects

## agent
Spawn a subagent for parallel task execution.
Parameters:
  - task (string, required): Task description for the subagent
  - type (string, optional): "explore" | "plan" | "general"

## web_search
Search the web for information.
Parameters:
  - query (string, required): Search query
  - max_results (number, optional): Maximum results

## web_fetch
Fetch content from a URL.
Parameters:
  - url (string, required): URL to fetch

## mkdir
Create a directory (with parents).
Parameters:
  - path (string, required): Directory path to create

## notebook_edit
Edit a Jupyter notebook cell.
Parameters:
  - path (string, required): Notebook file path
  - cell_index (number, required): Cell index
  - content (string, required): New cell content

## bash_output
Read output from a background bash process.
Parameters:
  - pid (number, required): Process ID

## kill_shell
Kill a running background shell process.
Parameters:
  - pid (number, required): Process ID to kill

---

# Coding Conventions

- TypeScript strict mode, no `any` — use `unknown` + type guards
- Named exports only, no default exports
- ESM: use .js extension in imports
- Immutable state: readonly properties, spread copy
- Async everywhere: no sync fs operations
- AbortController for cancellable operations
- Commit format: feat(module), fix(module), refactor(module)

---

# Available Skills (Slash Commands)

/help — Show help
/clear — Clear conversation
/init — Initialize DBCODE.md for current project
/model — Switch LLM model
/config — View/edit configuration
/compact — Compact conversation context
/cost — Show token usage and cost
/context — Show context window usage
/resume — Resume previous session
/diff — Show git diff
/doctor — Diagnose configuration issues
/stats — Show session statistics

---

## Important: Action Bias

Do NOT end your turn by merely describing what you plan to do.
Always use tools to take action. If you need to read files, call file_read.
If you need to search, call grep_search. Never say "I will read the file"
without actually calling the tool.
Continue calling tools until the task is fully complete.

---

# Auto Memory

## Project Status (2026-03-06)
- Build: ✅ tsup ESM with code splitting
- Tests: 734 tests / 98.39% coverage
(... memory 내용 ...)

---

# Repository Map

src/
  cli/
    App.tsx
    components/
      UserInput.tsx
      ActivityFeed.tsx
      ...
  core/
    agent-loop.ts
    system-prompt-builder.ts
    context-manager.ts
    ...
  llm/
    client.ts
    streaming.ts
    ...
  tools/
    definitions/
      bash-exec.ts
      file-read.ts
      file-edit.ts
      ...
    executor.ts
    registry.ts
  utils/
    ...
test/
  ...
package.json
tsconfig.json
```

#### 단계 B: 최종 API 요청 조립

`agent-loop.ts:589-597`에서 다음 객체가 생성됩니다:

```typescript
// agent-loop.ts line 589
const chatRequest = {
  model: "gpt-4o", // 또는 사용자가 설정한 모델
  messages: [
    // ─── [0] 시스템 프롬프트 ───
    {
      role: "system",
      content: "You are dbcode, an AI coding assistant...",
      // ↑ 위의 전체 시스템 프롬프트 (약 12,000 토큰)
    },

    // ─── [1] 사용자 메시지 ───
    {
      role: "user",
      content: "깃 체크아웃 하고 init command 시작해줘",
    },
  ],

  // ─── 도구 정의 (OpenAI function calling 형식) ───
  tools: [
    {
      type: "function",
      function: {
        name: "file_read",
        description: "Read a file and return its contents with line numbers.",
        parameters: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "Absolute path to the file" },
            offset: { type: "number", description: "Line number to start reading from" },
            limit: { type: "number", description: "Maximum number of lines to read" },
          },
          required: ["file_path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "file_write",
        description: "Write content to a file, creating it if it doesn't exist.",
        parameters: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "Absolute path" },
            content: { type: "string", description: "Content to write" },
          },
          required: ["file_path", "content"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "file_edit",
        description: "Find and replace a specific string in a file.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to edit" },
            old_string: { type: "string", description: "Exact string to find" },
            new_string: { type: "string", description: "Replacement string" },
            replace_all: { type: "boolean", description: "Replace all occurrences" },
          },
          required: ["path", "old_string", "new_string"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "bash_exec",
        description: "Execute a shell command and return stdout/stderr.",
        parameters: {
          type: "object",
          properties: {
            command: { type: "string", description: "The command to execute" },
            timeout: { type: "number", description: "Timeout in ms (max 600000)" },
            working_directory: { type: "string", description: "Working directory" },
            run_in_background: { type: "boolean", description: "Run async" },
          },
          required: ["command"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "grep_search",
        description: "Search file contents using regex patterns.",
        parameters: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "Regex pattern" },
            path: { type: "string", description: "Directory to search" },
            include: { type: "string", description: "Glob filter" },
          },
          required: ["pattern"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "glob_search",
        description: "Find files by name pattern.",
        parameters: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "Glob pattern" },
            path: { type: "string", description: "Base directory" },
          },
          required: ["pattern"],
        },
      },
    },
    // ... list_dir, ask_user, todo_write, agent, web_search,
    //     web_fetch, mkdir, notebook_edit, bash_output, kill_shell
    // 총 16개 도구 정의
  ],

  temperature: 0,
  maxTokens: 4096,
  signal: abortController.signal, // Esc 키로 취소 가능
};
```

#### 단계 C: LLM API 호출

`client.ts`의 `toOpenAIMessages()`가 내부 메시지를 OpenAI 형식으로 변환 후,
`openai.chat.completions.create()` (스트리밍이면 `.stream()`) 호출.

```
>>> HTTP POST https://api.openai.com/v1/chat/completions

요청 크기: ~14,000 토큰 (시스템 12,000 + 사용자 메시지 30 + 도구 정의 2,000)
예상 소요: 5~15초
```

#### 단계 D: LLM 응답 수신

```json
{
  "id": "chatcmpl-abc123",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "git checkout을 실행하겠습니다.",
        "tool_calls": [
          {
            "id": "call_001",
            "type": "function",
            "function": {
              "name": "bash_exec",
              "arguments": "{\"command\": \"git checkout main\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 14200,
    "completion_tokens": 45,
    "total_tokens": 14245
  }
}
```

> **주목**: LLM은 두 작업(git checkout + init) 중 **하나만** 먼저 처리합니다.
> ReAct 패턴의 특성상, 하나를 실행하고 결과를 본 뒤 다음 행동을 결정합니다.

#### 단계 E: 도구 호출 추출 + 퍼미션 체크

```
agent-loop.ts line 741:
  extractToolCalls() → [{ id: "call_001", name: "bash_exec", arguments: { command: "git checkout main" } }]

agent-loop.ts line 836:
  checkPermission("bash_exec", { command: "git checkout main" })
  → settings.local.json의 allow 목록에 "Bash(git checkout *)" 있음
  → ✅ 자동 허용 (사용자 프롬프트 없음)
```

#### 단계 F: 도구 실행

```
executor.ts:
  spawn("bash", ["-c", "git checkout main"], {
    timeout: 120000,
    signal: abortSignal,
    cwd: "/c/Users/DBInc/myproject"
  })

  stdout: "Already on 'main'\nYour branch is up to date with 'origin/main'."
  exitCode: 0
```

#### 단계 G: PostToolUse 훅 실행

```
hooks/runner.ts:
  matcher: "Edit|Write"  ← bash_exec는 매치 안 됨
  → 훅 실행 안 함 (이 경우는 빠름)
```

#### 단계 H: 도구 결과를 messages에 추가

```typescript
// agent-loop.ts: 도구 결과 메시지 추가
messages.push({
  role: "tool",
  content: "Already on 'main'\nYour branch is up to date with 'origin/main'.",
  toolCallId: "call_001",
});
```

**현재 messages 상태:**

```
[0] { role: "system",    content: "You are dbcode..." }           // ~12,000 토큰
[1] { role: "user",      content: "깃 체크아웃 하고 init..." }     // ~30 토큰
[2] { role: "assistant", content: "git checkout을 실행하겠습니다.",
      toolCalls: [{ id: "call_001", name: "bash_exec", ... }] }  // ~45 토큰
[3] { role: "tool",      toolCallId: "call_001",
      content: "Already on 'main'..." }                           // ~25 토큰
```

**→ tool_calls가 있었으므로 루프 계속 (Iteration 2로)**

---

### 2.2. Iteration 2

#### 단계 A: Observation Masking + Context Compaction

```typescript
// agent-loop.ts line 566
const maskedMessages = applyObservationMasking(messages, { keepRecentN: 5 });
// → 아직 메시지가 4개뿐이므로 마스킹 없음

// agent-loop.ts line 568
const managedMessages = await contextManager.prepare(maskedMessages);
// → 총 토큰 ~14,100. maxContextTokens 이내이므로 압축 없음
```

#### 단계 B: LLM API 호출 (2회차)

```typescript
const chatRequest = {
  model: "gpt-4o",
  messages: [
    // [0] 시스템 프롬프트 (동일, ~12,000 토큰) ← ⚠️ 매번 재전송!
    { role: "system", content: "You are dbcode..." },

    // [1] 원래 사용자 메시지
    { role: "user", content: "깃 체크아웃 하고 init command 시작해줘" },

    // [2] 1회차 어시스턴트 응답
    {
      role: "assistant",
      content: "git checkout을 실행하겠습니다.",
      tool_calls: [
        {
          id: "call_001",
          type: "function",
          function: { name: "bash_exec", arguments: '{"command":"git checkout main"}' },
        },
      ],
    },

    // [3] 1회차 도구 결과
    {
      role: "tool",
      tool_call_id: "call_001",
      content: "Already on 'main'\nYour branch is up to date with 'origin/main'.",
    },
  ],
  tools: [
    /* 동일한 16개 도구 정의 */
  ],
  temperature: 0,
  maxTokens: 4096,
};
```

```
>>> HTTP POST (2회차)
요청 크기: ~14,300 토큰 (이전 + 어시스턴트 45 + 도구결과 25)
예상 소요: 5~15초
```

#### LLM 응답 (2회차)

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "main 브랜치로 체크아웃했습니다. 이제 프로젝트를 초기화하겠습니다. 먼저 프로젝트 구조를 확인합니다.",
        "tool_calls": [
          {
            "id": "call_002",
            "type": "function",
            "function": {
              "name": "glob_search",
              "arguments": "{\"pattern\": \"package.json\", \"path\": \"/c/Users/DBInc/myproject\"}"
            }
          },
          {
            "id": "call_003",
            "type": "function",
            "function": {
              "name": "list_dir",
              "arguments": "{\"path\": \"/c/Users/DBInc/myproject\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 14350,
    "completion_tokens": 120,
    "total_tokens": 14470
  }
}
```

> **병렬 실행**: glob_search + list_dir는 둘 다 읽기 전용이므로 `groupToolCalls()`에서 같은 그룹에 배치됩니다.
> → `[[call_002, call_003]]` — 동시에 실행

#### 도구 실행 (병렬)

```
[call_002] glob_search("package.json") → "package.json" (1 match)
[call_003] list_dir("/c/Users/DBInc/myproject") →
  "src/\n  index.ts\n  utils.ts\npackage.json\ntsconfig.json\nREADME.md"
```

#### messages에 추가

```
[4] { role: "assistant", content: "main 브랜치로...", toolCalls: [call_002, call_003] }
[5] { role: "tool", toolCallId: "call_002", content: "package.json" }
[6] { role: "tool", toolCallId: "call_003", content: "src/\n  index.ts\n..." }
```

**→ tool_calls 있으므로 Iteration 3으로**

---

### 2.3. Iteration 3

#### LLM API 호출 (3회차)

```typescript
messages: [
  // [0] 시스템 프롬프트 (~12,000 토큰) ← ⚠️ 3번째 재전송
  // [1] 사용자: "깃 체크아웃 하고 init..."
  // [2] 어시스턴트: "git checkout을 실행하겠습니다." + tool_calls
  // [3] 도구결과: "Already on 'main'..."
  // [4] 어시스턴트: "main 브랜치로 체크아웃..." + tool_calls
  // [5] 도구결과: "package.json"
  // [6] 도구결과: "src/\n  index.ts\n..."
]

요청 크기: ~14,700 토큰
예상 소요: 8~20초 (응답이 길어짐 — DBCODE.md 생성)
```

#### LLM 응답 (3회차) — DBCODE.md 파일 생성

````json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "프로젝트 구조를 파악했습니다. DBCODE.md를 생성합니다.",
        "tool_calls": [
          {
            "id": "call_004",
            "type": "function",
            "function": {
              "name": "file_write",
              "arguments": "{\"file_path\":\"/c/Users/DBInc/myproject/DBCODE.md\",\"content\":\"# DBCODE.md — myproject\\n\\nNode.js TypeScript project.\\n\\n## Commands\\n\\n```bash\\nnpm run build\\nnpm test\\nnpm run lint\\n```\\n\\n## Key Rules\\n\\n- TypeScript strict mode\\n- ESM imports\\n- Named exports only\\n\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 14700,
    "completion_tokens": 180,
    "total_tokens": 14880
  }
}
````

#### 퍼미션 체크 + 실행

```
checkPermission("file_write", { file_path: ".../DBCODE.md" })
→ settings.local.json allow에 "Write" 있음
→ ✅ 자동 허용

executor.ts: writeFile("/c/Users/DBInc/myproject/DBCODE.md", content)
→ 성공
```

#### ⚠️ PostToolUse 훅 실행!

```
hooks/runner.ts:
  matcher: "Edit|Write" ← file_write가 "Write"에 매치!

  실행: npx prettier --write "/c/Users/DBInc/myproject/DBCODE.md" 2>/dev/null || true
  → npx 시작 오버헤드 + prettier 실행 = 약 1~3초 추가
```

#### messages에 추가

```
[7] { role: "assistant", content: "프로젝트 구조를...", toolCalls: [call_004] }
[8] { role: "tool", toolCallId: "call_004", content: "File written: /c/.../DBCODE.md (245 bytes)" }
```

---

### 2.4. Iteration 4

#### LLM API 호출 (4회차)

```typescript
messages: [
  // [0] 시스템 프롬프트 (~12,000 토큰)  ← ⚠️ 4번째 재전송
  // [1] 사용자 메시지
  // [2]-[3] Iteration 1 (어시스턴트 + 도구결과)
  // [4]-[6] Iteration 2 (어시스턴트 + 도구결과 2개)
  // [7]-[8] Iteration 3 (어시스턴트 + 도구결과)
]

요청 크기: ~15,200 토큰
```

#### LLM 응답 (4회차) — 최종 텍스트 응답

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "완료했습니다!\n\n1. ✅ `main` 브랜치로 체크아웃했습니다\n2. ✅ 프로젝트를 초기화하고 `DBCODE.md`를 생성했습니다\n\nDBCODE.md에 프로젝트 빌드 명령, 코딩 규칙 등을 작성했습니다. 필요하면 내용을 수정해드릴게요.",
        "tool_calls": []
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15200,
    "completion_tokens": 95,
    "total_tokens": 15295
  }
}
```

**→ tool_calls가 비어있으므로 루프 종료!**

#### Turn 1 결산

```
LLM API 호출: 4회
총 입력 토큰: 14,200 + 14,350 + 14,700 + 15,200 = 58,450 토큰
총 출력 토큰: 45 + 120 + 180 + 95 = 440 토큰
도구 실행: 4회 (bash_exec, glob_search, list_dir, file_write)
PostToolUse 훅: 1회 (prettier on file_write)
예상 총 소요 시간: 25~60초
```

---

## 3. Turn 2

> 사용자 입력: **"테스트코드 작성해줘"**

### 3.1. Iteration 1

사용자가 새 메시지를 입력하면, **이전 Turn의 모든 messages가 유지된 채** 새 메시지가 추가됩니다.

#### 현재 messages 상태 (Turn 2 시작 시점)

```typescript
messages: [
  // ─── Turn 1에서 누적된 메시지들 ───
  [0]  { role: "system",    content: "You are dbcode..." },           // ~12,000 토큰
  [1]  { role: "user",      content: "깃 체크아웃 하고 init..." },     // ~30 토큰
  [2]  { role: "assistant", content: "git checkout을 실행합니다.",
         toolCalls: [{ bash_exec: "git checkout main" }] },           // ~45 토큰
  [3]  { role: "tool",      content: "Already on 'main'..." },        // ~25 토큰
  [4]  { role: "assistant", content: "main 브랜치로 체크아웃...",
         toolCalls: [{ glob_search }, { list_dir }] },                // ~120 토큰
  [5]  { role: "tool",      content: "package.json" },                // ~10 토큰
  [6]  { role: "tool",      content: "src/\n  index.ts\n..." },       // ~50 토큰
  [7]  { role: "assistant", content: "DBCODE.md를 생성합니다.",
         toolCalls: [{ file_write: "DBCODE.md" }] },                  // ~180 토큰
  [8]  { role: "tool",      content: "File written: DBCODE.md" },     // ~15 토큰
  [9]  { role: "assistant", content: "완료했습니다! ..." },             // ~95 토큰

  // ─── Turn 2: 새 사용자 메시지 ───
  [10] { role: "user",      content: "테스트코드 작성해줘" }            // ~15 토큰
]
```

#### Observation Masking 적용

```typescript
// agent-loop.ts line 566
const maskedMessages = applyObservationMasking(messages, { keepRecentN: 5 });
```

`keepRecentN: 5`이므로 **최근 5개 메시지([6]~[10])는 보존**, 그 이전의 tool 결과는 마스킹됩니다:

```
[3] tool 결과 "Already on 'main'..." → "[이전 도구 결과 — 요약됨]" 으로 압축
[5] tool 결과 "package.json" → "[이전 도구 결과 — 요약됨]"
```

> **목적**: 오래된 도구 결과의 세부 텍스트를 제거하여 토큰 절약

#### LLM API 호출 (Turn 2, 1회차)

```typescript
const chatRequest = {
  model: "gpt-4o",
  messages: [
    // [0] 시스템 프롬프트 (~12,000 토큰)   ← ⚠️ 5번째 재전송!!
    { role: "system", content: "You are dbcode..." },

    // [1] Turn 1 사용자 메시지
    { role: "user", content: "깃 체크아웃 하고 init command 시작해줘" },

    // [2] Turn 1 어시스턴트 (1회차)
    { role: "assistant", content: "git checkout을 실행하겠습니다.",
      tool_calls: [{ id: "call_001", ... }] },

    // [3] Turn 1 도구결과 (마스킹됨)
    { role: "tool", tool_call_id: "call_001",
      content: "[Previous tool output summarized]" },

    // [4] Turn 1 어시스턴트 (2회차)
    { role: "assistant", content: "main 브랜치로 체크아웃...",
      tool_calls: [{ id: "call_002", ... }, { id: "call_003", ... }] },

    // [5] Turn 1 도구결과 (마스킹됨)
    { role: "tool", tool_call_id: "call_002",
      content: "[Previous tool output summarized]" },

    // [6] Turn 1 도구결과 (보존 — 최근 5개 내)
    { role: "tool", tool_call_id: "call_003",
      content: "src/\n  index.ts\n  utils.ts\npackage.json\ntsconfig.json" },

    // [7] Turn 1 어시스턴트 (3회차)
    { role: "assistant", content: "프로젝트 구조를 파악...",
      tool_calls: [{ id: "call_004", ... }] },

    // [8] Turn 1 도구결과 (보존)
    { role: "tool", tool_call_id: "call_004",
      content: "File written: /c/.../DBCODE.md (245 bytes)" },

    // [9] Turn 1 어시스턴트 (최종 응답)
    { role: "assistant", content: "완료했습니다!\n1. ✅ main 브랜치로..." },

    // [10] Turn 2 사용자 메시지 ← 새 입력
    { role: "user", content: "테스트코드 작성해줘" }
  ],
  tools: [ /* 동일한 16개 */ ],
  temperature: 0,
  maxTokens: 4096
};
```

```
>>> HTTP POST
요청 크기: ~15,500 토큰 (시스템 12,000 + 대화 히스토리 3,500)
예상 소요: 8~20초
```

#### LLM 응답 — 파일 읽기 결정

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "테스트코드를 작성하겠습니다. 먼저 소스 파일을 확인합니다.",
        "tool_calls": [
          {
            "id": "call_005",
            "function": {
              "name": "file_read",
              "arguments": "{\"file_path\":\"/c/Users/DBInc/myproject/src/index.ts\"}"
            }
          },
          {
            "id": "call_006",
            "function": {
              "name": "file_read",
              "arguments": "{\"file_path\":\"/c/Users/DBInc/myproject/src/utils.ts\"}"
            }
          },
          {
            "id": "call_007",
            "function": {
              "name": "file_read",
              "arguments": "{\"file_path\":\"/c/Users/DBInc/myproject/package.json\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 15500,
    "completion_tokens": 150,
    "total_tokens": 15650
  }
}
```

> **병렬 실행**: file_read 3개 모두 `ALWAYS_PARALLEL_TOOLS`에 속하므로 동시 실행

#### 도구 실행 (3개 병렬)

```
[call_005] file_read("src/index.ts") →
  "     1 | import { add, subtract } from './utils.js';\n     2 | \n     3 | export function main() {\n     4 |   console.log(add(1, 2));\n     5 |   console.log(subtract(5, 3));\n     6 | }\n"
  (약 200 토큰)

[call_006] file_read("src/utils.ts") →
  "     1 | export function add(a: number, b: number): number {\n     2 |   return a + b;\n     3 | }\n     4 | \n     5 | export function subtract(a: number, b: number): number {\n     6 |   return a - b;\n     7 | }\n"
  (약 150 토큰)

[call_007] file_read("package.json") →
  "     1 | {\n     2 |   \"name\": \"myproject\",\n     3 |   \"type\": \"module\",\n     4 |   \"scripts\": {\n     5 |     \"build\": \"tsc\",\n     6 |     \"test\": \"vitest run\"\n     7 |   },\n     8 |   \"devDependencies\": {\n     9 |     \"vitest\": \"^1.6.0\",\n    10 |     \"typescript\": \"^5.4.0\"\n    11 |   }\n    12 | }\n"
  (약 200 토큰)
```

#### PostToolUse 훅

```
file_read는 "Edit|Write"에 매치 안 됨 → 훅 실행 안 함 ✅
```

#### messages에 추가

```
[11] { role: "assistant", content: "테스트코드를 작성하겠습니다...",
       toolCalls: [call_005, call_006, call_007] }                    // ~150 토큰
[12] { role: "tool", toolCallId: "call_005", content: "1 | import..." } // ~200 토큰
[13] { role: "tool", toolCallId: "call_006", content: "1 | export..." } // ~150 토큰
[14] { role: "tool", toolCallId: "call_007", content: "1 | {..." }      // ~200 토큰
```

---

### 3.2. Iteration 2

#### LLM API 호출 (Turn 2, 2회차)

```typescript
messages: [
  // [0]  시스템 프롬프트 (~12,000 토큰)     ← ⚠️ 6번째 재전송!!!
  // [1]  Turn 1 사용자: "깃 체크아웃..."
  // [2]  Turn 1 어시스턴트 + tool_calls
  // [3]  Turn 1 도구결과 (마스킹)
  // [4]  Turn 1 어시스턴트 + tool_calls
  // [5]  Turn 1 도구결과 (마스킹)
  // [6]  Turn 1 도구결과 (보존)
  // [7]  Turn 1 어시스턴트 + tool_calls
  // [8]  Turn 1 도구결과 (보존)
  // [9]  Turn 1 어시스턴트 (최종)
  // [10] Turn 2 사용자: "테스트코드 작성해줘"
  // [11] Turn 2 어시스턴트 + tool_calls (3개 file_read)
  // [12] Turn 2 도구결과: index.ts 내용
  // [13] Turn 2 도구결과: utils.ts 내용
  // [14] Turn 2 도구결과: package.json 내용
]

요청 크기: ~16,400 토큰
예상 소요: 15~30초 (긴 파일 생성 응답)
```

#### LLM 응답 — 테스트 파일 작성

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "소스 파일을 확인했습니다. vitest로 테스트를 작성합니다.",
        "tool_calls": [
          {
            "id": "call_008",
            "function": {
              "name": "file_write",
              "arguments": "{\"file_path\":\"/c/Users/DBInc/myproject/test/utils.test.ts\",\"content\":\"import { describe, it, expect } from 'vitest';\\nimport { add, subtract } from '../src/utils.js';\\n\\ndescribe('add', () => {\\n  it('should add two positive numbers', () => {\\n    expect(add(1, 2)).toBe(3);\\n  });\\n\\n  it('should handle zero', () => {\\n    expect(add(0, 5)).toBe(5);\\n  });\\n\\n  it('should handle negative numbers', () => {\\n    expect(add(-1, -2)).toBe(-3);\\n  });\\n});\\n\\ndescribe('subtract', () => {\\n  it('should subtract two numbers', () => {\\n    expect(subtract(5, 3)).toBe(2);\\n  });\\n\\n  it('should handle negative result', () => {\\n    expect(subtract(3, 5)).toBe(-2);\\n  });\\n});\\n\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 16400,
    "completion_tokens": 350,
    "total_tokens": 16750
  }
}
```

#### 도구 실행

```
[call_008] file_write("test/utils.test.ts", content)
  → mkdir -p test/ (부모 디렉토리 자동 생성)
  → writeFile("test/utils.test.ts", content)
  → 성공: "File written: test/utils.test.ts (478 bytes)"
```

#### ⚠️ PostToolUse 훅 실행!

```
hooks/runner.ts:
  matcher: "Edit|Write" ← file_write가 "Write"에 매치!

  실행: npx prettier --write "/c/Users/DBInc/myproject/test/utils.test.ts"
  → 약 1~3초 추가
```

---

### 3.3. Iteration 3

#### LLM API 호출 (Turn 2, 3회차)

```typescript
messages: [
  // [0]  시스템 프롬프트 (~12,000 토큰)    ← ⚠️ 7번째 재전송!!!!
  // [1]-[9]   Turn 1 전체 히스토리          ← 계속 누적됨
  // [10]      Turn 2 사용자 메시지
  // [11]-[14] Turn 2 Iteration 1
  // [15]      Turn 2 Iteration 2 어시스턴트
  // [16]      Turn 2 Iteration 2 도구결과
]

요청 크기: ~17,200 토큰
```

#### LLM 응답 — 테스트 실행

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "테스트 파일을 작성했습니다. 실행해서 확인합니다.",
        "tool_calls": [
          {
            "id": "call_009",
            "function": {
              "name": "bash_exec",
              "arguments": "{\"command\":\"npx vitest run\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 17200,
    "completion_tokens": 55,
    "total_tokens": 17255
  }
}
```

#### 도구 실행

```
[call_009] bash_exec("npx vitest run")
→ stdout:
  " ✓ test/utils.test.ts (5 tests) 12ms
    ✓ add > should add two positive numbers
    ✓ add > should handle zero
    ✓ add > should handle negative numbers
    ✓ subtract > should subtract two numbers
    ✓ subtract > should handle negative result

  Test Files  1 passed (1)
  Tests       5 passed (5)
  Duration    1.23s"
```

---

### 3.4. Iteration 4 (최종)

#### LLM API 호출 (Turn 2, 4회차)

```
요청 크기: ~17,700 토큰 (← ⚠️ 8번째 시스템 프롬프트 재전송)
```

#### LLM 응답 — 최종 텍스트

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "테스트코드를 작성하고 모두 통과했습니다! ✅\n\n**`test/utils.test.ts`** (5개 테스트):\n- `add`: 양수, 0, 음수 케이스\n- `subtract`: 일반 케이스, 음수 결과 케이스\n\n모든 테스트가 통과했습니다 (5/5, 1.23s).",
        "tool_calls": []
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 17700,
    "completion_tokens": 110,
    "total_tokens": 17810
  }
}
```

**→ tool_calls 비어있음 → 루프 종료 → UI에 최종 텍스트 표시**

---

## 4. 토큰 사용량 누적 분석

### Turn 1 (4 iterations)

| Iter | 입력 토큰 | 출력 토큰 | 누적 입력 | 시스템 프롬프트 비중 |
| ---- | --------- | --------- | --------- | -------------------- |
| 1    | 14,200    | 45        | 14,200    | 84.5%                |
| 2    | 14,350    | 120       | 28,550    | 83.6%                |
| 3    | 14,700    | 180       | 43,250    | 81.6%                |
| 4    | 15,200    | 95        | 58,450    | 78.9%                |

### Turn 2 (4 iterations)

| Iter | 입력 토큰 | 출력 토큰 | 누적 입력 | 시스템 프롬프트 비중 |
| ---- | --------- | --------- | --------- | -------------------- |
| 5    | 15,500    | 150       | 73,950    | 77.4%                |
| 6    | 16,400    | 350       | 90,350    | 73.2%                |
| 7    | 17,200    | 55        | 107,550   | 69.8%                |
| 8    | 17,700    | 110       | 125,250   | 67.8%                |

### 총계

```
전체 LLM API 호출: 8회
전체 입력 토큰:    125,250
전체 출력 토큰:    1,105
합계:             126,355 토큰

시스템 프롬프트만: 12,000 × 8 = 96,000 토큰 (전체의 76%!)
실제 대화 내용:    30,355 토큰 (전체의 24%)
```

### 비용 (GPT-4o 기준, $2.50/1M input, $10/1M output)

```
입력: 125,250 × $2.50 / 1,000,000 = $0.31
출력: 1,105 × $10 / 1,000,000   = $0.01
합계: $0.32 (약 470원)

이 중 시스템 프롬프트 비용: $0.24 (75%)
```

---

## 5. 병목 지점 시각화

```
시간 흐름 →

Turn 1, Iter 1:
  [시스템 프롬프트 조립 100ms][===== LLM API 호출 8s =====][git checkout 0.5s]

Turn 1, Iter 2:
  [masking 10ms][===== LLM API 호출 9s =====][glob+listdir 0.3s (병렬)]

Turn 1, Iter 3:
  [masking 10ms][======= LLM API 호출 12s =======][file_write 50ms][prettier 2s ⚠️]

Turn 1, Iter 4:
  [masking 10ms][===== LLM API 호출 8s =====]
                                              ← Turn 1 종료 (~40s)

Turn 2, Iter 1:
  [masking 20ms][======= LLM API 호출 12s ========][file_read ×3 0.1s (병렬)]

Turn 2, Iter 2:
  [masking 20ms][========= LLM API 호출 18s =========][file_write 50ms][prettier 2s ⚠️]

Turn 2, Iter 3:
  [masking 20ms][======= LLM API 호출 10s ========][vitest 3s]

Turn 2, Iter 4:
  [masking 20ms][===== LLM API 호출 8s =====]
                                              ← Turn 2 종료 (~55s)

총 소요: ~95초 (1분 35초)
```

### 시간 분포

```
LLM API 대기:     ~85초 (89%)  ← 절대적 병목
도구 실행:         ~4초  (4%)
Prettier 훅:      ~4초  (4%)   ← 제거 가능한 낭비
기타 (조립, 마스킹): ~2초  (2%)
```

### 핵심 인사이트

1. **시간의 89%는 LLM 응답 대기** — 이건 모델 속도에 의존하므로 줄이기 어려움
2. **시스템 프롬프트가 입력 토큰의 76%** — 이걸 줄이면 LLM 응답 속도가 빨라짐
3. **8번의 API 호출에서 시스템 프롬프트가 8번 반복 전송** — Prompt Caching이 있으면 절약 가능
4. **Prettier 훅은 파일 쓸 때마다 1~3초 추가** — 세션 끝에 한번으로 바꾸면 절약
5. **대화가 길어질수록 컨텍스트가 누적** — Turn 2의 각 호출은 Turn 1보다 2,000~3,000 토큰 더 큼

---

## 부록: 코드 위치 참조

| 기능                 | 파일                                | 주요 라인                   |
| -------------------- | ----------------------------------- | --------------------------- |
| 시스템 프롬프트 조립 | `src/core/system-prompt-builder.ts` | `buildSystemPrompt()` L194  |
| 섹션 우선순위/예산   | `src/core/system-prompt-builder.ts` | `TIER_BUDGETS` L38-71       |
| Agent Loop 메인      | `src/core/agent-loop.ts`            | `runAgentLoop()` L488       |
| LLM 요청 조립        | `src/core/agent-loop.ts`            | `chatRequest` L589-597      |
| 스트리밍 호출        | `src/core/agent-loop.ts`            | L604-636                    |
| 도구 호출 추출       | `src/core/agent-loop.ts`            | L741-766                    |
| 병렬 그룹 분류       | `src/core/agent-loop.ts`            | `groupToolCalls()` L369     |
| 도구 결과 잘라내기   | `src/core/agent-loop.ts`            | `truncateToolResult()` L429 |
| OpenAI 메시지 변환   | `src/llm/client.ts`                 | `toOpenAIMessages()` L61    |
| 에러 분류/재시도     | `src/core/agent-loop.ts`            | `classifyLLMError()` L173   |
| Observation Masking  | `src/core/observation-masking.ts`   | `applyObservationMasking()` |
| Context Compaction   | `src/core/context-manager.ts`       | `prepare()`                 |
| 퍼미션 체크          | `src/permissions/manager.ts`        | `checkPermission()`         |
| 도구 실행            | `src/tools/executor.ts`             | `executeToolCall()`         |
| 훅 실행              | `src/hooks/runner.ts`               | `run()`                     |
| Circuit Breaker      | `src/core/circuit-breaker.ts`       | `shouldContinue()`          |
