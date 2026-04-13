# 04. CLI UX/UI and GUI Companion Plan

> DHelix Code v0.2.x -> v0.5.x | 2026 Q2-Q3 UX 혁신 로드맵
>
> 목표: "capable terminal UI" -> "high-trust operator workspace" + GUI companion
>
> **Note:** Master roadmap (99-master-roadmap.md)에 따라 CLI UX는 v0.5.0 Wave 3에 배치.

---

## 1. Current UX Assessment

### 1.1 Component-by-Component Rating

DHelix CLI는 Ink 5.x (React for CLI) 기반 22개 컴포넌트로 구성.
전체 UX quality 78% -- 기능적으로 동작하나 미적 완성도와 operator-grade 인터랙션 부족.

| Component               | File                              | Rating | Strengths                | Gaps                                       |
| ----------------------- | --------------------------------- | ------ | ------------------------ | ------------------------------------------ |
| `App.tsx`               | `src/cli/App.tsx`                 | B      | ErrorBoundary, hook 통합 | Shell layout 추상화 없음, 모든 상태가 flat |
| `MessageList`           | `components/MessageList.tsx`      | B-     | 대화 렌더링 기본 완성    | Virtualization 없음, 대형 세션 성능 저하   |
| `StreamingMessage`      | `components/StreamingMessage.tsx` | B      | 실시간 토큰 스트리밍     | Diff 모드 없음, plain text only            |
| `PromptInput/UserInput` | `components/UserInput.tsx`        | B+     | Slash command, voice     | Overlay suggestion 미분리, multi-line 제한 |
| `StatusBar`             | `components/StatusBar.tsx`        | C+     | 기본 상태 표시           | 클릭/네비게이션 불가, passive label only   |
| `ToolCallBlock`         | `components/ToolCallBlock.tsx`    | B      | Tool 실행 피드백         | Grouped summary 없음, 개별 나열            |
| `ActivityFeed`          | `components/ActivityFeed.tsx`     | B      | 실시간 활동              | Timeline 부재, event grouping 없음         |
| `PermissionPrompt`      | `components/PermissionPrompt.tsx` | B+     | 5 modes, 명확한 UX       | Inline diff preview 없음                   |
| `ThinkingBlock`         | `components/ThinkingBlock.tsx`    | B      | Thinking 상태 표시       | Token budget 시각화 없음                   |
| `TaskListView`          | `components/TaskListView.tsx`     | B-     | 태스크 목록              | Tab switching 없음, flat list              |
| `TaskViewPanel`         | `components/TaskViewPanel.tsx`    | B-     | 태스크 상세              | Thread viewer 미흡                         |
| `TeammateStatus`        | `components/TeammateStatus.tsx`   | B      | 팀원 상태 표시           | Agent switching UI 없음                    |
| `SlashCommandMenu`      | `components/SlashCommandMenu.tsx` | B+     | 자동완성, 검색           | Fuzzy match 없음                           |
| `Logo`                  | `components/Logo.tsx`             | A-     | Double Helix 브랜드      | 애니메이션 없음                            |
| `Spinner`               | `components/Spinner.tsx`          | B      | 로딩 표시                | 단일 스타일, progress 미표시               |
| `RetryCountdown`        | `components/RetryCountdown.tsx`   | B+     | 재시도 UX                | 시각적 카운트다운 바 없음                  |
| `ErrorBanner`           | `components/ErrorBanner.tsx`      | B      | 에러 표시                | Dismissible 아님, action 없음              |
| `ErrorBoundary`         | `components/ErrorBoundary.tsx`    | A-     | React boundary 패턴      | 복구 옵션 제한적                           |
| `SelectList`            | `components/SelectList.tsx`       | B      | 선택 리스트              | 스크롤 인디케이터 없음                     |
| `VoiceIndicator`        | `components/VoiceIndicator.tsx`   | B+     | 음성 입력 피드백         | 파형 시각화 없음                           |
| `ReadGroupBlock`        | `components/ReadGroupBlock.tsx`   | B      | 파일 읽기 그룹화         | 축소/확장 없음                             |
| `TurnBlock`             | `components/TurnBlock.tsx`        | B      | Turn 단위 렌더링         | Collapse/expand 없음                       |
| `AgentStatus`           | `components/AgentStatus.tsx`      | B      | 에이전트 상태            | Multi-agent thread 미지원                  |

### 1.2 UX Infrastructure Rating

| Area                | Rating | Note                                                      |
| ------------------- | ------ | --------------------------------------------------------- |
| Theme system        | B+     | Dark/Light/Auto/Colorblind 4모드, SSOT `theme.ts`         |
| Keybindings         | B+     | Customizable, chord support, `~/.dhelix/keybindings.json` |
| Syntax highlighting | B      | Shiki 기반, 언어 지원 양호                                |
| Layout system       | C      | Shell layout 추상화 없음, transcript-centric              |
| Overlay/Modal       | C-     | 별도 레이어 없음, 프롬프트에 혼합                         |
| Performance         | C+     | 매 키스트로크 re-render, virtualization 없음              |
| Accessibility       | D      | Screen reader 미지원, ARIA 없음                           |
| Responsive layout   | D      | 작은 터미널 대응 없음                                     |

---

## 2. Competitive Visual Comparison

### 2.1 Feature Matrix

| Feature                | DHelix (현재)       | OpenCode               | Codex              | Claude Code         |
| ---------------------- | ------------------- | ---------------------- | ------------------ | ------------------- |
| **Framework**          | Ink 5.x (React)     | SolidJS + OpenTUI      | Ratatui (Rust)     | Ink (React)         |
| **Shell layout**       | Flat transcript     | Multi-pane             | Chat + bottom pane | Scrollable + sticky |
| **Diff viewer**        | None (plain text)   | Syntax-aware           | Syntax highlight   | Inline diff         |
| **Agent tabs**         | None                | Tab switching          | Thread viewer      | Background panel    |
| **File browser**       | None                | Tree widget            | None               | None                |
| **Theme**              | 4 modes             | Dark/Light + custom    | 256 + truecolor    | Dark/Light          |
| **ANSI colors**        | Basic (Ink default) | 12 custom styles       | Full truecolor     | Standard            |
| **Performance**        | Every-key rerender  | SolidJS fine-grained   | Rust-native        | Optimized           |
| **Job/approval panel** | Basic permission    | Full panel system      | Approval dialog    | Approval flow       |
| **Image support**      | None                | None                   | Terminal protocol  | None                |
| **Audio notification** | None                | None                   | Completion sound   | None                |
| **Session forking**    | None                | Fork UI                | None               | None                |
| **Web dashboard**      | None                | Desktop + Web + App    | None               | None                |
| **IDE integration**    | VSCode ext (basic)  | VSCode-like UI         | None               | VSCode ext          |
| **Virtualization**     | None                | Virtua (large history) | Efficient (Rust)   | Unknown             |
| **Accessibility**      | None                | Unknown                | Unknown            | Minimal             |
| **Plugin keybindings** | Chord support       | Plugin-driven          | Custom             | Limited             |

### 2.2 Competitive Position Analysis

**DHelix 강점:**

- React ecosystem 활용 (Ink 5.x) -- 개발 속도, 커뮤니티
- 22개 컴포넌트 이미 구현 -- foundation 양호
- Keybinding customization + chord support -- 경쟁 우위
- 4가지 테마 + 브랜드 컬러 체계 -- 디자인 기반 있음
- Voice input support -- 차별화 기능

**Critical gaps (경쟁 열위):**

