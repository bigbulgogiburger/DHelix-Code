# Compact & Auto-Compaction 심층 분석 보고서

> 작성일: 2026-03-20
> 근거: 소스 코드 실측 분석 (`context-manager.ts`, `agent-loop.ts`, `useAgentLoop.ts`, `compact.ts`, `token-counter.ts`)
> 상태: 종합 완료

---

## 1. 아키텍처 개요

```
사용자 메시지 입력
    ↓
[useAgentLoop.ts:529]  ← contextManager.prepare() (첫 번째 compaction 지점)
    ↓
    메시지 배열 → runAgentLoop 전달
    ↓
[agent-loop.ts:560]  applyObservationMasking (최근 5개 보존)
    ↓
[agent-loop.ts:562]  contextManager.prepare()  ← 매 반복마다 호출 (두 번째 compaction 지점)
    │
    ├─→ Layer 1: Microcompaction (상시 실행)
    │   ├─ 모든 tool 결과 중 상위 5개를 Hot Tail로 유지
    │   ├─ 나머지를 cold storage(디스크)로 이동 (≥200 토큰)
    │   └─ 우선순위: Error(100) > Write(80) > Frequent(60) > Read(40)
    │
    ├─→ Layer 2: Auto-Compaction (임계값 초과 시)
    │   ├─ usageRatio ≥ compactionThreshold → 트리거
    │   ├─ 시스템 메시지 보존 + DBCODE.md 리로드
    │   ├─ 최근 N턴 보존, 중간 턴 요약 (LLM 또는 로컬)
    │   └─ 대형 도구 결과 Head+Tail 잘라내기
    │
    ├─→ Layer 3: Rehydration (compaction 후)
    │   ├─ 최근 사용 파일 5개 재읽기
    │   └─ 전략: recency / frequency / mixed
    │
    └─→ GC: Cold Storage 정리 (적응적 간격)
        ├─ usage > 80% → 매 compaction마다
        ├─ usage 50-80% → 5회마다
        └─ usage < 50% → 15회마다
    ↓
관리된 메시지 → LLM 호출
```

---

## 2. 토큰 카운팅 시스템

### 2-1. 방식: tiktoken (정확한 토큰 카운팅)

| 항목            | 값                                           | 위치                       |
| --------------- | -------------------------------------------- | -------------------------- |
| 라이브러리      | `js-tiktoken`                                | `token-counter.ts:32`      |
| 인코딩          | `o200k_base` (GPT-4o 기준)                   | `token-counter.ts:35`      |
| 캐시            | LRU, 최대 500 항목                           | `token-counter.ts:84-167`  |
| 메시지 오버헤드 | 4 토큰/메시지 + 2 토큰 (어시스턴트 프라이밍) | `token-counter.ts:259-269` |

```typescript
// token-counter.ts:185-198
export function countTokens(text: string): number {
  const key = hashString(text);
  const cached = tokenCache.get(key);
  if (cached !== undefined) return cached; // 캐시 히트
  const enc = getEncoder();
  const count = enc.encode(text).length; // tiktoken 인코딩
  tokenCache.set(key, count);
  return count;
}
```

### 2-2. 토큰 예산 계산

```typescript
// context-manager.ts:218-219
get tokenBudget(): number {
  return Math.floor(this.maxContextTokens * (1 - this.responseReserveRatio));
}
// 기본값: 1,000,000 * (1 - 0.2) = 800,000 토큰
```

| 설정                   | 기본값                                | 위치                      |
| ---------------------- | ------------------------------------- | ------------------------- |
| `maxContextTokens`     | 1,000,000 (모델별 `maxContextTokens`) | `constants.ts`            |
| `responseReserveRatio` | 0.2 (20% 응답용 예약)                 | `constants.ts:AGENT_LOOP` |
| 유효 예산              | 800,000 토큰                          | 계산값                    |

---

## 3. Auto-Compaction 트리거 조건

### 3-1. 모델 티어별 임계값

```typescript
// context-manager.ts:40-52
switch (tier) {
  case "high": // GPT-4o, Claude 등
    return { compactionThreshold: 0.835, preserveRecentTurns: 5 };
  case "medium": // GPT-4 Turbo 등
    return { compactionThreshold: 0.75, preserveRecentTurns: 4 };
  case "low": // 소형 모델
    return { compactionThreshold: 0.65, preserveRecentTurns: 3 };
}
```

