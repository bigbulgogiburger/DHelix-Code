# dbcode 개발 기획서: 52점 → 80점

> 작성자: 특급 Anthropic Claude Code 개발자 (신규 합류)
> 작성일: 2026-03-07
> 대상: dbcode CLI AI 코딩 어시스턴트

---

## 1. 현재 상태 진단

코드를 전부 읽어봤습니다. 솔직한 소감:

**생각보다 잘 만든 것:**

- MCP 클라이언트 (`src/mcp/client.ts`) — JSON-RPC 2.0 완전 구현, stdio 트랜스포트, 환경변수 resolve까지. 스켈레톤이 아니라 **동작 가능한 수준**
- Tool Bridge (`src/mcp/tool-bridge.ts`) — MCP 도구를 dbcode 도구 레지스트리에 자동 등록, 네임스페이싱(`mcp__server__tool`), deferred loading 판단까지 있음
- Subagent spawner — 병렬 실행, 필터된 레지스트리, 격리된 이벤트 에미터. 구조가 Claude Code의 Agent tool과 거의 동일
- Permission 시스템 — 3단계 체크(세션 승인 → 규칙 → 모드), 5가지 모드, glob 패턴 룰. 이건 프로덕션급

**진짜 문제:**

1. **MCP가 App.tsx에 연결 안 됨** — 클라이언트는 있는데 부팅 시 서버 연결하는 코드가 없음
2. **Context Compaction이 가짜** — LLM 요약이 아닌 텍스트 truncation. 긴 세션에서 맥락 유실
3. **토큰 사용량 추적 없음** — `usage: { promptTokens: 0, completionTokens: 0 }` 하드코딩
4. **도구 8개** — Claude Code는 20+개. 특히 notebook, web_fetch, LSP 등 부재
5. **guardrails 전무** — 비밀키 유출, 위험 명령 실행 차단 없음
6. **App.tsx 509줄** — 비즈니스 로직과 UI가 한 파일에 섞임

---

## 2. 점수 목표 역산

| 영역             | 현재   | 목표   | 가중치 | 점수 증가  |
| ---------------- | ------ | ------ | ------ | ---------- |
| 아키텍처 설계    | 78     | 85     | 20%    | +1.4       |
| 핵심 기능 완성도 | 45     | **75** | 30%    | **+9.0**   |
| LLM 클라이언트   | 65     | **80** | 15%    | **+2.25**  |
| CLI/UX           | 55     | 70     | 15%    | +2.25      |
| 테스트 & 품질    | 40     | **70** | 10%    | **+3.0**   |
| 프로덕션 준비도  | 20     | **55** | 10%    | **+3.5**   |
| **총점**         | **52** |        |        | **→ 73.5** |

**핵심**: 기능 완성도(30%)와 프로덕션 준비도(10%)에서 대부분의 점수를 올려야 함

---

## 3. 스프린트 계획 (8주, 4 스프린트)

### Sprint 1: "심장 수술" (Week 1-2)

> 에이전트 루프의 핵심 품질을 올린다. 유저가 체감하는 가장 중요한 부분.

#### 1-1. LLM 기반 Context Compaction (+8점)

**현재 문제:**

```typescript
// context-manager.ts:228 — summarizeTurns()
// 단순 텍스트 잘라내기. LLM이 아닌 regex로 파일 경로만 추출
private summarizeTurns(turns, focusTopic): string {
  // User: "xxx..." / Assistant: "xxx..." / (3 tool calls executed)
  // 이건 요약이 아니라 잘라내기
}
```

**해야 할 것:**

```
context-manager.ts 수정:
1. summarizeTurns()에 LLM 호출 추가
2. 요약 프롬프트: "다음 대화를 요약해라. 수정한 파일, 결정사항, 현재 진행 상황을 보존해라"
3. fallback: LLM 호출 실패 시 현재의 텍스트 truncation 유지
4. 캐시: 동일 턴 재요약 방지
```

**구체적 태스크:**

