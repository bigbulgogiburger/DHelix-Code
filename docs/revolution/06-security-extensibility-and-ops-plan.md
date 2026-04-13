# Security, Extensibility, and Operational Hardening Plan

> **Version**: 2.0 (2026-04-04) — Full rewrite incorporating OpenCode/Codex 벤치마킹 결과 및 2026 enterprise 트렌드
>
> **Scope**: 보안 posture 평가, 샌드박싱 전략, 퍼미션 진화, Trust Tier 모델, Guardrails 강화, 운영 관측성, Enterprise 준비, 검증 전략

## Why This Matters

Frontier coding agents are becoming **runtime platforms**. 사용자의 파일 시스템, 셸, 네트워크에 직접 접근하는 에이전트는 더 이상 "도구"가 아니라 **신뢰 경계(trust boundary)** 그 자체다.

DHelix는 이미 평균 이상의 guardrails를 가지고 있다. 하지만 OpenCode의 정교한 permission 시스템과 Codex의 OS-level sandboxing을 벤치마킹한 결과, **필터 기반 방어에서 정책 아키텍처(policy architecture)로의 전환**이 필수적이다.

Evidence anchors:

- DHelix: `src/guardrails/`, `src/permissions/`, `src/hooks/`, `src/mcp/`, `src/skills/`
- OpenCode: wildcard permissions, bash arity system, doom loop detection, SQLite permission DB
- Codex: Seatbelt (macOS), Landlock+bubblewrap (Linux), TOML execution policies

---

## 1. Security Posture Assessment

### 1.1 Current Strengths

DHelix의 보안 기반은 **경쟁 제품 대비 상당히 구조적**이다:

| Component             | Location                               | 평가                                                            |
| --------------------- | -------------------------------------- | --------------------------------------------------------------- |
| **InjectionDetector** | `src/guardrails/injection-detector.ts` | 8가지 injection 유형 탐지 — 대부분의 오픈소스 에이전트보다 우수 |
| **EntropyScanner**    | `src/guardrails/entropy-scanner.ts`    | High-entropy string 탐지로 토큰/키 유출 방지                    |
| **SecretScanner**     | `src/guardrails/secret-scanner.ts`     | 250+ 패턴 — AWS, GCP, Azure, GitHub 등 주요 서비스 커버         |
| **CommandFilter**     | `src/guardrails/command-filter.ts`     | 위험 명령어 필터링 (`rm -rf /`, `dd`, `mkfs` 등)                |
| **PathFilter**        | `src/guardrails/path-filter.ts`        | 프로젝트 외부 경로 접근 제어                                    |
| **OutputLimiter**     | `src/guardrails/output-limiter.ts`     | 도구 출력 크기 제한으로 context 오염 방지                       |
| **Permission Modes**  | `src/permissions/modes.ts`             | 5-mode system (default → bypassPermissions)                     |
| **Audit Log**         | `src/permissions/audit-log.ts`         | 퍼미션 결정 기록                                                |
| **Pattern Parser**    | `src/permissions/pattern-parser.ts`    | Wildcard 기반 규칙 매칭                                         |
| **ReDoS Protection**  | Guardrails 전반                        | 10K char 절삭으로 ReDoS 공격 방어                               |

### 1.2 Critical Gaps

#### Gap A: OS-Level Sandboxing 부재 (vs Codex — 가장 큰 격차)

Codex는 **플랫폼별 OS-level 격리**를 구현한다:

```
┌─────────────────────────────────────────────────────┐
│ Codex Sandboxing                                     │
├─────────────┬───────────────────────────────────────┤
│ macOS       │ sandbox-exec + Seatbelt SBPL policies │
│ Linux       │ Landlock LSM + bubblewrap + seccomp   │
│ Windows     │ Restricted process tokens              │
└─────────────┴───────────────────────────────────────┘
```

DHelix는 현재 **프로세스 격리 없이** 도구를 실행한다. `bash_exec`가 사용자의 전체 파일 시스템과 네트워크에 접근 가능하다. 이것은 단순한 개선 사항이 아니라 **enterprise 도입의 차단 요인**이다.

#### Gap B: Permission Granularity 부족 (vs OpenCode)

OpenCode의 퍼미션 시스템:

- **Wildcard 매칭** with longest-match-wins 전략
- **162개 명령어 사전** (bash arity system) — `git commit -m` vs `git push --force` 구분
- **도구별 기본값 차등화** — bash는 엄격, file read는 관대
- **에이전트 레벨 기본값** — build agent vs plan agent
- **SQLite 영구 저장** — 세션 간 approval 지속
- **Doom loop detection** — 동일 호출 3회 반복 시 자동 중단

DHelix의 5-mode 시스템은 **전역 수준**이며, 도구별/명령어별 세밀한 제어가 불가능하다.

#### Gap C: Tool Output Secret Masking 미구현

`SecretScanner`는 **입력** 검사에 집중되어 있다. 도구 실행 결과에 포함된 secrets (예: `env` 출력에 노출된 API 키)가 LLM context에 그대로 전달될 수 있다.

#### Gap D: MCP/Skills Supply Chain 검증 없음

외부 MCP 서버와 skills는 **무결성 검증 없이** 로드된다. 악의적 MCP 서버가 시스템 도구를 재정의하거나, 스킬이 shell injection을 포함할 수 있다.

#### Gap E: Rate Limiting 부재

도구 실행에 대한 rate limiting이 없어 **무한 루프 또는 리소스 소진** 공격에 취약하다.

#### Gap F: 사용자 수준 정책/RBAC 없음

개인 개발자에게는 문제가 되지 않지만, **팀/enterprise 환경**에서 정책 관리가 불가능하다.

---

## 2. Sandboxing Strategy

### 2.1 Architecture Decision: Phased Approach (Codex-Inspired)

Codex의 full OS-level sandbox를 최종 목표로 하되, **점진적 3-phase 접근**을 채택한다.

