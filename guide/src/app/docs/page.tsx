import Link from "next/link";

const layers = [
  {
    name: "Layer 2: Core",
    color: "purple",
    badge: "Zero UI Imports",
    icon: "⚙️",
    borderColor: "border-l-accent-purple",
    badgeBg: "bg-[rgba(139,92,246,0.1)] text-accent-purple",
    modules: [
      { slug: "agent-loop", name: "agent-loop.ts", desc: "ReAct 패턴 메인 루프 — LLM 호출, 도구 실행, 결과 피드백 반복", status: "ready" },
      { slug: "context-manager", name: "context-manager.ts", desc: "3-Layer 토큰 관리 — Microcompaction, Auto-compaction, Rehydration", status: "ready" },
      { slug: "circuit-breaker", name: "circuit-breaker.ts", desc: "무한 루프 방지 — 무변경/에러 반복 감지 후 자동 중단", status: "ready" },
      { slug: "recovery-executor", name: "recovery-executor.ts", desc: "에러 유형별 복구 전략 — compact, retry, fallback", status: "ready" },
      { slug: "system-prompt-builder", name: "system-prompt-builder.ts", desc: "동적 시스템 프롬프트 조립 — SHA-256 캐시", status: "planned" },
      { slug: "checkpoint-manager", name: "checkpoint-manager.ts", desc: "파일 변경 전 자동 상태 스냅샷 — /undo, /rewind 기반", status: "planned" },
      { slug: "observation-masking", name: "observation-masking.ts", desc: "재생성 가능한 도구 출력 마스킹 — 컨텍스트 절약", status: "planned" },
    ],
  },
  {
    name: "Layer 3: Infrastructure",
    color: "green",
    badge: "LLM + Tools + Security",
    icon: "🔧",
    borderColor: "border-l-accent-green",
    badgeBg: "bg-[rgba(16,185,129,0.1)] text-accent-green",
    modules: [
      { slug: "token-counter", name: "llm/token-counter.ts", desc: "토큰 계산 — tiktoken 기반 정확 계산 + 빠른 추정, LRU 캐시", status: "ready" },
      { slug: "model-capabilities", name: "llm/model-capabilities.ts", desc: "모델별 능력 레지스트리 — 기능 플래그, 컨텍스트 크기, 가격, 능력 티어", status: "ready" },
      { slug: "secret-scanner", name: "guardrails/secret-scanner.ts", desc: "비밀 키 탐지 — 28개 정규식 패턴으로 API 키, 토큰, 비밀번호 감지", status: "ready" },
      { slug: "llm-client", name: "llm/client.ts", desc: "OpenAI 호환 LLM API 클라이언트 — 스트리밍, 재시도, URL 정규화", status: "planned" },
      { slug: "dual-model-router", name: "llm/dual-model-router.ts", desc: "Architect/Editor 모델 자동 전환 라우터", status: "planned" },
      { slug: "tool-registry", name: "tools/registry.ts", desc: "도구 등록/조회 — Hot Tools + Deferred Loading", status: "ready" },
      { slug: "tool-executor", name: "tools/executor.ts", desc: "도구 실행 파이프라인 — Zod 검증, AbortSignal, 재시도", status: "planned" },
      { slug: "permission-manager", name: "permissions/manager.ts", desc: "5단계 권한 결정 트리 — deny-first 원칙", status: "ready" },
      { slug: "mcp-manager", name: "mcp/manager.ts", desc: "MCP 서버 수명주기 — 3-Scope 설정, 병렬 연결", status: "planned" },
    ],
  },
  {
    name: "Layer 4: Leaf Modules",
    color: "orange",
    badge: "Zero Upward Deps",
    icon: "🍃",
    borderColor: "border-l-accent-orange",
    badgeBg: "bg-[rgba(245,158,11,0.1)] text-accent-orange",
    modules: [
      { slug: "config-loader", name: "config/loader.ts", desc: "5-Layer 설정 병합 — CLI > 환경변수 > 프로젝트 > 사용자 > 기본값", status: "ready" },
      { slug: "skill-manager", name: "skills/manager.ts", desc: "4개 디렉토리에서 스킬 로딩 — 42개 슬래시 명령 관리", status: "planned" },
      { slug: "instruction-loader", name: "instructions/loader.ts", desc: "6단계 DBCODE.md 로딩 체인", status: "planned" },
    ],
  },
  {
    name: "Layer 1: CLI",
    color: "blue",
    badge: "Ink/React",
    icon: "🖥️",
    borderColor: "border-l-accent-blue",
    badgeBg: "bg-[rgba(59,130,246,0.1)] text-accent-blue",
    modules: [
      { slug: "use-agent-loop", name: "cli/hooks/useAgentLoop.ts", desc: "Agent Loop ↔ React 상태 연결 핵심 브릿지", status: "planned" },
      { slug: "activity-feed", name: "cli/components/ActivityFeed.tsx", desc: "Progressive Static Flushing — 완료 항목 Static 전환", status: "planned" },
    ],
  },
];

