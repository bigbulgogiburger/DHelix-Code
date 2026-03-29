# dhelix 종합 문제 분석 및 개선 계획

> **작성일**: 2026-03-07
> **분석 대상**: dhelix v0.1.0 — CLI AI Coding Assistant
> **분석 관점**: Anthropic Claude Code 개발자 시점에서의 심층 분석

---

## 1. 문제 요약

사용자 테스트에서 발견된 문제와 코드 분석을 통해 추가 발견된 문제를 종합하면 다음과 같습니다:

| #   | 문제                                  | 심각도   | 카테고리           |
| --- | ------------------------------------- | -------- | ------------------ |
| 1   | 로고가 스크롤되어 사라짐              | Medium   | UI/UX              |
| 2   | 긴 텍스트에서 글씨 번쩍번쩍 깜빡임    | Critical | UI/Rendering       |
| 3   | 작업 내용과 진행 상황이 분리됨        | Critical | UI/UX Architecture |
| 4   | 다중 인스턴스 동시 실행 불가          | High     | Architecture       |
| 5   | Java/Spring Boot 프로젝트 빌드 실패   | High     | Agent Quality      |
| 6   | 빌드/테스트 수정 루프 타임아웃        | High     | Agent Loop         |
| 7   | 도구 실행 이력이 대화에 보존되지 않음 | Critical | Conversation State |
| 8   | 멀티라인 입력 미지원                  | Medium   | Input UX           |
| 9   | 입력 히스토리(위/아래 화살표) 미지원  | Medium   | Input UX           |
| 10  | 컨텍스트 압축이 단순 절삭 방식        | Medium   | Context Management |

---

## 2. 상세 분석

### 2.1 로고 사라짐 문제

**파일**: `src/cli/App.tsx:379-385`

```tsx
<Static items={["logo"]}>
  {() => (
    <Box key="logo" marginBottom={1}>
      <Logo modelName={activeModel} />
    </Box>
  )}
</Static>
```

**근본 원인**: Ink의 `<Static>` 컴포넌트는 로그형 출력을 위한 것으로, 한 번 렌더링된 후 위로 스크롤되어 사라집니다. 대화가 길어지면 로고가 터미널 버퍼 밖으로 밀려납니다.

**Claude Code와의 차이**: Claude Code는 세션 시작 시 로고를 한 번 출력하지만, 핵심은 로고 자체가 아니라 **세션 컨텍스트 정보**(모델명, 프로젝트 경로, 세션 ID)가 항상 접근 가능하다는 점입니다. StatusBar에 이 정보가 통합되어 있어 로고가 스크롤되어도 컨텍스트를 잃지 않습니다.

**개선 방향**:

- 로고는 `<Static>`에 남기되, 핵심 정보(모델, 버전)는 `StatusBar`에 상시 표시
- 또는 `/logo` 슬래시 명령으로 언제든 다시 볼 수 있게 제공
- 세션 시작 시 한 번 출력하는 것은 유지하되, 사라지는 것 자체는 자연스러운 동작으로 수용

---

### 2.2 텍스트 깜빡임(Flicker) 문제

**근본 원인**: 복합적인 렌더링 과부하

#### 원인 1: 과다한 리렌더링 빈도

**파일**: `src/cli/App.tsx:130-132`, `src/cli/components/Spinner.tsx`

```tsx
// 매 텍스트 델타마다 상태 업데이트 → 전체 UI 리렌더
const onTextDelta = ({ text }: { text: string }) => {
  setStreamingText((prev) => prev + text); // 글자 1개마다 리렌더
};
```

```tsx
// 80ms마다 스피너 프레임 변경 → 추가 리렌더
const timer = setInterval(() => {
  setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
}, FRAME_INTERVAL); // 80ms
```

LLM 스트리밍 중에는:

- **텍스트 델타**: 토큰 하나당 `setStreamingText` → 리렌더
- **스피너**: 80ms마다 `setFrameIndex` → 리렌더
- **ToolCallBlock 스피너**: 실행 중인 도구마다 80ms 리렌더
- 이들이 **동시에 발생**하면 초당 50~100회 이상 리렌더