```
Phase 1 (P0)          Phase 2 (P1)           Phase 3 (P2)
Process Isolation  →   OS-Level Sandbox   →   Container/microVM
─────────────────      ────────────────       ─────────────────
- restricted env       - macOS Seatbelt       - Docker isolation
- path allow/deny      - Linux Landlock       - gVisor/Firecracker
- network controls     - seccomp filters      - per-task VMs
- UID/GID isolation    - file policy SBPL     - ephemeral envs
```

### 2.2 Phase 1: Process-Level Isolation (Target: v0.4.0)

**목표**: `bash_exec`, `bash_output` 실행 시 **제한된 자식 프로세스** 환경 제공

#### 2.2.1 Restricted Environment Variables

```typescript
// src/sandbox/process-sandbox.ts (planned)
interface ProcessSandboxConfig {
  readonly allowedEnvVars: ReadonlySet<string>; // whitelist
  readonly deniedEnvVars: ReadonlySet<string>; // blacklist (secrets 제거)
  readonly inheritPath: boolean; // PATH 상속 여부
  readonly customPath?: string; // 제한된 PATH
  readonly workingDir: string; // CWD 고정
  readonly timeout: number; // ms
  readonly maxOutputSize: number; // bytes
}
```

#### 2.2.2 Filesystem Access Policy

```typescript
interface FilesystemPolicy {
  readonly allowedPaths: readonly PathRule[];
  readonly deniedPaths: readonly PathRule[];
  readonly mode: "read" | "write" | "execute";
}

interface PathRule {
  readonly pattern: string; // glob pattern
  readonly recursive: boolean;
  readonly reason: string; // policy provenance
}
```

**기본 정책**:

| Path               | Access     | Reason              |
| ------------------ | ---------- | ------------------- |
| `{projectRoot}/**` | read/write | 프로젝트 파일 작업  |
| `~/.dhelix/**`     | read       | 설정 읽기           |
| `/tmp/dhelix-*/**` | read/write | 임시 파일           |
| `~/.ssh/**`        | deny       | SSH 키 보호         |
| `~/.aws/**`        | deny       | AWS 자격 증명 보호  |
| `~/.gnupg/**`      | deny       | GPG 키 보호         |
| `/etc/passwd`      | deny       | 시스템 파일 보호    |
| `~/.env*`          | deny       | 환경 변수 파일 보호 |

#### 2.2.3 Network Control

```typescript
interface NetworkPolicy {
  readonly allowOutbound: boolean; // 기본: true (개발 필요)
  readonly allowedHosts: readonly string[]; // whitelist mode
  readonly deniedHosts: readonly string[]; // blacklist mode
  readonly allowLoopback: boolean; // localhost 허용
  readonly maxConnections: number; // 동시 연결 제한
}
```

Phase 1에서는 `child_process.spawn`의 `env` 옵션을 활용하여 구현. OS-level enforcement는 없지만 **대부분의 우발적 유출을 방지**한다.

#### 2.2.4 Implementation Path

```
src/sandbox/
├── process-sandbox.ts         # child_process wrapper
├── policy-loader.ts           # TOML/JSON 정책 파일 로딩
├── filesystem-policy.ts       # 경로 접근 제어
├── network-policy.ts          # 네트워크 접근 제어
├── env-sanitizer.ts           # 환경 변수 정제
└── types.ts                   # 공유 타입
```

### 2.3 Phase 2: OS-Level Sandbox (Target: v0.4.0)

**목표**: Codex와 동등한 OS-level enforcement

#### 2.3.1 macOS: Seatbelt Integration

```scheme
;; .dhelix/sandbox/macos.sb (Seatbelt policy example)
(version 1)
(deny default)

;; Allow read access to project directory
(allow file-read*
  (subpath "${PROJECT_ROOT}"))

;; Allow write to project and temp
(allow file-write*
  (subpath "${PROJECT_ROOT}")
  (subpath "/tmp/dhelix-${SESSION_ID}"))

;; Allow network for development servers
(allow network-outbound
  (remote ip "localhost:*"))

;; Deny sensitive paths
(deny file-read*
  (subpath "${HOME}/.ssh")
  (subpath "${HOME}/.aws")
  (subpath "${HOME}/.gnupg"))

;; Allow process execution (restricted)
(allow process-exec
  (literal "/bin/sh")
  (literal "/usr/bin/env"))
```

**실행 방식**:

```typescript
// macOS sandbox execution
const sandboxedExec = (cmd: string, policy: string): ChildProcess => {
  return spawn("sandbox-exec", ["-f", policy, "/bin/sh", "-c", cmd], {
    env: sanitizedEnv,
    cwd: projectRoot,
  });
};
```

#### 2.3.2 Linux: Landlock + seccomp

```typescript
// Linux sandbox layers
interface LinuxSandbox {
  readonly landlock: {
    readonly readPaths: readonly string[];
    readonly writePaths: readonly string[];
    readonly executePaths: readonly string[];
  };
  readonly seccomp: {
    readonly allowedSyscalls: readonly string[];
    readonly deniedSyscalls: readonly string[]; // fork bomb 방지 등
  };
  readonly namespaces: {
    readonly network: boolean; // network namespace 격리
    readonly pid: boolean; // PID namespace 격리
    readonly mount: boolean; // mount namespace 격리
  };
}
```

bubblewrap(`bwrap`)를 래핑하여 구현:

```bash
bwrap \
  --ro-bind /usr /usr \
  --bind ${PROJECT_ROOT} ${PROJECT_ROOT} \
  --tmpfs /tmp \
  --unshare-net \          # 네트워크 격리 (옵션)
  --die-with-parent \
  --new-session \
  /bin/sh -c "${COMMAND}"
```

#### 2.3.3 Platform Detection & Fallback

