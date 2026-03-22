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

export default function TextParsingStrategyPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/llm/strategies/text-parsing.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              TextParsingStrategy
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            XML/JSON 텍스트 파싱 폴백 전략 &mdash; 네이티브 function calling을 지원하지 않는 모델에서 XML 태그로 도구 호출을 추출하는 폴백 방식입니다.
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
              <code className="text-cyan-600">TextParsingStrategy</code>는 Llama3, Phi 등 네이티브 function calling을
              지원하지 않는 모델에서 도구 호출을 사용하기 위한 폴백(fallback) 전략입니다.
              도구 사용법을 시스템 프롬프트에 텍스트로 주입하고,
              모델의 응답에서 XML 패턴을 정규식으로 추출합니다.
            </p>
            <p>
              핵심 차별점은 <strong>3단계 JSON 복구</strong>입니다.
              LLM이 생성하는 JSON은 종종 표준에 맞지 않는데(후행 쉼표, 작은따옴표, 인용 없는 키 등),
              이 전략은 표준 파싱 &rarr; 흔한 실수 수정 &rarr; 정규식 키-값 추출의 3단계로
              가능한 한 도구 인자를 복구합니다.
            </p>
            <p>
              도구 실행 결과는 <code className="text-cyan-600">&quot;user&quot;</code> 역할 메시지에
              XML 형식으로 포함하여 전달합니다. 이 모델들은 <code className="text-cyan-600">&quot;tool&quot;</code> 역할을
              이해하지 못하기 때문입니다.
            </p>
          </div>

          <MermaidDiagram
            title="TextParsingStrategy 요청-응답 흐름"
            titleColor="purple"
            chart={`graph LR
  PREP["prepareRequest()<br/><small>시스템 프롬프트에<br/>도구 사용법 주입</small>"]
  LLM["LLM<br/><small>XML로 도구 호출<br/>텍스트에 포함</small>"]
  EXTRACT["extractToolCalls()<br/><small>정규식으로<br/>XML 파싱</small>"]
  PARSE["parseToolArguments()<br/><small>3단계 JSON 복구</small>"]
  FORMAT["formatToolResults()<br/><small>'user' 역할<br/>XML 메시지</small>"]

  PREP -->|"시스템 메시지"| LLM
  LLM -->|"XML 포함 텍스트"| EXTRACT
  EXTRACT --> PARSE
  PARSE -->|"ExtractedToolCall[]"| FORMAT
  FORMAT -->|"ChatMessage[]"| LLM

  style PREP fill:#fef3c7,stroke:#f59e0b,color:#92400e,stroke-width:2px
  style LLM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style EXTRACT fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style PARSE fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px
  style FORMAT fill:#fef3c7,stroke:#f59e0b,color:#92400e`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 외국어를 모르는 관광객에게 그림이 그려진 메뉴판을 주고,
            손가락으로 가리키며 주문하게 하는 것과 같습니다. 정규 주문서(네이티브 API)를
            사용하는 것보다 오해의 여지가 있지만, 의사소통 자체는 가능하게 만듭니다.
            3단계 복구는 손님의 &quot;어눌한 주문&quot;을 최대한 해석하는 과정입니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* TOOL_CALL_PATTERN */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            const TOOL_CALL_PATTERN
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            XML 도구 호출 패턴을 추출하는 정규식입니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">TOOL_CALL_PATTERN</span> =
            {"\n"}{"  "}<span className="str">{"/<tool_call>\\s*<name>([\\s\\S]*?)<\\/name>"}</span>
            {"\n"}{"  "}<span className="str">{"\\s*<arguments>([\\s\\S]*?)<\\/arguments>\\s*<\\/tool_call>/g"}</span>
          </CodeBlock>
          <p className="text-[13px] text-gray-600 mt-2">
            <code className="text-cyan-600">[\\s\\S]*?</code> &mdash; 줄바꿈을 포함한 최소 매칭(non-greedy)으로
            여러 줄에 걸친 도구 호출도 추출합니다.
          </p>

          {/* extractKeyValuePairs function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function extractKeyValuePairs(raw)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            잘못된 JSON에서 키-값 쌍을 정규식으로 직접 추출하는 최후의 수단 함수입니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">extractKeyValuePairs</span>(<span className="prop">raw</span>: <span className="type">string</span>): <span className="type">Record&lt;string, unknown&gt;</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "raw", type: "string", required: true, desc: "잘못된 JSON 문자열" },
            ]}
          />

          {/* parseToolArguments function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function parseToolArguments(raw)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            도구 인자 JSON을 3단계 복구로 파싱합니다.
            LLM이 생성하는 비표준 JSON을 최대한 복구하여 파싱합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">parseToolArguments</span>(<span className="prop">raw</span>: <span className="type">string</span>): <span className="type">Record&lt;string, unknown&gt;</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "raw", type: "string", required: true, desc: "파싱할 JSON 문자열 (잘못된 형식일 수 있음)" },
            ]}
          />

          {/* TextParsingStrategy class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class TextParsingStrategy
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">ToolCallStrategy</code> 인터페이스를 구현하는 텍스트 파싱 전략 클래스입니다.
          </p>

          {/* name */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            name
          </h4>
          <CodeBlock>
            <span className="kw">readonly</span> <span className="prop">name</span> = <span className="str">&quot;text-parsing&quot;</span>
          </CodeBlock>

          {/* prepareRequest */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            prepareRequest(messages, tools)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            도구 사용법을 시스템 메시지에 텍스트로 주입합니다.
            API의 tools 파라미터를 사용하지 않고, 자연어+XML 예시로 프롬프트에 포함합니다.
            반환값에 <code className="text-cyan-600">tools</code> 필드가 없습니다.
          </p>
          <CodeBlock>
            <span className="fn">prepareRequest</span>(
            {"\n"}{"  "}<span className="prop">messages</span>: <span className="type">readonly ChatMessage[]</span>,
            {"\n"}{"  "}<span className="prop">tools</span>: <span className="type">readonly ToolDefinitionForLLM[]</span>,
            {"\n"}): <span className="type">PreparedRequest</span>
            {"\n"}<span className="cm">{"// 반환: { messages } — tools 필드 없음"}</span>
          </CodeBlock>

          {/* extractToolCalls */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            extractToolCalls(content, _toolCalls)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            응답 텍스트에서 <code className="text-cyan-600">&lt;tool_call&gt;</code> XML 패턴을 정규식으로 추출합니다.
            <code className="text-cyan-600">_toolCalls</code> 인자는 사용하지 않습니다.
          </p>
          <CodeBlock>
            <span className="fn">extractToolCalls</span>(
            {"\n"}{"  "}<span className="prop">content</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">_toolCalls</span>: <span className="type">readonly ToolCallRequest[]</span>,
            {"\n"}): <span className="type">readonly ExtractedToolCall[]</span>
          </CodeBlock>

          {/* formatToolResults */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            formatToolResults(results)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            도구 실행 결과를 <code className="text-cyan-600">&quot;user&quot;</code> 역할 메시지에 XML 형식으로 포함합니다.
            모든 결과가 하나의 메시지에 합쳐집니다.
          </p>
          <CodeBlock>
            <span className="fn">formatToolResults</span>(
            {"\n"}{"  "}<span className="prop">results</span>: <span className="type">readonly {"{"} id: string; output: string; isError: boolean {"}"}[]</span>,
            {"\n"}): <span className="type">readonly ChatMessage[]</span>
          </CodeBlock>

          {/* stripToolCalls static */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            static stripToolCalls(content)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            어시스턴트 텍스트에서 도구 호출 XML을 제거합니다.
            사용자에게 보여줄 때 순수한 추론/설명 텍스트만 남깁니다.
          </p>
          <CodeBlock>
            <span className="kw">static</span> <span className="fn">stripToolCalls</span>(<span className="prop">content</span>: <span className="type">string</span>): <span className="type">string</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "content", type: "string", required: true, desc: "XML이 포함된 원본 텍스트" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">extractKeyValuePairs()</code>는 <strong>최후의 수단</strong>입니다.
              중첩 객체, 배열 등 복잡한 구조는 처리할 수 없습니다.
            </li>
            <li>
              도구 호출 ID는 <code className="text-cyan-600">tc_text_</code> 접두사 + UUID 앞 8자리로 자동 생성됩니다.
              네이티브 전략과 달리 API가 ID를 제공하지 않기 때문입니다.
            </li>
            <li>
              <code className="text-cyan-600">prepareRequest()</code>는 도구 지시사항을 기존 시스템 메시지 바로 <strong>뒤에</strong> 삽입합니다.
              다른 역할의 메시지 앞에 위치하여 모델이 먼저 읽도록 합니다.
            </li>
            <li>
              <code className="text-cyan-600">formatToolResults()</code>는 모든 결과를 <strong>하나의</strong> user 메시지로 합칩니다.
              네이티브 전략(개별 메시지)과 다른 방식입니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 텍스트 파싱 전략으로 도구 호출</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            텍스트 파싱 전략은 보통 <code className="text-cyan-600">selectStrategy()</code>에 의해
            자동 선택됩니다. 수동 사용 시 XML 형식의 응답을 기대해야 합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">strategy</span> = <span className="kw">new</span> <span className="fn">TextParsingStrategy</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 1. 도구 사용법을 시스템 프롬프트에 주입"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">prepared</span> = <span className="prop">strategy</span>.<span className="fn">prepareRequest</span>(<span className="prop">messages</span>, <span className="prop">tools</span>);
            {"\n"}<span className="cm">{"// prepared.tools === undefined (프롬프트에 이미 포함)"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 2. LLM 호출 (tools 파라미터 없이)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">response</span> = <span className="kw">await</span> <span className="fn">llm</span>.<span className="fn">chat</span>(<span className="prop">prepared</span>.<span className="prop">messages</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 응답 텍스트에서 XML 도구 호출 추출"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">calls</span> = <span className="prop">strategy</span>.<span className="fn">extractToolCalls</span>(<span className="prop">response</span>.<span className="prop">content</span>, []);
            {"\n"}
            {"\n"}<span className="cm">{"// 4. 사용자에게 보여줄 텍스트에서 XML 제거"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">cleanText</span> = <span className="fn">TextParsingStrategy</span>.<span className="fn">stripToolCalls</span>(<span className="prop">response</span>.<span className="prop">content</span>);
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> 텍스트 파싱 전략으로 <code>prepareRequest()</code>를 호출한 후에는
            LLM API에 <code>tools</code> 파라미터를 전달하지 마세요. 도구 정의가 프롬프트와 API 양쪽에
            중복으로 포함되어 모델이 혼란에 빠질 수 있습니다.
          </Callout>

          {/* 고급: 3단계 JSON 복구 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; parseToolArguments() 3단계 JSON 복구
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            LLM이 생성하는 비표준 JSON을 3단계로 복구합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1단계: 표준 JSON.parse 시도"}</span>
            {"\n"}<span className="fn">JSON</span>.<span className="fn">parse</span>(<span className="str">{`'{"file_path": "src/main.ts"}'`}</span>)
            {"\n"}<span className="cm">{"// → 성공! 그대로 사용"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 2단계: 흔한 실수 수정 후 재시도"}</span>
            {"\n"}<span className="cm">{"// 수정 대상:"}</span>
            {"\n"}<span className="cm">{'// - 후행 쉼표:     { "a": 1, } → { "a": 1 }'}</span>
            {"\n"}<span className="cm">{"// - 작은따옴표:   { 'a': 'b' } → { \"a\": \"b\" }"}</span>
            {"\n"}<span className="cm">{"// - 인용 없는 키: { a: \"b\" }  → { \"a\": \"b\" }"}</span>
            {"\n"}<span className="cm">{"// - 리터럴 줄바꿈: 실제 줄바꿈 → \\n"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 3단계: 정규식으로 키-값 쌍 직접 추출 (최후의 수단)"}</span>
            {"\n"}<span className="fn">extractKeyValuePairs</span>(<span className="str">{`'file_path: src/main.ts'`}</span>)
            {"\n"}<span className="cm">{"// → { file_path: \"src/main.ts\" }"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>parseToolArguments()</code>는 독립적으로도 사용할 수 있습니다.
            LLM이 생성한 비표준 JSON을 안전하게 파싱해야 하는 다른 상황에서도 유용합니다.
          </Callout>

          {/* 고급: XML 결과 형식 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 결과 XML 형식
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">formatToolResults()</code>가 생성하는 XML 형식입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// formatToolResults() 출력 예시"}</span>
            {"\n"}<span className="str">Tool execution results:</span>
            {"\n"}
            {"\n"}<span className="str">&lt;tool_result id=&quot;tc_text_abc12345&quot; status=&quot;SUCCESS&quot;&gt;</span>
            {"\n"}<span className="str">파일 내용이 여기에 들어갑니다...</span>
            {"\n"}<span className="str">&lt;/tool_result&gt;</span>
            {"\n"}
            {"\n"}<span className="str">&lt;tool_result id=&quot;tc_text_def67890&quot; status=&quot;ERROR&quot;&gt;</span>
            {"\n"}<span className="str">파일을 찾을 수 없습니다: /path/to/file</span>
            {"\n"}<span className="str">&lt;/tool_result&gt;</span>
          </CodeBlock>

          <DeepDive title="formatToolInstructions() — 시스템 프롬프트에 주입되는 내용">
            <p className="mb-3">
              <code className="text-cyan-600">prepareRequest()</code>가 내부적으로 호출하는
              <code className="text-cyan-600">formatToolInstructions()</code>는 다음 구조의 텍스트를 생성합니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><strong>Available Tools:</strong> 각 도구의 이름, 설명, 매개변수 스키마</li>
              <li><strong>How to use tools:</strong> XML 형식 예시</li>
              <li><strong>규칙:</strong> 여러 도구 동시 호출 가능, 추론을 먼저 작성</li>
            </ul>
            <p className="mt-3 text-amber-600">
              이 텍스트는 시스템 메시지로 추가되므로, 원래 시스템 프롬프트의 토큰 예산을 소비합니다.
              도구가 많으면 컨텍스트 윈도우를 상당히 차지할 수 있으니 주의하세요.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>3단계 JSON 복구 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">parseToolArguments()</code>의 3단계 복구 과정입니다.
            각 단계가 실패하면 다음 단계로 넘어갑니다.
          </p>

          <MermaidDiagram
            title="parseToolArguments() 3단계 JSON 복구"
            titleColor="purple"
            chart={`graph TD
  INPUT["raw JSON 문자열"] --> S1{"1단계<br/>JSON.parse"}
  S1 -->|"성공"| OK["파싱된 객체 반환"]
  S1 -->|"실패"| FIX["흔한 실수 수정<br/><small>후행 쉼표, 작은따옴표,<br/>인용 없는 키, 줄바꿈</small>"]
  FIX --> S2{"2단계<br/>JSON.parse(fixed)"}
  S2 -->|"성공"| OK
  S2 -->|"실패"| S3["3단계<br/>extractKeyValuePairs()"]
  S3 --> REGEX["정규식으로<br/>key: value 추출"]
  REGEX --> OK

  style INPUT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style S1 fill:#dcfce7,stroke:#10b981,color:#065f46
  style FIX fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style S2 fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style S3 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style REGEX fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style OK fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">extractToolCalls()</code>의 XML 파싱 로직과
            <code className="text-cyan-600">parseToolArguments()</code>의 2단계 수정 로직입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// extractToolCalls — XML에서 도구 호출 추출"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">regex</span> = <span className="kw">new</span> <span className="fn">RegExp</span>(<span className="prop">TOOL_CALL_PATTERN</span>.<span className="prop">source</span>, <span className="str">&quot;g&quot;</span>);
            {"\n"}<span className="kw">let</span> <span className="prop">match</span>;
            {"\n"}
            {"\n"}<span className="kw">while</span> ((<span className="prop">match</span> = <span className="prop">regex</span>.<span className="fn">exec</span>(<span className="prop">content</span>)) !== <span className="kw">null</span>) {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">name</span> = <span className="prop">match</span>[<span className="num">1</span>].<span className="fn">trim</span>();
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">argsStr</span> = <span className="prop">match</span>[<span className="num">2</span>].<span className="fn">trim</span>();
            {"\n"}{"  "}<span className="cm">{"// [1] 3단계 복구를 통한 안전한 JSON 파싱"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">args</span> = <span className="fn">parseToolArguments</span>(<span className="prop">argsStr</span>);
            {"\n"}{"  "}<span className="prop">calls</span>.<span className="fn">push</span>({"{"} <span className="prop">id</span>: <span className="fn">generateCallId</span>(), <span className="prop">name</span>, <span className="prop">arguments</span>: <span className="prop">args</span> {"}"});
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// parseToolArguments 2단계 — 흔한 실수 수정"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">fixed</span> = <span className="prop">raw</span>
            {"\n"}{"  "}.<span className="fn">replace</span>(<span className="str">/,\\s*{"}"}/g</span>, <span className="str">&quot;{"}"}&quot;</span>){"   "}<span className="cm">{"// [2] 후행 쉼표 제거"}</span>
            {"\n"}{"  "}.<span className="fn">replace</span>(<span className="str">/,\\s*]/g</span>, <span className="str">&quot;]&quot;</span>){"     "}<span className="cm">{"// [3] 배열 후행 쉼표 제거"}</span>
            {"\n"}{"  "}.<span className="fn">replace</span>(<span className="str">/&apos;/g</span>, <span className="str">&apos;&quot;&apos;</span>){"          "}<span className="cm">{"// [4] 작은따옴표 → 큰따옴표"}</span>
            {"\n"}{"  "}.<span className="fn">replace</span>(<span className="str">/(\\w+)\\s*:/g</span>, <span className="str">&apos;&quot;$1&quot;:&apos;</span>){" "}<span className="cm">{"// [5] 인용 없는 키 수정"}</span>
            {"\n"}{"  "}.<span className="fn">replace</span>(<span className="str">/\\n/g</span>, <span className="str">&quot;\\\\n&quot;</span>);{"    "}<span className="cm">{"// [6] 줄바꿈 이스케이프"}</span>
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 각 XML 매칭에서 추출된 인자 문자열을 3단계 복구로 파싱합니다.</p>
            <p><strong className="text-gray-900">[2-3]</strong> LLM이 자주 실수하는 후행 쉼표를 제거합니다.</p>
            <p><strong className="text-gray-900">[4]</strong> Python 습관으로 작은따옴표를 사용하는 LLM의 출력을 수정합니다.</p>
            <p><strong className="text-gray-900">[5]</strong> JavaScript 객체 리터럴 스타일(키에 따옴표 없음)을 표준 JSON으로 수정합니다.</p>
            <p><strong className="text-gray-900">[6]</strong> JSON 문자열 내의 실제 줄바꿈을 이스케이프 시퀀스로 변환합니다.</p>
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
              &quot;모델이 XML 형식을 따르지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              일부 소형 모델은 시스템 프롬프트의 지시를 무시할 수 있습니다.
              다음을 시도하세요:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>프롬프트에 XML 예시를 더 강조하거나 반복합니다.</li>
              <li>더 큰 모델로 교체합니다. (7B 이상 권장)</li>
              <li>two-stage-tool-call 전략을 사용하여 자연어 의도를 파싱합니다.</li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;3단계 복구에서도 인자 파싱이 실패해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">extractKeyValuePairs()</code>는 단순한 key-value 쌍만 추출합니다.
              중첩 객체나 배열이 필요한 도구 인자는 복구할 수 없습니다.
              해당 도구의 파라미터를 가능하면 평탄화(flatten)하여 단순한 문자열/숫자 타입으로 설계하세요.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;도구 호출 XML이 사용자에게 그대로 보여요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">TextParsingStrategy.stripToolCalls(content)</code>를 사용하여
              사용자에게 보여주기 전에 XML 태그를 제거하세요. 이 정적 메서드는 인스턴스 없이도 호출 가능합니다.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;도구 정의가 너무 많아서 컨텍스트를 초과해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              텍스트 파싱 전략에서는 도구 정의가 시스템 프롬프트에 텍스트로 포함됩니다.
              도구가 많으면 상당한 토큰을 소비합니다. 사용하지 않는 도구를 비활성화하거나,
              도구 설명을 간결하게 줄이세요. 또는 적응형 스키마(adaptive schema)를 활용하세요.
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
                name: "native-function-calling.ts",
                slug: "native-function-calling",
                relation: "sibling",
                desc: "OpenAI 표준 tool_calls를 사용하는 네이티브 전략 — 텍스트 파싱의 대안",
              },
              {
                name: "two-stage-tool-call.ts",
                slug: "two-stage-tool-call",
                relation: "sibling",
                desc: "자연어 의도를 구조화된 도구 호출로 변환 — XML도 못 따르는 모델용",
              },
              {
                name: "model-capabilities.ts",
                slug: "model-capabilities",
                relation: "sibling",
                desc: "supportsTools: false인 모델에서 이 전략이 자동 선택됨",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