#### 원인 2: Ink의 전체 재그리기 방식

Ink는 동적 영역(Static 아닌 부분)을 매 렌더마다 완전히 지우고 다시 그립니다. 내용이 터미널 높이를 초과하면:

1. 이전 프레임 전체 삭제 (ANSI escape)
2. 새 프레임 전체 출력
3. 이 사이에 순간적으로 빈 화면이 보임 → **번쩍임**

#### 원인 3: 마크다운 렌더링 비용

**파일**: `src/cli/renderer/markdown.ts`

`marked` + `marked-terminal`로 매 렌더마다 마크다운을 파싱합니다. 스트리밍 중에는 불완전한 마크다운이 계속 변하므로 레이아웃이 불안정합니다.

**개선 방향**:

```
Phase 1 (즉시):
├─ 텍스트 델타를 버퍼링하여 50~100ms 간격으로 배치 업데이트
├─ 스트리밍 중 마크다운 렌더링 비활성화 (완료 후에만 적용)
├─ 스피너 인터벌을 200ms로 늘림
└─ React.memo로 불필요한 하위 컴포넌트 리렌더 방지

Phase 2 (구조적):
├─ Ink의 <Static>을 더 적극적으로 활용
│   완료된 도구 호출을 즉시 <Static>으로 이동
├─ 동적 영역의 크기를 최소화
│   (현재: 모든 도구 호출 + 스트리밍 + 입력 + 상태바)
│   (목표: 현재 진행 중인 항목 + 입력만 동적)
└─ 터미널 높이 초과 시 자동 스크롤 대신 페이징
```

---

### 2.3 작업 내용과 진행 상황 분리 문제

**이것이 가장 중요한 UX 문제입니다.**

#### 현재 구조 (App.tsx 레이아웃)

```
┌─────────────────────────────────────┐
│ [Static] Logo                        │  ← 스크롤되어 사라짐
│ [Static] MessageList                 │  ← 최종 텍스트만 (도구 이력 없음)
│                                      │
│ [Dynamic] ToolCallBlock × N          │  ← 현재 턴의 도구만 표시
│ [Dynamic] StreamingMessage           │  ← 현재 턴의 텍스트만
│ [Dynamic] Spinner                    │
│ [Dynamic] PermissionPrompt           │
│ [Dynamic] UserInput                  │
│ [Dynamic] StatusBar                  │
└─────────────────────────────────────┘
```

#### 문제점

1. **도구 이력 소실**: `processMessage` 시작 시 `setToolCalls([])` 으로 이전 턴의 도구 호출을 모두 삭제합니다. 이전에 무슨 파일을 읽고, 무슨 명령을 실행했는지 알 수 없습니다.

2. **텍스트와 도구의 시간적 분리**: Claude Code에서는 어시스턴트의 텍스트와 도구 호출이 시간순으로 인터리빙됩니다:

   ```
   assistant: 파일을 확인하겠습니다.
     [✓] Read src/App.tsx
   assistant: 수정이 필요합니다.
     [✓] Edited src/App.tsx
     [✓] Ran npm test
   assistant: 테스트가 통과했습니다.
   ```

   dhelix에서는:

   ```
   assistant: 테스트가 통과했습니다.  ← 최종 텍스트만
     [✓] Read src/App.tsx              ← 도구 호출은 별도 블록
     [✓] Edited src/App.tsx            ← 어떤 맥락에서 실행됐는지 모름
     [✓] Ran npm test
   ```

3. **컨텍스트 상실**: 여러 턴에 걸친 작업에서 "이전에 뭘 했는지" 한눈에 보이지 않습니다.

#### Claude Code의 접근 방식

Claude Code는 **턴 단위 Activity Feed** 패턴을 사용합니다:

```
┌─ Turn 1 ──────────────────────────────┐
│ user: 파일 구조를 보여줘              │
│                                        │
│ assistant: 확인하겠습니다.             │
│   [✓] Read src/                       │
│   [✓] Glob **/*.ts                    │
│ assistant: 총 15개 파일이 있습니다... │
└────────────────────────────────────────┘

┌─ Turn 2 ──────────────────────────────┐
│ user: App.tsx를 수정해줘              │
│                                        │
│ assistant: 수정하겠습니다.             │
│   [✓] Read src/App.tsx                │
│   [✓] Edited src/App.tsx              │
│ assistant: 수정 완료했습니다.          │
└────────────────────────────────────────┘
```

#### 개선 방향: Activity Feed 아키텍처

```typescript
// 새로운 메시지 타입: 턴 단위 활동 기록
interface TurnActivity {
  readonly turnId: string;
  readonly userMessage: string;
  readonly entries: readonly ActivityEntry[];
}

type ActivityEntry =
  | { type: "assistant-text"; content: string }
  | { type: "tool-start"; id: string; name: string; args?: Record<string, unknown> }
  | {
      type: "tool-complete";
      id: string;
      name: string;
      status: "complete" | "error";
      output?: string;
    }
  | { type: "permission-request"; toolName: string }
  | { type: "permission-result"; allowed: boolean };
```

```
구현 단계:
1. TurnActivity 데이터 모델 정의
2. agent-loop에서 이벤트를 시간순으로 수집
3. ActivityFeed 컴포넌트 구현 (턴 단위 그룹핑)
4. 완료된 턴은 <Static>으로 이동 (깜빡임 방지)
5. 현재 진행 중 턴만 동적 영역에 유지
```

---

### 2.4 다중 인스턴스 동시 실행 문제

**현재 상태**: dhelix는 단일 인스턴스만을 가정하고 설계되었습니다.

**충돌 지점**:

- `~/.dhelix/sessions/` 디렉토리의 세션 파일 동시 접근
- `~/.dhelix/debug.log` 로그 파일 경합
- 동일 프로젝트 디렉토리에서 복수 인스턴스의 파일 수정 충돌
- CLI stdin/stdout 점유 (터미널당 1개는 자연스러움, 문제는 같은 프로젝트를 다른 터미널에서 열 때)

**개선 방향**:

```
1. 세션 격리: 인스턴스별 고유 세션 ID + 잠금 파일(lockfile) 도입
2. 로그 격리: 인스턴스별 로그 파일 또는 로그 로테이션
3. 파일 수정 경합 감지: 파일 수정 전 mtime 체크 (optimistic locking)
4. 프로세스 발견: `~/.dhelix/instances.json`에 활성 인스턴스 등록
   - PID, 작업 디렉토리, 시작 시간 기록
   - 같은 디렉토리에서 이미 실행 중이면 경고 표시
```

---

### 2.5 Java/Spring Boot 프로젝트 빌드 실패

**testJava 프로젝트 분석 결과**:

| 문제                     | 원인                                                                  | 심각도   |
| ------------------------ | --------------------------------------------------------------------- | -------- |
| User 엔티티 중복         | 루트와 entity/ 디렉토리에 각각 다른 필드의 User 생성                  | Critical |
| 필드 불일치              | Controller가 `getUsername()` 호출하지만 엔티티에는 `name` 필드만 존재 | Critical |
| QueryDSL 버전            | 5.0.0은 Spring Boot 3.x (Jakarta) 미지원, 6.0+ 필요                   | High     |
| settings.gradle 누락     | Gradle 프로젝트 표준 파일 누락                                        | Low      |
| Gradle Wrapper 생성 실패 | 디렉토리에 기존 파일이 있어 `gradle init` 실패                        | High     |

**기존 E2E 테스트 (test-projects/spring-boot-api)에서도 유사 문제 발견**:

- `repositories { mavenCentral() }` 누락
- import 문 누락
- Gradle 9.3.1 호환성 문제
- getter/setter 누락

**근본 원인 분석**:

이 문제들은 LLM의 코드 생성 능력 문제가 아니라 **dhelix의 에이전트 루프 설계** 문제입니다:

1. **파일 일관성 검증 부재**: 새 파일을 쓸 때 기존 파일과의 관계(import, 타입 참조)를 검증하지 않음
2. **빌드 피드백 루프 부재**: 파일 생성 후 즉시 빌드/컴파일을 실행하여 오류를 조기 발견하는 단계가 없음
3. **자기 수정 루프 타임아웃**: 300초 제한으로 복잡한 빌드 오류 수정이 완료되지 않음
4. **프레임워크별 지식 부재**: Spring Boot 3.x + Jakarta, QueryDSL 6.x 등의 최신 버전 조합에 대한 가이드라인이 시스템 프롬프트에 없음

**개선 방향**:

```
단기:
├─ 빌드 검증 자동화: 프로젝트 생성 후 자동 빌드 실행
├─ 자기 수정 타임아웃 연장: 300s → 600s (또는 설정 가능)
├─ 오류 패턴 DB: 흔한 빌드 오류 패턴과 수정 방법을 시스템 프롬프트에 포함
└─ 파일 생성 시 기존 파일 스캔: 같은 이름의 클래스가 이미 있는지 확인

중기:
├─ 프레임워크별 프로젝트 템플릿 제공
│   (Spring Initializr API 연동, create-react-app, flutter create 등)
├─ 점진적 빌드 검증: 파일 3-5개 생성마다 빌드 체크
└─ LSP 연동: 컴파일 오류를 실시간으로 감지
```

---

### 2.6 빌드/테스트 수정 루프 타임아웃

**현재**: `TOOL_TIMEOUTS.bash = 120_000` (2분), 에이전트 루프 자체의 턴당 제한은 E2E 테스트에서 300초

**문제**: Java/Flutter 프로젝트의 첫 빌드는 의존성 다운로드만 수 분이 소요됩니다. 빌드 오류가 발생하면 LLM이 파일을 수정하고 다시 빌드하는 과정에서 쉽게 타임아웃됩니다.

**개선 방향**:

```
1. 의존성 다운로드와 빌드 분리
   - `gradle dependencies` → timeout 600s (의존성)
   - `gradle build` → timeout 120s (빌드만)
2. 점진적 수정: 한 번에 모든 오류를 고치려 하지 않고, 하나씩 수정 → 빌드 → 반복
3. 빌드 캐시 활용: Gradle daemon, npm cache 등을 인스턴스 간 공유
4. 병렬 도구 실행: 독립적인 파일 수정은 병렬로 처리
```

---

### 2.7 도구 실행 이력이 대화에 보존되지 않음

**파일**: `src/cli/App.tsx:168`, `src/cli/App.tsx:244-249`

```tsx
// processMessage 시작 시 모든 도구 호출 초기화
setToolCalls([]);

// 결과에서 최종 assistant 텍스트만 대화에 추가
const lastMessage = result.messages[result.messages.length - 1];
if (lastMessage && lastMessage.role === "assistant") {
  addAssistantMessage(lastMessage.content);
}
```

**문제**: agent-loop은 내부적으로 모든 도구 호출과 결과를 `messages` 배열에 유지하지만, App.tsx에서는 최종 assistant 텍스트만 `conversation`에 추가합니다. 도구 호출 이력은 UI에서만 임시로 표시되고 영구 보존되지 않습니다.

**개선 방향**:

```
1. Conversation에 도구 호출 메시지도 포함
   - tool-call 메시지 (assistant가 도구를 호출함)
   - tool-result 메시지 (도구 실행 결과)
2. 세션 저장 시 전체 메시지 이력 보존
3. 세션 복원 시 도구 이력도 함께 표시
```

---

### 2.8 멀티라인 입력 미지원

**파일**: `src/cli/components/UserInput.tsx`

현재 UserInput은 단일 라인만 지원합니다. Enter 키가 즉시 제출(submit)을 트리거합니다.

**Claude Code와의 차이**: Claude Code는 `Shift+Enter`로 줄바꿈, `Enter`로 제출을 분리합니다. 코드 붙여넣기, 여러 줄의 지시사항 입력에 필수적입니다.

**개선 방향**:

```
1. Shift+Enter 또는 Option+Enter → 줄바꿈 삽입
2. Enter → 제출
3. 붙여넣기 감지: 빠르게 여러 줄이 입력되면 자동으로 멀티라인 모드
4. 텍스트 영역 높이 자동 조정 (최대 터미널 높이의 50%)
```

