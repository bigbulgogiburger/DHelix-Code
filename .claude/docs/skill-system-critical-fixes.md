# Skill System Critical Fixes — DHelix Code v0.2.0

> 작성: 2026-03-29
> 대상: src/skills/, src/cli/hooks/useAgentLoop.ts, test/unit/skills/

## Executive Summary

DHelix Code의 스킬 시스템은 Claude Code의 YAML frontmatter + markdown body 패턴을 충실히 구현하고 있으나,
**3가지 critical issue**로 인해 fork 스킬, 모델 오버라이드, 동적 컨텍스트가 실제로 동작하지 않거나 보안 위험이 존재합니다.

---

## Issue #1: skill:fork 이벤트 리스너 미연결 (CRITICAL)

### 현상

`context: "fork"` 스킬 실행 시 `commandContext.emit("skill:fork", ...)` 이벤트가 발행되지만,
**Agent Loop에 해당 이벤트를 수신하는 리스너가 없어** 서브에이전트가 생성되지 않습니다.

### 영향 범위

- `command-bridge.ts:66` — 이벤트 발행 코드
- `useAgentLoop.ts` — 리스너 부재
- 모든 `context: "fork"` 스킬이 "launched as subagent" 메시지만 표시하고 실제로는 아무 일도 안 함

### 근본 원인

```typescript
// command-bridge.ts:66 — 이벤트를 보내지만
commandContext.emit("skill:fork", {
  prompt: result.prompt,
  model: result.model,
  agentType: result.agentType,
  allowedTools: result.allowedTools,
});

// useAgentLoop.ts — 수신자가 없음
// events.on("skill:fork", ...) 핸들러가 존재하지 않음
```

### 수정 방안

`useAgentLoop.ts`에 `skill:fork` 이벤트 리스너를 추가하고, 서브에이전트 생성 로직 연결:

```typescript
// useAgentLoop.ts — useEffect 내부에 추가
events.on("skill:fork", async (data) => {
  const { prompt, model, agentType, allowedTools } = data;
  // SubagentSpawner를 사용하여 서브에이전트 생성
  // agentType에 따라 explore/plan/general 분기
  // allowedTools로 도구 필터링
  // 결과를 대화에 주입
});
```

### 필요 파일

- `src/cli/hooks/useAgentLoop.ts` — 리스너 추가
- `src/subagents/spawner.ts` — 서브에이전트 생성 API 확인
- `test/unit/skills/command-bridge.test.ts` — fork 동작 검증 테스트

---

## Issue #2: exec() 셸 인젝션 취약점 (CRITICAL)

### 현상

`executor.ts:85`에서 `exec(command)` 호출 시 사용자 입력이 그대로 셸에 전달됩니다.

### 영향 범위

- `src/skills/executor.ts:83-93` — `executeShellCommand()` 함수
- 스킬 본문의 `!command` 구문이 사용자 인자를 포함할 때 위험

### 공격 시나리오

```markdown
# 스킬 본문 예시

현재 파일 분석: `!cat $ARGUMENTS`
```

사용자 입력: `/analyze "src/app.ts; rm -rf /"`
→ 변수 치환 후: `!cat src/app.ts; rm -rf /`
→ `exec("cat src/app.ts; rm -rf /")` — 셸 인젝션 발생

### 수정 방안

1. `exec()` → `execFile()` 변환 (셸 해석 제거)
2. 또는 동적 컨텍스트 명령어에 사용자 변수가 포함되었는지 검증
3. 안전한 명령어 화이트리스트 적용

```typescript
import { execFile } from "node:child_process";

async function executeShellCommand(command: string, cwd: string): Promise<string> {
  // command를 파싱하여 실행파일과 인자를 분리
  const parts = parseShellCommand(command);
  return new Promise<string>((resolve) => {
    execFile(
      parts[0],
      parts.slice(1),
      { timeout: COMMAND_TIMEOUT_MS, cwd },
      (error, stdout, stderr) => {
        if (error) {
          resolve(`[Command failed: ${stderr.trim() || error.message}]`);
          return;
        }
        resolve(stdout.trim());
      },
    );
  });
}
```

