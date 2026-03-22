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

/* ───────────────────────────── Data ───────────────────────────── */

const agentLoopConfigParams = [
  { name: "client", type: "LLMProvider", required: true, desc: "LLM API 클라이언트 (OpenAI, Anthropic 등). chat() / stream() 메서드를 제공해야 합니다." },
  { name: "model", type: "string", required: true, desc: "사용할 LLM 모델명 (예: 'gpt-4o', 'claude-sonnet-4-20250514'). dual-model 라우팅 시 기본 모델로 사용됩니다." },
  { name: "toolRegistry", type: "ToolRegistry", required: true, desc: "등록된 도구 목록을 관리하는 레지스트리. Hot Tools + Deferred Loading 모드를 지원합니다." },
  { name: "strategy", type: "ToolCallStrategy", required: true, desc: "도구 호출 전략 (네이티브 함수 호출 / 텍스트 파싱). 요청 준비와 응답 파싱을 담당합니다." },
  { name: "events", type: "AppEventEmitter", required: true, desc: "이벤트 이미터 -- UI에 진행 상황(llm:start, tool:complete, agent:iteration 등)을 알리는 데 사용됩니다." },
  { name: "maxIterations", type: "number", required: false, desc: "최대 반복 횟수. 기본값: AGENT_LOOP.maxIterations (constants.ts). 서킷 브레이커와 함께 무한 루프를 방지합니다." },
  { name: "temperature", type: "number", required: false, desc: "LLM 응답의 창의성 수준 (0 = 결정적, 1 = 창의적). 기본값: 0." },
  { name: "maxTokens", type: "number", required: false, desc: "LLM 응답의 최대 토큰 수. 기본값: 4096." },
  { name: "signal", type: "AbortSignal", required: false, desc: "취소 신호. 사용자가 Esc를 누르면 전파되어 루프가 즉시 중단됩니다." },
  { name: "workingDirectory", type: "string", required: false, desc: "작업 디렉토리 경로. 도구 실행 시 CWD로 사용됩니다." },
  { name: "checkPermission", type: "(call: ExtractedToolCall) => Promise<PermissionResult>", required: false, desc: "도구 호출 전 권한 확인 콜백. 2회 이상 거절되면 해당 도구 사용 중단을 LLM에 지시합니다." },
  { name: "maxRetries", type: "number", required: false, desc: "LLM 호출 재시도 횟수. 기본값: 2. transient 에러에만 적용됩니다." },
  { name: "useStreaming", type: "boolean", required: false, desc: "스트리밍 모드 활성화. true이면 텍스트 델타를 실시간으로 UI에 전달합니다." },
  { name: "maxContextTokens", type: "number", required: false, desc: "컨텍스트 윈도우 최대 토큰 수. 설정 시 auto-compaction이 활성화됩니다." },
  { name: "maxToolResultChars", type: "number", required: false, desc: "개별 도구 결과의 최대 문자 수. 기본값: 12,000." },
  { name: "maxToolResultTokens", type: "number", required: false, desc: "개별 도구 결과의 최대 토큰 수. 설정 시 문자 기반 대신 토큰 기반 잘라내기를 사용합니다." },
  { name: "enableGuardrails", type: "boolean", required: false, desc: "보안 가드레일 활성화 여부. 기본값: true. false로 설정하면 입출력 가드레일을 건너뜁니다." },
  { name: "checkpointManager", type: "CheckpointManager", required: false, desc: "자동 체크포인트 매니저. 파일 수정 전 백업 스냅샷을 생성합니다." },
  { name: "sessionId", type: "string", required: false, desc: "세션 ID. 체크포인트 메타데이터와 컨텍스트 매니저에서 사용됩니다." },
  { name: "thinking", type: "ThinkingConfig", required: false, desc: "Extended thinking 설정 (Claude 모델용). 내부 추론 토큰 예산을 제어합니다." },
  { name: "dualModelRouter", type: "DualModelRouter", required: false, desc: "이중 모델 라우터. Architect/Editor 패턴으로 반복마다 모델을 자동 전환합니다." },
  { name: "isSubagent", type: "boolean", required: false, desc: "서브에이전트 모드 여부. true이면 초기 반복에서 도구 호출이 없을 때 자동으로 nudge 메시지를 주입합니다." },
];

const seeAlsoItems = [
  { name: "context-manager.ts", slug: "context-manager", relation: "sibling" as const, desc: "3-Layer 토큰 관리 -- Agent Loop가 매 반복 시작 시 prepare()를 호출하여 compaction을 수행합니다." },
  { name: "circuit-breaker.ts", slug: "circuit-breaker", relation: "sibling" as const, desc: "무한 루프 방지 -- Agent Loop가 매 반복 끝에 recordIteration()을 호출합니다." },
  { name: "recovery-executor.ts", slug: "recovery-executor", relation: "sibling" as const, desc: "에러 유형별 복구 전략 -- LLM 호출 실패 시 findRecoveryStrategy()로 복구를 시도합니다." },
  { name: "tools/executor.ts", slug: "tool-executor", relation: "child" as const, desc: "도구 실행 파이프라인 -- Agent Loop가 executeToolCall()을 호출하여 개별 도구를 실행합니다." },
  { name: "permissions/manager.ts", slug: "permission-manager", relation: "child" as const, desc: "5단계 권한 결정 -- checkPermission 콜백을 통해 도구 실행 전 권한을 확인합니다." },
  { name: "llm/client.ts", slug: "llm-client", relation: "child" as const, desc: "LLM API 클라이언트 -- Agent Loop가 chat()/stream()을 호출하여 LLM과 통신합니다." },
  { name: "observation-masking.ts", slug: "observation-masking", relation: "sibling" as const, desc: "도구 출력 마스킹 -- 재생성 가능한 도구 출력을 마스킹하여 컨텍스트를 절약합니다." },
];

