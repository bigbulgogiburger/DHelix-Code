# dhelix 전체 소스 문서화 마스터 플랜 v2

> 작성일: 2026-03-22
> 전체 소스: 252개 파일 / 62,620 LOC
> 기존 문서: 21페이지
> **목표: 약 200페이지 (1파일 = 1페이지 원칙)**
> 실행: Claude Agent Teams 20명 병렬

---

## 원칙: 1파일 = 1페이지

모든 유의미한 소스 파일에 개별 문서 페이지를 생성한다.
파일을 검색하면 바로 해당 페이지가 나오도록 직관적인 구조를 유지한다.

---

## Skip 대상 (약 50개)

다음 파일들은 별도 페이지를 만들지 않고, 부모 모듈 페이지의 레퍼런스 섹션에 통합한다.

### types/index/d.ts 파일 (15개)

| 파일                         | 이유             | 통합 대상                            |
| ---------------------------- | ---------------- | ------------------------------------ |
| `auth/types.ts`              | 타입만           | auth/token-manager 페이지            |
| `config/types.ts`            | 타입만           | config-loader 페이지                 |
| `guardrails/types.ts`        | 타입만           | guardrails/injection-detector 페이지 |
| `guardrails/index.ts`        | re-export        | guardrails 계열 페이지               |
| `hooks/types.ts`             | 타입만           | hooks/runner 페이지                  |
| `mcp/types.ts`               | 타입만           | mcp-manager 페이지                   |
| `memory/types.ts`            | 타입만           | memory/manager 페이지                |
| `memory/index.ts`            | re-export        | memory/manager 페이지                |
| `permissions/types.ts`       | 타입만           | permission-manager 페이지            |
| `sandbox/index.ts`           | re-export        | sandbox/linux 페이지                 |
| `skills/types.ts`            | 타입만           | skill-manager 페이지                 |
| `tools/types.ts`             | 타입만           | tool-registry 페이지                 |
| `voice/index.ts`             | re-export        | voice/recorder 페이지                |
| `types/marked-terminal.d.ts` | 외부 타입 선언   | Skip                                 |
| `src/index.ts`               | 진입점 re-export | Deep Dive 메인에 포함                |

### 80줄 이하 소형 파일 (약 35개, types 제외)

| 파일                                | LOC | 이유        | 통합 대상                     |
| ----------------------------------- | --- | ----------- | ----------------------------- |
| `commands/clear.ts`                 | 27  | 단순 명령   | commands 계열 근처 페이지     |
| `commands/compact.ts`               | 37  | 단순 래퍼   | context-manager 페이지        |
| `commands/simplify.ts`              | 45  | 단순 명령   | commands 계열                 |
| `commands/fast.ts`                  | 46  | 토글 명령   | commands 계열                 |
| `commands/debug.ts`                 | 53  | 단순 출력   | commands 계열                 |
| `commands/help.ts`                  | 53  | 단순 출력   | commands 계열                 |
| `commands/config.ts`                | 54  | 단순 래퍼   | config-loader 페이지          |
| `commands/tone.ts`                  | 55  | 토글 명령   | commands 계열                 |
| `commands/rename.ts`                | 56  | 단순 명령   | session-manager 페이지        |
| `commands/output-style.ts`          | 57  | 토글 명령   | commands 계열                 |
| `commands/plan.ts`                  | 57  | 모드 전환   | commands 계열                 |
| `commands/batch.ts`                 | 61  | 래퍼        | commands 계열                 |
| `commands/fork.ts`                  | 64  | 단순 명령   | session-manager 페이지        |
| `commands/voice.ts`                 | 65  | 래퍼        | voice/recorder 페이지         |
| `commands/keybindings.ts`           | 77  | 래퍼        | commands 계열                 |
| `commands/status.ts`                | 79  | 단순 출력   | commands 계열                 |
| `utils/stack.ts`                    | 27  | 유틸        | utils/error 페이지            |
| `utils/notification-config.ts`      | 32  | 설정        | utils/notifications 페이지    |
| `llm/client-factory.ts`             | 40  | 작은 팩토리 | llm-client 페이지             |
| `llm/thinking-budget.ts`            | 60  | 단순 계산   | model-capabilities 페이지     |
| `cli/components/Spinner.tsx`        | 42  | 단순 UI     | CLI 계열                      |
| `cli/components/VoiceIndicator.tsx` | 48  | 단순 UI     | voice 계열                    |
| `cli/components/RetryCountdown.tsx` | 52  | 단순 UI     | CLI 계열                      |
| `cli/components/ErrorBoundary.tsx`  | 71  | 표준 패턴   | App.tsx 페이지                |
| `cli/components/MessageList.tsx`    | 79  | 단순 래퍼   | CLI 계열                      |
| `cli/hooks/useConversation.ts`      | 59  | 단순 상태   | use-agent-loop 페이지         |
| `cli/hooks/useTextBuffering.ts`     | 75  | 단순 버퍼   | use-agent-loop 페이지         |
| `tools/validation.ts`               | 57  | 단순 래퍼   | tool-executor 페이지          |
| `tools/definitions/mkdir.ts`        | 62  | 단순 도구   | file-tools 계열               |
| `tools/definitions/file-write.ts`   | 76  | 작은 도구   | file-tools 계열               |
| `core/session-auto-save.ts`         | 66  | 타이머 래퍼 | session-manager 페이지        |
| `guardrails/output-limiter.ts`      | 70  | 단순 필터   | guardrails 계열               |
| `subagents/general.ts`              | 65  | 설정만      | subagents/spawner 페이지      |
| `subagents/plan.ts`                 | 70  | 설정만      | subagents/spawner 페이지      |
| `subagents/explore.ts`              | 71  | 설정만      | subagents/spawner 페이지      |
| `sandbox/network-policy-schema.ts`  | 28  | Zod 스키마  | sandbox/network-policy 페이지 |

