# Claude Code CLI — Package Structure Analysis

> Analysis date: 2026-03-06
> Package: `@anthropic-ai/claude-code` (globally installed)
> Location: `$(npm root -g)/@anthropic-ai/claude-code/`

## Package Layout

```
@anthropic-ai/claude-code/
├── cli.js           # 12MB bundled, minified single-file CLI
├── package.json
├── README.md
├── LICENSE.md
├── sdk-tools.d.ts   # TypeScript types for SDK tool integration
├── resvg.wasm       # SVG rendering (for screenshot/diagram features)
├── tree-sitter.wasm          # Code parsing
├── tree-sitter-bash.wasm     # Bash grammar
└── vendor/
    └── ripgrep/     # Bundled rg binary for content search
```

## System Prompt Structure

The system prompt is assembled via `getSystemPrompt()` (29 references in bundle).
Key sections identified from string analysis:

| Section              | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `# System`           | Identity and core behavior rules              |
| `# Doing tasks`      | How to approach software engineering tasks    |
| `# Using your tools` | When/how to use each tool, parallel execution |
| `# Tone and style`   | Communication style guidelines                |
| `# Environment`      | Platform, shell, cwd, git status, model info  |
| `# Instructions`     | Project-specific CLAUDE.md content            |

**Key patterns adopted in dhelix**:

- Section-based prompt assembly with priority ordering
- Auto-loading project instructions from `.dhelix/DHELIX.md`
- Git context (branch, recent commits) in environment section
- Tool usage guidelines (when to use Read vs Grep vs Glob)

## Tool System

Claude Code uses Anthropic's native `tool_use` format (544 occurrences).
Identified tools:

| Tool         | Count | dhelix Equivalent |
| ------------ | ----- | ----------------- |
| Read         | 51    | `file_read`       |
| Bash         | 22    | `bash_exec`       |
| Write        | 19    | `file_write`      |
| Edit         | 20    | `file_edit`       |
| Glob         | 26    | `glob_search`     |
| Grep         | 23    | `grep_search`     |
| Agent        | 12    | (subagent system) |
| WebFetch     | 8     | (not yet)         |
| WebSearch    | 7     | (not yet)         |
| NotebookEdit | 5     | (not yet)         |
| AskUser      | 1     | `ask_user`        |
| TodoWrite    | 2     | (task manager)    |

**Key insight**: Claude Code's core tool set is very similar to dhelix's P0 tools.
The main gaps are WebFetch, WebSearch, and NotebookEdit — all non-critical for MVP.

## Conversation Flow

- Messages accumulate in a flat array (system + user + assistant + tool messages)
- Context compaction uses `getSystemPromptSectionCache` and `clearSystemPromptSectionState`
- Tool results are formatted as tool-role messages with tool_use IDs
- Streaming uses Anthropic's native SSE format (different from OpenAI's)

## Error Handling

Claude Code handles these HTTP errors:

- 400: Invalid request (permanent)
- 401/403: Auth errors (permanent)
- 429: Rate limit (retryable with backoff)
- 500: API error (retryable)
- 529: Overloaded (retryable)

**Adopted in dhelix**: Same classification pattern with OpenAI-equivalent status codes.

## UI Patterns

- Single-file Ink-based React CLI (similar to dhelix)
- Logo/header pinned to scroll buffer
- Streaming text display with tool call blocks
- Permission prompts for dangerous operations
- Status bar with model/token info

## Key Takeaways for dhelix

1. **System prompt structure**: Adopted `# System`, `# Doing tasks`, `# Using your tools` pattern
2. **Tool-centric architecture**: All capabilities exposed as LLM-callable tools
3. **Error classification**: Transient vs permanent error handling with retries
4. **Context management**: Auto-compaction when approaching token limits
5. **Bundled ripgrep**: Claude Code bundles its own rg binary; dhelix uses fast-glob instead
6. **Agent tool**: Sub-agent delegation for complex tasks (dhelix has subagent system)
