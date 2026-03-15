# Claude Code 피드백 시스템 심층 분석 v2

> **Date**: 2026-03-15
> **Version**: v2 — 실구현 감사 + 프로덕션 갭 분석 + 경쟁 벤치마킹
> **Scope**: 10개 통합 지점 감사, 7개 팀 병렬 수정, 프로덕션 준비도 분석
> **Changes**: v1 대비 330줄 코드 추가 (10개 파일)

---

## Part 1: v1에서 발견된 미연결 이슈 및 수정 결과

### 정밀 감사 결과 (10개 통합 지점)

v1 문서에서 "구현 완료"로 표기했으나, 실제 코드 감사에서 **3개 CRITICAL + 2개 PARTIAL** 이슈를 발견했다.

| # | 통합 지점 | v1 판정 | v2 감사 결과 | 수정 후 |
|---|----------|--------|-------------|---------|
| 1 | ask_user 이벤트 플로우 | ✅ | ✅ 연결됨 — executor가 events를 ToolContext에 전달 | — |
| 2 | **RetryCountdown** | ✅ | **❌ 미연결** — 컴포넌트 존재하나 어디서도 렌더링 안 됨 | ✅ 수정 완료 |
| 3 | **MCP 도구 디스플레이** | ✅ | **❌ 미연결** — mcp__* 도구가 기본 gray 폴백으로 표시 | ✅ 수정 완료 |
| 4 | Notification 자동 소멸 | ✅ | ⚠️ 메모리릭 — setTimeout 참조 미저장, unmount 시 미정리 | ✅ 수정 완료 |
| 5 | 도구 출력 스트리밍 | ✅ | ✅ 연결됨 — bash_exec만 스트리밍, 의도적 설계 | — |
| 6 | StatusBar 비용 계산 | ✅ | ✅ 연결됨 — useAgentLoop → App → StatusBar 완전 연결 | — |
| 7 | Headless ask_user | ✅ | ⚠️ 부분 — stream-json만 처리, text/json 모드 미처리 | ✅ 수정 완료 |
| 8 | **ThinkingBlock** | ✅ | **❌ 미연결** — 컴포넌트 존재하나 어디서도 렌더링 안 됨 | ✅ 수정 완료 |
| 9 | isStreamingFinal 리셋 | ✅ | ✅ 정상 — finally 블록에서 적절히 리셋 | — |
| 10 | 이벤트 리스너 정리 | ✅ | ✅ 정상 — useEffect return에서 모든 리스너 해제 | — |

---

### 7개 팀 수정 상세

#### Team 1: ThinkingBlock 연결 (CRITICAL)

**문제**: Extended Thinking 출력이 사용자에게 완전히 숨겨져 있었음

**수정 내역 (6개 파일)**:

| 파일 | 변경 |
|------|------|
| `src/utils/events.ts` | `"llm:thinking-delta"` 이벤트 타입 추가 |
| `src/core/activity.ts` | `"thinking"` 엔트리 타입 추가 |
| `src/core/agent-loop.ts` | `consumeStream`에 `onThinkingDelta` 콜백 추가 → 이벤트 발행 |
| `src/cli/hooks/useAgentLoop.ts` | thinking 콘텐츠 누적 + 활동 엔트리 생성 |
| `src/cli/components/ActivityFeed.tsx` | `case "thinking"` → ThinkingBlock 렌더링 |
| `src/cli/components/TurnBlock.tsx` | `case "thinking"` → ThinkingBlock 렌더링 |

**데이터 플로우**:
```
anthropic.ts → thinking-delta 청크
  → streaming.ts → onThinkingDelta 콜백
    → agent-loop.ts → llm:thinking-delta 이벤트
      → useAgentLoop.ts → 활동 엔트리 생성
        → ActivityFeed.tsx → ThinkingBlock 렌더링
```

#### Team 2: MCP 도구 디스플레이 (CRITICAL)

**문제**: MCP 도구가 "Running mcp__playwright__browser_navigate" (gray)로만 표시

**수정 내역 (`tool-display.ts`)**:
- `parseMCPToolName()`: `mcp__{server}__{tool}` 파싱
- `getMCPToolDisplay()`: 도구 이름 휴리스틱 기반 색상/동사 매핑

