"use client";

import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { FilePath } from "@/components/FilePath";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { DeepDive } from "@/components/DeepDive";
import { ParamTable } from "@/components/ParamTable";
import { LayerBadge } from "@/components/LayerBadge";
import { SeeAlso } from "@/components/SeeAlso";

/* ─────────────────────────────────────────────
   ContextManager Source Reference Page
   HUB MODULE — extra-detailed documentation
   ───────────────────────────────────────────── */

export default function ContextManagerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ════════════════════════════════════════════
            Section 1: Header
            ════════════════════════════════════════════ */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/core/context-manager.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-3">
              <span className="text-gray-900">ContextManager</span>
            </h1>
            <div className="flex items-center gap-3 mb-4">
              <LayerBadge layer="core" />
              <span className="text-[13px] text-gray-600">
                3-Layer 컨텍스트 압축 파이프라인 — LLM 토큰 윈도우의 지능적 관리자
              </span>
            </div>
            <p className="text-[15px] text-gray-600 leading-relaxed">
              LLM은 한 번에 처리할 수 있는 텍스트 양(토큰 수)에 한계가 있습니다. 대화가 길어지면
              이전 내용을 잃게 되는데, <strong className="text-gray-900">ContextManager</strong>는
              이 문제를 3단계 압축 전략으로 해결합니다. 대용량 도구 출력을 디스크에
              저장하고(Microcompaction), 오래된 대화를 구조화된 요약으로 교체하며(Auto-compaction),
              압축 후 중요한 파일을 다시 읽어 신선한 컨텍스트를 제공합니다(Rehydration).
            </p>
          </div>
        </RevealOnScroll>

        {/* ════════════════════════════════════════════
            Section 2: 개요
            ════════════════════════════════════════════ */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📋</span> 개요
            </h2>

            <div className="text-[14px] text-gray-600 leading-relaxed mb-6 space-y-3">
              <p>
                ContextManager는 dhelix의{" "}
                <strong className="text-gray-900">가장 중요한 Core 모듈</strong> 중 하나입니다.
                Agent Loop가 매 턴마다 LLM에 메시지를 보내기 전에{" "}
                <code className="text-cyan-600 text-[13px]">prepare()</code>를 호출하여 컨텍스트
                윈도우를 최적화합니다.
              </p>
              <p>
                핵심 임계값은 <strong className="text-violet-600">83.5%</strong>입니다. 컨텍스트
                사용량이 이 비율에 도달하면 자동 압축이 트리거됩니다. 이 숫자는 high-tier 모델
                기준이며, medium 모델은 75%, low 모델은 65%로 더 일찍 압축합니다.
              </p>
              <p>
                Cold Storage는 SHA-256 해시 기반의{" "}
                <strong className="text-gray-900">content-addressable storage</strong>입니다. 동일한
                도구 출력은 중복 저장되지 않으며, 24시간 TTL 기반의 가비지 컬렉션이 자동으로
                실행됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="아키텍처에서의 ContextManager 위치"
              titleColor="purple"
              chart={`graph TD
    subgraph CLI["Layer 1: CLI"]
        APP["App.tsx<br/><small>루트 UI 컴포넌트</small>"]
        HOOKS["useAgentLoop<br/><small>에이전트 실행 훅</small>"]
    end
    subgraph CORE["Layer 2: Core"]
        AGENT["Agent Loop<br/><small>ReAct 메인 루프</small>"]
        CTX["ContextManager<br/><small>3-Layer 토큰 압축</small>"]
        SYS["SystemPromptBuilder<br/><small>시스템 프롬프트 조립</small>"]
    end
    subgraph INFRA["Layer 3: Infrastructure"]
        LLM["LLM Client<br/><small>LLM API 호출</small>"]
        TOOLS["Tool System<br/><small>도구 실행 엔진</small>"]
    end
    subgraph LEAF["Layer 4: Leaf"]
        TOKEN["token-counter<br/><small>토큰 수 계산</small>"]
        CONFIG["Config<br/><small>5계층 설정 병합</small>"]
    end

    APP --> AGENT
    HOOKS --> AGENT
    AGENT -->|"prepare()"| CTX
    AGENT --> LLM
    AGENT --> TOOLS
    CTX -->|"countTokens()"| TOKEN
    CTX -->|"buildSystemPrompt()"| SYS
    CTX -->|"LLM summarize"| LLM

    style CTX fill:#ede9fe,stroke:#8b5cf6,stroke-width:3px,color:#1e293b
    style AGENT fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
    style LLM fill:#f1f5f9,stroke:#10b981,color:#1e293b
    style TOKEN fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
    style SYS fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
    style APP fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
    style HOOKS fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
    style TOOLS fill:#f1f5f9,stroke:#10b981,color:#1e293b
    style CONFIG fill:#f1f5f9,stroke:#f59e0b,color:#1e293b`}
            />

            <MermaidDiagram
              title="3-Layer 압축 파이프라인"
              titleColor="purple"
              chart={`flowchart LR
    INPUT["Messages<br/><small>원본 대화 입력</small>"] --> L1["Layer 1<br/><small>대용량 출력을 디스크 이동</small>"]
    L1 -->|"대용량 도구 출력\\n→ Cold Storage"| L2["Layer 2<br/><small>오래된 대화 요약 교체</small>"]
    L2 -->|"usage >= 83.5%\\n→ 구조화 요약"| L3["Layer 3<br/><small>중요 파일 다시 읽기</small>"]
    L3 -->|"최근 파일\\n재읽기"| OUTPUT["Optimized<br/><small>최적화된 메시지</small>"]

    style L1 fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
    style L2 fill:#ede9fe,stroke:#ec4899,color:#1e293b
    style L3 fill:#ede9fe,stroke:#06b6d4,color:#1e293b
    style INPUT fill:#f1f5f9,stroke:#64748b,color:#1e293b
    style OUTPUT fill:#dcfce7,stroke:#10b981,color:#1e293b`}
            />
          </section>
        </RevealOnScroll>

        {/* ════════════════════════════════════════════
            Section 3: 레퍼런스
            ════════════════════════════════════════════ */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📖</span> 레퍼런스
            </h2>

            {/* --- ContextManagerConfig --- */}
            <h3
              className="text-[16px] font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              ContextManagerConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              ContextManager를 생성할 때 전달하는 설정 인터페이스입니다. 모든 필드가 선택적이며,
              기본값이 제공됩니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "maxContextTokens",
                  type: "number",
                  required: false,
                  desc: "컨텍스트 윈도우 최대 토큰 수. 기본값: TOKEN_DEFAULTS.maxContextWindow",
                },
                {
                  name: "compactionThreshold",
                  type: "number",
                  required: false,
                  desc: "자동 압축 트리거 비율 (0-1). 기본값: 0.835 (high-tier)",
                },
                {
                  name: "preserveRecentTurns",
                  type: "number",
                  required: false,
                  desc: "압축 시 보존할 최근 턴 수. 기본값: 5",
                },
                {
                  name: "responseReserveRatio",
                  type: "number",
                  required: false,
                  desc: "LLM 응답용 예약 비율. 기본값: AGENT_LOOP.responseReserveRatio",
                },
                {
                  name: "workingDirectory",
                  type: "string",
                  required: false,
                  desc: "DHELIX.md 재로딩을 위한 작업 디렉토리. 기본값: process.cwd()",
                },
                {
                  name: "client",
                  type: "LLMProvider",
                  required: false,
                  desc: "LLM 요약에 사용할 클라이언트. 없으면 로컬 추출 fallback",
                },
                {
                  name: "summaryModel",
                  type: "string",
                  required: false,
                  desc: "요약에 사용할 모델 ID. 기본값: 메인 모델과 동일",
                },
                {
                  name: "sessionId",
                  type: "string",
                  required: false,
                  desc: "콜드 스토리지 디렉토리 스코핑용 세션 ID. 기본값: 'default'",
                },
                {
                  name: "onPreCompact",
                  type: "() => void",
                  required: false,
                  desc: "압축 시작 전 이벤트 콜백 (UI 알림 등)",
                },
                {
                  name: "coldStorageTtlMs",
                  type: "number",
                  required: false,
                  desc: "콜드 스토리지 파일 만료 시간 (ms). 기본값: 24시간",
                },
                {
                  name: "rehydrationStrategy",
                  type: "RehydrationStrategy",
                  required: false,
                  desc: "리하이드레이션 파일 선택 전략. 기본값: 'recency'",
                },
              ]}
            />

            {/* --- ContextUsage --- */}
            <h3
              className="text-[16px] font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              ContextUsage
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              현재 컨텍스트 윈도우 사용량을 나타내는 읽기 전용 인터페이스입니다.
              <code className="text-cyan-600 text-[12px] mx-1">getUsage()</code>가 반환합니다.
            </p>
            <ParamTable
              params={[
                { name: "totalTokens", type: "number", required: true, desc: "현재 전체 토큰 수" },
                {
                  name: "maxTokens",
                  type: "number",
                  required: true,
                  desc: "사용 가능한 최대 토큰 수 (응답 예약분 제외)",
                },
                {
                  name: "usageRatio",
                  type: "number",
                  required: true,
                  desc: "사용률 (totalTokens / maxTokens, 0~1)",
                },
                {
                  name: "messageCount",
                  type: "number",
                  required: true,
                  desc: "메시지 배열의 길이",
                },
              ]}
            />

            {/* --- ColdStorageRef --- */}
            <h3
              className="text-[16px] font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              ColdStorageRef
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              디스크에 저장된 도구 출력에 대한 참조입니다. SHA-256 해시 기반으로 중복 저장을
              방지합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "hash",
                  type: "string",
                  required: true,
                  desc: "콘텐츠의 SHA-256 해시 (앞 16자)",
                },
                {
                  name: "path",
                  type: "string",
                  required: true,
                  desc: "콜드 스토리지 파일의 절대 경로",
                },
                {
                  name: "originalTokens",
                  type: "number",
                  required: true,
                  desc: "원본 콘텐츠의 토큰 수",
                },
              ]}
            />

            {/* --- CompactionResult --- */}
            <h3
              className="text-[16px] font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              CompactionResult
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              압축 작업의 결과를 나타냅니다.
              <code className="text-cyan-600 text-[12px] mx-1">compact()</code> 및
              <code className="text-cyan-600 text-[12px] mx-1">manualCompact()</code>가 반환합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "originalTokens",
                  type: "number",
                  required: true,
                  desc: "압축 전 전체 토큰 수",
                },
                {
                  name: "compactedTokens",
                  type: "number",
                  required: true,
                  desc: "압축 후 전체 토큰 수",
                },
                {
                  name: "removedMessages",
                  type: "number",
                  required: true,
                  desc: "제거된 메시지 수",
                },
                {
                  name: "summary",
                  type: "string",
                  required: true,
                  desc: "구조화된 대화 요약 텍스트",
                },
              ]}
            />

            {/* --- CompactionMetrics --- */}
            <h3
              className="text-[16px] font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              CompactionMetrics
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              누적 압축 메트릭. 관측(observability)용으로 사용되며
              <code className="text-cyan-600 text-[12px] mx-1">getCompactionMetrics()</code>가
              반환합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "compactionCount",
                  type: "number",
                  required: true,
                  desc: "수행된 총 압축 횟수",
                },
                {
                  name: "totalTokensSaved",
                  type: "number",
                  required: true,
                  desc: "절약된 총 토큰 수 (micro + auto)",
                },
                {
                  name: "coldStorageEntries",
                  type: "number",
                  required: true,
                  desc: "현재 콜드 스토리지에 저장된 항목 수",
                },
                {
                  name: "coldStorageSizeBytes",
                  type: "number",
                  required: true,
                  desc: "콜드 스토리지 추정 크기 (bytes)",
                },
                {
                  name: "averageCompressionRatio",
                  type: "number",
                  required: true,
                  desc: "평균 압축 비율 (0~1, 낮을수록 좋음)",
                },
                {
                  name: "lastCompactionAt",
                  type: "string | null",
                  required: true,
                  desc: "마지막 압축 시각 (ISO 8601)",
                },
              ]}
            />

            {/* --- Public Methods --- */}
            <h3
              className="text-[16px] font-bold text-violet-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              Public Methods
            </h3>

            {/* tokenBudget */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-cyan-600">tokenBudget</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">
                  getter
                </span>
              </div>
              <p className="text-[13px] text-gray-600 mb-2">
                응답 예약분을 제외한 실효 토큰 예산을 반환합니다.
              </p>
              <CodeBlock>
                {`get tokenBudget(): number
// = maxContextTokens * (1 - responseReserveRatio)`}
              </CodeBlock>
            </div>

            {/* getUsage */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-cyan-600">getUsage</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  method
                </span>
              </div>
              <p className="text-[13px] text-gray-600 mb-2">
                메시지 배열의 현재 컨텍스트 사용량을 계산합니다.
              </p>
              <CodeBlock>{`getUsage(messages: readonly ChatMessage[]): ContextUsage`}</CodeBlock>
              <ParamTable
                params={[
                  {
                    name: "messages",
                    type: "readonly ChatMessage[]",
                    required: true,
                    desc: "사용량을 측정할 대화 메시지 배열",
                  },
                ]}
              />
            </div>

            {/* needsCompaction */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-cyan-600">needsCompaction</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  method
                </span>
              </div>
              <p className="text-[13px] text-gray-600 mb-2">
                현재 사용량이 압축 임계값을 초과하는지 확인합니다. 내부적으로{" "}
                <code className="text-cyan-600 text-[12px]">getUsage()</code>를 호출하여
                <code className="text-cyan-600 text-[12px]">
                  {" "}
                  usageRatio &gt;= compactionThreshold
                </code>
                를 비교합니다.
              </p>
              <CodeBlock>{`needsCompaction(messages: readonly ChatMessage[]): boolean`}</CodeBlock>
            </div>

            {/* trackFileAccess */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-cyan-600">trackFileAccess</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  method
                </span>
              </div>
              <p className="text-[13px] text-gray-600 mb-2">
                파일 접근을 추적합니다. 리하이드레이션 시 어떤 파일을 다시 읽을지 결정하는 데
                사용됩니다. 최근성(recency)과 빈도(frequency) 모두 업데이트합니다.
              </p>
              <CodeBlock>{`trackFileAccess(filePath: string): void`}</CodeBlock>
            </div>

            {/* prepare */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-cyan-600">prepare</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-600">
                  핵심 메서드
                </span>
              </div>
              <p className="text-[13px] text-gray-600 mb-2">
                LLM에 보내기 전 메시지를 최적화하는{" "}
                <strong className="text-gray-900">진입점</strong>입니다. Layer 1(microcompact) →
                Layer 2(auto-compact, 조건부) → GC(주기적)를 순서대로 실행합니다.
                <strong className="text-gray-900">
                  {" "}
                  입력을 절대 변경하지 않고 새 배열을 반환합니다.
                </strong>
              </p>
              <CodeBlock>
                {`async prepare(
  messages: readonly ChatMessage[]
): Promise<readonly ChatMessage[]>`}
              </CodeBlock>
            </div>

            {/* compact */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-cyan-600">compact</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  method
                </span>
              </div>
              <p className="text-[13px] text-gray-600 mb-2">
                Layer 2 + 3 통합 압축. 시스템 프롬프트를 디스크에서 재로딩하고, 대화를 턴 단위로
                분리하여 오래된 턴을 구조화된 요약으로 교체한 뒤, 리하이드레이션을 수행합니다.
              </p>
              <CodeBlock>
                {`async compact(
  messages: readonly ChatMessage[],
  focusTopic?: string
): Promise<{
  readonly messages: readonly ChatMessage[];
  readonly result: CompactionResult;
}>`}
              </CodeBlock>
              <ParamTable
                params={[
                  {
                    name: "messages",
                    type: "readonly ChatMessage[]",
                    required: true,
                    desc: "압축할 대화 메시지 배열",
                  },
                  {
                    name: "focusTopic",
                    type: "string",
                    required: false,
                    desc: "특정 주제에 집중하여 요약 (예: /compact 'API 설계')",
                  },
                ]}
              />
            </div>

            {/* manualCompact */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-cyan-600">manualCompact</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  method
                </span>
              </div>
              <p className="text-[13px] text-gray-600 mb-2">
                사용자가 <code className="text-cyan-600 text-[12px]">/compact [focus]</code>{" "}
                명령으로 수동 트리거하는 압축입니다. 내부적으로{" "}
                <code className="text-cyan-600 text-[12px]">compact()</code>를 호출합니다.
              </p>
              <CodeBlock>
                {`async manualCompact(
  messages: readonly ChatMessage[],
  focusTopic?: string
): Promise<{ messages; result: CompactionResult }>`}
              </CodeBlock>
            </div>

            {/* microcompact */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-cyan-600">microcompact</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  method
                </span>
              </div>
              <p className="text-[13px] text-gray-600 mb-2">
                Layer 1: 대용량 도구 출력을 콜드 스토리지로 이동합니다. 최근 {String(5)}개의 높은
                우선순위 도구 결과(Hot Tail)는 인라인으로 유지하고, 나머지는 디스크 참조로
                교체합니다.
              </p>
              <CodeBlock>
                {`async microcompact(
  messages: readonly ChatMessage[]
): Promise<readonly ChatMessage[]>`}
              </CodeBlock>
            </div>

            {/* getCompactionMetrics */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-cyan-600">
                  getCompactionMetrics
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  method
                </span>
              </div>
              <p className="text-[13px] text-gray-600 mb-2">
                누적 압축 메트릭을 반환합니다. 압축 횟수, 절약 토큰, 콜드 스토리지 상태, 평균 압축
                비율 등을 확인할 수 있습니다.
              </p>
              <CodeBlock>{`getCompactionMetrics(): CompactionMetrics`}</CodeBlock>
            </div>

            {/* cleanupColdStorage */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-cyan-600">
                  cleanupColdStorage
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  method
                </span>
              </div>
              <p className="text-[13px] text-gray-600 mb-2">
                TTL 초과 또는 고아 상태(orphaned)의 콜드 스토리지 파일을 정리합니다.
                <code className="text-cyan-600 text-[12px] mx-1">prepare()</code>에서 주기적으로
                백그라운드 실행됩니다.
              </p>
              <CodeBlock>{`async cleanupColdStorage(): Promise<CleanupResult>`}</CodeBlock>
            </div>

            {/* trackColdRefAccess */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-cyan-600">
                  trackColdRefAccess
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  method
                </span>
              </div>
              <p className="text-[13px] text-gray-600 mb-2">
                콜드 스토리지 참조의 접근 횟수를 추적합니다. 자주 접근되는 콜드 참조는 Hot Tail에서
                더 높은 우선순위를 받습니다(3회 이상 접근 시 score 60).
              </p>
              <CodeBlock>{`trackColdRefAccess(hash: string): void`}</CodeBlock>
            </div>

            {/* dispose */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-cyan-600">dispose</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  method
                </span>
              </div>
              <p className="text-[13px] text-gray-600 mb-2">
                모든 내부 상태를 초기화하여 메모리 누수를 방지합니다. 세션 종료 시 또는 컨텍스트
                리셋 시 호출합니다.
              </p>
              <CodeBlock>{`dispose(): void`}</CodeBlock>
            </div>

            {/* --- getContextConfig (standalone function) --- */}
            <h3
              className="text-[16px] font-bold text-violet-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              Standalone Functions
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-cyan-600">getContextConfig</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-600">
                  function
                </span>
              </div>
              <p className="text-[13px] text-gray-600 mb-2">
                모델 능력 수준(tier)별 컨텍스트 압축 설정을 반환합니다. 소형 모델은 더 일찍, 더
                공격적으로 압축합니다.
              </p>
              <CodeBlock>
                {`getContextConfig(tier: CapabilityTier): {
  compactionThreshold: number;  // high=0.835, medium=0.75, low=0.65
  preserveRecentTurns: number;  // high=5, medium=4, low=3
}`}
              </CodeBlock>
            </div>

            {/* --- Caveats --- */}
            <h3
              className="text-[16px] font-bold text-red-600"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              Caveats
            </h3>

            <Callout type="warn" icon="&#x26A0;&#xFE0F;">
              <strong>Caveat 1: 요약 품질은 LLM에 의존합니다.</strong>{" "}
              <code className="text-cyan-600 text-[12px]">client</code>가 제공되지 않으면 로컬
              추출(extractive)로 fallback합니다. 로컬 추출은 단순한 텍스트 잘라내기이므로 중요한
              맥락이 손실될 수 있습니다. production에서는 반드시 LLM client를 설정하세요.
            </Callout>

            <Callout type="warn" icon="&#x26A0;&#xFE0F;">
              <strong>Caveat 2: Cold Storage는 로컬 파일 시스템에 의존합니다.</strong> 콜드
              스토리지는
              <code className="text-cyan-600 text-[12px] mx-1">{`\${SESSIONS_DIR}/\${sessionId}/cold-storage/`}</code>
              에 저장됩니다. 이 경로가 접근 불가하거나 디스크 공간이 부족하면, microcompaction이
              실패하고 원본 콘텐츠가 인라인으로 유지됩니다(graceful degradation).
            </Callout>

            <Callout type="warn" icon="&#x26A0;&#xFE0F;">
              <strong>Caveat 3: 리하이드레이션 예산은 전체의 5%입니다.</strong> 압축 후 재읽기에
              사용되는 토큰은 <code className="text-cyan-600 text-[12px]">tokenBudget * 0.05</code>
              로 제한됩니다. 대용량 파일이 여럿이면 일부만 재읽기됩니다. 각 파일도 4000자로
              잘립니다.
            </Callout>

            <Callout type="danger" icon="&#x1F6A8;">
              <strong>Caveat 4: prepare()는 입력을 변경하지 않습니다.</strong> 항상 새 배열을
              반환합니다(immutability). 반환값을 사용하지 않고 원본을 계속 쓰면 압축이 적용되지
              않습니다. 반드시{" "}
              <code className="text-cyan-600 text-[12px]">
                messages = await ctx.prepare(messages)
              </code>
              처럼 재할당하세요.
            </Callout>

            <Callout type="info" icon="&#x1F4A1;">
              <strong>Caveat 5: GC는 best-effort입니다.</strong> 콜드 스토리지 가비지 컬렉션은
              백그라운드에서 실행되며, 실패해도 에러를 던지지 않습니다(swallow). 이는 GC 실패가 주요
              워크플로우를 방해하지 않도록 하기 위한 설계입니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ════════════════════════════════════════════
            Section 4: 사용법
            ════════════════════════════════════════════ */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🚀</span> 사용법
            </h2>

            {/* Basic usage */}
            <h3
              className="text-[15px] font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              1. 기본 사용 - 컨텍스트 상태 확인
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              Agent Loop가 매 턴마다 수행하는 가장 기본적인 작업입니다.
            </p>
            <CodeBlock>
              {`import { ContextManager } from "./context-manager.js";

// 설정과 함께 생성
const ctx = new ContextManager({
  maxContextTokens: 128_000,
  compactionThreshold: 0.835,
  preserveRecentTurns: 5,
  client: llmProvider,         // LLM 요약용
  sessionId: "session-abc123",
  workingDirectory: "/path/to/project",
});

// 현재 사용량 확인
const usage = ctx.getUsage(messages);
console.log(\`사용률: \${(usage.usageRatio * 100).toFixed(1)}%\`);
console.log(\`\${usage.totalTokens} / \${usage.maxTokens} 토큰\`);

// 압축 필요 여부 확인
if (ctx.needsCompaction(messages)) {
  console.log("컨텍스트 압축이 필요합니다!");
}`}
            </CodeBlock>

            {/* prepare() - auto compaction */}
            <h3
              className="text-[15px] font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              2. 자동 압축 트리거 (prepare)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              LLM에 메시지를 보내기 전에{" "}
              <code className="text-cyan-600 text-[12px]">prepare()</code>를 호출하면 Layer 1 ~
              Layer 3가 자동으로 실행됩니다.
            </p>
            <CodeBlock>
              {`// Agent Loop 내부에서의 사용 패턴
async function agentLoop(messages: ChatMessage[]) {
  // 1. 파일 접근 추적 (리하이드레이션에 사용됨)
  ctx.trackFileAccess("/src/core/agent-loop.ts");
  ctx.trackFileAccess("/src/llm/client.ts");

  // 2. prepare() — microcompact + auto-compact + GC
  const optimized = await ctx.prepare(messages);
  //    ^^^^^^^^^
  //    반드시 반환값을 사용해야 합니다!

  // 3. 최적화된 메시지로 LLM 호출
  const response = await llm.chat({
    messages: optimized,
    model: "gpt-4",
  });
}`}
            </CodeBlock>

            <Callout type="warn" icon="&#x26A0;&#xFE0F;">
              <code className="text-cyan-600 text-[12px]">prepare()</code>의 반환값을 무시하면
              압축이 전혀 적용되지 않습니다.
              <code className="text-cyan-600 text-[12px] ml-1">
                messages = await ctx.prepare(messages)
              </code>
              처럼 반드시 재할당하세요.
            </Callout>

            {/* manual compact */}
            <h3
              className="text-[15px] font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              3. 수동 압축 (/compact 명령)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              사용자가 <code className="text-cyan-600 text-[12px]">/compact</code> 명령을 실행하면
              특정 주제에 집중하여 압축할 수 있습니다.
            </p>
            <CodeBlock>
              {`// /compact API 설계 — 특정 주제에 집중하여 압축
const { messages: compacted, result } = await ctx.manualCompact(
  messages,
  "API 설계"  // focusTopic: 이 주제의 맥락을 더 잘 보존
);

console.log(\`\${result.originalTokens} → \${result.compactedTokens} 토큰\`);
console.log(\`\${result.removedMessages}개 메시지 제거\`);
console.log(\`요약:\\n\${result.summary}\`);`}
            </CodeBlock>

            <Callout type="tip" icon="&#x1F4A1;">
              <code className="text-cyan-600 text-[12px]">focusTopic</code>을 지정하면 LLM 요약 시
              해당 주제에 특별히 주의를 기울입니다. 예를 들어
              <code className="text-cyan-600 text-[12px] ml-1">
                /compact &quot;인증 시스템&quot;
              </code>
              을 하면 인증 관련 결정사항과 코드 변경이 요약에 더 잘 보존됩니다.
            </Callout>

            {/* Rehydration */}
            <h3
              className="text-[15px] font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              4. 리하이드레이션 전략 설정
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              압축 후 어떤 파일을 다시 읽을지 결정하는 3가지 전략이 있습니다.
            </p>
            <CodeBlock>
              {`// recency (기본값): 가장 최근 접근한 5개 파일
const ctx1 = new ContextManager({
  rehydrationStrategy: "recency",
});

// frequency: 가장 자주 접근한 5개 파일
const ctx2 = new ContextManager({
  rehydrationStrategy: "frequency",
});

// mixed: 최근 3개 + 빈번 2개 (중복 제거)
const ctx3 = new ContextManager({
  rehydrationStrategy: "mixed",
});`}
            </CodeBlock>

            <Callout type="warn" icon="&#x26A0;&#xFE0F;">
              리하이드레이션은 <code className="text-cyan-600 text-[12px]">trackFileAccess()</code>
              로 추적된 파일만 대상으로 합니다. 이 메서드를 호출하지 않으면 리하이드레이션이 아무
              파일도 읽지 않습니다. Agent Loop에서 도구가 파일을 읽거나 쓸 때마다 호출해야 합니다.
            </Callout>

            <Callout type="warn" icon="&#x26A0;&#xFE0F;">
              삭제되거나 이동된 파일은 리하이드레이션 시 조용히 건너뜁니다(try-catch). 오류 로그가
              남지 않으므로, 파일이 재읽기되지 않았다면 파일 존재 여부를 먼저 확인하세요.
            </Callout>

            {/* Metrics */}
            <h3
              className="text-[15px] font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              5. 메트릭 모니터링
            </h3>
            <CodeBlock>
              {`const metrics = ctx.getCompactionMetrics();
console.log(\`압축 횟수: \${metrics.compactionCount}\`);
console.log(\`절약된 토큰: \${metrics.totalTokensSaved}\`);
console.log(\`콜드 스토리지: \${metrics.coldStorageEntries}개 항목\`);
console.log(\`평균 압축률: \${(metrics.averageCompressionRatio * 100).toFixed(1)}%\`);

// 세션 종료 시 정리
ctx.dispose();`}
            </CodeBlock>

            {/* DeepDive: 83.5% */}
            <DeepDive title="왜 83.5%인가?">
              <div className="space-y-3">
                <p>
                  컨텍스트 압축 임계값 <strong className="text-gray-900">83.5%</strong>는 여러
                  실험과 설계 고려를 통해 결정된 값입니다.
                </p>
                <p>
                  <strong className="text-cyan-600">너무 높으면 (예: 95%)</strong>: 압축이 트리거될
                  때 이미 컨텍스트가 거의 가득 찬 상태입니다. 요약을 생성하기 위한 LLM 호출 자체가
                  컨텍스트 초과를 일으킬 수 있고, 요약 품질도 낮아집니다. 이전 버전에서 실제로 이
                  문제가 발생했습니다 (원래 95%에서 하향 조정).
                </p>
                <p>
                  <strong className="text-cyan-600">너무 낮으면 (예: 50%)</strong>: 불필요하게 자주
                  압축이 실행됩니다. 매번 LLM 요약 호출 비용이 발생하고, 너무 이른 시점에 대화
                  맥락이 손실되어 LLM의 작업 품질이 떨어집니다.
                </p>
                <p>
                  <strong className="text-violet-600">83.5%의 의미</strong>: 응답
                  예약분(responseReserveRatio)을 고려하면, 실효 budget의 83.5%는 전체 윈도우의 약
                  70-75% 정도입니다. 이는 LLM이 충분한 맥락을 유지하면서도 요약 + 리하이드레이션에
                  필요한 여유 공간(약 15-20%)을 확보하는 sweet spot입니다.
                </p>
                <p>
                  <strong className="text-amber-600">모델별 차등 적용</strong>: 소형 모델(medium:
                  75%, low: 65%)은 컨텍스트 윈도우가 작으므로 더 일찍 압축해야 합니다. 보존하는 턴
                  수도 줄여(4턴, 3턴) 각 압축에서 더 공격적으로 공간을 확보합니다.
                </p>
              </div>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ════════════════════════════════════════════
            Section 5: 내부 구현
            ════════════════════════════════════════════ */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>⚙️</span> 내부 구현
            </h2>

            <MermaidDiagram
              title="3-Layer 파이프라인 상세 플로우"
              titleColor="purple"
              chart={`flowchart TD
    START["prepare(messages)<br/><small>메인 진입점 호출</small>"] --> MC["Layer 1: microcompact()<br/><small>대용량 출력 디스크 이동</small>"]
    MC --> MC_CHECK{"tool 메시지 ><br/>HOT_TAIL_SIZE(5)?"}
    MC_CHECK -->|"No"| MC_SKIP["원본 유지<br/><small>압축 불필요</small>"]
    MC_CHECK -->|"Yes"| MC_SCORE["hotTailPriority()<br/><small>도구 결과 중요도 점수화</small>"]
    MC_SCORE --> MC_SPLIT["Hot Tail 분리<br/><small>상위 5개 인라인 유지</small>"]
    MC_SPLIT --> MC_FILTER{"eligible tool?<br/>≥ 200 tokens?"}
    MC_FILTER -->|"No"| MC_KEEP["인라인 유지<br/><small>소형 출력 보존</small>"]
    MC_FILTER -->|"Yes"| MC_COLD["writeColdStorage()<br/><small>SHA-256 해시로 저장</small>"]
    MC_COLD --> MC_REF["참조 메시지로 교체<br/><small>디스크 경로만 남김</small>"]

    MC_SKIP --> L2_CHECK
    MC_KEEP --> L2_CHECK
    MC_REF --> L2_CHECK

    L2_CHECK{"needsCompaction()?<br/>usageRatio ≥ 83.5%?"}
    L2_CHECK -->|"No"| GC_CHECK
    L2_CHECK -->|"Yes"| L2["Layer 2: compact()<br/><small>대화 구조화 요약</small>"]
    L2 --> L2_RELOAD["reloadSystemPrompt()<br/><small>DHELIX.md 최신 로딩</small>"]
    L2_RELOAD --> L2_TURNS["identifyTurns()<br/><small>대화를 턴 단위 분리</small>"]
    L2_TURNS --> L2_SPLIT["턴 분류<br/><small>오래된 턴 요약, 최근 보존</small>"]
    L2_SPLIT --> L2_SUMMARY["summarizeWithFallback()<br/><small>LLM 요약 또는 로컬 추출</small>"]
    L2_SUMMARY --> L3["Layer 3: rehydrate()<br/><small>중요 파일 재읽기</small>"]
    L3 --> L3_SELECT["selectRehydrationFiles()<br/><small>전략별 파일 선택</small>"]
    L3_SELECT --> L3_READ["readFile() x N<br/><small>5% 예산 내 파일 읽기</small>"]
    L3_READ --> GC_CHECK

    GC_CHECK{"GC 주기<br/>도달?"}
    GC_CHECK -->|"No"| DONE["최적화된 messages 반환<br/><small>LLM에 전달 준비 완료</small>"]
    GC_CHECK -->|"Yes"| GC["cleanupColdStorage()<br/><small>만료 파일 백그라운드 정리</small>"]
    GC --> DONE

    style START fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
    style MC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
    style L2 fill:#ede9fe,stroke:#ec4899,color:#1e293b
    style L3 fill:#ede9fe,stroke:#06b6d4,color:#1e293b
    style GC fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
    style DONE fill:#dcfce7,stroke:#10b981,color:#1e293b
    style MC_SCORE fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
    style MC_COLD fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
    style L2_RELOAD fill:#f1f5f9,stroke:#ec4899,color:#1e293b
    style L2_SUMMARY fill:#f1f5f9,stroke:#ec4899,color:#1e293b
    style L3_SELECT fill:#f1f5f9,stroke:#06b6d4,color:#1e293b`}
            />

            {/* State variables table */}
            <h3 className="text-[15px] font-bold text-gray-900 mt-8 mb-4">내부 상태 변수</h3>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden my-4">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      변수
                    </th>
                    <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      타입
                    </th>
                    <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      용도
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      name: "coldRefs",
                      type: "Map<string, ColdStorageRef>",
                      desc: "해시 → 콜드 스토리지 참조. 리하이드레이션 및 GC에 사용",
                    },
                    {
                      name: "recentFiles",
                      type: "string[]",
                      desc: "최근 접근 파일 경로 (최대 10개). recency 리하이드레이션에 사용",
                    },
                    {
                      name: "fileAccessFrequency",
                      type: "Map<string, number>",
                      desc: "파일별 접근 횟수. frequency 리하이드레이션에 사용",
                    },
                    {
                      name: "coldRefAccessCount",
                      type: "Map<string, number>",
                      desc: "콜드 참조 재접근 횟수. Hot Tail 우선순위에 영향",
                    },
                    {
                      name: "compactionCount",
                      type: "number",
                      desc: "총 압축 횟수. 경계 마커(boundary marker)에 표시",
                    },
                    {
                      name: "totalTokensSaved",
                      type: "number",
                      desc: "micro + auto 압축으로 절약된 총 토큰 수",
                    },
                    {
                      name: "totalCompressionRatios",
                      type: "number[]",
                      desc: "각 압축의 비율(compacted/original). 평균 계산용",
                    },
                    {
                      name: "lastCompactionAt",
                      type: "string | null",
                      desc: "마지막 압축 시각 (ISO 8601 형식)",
                    },
                    {
                      name: "lastGcCompactionCount",
                      type: "number",
                      desc: "마지막 GC 실행 시점의 compactionCount. 적응적 GC 간격 계산용",
                    },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50 border-b border-gray-200">
                      <td className="p-3 px-4 font-mono text-cyan-600 font-semibold text-[12px]">
                        {row.name}
                      </td>
                      <td className="p-3 px-4 font-mono text-violet-600 text-[11px]">{row.type}</td>
                      <td className="p-3 px-4 text-gray-600">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Hot Tail Priority */}
            <h3
              className="text-[15px] font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              Hot Tail 우선순위 스코어링
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              Microcompaction에서 어떤 도구 결과를 인라인으로 유지할지 결정하는 우선순위
              시스템입니다. 점수가 높을수록 인라인 유지 우선순위가 높습니다.
            </p>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden my-4">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      점수
                    </th>
                    <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      조건
                    </th>
                    <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      이유
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      score: "100",
                      cond: "에러 결과 (Error:, STDERR:, error:)",
                      reason: "디버깅 컨텍스트는 항상 보존해야 함",
                    },
                    {
                      score: "80",
                      cond: "쓰기 도구 (file_edit, file_write)",
                      reason: "파일 변경(mutation) 맥락은 중요",
                    },
                    {
                      score: "60",
                      cond: "자주 재접근된 콜드 참조 (>2회)",
                      reason: "반복 접근은 중요도가 높다는 신호",
                    },
                    {
                      score: "40",
                      cond: "기타 도구 결과 (reads, searches)",
                      reason: "기본 우선순위",
                    },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50 border-b border-gray-200">
                      <td className="p-3 px-4 font-mono text-amber-600 font-bold">{row.score}</td>
                      <td className="p-3 px-4 text-gray-900">{row.cond}</td>
                      <td className="p-3 px-4 text-gray-600">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Key code excerpt */}
            <h3
              className="text-[15px] font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              핵심 코드: prepare() 진입점
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              Agent Loop가 호출하는 메인 진입점입니다. 3개 Layer와 GC를 순서대로 조율합니다.
            </p>
            <CodeBlock>
              {`/**
 * Prepare messages for the LLM by applying microcompaction
 * and auto-compaction. Layer 1 runs first (continuous),
 * then Layer 2 checks threshold.
 * Periodically triggers cold storage garbage collection.
 * Returns a new message array (never mutates input).
 */
async prepare(
  messages: readonly ChatMessage[]
): Promise<readonly ChatMessage[]> {
  // Layer 1: Microcompaction (continuous, always runs)
  let result = await this.microcompact(messages);

  // Layer 2: Auto-compaction (threshold-based)
  if (this.needsCompaction(result)) {
    const { messages: compacted } = await this.compact(result);
    result = [...compacted];
  }

  // Periodic cold storage garbage collection (adaptive interval)
  const gcInterval = this.getAdaptiveGcInterval(result);
  if (
    this.compactionCount > 0 &&
    this.compactionCount - this.lastGcCompactionCount >= gcInterval
  ) {
    this.lastGcCompactionCount = this.compactionCount;
    // Run GC in the background — don't block prepare()
    this.cleanupColdStorage().catch(() => {
      // Swallow GC errors — cleanup is best-effort
    });
  }

  return result;
}`}
            </CodeBlock>

            {/* Adaptive GC */}
            <h3
              className="text-[15px] font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              적응적 GC 간격
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              컨텍스트 사용량과 콜드 스토리지 크기에 따라 GC 주기를 자동 조절합니다.
            </p>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden my-4">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      조건
                    </th>
                    <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      GC 간격
                    </th>
                    <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      의미
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      cond: "usage > 80% OR coldStorage > 100개",
                      interval: "1",
                      meaning: "매 압축마다 GC (높은 압박)",
                    },
                    {
                      cond: "usage 50-80% OR coldStorage > 50개",
                      interval: "5",
                      meaning: "5회 압축마다 GC (중간)",
                    },
                    { cond: "그 외", interval: "15", meaning: "15회 압축마다 GC (여유)" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50 border-b border-gray-200">
                      <td className="p-3 px-4 text-gray-900">{row.cond}</td>
                      <td className="p-3 px-4 font-mono text-amber-600 font-bold">
                        {row.interval}
                      </td>
                      <td className="p-3 px-4 text-gray-600">{row.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Constants */}
            <h3
              className="text-[15px] font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              모듈 상수
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden my-4">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      상수
                    </th>
                    <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      값
                    </th>
                    <th className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                      설명
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      name: "COLD_STORAGE_ELIGIBLE_TOOLS",
                      val: "file_read, bash_exec, grep_search, glob_search",
                      desc: "콜드 스토리지 대상 도구 (대용량 읽기 전용)",
                    },
                    {
                      name: "COLD_STORAGE_MIN_TOKENS",
                      val: "200",
                      desc: "이 이하의 도구 출력은 인라인 유지",
                    },
                    { name: "HOT_TAIL_SIZE", val: "5", desc: "인라인 유지할 최근 도구 결과 수" },
                    { name: "REHYDRATION_FILE_COUNT", val: "5", desc: "압축 후 재읽기할 파일 수" },
                    {
                      name: "COLD_STORAGE_TTL_MS",
                      val: "86,400,000 (24h)",
                      desc: "콜드 스토리지 파일 기본 만료 시간",
                    },
                    {
                      name: "WRITE_TOOLS",
                      val: "file_edit, file_write",
                      desc: "Hot Tail에서 높은 우선순위를 받는 쓰기 도구",
                    },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50 border-b border-gray-200">
                      <td className="p-3 px-4 font-mono text-cyan-600 font-semibold text-[12px]">
                        {row.name}
                      </td>
                      <td className="p-3 px-4 font-mono text-amber-600 text-[12px]">{row.val}</td>
                      <td className="p-3 px-4 text-gray-600">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </RevealOnScroll>

        {/* ════════════════════════════════════════════
            Section 6: 트러블슈팅
            ════════════════════════════════════════════ */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔧</span> 트러블슈팅
            </h2>

            <div className="space-y-4">
              {/* FAQ 1 */}
              <DeepDive title="컨텍스트 오버플로우 (Context Overflow)가 발생합니다">
                <div className="space-y-2">
                  <p>
                    <strong className="text-gray-900">증상</strong>: LLM API가 &quot;context length
                    exceeded&quot; 에러를 반환합니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인</strong>:
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>
                      <code className="text-cyan-600 text-[12px]">prepare()</code>를 호출하지 않고
                      원본 메시지를 LLM에 전달한 경우
                    </li>
                    <li>
                      <code className="text-cyan-600 text-[12px]">prepare()</code>의 반환값을
                      사용하지 않는 경우
                    </li>
                    <li>
                      <code className="text-cyan-600 text-[12px]">maxContextTokens</code> 설정이
                      실제 모델 한도보다 높게 설정된 경우
                    </li>
                    <li>
                      단일 메시지가 전체 budget의 83.5%를 초과하는 경우 (압축해도 줄일 수 없음)
                    </li>
                  </ul>
                  <p>
                    <strong className="text-gray-900">해결</strong>:
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>
                      <code className="text-cyan-600 text-[12px]">
                        messages = await ctx.prepare(messages)
                      </code>
                      로 반환값을 재할당하세요
                    </li>
                    <li>
                      <code className="text-cyan-600 text-[12px]">getUsage()</code>로 현재 사용량을
                      확인하세요
                    </li>
                    <li>
                      <code className="text-cyan-600 text-[12px]">maxContextTokens</code>를 모델의
                      실제 한도에 맞추세요
                    </li>
                  </ul>
                </div>
              </DeepDive>

              {/* FAQ 2 */}
              <DeepDive title="자동 압축이 트리거되지 않습니다">
                <div className="space-y-2">
                  <p>
                    <strong className="text-gray-900">증상</strong>: 대화가 길어져도 압축이 실행되지
                    않습니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인</strong>:
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>
                      <code className="text-cyan-600 text-[12px]">compactionThreshold</code>가 1.0
                      이상으로 설정된 경우 (사실상 비활성화)
                    </li>
                    <li>
                      <code className="text-cyan-600 text-[12px]">maxContextTokens</code>가 실제보다
                      매우 크게 설정되어 usageRatio가 항상 낮은 경우
                    </li>
                    <li>
                      Microcompaction이 도구 출력을 효율적으로 정리하여 임계값에 도달하지 않는 경우
                      (정상 동작)
                    </li>
                  </ul>
                  <p>
                    <strong className="text-gray-900">확인 방법</strong>:
                  </p>
                  <CodeBlock>
                    {`const usage = ctx.getUsage(messages);
console.log(\`사용률: \${(usage.usageRatio * 100).toFixed(1)}%\`);
console.log(\`임계값: \${(ctx['compactionThreshold'] * 100).toFixed(1)}%\`);
// 사용률이 임계값 미만이면 정상 동작입니다.`}
                  </CodeBlock>
                </div>
              </DeepDive>

              {/* FAQ 3 */}
              <DeepDive title="콜드 스토리지 디스크 공간 문제">
                <div className="space-y-2">
                  <p>
                    <strong className="text-gray-900">증상</strong>: 콜드 스토리지 디렉토리가
                    비정상적으로 커집니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인</strong>:
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>GC가 실행되기 전에 세션이 자주 종료되는 경우</li>
                    <li>
                      <code className="text-cyan-600 text-[12px]">coldStorageTtlMs</code>가 너무
                      길게 설정된 경우
                    </li>
                    <li>대용량 도구 출력이 매우 빈번한 워크플로우</li>
                  </ul>
                  <p>
                    <strong className="text-gray-900">해결</strong>:
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>
                      <code className="text-cyan-600 text-[12px]">
                        await ctx.cleanupColdStorage()
                      </code>
                      를 수동으로 호출하세요
                    </li>
                    <li>
                      <code className="text-cyan-600 text-[12px]">coldStorageTtlMs</code>를 줄이세요
                      (예: 4시간 = 14,400,000ms)
                    </li>
                    <li>
                      세션 종료 시 <code className="text-cyan-600 text-[12px]">ctx.dispose()</code>
                      를 호출하고, 콜드 스토리지 디렉토리를 정리하세요
                    </li>
                  </ul>
                </div>
              </DeepDive>

              {/* FAQ 4 */}
              <DeepDive title="압축 후 LLM이 이전 맥락을 잊어버립니다">
                <div className="space-y-2">
                  <p>
                    <strong className="text-gray-900">증상</strong>: 압축 후 LLM이 이전에 논의한
                    내용을 기억하지 못합니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인</strong>:
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>
                      <code className="text-cyan-600 text-[12px]">client</code>가 설정되지 않아 로컬
                      추출(extractive) 요약이 사용된 경우 - 로컬 추출은 단순 잘라내기이므로 중요
                      맥락 손실 가능
                    </li>
                    <li>
                      <code className="text-cyan-600 text-[12px]">preserveRecentTurns</code>가 너무
                      작은 경우 (직전 맥락 부족)
                    </li>
                    <li>리하이드레이션 파일이 현재 작업과 관련 없는 파일인 경우</li>
                  </ul>
                  <p>
                    <strong className="text-gray-900">해결</strong>:
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>
                      반드시 <code className="text-cyan-600 text-[12px]">client</code>(LLM
                      provider)를 설정하여 LLM 기반 요약을 활성화하세요
                    </li>
                    <li>
                      <code className="text-cyan-600 text-[12px]">preserveRecentTurns</code>를 5
                      이상으로 유지하세요
                    </li>
                    <li>
                      <code className="text-cyan-600 text-[12px]">
                        rehydrationStrategy: &quot;mixed&quot;
                      </code>
                      를 사용하여 최근 + 빈번 파일을 모두 재읽기하세요
                    </li>
                    <li>
                      <code className="text-cyan-600 text-[12px]">/compact &quot;주제&quot;</code>로
                      중요한 주제를 명시하여 수동 압축하세요
                    </li>
                  </ul>
                </div>
              </DeepDive>

              {/* FAQ 5 */}
              <DeepDive title="리하이드레이션이 작동하지 않습니다">
                <div className="space-y-2">
                  <p>
                    <strong className="text-gray-900">증상</strong>: 압축 후 파일
                    재읽기(rehydration) 시스템 메시지가 추가되지 않습니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인</strong>:
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>
                      <code className="text-cyan-600 text-[12px]">trackFileAccess()</code>가
                      호출되지 않아 추적된 파일이 없는 경우
                    </li>
                    <li>
                      추적된 모든 파일이 삭제/이동되어 readFile이 실패하는 경우 (조용히 건너뜀)
                    </li>
                    <li>리하이드레이션 budget(5%)이 이미 소진된 경우</li>
                  </ul>
                  <p>
                    <strong className="text-gray-900">확인 방법</strong>:
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>
                      도구가 파일에 접근할 때마다{" "}
                      <code className="text-cyan-600 text-[12px]">
                        ctx.trackFileAccess(filePath)
                      </code>
                      를 호출하는지 확인하세요
                    </li>
                    <li>
                      압축 후 메시지 배열의 마지막 system 메시지에 &quot;[Post-compaction
                      rehydration]&quot; 마커가 있는지 확인하세요
                    </li>
                    <li>추적된 파일의 존재 여부를 확인하세요</li>
                  </ul>
                </div>
              </DeepDive>
            </div>
          </section>
        </RevealOnScroll>

        {/* ════════════════════════════════════════════
            Section 7: 관련 문서
            ════════════════════════════════════════════ */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔗</span> 관련 문서
            </h2>

            <SeeAlso
              items={[
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "ContextManager를 호출하는 메인 ReAct 루프. prepare()를 매 턴마다 호출합니다.",
                },
                {
                  name: "token-counter.ts",
                  slug: "token-counter",
                  relation: "child",
                  desc: "countTokens(), countMessageTokens() — ContextManager가 사용량 계산에 의존합니다.",
                },
                {
                  name: "system-prompt-builder.ts",
                  slug: "system-prompt-builder",
                  relation: "sibling",
                  desc: "압축 시 시스템 프롬프트 재구성. reloadSystemPrompt()가 내부적으로 호출합니다.",
                },
                {
                  name: "recovery-executor.ts",
                  slug: "recovery-executor",
                  relation: "sibling",
                  desc: "에러 복구 시 compact 전략을 사용할 수 있습니다. ContextManager와 협력합니다.",
                },
                {
                  name: "llm/client.ts",
                  slug: "llm-client",
                  relation: "child",
                  desc: "LLM 기반 요약에 사용되는 LLMProvider. summarizeWithLLM()이 호출합니다.",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
