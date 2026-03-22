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

export default function LLMProviderPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/llm/provider.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              LLMProvider
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            모든 LLM 클라이언트가 구현해야 하는 공통 인터페이스와 핵심 타입을 정의하는 모듈입니다.
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
              <code className="text-cyan-600">provider.ts</code>는 dbcode의 LLM 계층에서 가장 근본적인 파일입니다.
              OpenAI, Anthropic, Ollama 등 다양한 LLM 프로바이더가 하나의 통일된 인터페이스를 구현하도록
              <strong> 공통 계약(contract)</strong>을 정의합니다.
            </p>
            <p>
              채팅 메시지(<code className="text-cyan-600">ChatMessage</code>), 요청(<code className="text-cyan-600">ChatRequest</code>),
              응답(<code className="text-cyan-600">ChatResponse</code>), 스트리밍 청크(<code className="text-cyan-600">ChatChunk</code>),
              도구 호출(<code className="text-cyan-600">ToolCallRequest</code>) 등 LLM 통신에 필요한 모든 타입이 이 파일에 집중되어 있습니다.
            </p>
            <p>
              이 파일 자체는 구현이 없는 순수한 타입/인터페이스 정의이며, 실제 구현은
              <code className="text-cyan-600">AnthropicProvider</code>, <code className="text-cyan-600">OpenAICompatibleClient</code>,
              <code className="text-cyan-600">ResponsesAPIClient</code> 등의 프로바이더 클래스에서 이루어집니다.
            </p>
          </div>

          <MermaidDiagram
            title="LLMProvider 인터페이스 의존 관계"
            titleColor="purple"
            chart={`graph TD
  PROVIDER["LLMProvider<br/><small>provider.ts — 공통 인터페이스</small>"]
  ANTHROPIC["AnthropicProvider<br/><small>providers/anthropic.ts</small>"]
  OPENAI["OpenAICompatibleClient<br/><small>client.ts</small>"]
  RESPONSES["ResponsesAPIClient<br/><small>responses-client.ts</small>"]
  ROUTER["ModelRouter<br/><small>model-router.ts</small>"]
  AGENT["Agent Loop<br/><small>core/agent-loop.ts</small>"]

  ANTHROPIC -->|"implements"| PROVIDER
  OPENAI -->|"implements"| PROVIDER
  RESPONSES -->|"implements"| PROVIDER
  ROUTER -->|"implements"| PROVIDER
  AGENT -->|"사용"| PROVIDER
  ROUTER -->|"주/대체 모델 위임"| PROVIDER

  style PROVIDER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style ANTHROPIC fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style OPENAI fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RESPONSES fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style ROUTER fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style AGENT fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>다형성 패턴:</strong> 에이전트 루프는 <code>LLMProvider</code> 인터페이스만 알면 됩니다.
            실제로 어떤 프로바이더가 사용되는지 몰라도 <code>chat()</code>과 <code>stream()</code>을 동일하게
            호출할 수 있습니다. 이것이 인터페이스 기반 설계의 핵심 장점입니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* ChatRole type */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            type ChatRole
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            채팅 메시지의 발신자를 구분하는 유니온 타입입니다.
          </p>
          <CodeBlock>
            <span className="kw">type</span> <span className="type">ChatRole</span> = <span className="str">&quot;system&quot;</span> | <span className="str">&quot;user&quot;</span> | <span className="str">&quot;assistant&quot;</span> | <span className="str">&quot;tool&quot;</span>;
          </CodeBlock>
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <code className="text-cyan-600">&quot;system&quot;</code> &mdash; 시스템 지시사항 (LLM의 행동 규칙을 설정)</p>
            <p>&bull; <code className="text-cyan-600">&quot;user&quot;</code> &mdash; 사용자가 보낸 메시지</p>
            <p>&bull; <code className="text-cyan-600">&quot;assistant&quot;</code> &mdash; LLM이 생성한 응답 메시지</p>
            <p>&bull; <code className="text-cyan-600">&quot;tool&quot;</code> &mdash; 도구 실행 결과 메시지 (함수 호출 후 반환값)</p>
          </div>

          {/* ChatMessage interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ChatMessage
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            대화 기록의 기본 단위입니다. 모든 LLM 통신은 이 메시지의 배열을 주고받습니다.
          </p>
          <ParamTable
            params={[
              { name: "role", type: "ChatRole", required: true, desc: "메시지를 보낸 주체 (system, user, assistant, tool)" },
              { name: "content", type: "string", required: true, desc: "메시지 본문 텍스트" },
              { name: "name", type: "string", required: false, desc: "메시지 발신자 이름 (일부 API에서 사용)" },
              { name: "toolCallId", type: "string", required: false, desc: "도구 호출 ID — role이 'tool'일 때 어떤 호출에 대한 응답인지 식별" },
              { name: "toolCalls", type: "readonly ToolCallRequest[]", required: false, desc: "LLM이 요청한 도구 호출 목록 — role이 'assistant'일 때 사용" },
            ]}
          />

          {/* ToolCallRequest interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ToolCallRequest
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            LLM이 특정 도구(함수)를 실행해 달라고 보내는 요청입니다.
            LLM은 자체적으로 파일을 읽거나 명령어를 실행할 수 없으므로, 도구 호출을 통해 외부 기능을 사용합니다.
          </p>
          <ParamTable
            params={[
              { name: "id", type: "string", required: true, desc: "고유 식별자 — 요청과 응답을 매칭하는 데 사용" },
              { name: "name", type: "string", required: true, desc: "호출할 도구의 이름 (예: 'file_read', 'bash_exec')" },
              { name: "arguments", type: "string", required: true, desc: "도구에 전달할 인자 (JSON 문자열 형태)" },
            ]}
          />

          {/* ChatRequest interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ChatRequest
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            모델에게 보내는 채팅 완성(chat completion) 요청입니다.
            대화 기록, 사용할 모델, 도구 목록 등을 포함합니다.
          </p>
          <ParamTable
            params={[
              { name: "model", type: "string", required: true, desc: "사용할 모델 이름 (예: 'gpt-4o', 'claude-sonnet-4-20250514')" },
              { name: "messages", type: "readonly ChatMessage[]", required: true, desc: "대화 메시지 목록 — 시스템 지시사항 + 대화 기록" },
              { name: "tools", type: "readonly ToolDefinitionForLLM[]", required: false, desc: "LLM이 사용할 수 있는 도구 목록" },
              { name: "temperature", type: "number", required: false, desc: "응답의 무작위성 조절 (0=결정적, 1=창의적)" },
              { name: "maxTokens", type: "number", required: false, desc: "생성할 최대 토큰 수" },
              { name: "signal", type: "AbortSignal", required: false, desc: "요청 취소를 위한 AbortSignal — Esc로 요청 중단 가능" },
              { name: "thinking", type: "ThinkingConfig", required: false, desc: "Extended Thinking 설정 (Claude 모델 전용)" },
            ]}
          />

          {/* ChatResponse interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ChatResponse
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            모델이 반환한 전체 응답입니다. 텍스트 응답, 도구 호출 요청, 토큰 사용량 등을 포함합니다.
          </p>
          <ParamTable
            params={[
              { name: "content", type: "string", required: true, desc: "모델이 생성한 텍스트 응답" },
              { name: "toolCalls", type: "readonly ToolCallRequest[]", required: true, desc: "모델이 요청한 도구 호출 목록" },
              { name: "usage", type: "TokenUsage", required: true, desc: "토큰 사용량 정보 — 비용 추적에 사용" },
              { name: "finishReason", type: "string", required: true, desc: "응답 종료 사유 ('stop', 'length', 'tool_calls')" },
              { name: "thinking", type: "string", required: false, desc: "Extended Thinking 내용 (Claude 모델 전용)" },
            ]}
          />

          {/* ChatChunk interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ChatChunk
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            LLM의 스트리밍 응답에서 실시간으로 받는 데이터 조각입니다.
            LLM은 응답을 토큰 단위로 점진적으로 보내며, 사용자는 생성 과정을 실시간으로 볼 수 있습니다.
          </p>
          <ParamTable
            params={[
              { name: "type", type: "'text-delta' | 'tool-call-delta' | 'thinking-delta' | 'done'", required: true, desc: "청크 타입 — 어떤 종류의 데이터인지 구분" },
              { name: "text", type: "string", required: false, desc: "텍스트 조각 (type이 'text-delta'일 때)" },
              { name: "toolCall", type: "Partial<ToolCallRequest>", required: false, desc: "도구 호출 조각 (type이 'tool-call-delta'일 때)" },
              { name: "usage", type: "TokenUsage", required: false, desc: "토큰 사용량 (type이 'done'일 때 최종 사용량)" },
              { name: "thinking_delta", type: "string", required: false, desc: "Extended Thinking 텍스트 조각" },
              { name: "finishReason", type: "string", required: false, desc: "응답 종료 사유 (type이 'done'일 때)" },
            ]}
          />

          {/* LLMProvider interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface LLMProvider
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            모든 LLM 클라이언트가 구현해야 하는 공통 계약입니다.
            이 인터페이스를 구현하면 어떤 LLM 서비스든 동일한 방식으로 사용할 수 있습니다.
          </p>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            name
          </h4>
          <CodeBlock>
            <span className="kw">readonly</span> <span className="prop">name</span>: <span className="type">string</span>
          </CodeBlock>
          <p className="text-[13px] text-gray-600 mt-2 mb-4">
            프로바이더 이름입니다 (예: <code className="text-cyan-600">&quot;openai-compatible&quot;</code>, <code className="text-cyan-600">&quot;anthropic&quot;</code>).
          </p>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            chat(request)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            동기식 채팅 요청으로 전체 응답을 한 번에 받습니다.
          </p>
          <CodeBlock>
            <span className="fn">chat</span>(<span className="prop">request</span>: <span className="type">ChatRequest</span>): <span className="type">Promise</span>&lt;<span className="type">ChatResponse</span>&gt;
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            stream(request)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            스트리밍 채팅 요청으로 응답을 실시간 청크로 받습니다.
            <code className="text-cyan-600">for await...of</code>로 청크를 순회합니다.
          </p>
          <CodeBlock>
            <span className="fn">stream</span>(<span className="prop">request</span>: <span className="type">ChatRequest</span>): <span className="type">AsyncIterable</span>&lt;<span className="type">ChatChunk</span>&gt;
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            countTokens(text)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            텍스트의 토큰 수를 계산합니다. 컨텍스트 윈도우 관리와 비용 추적에 사용됩니다.
          </p>
          <CodeBlock>
            <span className="fn">countTokens</span>(<span className="prop">text</span>: <span className="type">string</span>): <span className="type">number</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              모든 프로퍼티에 <code className="text-cyan-600">readonly</code>가 적용되어 있습니다.
              불변성(immutability)을 보장하기 위한 설계 원칙입니다.
            </li>
            <li>
              <code className="text-cyan-600">ToolCallRequest.arguments</code>는 <strong>JSON 문자열</strong>입니다.
              객체가 아니라 문자열이므로, 사용 시 <code className="text-cyan-600">JSON.parse()</code>가 필요합니다.
            </li>
            <li>
              <code className="text-cyan-600">ChatChunk</code>의 <code className="text-cyan-600">type</code>에 따라
              사용 가능한 필드가 달라집니다. <code className="text-cyan-600">&quot;done&quot;</code>일 때만
              <code className="text-cyan-600">usage</code>와 <code className="text-cyan-600">finishReason</code>이 포함됩니다.
            </li>
            <li>
              <code className="text-cyan-600">ThinkingConfig</code>는 Claude 모델 전용입니다.
              다른 모델에서는 이 설정이 무시됩니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; LLMProvider 인터페이스로 통일된 호출</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            어떤 프로바이더든 동일한 <code className="text-cyan-600">LLMProvider</code> 인터페이스를 통해
            사용할 수 있습니다. 호출하는 쪽에서는 실제 구현체를 몰라도 됩니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 프로바이더에 독립적인 LLM 호출 함수"}</span>
            {"\n"}<span className="kw">async function</span> <span className="fn">askLLM</span>(<span className="prop">provider</span>: <span className="type">LLMProvider</span>, <span className="prop">question</span>: <span className="type">string</span>) {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">request</span>: <span className="type">ChatRequest</span> = {"{"}
            {"\n"}{"    "}<span className="prop">model</span>: <span className="str">&quot;claude-sonnet-4-20250514&quot;</span>,
            {"\n"}{"    "}<span className="prop">messages</span>: [{"{"}
            {"\n"}{"      "}<span className="prop">role</span>: <span className="str">&quot;user&quot;</span>,
            {"\n"}{"      "}<span className="prop">content</span>: <span className="prop">question</span>,
            {"\n"}{"    "}{"}"}],
            {"\n"}{"  "}{"}"};
            {"\n"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">response</span> = <span className="kw">await</span> <span className="prop">provider</span>.<span className="fn">chat</span>(<span className="prop">request</span>);
            {"\n"}{"  "}<span className="kw">return</span> <span className="prop">response</span>.<span className="prop">content</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>ChatRequest.model</code>은 프로바이더가 지원하는 모델이어야 합니다.
            예를 들어, <code>AnthropicProvider</code>에 <code>&quot;gpt-4o&quot;</code> 모델을 전달하면
            API 에러가 발생합니다. 모델-프로바이더 매칭은 <code>ModelRouter</code>가 자동으로 처리합니다.
          </Callout>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>스트리밍 사용법 &mdash; 실시간 응답 수신</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">stream()</code> 메서드는 <code className="text-cyan-600">AsyncIterable</code>을
            반환합니다. <code className="text-cyan-600">for await...of</code>로 청크를 순회하며 실시간으로 처리합니다.
          </p>
          <CodeBlock>
            <span className="kw">for await</span> (<span className="kw">const</span> <span className="prop">chunk</span> <span className="kw">of</span> <span className="prop">provider</span>.<span className="fn">stream</span>(<span className="prop">request</span>)) {"{"}
            {"\n"}{"  "}<span className="kw">switch</span> (<span className="prop">chunk</span>.<span className="prop">type</span>) {"{"}
            {"\n"}{"    "}<span className="kw">case</span> <span className="str">&quot;text-delta&quot;</span>:
            {"\n"}{"      "}<span className="fn">process</span>.<span className="prop">stdout</span>.<span className="fn">write</span>(<span className="prop">chunk</span>.<span className="prop">text</span> ?? <span className="str">&quot;&quot;</span>);
            {"\n"}{"      "}<span className="kw">break</span>;
            {"\n"}{"    "}<span className="kw">case</span> <span className="str">&quot;tool-call-delta&quot;</span>:
            {"\n"}{"      "}<span className="cm">{"// 도구 호출 데이터를 점진적으로 조립"}</span>
            {"\n"}{"      "}<span className="fn">appendToolCall</span>(<span className="prop">chunk</span>.<span className="prop">toolCall</span>);
            {"\n"}{"      "}<span className="kw">break</span>;
            {"\n"}{"    "}<span className="kw">case</span> <span className="str">&quot;done&quot;</span>:
            {"\n"}{"      "}<span className="cm">{"// 최종 토큰 사용량 기록"}</span>
            {"\n"}{"      "}<span className="fn">recordUsage</span>(<span className="prop">chunk</span>.<span className="prop">usage</span>);
            {"\n"}{"      "}<span className="kw">break</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          <DeepDive title="ToolDefinitionForLLM 구조와 OpenAI 호환성">
            <p className="mb-3">
              도구 정의는 OpenAI의 function calling 형식을 따릅니다.
              Anthropic 프로바이더는 이 형식을 내부적으로 Anthropic의 <code className="text-cyan-600">input_schema</code> 형식으로 변환합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">tool</span>: <span className="type">ToolDefinitionForLLM</span> = {"{"}
              {"\n"}{"  "}<span className="prop">type</span>: <span className="str">&quot;function&quot;</span>,
              {"\n"}{"  "}<span className="prop">function</span>: {"{"}
              {"\n"}{"    "}<span className="prop">name</span>: <span className="str">&quot;file_read&quot;</span>,
              {"\n"}{"    "}<span className="prop">description</span>: <span className="str">&quot;파일의 내용을 읽습니다&quot;</span>,
              {"\n"}{"    "}<span className="prop">parameters</span>: {"{"}
              {"\n"}{"      "}<span className="prop">type</span>: <span className="str">&quot;object&quot;</span>,
              {"\n"}{"      "}<span className="prop">properties</span>: {"{"}
              {"\n"}{"        "}<span className="prop">path</span>: {"{"} <span className="prop">type</span>: <span className="str">&quot;string&quot;</span> {"}"},
              {"\n"}{"      "}{"}"},
              {"\n"}{"      "}<span className="prop">required</span>: [<span className="str">&quot;path&quot;</span>],
              {"\n"}{"    "}{"}"},
              {"\n"}{"  "}{"}"},
              {"\n"}{"}"};
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              <code className="text-cyan-600">parameters</code> 필드는 JSON Schema 형식이므로,
              도구의 매개변수 검증이 LLM 측에서 자동으로 이루어집니다.
            </p>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>타입 관계 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            provider.ts에 정의된 타입들이 어떻게 연결되는지를 보여줍니다.
            요청-응답 흐름에서 각 타입의 역할을 확인할 수 있습니다.
          </p>

          <MermaidDiagram
            title="타입 관계 및 데이터 흐름"
            titleColor="purple"
            chart={`graph LR
  REQ["ChatRequest<br/><small>모델 + 메시지 + 도구</small>"]
  MSG["ChatMessage<br/><small>role + content</small>"]
  TOOL_DEF["ToolDefinitionForLLM<br/><small>도구 스키마 정의</small>"]
  THINK["ThinkingConfig<br/><small>확장 사고 설정</small>"]
  RES["ChatResponse<br/><small>텍스트 + 도구 호출</small>"]
  CHUNK["ChatChunk<br/><small>스트리밍 조각</small>"]
  TC["ToolCallRequest<br/><small>id + name + args</small>"]
  USAGE["TokenUsage<br/><small>prompt + completion</small>"]

  REQ --> MSG
  REQ --> TOOL_DEF
  REQ --> THINK
  RES --> TC
  RES --> USAGE
  CHUNK --> TC
  CHUNK --> USAGE
  MSG --> TC

  style REQ fill:#dbeafe,stroke:#3b82f6,color:#1e293b,stroke-width:2px
  style RES fill:#dcfce7,stroke:#10b981,color:#1e293b,stroke-width:2px
  style CHUNK fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style TC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style USAGE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style MSG fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style TOOL_DEF fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style THINK fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 설계 원칙</h3>
          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">불변성 (Immutability)</strong> &mdash; 모든 인터페이스의 프로퍼티에 <code className="text-cyan-600">readonly</code>가 적용되어 있습니다. 한번 생성된 메시지나 응답은 변경할 수 없으며, 새로운 객체를 생성해야 합니다.</p>
            <p><strong className="text-gray-900">OpenAI 호환성</strong> &mdash; 내부 타입 체계는 OpenAI Chat Completions API를 기준으로 설계되었습니다. Anthropic이나 Responses API는 각 프로바이더 내부에서 형식 변환을 수행합니다.</p>
            <p><strong className="text-gray-900">스트리밍 우선</strong> &mdash; <code className="text-cyan-600">ChatChunk</code> 타입은 4가지 청크 타입을 지원하여, 텍스트, 도구 호출, 사고 과정을 모두 실시간으로 전달할 수 있습니다.</p>
            <p><strong className="text-gray-900">AbortSignal 통합</strong> &mdash; <code className="text-cyan-600">ChatRequest.signal</code>을 통해 사용자가 Esc를 누르면 진행 중인 LLM 요청을 즉시 취소할 수 있습니다.</p>
          </div>
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
              &quot;ToolCallRequest.arguments를 파싱할 수 없어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">arguments</code>는 JSON <strong>문자열</strong>입니다.
              LLM이 가끔 잘못된 JSON을 반환하므로 반드시 <code className="text-cyan-600">try-catch</code>로 감싸세요.
            </p>
            <CodeBlock>
              <span className="kw">let</span> <span className="prop">args</span>: <span className="type">Record</span>&lt;<span className="type">string</span>, <span className="type">unknown</span>&gt;;
              {"\n"}<span className="kw">try</span> {"{"}
              {"\n"}{"  "}<span className="prop">args</span> = <span className="type">JSON</span>.<span className="fn">parse</span>(<span className="prop">toolCall</span>.<span className="prop">arguments</span>);
              {"\n"}{"}"} <span className="kw">catch</span> {"{"}
              {"\n"}{"  "}<span className="prop">args</span> = {"{}"}; <span className="cm">{"// 파싱 실패 시 빈 객체"}</span>
              {"\n"}{"}"}
            </CodeBlock>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;스트리밍에서 tool-call-delta의 데이터가 불완전해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">tool-call-delta</code> 청크의 <code className="text-cyan-600">toolCall</code>은
              <code className="text-cyan-600">Partial&lt;ToolCallRequest&gt;</code> 타입입니다.
              여러 청크에 걸쳐 점진적으로 데이터가 도착하므로, 모든 청크를 조립해야 완전한
              도구 호출 요청이 됩니다. <code className="text-cyan-600">&quot;done&quot;</code> 청크를 받은 후에
              최종 조립 결과를 사용하세요.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;TokenUsage 값이 0으로 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              일부 로컬 LLM 프로바이더(Ollama 등)는 토큰 사용량을 반환하지 않을 수 있습니다.
              이 경우 <code className="text-cyan-600">promptTokens</code>, <code className="text-cyan-600">completionTokens</code>,
              <code className="text-cyan-600">totalTokens</code> 모두 0이 됩니다.
              <code className="text-cyan-600">countTokens()</code> 메서드를 사용하여 클라이언트 측에서
              직접 계산하는 것이 더 정확합니다.
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
                name: "anthropic.ts",
                slug: "anthropic-provider",
                relation: "child",
                desc: "LLMProvider를 구현하는 Anthropic Claude 전용 프로바이더",
              },
              {
                name: "responses-client.ts",
                slug: "responses-client",
                relation: "child",
                desc: "LLMProvider를 구현하는 Responses API 전용 클라이언트 (Codex 모델)",
              },
              {
                name: "model-router.ts",
                slug: "model-router",
                relation: "child",
                desc: "LLMProvider를 구현하며 주/대체 모델 간 자동 전환을 제공하는 라우터",
              },
              {
                name: "token-counter.ts",
                slug: "token-counter",
                relation: "sibling",
                desc: "countTokens() 메서드의 실제 토큰 계산 로직을 담당하는 모듈",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