```typescript
// src/sandbox/platform-detector.ts
type SandboxLevel = "os-native" | "process-restricted" | "unrestricted";

const detectSandboxCapability = (): SandboxLevel => {
  if (process.platform === "darwin" && hasSandboxExec()) return "os-native";
  if (process.platform === "linux" && hasLandlock()) return "os-native";
  if (canRestrictEnv()) return "process-restricted";
  return "unrestricted";
};
```

**Fallback 전략**: OS-level sandbox 불가 시 Phase 1의 process isolation으로 자동 fallback + 경고 표시.

### 2.4 Phase 3: Container/microVM Isolation (Target: v0.6.0+)

**목표**: 고위험 작업에 대한 완전한 격리

- Docker 기반 임시 컨테이너에서 도구 실행
- gVisor 또는 Firecracker microVM으로 커널 수준 격리
- 세션별 ephemeral 환경 — 작업 완료 후 자동 삭제
- Enterprise에서 "untrusted code execution" 시나리오 지원

이 단계는 **remote/background agent 실행**과 결합하여 Codex의 cloud sandbox 모델과 동등한 위치를 확보한다.

---

## 3. Permission System Evolution

### 3.1 Current State → Target State

```
Current (v0.2.0)                    Target (v0.4.0)
────────────────                    ────────────────
5 global modes                  →   Tool-specific granular policies
Session-only memory             →   Persistent approval DB (SQLite)
Binary allow/deny               →   allow/ask/deny 3-action model
No command analysis              →   Arity-based command matching
No agent-level defaults          →   Role-specific permission profiles
No doom loop detection           →   Repetition circuit breaker
```

### 3.2 Execution Policy Engine

OpenCode의 TOML 기반 정책과 Codex의 execution policy를 결합한 **하이브리드 정책 엔진** 도입.

#### 3.2.1 Policy File Format

```toml
# .dhelix/policies/default.toml

[tool.bash_exec]
default_action = "ask"
timeout_ms = 30000
max_output_bytes = 1048576

[tool.bash_exec.rules]
# Allow common development commands
allow = [
  "npm *",
  "node *",
  "git status",
  "git diff *",
  "git log *",
  "git add *",
  "git commit *",
  "ls *",
  "cat *",
  "head *",
  "tail *",
  "wc *",
  "find * -name *",
  "grep *",
  "rg *",
]

# Always ask for confirmation
ask = [
  "git push *",
  "git checkout *",
  "git reset *",
  "git rebase *",
  "npm publish *",
  "docker *",
  "curl *",
  "wget *",
]

# Always deny
deny = [
  "rm -rf /",
  "rm -rf /*",
  "dd if=*",
  "mkfs.*",
  ":(){:|:&};:",
  "chmod -R 777 /",
  "sudo *",           # 기본 deny, 명시적 override 가능
]

[tool.file_write]
default_action = "allow"

[tool.file_write.rules]
deny = [
  "~/.ssh/*",
  "~/.aws/*",
  "~/.gnupg/*",
  "/etc/*",
  "*.env",
  "*.pem",
  "*.key",
]

[tool.file_read]
default_action = "allow"       # 읽기는 기본 허용

[tool.web_fetch]
default_action = "ask"
timeout_ms = 10000

[tool.agent]
default_action = "allow"       # 서브에이전트는 부모 정책 상속
```

#### 3.2.2 Arity-Based Command Matching (OpenCode 방식)

```typescript
// src/permissions/arity-matcher.ts

interface CommandArity {
  readonly command: string;
  readonly subcommands: readonly string[];
  readonly flags: readonly string[];
  readonly riskLevel: "safe" | "moderate" | "dangerous";
}

// 162+ 명령어 사전 (OpenCode 수준)
const COMMAND_DICTIONARY: ReadonlyMap<string, CommandArity> = new Map([
  [
    "git",
    {
      command: "git",
      subcommands: [
        "status",
        "diff",
        "log",
        "add",
        "commit",
        "push",
        "pull",
        "checkout",
        "reset",
        "rebase",
        "branch",
      ],
      flags: ["--force", "--hard", "-D", "--no-verify"],
      riskLevel: "moderate",
    },
  ],
  [
    "npm",
    {
      command: "npm",
      subcommands: ["install", "run", "test", "build", "publish", "exec"],
      flags: ["--registry", "--global"],
      riskLevel: "moderate",
    },
  ],
  // ... 160+ more entries
]);

// Longest-match-wins 전략
const matchPermission = (cmd: string, rules: PolicyRules): "allow" | "ask" | "deny" => {
  const parsed = parseCommand(cmd);
  // 가장 구체적인 규칙이 우선
  // "git push --force" > "git push *" > "git *" > "*"
  return findLongestMatch(parsed, rules);
};
```

#### 3.2.3 Persistent Approval Database

```typescript
// src/permissions/persistent-store.ts (기존 확장)

interface ApprovalRecord {
  readonly id: string;
  readonly tool: string;
  readonly command: string; // normalized
  readonly action: "allow" | "deny";
  readonly scope: "session" | "project" | "global";
  readonly createdAt: number;
  readonly expiresAt: number | null; // TTL support
  readonly source: PolicyProvenance; // 결정 출처 추적
}

// SQLite 기반 영구 저장
// 위치: ~/.dhelix/permissions.db (global), .dhelix/permissions.db (project)
```

#### 3.2.4 Agent-Level Permission Profiles

```toml
# .dhelix/policies/agent-profiles.toml

[profile.build]
# 빌드 에이전트: 파일 쓰기 + 셸 실행 허용, 네트워크 제한
tool_defaults = { bash_exec = "allow", file_write = "allow", web_fetch = "deny" }

[profile.plan]
# 계획 에이전트: 읽기 전용 + 검색만
tool_defaults = { bash_exec = "ask", file_write = "deny", file_read = "allow", grep_search = "allow" }

[profile.explore]
# 탐색 에이전트: 읽기 + 웹 검색
tool_defaults = { file_read = "allow", web_search = "allow", web_fetch = "allow", file_write = "deny" }

[profile.compaction]
# 컴팩션 에이전트: 최소 권한
tool_defaults = { file_read = "allow" }
```

