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

export default function UseAgentLoopPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/hooks/useAgentLoop.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">useAgentLoop</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              Agent Loop과 React UI를 연결하는 핵심 브릿지 훅 — 사용자 입력부터 LLM 응답, 도구 실행,
              대화 저장까지 전체 오케스트레이션을 담당합니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ─── 1. 개요 (Overview) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📋</span> 개요
            </h2>
            <div className="text-[14px] text-gray-600 leading-[1.85] mb-8 space-y-3">
              <p>
                <code className="text-cyan-600">useAgentLoop</code>은 dbcode CLI 애플리케이션의
                심장부입니다.
                <code className="text-cyan-600">App.tsx</code> 단 한 곳에서만 호출되며, 사용자가
                입력한 메시지를 받아서 LLM에 전달하고, 도구를 실행하고, 결과를 대화 히스토리에
                저장하는 전체 에이전트 사이클을 React 상태로 관리합니다.
              </p>
              <p>
                이 훅은 &quot;접착제(glue)&quot; 역할을 합니다. Core 레이어의{" "}
                <code className="text-cyan-600">runAgentLoop</code>,
                <code className="text-cyan-600">buildSystemPrompt</code>,{" "}
                <code className="text-cyan-600">ContextManager</code> 등 순수 로직 모듈들을 React의
                상태 관리(<code className="text-cyan-600">useState</code>,{" "}
                <code className="text-cyan-600">useRef</code>)와 이벤트 시스템으로 연결하여 UI가
                실시간으로 업데이트되도록 합니다.
              </p>
              <p>
                특히 메시지 큐잉, AbortController를 통한 취소(Escape 키), 토큰/비용 추적, 세션 저장,
                슬래시 명령 위임, MCP 도구 연동 등 다양한 부가 기능을 하나의 훅 안에서 일관되게
                관리합니다.
              </p>
            </div>

            <MermaidDiagram
              title="useAgentLoop 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  APP["App.tsx<br/><small>cli/App.tsx</small>"]
  HOOK["useAgentLoop<br/><small>cli/hooks/useAgentLoop.ts</small>"]
  CONV["useConversation<br/><small>cli/hooks/useConversation.ts</small>"]
  BUF["useTextBuffering<br/><small>cli/hooks/useTextBuffering.ts</small>"]
  AL["Agent Loop<br/><small>core/agent-loop.ts</small>"]
  SP["System Prompt Builder<br/><small>core/system-prompt-builder.ts</small>"]
  CTX["Context Manager<br/><small>core/context-manager.ts</small>"]
  ACT["Activity Collector<br/><small>core/activity.ts</small>"]

  APP -->|"단일 소비자"| HOOK
  HOOK -->|"대화 상태"| CONV
  HOOK -->|"스트리밍 버퍼"| BUF
  HOOK -->|"에이전트 실행"| AL
  HOOK -->|"프롬프트 빌드"| SP
  HOOK -->|"컨텍스트 압축"| CTX
  HOOK -->|"활동 추적"| ACT

  style HOOK fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style APP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CONV fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style BUF fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SP fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CTX fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style ACT fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 교향악단의 지휘자를 떠올리세요. 지휘자(useAgentLoop)는 직접
              악기를 연주하지 않지만, 각 파트(LLM, 도구, UI, 세션)에 시작/정지 신호를 보내고 전체
              연주를 하나로 조율합니다. App.tsx는 관객이 보는 무대(UI)이고, 이 훅은 무대 뒤의
              지휘자입니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 2. 레퍼런스 (Reference) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📖</span> 레퍼런스
            </h2>

            {/* UseAgentLoopOptions interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface UseAgentLoopOptions
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">useAgentLoop</code> 훅에 전달하는 옵션 객체입니다.
              App.tsx에서 초기화한 의존성을 모두 주입받습니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "client",
                  type: "LLMProvider",
                  required: true,
                  desc: "LLM API 클라이언트 인스턴스 (OpenAI SDK 기반)",
                },
                {
                  name: "model",
                  type: "string",
                  required: true,
                  desc: "사용할 LLM 모델명 (예: 'gpt-4o', 'claude-sonnet-4-20250514')",
                },
                {
                  name: "toolRegistry",
                  type: "ToolRegistry",
                  required: true,
                  desc: "사용 가능한 도구 목록을 관리하는 레지스트리",
                },
                {
                  name: "strategy",
                  type: "ToolCallStrategy",
                  required: true,
                  desc: "LLM의 도구 호출 방식 전략 (auto, required 등)",
                },
                {
                  name: "checkPermission",
                  type: "(call: ExtractedToolCall) => Promise<PermissionResult>",
                  required: true,
                  desc: "도구 실행 전 권한 확인 함수",
                },
                {
                  name: "commandRegistry",
                  type: "CommandRegistry",
                  required: false,
                  desc: "슬래시 명령 레지스트리 (/help, /model 등)",
                },
                {
                  name: "contextManager",
                  type: "ContextManager",
                  required: false,
                  desc: "3-Layer 컨텍스트 압축 관리자",
                },
                {
                  name: "hookRunner",
                  type: "HookRunner",
                  required: false,
                  desc: "UserPromptSubmit/Stop 훅 실행기",
                },
                {
                  name: "sessionManager",
                  type: "SessionManager",
                  required: false,
                  desc: "대화 세션 저장/불러오기 관리자",
                },
                {
                  name: "skillManager",
                  type: "SkillManager",
                  required: false,
                  desc: "스킬 시스템 관리자 — 프롬프트 섹션 빌드",
                },
                {
                  name: "sessionId",
                  type: "string",
                  required: false,
                  desc: "현재 세션 ID (세션 저장/체크포인트에 사용)",
                },
                {
                  name: "initialLocale",
                  type: "string",
                  required: false,
                  desc: "시스템 프롬프트 언어 (기본값: 'ko')",
                },
                {
                  name: "initialTone",
                  type: "string",
                  required: false,
                  desc: "응답 톤 설정 (기본값: 'normal')",
                },
                {
                  name: "mcpConnector",
                  type: "MCPManagerConnector",
                  required: false,
                  desc: "MCP 도구 검색 및 시스템 프롬프트 연동",
                },
                {
                  name: "mcpManager",
                  type: "MCPManager",
                  required: false,
                  desc: "MCP 서버 관리자 (슬래시 명령에 전달)",
                },
                {
                  name: "thinkingEnabled",
                  type: "boolean",
                  required: false,
                  desc: "Extended Thinking 활성화 여부 (기본값: false)",
                },
              ]}
            />

            {/* Return type (AgentLoopState) */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              반환값 (AgentLoopState)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">useAgentLoop</code>이 반환하는 객체입니다. App.tsx에서
              이 값들을 각 컴포넌트에 전달하여 UI를 구성합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "isProcessing",
                  type: "boolean",
                  required: true,
                  desc: "에이전트가 현재 LLM 호출/도구 실행 중인지 여부",
                },
                {
                  name: "streamingText",
                  type: "string",
                  required: true,
                  desc: "LLM이 스트리밍 중인 텍스트 (100ms 버퍼링)",
                },
                {
                  name: "isStreamingFinal",
                  type: "boolean",
                  required: true,
                  desc: "최종 응답(도구 호출 없는)을 스트리밍 중인지 여부",
                },
                {
                  name: "agentPhase",
                  type: '"idle" | "llm-thinking" | "llm-streaming" | "tools-running" | "tools-done"',
                  required: true,
                  desc: "현재 에이전트 단계 — AgentStatus 스피너에 사용",
                },
                {
                  name: "completedTurns",
                  type: "readonly TurnActivity[]",
                  required: true,
                  desc: "완료된 대화 턴의 활동 로그 목록",
                },
                {
                  name: "currentTurn",
                  type: "TurnActivity | null",
                  required: true,
                  desc: "현재 진행 중인 턴의 활동 스냅샷",
                },
                {
                  name: "liveTurn",
                  type: "TurnActivity | null",
                  required: true,
                  desc: "currentTurn + 실시간 스트리밍 텍스트가 합쳐진 턴",
                },
                {
                  name: "handleSubmit",
                  type: "(input: string) => Promise<void>",
                  required: true,
                  desc: "사용자 입력 처리 — 슬래시 명령 또는 에이전트 루프 실행",
                },
                {
                  name: "error",
                  type: "string | null",
                  required: true,
                  desc: "마지막 에러 메시지 (없으면 null)",
                },
                {
                  name: "commandOutput",
                  type: "string | null",
                  required: true,
                  desc: "슬래시 명령 실행 결과 (없으면 null)",
                },
                {
                  name: "tokenCount",
                  type: "number",
                  required: true,
                  desc: "누적 토큰 수 (간이 카운트)",
                },
                {
                  name: "activeModel",
                  type: "string",
                  required: true,
                  desc: "현재 활성 모델명 (/model로 변경 가능)",
                },
                {
                  name: "events",
                  type: "EventEmitter",
                  required: true,
                  desc: "이벤트 이미터 — 도구/LLM/에이전트 이벤트 전파",
                },
                {
                  name: "messageQueueRef",
                  type: "RefObject<string[]>",
                  required: true,
                  desc: "처리 대기 중인 메시지 큐",
                },
                {
                  name: "inputTokens",
                  type: "number",
                  required: true,
                  desc: "누적 입력 토큰 수 (모델 가격 기준)",
                },
                {
                  name: "outputTokens",
                  type: "number",
                  required: true,
                  desc: "누적 출력 토큰 수 (모델 가격 기준)",
                },
                { name: "totalCost", type: "number", required: true, desc: "누적 비용 (USD)" },
                {
                  name: "interactiveSelect",
                  type: "InteractiveSelect | null",
                  required: true,
                  desc: "대화형 선택 UI 데이터 (/model 등)",
                },
                {
                  name: "retryInfo",
                  type: "RetryInfo | null",
                  required: true,
                  desc: "재시도 카운트다운 정보 (429 등 에러 시)",
                },
                {
                  name: "pendingAskUser",
                  type: "AskUserData | null",
                  required: true,
                  desc: "ask_user 도구의 대기 질문 데이터",
                },
                {
                  name: "streamingOutputs",
                  type: "RefObject<Map<string, string>>",
                  required: true,
                  desc: "실행 중인 도구의 실시간 출력 (bash_exec 등)",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                이 훅은 <strong>App.tsx에서 단 한 번만</strong> 호출해야 합니다. 여러 곳에서
                호출하면 이벤트 리스너가 중복 등록되어 상태가 꼬입니다.
              </li>
              <li>
                <code className="text-cyan-600">client</code>는 내부적으로{" "}
                <code className="text-cyan-600">useRef</code>로 관리됩니다.{" "}
                <code className="text-cyan-600">/model</code> 명령으로 모델을 전환하면
                <code className="text-cyan-600">clientRef.current</code>가 새 클라이언트로
                교체됩니다.
              </li>
              <li>
                <code className="text-cyan-600">strategy</code>는{" "}
                <code className="text-cyan-600">activeModel</code>이 변경될 때마다{" "}
                <code className="text-cyan-600">useMemo</code>로 재계산됩니다. 외부에서 전달한{" "}
                <code className="text-cyan-600">_initialStrategy</code>는 초기값으로만 사용됩니다.
              </li>
              <li>
                <code className="text-cyan-600">processMessage</code>는 재귀 호출됩니다 — 메시지
                큐에 대기 메시지가 있으면 <code className="text-cyan-600">finally</code> 블록에서
                다음 메시지를 꺼내 자기 자신을 호출합니다.
              </li>
            </ul>
          </section>
        </RevealOnScroll>

        {/* ─── 3. 사용법 (Usage) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🚀</span> 사용법
            </h2>

            {/* 기본 사용법 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; App.tsx에서 호출하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              App.tsx에서 <code className="text-cyan-600">useAgentLoop</code>을 호출하고, 반환값을
              각 UI 컴포넌트에 전달하는 패턴입니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> {"{"}
              {"\n"}
              {"  "}
              <span className="prop">isProcessing</span>,{"\n"}
              {"  "}
              <span className="prop">streamingText</span>,{"\n"}
              {"  "}
              <span className="prop">agentPhase</span>,{"\n"}
              {"  "}
              <span className="prop">completedTurns</span>,{"\n"}
              {"  "}
              <span className="prop">liveTurn</span>,{"\n"}
              {"  "}
              <span className="prop">handleSubmit</span>,{"\n"}
              {"  "}
              <span className="prop">error</span>,{"\n"}
              {"  "}
              <span className="prop">activeModel</span>,{"\n"}
              {"  "}
              <span className="prop">events</span>,{"\n"}
              {"  "}
              <span className="prop">totalCost</span>,{"\n"}
              {"}"} = <span className="fn">useAgentLoop</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">client</span>,{"\n"}
              {"  "}
              <span className="prop">model</span>: <span className="str">&quot;gpt-4o&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">toolRegistry</span>,{"\n"}
              {"  "}
              <span className="prop">strategy</span>,{"\n"}
              {"  "}
              <span className="prop">checkPermission</span>,{"\n"}
              {"  "}
              <span className="prop">commandRegistry</span>,{"\n"}
              {"  "}
              <span className="prop">contextManager</span>,{"\n"}
              {"  "}
              <span className="prop">sessionManager</span>,{"\n"}
              {"  "}
              <span className="prop">sessionId</span>,{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// UI 컴포넌트에 전달"}</span>
              {"\n"}
              <span className="kw">return</span> ({"\n"}
              {"  "}&lt;<span className="type">AgentStatus</span>{" "}
              <span className="prop">phase</span>={"{"}agentPhase{"}"} /&gt;
              {"\n"}
              {"  "}&lt;<span className="type">ActivityFeed</span>{" "}
              <span className="prop">turns</span>={"{"}completedTurns{"}"}{" "}
              <span className="prop">currentTurn</span>={"{"}liveTurn{"}"} /&gt;
              {"\n"}
              {"  "}&lt;<span className="type">InputBox</span>{" "}
              <span className="prop">onSubmit</span>={"{"}handleSubmit{"}"}{" "}
              <span className="prop">disabled</span>={"{"}isProcessing{"}"} /&gt;
              {"\n"}
              {"  "}&lt;<span className="type">StatusBar</span> <span className="prop">model</span>=
              {"{"}activeModel{"}"} <span className="prop">cost</span>={"{"}totalCost{"}"} /&gt;
              {"\n"});
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>useAgentLoop</code>은 내부에서 10개 이상의 이벤트
              리스너를 등록합니다. 컴포넌트 트리 깊은 곳에서 호출하면 언마운트/리마운트 시 리스너
              누수가 발생할 수 있으므로, 반드시 최상위 <code>App.tsx</code>에서만 호출하세요.
            </Callout>

            {/* 고급: handleSubmit 흐름 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; handleSubmit 입력 처리 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">handleSubmit</code>은 사용자 입력을 세 가지 경로로
              분기합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// handleSubmit 내부 분기 로직"}</span>
              {"\n"}
              <span className="kw">async function</span> <span className="fn">handleSubmit</span>(
              <span className="prop">input</span>: <span className="type">string</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// 경로 1: 슬래시 명령 — commandRegistry에 위임"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">commandRegistry</span>.
              <span className="fn">isCommand</span>(<span className="prop">input</span>)) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="prop">commandRegistry</span>.
              <span className="fn">execute</span>(<span className="prop">input</span>,{" "}
              <span className="prop">ctx</span>);
              {"\n"}
              {"    "}
              <span className="cm">{"// /model → 모델 전환, /compact → 컨텍스트 압축, ..."}</span>
              {"\n"}
              {"    "}
              <span className="kw">return</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// 경로 2: 에이전트 처리 중 → 메시지 큐에 추가"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">isProcessing</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="prop">messageQueueRef</span>.<span className="prop">current</span>.
              <span className="fn">push</span>(<span className="prop">input</span>);
              {"\n"}
              {"    "}
              <span className="kw">return</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// 경로 3: 정상 처리 → processMessage 실행"}</span>
              {"\n"}
              {"  "}
              <span className="kw">void</span> <span className="fn">processMessage</span>(
              <span className="prop">input</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* 고급: 메시지 큐잉 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 메시지 큐잉과 순차 처리
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              에이전트가 처리 중일 때 사용자가 추가 메시지를 입력하면, 큐에 저장된 후 현재 처리가
              끝나면 자동으로 다음 메시지를 꺼내 처리합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// processMessage의 finally 블록 내부"}</span>
              {"\n"}
              <span className="kw">finally</span> {"{"}
              {"\n"}
              {"  "}
              <span className="fn">setIsProcessing</span>(<span className="kw">false</span>);
              {"\n"}
              {"  "}
              <span className="fn">setAgentPhase</span>(
              <span className="str">&quot;idle&quot;</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// 큐에 대기 중인 메시지가 있으면 바로 처리"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">nextMessage</span> ={" "}
              <span className="prop">messageQueueRef</span>.<span className="prop">current</span>.
              <span className="fn">shift</span>();
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">nextMessage</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">void</span> <span className="fn">processMessage</span>(
              <span className="prop">nextMessage</span>);
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 메시지 큐는 <code>useRef</code>로 관리되므로 큐에 메시지를
              추가해도 리렌더링이 발생하지 않습니다. 큐는 FIFO(선입선출) 순서로 처리됩니다.
            </Callout>

            {/* 고급: AbortController */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; Escape 키 취소 (AbortController)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              사용자가 Escape 키를 누르면 <code className="text-cyan-600">input:abort</code>{" "}
              이벤트가 발생하고, AbortController가 현재 실행 중인 에이전트 루프를 취소합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. processMessage에서 AbortController 생성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">controller</span> ={" "}
              <span className="kw">new</span> <span className="fn">AbortController</span>();
              {"\n"}
              <span className="prop">abortControllerRef</span>.<span className="prop">current</span>{" "}
              = <span className="prop">controller</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 2. runAgentLoop에 signal 전달"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">runAgentLoop</span>({"{"}{" "}
              <span className="prop">signal</span>: <span className="prop">controller</span>.
              <span className="prop">signal</span>, ... {"}"},{" "}
              <span className="prop">messages</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. Escape 키 → input:abort → controller.abort()"}</span>
              {"\n"}
              <span className="prop">events</span>.<span className="fn">on</span>(
              <span className="str">&quot;input:abort&quot;</span>, () =&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="prop">abortControllerRef</span>.<span className="prop">current</span>
              ?.<span className="fn">abort</span>();
              {"\n"}
              {"}"});
            </CodeBlock>

            <DeepDive title="슬래시 명령에서의 모델/프로바이더 전환">
              <p className="mb-3">
                <code className="text-cyan-600">/model</code> 명령은{" "}
                <code className="text-cyan-600">handleSubmit</code> 내부에서 특수 처리됩니다. 명령
                결과에 <code className="text-cyan-600">newProvider</code>가 포함되면 LLM
                클라이언트를 완전히 교체하고, <code className="text-cyan-600">newModel</code>만
                있으면 모델명만 변경합니다.
              </p>
              <CodeBlock>
                <span className="kw">if</span> (<span className="prop">result</span>.
                <span className="prop">newProvider</span>) {"{"}
                {"\n"}
                {"  "}
                <span className="cm">
                  {"// 프로바이더 전환: client + model + strategy 3종 세트 교체"}
                </span>
                {"\n"}
                {"  "}
                <span className="prop">clientRef</span>.<span className="prop">current</span> ={" "}
                <span className="fn">createLLMClientForModel</span>(
                <span className="prop">result</span>.<span className="prop">newProvider</span>);
                {"\n"}
                {"  "}
                <span className="fn">setActiveModel</span>(<span className="prop">result</span>.
                <span className="prop">newProvider</span>.<span className="prop">model</span>);
                {"\n"}
                {"}"} <span className="kw">else if</span> (<span className="prop">result</span>.
                <span className="prop">newModel</span>) {"{"}
                {"\n"}
                {"  "}
                <span className="fn">setActiveModel</span>(<span className="prop">result</span>.
                <span className="prop">newModel</span>);
                {"\n"}
                {"}"}
                {"\n"}
                {"\n"}
                <span className="cm">{"// activeStrategy는 useMemo로 activeModel에 연동"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">activeStrategy</span> ={" "}
                <span className="fn">useMemo</span>(() =&gt;
                {"\n"}
                {"  "}
                <span className="fn">selectStrategy</span>(<span className="prop">activeModel</span>
                ), [<span className="prop">activeModel</span>]);
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                이 설계 덕분에{" "}
                <code className="text-cyan-600">/model claude-sonnet-4-20250514</code>처럼 GPT에서
                Claude로, 또는 그 반대로 실시간 전환이 가능합니다. Strategy도 자동으로 재계산되어
                모델/전략 불일치를 방지합니다.
              </p>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ─── 4. 내부 구현 (Internals) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>⚙️</span> 내부 구현
            </h2>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              agentPhase 상태 머신
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">agentPhase</code>는 에이전트의 현재 단계를 나타내며,
              UI의 <code className="text-cyan-600">AgentStatus</code> 스피너에 직접 전달됩니다.
              이벤트 기반으로 상태가 전이됩니다.
            </p>

            <MermaidDiagram
              title="agentPhase 상태 전이"
              titleColor="purple"
              chart={`graph TD
  START(("●")) --> IDLE["idle<br/><small>사용자 입력 대기</small>"]
  IDLE -->|"llm:start 이벤트"| THINKING["llm_thinking<br/><small>Extended Thinking 추론</small>"]
  THINKING -->|"llm:text-delta 이벤트"| STREAMING["llm_streaming<br/><small>텍스트 실시간 표시</small>"]
  STREAMING -->|"agent:tools-executing 이벤트"| TOOLS["tools_running<br/><small>도구 실행 중</small>"]
  TOOLS -->|"agent:tools-done 이벤트"| DONE["tools_done<br/><small>도구 실행 완료</small>"]
  DONE -->|"llm:start (다음 반복)"| THINKING
  STREAMING -->|"isFinal=true (최종 응답)"| IDLE
  DONE -->|"루프 종료"| IDLE

  style IDLE fill:#dcfce7,stroke:#22c55e,color:#1e293b
  style THINKING fill:#fef9c3,stroke:#eab308,color:#1e293b
  style STREAMING fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TOOLS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style DONE fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              processMessage 실행 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">processMessage</code>는 하나의 사용자 메시지를
              처리하는 핵심 내부 함수입니다. 시스템 프롬프트 빌드부터 세션 저장까지의 전체
              파이프라인을 실행합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// processMessage 실행 순서"}</span>
              {"\n"}
              <span className="kw">async function</span> <span className="fn">processMessage</span>(
              <span className="prop">input</span>: <span className="type">string</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 상태 초기화"}</span>
              {"\n"}
              {"  "}
              <span className="fn">addUserMessage</span>(<span className="prop">input</span>);
              {"\n"}
              {"  "}
              <span className="fn">setIsProcessing</span>(<span className="kw">true</span>);
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">controller</span> ={" "}
              <span className="kw">new</span> <span className="fn">AbortController</span>();
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [2] 활동 추적 시작"}</span>
              {"\n"}
              {"  "}
              <span className="prop">activityRef</span>.<span className="prop">current</span>.
              <span className="fn">startTurn</span>();
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] UserPromptSubmit 훅 실행 (차단 가능)"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">hookRunner</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">hookResult</span> ={" "}
              <span className="kw">await</span> <span className="prop">hookRunner</span>.
              <span className="fn">run</span>(
              <span className="str">&quot;UserPromptSubmit&quot;</span>, ...);
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">hookResult</span>.
              <span className="prop">blocked</span>) <span className="kw">return</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">
                {"// [4] 시스템 프롬프트 빌드 (지침 + 스킬 + 메모리 + 레포맵)"}
              </span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">systemPrompt</span> ={" "}
              <span className="fn">buildSystemPrompt</span>({"{"}...{"}"});
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [5] 메시지 조합 + 컨텍스트 압축"}</span>
              {"\n"}
              {"  "}
              <span className="kw">let</span> <span className="prop">messages</span> = [
              <span className="prop">system</span>, ...<span className="prop">history</span>,{" "}
              <span className="prop">user</span>];
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">contextManager</span>){" "}
              <span className="prop">messages</span> = <span className="kw">await</span>{" "}
              <span className="prop">contextManager</span>.<span className="fn">prepare</span>(
              <span className="prop">messages</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [6] 에이전트 루프 실행"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">runAgentLoop</span>(
              <span className="prop">config</span>, <span className="prop">messages</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [7] 결과 저장: conversation + session"}</span>
              {"\n"}
              {"  "}
              <span className="cm">{"// [8] 메시지 큐 처리"}</span>
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 대화 히스토리에 사용자 메시지를
                추가하고, 처리 중 플래그를 설정합니다. AbortController를 생성하여 취소를 지원합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> ActivityCollector에 새 턴을 시작하여
                도구 호출, LLM 응답 등의 활동을 기록합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> UserPromptSubmit 훅이 설정되어 있으면
                실행합니다. 훅이 <code className="text-cyan-600">blocked: true</code>를 반환하면
                처리를 중단합니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> 프로젝트 지침(DBCODE.md), 스킬
                프롬프트, 자동 메모리, 레포맵을 조합하여 시스템 프롬프트를 빌드합니다.
              </p>
              <p>
                <strong className="text-gray-900">[5]</strong> 시스템 메시지, 대화 히스토리, 새
                사용자 메시지를 하나의 배열로 조합합니다. ContextManager가 있으면 토큰 초과를
                방지하기 위해 압축합니다.
              </p>
              <p>
                <strong className="text-gray-900">[6]</strong> Core 레이어의{" "}
                <code className="text-cyan-600">runAgentLoop</code>을 호출하여 LLM ↔ 도구 반복
                실행을 수행합니다.
              </p>
              <p>
                <strong className="text-gray-900">[7-8]</strong> 결과 메시지를 대화 히스토리와 세션
                파일에 저장하고, 메시지 큐에 대기 메시지가 있으면 다음 처리를 시작합니다.
              </p>
            </div>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              이벤트 기반 UI 업데이트
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">useAgentLoop</code>은 11개의 이벤트를 구독하여 Core
              레이어의 상태 변화를 React 상태에 실시간으로 반영합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 이벤트 → React 상태 매핑"}</span>
              {"\n"}
              <span className="str">&quot;tool:start&quot;</span>
              {"       → "}
              <span className="fn">activityRef</span>.<span className="fn">addEntry</span>(
              <span className="str">&quot;tool-start&quot;</span>){"\n"}
              <span className="str">&quot;tool:complete&quot;</span>
              {"    → "}
              <span className="fn">activityRef</span>.<span className="fn">addEntry</span>(
              <span className="str">&quot;tool-complete&quot;</span>){"\n"}
              <span className="str">&quot;tool:output-delta&quot;</span>
              {" → "}
              <span className="fn">streamingOutputsRef</span>.<span className="fn">set</span>()
              {"\n"}
              <span className="str">&quot;llm:thinking-delta&quot;</span> →{" "}
              <span className="fn">thinkingContentRef</span> 누적
              {"\n"}
              <span className="str">&quot;llm:text-delta&quot;</span>
              {"   → "}
              <span className="fn">appendText</span>() + <span className="fn">agentPhase</span> ={" "}
              <span className="str">&quot;llm-streaming&quot;</span>
              {"\n"}
              <span className="str">&quot;llm:start&quot;</span>
              {"        → "}
              <span className="fn">agentPhase</span> ={" "}
              <span className="str">&quot;llm-thinking&quot;</span>
              {"\n"}
              <span className="str">&quot;agent:assistant-message&quot;</span> → thinking 플러시 +
              isFinal 처리
              {"\n"}
              <span className="str">&quot;agent:tools-executing&quot;</span>
              {"  → "}
              <span className="fn">agentPhase</span> ={" "}
              <span className="str">&quot;tools-running&quot;</span>
              {"\n"}
              <span className="str">&quot;agent:tools-done&quot;</span>
              {"      → "}
              <span className="fn">agentPhase</span> ={" "}
              <span className="str">&quot;tools-done&quot;</span>
              {"\n"}
              <span className="str">&quot;agent:usage-update&quot;</span>
              {"    → "}
              <span className="fn">inputTokens</span>, <span className="fn">outputTokens</span>,{" "}
              <span className="fn">totalCost</span> 업데이트
              {"\n"}
              <span className="str">&quot;ask_user:prompt&quot;</span>
              {"      → "}
              <span className="fn">setPendingAskUser</span>()
              {"\n"}
              <span className="str">&quot;agent:retry&quot;</span>
              {"          → "}
              <span className="fn">setRetryInfo</span>()
            </CodeBlock>

            <DeepDive title="토큰/비용 추적 상세">
              <p className="mb-3">
                <code className="text-cyan-600">agent:usage-update</code> 이벤트가 발생할 때마다
                델타(증분) 방식으로 토큰 수와 비용을 계산합니다.
              </p>
              <CodeBlock>
                <span className="cm">{"// 델타 계산 (이전 값과의 차이)"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">deltaPrompt</span> ={" "}
                <span className="prop">data</span>.<span className="prop">promptTokens</span> -{" "}
                <span className="prop">prevUsageRef</span>.<span className="prop">current</span>.
                <span className="prop">prompt</span>;{"\n"}
                <span className="kw">const</span> <span className="prop">deltaCompletion</span> ={" "}
                <span className="prop">data</span>.<span className="prop">completionTokens</span> -{" "}
                <span className="prop">prevUsageRef</span>.<span className="prop">current</span>.
                <span className="prop">completion</span>;{"\n"}
                {"\n"}
                <span className="cm">{"// 비용 계산 (모델별 가격표 참조)"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">caps</span> ={" "}
                <span className="fn">getModelCapabilities</span>(
                <span className="prop">activeModel</span>);
                {"\n"}
                <span className="kw">const</span> <span className="prop">deltaCost</span> ={"\n"}
                {"  "}(<span className="prop">deltaPrompt</span> /{" "}
                <span className="num">1_000_000</span>) * <span className="prop">caps</span>.
                <span className="prop">pricing</span>.<span className="prop">inputPerMillion</span>{" "}
                +{"\n"}
                {"  "}(<span className="prop">deltaCompletion</span> /{" "}
                <span className="num">1_000_000</span>) * <span className="prop">caps</span>.
                <span className="prop">pricing</span>.<span className="prop">outputPerMillion</span>
                ;
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                <code className="text-cyan-600">prevUsageRef</code>를 사용하는 이유는 에이전트
                루프가 여러 반복(iteration)을 거치면서 누적 토큰을 보고하기 때문입니다. 이전
                보고와의 차이를 계산해야 정확한 증분값을 얻을 수 있습니다.
              </p>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ─── 5. 트러블슈팅 (Troubleshooting) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔧</span> 트러블슈팅
            </h2>

            {/* FAQ 1 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Escape 키를 눌렀는데 에이전트가 멈추지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                두 가지를 확인하세요:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>이벤트 연결:</strong> <code className="text-cyan-600">input:abort</code>{" "}
                  이벤트가 정상적으로 발생하는지 확인하세요. 키보드 이벤트 핸들러에서{" "}
                  <code className="text-cyan-600">events.emit(&quot;input:abort&quot;)</code>가
                  호출되어야 합니다.
                </li>
                <li>
                  <strong>AbortController 상태:</strong>{" "}
                  <code className="text-cyan-600">abortControllerRef.current</code>가
                  <code className="text-cyan-600">null</code>이면 에이전트 루프가 실행 중이 아닌
                  것입니다.
                  <code className="text-cyan-600">isProcessing</code> 상태를 확인하세요.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;/model로 모델을 전환했는데 이전 모델로 계속 요청이 가요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">activeModel</code>은{" "}
                <code className="text-cyan-600">useState</code>로 관리되지만,{" "}
                <code className="text-cyan-600">client</code>는{" "}
                <code className="text-cyan-600">useRef</code>로 관리됩니다. 두 가지를 모두
                확인하세요:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <code className="text-cyan-600">result.newProvider</code>가 반환되면{" "}
                  <code className="text-cyan-600">clientRef.current</code>가 새 클라이언트로
                  교체되어야 합니다.
                </li>
                <li>
                  <code className="text-cyan-600">activeStrategy</code>는{" "}
                  <code className="text-cyan-600">useMemo</code>로
                  <code className="text-cyan-600">activeModel</code>에 연동되므로, 모델이 변경되면
                  자동 재계산됩니다.
                </li>
              </ul>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;에이전트 처리 중에 보낸 메시지가 사라졌어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                처리 중 입력된 메시지는 <code className="text-cyan-600">messageQueueRef</code>에
                저장됩니다. 현재 처리가 완료되면 <code className="text-cyan-600">finally</code>{" "}
                블록에서 자동으로 꺼내져 처리됩니다. 메시지가 실제로 사라진 것이 아니라 대기 중인
                것입니다.
              </p>
              <Callout type="tip" icon="*">
                큐는 <code>useRef</code>이므로 UI에 &quot;대기 중인 메시지 N개&quot; 같은 표시가
                없습니다. 큐 상태를 확인하려면 <code>messageQueueRef.current.length</code>를
                체크하세요.
              </Callout>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;토큰 비용이 실제보다 적게 표시돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                비용 계산은 <code className="text-cyan-600">getModelCapabilities</code>의 가격표에
                의존합니다. 모델 가격이 업데이트되었는데{" "}
                <code className="text-cyan-600">model-capabilities.ts</code>에 반영되지 않았다면
                실제 비용과 차이가 생깁니다. 또한 델타 계산 방식이므로,
                <code className="text-cyan-600">prevUsageRef</code>가 초기화되지 않으면 첫 번째
                반복의 토큰이 누락될 수 있습니다.
              </p>
            </div>

            {/* FAQ 5 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;스트리밍 텍스트가 끊기거나 깜빡여요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">useTextBuffering(100)</code>이 100ms 간격으로
                텍스트를 버퍼링합니다. LLM 응답이 매우 빠르게 오면 한 번에 많은 텍스트가 표시되어
                깜빡임처럼 보일 수 있습니다. <code className="text-cyan-600">llm:text-delta</code>{" "}
                이벤트 빈도를 확인하고, 버퍼링 간격을 조정해 보세요.
              </p>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 6. 관련 문서 (See Also) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔗</span> 관련 문서
            </h2>
            <SeeAlso
              items={[
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "child",
                  desc: "useAgentLoop이 호출하는 Core 레이어의 에이전트 루프 — LLM ↔ 도구 반복 실행 엔진",
                },
                {
                  name: "system-prompt-builder.ts",
                  slug: "system-prompt-builder",
                  relation: "child",
                  desc: "processMessage에서 호출하는 시스템 프롬프트 조립기 — 지침, 스킬, 메모리 통합",
                },
                {
                  name: "context-manager.ts",
                  slug: "context-manager",
                  relation: "child",
                  desc: "메시지 배열을 토큰 한도 내로 압축하는 3-Layer 컨텍스트 관리자",
                },
                {
                  name: "ActivityFeed",
                  slug: "activity-feed",
                  relation: "sibling",
                  desc: "useAgentLoop의 completedTurns/liveTurn을 표시하는 UI 컴포넌트",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
