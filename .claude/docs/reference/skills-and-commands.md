# Skills & Commands

> 참조 시점: 스킬 개발, 슬래시 명령 추가, 입력 시스템 수정 시

## Skills System

- Skills loaded from 4 directories:
  - `.dbcode/commands/`, `.dbcode/skills/` (project-level)
  - `~/.dbcode/commands/`, `~/.dbcode/skills/` (user-level)
- `SkillManager` builds system prompt section listing available skills
- User-invocable skills become `/name` slash commands via `command-bridge.ts`

### String Substitutions

| 변수                   | 설명              |
| ---------------------- | ----------------- |
| `$ARGUMENTS`           | 전체 인자 문자열  |
| `$ARGUMENTS[N]`        | N번째 인자        |
| `$N`                   | N번째 인자 (축약) |
| `${DBCODE_SESSION_ID}` | 현재 세션 ID      |

### Skill File Structure

```markdown
---
name: my-skill
description: What this skill does
user_invocable: true
---

Skill prompt content with $ARGUMENTS substitution...
```

## Slash Commands (29 total)

All functional: help, clear, compact, model, config, cost, context, resume,
rewind, effort, fast, simplify, batch, debug, mcp, diff, doctor, stats,
export, copy, fork, rename, output-style, update, memory, keybindings, init, plan, status

새 명령 추가: `src/commands/`에 파일 생성 → `registry.ts`에 등록

## Input History

- Persisted to `~/.dbcode/input-history.json` (survives restarts)
- Up/Down arrow keys navigate history across sessions
- Max 500 entries, deduplication on insert (most recent wins)
- Auto-saves on every new input
- Implementation: `src/cli/hooks/useInput.ts`

## 주의사항

- `command-bridge.ts`가 스킬을 슬래시 커맨드로 자동 변환 — 이름 충돌 주의
- 스킬의 `user_invocable: true`가 없으면 시스템 전용 (유저가 `/name`으로 호출 불가)
- 슬래시 커맨드와 스킬 이름이 겹치면 스킬이 우선