- [ ] `ContextManager`에 `LLMProvider` 의존성 주입
- [ ] `summarizeWithLLM(turns: Turn[], focusTopic?: string): Promise<string>` 메서드 추가
- [ ] 요약 프롬프트 설계 (Claude Code의 compaction prompt 참고)
- [ ] `compact()` 에서 LLM 요약 사용, 실패 시 기존 로직 fallback
- [ ] `AgentLoopConfig`에 `client` 전달 경로 확보 (이미 있음)
- [ ] 단위 테스트: LLM mock으로 요약 품질 검증

**예상 영향:** 핵심 기능 완성도 45→55 (+3점)

#### 1-2. 토큰 사용량 실시간 추적 (+3점)

**현재 문제:**

```typescript
// agent-loop.ts:186 — 스트리밍 응답에서 usage가 항상 0
response = {
  content: accumulated.text,
  toolCalls: accumulated.toolCalls,
  usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, // ← 하드코딩
};
```

**해야 할 것:**

```
1. streaming.ts: OpenAI stream의 usage chunk 파싱 (stream_options.include_usage)
2. client.ts: chat() 요청 시 stream_options 추가
3. agent-loop.ts: 누적 토큰 카운트를 이벤트로 emit
4. StatusBar: 실시간 토큰 사용량 표시 (현재/최대)
5. 세션 종료 시 총 토큰/비용 리포트
```

**구체적 태스크:**

- [ ] `StreamAccumulator`에 `usage` 필드 추가
- [ ] `consumeStream()`에서 `usage` chunk 파싱
- [ ] `client.ts`의 `stream()` 메서드에 `stream_options: { include_usage: true }` 추가
- [ ] `agent-loop.ts`에서 누적 토큰 추적, `llm:complete` 이벤트에 정확한 usage 전달
- [ ] `StatusBar`에 토큰 프로그레스 바 표시

**예상 영향:** LLM 클라이언트 65→72 (+1점)

#### 1-3. App.tsx 분리 리팩토링 (+2점)

**현재 문제:** 509줄에 모든 로직이 집중. 비즈니스 로직(agent loop 호출)과 UI(렌더링)가 혼재.

**해야 할 것:**

```
App.tsx → 3개 파일로 분리:
1. hooks/useAgentLoop.ts — processMessage(), 이벤트 바인딩, 에러 처리
2. hooks/usePermissionPrompt.ts — 퍼미션 요청/응답 로직
3. App.tsx — 순수 UI 렌더링만 (200줄 이하)
```

**구체적 태스크:**

- [ ] `useAgentLoop` 커스텀 훅 추출 (processMessage, 이벤트, activity tracking)
- [ ] `usePermissionPrompt` 훅 추출 (pendingPermission, handleResponse)
- [ ] `App.tsx`를 순수 컴포넌트로 축소
- [ ] 기존 테스트가 깨지지 않는지 확인

**예상 영향:** 아키텍처 78→82 (+0.8점), CLI/UX 55→60 (+0.75점)

---

### Sprint 2: "MCP 통합 + 보안 기반" (Week 3-4)

> 외부 도구 생태계 연결과 최소한의 보안을 확보한다.

#### 2-1. MCP 서버 부팅 통합 (+6점)

**현재 상태:** MCP 클라이언트는 **완성**되어 있음. 하지만 App 부팅 시 서버에 연결하는 코드가 없음.

**해야 할 것:**

```
1. 설정 파일에서 MCP 서버 목록 로드 (~/.dbcode/mcp.json 또는 config)
2. 부팅 시 각 서버에 connect()
3. MCPToolBridge로 도구 자동 등록
4. 시스템 프롬프트에 MCP 서버 안내 주입
5. 종료 시 disconnect() 정리
```

**설정 파일 형식:**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/tmp"],
      "transport": "stdio"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-github"],
      "transport": "stdio",
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

**구체적 태스크:**

- [ ] `src/mcp/manager.ts` 생성 — MCP 서버 라이프사이클 관리
  - `loadConfig()`: 설정 파일 파싱
  - `connectAll()`: 모든 서버 병렬 연결
  - `registerAllTools(toolRegistry)`: 도구 일괄 등록
  - `disconnectAll()`: 정리
