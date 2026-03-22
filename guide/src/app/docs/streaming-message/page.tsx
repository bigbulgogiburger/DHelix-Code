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

export default function StreamingMessagePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/components/StreamingMessage.tsx" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">StreamingMessage</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              LLM 응답을 실시간으로 스트리밍 표시하며 점진적 마크다운 렌더링을 지원하는
              컴포넌트입니다.
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
                <code className="text-cyan-600">StreamingMessage</code>는 LLM이 응답을 생성하는 동안
                텍스트가 한 글자씩 추가되는 것을 보여주는 Ink 컴포넌트입니다. 완료된 부분은
                마크다운으로 렌더링하고, 아직 작성 중인 부분은 원시 텍스트로 표시합니다.
              </p>
              <p>
                핵심 아이디어는 &quot;점진적 마크다운 렌더링&quot;입니다. 코드 블록(<code>```</code>
                )의 쌍이 완성되었는지 추적하여, 완성된 부분만 마크다운으로 변환합니다. 미완성 코드
                블록이나 마지막 문단은 원시 텍스트 그대로 유지하여 스트리밍 중에도 깜빡임 없이
                안정적인 표시가 가능합니다.
              </p>
              <p>
                스트리밍이 진행 중일 때는 커서(<code className="text-cyan-600">▌</code>)가 표시되어
                사용자에게 아직 응답이 생성되고 있음을 시각적으로 알려줍니다.
              </p>
            </div>

            <MermaidDiagram
              title="StreamingMessage 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AL["Agent Loop<br/><small>에이전트 루프 — LLM 응답 수신</small>"]
  SM["StreamingMessage<br/><small>스트리밍 텍스트 표시</small>"]
  MD["markdown.ts<br/><small>마크다운 렌더러</small>"]
  TCB["ToolCallBlock<br/><small>도구 호출 표시</small>"]
  TB["ThinkingBlock<br/><small>사고 과정 표시</small>"]

  AL -->|"텍스트 + isComplete 전달"| SM
  SM -->|"renderMarkdown()"| MD
  SM -->|"hasMarkdown()"| MD
  AL --> TCB
  AL --> TB

  style SM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MD fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TCB fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TB fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> StreamingMessage는 &quot;타자기&quot;처럼 작동합니다. 글자가
              하나씩 찍히는 동안, 이미 완성된 문단은 깔끔하게 정리(마크다운 렌더링)하고, 현재 작성
              중인 줄은 원시 텍스트 그대로 보여줍니다.
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

            {/* StreamingMessageProps interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface StreamingMessageProps
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              StreamingMessage 컴포넌트에 전달되는 Props입니다. 모든 프로퍼티는{" "}
              <code className="text-cyan-600">readonly</code>입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "text",
                  type: "string",
                  required: true,
                  desc: "표시할 텍스트 (스트리밍 중 점진적으로 증가)",
                },
                {
                  name: "isComplete",
                  type: "boolean",
                  required: true,
                  desc: "스트리밍 완료 여부 (true이면 커서 숨김, 전체 마크다운 렌더링)",
                },
                {
                  name: "enableMarkdown",
                  type: "boolean",
                  required: false,
                  desc: "마크다운 렌더링 활성화 여부 (기본값: true)",
                },
              ]}
            />

            {/* partialRenderMarkdown function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              partialRenderMarkdown(text)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              스트리밍 텍스트를 렌더링 가능한(완료된) 부분과 원시(미완성) 부분으로 분리하는 내부
              함수입니다. 코드 블록의 쌍이 맞는지 확인하여 안전한 분리 지점을 결정합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">partialRenderMarkdown</span>
              (<span className="prop">text</span>: <span className="type">string</span>): {"{"}
              {"\n"}
              {"  "}
              <span className="prop">rendered</span>: <span className="type">string</span>;{"\n"}
              {"  "}
              <span className="prop">raw</span>: <span className="type">string</span>;{"\n"}
              {"}"}
            </CodeBlock>
            <ParamTable
              params={[
                { name: "text", type: "string", required: true, desc: "분리할 스트리밍 텍스트" },
              ]}
            />
            <div className="text-[13px] text-gray-600 mt-3 space-y-1">
              <p>
                &bull; <code className="text-cyan-600">rendered</code> &mdash; 마크다운 렌더링이
                적용된 완성 부분
              </p>
              <p>
                &bull; <code className="text-cyan-600">raw</code> &mdash; 아직 작성 중인 미완성 부분
                (원시 텍스트)
              </p>
            </div>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">text</code>가 빈 문자열이면 컴포넌트는{" "}
                <code className="text-cyan-600">null</code>을 반환합니다 (아무것도 렌더링하지 않음).
              </li>
              <li>
                <code className="text-cyan-600">React.memo</code>로 감싸져 있어 Props가 변경되지
                않으면 리렌더링되지 않습니다.
              </li>
              <li>
                <code className="text-cyan-600">enableMarkdown</code>이 false이거나 텍스트에
                마크다운 문법이 없으면 전체 텍스트를 원시 텍스트로 표시합니다.
              </li>
              <li>
                <code className="text-cyan-600">isComplete</code>가 true가 되면 전체 텍스트를 한
                번에 마크다운으로 렌더링합니다. 부분 렌더링은 스트리밍 중에만 적용됩니다.
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
              기본 사용법 &mdash; 스트리밍 텍스트 표시
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              가장 기본적인 사용 패턴입니다. LLM 응답 텍스트와 완료 여부를 전달합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 스트리밍 중 — 커서(▌)가 표시됨"}</span>
              {"\n"}
              <span className="kw">{"<"}</span>
              <span className="fn">StreamingMessage</span>
              {"\n"}
              {"  "}
              <span className="prop">text</span>=
              <span className="str">&quot;이 파일을 분석해 보겠습니다...&quot;</span>
              {"\n"}
              {"  "}
              <span className="prop">isComplete</span>={"{"}
              {"{"}
              <span className="kw">false</span>
              {"}"}
              {"}"}
              {"\n"}
              <span className="kw">/{">"}</span>
            </CodeBlock>

            <CodeBlock>
              <span className="cm">{"// 완료 — 전체 마크다운 렌더링, 커서 숨김"}</span>
              {"\n"}
              <span className="kw">{"<"}</span>
              <span className="fn">StreamingMessage</span>
              {"\n"}
              {"  "}
              <span className="prop">text</span>=
              <span className="str">&quot;분석 결과입니다.\n\n```ts\nconst x = 1;\n```&quot;</span>
              {"\n"}
              {"  "}
              <span className="prop">isComplete</span>={"{"}
              {"{"}
              <span className="kw">true</span>
              {"}"}
              {"}"}
              {"\n"}
              <span className="kw">/{">"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>isComplete</code>를 true로 전환하는 타이밍이 중요합니다.
              스트리밍이 끝나기 전에 true로 설정하면 미완성 마크다운이 깨져 보일 수 있습니다. LLM의
              스트리밍 종료 신호를 받은 후에만 true로 설정하세요.
            </Callout>

            {/* 마크다운 비활성화 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 마크다운 렌더링 비활성화
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              마크다운 렌더링을 비활성화하면 텍스트가 항상 원시 형태로 표시됩니다. 코드 전용
              출력이나 마크다운 파싱이 불필요한 경우에 사용합니다.
            </p>
            <CodeBlock>
              <span className="kw">{"<"}</span>
              <span className="fn">StreamingMessage</span>
              {"\n"}
              {"  "}
              <span className="prop">text</span>={"{"}
              {"{"}
              <span className="prop">rawOutput</span>
              {"}"}
              {"}"}
              {"\n"}
              {"  "}
              <span className="prop">isComplete</span>={"{"}
              {"{"}
              <span className="kw">true</span>
              {"}"}
              {"}"}
              {"\n"}
              {"  "}
              <span className="prop">enableMarkdown</span>={"{"}
              {"{"}
              <span className="kw">false</span>
              {"}"}
              {"}"}
              {"\n"}
              <span className="kw">/{">"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>enableMarkdown</code>은 기본값이 true입니다. 대부분의 LLM
              응답은 마크다운을 포함하므로 명시적으로 비활성화할 필요가 거의 없습니다.
            </Callout>

            <DeepDive title="useMemo를 사용한 렌더링 최적화">
              <p className="mb-3">
                StreamingMessage는 <code className="text-cyan-600">useMemo</code>를 사용하여
                텍스트가 변경될 때만 마크다운 파싱을 수행합니다. 의존성 배열은
                <code className="text-cyan-600">[text, isComplete, enableMarkdown]</code>입니다.
              </p>
              <p className="text-gray-600">
                스트리밍 중에는 매 글자마다 text가 변경되므로 useMemo가 자주 재계산되지만,
                partialRenderMarkdown의 분리 로직 덕분에 완성된 부분의 마크다운은 캐시되고 미완성
                부분만 원시 텍스트로 빠르게 추가됩니다.
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
              점진적 렌더링 상태 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              partialRenderMarkdown 함수의 분리 로직입니다. 코드 블록의 쌍 여부에 따라 두 가지 분리
              전략을 사용합니다.
            </p>

            <MermaidDiagram
              title="partialRenderMarkdown 분리 전략"
              titleColor="purple"
              chart={`graph TD
  INPUT["입력 텍스트<br/><small>스트리밍 중인 전체 텍스트</small>"]
  CHECK["코드 블록 쌍 확인<br/><small>backtick(''') 개수가 홀수인가?</small>"]
  IN_CODE["미완성 코드 블록<br/><small>마지막 ''' 위치에서 분리</small>"]
  NOT_CODE["코드 블록 완성<br/><small>마지막 빈 줄(문단 경계)에서 분리</small>"]
  NO_PARA["단일 문단<br/><small>문단 경계 없음 — 전체가 raw</small>"]
  RESULT["결과<br/><small>rendered + raw 반환</small>"]

  INPUT --> CHECK
  CHECK -->|"홀수 (미완성)"| IN_CODE
  CHECK -->|"짝수 (완성)"| NOT_CODE
  NOT_CODE -->|"빈 줄 없음"| NO_PARA
  IN_CODE --> RESULT
  NOT_CODE --> RESULT
  NO_PARA --> RESULT

  style INPUT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CHECK fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style IN_CODE fill:#fef9c3,stroke:#eab308,color:#1e293b
  style NOT_CODE fill:#dcfce7,stroke:#10b981,color:#1e293b
  style NO_PARA fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style RESULT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">partialRenderMarkdown</code> 함수의 분리 로직입니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">partialRenderMarkdown</span>
              (<span className="prop">text</span>: <span className="type">string</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 코드 블록(```) 개수를 세서 미완성 여부 판단"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">codeBlockCount</span> = (
              <span className="prop">text</span>.<span className="fn">match</span>(
              <span className="str">/```/g</span>) || []).<span className="prop">length</span>;
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">isInCodeBlock</span> ={" "}
              <span className="prop">codeBlockCount</span> % <span className="num">2</span> !=={" "}
              <span className="num">0</span>;{"\n"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">isInCodeBlock</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [2] 마지막 미완성 ``` 위치에서 분리"}</span>
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">lastCodeBlockStart</span> ={" "}
              <span className="prop">text</span>.<span className="fn">lastIndexOf</span>(
              <span className="str">&quot;```&quot;</span>);
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">completePart</span> ={" "}
              <span className="prop">text</span>.<span className="fn">slice</span>(
              <span className="num">0</span>, <span className="prop">lastCodeBlockStart</span>);
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">incompletePart</span> ={" "}
              <span className="prop">text</span>.<span className="fn">slice</span>(
              <span className="prop">lastCodeBlockStart</span>);
              {"\n"}
              {"    "}
              <span className="kw">return</span> {"{"} <span className="prop">rendered</span>: ...,{" "}
              <span className="prop">raw</span>: <span className="prop">incompletePart</span> {"}"};
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 코드 블록이 완성된 경우 — 마지막 빈 줄에서 분리"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">lastParaBreak</span> ={" "}
              <span className="prop">text</span>.<span className="fn">lastIndexOf</span>(
              <span className="str">&quot;\\n\\n&quot;</span>);
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">lastParaBreak</span> === -
              <span className="num">1</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [4] 빈 줄이 없으면 전체가 미완성"}</span>
              {"\n"}
              {"    "}
              <span className="kw">return</span> {"{"} <span className="prop">rendered</span>:{" "}
              <span className="str">&quot;&quot;</span>, <span className="prop">raw</span>:{" "}
              <span className="prop">text</span> {"}"};{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> {"{"} <span className="prop">rendered</span>: ...,{" "}
              <span className="prop">raw</span>: ... {"}"};{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 백틱 3개(<code>```</code>)의 개수가
                홀수이면 현재 코드 블록 안에 있다고 판단합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 미완성 코드 블록이 있으면 마지막{" "}
                <code>```</code> 위치를 기준으로 분리합니다. 그 앞부분은 안전하게 마크다운으로
                렌더링할 수 있습니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 코드 블록이 모두 완성되었으면 마지막
                빈 줄(문단 경계)을 기준으로 분리합니다. 완성된 문단만 마크다운으로 렌더링됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> 빈 줄이 한 번도 없으면 아직 첫 번째
                문단이 완성되지 않은 것이므로, 전체 텍스트를 원시 텍스트로 표시합니다.
              </p>
            </div>
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
                &quot;마크다운이 렌더링되지 않고 원시 텍스트로 보여요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                세 가지 원인이 있을 수 있습니다:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>enableMarkdown가 false:</strong> 명시적으로 비활성화되었는지 확인하세요.
                </li>
                <li>
                  <strong>hasMarkdown() 검사 실패:</strong> 텍스트에 마크다운 문법(코드 블록, 헤딩,
                  리스트 등)이 감지되지 않으면 원시 텍스트로 표시됩니다.
                </li>
                <li>
                  <strong>스트리밍 중 첫 문단:</strong> 아직 빈 줄이 없는 단일 문단이면 전체가 raw로
                  표시됩니다. 문단이 완성되면 자동으로 마크다운이 적용됩니다.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;커서(▌)가 사라지지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                커서는 <code className="text-cyan-600">isComplete</code>가 false인 동안 표시됩니다.
                스트리밍이 끝났는데도 커서가 보인다면, 부모 컴포넌트에서{" "}
                <code className="text-cyan-600">isComplete</code>를 true로 변경하지 않은 것입니다.
                LLM 스트리밍 종료 이벤트를 정확히 감지하여 상태를 업데이트하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;코드 블록이 깨져 보여요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                스트리밍 중에 코드 블록의 닫는 <code>```</code>이 아직 도착하지 않은 경우입니다.
                이는 정상적인 동작입니다 &mdash; partialRenderMarkdown이 미완성 코드 블록을 감지하여
                원시 텍스트로 표시하기 때문입니다. 닫는 <code>```</code>이 도착하면 자동으로
                마크다운 렌더링이 적용됩니다.
              </p>
              <Callout type="tip" icon="*">
                코드 블록 완성 여부는 <code>```</code> 개수의 홀짝으로 판단합니다. 중첩 코드 블록은
                지원하지 않으므로 백틱 3개 이상의 중첩이 있으면 잘못 판단할 수 있습니다.
              </Callout>
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
                  name: "ToolCallBlock.tsx",
                  slug: "tool-call-block",
                  relation: "sibling",
                  desc: "도구 호출 상태와 결과를 리치하게 표시하는 동반 컴포넌트",
                },
                {
                  name: "ThinkingBlock.tsx",
                  slug: "thinking-block",
                  relation: "sibling",
                  desc: "LLM의 Extended Thinking 내용을 표시하는 동반 컴포넌트",
                },
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "LLM 스트리밍 응답을 수신하고 StreamingMessage에 텍스트를 전달하는 메인 루프",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