---

## 신규 문서 페이지 목록 (~181개)

### Layer 1: CLI (25페이지 신규)

| #   | slug                    | 파일                                  | LOC   | 설명                                                           |
| --- | ----------------------- | ------------------------------------- | ----- | -------------------------------------------------------------- |
| 1   | `app-entry`             | `cli/App.tsx`                         | 480   | 루트 컴포넌트 — 모든 훅/컴포넌트 조합                          |
| 2   | `headless-mode`         | `cli/headless.ts`                     | 320   | 비대화형 모드 (CI/CD용)                                        |
| 3   | `setup-wizard`          | `cli/setup-wizard.ts`                 | 210   | 최초 실행 설정 마법사                                          |
| 4   | `agent-status`          | `cli/components/AgentStatus.tsx`      | 130   | 에이전트 실행 상태 표시                                        |
| 5   | `error-banner`          | `cli/components/ErrorBanner.tsx`      | 75    | 에러 배너                                                      |
| 6   | `logo-component`        | `cli/components/Logo.tsx`             | 60    | 로고 표시                                                      |
| 7   | `permission-prompt`     | `cli/components/PermissionPrompt.tsx` | 220   | 권한 요청 프롬프트                                             |
| 8   | `read-group-block`      | `cli/components/ReadGroupBlock.tsx`   | 120   | 연속 파일 읽기 그룹 표시                                       |
| 9   | `select-list`           | `cli/components/SelectList.tsx`       | 160   | 선택 목록 UI                                                   |
| 10  | `slash-command-menu`    | `cli/components/SlashCommandMenu.tsx` | 180   | 슬래시 명령 자동완성                                           |
| 11  | `status-bar`            | `cli/components/StatusBar.tsx`        | 250   | 하단 상태바                                                    |
| 12  | `streaming-message`     | `cli/components/StreamingMessage.tsx` | 190   | 스트리밍 텍스트 표시                                           |
| 13  | `task-list-view`        | `cli/components/TaskListView.tsx`     | 270   | 작업 목록 표시                                                 |
| 14  | `task-view-panel`       | `cli/components/TaskViewPanel.tsx`    | 300   | 작업 상세 패널                                                 |
| 15  | `teammate-status`       | `cli/components/TeammateStatus.tsx`   | 310   | 팀원 상태 표시                                                 |
| 16  | `thinking-block`        | `cli/components/ThinkingBlock.tsx`    | 150   | Extended Thinking 표시                                         |
| 17  | `tool-call-block`       | `cli/components/ToolCallBlock.tsx`    | 280   | 도구 호출 표시                                                 |
| 18  | `turn-block`            | `cli/components/TurnBlock.tsx`        | 110   | 대화 턴 블록                                                   |
| 19  | `user-input`            | `cli/components/UserInput.tsx`        | 380   | 사용자 입력 컴포넌트                                           |
| 20  | `use-input`             | `cli/hooks/useInput.ts`               | 190   | 입력 이벤트 핸들링                                             |
| 21  | `use-keybindings`       | `cli/hooks/useKeybindings.ts`         | 320   | 키바인딩 시스템                                                |
| 22  | `use-permission-prompt` | `cli/hooks/usePermissionPrompt.ts`    | 140   | 권한 프롬프트 훅                                               |
| 23  | `use-streaming`         | `cli/hooks/useStreaming.ts`           | 130   | 스트리밍 버퍼 훅                                               |
| 24  | `use-voice`             | `cli/hooks/useVoice.ts`               | 95    | 음성 입력 훅                                                   |
| 25  | `rendering-engine`      | `cli/renderer/` (5개 파일 통합)       | 1,416 | tool-display + syntax + markdown + theme + synchronized-output |