| 모델 티어 | 트리거 비율 | 보존 턴 수 | 트리거 예시 (1M 컨텍스트) |
| --------- | ----------- | ---------- | ------------------------- |
| high      | 83.5%       | 5턴        | 668,000 토큰 초과 시      |
| medium    | 75%         | 4턴        | 600,000 토큰 초과 시      |
| low       | 65%         | 3턴        | 520,000 토큰 초과 시      |

### 3-2. 트리거 지점 (2곳)

**지점 1: useAgentLoop.ts:529** — 사용자 메시지 처리 전

```typescript
if (contextManager) {
  messages = [...(await contextManager.prepare(messages))];
}
```

**지점 2: agent-loop.ts:562** — 에이전트 루프 매 반복

```typescript
const maskedMessages = applyObservationMasking(messages, { keepRecentN: 5 });
const managedMessages = [...(await contextManager.prepare(maskedMessages))];
```

### 3-3. needsCompaction 판정

```typescript
// context-manager.ts:238-241
needsCompaction(messages: readonly ChatMessage[]): boolean {
  const usage = this.getUsage(messages);
  return usage.usageRatio >= this.compactionThreshold;
}
```

---

## 4. Layer 1: Microcompaction (상시)

### 동작 원리

1. 모든 `tool` 역할 메시지를 찾음 (line 347-352)
2. 도구 결과가 5개 이하이면 변경 없음 (line 355-356)
3. 각 도구 메시지에 우선순위 점수 부여:

| 우선순위             | 점수 | 대상                               |
| -------------------- | ---- | ---------------------------------- |
| Error 결과           | 100  | `Error:`, `STDERR:`, `error:` 포함 |
| Write/Edit 결과      | 80   | `file_edit`, `file_write` 도구     |
| 자주 접근된 cold ref | 60   | 접근 횟수 > 2                      |
| 일반 읽기 결과       | 40   | 나머지                             |

4. 상위 5개(HOT_TAIL_SIZE)는 인라인 유지
5. 나머지 중 적격한 것(file_read, bash_exec 등 + ≥200 토큰)은 cold storage로 이동

### Cold Storage 저장

```typescript
// context-manager.ts:988-1004
private async writeColdStorage(dir: string, content: string): Promise<ColdStorageRef> {
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
  const filePath = join(dir, `${hash}.txt`);
  // Content-addressable: 같은 내용이면 재작성하지 않음
  try { await readFile(filePath, "utf-8"); }
  catch { await writeFile(filePath, content, "utf-8"); }
  return { hash, path: filePath, originalTokens: countTokens(content) };
}
```

**저장 경로**: `~/.dbcode/sessions/{sessionId}/cold-storage/{sha256-16자}.txt`

**교체 메시지**:

```
[Tool output stored at: {path}. Re-read if needed. Original: {tokens} tokens]
```

---

## 5. Layer 2: Auto-Compaction (임계값 초과)

### 압축 알고리즘 (compact 메서드, line 454-538)

```
1. onPreCompact 이벤트 발행
2. DBCODE.md 디스크에서 리로드 → 최신 시스템 프롬프트 재구성
3. 시스템 메시지와 대화 메시지 분리
4. 대화 턴 식별 (user → assistant/tool 그룹)
5. if (턴 수 ≤ preserveRecentTurns):
     → 도구 결과만 잘라내기 (Head 60% + Tail 40%)
   else:
     → 중간 턴을 요약 (LLM 또는 로컬)
     → 최근 N턴 보존
     → 압축 경계 마커 삽입
6. Layer 3: Rehydration 실행
7. 압축률 메트릭 기록
```

### LLM 요약 (line 787-839)

5개 구조화 섹션으로 요약을 요청:

```
## User Intent        — 사용자의 원래 목표/작업
## Key Decisions      — 기술적 결정과 근거
## Files Touched      — 읽기/생성/수정한 파일 목록
## Errors & Resolutions — 발견된 버그와 해결 방법
## Pending Tasks      — 아직 해야 할 작업/다음 단계
```

- **최대 출력**: 1024 토큰 (line 836)
- **focusTopic 지원**: `"Pay special attention to anything related to: {topic}"` (line 801-803)
- **실패 시**: 로컬 추출 fallback (line 776-780)

### 로컬 요약 (LLM 없이, line 846-914)

- 각 턴에서 user 메시지 200자, assistant 300자 추출
- 도구 결과에서 파일 경로 추출 (정규식)
- 에러 메시지 최대 10개 수집
- `## Files Touched`, `## Errors Encountered` 섹션 구성