#### 3.2.5 Doom Loop Detection (OpenCode 방식)

```typescript
// src/permissions/doom-loop-detector.ts

interface DoomLoopConfig {
  readonly maxIdenticalCalls: number; // default: 3
  readonly windowMs: number; // default: 60000 (1분)
  readonly action: "break" | "ask" | "warn";
}

// 동일한 도구 + 동일한 인자로 3회 반복 호출 시 자동 중단
// Agent loop의 circuit breaker와 연동
```

### 3.3 Policy Provenance Tracking

모든 퍼미션 결정에 대해 **왜 그 결정이 내려졌는지** 추적:

```typescript
interface PolicyProvenance {
  readonly decision: "allow" | "ask" | "deny";
  readonly source:
    | "builtin"
    | "user-policy"
    | "project-policy"
    | "admin-policy"
    | "persistent-approval";
  readonly rule: string; // 매칭된 규칙 텍스트
  readonly file: string; // 정책 파일 경로
  readonly line: number; // 정책 파일 라인
  readonly overriddenBy?: string; // 상위 정책에 의한 override 시
  readonly timestamp: number;
  readonly sessionId: string;
}
```

---

## 4. Trust Tier Model

### 4.1 Four-Tier Classification

코드, 도구, MCP 서버, 스킬 등 모든 확장 가능한 요소에 대해 **4단계 신뢰 등급** 적용:

> **Note:** Skills는 추가로 T4 (Remote URL) 등급을 가질 수 있음. 상세는 05-feature-ecosystem-improvement-plan.md 섹션 3.5 참조.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Trust Tier Model                            │
├───────┬──────────────────┬──────────────────┬───────────────────┤
│ Tier  │ Category          │ Default Policy    │ Sandbox Level     │
├───────┼──────────────────┼──────────────────┼───────────────────┤
│  T0   │ Built-in          │ Fully trusted     │ None              │
│       │ (23 core tools)   │ No approval needed│                   │
├───────┼──────────────────┼──────────────────┼───────────────────┤
│  T1   │ Locally authored  │ User-verified     │ Process isolation │
│       │ (user skills,     │ Trust-on-first-   │                   │
│       │  local MCP)       │ use + persist     │                   │
├───────┼──────────────────┼──────────────────┼───────────────────┤
│  T2   │ Project-shared    │ Review required   │ Process isolation │
│       │ (.dhelix/ in repo,│ Per-session       │ + restricted env  │
│       │  team policies)   │ approval          │                   │
├───────┼──────────────────┼──────────────────┼───────────────────┤
│  T3   │ External/MCP      │ Sandboxed         │ OS-level sandbox  │
│       │ (npm skills,      │ Explicit opt-in   │ + network control │
│       │  remote MCP)      │ per capability    │                   │
└───────┴──────────────────┴──────────────────┴───────────────────┘
```

### 4.2 Tier Assignment Rules

```typescript
// src/trust/tier-resolver.ts

const resolveTier = (source: ExtensionSource): TrustTier => {
  // T0: Built-in tools defined in src/tools/
  if (source.type === "builtin") return TrustTier.BuiltIn;

  // T1: Files in ~/.dhelix/skills/ or local MCP in user config
  if (source.type === "skill" && source.location.startsWith(homedir()))
    return TrustTier.LocallyAuthored;

  // T2: Files in {project}/.dhelix/ committed to repo
  if (source.type === "skill" && source.location.startsWith(projectRoot))
    return TrustTier.ProjectShared;

  // T2: MCP servers defined in project config
  if (source.type === "mcp" && source.scope === "project") return TrustTier.ProjectShared;

  // T3: Everything else
  return TrustTier.External;
};
```

### 4.3 Tier-Specific Policy Defaults

| Capability           | T0               | T1    | T2    | T3   |
| -------------------- | ---------------- | ----- | ----- | ---- |
| File read (project)  | allow            | allow | allow | ask  |
| File write (project) | allow            | allow | ask   | deny |
| Shell execution      | allow (filtered) | ask   | ask   | deny |
| Network outbound     | allow            | ask   | deny  | deny |
| Spawn subprocess     | allow            | ask   | deny  | deny |
| Access secrets       | N/A              | deny  | deny  | deny |
| Modify permissions   | N/A              | deny  | deny  | deny |

### 4.4 MCP Server Trust Verification

```typescript
// src/trust/mcp-verifier.ts

interface McpTrustCheck {
  readonly server: string;
  readonly tier: TrustTier;
  readonly checks: {
    readonly configSource: "user" | "project" | "external";
    readonly transportSecurity: "stdio" | "sse-https" | "sse-http";
    readonly toolCount: number;
    readonly hasResourceAccess: boolean;
    readonly lastVerified: number;
    readonly checksumMatch: boolean; // 무결성 검증
  };
}
```

### 4.5 Skill Trust Verification

```typescript
// src/trust/skill-verifier.ts

interface SkillTrustCheck {
  readonly path: string;
  readonly tier: TrustTier;
  readonly checks: {
    readonly hasShellExecution: boolean; // shell injection 가능성
    readonly hasDynamicImport: boolean; // dynamic code loading
    readonly hasNetworkAccess: boolean; // fetch/http 사용
    readonly hasFileSystemAccess: boolean; // fs 모듈 사용
    readonly sourceHash: string; // 변경 감지
    readonly lastReviewedAt: number | null; // 사용자 검토 시점
  };
}
```

---

## 5. Guardrails Enhancement

### 5.1 Current Guardrails Quality: 80% → Target: 95%

현재 guardrails는 **regex 기반 패턴 매칭**에 의존한다. 이는 대부분의 공격을 차단하지만, sophisticated adversarial prompts에 취약하다.

### 5.2 ML-Based Injection Detection (Phase 2)

```typescript
// src/guardrails/ml-injection-detector.ts (planned)