### Layer 2: Core (12페이지 신규)

| #   | slug                   | 파일                          | LOC | 설명                                       |
| --- | ---------------------- | ----------------------------- | --- | ------------------------------------------ |
| 26  | `activity-collector`   | `core/activity.ts`            | 290 | 턴 활동 수집 (TurnActivity, ActivityEntry) |
| 27  | `adaptive-context`     | `core/adaptive-context.ts`    | 210 | 모델별 컨텍스트 윈도우 최적화              |
| 28  | `auto-memory`          | `core/auto-memory.ts`         | 819 | 대화에서 학습한 내용 자동 영속화           |
| 29  | `code-review-agent`    | `core/code-review-agent.ts`   | 180 | 코드 리뷰 에이전트 로직                    |
| 30  | `conversation-manager` | `core/conversation.ts`        | 245 | 대화 메시지 관리 + 직렬화                  |
| 31  | `memory-storage`       | `core/memory-storage.ts`      | 180 | 메모리 파일 읽기/쓰기                      |
| 32  | `message-types`        | `core/message-types.ts`       | 85  | 메시지 타입 정의                           |
| 33  | `recovery-strategy`    | `core/recovery-strategy.ts`   | 195 | 에러 → 복구 전략 매핑                      |
| 34  | `session-manager`      | `core/session-manager.ts`     | 662 | 세션 생명주기 관리                         |
| 35  | `system-prompt-cache`  | `core/system-prompt-cache.ts` | 150 | SHA-256 프롬프트 캐시                      |
| 36  | `task-manager`         | `core/task-manager.ts`        | 380 | 작업 목록 CRUD + 진행률                    |
| 37  | `tone-profiles`        | `core/tone-profiles.ts`       | 120 | 응답 톤 프로필                             |
| 38  | `update-checker`       | `core/update-checker.ts`      | 130 | 새 버전 확인                               |

### Layer 3: LLM (9페이지 신규)

| #   | slug                      | 파일                                        | LOC | 설명                               |
| --- | ------------------------- | ------------------------------------------- | --- | ---------------------------------- |
| 39  | `llm-provider`            | `llm/provider.ts`                           | 280 | LLMProvider 인터페이스 + 핵심 타입 |
| 40  | `anthropic-provider`      | `llm/providers/anthropic.ts`                | 190 | Anthropic 네이티브 프로바이더      |
| 41  | `responses-client`        | `llm/responses-client.ts`                   | 932 | Responses API 전용 클라이언트      |
| 42  | `model-router`            | `llm/model-router.ts`                       | 384 | 요청별 최적 모델 선택              |
| 43  | `cost-tracker`            | `llm/cost-tracker.ts`                       | 160 | 토큰 비용 실시간 추적              |
| 44  | `tool-call-strategy`      | `llm/tool-call-strategy.ts`                 | 210 | 도구 호출 전략 선택기              |
| 45  | `native-function-calling` | `llm/strategies/native-function-calling.ts` | 150 | OpenAI function calling            |
| 46  | `text-parsing-strategy`   | `llm/strategies/text-parsing.ts`            | 180 | XML/JSON 텍스트 파싱               |
| 47  | `two-stage-tool-call`     | `llm/strategies/two-stage-tool-call.ts`     | 165 | 2단계 도구 호출                    |
| 48  | `llm-streaming`           | `llm/streaming.ts`                          | 290 | SSE 스트리밍 파서                  |
| 49  | `structured-output`       | `llm/structured-output.ts`                  | 130 | 구조화 출력 (JSON mode)            |

### Layer 3: Tools (12페이지 신규)