- [ ] `src/index.ts` (부팅)에서 MCPManager 초기화
- [ ] `system-prompt-builder.ts`에 MCP 서버 정보 섹션 추가
- [ ] 연결 실패 시 graceful fallback (경고만 출력, 나머지 계속)
- [ ] MCP 도구가 많을 때 deferred loading (shouldDeferTools 활용)
- [ ] 통합 테스트: mock MCP 서버로 도구 등록 검증

**예상 영향:** 핵심 기능 완성도 55→65 (+3점)

#### 2-2. Guardrails 기본 구현 (+5점)

**현재 상태:** `guardrails/` 디렉토리 자체가 없음. 보안 검증 제로.

**해야 할 것 (최소 3가지만):**

```
1. Secret Scanner — 출력에서 API 키/비밀번호 패턴 감지
2. Dangerous Command Filter — rm -rf /, DROP TABLE 등 차단
3. Output Size Limiter — 거대한 출력 자동 truncation
```

**구체적 태스크:**

- [ ] `src/guardrails/secret-scanner.ts`
  - 정규식 기반 패턴 매칭 (AWS_KEY, GITHUB_TOKEN, password=, etc.)
  - tool result에서 감지 시 `[REDACTED]`로 치환
  - 경고 이벤트 emit
- [ ] `src/guardrails/command-filter.ts`
  - bash_exec의 command에서 위험 패턴 감지
  - 위험 레벨: block (즉시 차단) / warn (사용자 확인)
  - 패턴: `rm -rf /`, `DROP TABLE`, `DELETE FROM`, `> /dev/sda`, `chmod 777`
- [ ] `src/guardrails/output-limiter.ts`
  - tool result가 maxToolResultChars 초과 시 head+tail 보존
  - 이미 context-manager.ts에 비슷한 로직 있음 → 여기로 이동
- [ ] `src/guardrails/index.ts` — 파이프라인 조합
  - `applyInputGuardrails(toolCall)` → command filter
  - `applyOutputGuardrails(toolResult)` → secret scanner + output limiter
- [ ] agent-loop.ts에서 tool 실행 전후로 guardrails 적용
- [ ] 단위 테스트: 각 guardrail 독립 테스트

**예상 영향:** 프로덕션 준비도 20→40 (+2점)

#### 2-3. 도구 3개 추가 (+3점)

현재 8개 → 11개로 확장. 가장 자주 쓰이는 것부터.

| 도구            | 퍼미션  | 구현 난이도 | 설명                                 |
| --------------- | ------- | ----------- | ------------------------------------ |
| `web_fetch`     | confirm | 중          | URL → 텍스트 변환 (readability 추출) |
| `list_dir`      | safe    | 하          | 디렉토리 목록 (tree 형태)            |
| `notebook_edit` | confirm | 중          | .ipynb 셀 추가/수정/삭제             |

**구체적 태스크:**

- [ ] `src/tools/definitions/web-fetch.ts`
  - `node:https` 또는 `undici`로 HTTP GET
  - HTML → 텍스트 변환 (cheerio 또는 linkedom)
  - 최대 응답 크기 제한 (100KB)
- [ ] `src/tools/definitions/list-dir.ts`
  - `node:fs/promises`의 readdir
  - recursive 옵션 (depth 제한)
  - .gitignore 패턴 존중
- [ ] `src/tools/definitions/notebook-edit.ts`
  - .ipynb JSON 파싱
  - 셀 CRUD 연산
- [ ] 각 도구를 registry에 등록

**예상 영향:** 핵심 기능 완성도 65→68 (+0.9점)

---

### Sprint 3: "사용자 경험 도약" (Week 5-6)

> CLI 사용 경험을 Claude Code 수준으로 끌어올린다.

#### 3-1. Anthropic API 직접 지원 (+3점)

**현재 문제:** OpenAI SDK 호환 API만 지원. Anthropic Claude를 쓰려면 별도 프록시 필요.