interface MlDetectionConfig {
  readonly model: "local-classifier" | "embedding-similarity";
  readonly threshold: number; // 0.0 ~ 1.0
  readonly fallbackToRegex: boolean; // ML 실패 시 regex fallback
}

// Phase 2a: Embedding similarity 기반
// - 알려진 injection 패턴의 embedding 벡터 DB 구축
// - 입력 텍스트와 cosine similarity 비교
// - 0.85 이상 시 injection 의심

// Phase 2b: Local classifier (ONNX Runtime)
// - 경량 분류 모델 (~5MB)
// - 8가지 injection 유형에 대한 multi-label classification
// - latency target: < 10ms per check
```

### 5.3 Output Secret Masking

**도구 실행 결과**에서 secrets를 탐지하고 마스킹:

```typescript
// src/guardrails/output-masker.ts (planned)

interface OutputMaskingConfig {
  readonly enabled: boolean;
  readonly patterns: readonly SecretPattern[]; // SecretScanner 패턴 재사용
  readonly maskChar: string; // default: '*'
  readonly preserveLength: boolean; // 길이 유지 여부
  readonly logMaskedCount: boolean; // 마스킹 횟수 로깅
}

// 적용 시점:
// 1. bash_exec/bash_output 실행 결과
// 2. file_read 결과 (env 파일 등)
// 3. MCP tool 실행 결과
// 4. 모든 도구 결과가 LLM context에 추가되기 전
```

**마스킹 예시**:

```
Before: export OPENAI_API_KEY=sk-proj-abc123def456ghi789
After:  export OPENAI_API_KEY=sk-proj-****************************
```

### 5.4 Rate Limiting Per Tool

```typescript
// src/guardrails/rate-limiter.ts (planned)

interface RateLimitConfig {
  readonly tool: string;
  readonly maxCalls: number;
  readonly windowMs: number;
  readonly action: "block" | "ask" | "warn" | "throttle";
}

// 기본 rate limits
const DEFAULT_LIMITS: readonly RateLimitConfig[] = [
  { tool: "bash_exec", maxCalls: 50, windowMs: 60000, action: "warn" },
  { tool: "file_write", maxCalls: 100, windowMs: 60000, action: "warn" },
  { tool: "web_fetch", maxCalls: 20, windowMs: 60000, action: "ask" },
  { tool: "web_search", maxCalls: 10, windowMs: 60000, action: "ask" },
  { tool: "agent", maxCalls: 5, windowMs: 60000, action: "ask" },
];
```

### 5.5 Supply Chain Verification for MCP/Skills

```typescript
// src/guardrails/supply-chain.ts (planned)

interface SupplyChainConfig {
  readonly verifyChecksums: boolean; // SHA-256 무결성 검증
  readonly lockfileRequired: boolean; // .dhelix/skills.lock
  readonly allowedRegistries: readonly string[]; // npm, github
  readonly maxSkillSize: number; // bytes
  readonly scanForMalware: boolean; // 기본 정적 분석
}

// Skills lockfile 예시: .dhelix/skills.lock
// {
//   "skills": {
//     "my-custom-skill": {
//       "version": "1.0.0",
//       "sha256": "abc123...",
//       "source": "~/.dhelix/skills/my-custom-skill.md",
//       "verifiedAt": "2026-04-04T00:00:00Z",
//       "tier": "T1"
//     }
//   }
// }
```

### 5.6 Enhanced Injection Detection Patterns

현재 8가지 유형에 추가:

| #   | 유형                          | 설명                       | 탐지 방법                   |
| --- | ----------------------------- | -------------------------- | --------------------------- |
| 9   | **Indirect prompt injection** | 파일/URL 내 숨겨진 지시    | Context source 태깅 + 분리  |
| 10  | **Tool result injection**     | 도구 출력에 삽입된 지시    | Result boundary enforcement |
| 11  | **Unicode confusable**        | 시각적으로 동일한 유니코드 | Confusable mapping table    |
| 12  | **Tokenization exploit**      | 토크나이저 경계 조작       | Pre-tokenization 정규화     |
| 13  | **Multi-turn escalation**     | 점진적 권한 확대           | Session-level 행동 분석     |

---

## 6. Operational Observability

### 6.1 Runtime Metrics Dashboard

```typescript
// src/observability/metrics-collector.ts (planned)

interface RuntimeMetrics {
  // Session health
  readonly sessionDuration: number;
  readonly loopIterations: number;
  readonly totalTokensUsed: number;
  readonly compactionCount: number;
  readonly compactionQuality: number; // 0.0 ~ 1.0

  // Tool execution
  readonly toolCalls: ReadonlyMap<string, ToolMetrics>;
  readonly permissionWaitTime: number; // 사용자 승인 대기 총 시간
  readonly permissionDenyCount: number;

  // Error tracking
  readonly toolErrors: readonly ToolError[];
  readonly retryCount: number;
  readonly circuitBreakerTrips: number;

  // Resource usage
  readonly peakMemoryMB: number;
  readonly activeChildProcesses: number;
  readonly openFileHandles: number;
}

interface ToolMetrics {
  readonly callCount: number;
  readonly totalDurationMs: number;
  readonly avgDurationMs: number;
  readonly p99DurationMs: number;
  readonly errorCount: number;
  readonly lastCallAt: number;
}
```

### 6.2 MCP Connection & Auth State Monitoring

```typescript
// src/observability/mcp-monitor.ts (planned)

interface McpConnectionState {
  readonly server: string;
  readonly status: "connected" | "connecting" | "disconnected" | "error" | "auth-pending";
  readonly transport: "stdio" | "sse";
  readonly uptime: number;
  readonly reconnectCount: number;
  readonly lastError: string | null;
  readonly lastHealthCheck: number;
  readonly toolCount: number;
  readonly latencyMs: number; // 최근 응답 지연
}

// 자동 health check: 30초 간격 ping
// 3회 연속 실패 시 reconnect
// 5회 연속 실패 시 서버 비활성화 + 사용자 알림
```

### 6.3 Hook Failure Tracking

```typescript
// src/observability/hook-tracker.ts (planned)

