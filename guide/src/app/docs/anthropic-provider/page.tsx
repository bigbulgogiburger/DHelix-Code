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

export default function AnthropicProviderPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/llm/providers/anthropic.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              AnthropicProvider
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            Anthropic Messages API를 직접 호출하여 Claude 모델과 통신하는 네이티브 프로바이더입니다.
          </p>
        </div>
      </RevealOnScroll>

      {/* ─── 1. 개요 (Overview) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📋</span> 개요
          </h2>
          <div className="text-[14px] text-gray-600 leading-[1.85] mb-8 space-y-3">
            <p>
              <code className="text-cyan-600">AnthropicProvider</code>는 OpenAI SDK에 의존하지 않고
              <code className="text-cyan-600">fetch</code>로 Anthropic의 Messages API를 직접 호출합니다.
              이를 통해 Anthropic 전용 기능(Extended Thinking, 프롬프트 캐싱, 529 과부하 처리 등)을
              네이티브하게 지원합니다.
            </p>
            <p>
              내부적으로 <code className="text-cyan-600">ChatMessage</code> 배열을 Anthropic 형식으로 변환하고,
              SSE(Server-Sent Events)를 직접 파싱하여 스트리밍을 구현합니다.
              시스템 메시지는 별도의 <code className="text-cyan-600">system</code> 파라미터로 분리되며,
              도구 결과는 <code className="text-cyan-600">user</code> 역할의 <code className="text-cyan-600">tool_result</code> 블록으로 전달됩니다.
            </p>
            <p>
              자동 재시도 로직이 내장되어 있어, 일시적 에러(500, 502, 503)는 지수 백오프로 최대 3회,
              Rate Limit(429, 529)은 더 긴 백오프로 최대 5회 재시도합니다.
            </p>
          </div>

          <MermaidDiagram
            title="AnthropicProvider 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  ROUTER["ModelRouter<br/><small>model-router.ts</small>"]
  RESOLVE["resolveProvider()<br/><small>'claude-*' 모델 감지</small>"]
  AP["AnthropicProvider<br/><small>providers/anthropic.ts</small>"]
  CONVERT["extractSystemAndMessages()<br/><small>메시지 형식 변환</small>"]
  SSE["parseSSEStream()<br/><small>SSE 스트림 파싱</small>"]
  API["Anthropic Messages API<br/><small>api.anthropic.com</small>"]

  ROUTER -->|"claude-* 모델"| RESOLVE
  RESOLVE -->|"생성"| AP
  AP -->|"메시지 변환"| CONVERT
  AP -->|"스트리밍"| SSE
  AP -->|"fetch"| API

  style AP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style ROUTER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RESOLVE fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CONVERT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style SSE fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style API fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>왜 SDK 없이 직접 구현?</strong> Anthropic의 Messages API는 OpenAI Chat Completions API와
            구조가 다릅니다. 시스템 메시지가 별도 파라미터이고, 콘텐츠가 블록 배열이며,
            529 상태 코드가 과부하를 의미합니다. 직접 구현하면 이런 차이를 정확히 처리할 수 있고,
            SDK 의존성도 줄어듭니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* AnthropicProviderConfig */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface AnthropicProviderConfig
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            프로바이더 생성 시 전달하는 설정 객체입니다.
            모든 필드가 선택적이며, 미지정 시 환경변수나 기본값을 사용합니다.
          </p>
          <ParamTable
            params={[
              { name: "apiKey", type: "string", required: false, desc: "API 키 — 없으면 ANTHROPIC_API_KEY 환경변수에서 읽음" },
              { name: "baseURL", type: "string", required: false, desc: "API 엔드포인트 URL — 프록시 사용 시 변경 (기본: api.anthropic.com)" },
              { name: "timeout", type: "number", required: false, desc: "요청 타임아웃(밀리초) — 기본값 120,000 (2분)" },
              { name: "eventEmitter", type: "AppEventEmitter", required: false, desc: "이벤트 발행기 — 캐시 통계 등의 이벤트를 외부에 알림" },
            ]}
          />

          {/* Anthropic 전용 타입들 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            Anthropic 콘텐츠 블록 타입
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            Anthropic API 응답은 <code className="text-cyan-600">content</code> 배열에 여러 블록이 포함됩니다.
            텍스트, 사고, 도구 호출이 모두 같은 배열에 섞여 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">type</span> <span className="type">AnthropicContentBlock</span> =
            {"\n"}{"  "}| <span className="type">AnthropicTextBlock</span>       <span className="cm">{"// { type: 'text', text: string }"}</span>
            {"\n"}{"  "}| <span className="type">AnthropicThinkingBlock</span>   <span className="cm">{"// { type: 'thinking', thinking: string }"}</span>
            {"\n"}{"  "}| <span className="type">AnthropicToolUseBlock</span>;   <span className="cm">{"// { type: 'tool_use', id, name, input }"}</span>
          </CodeBlock>

          {/* AnthropicProvider class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class AnthropicProvider
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">LLMProvider</code> 인터페이스를 구현하는 Anthropic 전용 클래스입니다.
            <code className="text-cyan-600">name</code> 프로퍼티는 <code className="text-cyan-600">&quot;anthropic&quot;</code>입니다.
          </p>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            constructor(config?)
          </h4>
          <CodeBlock>
            <span className="kw">constructor</span>(<span className="prop">config</span>?: <span className="type">AnthropicProviderConfig</span>)
          </CodeBlock>
          <p className="text-[13px] text-gray-600 mt-2 mb-4">
            API 키가 없으면 <code className="text-cyan-600">ANTHROPIC_API_KEY</code> 환경변수에서 읽습니다.
            환경변수도 없으면 <code className="text-red-600">LLMError</code>를 throw합니다.
          </p>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            chat(request)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            동기식 채팅 요청을 수행합니다. 내부적으로 재시도 로직이 포함되어 있습니다.
          </p>
          <CodeBlock>
            <span className="fn">chat</span>(<span className="prop">request</span>: <span className="type">ChatRequest</span>): <span className="type">Promise</span>&lt;<span className="type">ChatResponse</span>&gt;
          </CodeBlock>
          <ParamTable
            params={[
              { name: "request", type: "ChatRequest", required: true, desc: "채팅 요청 — 모델, 메시지, 도구 등 포함" },
            ]}
          />

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            stream(request)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            스트리밍 채팅 요청을 수행합니다. SSE를 직접 파싱하여 <code className="text-cyan-600">ChatChunk</code>를 yield합니다.
            스트리밍 유휴 타임아웃이 적용되어, 일정 시간 청크가 안 오면 자동으로 중단됩니다.
          </p>
          <CodeBlock>
            <span className="fn">stream</span>(<span className="prop">request</span>: <span className="type">ChatRequest</span>): <span className="type">AsyncIterable</span>&lt;<span className="type">ChatChunk</span>&gt;
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            countTokens(text)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            텍스트의 토큰 수를 계산합니다.
          </p>
          <CodeBlock>
            <span className="fn">countTokens</span>(<span className="prop">text</span>: <span className="type">string</span>): <span className="type">number</span>
          </CodeBlock>

          {/* 내부 유틸리티 함수 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            내부 유틸리티 함수
          </h3>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            extractSystemAndMessages(messages)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            내부 <code className="text-cyan-600">ChatMessage</code> 배열에서 시스템 메시지를 분리하고
            나머지를 Anthropic 형식으로 변환합니다.
          </p>
          <CodeBlock>
            <span className="fn">extractSystemAndMessages</span>(<span className="prop">messages</span>: <span className="kw">readonly</span> <span className="type">ChatMessage</span>[]): {"{"}
            {"\n"}{"  "}<span className="prop">system</span>: <span className="type">string</span> | <span className="type">undefined</span>;
            {"\n"}{"  "}<span className="prop">messages</span>: <span className="type">Array</span>&lt;<span className="type">Record</span>&lt;<span className="type">string</span>, <span className="type">unknown</span>&gt;&gt;;
            {"\n"}{"}"}
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            toAnthropicTools(tools)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            OpenAI 형식의 도구 정의를 Anthropic의 <code className="text-cyan-600">input_schema</code> 형식으로 변환합니다.
          </p>
          <CodeBlock>
            <span className="fn">toAnthropicTools</span>(<span className="prop">tools</span>: <span className="kw">readonly</span> <span className="type">ToolDefinitionForLLM</span>[]): <span className="type">AnthropicTool</span>[]
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              Anthropic API는 <code className="text-cyan-600">system</code> 메시지를 별도 파라미터로 받습니다.
              OpenAI처럼 <code className="text-cyan-600">messages</code> 배열에 넣으면 에러가 발생합니다.
            </li>
            <li>
              <code className="text-cyan-600">tool</code> 역할의 메시지는 Anthropic에서 <code className="text-cyan-600">user</code> 역할의
              <code className="text-cyan-600">tool_result</code> 블록으로 변환됩니다.
            </li>
            <li>
              HTTP 529 상태 코드는 Anthropic 전용 과부하 코드입니다.
              일반적인 HTTP 표준에는 없으며, Rate Limit(429)과 동일하게 처리됩니다.
            </li>
            <li>
              <code className="text-cyan-600">ANTHROPIC_API_KEY</code> 환경변수가 필수입니다.
              설정하지 않으면 생성자에서 즉시 에러가 발생합니다.
            </li>
          </ul>
        </section>
      </RevealOnScroll>

      {/* ─── 3. 사용법 (Usage) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🚀</span> 사용법
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; resolveProvider를 통한 자동 생성</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            일반적으로 직접 생성하지 않고 <code className="text-cyan-600">resolveProvider()</code>가 모델 이름을 보고 자동으로 생성합니다.
            <code className="text-cyan-600">&quot;claude-&quot;</code>로 시작하는 모델명이면 이 프로바이더가 선택됩니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// resolveProvider가 자동으로 AnthropicProvider를 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">provider</span> = <span className="fn">resolveProvider</span>(<span className="str">&quot;claude-sonnet-4-20250514&quot;</span>);
            {"\n"}
            {"\n"}<span className="kw">const</span> <span className="prop">response</span> = <span className="kw">await</span> <span className="prop">provider</span>.<span className="fn">chat</span>({"{"}
            {"\n"}{"  "}<span className="prop">model</span>: <span className="str">&quot;claude-sonnet-4-20250514&quot;</span>,
            {"\n"}{"  "}<span className="prop">messages</span>: [{"{"}
            {"\n"}{"    "}<span className="prop">role</span>: <span className="str">&quot;user&quot;</span>,
            {"\n"}{"    "}<span className="prop">content</span>: <span className="str">&quot;이 코드를 리뷰해주세요&quot;</span>,
            {"\n"}{"  "}{"}"}],
            {"\n"}{"}"});
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> 직접 <code>AnthropicProvider</code>를 생성할 때는 반드시
            <code>ANTHROPIC_API_KEY</code> 환경변수가 설정되어 있어야 합니다.
            키가 없으면 생성자에서 즉시 <code>LLMError</code>가 throw됩니다.
          </Callout>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; Extended Thinking 활성화
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            Claude의 Extended Thinking을 활성화하면 모델이 답변 전에 깊이 생각하는 과정을 거칩니다.
            <code className="text-cyan-600">thinking</code> 필드로 사고 과정을 확인할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">response</span> = <span className="kw">await</span> <span className="prop">provider</span>.<span className="fn">chat</span>({"{"}
            {"\n"}{"  "}<span className="prop">model</span>: <span className="str">&quot;claude-sonnet-4-20250514&quot;</span>,
            {"\n"}{"  "}<span className="prop">messages</span>: [{"{ "}<span className="prop">role</span>: <span className="str">&quot;user&quot;</span>, <span className="prop">content</span>: <span className="str">&quot;복잡한 아키텍처 설계&quot;</span>{" }"}],
            {"\n"}{"  "}<span className="prop">thinking</span>: {"{"}
            {"\n"}{"    "}<span className="prop">type</span>: <span className="str">&quot;enabled&quot;</span>,
            {"\n"}{"    "}<span className="prop">budget_tokens</span>: <span className="num">16000</span>,
            {"\n"}{"  "}{"}"},
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 사고 과정 확인"}</span>
            {"\n"}<span className="kw">if</span> (<span className="prop">response</span>.<span className="prop">thinking</span>) {"{"}
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">&quot;사고 과정:&quot;</span>, <span className="prop">response</span>.<span className="prop">thinking</span>);
            {"\n"}{"}"}
          </CodeBlock>

          <DeepDive title="메시지 형식 변환 상세">
            <p className="mb-3">
              Anthropic API는 OpenAI와 메시지 구조가 다릅니다. <code className="text-cyan-600">extractSystemAndMessages()</code>가
              다음과 같이 변환합니다:
            </p>
            <div className="text-[13px] text-gray-600 space-y-2">
              <p><strong className="text-gray-900">system 메시지</strong> &mdash; <code className="text-cyan-600">messages</code> 배열에서 분리되어 별도의 <code className="text-cyan-600">system</code> 파라미터로 전달됩니다. 여러 개이면 줄바꿈으로 합칩니다.</p>
              <p><strong className="text-gray-900">tool 메시지</strong> &mdash; <code className="text-cyan-600">user</code> 역할의 <code className="text-cyan-600">tool_result</code> 블록으로 변환됩니다. Anthropic은 도구 결과를 user 역할의 특수 블록으로 받습니다.</p>
              <p><strong className="text-gray-900">assistant + toolCalls</strong> &mdash; 텍스트 블록과 <code className="text-cyan-600">tool_use</code> 블록을 하나의 <code className="text-cyan-600">content</code> 배열에 포함시킵니다.</p>
              <p><strong className="text-gray-900">도구 정의</strong> &mdash; OpenAI의 <code className="text-cyan-600">parameters</code>가 Anthropic의 <code className="text-cyan-600">input_schema</code>로 매핑됩니다.</p>
            </div>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>재시도 전략 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            HTTP 상태 코드에 따라 재시도 여부와 대기 시간이 결정됩니다.
            Rate Limit 에러는 더 긴 백오프를, 일시적 에러는 표준 백오프를 적용합니다.
          </p>

          <MermaidDiagram
            title="재시도 전략 흐름"
            titleColor="purple"
            chart={`graph TD
  REQ["HTTP 요청<br/><small>fetch → Anthropic API</small>"]
  CHECK{"상태 코드<br/>확인"}
  OK["200 OK<br/><small>응답 반환</small>"]
  RL["429 / 529<br/><small>Rate Limit</small>"]
  TRANS["500 / 502 / 503<br/><small>일시적 에러</small>"]
  AUTH["401 / 403<br/><small>인증 에러</small>"]
  PERM["기타 에러<br/><small>영구적 에러</small>"]
  RL_RETRY["재시도 (최대 5회)<br/><small>5초 → 10초 → 20초 → 40초 → 60초</small>"]
  TR_RETRY["재시도 (최대 3회)<br/><small>1초 → 2초 → 4초</small>"]
  FAIL["LLMError throw<br/><small>재시도 불가</small>"]

  REQ --> CHECK
  CHECK -->|"200"| OK
  CHECK -->|"429/529"| RL
  CHECK -->|"500/502/503"| TRANS
  CHECK -->|"401/403"| AUTH
  CHECK -->|"기타"| PERM
  RL --> RL_RETRY
  TRANS --> TR_RETRY
  AUTH --> FAIL
  PERM --> FAIL
  RL_RETRY -->|"재시도"| REQ
  TR_RETRY -->|"재시도"| REQ

  style REQ fill:#dbeafe,stroke:#3b82f6,color:#1e293b,stroke-width:2px
  style OK fill:#dcfce7,stroke:#10b981,color:#1e293b
  style RL fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style TRANS fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style AUTH fill:#fee2e2,stroke:#ef4444,color:#1e293b
  style PERM fill:#fee2e2,stroke:#ef4444,color:#1e293b
  style RL_RETRY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style TR_RETRY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style FAIL fill:#fee2e2,stroke:#ef4444,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 상수</h3>
          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">ANTHROPIC_API_URL</strong> &mdash; <code className="text-cyan-600">&quot;https://api.anthropic.com/v1/messages&quot;</code> (기본 엔드포인트)</p>
            <p><strong className="text-gray-900">ANTHROPIC_VERSION</strong> &mdash; <code className="text-cyan-600">&quot;2023-06-01&quot;</code> (API 버전 헤더)</p>
            <p><strong className="text-gray-900">MAX_RETRIES_TRANSIENT</strong> &mdash; <code className="text-cyan-600">3</code> (일시적 에러 최대 재시도)</p>
            <p><strong className="text-gray-900">MAX_RETRIES_RATE_LIMIT</strong> &mdash; <code className="text-cyan-600">5</code> (Rate Limit 최대 재시도)</p>
            <p><strong className="text-gray-900">BASE_RETRY_DELAY_MS</strong> &mdash; <code className="text-cyan-600">1,000</code>ms (일시적 에러 기본 대기)</p>
            <p><strong className="text-gray-900">BASE_RATE_LIMIT_DELAY_MS</strong> &mdash; <code className="text-cyan-600">5,000</code>ms (Rate Limit 기본 대기)</p>
            <p><strong className="text-gray-900">MAX_RATE_LIMIT_DELAY_MS</strong> &mdash; <code className="text-cyan-600">60,000</code>ms (Rate Limit 최대 대기)</p>
          </div>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>SSE 스트림 파싱</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">parseSSEStream()</code> 제너레이터가 ReadableStream에서
            SSE 이벤트를 실시간으로 파싱합니다. 불완전한 줄은 버퍼에 유지하고,
            <code className="text-cyan-600">event:</code>와 <code className="text-cyan-600">data:</code> 접두사를 분석합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// SSE 프로토콜 형식"}</span>
            {"\n"}<span className="str">event: content_block_delta</span>
            {"\n"}<span className="str">{"data: {\"type\":\"content_block_delta\",\"delta\":{...}}"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 파싱 후 yield되는 이벤트 타입들"}</span>
            {"\n"}<span className="kw">type</span> <span className="type">AnthropicStreamEvent</span> =
            {"\n"}{"  "}| <span className="type">MessageStartEvent</span>       <span className="cm">{"// 스트리밍 시작"}</span>
            {"\n"}{"  "}| <span className="type">ContentBlockStartEvent</span>  <span className="cm">{"// 새 블록 시작"}</span>
            {"\n"}{"  "}| <span className="type">ContentBlockDeltaEvent</span>  <span className="cm">{"// 블록 내용 전달"}</span>
            {"\n"}{"  "}| <span className="type">ContentBlockStopEvent</span>   <span className="cm">{"// 블록 종료"}</span>
            {"\n"}{"  "}| <span className="type">MessageDeltaEvent</span>       <span className="cm">{"// 최종 메타데이터"}</span>
            {"\n"}{"  "}| <span className="type">MessageStopEvent</span>;       <span className="cm">{"// 스트리밍 완료"}</span>
          </CodeBlock>

          <DeepDive title="stop_reason → finishReason 매핑">
            <p className="mb-3">
              Anthropic의 <code className="text-cyan-600">stop_reason</code>을 내부 인터페이스의 OpenAI 스타일
              <code className="text-cyan-600">finishReason</code>으로 변환합니다:
            </p>
            <div className="text-[13px] text-gray-600 space-y-1">
              <p>&bull; <code className="text-cyan-600">&quot;end_turn&quot;</code> &rarr; <code className="text-emerald-600">&quot;stop&quot;</code> (정상 종료)</p>
              <p>&bull; <code className="text-cyan-600">&quot;max_tokens&quot;</code> &rarr; <code className="text-amber-600">&quot;length&quot;</code> (토큰 한도 도달)</p>
              <p>&bull; <code className="text-cyan-600">&quot;tool_use&quot;</code> &rarr; <code className="text-purple-600">&quot;tool_calls&quot;</code> (도구 사용 요청)</p>
              <p>&bull; <code className="text-cyan-600">&quot;stop_sequence&quot;</code> &rarr; <code className="text-emerald-600">&quot;stop&quot;</code> (중단 시퀀스)</p>
            </div>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 5. 트러블슈팅 (Troubleshooting) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔧</span> 트러블슈팅
          </h2>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;ANTHROPIC_API_KEY is required 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">ANTHROPIC_API_KEY</code> 환경변수를 설정하세요.
              <code className="text-cyan-600">.env</code> 파일에 추가하거나, 실행 시 직접 전달할 수 있습니다.
              프록시를 사용하는 경우 <code className="text-cyan-600">baseURL</code>도 함께 설정해야 합니다.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Rate limit exceeded 에러가 반복돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              자동 재시도가 5회까지 시도하지만, 지속적인 Rate Limit이면 근본적인 원인을 확인하세요:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-1 list-disc list-inside">
              <li>API 요금제의 분당 토큰/요청 한도를 확인하세요</li>
              <li>여러 인스턴스가 동시에 같은 키를 사용하는지 확인하세요</li>
              <li>ModelRouter의 fallback 모델을 설정하면 자동으로 대체됩니다</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;스트리밍 응답이 중간에 끊겨요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              스트리밍 유휴 타임아웃이 적용되어 있습니다. 일정 시간 동안 청크가 수신되지 않으면
              자동으로 중단됩니다. 네트워크 상태를 확인하거나, 프록시를 사용하는 경우
              프록시의 타임아웃 설정도 확인하세요.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;529 상태 코드가 뭔가요?&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              HTTP 529는 Anthropic 전용 상태 코드로, 서버 과부하를 의미합니다.
              표준 HTTP에는 없는 코드이며, dbcode에서는 429(Rate Limit)와 동일하게
              최대 5회 재시도하며 더 긴 백오프(5초 기본)를 적용합니다.
            </p>
          </div>
        </section>
      </RevealOnScroll>

      {/* ─── 6. 관련 문서 (See Also) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔗</span> 관련 문서
          </h2>
          <SeeAlso
            items={[
              {
                name: "provider.ts",
                slug: "llm-provider",
                relation: "parent",
                desc: "AnthropicProvider가 구현하는 LLMProvider 인터페이스 및 핵심 타입 정의",
              },
              {
                name: "model-router.ts",
                slug: "model-router",
                relation: "sibling",
                desc: "resolveProvider()가 'claude-*' 모델을 감지하여 AnthropicProvider를 생성하는 라우터",
              },
              {
                name: "responses-client.ts",
                slug: "responses-client",
                relation: "sibling",
                desc: "Codex 모델 전용 Responses API 클라이언트 — 유사한 재시도 패턴 사용",
              },
              {
                name: "token-counter.ts",
                slug: "token-counter",
                relation: "sibling",
                desc: "countTokens() 메서드의 실제 토큰 계산 로직",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