1. **Shell layout** -- 모든 경쟁자가 multi-pane layout 보유, DHelix는 flat
2. **Diff viewer** -- 2026 표준 기능, DHelix 미구현
3. **Performance** -- Ink re-render 문제가 대형 세션에서 체감
4. **Agent switching** -- Multi-agent 시대에 tab UI 없음
5. **GUI companion** -- OpenCode는 Desktop+Web+App 보유

### 2.3 2026 Industry Trends

```
[필수 기능]           [차별화 기능]          [미래 방향]
- Diff-first output   - Session forking     - Voice-first interaction
- Job/approval panels  - Audio notification  - Spatial computing TUI
- Background visibility- Image rendering     - AI-generated UI
- Tab-based agents     - Web dashboard       - Cross-device sync
- IDE agent combo      - Plugin marketplace  - Collaborative editing
```

---

## 3. CLI Improvements

### 3.A Shell Layout Abstraction

**목표:** transcript-centric flat layout -> 구조화된 shell layout system

#### 3.A.1 `ShellLayout` Component Architecture

```
+------------------------------------------------------+
|  [Header Bar]  DHelix Code v0.5  |  model  |  tokens |  <- HeaderBar
+------------------------------------------------------+
|                                                      |
|  [Scrollable Transcript Region]                      |  <- TranscriptFrame
|    - MessageList (virtualized)                       |
|    - ToolCallBlock (collapsible)                     |
|    - StreamingMessage                                |
|    - ActivityFeed                                    |
|                                                      |
+------------------------------------------------------+
|  [Bottom Float]  task progress | agent status         |  <- BottomFloat
+------------------------------------------------------+
|  [Sticky Prompt]  > _                                |  <- PromptFrame
+------------------------------------------------------+
|  [Footer Bar]  mode | perms | branch | mcp | health  |  <- FooterBar
+------------------------------------------------------+

[Overlay Layer]  SlashCommandMenu, Suggestions          <- OverlayPortal
[Modal Layer]   PermissionPrompt, Confirmations         <- ModalPortal
```

#### 3.A.2 Implementation Plan

```typescript
// src/cli/layout/ShellLayout.tsx
interface ShellLayoutSlots {
  readonly header?: React.ReactNode;
  readonly transcript: React.ReactNode;
  readonly bottomFloat?: React.ReactNode;
  readonly prompt: React.ReactNode;
  readonly footer?: React.ReactNode;
}

interface ShellLayoutState {
  readonly transcriptScrollOffset: number;
  readonly isAtBottom: boolean;
  readonly overlayStack: readonly OverlayEntry[];
  readonly modalStack: readonly ModalEntry[];
  readonly focusZone: "transcript" | "prompt" | "overlay" | "modal";
}
```

**핵심 원칙:**

- Layout 관심사를 프롬프트 컴포넌트에서 완전 분리
- 각 slot은 독립적으로 re-render 가능 (React.memo boundary)
- Overlay/Modal은 별도 portal context로 관리
- Focus zone 전환은 키보드 단축키로 제어

#### 3.A.3 Deliverables

| Task                                     | Effort | Priority |
| ---------------------------------------- | ------ | -------- |
| `ShellLayout` container component        | 3d     | P0       |
| `TranscriptFrame` with scroll management | 2d     | P0       |
| `PromptFrame` sticky positioning         | 1d     | P0       |
| `FooterBar` with navigation state        | 2d     | P0       |
| `OverlayPortal` context + renderer       | 2d     | P1       |
| `ModalPortal` context + renderer         | 1d     | P1       |
| `HeaderBar` optional status surface      | 1d     | P2       |
| `BottomFloat` task/agent status slot     | 1d     | P1       |
| Layout responsive breakpoints            | 2d     | P2       |
| Migrate `App.tsx` to `ShellLayout`       | 3d     | P0       |

### 3.B Diff Viewer with Syntax-Aware Rendering

**목표:** plain text file_edit output -> code-review grade diff viewer

#### 3.B.1 Diff Rendering Modes

```
[Mode 1: Inline Diff]
  src/agent/loop.ts
  L42  - const timeout = 5000;
  L42  + const timeout = getTimeout(config);
  L43    const controller = new AbortController();

[Mode 2: Side-by-Side Diff]
  ┌─── before ──────────┬─── after ───────────┐
  │ const timeout = 5000 │ const timeout =     │
  │                      │   getTimeout(config) │
  └──────────────────────┴──────────────────────┘

[Mode 3: Unified Diff with Context]
  @@ -40,5 +40,5 @@ class AgentLoop {
     const signal = controller.signal;
  -  const timeout = 5000;
  +  const timeout = getTimeout(config);
     const controller = new AbortController();

[Mode 4: Hunk Summary]
  ┌ src/agent/loop.ts  (+3 -1)  2 hunks
  │  L42: timeout → configurable
  │  L88: add error recovery
  └ [Enter to expand] [A to apply] [R to reject]
```

#### 3.B.2 Technical Stack

- **Diff engine:** `diff` npm package (Myers algorithm)
- **Syntax highlighting:** Shiki (이미 사용 중) -- ANSI output mode
- **Line numbering:** Gutter + relative offset
- **Navigation:** `j/k` hunk navigation, `n/p` file navigation
- **Action:** `a` apply, `r` reject, `e` edit, `s` skip

#### 3.B.3 `DiffViewer` Component

```typescript
// src/cli/components/DiffViewer.tsx
interface DiffViewerProps {
  readonly filePath: string;
  readonly before: string;
  readonly after: string;
  readonly mode: "inline" | "side-by-side" | "unified" | "hunk-summary";
  readonly language?: string;
  readonly onApply?: () => void;
  readonly onReject?: () => void;
  readonly onEdit?: (editedContent: string) => void;
}
```

#### 3.B.4 Integration Points

1. **`file_edit` tool output** -- 기본 diff 표시로 전환
2. **`file_write` tool output** -- 새 파일 생성 시 전체 내용 하이라이팅
3. **Permission prompt** -- diff preview 포함하여 "what will change" 표시
4. **Agent output** -- code block 내 diff 자동 감지 및 렌더링
5. **`safe_rename` LSP tool** -- 영향 받는 파일들의 변경 요약

| Task                               | Effort | Priority |
| ---------------------------------- | ------ | -------- |
| Diff engine integration            | 2d     | P0       |
| Inline diff renderer               | 3d     | P0       |
| Shiki syntax highlighting for diff | 2d     | P0       |
| Side-by-side mode                  | 2d     | P1       |
| Hunk summary mode                  | 1d     | P1       |
| Keyboard navigation (j/k/n/p)      | 1d     | P0       |
| Apply/reject actions               | 1d     | P0       |
| Permission prompt diff preview     | 2d     | P1       |
| Diff mode toggle keybinding        | 0.5d   | P1       |

### 3.C Job/Task/Approval Panels

**목표:** background work를 transparent operator surface로 노출

#### 3.C.1 Job Panel

```
╭─ Jobs ──────────────────────────────────────────╮
│ ● [#1] refactor auth module       ██████░░ 75%  │
│   └─ 3 files modified, 1 pending approval       │
│ ● [#2] write unit tests           ████████ done  │
│   └─ 12 tests passed, 89% coverage              │
│ ○ [#3] update documentation       queued         │
│   └─ waiting for #1 completion                   │
│ ✗ [#4] deploy staging             failed         │
│   └─ npm ERR! Missing peer dep    [R]etry        │
╰─────────────────── 3 active  1 failed ──────────╯
```

#### 3.C.2 Approval Queue Panel