interface HookExecutionRecord {
  readonly hookName: string;
  readonly trigger: string; // file pattern, event name
  readonly startedAt: number;
  readonly completedAt: number | null;
  readonly exitCode: number | null;
  readonly stderr: string | null;
  readonly status: "success" | "failed" | "timeout" | "skipped";
}

// Hook failures 누적 시 경고:
// "auto-lint hook has failed 5 times in this session. Consider disabling."
```

### 6.4 Compaction Anomaly Detection

```typescript
// src/observability/compaction-monitor.ts (planned)

interface CompactionAnomaly {
  readonly type:
    | "excessive-frequency" // 비정상적으로 잦은 compaction
    | "quality-degradation" // compaction 후 품질 저하
    | "context-loss" // 중요 context 유실 감지
    | "tool-pair-broken" // tool_use/tool_result 쌍 깨짐
    | "summary-drift"; // 요약과 실제 내용 괴리
  readonly severity: "info" | "warning" | "critical";
  readonly details: string;
  readonly suggestedAction: string;
}
```

### 6.5 Session Health Metrics

```typescript
// src/observability/session-health.ts (planned)

interface SessionHealth {
  readonly score: number; // 0-100
  readonly indicators: {
    readonly contextUtilization: number; // 컨텍스트 사용률 (%)
    readonly errorRate: number; // 오류 비율
    readonly avgResponseTime: number; // 평균 응답 시간
    readonly toolSuccessRate: number; // 도구 성공률
    readonly compactionHealth: number; // 컴팩션 건전성
    readonly memoryPressure: number; // 메모리 압박도
  };
  readonly alerts: readonly SessionAlert[];
}

// CLI에서 Ctrl+O (verbose mode)로 실시간 확인
// /health 명령어로 상세 대시보드 표시
```

### 6.6 Metrics Export

```typescript
// src/observability/exporter.ts (planned)

interface MetricsExporter {
  // JSON Lines 형식으로 파일 출력
  exportToFile(path: string): Promise<void>;

  // OTLP (OpenTelemetry) 호환 출력
  exportToOTLP(endpoint: string): Promise<void>;

  // StatsD 호환 출력
  exportToStatsD(host: string, port: number): Promise<void>;
}
```

---

## 7. Enterprise Readiness

### 7.1 Managed Policy Bundles

Enterprise 관리자가 **조직 전체에 보안 정책을 배포**할 수 있는 메커니즘:

```typescript
// Policy bundle format
interface PolicyBundle {
  readonly version: string;
  readonly issuer: string; // 조직명
  readonly signature: string; // 정책 서명 (무결성)
  readonly policies: {
    readonly permissions: PermissionPolicy;
    readonly sandbox: SandboxPolicy;
    readonly network: NetworkPolicy;
    readonly trustTiers: TrustTierOverrides;
    readonly rateLimits: RateLimitConfig[];
  };
  readonly enforcement: "strict" | "advisory"; // strict: 사용자 override 불가
  readonly expiresAt: string; // 정책 만료일
}
```

**배포 경로**:

```
Organization Admin
    │
    ├── ~/.dhelix/policies/org-policy.toml      (개인에게 배포)
    ├── {repo}/.dhelix/policies/team-policy.toml (프로젝트에 포함)
    └── https://policy.company.com/dhelix.toml   (원격 정책 서버)
```

**정책 우선순위** (높은 것이 우선):

```
1. Admin/Org policy (enforcement: strict)  — override 불가
2. Project policy (.dhelix/policies/)       — 프로젝트 규칙
3. User policy (~/.dhelix/policies/)        — 개인 설정
4. Built-in defaults                         — 시스템 기본값
```

### 7.2 Exportable Audit Logs

```typescript
// src/audit/structured-logger.ts (planned)

interface AuditEvent {
  readonly timestamp: string; // ISO 8601
  readonly sessionId: string;
  readonly userId: string;
  readonly eventType:
    | "tool_execution"
    | "permission_decision"
    | "sandbox_violation"
    | "secret_detected"
    | "injection_blocked"
    | "mcp_connection"
    | "policy_loaded"
    | "trust_tier_assigned";
  readonly tool?: string;
  readonly command?: string;
  readonly decision?: string;
  readonly policySource?: string;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly metadata: Record<string, unknown>;
}
```

**출력 형식 지원**:

| Format     | Use Case          | 설명                      |
| ---------- | ----------------- | ------------------------- |
| JSON Lines | SIEM 통합         | Splunk, ELK, Datadog 호환 |
| CSV        | 스프레드시트 분석 | 간단한 리뷰용             |
| OTLP       | OpenTelemetry     | 분산 추적 통합            |
| Syslog     | 기존 로그 시스템  | RFC 5424 호환             |

**CLI 명령어**:

```bash
dhelix audit export --format jsonl --since 2026-04-01 --output audit.jsonl
dhelix audit export --format csv --tool bash_exec --output bash-audit.csv
dhelix audit stats --last 7d     # 최근 7일 통계
```

### 7.3 Environment Egress Controls

```toml
# .dhelix/policies/egress.toml

[network]
# 허용된 외부 호스트
allowed_hosts = [
  "registry.npmjs.org",
  "api.github.com",
  "*.company-internal.com",
]

# 차단된 호스트
denied_hosts = [
  "*.pastebin.com",
  "*.transfer.sh",
  "ngrok.io",
]

# DNS 해석 정책
allow_dns = true
log_dns_queries = true

# 아웃바운드 포트 제한
allowed_ports = [80, 443, 22]
```

### 7.4 SSO/SAML Integration Path

Enterprise 환경에서 **사용자 인증 및 정책 연동**:

```
Phase 1: API Key 기반 인증 (현재)
  └── DHELIX_API_KEY 환경 변수

