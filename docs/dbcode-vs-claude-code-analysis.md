# dbcode vs Claude Code 상세 비교 분석

> 작성일: 2026-03-08
> 분석 대상: dbcode (현재 main 브랜치) vs Anthropic Claude Code 2.1.x

---

## 1. 전체 요약

| 영역              | dbcode        | Claude Code    | 격차        |
| ----------------- | ------------- | -------------- | ----------- |
| 핵심 아키텍처     | ✅ 완성       | ✅ 완성        | 동등        |
| 도구 시스템       | ⚠️ 11개 도구  | ✅ 15+ 도구    | 중간        |
| CLI UX/표시       | ⚠️ 기본 수준  | ✅ 프로덕션    | **큰 격차** |
| 컨텍스트 관리     | ✅ 자동 압축  | ✅ 자동 압축   | 동등        |
| 권한/보안         | ✅ 5단계 모드 | ✅ 다단계 모드 | 동등        |
| 세션 관리         | ✅ 파일 기반  | ✅ 파일 기반   | 동등        |
| MCP 지원          | ✅ stdio      | ✅ stdio+SSE   | 소폭 부족   |
| 서브에이전트      | ⚠️ 기본       | ✅ 풀 기능     | 중간        |
| Extended Thinking | ❌ 없음       | ✅ 완전 지원   | **큰 격차** |
| 멀티모달          | ❌ 없음       | ✅ 이미지/PDF  | **큰 격차** |

---

## 2. CLI UX 상세 비교

### 2.1 도구 실행 표시

**Claude Code의 표시 방식:**

```
⏺ Read(src/cli/App.tsx)
  ⎿  (전체 파일 내용 또는 요약)

⏺ Edit(src/cli/App.tsx)
  ⎿  Updated src/cli/App.tsx
     Added 3 lines, removed 1 line
      107     <Box flexDirection="column" padding={1}>
      108 -     <Logo />
      108 +     <Static items={[{ key: "logo" }]}>
      109 +       {() => <Logo />}
      110 +     </Static>
      111       <ActivityFeed ...

⏺ Bash(npm test)
  ⎿  ✓ 80 passed (80)
     Tests  1042 passed (1042)
     Duration  16.44s
```

**dbcode의 현재 표시 방식:**

```
[⠋] Reading src/cli/App.tsx
[✓] Read src/cli/App.tsx (50 lines) (1.2s)
[⠋] Editing src/cli/App.tsx
[✓] Edited src/cli/App.tsx (0.8s)
  - <Logo />
  + <Static items={[{ key: "logo" }]}>     ← 방금 추가한 diff 프리뷰
[⠋] Running npm test
[✓] Ran npm test (16.4s)
  ✓ 80 passed                               ← 방금 추가한 출력 프리뷰
```

**남은 격차:**

| 항목                                          | Claude Code      | dbcode            | 우선순위 |
| --------------------------------------------- | ---------------- | ----------------- | -------- |
| 도구 아이콘 (⏺ vs [✓])                       | ⏺ filled circle | [✓] brackets      | P2       |
| Edit 시 줄 번호 + 컨텍스트 라인 표시          | ✅ ±3줄 컨텍스트 | ⚠️ old/new만 표시 | **P0**   |
| Edit 시 "Added N lines, removed M lines" 요약 | ✅               | ❌                | **P0**   |
| Read 결과 접기/펼치기                         | ✅ 길면 접기     | ❌ 항상 숨김      | P1       |
| Bash 출력 접기/펼치기 (ctrl+o)                | ✅               | ❌                | P1       |
| 도구 설명 (description) 표시                  | ✅               | ❌                | P2       |
| 병렬 도구 실행 표시                           | ✅ 동시 진행     | ❌ 순차 표시      | P1       |

### 2.2 스트리밍 & 마크다운

| 항목                          | Claude Code        | dbcode                  | 우선순위 |
| ----------------------------- | ------------------ | ----------------------- | -------- |
| 실시간 마크다운 렌더링        | ✅ 스트리밍 중에도 | ⚠️ 완료 후에만          | P1       |
| 코드블록 구문 하이라이팅      | ✅ highlight.js    | ⚠️ marked-terminal 기본 | P2       |
| 인라인 코드 `backtick` 스타일 | ✅ 배경색          | ⚠️ 기본                 | P3       |
| 테이블 렌더링                 | ✅ 정렬            | ⚠️ 기본                 | P3       |

### 2.3 입력 UX

