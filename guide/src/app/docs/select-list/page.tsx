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

export default function SelectListPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/cli/components/SelectList.tsx" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              SelectList
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="cli" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            키보드로 탐색 가능한 재사용 가능한 선택 목록 UI 컴포넌트입니다.
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
              <code className="text-cyan-600">SelectList</code>는 여러 옵션 중 하나를 선택할 수 있는
              대화형 목록 컴포넌트입니다. 위/아래 화살표 키로 항목 간 이동하고,
              Enter로 선택을 확정하며, Escape로 취소할 수 있습니다.
            </p>
            <p>
              옵션이 <code className="text-cyan-600">maxVisible</code>(기본값: 8)보다 많으면 자동으로
              스크롤이 적용되며, 위/아래에 &quot;&#8593; more&quot; / &quot;&#8595; more&quot; 표시가 나타납니다.
              현재 선택된 항목은 시안색 + 볼드 + &#9656; 마커로 강조됩니다.
            </p>
            <p>
              주요 사용처는 <code className="text-cyan-600">/model</code> 명령에서의 모델 선택이며,
              <code className="text-cyan-600">SelectOption</code> 인터페이스를 따르는 모든 선택 시나리오에
              범용적으로 활용할 수 있습니다.
            </p>
          </div>

          <MermaidDiagram
            title="SelectList 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  CMD["슬래시 명령<br/><small>/model, /config 등</small>"]
  REG["Command Registry<br/><small>commands/registry.ts</small>"]
  SL["SelectList<br/><small>선택 목록 UI</small>"]
  CB_SELECT["onSelect 콜백<br/><small>선택 확정</small>"]
  CB_CANCEL["onCancel 콜백<br/><small>취소 처리</small>"]
  INK["Ink useInput<br/><small>키보드 입력 처리</small>"]

  CMD -->|"options 배열"| SL
  REG -->|"SelectOption 타입"| SL
  SL -->|"Enter"| CB_SELECT
  SL -->|"Escape"| CB_CANCEL
  INK -->|"↑↓ 화살표"| SL

  style SL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CMD fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style REG fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CB_SELECT fill:#dcfce7,stroke:#10b981,color:#1e293b
  style CB_CANCEL fill:#fee2e2,stroke:#ef4444,color:#1e293b
  style INK fill:#e0e7ff,stroke:#3b82f6,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 터미널의 <code>fzf</code>나 npm의 <code>inquirer</code>
            라이브러리에서 제공하는 인터랙티브 선택 목록과 비슷합니다.
            화살표 키로 탐색하고, Enter로 선택하며, Esc로 취소하는 직관적인 패턴입니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* SelectListProps */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface SelectListProps
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            <code className="text-cyan-600">SelectList</code> 컴포넌트의 Props입니다.
          </p>
          <ParamTable
            params={[
              { name: "prompt", type: "string", required: true, desc: "목록 위에 표시할 프롬프트 텍스트 (노란색 볼드로 렌더링)" },
              { name: "options", type: "readonly SelectOption[]", required: true, desc: "선택 가능한 옵션 배열 (value, label, description 포함)" },
              { name: "onSelect", type: "(value: string) => void", required: true, desc: "Enter로 선택 확인 시 호출 — 선택된 옵션의 value 전달" },
              { name: "onCancel", type: "() => void", required: true, desc: "Escape로 취소 시 호출되는 콜백" },
              { name: "maxVisible", type: "number", required: false, desc: "한 번에 표시할 최대 옵션 수 (기본값: 8, 초과 시 스크롤)" },
            ]}
          />

          {/* SelectOption (from registry) */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface SelectOption
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            <code className="text-cyan-600">commands/registry.ts</code>에서 import되는 옵션 타입입니다.
            각 옵션은 고유한 value와 표시용 label을 가집니다.
          </p>
          <ParamTable
            params={[
              { name: "value", type: "string", required: true, desc: "선택 시 콜백에 전달되는 고유 식별자 (React key로도 사용)" },
              { name: "label", type: "string", required: true, desc: "화면에 표시되는 텍스트" },
              { name: "description", type: "string", required: false, desc: "label 옆에 흐린 색으로 표시되는 부가 설명" },
            ]}
          />

          {/* SelectList function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function SelectList
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            키보드 탐색이 가능한 선택 목록 함수 컴포넌트입니다.
            내부적으로 <code className="text-cyan-600">selectedIndex</code>와
            <code className="text-cyan-600">scrollOffset</code> 두 가지 상태를 관리합니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">SelectList</span>({"{"} <span className="prop">prompt</span>, <span className="prop">options</span>, <span className="prop">onSelect</span>, <span className="prop">onCancel</span>, <span className="prop">maxVisible</span> {"}"}: <span className="type">SelectListProps</span>): <span className="type">JSX.Element</span>
          </CodeBlock>

          {/* 키보드 바인딩 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            키보드 바인딩
          </h3>
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2">
            <p>&bull; <strong>↑ (Up Arrow)</strong> &mdash; 이전 항목으로 이동, 필요 시 스크롤 오프셋 조정</p>
            <p>&bull; <strong>↓ (Down Arrow)</strong> &mdash; 다음 항목으로 이동, 필요 시 스크롤 오프셋 조정</p>
            <p>&bull; <strong>Enter</strong> &mdash; 현재 선택된 항목의 <code className="text-cyan-600">value</code>로 <code className="text-cyan-600">onSelect</code> 호출</p>
            <p>&bull; <strong>Escape</strong> &mdash; <code className="text-cyan-600">onCancel</code> 호출</p>
          </div>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              옵션 배열이 비어 있으면 &quot;No options available.&quot; 메시지가 표시되고
              키보드 입력이 무시됩니다. <code className="text-cyan-600">useInput</code> Hook은
              빈 배열에서도 등록되어 있지만 <code className="text-cyan-600">options[selectedIndex]</code>가
              <code className="text-cyan-600">undefined</code>일 때 <code className="text-cyan-600">onSelect</code>를
              호출하지 않습니다.
            </li>
            <li>
              <code className="text-cyan-600">selectedIndex</code>는 0부터 시작합니다. 첫 번째 항목이
              기본 선택 상태입니다.
            </li>
            <li>
              스크롤 오프셋은 선택 인덱스와 연동됩니다. 위로 이동하면
              <code className="text-cyan-600">Math.min(scrollOffset, nextIndex)</code>로,
              아래로 이동하면 <code className="text-cyan-600">Math.max(scrollOffset, nextIndex - maxVisible + 1)</code>로
              자동 조정됩니다.
            </li>
            <li>
              회색 테두리(<code className="text-cyan-600">borderStyle=&quot;single&quot;</code>)가 있는 Box 안에
              렌더링되며, 하단에는 &quot;Enter to select, Esc to cancel&quot; 안내문이 표시됩니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 모델 선택</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">/model</code> 명령에서 사용하는 패턴입니다.
            사용 가능한 모델 목록을 옵션으로 전달하고, 선택 결과를 콜백으로 받습니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="type">SelectList</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./SelectList.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="kw">const</span> <span className="prop">modelOptions</span> = [
            {"\n"}{"  "}{"{"} <span className="prop">value</span>: <span className="str">&quot;gpt-4o&quot;</span>, <span className="prop">label</span>: <span className="str">&quot;GPT-4o&quot;</span>, <span className="prop">description</span>: <span className="str">&quot;최신 멀티모달 모델&quot;</span> {"}"},
            {"\n"}{"  "}{"{"} <span className="prop">value</span>: <span className="str">&quot;claude-3&quot;</span>, <span className="prop">label</span>: <span className="str">&quot;Claude 3&quot;</span>, <span className="prop">description</span>: <span className="str">&quot;Anthropic 모델&quot;</span> {"}"},
            {"\n"}{"  "}{"{"} <span className="prop">value</span>: <span className="str">&quot;local-llama&quot;</span>, <span className="prop">label</span>: <span className="str">&quot;Llama 3.1&quot;</span>, <span className="prop">description</span>: <span className="str">&quot;로컬 실행&quot;</span> {"}"},
            {"\n"}];
            {"\n"}
            {"\n"}&lt;<span className="type">SelectList</span>
            {"\n"}{"  "}<span className="prop">prompt</span>=<span className="str">&quot;사용할 모델을 선택하세요:&quot;</span>
            {"\n"}{"  "}<span className="prop">options</span>={"{"}modelOptions{"}"}
            {"\n"}{"  "}<span className="prop">onSelect</span>={"{"}(<span className="prop">value</span>) =&gt; <span className="fn">handleModelChange</span>(<span className="prop">value</span>){"}"}
            {"\n"}{"  "}<span className="prop">onCancel</span>={"{"}() =&gt; <span className="fn">setShowSelector</span>(<span className="kw">false</span>){"}"}
            {"\n"}/&gt;
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> 옵션의 <code>value</code>는 반드시 고유해야 합니다.
            React의 <code>key</code> prop으로 사용되므로 중복되면 렌더링 경고가 발생합니다.
          </Callout>

          {/* 스크롤 사용법 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 스크롤과 maxVisible 조정
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            옵션이 많을 때 <code className="text-cyan-600">maxVisible</code>을 조정하여
            한 번에 보이는 항목 수를 제어할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 5개만 표시하고 나머지는 스크롤"}</span>
            {"\n"}&lt;<span className="type">SelectList</span>
            {"\n"}{"  "}<span className="prop">prompt</span>=<span className="str">&quot;파일을 선택하세요:&quot;</span>
            {"\n"}{"  "}<span className="prop">options</span>={"{"}fileOptions{"}"} <span className="cm">{"// 20개 옵션"}</span>
            {"\n"}{"  "}<span className="prop">maxVisible</span>={"{"}5{"}"}
            {"\n"}{"  "}<span className="prop">onSelect</span>={"{"}handleFileSelect{"}"}
            {"\n"}{"  "}<span className="prop">onCancel</span>={"{"}handleCancel{"}"}
            {"\n"}/&gt;
            {"\n"}
            {"\n"}<span className="cm">{"// 렌더링 결과:"}</span>
            {"\n"}<span className="cm">{"// 파일을 선택하세요:"}</span>
            {"\n"}<span className="cm">{"//   ↑ more"}</span>
            {"\n"}<span className="cm">{"//   file-3.ts"}</span>
            {"\n"}<span className="cm">{"// ▸ file-4.ts  ← 선택된 항목"}</span>
            {"\n"}<span className="cm">{"//   file-5.ts"}</span>
            {"\n"}<span className="cm">{"//   file-6.ts"}</span>
            {"\n"}<span className="cm">{"//   file-7.ts"}</span>
            {"\n"}<span className="cm">{"//   ↓ more"}</span>
            {"\n"}<span className="cm">{"// (4/20) Enter to select, Esc to cancel"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> 옵션 수가 <code>maxVisible</code>보다 많을 때만 &quot;&#8593; more&quot; /
            &quot;&#8595; more&quot; 인디케이터와 &quot;(N/M)&quot; 카운터가 표시됩니다.
            적을 때는 깔끔하게 전체 목록만 표시됩니다.
          </Callout>

          <DeepDive title="스크롤 오프셋 관리 로직">
            <p className="mb-3">
              <code className="text-cyan-600">selectedIndex</code>와 <code className="text-cyan-600">scrollOffset</code>은
              항상 연동되어 선택된 항목이 화면에 보이도록 보장합니다.
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><strong>위로 이동:</strong> <code>scrollOffset = Math.min(scrollOffset, nextIndex)</code> &mdash; 선택이 화면 위로 벗어나면 스크롤을 위로 당김</li>
              <li><strong>아래로 이동:</strong> <code>scrollOffset = Math.max(scrollOffset, nextIndex - maxVisible + 1)</code> &mdash; 선택이 화면 아래로 벗어나면 스크롤을 아래로 밀기</li>
              <li><strong>화면 표시:</strong> <code>options.slice(scrollOffset, scrollOffset + maxVisible)</code> &mdash; 오프셋 기반으로 보이는 항목만 추출</li>
            </ul>
            <p className="mt-3 text-amber-600">
              <code>selectedIndex</code>는 전체 배열 기준이고,
              <code>scrollOffset</code>은 표시 시작 위치입니다.
              <code>actualIndex = scrollOffset + 화면상의 인덱스</code>로 매핑됩니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>입력 처리 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">useInput</code> Hook이 키보드 입력을 받아
            상태를 업데이트하거나 콜백을 호출하는 흐름입니다.
          </p>

          <MermaidDiagram
            title="SelectList 입력 처리 흐름"
            titleColor="purple"
            chart={`graph TD
  INPUT["useInput<br/><small>키보드 입력 수신</small>"]
  INPUT --> ESC{"Escape?"}
  INPUT --> RET{"Enter?"}
  INPUT --> UP{"Up Arrow?"}
  INPUT --> DOWN{"Down Arrow?"}

  ESC -->|"예"| CANCEL["onCancel() 호출<br/><small>선택 취소</small>"]
  RET -->|"예"| CHECK{"options[index]<br/>존재?"}
  CHECK -->|"예"| SELECT["onSelect(value) 호출<br/><small>선택 확정</small>"]
  CHECK -->|"아니오"| NOOP["무시<br/><small>빈 배열일 때</small>"]

  UP -->|"예"| UPIDX["selectedIndex - 1<br/><small>Math.max(0, prev - 1)</small>"]
  UPIDX --> UPSCR["scrollOffset 조정<br/><small>Math.min(so, next)</small>"]

  DOWN -->|"예"| DOWNIDX["selectedIndex + 1<br/><small>Math.min(length-1, prev+1)</small>"]
  DOWNIDX --> DOWNSCR["scrollOffset 조정<br/><small>Math.max(so, next-max+1)</small>"]

  style INPUT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style ESC fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style RET fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style UP fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style DOWN fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style CANCEL fill:#fee2e2,stroke:#ef4444,color:#1e293b
  style SELECT fill:#dcfce7,stroke:#10b981,color:#1e293b
  style NOOP fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style CHECK fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style UPIDX fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style DOWNIDX fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style UPSCR fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style DOWNSCR fill:#e0e7ff,stroke:#3b82f6,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">useInput</code> Hook 내부의 키 처리 로직입니다.
          </p>
          <CodeBlock>
            <span className="fn">useInput</span>((<span className="prop">_input</span>, <span className="prop">key</span>) =&gt; {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] Escape → 즉시 취소"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">key</span>.<span className="prop">escape</span>) {"{"} <span className="fn">onCancel</span>(); <span className="kw">return</span>; {"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] Enter → 선택된 항목이 있으면 확정"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">key</span>.<span className="prop">return</span>) {"{"}
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">selected</span> = <span className="prop">options</span>[<span className="prop">selectedIndex</span>];
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">selected</span>) <span className="fn">onSelect</span>(<span className="prop">selected</span>.<span className="prop">value</span>);
            {"\n"}{"    "}<span className="kw">return</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] Up → 이전 항목 (최소 0)"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">key</span>.<span className="prop">upArrow</span>) {"{"}
            {"\n"}{"    "}<span className="fn">setSelectedIndex</span>((<span className="prop">prev</span>) =&gt; {"{"}
            {"\n"}{"      "}<span className="kw">const</span> <span className="prop">next</span> = <span className="type">Math</span>.<span className="fn">max</span>(<span className="num">0</span>, <span className="prop">prev</span> - <span className="num">1</span>);
            {"\n"}{"      "}<span className="fn">setScrollOffset</span>((<span className="prop">so</span>) =&gt; <span className="type">Math</span>.<span className="fn">min</span>(<span className="prop">so</span>, <span className="prop">next</span>));
            {"\n"}{"      "}<span className="kw">return</span> <span className="prop">next</span>;
            {"\n"}{"    "}{"}"});
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [4] Down → 다음 항목 (최대 length-1)"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">key</span>.<span className="prop">downArrow</span>) {"{"}
            {"\n"}{"    "}<span className="fn">setSelectedIndex</span>((<span className="prop">prev</span>) =&gt; {"{"}
            {"\n"}{"      "}<span className="kw">const</span> <span className="prop">next</span> = <span className="type">Math</span>.<span className="fn">min</span>(<span className="prop">options</span>.<span className="prop">length</span> - <span className="num">1</span>, <span className="prop">prev</span> + <span className="num">1</span>);
            {"\n"}{"      "}<span className="fn">setScrollOffset</span>((<span className="prop">so</span>) =&gt; <span className="type">Math</span>.<span className="fn">max</span>(<span className="prop">so</span>, <span className="prop">next</span> - <span className="prop">maxVisible</span> + <span className="num">1</span>));
            {"\n"}{"      "}<span className="kw">return</span> <span className="prop">next</span>;
            {"\n"}{"    "}{"}"});
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"});
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> Escape 키가 눌리면 즉시 <code className="text-cyan-600">onCancel</code>을 호출하고 early return합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> Enter 키가 눌리면 현재 인덱스의 옵션이 존재하는지 확인 후 <code className="text-cyan-600">onSelect</code>를 호출합니다. 빈 배열일 때 안전합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 위 화살표는 인덱스를 1 감소시키되 0 미만으로 내려가지 않습니다. 동시에 스크롤 오프셋을 조정하여 선택 항목이 보이도록 합니다.</p>
            <p><strong className="text-gray-900">[4]</strong> 아래 화살표는 인덱스를 1 증가시키되 배열 길이를 초과하지 않습니다. 선택이 화면 밖으로 나가면 스크롤을 밀어 올립니다.</p>
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
              &quot;Enter를 눌러도 아무 반응이 없어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              옵션 배열이 비어 있으면 <code className="text-cyan-600">options[selectedIndex]</code>가
              <code className="text-cyan-600">undefined</code>가 되어 <code className="text-cyan-600">onSelect</code>가
              호출되지 않습니다. 옵션 배열에 최소 하나의 항목이 있는지 확인하세요.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;화살표 키가 작동하지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              Ink의 <code className="text-cyan-600">useInput</code> Hook은 포커스된 컴포넌트에서만
              작동합니다. 다른 컴포넌트에서도 <code className="text-cyan-600">useInput</code>을 사용하고
              있다면 입력이 충돌할 수 있습니다.
            </p>
            <Callout type="tip" icon="*">
              SelectList가 표시될 때 다른 <code>useInput</code> 리스너를 비활성화하세요.
              Ink의 <code>useInput</code>에 조건부 활성화 옵션을 사용할 수 있습니다.
            </Callout>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;옵션이 많은데 스크롤이 안 돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">maxVisible</code>이 옵션 수 이상이면 스크롤이 비활성화됩니다.
              기본값은 8이므로, 8개 이하의 옵션에서는 스크롤이 필요하지 않습니다.
              더 적은 수만 표시하고 싶다면 <code className="text-cyan-600">maxVisible</code>을
              낮은 값으로 설정하세요.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;description이 표시되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">description</code>은 선택적 필드입니다.
              값이 <code className="text-cyan-600">undefined</code>이면 label만 표시됩니다.
              description을 포함하면 label 옆에 &quot; &mdash; description&quot; 형태로
              흐린 색으로 표시됩니다.
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
                name: "slash-command-menu.ts",
                slug: "slash-command-menu",
                relation: "sibling",
                desc: "슬래시 명령 메뉴 — 명령 목록에서 선택하는 유사 UI 패턴",
              },
              {
                name: "model-capabilities.ts",
                slug: "model-capabilities",
                relation: "sibling",
                desc: "/model 명령에서 모델 선택 시 사용되는 모델 정보 모듈",
              },
              {
                name: "user-input.tsx",
                slug: "user-input",
                relation: "sibling",
                desc: "사용자 입력 처리 컴포넌트 — SelectList와 함께 대화형 UI를 구성",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
