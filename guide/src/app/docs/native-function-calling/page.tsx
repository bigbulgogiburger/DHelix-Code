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

export default function NativeFunctionCallingPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/llm/strategies/native-function-calling.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              NativeFunctionCallingStrategy
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            OpenAI function calling 네이티브 전략 &mdash; 표준 <code className="text-cyan-600">tool_calls</code> API를 사용하는 도구 호출 방식입니다.
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
              <code className="text-cyan-600">NativeFunctionCallingStrategy</code>는 GPT-4o, Claude, GPT-5 등
              대부분의 상용 LLM 모델이 지원하는 표준 function calling 메커니즘을 사용합니다.
              API의 <code className="text-cyan-600">tools</code> 파라미터에 도구 정의를 전달하면,
              모델이 <code className="text-cyan-600">tool_calls</code> 필드에 구조화된 JSON으로 호출 정보를 반환합니다.
            </p>
            <p>
              이 방식은 모델이 직접 JSON을 생성하므로 파싱 오류가 적고,
              도구 이름과 인자의 정확도가 높습니다. 텍스트 파싱 전략 대비
              가장 안정적이고 성능이 좋은 방식이며, 별도의 텍스트 변환 없이
              API의 기본 기능을 그대로 활용합니다.
            </p>
            <p>
              도구 실행 결과는 OpenAI API 규격에 따라 <code className="text-cyan-600">&quot;tool&quot;</code> 역할 메시지로
              변환되어 다시 모델에게 전달됩니다.
              <code className="text-cyan-600">toolCallId</code>로 원래 도구 호출과 매칭됩니다.
            </p>
          </div>

          <MermaidDiagram
            title="NativeFunctionCalling 요청-응답 흐름"
            titleColor="purple"
            chart={`graph LR
  PREP["prepareRequest()<br/><small>messages + tools 그대로 전달</small>"]
  LLM["LLM API<br/><small>tool_calls 반환</small>"]
  EXTRACT["extractToolCalls()<br/><small>JSON.parse(arguments)</small>"]
  EXEC["Tool Executor<br/><small>도구 실행</small>"]
  FORMAT["formatToolResults()<br/><small>'tool' 역할 메시지</small>"]

  PREP -->|"tools 파라미터"| LLM
  LLM -->|"tool_calls[]"| EXTRACT
  EXTRACT -->|"ExtractedToolCall[]"| EXEC
  EXEC -->|"실행 결과"| FORMAT
  FORMAT -->|"ChatMessage[]"| LLM

  style PREP fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style LLM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style EXTRACT fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style FORMAT fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 표준 주문서 양식을 떠올리세요. 식당에 메뉴판(도구 정의)을 보여주면,
            손님(LLM)이 정해진 양식(JSON)으로 주문서(tool_calls)를 작성합니다.
            자유 형식으로 말하는 것(텍스트 파싱)보다 오해가 적고 정확합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* class NativeFunctionCallingStrategy */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class NativeFunctionCallingStrategy
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">ToolCallStrategy</code> 인터페이스를 구현하는 네이티브 전략 클래스입니다.
            LLMProvider의 tools 파라미터를 직접 사용하는 가장 기본적인 전략입니다.
          </p>

          {/* name */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            name
          </h4>
          <CodeBlock>
            <span className="kw">readonly</span> <span className="prop">name</span> = <span className="str">&quot;native&quot;</span>
          </CodeBlock>

          {/* prepareRequest */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            prepareRequest(messages, tools)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            메시지와 도구 정의를 <strong>변환 없이 그대로</strong> 반환합니다.
            API가 직접 tools 파라미터를 이해하므로 별도의 전처리가 불필요합니다.
          </p>
          <CodeBlock>
            <span className="fn">prepareRequest</span>(
            {"\n"}{"  "}<span className="prop">messages</span>: <span className="type">readonly ChatMessage[]</span>,
            {"\n"}{"  "}<span className="prop">tools</span>: <span className="type">readonly ToolDefinitionForLLM[]</span>,
            {"\n"}): <span className="type">PreparedRequest</span>
            {"\n"}<span className="cm">{"// 반환: { messages, tools } — 변환 없이 그대로"}</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "messages", type: "readonly ChatMessage[]", required: true, desc: "원본 메시지 배열 (변환 없이 그대로 반환)" },
              { name: "tools", type: "readonly ToolDefinitionForLLM[]", required: true, desc: "도구 정의 배열 (변환 없이 그대로 반환)" },
            ]}
          />

          {/* extractToolCalls */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            extractToolCalls(_content, toolCalls)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            모델이 반환한 <code className="text-cyan-600">tool_calls</code> 배열의 각 항목에서
            JSON 문자열인 <code className="text-cyan-600">arguments</code>를 파싱하여 객체로 변환합니다.
            텍스트 응답(<code className="text-cyan-600">_content</code>)은 사용하지 않습니다.
          </p>
          <CodeBlock>
            <span className="fn">extractToolCalls</span>(
            {"\n"}{"  "}<span className="prop">_content</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">toolCalls</span>: <span className="type">readonly ToolCallRequest[]</span>,
            {"\n"}): <span className="type">readonly ExtractedToolCall[]</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "_content", type: "string", required: true, desc: "텍스트 응답 (네이티브 전략에서는 사용하지 않음)" },
              { name: "toolCalls", type: "readonly ToolCallRequest[]", required: true, desc: "모델이 반환한 도구 호출 배열" },
            ]}
          />

          {/* formatToolResults */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            formatToolResults(results)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            도구 실행 결과를 OpenAI API 규격의 <code className="text-cyan-600">&quot;tool&quot;</code> 역할 메시지로 변환합니다.
            에러인 경우 <code className="text-cyan-600">&quot;Error: &quot;</code> 접두사를 붙여 모델이 에러임을 인식하도록 합니다.
          </p>
          <CodeBlock>
            <span className="fn">formatToolResults</span>(
            {"\n"}{"  "}<span className="prop">results</span>: <span className="type">readonly {"{"} id: string; output: string; isError: boolean {"}"}[]</span>,
            {"\n"}): <span className="type">readonly ChatMessage[]</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "results[].id", type: "string", required: true, desc: "원래 도구 호출의 고유 ID (toolCallId와 매칭)" },
              { name: "results[].output", type: "string", required: true, desc: "도구 실행 결과 텍스트" },
              { name: "results[].isError", type: "boolean", required: true, desc: "에러 발생 여부 (true이면 \"Error: \" 접두사 추가)" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">extractToolCalls()</code>에서 JSON 파싱이 실패하면
              빈 객체(<code className="text-cyan-600">{"{}"}</code>)가 인자로 사용됩니다.
              모델이 가끔 잘못된 JSON을 생성할 수 있으므로 방어적으로 처리합니다.
            </li>
            <li>
              JSON 파싱 실패 시 경고는 <code className="text-cyan-600">DBCODE_VERBOSE</code> 환경 변수가
              설정된 경우에만 <code className="text-cyan-600">stderr</code>로 출력됩니다.
            </li>
            <li>
              <code className="text-cyan-600">formatToolResults()</code>는 각 결과를 <strong>개별 메시지</strong>로 변환합니다.
              텍스트 파싱 전략과 달리 하나의 메시지에 합치지 않습니다.
            </li>
            <li>
              이 전략은 상태를 갖지 않습니다(stateless). 매 호출마다 새 인스턴스를 생성해도 문제 없습니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 전체 도구 호출 사이클</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            네이티브 전략의 3단계 사이클입니다: 준비 &rarr; 추출 &rarr; 결과 포맷.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">strategy</span> = <span className="kw">new</span> <span className="fn">NativeFunctionCallingStrategy</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 1단계: 요청 준비 (변환 없이 그대로)"}</span>
            {"\n"}<span className="kw">const</span> {"{ "}<span className="prop">messages</span>, <span className="prop">tools</span>{" }"} = <span className="prop">strategy</span>.<span className="fn">prepareRequest</span>(
            {"\n"}{"  "}<span className="prop">chatMessages</span>, <span className="prop">toolDefinitions</span>,
            {"\n"});
            {"\n"}
            {"\n"}<span className="cm">{"// 2단계: LLM 호출 후 도구 호출 추출"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">response</span> = <span className="kw">await</span> <span className="fn">llm</span>.<span className="fn">chat</span>(<span className="prop">messages</span>, <span className="prop">tools</span>);
            {"\n"}<span className="kw">const</span> <span className="prop">calls</span> = <span className="prop">strategy</span>.<span className="fn">extractToolCalls</span>(
            {"\n"}{"  "}<span className="prop">response</span>.<span className="prop">content</span>,
            {"\n"}{"  "}<span className="prop">response</span>.<span className="prop">toolCalls</span>,
            {"\n"});
            {"\n"}
            {"\n"}<span className="cm">{"// 3단계: 도구 실행 후 결과를 메시지로 변환"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">toolResults</span> = <span className="kw">await</span> <span className="fn">executeTools</span>(<span className="prop">calls</span>);
            {"\n"}<span className="kw">const</span> <span className="prop">resultMessages</span> = <span className="prop">strategy</span>.<span className="fn">formatToolResults</span>(<span className="prop">toolResults</span>);
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>extractToolCalls()</code>에서 첫 번째 인자(<code>content</code>)는
            무시되지만 인터페이스 호환성을 위해 반드시 전달해야 합니다.
            빈 문자열(<code>&quot;&quot;</code>)을 전달해도 됩니다.
          </Callout>

          {/* 고급: JSON 파싱 실패 처리 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; JSON 파싱 실패 디버깅
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            모델이 잘못된 JSON을 생성하면 인자가 빈 객체로 대체됩니다.
            <code className="text-cyan-600">DBCODE_VERBOSE</code> 환경 변수로 디버깅할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 환경 변수 설정으로 파싱 실패 경고 활성화"}</span>
            {"\n"}<span className="prop">DBCODE_VERBOSE</span>=<span className="num">1</span> <span className="prop">dbcode</span>
            {"\n"}
            {"\n"}<span className="cm">{"// stderr 출력 예시:"}</span>
            {"\n"}<span className="cm">{"// [native-function-calling] Failed to parse tool arguments"}</span>
            {"\n"}<span className="cm">{"// for \"file_read\" (id: call_abc123): {invalid json}"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> JSON 파싱 실패가 빈번하다면 해당 모델이 function calling을
            제대로 지원하지 않는 것일 수 있습니다.
            <code>model-capabilities</code>에서 <code>supportsTools: false</code>로 설정하여
            텍스트 파싱 전략으로 전환하는 것을 고려하세요.
          </Callout>

          <DeepDive title="네이티브 vs 텍스트 파싱: 결과 메시지 형식 차이">
            <p className="mb-3">
              두 전략의 <code className="text-cyan-600">formatToolResults()</code>는 근본적으로 다른 메시지 형식을 사용합니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li>
                <strong>네이티브:</strong> 각 결과가 <code className="text-cyan-600">role: &quot;tool&quot;</code> 메시지 +
                <code className="text-cyan-600">toolCallId</code>로 개별 전달
              </li>
              <li>
                <strong>텍스트 파싱:</strong> 모든 결과가 <code className="text-cyan-600">role: &quot;user&quot;</code> 메시지 하나에
                XML 형식으로 합쳐져 전달
              </li>
            </ul>
            <p className="mt-3 text-amber-600">
              이 차이 때문에 한 전략으로 준비하고 다른 전략으로 결과를 포맷하면
              모델이 혼란에 빠집니다. 반드시 같은 전략 인스턴스를 사용하세요.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>extractToolCalls 파싱 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">extractToolCalls()</code>의 각 tool_call 항목 처리 과정입니다.
            JSON.parse 실패에 대한 방어적 처리가 핵심입니다.
          </p>

          <MermaidDiagram
            title="extractToolCalls() JSON 파싱 흐름"
            titleColor="purple"
            chart={`graph TD
  INPUT["toolCalls.map()"] --> PARSE{"JSON.parse<br/>tc.arguments"}
  PARSE -->|"성공"| RESULT["{ id, name, arguments }"]
  PARSE -->|"실패"| VERBOSE{"DBCODE_VERBOSE?"}
  VERBOSE -->|"Yes"| WARN["stderr 경고 출력"]
  VERBOSE -->|"No"| SILENT["조용히 진행"]
  WARN --> EMPTY["arguments = {}"]
  SILENT --> EMPTY
  EMPTY --> RESULT

  style INPUT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style PARSE fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style VERBOSE fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style WARN fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style SILENT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style EMPTY fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">extractToolCalls()</code>와
            <code className="text-cyan-600">formatToolResults()</code>의 핵심 로직입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// extractToolCalls — 도구 호출 추출"}</span>
            {"\n"}<span className="kw">return</span> <span className="prop">toolCalls</span>.<span className="fn">map</span>((<span className="prop">tc</span>) =&gt; {"{"}
            {"\n"}{"  "}<span className="kw">let</span> <span className="prop">args</span>: <span className="type">Record&lt;string, unknown&gt;</span>;
            {"\n"}{"  "}<span className="kw">try</span> {"{"}
            {"\n"}{"    "}<span className="cm">{"// [1] JSON 문자열로 전달된 인자를 파싱"}</span>
            {"\n"}{"    "}<span className="prop">args</span> = <span className="fn">JSON</span>.<span className="fn">parse</span>(<span className="prop">tc</span>.<span className="prop">arguments</span>);
            {"\n"}{"  "}<span className="kw">{"}"} catch {"{"}</span>
            {"\n"}{"    "}<span className="cm">{"// [2] 파싱 실패 시 빈 객체로 대체"}</span>
            {"\n"}{"    "}<span className="prop">args</span> = {"{}"};
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="kw">return</span> {"{"} <span className="prop">id</span>: <span className="prop">tc</span>.<span className="prop">id</span>, <span className="prop">name</span>: <span className="prop">tc</span>.<span className="prop">name</span>, <span className="prop">arguments</span>: <span className="prop">args</span> {"}"};
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// formatToolResults — 결과를 \"tool\" 역할 메시지로 변환"}</span>
            {"\n"}<span className="kw">return</span> <span className="prop">results</span>.<span className="fn">map</span>((<span className="prop">result</span>) =&gt; ({"{"}
            {"\n"}{"  "}<span className="prop">role</span>: <span className="str">&quot;tool&quot;</span>,
            {"\n"}{"  "}<span className="cm">{"// [3] 에러면 \"Error: \" 접두사 추가"}</span>
            {"\n"}{"  "}<span className="prop">content</span>: <span className="prop">result</span>.<span className="prop">isError</span> ? <span className="str">`Error: ${"{"}<span className="prop">result</span>.<span className="prop">output</span>{"}"}`</span> : <span className="prop">result</span>.<span className="prop">output</span>,
            {"\n"}{"  "}<span className="cm">{"// [4] 원래 도구 호출 ID와 매칭"}</span>
            {"\n"}{"  "}<span className="prop">toolCallId</span>: <span className="prop">result</span>.<span className="prop">id</span>,
            {"\n"}{"}"}));
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 모델이 반환한 arguments는 JSON 문자열이므로 객체로 파싱해야 합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> JSON 파싱 실패 시 빈 객체로 대체합니다. 도구 실행은 계속되지만, 필수 인자가 없어서 도구 자체가 에러를 반환할 수 있습니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 에러 결과에 &quot;Error: &quot; 접두사를 붙여 모델이 에러 상황임을 명확히 인식하도록 합니다.</p>
            <p><strong className="text-gray-900">[4]</strong> <code className="text-cyan-600">toolCallId</code>가 원래 호출의 <code className="text-cyan-600">id</code>와 매칭되어 모델이 어떤 호출의 결과인지 파악할 수 있습니다.</p>
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
              &quot;도구 인자가 빈 객체로 전달돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              모델이 잘못된 JSON을 생성한 경우입니다. <code className="text-cyan-600">DBCODE_VERBOSE=1</code>로
              실행하면 stderr에 파싱 실패 로그가 출력됩니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 출력 예시"}</span>
              {"\n"}<span className="str">[native-function-calling] Failed to parse tool arguments</span>
              {"\n"}<span className="str">for &quot;file_read&quot; (id: call_abc123): {"{"}&quot;invalid&quot;json{"}"}</span>
            </CodeBlock>
            <Callout type="tip" icon="*">
              이 문제가 반복되면 해당 모델의 <code>supportsTools</code>를 <code>false</code>로 설정하여
              텍스트 파싱 전략(3단계 복구 포함)으로 전환하세요.
            </Callout>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;toolCallId 매칭 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">formatToolResults()</code>에 전달하는 <code className="text-cyan-600">id</code>가
              <code className="text-cyan-600">extractToolCalls()</code>에서 추출한 <code className="text-cyan-600">id</code>와
              일치하는지 확인하세요. ID가 불일치하면 API가 &quot;unknown tool_call_id&quot; 에러를 반환합니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;에러 결과인데 모델이 에러를 인식하지 못해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">isError</code> 필드가 <code className="text-cyan-600">true</code>로
              올바르게 설정되어 있는지 확인하세요. <code className="text-cyan-600">true</code>일 때만
              &quot;Error: &quot; 접두사가 붙습니다. 또한 일부 모델은 에러 메시지가 너무 짧으면
              맥락을 파악하지 못할 수 있으므로, 충분히 설명적인 에러 메시지를 전달하세요.
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
                name: "tool-call-strategy.ts",
                slug: "tool-call-strategy",
                relation: "parent",
                desc: "ToolCallStrategy 인터페이스 정의 + selectStrategy() 전략 선택기",
              },
              {
                name: "text-parsing.ts",
                slug: "text-parsing-strategy",
                relation: "sibling",
                desc: "XML 형식 폴백 전략 — 네이티브 function calling을 지원하지 않는 모델용",
              },
              {
                name: "two-stage-tool-call.ts",
                slug: "two-stage-tool-call",
                relation: "sibling",
                desc: "자연어 의도를 구조화된 도구 호출로 변환하는 2단계 전략",
              },
              {
                name: "model-capabilities.ts",
                slug: "model-capabilities",
                relation: "sibling",
                desc: "supportsTools 플래그로 이 전략의 사용 여부를 결정하는 모듈",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
