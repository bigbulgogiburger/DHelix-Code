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

export default function ToolCallStrategyPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/llm/tool-call-strategy.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              ToolCallStrategy
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            도구 호출 전략 선택기 &mdash; 모델 능력에 따라 native / text-parsing / two-stage 중 적절한 도구 호출 방식을 자동 선택하는 모듈입니다.
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
              LLM 모델마다 도구 호출(function calling) 지원 방식이 다릅니다.
              <code className="text-cyan-600">ToolCallStrategy</code>는 이 차이를 추상화하여
              에이전트 루프가 모델에 관계없이 동일한 인터페이스로 도구를 호출할 수 있게 합니다.
            </p>
            <p>
              <strong>네이티브 전략(Native)</strong>은 OpenAI의 <code className="text-cyan-600">tool_calls</code> 필드를
              사용하는 표준 방식으로, GPT-4o, Claude 등 대부분의 상용 모델이 지원합니다.
              <strong>텍스트 파싱 전략(Text Parsing)</strong>은 XML 태그로 도구 호출을 텍스트에 포함하는 폴백 방식으로,
              Llama3 등 네이티브 function calling을 지원하지 않는 모델에서 사용됩니다.
            </p>
            <p>
              이 모듈은 <code className="text-cyan-600">model-capabilities</code>의
              <code className="text-cyan-600">supportsTools</code> 플래그를 확인하여 자동으로
              적절한 전략을 선택합니다. 테스트나 디버깅 시에는
              <code className="text-cyan-600">forceStrategy()</code>로 전략을 강제할 수도 있습니다.
            </p>
          </div>

          <MermaidDiagram
            title="ToolCallStrategy 전략 선택 구조"
            titleColor="purple"
            chart={`graph TD
  AL["Agent Loop<br/><small>agent-loop.ts</small>"]
  SEL["selectStrategy()<br/><small>tool-call-strategy.ts</small>"]
  MC["Model Capabilities<br/><small>supportsTools 플래그</small>"]
  NAT["NativeFunctionCalling<br/><small>strategies/native-function-calling.ts</small>"]
  TXT["TextParsing<br/><small>strategies/text-parsing.ts</small>"]
  LLM["LLM Client<br/><small>llm/client.ts</small>"]

  AL -->|"모델 이름"| SEL
  SEL -->|"능력 조회"| MC
  MC -->|"supportsTools: true"| NAT
  MC -->|"supportsTools: false"| TXT
  NAT -->|"tools 파라미터 전달"| LLM
  TXT -->|"시스템 프롬프트 주입"| LLM

  style SEL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style NAT fill:#dcfce7,stroke:#10b981,color:#065f46
  style TXT fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 여러 언어를 사용하는 통역사를 떠올리세요. 영어를 아는 상대에게는
            영어로 직접 대화하고(네이티브), 영어를 모르는 상대에게는 수화나 그림으로 의사소통합니다(텍스트 파싱).
            ToolCallStrategy는 각 모델의 &quot;언어 능력&quot;에 맞는 통역 방식을 자동으로 선택합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* PreparedRequest interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface PreparedRequest
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            도구 정의가 요청에 포함된 형태입니다. 전략에 따라 도구 정의가
            <code className="text-cyan-600">tools</code> 필드에 들어가거나(네이티브),
            시스템 메시지에 텍스트로 주입됩니다(텍스트 파싱).
          </p>
          <ParamTable
            params={[
              { name: "messages", type: "readonly ChatMessage[]", required: true, desc: "도구 정의가 반영된 메시지 배열" },
              { name: "tools", type: "readonly ToolDefinitionForLLM[]", required: false, desc: "도구 정의 (네이티브 전략에서만 사용, 텍스트 파싱에서는 undefined)" },
            ]}
          />

          {/* ToolCallStrategy interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ToolCallStrategy
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            모든 전략이 구현해야 하는 공통 계약입니다. 세 가지 핵심 메서드로 구성됩니다.
          </p>

          {/* name */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            name
          </h4>
          <CodeBlock>
            <span className="kw">readonly</span> <span className="prop">name</span>: <span className="str">&quot;native&quot;</span> | <span className="str">&quot;text-parsing&quot;</span>
          </CodeBlock>

          {/* prepareRequest */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            prepareRequest(messages, tools)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            요청에 도구 정의를 포함시키는 전처리 단계입니다.
            네이티브 전략은 tools 필드에 그대로 포함하고, 텍스트 파싱 전략은 시스템 메시지에 텍스트로 주입합니다.
          </p>
          <CodeBlock>
            <span className="fn">prepareRequest</span>(
            {"\n"}{"  "}<span className="prop">messages</span>: <span className="type">readonly ChatMessage[]</span>,
            {"\n"}{"  "}<span className="prop">tools</span>: <span className="type">readonly ToolDefinitionForLLM[]</span>,
            {"\n"}): <span className="type">PreparedRequest</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "messages", type: "readonly ChatMessage[]", required: true, desc: "원본 메시지 배열" },
              { name: "tools", type: "readonly ToolDefinitionForLLM[]", required: true, desc: "사용 가능한 도구 정의 배열" },
            ]}
          />

          {/* extractToolCalls */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            extractToolCalls(content, toolCalls)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            LLM 응답에서 도구 호출을 추출합니다.
            네이티브 전략은 toolCalls 배열에서 직접 추출하고, 텍스트 파싱 전략은 텍스트에서 XML 패턴으로 파싱합니다.
          </p>
          <CodeBlock>
            <span className="fn">extractToolCalls</span>(
            {"\n"}{"  "}<span className="prop">content</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">toolCalls</span>: <span className="type">readonly ToolCallRequest[]</span>,
            {"\n"}): <span className="type">readonly ExtractedToolCall[]</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "content", type: "string", required: true, desc: "LLM의 텍스트 응답" },
              { name: "toolCalls", type: "readonly ToolCallRequest[]", required: true, desc: "LLM이 반환한 tool_calls (네이티브에서만 사용)" },
            ]}
          />

          {/* formatToolResults */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            formatToolResults(results)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            도구 실행 결과를 대화 메시지로 변환합니다.
            네이티브 전략은 &quot;tool&quot; 역할 메시지로, 텍스트 파싱 전략은 &quot;user&quot; 역할 메시지에 XML 형식으로 포함합니다.
          </p>
          <CodeBlock>
            <span className="fn">formatToolResults</span>(
            {"\n"}{"  "}<span className="prop">results</span>: <span className="type">readonly {"{"} id: string; output: string; isError: boolean {"}"}[]</span>,
            {"\n"}): <span className="type">readonly ChatMessage[]</span>
          </CodeBlock>

          {/* selectStrategy function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function selectStrategy(modelName)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            모델 능력에 따라 적절한 도구 호출 전략을 자동 선택합니다.
            <code className="text-cyan-600">supportsTools: true</code>이면 네이티브,
            <code className="text-cyan-600">false</code>이면 텍스트 파싱 전략을 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">selectStrategy</span>(<span className="prop">modelName</span>: <span className="type">string</span>): <span className="type">ToolCallStrategy</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "modelName", type: "string", required: true, desc: "모델 이름 (예: \"gpt-4o\", \"llama3\")" },
            ]}
          />

          {/* forceStrategy function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function forceStrategy(strategyName)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            모델 능력과 무관하게 특정 전략을 강제로 사용합니다. 테스트나 디버깅 시 유용합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">forceStrategy</span>(
            {"\n"}{"  "}<span className="prop">strategyName</span>: <span className="str">&quot;native&quot;</span> | <span className="str">&quot;text-parsing&quot;</span>,
            {"\n"}): <span className="type">ToolCallStrategy</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "strategyName", type: "\"native\" | \"text-parsing\"", required: true, desc: "사용할 전략 이름" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">selectStrategy()</code>는 매 호출마다 <strong>새 인스턴스</strong>를 생성합니다.
              상태를 공유하지 않으므로 캐싱이 불필요합니다.
            </li>
            <li>
              Responses API 전용 모델(<code className="text-cyan-600">isResponsesOnlyModel</code>)은
              <code className="text-cyan-600">supportsTools</code> 플래그와 무관하게 항상 네이티브 전략을 사용합니다.
            </li>
            <li>
              텍스트 파싱 전략에서는 <code className="text-cyan-600">tools</code> 필드가
              <code className="text-cyan-600">undefined</code>로 반환됩니다.
              도구 정의는 이미 시스템 프롬프트에 포함되어 있습니다.
            </li>
            <li>
              <code className="text-cyan-600">forceStrategy()</code>는 프로덕션 코드에서 사용하지 마세요.
              모델-전략 불일치로 도구 호출이 실패할 수 있습니다.
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

          {/* 기본 사용법 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 전략 자동 선택</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 일반적인 사용 패턴입니다. 모델 이름을 전달하면
            자동으로 적절한 전략이 선택됩니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{ "}<span className="fn">selectStrategy</span>{" }"} <span className="kw">from</span> <span className="str">&quot;./tool-call-strategy.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 1. 모델에 맞는 전략 선택"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">strategy</span> = <span className="fn">selectStrategy</span>(<span className="str">&quot;gpt-4o&quot;</span>);
            {"\n"}<span className="cm">{"// → NativeFunctionCallingStrategy"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 요청에 도구 포함"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">prepared</span> = <span className="prop">strategy</span>.<span className="fn">prepareRequest</span>(<span className="prop">messages</span>, <span className="prop">tools</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 3. LLM 호출"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">response</span> = <span className="kw">await</span> <span className="fn">llm</span>.<span className="fn">chat</span>(<span className="prop">prepared</span>.<span className="prop">messages</span>, <span className="prop">prepared</span>.<span className="prop">tools</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 4. 응답에서 도구 호출 추출"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">calls</span> = <span className="prop">strategy</span>.<span className="fn">extractToolCalls</span>(
            {"\n"}{"  "}<span className="prop">response</span>.<span className="prop">content</span>, <span className="prop">response</span>.<span className="prop">toolCalls</span>,
            {"\n"});
            {"\n"}
            {"\n"}<span className="cm">{"// 5. 도구 실행 후 결과를 메시지로 변환"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">resultMsgs</span> = <span className="prop">strategy</span>.<span className="fn">formatToolResults</span>(<span className="prop">results</span>);
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>prepareRequest()</code>, <code>extractToolCalls()</code>,
            <code>formatToolResults()</code>는 반드시 <strong>같은 전략 인스턴스</strong>의 메서드를 사용해야 합니다.
            네이티브로 준비하고 텍스트 파싱으로 추출하면 결과가 엉망이 됩니다.
          </Callout>

          {/* 고급: 전략 강제 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 전략 강제 (테스트용)
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            테스트에서 특정 전략의 동작을 검증하고 싶을 때 사용합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{ "}<span className="fn">forceStrategy</span>{" }"} <span className="kw">from</span> <span className="str">&quot;./tool-call-strategy.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 텍스트 파싱 전략을 강제 — 네이티브 지원 모델이더라도"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">textStrategy</span> = <span className="fn">forceStrategy</span>(<span className="str">&quot;text-parsing&quot;</span>);
            {"\n"}<span className="fn">expect</span>(<span className="prop">textStrategy</span>.<span className="prop">name</span>).<span className="fn">toBe</span>(<span className="str">&quot;text-parsing&quot;</span>);
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>strategy.name</code> 프로퍼티로 현재 어떤 전략이 선택되었는지
            런타임에 확인할 수 있습니다. 로깅이나 디버깅에 유용합니다.
          </Callout>

          <DeepDive title="Responses API 모델의 특별 처리">
            <p className="mb-3">
              <code className="text-cyan-600">isResponsesOnlyModel()</code>로 식별되는 Responses API 전용 모델은
              <code className="text-cyan-600">supportsTools</code> 플래그가 <code className="text-red-600">false</code>로
              설정되어 있더라도 항상 네이티브 전략을 사용합니다.
            </p>
            <p className="text-gray-600">
              이는 Responses API가 자체적으로 tool calling을 지원하기 때문입니다.
              <code className="text-cyan-600">selectStrategy()</code> 내부에서 <code className="text-cyan-600">isResponsesOnlyModel()</code>
              체크가 <code className="text-cyan-600">supportsTools</code> 체크보다 <strong>먼저</strong> 실행되어
              전략 불일치를 방지합니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>전략 선택 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">selectStrategy()</code> 함수의 내부 판단 흐름입니다.
            Responses API 모델 체크가 가장 먼저 실행됩니다.
          </p>

          <MermaidDiagram
            title="selectStrategy() 판단 흐름"
            titleColor="purple"
            chart={`graph TD
  INPUT["selectStrategy(modelName)"] --> RESP{"isResponsesOnlyModel?"}
  RESP -->|"Yes"| NATIVE["NativeFunctionCalling<br/><small>네이티브 전략 반환</small>"]
  RESP -->|"No"| CAPS["getModelCapabilities()"]
  CAPS --> SUPPORTS{"supportsTools?"}
  SUPPORTS -->|"true"| NATIVE
  SUPPORTS -->|"false"| TEXT["TextParsing<br/><small>텍스트 파싱 전략 반환</small>"]

  style INPUT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style RESP fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style CAPS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SUPPORTS fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style NATIVE fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style TEXT fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">selectStrategy()</code>의 전체 구현입니다.
            간결하지만 Responses API 모델에 대한 방어 로직이 포함되어 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">selectStrategy</span>(<span className="prop">modelName</span>: <span className="type">string</span>): <span className="type">ToolCallStrategy</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] Responses API 모델은 항상 네이티브"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="fn">isResponsesOnlyModel</span>(<span className="prop">modelName</span>)) {"{"}
            {"\n"}{"    "}<span className="kw">return new</span> <span className="fn">NativeFunctionCallingStrategy</span>();
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 모델 능력 조회"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">caps</span> = <span className="fn">getModelCapabilities</span>(<span className="prop">modelName</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 도구 호출 지원 여부에 따라 전략 분기"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">caps</span>.<span className="prop">supportsTools</span>) {"{"}
            {"\n"}{"    "}<span className="kw">return new</span> <span className="fn">NativeFunctionCallingStrategy</span>();
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="kw">return new</span> <span className="fn">TextParsingStrategy</span>();
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> Responses API 전용 모델은 supportsTools 플래그와 무관하게 항상 네이티브 전략을 사용합니다. 이 체크가 먼저 실행되어 전략 불일치를 방지합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> model-capabilities 모듈에서 모델의 능력 정보를 조회합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> supportsTools가 true이면 네이티브, false이면 텍스트 파싱 전략을 반환합니다.</p>
          </div>
        </section>
      </RevealOnScroll>

      {/* ─── 5. 트러블슈팅 (Troubleshooting) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔧</span> 트러블슈팅
          </h2>

          {/* FAQ 1 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;도구 호출이 추출되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              전략 불일치가 원인일 수 있습니다. <code className="text-cyan-600">strategy.name</code>을 확인하세요:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>네이티브 전략인데 모델이 tool_calls를 반환하지 않는 경우:</strong>{" "}
                해당 모델의 <code className="text-cyan-600">supportsTools</code>가 잘못 설정되었을 수 있습니다.
                <code className="text-cyan-600">model-capabilities</code>를 확인하세요.
              </li>
              <li>
                <strong>텍스트 파싱인데 모델이 XML 형식을 따르지 않는 경우:</strong>{" "}
                모델이 시스템 프롬프트의 지시를 따르지 않을 수 있습니다.
                더 강력한 모델로 교체하거나 프롬프트를 조정하세요.
              </li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;새로운 모델을 추가했는데 도구 호출이 안 돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">model-capabilities</code>에 해당 모델의
              <code className="text-cyan-600">supportsTools</code> 플래그가 등록되어 있는지 확인하세요.
              미등록 모델은 기본값을 사용하는데, 기본값이 <code className="text-red-600">false</code>이면
              텍스트 파싱 전략이 선택됩니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;forceStrategy()로 설정한 전략이 적용되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">forceStrategy()</code>는 새 인스턴스를 반환합니다.
              반환값을 변수에 저장하고 해당 인스턴스를 사용하고 있는지 확인하세요.
              또한 에이전트 루프 내부에서 <code className="text-cyan-600">selectStrategy()</code>가
              다시 호출되어 강제 전략을 덮어쓰고 있지 않은지 확인하세요.
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
                name: "native-function-calling.ts",
                slug: "native-function-calling",
                relation: "child",
                desc: "OpenAI 표준 tool_calls를 사용하는 네이티브 전략 구현",
              },
              {
                name: "text-parsing.ts",
                slug: "text-parsing-strategy",
                relation: "child",
                desc: "XML 형식으로 도구 호출을 추출하는 텍스트 파싱 폴백 전략",
              },
              {
                name: "two-stage-tool-call.ts",
                slug: "two-stage-tool-call",
                relation: "child",
                desc: "저능력 모델의 자연어 의도를 구조화된 도구 호출로 변환하는 2단계 전략",
              },
              {
                name: "model-capabilities.ts",
                slug: "model-capabilities",
                relation: "sibling",
                desc: "supportsTools 플래그를 제공하여 전략 선택의 기준이 되는 모듈",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
