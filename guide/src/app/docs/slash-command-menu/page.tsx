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

export default function SlashCommandMenuPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/cli/components/SlashCommandMenu.tsx" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              SlashCommandMenu
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="cli" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            사용자가 &quot;/&quot;를 입력하면 표시되는 슬래시 명령어 자동완성 메뉴 컴포넌트입니다.
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
              <code className="text-cyan-600">SlashCommandMenu</code>는 사용자가 입력창에 &quot;/&quot;를
              타이핑하면 나타나는 자동완성 팝업 메뉴입니다. 등록된 슬래시 명령어 목록에서
              입력된 접두사와 일치하는 명령어를 필터링하여 보여주고,
              키보드로 탐색하여 선택할 수 있습니다.
            </p>
            <p>
              최대 6개의 항목이 화면에 동시에 표시되며, 더 많은 항목이 있으면 위아래로 스크롤됩니다.
              현재 선택된 항목은 시안색으로 강조되고, 각 항목에는 명령어 이름과 설명이 함께 표시됩니다.
            </p>
            <p>
              별도의 <code className="text-cyan-600">getMatchingCommands</code> 유틸리티 함수가 export되어
              입력 텍스트에서 슬래시 접두사를 추출하고 매칭되는 명령어를 필터링합니다.
              이미 인수를 입력 중이면(공백 포함) 빈 배열을 반환하여 메뉴가 자동으로 닫힙니다.
            </p>
          </div>

          <MermaidDiagram
            title="SlashCommandMenu 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  UI["User Input<br/><small>사용자 입력 컴포넌트</small>"]
  SCM["SlashCommandMenu<br/><small>자동완성 메뉴</small>"]
  REG["Command Registry<br/><small>슬래시 명령어 레지스트리</small>"]
  EXEC["Skill Executor<br/><small>명령어 실행기</small>"]
  LOADER["Skill Loader<br/><small>스킬 로더 (4 디렉토리)</small>"]

  UI -->|"'/' 입력 감지"| SCM
  REG -->|"SlashCommand[] 목록"| SCM
  SCM -->|"선택된 명령어"| UI
  UI -->|"명령어 실행"| EXEC
  LOADER -->|"명령어 등록"| REG

  style SCM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style UI fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style REG fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LOADER fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> SlashCommandMenu는 IDE의 명령 팔레트(Command Palette)와 비슷합니다.
            VS Code에서 <code>Ctrl+Shift+P</code>를 누르면 명령 목록이 나타나고, 타이핑하면 필터링되는 것처럼,
            dbcode에서 <code>/</code>를 입력하면 사용 가능한 슬래시 명령어가 필터링되어 표시됩니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* SlashCommandMenuProps interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface SlashCommandMenuProps
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            SlashCommandMenu 컴포넌트에 전달되는 Props입니다. 모든 프로퍼티는 <code className="text-cyan-600">readonly</code>입니다.
          </p>
          <ParamTable
            params={[
              { name: "commands", type: "readonly SlashCommand[]", required: true, desc: "모든 사용 가능한 슬래시 명령어 배열 (registry에서 가져옴)" },
              { name: "prefix", type: "string", required: true, desc: "'/' 이후의 텍스트로 명령어를 필터링하는 접두사" },
              { name: "onSelect", type: "(name: string) => void", required: true, desc: "Tab 또는 Enter로 명령어 선택 시 호출되는 콜백 (명령어 이름 전달)" },
              { name: "onClose", type: "() => void", required: true, desc: "Escape로 메뉴 닫기 시 호출되는 콜백" },
              { name: "visible", type: "boolean", required: true, desc: "메뉴 표시 여부 (false이면 렌더링하지 않음)" },
            ]}
          />

          {/* getMatchingCommands function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            getMatchingCommands(input, allCommands)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            사용자 입력을 기반으로 슬래시 명령어를 필터링하는 유틸리티 함수입니다.
            컴포넌트 외부에서도 사용할 수 있도록 export됩니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">getMatchingCommands</span>(
            {"\n"}{"  "}<span className="prop">input</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">allCommands</span>: <span className="kw">readonly</span> <span className="type">SlashCommand</span>[]
            {"\n"}): <span className="kw">readonly</span> <span className="type">SlashCommand</span>[]
          </CodeBlock>
          <ParamTable
            params={[
              { name: "input", type: "string", required: true, desc: "사용자의 전체 입력 텍스트 (예: \"/mo\", \"/model\")" },
              { name: "allCommands", type: "readonly SlashCommand[]", required: true, desc: "모든 사용 가능한 슬래시 명령어 배열" },
            ]}
          />
          <div className="text-[13px] text-gray-600 mt-3 space-y-1">
            <p>&bull; <code className="text-cyan-600">&quot;/&quot;</code>로 시작하지 않으면 빈 배열 반환</p>
            <p>&bull; 공백이 포함되어 있으면(인수 입력 중) 빈 배열 반환</p>
            <p>&bull; 대소문자 구분 없이 접두사 매칭 (<code className="text-cyan-600">toLowerCase()</code>)</p>
          </div>

          {/* MAX_VISIBLE constant */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            MAX_VISIBLE
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            한 번에 화면에 표시되는 최대 항목 수입니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">MAX_VISIBLE</span> = <span className="num">6</span>;
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">visible</code>이 false이거나 필터링된 결과가 0개이면
              컴포넌트는 <code className="text-cyan-600">null</code>을 반환합니다.
            </li>
            <li>
              필터링된 목록이 변경되면 <code className="text-cyan-600">useEffect</code>로
              <code className="text-cyan-600">selectedIndex</code>와 <code className="text-cyan-600">scrollOffset</code>이
              자동으로 0으로 리셋됩니다.
            </li>
            <li>
              <code className="text-cyan-600">useInput</code> 훅은 <code className="text-cyan-600">visible</code>이 true이고
              필터링 결과가 있을 때만 활성화됩니다 (<code className="text-cyan-600">isActive</code>).
            </li>
            <li>
              이 컴포넌트는 <code className="text-cyan-600">React.memo</code>로 감싸져 있지 <strong>않습니다</strong>.
              입력이 바뀔 때마다 prefix가 변경되어 자연스럽게 리렌더링됩니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 자동완성 메뉴 표시</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            사용자 입력 컴포넌트와 함께 사용하는 기본 패턴입니다.
            입력이 &quot;/&quot;로 시작하면 메뉴를 표시합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> [<span className="prop">input</span>, <span className="prop">setInput</span>] = <span className="fn">useState</span>(<span className="str">&quot;&quot;</span>);
            {"\n"}<span className="kw">const</span> <span className="prop">showMenu</span> = <span className="prop">input</span>.<span className="fn">startsWith</span>(<span className="str">&quot;/&quot;</span>);
            {"\n"}
            {"\n"}<span className="kw">{"<"}</span><span className="fn">SlashCommandMenu</span>
            {"\n"}{"  "}<span className="prop">commands</span>={"{"}{"{"}<span className="prop">allCommands</span>{"}"}{"}"}{"\n"}{"  "}<span className="prop">prefix</span>={"{"}{"{"}<span className="prop">input</span>{"}"}{"}"}{"\n"}{"  "}<span className="prop">visible</span>={"{"}{"{"}<span className="prop">showMenu</span>{"}"}{"}"}{"\n"}{"  "}<span className="prop">onSelect</span>={"{"}{"{"}<span className="fn">handleSelect</span>{"}"}{"}"}{"\n"}{"  "}<span className="prop">onClose</span>={"{"}{"{"}<span className="fn">handleClose</span>{"}"}{"}"}{"\n"}<span className="kw">/{">"}</span>
          </CodeBlock>

          <CodeBlock>
            <span className="cm">{"// 명령어 선택 시 입력을 완성"}</span>
            {"\n"}<span className="kw">function</span> <span className="fn">handleSelect</span>(<span className="prop">name</span>: <span className="type">string</span>) {"{"}
            {"\n"}{"  "}<span className="fn">setInput</span>(<span className="str">`/${"{"}</span><span className="prop">name</span><span className="str">{"}"} `</span>);
            {"\n"}{"  "}<span className="cm">{"// \"/mo\" → \"/model \" 로 완성"}</span>
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>prefix</code>에 전체 입력 텍스트를 전달하세요.
            <code>getMatchingCommands</code> 내부에서 &quot;/&quot; 접두사 추출과 필터링을 자동으로 처리합니다.
            &quot;/&quot;를 제거한 텍스트를 전달하면 필터링이 작동하지 않습니다.
          </Callout>

          {/* 키보드 조작 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 키보드 탐색과 스크롤
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            메뉴가 열려있을 때의 키보드 조작과 스크롤 동작입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 키보드 조작:"}</span>
            {"\n"}<span className="cm">{"// ↑     : 위로 이동 (첫 번째에서 멈춤, 순환 없음)"}</span>
            {"\n"}<span className="cm">{"// ↓     : 아래로 이동 (마지막에서 멈춤, 순환 없음)"}</span>
            {"\n"}<span className="cm">{"// Tab   : 현재 선택된 명령어 선택"}</span>
            {"\n"}<span className="cm">{"// Enter : 현재 선택된 명령어 선택"}</span>
            {"\n"}<span className="cm">{"// Esc   : 메뉴 닫기"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 표시 예시 (7개 중 6개 표시):"}</span>
            {"\n"}<span className="cm">{"// ┌────────────────────────────┐"}</span>
            {"\n"}<span className="cm">{"// │ ▸ /model — 모델 선택      │"}</span>
            {"\n"}<span className="cm">{"// │   /memory — 메모리 관리   │"}</span>
            {"\n"}<span className="cm">{"// │   /mcp — MCP 서버 관리    │"}</span>
            {"\n"}<span className="cm">{"// │   /mode — 권한 모드 변경  │"}</span>
            {"\n"}<span className="cm">{"// │   /manual — 매뉴얼 보기   │"}</span>
            {"\n"}<span className="cm">{"// │   /mock — 모킹 도구       │"}</span>
            {"\n"}<span className="cm">{"// │   ↓ more                  │"}</span>
            {"\n"}<span className="cm">{"// └────────────────────────────┘"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> 위아래 방향키는 순환하지 않습니다 (PermissionPrompt의 좌우 화살표와 다름).
            첫 번째 항목에서 위쪽을 누르거나 마지막 항목에서 아래쪽을 누르면 아무 일도 일어나지 않습니다.
            <code className="text-cyan-600">Math.max(0, ...)</code>와 <code className="text-cyan-600">Math.min(length - 1, ...)</code>로 범위를 제한합니다.
          </Callout>

          <DeepDive title="getMatchingCommands 필터링 로직 상세">
            <p className="mb-3">
              입력 텍스트에서 슬래시 명령어를 추출하고 필터링하는 과정입니다:
            </p>
            <CodeBlock>
              <span className="kw">export function</span> <span className="fn">getMatchingCommands</span>(<span className="prop">input</span>, <span className="prop">allCommands</span>) {"{"}
              {"\n"}{"  "}<span className="kw">const</span> <span className="prop">trimmed</span> = <span className="prop">input</span>.<span className="fn">trim</span>();
              {"\n"}
              {"\n"}{"  "}<span className="cm">{"// \"/\"로 시작하지 않으면 매칭 없음"}</span>
              {"\n"}{"  "}<span className="kw">if</span> (!<span className="prop">trimmed</span>.<span className="fn">startsWith</span>(<span className="str">&quot;/&quot;</span>)) <span className="kw">return</span> [];
              {"\n"}
              {"\n"}{"  "}<span className="cm">{"// \"/\" 이후 텍스트 추출 + 소문자 변환"}</span>
              {"\n"}{"  "}<span className="kw">const</span> <span className="prop">prefix</span> = <span className="prop">trimmed</span>.<span className="fn">slice</span>(<span className="num">1</span>).<span className="fn">toLowerCase</span>();
              {"\n"}
              {"\n"}{"  "}<span className="cm">{"// 공백 포함 = 인수 입력 중 → 메뉴 닫기"}</span>
              {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">prefix</span>.<span className="fn">includes</span>(<span className="str">&quot; &quot;</span>)) <span className="kw">return</span> [];
              {"\n"}
              {"\n"}{"  "}<span className="cm">{"// 접두사 매칭 필터링"}</span>
              {"\n"}{"  "}<span className="kw">return</span> <span className="prop">allCommands</span>.<span className="fn">filter</span>(
              {"\n"}{"    "}(<span className="prop">cmd</span>) =&gt; <span className="prop">cmd</span>.<span className="prop">name</span>.<span className="fn">startsWith</span>(<span className="prop">prefix</span>)
              {"\n"}{"  "});
              {"\n"}{"}"}
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              예시: <code>&quot;/mo&quot;</code> 입력 시 &rarr; prefix는 <code>&quot;mo&quot;</code> &rarr;
              <code>/model</code>, <code>/mode</code>, <code>/mock</code> 등이 매칭됩니다.
              <code>&quot;/model gpt-4&quot;</code> 입력 시 &rarr; 공백이 포함되어 빈 배열이 반환되고 메뉴가 닫힙니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>스크롤 관리 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            SlashCommandMenu는 최대 6개 항목만 표시하고, 더 있으면 스크롤합니다.
            <code className="text-cyan-600">selectedIndex</code>와 <code className="text-cyan-600">scrollOffset</code>으로
            스크롤 윈도우를 관리합니다.
          </p>

          <MermaidDiagram
            title="SlashCommandMenu 스크롤 관리"
            titleColor="purple"
            chart={`graph TD
  DOWN["↓ 키 입력<br/><small>selectedIndex + 1</small>"]
  UP["↑ 키 입력<br/><small>selectedIndex - 1</small>"]
  CHECK_DOWN["선택이 윈도우 아래로 벗어남?<br/><small>selectedIndex >= scrollOffset + MAX_VISIBLE</small>"]
  CHECK_UP["선택이 윈도우 위로 벗어남?<br/><small>selectedIndex < scrollOffset</small>"]
  SCROLL_DOWN["scrollOffset 증가<br/><small>윈도우를 아래로 이동</small>"]
  SCROLL_UP["scrollOffset 감소<br/><small>윈도우를 위로 이동</small>"]
  RENDER["렌더링<br/><small>filtered.slice(scrollOffset, scrollOffset + 6)</small>"]
  INDICATOR_UP["↑ more 표시<br/><small>scrollOffset > 0일 때</small>"]
  INDICATOR_DOWN["↓ more 표시<br/><small>scrollOffset + 6 < total일 때</small>"]

  DOWN --> CHECK_DOWN
  UP --> CHECK_UP
  CHECK_DOWN -->|"예"| SCROLL_DOWN
  CHECK_DOWN -->|"아니오"| RENDER
  CHECK_UP -->|"예"| SCROLL_UP
  CHECK_UP -->|"아니오"| RENDER
  SCROLL_DOWN --> RENDER
  SCROLL_UP --> RENDER
  RENDER --> INDICATOR_UP
  RENDER --> INDICATOR_DOWN

  style DOWN fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style UP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CHECK_DOWN fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style CHECK_UP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style SCROLL_DOWN fill:#fef9c3,stroke:#eab308,color:#1e293b
  style SCROLL_UP fill:#fef9c3,stroke:#eab308,color:#1e293b
  style RENDER fill:#dcfce7,stroke:#10b981,color:#1e293b
  style INDICATOR_UP fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style INDICATOR_DOWN fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            키보드 탐색과 스크롤 오프셋 관리의 핵심 로직입니다.
          </p>
          <CodeBlock>
            <span className="fn">useInput</span>((<span className="prop">_input</span>, <span className="prop">key</span>) =&gt; {"{"}
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">key</span>.<span className="prop">upArrow</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// [1] 위로 이동 — 0에서 멈춤"}</span>
            {"\n"}{"    "}<span className="fn">setSelectedIndex</span>((<span className="prop">prev</span>) =&gt; {"{"}
            {"\n"}{"      "}<span className="kw">const</span> <span className="prop">next</span> = <span className="fn">Math</span>.<span className="fn">max</span>(<span className="num">0</span>, <span className="prop">prev</span> - <span className="num">1</span>);
            {"\n"}{"      "}<span className="cm">{"// [2] 스크롤 윈도우도 위로 조정"}</span>
            {"\n"}{"      "}<span className="fn">setScrollOffset</span>((<span className="prop">so</span>) =&gt; <span className="fn">Math</span>.<span className="fn">min</span>(<span className="prop">so</span>, <span className="prop">next</span>));
            {"\n"}{"      "}<span className="kw">return</span> <span className="prop">next</span>;
            {"\n"}{"    "}{"}"});
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="kw">else if</span> (<span className="prop">key</span>.<span className="prop">downArrow</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// [3] 아래로 이동 — length-1에서 멈춤"}</span>
            {"\n"}{"    "}<span className="fn">setSelectedIndex</span>((<span className="prop">prev</span>) =&gt; {"{"}
            {"\n"}{"      "}<span className="kw">const</span> <span className="prop">next</span> = <span className="fn">Math</span>.<span className="fn">min</span>(<span className="prop">filtered</span>.<span className="prop">length</span> - <span className="num">1</span>, <span className="prop">prev</span> + <span className="num">1</span>);
            {"\n"}{"      "}<span className="cm">{"// [4] 스크롤 윈도우도 아래로 조정"}</span>
            {"\n"}{"      "}<span className="fn">setScrollOffset</span>((<span className="prop">so</span>) =&gt;
            {"\n"}{"        "}<span className="fn">Math</span>.<span className="fn">max</span>(<span className="prop">so</span>, <span className="prop">next</span> - <span className="prop">MAX_VISIBLE</span> + <span className="num">1</span>)
            {"\n"}{"      "});
            {"\n"}{"      "}<span className="kw">return</span> <span className="prop">next</span>;
            {"\n"}{"    "}{"}"});
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="kw">else if</span> (<span className="prop">key</span>.<span className="prop">tab</span> || <span className="prop">key</span>.<span className="prop">return</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// [5] Tab 또는 Enter — 명령어 선택"}</span>
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">filtered</span>.<span className="prop">length</span> {">"} <span className="num">0</span>) {"{"}
            {"\n"}{"      "}<span className="fn">onSelect</span>(<span className="prop">filtered</span>[<span className="prop">selectedIndex</span>]!.<span className="prop">name</span>);
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="kw">else if</span> (<span className="prop">key</span>.<span className="prop">escape</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// [6] Escape — 메뉴 닫기"}</span>
            {"\n"}{"    "}<span className="fn">onClose</span>();
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"});
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> <code className="text-cyan-600">Math.max(0, prev - 1)</code>로 인덱스가 음수가 되지 않도록 합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> <code className="text-cyan-600">Math.min(so, next)</code>로 스크롤 오프셋이 선택 위치보다 아래에 있지 않도록 조정합니다. 선택이 현재 윈도우 위로 벗어나면 윈도우가 따라 올라갑니다.</p>
            <p><strong className="text-gray-900">[3]</strong> <code className="text-cyan-600">Math.min(filtered.length - 1, prev + 1)</code>로 인덱스가 배열 범위를 넘지 않도록 합니다.</p>
            <p><strong className="text-gray-900">[4]</strong> <code className="text-cyan-600">Math.max(so, next - MAX_VISIBLE + 1)</code>로 선택이 현재 윈도우 아래로 벗어나면 윈도우가 따라 내려갑니다.</p>
            <p><strong className="text-gray-900">[5]</strong> Tab과 Enter 모두 같은 동작(선택)을 합니다. 필터링 결과가 비어있으면 아무 일도 하지 않습니다.</p>
            <p><strong className="text-gray-900">[6]</strong> Escape를 누르면 <code className="text-cyan-600">onClose</code> 콜백을 호출하여 메뉴를 닫습니다.</p>
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
              &quot;/를 입력했는데 메뉴가 안 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              다음 사항을 확인하세요:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>visible Props:</strong> 부모 컴포넌트에서 <code className="text-cyan-600">visible</code>을
                true로 설정하고 있는지 확인하세요.
              </li>
              <li>
                <strong>commands 배열:</strong> 빈 배열을 전달하면 필터링 결과도 비어있어 메뉴가 표시되지 않습니다.
                명령어 레지스트리가 올바르게 초기화되었는지 확인하세요.
              </li>
              <li>
                <strong>공백 포함:</strong> &quot;/ &quot;(슬래시 + 공백)을 입력하면 <code className="text-cyan-600">getMatchingCommands</code>가
                빈 배열을 반환합니다. 공백 없이 &quot;/&quot;만 입력해야 합니다.
              </li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;명령어를 선택했는데 아무 일도 안 일어나요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">onSelect</code> 콜백에서 명령어 이름만 전달됩니다.
              실제 명령어 실행은 부모 컴포넌트에서 처리해야 합니다.
              콜백에서 입력 텍스트를 완성하고(<code>&quot;/name &quot;</code>), 명령어 실행기로 전달하는
              로직이 올바르게 구현되어 있는지 확인하세요.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;새로 추가한 명령어가 목록에 안 보여요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              SlashCommandMenu는 <code className="text-cyan-600">commands</code> Props로 전달받은 명령어만 표시합니다.
              새 명령어가 <code className="text-cyan-600">Command Registry</code>에 올바르게 등록되었는지,
              그리고 등록된 목록이 이 컴포넌트까지 전달되는지 확인하세요.
            </p>
            <Callout type="tip" icon="*">
              새 슬래시 명령어를 추가할 때는 <code>add-slash-command</code> 스킬을 사용하면
              레지스트리 등록, 실행기 연결, 메뉴 노출까지 자동으로 처리됩니다.
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
                name: "skill-manager.ts",
                slug: "skill-manager",
                relation: "parent",
                desc: "슬래시 명령어의 등록, 로딩, 실행을 관리하는 모듈",
              },
              {
                name: "skill-loader.ts",
                slug: "skill-loader",
                relation: "sibling",
                desc: "4개 디렉토리에서 스킬 파일을 로드하여 명령어를 등록하는 모듈",
              },
              {
                name: "skill-executor.ts",
                slug: "skill-executor",
                relation: "sibling",
                desc: "선택된 슬래시 명령어를 실제로 실행하는 모듈",
              },
              {
                name: "PermissionPrompt.tsx",
                slug: "permission-prompt",
                relation: "sibling",
                desc: "도구 실행 전 권한을 묻는 동반 프롬프트 컴포넌트",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