### 대안: 변수 치환 순서 변경

더 근본적으로는 **동적 컨텍스트 실행을 변수 치환보다 먼저** 수행하면,
사용자 인자가 셸 명령에 포함되지 않아 인젝션 자체가 불가능합니다.

```typescript
// 현재: interpolate → resolve (위험)
// 수정: resolve → interpolate (안전)
const resolved = await resolveDynamicContext(body, context.workingDirectory);
const interpolated = interpolateVariables(resolved, context);
```

### 필요 파일

- `src/skills/executor.ts` — 실행 순서 변경 + execFile 전환
- `test/unit/skills/executor.test.ts` — 인젝션 방어 테스트

---

## Issue #3: modelOverride 무시됨 (HIGH)

### 현상

스킬 frontmatter에 `model: "gpt-4o"` 지정 시 `CommandResult.modelOverride`로 반환되지만,
`useAgentLoop.ts`의 `handleSubmit`에서 **이 값을 처리하는 코드가 없습니다.**

### 영향 범위

- `command-bridge.ts:85` — `modelOverride: result.model` 반환
- `useAgentLoop.ts:719-721` — `shouldInjectAsUserMessage` 분기에서 `processMessage(result.output)`만 호출
- `modelOverride`가 소비되지 않고 사라짐

### 근본 원인

```typescript
// useAgentLoop.ts:717-722
if (result.shouldInjectAsUserMessage && result.success) {
  void processMessage(result.output); // ← modelOverride가 전달되지 않음
  return;
}
```

`processMessage`는 현재 `activeModel`을 사용하므로, 스킬의 모델 오버라이드가 무시됩니다.

### 수정 방안

`shouldInjectAsUserMessage` 분기에서 모델 오버라이드 적용:

```typescript
if (result.shouldInjectAsUserMessage && result.success) {
  // 스킬이 모델 오버라이드를 지정한 경우 임시 적용
  const previousModel = activeModel;
  if (result.modelOverride) {
    clientRef.current = createLLMClientForModel({ model: result.modelOverride });
    setActiveModel(result.modelOverride);
  }
  void processMessage(result.output);
  // 참고: 모델 복원은 스킬 실행 후 사용자가 /model로 수동 복원
  return;
}
```

### 필요 파일

- `src/cli/hooks/useAgentLoop.ts` — modelOverride 처리 추가
- `test/unit/skills/command-bridge.test.ts` — 모델 오버라이드 전달 검증

---

## Team Assignment

| Agent       | Role             | Issue                          | Files                       |
| ----------- | ---------------- | ------------------------------ | --------------------------- |
| **Agent 1** | Fork 리스너 구현 | #1 skill:fork                  | useAgentLoop.ts, spawner.ts |
| **Agent 2** | 셸 인젝션 수정   | #2 exec → execFile             | executor.ts                 |
| **Agent 3** | 모델 오버라이드  | #3 modelOverride 연결          | useAgentLoop.ts             |
| **Agent 4** | 테스트 작성      | #1~3 모든 이슈                 | test/unit/skills/\*.test.ts |
| **Agent 5** | 통합 검증        | 빌드 + typecheck + 기존 테스트 | 전체                        |

---

## Verification Checklist

- [ ] fork 스킬 실행 시 서브에이전트가 실제로 생성되는가
- [ ] `!command` 에서 사용자 인자가 셸에 직접 전달되지 않는가
- [ ] `model: "gpt-4o"` frontmatter가 실행 시 모델을 전환하는가
- [ ] 기존 inline 스킬이 여전히 정상 동작하는가
- [ ] `npm run build` 성공
- [ ] `npm run typecheck` 성공 (기존 OpenAI 타입 이슈 제외)
- [ ] 신규 테스트 전체 통과