### 도구 결과 잘라내기 (line 922-945)

| 구분      | 최대 토큰 | 잘라내기 방식       |
| --------- | --------- | ------------------- |
| 에러 결과 | 1,000     | Head 60% + Tail 40% |
| 일반 결과 | 2,000     | Head 60% + Tail 40% |

```
[원본 앞 60%]

[... {제거된 토큰} tokens omitted ...]

[원본 뒤 40%]
```

---

## 6. Layer 3: Rehydration (압축 후)

### 목적

압축 후 LLM이 최근 작업 컨텍스트를 잃지 않도록 관련 파일을 다시 읽어 제공.

### 전략 (line 676-694)

| 전략             | 설명                            | 파일 수 |
| ---------------- | ------------------------------- | ------- |
| `recency` (기본) | 최근 접근 파일 N개              | 5       |
| `frequency`      | 가장 자주 접근한 파일 N개       | 5       |
| `mixed`          | 최근 3개 + 빈번 2개 (중복 제거) | 5       |

### 파일 읽기 제한

- 파일당 최대 4,000자 (초과 시 3,800자 + `[... truncated]`)
- 읽기 실패 시 무시 (파일 삭제/이동 대응)

### 결과 삽입

```
[Post-compaction rehydration]
Re-read 3 recently accessed files:

--- src/core/agent-loop.ts ---
(파일 내용)

--- src/tools/executor.ts ---
(파일 내용)
```

---

## 7. Garbage Collection

### Cold Storage 정리 (line 294-337)

**정리 대상**:

1. TTL 만료 파일 (기본 24시간)
2. 고아 파일 (coldRefs 맵에 참조 없는 파일)

**적응적 GC 간격** (line 608-617):

| 컨텍스트 사용률 | GC 간격           |
| --------------- | ----------------- |
| > 80%           | 매 compaction마다 |
| 50-80%          | 5회마다           |
| < 50%           | 15회마다          |

**실행 방식**: 백그라운드 (prepare() 블로킹 안 함, line 440-442)

---

## 8. `/compact` 명령어 현황

### 현재 상태: ❌ 완전히 미연결

```typescript
// compact.ts:23-34 — 전체 코드
async execute(args: string, _context: CommandContext): Promise<CommandResult> {
  const focusTopic = args.trim() || undefined;
  return {
    output: focusTopic
      ? `Compaction triggered with focus: "${focusTopic}"`
      : "Compaction triggered.",
    success: true,
  };
}
```

**문제점**:

1. `contextManager.manualCompact()` 메서드가 존재하지만 (`context-manager.ts:544-549`) 어디서도 호출되지 않음
2. `CommandResult` 인터페이스에 `shouldCompact` 필드가 없음
3. `useAgentLoop.ts`의 `handleSubmit`에 compact 결과 처리 분기가 없음
4. `focusTopic` 파라미터가 추출되지만 절대 전달되지 않음

### 호출 체인 단절 지점

```
사용자: /compact auth-refactor
    ↓
compact.ts: focusTopic = "auth-refactor"
    ↓
return { output: "Compaction triggered...", success: true }
    ↓
useAgentLoop.ts handleSubmit:
  setCommandOutput(result.output)  ← 화면에 메시지만 표시
    ↓
contextManager.manualCompact()  ← ❌ 호출되지 않음
    ↓
실제 compaction: ❌ 발생하지 않음
```

### 수정 방안

**방안 A: CommandResult 확장** (권장)

```typescript
// registry.ts — CommandResult에 추가
readonly shouldCompact?: boolean;
readonly compactFocusTopic?: string;

// compact.ts — 필드 반환
return {
  output: "Compaction triggered.",
  success: true,
  shouldCompact: true,
  compactFocusTopic: focusTopic,
};

// useAgentLoop.ts handleSubmit — 처리 추가
if (result.shouldCompact && contextManager) {
  const { result: compactResult } = await contextManager.manualCompact(
    conversation.toMessagesForLLM(),
    result.compactFocusTopic,
  );
  setCommandOutput(`Compacted: ${compactResult.originalTokens} → ${compactResult.compactedTokens} tokens`);
}
```

**방안 B: 이벤트 기반**

```typescript
// compact.ts
emit("context:force-compact", { focusTopic });

// useAgentLoop.ts — 이벤트 리스너
events.on("context:force-compact", async ({ focusTopic }) => {
  await contextManager.manualCompact(..., focusTopic);
});
```

---

## 9. 발견된 이슈 전체 목록