**해야 할 것:**

```
1. src/llm/providers/anthropic.ts — Anthropic SDK 래퍼
2. src/llm/providers/openai.ts — 기존 client.ts 리네이밍
3. model-router.ts에서 모델명으로 provider 자동 선택
   - "claude-*" → Anthropic provider
   - "gpt-*", "o1-*" → OpenAI provider
   - 나머지 → baseURL 기반 OpenAI 호환
```

**구체적 태스크:**

- [ ] `@anthropic-ai/sdk` 의존성 추가
- [ ] `src/llm/providers/anthropic.ts` — `LLMProvider` 인터페이스 구현
  - `chat()`, `stream()`, `countTokens()` 구현
  - Anthropic 특유의 system message 처리 (별도 필드)
  - Tool use 포맷 변환 (OpenAI → Anthropic → OpenAI 응답 형태)
- [ ] 기존 `client.ts` → `providers/openai.ts`로 이동
- [ ] `model-router.ts`에 자동 라우팅 로직 추가
- [ ] 환경변수: `ANTHROPIC_API_KEY` 지원
- [ ] 통합 테스트: Anthropic API mock으로 검증

**예상 영향:** LLM 클라이언트 72→80 (+1.2점)

#### 3-2. 대화 히스토리 & 세션 복원 (+2점)

**현재 문제:** 세션 매니저가 있지만, 이전 세션 재개 UX가 없음.

**해야 할 것:**

```
1. /resume — 최근 세션 재개
2. /history — 세션 목록 표시
3. 부팅 시 이전 세션 자동 감지 ("이전 세션을 이어서 할까요?")
```

**구체적 태스크:**

- [ ] `/resume [session-id]` 슬래시 명령 추가
- [ ] `/history` 명령 — 최근 10개 세션 목록 (시간, 첫 메시지, 턴 수)
- [ ] 세션 메타데이터 저장 (첫 메시지, 턴 수, 마지막 시간)
- [ ] 부팅 시 최근 세션 감지 프롬프트

**예상 영향:** CLI/UX 60→65 (+0.75점)

#### 3-3. 에러 복구 UX 개선 (+2점)

**현재 문제:** 에러 발생 시 빨간 텍스트만 표시. 사용자가 뭘 해야 할지 모름.

**해야 할 것:**

```
1. 에러 유형별 가이드 메시지
   - Rate limit → "X초 후 자동 재시도됩니다" + 프로그레스 바
   - Network → "네트워크를 확인하세요. /retry로 재시도"
   - Token limit → "대화가 너무 깁니다. /compact로 압축하세요"
   - API key → "OPENAI_API_KEY가 설정되지 않았습니다"
2. /retry 명령 — 마지막 실패한 메시지 재시도
3. /compact — 수동 컨텍스트 압축 (이미 ContextManager에 메서드 있음)
```

**구체적 태스크:**

- [ ] `ErrorBanner` 컴포넌트에 actionable 메시지 추가
- [ ] `/retry` 명령 구현
- [ ] `/compact [topic]` 명령 구현 (manualCompact 연결)
- [ ] rate limit 시 자동 재시도 카운트다운 UI

**예상 영향:** CLI/UX 65→70 (+0.75점)

---

### Sprint 4: "품질 & 배포" (Week 7-8)

> 테스트 커버리지와 배포 파이프라인을 확보한다.

#### 4-1. 통합 테스트 스위트 (+5점)

**현재 문제:** 86개 테스트 파일이 있지만 대부분 단위 테스트. 모듈 간 연동 검증 부재.

**해야 할 것:**

```
1. Agent Loop 통합 테스트
   - Mock LLM + 실제 도구 → 파일 생성/편집 시나리오
   - Permission 체크 동작 확인
   - Context compaction 트리거 확인

2. MCP 통합 테스트
   - Mock MCP 서버 → 도구 등록 → 도구 실행 → 결과 반환

3. E2E Smoke 테스트
   - 실제 API 호출 (가벼운 시나리오 1개)
   - "Hello World 파일 만들어줘" → 파일 생성 확인
   - CI에서 선택적 실행 (API 키 있을 때만)
```

