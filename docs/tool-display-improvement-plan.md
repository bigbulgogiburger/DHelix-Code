# Tool Display Improvement Plan

dbcode의 도구 실행 표시를 Claude Code / Codex CLI 수준으로 개선하기 위한 계획.

## 현재 문제

```
[⠋] Reading
[✓] Read (10ms)
[⠋] Searching "copilot"
[✓] Searched 1 result (4ms)
```

**무엇을 읽는지, 어디를 탐색하는지 알 수 없음.** 사용자는 AI의 작업 과정을 이해할 수 없다.

## 목표 (Claude Code / Codex CLI 스타일)

```
⏺ Reading src/commands/init.ts (lines 1-237)
 ⎿ Read src/commands/init.ts — 237 lines (10ms)

⏺ Searching "copilot" in src/
 ⎿ Searched — 0 matches in 47 files (4ms)

⏺ Editing src/core/activity.ts
 ⎿ Edited src/core/activity.ts (+2 -3)
    47 -     throw new Error("No active turn");
    47 +     this.startTurn();

⏺ Running npm test
 ⎿ Ran npm test — exit code 0 (3.2s)
    ✓ 156 passed, 0 failed
```

---

## Phase 1: 메타데이터 파이프라인 연결 (Critical)

### 문제: 도구 메타데이터가 표시 계층에 도달하지 못함

각 도구의 `execute()`가 `ToolResult.metadata`를 반환하지만, `useAgentLoop.ts`의 `onToolComplete` 핸들러에서 **metadata가 누락됨**:

```typescript
// 현재 (metadata 손실)
activityRef.current.addEntry("tool-complete", { name, id, isError, output });

// 개선 후
activityRef.current.addEntry("tool-complete", { name, id, isError, output, metadata });
```

### 파일 변경

| File                                   | Change                                                   |
| -------------------------------------- | -------------------------------------------------------- |
| `src/cli/hooks/useAgentLoop.ts`        | `onToolComplete` 콜백에 `metadata` 파라미터 추가 및 전달 |
| `src/core/agent-loop.ts`               | `agent:tool-complete` 이벤트에 metadata 포함             |
| `src/cli/renderer/tool-display.ts`     | `extractDetail(args, output, metadata)` 시그니처로 확장  |
| `src/cli/components/ToolCallBlock.tsx` | `metadata` prop 추가 및 활용                             |

---

## Phase 2: 상세 표시 텍스트 개선

### 2a. file_read — 파일 경로 + 라인 범위

```
현재: [✓] Read (10ms)
개선: [✓] Read src/commands/init.ts — 237 lines (10ms)
      [✓] Read package.json — 45 lines (5ms)
      [✓] Read screenshot.png — image 1920×1080 (15ms)
      [✓] Read report.pdf — pages 1-5 of 47 (200ms)
```

**소스**: `metadata.path`, `metadata.totalLines`, `metadata.readFrom`, `metadata.readTo`, `metadata.type`

### 2b. file_write — 파일 경로 + 크기

```
현재: [✓] Wrote (35.0s)
개선: [✓] Wrote src/commands/init.ts — 303 lines (35.0s)
```

**소스**: `args.file_path`, output에서 라인 수 파싱

### 2c. file_edit — 파일 경로 + 변경량

```
현재: [✓] Edited (0.8s)
개선: [✓] Edited src/core/activity.ts (+2 -3) (0.8s)
```

**소스**: `metadata.path`, `metadata.linesAdded`, `metadata.linesRemoved`

### 2d. grep_search — 패턴 + 범위 + 결과

```
현재: [✓] Searched 1 result (5ms)
개선: [✓] Searched "copilot" in src/ — 0 matches (5ms)
      [✓] Searched "max_tokens" in src/llm/ — 4 matches in 2 files (43ms)
```

**소스**: `args.pattern`, `args.path`, `metadata.matchCount`, output 파싱

### 2e. glob_search — 패턴 + 결과

```
현재: [✓] Searched 1 result (8ms)
개선: [✓] Glob **/*.test.ts — 24 files found (8ms)
```

**소스**: `args.pattern`, `metadata.count`

### 2f. bash_exec — 명령어 + exit code

```
현재: [✓] Ran (3.2s)
개선: [✓] Ran npm test — exit 0 (3.2s)
      [✗] Ran tsc --noEmit — exit 1 (5.1s)
```

**소스**: `metadata.exitCode`, `metadata.command`

### 2g. list_dir — 경로

```
현재: [✓] Listed (6ms)
개선: [✓] Listed src/commands/ — 12 entries (6ms)
```

**소스**: `args.path`, output 라인 수

### 2h. web_fetch — URL

```
현재: [✓] Fetched (1.2s)
개선: [✓] Fetched https://api.example.com/docs — 2.4KB (1.2s)
```

**소스**: `args.url`, output 크기

### 2i. web_search — 쿼리

```
현재: [✓] Searched (0.8s)
개선: [✓] Searched web "gpt-5 tokenizer encoding" — 8 results (0.8s)
```

**소스**: `args.query`, output 결과 수

---

## Phase 3: 시각적 개선

### 3a. 아이콘 시스템 변경

```
현재                    개선안 A (Claude Code)     개선안 B (Codex)
[⠋] Reading...         ⏺ Reading...              • Reading...
[✓] Read (10ms)        ⎿ Read (10ms)             • Read (10ms)
[✗] Error              ⎿ Error                    ✗ Error
```

### 3b. 트리 커넥터로 하위 상세 표시

