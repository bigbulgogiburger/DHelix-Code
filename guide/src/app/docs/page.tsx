import Link from "next/link";

const layers = [
  {
    name: "Layer 1: CLI",
    color: "blue",
    badge: "Ink/React",
    icon: "🖥️",
    borderClass: "border-l-blue-400",
    badgeBg: "bg-blue-100 text-blue-700",
    modules: [
      {
        slug: "use-agent-loop",
        name: "cli/hooks/useAgentLoop.ts",
        desc: "Agent Loop ↔ React 상태 연결 핵심 브릿지",
        status: "ready",
      },
      {
        slug: "activity-feed",
        name: "cli/components/ActivityFeed.tsx",
        desc: "Progressive Static Flushing — 완료 항목 Static 전환",
        status: "ready",
      },
      {
        slug: "agent-status",
        name: "cli/components/AgentStatus.tsx",
        desc: "에이전트 실행 상태 표시 — 애니메이션 별 + 한국어 메시지 + 경과 시간",
        status: "ready",
      },
      {
        slug: "turn-block",
        name: "cli/components/TurnBlock.tsx",
        desc: "대화 턴 블록 — 사용자 입력 + AI 응답 + 도구 호출을 하나의 턴으로 렌더링",
        status: "ready",
      },
      {
        slug: "error-banner",
        name: "cli/components/ErrorBanner.tsx",
        desc: "에러 배너 — 에러 자동 분류 + 유형별 아이콘 + 한국어 해결 가이드",
        status: "ready",
      },
      {
        slug: "use-voice",
        name: "cli/hooks/useVoice.ts",
        desc: "음성 입력 훅 — SoX 녹음 + Whisper API 변환 생명주기 관리",
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
        slug: "rendering-engine",
        name: "cli/renderer/",
        desc: "도구 실행 결과 ANSI 렌더링 — tool-display + syntax + markdown + theme + 동기화 출력",
        status: "ready",
      },
    ],
  },
  {
    name: "Layer 2: Core",
    color: "purple",
    badge: "Zero UI Imports",
    icon: "⚙️",
    borderClass: "border-l-violet-400",
    badgeBg: "bg-violet-100 text-violet-700",
    modules: [
      {
        slug: "agent-loop",
        name: "agent-loop.ts",
        desc: "ReAct 패턴 메인 루프 — LLM 호출, 도구 실행, 결과 피드백 반복",
        status: "ready",
      },
      {
        slug: "context-manager",
        name: "context-manager.ts",
        desc: "3-Layer 토큰 관리 — Microcompaction, Auto-compaction, Rehydration",
        status: "ready",
      },
      {
        slug: "circuit-breaker",
        name: "circuit-breaker.ts",
        desc: "무한 루프 방지 — 무변경/에러 반복 감지 후 자동 중단",
        status: "ready",
      },
      {
        slug: "recovery-executor",
        name: "recovery-executor.ts",
        desc: "에러 유형별 복구 전략 — compact, retry, fallback",
        status: "ready",
      },
      {
        slug: "system-prompt-builder",
        name: "system-prompt-builder.ts",
        desc: "동적 시스템 프롬프트 조립 — 모듈식 섹션 + 우선순위 기반 토큰 예산",
        status: "ready",
      },
      {
        slug: "checkpoint-manager",
        name: "checkpoint-manager.ts",
        desc: "파일 변경 전 자동 상태 스냅샷 — SHA-256 해시 + /undo, /rewind",
        status: "ready",
      },
      {
        slug: "observation-masking",
        name: "observation-masking.ts",
        desc: "재생성 가능한 도구 출력 마스킹 — 읽기 전용 감지 + 토큰 절약",
        status: "ready",
      },
    ],
  },
  {
    name: "Layer 3: Infrastructure",
    color: "green",
    badge: "LLM + Tools + Security",
    icon: "🔧",
    borderClass: "border-l-emerald-400",
    badgeBg: "bg-emerald-100 text-emerald-700",
    modules: [
      {
        slug: "token-counter",
        name: "llm/token-counter.ts",
        desc: "토큰 계산 — tiktoken 기반 정확 계산 + 빠른 추정, LRU 캐시",
        status: "ready",
      },
      {
        slug: "model-capabilities",
        name: "llm/model-capabilities.ts",
        desc: "모델별 능력 레지스트리 — 기능 플래그, 컨텍스트 크기, 가격, 능력 티어",
        status: "ready",
      },
      {
        slug: "secret-scanner",
        name: "guardrails/secret-scanner.ts",
        desc: "비밀 키 탐지 — 28개 정규식 패턴으로 API 키, 토큰, 비밀번호 감지",
        status: "ready",
      },
      {
        slug: "llm-client",
        name: "llm/client.ts",
        desc: "OpenAI 호환 LLM API 클라이언트 — 스트리밍, 자동 재시도, 에러 분류",
        status: "ready",
      },
      {
        slug: "dual-model-router",
        name: "llm/dual-model-router.ts",
        desc: "Architect/Editor 모델 자동 전환 — 작업 페이즈별 라우팅",
        status: "ready",
      },
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
        slug: "permission-manager",
        name: "permissions/manager.ts",
        desc: "5단계 권한 결정 트리 — deny-first 원칙",
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
      {
        slug: "mcp-manager",
        name: "mcp/manager.ts",
        desc: "MCP 서버 수명주기 — 3-Scope 설정, 병렬 연결, 도구 브리지",
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
      {
        slug: "mcp-prompts",
        name: "mcp/prompts.ts + resources.ts",
        desc: "MCP 프롬프트 & 리소스 — 슬래시 명령 생성 + @멘션 파싱 + TTL 캐시",
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
    ],
  },
  {
    name: "Layer 4: Leaf Modules",
    color: "orange",
    badge: "Zero Upward Deps",
    icon: "🍃",
    borderClass: "border-l-amber-400",
    badgeBg: "bg-amber-100 text-amber-700",
    modules: [
      {
        slug: "config-loader",
        name: "config/loader.ts",
        desc: "5-Layer 설정 병합 — CLI > 환경변수 > 프로젝트 > 사용자 > 기본값",
        status: "ready",
      },
      {
        slug: "skill-manager",
        name: "skills/manager.ts",
        desc: "4개 디렉토리에서 스킬 로딩 — 우선순위 병합 + 프롬프트 섹션 생성",
        status: "ready",
      },
      {
        slug: "instruction-loader",
        name: "instructions/loader.ts",
        desc: "6단계 DBCODE.md 로딩 체인 — global → project → local 계층 병합",
        status: "ready",
      },
      {
        slug: "utils-notifications",
        name: "utils/notifications.ts",
        desc: "알림 시스템 — 크로스 플랫폼 데스크톱 알림 + 이벤트 트리거 + 설정",
        status: "ready",
      },
    ],
  },
  {
    name: "Slash Commands",
    color: "cyan",
    badge: "User Commands",
    icon: "⌨️",
    borderClass: "border-l-cyan-400",
    badgeBg: "bg-cyan-100 text-cyan-700",
    modules: [
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
        slug: "cmd-rewind",
        name: "commands/rewind.ts",
        desc: "/rewind 체크포인트 복원 — 자동 체크포인트 목록 조회 및 파일 복원",
        status: "ready",
      },
      {
        slug: "cmd-dual-model",
        name: "commands/dual-model.ts",
        desc: "/dual, /architect, /editor 듀얼 모델 설정 — 작업별 모델 자동 전환",
        status: "ready",
      },
      {
        slug: "cmd-update",
        name: "commands/update.ts",
        desc: "/update 업데이트 확인 — npm 레지스트리 조회 후 자동 글로벌 업데이트",
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
        slug: "cmd-resume",
        name: "commands/resume.ts",
        desc: "/resume 세션 이어하기 — 대화형 선택 리스트 + 부분 ID 매칭 세션 재개",
        status: "ready",
      },
      {
        slug: "cmd-stats",
        name: "commands/stats.ts",
        desc: "/stats 세션 통계 — 토큰/비용/도구 사용량 시각적 막대 차트 대시보드",
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
            <div className="text-3xl font-bold text-indigo-600">63</div>
            <div className="text-sm text-gray-500 mt-1">총 모듈</div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-600">46</div>
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

              {/* Module Cards */}
              <div
                className="flex flex-col gap-3"
                style={{ display: "flex", flexDirection: "column", gap: "12px" }}
              >
                {layer.modules.map((mod) => {
                  const badge = statusBadge[mod.status];
                  const isReady = mod.status === "ready";

                  const content = (
                    <div
                      className={`border border-gray-200 rounded-lg p-4 border-l-4 ${layer.borderClass} transition-colors ${
                        isReady
                          ? "hover:bg-gray-50 hover:border-gray-300 cursor-pointer"
                          : "opacity-60"
                      }`}
                      style={{ padding: "20px" }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1">
                            <span className="text-indigo-600 font-mono text-sm font-semibold">
                              {mod.name}
                            </span>
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
                    <Link key={mod.slug} href={`/docs/${mod.slug}`} className="group">
                      {content}
                    </Link>
                  ) : (
                    <div key={mod.slug}>{content}</div>
                  );
                })}
              </div>
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