**구체적 태스크:**

- [ ] `test/integration/agent-loop-tools.test.ts` — agent loop + 도구 연동
- [ ] `test/integration/mcp-bridge.test.ts` — MCP 클라이언트 + 브릿지
- [ ] `test/integration/context-compaction.test.ts` — 토큰 초과 시 compaction
- [ ] `test/integration/guardrails.test.ts` — 보안 필터 파이프라인
- [ ] `test/e2e/smoke.test.ts` — 최소 E2E (CI 선택적)
- [ ] 커버리지 목표: 전체 70% 이상

**예상 영향:** 테스트 & 품질 40→70 (+3점)

#### 4-2. CI/CD 파이프라인 (+3점)

**해야 할 것:**

```
.github/workflows/ci.yml:
1. lint + typecheck + 단위 테스트 (PR마다)
2. 통합 테스트 (merge 시)
3. E2E smoke (선택적, API 키 있을 때)
4. 커버리지 리포트 (Codecov/Coveralls)
5. npm publish (릴리스 태그 시)
```

**구체적 태스크:**

- [ ] GitHub Actions 워크플로우 생성
- [ ] `npm run ci` 스크립트: `typecheck && lint && test:coverage`
- [ ] 커버리지 게이트: 70% 미만 시 CI 실패
- [ ] npm 패키지 배포 준비 (`package.json` 정리, bin 필드)
- [ ] `npx dbcode`로 실행 가능하도록 설정

**예상 영향:** 프로덕션 준비도 40→55 (+1.5점)

#### 4-3. README & 온보딩 (+1점)

- [ ] README.md 정비 (설치, 설정, 사용법, 스크린샷)
- [ ] `dbcode --help` 출력 개선
- [ ] 첫 실행 시 온보딩 플로우 (API 키 설정 가이드)

---

## 4. 우선순위 매트릭스

```
                    높은 점수 영향
                         │
        ┌────────────────┼────────────────┐
        │   1-1 Context  │  2-1 MCP 통합  │
        │   Compaction   │                │
높은    │   (+8점)       │  (+6점)        │
ROI     │                │                │
        │   2-2 Guard-   │  3-1 Anthropic │
        │   rails (+5점) │  API (+3점)    │
        ├────────────────┼────────────────┤
        │   4-1 통합     │  2-3 도구 추가 │
        │   테스트(+5점) │  (+3점)        │
낮은    │                │                │
ROI     │   1-2 토큰     │  3-2 세션 복원 │
        │   추적 (+3점)  │  (+2점)        │
        └────────────────┼────────────────┘
                         │
                    낮은 점수 영향
```

---

## 5. 팀 배분 (Agent Teams 기준)

8주 동안 병렬로 작업할 수 있는 최적의 팀 구성:

### Sprint 1 (Week 1-2): 3명 병렬

| 팀원    | 태스크                     | 파일 소유권                                 |
| ------- | -------------------------- | ------------------------------------------- |
| Agent A | 1-1 LLM Context Compaction | `src/core/context-manager.ts`               |
| Agent B | 1-2 토큰 사용량 추적       | `src/llm/streaming.ts`, `src/llm/client.ts` |
| Agent C | 1-3 App.tsx 리팩토링       | `src/cli/App.tsx`, `src/cli/hooks/`         |

### Sprint 2 (Week 3-4): 3명 병렬

| 팀원    | 태스크                 | 파일 소유권                            |
| ------- | ---------------------- | -------------------------------------- |
| Agent D | 2-1 MCP 서버 부팅 통합 | `src/mcp/manager.ts`, `src/index.ts`   |
| Agent E | 2-2 Guardrails 구현    | `src/guardrails/*` (신규)              |
| Agent F | 2-3 도구 3개 추가      | `src/tools/definitions/` (신규 파일만) |

### Sprint 3 (Week 5-6): 3명 병렬

