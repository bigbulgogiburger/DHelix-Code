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

export default function TwoStageToolCallPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/llm/strategies/two-stage-tool-call.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              TwoStageToolCall
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            2단계 도구 호출 (계획 &rarr; 실행) &mdash; 저능력 모델의 자연어 의도를 정규식 패턴 매칭으로 구조화된 도구 호출로 변환하는 모듈입니다.
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
              일부 소형 로컬 모델(Tiny Llama, Phi-2 등)은 네이티브 function calling이나
              XML 형식의 도구 호출도 제대로 수행하지 못하고, 자연어로 의도를 표현하는 경우가 있습니다.
              예를 들어 <code className="text-cyan-600">&quot;read file src/main.ts&quot;</code>라고 응답하는 식입니다.
            </p>
            <p>
              <code className="text-cyan-600">TwoStageToolCall</code>은 이런 자연어 텍스트에서
              정규식 패턴 매칭을 사용하여 도구 호출 의도를 추출합니다.
              <strong>1단계(계획)</strong>에서 모델이 자연어로 의도를 표현하면,
              <strong>2단계(실행)</strong>에서 이 모듈이 정규식으로 의도를 파싱하여
              구조화된 도구 호출로 변환합니다.
            </p>
            <p>
              7가지 핵심 도구에 대한 패턴을 지원합니다:
              <code className="text-cyan-600">file_read</code>,
              <code className="text-cyan-600">grep_search</code>,
              <code className="text-cyan-600">file_write</code>,
              <code className="text-cyan-600">bash_exec</code>,
              <code className="text-cyan-600">list_dir</code>,
              <code className="text-cyan-600">file_edit</code>,
              <code className="text-cyan-600">glob_search</code>.
            </p>
          </div>

          <MermaidDiagram
            title="TwoStageToolCall 계획→실행 흐름"
            titleColor="purple"
            chart={`graph LR
  LLM["LLM 응답<br/><small>'read file src/main.ts'</small>"]
  PARSE["parseNaturalLanguageIntent()<br/><small>정규식 패턴 매칭</small>"]
  MATCH["INTENT_PATTERNS<br/><small>7가지 도구 패턴</small>"]
  VERIFY["availableTools<br/><small>도구 존재 확인</small>"]
  RESULT["NaturalLanguageIntent<br/><small>toolName + extractedArgs</small>"]
  EXEC["Tool Executor<br/><small>도구 실행</small>"]

  LLM -->|"자연어 텍스트"| PARSE
  PARSE --> MATCH
  MATCH -->|"regex 매칭"| VERIFY
  VERIFY -->|"도구 존재"| RESULT
  RESULT -->|"구조화된 호출"| EXEC

  style LLM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PARSE fill:#dbeafe,stroke:#3b82f6,color:#1e293b,stroke-width:2px
  style MATCH fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style VERIFY fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 아이가 &quot;저 그 인형 갖고 싶어!&quot;라고 손가락으로 가리키면,
            부모가 아이의 의도를 해석하여 정확한 인형을 집어주는 것과 같습니다.
            모델(아이)이 자연어로 의도를 표현하면, 이 모듈(부모)이 정규식으로 의도를 파악하여
            올바른 도구를 호출합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* NaturalLanguageIntent interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface NaturalLanguageIntent
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            자연어에서 추출된 도구 호출 의도입니다. 정규식 매칭 결과를 구조화된 형태로 표현합니다.
          </p>
          <ParamTable
            params={[
              { name: "toolName", type: "string", required: true, desc: "매칭된 도구 이름 (예: \"file_read\", \"bash_exec\")" },
              { name: "extractedArgs", type: "Record<string, unknown>", required: true, desc: "추출된 인자 — 정규식 캡처 그룹에서 추출 (예: { file_path: \"src/main.ts\" })" },
              { name: "requiredParams", type: "readonly string[]", required: true, desc: "필수 매개변수 이름 목록" },
              { name: "confidence", type: "number", required: true, desc: "매칭 신뢰도 (0~1) — 현재 고정값 0.9 사용" },
            ]}
          />

          {/* IntentPattern interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface IntentPattern (내부)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            의도 패턴의 내부 타입입니다. 정규식과 도구 이름, 인자 추출 함수의 매핑입니다.
          </p>
          <ParamTable
            params={[
              { name: "regex", type: "RegExp", required: true, desc: "자연어 텍스트를 매칭하는 정규식" },
              { name: "tool", type: "string", required: true, desc: "매칭 시 사용할 도구 이름" },
              { name: "argMap", type: "(m: RegExpMatchArray) => Record<string, unknown>", required: true, desc: "정규식 매칭 결과에서 인자를 추출하는 함수" },
            ]}
          />

          {/* INTENT_PATTERNS */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            const INTENT_PATTERNS
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            7가지 핵심 도구에 대한 자연어 의도 패턴 목록입니다. 각 패턴은 특정 동사로 시작하는 자연어 명령을 매칭합니다.
          </p>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-3">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2 font-bold text-gray-700">패턴</th>
                  <th className="text-left px-4 py-2 font-bold text-gray-700">도구</th>
                  <th className="text-left px-4 py-2 font-bold text-gray-700">추출 인자</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-mono text-cyan-600">read [file] &lt;path&gt;</td>
                  <td className="px-4 py-2">file_read</td>
                  <td className="px-4 py-2">file_path</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-mono text-cyan-600">search [for] &lt;pattern&gt;</td>
                  <td className="px-4 py-2">grep_search</td>
                  <td className="px-4 py-2">pattern</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-mono text-cyan-600">write [to] &lt;path&gt;</td>
                  <td className="px-4 py-2">file_write</td>
                  <td className="px-4 py-2">file_path</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-mono text-cyan-600">run &lt;command&gt;</td>
                  <td className="px-4 py-2">bash_exec</td>
                  <td className="px-4 py-2">command</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-mono text-cyan-600">list [files [in]] &lt;path&gt;</td>
                  <td className="px-4 py-2">list_dir</td>
                  <td className="px-4 py-2">path</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-mono text-cyan-600">edit &lt;path&gt;</td>
                  <td className="px-4 py-2">file_edit</td>
                  <td className="px-4 py-2">file_path</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-cyan-600">find [files] &lt;pattern&gt;</td>
                  <td className="px-4 py-2">glob_search</td>
                  <td className="px-4 py-2">pattern</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* parseNaturalLanguageIntent function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function parseNaturalLanguageIntent(text, availableTools)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            자연어 텍스트를 분석하여 구조화된 도구 호출 의도를 추출합니다.
            패턴 목록을 순서대로 매칭하며, 첫 번째로 일치하는 패턴을 사용합니다.
            매칭된 도구가 <code className="text-cyan-600">availableTools</code>에 존재하는지도 확인합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">parseNaturalLanguageIntent</span>(
            {"\n"}{"  "}<span className="prop">text</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">availableTools</span>: <span className="type">readonly ToolDefinition[]</span>,
            {"\n"}): <span className="type">NaturalLanguageIntent | null</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "text", type: "string", required: true, desc: "LLM의 자연어 응답 텍스트" },
              { name: "availableTools", type: "readonly ToolDefinition[]", required: true, desc: "현재 사용 가능한 도구 정의 목록" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              패턴 매칭은 <strong>순서 우선</strong>입니다. <code className="text-cyan-600">&quot;search for files *.ts&quot;</code>는
              <code className="text-cyan-600">grep_search</code>로 매칭됩니다(<code className="text-cyan-600">search</code> 패턴이
              <code className="text-cyan-600">find</code> 패턴보다 먼저 정의되어 있으므로).
            </li>
            <li>
              <code className="text-cyan-600">confidence</code>는 현재 <strong>고정값 0.9</strong>입니다.
              향후 패턴 복잡도나 매칭 품질에 따라 동적으로 계산될 수 있습니다.
            </li>
            <li>
              매칭된 도구가 <code className="text-cyan-600">availableTools</code>에 없으면 <code className="text-cyan-600">null</code>을 반환합니다.
              권한 설정으로 비활성화된 도구는 매칭에서 제외됩니다.
            </li>
            <li>
              정규식 매칭은 대소문자를 구분하지 않습니다(<code className="text-cyan-600">/i</code> 플래그).
              &quot;Read file&quot;과 &quot;read file&quot; 모두 매칭됩니다.
            </li>
            <li>
              이 모듈은 <strong>단일 인자</strong>만 추출할 수 있습니다.
              여러 인자가 필요한 도구(예: file_edit의 old_string + new_string)는 완전히 지원되지 않습니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 자연어에서 도구 호출 추출</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            LLM 응답에서 도구 호출 의도가 추출되지 않았을 때 폴백으로 사용합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{ "}<span className="fn">parseNaturalLanguageIntent</span>{" }"} <span className="kw">from</span> <span className="str">&quot;./two-stage-tool-call.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// LLM이 자연어로 응답한 경우"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">llmResponse</span> = <span className="str">&quot;I&apos;ll read file src/main.ts to understand the structure&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 자연어에서 도구 호출 의도 추출"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">intent</span> = <span className="fn">parseNaturalLanguageIntent</span>(<span className="prop">llmResponse</span>, <span className="prop">availableTools</span>);
            {"\n"}
            {"\n"}<span className="kw">if</span> (<span className="prop">intent</span>) {"{"}
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="prop">intent</span>.<span className="prop">toolName</span>);{"      "}<span className="cm">{"// \"file_read\""}</span>
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="prop">intent</span>.<span className="prop">extractedArgs</span>);{"  "}<span className="cm">{"// { file_path: \"src/main.ts\" }"}</span>
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="prop">intent</span>.<span className="prop">confidence</span>);{"    "}<span className="cm">{"// 0.9"}</span>
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>parseNaturalLanguageIntent()</code>의 반환값은 <code>null</code>일 수 있습니다.
            어떤 패턴에도 매칭되지 않거나, 매칭된 도구가 사용 가능 목록에 없으면 <code>null</code>을 반환합니다.
            반드시 <code>null</code> 체크를 수행하세요.
          </Callout>

          {/* 고급: 에이전트 루프에서의 폴백 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 에이전트 루프에서 폴백으로 사용
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            에이전트 루프에서 네이티브/텍스트 파싱 전략이 도구 호출을 추출하지 못했을 때
            마지막 수단으로 자연어 의도 파싱을 시도합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 기본 전략으로 도구 호출 추출 시도"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">calls</span> = <span className="prop">strategy</span>.<span className="fn">extractToolCalls</span>(<span className="prop">content</span>, <span className="prop">toolCalls</span>);
            {"\n"}
            {"\n"}<span className="kw">if</span> (<span className="prop">calls</span>.<span className="prop">length</span> === <span className="num">0</span>) {"{"}
            {"\n"}{"  "}<span className="cm">{"// 폴백: 자연어 의도 파싱"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">intent</span> = <span className="fn">parseNaturalLanguageIntent</span>(<span className="prop">content</span>, <span className="prop">tools</span>);
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">intent</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// 추출된 의도를 도구 호출로 변환하여 실행"}</span>
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">executeTool</span>({"{"}
            {"\n"}{"      "}<span className="prop">name</span>: <span className="prop">intent</span>.<span className="prop">toolName</span>,
            {"\n"}{"      "}<span className="prop">arguments</span>: <span className="prop">intent</span>.<span className="prop">extractedArgs</span>,
            {"\n"}{"    "}{"}"});
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>confidence</code> 값을 활용하여 의도의 신뢰도가 낮을 때
            사용자에게 확인을 요청하는 로직을 추가할 수 있습니다. 현재는 고정값 0.9이지만,
            향후 동적 계산으로 발전할 수 있습니다.
          </Callout>

          <DeepDive title="패턴 매칭 우선순위와 한계">
            <p className="mb-3">
              <code className="text-cyan-600">INTENT_PATTERNS</code>는 배열 순서대로 매칭됩니다.
              첫 번째로 일치하는 패턴이 사용되므로, 모호한 입력에서는 의도하지 않은 도구가 매칭될 수 있습니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><code>&quot;search for files *.ts&quot;</code> &rarr; <code>grep_search</code> (find가 아닌 search가 먼저 매칭)</li>
              <li><code>&quot;write a test&quot;</code> &rarr; <code>file_write</code> (&quot;write&quot;가 매칭되지만 의도는 코드 작성)</li>
              <li><code>&quot;edit the config&quot;</code> &rarr; <code>file_edit</code> (&quot;the config&quot;가 file_path로 추출)</li>
            </ul>
            <p className="mt-3 text-amber-600">
              이러한 한계 때문에 이 전략은 &quot;최후의 수단&quot;으로만 사용해야 합니다.
              가능하면 네이티브나 텍스트 파싱 전략을 우선 사용하세요.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>의도 파싱 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">parseNaturalLanguageIntent()</code>의 내부 판단 흐름입니다.
            7가지 패턴을 순서대로 매칭하고, 도구 존재 여부를 확인합니다.
          </p>

          <MermaidDiagram
            title="parseNaturalLanguageIntent() 판단 흐름"
            titleColor="purple"
            chart={`graph TD
  INPUT["text.trim()"] --> P1{"read 패턴<br/>매칭?"}
  P1 -->|"Yes"| CHK1{"file_read<br/>존재?"}
  P1 -->|"No"| P2{"search 패턴<br/>매칭?"}
  P2 -->|"Yes"| CHK2{"grep_search<br/>존재?"}
  P2 -->|"No"| P3{"... 나머지 5개<br/>패턴 순회"}
  P3 -->|"매칭됨"| CHK3{"해당 도구<br/>존재?"}
  P3 -->|"모두 실패"| NULL["null 반환"]
  CHK1 -->|"Yes"| RESULT["NaturalLanguageIntent<br/><small>toolName + extractedArgs</small>"]
  CHK1 -->|"No"| P2
  CHK2 -->|"Yes"| RESULT
  CHK2 -->|"No"| P3
  CHK3 -->|"Yes"| RESULT
  CHK3 -->|"No"| NULL

  style INPUT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style P1 fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style P2 fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style P3 fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style CHK1 fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style CHK2 fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style CHK3 fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style NULL fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">parseNaturalLanguageIntent()</code>의 전체 구현입니다.
            간결하지만 도구 존재 확인이라는 안전장치가 포함되어 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">parseNaturalLanguageIntent</span>(
            {"\n"}{"  "}<span className="prop">text</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">availableTools</span>: <span className="type">readonly ToolDefinition[]</span>,
            {"\n"}): <span className="type">NaturalLanguageIntent | null</span> {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">trimmed</span> = <span className="prop">text</span>.<span className="fn">trim</span>();
            {"\n"}
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">p</span> <span className="kw">of</span> <span className="prop">INTENT_PATTERNS</span>) {"{"}
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">match</span> = <span className="prop">trimmed</span>.<span className="fn">match</span>(<span className="prop">p</span>.<span className="prop">regex</span>);
            {"\n"}{"    "}<span className="cm">{"// [1] 정규식 매칭 + 도구 존재 확인"}</span>
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">match</span> && <span className="prop">availableTools</span>.<span className="fn">some</span>(
            {"\n"}{"      "}<span className="prop">t</span> =&gt; <span className="prop">t</span>.<span className="prop">name</span> === <span className="prop">p</span>.<span className="prop">tool</span>
            {"\n"}{"    "})) {"{"}
            {"\n"}{"      "}<span className="cm">{"// [2] 캡처 그룹에서 인자 추출"}</span>
            {"\n"}{"      "}<span className="kw">const</span> <span className="prop">args</span> = <span className="prop">p</span>.<span className="fn">argMap</span>(<span className="prop">match</span>);
            {"\n"}{"      "}<span className="kw">return</span> {"{"}
            {"\n"}{"        "}<span className="prop">toolName</span>: <span className="prop">p</span>.<span className="prop">tool</span>,
            {"\n"}{"        "}<span className="prop">extractedArgs</span>: <span className="prop">args</span>,
            {"\n"}{"        "}<span className="prop">requiredParams</span>: <span className="fn">Object</span>.<span className="fn">keys</span>(<span className="prop">args</span>),
            {"\n"}{"        "}<span className="prop">confidence</span>: <span className="num">0.9</span>,{"  "}<span className="cm">{"// [3] 고정 신뢰도"}</span>
            {"\n"}{"      "}{"}"};
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="kw">return</span> <span className="kw">null</span>;{"  "}<span className="cm">{"// [4] 매칭 실패"}</span>
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 정규식이 매칭되더라도 해당 도구가 <code className="text-cyan-600">availableTools</code>에 존재하지 않으면 다음 패턴으로 넘어갑니다. 권한 설정으로 비활성화된 도구는 자동 제외됩니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 각 패턴의 <code className="text-cyan-600">argMap</code> 함수가 정규식 캡처 그룹에서 인자를 추출합니다. 예: <code className="text-cyan-600">match[1]?.trim()</code>으로 첫 번째 캡처 그룹의 값을 가져옵니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 신뢰도는 현재 0.9로 고정되어 있습니다. 정규식 매칭 자체는 비교적 확실하지만, 의도 해석의 정확도가 100%는 아니기 때문입니다.</p>
            <p><strong className="text-gray-900">[4]</strong> 모든 패턴을 순회해도 매칭되지 않으면 null을 반환합니다. 호출자는 반드시 null 체크를 수행해야 합니다.</p>
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
              &quot;자연어 의도가 추출되지 않아요 (null 반환)&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              다음을 확인하세요:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>패턴 미매칭:</strong> 7가지 패턴(read, search, write, run, list, edit, find)의
                동사로 시작하는 텍스트만 매칭됩니다. &quot;open file&quot;이나 &quot;execute command&quot; 등은 매칭되지 않습니다.
              </li>
              <li>
                <strong>도구 미등록:</strong> 매칭된 도구가 <code className="text-cyan-600">availableTools</code>에 없으면
                null을 반환합니다. 권한 설정을 확인하세요.
              </li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;잘못된 도구가 매칭돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              패턴은 배열 순서대로 매칭됩니다. &quot;search for files&quot;는 <code className="text-cyan-600">grep_search</code>로
              매칭됩니다(<code className="text-cyan-600">find</code>가 아닌 <code className="text-cyan-600">search</code>가 먼저 정의).
              이는 현재 설계의 한계입니다. 정확한 도구 호출이 필요하면 네이티브나 텍스트 파싱 전략을 사용하세요.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;여러 인자가 필요한 도구인데 하나만 추출돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              이 모듈은 정규식의 첫 번째 캡처 그룹에서 <strong>하나의 인자</strong>만 추출합니다.
              <code className="text-cyan-600">file_edit</code>처럼 old_string + new_string이 필요한 도구는
              완전히 지원되지 않습니다. 이런 경우 부족한 인자에 대해 도구 자체가 에러를 반환합니다.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;새로운 도구 패턴을 추가하고 싶어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">INTENT_PATTERNS</code> 배열에 새 항목을 추가하세요.
              <code className="text-cyan-600">regex</code>(정규식), <code className="text-cyan-600">tool</code>(도구 이름),
              <code className="text-cyan-600">argMap</code>(인자 추출 함수) 세 가지를 정의하면 됩니다.
              배열의 순서가 매칭 우선순위를 결정하므로, 더 구체적인 패턴을 앞에 배치하세요.
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
                desc: "XML 형식 폴백 전략 — 이 전략보다 한 단계 높은 수준의 도구 호출",
              },
              {
                name: "native-function-calling.ts",
                slug: "native-function-calling",
                relation: "sibling",
                desc: "OpenAI 표준 네이티브 전략 — 가장 안정적인 도구 호출 방식",
              },
              {
                name: "tool-registry.ts",
                slug: "tool-registry",
                relation: "sibling",
                desc: "availableTools를 제공하는 도구 레지스트리 — 패턴 매칭의 도구 존재 확인에 사용",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
