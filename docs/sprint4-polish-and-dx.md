# Sprint 4: 완성도 + 개발자 경험 (Polish & Developer Experience)

> **Version**: 2.0 (웹 리서치 + 프로젝트 심층 분석 반영)
> **Date**: 2026-03-14
> **Base**: Sprint 3 완료 — 3443 tests / 0 TS errors
> **Scope**: I6 /doctor 진단 + I7 /bug 이슈 리포트 + 성능 최적화 + DX 개선

---

## 목차

1. [Sprint 4 범위 선정](#sprint-4-범위-선정)
2. [I6. /doctor 포괄적 진단](#i6-doctor-포괄적-진단)
3. [I7. /bug 자동 이슈 리포트](#i7-bug-자동-이슈-리포트)
4. [P1. 성능 최적화](#p1-성능-최적화)
5. [DX1. 개발자 경험 개선](#dx1-개발자-경험-개선)
6. [구현 순서 및 일정](#구현-순서-및-일정)
7. [검증 기준](#검증-기준)

---

## Sprint 4 범위 선정

Sprint 1-3에서 Critical + Important 격차가 모두 해소되었습니다. Sprint 4는 **완성도와 사용성**에 집중합니다.

### 현재 프로젝트 현황 (심층 분석)

| 항목               | 수치                     | 비고                                             |
| ------------------ | ------------------------ | ------------------------------------------------ |
| 소스 파일          | ~120개                   | src/ 전체                                        |
| 테스트 파일        | ~60개                    | test/unit/                                       |
| 커맨드 수          | **38개**                 | src/commands/ (doctor, stats, diff 등 이미 존재) |
| 테스트 커버리지 갭 | **23개 커맨드** 미테스트 | commands 모듈이 가장 큰 갭                       |
| 인증 시스템        | 토큰 기반만              | OAuth Device Flow 없음                           |

### 로드맵 잔여 + 신규 발견 항목

| #       | 기능             | 설명                                | 현재 상태              | 복잡도 |
| ------- | ---------------- | ----------------------------------- | ---------------------- | ------ |
| **I6**  | /doctor 진단     | 환경 점검 12+ 항목                  | 4개 체크만 존재 (65줄) | 중     |
| **I7**  | /bug 이슈 리포트 | GitHub Issues URL 자동 생성         | 미구현                 | 낮-중  |
| **P1**  | 성능 최적화      | Startup 병렬화, 커맨드 lazy loading | 순차 초기화            | 중     |
| **DX1** | 개발자 경험      | /stats, /export, /diff 보강         | 일부 존재하나 미흡     | 낮-중  |
| **T1**  | 테스트 커버리지  | 23개 미테스트 커맨드                | 38개 중 15개만 테스트  | 중     |

---

## I6. /doctor 포괄적 진단

### Claude Code /doctor 참조 (웹 리서치)

Claude Code의 `/doctor`는 환경 문제를 자동 감지하고 해결 방법을 제시합니다:

- **Installation Info**: 설치 방식(npm/native), Node.js 경로, 버전
- **Authentication**: API 연결 상태, 인증 유효성
- **Configuration**: `settings.json` 유효성, 잘못된 권한 패턴 감지
- **MCP Health**: MCP 서버 연결 상태
- **File Permissions**: config 디렉토리 쓰기 권한
- **Context**: DBCODE.md 유효성

> 출처: [Claude Code Troubleshooting](https://code.claude.com/docs/en/troubleshooting), [Flutter Doctor Guide](https://flutterfever.com/flutter-doctor-command/)

**dbcode 현재 상태**: `src/commands/doctor.ts` — 65줄, **4개 체크만** (Node, Git, Git repo, Model config). Claude Code 대비 큰 갭.

### 구현 계획

**파일: `src/commands/doctor.ts`**

기존 doctor 커맨드가 있으면 확장, 없으면 신규 생성.

```typescript
interface DiagnosticCheck {
  readonly name: string;
  readonly status: "pass" | "warn" | "fail";
  readonly message: string;
  readonly fix?: string;
}

async function runDiagnostics(): Promise<readonly DiagnosticCheck[]> {
  const checks: DiagnosticCheck[] = [];

  // 1. Node.js 버전
  checks.push(checkNodeVersion());

  // 2. Git 설치 + 설정
  checks.push(await checkGitInstallation());

  // 3. API 키 유효성
  checks.push(await checkApiKey());

  // 4. 디스크 공간
  checks.push(checkDiskSpace());

  // 5. 설정 파일 유효성
  checks.push(await checkConfig());

  // 6. MCP 서버 연결
  checks.push(await checkMCPServers());

  // 7. Shiki 하이라이터 상태
  checks.push(checkSyntaxHighlighter());

  // 8. SoX 설치 (음성 입력용)
  checks.push(await checkSoxInstalled());

  return checks;
}
```

### 출력 형식

```
dbcode doctor

  ✓ Node.js v20.11.0 (required: ≥20.0.0)
  ✓ Git 2.43.0 — user.name: "PyeonDohun"
  ✓ API key configured (OpenAI)
  ✓ Disk space: 45.2 GB free
  ✓ Config: ~/.dbcode/config.json valid
  ⚠ MCP: 2/3 servers connected (serena: timeout)
  ✓ Syntax highlighting: Shiki initialized
  ⚠ SoX not installed — voice input unavailable
    Fix: brew install sox

  7/8 checks passed, 1 warning
```

### 영향 범위

| 파일                     | 변경           | 규모   |
| ------------------------ | -------------- | ------ |
| `src/commands/doctor.ts` | 확장 또는 신규 | ~150줄 |
| 테스트                   | 신규           | ~50줄  |

---

## I7. /bug 자동 이슈 리포트

### 구현 계획

**파일: `src/commands/bug.ts` (신규)**

```typescript
/** /bug — Report a bug with context */
export const bugCommand: SlashCommand = {
  name: "bug",
  description: "Report a bug with system context",
  usage: "/bug <description>",

  async execute(args, context) {
    const description = args.trim();
    if (!description) {
      return { output: "Usage: /bug <description>", success: false };
    }

    // Collect diagnostic context
    const diagnostics = {
      version: VERSION,
      platform: process.platform,
      nodeVersion: process.version,
      model: context.model,
      sessionId: context.sessionId,
      timestamp: new Date().toISOString(),
    };

    // Format bug report
    const report = formatBugReport(description, diagnostics);

    // Option 1: Copy to clipboard
    // Option 2: Open GitHub issue URL with pre-filled template
    const issueUrl = buildGitHubIssueUrl(report);

    return {
      output: [
        "Bug report generated.",
        "",
        `Open in browser: ${issueUrl}`,
        "",
        "Or copy the report below:",
        "---",
        report,
      ].join("\n"),
      success: true,
    };
  },
};
```

### GitHub Issue URL 생성

```typescript
function buildGitHubIssueUrl(report: string): string {
  const params = new URLSearchParams({
    title: "[Bug] " + report.split("\n")[0].slice(0, 80),
    body: report,
    labels: "bug",
  });
  return `https://github.com/bigbulgogiburger/dbcode/issues/new?${params}`;
}
```

### 영향 범위

| 파일                  | 변경        | 규모  |
| --------------------- | ----------- | ----- |
| `src/commands/bug.ts` | **신규**    | ~80줄 |
| `src/index.ts`        | 커맨드 등록 | +2줄  |
| 테스트                | 신규        | ~30줄 |

---

## P1. 성능 최적화

### P1-1. Startup 시간 단축

현재 startup 시 동기적으로 실행되는 작업:

- `loadConfig()` — 5-level config 병합
- `loadInstructions()` — DBCODE.md 로딩
- `initHighlighter()` — Shiki 초기화 (이미 비동기)

**최적화**: 병렬 초기화

```typescript
// 현재 (순차):
const config = await loadConfig(overrides);
const instructions = await loadInstructions(cwd);

// 최적화 (병렬):
const [config, instructions] = await Promise.all([loadConfig(overrides), loadInstructions(cwd)]);
```

### P1-2. Import 지연 로딩

무거운 모듈(shiki, openai)을 첫 사용 시점까지 지연:

```typescript
// 현재: import OpenAI from "openai"; (startup 시 로드)
// 최적화: const OpenAI = (await import("openai")).default; (첫 LLM 호출 시)
```

### P1-3. Context Compaction 효율성 측정

`ContextManager`에 compaction 품질 메트릭 추가:

```typescript
interface CompactionQuality {
  readonly tokensBefore: number;
  readonly tokensAfter: number;
  readonly compressionRatio: number;
  readonly summaryLength: number;
  readonly elapsedMs: number;
}
```

### 영향 범위

| 파일                          | 변경        | 규모       |
| ----------------------------- | ----------- | ---------- |
| `src/index.ts`                | 병렬 초기화 | ~10줄 변경 |
| `src/llm/client.ts`           | 지연 import | ~5줄       |
| `src/core/context-manager.ts` | 품질 메트릭 | ~20줄      |
| 테스트                        | 신규        | ~30줄      |

---

## DX1. 개발자 경험 개선

### DX1-1. /stats 세션 통계

```
/stats
Session Statistics
  Duration: 45 minutes
  Turns: 23
  Tokens: 125,430 (input: 98,200, output: 27,230)
  Cost: $0.47
  Tools used: 67 (file_read: 28, bash_exec: 15, file_edit: 12, ...)
  Compactions: 2
  Files modified: 8
```

### DX1-2. /export 세션 내보내기

세션을 마크다운 파일로 내보내기:

```
/export [path]
→ Exported session to ./dbcode-session-2026-03-14.md
```

### DX1-3. /diff 변경 요약

현재 세션에서 수정된 파일의 git diff 요약:

```
/diff
Changes in this session:
  M src/tools/registry.ts (+40, -2)
  M src/core/agent-loop.ts (+25, -3)
  A src/llm/thinking-budget.ts (+30)
  Total: 3 files, +95 / -5
```

### 영향 범위

| 파일                     | 변경        | 규모  |
| ------------------------ | ----------- | ----- |
| `src/commands/stats.ts`  | 확장        | ~30줄 |
| `src/commands/export.ts` | 신규        | ~50줄 |
| `src/commands/diff.ts`   | 신규        | ~40줄 |
| `src/index.ts`           | 커맨드 등록 | +3줄  |
| 테스트                   | 신규        | ~60줄 |

---

## 구현 순서 및 일정

### 에이전트 배정 (3명)

```
Agent 1: "doctor-bug"        → I6 /doctor + I7 /bug (commands/ 전담)
Agent 2: "performance"       → P1 성능 최적화 (index.ts, client.ts, context-manager.ts)
Agent 3: "dx-commands"       → DX1 /stats, /export, /diff (commands/ 신규)
```

### 일정

```
Day 1    │  Agent 1 + Agent 2 + Agent 3 병렬
Day 2    │  통합 검증 + 커맨드 등록
Day 3    │  벤치마크 + 커밋
```

**총 예상: 3일**

---

## 검증 기준

### 기능 검증

- [ ] `/doctor` — 8개 항목 진단, pass/warn/fail 표시
- [ ] `/bug <desc>` — GitHub Issue URL 생성 + 리포트 출력
- [ ] `/stats` — 세션 통계 표시 (토큰, 비용, 도구 사용)
- [ ] `/export` — 세션을 마크다운으로 내보내기
- [ ] `/diff` — 세션 중 변경 파일 요약

### 성능 검증

- [ ] Startup 시간 측정 (before/after)
- [ ] Context compaction 품질 메트릭 출력

### 회귀 방지

- [ ] 기존 테스트 전부 통과
- [ ] TypeScript 에러 0개
- [ ] 빌드 성공

---

## Sprint 4 이후 — 프로젝트 전체 현황

```
Sprint 1: 비용 최적화         ✅ C1+C2 (Prompt Caching, Deferred Tools)
Sprint 2: UX 완성             ✅ I2+I3+C3+I4 (Markdown, Syntax, Streaming, Thinking)
Sprint 3: 고급 기능 + 코어 보강 ✅ I5+C4+I1+H1-H5 (Plan Mode, MCP HTTP, Worktree, Core)
Sprint 4: 완성도 + DX         ✅ I6+I7+P1+DX1 (Doctor, Bug, Performance, Commands)

격차 해소 현황:
  Critical (C1-C4):   4/4 해소   ✅
  Important (I1-I8):  8/8 해소   ✅
  Core Hardening:     5/5 해소   ✅
  Performance:        3/3 신규   ✅
  DX:                 3/3 신규   ✅

남은 작업 (v1.0 릴리스 전):
  - E2E 테스트 커버리지 확대
  - npm publish 준비 (README, CHANGELOG, LICENSE)
  - CI/CD 파이프라인 (GitHub Actions)
  - 사용자 문서 (Getting Started, Configuration Guide)
```

---

## 웹 리서치 참조

### /doctor 패턴

- [Claude Code Troubleshooting](https://code.claude.com/docs/en/troubleshooting)
- [Flutter Doctor Diagnostics Guide](https://flutterfever.com/flutter-doctor-command/)
- [Claude Code /doctor Issue #7842](https://github.com/anthropics/claude-code/issues/7842)

### /bug 패턴

- [Claude Code /bug URL length Issue #11858](https://github.com/anthropics/claude-code/issues/11858)
- [Reporting Issues — DeepWiki](https://deepwiki.com/anthropics/claude-code/2.5-providing-feedback-and-reporting-issues)

### OAuth CLI 패턴

- [gh auth login manual](https://cli.github.com/manual/gh_auth_login)
- [OAuth Device Flow in JS CLI](https://dev.to/ddebajyati/integrate-github-login-with-oauth-device-flow-in-your-js-cli-28fk)
- [Browser-based OAuth for CLI — WorkOS](https://workos.com/blog/how-to-build-browser-based-oauth-into-your-cli-with-workos)