| 팀원     | 태스크                        | 파일 소유권                                           |
| -------- | ----------------------------- | ----------------------------------------------------- |
| Agent G  | 3-1 Anthropic API 지원        | `src/llm/providers/` (신규)                           |
| Agent H  | 3-2 + 3-3 세션 복원 + 에러 UX | `src/commands/`, `src/cli/components/ErrorBanner.tsx` |
| Agent A' | guardrails ↔ agent-loop 통합 | `src/core/agent-loop.ts` (guardrails 적용 부분만)     |

### Sprint 4 (Week 7-8): 2명 병렬

| 팀원    | 태스크                 | 파일 소유권                             |
| ------- | ---------------------- | --------------------------------------- |
| Agent I | 4-1 통합 테스트 전체   | `test/integration/*`                    |
| Agent J | 4-2 CI/CD + 4-3 README | `.github/`, `README.md`, `package.json` |

---

## 6. 리스크 & 완화책

| 리스크                   | 확률 | 영향 | 완화책                                    |
| ------------------------ | ---- | ---- | ----------------------------------------- |
| LLM 기반 compaction 비용 | 높음 | 중   | 캐시 + 저렴한 모델 사용 (Haiku급)         |
| MCP 서버 연결 불안정     | 중간 | 높음 | 연결 실패 무시 + 재연결 로직              |
| Anthropic SDK 호환성     | 낮음 | 중   | tool_use 포맷 차이 주의, 통합 테스트 필수 |
| App.tsx 리팩토링 회귀    | 중간 | 중   | 리팩토링 전 스냅샷 테스트 추가            |
| CI 비용 (API 호출)       | 중간 | 낮   | smoke 테스트는 nightly만 실행             |

---

## 7. 성공 지표

각 스프린트 종료 시 체크:

### Sprint 1 완료 기준

- [ ] 20턴 이상 대화에서 맥락 유실 없이 동작 (LLM compaction)
- [ ] StatusBar에 실시간 토큰 사용량 표시
- [ ] App.tsx 300줄 이하

### Sprint 2 완료 기준

- [ ] `~/.dbcode/mcp.json` 설정으로 MCP 서버 자동 연결
- [ ] `rm -rf /` 명령 차단 확인
- [ ] API 키가 tool result에 노출되지 않음 확인
- [ ] 도구 11개 이상 등록

### Sprint 3 완료 기준

- [ ] `ANTHROPIC_API_KEY`로 Claude 모델 직접 호출 가능
- [ ] `/resume`로 이전 세션 재개 동작
- [ ] rate limit 시 자동 재시도 + 카운트다운 UI

### Sprint 4 완료 기준

- [ ] 테스트 커버리지 70% 이상
- [ ] GitHub Actions CI 그린
- [ ] `npx dbcode`로 설치 없이 실행 가능

---

## 8. "진짜 80점"으로 가려면 (Sprint 4 이후)

73점에서 80점까지의 마지막 7점은 **깊이**에서 나옴:

1. **Sandbox** (macOS Seatbelt / Linux seccomp) — bash_exec의 파일시스템 접근 제한
2. **Extended Thinking** — Anthropic Claude의 thinking block 지원
3. **Multi-file edit** — 하나의 LLM 응답으로 여러 파일 동시 편집
4. **Tab completion** — 파일 경로, 명령어, 도구명 자동완성
5. **Telemetry** — 익명 사용 통계 수집 (opt-in)
6. **Plugin system** — 커뮤니티 도구 확장

이건 Sprint 5-6 (추가 4주)에서 다룰 사안.

---

## 9. 즉시 시작 가능한 첫 번째 액션

지금 당장 시작한다면:

```
Sprint 1의 3개 태스크를 Agent Teams로 병렬 실행:
1. Agent A: Context Compaction LLM 요약 구현
2. Agent B: 스트리밍 토큰 usage 파싱
3. Agent C: App.tsx → useAgentLoop + usePermissionPrompt 분리
```

이 3개가 완료되면 체감 점수가 52 → 60으로 오르고,
Sprint 2의 MCP + Guardrails가 완료되면 60 → 70을 넘긴다.