| 항목                                 | Claude Code | dbcode                | 상태   |
| ------------------------------------ | ----------- | --------------------- | ------ |
| 멀티라인 입력 (Ctrl+J / Shift+Enter) | ✅          | ✅ 수정 완료          | 동등   |
| 입력 히스토리 (↑/↓)                  | ✅          | ✅                    | 동등   |
| readline 단축키 (Ctrl+A/E/K/U/W)     | ✅          | ✅                    | 동등   |
| 단어 단위 이동 (Alt+←/→)             | ✅          | ✅                    | 동등   |
| 슬래시 명령어 자동완성               | ✅          | ✅                    | 동등   |
| 탭 자동완성 (파일 경로)              | ✅          | ❌                    | **P1** |
| @ 멘션 (파일/디렉토리)               | ✅          | ✅ 파서 있음, UI 없음 | P1     |
| 이미지 붙여넣기                      | ✅          | ❌                    | P2     |

### 2.4 상태바 & 정보 표시

| 항목                   | Claude Code    | dbcode          | 상태 |
| ---------------------- | -------------- | --------------- | ---- |
| 모델명 표시            | ✅             | ✅              | 동등 |
| 토큰 사용량 바         | ✅             | ✅              | 동등 |
| 비용 표시              | ✅ API 비용    | ⚠️ /cost 명령만 | P2   |
| 세션 이름              | ✅             | ⚠️ 표시만       | 동등 |
| extended thinking 토글 | ✅ Option+T    | ❌              | P1   |
| 컨텍스트 % 경고        | ✅ 80% 초과 시 | ⚠️ 색상만 변경  | P2   |

---

## 3. 핵심 기능 비교

### 3.1 도구 (Tools)

**Claude Code의 도구:**
| 도구 | Claude Code | dbcode | 격차 |
|------|-------------|--------|------|
| Read | ✅ 이미지/PDF 지원, 2000줄 기본 | ⚠️ 텍스트만, 줄 제한 없음 | **P0** |
| Edit | ✅ uniqueness 검증, old_string/new_string | ✅ 동일 | 동등 |
| Write | ✅ 기존 파일 읽기 필수 확인 | ✅ | 동등 |
| Bash | ✅ 타임아웃, 백그라운드 실행, 설명 필수 | ⚠️ 타임아웃만 | **P0** |
| Glob | ✅ mtime 정렬 | ✅ | 동등 |
| Grep | ✅ ripgrep, 컨텍스트 라인, output_mode | ⚠️ 기본 | P1 |
| Agent (서브에이전트) | ✅ 다양한 타입, 병렬 실행 | ⚠️ explore/plan/general만 | P1 |
| Notebook Edit | ✅ | ✅ | 동등 |
| WebFetch | ✅ | ✅ | 동등 |
| WebSearch | ✅ | ❌ | **P0** |
| TodoWrite/TodoRead | ✅ 작업 관리 | ❌ TaskManager만 | P1 |
| LSP | ✅ 언어 서버 연동 | ❌ | P2 |
| MCP tools | ✅ 동적 로딩 | ✅ | 동등 |

**dbcode에만 있는 도구:**

- `list_dir` — Claude Code는 Bash(`ls`)로 대체
- `ask_user` — Claude Code는 `AskUserQuestion`

### 3.2 Bash 도구 세부 비교

| 기능                                  | Claude Code               | dbcode        |
| ------------------------------------- | ------------------------- | ------------- |
| 타임아웃 (기본 120s, 최대 600s)       | ✅                        | ✅            |
| `run_in_background` 파라미터          | ✅                        | ❌            |
| `description` 파라미터 (필수)         | ✅                        | ❌            |
| 작업 디렉토리 유지                    | ✅ cd 없이 절대 경로 권장 | ⚠️ cwd 고정   |
| 대화형 명령어 차단 (git rebase -i 등) | ✅ 시스템 프롬프트        | ❌            |
| 위험 명령어 경고 (rm -rf, force push) | ✅ 시스템 프롬프트        | ⚠️ guardrails |

### 3.3 file_read 세부 비교

| 기능                      | Claude Code        | dbcode         |
| ------------------------- | ------------------ | -------------- |
| 줄 번호 표시              | ✅ cat -n 형식     | ✅ 유사        |
| offset/limit              | ✅                 | ✅             |
| 이미지 읽기 (PNG, JPG)    | ✅ 멀티모달        | ❌             |
| PDF 읽기 (pages 파라미터) | ✅                 | ❌             |
| Jupyter 노트북 읽기       | ✅                 | ❌ (별도 도구) |
| 2000줄 기본 제한          | ✅                 | ❌ 전체 읽기   |
| 2000자 줄 truncation      | ✅                 | ❌             |
| 빈 파일 경고              | ✅ system-reminder | ❌             |