```
╭─ Approvals (2 pending) ────────────────────────╮
│ [1] file_write src/auth/handler.ts              │
│     +42 -8 lines | 3 functions modified         │
│     [Y]es [N]o [D]iff [E]dit                    │
│                                                  │
│ [2] bash_exec: npm install jsonwebtoken         │
│     New dependency: jsonwebtoken@9.0.2           │
│     [Y]es [N]o [I]nspect                        │
╰─────────────────────────────────────────────────╯
```

#### 3.C.3 Agent/Teammate Panel

```
╭─ Agents ────────────────────────────────────────╮
│ ★ main         claude-opus-4    active  ctx:45K  │
│   ├─ worker-1  claude-sonnet-4  running test...  │
│   ├─ worker-2  claude-sonnet-4  idle             │
│   └─ worker-3  claude-haiku-4   done   (2m ago)  │
│                                                   │
│ [Tab] switch  [Enter] view  [K] kill             │
╰──────────────────────────────────────────────────╯
```

#### 3.C.4 Panel Navigation

- **`Ctrl+J`** -- Toggle Job panel
- **`Ctrl+A`** -- Toggle Approval queue
- **`Ctrl+T`** -- Toggle Agent/Teammate panel
- **`Ctrl+H`** -- Toggle Health/Runtime panel
- **`Esc`** -- Close active panel, return to prompt
- **`Tab`** -- Cycle between visible panels

| Task                        | Effort | Priority |
| --------------------------- | ------ | -------- |
| Panel container abstraction | 2d     | P0       |
| Job panel component         | 3d     | P0       |
| Approval queue panel        | 2d     | P0       |
| Agent/teammate panel        | 2d     | P0       |
| Runtime health panel        | 1d     | P1       |
| Panel navigation system     | 2d     | P0       |
| Keybinding registration     | 1d     | P0       |
| Panel state management      | 2d     | P0       |
| Attach/detach semantics     | 2d     | P1       |

### 3.D Agent Switching UI (Tab-Based)

**목표:** Multi-agent workflow에서 agent 간 원활한 전환

#### 3.D.1 Tab Bar Design

```
┌─ main ─┬─ worker-1 ─┬─ worker-2 ─┬─ + ─┐
│ ★ opus │ ● sonnet   │ ○ sonnet   │     │
└────────┴────────────┴────────────┴─────┘
```

- `★` = 현재 포커스 agent
- `●` = running (output streaming)
- `○` = idle
- `✗` = errored
- `◌` = queued

#### 3.D.2 Switching Mechanics

```
[Alt+1..9]     -- Switch to agent by index
[Alt+Left/Right] -- Cycle agents
[Alt+N]        -- New agent tab (spawn subagent)
[Alt+W]        -- Close agent tab
[Alt+M]        -- Merge agent result into main
```

#### 3.D.3 Agent Context Isolation

각 tab은 독립적 context를 유지:

- 자체 transcript history
- 자체 working directory
- 자체 tool permission state
- 자체 context window usage meter
- 공유: project config, MCP connections, LSP instances

#### 3.D.4 Implementation

```typescript
// src/cli/state/AgentTabManager.ts
interface AgentTab {
  readonly id: string;
  readonly label: string;
  readonly model: string;
  readonly status: "active" | "running" | "idle" | "error" | "queued";
  readonly contextUsage: { used: number; total: number };
  readonly transcriptRef: TranscriptHandle;
}

interface AgentTabState {
  readonly tabs: readonly AgentTab[];
  readonly activeTabId: string;
  readonly maxTabs: number; // default: 8
}
```

| Task                         | Effort | Priority |
| ---------------------------- | ------ | -------- |
| `AgentTabManager` state      | 2d     | P1       |
| Tab bar component            | 2d     | P1       |
| Tab switching keybindings    | 1d     | P1       |
| Per-tab transcript isolation | 3d     | P1       |
| Agent spawn from tab         | 2d     | P2       |
| Tab merge semantics          | 2d     | P2       |
| Tab status indicators        | 1d     | P1       |

### 3.E Performance Optimization

**목표:** 매 키스트로크 re-render 제거, 대형 세션 성능 보장

#### 3.E.1 Current Performance Problems

1. **Keystroke re-render** -- UserInput 변경이 전체 App tree re-render 유발
2. **Large transcript** -- 1000+ messages에서 scroll lag
3. **ToolCallBlock** -- 각 tool call이 개별 렌더, 100+ calls에서 jank
4. **Shiki highlighting** -- 동기 처리로 큰 코드 블록에서 blocking
5. **StatusBar** -- 1초 간격 폴링이 불필요한 re-render 유발

#### 3.E.2 Optimization Strategy

**Layer 1: React Optimization (즉시 적용 가능)**

```typescript
// 1. React.memo on all leaf components
const MessageItem = React.memo(({ message }: Props) => {
  // Only re-render when message content changes
});

// 2. useMemo for expensive computations
const highlightedCode = useMemo(() => highlightWithShiki(code, language), [code, language]);

// 3. useCallback for stable references
const handleSubmit = useCallback(
  (input: string) => {
    agent.send(input);
  },
  [agent],
);
```

**Layer 2: Virtualization (중기)**

```typescript
// src/cli/components/VirtualizedTranscript.tsx
// Only render visible messages + buffer
interface VirtualizedTranscriptProps {
  readonly messages: readonly Message[];
  readonly viewportHeight: number;
  readonly bufferSize: number; // default: 20 messages above/below
  readonly estimateHeight: (msg: Message) => number;
}
```

- `ink-virtual-list` 또는 custom implementation
- Viewport 내 메시지만 렌더
- 스크롤 시 buffer zone 활용
- 고정 높이 추정 + 실측 보정

**Layer 3: Async Rendering (장기)**

- Shiki highlighting을 worker thread로 이동
- 코드 블록 placeholder -> highlight 완료 시 swap
- Tool result grouping -- 연속 tool calls를 단일 "batch" block으로

#### 3.E.3 Performance Targets

| Metric                  | Current         | Target         | Method                 |
| ----------------------- | --------------- | -------------- | ---------------------- |
| Keystroke latency       | ~50ms           | <16ms          | Input isolation, memo  |
| 1000-msg scroll         | Laggy (~200ms)  | Smooth (<33ms) | Virtualization         |
| Large code block render | ~100ms blocking | <16ms async    | Worker Shiki           |
| Memory (10K messages)   | ~500MB          | <150MB         | Virtualization + GC    |
| Initial render          | ~300ms          | <100ms         | Lazy component loading |

| Task                              | Effort | Priority |
| --------------------------------- | ------ | -------- |
| React.memo on all leaf components | 2d     | P0       |
| Input state isolation             | 1d     | P0       |
| useMemo for Shiki highlighting    | 1d     | P0       |
| StatusBar polling optimization    | 0.5d   | P0       |
| VirtualizedTranscript component   | 4d     | P1       |
| Async Shiki worker                | 3d     | P1       |
| Tool call batch grouping          | 2d     | P2       |
| Performance monitoring hooks      | 1d     | P1       |
| Benchmark test suite              | 2d     | P1       |

### 3.F File Tree Browser Component

**목표:** 프로젝트 구조를 터미널 내에서 탐색 가능

#### 3.F.1 File Tree Design

```
╭─ Files ─────────────────────────────────────────╮
│ ▼ src/                                           │
│   ▼ cli/                                         │
│     ▶ components/           (22 files)           │
│     ▶ hooks/                (8 files)            │
│     ▶ layout/               (new)                │
│       App.tsx               4.2K  modified       │
│   ▼ core/                                        │
│       agent-loop.ts         12K   modified       │
│       context-manager.ts    8.5K                 │
│   ▶ tools/                  (23 tools)           │
│   ▶ utils/                                       │
│ ▶ test/                                          │
│   package.json              2.1K                 │
│   tsconfig.json             0.8K                 │
╰── 156 files | 23 modified | .gitignore active ──╯
```