```
⏺ Edited src/core/activity.ts (+2 -3)
 ⎿  47 -     throw new Error("No active turn");
 ⎿  47 +     this.startTurn();

⏺ Ran npm test — exit 0 (3.2s)
 ⎿ ✓ 156 passed, 0 failed
```

### 3c. 연속 읽기 그룹핑

Claude Code는 여러 연속 읽기를 하나로 그룹:

```
⏺ Read 5 files
 ⎿ package.json, tsconfig.json, src/index.ts, src/config/schema.ts, README.md
```

비verbose 모드에서 그룹핑, verbose 모드(`Ctrl+O`)에서 개별 표시.

### 3d. 진행 중 상태 표시

```
[shimmer] Working  12s  (Esc to cancel)
 ⎿ Reading src/commands/init.ts...
```

---

## Phase 4: 확장 기능

### 4a. Verbose 토글 (Ctrl+O)

- 비verbose (기본): 압축된 요약 ("Read 5 files", "Edited 2 files")
- verbose: 개별 도구 호출 상세 표시 + 전체 args/output
- 이미 `Ctrl+O`가 verbose 토글로 등록되어 있으나, 도구 표시에 적용되지 않음

### 4b. 타임스탬프 표시 (verbose 모드)

```
[14:32:15] ⏺ Read src/commands/init.ts — 237 lines (10ms)
[14:32:15] ⏺ Read package.json — 45 lines (5ms)
[14:32:16] ⏺ Searching "max_tokens" in src/llm/ — 4 matches (43ms)
```

**소스**: `ActivityEntry.timestamp` (이미 저장되지만 표시 안됨)

### 4c. 턴 요약

```
── Turn 3 completed in 12.4s ──
  5 files read, 2 files edited, 1 command run
```

### 4d. 배경 프로세스 추적

```
⏺ Running npm test (background, PID 12345)
 ⎿ Output: /tmp/dbcode/task-abc.output
```

---

## 구현 우선순위

| 우선순위 | 항목                                           | 난이도 | 영향도                      |
| -------- | ---------------------------------------------- | ------ | --------------------------- |
| **P0**   | Phase 1: metadata 파이프라인 연결              | Medium | Critical — 모든 개선의 기반 |
| **P0**   | Phase 2a-f: 파일 경로/패턴 표시                | Low    | High — 가장 눈에 띄는 개선  |
| **P1**   | Phase 2g-i: 나머지 도구 상세 표시              | Low    | Medium                      |
| **P1**   | Phase 3b: 트리 커넥터                          | Low    | Medium — 시각적 계층 구조   |
| **P2**   | Phase 3c: 연속 읽기 그룹핑                     | Medium | Medium — 출력 압축          |
| **P2**   | Phase 3a: 아이콘 시스템 변경                   | Low    | Low — 미적 개선             |
| **P2**   | Phase 4a: Verbose 토글 적용                    | Medium | Medium                      |
| **P3**   | Phase 4b-d: 타임스탬프, 턴 요약, 배경 프로세스 | Medium | Low                         |

---

## 핵심 파일 맵

| File                                    | Role                                             |
| --------------------------------------- | ------------------------------------------------ |
| `src/core/agent-loop.ts`                | 도구 실행 결과 이벤트 발행 (metadata 포함 필요)  |
| `src/cli/hooks/useAgentLoop.ts:115-131` | 이벤트 → ActivityEntry 변환 (metadata 전달 필요) |
| `src/core/activity.ts`                  | ActivityEntry 저장 (metadata 필드 추가 필요)     |
| `src/cli/renderer/tool-display.ts`      | 표시 텍스트 생성 (metadata 활용 필요)            |
| `src/cli/components/ToolCallBlock.tsx`  | 최종 렌더링 (metadata prop 추가 필요)            |
| `src/cli/components/TurnBlock.tsx`      | 턴 렌더링 (entry.data → ToolCallBlock 매핑)      |
| `src/cli/components/ActivityFeed.tsx`   | 전체 피드 (그룹핑, 턴 요약 추가 필요)            |
| `src/tools/definitions/*.ts`            | 각 도구의 metadata 반환값 (이미 구현됨)          |

---

## 참고: Claude Code vs Codex vs dbcode 비교

| Feature          | Claude Code | Codex CLI        | dbcode (현재) | dbcode (목표) |
| ---------------- | ----------- | ---------------- | ------------- | ------------- |
| 파일 경로 표시   | ✅          | ✅               | ❌            | ✅            |
| 검색 패턴 표시   | ✅          | ✅               | △ (부분)      | ✅            |
| Exit code 표시   | ✅          | ✅ (색상)        | ❌            | ✅            |
| Diff 미리보기    | ✅          | ✅ (구문 강조)   | ✅            | ✅            |
| 연속 읽기 그룹핑 | ✅          | ✅ ("Exploring") | ❌            | ✅            |
| Verbose 토글     | ✅ (Ctrl+O) | ✅ (Ctrl+T)      | ✅ (등록됨)   | ✅ (적용)     |
| 트리 커넥터      | ✅ (⎿)      | ✅ (└)           | ❌            | ✅            |
| 타임스탬프       | ❌          | ✅               | ❌            | ✅ (verbose)  |
| 턴 요약          | ❌          | ❌               | ❌            | ✅            |
| Thinking 표시    | ✅ (∴)      | ❌               | ✅            | ✅            |
| 경과 시간        | ❌          | ✅               | ✅            | ✅            |
| 배경 프로세스    | ❌          | ❌               | △ (텍스트)    | ✅            |