| #   | slug                  | 파일                                 | LOC | 설명                    |
| --- | --------------------- | ------------------------------------ | --- | ----------------------- |
| 50  | `adaptive-schema`     | `tools/adaptive-schema.ts`           | 250 | 모델 능력별 스키마 축소 |
| 51  | `tool-call-corrector` | `tools/tool-call-corrector.ts`       | 220 | 인자 자동 교정          |
| 52  | `tool-retry`          | `tools/tool-retry.ts`                | 95  | 도구 재시도 로직        |
| 53  | `lazy-tool-loader`    | `tools/lazy-tool-loader.ts`          | 130 | Deferred 도구 지연 로딩 |
| 54  | `import-hint`         | `tools/import-hint.ts`               | 60  | import 경로 힌트        |
| 55  | `tool-file-read`      | `tools/definitions/file-read.ts`     | 670 | 파일 읽기 도구          |
| 56  | `tool-file-edit`      | `tools/definitions/file-edit.ts`     | 350 | 파일 수정 도구          |
| 57  | `tool-grep-search`    | `tools/definitions/grep-search.ts`   | 401 | ripgrep 기반 검색       |
| 58  | `tool-glob-search`    | `tools/definitions/glob-search.ts`   | 180 | glob 패턴 검색          |
| 59  | `tool-bash-exec`      | `tools/definitions/bash-exec.ts`     | 292 | 셸 명령 실행            |
| 60  | `tool-bash-output`    | `tools/definitions/bash-output.ts`   | 120 | 백그라운드 출력 읽기    |
| 61  | `tool-kill-shell`     | `tools/definitions/kill-shell.ts`    | 70  | 프로세스 종료           |
| 62  | `tool-list-dir`       | `tools/definitions/list-dir.ts`      | 85  | 디렉토리 목록           |
| 63  | `tool-web-search`     | `tools/definitions/web-search.ts`    | 304 | 웹 검색                 |
| 64  | `tool-web-fetch`      | `tools/definitions/web-fetch.ts`     | 442 | URL 콘텐츠 가져오기     |
| 65  | `tool-agent`          | `tools/definitions/agent.ts`         | 350 | 서브에이전트 스폰       |
| 66  | `tool-ask-user`       | `tools/definitions/ask-user.ts`      | 110 | 사용자에게 질문         |
| 67  | `tool-notebook-edit`  | `tools/definitions/notebook-edit.ts` | 250 | Jupyter 노트북 편집     |
| 68  | `tool-todo-write`     | `tools/definitions/todo-write.ts`    | 150 | 작업 목록               |

### Layer 3: Permissions (6페이지 신규)

| #   | slug                          | 파일                              | LOC | 설명                 |
| --- | ----------------------------- | --------------------------------- | --- | -------------------- |
| 69  | `permission-rules`            | `permissions/rules.ts`            | 280 | allow/deny 규칙 엔진 |
| 70  | `permission-modes`            | `permissions/modes.ts`            | 120 | 5가지 권한 모드      |
| 71  | `permission-patterns`         | `permissions/pattern-parser.ts`   | 150 | 패턴 파싱            |
| 72  | `permission-wildcard`         | `permissions/wildcard.ts`         | 90  | 와일드카드 매칭      |
| 73  | `permission-session-store`    | `permissions/session-store.ts`    | 210 | 세션별 권한 캐시     |
| 74  | `permission-persistent-store` | `permissions/persistent-store.ts` | 445 | 영속 권한 저장       |
| 75  | `permission-audit-log`        | `permissions/audit-log.ts`        | 180 | 권한 감사 로그       |

### Layer 3: MCP (13페이지 신규)

| #   | slug                    | 파일                       | LOC | 설명                     |
| --- | ----------------------- | -------------------------- | --- | ------------------------ |
| 76  | `mcp-client`            | `mcp/client.ts`            | 420 | JSON-RPC MCP 클라이언트  |
| 77  | `mcp-scope-manager`     | `mcp/scope-manager.ts`     | 250 | 3-Scope 설정 관리        |
| 78  | `mcp-tool-bridge`       | `mcp/tool-bridge.ts`       | 350 | MCP→dhelix 도구 변환     |
| 79  | `mcp-tool-filter`       | `mcp/tool-filter.ts`       | 130 | 도구 허용/차단           |
| 80  | `mcp-tool-search`       | `mcp/tool-search.ts`       | 180 | Deferred 도구 검색       |
| 81  | `mcp-managed-config`    | `mcp/managed-config.ts`    | 520 | 관리형 MCP 설정          |
| 82  | `mcp-output-limiter`    | `mcp/output-limiter.ts`    | 510 | 출력 크기 제한           |
| 83  | `mcp-serve`             | `mcp/serve.ts`             | 580 | dhelix를 MCP 서버로 실행 |
| 84  | `mcp-manager-connector` | `mcp/manager-connector.ts` | 540 | 매니저 커넥터            |
| 85  | `mcp-oauth`             | `mcp/oauth.ts`             | 460 | OAuth 인증               |
| 86  | `mcp-prompts`           | `mcp/prompts.ts`           | 140 | MCP 프롬프트 리소스      |
| 87  | `mcp-resources`         | `mcp/resources.ts`         | 120 | MCP 리소스 엔드포인트    |
| 88  | `mcp-transport-base`    | `mcp/transports/base.ts`   | 130 | 트랜스포트 인터페이스    |
| 89  | `mcp-transport-stdio`   | `mcp/transports/stdio.ts`  | 180 | stdio 트랜스포트         |
| 90  | `mcp-transport-sse`     | `mcp/transports/sse.ts`    | 190 | SSE 트랜스포트           |
| 91  | `mcp-transport-http`    | `mcp/transports/http.ts`   | 160 | HTTP 트랜스포트          |