const statusBadge: Record<string, { text: string; style: string }> = {
  ready: { text: "Ready", style: "bg-[rgba(16,185,129,0.15)] text-accent-green" },
  planned: { text: "Planned", style: "bg-[rgba(100,116,139,0.15)] text-text-muted" },
  wip: { text: "WIP", style: "bg-[rgba(245,158,11,0.15)] text-accent-orange" },
};

export default function DocsPage() {
  return (
    <div className="min-h-screen pt-[100px] pb-20">
      <div className="max-w-[960px] mx-auto px-4 sm:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-[rgba(6,182,212,0.1)] border border-[rgba(6,182,212,0.2)] rounded-full text-[13px] text-accent-cyan font-semibold mb-6">
            Source Reference
          </span>
          <h1 className="text-[clamp(28px,4vw,48px)] font-black tracking-tight leading-[1.15] mb-4">
            <span className="bg-gradient-to-r from-accent-cyan to-accent-blue bg-clip-text text-transparent">
              소스 레퍼런스
            </span>
          </h1>
          <p className="text-[16px] text-text-secondary max-w-[560px] mx-auto">
            dbcode의 모든 TypeScript 모듈을 초보자도 이해할 수 있도록 구조화한 문서입니다.
            각 페이지는 개요 → 레퍼런스 → 사용법 → 내부 구현 → 트러블슈팅 순서로 구성됩니다.
          </p>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-10 mb-14">
          <div className="text-center">
            <div className="text-2xl font-extrabold bg-gradient-to-r from-accent-cyan to-accent-blue bg-clip-text text-transparent">21</div>
            <div className="text-xs text-text-muted mt-1">총 모듈</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-extrabold text-accent-green">10</div>
            <div className="text-xs text-text-muted mt-1">문서 완료</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-extrabold text-text-muted">11</div>
            <div className="text-xs text-text-muted mt-1">작성 예정</div>
          </div>
        </div>

        {/* Layer Groups */}
        <div className="flex flex-col gap-8">
          {layers.map((layer) => (
            <div key={layer.name}>
              {/* Layer Header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xl">{layer.icon}</span>
                <h2 className="text-lg font-bold">{layer.name}</h2>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${layer.badgeBg}`}>
                  {layer.badge}
                </span>
              </div>

              {/* Module Cards */}
              <div className="flex flex-col gap-2.5">
                {layer.modules.map((mod) => {
                  const badge = statusBadge[mod.status];
                  const isReady = mod.status === "ready";

                  const content = (
                    <div
                      className={`bg-bg-card border border-border rounded-xl p-5 border-l-[3px] ${layer.borderColor} transition-all ${
                        isReady ? "hover:border-[rgba(59,130,246,0.3)] hover:translate-y-[-1px] hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] cursor-pointer" : "opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <span className="font-mono text-sm font-bold text-accent-cyan">{mod.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badge.style}`}>
                              {badge.text}
                            </span>
                          </div>
                          <p className="text-[13px] text-text-secondary leading-relaxed">{mod.desc}</p>
                        </div>
                        {isReady && (
                          <span className="text-text-muted text-sm mt-1 shrink-0">→</span>
                        )}
                      </div>
                    </div>
                  );

                  return isReady ? (
                    <Link key={mod.slug} href={`/docs/${mod.slug}`}>{content}</Link>
                  ) : (
                    <div key={mod.slug}>{content}</div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-14 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-bg-card border border-border rounded-xl text-[13px] text-text-secondary">
            <span>💡</span>
            <span>문서가 작성되면 <strong className="text-text-primary">Planned</strong> → <strong className="text-accent-green">Ready</strong>로 변경되며 클릭하여 열람할 수 있습니다.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
