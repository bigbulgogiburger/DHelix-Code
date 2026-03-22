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

export default function ThinkingBlockPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/cli/components/ThinkingBlock.tsx" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              ThinkingBlock
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="cli" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            LLM의 확장 사고(Extended Thinking) 내용을 축소/확장 형태로 표시하는 컴포넌트입니다.
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
              <code className="text-cyan-600">ThinkingBlock</code>은 Claude 등 일부 모델이 지원하는
              &quot;확장 사고(Extended Thinking)&quot; 기능의 출력을 터미널에 표시하는 Ink 컴포넌트입니다.
              기본적으로 &quot;Thinking...&quot; 한 줄로 축소되지만, <code className="text-cyan-600">Ctrl+O</code>
              (상세 모드)로 확장하면 사고 내용을 최대 20줄까지 표시합니다.
            </p>
            <p>
              스트리밍 중에는 ASCII 스피너(<code>|</code>, <code>/</code>, <code>-</code>, <code>\</code>)가
              200ms 간격으로 회전하여 사용자에게 사고가 진행 중임을 시각적으로 알려줍니다.
              사고에 사용된 토큰 수도 선택적으로 표시할 수 있습니다.
            </p>
            <p>
              이 컴포넌트는 에이전트의 &quot;내부 독백&quot;을 보여주는 창구입니다. 사용자가 에이전트가
              어떤 추론 과정을 거치는지 이해하고 싶을 때 유용하지만, 기본적으로는 축소되어
              화면 공간을 차지하지 않습니다.
            </p>
          </div>

          <MermaidDiagram
            title="ThinkingBlock 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AL["Agent Loop<br/><small>에이전트 루프 — LLM 응답 처리</small>"]
  LLM["LLM Client<br/><small>Extended Thinking 응답 수신</small>"]
  TB["ThinkingBlock<br/><small>사고 과정 표시</small>"]
  SM["StreamingMessage<br/><small>텍스트 스트리밍 표시</small>"]
  TCB["ToolCallBlock<br/><small>도구 호출 표시</small>"]

  LLM -->|"thinking content + tokens"| AL
  AL -->|"content, tokenCount, isStreaming"| TB
  AL --> SM
  AL --> TCB

  style TB fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TCB fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> ThinkingBlock은 수학 시험에서 &quot;풀이 과정&quot;을 보여주는 것과 같습니다.
            기본적으로 답만 보이지만, 풀이 과정을 펼치면 어떤 사고를 거쳤는지 확인할 수 있습니다.
            토큰 수는 풀이 과정의 &quot;길이&quot;를 나타냅니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* ThinkingBlockProps interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ThinkingBlockProps
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            ThinkingBlock 컴포넌트에 전달되는 Props입니다. 모든 프로퍼티는 <code className="text-cyan-600">readonly</code>입니다.
          </p>
          <ParamTable
            params={[
              { name: "content", type: "string", required: true, desc: "사고 내용 텍스트" },
              { name: "tokenCount", type: "number", required: false, desc: "사고에 사용된 토큰 수 (표시용)" },
              { name: "isExpanded", type: "boolean", required: false, desc: "확장 표시 여부 (기본값: false, Ctrl+O로 토글)" },
              { name: "isStreaming", type: "boolean", required: false, desc: "현재 사고 스트리밍 중 여부 (true이면 스피너 표시, 기본값: false)" },
            ]}
          />

          {/* Constants */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            내부 상수
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            스피너 애니메이션과 표시를 제어하는 상수들입니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">THINKING_SPINNER_FRAMES</span> = [<span className="str">&quot;|&quot;</span>, <span className="str">&quot;/&quot;</span>, <span className="str">&quot;-&quot;</span>, <span className="str">&quot;\\&quot;</span>];
            {"\n"}<span className="kw">const</span> <span className="prop">THINKING_SPINNER_INTERVAL_MS</span> = <span className="num">200</span>;
            {"\n"}<span className="cm">{"// 확장 모드에서 최대 표시 줄 수: 20줄"}</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">content</code>가 빈 문자열이고 <code className="text-cyan-600">isStreaming</code>이
              false이면 컴포넌트는 <code className="text-cyan-600">null</code>을 반환합니다.
            </li>
            <li>
              <code className="text-cyan-600">React.memo</code>로 감싸져 있어 Props가 변경되지 않으면
              리렌더링되지 않습니다.
            </li>
            <li>
              확장 모드에서도 사고 내용은 <strong>최대 20줄</strong>까지만 표시됩니다.
              20줄을 초과하면 &quot;... (N more lines)&quot;로 축약됩니다.
            </li>
            <li>
              <code className="text-cyan-600">isExpanded</code> Props가 변경되면 내부 <code className="text-cyan-600">expanded</code> state가
              <code className="text-cyan-600">useEffect</code>로 동기화됩니다. 외부와 내부 상태가 항상 일치합니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 축소된 사고 표시</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 기본적인 사용 패턴입니다. 기본적으로 축소되어 &quot;Thinking...&quot; 한 줄만 표시됩니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 축소 표시 — \"Thinking... (1,234 tokens)\""}</span>
            {"\n"}<span className="kw">{"<"}</span><span className="fn">ThinkingBlock</span>
            {"\n"}{"  "}<span className="prop">content</span>=<span className="str">&quot;이 문제를 분석해 봅시다...&quot;</span>
            {"\n"}{"  "}<span className="prop">tokenCount</span>={"{"}{"{"}<span className="num">1234</span>{"}"}{"}"}{"\n"}<span className="kw">/{">"}</span>
            {"\n"}<span className="cm">{"// 출력: Thinking... (1,234 tokens)"}</span>
          </CodeBlock>

          <CodeBlock>
            <span className="cm">{"// 스트리밍 중 — 스피너 회전 + \"Thinking...\""}</span>
            {"\n"}<span className="kw">{"<"}</span><span className="fn">ThinkingBlock</span>
            {"\n"}{"  "}<span className="prop">content</span>=<span className="str">&quot;현재까지의 사고 내용...&quot;</span>
            {"\n"}{"  "}<span className="prop">isStreaming</span>={"{"}{"{"}<span className="kw">true</span>{"}"}{"}"}{"\n"}<span className="kw">/{">"}</span>
            {"\n"}<span className="cm">{"// 출력: / Thinking..."}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>content</code>가 빈 문자열이고 <code>isStreaming</code>이 false이면
            아무것도 렌더링되지 않습니다. Extended Thinking을 지원하지 않는 모델에서는 이 컴포넌트를
            조건부로 렌더링하는 것이 좋습니다.
          </Callout>

          {/* 확장 표시 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 확장 표시 (상세 모드)
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">isExpanded</code>를 true로 설정하면
            사고 내용이 최대 20줄까지 표시됩니다. <code className="text-cyan-600">Ctrl+O</code>로 토글합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 확장 표시 — 사고 내용 최대 20줄"}</span>
            {"\n"}<span className="kw">{"<"}</span><span className="fn">ThinkingBlock</span>
            {"\n"}{"  "}<span className="prop">content</span>=<span className="str">&quot;1단계: 파일 구조 분석\n2단계: 의존성 확인\n3단계: 구현 계획&quot;</span>
            {"\n"}{"  "}<span className="prop">tokenCount</span>={"{"}{"{"}<span className="num">5678</span>{"}"}{"}"}{"\n"}{"  "}<span className="prop">isExpanded</span>={"{"}{"{"}<span className="kw">true</span>{"}"}{"}"}{"\n"}<span className="kw">/{">"}</span>
            {"\n"}<span className="cm">{"// 출력:"}</span>
            {"\n"}<span className="cm">{"// Thinking (5,678 tokens):"}</span>
            {"\n"}<span className="cm">{"//   1단계: 파일 구조 분석"}</span>
            {"\n"}<span className="cm">{"//   2단계: 의존성 확인"}</span>
            {"\n"}<span className="cm">{"//   3단계: 구현 계획"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> tokenCount는 <code>toLocaleString()</code>으로 포맷됩니다.
            예를 들어 1234는 &quot;1,234&quot;로, 31999는 &quot;31,999&quot;로 표시되어
            한눈에 규모를 파악할 수 있습니다.
          </Callout>

          <DeepDive title="isExpanded Props와 내부 state의 관계">
            <p className="mb-3">
              ThinkingBlock은 <code className="text-cyan-600">isExpanded</code> Props와 별도로
              내부 <code className="text-cyan-600">expanded</code> state를 가지고 있습니다.
              <code className="text-cyan-600">useEffect</code>를 통해 Props 변경 시 내부 state가 동기화됩니다:
            </p>
            <CodeBlock>
              <span className="kw">const</span> [<span className="prop">expanded</span>, <span className="prop">setExpanded</span>] = <span className="fn">useState</span>(<span className="prop">isExpanded</span>);
              {"\n"}
              {"\n"}<span className="fn">useEffect</span>(() =&gt; {"{"}
              {"\n"}{"  "}<span className="fn">setExpanded</span>(<span className="prop">isExpanded</span>);
              {"\n"}{"}"}, [<span className="prop">isExpanded</span>]);
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              이 패턴을 사용하는 이유는 향후 컴포넌트 내부에서 클릭으로 확장/축소를
              토글할 수 있도록 확장성을 확보하기 위함입니다. 현재는 외부 Props로만 제어됩니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>렌더링 분기 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            ThinkingBlock의 렌더링은 세 가지 조건에 따라 분기됩니다:
            컨텐츠 유무, 스트리밍 여부, 확장 여부.
          </p>

          <MermaidDiagram
            title="ThinkingBlock 렌더링 분기"
            titleColor="purple"
            chart={`graph TD
  INPUT["Props 수신<br/><small>content, tokenCount, isExpanded, isStreaming</small>"]
  CHECK_EMPTY["content 비어있고<br/>isStreaming = false?"]
  NULL["null 반환<br/><small>아무것도 렌더링하지 않음</small>"]
  CHECK_EXPANDED["expanded 상태 확인"]
  COLLAPSED["축소 표시<br/><small>[스피너] Thinking... (N tokens)</small>"]
  EXPANDED["확장 표시<br/><small>[스피너] Thinking (N tokens):<br/>  내용 (최대 20줄)</small>"]

  INPUT --> CHECK_EMPTY
  CHECK_EMPTY -->|"예"| NULL
  CHECK_EMPTY -->|"아니오"| CHECK_EXPANDED
  CHECK_EXPANDED -->|"축소"| COLLAPSED
  CHECK_EXPANDED -->|"확장"| EXPANDED

  style INPUT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CHECK_EMPTY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style NULL fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style CHECK_EXPANDED fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style COLLAPSED fill:#fef9c3,stroke:#eab308,color:#1e293b
  style EXPANDED fill:#dcfce7,stroke:#10b981,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            렌더링 로직의 핵심 부분입니다. 축소/확장 모드에 따라 다른 UI를 반환합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// [1] 빈 컨텐츠 + 스트리밍 아님 → 렌더링 안 함"}</span>
            {"\n"}<span className="kw">if</span> (!<span className="prop">content</span> && !<span className="prop">isStreaming</span>) {"{"}
            {"\n"}{"  "}<span className="kw">return</span> <span className="kw">null</span>;
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// [2] 토큰 수 포맷 (1234 → \"1,234\")"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">tokenLabel</span> = <span className="prop">tokenCount</span> != <span className="kw">null</span>
            {"\n"}{"  "}? <span className="str">` (${"{"}</span><span className="prop">tokenCount</span>.<span className="fn">toLocaleString</span>()<span className="str">{"}"} tokens)`</span>
            {"\n"}{"  "}: <span className="str">&quot;&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// [3] 축소 모드 — 한 줄 표시"}</span>
            {"\n"}<span className="kw">if</span> (!<span className="prop">expanded</span>) {"{"}
            {"\n"}{"  "}<span className="kw">return</span> (
            {"\n"}{"    "}<span className="kw">{"<"}</span><span className="fn">Text</span> <span className="prop">dimColor</span><span className="kw">{">"}</span>
            {"\n"}{"      "}{"{"}{"{"}<span className="prop">isStreaming</span> ? <span className="prop">spinnerFrame</span> + <span className="str">&quot; &quot;</span> : <span className="str">&quot;&quot;</span>{"}"}{"}"}{"\n"}{"      "}Thinking...{"{"}{"{"}<span className="prop">tokenLabel</span>{"}"}{"}"}{"\n"}{"    "}<span className="kw">{"<"}/</span><span className="fn">Text</span><span className="kw">{">"}</span>
            {"\n"}{"  "});
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// [4] 확장 모드 — 최대 20줄 표시"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">lines</span> = <span className="prop">content</span>.<span className="fn">split</span>(<span className="str">&quot;\\n&quot;</span>);
            {"\n"}<span className="kw">const</span> <span className="prop">displayLines</span> = <span className="prop">lines</span>.<span className="prop">length</span> {">"} <span className="num">20</span>
            {"\n"}{"  "}? [...<span className="prop">lines</span>.<span className="fn">slice</span>(<span className="num">0</span>, <span className="num">20</span>), <span className="str">`... (${"{"}</span><span className="prop">lines</span>.<span className="prop">length</span> - <span className="num">20</span><span className="str">{"}"} more lines)`</span>]
            {"\n"}{"  "}: <span className="prop">lines</span>;
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 사고 내용이 없고 스트리밍도 아니면 아무것도 표시하지 않습니다. Extended Thinking을 지원하지 않는 모델에서는 이 경로로 빠집니다.</p>
            <p><strong className="text-gray-900">[2]</strong> <code className="text-cyan-600">toLocaleString()</code>으로 숫자를 로캘에 맞게 포맷합니다. 토큰 수가 없으면 빈 문자열입니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 축소 모드에서는 dimColor로 흐리게 표시합니다. 스트리밍 중이면 스피너 문자가 앞에 붙습니다.</p>
            <p><strong className="text-gray-900">[4]</strong> 확장 모드에서 20줄을 초과하면 처음 20줄만 표시하고 나머지는 &quot;... (N more lines)&quot;로 축약합니다.</p>
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
              &quot;Thinking...이 표시되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              두 가지 가능성이 있습니다:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>Extended Thinking 비활성화:</strong> 현재 사용 중인 모델이 Extended Thinking을 지원하지 않거나
                비활성화되어 있을 수 있습니다. <code className="text-cyan-600">Alt+T</code>로 토글하세요.
              </li>
              <li>
                <strong>빈 content:</strong> content가 빈 문자열이고 isStreaming이 false이면 아무것도 렌더링되지 않습니다.
                LLM이 사고 컨텐츠를 반환하지 않은 경우입니다.
              </li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;사고 내용이 잘려서 보여요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              확장 모드(<code className="text-cyan-600">Ctrl+O</code>)에서도 최대 20줄까지만 표시됩니다.
              이는 터미널 화면 공간을 보호하기 위한 설계입니다. 20줄을 초과하면
              &quot;... (N more lines)&quot; 메시지가 표시되며, 전체 사고 내용을 보려면
              로그 파일을 확인해야 합니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;스피너가 멈추지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              스피너는 <code className="text-cyan-600">isStreaming</code>이 true인 동안 200ms 간격으로 계속 회전합니다.
              사고가 완료되면 부모 컴포넌트가 <code className="text-cyan-600">isStreaming</code>을 false로 변경해야 합니다.
              변경되면 <code className="text-cyan-600">useEffect</code>의 cleanup 함수가 interval을 자동으로 정리합니다.
            </p>
            <Callout type="tip" icon="*">
              스피너 속도(200ms)는 <code>THINKING_SPINNER_INTERVAL_MS</code> 상수로 제어됩니다.
              ToolCallBlock의 스피너(500ms)보다 빠르게 회전하여 시각적 차별화를 줍니다.
            </Callout>
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
                name: "StreamingMessage.tsx",
                slug: "streaming-message",
                relation: "sibling",
                desc: "LLM 응답 텍스트를 실시간 스트리밍으로 표시하는 동반 컴포넌트",
              },
              {
                name: "ToolCallBlock.tsx",
                slug: "tool-call-block",
                relation: "sibling",
                desc: "도구 호출 상태와 결과를 리치하게 표시하는 동반 컴포넌트",
              },
              {
                name: "model-capabilities.ts",
                slug: "model-capabilities",
                relation: "sibling",
                desc: "모델별 Extended Thinking 지원 여부를 포함한 능력 정보",
              },
              {
                name: "agent-loop.ts",
                slug: "agent-loop",
                relation: "parent",
                desc: "LLM 사고 응답을 수신하고 ThinkingBlock에 데이터를 전달하는 메인 루프",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