### Layer 3: Guardrails (5페이지 신규)

| #   | slug                 | 파일                               | LOC | 설명                 |
| --- | -------------------- | ---------------------------------- | --- | -------------------- |
| 92  | `injection-detector` | `guardrails/injection-detector.ts` | 310 | 프롬프트 인젝션 감지 |
| 93  | `entropy-scanner`    | `guardrails/entropy-scanner.ts`    | 180 | 엔트로피 이상 감지   |
| 94  | `command-filter`     | `guardrails/command-filter.ts`     | 150 | 위험 명령어 필터     |
| 95  | `path-filter`        | `guardrails/path-filter.ts`        | 120 | 경로 접근 제한       |

### Layer 3: Subagents (9페이지 신규)

| #   | slug                  | 파일                               | LOC | 설명                        |
| --- | --------------------- | ---------------------------------- | --- | --------------------------- |
| 96  | `subagent-spawner`    | `subagents/spawner.ts`             | 935 | 서브에이전트 생성/설정/실행 |
| 97  | `team-manager`        | `subagents/team-manager.ts`        | 783 | 팀 생성 + 워커 배분         |
| 98  | `task-list`           | `subagents/task-list.ts`           | 651 | 팀 작업 목록 관리           |
| 99  | `shared-state`        | `subagents/shared-state.ts`        | 210 | 워커 간 공유 상태           |
| 100 | `definition-loader`   | `subagents/definition-loader.ts`   | 280 | 에이전트 정의 로딩          |
| 101 | `agent-hooks`         | `subagents/agent-hooks.ts`         | 170 | 서브에이전트 훅             |
| 102 | `agent-memory`        | `subagents/agent-memory.ts`        | 140 | 서브에이전트 메모리         |
| 103 | `agent-skills-loader` | `subagents/agent-skills-loader.ts` | 120 | 서브에이전트 스킬           |

### Layer 4: Config (2페이지 신규)

| #   | slug              | 파일                 | LOC | 설명            |
| --- | ----------------- | -------------------- | --- | --------------- |
| 104 | `config-defaults` | `config/defaults.ts` | 180 | 하드코딩 기본값 |
| 105 | `config-schema`   | `config/schema.ts`   | 250 | Zod 설정 스키마 |

### Layer 4: Skills (3페이지 신규)

| #   | slug                   | 파일                       | LOC | 설명                |
| --- | ---------------------- | -------------------------- | --- | ------------------- |
| 106 | `skill-loader`         | `skills/loader.ts`         | 250 | 스킬 파일 탐색/로딩 |
| 107 | `skill-executor`       | `skills/executor.ts`       | 310 | 스킬 실행 엔진      |
| 108 | `skill-command-bridge` | `skills/command-bridge.ts` | 180 | 슬래시 명령 ↔ 스킬 |

### Layer 4: Instructions (2페이지 신규)

| #   | slug                       | 파일                           | LOC | 설명                     |
| --- | -------------------------- | ------------------------------ | --- | ------------------------ |
| 109 | `instruction-parser`       | `instructions/parser.ts`       | 220 | DHELIX.md 파싱 + @import |
| 110 | `instruction-path-matcher` | `instructions/path-matcher.ts` | 170 | 경로 조건부 매칭         |

### Layer 4: Memory (4페이지 신규)

