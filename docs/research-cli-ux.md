# CLI UX/DX Patterns Research for dhelix

> Research Date: 2026-03-05
> Scope: Terminal UI, Streaming, Interaction patterns for a cross-platform AI coding assistant CLI

---

## Table of Contents

1. [Terminal UI Framework Comparison](#1-terminal-ui-framework-comparison)
2. [Streaming Text Rendering](#2-streaming-text-rendering)
3. [CLI Coding Tool UX Analysis](#3-cli-coding-tool-ux-analysis)
4. [Markdown Terminal Rendering](#4-markdown-terminal-rendering)
5. [Diff / Code Edit Visualization](#5-diff--code-edit-visualization)
6. [Progress Indicators & Spinners](#6-progress-indicators--spinners)
7. [Input UX](#7-input-ux)
8. [Keybinding Systems](#8-keybinding-systems)
9. [Session Management UX](#9-session-management-ux)
10. [Color & Styling Libraries](#10-color--styling-libraries)
11. [Syntax Highlighting](#11-syntax-highlighting)
12. [Accessibility](#12-accessibility)
13. [Windows-Specific Concerns](#13-windows-specific-concerns)
14. [Recommended Tech Stack](#14-recommended-tech-stack)
15. [UX Mockups](#15-ux-mockups)

---

## 1. Terminal UI Framework Comparison

### Framework Matrix

| Feature               | Ink (React CLI)                                              | Blessed/Neo-Blessed                  | terminal-kit   | Clack                | Enquirer              |
| --------------------- | ------------------------------------------------------------ | ------------------------------------ | -------------- | -------------------- | --------------------- |
| **Paradigm**          | React components (JSX)                                       | Widget tree (imperative)             | Low-level API  | Prompt builder       | Prompt builder        |
| **Weekly Downloads**  | ~1.7M                                                        | ~1.5M (blessed)                      | ~78K           | ~500K                | ~10M                  |
| **GitHub Stars**      | 35.4K                                                        | 11.5K                                | 3.2K           | 5K                   | 7.6K                  |
| **Maintained**        | Active                                                       | Unmaintained (neo-blessed: sporadic) | Sporadic       | Active               | Low activity          |
| **Layout Engine**     | Yoga (Flexbox)                                               | Custom box model                     | Custom         | N/A (sequential)     | N/A                   |
| **Streaming Support** | Native (React re-renders)                                    | Manual buffer management             | Manual         | No                   | No                    |
| **Windows Support**   | Good (ANSI)                                                  | Partial (ConPTY issues)              | Partial        | Good                 | Good                  |
| **macOS Support**     | Excellent                                                    | Excellent                            | Excellent      | Excellent            | Excellent             |
| **TypeScript**        | Yes                                                          | @types/blessed                       | Partial        | Yes                  | @types/enquirer       |
| **Learning Curve**    | Low (if React known)                                         | High                                 | High           | Very Low             | Low                   |
| **Bundle Size**       | ~200KB                                                       | ~800KB                               | ~600KB         | ~15KB                | ~30KB                 |
| **Real-time Updates** | Excellent (state-driven)                                     | Good (manual redraws)                | Good           | Poor                 | Poor                  |
| **Notable Users**     | GitHub Copilot CLI, Cloudflare Wrangler, Prisma, Shopify CLI | Legacy TUI apps                      | Terminal games | create-t3-app, Astro | ESLint, Webpack, pnpm |

### Recommendation: **Ink (React for CLI)**

**Why Ink is the best choice for dhelix:**

1. **React mental model**: Component-based architecture maps perfectly to a chat UI with streaming messages, tool status panels, and input areas. Developers already know React.

2. **Streaming-native**: React's state-driven re-rendering is ideal for LLM streaming. Updating state triggers minimal terminal redraws via Ink's diff-based rendering.

3. **Production-proven for AI CLIs**: GitHub Copilot CLI and multiple AI coding tools already use Ink, validating it for this exact use case.

4. **Yoga Flexbox layout**: Provides CSS-like layout capabilities (flex direction, padding, borders) essential for multi-panel UIs without complex escape code math.

5. **Cross-platform**: Works well on Windows Terminal, PowerShell, cmd.exe, macOS Terminal.app, and iTerm2. ANSI-based rendering avoids platform-specific APIs.

6. **Performance**: Incremental rendering (only changed lines redrawn), configurable frame rate cap, and Static component for finalized content.

7. **Rich ecosystem**: ink-text-input, ink-spinner, ink-select-input, ink-table, ink-link, ink-gradient, ink-big-text, etc.

8. **Hooks**: useInput, useFocus, useFocusManager, useStdout, useStderr, useWindowSize -- all essential for a CLI tool.

**Caveats:**

- Text must live inside `<Text>` components (no arbitrary nesting)
- Requires JSX transpilation (Babel or TypeScript with JSX)
- Not suitable for full-screen TUI apps with heavy widget needs (blessed is better there, but we don't need that)

---

## 2. Streaming Text Rendering

### The Core Challenge

LLM tokens arrive at 50-100+ tokens/second. Rendering each token individually causes:

- Terminal flicker from excessive redraws
- Incomplete markdown showing raw syntax (`**bold` without closing)
- Code fences opening but never closing, breaking layout
- Performance degradation from re-parsing full document per token

### Recommended Architecture: Block-Level Incremental Rendering

```
LLM API ──> Token Buffer ──> Streaming Markdown Parser ──> Ink Components
              (batches)        (incremental blocks)         (diff render)
```

**Key strategies (based on Will McGugan's Textual approach):**

1. **Token Buffering (Producer-Consumer)**

   - Buffer between LLM stream and renderer
   - Concatenate tokens arriving faster than render cycle
   - Typical batch: 16-33ms window (~30-60 FPS equivalent)

2. **Block-Level Finalization**

   - Only the LAST markdown block can change when new tokens arrive
   - Previous blocks (completed paragraphs, code blocks, headers) are finalized
   - Finalized blocks use Ink's `<Static>` component (never re-rendered)

3. **Incremental Parsing**

   - Don't re-parse entire document for each token batch
   - Parse only from last block's start position to end of buffer
   - Keeps parsing sub-millisecond regardless of response length

4. **Partial Syntax Handling**
   - Track open markdown constructs: `**`, `` ` ``, ` ``` `, `[`, etc.
   - Display text as-is when construct is incomplete (don't attempt rendering)
   - Render construct only when closing delimiter is detected

### Implementation Pattern for Ink

```tsx
function StreamingMessage({ stream }: { stream: AsyncIterable<string> }) {
  const [finalizedBlocks, setFinalizedBlocks] = useState<Block[]>([]);
  const [activeBlock, setActiveBlock] = useState<Block | null>(null);

  useEffect(() => {
    const buffer = new TokenBuffer({ flushInterval: 32 }); // ~30fps
    const parser = new IncrementalMarkdownParser();

    buffer.on("flush", (text) => {
      const { finalized, active } = parser.append(text);
      if (finalized.length > 0) {
        setFinalizedBlocks((prev) => [...prev, ...finalized]);
      }
      setActiveBlock(active);
    });

    consumeStream(stream, buffer);
    return () => buffer.destroy();
  }, [stream]);

  return (
    <Box flexDirection="column">
      <Static items={finalizedBlocks}>
        {(block, i) => <MarkdownBlock key={i} block={block} />}
      </Static>
      {activeBlock && <MarkdownBlock block={activeBlock} />}
    </Box>
  );
}
```

### Performance Targets

| Metric                  | Target     | Rationale                     |
| ----------------------- | ---------- | ----------------------------- |
| Token-to-render latency | < 50ms     | Perceived real-time           |
| Render frame rate       | 30 FPS max | Smooth without CPU waste      |
| Memory per message      | < 1MB      | Long conversations don't leak |
| Parse time per batch    | < 1ms      | No visible lag                |

---

## 3. CLI Coding Tool UX Analysis

### Competitive Analysis

| Feature             | Claude Code              | Aider               | Codex CLI   | Gemini CLI    | GitHub Copilot CLI |
| ------------------- | ------------------------ | ------------------- | ----------- | ------------- | ------------------ |
| **Streaming**       | Excellent, smooth        | Good                | Good        | Good          | Limited            |
| **Tool Status**     | Spinner + approval flow  | Git-native diffs    | Sandboxed   | Inline        | Suggestion-only    |
| **Multi-file Edit** | Yes, parallel agents     | Yes, atomic commits | Yes         | Yes           | No                 |
| **Session Resume**  | /resume, /fork           | Git history         | Per-session | Session files | Stateless          |
| **Error Display**   | Inline with recovery     | Stack traces        | Inline      | Inline        | Minimal            |
| **Diff Preview**    | Unified, colored         | Git diff format     | Unified     | Unified       | N/A                |
| **Input Style**     | Single-line + multi-line | Single-line         | Single-line | Single-line   | Single-line        |
| **Approval Flow**   | Per-tool, configurable   | Auto-commit         | Sandbox     | Auto          | N/A                |

### UX Strengths to Emulate

**From Claude Code:**

- Clean, readable streaming output with proper markdown rendering
- Tool execution approval flow (user can approve/deny each tool use)
- Sub-agent architecture visible in output (progress spinners for parallel tasks)
- `/slash` commands for common operations
- Session management with resume and fork capabilities
- Compact mode for reduced output

**From Aider:**

- Git-native workflow: every edit is a clean atomic commit
- Token usage display (cost awareness)
- `/add` and `/drop` for managing file context
- Architect/editor model separation (plan first, then execute)
- 80-98% token efficiency through smart context management

**From Codex CLI:**

- Sandboxed execution (safe by default)
- Clear permission levels: suggest, auto-edit, full-auto
- Session persistence as JSONL files

### UX Weaknesses to Avoid

- **Excessive verbosity**: Long explanations before taking action (show actions, not explanations)
- **No cost visibility**: Users should always know token/cost impact
- **Poor error recovery**: Errors should suggest next steps, not just dump stack traces
- **Input limitations**: Single-line input is frustrating for complex prompts
- **Slow startup**: CLI tools should start in < 500ms

### Key UX Principles for dhelix

1. **Action-first**: Show what you're doing, not what you're thinking
2. **Progressive disclosure**: Collapsed details expandable on demand
3. **Cost transparency**: Token usage and estimated cost always visible
4. **Safe by default**: Require approval for destructive operations
5. **Fast feedback**: Spinner appears within 100ms of any operation
6. **Keyboard-driven**: Every action accessible via keyboard shortcut
7. **Context awareness**: Show which files are in context, token budget remaining

---

## 4. Markdown Terminal Rendering

### Library Comparison

| Library                       | Approach                | Code Highlighting | Tables | Images | Streaming  | Size         |
| ----------------------------- | ----------------------- | ----------------- | ------ | ------ | ---------- | ------------ |
| **marked-terminal**           | marked renderer plugin  | highlight.js      | Yes    | No     | Via marked | ~50KB        |
| **marked + custom renderer**  | Custom render functions | Pluggable (shiki) | Custom | No     | Yes        | ~30KB+plugin |
| **markdown-it-terminal**      | markdown-it plugin      | Yes               | Yes    | No     | Via md-it  | ~40KB        |
| **cli-markdown**              | Standalone              | highlight.js      | Yes    | No     | No         | ~25KB        |
| **Custom incremental parser** | Hand-rolled             | Pluggable         | Custom | No     | Native     | ~5-10KB      |

### Recommendation: Hybrid Approach

**For finalized blocks**: Use `marked` with `marked-terminal` renderer for full-fidelity markdown rendering with syntax highlighting.

**For streaming active block**: Use a custom incremental parser that handles partial markdown gracefully:

```
Complete paragraph  ──> marked-terminal (full rendering)
Complete code block ──> marked-terminal + shiki (syntax highlight)
Active/partial text ──> Custom partial renderer (safe fallback)
```

### Markdown Elements Priority

| Element                   | Priority | Rendering Approach                                |
| ------------------------- | -------- | ------------------------------------------------- |
| Code blocks (fenced)      | P0       | Syntax highlighted with language detection        |
| Inline code               | P0       | Background color + monospace                      |
| Bold/italic               | P0       | ANSI bold/dim                                     |
| Headers                   | P1       | Color + bold + separator line                     |
| Lists (ordered/unordered) | P1       | Indented with bullet/number                       |
| Links                     | P1       | Underline + color (clickable in modern terminals) |
| Tables                    | P2       | Box-drawing characters                            |
| Blockquotes               | P2       | Left border + dim text                            |
| Horizontal rules          | P3       | Full-width line                                   |
| Images                    | P3       | Alt text display only                             |

---

## 5. Diff / Code Edit Visualization

### Approaches

**1. Unified Diff (Recommended Default)**

```
  src/utils/parser.ts
  ────────────────────────────────
   10 │   function parse(input: string) {
 - 11 │     const result = oldMethod(input)
 + 11 │     const result = newMethod(input, options)
   12 │     return result
   13 │   }
```

**2. Side-by-Side Diff (Optional Toggle)**

```
  src/utils/parser.ts
  ─────────────────────────────── │ ───────────────────────────────
   Before                        │  After
   const result = oldMethod(     │  const result = newMethod(
     input                       │    input,
   )                             │    options
                                 │  )
```

**3. Inline Diff (For Small Changes)**

```
  src/utils/parser.ts:11
  - const result = oldMethod(input)
  + const result = newMethod(input, options)
```

### Libraries

| Library                | Terminal Support       | Syntax Highlighting | Ink Compatible     | Size   |
| ---------------------- | ---------------------- | ------------------- | ------------------ | ------ |
| **diff** (npm)         | Output only (no color) | No                  | Manual integration | 40KB   |
| **diff2html**          | HTML output primarily  | highlight.js        | No (HTML)          | Large  |
| **@git-diff-view/cli** | Yes                    | Yes                 | Yes (Ink renderer) | Medium |
| **Custom renderer**    | Full control           | Pluggable           | Yes                | Small  |

### Recommendation

Use the `diff` npm package for computing diffs, then render with a custom Ink component:

```tsx
function DiffView({ oldText, newText, filename }: DiffProps) {
  const changes = diffLines(oldText, newText);
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray">
      <Text bold color="cyan">{`  ${filename}`}</Text>
      {changes.map((change, i) => (
        <Text key={i} color={change.added ? "green" : change.removed ? "red" : "white"}>
          {change.added ? "+ " : change.removed ? "- " : "  "}
          {change.value}
        </Text>
      ))}
    </Box>
  );
}
```

Color coding:

- **Green** (`+`): Added lines
- **Red** (`-`): Removed lines
- **Gray**: Context lines
- **Cyan**: File path header
- **Yellow**: Line numbers

---

## 6. Progress Indicators & Spinners

### Library Comparison

| Library          | Downloads/week | Dependencies   | Size   | Features                     | Windows |
| ---------------- | -------------- | -------------- | ------ | ---------------------------- | ------- |
| **ora**          | 28.4M          | Multiple       | ~100KB | Rich API, promise support    | Yes     |
| **nanospinner**  | 1.5M           | 1 (picocolors) | ~7KB   | Minimal, fast                | Yes     |
| **cli-spinners** | 25.4M          | 0              | ~15KB  | Spinner frames only (data)   | Yes     |
| **listr2**       | 8M             | Multiple       | ~200KB | Multi-task trees, concurrent | Yes     |
| **ink-spinner**  | 200K           | Ink peer dep   | ~5KB   | Ink-native component         | Yes     |

### Recommendation for dhelix

**Primary**: `ink-spinner` for Ink-native integration
**Multi-task**: Custom Ink component using `cli-spinners` frame data
**Standalone scripts**: `nanospinner` (minimal overhead)

### Progress UI Patterns

**1. Tool Execution Spinner**

```
  ⠋ Reading file src/utils/parser.ts...
```

**2. Multi-Step Progress**

```
  ◆ Analyzing codebase
    ├── ✓ Reading 12 files (0.3s)
    ├── ⠋ Parsing AST...
    └── ○ Generating plan
```

**3. Token Usage Bar**

```
  Tokens: ████████░░░░░░░░ 52% (41K / 80K context)
```

**4. Cost Indicator**

```
  Session: $0.24 │ Tokens: 41K in / 8K out │ Duration: 3m 12s
```

---

## 7. Input UX

### Requirements

| Feature                                           | Priority | Implementation                         |
| ------------------------------------------------- | -------- | -------------------------------------- |
| Single-line input                                 | P0       | Ink `useInput` + custom TextInput      |
| Multi-line input (Shift+Enter or \\ continuation) | P0       | Custom state machine                   |
| Command history (up/down arrow)                   | P0       | Persist to file, in-memory ring buffer |
| Slash commands (`/help`, `/add`, `/commit`)       | P0       | Prefix matching + auto-complete        |
| File path completion (Tab)                        | P1       | fs.readdir + fuzzy match               |
| Paste support                                     | P1       | Ink `usePaste` hook (bracketed paste)  |
| Syntax highlighting in input                      | P2       | ANSI color on re-render                |
| Vi/Emacs key modes                                | P3       | Configurable keybinding profiles       |

### Multi-Line Input Design

```
  ╭─ dhelix ──────────────────────────────────╮
  │ > Refactor the parser module to use       │
  │   the visitor pattern instead of the      │
  │   switch statement. Make sure to:         │
  │   - Keep backward compatibility           │
  │   - Add unit tests                        │
  │                                           │
  │   [Enter to send, Shift+Enter for newline]│
  ╰───────────────────────────────────────────╯
```

### Auto-Completion Strategy

```
  > /he
    ┌──────────────────────┐
    │ /help     Show help  │  <-- highlighted
    │ /history  Show log   │
    └──────────────────────┘
```

Use a custom Ink component with:

- Fuzzy matching via `fuse.js` or simple prefix match
- File path completion via `fs.readdir` with glob support
- Command palette with description

### Libraries for Input

| Library               | Purpose                        | Cross-Platform                  |
| --------------------- | ------------------------------ | ------------------------------- |
| **ink-text-input**    | Single-line text input for Ink | Yes                             |
| **Ink useInput hook** | Raw keypress handling          | Yes                             |
| **Ink usePaste hook** | Paste event capture            | Yes (bracketed paste)           |
| **fuse.js**           | Fuzzy search for auto-complete | Yes                             |
| **omelette**          | Shell-level tab completion     | Bash/Zsh/Fish (not Windows cmd) |
| **tabtab**            | Shell-level tab completion     | Bash/Zsh/Fish                   |

### Windows Input Considerations

- `readline.emitKeypressEvents()` has known issues on Windows where keypress events may not fire correctly with async handlers (Node.js issue #49588)
- Workaround: Use Ink's `useInput` which abstracts raw mode handling
- Ctrl+C must be handled explicitly in raw mode (SIGINT not emitted)
- Paste via right-click in cmd.exe (no bracketed paste); Windows Terminal supports bracketed paste

---

## 8. Keybinding Systems

### Architecture

```typescript
interface Keybinding {
  key: string; // e.g., "ctrl+s", "escape", "tab"
  action: string; // e.g., "submit", "cancel", "complete"
  context?: string; // e.g., "input", "diff-view", "global"
  description: string; // Human-readable for help display
}
```

### Default Keybindings for dhelix

| Key           | Context       | Action                          |
| ------------- | ------------- | ------------------------------- |
| `Enter`       | input         | Submit message                  |
| `Shift+Enter` | input         | New line                        |
| `Ctrl+C`      | global        | Cancel current operation / Exit |
| `Ctrl+D`      | input         | Exit (EOF)                      |
| `Tab`         | input         | Auto-complete                   |
| `Up/Down`     | input (empty) | History navigation              |
| `Escape`      | any           | Cancel / back                   |
| `Ctrl+L`      | global        | Clear screen                    |
| `Ctrl+U`      | input         | Clear line                      |
| `y` / `n`     | approval      | Accept / Reject tool execution  |
| `e`           | approval      | Edit before executing           |
| `Ctrl+Z`      | global        | Undo last file change           |

### Cross-Platform Key Detection

| Key Combo   | macOS Terminal | Windows Terminal | cmd.exe       | PowerShell   |
| ----------- | -------------- | ---------------- | ------------- | ------------ |
| Ctrl+C      | SIGINT         | Raw key event    | Raw key event | SIGINT       |
| Shift+Enter | `\x1b[13;2u`   | Varies           | Not reliable  | Varies       |
| Alt+key     | `\x1b` + key   | `\x1b` + key     | Not reliable  | `\x1b` + key |
| Ctrl+Arrow  | Works          | Works            | Works         | Works        |
| Fn keys     | Works          | Works            | Works         | Works        |

**Important**: Shift+Enter detection is unreliable across terminals. Alternatives:

- Use `\\` at end of line for continuation (Aider pattern)
- Use Ctrl+Enter (detected in some modern terminals)
- Use a dedicated "multi-line mode" toggle (`Ctrl+E` to open editor)

### Implementation with Ink

```tsx
useInput(
  (input, key) => {
    if (key.return && !key.shift) {
      handleSubmit();
    } else if (key.escape) {
      handleCancel();
    } else if (key.tab) {
      handleAutoComplete();
    } else if (key.upArrow && inputEmpty) {
      handleHistoryPrev();
    }
  },
  { isActive: isFocused },
);
```

---

## 9. Session Management UX

### Architecture

```
~/.dhelix/
  sessions/
    <project-hash>/
      session-<id>.jsonl        # Conversation history
      session-<id>.meta.json    # Metadata (timestamp, model, cost)
  config.json                   # User preferences
  history                       # Command history file
```

### Session File Format (JSONL)

Each line is a JSON object:

```jsonl
{"type":"user","content":"Refactor parser","timestamp":"2026-03-05T10:00:00Z"}
{"type":"assistant","content":"I'll refactor...","tokens":{"in":500,"out":200}}
{"type":"tool","name":"read_file","args":{"path":"src/parser.ts"},"result":"..."}
{"type":"assistant","content":"Here's the plan...","tokens":{"in":800,"out":400}}
```

### Session Commands

| Command        | Description                                              |
| -------------- | -------------------------------------------------------- |
| `/resume`      | Resume last session for current project                  |
| `/resume <id>` | Resume specific session                                  |
| `/fork`        | Branch from current point (original untouched)           |
| `/history`     | List recent sessions with summaries                      |
| `/clear`       | Clear current conversation (start fresh in same session) |
| `/export`      | Export session as markdown                               |
| `/compact`     | Compress old messages to save context                    |

### Resume UX Flow

```
  dhelix v0.1.0

  ┌─ Resume Session? ──────────────────────────┐
  │                                             │
  │  Last session: 2h ago (12 messages, $0.42)  │
  │  Summary: Refactored parser module          │
  │                                             │
  │  [r] Resume  [n] New session  [h] History   │
  └─────────────────────────────────────────────┘
```

---

## 10. Color & Styling Libraries

### Library Comparison

| Library         | Size  | Dependencies | Performance (ops/s) | Color Levels     | ESM/CJS        |
| --------------- | ----- | ------------ | ------------------- | ---------------- | -------------- |
| **chalk**       | 101KB | 0            | 4.8M                | 0-3 (16M colors) | ESM only (v5+) |
| **picocolors**  | 7KB   | 0            | 8M                  | Basic 16         | CJS + ESM      |
| **yoctocolors** | 3KB   | 0            | 8M                  | Basic 16         | ESM only       |
| **ansi-colors** | 25KB  | 0            | 7M                  | Basic 16         | CJS            |
| **colorette**   | 6KB   | 0            | 8M                  | Basic 16         | CJS + ESM      |
| **kleur**       | 8KB   | 0            | 7.5M                | Basic 16         | CJS + ESM      |

### Recommendation

**Primary**: `chalk` (v5 ESM) - Most feature-rich, auto-detects terminal capabilities, graceful degradation on Windows. Used by Ink internally.

**Performance-critical paths**: `picocolors` - When coloring happens in hot loops (e.g., per-token during streaming), the 2x speed advantage matters.

### Color Scheme Design

```
  Role            Light Terminal     Dark Terminal
  ─────────────── ────────────────── ──────────────────
  User input      white/black        white
  AI response     default            default
  Code blocks     green bg           gray bg
  Inline code     cyan               cyan
  File paths      blue, underline    blue, underline
  Added lines     green              green
  Removed lines   red                red
  Warnings        yellow             yellow
  Errors          red, bold          red, bold
  Dim/secondary   gray               dim white
  Spinner         cyan               cyan
  Cost/tokens     dim yellow         dim yellow
```

### Terminal Color Detection

```typescript
import chalk from "chalk";

// Automatic detection
chalk.level; // 0 = no color, 1 = basic, 2 = 256, 3 = truecolor

// Force color (for CI/pipes)
// Set env: FORCE_COLOR=1

// Respect NO_COLOR convention
// Set env: NO_COLOR=1
```

---

## 11. Syntax Highlighting

### Options

| Library          | Engine             | Languages | Terminal Output     | Performance       | Size                 |
| ---------------- | ------------------ | --------- | ------------------- | ----------------- | -------------------- |
| **shiki**        | TextMate (VS Code) | 200+      | `codeToAnsi()`      | Good (async init) | ~2MB (with grammars) |
| **highlight.js** | Regex              | 190+      | Via marked-terminal | Fast              | ~1MB                 |
| **Prism**        | Regex              | 300+      | Manual ANSI mapping | Fast              | ~500KB               |

### Recommendation: **Shiki**

- VS Code-identical highlighting (users see same colors as their editor)
- `codeToAnsi()` produces terminal-ready ANSI output
- Theme support (vitesse-dark default, customizable)
- Language auto-detection from code fence markers
- Lazy loading: only load grammars for languages actually used

```typescript
import { codeToAnsi } from "shiki";

const highlighted = await codeToAnsi(code, {
  lang: "typescript",
  theme: "vitesse-dark",
});
process.stdout.write(highlighted);
```

**Caveat**: Shiki's initial load is async and ~100ms. Pre-load common languages (JS/TS/Python/Go/Rust) at startup.

---

## 12. Accessibility

### Requirements

| Feature                     | Priority | Implementation                                 |
| --------------------------- | -------- | ---------------------------------------------- |
| `NO_COLOR` env var support  | P0       | Chalk auto-detects                             |
| High contrast mode          | P1       | Color scheme with 4.5:1+ contrast ratios       |
| Screen reader compatibility | P1       | Meaningful text output, ARIA-like structure    |
| Font size independence      | P0       | Relative layouts (no fixed column assumptions) |
| Reduced motion              | P2       | Option to disable spinners/animations          |
| Color-blind safe palette    | P1       | Avoid red/green only; use shape+color          |

### Color-Blind Safe Diff Indicators

Instead of relying solely on red/green:

```
  + Added line     (green + "+" prefix + bold)
  - Removed line   (red + "-" prefix + strikethrough)
    Context line   (default + "  " prefix)
```

The prefix characters (`+`, `-`, ` `) provide information without color.

### Screen Reader Considerations

- Avoid cursor repositioning tricks (confuses screen readers)
- Use `<Static>` for finalized content (screen readers can read sequentially)
- Provide `--plain` mode that strips all ANSI formatting
- Log-style output (append-only) is most screen-reader friendly

### Configuration

```json
{
  "accessibility": {
    "colorMode": "auto", // "auto" | "dark" | "light" | "high-contrast" | "none"
    "reducedMotion": false,
    "screenReader": false,
    "diffIndicators": "both" // "color" | "symbol" | "both"
  }
}
```

---

## 13. Windows-Specific Concerns

### Terminal Compatibility Matrix

| Feature            | Windows Terminal | PowerShell    | cmd.exe (legacy)               | WSL        |
| ------------------ | ---------------- | ------------- | ------------------------------ | ---------- |
| ANSI escape codes  | Full             | Full (Win10+) | Limited (VirtualTerminalLevel) | Full       |
| 24-bit color       | Yes              | Yes           | No (16 colors)                 | Yes        |
| Unicode/Emoji      | Yes              | Partial       | Minimal                        | Yes        |
| Bracketed paste    | Yes              | No            | No                             | Yes        |
| Mouse events       | Yes              | No            | No                             | Yes        |
| Hyperlinks (OSC 8) | Yes              | No            | No                             | Yes (some) |
| Resize events      | Yes              | Yes           | Yes                            | Yes        |
| ConPTY             | Yes              | Yes           | Yes                            | N/A        |

### Key Windows Issues and Mitigations

**1. ANSI Support Detection**

```typescript
import { supportsColor } from "chalk";

// Windows Terminal: level 3 (truecolor)
// PowerShell: level 2 (256 colors) on Win10+
// cmd.exe: level 1 (basic 16) or 0 (legacy)
// Solution: chalk auto-detects and degrades
```

**2. ConPTY Quirks**

- ConPTY may modify escape sequences passed to process input
- Shell integration sequences may be misplaced
- Mitigation: Test with both ConPTY and legacy console mode
- Use `process.platform === 'win32'` for Windows-specific workarounds

**3. Unicode Rendering**

```
  ✓  (U+2713) - Works in Windows Terminal, may show ? in cmd.exe
  ✗  (U+2717) - Same
  ●  (U+25CF) - Works everywhere
  ○  (U+25CB) - Works everywhere
  │  (U+2502) - Box-drawing, works everywhere
  ─  (U+2500) - Box-drawing, works everywhere
```

**Mitigation**: Use a Unicode fallback map:

```typescript
const symbols =
  process.platform === "win32" && !isModernTerminal()
    ? { tick: "v", cross: "x", bullet: "*", pipe: "|" }
    : { tick: "\u2713", cross: "\u2717", bullet: "\u25cf", pipe: "\u2502" };
```

**4. Path Handling**

- Always use `path.resolve()` and `path.join()` for file paths
- Display paths with forward slashes for consistency
- Accept both `\` and `/` in user input

**5. Keypress Issues**

- Node.js readline keypress events are unreliable on Windows with async handlers (issue #49588)
- Shift+Enter detection varies by terminal
- Mitigation: Use Ink's `useInput` abstraction layer

**6. Terminal Width**

- `process.stdout.columns` works on all platforms
- Listen for `SIGWINCH` (Unix) or poll periodically on Windows
- Ink handles this via `useWindowSize()` hook

### Recommended Testing Matrix

| Environment                   | Priority | Notes                                 |
| ----------------------------- | -------- | ------------------------------------- |
| Windows Terminal + PowerShell | P0       | Primary Windows target                |
| macOS Terminal.app            | P0       | Primary macOS target                  |
| VS Code integrated terminal   | P0       | Most common dev environment           |
| iTerm2 (macOS)                | P1       | Power user terminal                   |
| cmd.exe (Windows)             | P1       | Legacy support (graceful degradation) |
| WSL2 + Windows Terminal       | P1       | Common hybrid setup                   |
| Alacritty / Wezterm           | P2       | Modern GPU-accelerated terminals      |
| SSH remote session            | P2       | Remote development use case           |

---

## 14. Recommended Tech Stack

### Core Stack

| Layer                   | Library                    | Version    | Rationale                                          |
| ----------------------- | -------------------------- | ---------- | -------------------------------------------------- |
| **UI Framework**        | Ink                        | 5.x        | React for CLI, streaming-native, production-proven |
| **Layout**              | Yoga (via Ink)             | -          | Flexbox for terminal, cross-platform               |
| **Colors**              | chalk                      | 5.x        | Auto-detection, graceful degradation, Ink default  |
| **Colors (perf)**       | picocolors                 | 1.x        | Hot path coloring (streaming tokens)               |
| **Markdown**            | marked + marked-terminal   | 14.x / 7.x | Full markdown rendering for finalized blocks       |
| **Streaming MD**        | Custom incremental parser  | -          | Handles partial syntax during streaming            |
| **Syntax Highlighting** | shiki                      | 1.x        | VS Code-quality, `codeToAnsi()` for terminal       |
| **Diff Computing**      | diff                       | 7.x        | Compute unified diffs programmatically             |
| **Diff Display**        | Custom Ink component       | -          | Colored unified diff with line numbers             |
| **Spinner**             | ink-spinner + cli-spinners | -          | Ink-native with rich spinner frame data            |
| **Input**               | ink-text-input + custom    | -          | Single-line + custom multi-line extension          |
| **Auto-complete**       | fuse.js                    | 7.x        | Fuzzy search for commands and file paths           |
| **Prompts**             | @clack/prompts             | 0.x        | One-off prompts (confirmation, select)             |
| **Key Handling**        | Ink useInput               | -          | Cross-platform keypress abstraction                |
| **Session Storage**     | Custom JSONL               | -          | Append-only log, easy to parse/resume              |
| **Config**              | cosmiconfig                | 9.x        | Standard config file discovery                     |

### Development Dependencies

| Tool           | Purpose                              |
| -------------- | ------------------------------------ |
| TypeScript     | Type safety, JSX support             |
| tsup / esbuild | Fast bundling for CLI distribution   |
| vitest         | Unit testing                         |
| Playwright     | E2E testing (terminal screenshots)   |
| pkg / nexe     | Optional: single-binary distribution |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         dhelix CLI                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  Input Layer  │  │  Output Layer │  │   State Manager    │    │
│  │              │  │              │  │                    │    │
│  │  - TextInput │  │  - Streaming │  │  - Conversation    │    │
│  │  - History   │  │    Markdown  │  │  - Session         │    │
│  │  - AutoComp  │  │  - Diff View │  │  - Config          │    │
│  │  - Keybinds  │  │  - Spinners  │  │  - File Context    │    │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘    │
│         │                 │                    │                │
│  ┌──────┴─────────────────┴────────────────────┴───────────┐    │
│  │                    Ink (React Runtime)                   │    │
│  │    Components ◄── Hooks ◄── State ◄── Effects           │    │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         │                                       │
│  ┌──────────────────────┴──────────────────────────────────┐    │
│  │              Terminal Abstraction Layer                   │    │
│  │    chalk ── ANSI codes ── color detection ── fallbacks   │    │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         │                                       │
├─────────────────────────┴───────────────────────────────────────┤
│  stdout / stderr (cross-platform: Win Terminal, macOS, Linux)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15. UX Mockups

### Main Chat Interface

```
  ┌─ dhelix ──────────────────────────────────── model: opus-4 ──┐
  │                                                               │
  │  You: Refactor the auth module to use JWT tokens              │
  │                                                               │
  │  ┌─ Assistant ──────────────────────────────────────────────┐ │
  │  │ I'll refactor the auth module. Here's my plan:          │ │
  │  │                                                          │ │
  │  │ 1. Install `jsonwebtoken` package                       │ │
  │  │ 2. Create `src/auth/jwt.ts` with token utilities        │ │
  │  │ 3. Update `src/auth/middleware.ts` to use JWT           │ │
  │  │ 4. Update tests                                         │ │
  │  │                                                          │ │
  │  │ Let me start by reading the current auth code.          │ │
  │  └──────────────────────────────────────────────────────────┘ │
  │                                                               │
  │  ⠋ Reading src/auth/middleware.ts...                          │
  │                                                               │
  ├───────────────────────────────────────────────────────────────┤
  │  Tokens: 12K/80K │ Cost: $0.08 │ Session: 2m                 │
  ├───────────────────────────────────────────────────────────────┤
  │  >                                                            │
  └───────────────────────────────────────────────────────────────┘
```

### Tool Approval Flow

```
  ┌─ Tool: write_file ──────────────────────────────────────────┐
  │  Path: src/auth/jwt.ts                                      │
  │                                                              │
  │  + import jwt from 'jsonwebtoken'                           │
  │  +                                                           │
  │  + export function generateToken(payload: TokenPayload) {   │
  │  +   return jwt.sign(payload, process.env.JWT_SECRET!, {    │
  │  +     expiresIn: '24h'                                     │
  │  +   })                                                      │
  │  + }                                                         │
  │  +                                                           │
  │  + export function verifyToken(token: string) {             │
  │  +   return jwt.verify(token, process.env.JWT_SECRET!)      │
  │  + }                                                         │
  │                                                              │
  │  [y] Accept  [n] Reject  [e] Edit  [d] Show full diff       │
  └──────────────────────────────────────────────────────────────┘
```

### Error Display

```
  ┌─ Error ─────────────────────────────────────────────────────┐
  │  TypeScript compilation failed in src/auth/jwt.ts:8         │
  │                                                              │
  │  Property 'secret' does not exist on type 'ProcessEnv'      │
  │                                                              │
  │  Suggestion: Add JWT_SECRET to your .env.d.ts type          │
  │  declarations, or use a type assertion.                      │
  │                                                              │
  │  [f] Auto-fix  [s] Skip  [r] Retry                         │
  └──────────────────────────────────────────────────────────────┘
```

### Multi-Task Progress

```
  ┌─ Agent Tasks ───────────────────────────────────────────────┐
  │  ◆ Refactoring auth module                                  │
  │    ├── ✓ Read existing code (0.4s)                         │
  │    ├── ✓ Install jsonwebtoken (2.1s)                       │
  │    ├── ⠋ Creating src/auth/jwt.ts...                       │
  │    ├── ○ Update middleware.ts                                │
  │    ├── ○ Update auth.test.ts                                │
  │    └── ○ Run tests                                          │
  └──────────────────────────────────────────────────────────────┘
```

### Session Resume Screen

```
  dhelix v0.1.0 - AI Coding Assistant

  Recent sessions for ~/projects/myapp:

    1. [2h ago]  Refactored auth to JWT (12 msgs, $0.42)
    2. [1d ago]  Fixed pagination bug (8 msgs, $0.15)
    3. [3d ago]  Added user profile API (24 msgs, $1.20)

  [1-3] Resume session  [n] New session  [q] Quit
```

### Compact Mode (Reduced Verbosity)

```
  > Add input validation to the user registration endpoint

  Reading src/routes/register.ts... done
  Reading src/models/user.ts... done

  Plan: Add zod validation schema, update route handler

  ┌─ write_file: src/routes/register.ts ────────────────────────┐
  │  +  const schema = z.object({                               │
  │  +    email: z.string().email(),                             │
  │  +    password: z.string().min(8),                           │
  │  +    name: z.string().min(1).max(100),                      │
  │  +  })                                                       │
  │  [y/n/e]                                                     │
  └──────────────────────────────────────────────────────────────┘
```

---

## Summary of Key Decisions

| Decision            | Choice                                                  | Rationale                                                                    |
| ------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| UI Framework        | **Ink (React for CLI)**                                 | Streaming-native, component-based, proven by Copilot CLI, Prisma, Cloudflare |
| Streaming Strategy  | **Block-level incremental with token buffering**        | Sub-millisecond parsing, flicker-free, minimal redraws                       |
| Markdown Rendering  | **marked-terminal (final) + custom parser (streaming)** | Full fidelity for completed blocks, safe partial rendering                   |
| Syntax Highlighting | **Shiki**                                               | VS Code-identical output, terminal ANSI support                              |
| Color Library       | **chalk (primary) + picocolors (hot path)**             | Feature-rich with fast fallback                                              |
| Diff Display        | **diff (compute) + custom Ink component (render)**      | Full control over terminal rendering                                         |
| Input System        | **Ink useInput + custom multi-line**                    | Cross-platform, extensible                                                   |
| Session Storage     | **JSONL files**                                         | Append-only, human-readable, easy resume/fork                                |
| Config              | **cosmiconfig**                                         | Standard discovery (package.json, .dhelixrc, etc.)                           |

### Cross-Platform Confidence Score

| Component       | Windows | macOS | Linux | Notes                                            |
| --------------- | ------- | ----- | ----- | ------------------------------------------------ |
| Ink rendering   | 9/10    | 10/10 | 10/10 | Minor ConPTY edge cases                          |
| Color support   | 8/10    | 10/10 | 10/10 | cmd.exe limited to 16 colors                     |
| Unicode symbols | 7/10    | 10/10 | 10/10 | Fallback map for legacy terminals                |
| Key handling    | 8/10    | 10/10 | 10/10 | Shift+Enter unreliable on some Windows terminals |
| Streaming       | 10/10   | 10/10 | 10/10 | Pure Node.js, no platform deps                   |
| File paths      | 10/10   | 10/10 | 10/10 | path.resolve handles all cases                   |
| Diff rendering  | 9/10    | 10/10 | 10/10 | ANSI color dependent                             |
| Session files   | 10/10   | 10/10 | 10/10 | JSONL is platform-agnostic                       |