Phase 2: OAuth 2.1 (v0.4.0-v0.5.0)
  ├── Authorization Code + PKCE
  ├── Device Authorization Flow (CLI 최적)
  └── Refresh token rotation

Phase 3: SAML/SSO (v0.6.0)
  ├── SAML 2.0 IdP 연동
  ├── OIDC 기반 SSO
  ├── 조직별 정책 자동 로딩
  └── SCIM 기반 사용자/그룹 동기화
```

### 7.5 Compliance Features

| Feature              | 설명                              | Target |
| -------------------- | --------------------------------- | ------ |
| **Data residency**   | LLM 호출 시 지역 제한 (EU, US 등) | v0.5.0 |
| **PII detection**    | 개인정보 자동 감지 및 경고        | v0.5.0 |
| **Retention policy** | 세션 로그 자동 만료/삭제          | v0.5.0 |
| **Access control**   | RBAC 기반 도구 접근 제어          | v0.6.0 |
| **SOC 2 Type II**    | 감사 추적 + 접근 통제 증명        | v0.7.0 |

---

## 8. Verification Strategy

### 8.1 Security Feature Testing Matrix

```
┌─────────────────────┬──────────────┬──────────────┬──────────────┐
│ Feature              │ Unit Test    │ Integration  │ Adversarial  │
├─────────────────────┼──────────────┼──────────────┼──────────────┤
│ Process sandbox      │ ✓ env strip  │ ✓ real exec  │ ✓ escape     │
│ OS-level sandbox     │ ✓ policy gen │ ✓ platform   │ ✓ breakout   │
│ Permission engine    │ ✓ matching   │ ✓ SQLite DB  │ ✓ bypass     │
│ Arity matcher        │ ✓ parsing    │ ✓ 162 cmds   │ ✓ evasion    │
│ Trust tier resolver  │ ✓ classify   │ ✓ MCP/skill  │ ✓ escalation │
│ Output masking       │ ✓ patterns   │ ✓ tool chain │ ✓ encoding   │
│ Rate limiter         │ ✓ counting   │ ✓ concurrent │ ✓ burst      │
│ Supply chain verify  │ ✓ checksums  │ ✓ lockfile   │ ✓ tampering  │
│ Injection detection  │ ✓ patterns   │ ✓ ML model   │ ✓ adversarial│
│ Audit logging        │ ✓ format     │ ✓ SIEM export│ ✓ tampering  │
│ Policy bundles       │ ✓ parsing    │ ✓ precedence │ ✓ conflict   │
│ Doom loop detection  │ ✓ counting   │ ✓ agent loop │ ✓ variation  │
└─────────────────────┴──────────────┴──────────────┴──────────────┘
```

### 8.2 Adversarial Test Suite

보안 기능은 **공격자 관점의 테스트**가 필수적이다:

```typescript
// test/adversarial/sandbox-escape.test.ts

describe("Sandbox Escape Prevention", () => {
  it("blocks symlink-based escape from project directory", async () => {
    // 심볼릭 링크를 통한 샌드박스 탈출 시도
  });

  it("blocks /proc/self/fd based escape on Linux", async () => {
    // /proc 파일 시스템을 통한 우회 시도
  });

  it("blocks environment variable injection via command substitution", async () => {
    // $(cat ~/.ssh/id_rsa) 같은 명령어 치환 공격
  });

  it("blocks path traversal via unicode normalization", async () => {
    // ../../../etc/passwd 의 유니코드 변형
  });
});

// test/adversarial/permission-bypass.test.ts

describe("Permission Bypass Prevention", () => {
  it("blocks aliased dangerous commands", async () => {
    // alias rm='rm -rf /' 같은 alias 기반 우회
  });

  it("blocks shell function override attacks", async () => {
    // function git() { curl evil.com; } 같은 함수 재정의
  });

  it("blocks multi-stage privilege escalation", async () => {
    // 1단계: 무해한 명령어 승인 받기
    // 2단계: 승인된 패턴 활용하여 위험 명령어 실행
  });
});

// test/adversarial/injection.test.ts

describe("Advanced Injection Prevention", () => {
  it("detects indirect injection in file contents", async () => {
    // README.md에 숨겨진 "Ignore previous instructions..." 탐지
  });

  it("detects injection via tool result poisoning", async () => {
    // bash_exec 결과에 포함된 adversarial prompt
  });

  it("detects unicode confusable-based injection", async () => {
    // Cyrillic 'а' vs Latin 'a' 같은 confusable 문자
  });
});
```

### 8.3 Regression Test Suite

보안 기능 회귀 방지를 위한 **자동화된 CI 테스트**:

```bash
# CI pipeline 추가
npm run test:security        # 보안 관련 테스트만 실행
npm run test:adversarial     # adversarial 테스트 실행
npm run test:sandbox         # 샌드박스 테스트 (플랫폼별)