| #   | slug             | 파일                | LOC | 설명                 |
| --- | ---------------- | ------------------- | --- | -------------------- |
| 111 | `memory-manager` | `memory/manager.ts` | 350 | 프로젝트 메모리 관리 |
| 112 | `memory-writer`  | `memory/writer.ts`  | 180 | 메모리 파일 작성     |
| 113 | `memory-loader`  | `memory/loader.ts`  | 150 | 메모리 파일 로딩     |
| 114 | `memory-paths`   | `memory/paths.ts`   | 60  | 메모리 경로 유틸     |

### Layer 4: Hooks (3페이지 신규)

| #   | slug               | 파일                   | LOC | 설명         |
| --- | ------------------ | ---------------------- | --- | ------------ |
| 115 | `hook-runner`      | `hooks/runner.ts`      | 290 | 훅 실행 엔진 |
| 116 | `hook-loader`      | `hooks/loader.ts`      | 180 | 훅 정의 로딩 |
| 117 | `hook-auto-lint`   | `hooks/auto-lint.ts`   | 120 | 자동 린트 훅 |
| 118 | `hook-team-events` | `hooks/team-events.ts` | 100 | 팀 이벤트 훅 |

### Layer 4: Utils (6페이지 신규)

| #   | slug                  | 파일                     | LOC | 설명                   |
| --- | --------------------- | ------------------------ | --- | ---------------------- |
| 119 | `utils-error`         | `utils/error.ts`         | 180 | BaseError, LLMError 등 |
| 120 | `utils-events`        | `utils/events.ts`        | 150 | AppEventEmitter + 타입 |
| 121 | `utils-logger`        | `utils/logger.ts`        | 120 | 로거 시스템            |
| 122 | `utils-platform`      | `utils/platform.ts`      | 110 | OS/셸 플랫폼 감지      |
| 123 | `utils-path`          | `utils/path.ts`          | 90  | 크로스 플랫폼 경로     |
| 124 | `utils-notifications` | `utils/notifications.ts` | 160 | 알림 시스템            |

### Layer 4: Sandbox (6페이지 신규)

| #   | slug                        | 파일                           | LOC | 설명            |
| --- | --------------------------- | ------------------------------ | --- | --------------- |
| 125 | `sandbox-linux`             | `sandbox/linux.ts`             | 511 | Linux 샌드박스  |
| 126 | `sandbox-bubblewrap`        | `sandbox/bubblewrap.ts`        | 280 | Bubblewrap 래퍼 |
| 127 | `sandbox-seatbelt`          | `sandbox/seatbelt.ts`          | 220 | macOS Seatbelt  |
| 128 | `sandbox-network-policy`    | `sandbox/network-policy.ts`    | 190 | 네트워크 정책   |
| 129 | `sandbox-network-proxy`     | `sandbox/network-proxy.ts`     | 170 | 네트워크 프록시 |
| 130 | `sandbox-sandboxed-network` | `sandbox/sandboxed-network.ts` | 150 | 네트워크 격리   |

### Layer 4: Auth (2페이지 신규)

| #   | slug                 | 파일                    | LOC | 설명           |
| --- | -------------------- | ----------------------- | --- | -------------- |
| 131 | `token-manager-auth` | `auth/token-manager.ts` | 210 | API 토큰 관리  |
| 132 | `token-store`        | `auth/token-store.ts`   | 140 | 토큰 영속 저장 |

### Layer 4: Voice (2페이지 신규)

| #   | slug                | 파일                   | LOC | 설명             |
| --- | ------------------- | ---------------------- | --- | ---------------- |
| 133 | `voice-recorder`    | `voice/recorder.ts`    | 180 | 음성 녹음        |
| 134 | `voice-transcriber` | `voice/transcriber.ts` | 150 | 음성→텍스트 변환 |

### Layer 4: Mentions (2페이지 신규)

| #   | slug                | 파일                            | LOC | 설명          |
| --- | ------------------- | ------------------------------- | --- | ------------- |
| 135 | `mention-parser`    | `mentions/parser.ts`            | 130 | @mention 파싱 |
| 136 | `mention-resolver`  | `mentions/resolver.ts`          | 160 | mention 해석  |
| 137 | `resource-resolver` | `mentions/resource-resolver.ts` | 470 | 리소스 해석   |

### Layer 4: Telemetry (3페이지 신규)

