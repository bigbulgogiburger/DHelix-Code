# Config & Instructions System

> 참조 시점: DBCODE.md 처리, 설정 계층, MCP 스코프 설정, 프로젝트 초기화 시

## DBCODE.md Location

- **Primary**: `DBCODE.md` at project root (convention, same as CLAUDE.md)
- **Fallback**: `.dbcode/DBCODE.md` (backward compatible)
- `/init` creates `DBCODE.md` at project root + `.dbcode/` for settings and rules
- `DBCODE.md` is optional — dbcode works without it
- Use `getProjectConfigPaths(cwd)` from `src/constants.ts` to resolve paths consistently
- **Never hardcode DBCODE.md paths** — always use the centralized helper

## Instruction Loading Hierarchy (lowest → highest priority)

1. `~/.dbcode/DBCODE.md` — global user instructions
2. `~/.dbcode/rules/*.md` — global user rules
3. Parent directory `DBCODE.md` files (walking up from cwd)
4. Project root `DBCODE.md`
5. `.dbcode/rules/*.md` — project path-conditional rules
6. `DBCODE.local.md` — local overrides (gitignored)

## Config Hierarchy (5-level)

```mermaid
graph BT
    A["CLI flags"] --> MERGE[Merged Config]
    B["Environment vars"] --> MERGE
    C["Project .dbcode/settings.json"] --> MERGE
    D["User ~/.dbcode/settings.json"] --> MERGE
    E["defaults.ts"] --> MERGE
```

Priority: CLI flags > env vars > project > user > defaults

## Key Config Paths

| 용도             | 경로                                      |
| ---------------- | ----------------------------------------- |
| 프로젝트 설정    | `.dbcode/settings.json`                   |
| 사용자 전역 설정 | `~/.dbcode/settings.json`                 |
| 프로젝트 규칙    | `.dbcode/rules/*.md`                      |
| 전역 규칙        | `~/.dbcode/rules/*.md`                    |
| 키바인딩         | `~/.dbcode/keybindings.json`              |
| 입력 히스토리    | `~/.dbcode/input-history.json`            |
| 권한 감사 로그   | `.dbcode/audit.jsonl`                     |
| 프로젝트 메모리  | `~/.dbcode/projects/{hash}/memory/`       |
| 콜드 스토리지    | `~/.dbcode/projects/{hash}/cold-storage/` |

## MCP Config Paths (3-Scope)

MCP 서버 설정은 3개 스코프로 관리됩니다. 우선순위: local > project > user

| 스코프  | 경로                         | 용도                       | Git        |
| ------- | ---------------------------- | -------------------------- | ---------- |
| local   | `.dbcode/mcp-local.json`     | 개인 개발 서버 (API 키 등) | .gitignore |
| project | `.dbcode/mcp.json`           | 팀 공용 서버               | 커밋       |
| user    | `~/.dbcode/mcp-servers.json` | 글로벌 서버                | N/A        |

모든 스코프의 설정 파일 형식:

```json
{
  "servers": {
    "server-name": {
      "transport": "stdio",
      "command": "npx",
      "args": ["@some/mcp-server"]
    }
  }
}
```

- **MCPScopeManager** (`src/mcp/scope-manager.ts`): 3개 스코프 병합 담당
- **MCPManager** (`src/mcp/manager.ts`): `loadScopedConfigs()` → `connectAll()` → 도구 등록
- **레거시 fallback**: `~/.dbcode/mcp.json` (`{ mcpServers: {...} }` 형식) — scope-manager가 없을 때만 사용

## DEFAULT_MODEL Resolution

Model selection follows env-var priority chain:

```
DBCODE_MODEL > OPENAI_MODEL > "gpt-5.1-codex-mini" (schema.ts hardcoded default)
```

**dotenv 타이밍 주의사항:**

- `src/index.ts`에서 dotenv는 **패키지 루트의 `.env`만** 로드 (cwd의 `.env`는 읽지 않음)
- `config/schema.ts`의 Zod 기본값은 **import 시점**(dotenv 로드 전)에 평가되므로 `"gpt-5.1-codex-mini"` 하드코딩 필수
- 런타임 env 오버라이드는 `config/loader.ts`의 `loadEnvConfig()`에서 처리
- `/model` 명령의 Default 항목은 실행 시점에 `process.env`를 직접 읽어 정확한 env 모델 표시

CLI `--model` flag overrides all.

## Permission Audit Logging

- **audit-log.ts** (`src/permissions/`): Logs every permission check to JSONL format
- Each entry: timestamp, tool name, permission level, user decision, file path
- Stored at `.dbcode/audit.jsonl` (project-level, gitignored)

## Health Checks (/doctor)

`/doctor` runs 12 health checks: config, permissions, sandbox, LLM connectivity, MCP servers, etc.

## 주의사항

- `getProjectConfigPaths(cwd)` 헬퍼를 항상 사용 — 경로 하드코딩 금지
- `.dbcode/rules/*.md`는 glob 기반 path-conditional — `path-matcher.ts` 참조
- `DBCODE.local.md`는 `.gitignore`에 포함되어야 함
- `audit.jsonl`은 `.gitignore`에 포함되어야 함
- MCP 스코프 설정 변경 시 dbcode 재시작 필요 (부트스트랩에서 연결)
- MCP 서버 추가/제거는 `/mcp add|remove` 명령어로 — 직접 JSON 수정도 가능