# Coverage target
# src/sandbox/      → 90%+
# src/permissions/   → 90%+
# src/guardrails/    → 85%+
# src/trust/         → 85%+
# src/audit/         → 80%+
```

### 8.4 Security Audit Schedule

| 주기      | 활동                        | 담당        |
| --------- | --------------------------- | ----------- |
| 매 릴리스 | Adversarial test suite 실행 | CI 자동화   |
| 월 1회    | SecretScanner 패턴 업데이트 | 보안 팀     |
| 분기 1회  | 외부 penetration test       | 외부 감사   |
| 반기 1회  | 전체 보안 아키텍처 리뷰     | 아키텍처 팀 |

---

## 9. Success Metrics

### 9.1 Security Metrics

| Metric                        | Current        | v0.4.0 Target   | v0.5.0 Target    | v0.6.0 Target       |
| ----------------------------- | -------------- | --------------- | ---------------- | ------------------- |
| **Sandbox coverage**          | 0%             | 60% (process)   | 90% (OS-level)   | 99% (container)     |
| **Permission granularity**    | 5 global modes | Tool-specific   | Command-specific | Capability-specific |
| **Injection detection rate**  | ~80%           | 85% (+ 5 types) | 92% (+ ML)       | 97% (ensemble)      |
| **Secret masking**            | Input only     | + Output        | + Context        | + Audit             |
| **Trust tier coverage**       | None           | T0-T1           | T0-T3            | T0-T3 + remote      |
| **Audit log completeness**    | Basic          | Structured      | SIEM-ready       | SOC 2 compliant     |
| **Supply chain verification** | None           | Checksums       | Lockfile         | Signed packages     |

### 9.2 Operational Metrics

| Metric                            | Current  | v0.4.0 Target        | v0.5.0 Target           |
| --------------------------------- | -------- | -------------------- | ----------------------- |
| **MCP health monitoring**         | None     | Connection status    | Full health dashboard   |
| **Tool error visibility**         | Log only | Structured tracking  | Real-time alerts        |
| **Permission wait time tracking** | None     | Basic timing         | P50/P95/P99 latency     |
| **Compaction quality monitoring** | None     | Anomaly detection    | Quality scoring         |
| **Session health score**          | None     | Basic (3 indicators) | Full (6 indicators)     |
| **Hook failure tracking**         | None     | Count + stderr       | Auto-disable suggestion |

### 9.3 Enterprise Readiness Metrics

| Metric                   | Current | v0.5.0 Target   | v0.6.0 Target       |
| ------------------------ | ------- | --------------- | ------------------- |
| **Policy management**    | None    | TOML-based      | Managed bundles     |
| **Audit export**         | None    | JSON Lines      | SIEM + OTLP         |
| **Auth integration**     | API key | OAuth 2.1       | SAML/SSO            |
| **Egress control**       | None    | Host allow/deny | Full network policy |
| **Compliance readiness** | None    | PII detection   | SOC 2 prep          |

### 9.4 Competitive Position Targets

```
                 DHelix v0.2.0    DHelix v0.5.0    Codex      OpenCode
                 -------------    -------------    -----      --------
Sandboxing       ○ None           ● OS-level       ● OS-level ○ None
Permission       △ 5 modes        ● Granular       △ TOML     ● Arity+DB
Injection Det.   △ 8 regex        ● 13 + ML        ○ Basic    ○ Basic
Secret Scan      △ Input only     ● In + Out       ○ Basic    ○ Basic
Trust Tiers      ○ None           ● T0-T3          △ Implicit ○ None
Audit Logs       △ Basic          ● SIEM-ready     ○ Basic    ● SQLite
Supply Chain     ○ None           ● Lockfile       ○ None     ○ None
Enterprise       ○ None           △ OAuth+Policy   △ Cloud    ○ None

● = Strong   △ = Partial   ○ = Missing/Weak
```

**핵심 목표**: v0.4.0-v0.5.0에서 **Codex의 sandboxing 수준 + OpenCode의 permission 수준 + DHelix 고유의 guardrails 강점**을 결합하여 **가장 균형 잡힌 보안 posture**를 달성한다.

---

## 10. Implementation Priority & Roadmap

### P0 — Must Have (v0.4.0)

| Item                                        | 예상 공수 | 의존성           |
| ------------------------------------------- | --------- | ---------------- |
| Process-level sandbox for bash_exec         | 3d        | None             |
| Tool-specific permission rules (TOML)       | 3d        | None             |
| Arity-based command matching (30 core cmds) | 2d        | Permission rules |
| Output secret masking                       | 2d        | SecretScanner    |
| Doom loop detection                         | 1d        | Agent loop       |
| Trust Tier T0-T1 assignment                 | 2d        | None             |
| Structured audit events                     | 2d        | None             |

### P1 — Should Have (v0.4.0)

| Item                            | 예상 공수 | 의존성            |
| ------------------------------- | --------- | ----------------- |
| macOS Seatbelt integration      | 5d        | Process sandbox   |
| Linux Landlock + seccomp        | 5d        | Process sandbox   |
| Persistent approval DB (SQLite) | 3d        | Permission rules  |
| Agent-level permission profiles | 2d        | Permission rules  |
| Rate limiting per tool          | 2d        | None              |
| MCP health monitoring           | 3d        | MCP client        |
| Supply chain checksums          | 2d        | Trust tiers       |
| JSON Lines audit export         | 2d        | Structured audit  |
| Policy provenance tracking      | 2d        | Permission rules  |
| Session health metrics          | 3d        | Metrics collector |

### P2 — Nice to Have (v0.5.0+)

| Item                              | 예상 공수 | 의존성        |
| --------------------------------- | --------- | ------------- |
| Container/microVM isolation       | 10d       | OS sandbox    |
| ML-based injection detection      | 7d        | ONNX Runtime  |
| Managed policy bundles            | 5d        | TOML policies |
| SIEM/OTLP export                  | 3d        | Audit events  |
| OAuth 2.1 integration             | 5d        | None          |
| SAML/SSO                          | 5d        | OAuth 2.1     |
| Network egress policy             | 3d        | Sandbox       |
| Full arity dictionary (162+ cmds) | 3d        | Arity matcher |
| Compaction anomaly detection      | 3d        | Metrics       |
| Hook failure auto-remediation     | 2d        | Hook tracker  |

---

## Strategic Position

DHelix의 보안 전략은 **경쟁 제품의 장점을 선별적으로 흡수**하면서 **고유의 guardrails 강점을 유지**하는 것이다.

- **Codex에서 가져올 것**: OS-level sandboxing architecture, platform-specific isolation
- **OpenCode에서 가져올 것**: Arity-based command matching, persistent approval DB, doom loop detection
- **DHelix 고유 강점**: 8→13 injection type detection, 250+ secret patterns, ReDoS protection, ML-based detection path

최종 목표는 **developer-grade coding agent이면서 동시에 policy-legible하고 operationally debuggable한 플랫폼**이 되는 것이다. 이것이 serious engineering 팀에서의 채택 장벽을 가장 크게 낮추는 차별화 요소다.