| 도구 이름 패턴 | 색상 | 진행 동사 | 완료 동사 |
|-------------|------|---------|---------|
| search | magenta | Searching | Searched |
| read, get | blue | Reading | Read |
| write, create, edit, update | cyan | Writing | Wrote |
| navigate, click, snapshot | green | Browsing | Browsed |
| run, execute, eval | yellow | Running | Ran |
| 기타 | gray | Running | Ran |

**표시 형식 변경**:
```
변경 전: Running mcp__playwright__browser_navigate  (gray)
변경 후: ⠋ Browsing [MCP:playwright] browser_navigate  (green)
```

#### Team 3: RetryCountdown 연결 (MEDIUM)

**문제**: 재시도 카운트다운 컴포넌트가 존재하나 렌더링 안 됨

**수정 내역 (4개 파일)**:
- `events.ts`: `"agent:retry"` 이벤트 추가 (`delayMs`, `reason`, `attempt`, `maxRetries`)
- `agent-loop.ts`: 재시도 전 `agent:retry` 이벤트 발행 (2곳 — recovery 재시도, transient 에러 재시도)
- `useAgentLoop.ts`: `retryInfo` 상태 추가 + 이벤트 리스너
- `App.tsx`: `RetryCountdown` 렌더링 추가

**표시 형식**:
```
⏳ Timeout -- retry with backoff (1/2) 5초...
```

#### Team 4: Notification 메모리릭 수정 (LOW)

**문제**: `setTimeout` 참조 미저장 → unmount 시 콜백 실행, 연속 알림 시 타이머 누적

**수정 내역 (`App.tsx`)**:
- `notificationTimeoutRef` 추가
- `showNotification`에서 이전 타이머 취소
- `useEffect` cleanup에서 타이머 정리

#### Team 5: Headless ask_user 폴백 (MEDIUM)

**문제**: headless text/json 모드에서 ask_user 질문이 무시됨 → 도구 영원히 대기

**수정 내역 (`headless.ts`)**:
- 모든 출력 형식에서 `ask_user:prompt` 이벤트 핸들러 등록
- 선택지 있으면 첫 번째 자동 선택, 없으면 기본 메시지 응답
- 즉시 `ask_user:response` 발행하여 도구 해제

#### Team 6: ToolCallBlock MCP 개선 (MEDIUM)

**문제**: MCP 도구 결과에 서버 이름, 절단 표시, 디버그 정보가 안 보임

**수정 내역 (`ToolCallBlock.tsx`)**:
- 메타데이터에서 `serverName` 추출 → 헤더에 `[서버명]` 표시
- `truncated: true` → 노란색 `[Output truncated]` 표시
- `[Debug] Arguments sent:` → 구조화된 디버그 표시

---

## Part 2: 프로덕션 준비도 갭 분석

### 코어 아키텍처 (심각도순)

#### 1. MCP 클라이언트 재연결 없음 (CRITICAL)

| 항목 | 상세 |
|------|------|
| 파일 | `src/mcp/client.ts` |
| 문제 | 서버 연결 끊김 시 `state = "disconnected"` 설정 후 모든 대기 요청 reject. **재연결 시도 없음** |
| 영향 | MCP 서버 크래시 또는 네트워크 단절 시 영구 단절 |
| 해결 방안 | 지수 백오프 재연결 (최대 5회), 건강 검사 핑, 우아한 저하 (MCP 도구 없이 계속) |

#### 2. 세션 손상 시 전체 유실 (CRITICAL)

| 항목 | 상세 |
|------|------|
| 파일 | `src/core/session-manager.ts` |
| 문제 | JSONL 파싱에서 한 줄이 손상되면 **전체 세션 로드 실패** (`SessionError` throw) |
| 영향 | 긴 작업 세션 전체 유실 가능 |
| 해결 방안 | 손상 라인 건너뛰기 + 경고 반환, 세션 인덱스 이중화 |

#### 3. 에이전트 루프 전역 에러 바운더리 없음 (HIGH)

