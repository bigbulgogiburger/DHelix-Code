import Link from "next/link";

/* ─── Sub-group type ─── */
type SubGroup = {
  name: string;
  modules: Module[];
};

type Module = {
  slug: string;
  name: string;
  desc: string;
  status: "ready" | "planned" | "wip";
};

type Layer = {
  name: string;
  color: string;
  badge: string;
  icon: string;
  borderClass: string;
  badgeBg: string;
  subGroupHeaderBg: string;
  modules?: Module[];
  subGroups?: SubGroup[];
};

const layers: Layer[] = [
  {
    name: "Layer 1: CLI",
    color: "blue",
    badge: "Ink/React — 27개",
    icon: "🖥️",
    borderClass: "border-l-blue-400",
    badgeBg: "bg-blue-100 text-blue-700",
    subGroupHeaderBg: "bg-blue-50 text-blue-800",
    subGroups: [
      {
        name: "Components (19)",
        modules: [
          {
            slug: "app-entry",
            name: "cli/App.tsx",
            desc: "CLI 루트 컴포넌트 — 모든 훅·하위 컴포넌트를 하나의 통합 터미널 인터페이스로 조합",
            status: "ready",
          },
          {
            slug: "agent-status",
            name: "cli/components/AgentStatus.tsx",
            desc: "에이전트 실행 상태 표시 — 애니메이션 별 + 한국어 메시지 + 경과 시간",
            status: "ready",
          },
          {
            slug: "error-banner",
            name: "cli/components/ErrorBanner.tsx",
            desc: "에러 배너 — 에러 자동 분류 + 유형별 아이콘 + 한국어 해결 가이드",
            status: "ready",
          },
          {
            slug: "logo-component",
            name: "cli/components/Logo.tsx",
            desc: "DB 로고 터미널 렌더링 — 유니코드 블록 문자 + ANSI 색상 + 두 가지 출력 방식",
            status: "ready",
          },
          {
            slug: "permission-prompt",
            name: "cli/components/PermissionPrompt.tsx",
            desc: "도구 실행 전 권한 요청 UI — 위험 도구 실행 전 사용자 확인 프롬프트",
            status: "ready",
          },
          {
            slug: "read-group-block",
            name: "cli/components/ReadGroupBlock.tsx",
            desc: "연속 파일 읽기 그룹 압축 표시 — 여러 파일 읽기를 하나의 그룹 블록으로 렌더링",
            status: "ready",
          },
          {
            slug: "select-list",
            name: "cli/components/SelectList.tsx",
            desc: "키보드 탐색 가능한 재사용 선택 목록 UI 컴포넌트",
            status: "ready",
          },
          {
            slug: "slash-command-menu",
            name: "cli/components/SlashCommandMenu.tsx",
            desc: "슬래시 명령어 자동완성 메뉴 — '/' 입력 시 표시되는 팝업 완성 목록",
            status: "ready",
          },
          {
            slug: "status-bar",
            name: "cli/components/StatusBar.tsx",
            desc: "화면 하단 상태 바 — 모델명, 컨텍스트 사용률, 세션 비용, 권한 모드 표시",
            status: "ready",
          },
          {
            slug: "streaming-message",
            name: "cli/components/StreamingMessage.tsx",
            desc: "LLM 응답 실시간 스트리밍 표시 — 점진적 마크다운 렌더링 지원",
            status: "ready",
          },
          {
            slug: "task-list-view",
            name: "cli/components/TaskListView.tsx",
            desc: "작업 목록 계층 트리 뷰 — 에이전트 Task를 계층적으로 시각화",
            status: "ready",
          },
          {
            slug: "task-view-panel",
            name: "cli/components/TaskViewPanel.tsx",
            desc: "멀티 에이전트 작업 진행 테이블 — 토글 가능한 오버레이 패널",
            status: "ready",
          },
          {
            slug: "teammate-status",
            name: "cli/components/TeammateStatus.tsx",
            desc: "팀원(서브에이전트) 상태 표시 — 3가지 수준의 컴포넌트 모음",
            status: "ready",
          },
          {
            slug: "thinking-block",
            name: "cli/components/ThinkingBlock.tsx",
            desc: "확장 사고(Extended Thinking) 표시 — LLM 사고 과정 축소/확장 토글",
            status: "ready",
          },
          {
            slug: "tool-call-block",
            name: "cli/components/ToolCallBlock.tsx",
            desc: "도구 호출 상태·결과 블록 — 에이전트 도구 실행 리치 표시",
            status: "ready",
          },
          {
            slug: "turn-block",
            name: "cli/components/TurnBlock.tsx",
            desc: "대화 턴 블록 — 사용자 입력 + AI 응답 + 도구 호출을 하나의 턴으로 렌더링",
            status: "ready",
          },
          {
            slug: "user-input",
            name: "cli/components/UserInput.tsx",
            desc: "에디터 수준의 터미널 입력 컴포넌트 — 커서 이동, 히스토리, @멘션, 다중 줄 지원",
            status: "ready",
          },
          {
            slug: "headless-mode",
            name: "cli/headless.ts",
            desc: "비대화형 헤드리스 모드 — CI/CD·스크립트 자동화를 위한 Ink UI 없는 실행",
            status: "ready",
          },
          {
            slug: "setup-wizard",
            name: "cli/components/SetupWizard.tsx",
            desc: "초기 설정 마법사 — API 키와 모델을 처음 실행 시 대화형으로 설정",
            status: "ready",
          },
        ],
      },
      {
        name: "Hooks (6)",
        modules: [
          {
            slug: "use-agent-loop",
            name: "cli/hooks/useAgentLoop.ts",
            desc: "Agent Loop ↔ React 상태 연결 핵심 브릿지",
            status: "ready",
          },
          {
            slug: "use-input",
            name: "cli/hooks/useInput.ts",
            desc: "입력 이벤트 핸들링 — 히스토리 영속화 + 방향키 탐색",
            status: "ready",
          },
          {
            slug: "use-keybindings",
            name: "cli/hooks/useKeybindings.ts",
            desc: "키바인딩 시스템 — 7개 기본 단축키 + 사용자 커스텀 매핑",
            status: "ready",
          },
          {
            slug: "use-permission-prompt",
            name: "cli/hooks/usePermissionPrompt.ts",
            desc: "권한 프롬프트 훅 — Promise 브릿지로 에이전트 루프 ↔ UI 연결",
            status: "ready",
          },
          {
            slug: "use-streaming",
            name: "cli/hooks/useStreaming.ts",
            desc: "스트리밍 버퍼 훅 — LLM 실시간 응답 축적 + AbortController 취소",
            status: "ready",
          },
          {
            slug: "use-voice",
            name: "cli/hooks/useVoice.ts",
            desc: "음성 입력 훅 — SoX 녹음 + Whisper API 변환 생명주기 관리",
            status: "ready",
          },
        ],
      },
      {
        name: "Other (2)",
        modules: [
          {
            slug: "activity-feed",
            name: "cli/components/ActivityFeed.tsx",
            desc: "Progressive Static Flushing — 완료 항목 Static 전환",
            status: "ready",
          },
          {
            slug: "rendering-engine",
            name: "cli/renderer/",
            desc: "도구 실행 결과 ANSI 렌더링 — tool-display + syntax + markdown + theme + 동기화 출력",
            status: "ready",
          },
        ],
      },
    ],
  },
  {
    name: "Layer 2: Core",
    color: "purple",
    badge: "Zero UI Imports — 20개",
    icon: "⚙️",
    borderClass: "border-l-violet-400",
    badgeBg: "bg-violet-100 text-violet-700",
    subGroupHeaderBg: "bg-violet-50 text-violet-800",
    modules: [
      {
        slug: "agent-loop",
        name: "core/agent-loop.ts",
        desc: "ReAct 패턴 메인 루프 — LLM 호출, 도구 실행, 결과 피드백 반복",
        status: "ready",
      },
      {
        slug: "context-manager",
        name: "core/context-manager.ts",
        desc: "3-Layer 토큰 관리 — Microcompaction, Auto-compaction, Rehydration",
        status: "ready",
      },
      {
        slug: "circuit-breaker",
        name: "core/circuit-breaker.ts",
        desc: "무한 루프 방지 — 무변경/에러 반복 감지 후 자동 중단",
        status: "ready",
      },
      {
        slug: "recovery-executor",
        name: "core/recovery-executor.ts",
        desc: "에러 유형별 복구 전략 — compact, retry, fallback",
        status: "ready",
      },
      {
        slug: "recovery-strategy",
        name: "core/recovery-strategy.ts",
        desc: "에러 유형별 복구 전략 매핑 테이블 모듈",
        status: "ready",
      },
      {
        slug: "system-prompt-builder",
        name: "core/system-prompt-builder.ts",
        desc: "동적 시스템 프롬프트 조립 — 모듈식 섹션 + 우선순위 기반 토큰 예산",
        status: "ready",
      },
      {
        slug: "system-prompt-cache",
        name: "core/system-prompt-cache.ts",
        desc: "SHA-256 기반 시스템 프롬프트 캐싱 모듈",
        status: "ready",
      },
      {
        slug: "checkpoint-manager",
        name: "core/checkpoint-manager.ts",
        desc: "파일 변경 전 자동 상태 스냅샷 — SHA-256 해시 + /undo, /rewind",
        status: "ready",
      },
      {
        slug: "observation-masking",
        name: "core/observation-masking.ts",
        desc: "재생성 가능한 도구 출력 마스킹 — 읽기 전용 감지 + 토큰 절약",
        status: "ready",
      },
      {
        slug: "activity-collector",
        name: "core/activity-collector.ts",
        desc: "턴 활동 수집 — TurnActivity, ActivityEntry 타입 + ActivityCollector",
        status: "ready",
      },
      {
        slug: "adaptive-context",
        name: "core/adaptive-context.ts",
        desc: "모델별 컨텍스트 윈도우 최적화 — 적응형 컨텍스트 로딩",
        status: "ready",
      },
      {
        slug: "auto-memory",
        name: "core/auto-memory.ts",
        desc: "대화 학습 내용 자동 감지 및 영속화 모듈",
        status: "ready",
      },
      {
        slug: "code-review-agent",
        name: "core/code-review-agent.ts",
        desc: "Generator-Critic 패턴 코드 리뷰 — diff 분석 후 이슈 목록·점수·요약 생성",
        status: "ready",
      },
      {
        slug: "conversation-manager",
        name: "core/conversation-manager.ts",
        desc: "대화 메시지 관리 — 추가, 변환, 직렬화",
        status: "ready",
      },
      {
        slug: "memory-storage",
        name: "core/memory-storage.ts",
        desc: "프로젝트별·전역 메모리 파일(.md) 읽기·쓰기·목록·삭제 저장소",
        status: "ready",
      },
      {
        slug: "message-types",
        name: "core/message-types.ts",
        desc: "LLM 채팅 메시지 타입 정의 — 역할 상수, 타입 가드 함수 제공",
        status: "ready",
      },
      {
        slug: "session-manager",
        name: "core/session-manager.ts",
        desc: "세션 생명주기 관리 — 생성, 저장, 복원, 이름 지정",
        status: "ready",
      },
      {
        slug: "task-manager",
        name: "core/task-manager.ts",
        desc: "작업 목록 CRUD + 진행률 추적",
        status: "ready",
      },
      {
        slug: "tone-profiles",
        name: "core/tone-profiles.ts",
        desc: "응답 톤 프로필(normal, concise, verbose 등) 정의 및 관리",
        status: "ready",
      },
      {
        slug: "update-checker",
        name: "core/update-checker.ts",
        desc: "npm 최신 버전 확인 — 7일 캐싱 + 5초 타임아웃으로 시작 성능 보호",
        status: "ready",
      },
    ],
  },
  {
    name: "Layer 3: Infrastructure",
    color: "green",
    badge: "LLM + Tools + Security — 74개",
    icon: "🔧",
    borderClass: "border-l-emerald-400",
    badgeBg: "bg-emerald-100 text-emerald-700",
    subGroupHeaderBg: "bg-emerald-50 text-emerald-800",
    subGroups: [
      {
        name: "LLM (15)",
        modules: [
          {
            slug: "llm-client",
            name: "llm/client.ts",
            desc: "OpenAI 호환 LLM API 클라이언트 — 스트리밍, 자동 재시도, 에러 분류",
            status: "ready",
          },
          {
            slug: "llm-provider",
            name: "llm/provider.ts",
            desc: "모든 LLM 클라이언트 공통 인터페이스 및 핵심 타입 정의",
            status: "ready",
          },
          {
            slug: "llm-streaming",
            name: "llm/streaming.ts",
            desc: "SSE 스트리밍 파서 + 청크 누적 — LLM 실시간 스트리밍 응답 관리",
            status: "ready",
          },
          {
            slug: "anthropic-provider",
            name: "llm/anthropic-provider.ts",
            desc: "Anthropic Messages API 네이티브 프로바이더 — Claude 모델 직접 통신",
            status: "ready",
          },
          {
            slug: "responses-client",
            name: "llm/responses-client.ts",
            desc: "Responses API 전용 클라이언트 — Chat Completions 미지원 Codex 모델 통신",
            status: "ready",
          },
          {
            slug: "model-capabilities",
            name: "llm/model-capabilities.ts",
            desc: "모델별 능력 레지스트리 — 기능 플래그, 컨텍스트 크기, 가격, 능력 티어",
            status: "ready",
          },
          {
            slug: "model-router",
            name: "llm/model-router.ts",
            desc: "요청별 최적 모델 선택 + 주/대체 모델 간 자동 전환(재시도 + 폴백)",
            status: "ready",
          },
          {
            slug: "dual-model-router",
            name: "llm/dual-model-router.ts",
            desc: "Architect/Editor 모델 자동 전환 — 작업 페이즈별 라우팅",
            status: "ready",
          },
          {
            slug: "cost-tracker",
            name: "llm/cost-tracker.ts",
            desc: "토큰 비용 실시간 추적 — LLM API 호출 토큰 사용량·비용 세션 단위 누적",
            status: "ready",
          },
          {
            slug: "token-counter",
            name: "llm/token-counter.ts",
            desc: "토큰 계산 — tiktoken 기반 정확 계산 + 빠른 추정, LRU 캐시",
            status: "ready",
          },
          {
            slug: "tool-call-strategy",
            name: "llm/tool-call-strategy.ts",
            desc: "도구 호출 전략 선택기 — 모델 능력에 따라 native/text-parsing/two-stage 자동 선택",
            status: "ready",
          },
          {
            slug: "native-function-calling",
            name: "llm/native-function-calling.ts",
            desc: "OpenAI function calling 네이티브 전략 — 표준 tool_calls API 도구 호출",
            status: "ready",
          },
          {
            slug: "text-parsing-strategy",
            name: "llm/text-parsing-strategy.ts",
            desc: "XML/JSON 텍스트 파싱 폴백 전략 — 네이티브 FC 미지원 모델용 XML 태그 추출",
            status: "ready",
          },
          {
            slug: "two-stage-tool-call",
            name: "llm/two-stage-tool-call.ts",
            desc: "2단계 도구 호출(계획→실행) — 저능력 모델 자연어 의도를 구조화된 호출로 변환",
            status: "ready",
          },
          {
            slug: "structured-output",
            name: "llm/structured-output.ts",
            desc: "구조화된 출력(JSON mode) — 모델 능력 티어에 따른 적절한 JSON 출력 설정 생성",
            status: "ready",
          },
        ],
      },
      {
        name: "Tools (21)",
        modules: [
          {
            slug: "tool-registry",
            name: "tools/registry.ts",
            desc: "도구 등록/조회 — Hot Tools + Deferred Loading",
            status: "ready",
          },
          {
            slug: "tool-executor",
            name: "tools/executor.ts",
            desc: "도구 실행 파이프라인 — Zod 검증, 인자 교정, 백그라운드 프로세스",
            status: "ready",
          },
          {
            slug: "adaptive-schema",
            name: "tools/adaptive-schema.ts",
            desc: "모델 능력별 도구 스키마 축소 — HIGH/MEDIUM/LOW 3단계 전략",
            status: "ready",
          },
          {
            slug: "tool-call-corrector",
            name: "tools/tool-call-corrector.ts",
            desc: "저성능 모델 인자 자동 교정 — 경로/타입 사전 교정",
            status: "ready",
          },
          {
            slug: "tool-retry",
            name: "tools/tool-retry.ts",
            desc: "도구 실행 재시도 — Levenshtein 파일명 교정 + JSON 수리",
            status: "ready",
          },
          {
            slug: "lazy-tool-loader",
            name: "tools/lazy-tool-loader.ts",
            desc: "Deferred 도구 지연 로딩 — 등급별 온디맨드 스키마 제공",
            status: "ready",
          },
          {
            slug: "import-hint",
            name: "tools/import-hint.ts",
            desc: "import 경로 힌트 — 파일 편집 후 역참조 파일 자동 안내",
            status: "ready",
          },
          {
            slug: "tool-file-read",
            name: "tools/definitions/file-read.ts",
            desc: "파일 읽기 도구 — 텍스트, 이미지, PDF, Jupyter Notebook 지원",
            status: "ready",
          },
          {
            slug: "tool-file-edit",
            name: "tools/definitions/file-edit.ts",
            desc: "파일 수정 도구 — 정확한 문자열 매칭 기반 안전한 교체",
            status: "ready",
          },
          {
            slug: "tool-grep-search",
            name: "tools/definitions/grep-search.ts",
            desc: "ripgrep 기반 코드 검색 — 정규식 패턴 매칭 + JavaScript 폴백",
            status: "ready",
          },
          {
            slug: "tool-glob-search",
            name: "tools/definitions/glob-search.ts",
            desc: "glob 패턴 파일 검색 — fast-glob + 수정 시간순 정렬",
            status: "ready",
          },
          {
            slug: "tool-bash-exec",
            name: "tools/definitions/bash-exec.ts",
            desc: "셸 명령 실행 — 포그라운드/백그라운드 + 크로스 플랫폼",
            status: "ready",
          },
          {
            slug: "tool-bash-output",
            name: "tools/definitions/bash-output.ts",
            desc: "백그라운드 출력 읽기 — 증분 읽기 방식으로 새 출력만 반환",
            status: "ready",
          },
          {
            slug: "tool-kill-shell",
            name: "tools/definitions/kill-shell.ts",
            desc: "프로세스 종료 — SIGTERM/SIGKILL/SIGINT 시그널 전송",
            status: "ready",
          },
          {
            slug: "tool-list-dir",
            name: "tools/definitions/list-dir.ts",
            desc: "디렉토리 트리 목록 — 연결선 시각화 + 자동 제외 목록",
            status: "ready",
          },
          {
            slug: "tool-web-search",
            name: "tools/definitions/web-search.ts",
            desc: "실시간 웹 검색 — 제목, URL, 스니펫 반환",
            status: "ready",
          },
          {
            slug: "tool-web-fetch",
            name: "tools/definitions/web-fetch.ts",
            desc: "URL 내용 텍스트 가져오기 — HTML 자동 정리, 응답 캐싱, HTTPS 업그레이드",
            status: "ready",
          },
          {
            slug: "tool-agent",
            name: "tools/definitions/agent.ts",
            desc: "서브에이전트 생성·위임 도구 — 팩토리 패턴으로 의존성 주입",
            status: "ready",
          },
          {
            slug: "tool-ask-user",
            name: "tools/definitions/ask-user.ts",
            desc: "LLM이 사용자에게 직접 질문·확인 요청할 때 사용하는 도구",
            status: "ready",
          },
          {
            slug: "tool-notebook-edit",
            name: "tools/definitions/notebook-edit.ts",
            desc: "Jupyter Notebook(.ipynb) 셀 추가·교체·삭제 도구",
            status: "ready",
          },
          {
            slug: "tool-todo-write",
            name: "tools/definitions/todo-write.ts",
            desc: "작업 목록 관리 — 단계별 분해 + in_progress 1개 규칙",
            status: "ready",
          },
        ],
      },
      {
        name: "Permissions (8)",
        modules: [
          {
            slug: "permission-manager",
            name: "permissions/manager.ts",
            desc: "5단계 권한 결정 트리 — deny-first 원칙",
            status: "ready",
          },
          {
            slug: "permission-modes",
            name: "permissions/modes.ts",
            desc: "5가지 권한 모드에 따른 도구 실행 허용 여부 결정",
            status: "ready",
          },
          {
            slug: "permission-rules",
            name: "permissions/rules.ts",
            desc: "도구 호출을 사전 allow/deny 규칙에 매칭하는 규칙 엔진",
            status: "ready",
          },
          {
            slug: "permission-patterns",
            name: "permissions/patterns.ts",
            desc: "권한 패턴 문자열 파싱 및 도구 호출 매칭 패턴 파서",
            status: "ready",
          },
          {
            slug: "permission-wildcard",
            name: "permissions/wildcard.ts",
            desc: "경로 안전 와일드카드 매칭 + 도구별 인수 매핑 유틸리티",
            status: "ready",
          },
          {
            slug: "permission-session-store",
            name: "permissions/session-store.ts",
            desc: "세션별 권한 허용 캐시 — Set 기반 O(1) 조회 + 영속화",
            status: "ready",
          },
          {
            slug: "permission-persistent-store",
            name: "permissions/persistent-store.ts",
            desc: "영속적 권한 저장 — settings.json 기반 allow/deny 규칙",
            status: "ready",
          },
          {
            slug: "permission-audit-log",
            name: "permissions/audit-log.ts",
            desc: "권한 결정 감사 로그 — JSONL 형식 append-only 기록",
            status: "ready",
          },
        ],
      },
      {
        name: "MCP (16)",
        modules: [
          {
            slug: "mcp-manager",
            name: "mcp/manager.ts",
            desc: "MCP 서버 수명주기 — 3-Scope 설정, 병렬 연결, 도구 브리지",
            status: "ready",
          },
          {
            slug: "mcp-client",
            name: "mcp/client.ts",
            desc: "외부 MCP 서버 JSON-RPC 2.0 통신 핵심 클라이언트",
            status: "ready",
          },
          {
            slug: "mcp-scope-manager",
            name: "mcp/scope-manager.ts",
            desc: "3-Scope MCP 서버 설정 관리 — local, project, user 범위",
            status: "ready",
          },
          {
            slug: "mcp-tool-bridge",
            name: "mcp/tool-bridge.ts",
            desc: "MCP 서버 도구를 dbcode 도구 레지스트리에 변환하여 연결하는 브리지",
            status: "ready",
          },
          {
            slug: "mcp-tool-filter",
            name: "mcp/tool-filter.ts",
            desc: "서버별 허용/차단 목록으로 MCP 도구 필터링",
            status: "ready",
          },
          {
            slug: "mcp-tool-search",
            name: "mcp/tool-search.ts",
            desc: "대규모 MCP 도구 세트를 위한 지연 로딩(deferred) 검색 모듈",
            status: "ready",
          },
          {
            slug: "mcp-managed-config",
            name: "mcp/managed-config.ts",
            desc: "관리형 MCP 설정 — 관리자 정책 강제, 도구 허용/차단, 서버 제한",
            status: "ready",
          },
          {
            slug: "mcp-output-limiter",
            name: "mcp/output-limiter.ts",
            desc: "MCP 출력 크기 제한 — JSON/Markdown/텍스트 구조 보존 스마트 잘림",
            status: "ready",
          },
          {
            slug: "mcp-serve",
            name: "mcp/serve.ts",
            desc: "dbcode를 MCP 서버로 실행 — JSON-RPC 2.0 프로토콜로 도구 노출",
            status: "ready",
          },
          {
            slug: "mcp-manager-connector",
            name: "mcp/manager-connector.ts",
            desc: "매니저 커넥터 — 6개 서브 모듈 통합 오케스트레이터",
            status: "ready",
          },
          {
            slug: "mcp-oauth",
            name: "mcp/oauth.ts",
            desc: "OAuth 인증 — Authorization Code Flow, 토큰 갱신/영속화",
            status: "ready",
          },
          {
            slug: "mcp-prompts",
            name: "mcp/prompts.ts + resources.ts",
            desc: "MCP 프롬프트 & 리소스 — 슬래시 명령 생성 + @멘션 파싱 + TTL 캐시",
            status: "ready",
          },
          {
            slug: "mcp-transport-base",
            name: "mcp/transports/base.ts",
            desc: "트랜스포트 추상 인터페이스 — MCPTransportLayer + 팩토리 함수",
            status: "ready",
          },
          {
            slug: "mcp-transport-stdio",
            name: "mcp/transports/stdio.ts",
            desc: "stdio 트랜스포트 — 자식 프로세스 stdin/stdout JSON-RPC 통신",
            status: "ready",
          },
          {
            slug: "mcp-transport-sse",
            name: "mcp/transports/sse.ts",
            desc: "SSE 트랜스포트 — Server-Sent Events 양방향 통신 + 지수 백오프",
            status: "ready",
          },
          {
            slug: "mcp-transport-http",
            name: "mcp/transports/http.ts",
            desc: "Streamable HTTP 트랜스포트 — 세션 관리 + OAuth + 자동 재시도",
            status: "ready",
          },
        ],
      },
      {
        name: "Guardrails (5)",
        modules: [
          {
            slug: "injection-detector",
            name: "guardrails/injection-detector.ts",
            desc: "프롬프트 인젝션 감지 — AI에 대한 프롬프트 인젝션 공격 탐지 보안 모듈",
            status: "ready",
          },
          {
            slug: "entropy-scanner",
            name: "guardrails/entropy-scanner.ts",
            desc: "Shannon 엔트로피 기반 이상 감지 — 코드 내 비밀 정보 통계적 탐지",
            status: "ready",
          },
          {
            slug: "secret-scanner",
            name: "guardrails/secret-scanner.ts",
            desc: "비밀 키 탐지 — 28개 정규식 패턴으로 API 키, 토큰, 비밀번호 감지",
            status: "ready",
          },
          {
            slug: "command-filter",
            name: "guardrails/command-filter.ts",
            desc: "위험 명령어 필터 — 시스템 파괴·보안 위협 쉘 명령 탐지 및 차단",
            status: "ready",
          },
          {
            slug: "path-filter",
            name: "guardrails/path-filter.ts",
            desc: "경로 접근 제한 — 민감한 시스템 파일·인증 정보 접근 차단 보안 모듈",
            status: "ready",
          },
        ],
      },
      {
        name: "Subagents (8)",
        modules: [
          {
            slug: "subagent-spawner",
            name: "subagents/spawner.ts",
            desc: "서브에이전트 생성·설정·실행 — 메인 에이전트가 복잡한 작업을 분할 위임",
            status: "ready",
          },
          {
            slug: "team-manager",
            name: "subagents/team-manager.ts",
            desc: "팀 생성·워커 배분·결과 병합 — 여러 워커 에이전트 팀 생성·실행 오케스트레이터",
            status: "ready",
          },
          {
            slug: "subagent-task-list",
            name: "subagents/task-list.ts",
            desc: "팀 작업 목록 관리 — 여러 서브에이전트 협업 시 작업 조율",
            status: "ready",
          },
          {
            slug: "shared-state",
            name: "subagents/shared-state.ts",
            desc: "워커 간 공유 상태 — 서브에이전트 간 통신·데이터 공유",
            status: "ready",
          },
          {
            slug: "definition-loader",
            name: "subagents/definition-loader.ts",
            desc: "마크다운(.md) 파일에서 에이전트 정의 파싱·로드",
            status: "ready",
          },
          {
            slug: "agent-hooks",
            name: "subagents/agent-hooks.ts",
            desc: "에이전트 정의 훅을 기존 훅 시스템 형식으로 변환하는 서브에이전트 전용 훅",
            status: "ready",
          },
          {
            slug: "agent-memory-sub",
            name: "subagents/agent-memory.ts",
            desc: "서브에이전트 세션 간 영속적 메모리 관리 모듈",
            status: "ready",
          },
          {
            slug: "agent-skills-loader",
            name: "subagents/agent-skills-loader.ts",
            desc: "서브에이전트 시스템 프롬프트에 스킬 내용 주입 — 4개 경로 우선순위 탐색",
            status: "ready",
          },
        ],
      },
    ],
  },
  {
    name: "Layer 4: Leaf Modules",
    color: "orange",
    badge: "Zero Upward Deps — 42개",
    icon: "🍃",
    borderClass: "border-l-amber-400",
    badgeBg: "bg-amber-100 text-amber-700",
    subGroupHeaderBg: "bg-amber-50 text-amber-800",
    subGroups: [
      {
        name: "Config (3)",
        modules: [
          {
            slug: "config-loader",
            name: "config/loader.ts",
            desc: "5-Layer 설정 병합 — CLI > 환경변수 > 프로젝트 > 사용자 > 기본값",
            status: "ready",
          },
          {
            slug: "config-defaults",
            name: "config/defaults.ts",
            desc: "설정 계층 최하위(Level 1) 하드코딩 기본값 — 사용자·프로젝트 설정 없을 때 폴백",
            status: "ready",
          },
          {
            slug: "config-schema",
            name: "config/schema.ts",
            desc: "Zod 기반 런타임 설정 유효성 검증 — JSON·환경변수 값의 형식·범위 검사",
            status: "ready",
          },
        ],
      },
      {
        name: "Skills (4)",
        modules: [
          {
            slug: "skill-manager",
            name: "skills/manager.ts",
            desc: "4개 디렉토리에서 스킬 로딩 — 우선순위 병합 + 프롬프트 섹션 생성",
            status: "ready",
          },
          {
            slug: "skill-loader",
            name: "skills/loader.ts",
            desc: "스킬 파일(.md) 탐색·로딩 — YAML 프론트매터 파싱 + Zod 스키마 검증",
            status: "ready",
          },
          {
            slug: "skill-executor",
            name: "skills/executor.ts",
            desc: "스킬 실행 엔진 — SKILL.md 본문 파싱, 변수 치환, 동적 컨텍스트 주입",
            status: "ready",
          },
          {
            slug: "skill-command-bridge",
            name: "skills/command-bridge.ts",
            desc: "슬래시 명령 ↔ 스킬 시스템 브릿지 — 스킬을 SlashCommand로 변환 + inline/fork 분기",
            status: "ready",
          },
        ],
      },
      {
        name: "Instructions (3)",
        modules: [
          {
            slug: "instruction-loader",
            name: "instructions/loader.ts",
            desc: "6단계 DBCODE.md 로딩 체인 — global → project → local 계층 병합",
            status: "ready",
          },
          {
            slug: "instruction-parser",
            name: "instructions/parser.ts",
            desc: "@import 지시어 해석·병합 파서 — 순환 참조 감지, 최대 깊이 제한, .md 전용 보안",
            status: "ready",
          },
          {
            slug: "instruction-path-matcher",
            name: "instructions/path-matcher.ts",
            desc: "경로 조건부 규칙 매칭 — glob 패턴을 정규식으로 변환하여 디렉토리별 규칙 적용",
            status: "ready",
          },
        ],
      },
      {
        name: "Memory (4)",
        modules: [
          {
            slug: "memory-manager",
            name: "memory/manager.ts",
            desc: "프로젝트 스코프 메모리 중앙 관리 — loader·writer·paths 통합 인터페이스",
            status: "ready",
          },
          {
            slug: "memory-writer",
            name: "memory/writer.ts",
            desc: "프로젝트 메모리 안전 기록 — 원자적 파일 쓰기 + 중복 감지",
            status: "ready",
          },
          {
            slug: "memory-loader",
            name: "memory/loader.ts",
            desc: "프로젝트 메모리 파일 읽기 — MEMORY.md를 시스템 프롬프트에 주입",
            status: "ready",
          },
          {
            slug: "memory-paths",
            name: "memory/paths.ts",
            desc: "프로젝트 경로를 SHA-256 해시로 변환하여 안정적인 메모리 파일 경로 생성",
            status: "ready",
          },
        ],
      },
      {
        name: "Hooks (4)",
        modules: [
          {
            slug: "hook-runner",
            name: "hooks/runner.ts",
            desc: "훅 실행 엔진 — command/http/prompt/agent 4가지 핸들러 타입 실행",
            status: "ready",
          },
          {
            slug: "hook-loader",
            name: "hooks/loader.ts",
            desc: "settings.json에서 훅 설정 읽기 — Zod 스키마 검증",
            status: "ready",
          },
          {
            slug: "hook-auto-lint",
            name: "hooks/auto-lint.ts",
            desc: "파일 수정 후 린터 자동 실행 — .ts/.py/.go/.rs 등 코드 품질 즉시 피드백",
            status: "ready",
          },
          {
            slug: "hook-team-events",
            name: "hooks/team-events.ts",
            desc: "팀 매니저 ↔ 훅 시스템 브리지 — TeammateIdle·TaskCompleted 이벤트 연결",
            status: "ready",
          },
        ],
      },
      {
        name: "Utils (6)",
        modules: [
          {
            slug: "utils-error",
            name: "utils/error.ts",
            desc: "구조화된 에러 클래스 계층 — BaseError 루트로 도메인별 에러 체계 관리",
            status: "ready",
          },
          {
            slug: "utils-events",
            name: "utils/events.ts",
            desc: "mitt 기반 타입 안전 이벤트 시스템 — 느슨한 결합으로 LLM·도구·에이전트 이벤트 발행/구독",
            status: "ready",
          },
          {
            slug: "utils-logger",
            name: "utils/logger.ts",
            desc: "pino 기반 구조화 로깅 — 민감 정보 자동 마스킹 + 파일 기반 JSON 로깅 싱글톤",
            status: "ready",
          },
          {
            slug: "utils-path",
            name: "utils/path.ts",
            desc: "크로스 플랫폼 경로 처리 — Windows 백슬래시, Git Bash, UNC, 긴 경로 통일",
            status: "ready",
          },
          {
            slug: "utils-platform",
            name: "utils/platform.ts",
            desc: "OS·WSL·Git Bash·셸 타입 감지 — 샌드박스·경로·셸 명령 플랫폼별 분기",
            status: "ready",
          },
          {
            slug: "utils-notifications",
            name: "utils/notifications.ts",
            desc: "크로스 플랫폼 데스크톱 알림 + 이벤트 트리거 + 설정",
            status: "ready",
          },
        ],
      },
      {
        name: "Auth (2)",
        modules: [
          {
            slug: "token-manager-auth",
            name: "auth/token-manager.ts",
            desc: "API 토큰 해석·캐싱·제공 — 환경변수·파일에서 찾아 메모리 캐시 후 HTTP 인증 헤더 변환",
            status: "ready",
          },
          {
            slug: "token-store",
            name: "auth/token-store.ts",
            desc: "API 토큰 환경변수·자격증명 파일 로드·저장 — 파일 권한 0o600 보안 보장",
            status: "ready",
          },
        ],
      },
      {
        name: "Voice (2)",
        modules: [
          {
            slug: "voice-recorder",
            name: "voice/recorder.ts",
            desc: "SoX 기반 마이크 녹음 — 기본 마이크에서 PCM 오디오 캡처 후 WAV Buffer 반환",
            status: "ready",
          },
          {
            slug: "voice-transcriber",
            name: "voice/transcriber.ts",
            desc: "OpenAI Whisper API를 사용하여 오디오 Buffer를 텍스트로 변환(STT)",
            status: "ready",
          },
        ],
      },
      {
        name: "Sandbox (6)",
        modules: [
          {
            slug: "sandbox-linux",
            name: "sandbox/linux.ts",
            desc: "Linux 샌드박스 환경 감지·bubblewrap 설치 확인·bwrap 인수 생성·실행",
            status: "ready",
          },
          {
            slug: "sandbox-bubblewrap",
            name: "sandbox/bubblewrap.ts",
            desc: "Linux 네임스페이스 기반 프로세스 격리 — bubblewrap(bwrap) 고수준 래퍼",
            status: "ready",
          },
          {
            slug: "sandbox-seatbelt",
            name: "sandbox/seatbelt.ts",
            desc: "macOS 내장 Seatbelt 샌드박스 — sandbox-exec로 프로세스 격리 실행",
            status: "ready",
          },
          {
            slug: "sandbox-network-policy",
            name: "sandbox/network-policy.ts",
            desc: "샌드박스 네트워크 접근 제어 — 허용 목록·차단 목록 기반 규칙 엔진",
            status: "ready",
          },
          {
            slug: "sandbox-network-proxy",
            name: "sandbox/network-proxy.ts",
            desc: "네트워크 정책 적용 HTTP 프록시 — 샌드박스 트래픽 검사, 허용 호스트만 통과",
            status: "ready",
          },
          {
            slug: "sandbox-sandboxed-network",
            name: "sandbox/sandboxed-network.ts",
            desc: "네트워크 정책과 Seatbelt/Bubblewrap 통합 — 프록시 시작 + HTTP_PROXY 환경변수 주입",
            status: "ready",
          },
        ],
      },
      {
        name: "Mentions (3)",
        modules: [
          {
            slug: "mention-parser",
            name: "mentions/parser.ts",
            desc: "사용자 입력에서 @file, @url, @mcp 멘션 추출 파서",
            status: "ready",
          },
          {
            slug: "mention-resolver",
            name: "mentions/resolver.ts",
            desc: "@멘션 실제 콘텐츠 병렬 로드 — 파일 시스템, HTTP, MCP 통해 리졸브",
            status: "ready",
          },
          {
            slug: "resource-resolver",
            name: "mentions/resource-resolver.ts",
            desc: "MCP 리소스 멘션 해석·자동완성·캐싱 통합 리졸버 클래스",
            status: "ready",
          },
        ],
      },
      {
        name: "Telemetry (4)",
        modules: [
          {
            slug: "telemetry-events",
            name: "telemetry/events.ts",
            desc: "구조화된 텔레메트리 이벤트 정의 및 버퍼링 — 도구 결정, LLM 호출, 에러, 세션 라이프사이클",
            status: "ready",
          },
          {
            slug: "telemetry-metrics",
            name: "telemetry/metrics.ts",
            desc: "카운터·히스토그램 메트릭 인메모리 수집 텔레메트리 모듈",
            status: "ready",
          },
          {
            slug: "telemetry-otel",
            name: "telemetry/otel.ts",
            desc: "OTel SDK 없이 순수 HTTP/JSON으로 OTLP 엔드포인트에 메트릭·이벤트 전송 경량 Exporter",
            status: "ready",
          },
          {
            slug: "telemetry-config",
            name: "telemetry/config.ts",
            desc: "환경변수에서 텔레메트리 설정 로드 + Zod 검증 — 기본값으로 텔레메트리 비활성(프라이버시 보호)",
            status: "ready",
          },
        ],
      },
      {
        name: "Indexing (1)",
        modules: [
          {
            slug: "repo-map",
            name: "indexing/repo-map.ts",
            desc: "코드베이스 심볼·import 관계 경량 분석 — AI에게 프로젝트 전체 구조 제공",
            status: "ready",
          },
        ],
      },
      {
        name: "Other (1)",
        modules: [
          {
            slug: "constants",
            name: "src/constants.ts",
            desc: "애플리케이션 전체 상수·기본값·경로 정의 최하위 레이어 모듈",
            status: "ready",
          },
        ],
      },
    ],
  },
  {
    name: "Slash Commands",
    color: "cyan",
    badge: "User Commands — 25개",
    icon: "⌨️",
    borderClass: "border-l-cyan-400",
    badgeBg: "bg-cyan-100 text-cyan-700",
    subGroupHeaderBg: "bg-cyan-50 text-cyan-800",
    modules: [
      {
        slug: "cmd-init",
        name: "commands/init.ts",
        desc: "/init 프로젝트 초기화 — DBCODE.md + .dbcode/ 디렉토리 생성으로 AI 프로젝트 이해 지원",
        status: "ready",
      },
      {
        slug: "cmd-commit",
        name: "commands/commit.ts",
        desc: "/commit Git 커밋 — 스테이징 분석 + 타입/스코프 자동 감지 + LLM 커밋 메시지 생성",
        status: "ready",
      },
      {
        slug: "cmd-review",
        name: "commands/review.ts",
        desc: "/review 코드 리뷰 — 4가지 관점(버그/보안/품질/에러) 체계적 리뷰 + 심각도 분류",
        status: "ready",
      },
      {
        slug: "cmd-diff",
        name: "commands/diff.ts",
        desc: "/diff 변경 사항 확인 — git diff를 staged/unstaged 구분하여 요약 표시",
        status: "ready",
      },
      {
        slug: "cmd-context",
        name: "commands/context.ts",
        desc: "/context 컨텍스트 정보 — 컨텍스트 윈도우 사용량 시각적 진행 막대 표시",
        status: "ready",
      },
      {
        slug: "cmd-model",
        name: "commands/model.ts",
        desc: "/model 세션 중 활성 LLM 모델·프로바이더 전환 명령어",
        status: "ready",
      },
      {
        slug: "cmd-dual-model",
        name: "commands/dual-model.ts",
        desc: "/dual, /architect, /editor 듀얼 모델 설정 — 작업별 모델 자동 전환",
        status: "ready",
      },
      {
        slug: "cmd-effort",
        name: "commands/effort.ts",
        desc: "/effort LLM 응답 추론 깊이·최대 토큰 수 4단계(low/medium/high/max) 조절",
        status: "ready",
      },
      {
        slug: "cmd-agents",
        name: "commands/agents.ts",
        desc: "/agents 프로젝트·사용자 디렉토리 에이전트 정의 파일 조회·관리",
        status: "ready",
      },
      {
        slug: "cmd-team",
        name: "commands/team.ts",
        desc: "/team 여러 AI 에이전트 병렬 실행 — 복잡한 작업 분담 팀 관리 명령어",
        status: "ready",
      },
      {
        slug: "cmd-memory",
        name: "commands/memory.ts",
        desc: "/memory 세션 간 영구 기억 정보 마크다운 파일 관리 — 프로젝트 메모리 시스템",
        status: "ready",
      },
      {
        slug: "cmd-mcp",
        name: "commands/mcp.ts",
        desc: "/mcp MCP 서버 추가·제거·조회 — 3-스코프 체계 관리",
        status: "ready",
      },
      {
        slug: "cmd-permissions",
        name: "commands/permissions.ts",
        desc: "/permissions LLM 도구 호출 권한 영구 규칙 세밀 관리 명령어",
        status: "ready",
      },
      {
        slug: "cmd-export",
        name: "commands/export.ts",
        desc: "/export 현재 대화 내역 마크다운 파일 또는 클립보드 내보내기",
        status: "ready",
      },
      {
        slug: "cmd-analytics",
        name: "commands/analytics.ts",
        desc: "/analytics 상세 분석 — 모델 분포, 도구 빈도, 캐시 통계, 활동 타임라인 종합 대시보드",
        status: "ready",
      },
      {
        slug: "cmd-stats",
        name: "commands/stats.ts",
        desc: "/stats 세션 통계 — 토큰/비용/도구 사용량 시각적 막대 차트 대시보드",
        status: "ready",
      },
      {
        slug: "cmd-doctor",
        name: "commands/doctor.ts",
        desc: "/doctor 환경 진단 — 12가지 항목 자동 점검 (Node.js, Git, API 키, LLM 연결 등)",
        status: "ready",
      },
      {
        slug: "cmd-update",
        name: "commands/update.ts",
        desc: "/update 업데이트 확인 — npm 레지스트리 조회 후 자동 글로벌 업데이트",
        status: "ready",
      },
      {
        slug: "cmd-resume",
        name: "commands/resume.ts",
        desc: "/resume 세션 이어하기 — 대화형 선택 리스트 + 부분 ID 매칭 세션 재개",
        status: "ready",
      },
      {
        slug: "cmd-rewind",
        name: "commands/rewind.ts",
        desc: "/rewind 체크포인트 복원 — 자동 체크포인트 목록 조회 및 파일 복원",
        status: "ready",
      },
      {
        slug: "cmd-undo",
        name: "commands/undo.ts",
        desc: "/undo 파일 되돌리기 — git checkout 기반 마지막 커밋 상태 복원",
        status: "ready",
      },
      {
        slug: "cmd-bug",
        name: "commands/bug.ts",
        desc: "/bug 버그 리포트 — 환경 정보 자동 수집 + GitHub 이슈 생성 URL 제공",
        status: "ready",
      },
      {
        slug: "cmd-copy",
        name: "commands/copy.ts",
        desc: "/copy 코드 블록 복사 — 어시스턴트 메시지의 코드 블록 시스템 클립보드 복사",
        status: "ready",
      },
      {
        slug: "cmd-cost",
        name: "commands/cost.ts",
        desc: "/cost 비용 확인 — 토큰 사용량, 예상 비용, 턴당 효율성 메트릭 상세 표시",
        status: "ready",
      },
      {
        slug: "cmd-registry",
        name: "commands/registry.ts",
        desc: "명령어 레지스트리 — SlashCommand 등록/조회/실행 + 자동 완성 + 부가 효과 체이닝",
        status: "ready",
      },
    ],
  },
];