### CRITICAL

| #      | 이슈                                       | 위치                 | 영향                 |
| ------ | ------------------------------------------ | -------------------- | -------------------- |
| **C1** | `/compact` 명령이 아무것도 하지 않음       | `compact.ts` 전체    | 수동 compaction 불가 |
| **C2** | `focusTopic` 파라미터 무시됨               | `compact.ts:29`      | 주제별 압축 불가     |
| **C3** | `CommandResult`에 compact 트리거 필드 없음 | `registry.ts:91-124` | 메커니즘 자체 부재   |

### HIGH

| #      | 이슈                                        | 위치                     | 영향                               |
| ------ | ------------------------------------------- | ------------------------ | ---------------------------------- |
| **H1** | `writeColdStorage()` 실패 시 깨진 참조 남음 | `context-manager.ts:400` | 디스크 풀/권한 에러 시 데이터 손실 |
| **H2** | LLM 요약 실패 시 로그 없음                  | `context-manager.ts:776` | 디버깅 불가, 성능 저하 인지 불가   |

### MEDIUM

| #      | 이슈                                             | 위치                     | 영향                                 |
| ------ | ------------------------------------------------ | ------------------------ | ------------------------------------ |
| **M1** | Rehydration 후 토큰 예산 재검증 없음             | `context-manager.ts:628` | Thrashing (반복 압축) 가능           |
| **M2** | Layer 1이 충분하면 Layer 2가 영원히 트리거 안 됨 | `context-manager.ts:427` | 긴 대화에서 메시지 축적              |
| **M3** | `coldRefAccessCount` 맵 무한 성장                | `context-manager.ts:191` | 장시간 세션에서 메모리 누수          |
| **M4** | 서브에이전트에 ContextManager 전파 안 됨         | `spawner.ts:520`         | 서브에이전트 자체 컨텍스트 관리 없음 |

### LOW

| #      | 이슈                                   | 위치                     | 영향                |
| ------ | -------------------------------------- | ------------------------ | ------------------- |
| **L1** | GC 간격이 cold storage 크기 무시       | `context-manager.ts:608` | 디스크 공간 비효율  |
| **L2** | `rehydrationStrategy` 사용자 설정 불가 | `context-manager.ts:214` | 항상 "recency" 고정 |

---

## 10. 전파 경로 상태 (Compaction 관련)

| 항목                    | 메인 에이전트 |    서브에이전트    | 비고                              |
| ----------------------- | :-----------: | :----------------: | --------------------------------- |
| ContextManager 인스턴스 |      ✅       |         ❌         | 서브에이전트는 자체 인스턴스 없음 |
| auto-compaction         |      ✅       | ⚠️ agent-loop 내부 | agent-loop.ts에서 별도 생성       |
| /compact 명령           |   ❌ 미연결   |         ❌         | 수동 compaction 불가              |
| cold storage 공유       |      ❌       |         ❌         | 세션별 격리                       |
| 토큰 예산               |   ✅ 모델별   |     ✅ 모델별      | 정상                              |

### agent-loop.ts 내부의 ContextManager (line 520-527)

```typescript
const contextManager = new ContextManager({
  maxContextTokens: config.maxContextTokens,
  sessionId: config.sessionId,
  workingDirectory: config.workingDirectory,
  onPreCompact: () => {
    config.events.emit("context:pre-compact", { compactionNumber: 0 });
  },
});
```

**주의**: `client` (LLM 프로바이더)가 전달되지 않음 → **LLM 요약 비활성화**, 항상 로컬 fallback 사용.

---

## 11. 정상 동작 검증 체크리스트

| #   | 검증 항목                   | 결과 | 근거                               |
| --- | --------------------------- | ---- | ---------------------------------- |
| 1   | tiktoken 토큰 카운팅 정확성 | ✅   | `o200k_base` 인코딩 + LRU 캐시     |
| 2   | 토큰 예산 계산 정확성       | ✅   | `maxContextTokens * 0.8`           |
| 3   | Auto-compaction 트리거 조건 | ✅   | `usageRatio >= threshold`          |
| 4   | Microcompaction 상시 실행   | ✅   | `prepare()` 호출 시 매번           |
| 5   | Cold storage 디스크 저장    | ✅   | content-addressable, SHA-256       |
| 6   | 시스템 메시지 보존          | ✅   | compaction 시 항상 보존            |
| 7   | DBCODE.md 리로드            | ✅   | compaction 시 디스크에서 재로드    |
| 8   | Head+Tail 잘라내기          | ✅   | 60/40 비율                         |
| 9   | GC 적응적 간격              | ✅   | usage 기반 1/5/15                  |
| 10  | `/compact` 수동 트리거      | ❌   | **미연결**                         |
| 11  | focusTopic 주제별 압축      | ❌   | **미연결**                         |
| 12  | LLM 기반 구조화 요약        | ⚠️   | agent-loop 내부 CM에 client 미전달 |