| 항목 | 상세 |
|------|------|
| 파일 | `src/core/agent-loop.ts` |
| 문제 | `contextManager.prepare()`, `strategy.prepareRequest()` 등 비-LLM 에러가 try-catch 바깥에서 발생 가능 |
| 영향 | 예상치 못한 예외로 에이전트 루프 전체 크래시 |
| 해결 방안 | while 루프 본체를 try-catch로 감싸기, 비-LLM 에러도 recovery 전략 적용 |

#### 4. 체크포인트 스토리지 무제한 (HIGH)

| 항목 | 상세 |
|------|------|
| 파일 | `src/core/checkpoint-manager.ts` |
| 문제 | 체크포인트 수/크기 제한 없음. 파일 전체 복사. 압축 없음 |
| 영향 | 장시간 세션에서 디스크 공간 고갈 |
| 해결 방안 | 최대 20개 체크포인트 유지 (FIFO 제거), 델타/diff 저장, gzip 압축 |

#### 5. 감사 로그에 도구 인수 누락 (HIGH)

| 항목 | 상세 |
|------|------|
| 파일 | `src/permissions/audit-log.ts` |
| 문제 | 도구 이름과 결정만 기록, **실행 인수(arguments) 미기록** |
| 영향 | 보안 포렌식 분석 불가 — "어떤 명령을 실행했는지" 추적 불가능 |
| 해결 방안 | 인수 해시 또는 민감정보 삭제 후 인수 기록 |

#### 6. 엔트로피 스캐너 출력 가드레일 미통합 (MEDIUM)

| 항목 | 상세 |
|------|------|
| 파일 | `src/guardrails/index.ts` |
| 문제 | `applyOutputGuardrails`가 `scanForSecrets`(패턴 기반)만 사용, `detectHighEntropySecrets`(엔트로피 기반) 미호출 |
| 영향 | 높은 엔트로피의 비밀 정보(랜덤 API 키 등)가 출력에서 감지 안 됨 |
| 해결 방안 | `applyOutputGuardrails`에 엔트로피 스캐너 통합 |

#### 7. bash_exec 샌드박싱 없음 (MEDIUM)

| 항목 | 상세 |
|------|------|
| 파일 | `src/tools/definitions/bash-exec.ts` |
| 문제 | 명령이 사용자 권한으로 직접 실행. `command-filter.ts`로 패턴 차단만 |
| 영향 | 알려지지 않은 위험 명령 실행 가능 |
| 참고 | `src/sandbox/` 모듈 존재 (seatbelt, bubblewrap) — 연결만 하면 됨 |

#### 8. 모델 라우터 자동 복귀 없음 (MEDIUM)

| 항목 | 상세 |
|------|------|
| 파일 | `src/llm/model-router.ts` |
| 문제 | 폴백 전환 후 primary가 복구되어도 **자동 복귀 없음** — `resetToPrimary()` 수동 호출 필요 |
| 영향 | 일시적 장애 후에도 계속 폴백(비싼/느린) 모델 사용 |
| 해결 방안 | 주기적 primary 헬스 프로브 + 자동 failback |

#### 9. Cold Storage 총 크기 제한 없음 (LOW)

| 항목 | 상세 |
|------|------|
| 파일 | `src/core/context-manager.ts` |
| 문제 | TTL 기반 정리만 있고, 총 디스크 사용량 제한 없음 |
| 영향 | 대량 파일 읽기 세션에서 디스크 고갈 가능 |
| 해결 방안 | 최대 100MB 총 크기 제한, LRU 기반 퇴출 |

#### 10. OpenAI 클라이언트 스트리밍 유휴 타임아웃 없음 (LOW)

| 항목 | 상세 |
|------|------|
| 파일 | `src/llm/client.ts` |
| 문제 | Anthropic 프로바이더는 유휴 타임아웃 있으나, OpenAI 호환 클라이언트는 없음 |
| 영향 | 행 연결이 감지 안 됨 |
| 해결 방안 | 스트리밍 중 30초 유휴 타임아웃 추가 |

---

### 보안 (OWASP LLM Top 10 커버리지)

