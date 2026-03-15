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

## Slash Commands (41 total)

### Core

| 명령 | 설명 |
|------|------|
| `/help` | 도움말 |
| `/clear` | 대화 초기화 |
| `/compact` | 컨텍스트 수동 압축 |
| `/status` | 세션 상태 조회 |
| `/doctor` | 설정 진단 (12 health checks) |

### Model & Configuration

| 명령 | 설명 |
|------|------|
| `/model` | LLM 모델 변경 |
| `/config` | 설정 조회/변경 |
| `/effort` | 응답 품질 수준 조정 |
| `/fast` | 빠른 모드 토글 |
| `/tone` | 대화 어조 변경 |
| `/output-style` | 출력 스타일 변경 |
| `/keybindings` | 키보드 단축키 관리 |
| `/dual-model` | Architect/Editor 듀얼 모델 패턴 |

### Session Management

| 명령 | 설명 |
|------|------|
| `/resume` | 이전 세션 복원 |
| `/rewind` | 체크포인트로 되돌리기 |
| `/fork` | 현재 세션 분기 |
| `/undo` | 파일 변경 되돌리기 |
| `/rename` | 세션 이름 변경 |

### Analysis & Monitoring

| 명령 | 설명 |
|------|------|
| `/cost` | API 비용 확인 |
| `/context` | 컨텍스트 사용량 조회 |
| `/stats` | 세션 통계 |
| `/analytics` | 상세 분석 대시보드 (토큰, 도구 빈도, 비용) |

### Development Tools

| 명령 | 설명 |
|------|------|
| `/commit` | Git 커밋 생성 |
| `/review` | 코드 리뷰 실행 |
| `/debug` | 디버깅 모드 |
| `/diff` | 변경사항 비교 |
| `/batch` | 배치 작업 실행 |
| `/simplify` | 코드 단순화 리뷰 |
| `/plan` | Plan 모드 (실행 전 확인) |
| `/init` | 프로젝트에 DBCODE.md 생성 |

### Export & Copy

| 명령 | 설명 |
|------|------|
| `/export` | 대화 내보내기 |
| `/copy` | 대화 클립보드에 복사 |

### External Integration

| 명령 | 설명 |
|------|------|
| `/mcp` | MCP 서버 관리 (list/add/remove, 3-scope) |
| `/voice` | 음성 입력 토글 |
| `/update` | 업데이트 확인 |
| `/bug` | 버그 리포트 |

### Agent & Team

| 명령 | 설명 |
|------|------|
| `/agents` | 서브에이전트 관리 |
| `/team` | 팀 오케스트레이션 |

### Permission & Memory

| 명령 | 설명 |
|------|------|
| `/permissions` | 권한 규칙 관리 |
| `/memory` | 프로젝트 메모리 관리 |

### /mcp 상세 (신규)

스코프 기반 MCP 서버 관리:

```
/mcp list                           — 스코프별 서버 목록 + 연결 상태
/mcp add <name> <command> [args]    — user 스코프에 추가 (기본)
/mcp add -s project <name> <cmd>    — 특정 스코프에 추가
/mcp remove <name>                  — 모든 스코프에서 제거
/mcp remove -s user <name>          — 특정 스코프에서만 제거
```

### /analytics

Session analytics dashboard — displays:
- Token usage breakdown (input/output/cache hits)
- Tool call frequency and success rates
- Context compaction history
- Cost per turn and cumulative cost
- Implementation: `src/cli/analytics.ts`

새 명령 추가: `src/commands/`에 파일 생성 → `registry.ts`에 등록

## Input History

- Persisted to `~/.dbcode/input-history.json` (survives restarts)
- Up/Down arrow keys navigate history across sessions
- Max 500 entries, deduplication on insert (most recent wins)
- Auto-saves on every new input
- Implementation: `src/cli/hooks/useInput.ts`

## 주의사항

- `command-bridge.ts`가 스킬을 슬래시 커맨드로 자동 변환 — 이름 충돌 주의
- 스킬의 `user_invocable: true`가 없으면 시스템 전용
- 슬래시 커맨드와 스킬 이름이 겹치면 스킬이 우선
- `CommandContext`에 `mcpManager` 필드가 있음 — MCP 명령어에서 실제 연결 상태 조회에 사용