/* ───────────────────────────── Page ───────────────────────────── */

export default function AgentLoopPage() {
  return (
    <div className="min-h-screen pt-[100px] pb-20">
      <div className="max-w-[900px] mx-auto px-4 sm:px-8">

        {/* ═══════ 1. Header ═══════ */}
        <RevealOnScroll>
          <div className="mb-14">
            <FilePath path="src/core/agent-loop.ts" />
            <h1 className="text-[clamp(32px,5vw,52px)] font-black tracking-tight leading-[1.1] mt-4 mb-3">
              <span className="bg-gradient-to-r from-accent-purple to-accent-pink bg-clip-text text-transparent">
                Agent Loop
              </span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="core" />
              <span className="text-[13px] text-text-muted">|</span>
              <span className="text-[14px] text-text-secondary">
                dbcode의 심장 -- ReAct 패턴 메인 실행 루프
              </span>
            </div>
            <p className="text-[15px] text-text-secondary leading-relaxed max-w-[720px]">
              사용자의 질문을 받아 LLM을 호출하고, 응답에서 도구 호출을 추출하여 실행한 뒤,
              그 결과를 다시 LLM에게 전달하는 과정을 <strong className="text-text-primary">도구 호출이 없을 때까지 반복</strong>합니다.
              이 모듈이 없으면 dbcode는 단순한 챗봇에 불과합니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ═══════ 2. 개요 ═══════ */}
        <RevealOnScroll>
          <section className="mb-16">
            <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2">
              <span>{"🧠"}</span> 개요 -- ReAct 패턴이란?
            </h2>

            <div className="text-[14px] text-text-secondary leading-[1.85] space-y-4 mb-8">
              <p>
                <strong className="text-accent-cyan">ReAct (Reasoning + Acting)</strong>는 LLM이 단순히 텍스트를 생성하는 것을 넘어,
                <span className="text-text-primary font-semibold"> 사고(Reasoning)</span>와
                <span className="text-text-primary font-semibold"> 행동(Acting)</span>을 번갈아 수행하는 패턴입니다.
              </p>
              <p>
                일반적인 챗봇은 질문에 대해 텍스트로만 답변합니다. 하지만 ReAct 에이전트는 "파일을 읽어야겠다"고 판단(Reasoning)하면
                실제로 <span className="font-mono text-accent-cyan text-[13px]">file_read</span> 도구를 호출(Acting)하고,
                그 결과를 바탕으로 다시 사고하여 다음 행동을 결정합니다.
              </p>
              <p>
                Agent Loop는 이 ReAct 사이클의 <strong className="text-text-primary">메인 while 루프</strong>를 구현합니다.
                매 반복(iteration)마다 다음 단계를 거칩니다:
              </p>
              <ol className="list-decimal list-inside space-y-1 pl-2 text-text-secondary">
                <li><strong className="text-text-primary">Context Prepare</strong> -- Observation Masking + Auto-compaction으로 토큰 예산 관리</li>
                <li><strong className="text-text-primary">LLM Call</strong> -- 스트리밍/비스트리밍 모드로 LLM 호출 (재시도 로직 포함)</li>
                <li><strong className="text-text-primary">Output Parse</strong> -- 응답에서 도구 호출 추출 + 유효성 검증</li>
                <li><strong className="text-text-primary">Permission Check</strong> -- 보안 가드레일 + 사용자 권한 확인</li>
                <li><strong className="text-text-primary">Tool Execution</strong> -- 병렬/순차 그룹화 후 도구 실행</li>
                <li><strong className="text-text-primary">Circuit Check</strong> -- 무한 루프 감지 + 진행 상황 추적</li>
              </ol>
            </div>

            <MermaidDiagram
              title="Agent Loop 의존성 맵"
              titleColor="purple"
              chart={`graph TD
    AL[Agent Loop<br/>ReAct 메인 루프]

    subgraph DEPS["직접 의존하는 모듈들"]
      LLM["LLMProvider<br/>chat() / stream()"]
      TOOLS["ToolRegistry<br/>도구 등록/조회"]
      EXEC["executeToolCall<br/>도구 실행"]
      PERM["checkPermission<br/>권한 확인"]
      CTX["ContextManager<br/>토큰 관리"]
      CB["CircuitBreaker<br/>무한 루프 방지"]
      REC["RecoveryExecutor<br/>에러 복구"]
      GUARD["Guardrails<br/>입출력 보안"]
      OBS["ObservationMasking<br/>도구 출력 마스킹"]
      CP["CheckpointManager<br/>파일 백업"]
      DUAL["DualModelRouter<br/>모델 자동 전환"]
      STREAM["consumeStream<br/>스트림 소비"]
    end

    AL --> LLM
    AL --> TOOLS
    AL --> EXEC
    AL --> PERM
    AL --> CTX
    AL --> CB
    AL --> REC
    AL --> GUARD
    AL --> OBS
    AL --> CP
    AL --> DUAL
    AL --> STREAM

    style AL fill:#8b5cf6,stroke:#a78bfa,color:#fff,stroke-width:2px
    style LLM fill:#3b82f6,stroke:#60a5fa,color:#fff
    style TOOLS fill:#10b981,stroke:#34d399,color:#fff
    style EXEC fill:#10b981,stroke:#34d399,color:#fff
    style PERM fill:#f59e0b,stroke:#fbbf24,color:#1a1a2e
    style CTX fill:#8b5cf6,stroke:#a78bfa,color:#fff
    style CB fill:#8b5cf6,stroke:#a78bfa,color:#fff
    style REC fill:#8b5cf6,stroke:#a78bfa,color:#fff
    style GUARD fill:#ef4444,stroke:#f87171,color:#fff
    style OBS fill:#8b5cf6,stroke:#a78bfa,color:#fff
    style CP fill:#8b5cf6,stroke:#a78bfa,color:#fff
    style DUAL fill:#3b82f6,stroke:#60a5fa,color:#fff
    style STREAM fill:#3b82f6,stroke:#60a5fa,color:#fff`}
            />

            <Callout type="info" icon="💡">
              <strong>왜 Agent Loop가 "심장"인가?</strong> -- dbcode의 모든 기능은 이 루프를 통해 실행됩니다.
              파일 편집, 터미널 명령, 검색 등 모든 도구 호출은 Agent Loop의 한 반복(iteration) 안에서 일어납니다.
              이 모듈을 이해하면 dbcode의 전체 실행 흐름을 파악할 수 있습니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ═══════ 3. 레퍼런스 ═══════ */}
        <RevealOnScroll>
          <section className="mb-16">
            <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2">
              <span>{"📋"}</span> 레퍼런스
            </h2>

            {/* AgentLoopConfig */}
            <h3 className="text-lg font-bold text-accent-cyan mb-3 font-mono">AgentLoopConfig</h3>
            <p className="text-[14px] text-text-secondary mb-4">
              루프의 동작을 제어하는 모든 옵션을 담고 있는 인터페이스입니다.
              LLM 클라이언트, 도구 레지스트리, 이벤트 이미터 등 <strong className="text-text-primary">5개의 필수 의존성</strong>과
              <strong className="text-text-primary">17개의 선택적 설정</strong>을 포함합니다.
            </p>
            <ParamTable params={agentLoopConfigParams} />

            <Callout type="warn" icon="⚠️">
              <strong>maxContextTokens를 설정하지 않으면</strong> auto-compaction이 비활성화됩니다.
              긴 대화에서 컨텍스트 윈도우를 초과하면 LLM이 "Request too large" 에러를 반환합니다.
              반드시 모델의 컨텍스트 윈도우보다 약간 작은 값(예: 80%)으로 설정하세요.
            </Callout>

            {/* AgentLoopResult */}
            <h3 className="text-lg font-bold text-accent-cyan mt-10 mb-3 font-mono">AgentLoopResult</h3>
            <p className="text-[14px] text-text-secondary mb-4">
              <span className="font-mono text-accent-purple text-[13px]">runAgentLoop()</span>의 반환값입니다.
              전체 대화 내역, 반복 횟수, 중단 여부, 토큰 사용량을 포함합니다.
            </p>
            <ParamTable params={[
              { name: "messages", type: "readonly ChatMessage[]", required: true, desc: "전체 대화 메시지 배열. 초기 메시지 + 루프 중 생성된 assistant/tool 메시지를 모두 포함합니다." },
              { name: "iterations", type: "number", required: true, desc: "실행된 반복 횟수. 서킷 브레이커나 max-iterations에 의해 중단된 경우 마지막 반복 번호입니다." },
              { name: "aborted", type: "boolean", required: true, desc: "사용자에 의해 중단(Esc)되었는지 여부. true이면 signal.aborted에 의한 조기 종료입니다." },
              { name: "usage", type: "AggregatedUsage", required: false, desc: "토큰 사용량 통계. 전체 프롬프트/응답 토큰, 반복 횟수, 도구 호출 수, 재시도 횟수를 포함합니다." },
            ]} />

            {/* AggregatedUsage */}
            <h3 className="text-lg font-bold text-accent-cyan mt-10 mb-3 font-mono">AggregatedUsage</h3>
            <p className="text-[14px] text-text-secondary mb-4">
              전체 루프 실행에 걸쳐 누적된 토큰 사용량과 실행 메트릭입니다.
              내부적으로는 <span className="font-mono text-accent-purple text-[13px]">UsageAggregator</span> 클래스가
              가변(mutable) 상태로 관리하지만, 외부에는 <span className="font-mono text-[13px]">snapshot()</span>을 통해 불변 스냅샷만 제공합니다.
            </p>
            <ParamTable params={[
              { name: "totalPromptTokens", type: "number", required: true, desc: "전체 입력(프롬프트) 토큰 수" },
              { name: "totalCompletionTokens", type: "number", required: true, desc: "전체 출력(응답) 토큰 수" },
              { name: "totalTokens", type: "number", required: true, desc: "전체 토큰 수 (입력 + 출력)" },
              { name: "iterationCount", type: "number", required: true, desc: "루프 반복 횟수" },
              { name: "toolCallCount", type: "number", required: true, desc: "실행된 도구 호출 총 수" },
              { name: "retriedCount", type: "number", required: true, desc: "재시도 횟수" },
            ]} />

            {/* classifyLLMError */}
            <h3 className="text-lg font-bold text-accent-cyan mt-10 mb-3 font-mono">classifyLLMError(error)</h3>
            <p className="text-[14px] text-text-secondary mb-4">
              LLM 에러를 분류하여 재시도 전략을 결정합니다. 에러 메시지의 키워드를 분석하여 3가지 유형으로 분류합니다:
            </p>
            <div className="bg-bg-card border border-border rounded-xl p-5 mb-4">
              <div className="space-y-3 text-[13px]">
                <div className="flex gap-3">
                  <span className="font-mono text-accent-green font-bold shrink-0">{'"transient"'}</span>
                  <span className="text-text-secondary">일시적 에러 (timeout, ECONNRESET, 500, 502, 504, network). 지수 백오프로 재시도합니다.</span>
                </div>
                <div className="flex gap-3">
                  <span className="font-mono text-accent-orange font-bold shrink-0">{'"overload"'}</span>
                  <span className="text-text-secondary">과부하 에러 (429, 503, rate limit, capacity). 클라이언트가 이미 Retry-After로 재시도했으므로 추가 재시도하지 않습니다.</span>
                </div>
                <div className="flex gap-3">
                  <span className="font-mono text-accent-red font-bold shrink-0">{'"permanent"'}</span>
                  <span className="text-text-secondary">영구적 에러 (Request too large, too many tokens, 기타). 재시도해도 소용없으므로 즉시 실패합니다.</span>
                </div>
              </div>
            </div>

            <Callout type="danger" icon="🚨">
              <strong>주의: "Request too large"는 permanent입니다.</strong> --
              이 에러가 발생하면 동일한 페이로드로 재시도해도 실패합니다.
              <span className="font-mono text-[12px]">maxContextTokens</span>를 설정하여 auto-compaction을 활성화하거나,
              <span className="font-mono text-[12px]">maxToolResultChars</span>/<span className="font-mono text-[12px]">maxToolResultTokens</span>를 줄여야 합니다.
            </Callout>

            <Callout type="info" icon="📌">
              <strong>PermissionResult 인터페이스</strong> --
              <span className="font-mono text-[13px]">checkPermission</span> 콜백의 반환값입니다.
              <span className="font-mono text-accent-cyan text-[13px]">{`{ allowed: boolean, reason?: string }`}</span> 형태이며,
              <span className="font-mono text-[13px]">allowed: false</span>일 때 거부 사유를 LLM에 전달합니다.
              같은 도구가 2회 이상 거절되면 "이 도구 사용을 중단하라"는 가이드를 LLM에 주입합니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ═══════ 4. 사용법 ═══════ */}
        <RevealOnScroll>
          <section className="mb-16">
            <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2">
              <span>{"🔌"}</span> 사용법
            </h2>

            <h3 className="text-lg font-bold mb-3">useAgentLoop 훅에서의 호출</h3>
            <p className="text-[14px] text-text-secondary leading-[1.85] mb-4">
              Agent Loop는 직접 호출하지 않습니다. CLI 레이어의
              <span className="font-mono text-accent-cyan text-[13px]"> useAgentLoop</span> React 훅이
              사용자 입력을 받아 <span className="font-mono text-accent-purple text-[13px]">runAgentLoop()</span>를 호출합니다.
              훅은 이벤트 이미터를 통해 UI 상태를 업데이트합니다.
            </p>

            <CodeBlock>{`// useAgentLoop 훅 내부 (간략화)
const result = await runAgentLoop(
  {
    client: llmClient,
    model: "claude-sonnet-4-20250514",
    toolRegistry: registry,
    strategy: nativeFunctionCallStrategy,
    events: appEvents,
    signal: abortController.signal,
    useStreaming: true,
    maxContextTokens: 100_000,
    checkPermission: permissionManager.check,
    checkpointManager: checkpointMgr,
    enableGuardrails: true,
  },
  [systemPrompt, ...conversationHistory, userMessage],
);

// result.messages -- 전체 대화 내역
// result.iterations -- 몇 번 반복했는지
// result.usage -- 토큰 사용량`}</CodeBlock>

            <h3 className="text-lg font-bold mt-8 mb-3">도구 호출 흐름</h3>
            <p className="text-[14px] text-text-secondary leading-[1.85] mb-4">
              LLM이 도구를 호출하면 다음과 같은 파이프라인을 거칩니다:
            </p>

            <MermaidDiagram
              title="도구 호출 파이프라인"
              titleColor="green"
              chart={`sequenceDiagram
    participant LLM as LLM
    participant AL as Agent Loop
    participant PERM as Permission
    participant GUARD as Guardrails
    participant CP as Checkpoint
    participant TOOL as Tool Executor

    LLM->>AL: 응답 (tool_calls 포함)
    AL->>AL: extractToolCalls + filterValid
    AL->>AL: groupToolCalls (병렬/순차)
    loop 각 그룹 (순차)
        loop 각 도구 호출 (pre-flight 순차)
            AL->>PERM: checkPermission(call)
            PERM-->>AL: allowed / denied
            AL->>GUARD: applyInputGuardrails(call)
            GUARD-->>AL: pass / block / warn
        end
        AL->>CP: createCheckpoint (파일 수정 시)
        AL->>TOOL: Promise.allSettled (그룹 내 병렬)
        TOOL-->>AL: ToolCallResult[]
        AL->>GUARD: applyOutputGuardrails(result)
    end
    AL->>AL: truncateToolResult
    AL->>LLM: 다음 반복으로 결과 전달`}
            />

            <Callout type="warn" icon="⚠️">
              <strong>Pre-flight 검사는 순차적입니다.</strong> --
              권한 확인(checkPermission)은 사용자에게 승인을 요청할 수 있으므로 순차적으로 실행됩니다.
              하지만 실제 도구 실행은 그룹 내에서 <span className="font-mono text-[13px]">Promise.allSettled()</span>로 병렬 실행됩니다.
            </Callout>

            <h3 className="text-lg font-bold mt-8 mb-3">에러 처리 흐름</h3>
            <p className="text-[14px] text-text-secondary leading-[1.85] mb-4">
              LLM 호출이 실패하면 3단계 에러 복구 파이프라인이 작동합니다:
            </p>

            <div className="bg-bg-card border border-border rounded-xl p-5 mb-4">
              <div className="space-y-4 text-[13px]">
                <div>
                  <div className="font-bold text-text-primary mb-1">1단계: Recovery Strategy 탐색</div>
                  <p className="text-text-secondary">
                    <span className="font-mono text-accent-purple">findRecoveryStrategy(error)</span>로 에러에 맞는 복구 전략을 찾습니다.
                    복구 전략이 있으면 <span className="font-mono text-accent-purple">executeRecovery()</span>를 실행합니다.
                    복구가 "retry"를 반환하면 compacted messages와 함께 반복을 재시작합니다.
                  </p>
                </div>
                <div>
                  <div className="font-bold text-text-primary mb-1">2단계: 에러 분류</div>
                  <p className="text-text-secondary">
                    <span className="font-mono text-accent-purple">classifyLLMError(error)</span>로 에러를 분류합니다.
                    "overload"와 "permanent"는 즉시 throw합니다.
                    "transient"만 다음 단계로 진행합니다.
                  </p>
                </div>
                <div>
                  <div className="font-bold text-text-primary mb-1">3단계: 지수 백오프 재시도</div>
                  <p className="text-text-secondary">
                    <span className="font-mono text-accent-cyan">1s → 2s → 4s</span> 간격으로 최대
                    <span className="font-mono text-accent-orange"> maxRetries</span>회 재시도합니다.
                    재시도 중 AbortSignal이 발동되면 즉시 중단합니다.
                  </p>
                </div>
              </div>
            </div>

            <Callout type="danger" icon="🔥">
              <strong>Pitfall: overload 에러에 재시도하지 마세요.</strong> --
              429/503 에러는 OpenAI SDK가 이미 Retry-After 헤더를 기반으로 재시도합니다.
              Agent Loop가 추가로 재시도하면 이중 재시도가 발생하여 rate limit을 더 악화시킵니다.
            </Callout>

            <DeepDive title="Tool Grouping 전략">
              <div className="space-y-4">
                <p>
                  LLM이 한 번의 응답에서 여러 도구를 호출할 수 있습니다.
                  Agent Loop는 이를 <strong>병렬 실행 그룹</strong>으로 분류하여 최대한 동시에 실행합니다.
                </p>

                <div className="space-y-2">
                  <div className="flex gap-2 items-start">
                    <span className="text-accent-green font-bold shrink-0">ALWAYS_PARALLEL:</span>
                    <span><span className="font-mono text-[12px]">glob_search, grep_search, file_read</span> -- 읽기 전용이므로 항상 병렬 실행 가능</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="text-accent-orange font-bold shrink-0">FILE_WRITE:</span>
                    <span><span className="font-mono text-[12px]">file_write, file_edit</span> -- 같은 파일 경로 대상이면 순차, 다른 파일이면 병렬</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="text-accent-blue font-bold shrink-0">BASH_EXEC:</span>
                    <span><span className="font-mono text-[12px]">bash_exec</span> -- 서로 독립적이므로 병렬 실행 가능</span>
                  </div>
                </div>

                <CodeBlock>{`// 예시: LLM이 3개 도구를 호출한 경우
const calls = [
  { name: "file_read", args: { path: "a.ts" } },   // Group 1
  { name: "file_edit", args: { path: "b.ts" } },    // Group 1 (다른 파일)
  { name: "file_edit", args: { path: "b.ts" } },    // Group 2 (같은 파일 충돌!)
];
// 결과: [[file_read, file_edit(b.ts)], [file_edit(b.ts)]]
// Group 1은 병렬 실행, Group 2는 Group 1 완료 후 실행`}</CodeBlock>

                <Callout type="tip" icon="✅">
                  <strong>파일 경로 추출</strong> --
                  <span className="font-mono text-[12px]">extractFilePath()</span> 함수가
                  <span className="font-mono text-[12px]"> file_path, path, filePath</span> 3가지 파라미터명을 시도합니다.
                  커스텀 도구에서 다른 이름을 사용하면 충돌 감지가 되지 않을 수 있습니다.
                </Callout>
              </div>
            </DeepDive>

            <DeepDive title="Observation Masking">
              <div className="space-y-4">
                <p>
                  긴 대화에서 초기 도구 출력은 이미 LLM이 처리한 정보입니다.
                  <span className="font-mono text-accent-cyan text-[12px]"> applyObservationMasking()</span>은
                  최근 N개(기본 5개)를 제외한 이전 도구 결과를 요약/마스킹하여 토큰을 절약합니다.
                </p>
                <p>
                  이 과정은 <strong>compaction 이전</strong>에 적용됩니다. 순서가 중요합니다:
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-2">
                  <li>Observation Masking (저비용, 동기) -- 재생성 가능한 도구 출력 마스킹</li>
                  <li>Context Manager prepare() (고비용, 비동기) -- 토큰 예산 초과 시 compaction</li>
                </ol>
                <Callout type="info" icon="💡">
                  Masking은 <strong>비파괴적</strong>입니다. 원본 messages 배열을 수정하지 않고 새로운 배열을 반환합니다.
                  따라서 이전 반복의 도구 결과를 나중에 참조해야 할 때 원본이 보존됩니다.
                </Callout>
              </div>
            </DeepDive>

            <Callout type="warn" icon="⚠️">
              <strong>Pitfall: Deferred 도구 스키마 누락</strong> --
              MCP 도구는 초기에 스키마를 로드하지 않습니다(Deferred Loading).
              <span className="font-mono text-[12px]"> resolveDeferredFromHistory()</span>가
              최근 3개 assistant 메시지에서 사용된 MCP 도구의 스키마를 자동으로 해석합니다.
              하지만 새로운 MCP 도구를 처음 호출할 때는 Hot Tools 목록에만 의존합니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ═══════ 5. 내부 구현 ═══════ */}
        <RevealOnScroll>
          <section className="mb-16">
            <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2">
              <span>{"⚙️"}</span> 내부 구현
            </h2>

            <h3 className="text-lg font-bold mb-4">상태 머신 다이어그램</h3>
            <p className="text-[14px] text-text-secondary leading-[1.85] mb-6">
              Agent Loop의 각 반복(iteration)은 아래 상태 머신을 따릅니다.
              종료 조건은 4가지입니다: 도구 호출 없음(정상 완료), 최대 반복 도달, 사용자 중단(Esc), 서킷 브레이커 발동.
            </p>

            <MermaidDiagram
              title="Agent Loop 상태 머신"
              titleColor="cyan"
              chart={`stateDiagram-v2
    [*] --> INIT: runAgentLoop() 호출

    INIT --> ABORT_CHECK: while 루프 진입
    ABORT_CHECK --> ABORTED: signal.aborted
    ABORT_CHECK --> DUAL_ROUTE: 계속

    DUAL_ROUTE --> CONTEXT_PREPARE: 모델 선택

    CONTEXT_PREPARE --> OBS_MASK: Observation Masking
    OBS_MASK --> COMPACTION: contextManager.prepare()

    COMPACTION --> TOOL_DEFS: 도구 정의 준비
    TOOL_DEFS --> LLM_CALL: strategy.prepareRequest()

    LLM_CALL --> RETRY: 에러 (transient)
    RETRY --> LLM_CALL: 재시도
    LLM_CALL --> RECOVERY: 에러 (recovery 가능)
    RECOVERY --> LLM_CALL: 복구 성공
    LLM_CALL --> FAILED: 에러 (permanent/overload)

    LLM_CALL --> OUTPUT_PARSE: 성공

    OUTPUT_PARSE --> VALIDATE: extractToolCalls
    VALIDATE --> EMPTY_CHECK: 유효한 호출 0개

    EMPTY_CHECK --> NUDGE_RETRY: 빈 응답 (재시도)
    NUDGE_RETRY --> ABORT_CHECK: 재시도
    EMPTY_CHECK --> COMPLETED: 정상 종료

    VALIDATE --> DUP_CHECK: 유효한 호출 있음
    DUP_CHECK --> LOOP_BREAK: 중복 3회+
    LOOP_BREAK --> ABORT_CHECK: 루프 탈출

    DUP_CHECK --> TOOL_GROUP: groupToolCalls

    TOOL_GROUP --> PREFLIGHT: 그룹별 순차
    PREFLIGHT --> PERM_CHECK: checkPermission
    PERM_CHECK --> INPUT_GUARD: applyInputGuardrails
    INPUT_GUARD --> CHECKPOINT: 승인됨

    CHECKPOINT --> PARALLEL_EXEC: 그룹 내 병렬
    PARALLEL_EXEC --> OUTPUT_GUARD: applyOutputGuardrails
    OUTPUT_GUARD --> TRUNCATE: truncateToolResult

    TRUNCATE --> CIRCUIT_CHECK: circuitBreaker.record

    CIRCUIT_CHECK --> ABORT_CHECK: 계속
    CIRCUIT_CHECK --> CB_OPEN: 서킷 열림

    ABORTED --> [*]
    COMPLETED --> [*]
    FAILED --> [*]
    CB_OPEN --> [*]`}
            />

            <h3 className="text-lg font-bold mt-10 mb-4">메인 루프 코드 (핵심 30줄)</h3>
            <p className="text-[14px] text-text-secondary leading-[1.85] mb-4">
              1,276줄의 전체 파일 중 핵심 구조를 보여주는 발췌본입니다:
            </p>

            <CodeBlock>{`export async function runAgentLoop(
  config: AgentLoopConfig,
  initialMessages: readonly ChatMessage[],
): Promise<AgentLoopResult> {
  const maxIterations = config.maxIterations ?? AGENT_LOOP.maxIterations;
  const messages: ChatMessage[] = [...initialMessages];
  const circuitBreaker = new CircuitBreaker(maxIterations);
  const contextManager = new ContextManager({ /* ... */ });
  let iterations = 0;

  while (iterations < maxIterations && circuitBreaker.shouldContinue()) {
    if (config.signal?.aborted) return { messages, iterations, aborted: true };

    iterations++;

    // 1. 모델 라우팅 (Dual-model)
    let activeClient = config.client;
    if (config.dualModelRouter) { /* phase detect + switch */ }

    // 2. 컨텍스트 준비 (마스킹 + compaction)
    const masked = applyObservationMasking(messages, { keepRecentN: 5 });
    const managed = await contextManager.prepare(masked);

    // 3. LLM 호출 (재시도 로직 포함)
    const response = await callLLMWithRetry(activeClient, managed, config);

    // 4. 도구 호출 추출 + 유효성 검증
    const extractedCalls = filterValidToolCalls(
      config.strategy.extractToolCalls(response.content, response.toolCalls),
      config.events,
    );

    // 5. 도구 호출이 없으면 종료
    if (extractedCalls.length === 0) {
      return { messages, iterations, aborted: false, usage };
    }

    // 6. 병렬 그룹화 + 권한 확인 + 도구 실행
    const groups = groupToolCalls(extractedCalls);
    for (const group of groups) {
      // pre-flight: permission + guardrails (순차)
      // execution: Promise.allSettled (병렬)
    }

    // 7. 서킷 브레이커 기록
    circuitBreaker.recordIteration({ filesModified, hasOutput, error });
  }

  return { messages, iterations, aborted: false, usage: finalUsage };
}`}</CodeBlock>

            <h3 className="text-lg font-bold mt-10 mb-4">HeadlessGuard 시스템</h3>
            <p className="text-[14px] text-text-secondary leading-[1.85] mb-4">
              Agent Loop에는 3가지 <strong className="text-text-primary">HeadlessGuard</strong>가 내장되어 있습니다.
              headless(UI 없는) 환경에서 LLM이 비정상 동작할 때 자동으로 대응합니다:
            </p>
            <div className="bg-bg-card border border-border rounded-xl p-5 mb-4">
              <div className="space-y-4 text-[13px]">
                <div>
                  <div className="font-bold text-accent-orange mb-1">1. 빈 응답 감지 (Empty Response Guard)</div>
                  <p className="text-text-secondary">
                    content가 빈 문자열이고 도구 호출도 없을 때 최대 <span className="font-mono">2회</span> 자동 재시도합니다.
                    "[System] Your previous response was empty..." 메시지를 주입하여 LLM을 nudge합니다.
                  </p>
                </div>
                <div>
                  <div className="font-bold text-accent-orange mb-1">2. 중복 도구 호출 감지 (Duplicate Tool Call Guard)</div>
                  <p className="text-text-secondary">
                    동일한 도구+파라미터 조합이 <span className="font-mono">3회 연속</span> 발생하면 루프를 탈출합니다.
                    도구 호출의 시그니처(이름+JSON 인자)를 해싱하여 비교합니다.
                  </p>
                </div>
                <div>
                  <div className="font-bold text-accent-orange mb-1">3. Incomplete 응답 감지 (Incomplete Response Guard)</div>
                  <p className="text-text-secondary">
                    Responses API가 "incomplete" 상태를 반환하면 최대 <span className="font-mono">2회</span> 재시도합니다.
                    Codex 모델이 early-stop하는 경우에 대응합니다.
                  </p>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-bold mt-10 mb-4">Permission Denial 추적</h3>
            <p className="text-[14px] text-text-secondary leading-[1.85] mb-4">
              같은 도구가 반복적으로 권한이 거절되면 LLM이 계속 같은 도구를 시도하는 무한 루프에 빠질 수 있습니다.
              Agent Loop는 도구별 거절 횟수를 추적하여 <span className="font-mono text-accent-red text-[13px]">2회 이상</span> 거절되면
              "이 도구 사용을 중단하고 사용자에게 가이드를 요청하라"는 메시지를 주입합니다.
            </p>

            <CodeBlock>{`// 거절 카운터 추적
const permissionDenialCounts = new Map<string, number>();
const MAX_DENIALS_BEFORE_STOP = 2;

// 2회 이상 거절 시
denialCount >= MAX_DENIALS_BEFORE_STOP
  ? \`Permission denied... STOP trying to use "\${call.name}".
     Inform the user what you were trying to do and ask for guidance.\`
  : \`Permission denied: \${permission.reason ?? "User rejected"}\`;`}</CodeBlock>

            <h3 className="text-lg font-bold mt-10 mb-4">MCP 도구 실패 복구</h3>
            <p className="text-[14px] text-text-secondary leading-[1.85] mb-4">
              MCP(Model Context Protocol) 도구가 실패하면 자동으로 복구 가이드 메시지를 주입합니다.
              타임아웃, 권한 거부 등 실패 유형을 분석하여 LLM에게 적절한 대응을 지시합니다.
            </p>

            <Callout type="tip" icon="✅">
              <strong>Auto-checkpoint가 데이터를 보호합니다.</strong> --
              <span className="font-mono text-[12px]">file_write</span>,
              <span className="font-mono text-[12px]">file_edit</span> 도구를 실행하기 전에
              <span className="font-mono text-accent-purple text-[12px]"> checkpointManager.createCheckpoint()</span>가 호출됩니다.
              파일 수정이 잘못되면 <span className="font-mono text-[12px]">/undo</span> 명령으로 복구할 수 있습니다.
              체크포인트 생성 실패는 도구 실행을 차단하지 않습니다 (fail-safe).
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ═══════ 6. 트러블슈팅 ═══════ */}
        <RevealOnScroll>
          <section className="mb-16">
            <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2">
              <span>{"🔧"}</span> 트러블슈팅
            </h2>

            <div className="space-y-6">
              {/* FAQ 1 */}
              <div className="bg-bg-card border border-border rounded-xl p-6">
                <h4 className="font-bold text-[15px] text-accent-red mb-2">Q1. Agent가 같은 작업을 무한 반복합니다</h4>
                <p className="text-[13px] text-text-secondary leading-relaxed mb-3">
                  <strong className="text-text-primary">원인:</strong> LLM이 같은 도구를 동일한 파라미터로 반복 호출하고 있습니다.
                  서킷 브레이커가 감지하지 못하는 미묘한 변화(예: 파일 내용이 매번 동일하게 변경)가 있을 수 있습니다.
                </p>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  <strong className="text-text-primary">해결:</strong>
                </p>
                <ul className="list-disc list-inside text-[13px] text-text-secondary pl-2 space-y-1">
                  <li><span className="font-mono text-[12px]">DBCODE_VERBOSE=1</span> 환경변수를 설정하여 trace 로그를 확인하세요</li>
                  <li>HeadlessGuard의 중복 감지(MAX_DUPLICATE_TOOL_CALLS = 3)가 동작하는지 확인하세요</li>
                  <li>서킷 브레이커의 maxIterations 값을 줄여 조기 중단을 유도하세요</li>
                  <li>Esc 키를 눌러 즉시 루프를 중단할 수 있습니다</li>
                </ul>
              </div>

              {/* FAQ 2 */}
              <div className="bg-bg-card border border-border rounded-xl p-6">
                <h4 className="font-bold text-[15px] text-accent-red mb-2">Q2. 도구 실행 권한이 계속 거부됩니다</h4>
                <p className="text-[13px] text-text-secondary leading-relaxed mb-3">
                  <strong className="text-text-primary">원인:</strong> 권한 모드가 restrictive하게 설정되어 있거나,
                  사용자가 도구 실행을 거부하고 있습니다.
                </p>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  <strong className="text-text-primary">해결:</strong>
                </p>
                <ul className="list-disc list-inside text-[13px] text-text-secondary pl-2 space-y-1">
                  <li>Shift+Tab을 눌러 권한 모드를 순회하세요 (5단계: deny-all → ask-all → ask-writes → auto → trust-all)</li>
                  <li>2회 거절 후 Agent는 자동으로 해당 도구 사용을 중단합니다</li>
                  <li>특정 도구를 항상 허용하려면 <span className="font-mono text-[12px]">.dbcode/settings.json</span>의 allowedTools에 추가하세요</li>
                </ul>
              </div>

              {/* FAQ 3 */}
              <div className="bg-bg-card border border-border rounded-xl p-6">
                <h4 className="font-bold text-[15px] text-accent-red mb-2">Q3. "Request too large" 에러가 발생합니다</h4>
                <p className="text-[13px] text-text-secondary leading-relaxed mb-3">
                  <strong className="text-text-primary">원인:</strong> 대화 히스토리 + 도구 결과의 총 토큰이 모델의 컨텍스트 윈도우를 초과했습니다.
                  이 에러는 permanent로 분류되어 재시도하지 않습니다.
                </p>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  <strong className="text-text-primary">해결:</strong>
                </p>
                <ul className="list-disc list-inside text-[13px] text-text-secondary pl-2 space-y-1">
                  <li><span className="font-mono text-[12px]">maxContextTokens</span>를 설정하여 auto-compaction을 활성화하세요 (모델 컨텍스트의 ~80%)</li>
                  <li><span className="font-mono text-[12px]">maxToolResultChars</span>를 줄여 개별 도구 결과 크기를 제한하세요</li>
                  <li><span className="font-mono text-[12px]">/compact</span> 명령으로 수동 compaction을 실행하세요</li>
                  <li>새 세션(<span className="font-mono text-[12px]">/clear</span>)을 시작하세요</li>
                </ul>
              </div>

              {/* FAQ 4 */}
              <div className="bg-bg-card border border-border rounded-xl p-6">
                <h4 className="font-bold text-[15px] text-accent-red mb-2">Q4. LLM 호출이 타임아웃됩니다</h4>
                <p className="text-[13px] text-text-secondary leading-relaxed mb-3">
                  <strong className="text-text-primary">원인:</strong> 네트워크 문제이거나, LLM 서버의 응답이 너무 느립니다.
                  이 에러는 transient으로 분류되어 자동 재시도됩니다.
                </p>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  <strong className="text-text-primary">해결:</strong>
                </p>
                <ul className="list-disc list-inside text-[13px] text-text-secondary pl-2 space-y-1">
                  <li>기본 타임아웃은 120초입니다 (<span className="font-mono text-[12px]">config/defaults.ts</span>)</li>
                  <li>로컬 LLM을 사용 중이면 GPU 메모리와 모델 크기를 확인하세요</li>
                  <li><span className="font-mono text-[12px]">maxRetries</span>를 늘려 재시도 횟수를 증가시키세요</li>
                  <li>스트리밍 모드(<span className="font-mono text-[12px]">useStreaming: true</span>)를 사용하면 partial content를 살릴 수 있습니다</li>
                </ul>
              </div>

              {/* FAQ 5 */}
              <div className="bg-bg-card border border-border rounded-xl p-6">
                <h4 className="font-bold text-[15px] text-accent-red mb-2">Q5. 서킷 브레이커가 너무 빨리 발동됩니다</h4>
                <p className="text-[13px] text-text-secondary leading-relaxed mb-3">
                  <strong className="text-text-primary">원인:</strong> CircuitBreaker가 연속된 반복에서 "진행 없음"(no progress)을
                  감지하여 루프를 중단했습니다. 파일 수정 없이 같은 에러가 반복되면 발동됩니다.
                </p>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  <strong className="text-text-primary">해결:</strong>
                </p>
                <ul className="list-disc list-inside text-[13px] text-text-secondary pl-2 space-y-1">
                  <li><span className="font-mono text-[12px]">maxIterations</span>를 늘려 서킷 브레이커의 기준을 완화하세요</li>
                  <li>도구 실행 에러가 있다면 근본 원인을 해결하세요 (에러 로그 확인)</li>
                  <li>서킷 브레이커 상태는 <span className="font-mono text-[12px]">getStatus()</span>로 확인할 수 있습니다 (reason 필드)</li>
                  <li>대화를 재시작(<span className="font-mono text-[12px]">/clear</span>)하면 서킷 브레이커가 리셋됩니다</li>
                </ul>
              </div>

              {/* FAQ 6 */}
              <div className="bg-bg-card border border-border rounded-xl p-6">
                <h4 className="font-bold text-[15px] text-accent-red mb-2">Q6. 도구 호출 인자가 불완전합니다 (JSON 파싱 실패)</h4>
                <p className="text-[13px] text-text-secondary leading-relaxed mb-3">
                  <strong className="text-text-primary">원인:</strong> 스트리밍 모드에서 스트림이 중간에 끊겨 도구 호출 인자가 불완전한 JSON이 되었습니다.
                  <span className="font-mono text-[12px]">filterValidToolCalls()</span>가 이를 감지하여 제거합니다.
                </p>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  <strong className="text-text-primary">해결:</strong>
                </p>
                <ul className="list-disc list-inside text-[13px] text-text-secondary pl-2 space-y-1">
                  <li>자동으로 "[System] Your tool calls had invalid JSON arguments" 피드백이 주입됩니다</li>
                  <li>LLM이 다음 반복에서 올바른 인자로 다시 호출합니다</li>
                  <li>반복되면 네트워크 연결 상태를 확인하세요</li>
                  <li>비스트리밍 모드(<span className="font-mono text-[12px]">useStreaming: false</span>)를 시도해보세요</li>
                </ul>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ═══════ 7. 관련 문서 ═══════ */}
        <RevealOnScroll>
          <section className="mb-8">
            <h2 className="text-2xl font-extrabold mb-6 flex items-center gap-2">
              <span>{"🔗"}</span> 관련 문서
            </h2>
            <SeeAlso items={seeAlsoItems} />
          </section>
        </RevealOnScroll>

      </div>
    </div>
  );
}