---

### 2.9 입력 히스토리 미지원

**현재**: 위/아래 화살표 키에 대한 핸들러가 없습니다.

**개선 방향**:

```
1. 입력 히스토리 배열 관리 (세션 내)
2. 위 화살표 → 이전 입력, 아래 화살표 → 다음 입력
3. 영구 히스토리: ~/.dhelix/history에 저장 (선택적)
```

---

### 2.10 컨텍스트 압축 방식

**파일**: `src/core/context-manager.ts`

현재 context-manager는 토큰 예산 초과 시 단순 절삭 방식을 사용합니다. 오래된 메시지를 잘라냅니다.

**개선 방향**:

```
1. 요약 기반 압축: LLM에게 이전 대화를 요약하도록 요청
2. 중요도 기반 보존: 시스템 프롬프트, 최근 N턴, 핵심 결정 사항 보존
3. 도구 결과 선택적 제거: 도구 출력(파일 내용 등)은 압축 우선 대상
4. 청크 단위 압축: 전체를 한 번에 압축하지 않고, 블록 단위로 점진적 압축
```

---

## 3. 개선 우선순위 및 로드맵

### Phase 0: Critical Fixes (1-2주)

> 사용성에 직접적으로 영향을 미치는 즉각적 수정

| #   | 작업                                         | 파일                               | 예상 복잡도 |
| --- | -------------------------------------------- | ---------------------------------- | ----------- |
| 0-1 | 텍스트 델타 버퍼링 (50ms 배치)               | `App.tsx`                          | Low         |
| 0-2 | 스트리밍 중 마크다운 렌더링 비활성화         | `StreamingMessage.tsx`             | Low         |
| 0-3 | 스피너 인터벌 200ms로 변경                   | `Spinner.tsx`, `ToolCallBlock.tsx` | Low         |
| 0-4 | React.memo 적용 (MessageList, ToolCallBlock) | 각 컴포넌트                        | Low         |
| 0-5 | StatusBar에 모델/버전 정보 상시 표시         | `StatusBar.tsx`                    | Low         |

```typescript
// 0-1: 텍스트 델타 버퍼링 예시
const textBufferRef = useRef("");
const flushTimerRef = useRef<NodeJS.Timeout>();

const onTextDelta = ({ text }: { text: string }) => {
  textBufferRef.current += text;
  if (!flushTimerRef.current) {
    flushTimerRef.current = setTimeout(() => {
      setStreamingText((prev) => prev + textBufferRef.current);
      textBufferRef.current = "";
      flushTimerRef.current = undefined;
    }, 50);
  }
};
```

### Phase 1: Activity Feed (2-3주)

> 가장 큰 UX 개선 — 작업 내용과 진행 상황 통합

| #   | 작업                                 | 설명                                        |
| --- | ------------------------------------ | ------------------------------------------- |
| 1-1 | `TurnActivity` 데이터 모델 정의      | 턴 단위 활동 기록 타입                      |
| 1-2 | `ActivityCollector` 구현             | 이벤트를 시간순 ActivityEntry 배열로 수집   |
| 1-3 | `TurnBlock` 컴포넌트                 | 한 턴의 모든 활동을 그룹핑하여 표시         |
| 1-4 | `ActivityFeed` 컴포넌트              | 완료된 턴 목록 (Static) + 현재 턴 (Dynamic) |
| 1-5 | `MessageList` → `ActivityFeed` 교체  | App.tsx 레이아웃 재구성                     |
| 1-6 | 도구 호출 이력을 Conversation에 보존 | 세션 저장/복원에 포함                       |

**목표 레이아웃**:

```
┌─────────────────────────────────────┐
│ [Static] Logo (한 번 출력)           │
│                                      │
│ [Static] Turn 1:                     │
│   user: 파일 구조를 보여줘           │
│   assistant: 확인하겠습니다.         │
│     [✓] Read src/                   │
│     [✓] Glob **/*.ts                │
│   assistant: 15개 파일입니다...      │
│                                      │
│ [Static] Turn 2:                     │
│   user: App.tsx를 수정해줘           │
│   assistant: 수정합니다.             │
│     [✓] Read src/App.tsx            │
│     [✓] Edited src/App.tsx          │
│   assistant: 완료했습니다.           │
│                                      │
│ [Dynamic] Turn 3 (진행 중):          │
│   user: 테스트 실행해줘             │
│   assistant: 실행하겠습니다.         │
│     [⠋] Running npm test            │  ← 여기만 Dynamic
│                                      │
│ [Dynamic] > _                        │  ← 입력
│ [Dynamic] StatusBar                  │  ← 상태바
└─────────────────────────────────────┘
```

### Phase 2: Input & Interaction (1-2주)

| #   | 작업                                  |
| --- | ------------------------------------- |
| 2-1 | 멀티라인 입력 (Shift+Enter)           |
| 2-2 | 입력 히스토리 (위/아래 화살표)        |
| 2-3 | 붙여넣기 감지 및 멀티라인 자동 전환   |
| 2-4 | Tab 자동완성 (파일 경로, 슬래시 명령) |

### Phase 3: Agent Quality (2-3주)

| #   | 작업                                |
| --- | ----------------------------------- |
| 3-1 | 프로젝트 생성 후 자동 빌드 검증     |
| 3-2 | 자기 수정 전략 개선 (점진적 수정)   |
| 3-3 | 프레임워크별 시스템 프롬프트 보강   |
| 3-4 | 파일 일관성 검증 (중복 클래스 감지) |
| 3-5 | 빌드 타임아웃 단계적 분리           |

### Phase 4: Multi-Instance & Context (2-3주)

| #   | 작업                                             |
| --- | ------------------------------------------------ |
| 4-1 | 인스턴스 레지스트리 (`~/.dhelix/instances.json`) |
| 4-2 | 세션 파일 잠금 (lockfile)                        |
| 4-3 | 같은 디렉토리 다중 접근 경고                     |
| 4-4 | 요약 기반 컨텍스트 압축                          |
| 4-5 | 중요도 기반 메시지 보존                          |

---

## 4. 기술적 구현 상세

### 4.1 텍스트 델타 버퍼링 (Phase 0-1)

**변경 파일**: `src/cli/App.tsx`

```typescript
// Before: 매 델타마다 즉시 상태 업데이트
const onTextDelta = ({ text }: { text: string }) => {
  setStreamingText((prev) => prev + text);
};

// After: 50ms 버퍼링 후 배치 업데이트
const textBufferRef = useRef("");
const flushTimerRef = useRef<ReturnType<typeof setTimeout>>();

useEffect(() => {
  const onTextDelta = ({ text }: { text: string }) => {
    textBufferRef.current += text;
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => {
        const buffered = textBufferRef.current;
        textBufferRef.current = "";
        flushTimerRef.current = undefined;
        setStreamingText((prev) => prev + buffered);
      }, 50);
    }
  };

  events.on("llm:text-delta", onTextDelta);
  return () => {
    events.off("llm:text-delta", onTextDelta);
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      // Flush remaining on cleanup
      setStreamingText((prev) => prev + textBufferRef.current);
      textBufferRef.current = "";
    }
  };
}, [events]);
```

### 4.2 Activity Feed 데이터 모델 (Phase 1-1)

**새 파일**: `src/core/activity.ts`

```typescript
export type ActivityEntryType =
  | "user-message"
  | "assistant-text"
  | "tool-start"
  | "tool-complete"
  | "tool-denied"
  | "error";

export interface ActivityEntry {
  readonly type: ActivityEntryType;
  readonly timestamp: Date;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface TurnActivity {
  readonly id: string;
  readonly entries: readonly ActivityEntry[];
  readonly isComplete: boolean;
}
```

### 4.3 완료된 턴의 Static 전환 (Phase 1-4)