const statusBadge: Record<string, { text: string; style: string }> = {
  ready: { text: "Ready", style: "bg-emerald-100 text-emerald-700" },
  planned: { text: "Planned", style: "bg-gray-100 text-gray-500" },
  wip: { text: "WIP", style: "bg-amber-100 text-amber-700" },
};

function ModuleCard({ mod, borderClass }: { mod: Module; borderClass: string }) {
  const badge = statusBadge[mod.status];
  const isReady = mod.status === "ready";

  const content = (
    <div
      className={`border border-gray-200 rounded-lg p-4 border-l-4 ${borderClass} transition-colors ${
        isReady ? "hover:bg-gray-50 hover:border-gray-300 cursor-pointer" : "opacity-60"
      }`}
      style={{ padding: "20px" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-indigo-600 font-mono text-sm font-semibold">{mod.name}</span>
            <span
              className={`text-xs font-semibold rounded-full ${badge.style}`}
              style={{ padding: "3px 10px" }}
            >
              {badge.text}
            </span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{mod.desc}</p>
        </div>
        {isReady && (
          <span className="text-gray-400 text-lg mt-1 shrink-0 transition-transform group-hover:translate-x-0.5">
            →
          </span>
        )}
      </div>
    </div>
  );

  return isReady ? (
    <Link href={`/docs/${mod.slug}`} className="group">
      {content}
    </Link>
  ) : (
    <div>{content}</div>
  );
}

export default function DocsPage() {
  return (
    <div className="pt-8 pb-16" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div
        style={{
          maxWidth: "900px",
          marginLeft: "auto",
          marginRight: "auto",
          paddingLeft: "1.5rem",
          paddingRight: "1.5rem",
        }}
      >
        {/* Header */}
        <div className="text-center mb-12" style={{ textAlign: "center", marginBottom: "48px" }}>
          <span className="inline-block bg-cyan-100 text-cyan-700 text-xs font-semibold px-3 py-1 rounded-full mb-5">
            Source Reference
          </span>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">소스 레퍼런스</h1>
          <p
            className="text-base text-gray-600 leading-relaxed"
            style={{ maxWidth: "36rem", marginLeft: "auto", marginRight: "auto" }}
          >
            dbcode의 모든 TypeScript 모듈을 초보자도 이해할 수 있도록 구조화한 문서입니다. 각
            페이지는 개요 → 레퍼런스 → 사용법 → 내부 구현 → 트러블슈팅 순서로 구성됩니다.
          </p>
        </div>

        {/* Stats */}
        <div
          className="flex justify-center items-center gap-12 mb-12"
          style={{ marginBottom: "48px" }}
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-indigo-600">188</div>
            <div className="text-sm text-gray-500 mt-1">총 모듈</div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-600">188</div>
            <div className="text-sm text-gray-500 mt-1">문서 완료</div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-400">0</div>
            <div className="text-sm text-gray-500 mt-1">작성 예정</div>
          </div>
        </div>

        {/* Layer Groups */}
        <div
          className="flex flex-col gap-10"
          style={{ display: "flex", flexDirection: "column", gap: "48px" }}
        >
          {layers.map((layer) => (
            <div key={layer.name}>
              {/* Layer Header */}
              <div className="flex items-center gap-3" style={{ marginBottom: "20px" }}>
                <span className="text-xl" style={{ lineHeight: 1 }}>
                  {layer.icon}
                </span>
                <h2 className="text-lg font-semibold text-gray-900" style={{ margin: 0 }}>
                  {layer.name}
                </h2>
                <span
                  className={`text-xs font-semibold rounded-full ${layer.badgeBg}`}
                  style={{ padding: "4px 14px" }}
                >
                  {layer.badge}
                </span>
              </div>

              {/* Flat modules (no sub-groups) */}
              {layer.modules && (
                <div
                  className="flex flex-col gap-3"
                  style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                >
                  {layer.modules.map((mod) => (
                    <ModuleCard key={mod.slug} mod={mod} borderClass={layer.borderClass} />
                  ))}
                </div>
              )}

              {/* Sub-grouped modules */}
              {layer.subGroups && (
                <div
                  className="flex flex-col gap-6"
                  style={{ display: "flex", flexDirection: "column", gap: "24px" }}
                >
                  {layer.subGroups.map((group) => (
                    <div key={group.name}>
                      {/* Sub-group header */}
                      <div
                        className={`inline-flex items-center rounded-md text-xs font-semibold mb-3 ${layer.subGroupHeaderBg}`}
                        style={{ padding: "4px 12px", marginBottom: "12px" }}
                      >
                        {group.name}
                      </div>
                      <div
                        className="flex flex-col gap-3"
                        style={{ display: "flex", flexDirection: "column", gap: "10px" }}
                      >
                        {group.modules.map((mod) => (
                          <ModuleCard key={mod.slug} mod={mod} borderClass={layer.borderClass} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-12" style={{ marginTop: "48px" }}>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600 flex items-center gap-2.5">
            <span>💡</span>
            <span>
              문서가 작성되면 <strong className="text-gray-900">Planned</strong> →{" "}
              <strong className="text-emerald-600">Ready</strong>로 변경되며 클릭하여 열람할 수
              있습니다.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