#### 3.F.2 Features

- **Git status integration** -- modified/added/deleted 표시
- **Collapse/Expand** -- 디렉토리 토글
- **Quick open** -- fuzzy search (`Ctrl+P`)
- **File preview** -- Enter로 파일 내용 side pane에 표시
- **Context actions** -- `file_read`, `file_edit` 도구를 파일에서 직접 실행
- **Filter** -- `.gitignore` 준수, 숨김 파일 토글

#### 3.F.3 Navigation

```
[Ctrl+E]       -- Toggle file tree panel
[j/k]          -- Navigate up/down
[Enter]        -- Expand directory / preview file
[Space]        -- Select file (multi-select)
[/]            -- Search within tree
[Ctrl+P]       -- Fuzzy file search (global)
[g]            -- Go to file by path
```

| Task                    | Effort | Priority |
| ----------------------- | ------ | -------- |
| File tree data model    | 2d     | P2       |
| Tree renderer component | 3d     | P2       |
| Git status integration  | 2d     | P2       |
| Keyboard navigation     | 1d     | P2       |
| Fuzzy search (`Ctrl+P`) | 2d     | P2       |
| File preview pane       | 2d     | P3       |
| Context actions menu    | 1d     | P3       |

---

## 4. Theming and Visual Polish

### 4.1 Premium Color Palette (Double Helix Brand)

현재 `src/cli/renderer/theme.ts`의 ThemeColors를 확장.

#### 4.1.1 Extended Color Token System

```typescript
// theme.ts 확장안
interface ExtendedThemeColors extends ThemeColors {
  // Semantic colors (기존)
  readonly primary: string; // #00BCD4 -- agent animation, emphasis
  readonly success: string; // #00E5FF -- completion, assistant
  readonly border: string; // #0097A7 -- borders, muted accents

  // NEW: Surface colors
  readonly surfacePrimary: string; // Panel backgrounds
  readonly surfaceSecondary: string; // Nested panel backgrounds
  readonly surfaceElevated: string; // Overlay/modal backgrounds

  // NEW: Interactive colors
  readonly focusRing: string; // Keyboard focus indicator
  readonly hoverBg: string; // Selection hover
  readonly selectedBg: string; // Active selection
  readonly pressedBg: string; // Button press

  // NEW: Diff colors
  readonly diffAdded: string; // Green tinted
  readonly diffRemoved: string; // Red tinted
  readonly diffChanged: string; // Yellow tinted
  readonly diffContext: string; // Muted

  // NEW: Status colors
  readonly statusRunning: string; // Animated cyan
  readonly statusQueued: string; // Dim gray
  readonly statusDone: string; // Bright green
  readonly statusFailed: string; // Bright red
  readonly statusIdle: string; // Dim cyan

  // NEW: Typography emphasis
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textTertiary: string;
  readonly textInverse: string;
}
```

#### 4.1.2 Dark Theme Extended Palette

```typescript
const darkThemeExtended: ExtendedTheme = {
  name: "dark",
  colors: {
    // Core Double Helix
    primary: "#00BCD4",
    success: "#00E5FF",
    border: "#0097A7",
    warning: "#FFB300",
    error: "#FF5252",

    // Surfaces
    surfacePrimary: "#1A1A2E", // Deep navy
    surfaceSecondary: "#16213E", // Slightly lighter
    surfaceElevated: "#0F3460", // Panel overlay

    // Interactive
    focusRing: "#00E5FF",
    hoverBg: "#1A3A4A",
    selectedBg: "#0D4F5A",
    pressedBg: "#0097A7",

    // Diff
    diffAdded: "#1B5E20",
    diffRemoved: "#B71C1C",
    diffChanged: "#F57F17",
    diffContext: "#37474F",

    // Status
    statusRunning: "#00E5FF",
    statusQueued: "#546E7A",
    statusDone: "#69F0AE",
    statusFailed: "#FF5252",
    statusIdle: "#0097A7",

    // Typography
    textPrimary: "#ECEFF1",
    textSecondary: "#90A4AE",
    textTertiary: "#546E7A",
    textInverse: "#1A1A2E",
  },
};
```

#### 4.1.3 Light Theme Extended Palette

```typescript
const lightThemeExtended: ExtendedTheme = {
  name: "light",
  colors: {
    primary: "#0097A7",
    success: "#00796B",
    border: "#B2EBF2",
    warning: "#F57F17",
    error: "#D32F2F",

    surfacePrimary: "#FAFAFA",
    surfaceSecondary: "#F5F5F5",
    surfaceElevated: "#FFFFFF",

    focusRing: "#0097A7",
    hoverBg: "#E0F7FA",
    selectedBg: "#B2EBF2",
    pressedBg: "#80DEEA",

    diffAdded: "#E8F5E9",
    diffRemoved: "#FFEBEE",
    diffChanged: "#FFF8E1",
    diffContext: "#ECEFF1",

    statusRunning: "#0097A7",
    statusQueued: "#BDBDBD",
    statusDone: "#2E7D32",
    statusFailed: "#D32F2F",
    statusIdle: "#B2EBF2",

    textPrimary: "#212121",
    textSecondary: "#616161",
    textTertiary: "#9E9E9E",
    textInverse: "#FAFAFA",
  },
};
```

### 4.2 Typography and Spacing

#### 4.2.1 Terminal Typography Scale

```
Title:     Bold + Primary color + CAPS      (session header, panel titles)
Heading:   Bold + Text color                 (section headers)
Body:      Regular + Text color              (messages, descriptions)
Caption:   Regular + Muted color             (timestamps, metadata)
Code:      Code color + background           (inline code)
Label:     Bold + Secondary color            (key-value labels)
Badge:     Inverse + Status color            (status badges)
```

#### 4.2.2 Spacing System

```
xs:  1 char   -- inline element gaps
sm:  2 chars  -- between related items
md:  1 line   -- between sections
lg:  2 lines  -- between major sections
```

#### 4.2.3 Box Drawing Characters

```
Panel:    ╭─╮ ╰─╯ │   -- rounded corners (friendly)
Table:    ┌─┐ └─┘ │   -- sharp corners (data)
Tree:     ├── └──       -- tree structure
Divider:  ─────────     -- horizontal separator
Progress: █░            -- progress bar
Status:   ● ○ ★ ✗ ◌    -- status indicators
Arrow:    → ← ↑ ↓      -- navigation hints
```

### 4.3 Animation and Transition Effects

#### 4.3.1 Spinner Variants

```typescript
// src/cli/components/Spinner.tsx 확장
type SpinnerVariant =
  | "dots" // ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏  (default)
  | "helix" // 🧬 DNA helix animation (brand)
  | "bar" // ▏▎▍▌▋▊▉█▊▋▌▍▎▏  (progress feel)
  | "pulse" // ◉ ◎ ○ ◎ ◉  (subtle)
  | "arrows" // ← ↖ ↑ ↗ → ↘ ↓ ↙  (directional)
  | "wave"; // ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁  (audio-like)
```

#### 4.3.2 Progress Bar Styles

```
Standard:  ████████░░░░░░░░  52%
Gradient:  ██████▓▓▒▒░░░░░░  52%
Minimal:   ───────●────────  52%
Helix:     ╠═══════╬════════╣  52%  (brand)
```

#### 4.3.3 Transition Effects

