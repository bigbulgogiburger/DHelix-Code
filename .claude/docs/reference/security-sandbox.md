# Security & Sandbox

> 참조 시점: 보안 정책 변경, 샌드박스 설정, 권한 시스템 수정 시

## Trust Tiers (`permissions/trust-tiers.ts`)

| Tier | 대상 | 기본 정책 |
|------|------|----------|
| T0 (BuiltIn) | 29개 core tools | 전체 허용 |
| T1 (LocallyAuthored) | `~/.dhelix/skills/` | Trust-on-first-use |
| T2 (ProjectShared) | `{project}/.dhelix/` | Review required |
| T3 (External) | npm, remote MCP | OS-level sandbox |

## Permission System

- **PolicyEngine** (`permissions/policy-engine.ts`) — TOML 기반 실행 정책, specificity-first
- **ApprovalDatabase** (`permissions/approval-db.ts`) — SQLite persistent approval (TTL)
- **PolicyBundles** (`permissions/policy-bundles.ts`) — restrictive/permissive/enterprise 프리셋
- **SIEM Export** (`permissions/siem-export.ts`) — JSON Lines + CEF + LEEF 감사 로그

## Sandbox Layers

| Layer | File | Platform | 방식 |
|-------|------|----------|------|
| Env Sanitizer | `sandbox/env-sanitizer.ts` | All | 환경변수 정제 (30+ secrets blacklist) |
| Process Sandbox | `sandbox/process-sandbox.ts` | All | 파일시스템 정책 + PATH 제한 |
| Seatbelt | `sandbox/seatbelt.ts` | macOS | S-expression 프로파일 |
| Bubblewrap | `sandbox/bubblewrap.ts` | Linux | 네임스페이스 격리 (WSL2 지원) |
| Container | `sandbox/container.ts` | Docker | `--read-only --network none` |

## Guardrails (`guardrails/`)

- **injection-detector** — 13개 인젝션 타입 감지
- **secret-scanner** — 28+ 시크릿 패턴 + ReDoS 방어
- **output-masker** — 도구 출력 시크릿 마스킹 (prefix 보존)
- **entropy-scanner** — 고엔트로피 문자열 감지