---

## 4. 아키텍처 비교

### 4.1 에이전트 루프

| 항목                | Claude Code                     | dbcode        | 비고        |
| ------------------- | ------------------------------- | ------------- | ----------- |
| ReAct 패턴          | ✅                              | ✅            | 동등        |
| maxIterations       | ✅                              | ✅ (50)       | 동등        |
| 자동 컨텍스트 압축  | ✅ 95% 임계값                   | ✅ 95%        | 동등        |
| 스트리밍 지원       | ✅                              | ✅            | 동등        |
| 에러 분류 & 재시도  | ✅ transient/overload/permanent | ✅ 동일       | 동등        |
| Extended Thinking   | ✅ 31,999 토큰 예산             | ❌            | **큰 격차** |
| 병렬 도구 실행      | ✅ 여러 도구 동시               | ❌ 순차 실행  | **P0**      |
| 도구 결과 크기 제한 | ✅                              | ✅ (12,000자) | 동등        |
| AbortSignal 취소    | ✅                              | ✅            | 동등        |

### 4.2 LLM 클라이언트

| 항목                     | Claude Code        | dbcode                   | 비고        |
| ------------------------ | ------------------ | ------------------------ | ----------- |
| Anthropic API 직접 지원  | ✅ 전용 프로바이더 | ❌ OpenAI 호환만         | **P0**      |
| OpenAI 호환 API          | ✅                 | ✅                       | 동등        |
| 스트리밍 (SSE)           | ✅                 | ✅                       | 동등        |
| 토큰 카운팅              | ✅ tiktoken        | ✅ js-tiktoken           | 동등        |
| 모델 자동 라우팅         | ✅                 | ✅ model-capabilities    | 동등        |
| Extended Thinking 스트림 | ✅ thinking 블록   | ❌                       | **큰 격차** |
| 429 재시도               | ✅ 즉시 에러       | ✅ 즉시 에러 (수정 완료) | 동등        |

### 4.3 서브에이전트 시스템

**Claude Code:**

- 다양한 에이전트 타입: general, Explore, Plan, claude-code-guide 등
- `run_in_background` 지원 — 비동기 실행 후 알림
- `isolation: "worktree"` — git worktree에서 격리 실행
- `resume` — 이전 에이전트 컨텍스트 이어받기
- 병렬 에이전트 실행 (한 메시지에 여러 Agent 호출)
- 에이전트 간 통신 없음 (각자 독립)

**dbcode:**

- 3개 타입만: explore, plan, general
- 백그라운드 실행 없음
- worktree 격리 없음
- 이어받기(resume) 없음
- 병렬 실행 없음

**우선순위: P1**

---

## 5. 슬래시 명령어 비교

### 5.1 dbcode에 있는 명령어 (29개)

```
/clear  /compact  /help  /model  /resume  /rewind  /effort  /fast
/simplify  /batch  /debug  /mcp  /config  /diff  /doctor  /stats
/status  /context  /copy  /export  /fork  /output-style  /rename
/cost  /update  /init  /plan  /undo
```

### 5.2 Claude Code에 있고 dbcode에 없는 것

| 명령어               | 기능             | 우선순위 |
| -------------------- | ---------------- | -------- |
| `/bug`               | 버그 리포트 생성 | P3       |
| `/login` / `/logout` | 인증 관리        | P2       |
| `/permissions`       | 권한 모드 변경   | P1       |
| `/terminal-setup`    | 터미널 설정      | P3       |
| `/memory`            | 자동 메모리 관리 | P2       |
| `/review`            | PR 리뷰 시작     | P2       |
| `/pr-comments`       | PR 코멘트 보기   | P2       |
| `/vim`               | Vim 모드 토글    | P3       |

### 5.3 dbcode에만 있는 고유 명령어

```
/effort  /fast  /simplify  /batch  /doctor  /fork
/output-style  /rename  /cost  /undo
```

이 중 `/effort`, `/fast`, `/undo`, `/fork`는 Claude Code에 없는 유용한 기능

---

## 6. 보안 & 권한 비교

| 항목                      | Claude Code | dbcode                     | 상태 |
| ------------------------- | ----------- | -------------------------- | ---- |
| 권한 모드 (5단계)         | ✅          | ✅                         | 동등 |
| 세션별 승인 캐싱          | ✅          | ✅                         | 동등 |
| Seatbelt 샌드박스 (macOS) | ✅          | ⚠️ 구현 파일 있으나 미완성 | P1   |
| 비밀 스캔 (출력 필터)     | ✅          | ✅                         | 동등 |
| 위험 명령어 필터          | ✅          | ✅ guardrails              | 동등 |
| Hooks 시스템              | ✅          | ✅ 5개 이벤트              | 동등 |
| .gitignore 준수           | ✅          | ⚠️ 일부만                  | P2   |

