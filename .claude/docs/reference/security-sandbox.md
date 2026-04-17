# Security & Sandbox

> 참조 시점: 보안 정책 변경, 샌드박스 설정, 권한 시스템 수정 시

## Trust Tiers (`src/permissions/trust-tiers.ts`)

| Tier                 | 대상                 | 기본 정책          |
| -------------------- | -------------------- | ------------------ |
| T0 (BuiltIn)         | 29개 core tools      | 전체 허용          |
| T1 (LocallyAuthored) | `~/.dhelix/skills/`  | Trust-on-first-use |
| T2 (ProjectShared)   | `{project}/.dhelix/` | Review required    |
| T3 (External)        | npm, remote MCP      | OS-level sandbox   |

## Permission System (`src/permissions/`)

| 파일                  | 역할                                                                 |
| --------------------- | -------------------------------------------------------------------- |
| `manager.ts`          | 계층 결정 엔진 — deny → session → allow → rules → mode               |
| `rules.ts`            | Glob 기반 규칙 매칭                                                  |
| `modes.ts`            | `default` / `acceptEdits` / `plan` / `dontAsk` / `bypassPermissions` |
| `session-store.ts`    | 세션 내 승인 캐시 (메모리)                                           |
| `persistent-store.ts` | `~/.dhelix/settings.json` 규칙 영속화                                |
| `approval-db.ts`      | SQLite 기반 승인 DB (TTL 지원)                                       |
| `pattern-parser.ts`   | `Tool(pattern)` 문법 파싱                                            |
| `wildcard.ts`         | Glob 패턴 매칭 헬퍼                                                  |
| `trust-tiers.ts`      | T0~T3 tier 판별                                                      |
| `audit-log.ts`        | JSONL 감사 로그 (`.dhelix/audit.jsonl`)                              |

> 이전 문서가 언급한 `policy-engine.ts` / `policy-bundles.ts` / `siem-export.ts`는 현재 소스에 존재하지 않음 (로드맵).

## Sandbox Layers (`src/sandbox/`)

| Layer             | File                                             | Platform | 방식                                  |
| ----------------- | ------------------------------------------------ | -------- | ------------------------------------- |
| Env Sanitizer     | `env-sanitizer.ts`                               | All      | 환경변수 정제 (30+ secrets blacklist) |
| Process Sandbox   | `process-sandbox.ts`                             | All      | 파일시스템 정책 + PATH 제한           |
| Seatbelt          | `seatbelt.ts`                                    | macOS    | `sandbox-exec` S-expression 프로파일  |
| Bubblewrap        | `bubblewrap.ts`                                  | Linux    | 네임스페이스 격리 (WSL2 지원)         |
| Container         | `container.ts`                                   | Docker   | `--read-only --network none`          |
| Network Policy    | `network-policy.ts` + `network-policy-schema.ts` | All      | allow/deny host 규칙 (Zod 스키마)     |
| Network Proxy     | `network-proxy.ts`                               | All      | HTTP 프록시 게이트                    |
| Sandboxed Network | `sandboxed-network.ts`                           | All      | fetch wrapper + 정책 적용             |
| Linux Helpers     | `linux.ts`                                       | Linux    | cgroup/namespace 유틸리티             |

## Guardrails (`src/guardrails/`)

| 모듈                    | 역할                                               |
| ----------------------- | -------------------------------------------------- |
| `secret-scanner.ts`     | 정규식 기반 API 키/비밀번호 감지 (ReDoS 방어 적용) |
| `entropy-scanner.ts`    | Shannon 엔트로피 기반 고엔트로피 문자열 감지       |
| `command-filter.ts`     | 위험 셸 명령 차단 (`rm -rf`, `dd`, fork bomb 등)   |
| `path-filter.ts`        | 경로 탈출 + 민감 경로 접근 차단 (`/etc`, `~/.ssh`) |
| `injection-detector.ts` | 프롬프트 인젝션 패턴 감지                          |
| `output-masker.ts`      | 도구 출력에서 시크릿 마스킹 (prefix 보존)          |
| `output-limiter.ts`     | 토큰/문자 제한                                     |
| `index.ts`              | `Guardrails` 파사드 — 4-stage tool pipeline에 통합 |

## Logger Redaction

- `src/utils/logger.ts` (pino)에 16개 API 키 패턴 redaction 경로 등록
- 새 민감 필드 도입 시 redaction paths 추가 필수

## 주의사항

- Trust tier 결정은 `PermissionManager`가 담당 — 수동 우회 금지
- 샌드박스 layer는 플랫폼별 감지 (`utils/platform.ts`) 후 선택 적용
- `.dhelix/audit.jsonl`은 반드시 `.gitignore`에 포함
- Guardrails는 도구 실행 4-stage pipeline에서 input/output 양방향 적용