---

## 12. 관련 파일 인덱스

| 파일                              | 역할                     | 핵심 라인                                 |
| --------------------------------- | ------------------------ | ----------------------------------------- |
| `src/core/context-manager.ts`     | 3-Layer 컨텍스트 관리자  | L169-1005 (전체 클래스)                   |
| `src/core/agent-loop.ts`          | 에이전트 루프 — CM 통합  | L520-527 (CM 생성), L562 (prepare 호출)   |
| `src/cli/hooks/useAgentLoop.ts`   | React 훅 — CM 통합       | L529-531 (prepare 호출)                   |
| `src/commands/compact.ts`         | `/compact` 슬래시 명령   | L18-35 (미연결 핸들러)                    |
| `src/commands/registry.ts`        | CommandResult 인터페이스 | L91-124 (shouldCompact 필드 없음)         |
| `src/llm/token-counter.ts`        | tiktoken 토큰 카운터     | L185-198 (countTokens)                    |
| `src/constants.ts`                | 기본 상수 (AGENT_LOOP)   | compactionThreshold, responseReserveRatio |
| `src/core/observation-masking.ts` | 관찰 마스킹              | keepRecentN: 5                            |

---

## 부록: Auto-Compaction 시나리오 시뮬레이션

### 시나리오: 1M 컨텍스트, high 티어, 긴 코딩 세션

```
Turn 1-10: 일반 코딩 (각 턴 ~20K 토큰)
  → 누적: 200K / 800K = 25% → compaction 안 함

Turn 11-30: 대량 파일 읽기 + 수정 (각 턴 ~30K)
  → Layer 1: 큰 file_read 결과를 cold storage로 이동
  → 인라인 유지: 최근 5개 도구 결과만
  → 누적 (Layer 1 후): ~400K / 800K = 50% → 아직 안 함

Turn 31-40: 디버깅 + 테스트 (각 턴 ~40K)
  → Layer 1: bash_exec 결과 cold storage 이동
  → 누적 (Layer 1 후): ~680K / 800K = 85% → 임계값 83.5% 초과!

  → Layer 2 트리거:
    - Turn 1-35를 구조화 요약 (LLM 또는 로컬)
    - Turn 36-40 (최근 5턴) 보존
    - 요약 + 최근 턴 = ~150K 토큰
    - Layer 3: 최근 파일 5개 리하이드레이션 (+~50K)
    - 결과: ~200K / 800K = 25% → 여유 확보

Turn 41+: 작업 계속...
  → 다음 compaction까지 ~480K 토큰 여유
```

---

## 13. 세션 자동 이름 설정 (관련 이슈)

### 배경

`/resume` 명령에서 모든 세션이 "New session"으로 표시되는 문제가 발견됨.

### 원인

`SessionManager.autoNameSession()` 메서드가 정의되어 있었으나 (`session-manager.ts:510-513`)
어디서도 호출되지 않았음. 세션 생성 시 이름이 `"New session"`으로 고정.

```typescript
// session-manager.ts:311 — 세션 생성 시
name: options.name ?? "New session",

// session-manager.ts:510-513 — 존재하지만 미호출
async autoNameSession(sessionId: string, firstUserMessage: string): Promise<void> {
  const name = generateSessionName(firstUserMessage);
  await this.renameSession(sessionId, name);
}
```

### 수정 내용 (2026-03-20)

`useAgentLoop.ts`에 자동 이름 설정 로직 추가:

```typescript
// useAgentLoop.ts — sessionNamedRef 추가
const sessionNamedRef = useRef(false);

// 세션 persist 블록에서 첫 메시지일 때 호출
if (!sessionNamedRef.current) {
  sessionNamedRef.current = true;
  sessionManager.autoNameSession(sessionId, input).catch(() => {});
}
```

### 제한사항

- **수정 전에 생성된 기존 세션**은 여전히 "New session"으로 표시됨
- 새 세션에서 첫 메시지를 보내야 이름이 설정됨
- 기존 세션 이름 일괄 업데이트는 별도 마이그레이션 필요
