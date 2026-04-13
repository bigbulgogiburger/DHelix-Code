# Naming Convention & Brand Guide

> 참조 시점: UI 텍스트, 환경변수, 설정 파일 경로 작업 시

## Naming Convention

| Context                     | Name          | Example                            |
| --------------------------- | ------------- | ---------------------------------- |
| Package / CLI command       | `dhelix`      | `npx dhelix`, `bin/dhelix.mjs`     |
| Project instruction file    | `DHELIX.md`   | `{project}/DHELIX.md`              |
| Config directory            | `.dhelix`     | `~/.dhelix/`, `{project}/.dhelix/` |
| Environment variable prefix | `DHELIX_`     | `DHELIX_MODEL`, `DHELIX_BASE_URL`  |
| Display / brand name        | `Dhelix Code` | UI titles, docs                    |

## Brand Colors (Double Helix Palette)

| Token         | Hex                   | Usage                          |
| ------------- | --------------------- | ------------------------------ |
| Bright accent | `#00E5FF`             | Success, completion, assistant |
| Primary       | `#00BCD4`             | Agent animation, emphasis      |
| Dark accent   | `#0097A7`             | Borders, muted accents         |
| Semantic      | `red`/`yellow`/`gray` | Errors / warnings / muted      |

Theme SSOT: `src/cli/renderer/theme.ts`

## Keyboard Shortcuts

| Shortcut  | Action            | Shortcut | Action         |
| --------- | ----------------- | -------- | -------------- |
| Esc       | Cancel agent loop | Ctrl+O   | Toggle verbose |
| Shift+Tab | Cycle permissions | Ctrl+D   | Exit           |
| Alt+T     | Toggle thinking   |          |                |

Customizable: `~/.dhelix/keybindings.json`

## Tool System (25 built-in)

| Category          | Tools                                                                | Note                                |
| ----------------- | -------------------------------------------------------------------- | ----------------------------------- |
| File I/O          | `file_read`, `file_write`, `file_edit`, `list_dir`, `mkdir`          | Core                                |
| Shell             | `bash_exec`, `bash_output`                                           | Real-time streaming + env sanitizer |
| Search            | `glob_search`, `grep_search`                                         | ripgrep fallback                    |
| Code Intelligence | `symbol_search`, `code_outline`, `find_dependencies`                 | Tier 1: tree-sitter                 |
| LSP               | `goto_definition`, `find_references`, `get_type_info`, `safe_rename` | Tier 2: LSP on-demand               |
| Web               | `web_search`, `web_fetch`                                            | Brave + DuckDuckGo                  |
| Batch             | `apply_patch`, `batch_file_ops`                                      | Multi-file operations               |
| Meta              | `agent`, `ask_user`, `todo_write`, `notebook_edit`                   | Subagents, UI                       |