---

## 7. 개선 로드맵 (우선순위별)

### Phase 0 — 즉시 수정 필요 (이미 완료된 것)

- [x] 429 rate limit 즉시 에러 표시
- [x] 로고 1회 표시 (Static 래핑)
- [x] 도구 표시 개선 (diff 프리뷰, 출력 프리뷰)
- [x] Korean IME Enter 키 호환
- [x] /init 피드백 개선

### Phase 1 — 핵심 UX 격차 해소 (P0)

#### 1.1 Edit 도구 표시 — 줄 번호 + 컨텍스트 라인

```
⏺ Edit(src/cli/App.tsx)
  ⎿  Updated src/cli/App.tsx
     Added 3 lines, removed 1 line
      107     <Box flexDirection="column" padding={1}>
      108 -     <Logo />
      108 +     <Static items={[{ key: "logo" }]}>
      109 +       {() => <Logo />}
      110 +     </Static>
```

- `file_edit` 도구 결과에 변경 줄 수 통계 포함
- `tool-display.ts`의 diff 프리뷰에 줄 번호 추가
- 파일 전체에서 변경 위치 컨텍스트 ±3줄 표시

#### 1.2 Bash 도구 — description + background 지원

```typescript
// bash-exec.ts에 추가
const paramSchema = z.object({
  command: z.string(),
  description: z.string().optional(), // 무엇을 하는 명령인지
  run_in_background: z.boolean().optional(), // 백그라운드 실행
  timeout: z.number().optional(),
});
```

#### 1.3 file_read — 이미지/PDF 지원

- 이미지: base64 인코딩 → LLM에 멀티모달 메시지로 전달
- PDF: `pdf-parse` 또는 `pdfjs-dist`로 텍스트 추출
- Jupyter: `.ipynb` 파서 추가 (셀 + 출력)

#### 1.4 병렬 도구 실행

- 현재: LLM이 여러 tool_calls 반환 → 하나씩 순차 실행
- 목표: `Promise.allSettled()`로 독립 도구 동시 실행
- 주의: 파일 쓰기 간 의존성 체크 필요

#### 1.5 WebSearch 도구 추가

```typescript
export const webSearchTool: ToolDefinition = {
  name: "web_search",
  description: "Search the web for current information",
  parameterSchema: z.object({
    query: z.string(),
    max_results: z.number().optional(),
  }),
  permissionLevel: "safe",
  execute: async (params) => {
    /* Brave/Bing/Google API */
  },
};
```

### Phase 2 — Extended Thinking 지원 (P0)

#### 2.1 Anthropic 프로바이더 추가

```
src/llm/providers/
├── anthropic.ts     ← 신규: Anthropic Messages API 직접 호출
└── openai-compat.ts ← 기존 client.ts 리네이밍
```

- `system` → 별도 필드, `tool_use`/`tool_result` 블록 형식
- Extended Thinking: `thinking` 블록 스트리밍
- Budget: `thinking.budget_tokens` 파라미터

#### 2.2 Thinking UI 컴포넌트

```tsx
// ThinkingBlock.tsx
<Box flexDirection="column">
  <Text color="gray" dimColor>
    {isExpanded ? thinkingContent : `Thinking... (${tokenCount} tokens)`}
  </Text>
</Box>
```

- Option+T로 thinking 표시 토글
- thinking 토큰 사용량 표시

### Phase 3 — 서브에이전트 고도화 (P1)

#### 3.1 백그라운드 실행

```typescript
interface SubagentConfig {
  run_in_background?: boolean; // 백그라운드 실행
  isolation?: "worktree"; // git worktree 격리
  resume?: string; // 이전 에이전트 ID
}
```

#### 3.2 전문 에이전트 타입 추가

- `code-reviewer` — 코드 리뷰 전문
- `build-error-resolver` — 빌드 에러 해결
- `security-reviewer` — 보안 분석
- `tdd-guide` — TDD 가이드

### Phase 4 — UX 고급 기능 (P1-P2)

#### 4.1 탭 자동완성 (파일 경로)

- Tab 키 → 현재 입력 분석 → 파일 경로 후보 표시
- `fast-glob`으로 후보 검색

#### 4.2 @ 멘션 UI

