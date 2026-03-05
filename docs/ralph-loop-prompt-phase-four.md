### >>> ACTIVE PHASE: 4 — Security (주 7-8) <<<

**Goal**: 프로덕션 수준의 보안 가드레일

**Deliverables** (ordered by dependency):

1. `src/guardrails/types.ts` — GuardrailResult, FilterAction, AuditEntry types
2. `src/guardrails/secret-scanner.ts` — Secret detection (15+ patterns: API keys, tokens, passwords + entropy-based detection)
3. `src/guardrails/input-filter.ts` — Input filtering (sensitive data masking for external LLM mode, injection defense)
4. `src/guardrails/output-filter.ts` — Output filtering (harmful code blocking, response length limits)
5. `src/guardrails/audit-logger.ts` — Audit logging with SHA-256 hash chain, log rotation
6. `src/guardrails/rate-limiter.ts` — Sliding window rate limiting (requests/minute)
7. `src/guardrails/token-budget.ts` — Token budget management (daily/session limits, `--max-budget-usd`)
8. `src/guardrails/content-policy.ts` — Content policy engine (custom rule files)
9. `src/guardrails/manager.ts` — Guardrail orchestrator (chains all filters in order)
10. `src/sandbox/types.ts` — SandboxConfig, SandboxProfile interfaces
11. `src/sandbox/manager.ts` — Platform-specific sandbox dispatcher
12. `src/sandbox/macos-seatbelt.ts` — macOS sandbox-exec Seatbelt profile generation
13. `src/sandbox/windows-appcontainer.ts` — Windows AppContainer + Job Objects
14. `.dbcodeignore` — Secret scan exclusion patterns (like .gitignore)
15. Update `src/core/agent-loop.ts` — Integrate guardrails (input filter before LLM, output filter after)
16. Update `src/tools/definitions/bash-exec.ts` — Run commands inside sandbox
17. Security profile auto-switching: local mode (basic) vs external mode (full guardrails)
18. Unit tests for secret-scanner, input/output filters, rate-limiter, token-budget, audit-logger

**Acceptance Criteria**:

- [ ] `npm run build` succeeds with zero errors
- [ ] `npm test` — all unit tests pass
- [ ] ESLint + Prettier pass with zero warnings
- [ ] No circular dependencies (verify with `madge --circular`)
- [ ] External LLM mode: file containing API key → auto-masked before sending to LLM
- [ ] Secret scanner detects: AWS keys, GitHub tokens, private keys, generic high-entropy strings
- [ ] Rate limiter: exceeding 60 req/min triggers throttling
- [ ] Token budget: daily limit enforcement with warning at 80%
- [ ] Audit log: every tool call recorded with SHA-256 hash chain
- [ ] macOS: bash_exec runs inside Seatbelt sandbox (filesystem + network restrictions)
- [ ] Windows: bash_exec runs inside AppContainer (when available)
- [ ] `.dbcodeignore` patterns exclude specified files from secret scanning
- [ ] Security profile auto-switches based on LLM config (local vs external baseURL)