```tsx
// ActivityFeed.tsx
export function ActivityFeed({ turns, currentTurn }: ActivityFeedProps) {
  return (
    <>
      {/* 완료된 턴들은 Static으로 → 리렌더 안 됨, 깜빡임 없음 */}
      <Static items={turns.map((t, i) => ({ ...t, key: `turn-${i}` }))}>
        {(turn) => <TurnBlock key={turn.key} turn={turn} />}
      </Static>

      {/* 현재 진행 중 턴만 Dynamic */}
      {currentTurn && <TurnBlock turn={currentTurn} isLive />}
    </>
  );
}
```

### 4.4 프레임워크별 빌드 검증 (Phase 3-1)

**새 파일**: `src/tools/validators/build-validator.ts`

```typescript
interface BuildValidator {
  detect(workingDir: string): Promise<boolean>;
  validate(workingDir: string): Promise<BuildResult>;
}

const validators: BuildValidator[] = [
  {
    // Gradle 프로젝트 감지 및 검증
    detect: async (dir) => existsFile(join(dir, "build.gradle")),
    validate: async (dir) => exec("./gradlew build --no-daemon", { cwd: dir, timeout: 300_000 }),
  },
  {
    // Node.js 프로젝트
    detect: async (dir) => existsFile(join(dir, "package.json")),
    validate: async (dir) => exec("npm run build", { cwd: dir, timeout: 120_000 }),
  },
  // Flutter, Python 등 추가...
];
```

---

## 5. Claude Code와의 핵심 차이 요약

| 영역              | Claude Code               | dhelix 현재            | 개선 목표              |
| ----------------- | ------------------------- | ---------------------- | ---------------------- |
| **턴 표시**       | 텍스트+도구 인터리빙      | 텍스트와 도구 분리     | Activity Feed          |
| **도구 이력**     | 전체 세션 보존            | 현재 턴만 임시 표시    | 영구 보존              |
| **렌더링**        | 안정적 (자체 터미널 제어) | Ink 기반 깜빡임        | 버퍼링 + Static 최적화 |
| **입력**          | 멀티라인, 히스토리        | 단일라인만             | Phase 2에서 구현       |
| **빌드 검증**     | 자동 빌드/테스트          | 사용자가 요청해야 실행 | 자동 검증              |
| **다중 인스턴스** | 지원 (세션 격리)          | 미지원                 | Phase 4에서 구현       |
| **컨텍스트 관리** | 요약 기반 압축            | 단순 절삭              | 요약 기반으로 전환     |

---

## 6. 즉시 실행 가능한 Quick Wins

코드 변경 최소화로 체감 개선이 큰 항목들:

1. **Spinner 인터벌 80ms → 200ms**: 3줄 수정, 렌더링 부하 60% 감소
2. **스트리밍 중 마크다운 비활성화**: `StreamingMessage.tsx`에서 `isComplete`가 false일 때 raw text 표시
3. **완료된 도구 호출에 스피너 제거**: `useSpinner` 훅이 `status !== "running"`이면 interval 생성 안 함 (이미 구현됨, 확인 필요)
4. **StatusBar에 버전+모델 표시**: Logo가 사라져도 현재 모델 정보 유지
5. **`/logo` 명령 추가**: 로고를 다시 볼 수 있는 슬래시 명령

---

## 7. 결론

dhelix v0.1.0은 **기능적으로 완성도가 높습니다**. 5개 기술 스택에서 프로젝트를 성공적으로 생성하고, 193회의 도구 호출을 정확하게 수행하며, 41개 이상의 테스트를 통과시켰습니다.

그러나 **UX 완성도**에서 Claude Code와 명확한 차이가 있으며, 이는 사용자 신뢰도에 직접적으로 영향을 미칩니다:

- **깜빡임** → "불안정해 보인다"
- **도구 이력 소실** → "뭘 했는지 모르겠다"
- **텍스트/도구 분리** → "맥락을 따라가기 어렵다"

**최우선 과제**는 Phase 0 (깜빡임 수정)과 Phase 1 (Activity Feed)입니다. 이 두 가지만 완료해도 사용자 체감 품질이 크게 향상됩니다. 나머지는 점진적으로 구현하되, 각 Phase가 독립적으로 배포 가능하도록 설계해야 합니다.