| #   | slug                | 파일                         | LOC | 설명                   |
| --- | ------------------- | ---------------------------- | --- | ---------------------- |
| 138 | `telemetry-metrics` | `telemetry/metrics.ts`       | 180 | 메트릭 수집            |
| 139 | `telemetry-events`  | `telemetry/events.ts`        | 120 | 텔레메트리 이벤트      |
| 140 | `telemetry-otel`    | `telemetry/otel-exporter.ts` | 150 | OpenTelemetry 내보내기 |
| 141 | `telemetry-config`  | `telemetry/config.ts`        | 80  | 텔레메트리 설정        |

### Layer 4: Indexing (1페이지 신규)

| #   | slug       | 파일                   | LOC | 설명               |
| --- | ---------- | ---------------------- | --- | ------------------ |
| 142 | `repo-map` | `indexing/repo-map.ts` | 350 | 리포지토리 맵 생성 |

### Commands (25페이지 신규)

80줄 이하 소형 명령어를 제외한 나머지 개별 페이지.

| #   | slug              | 파일                                      | LOC     | 설명              |
| --- | ----------------- | ----------------------------------------- | ------- | ----------------- |
| 143 | `cmd-init`        | `commands/init.ts` + `commands/init/*.ts` | 280+490 | 프로젝트 초기화   |
| 144 | `cmd-commit`      | `commands/commit.ts`                      | 200     | Git 커밋          |
| 145 | `cmd-review`      | `commands/review.ts`                      | 180     | 코드 리뷰         |
| 146 | `cmd-diff`        | `commands/diff.ts`                        | 120     | 변경 사항 확인    |
| 147 | `cmd-context`     | `commands/context.ts`                     | 110     | 컨텍스트 정보     |
| 148 | `cmd-model`       | `commands/model.ts`                       | 250     | 모델 변경         |
| 149 | `cmd-dual-model`  | `commands/dual-model.ts`                  | 140     | 듀얼 모델 설정    |
| 150 | `cmd-effort`      | `commands/effort.ts`                      | 60      | 추론 노력 수준    |
| 151 | `cmd-agents`      | `commands/agents.ts`                      | 440     | 에이전트 관리     |
| 152 | `cmd-team`        | `commands/team.ts`                        | 506     | 팀 오케스트레이션 |
| 153 | `cmd-memory`      | `commands/memory.ts`                      | 583     | 메모리 관리       |
| 154 | `cmd-mcp`         | `commands/mcp.ts`                         | 402     | MCP 서버 관리     |
| 155 | `cmd-permissions` | `commands/permissions.ts`                 | 378     | 권한 관리         |
| 156 | `cmd-export`      | `commands/export.ts`                      | 317     | 세션 내보내기     |
| 157 | `cmd-analytics`   | `commands/analytics.ts`                   | 317     | 사용 분석         |
| 158 | `cmd-stats`       | `commands/stats.ts`                       | 200     | 세션 통계         |
| 159 | `cmd-doctor`      | `commands/doctor.ts`                      | 381     | 환경 진단         |
| 160 | `cmd-update`      | `commands/update.ts`                      | 140     | 업데이트 확인     |
| 161 | `cmd-resume`      | `commands/resume.ts`                      | 180     | 세션 이어하기     |
| 162 | `cmd-rewind`      | `commands/rewind.ts`                      | 120     | 체크포인트 복원   |
| 163 | `cmd-undo`        | `commands/undo.ts`                        | 80      | 되돌리기          |
| 164 | `cmd-bug`         | `commands/bug.ts`                         | 130     | 버그 리포트       |
| 165 | `cmd-copy`        | `commands/copy.ts`                        | 60      | 출력 복사         |
| 166 | `cmd-cost`        | `commands/cost.ts`                        | 80      | 비용 확인         |
| 167 | `cmd-registry`    | `commands/registry.ts`                    | 260     | 명령어 레지스트리 |
| 168 | `constants`       | `constants.ts`                            | 120     | 전역 상수         |

---

## 전체 카운트

| 구분                         | 페이지 수                |
| ---------------------------- | ------------------------ |
| 기존 문서 (Layer 1~4)        | 21                       |
| 신규: CLI                    | 25                       |
| 신규: Core                   | 12                       |
| 신규: LLM                    | 11                       |
| 신규: Tools                  | 19                       |
| 신규: Permissions            | 7                        |
| 신규: MCP                    | 16                       |
| 신규: Guardrails             | 4                        |
| 신규: Subagents              | 8                        |
| 신규: Leaf (config~indexing) | 34                       |
| 신규: Commands               | 26                       |
| Skip (types/index/소형)      | ~50 (부모 페이지에 통합) |
| **총 문서 페이지**           | **~183 + 21 = 약 204**   |

---

## Agent Teams 실행 계획 (20명 병렬)