- **Panel open/close** -- 1-line slide (100ms)
- **Tab switch** -- instant swap, no animation (latency 우선)
- **Message appear** -- fade-in via color (dim -> full, 50ms)
- **Error flash** -- red background pulse (200ms)
- **Success indicator** -- green checkmark + brief highlight (300ms)
- **Thinking indicator** -- pulsing cyan dot with token count

### 4.4 Status Indicators and Progress Bars

#### 4.4.1 Context Window Meter

```
Context: ████████████░░░░  78% (156K / 200K tokens)
         ^^^^^^^^^^^        ^^^^
         used (gradient)    remaining (dim)

Warning at 80%:  ████████████████  80% ⚠ approaching limit
Critical at 95%: ████████████████  95% 🔴 compaction imminent
```

#### 4.4.2 Model Status Badge

```
[opus-4 ● 156K/200K] [sonnet-4 ○ idle] [haiku-4 ● 23K/200K]
```

#### 4.4.3 MCP Connection Status

```
MCP: ● github (3 tools) │ ● postgres (5 tools) │ ✗ slack (disconnected)
```

---

## 5. GUI Companion Plan

### 5.1 Web Dashboard Architecture

**결정:** Electron/Desktop이 아닌 Web-first approach.

- 이유: Cross-platform 즉시 지원, 빌드 복잡도 최소화, remote session 자연 지원
- 기술: Next.js 15 + React 19 + TailwindCSS v4 + WebSocket

#### 5.1.1 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Web Dashboard                         │
│  (Next.js 15 + React 19 + Tailwind v4)                  │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Session  │ │  Agent   │ │   MCP    │ │ Artifact │  │
│  │ Explorer │ │ Monitor  │ │ Manager  │ │ Browser  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       │             │            │             │         │
│  ┌────┴─────────────┴────────────┴─────────────┴─────┐  │
│  │              WebSocket Client Layer                │  │
│  └────────────────────────┬──────────────────────────┘  │
└───────────────────────────┼──────────────────────────────┘
                            │ ws://localhost:PORT
┌───────────────────────────┼──────────────────────────────┐
│              DHelix Dashboard Server                      │
│  ┌────────────────────────┴──────────────────────────┐  │
│  │              WebSocket Server (ws)                 │  │
│  └────────────────────────┬──────────────────────────┘  │
│                           │                              │
│  ┌──────────┐ ┌──────────┴──────────┐ ┌──────────────┐ │
│  │ Session  │ │  Agent Event Bus    │ │   MCP Proxy  │ │
│  │ Store    │ │  (EventEmitter)     │ │              │ │
│  └──────────┘ └─────────────────────┘ └──────────────┘ │
│                                                          │
│  Embedded in DHelix CLI process (--dashboard flag)       │
└──────────────────────────────────────────────────────────┘
```

#### 5.1.2 Activation

```bash
# CLI에서 대시보드 서버 시작
dhelix --dashboard           # localhost:3847 (default port)
dhelix --dashboard --port 8080

# 또는 실행 중 slash command
/dashboard                   # 브라우저 자동 열기
/dashboard --detach          # 백그라운드로 유지
```

### 5.2 Session Explorer

#### 5.2.1 Features

- **Session list** -- 모든 과거 세션 목록 (날짜, 프로젝트, duration, token usage)
- **Session timeline** -- 각 세션의 turn-by-turn timeline view
- **Session search** -- Full-text search across all sessions
- **Session fork** -- 과거 세션의 특정 지점에서 분기
- **Session compare** -- 두 세션의 diff view
- **Session export** -- Markdown, JSON, HTML export

#### 5.2.2 Session Card Design

```
┌──────────────────────────────────────────────────┐
│ 🧬 refactor auth module                2h 34m   │
│ ~/projects/myapp                       Apr 3     │
│                                                   │
│ Tokens: 145K input / 32K output                  │
│ Tools:  file_edit (23) bash_exec (8) grep (15)   │
│ Model:  claude-opus-4 → claude-sonnet-4          │
│                                                   │
│ [Resume]  [Fork]  [Export]  [Archive]            │
└──────────────────────────────────────────────────┘
```

### 5.3 MCP Server Manager

#### 5.3.1 Features

- **Server inventory** -- 등록된 모든 MCP 서버 목록 (scope: global/project/session)
- **Connection status** -- 실시간 연결 상태 모니터링
- **Tool catalog** -- 각 서버가 제공하는 도구 목록 + 사용 통계
- **Configuration editor** -- MCP 서버 설정 GUI 편집
- **Log viewer** -- MCP 통신 로그 실시간 표시
- **Server discovery** -- npm registry에서 MCP 서버 검색 및 설치

#### 5.3.2 MCP Server Card

```
┌──────────────────────────────────────────────────┐
│ ● github-mcp                    scope: global    │
│   Transport: stdio                               │
│   Tools: 12 (3 frequently used)                  │
│   Last used: 5 min ago                           │
│                                                   │
│   Most used: create_pr (45), list_issues (32)    │
│                                                   │
│   [Configure]  [Restart]  [Logs]  [Remove]       │
└──────────────────────────────────────────────────┘
```

### 5.4 Artifact Browser

#### 5.4.1 Features

- **Generated files** -- 세션에서 생성/수정된 모든 파일 목록
- **Diff viewer** -- 각 파일의 변경 이력 (Web-grade syntax highlighting)
- **Code review** -- 변경사항 review + comment + approve/reject
- **Artifact timeline** -- 시간순 변경 이력
- **Dependency graph** -- 변경된 파일 간 의존성 시각화
- **Undo/Redo** -- 특정 변경을 되돌리기

### 5.5 Job Monitor

#### 5.5.1 Features

- **Real-time job list** -- WebSocket으로 실시간 업데이트
- **Job detail view** -- 각 job의 상세 로그 + output
- **Agent graph** -- main agent -> subagent 관계 시각화
- **Resource usage** -- token consumption, time, API cost 추적
- **Approval workflow** -- Web에서 직접 approve/reject (CLI 대리)
- **Notification** -- Browser notification for job completion/failure

#### 5.5.2 Dashboard Layout

```
┌────────────────────────────────────────────────────────────┐
│  DHelix Dashboard                          [Settings] [?]  │
├──────────┬─────────────────────────────────────────────────┤
│          │                                                  │
│ Sessions │  Active Session: refactor auth module            │
│ ├ Today  │                                                  │
│ │ └ auth │  ┌─ Agents ──────────────────────────────────┐  │
│ │ └ test │  │ ★ main (opus-4) ── worker-1 (sonnet-4)   │  │
│ ├ Apr 2  │  │                └── worker-2 (sonnet-4)    │  │
│ │ └ feat │  └───────────────────────────────────────────┘  │
│          │                                                  │
│ Jobs     │  ┌─ Output ──────────────────────────────────┐  │
│ ├ Active │  │ [Transcript] [Diff] [Artifacts] [Logs]    │  │
│ │ └ #1   │  │                                           │  │
│ │ └ #2   │  │ src/auth/handler.ts                       │  │
│ ├ Done   │  │ @@ -42,5 +42,8 @@                        │  │
│ │ └ #3   │  │ - const timeout = 5000;                   │  │
│          │  │ + const timeout = getTimeout(config);      │  │
│ MCP      │  │                                           │  │
│ ├ github │  └───────────────────────────────────────────┘  │
│ ├ db     │                                                  │
│          │  ┌─ Approvals ────────────┐                     │
│          │  │ 2 pending              │                     │
│          │  │ [Approve All] [Review] │                     │
│          │  └────────────────────────┘                     │
└──────────┴─────────────────────────────────────────────────┘
```

### 5.6 Implementation Phases

| Phase   | Scope                               | Effort | Target |
| ------- | ----------------------------------- | ------ | ------ |
| Phase 1 | Dashboard server (WebSocket + REST) | 2w     | v0.7.0 |
| Phase 2 | Session explorer + Job monitor      | 2w     | v0.7.0 |
| Phase 3 | Artifact browser + Diff viewer      | 2w     | v0.7.0 |
| Phase 4 | MCP server manager                  | 1w     | v0.7.0 |
| Phase 5 | Approval workflow + notifications   | 1w     | v0.7.0 |
| Phase 6 | Polish + responsive + dark mode     | 1w     | v0.7.0 |

---

## 6. IDE Integration Enhancement

### 6.1 VSCode Extension Improvements

현재 `vscode-extension/` 디렉토리에 기본 extension 존재.
IDE bridge: `src/lsp/ide-bridge.ts`, `src/lsp/ide-bridge-manager.ts`, `src/lsp/ide-bridge-protocol.ts`

#### 6.1.1 Current Capabilities (As-Is)

- 기본 LSP 연결 (goto_definition, find_references, get_type_info, safe_rename)
- On-demand server lifecycle (5분 idle shutdown)
- IDE bridge protocol 정의

#### 6.1.2 Target Capabilities (To-Be)

| Feature                 | Priority | Description                                              |
| ----------------------- | -------- | -------------------------------------------------------- |
| Selection sharing       | P0       | 에디터 선택 영역을 agent context로 전달                  |
| Inline diff application | P0       | Agent가 제안한 변경을 에디터에서 직접 apply/reject       |
| Diagnostics forwarding  | P1       | 에디터 에러/경고를 agent가 자동 인식                     |
| Active file context     | P0       | 현재 열린 파일을 agent context에 자동 포함               |
| Task/Agent sidebar      | P1       | VSCode sidebar에서 agent 상태 + job 목록                 |
| Inline chat             | P2       | 에디터 내 inline agent 대화                              |
| Code lens               | P1       | "Ask DHelix" code lens on functions/classes              |
| Terminal integration    | P0       | VSCode terminal에서 `dhelix` 실행 시 extension 자동 연결 |

### 6.2 Selection Sharing Protocol

#### 6.2.1 IDE -> CLI Flow

```typescript
// IDE Bridge Protocol 확장
interface SelectionContext {
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly selectedText: string;
  readonly language: string;
  readonly diagnostics: readonly Diagnostic[];
}