- `@file:path` 입력 시 파일 내용을 컨텍스트에 주입
- `mentions/parser.ts`는 이미 존재 — UI 연결 필요

#### 4.3 접기/펼치기 (Expandable Output)

- 긴 도구 출력 기본 접힘
- Ctrl+O 또는 클릭으로 펼치기
- Claude Code의 "ctrl+o to expand" 패턴

#### 4.4 실시간 마크다운 렌더링

- 현재: `isComplete` 후에만 `renderMarkdown()`
- 목표: 코드블록 경계 감지 후 부분 렌더링

### Phase 5 — 운영 품질 (P2)

#### 5.1 비용 추적

- 모델별 토큰 단가 테이블
- 세션별 누적 비용 표시 (StatusBar)
- `/cost` 명령어 이미 존재 — 실시간 표시 추가

#### 5.2 텔레메트리 통합

- `src/telemetry/` 파일 있으나 연결 미완성
- OpenTelemetry 지표: 응답 시간, 토큰 사용량, 에러율

#### 5.3 macOS Seatbelt 샌드박스

- `src/sandbox/` 디렉토리 구조 정의됨
- AppSandbox 프로파일로 파일시스템 접근 제한
- 네트워크 접근 제한 (API URL만 허용)

---

## 8. 코드 품질 이슈

### 8.1 도구 결과 크기 관리

**현재**: `maxToolResultChars = 12,000` (문자 기준)
**문제**: 문자 수 ≠ 토큰 수. 한국어는 문자당 ~2-3 토큰
**해결**: 토큰 기반 truncation으로 변경

### 8.2 스트리밍 백프레셔

**현재**: `streaming.ts`에서 청크를 메모리에 무한 축적
**문제**: 매우 긴 응답 시 메모리 사용량 증가
**해결**: 청크 버퍼 크기 제한 + 플러시 메커니즘

### 8.3 토큰 카운팅 캐싱

**현재**: `countTokens()` 매번 새로 계산
**해결**: LRU 캐시 (최근 100개 메시지)

### 8.4 file_edit uniqueness 검증

**현재**: `content.split(old_string).length - 1`로 카운트
**문제**: 매우 큰 파일에서 O(n) × 문자열 분할 비용
**해결**: `indexOf` + 두 번째 `indexOf`로 2개 이상 확인

### 8.5 에러 메시지 일관성

**현재**: 일부 한국어, 일부 영어 혼재
**해결**: i18n 시스템 또는 한국어 통일

---

## 9. 테스트 커버리지 분석

| 모듈                 | 테스트 파일 수 | 테스트 수 | 상태 |
| -------------------- | -------------- | --------- | ---- |
| CLI 컴포넌트         | 11             | 202       | ✅   |
| LLM 클라이언트       | 6              | 100+      | ✅   |
| 도구 정의            | 11             | 150+      | ✅   |
| 코어 (agent-loop 등) | 5              | 100+      | ✅   |
| 권한/보안            | 5              | 50+       | ✅   |
| 설정/훅              | 5              | 50+       | ✅   |
| E2E                  | 6              | 소수      | ⚠️   |
| **합계**             | **80**         | **1042**  |      |

**누락된 테스트:**

- `src/mcp/client.ts` — 연결/재연결/에러 시나리오
- `src/subagents/spawner.ts` — 서브에이전트 라이프사이클
- `src/telemetry/` — 지표 수집/전송
- `src/skills/` — 스킬 로딩/실행
- `src/mentions/` — 파서 + 리졸버

---

## 10. 프로젝트 구조 통계

```
소스 파일:     95+ (.ts/.tsx)
테스트 파일:   80+
도구:          11개
슬래시 명령어: 29개
CLI 컴포넌트:  15개
가드레일:      4개 (command-filter, secret-scanner, output-limiter, types)
프로바이더:    1개 (OpenAI 호환)
서브에이전트:  3개 타입 (explore, plan, general)
```

---

## 11. 결론

dbcode는 **핵심 아키텍처**와 **기능 구현**에서 Claude Code와 대등한 수준입니다. 주요 격차는:

1. **Extended Thinking** — Anthropic API 전용 프로바이더 필요
2. **멀티모달 (이미지/PDF)** — file_read 확장
3. **CLI UX 디테일** — Edit diff 표시, 접기/펼치기, 탭 자동완성
4. **병렬 도구 실행** — agent-loop에서 Promise.allSettled
5. **Bash 고급 기능** — description, background 실행

이 5가지를 해결하면 Claude Code와 기능적으로 거의 동등한 수준에 도달합니다.