### Wave 1: 20명 동시 출발

| Agent        | 담당 영역                                          | 페이지 수 | 파일 수 |
| ------------ | -------------------------------------------------- | --------- | ------- |
| **Agent 1**  | CLI 컴포넌트 전반부: app-entry ~ permission-prompt | 7         | 7       |
| **Agent 2**  | CLI 컴포넌트 후반부: read-group ~ user-input       | 8         | 8       |
| **Agent 3**  | CLI 훅 + 렌더링 엔진: use-input ~ rendering-engine | 5         | 9       |
| **Agent 4**  | Core 전반부: activity ~ auto-memory                | 4         | 4       |
| **Agent 5**  | Core 후반부: code-review ~ update-checker          | 8         | 9       |
| **Agent 6**  | LLM 전체: provider ~ structured-output             | 11        | 11      |
| **Agent 7**  | Tools 인프라: adaptive-schema ~ import-hint        | 5         | 5       |
| **Agent 8**  | Tools 정의 전반: file-read ~ glob-search           | 4         | 4       |
| **Agent 9**  | Tools 정의 후반: bash-exec ~ todo-write            | 9         | 9       |
| **Agent 10** | Permissions 전체                                   | 7         | 7       |
| **Agent 11** | MCP 전반: client ~ tool-search                     | 5         | 5       |
| **Agent 12** | MCP 후반: managed-config ~ transports              | 11        | 11      |
| **Agent 13** | Guardrails + Subagents 전반                        | 4+4 = 8   | 8       |
| **Agent 14** | Subagents 후반: shared-state ~ agent-skills        | 4         | 4       |
| **Agent 15** | Leaf: Config + Skills + Instructions               | 7         | 7       |
| **Agent 16** | Leaf: Memory + Hooks                               | 8         | 8       |
| **Agent 17** | Leaf: Utils + Auth + Voice                         | 10        | 10      |
| **Agent 18** | Leaf: Sandbox + Mentions + Telemetry + Indexing    | 12        | 12      |
| **Agent 19** | Commands 전반: init ~ mcp                          | 13        | 13      |
| **Agent 20** | Commands 후반: permissions ~ constants             | 13        | 13      |

### Wave 2: 리뷰 (Wave 1 완료 후)

- 전체 ~183페이지의 h2 이모지, CSS 클래스, Mermaid 라이트 테마, 한국어 통일성 검증
- Sidebar.tsx + docs/page.tsx 구조 재설계 (사이드바 그룹핑)

### Wave 3: 빌드 검증

- `npm run build` 전체 빌드 통과 확인
- 26 → ~230 라우트 정상 생성 확인

---

## 사이드바 구조 (204페이지용)

현재 단순 4-Layer 구조에서 **서브그룹 계층**으로 확장 필요:

```
📂 Layer 1: CLI
  📁 Components (19)
  📁 Hooks (6)
  📁 Renderer (1)
  📁 Entry (3)

📂 Layer 2: Core (19)

📂 Layer 3: Infrastructure
  📁 LLM (15)
  📁 Tools (21)
  📁 Permissions (8)
  📁 MCP (17)
  📁 Guardrails (5)
  📁 Subagents (9)

📂 Layer 4: Leaf
  📁 Config (3)
  📁 Skills (4)
  📁 Instructions (3)
  📁 Memory (5)
  📁 Hooks (4)
  📁 Utils (6)
  📁 Sandbox (6)
  📁 Auth (2)
  📁 Voice (2)
  📁 Mentions (3)
  📁 Telemetry (4)
  📁 Indexing (1)

📂 Commands (26)
```

---

## 각 에이전트 공통 지침

1. **기존 패턴 참조**: `guide/src/app/docs/circuit-breaker/page.tsx` 읽고 동일 구조 적용
2. **guide/CLAUDE.md** 의 "핵심 규칙" 준수 (center-narrow, gap-3, Mermaid 라이트 테마 등)
3. **소스 코드 반드시 읽고** 문서 작성 (추측 금지)
4. **최소 요소**: Mermaid 1개, Callout warn 1개, DeepDive 1개
5. **모든 노드에 설명**: `NODE_ID["이름<br/><small>설명</small>"]`
6. **한국어 직접 입력** (유니코드 이스케이프 금지)
7. **LayerBadge 값**: cli / core / infra / leaf
8. **SeeAlso** 에 관련 문서 최소 2개 연결
9. **빌드 확인**: 페이지 작성 후 `npm run build` 통과 확인