// VSCode extension -> WebSocket -> CLI
// Agent receives as implicit context in system prompt
```

#### 6.2.2 CLI -> IDE Flow

```typescript
// Agent proposes change
interface ProposedChange {
  readonly filePath: string;
  readonly hunks: readonly DiffHunk[];
  readonly description: string;
}

// CLI -> WebSocket -> VSCode extension
// Extension shows inline diff with accept/reject buttons
```

### 6.3 Inline Diff Application

#### 6.3.1 Workflow

```
1. Agent generates file_edit
2. CLI sends ProposedChange to IDE via bridge
3. VSCode shows inline diff decoration:
   - Green: added lines
   - Red: removed lines
   - Yellow: modified lines
4. User clicks [Accept] / [Reject] per hunk
5. IDE sends ApplyResult back to CLI
6. Agent acknowledges
```

### 6.4 Task/Agent Views in IDE

#### 6.4.1 DHelix Sidebar Panel

```
╭─ DHelix Code ──────────────╮
│                              │
│ Session: refactor auth       │
│ Model: claude-opus-4         │
│ Context: 145K / 200K        │
│                              │
│ ▼ Agents                     │
│   ★ main        running      │
│     worker-1    idle         │
│     worker-2    done         │
│                              │
│ ▼ Jobs                       │
│   #1 refactor   75% ████░   │
│   #2 tests      done ✓      │
│                              │
│ ▼ Pending Approvals          │
│   file_write handler.ts     │
│   bash_exec npm install     │
│                              │
│ [Open Dashboard] [Settings] │
╰──────────────────────────────╯
```

#### 6.4.2 Code Lens Integration

```typescript
// 함수 위에 code lens 표시
// ──── Ask DHelix | Explain | Refactor | Test ────
async function handleAuth(req: Request): Promise<Response> {
  // ...
}
```

### 6.5 IDE Integration Deliverables

| Task                             | Effort | Priority |
| -------------------------------- | ------ | -------- |
| Selection sharing (IDE -> CLI)   | 3d     | P0       |
| Active file context auto-include | 2d     | P0       |
| Terminal auto-connect            | 2d     | P0       |
| Inline diff decoration           | 4d     | P0       |
| Hunk-level accept/reject UI      | 3d     | P0       |
| Diagnostics forwarding           | 2d     | P1       |
| DHelix sidebar panel             | 3d     | P1       |
| Code lens provider               | 2d     | P1       |
| Inline chat prototype            | 5d     | P2       |
| JetBrains plugin (initial)       | 2w     | P3       |
| Neovim plugin (initial)          | 1w     | P3       |

---

## 7. Accessibility

### 7.1 Current State

DHelix의 접근성 지원은 거의 없음 (Rating: D).

- Screen reader 지원 없음
- 색상 대비 미검증
- Keyboard-only 사용 시 focus 추적 불완전
- 색맹 테마만 존재 (부분적 해결)

### 7.2 Accessibility Standards

**Target: WCAG 2.1 AA equivalent** (터미널 환경 적응)

#### 7.2.1 Color and Contrast

| Requirement                  | Implementation                            |
| ---------------------------- | ----------------------------------------- |
| 4.5:1 minimum contrast ratio | 모든 text-background 조합 검증            |
| Color-only 정보 전달 금지    | Status에 항상 text label 또는 icon 병행   |
| 색맹 테마 개선               | Red-green 대신 blue-orange 대비 사용      |
| High contrast mode           | 추가 테마: `high-contrast` (WCAG AAA 7:1) |

#### 7.2.2 Keyboard Navigation

| Requirement                  | Implementation                        |
| ---------------------------- | ------------------------------------- |
| 모든 기능 keyboard 접근 가능 | Tab order 정의, focus trap for modals |
| Focus indicator 항상 visible | `focusRing` 토큰으로 일관된 표시      |
| Skip navigation              | 패널 간 빠른 이동 (`Ctrl+1..9`)       |
| Keyboard shortcut 문서화     | `/shortcuts` command, `?` overlay     |

#### 7.2.3 Screen Reader Support

| Requirement               | Implementation                                           |
| ------------------------- | -------------------------------------------------------- |
| Semantic structure        | ARIA-like role annotations via terminal escape sequences |
| Live region announcements | 새 메시지, 상태 변경 시 음성 알림 텍스트                 |
| Alternative text          | ASCII art/box drawing에 대한 text description            |
| Reduced motion            | 애니메이션 비활성화 옵션 (`--reduce-motion`)             |

#### 7.2.4 Audio Feedback

```
[Option] Audio notifications
  - Agent response complete:     subtle chime
  - Job completed:               success tone
  - Job failed:                  alert tone
  - Approval required:           attention tone
  - Context warning (80%+):      warning tone