| OWASP 위험 | 커버 여부 | 구현 | 갭 |
|-----------|---------|------|------|
| LLM01: 프롬프트 인젝션 | ✅ 완전 | 20+ 패턴, base64, 호모글리프 | — |
| LLM02: 불안전한 출력 | ⚠️ 부분 | 시크릿 스캔 + 출력 제한 | HTML/XSS 미처리, 엔트로피 미통합 |
| LLM04: 서비스 거부 | ⚠️ 부분 | 서킷 브레이커 + 출력 제한 | 턴당 토큰 하드 리밋 없음 |
| LLM05: 공급망 | ❌ 미구현 | — | 의존성 무결성 검사 없음, `^` 범위 사용 |
| LLM06: 민감 정보 | ✅ 완전 | 28 패턴 + 엔트로피 + 경로 필터 | 엔트로피 출력 미통합 (위 #6) |
| LLM07: 불안전한 플러그인 | ⚠️ 부분 | 명령 필터 + 경로 필터 | bash_exec 샌드박싱 없음 |
| LLM08: 과잉 에이전시 | ✅ 완전 | 5티어 권한, deny-by-default | — |

---

## Part 3: 경쟁 제품 벤치마킹

### Claude Code vs Aider vs Cursor vs Codex CLI

| 기능 | Claude Code | Aider | Cursor | Codex CLI | **dbcode** |
|------|-----------|-------|--------|-----------|-----------|
| **Diff 표시** | search/replace | search/replace 전용 포맷 | IDE 인라인 | — | ✅ +/- diff |
| **Git 통합** | 수동 커밋 | 자동 커밋 + /undo | IDE 연동 | — | ✅ 수동 커밋 |
| **비용 제한** | `--max-budget-usd` | — | 구독제 | — | ❌ 미구현 |
| **턴 제한** | `--max-turns` | — | — | — | ❌ 미구현 |
| **알림** | — | `--notifications` | IDE 알림 | — | ❌ 미구현 |
| **세션 이름** | `--name` | — | — | — | ❌ 미구현 |
| **세션 포크** | `--fork-session` | — | — | — | ⚠️ 내부 구현만 |
| **Side 질문** | `/btw` | — | — | — | ❌ 미구현 |
| **Bash 모드** | `!` 접두어 | `/run` | 터미널 | 내장 | ❌ 미구현 |
| **자동완성 제안** | 고스트 텍스트 | — | Tab 완성 | — | ❌ 미구현 |
| **멀티에이전트** | Agent Teams | — | 병렬 | — | ✅ 팀 매니저 |
| **샌드박싱** | 내장 | — | IDE 격리 | 내장 | ⚠️ 모듈만 존재 |
| **MCP 지원** | 완전 | — | — | MCP 쉘 | ✅ 완전 |
| **음성 입력** | — | — | — | — | ✅ SoX+Whisper |
| **DEC 2026** | — | — | — | — | ✅ 깜빡임 방지 |

---

### Aider에서 배울 점

| 패턴 | Aider 구현 | dbcode 적용 방안 |
|------|----------|--------------|
| Git 네이티브 Undo | 모든 AI 변경을 자동 커밋 → `/undo` = `git revert` | 체크포인트 대신 git stash/commit 기반 undo 고려 |
| 완료 알림 | `--notifications` (터미널 벨) + 커스텀 명령 | `src/utils/notifications.ts` 존재 — 연결만 하면 됨 |
| 맞춤 색상 | 역할별 색상 설정 (user=green, error=red) | 테마 시스템 존재 (`theme.ts`) — 설정 노출 필요 |
| 토큰 캐시 워밍 | `--cache-keepalive-pings` | Anthropic 프롬프트 캐싱은 구현 — keepalive 미구현 |

---

## Part 4: 추가 발견된 피드백 패턴

v1에서 미포함된 피드백 유형 12개를 추가 발견했다.

### 구현된 것 중 미연결된 것 (5개)

| # | 패턴 | 파일 | 상태 |
|---|------|------|------|
| 1 | **완료 알림** (데스크톱 알림) | `src/utils/notifications.ts` (크로스 플랫폼) | 구현됨, 미연결 |
| 2 | **Compact 결과 피드백** | `ContextManager.manualCompact()` 반환값 | 반환값 있으나 UI 미표시 |
| 3 | **Rewind 결과 피드백** | `CheckpointManager.restoreCheckpoint()` 반환값 | 반환값 있으나 UI 미표시 |
| 4 | **샌드박스 모듈** | `src/sandbox/` (seatbelt, bubblewrap) | 구현됨, bash_exec 미연결 |
| 5 | **세션 포크** | `SessionManager.forkSession()` | 구현됨, CLI 플래그 없음 |

### 완전 미구현 (7개)

| # | 패턴 | 경쟁 제품 | 우선순위 | 구현 난이도 |
|---|------|---------|---------|-----------|
| 6 | **비용 예산 제한** (`--max-budget-usd`) | Claude Code | HIGH | Medium |
| 7 | **턴 제한** (`--max-turns`) | Claude Code | HIGH | Low |
| 8 | **Bash 모드** (`!` 접두어) | Claude Code | MEDIUM | Low |
| 9 | **Side 질문** (`/btw`) | Claude Code | MEDIUM | Medium |
| 10 | **세션 이름** (`--name`) | Claude Code | LOW | Low |
| 11 | **완료 알림 자동 발송** | Aider | LOW | Low — 모듈 존재 |
| 12 | **고스트 텍스트 자동완성** | Claude Code, Cursor | LOW | High |

---

## Part 5: 개선 로드맵 v2

### Phase 1: 즉시 완료 (이번 세션)

- [x] ThinkingBlock 렌더링 연결 (6개 파일)
- [x] MCP 도구 디스플레이 개선 (도구 이름 휴리스틱)
- [x] RetryCountdown 렌더링 연결 (4개 파일)
- [x] Notification 메모리릭 수정
- [x] Headless ask_user 폴백
- [x] ToolCallBlock MCP 정보 표시

### Phase 2: 프로덕션 필수 (1주)

- [ ] MCP 클라이언트 자동 재연결 (지수 백오프, 최대 5회)
- [ ] 세션 손상 부분 복구 (corrupt 라인 건너뛰기)
- [ ] 에이전트 루프 전역 try-catch
- [ ] 체크포인트 FIFO 제거 (최대 20개)
- [ ] 감사 로그에 도구 인수 기록
- [ ] 비용 예산 제한 (`--max-budget-usd`)
- [ ] 턴 제한 (`--max-turns`)

### Phase 3: 품질 강화 (2주)

- [ ] 엔트로피 스캐너 출력 가드레일 통합
- [ ] bash_exec 샌드박스 연결 (`src/sandbox/` 활용)
- [ ] 모델 라우터 자동 failback
- [ ] Compact/Rewind 결과 UI 피드백
- [ ] 완료 알림 자동 발송 연결
- [ ] Bash 모드 (`!` 접두어)
- [ ] Side 질문 (`/btw`)

### Phase 4: 차별화 (1개월)

- [ ] Cold Storage 총 크기 제한
- [ ] OpenAI 스트리밍 유휴 타임아웃
- [ ] 세션 이름/포크 CLI 플래그
- [ ] 고스트 텍스트 자동완성
- [ ] 의존성 무결성 검사 (npm audit CI 통합)
- [ ] 텔레메트리 데이터 인벤토리 문서화

---

## Part 6: 수정 코드 변경 요약

| 팀 | 파일 | 추가 | 삭제 | 내용 |
|---|------|------|------|------|
| Team 1 | events.ts, activity.ts, agent-loop.ts, useAgentLoop.ts, ActivityFeed.tsx, TurnBlock.tsx | +89 | -0 | ThinkingBlock 연결 |
| Team 2 | tool-display.ts | +105 | -1 | MCP 도구 디스플레이 |
| Team 3 | events.ts, agent-loop.ts, useAgentLoop.ts, App.tsx | +72 | -0 | RetryCountdown 연결 |
| Team 4 | App.tsx | +15 | -3 | Notification 메모리릭 |
| Team 5 | headless.ts | +33 | -0 | Headless ask_user |
| Team 6 | ToolCallBlock.tsx | +62 | -1 | MCP ToolCallBlock 개선 |
| **합계** | **10개 파일** | **+330** | **-7** | |