Enable: dhelix --audio  or  DHELIX_AUDIO=1
```

### 7.3 Accessibility Deliverables

| Task                           | Effort | Priority |
| ------------------------------ | ------ | -------- |
| Contrast ratio audit + fix     | 2d     | P1       |
| Color-only information audit   | 1d     | P1       |
| High contrast theme            | 1d     | P1       |
| Keyboard focus tracking        | 2d     | P1       |
| Focus trap for modals/overlays | 1d     | P1       |
| Screen reader live regions     | 3d     | P2       |
| `--reduce-motion` flag         | 1d     | P2       |
| Audio notification system      | 2d     | P2       |
| Accessibility test suite       | 2d     | P2       |
| `/shortcuts` help overlay      | 1d     | P1       |

---

## 8. Success Metrics

### 8.1 Quantitative Metrics

| Metric                     | Current | Phase 1 Target | Phase 2 Target | Measurement                   |
| -------------------------- | ------- | -------------- | -------------- | ----------------------------- |
| **UX Quality Score**       | 78%     | 88%            | 95%            | Internal heuristic evaluation |
| **Keystroke latency**      | ~50ms   | <16ms          | <10ms          | Performance benchmark         |
| **1000-msg scroll**        | ~200ms  | <33ms          | <16ms          | FPS measurement               |
| **Initial render**         | ~300ms  | <150ms         | <100ms         | Time-to-interactive           |
| **Component count**        | 22      | 35             | 45             | Feature coverage              |
| **Diff viewer usage**      | 0%      | 60%            | 90%            | Telemetry (opt-in)            |
| **IDE integration active** | ~5%     | 30%            | 60%            | Extension install rate        |
| **Dashboard adoption**     | 0%      | 15%            | 40%            | Dashboard launch rate         |
| **Accessibility score**    | D       | B              | A-             | WCAG audit                    |

### 8.2 Qualitative Metrics

| Metric                  | Evaluation Method                                       |
| ----------------------- | ------------------------------------------------------- |
| **First impression**    | 5-second test: new user의 첫 인상 survey                |
| **Trust level**         | "I understand what the agent is doing" confidence score |
| **Operator efficiency** | Task completion time comparison (before/after)          |
| **Aesthetic rating**    | Side-by-side comparison with competitors (blind test)   |
| **Learning curve**      | Time to discover and use 5 core features                |
| **Error recovery**      | Time to understand and recover from agent errors        |

### 8.3 Competitive Benchmarks

| Dimension       | OpenCode | Codex | DHelix Target |
| --------------- | -------- | ----- | ------------- |
| Visual polish   | 9/10     | 8/10  | 9/10          |
| Performance     | 8/10     | 10/10 | 9/10          |
| Feature breadth | 9/10     | 7/10  | 9/10          |
| IDE integration | 7/10     | 3/10  | 9/10          |
| GUI companion   | 8/10     | 2/10  | 8/10          |
| Accessibility   | 5/10     | 4/10  | 8/10          |
| Operator trust  | 8/10     | 7/10  | 9/10          |

---

## 9. Implementation Roadmap

### 9.1 Phase 1: Foundation (v0.5.0, 4 weeks)

**Focus:** Shell layout + Performance + Diff viewer 기초

| Week | Deliverables                                                             |
| ---- | ------------------------------------------------------------------------ |
| W1   | `ShellLayout` container, `TranscriptFrame`, `PromptFrame`                |
| W2   | React.memo optimization pass, input state isolation, StatusBar fix       |
| W3   | Inline diff renderer + Shiki integration, keyboard navigation            |
| W4   | `FooterBar` navigation, panel container abstraction, integration testing |

**Exit criteria:**

- Shell layout 마이그레이션 완료
- Keystroke latency <20ms
- Inline diff viewer 동작
- 기존 22개 컴포넌트 regression 없음

### 9.2 Phase 2: Operator Surfaces (v0.5.1, 4 weeks)

**Focus:** Panels + Agent tabs + Extended theme

| Week | Deliverables                                                     |
| ---- | ---------------------------------------------------------------- |
| W1   | Job panel, Approval queue panel                                  |
| W2   | Agent/Teammate panel, panel navigation system                    |
| W3   | Agent tab bar, tab switching, per-tab isolation                  |
| W4   | Extended color token system, contrast audit, high-contrast theme |

**Exit criteria:**

- 3개 operator panel 동작
- Agent tab switching 동작
- WCAG AA color contrast 달성
- UX score 85%+

### 9.3 Phase 3: IDE + GUI (v0.6.0-v0.7.0, 6 weeks)

**Focus:** IDE integration 강화 + Dashboard MVP

| Week | Deliverables                                                  |
| ---- | ------------------------------------------------------------- |
| W1-2 | Selection sharing, active file context, terminal auto-connect |
| W3-4 | Inline diff decoration + hunk accept/reject in VSCode         |
| W5   | Dashboard server (WebSocket), session explorer MVP            |
| W6   | Job monitor, artifact browser MVP                             |

**Exit criteria:**

- VSCode extension에서 selection -> agent 동작
- Inline diff accept/reject 동작
- Dashboard에서 세션 목록 + job 상태 확인 가능

### 9.4 Phase 4: Polish + Scale (v0.6.0-v0.7.0, 4 weeks)

**Focus:** Virtualization + File tree + MCP manager + Audio

| Week | Deliverables                                              |
| ---- | --------------------------------------------------------- |
| W1   | VirtualizedTranscript, async Shiki worker                 |
| W2   | File tree browser, fuzzy search                           |
| W3   | MCP server manager (dashboard), approval workflow (web)   |
| W4   | Audio notifications, screen reader support, reduce-motion |

**Exit criteria:**

- 10K messages smooth scroll
- File tree with git status
- MCP management via dashboard
- Accessibility score B+

---

## 10. UX Design Principles

### 10.1 Core Principles

1. **Keyboard-first remains the default** -- 모든 기능은 keyboard로 접근 가능해야 함. Mouse/GUI는 보완.
2. **GUI complements CLI; it does not replace it** -- Dashboard는 CLI의 확장이지 대체가 아님.
3. **Background work must be inspectable, not magical** -- Agent가 무엇을 하는지 항상 확인 가능해야 함.
4. **Review surfaces must reduce trust cost** -- Diff viewer, approval panel 등은 agent 신뢰도를 높이는 도구.
5. **Every new surface should correspond to a real operational problem** -- 장식적 UI 추가 금지.
6. **Performance is a feature** -- 느린 UI는 나쁜 UI. 16ms target.
7. **Progressive disclosure** -- 기본 화면은 단순하게, 필요 시 detail 확장.
8. **Consistency over novelty** -- Double Helix 브랜드 내에서 일관된 시각 언어.

### 10.2 Anti-Patterns to Avoid

- **Over-decoration** -- ASCII art, 과도한 box drawing은 noise
- **Mode confusion** -- 어떤 panel이 active인지 항상 명확해야 함
- **Hidden state** -- 중요한 상태가 보이지 않는 곳에 숨겨지면 안 됨
- **Notification spam** -- 사용자가 제어 가능한 notification level
- **Feature creep** -- 각 Phase의 exit criteria를 엄격히 준수

---

## 11. Risk Assessment

| Risk                         | Impact | Likelihood | Mitigation                                                          |
| ---------------------------- | ------ | ---------- | ------------------------------------------------------------------- |
| Ink 5.x performance ceiling  | High   | Medium     | VirtualizedTranscript + memo로 완화, 극단적 경우 blessed-react 고려 |
| Dashboard maintenance burden | Medium | High       | Dashboard를 optional feature로, core에 의존성 최소화                |
| VSCode API breaking changes  | Medium | Low        | Extension API version pinning, quarterly update cycle               |
| Theme token explosion        | Low    | Medium     | ThemeColors 인터페이스 freeze, 확장은 별도 namespace                |
| Accessibility 과소 투자      | Medium | High       | Phase 2에서 반드시 포함, skip 불가로 roadmap에 고정                 |
| Multi-agent tab state leak   | High   | Medium     | Per-tab AbortController + strict isolation boundary                 |

---

## 12. File-Level Impact Map

### 12.1 New Files

| File                                           | Purpose                           |
| ---------------------------------------------- | --------------------------------- |
| `src/cli/layout/ShellLayout.tsx`               | Shell layout container            |
| `src/cli/layout/TranscriptFrame.tsx`           | Scrollable transcript region      |
| `src/cli/layout/PromptFrame.tsx`               | Sticky prompt region              |
| `src/cli/layout/FooterBar.tsx`                 | Interactive footer navigation     |
| `src/cli/layout/OverlayPortal.tsx`             | Overlay rendering context         |
| `src/cli/layout/ModalPortal.tsx`               | Modal rendering context           |
| `src/cli/layout/BottomFloat.tsx`               | Bottom float status slot          |
| `src/cli/layout/HeaderBar.tsx`                 | Optional header status bar        |
| `src/cli/components/DiffViewer.tsx`            | Syntax-aware diff renderer        |
| `src/cli/components/DiffViewer.test.ts`        | Diff viewer tests                 |
| `src/cli/components/JobPanel.tsx`              | Job monitoring panel              |
| `src/cli/components/ApprovalPanel.tsx`         | Approval queue panel              |
| `src/cli/components/AgentPanel.tsx`            | Agent/teammate panel              |
| `src/cli/components/AgentTabBar.tsx`           | Tab-based agent switching         |
| `src/cli/components/FileTree.tsx`              | File tree browser                 |
| `src/cli/components/VirtualizedTranscript.tsx` | Virtualized message list          |
| `src/cli/components/ProgressBar.tsx`           | Progress bar variants             |
| `src/cli/components/ContextMeter.tsx`          | Context window usage meter        |
| `src/cli/state/AgentTabManager.ts`             | Agent tab state management        |
| `src/cli/state/PanelManager.ts`                | Panel visibility/navigation state |
| `src/cli/state/LayoutState.ts`                 | Shell layout state                |
| `src/dashboard/server.ts`                      | Dashboard WebSocket server        |
| `src/dashboard/routes/session.ts`              | Session API endpoints             |
| `src/dashboard/routes/job.ts`                  | Job API endpoints                 |
| `src/dashboard/routes/mcp.ts`                  | MCP management endpoints          |
| `dashboard-web/`                               | Next.js web dashboard application |
| `vscode-extension/src/selection.ts`            | Selection sharing provider        |
| `vscode-extension/src/inlineDiff.ts`           | Inline diff decoration            |
| `vscode-extension/src/sidebar.ts`              | DHelix sidebar panel              |
| `vscode-extension/src/codeLens.ts`             | Code lens provider                |

### 12.2 Modified Files

| File                                      | Changes                                                        |
| ----------------------------------------- | -------------------------------------------------------------- |
| `src/cli/App.tsx`                         | Migrate to ShellLayout, remove flat layout logic               |
| `src/cli/renderer/theme.ts`               | Extend ThemeColors with surface/interactive/diff/status tokens |
| `src/cli/components/MessageList.tsx`      | Integrate with VirtualizedTranscript                           |
| `src/cli/components/StatusBar.tsx`        | Convert to interactive FooterBar items                         |
| `src/cli/components/ToolCallBlock.tsx`    | Add collapse/expand, batch grouping                            |
| `src/cli/components/PermissionPrompt.tsx` | Add diff preview integration                                   |
| `src/cli/components/SlashCommandMenu.tsx` | Move to OverlayPortal                                          |
| `src/cli/components/StreamingMessage.tsx` | Add diff detection and rendering                               |
| `src/cli/components/Spinner.tsx`          | Add variant system (dots, helix, bar, pulse)                   |
| `src/cli/hooks/useAgentLoop.ts`           | Add agent tab context awareness                                |
| `src/lsp/ide-bridge-protocol.ts`          | Add selection sharing + inline diff protocols                  |
| `src/lsp/ide-bridge-manager.ts`           | Add IDE context forwarding                                     |
| `vscode-extension/package.json`           | Add sidebar, code lens, commands                               |
| `vscode-extension/src/extension.ts`       | Register new providers                                         |

---

## Appendix A: Keybinding Summary

### Global Keybindings

| Key         | Action                     | Context |
| ----------- | -------------------------- | ------- |
| `Esc`       | Cancel agent / Close panel | Global  |
| `Ctrl+D`    | Exit                       | Global  |
| `Shift+Tab` | Cycle permissions          | Prompt  |
| `Alt+T`     | Toggle thinking            | Prompt  |
| `Ctrl+O`    | Toggle verbose             | Global  |

### Panel Keybindings

| Key      | Action                | Context      |
| -------- | --------------------- | ------------ |
| `Ctrl+J` | Toggle Job panel      | Global       |
| `Ctrl+A` | Toggle Approval panel | Global       |
| `Ctrl+T` | Toggle Agent panel    | Global       |
| `Ctrl+H` | Toggle Health panel   | Global       |
| `Ctrl+E` | Toggle File tree      | Global       |
| `Tab`    | Cycle between panels  | Panel active |

### Agent Tab Keybindings

| Key              | Action              | Context   |
| ---------------- | ------------------- | --------- |
| `Alt+1..9`       | Switch to agent tab | Global    |
| `Alt+Left/Right` | Cycle agent tabs    | Global    |
| `Alt+N`          | New agent tab       | Global    |
| `Alt+W`          | Close agent tab     | Global    |
| `Alt+M`          | Merge agent result  | Agent tab |

### Diff Viewer Keybindings

| Key   | Action           | Context   |
| ----- | ---------------- | --------- |
| `j/k` | Navigate hunks   | Diff view |
| `n/p` | Navigate files   | Diff view |
| `a`   | Apply hunk/file  | Diff view |
| `r`   | Reject hunk/file | Diff view |
| `e`   | Edit in place    | Diff view |
| `s`   | Skip             | Diff view |
| `d`   | Toggle diff mode | Diff view |

### File Tree Keybindings

| Key      | Action             | Context   |
| -------- | ------------------ | --------- |
| `j/k`    | Navigate up/down   | File tree |
| `Enter`  | Expand/preview     | File tree |
| `Space`  | Multi-select       | File tree |
| `/`      | Search within tree | File tree |
| `Ctrl+P` | Fuzzy file search  | Global    |
| `g`      | Go to path         | File tree |

---

## Appendix B: Color Token Quick Reference

```
Double Helix Brand:
  Bright accent  #00E5FF   -- success, completion, assistant
  Primary        #00BCD4   -- agent animation, emphasis
  Dark accent    #0097A7   -- borders, muted accents

Dark Theme Surfaces:
  Primary        #1A1A2E   -- main background
  Secondary      #16213E   -- nested panels
  Elevated       #0F3460   -- overlays, modals

Diff Colors:
  Added          #1B5E20   -- green tint
  Removed        #B71C1C   -- red tint
  Changed        #F57F17   -- yellow tint

Status:
  Running        #00E5FF   -- animated cyan
  Done           #69F0AE   -- bright green
  Failed         #FF5252   -- bright red
  Idle           #0097A7   -- dim cyan
  Queued         #546E7A   -- dim gray
```

---

> **Document version:** 2.0 (complete rewrite)
> **Last updated:** 2026-04-04
> **Supersedes:** Previous 04-cli-ux-ui-and-gui-plan.md (v1.0)
> **Related:** `docs/revolution/17-shell-layout-and-ide-ux-notes.md`, `src/cli/renderer/theme.ts`
