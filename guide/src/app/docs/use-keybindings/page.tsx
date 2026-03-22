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

export default function UseKeybindingsPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/hooks/useKeybindings.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">useKeybindings</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              커스터마이징 가능한 키보드 단축키 시스템을 제공하는 React 훅입니다.
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
                <code className="text-cyan-600">useKeybindings</code>는 CLI 앱에서 키보드 단축키를
                등록하고 감지하는 훅입니다. 7개의 기본 단축키가 내장되어 있으며, 사용자가{" "}
                <code className="text-cyan-600">~/.dbcode/keybindings.json</code>으로 키 매핑을
                자유롭게 변경할 수 있습니다.
              </p>
              <p>
                Ink의 <code className="text-cyan-600">useInput</code>을 기반으로 동작하며,
                <code className="text-cyan-600">ctrl</code>,{" "}
                <code className="text-cyan-600">alt(meta)</code>,
                <code className="text-cyan-600">shift</code> 수식키를 모두 지원합니다. Escape, Tab
                같은 특수 키도 별도 처리 로직으로 정확하게 매칭됩니다.
              </p>
              <p>
                설정 시스템은 3단계로 구성됩니다: 기본 바인딩 정의, 사용자 설정 파일 로드, 그리고 두
                설정의 병합. 사용자가 동일한 액션을 다른 키에 재매핑하면 기본 키의 바인딩이 자동으로
                제거되어 충돌을 방지합니다.
              </p>
            </div>

            <MermaidDiagram
              title="키바인딩 시스템 아키텍처"
              titleColor="purple"
              chart={`graph TD
  APP["App.tsx<br/><small>메인 앱</small>"]
  KB["useKeybindings<br/><small>useKeybindings.ts</small>"]
  INK["Ink useInput<br/><small>키 입력 감지</small>"]
  CFG["keybindings.json<br/><small>~/.dbcode/</small>"]
  DEF["DEFAULT_BINDINGS<br/><small>기본 7개 단축키</small>"]
  ACTIONS["Action Handlers<br/><small>cancel, exit, toggle 등</small>"]

  APP -->|"bindings 전달"| KB
  KB -->|"handleInput"| INK
  CFG -->|"loadKeybindingConfig()"| APP
  DEF -->|"getEffectiveBindings()"| APP
  KB -->|"매칭 시 호출"| ACTIONS

  style KB fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style APP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style INK fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CFG fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style DEF fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style ACTIONS fill:#dcfce7,stroke:#10b981,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> VS Code의 키보드 단축키 시스템과 같습니다. 기본 단축키가 있고,{" "}
              <code>keybindings.json</code>으로 사용자가 원하는 키를 매핑할 수 있습니다. 같은 액션을
              다른 키로 바꾸면 기본 키는 자동 해제됩니다.
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

            {/* Keybinding interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface Keybinding
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              키바인딩 정의 객체입니다. 키 조합과 수식키, 액션명, 핸들러 함수를 포함합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "key",
                  type: "string",
                  required: true,
                  desc: '키 이름 (예: "o", "escape", "tab")',
                },
                { name: "ctrl", type: "boolean", required: false, desc: "Ctrl 수식키 필요 여부" },
                {
                  name: "meta",
                  type: "boolean",
                  required: false,
                  desc: "Alt/Option/Meta 수식키 필요 여부",
                },
                { name: "shift", type: "boolean", required: false, desc: "Shift 수식키 필요 여부" },
                {
                  name: "action",
                  type: "string",
                  required: false,
                  desc: '액션 이름 (예: "cancel", "exit")',
                },
                {
                  name: "handler",
                  type: "() => void",
                  required: true,
                  desc: "매칭 시 실행할 콜백 함수",
                },
              ]}
            />

            {/* DEFAULT_BINDINGS */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              DEFAULT_BINDINGS
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              기본 키바인딩 매핑입니다. 사용자 설정이 없을 때 이 값이 사용됩니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">DEFAULT_BINDINGS</span> ={" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="str">&quot;escape&quot;</span>:{" "}
              <span className="str">&quot;cancel&quot;</span>,{" "}
              <span className="cm">{"// 현재 작업 취소"}</span>
              {"\n"}
              {"  "}
              <span className="str">&quot;ctrl+j&quot;</span>:{" "}
              <span className="str">&quot;newline&quot;</span>,{" "}
              <span className="cm">{"// 줄바꿈 삽입"}</span>
              {"\n"}
              {"  "}
              <span className="str">&quot;shift+tab&quot;</span>:{" "}
              <span className="str">&quot;cycle-mode&quot;</span>,{" "}
              <span className="cm">{"// 권한 모드 순환"}</span>
              {"\n"}
              {"  "}
              <span className="str">&quot;ctrl+o&quot;</span>:{" "}
              <span className="str">&quot;toggle-verbose&quot;</span>,{" "}
              <span className="cm">{"// 상세 모드 토글"}</span>
              {"\n"}
              {"  "}
              <span className="str">&quot;ctrl+d&quot;</span>:{" "}
              <span className="str">&quot;exit&quot;</span>, <span className="cm">{"// 종료"}</span>
              {"\n"}
              {"  "}
              <span className="str">&quot;alt+t&quot;</span>:{" "}
              <span className="str">&quot;toggle-thinking&quot;</span>,
              <span className="cm">{"// 확장 사고 토글"}</span>
              {"\n"}
              {"  "}
              <span className="str">&quot;alt+v&quot;</span>:{" "}
              <span className="str">&quot;toggle-voice&quot;</span>,{" "}
              <span className="cm">{"// 음성 녹음 토글"}</span>
              {"\n"}
              {"}"};
            </CodeBlock>

            {/* parseKeyCombo */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              parseKeyCombo(combo)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">&quot;ctrl+o&quot;</code>,{" "}
              <code className="text-cyan-600">&quot;alt+t&quot;</code>,
              <code className="text-cyan-600">&quot;shift+tab&quot;</code> 같은 키 조합 문자열을
              구조화된 객체로 파싱합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">parseKeyCombo</span>(
              <span className="prop">combo</span>: <span className="type">string</span>): {"{"}
              {"\n"}
              {"  "}
              <span className="prop">key</span>: <span className="type">string</span>;{" "}
              <span className="prop">ctrl</span>: <span className="type">boolean</span>;{" "}
              <span className="prop">meta</span>: <span className="type">boolean</span>;{" "}
              <span className="prop">shift</span>: <span className="type">boolean</span>;{"\n"}
              {"}"}
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "combo",
                  type: "string",
                  required: true,
                  desc: '키 조합 문자열 (예: "ctrl+o", "alt+t", "escape")',
                },
              ]}
            />

            {/* formatKeyCombo */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              formatKeyCombo(combo)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              키 조합 객체를 사람이 읽기 쉬운 문자열로 변환합니다.
            </p>
            <CodeBlock>
              <span className="fn">formatKeyCombo</span>({"{"} <span className="prop">key</span>:{" "}
              <span className="str">&quot;o&quot;</span>, <span className="prop">ctrl</span>:{" "}
              <span className="kw">true</span> {"}"}){"\n"}
              <span className="cm">{'// → "Ctrl+O"'}</span>
            </CodeBlock>

            {/* loadKeybindingConfig */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              loadKeybindingConfig()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">~/.dbcode/keybindings.json</code>에서 사용자 키바인딩
              설정을 로드합니다. 두 가지 파일 형식을 지원합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 새 형식 (권장)"}</span>
              {"\n"}
              {"{"} <span className="str">&quot;bindings&quot;</span>: {"{"}{" "}
              <span className="str">&quot;ctrl+k&quot;</span>:{" "}
              <span className="str">&quot;cancel&quot;</span>,{" "}
              <span className="str">&quot;ctrl+q&quot;</span>:{" "}
              <span className="str">&quot;exit&quot;</span> {"}"} {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// 레거시 형식 (호환)"}</span>
              {"\n"}[{"{"} <span className="str">&quot;key&quot;</span>:{" "}
              <span className="str">&quot;k&quot;</span>,{" "}
              <span className="str">&quot;ctrl&quot;</span>: <span className="kw">true</span>,{" "}
              <span className="str">&quot;action&quot;</span>:{" "}
              <span className="str">&quot;cancel&quot;</span> {"}"}]
            </CodeBlock>

            {/* getEffectiveBindings */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              getEffectiveBindings(userConfig)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              기본 바인딩과 사용자 설정을 병합하여 실효 바인딩을 반환합니다. 사용자가 동일한 액션을
              다른 키에 매핑하면 기본 키의 바인딩이 자동 제거됩니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">getEffectiveBindings</span>(
              {"\n"}
              {"  "}
              <span className="prop">userConfig</span>:{" "}
              <span className="type">Readonly&lt;Record&lt;string, string&gt;&gt;</span>
              {"\n"}): <span className="type">Readonly&lt;Record&lt;string, string&gt;&gt;</span>
            </CodeBlock>

            {/* buildKeybindings */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              buildKeybindings(bindings, actionHandlers)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              키-액션 맵과 액션-핸들러 맵을 결합하여{" "}
              <code className="text-cyan-600">Keybinding</code> 배열을 생성합니다. 핸들러가 없는
              액션은 건너뜁니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">buildKeybindings</span>(
              {"\n"}
              {"  "}
              <span className="prop">bindings</span>:{" "}
              <span className="type">Readonly&lt;Record&lt;string, string&gt;&gt;</span>,{"\n"}
              {"  "}
              <span className="prop">actionHandlers</span>:{" "}
              <span className="type">Readonly&lt;Record&lt;string, () =&gt; void&gt;&gt;</span>
              {"\n"}): <span className="type">readonly Keybinding[]</span>
            </CodeBlock>

            {/* useKeybindings hook */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              useKeybindings(bindings, isActive?)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              바인딩 배열을 받아 실제 키 입력을 감지하고 매칭되는 핸들러를 호출하는 React 훅입니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">useKeybindings</span>({"\n"}
              {"  "}
              <span className="prop">bindings</span>:{" "}
              <span className="type">readonly Keybinding[]</span>,{"\n"}
              {"  "}
              <span className="prop">isActive</span>?: <span className="type">boolean</span>
              {"\n"}): <span className="type">void</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "bindings",
                  type: "readonly Keybinding[]",
                  required: true,
                  desc: "등록할 키바인딩 배열",
                },
                {
                  name: "isActive",
                  type: "boolean",
                  required: false,
                  desc: "훅 활성화 여부 (기본값: true). false면 키 입력을 무시",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">alt</code>,{" "}
                <code className="text-cyan-600">meta</code>,
                <code className="text-cyan-600">option</code>은 모두 같은 수식키로 취급됩니다
                (내부적으로 <code className="text-cyan-600">meta</code>로 통합).
              </li>
              <li>
                바인딩 매칭은 <strong>순서대로</strong> 진행됩니다. 첫 번째로 매칭되는 바인딩의
                핸들러가 호출되고 즉시 <code className="text-cyan-600">return</code>합니다. 동일한
                키 조합에 여러 바인딩을 등록하면 첫 번째만 실행됩니다.
              </li>
              <li>
                <code className="text-cyan-600">escape</code>과{" "}
                <code className="text-cyan-600">tab</code>은 특수 키로 별도 처리됩니다. 일반 문자
                키와 다른 매칭 로직을 사용합니다.
              </li>
              <li>
                <code className="text-cyan-600">mergeKeybindings()</code>는{" "}
                <strong>deprecated</strong>입니다. 대신{" "}
                <code className="text-cyan-600">buildKeybindings() + getEffectiveBindings()</code>를
                사용하세요.
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
              기본 사용법 &mdash; 단축키 등록하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              3단계로 키바인딩을 설정합니다: 사용자 설정 로드, 실효 바인딩 계산, 훅에 전달.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 사용자 설정 로드 + 기본값 병합"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">userConfig</span> ={" "}
              <span className="fn">loadKeybindingConfig</span>();
              {"\n"}
              <span className="kw">const</span> <span className="prop">effectiveBindings</span> ={" "}
              <span className="fn">getEffectiveBindings</span>(
              <span className="prop">userConfig</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 액션 핸들러 정의"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">actionHandlers</span> = {"{"}
              {"\n"}
              {"  "}
              <span className="prop">cancel</span>: () =&gt;{" "}
              <span className="fn">handleCancel</span>(),
              {"\n"}
              {"  "}
              <span className="prop">exit</span>: () =&gt; <span className="fn">process</span>.
              <span className="fn">exit</span>(<span className="num">0</span>),
              {"\n"}
              {"  "}
              <span className="str">&quot;toggle-verbose&quot;</span>: () =&gt;{" "}
              <span className="fn">setVerbose</span>(<span className="prop">v</span> =&gt; !
              <span className="prop">v</span>),
              {"\n"}
              {"  "}
              <span className="str">&quot;toggle-thinking&quot;</span>: () =&gt;{" "}
              <span className="fn">setThinking</span>(<span className="prop">t</span> =&gt; !
              <span className="prop">t</span>),
              {"\n"}
              {"}"};{"\n"}
              {"\n"}
              <span className="cm">{"// 3. 바인딩 배열 생성 + 훅 등록"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">keybindings</span> ={" "}
              <span className="fn">buildKeybindings</span>(
              <span className="prop">effectiveBindings</span>,{" "}
              <span className="prop">actionHandlers</span>);
              {"\n"}
              <span className="fn">useKeybindings</span>(<span className="prop">keybindings</span>);
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>actionHandlers</code>에 없는 액션은 자동으로 무시됩니다.
              사용자가 <code>keybindings.json</code>에 존재하지 않는 액션을 매핑해도 에러가 발생하지
              않지만, 해당 키는 아무 동작도 하지 않습니다.
            </Callout>

            {/* 고급: 커스텀 키바인딩 파일 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 사용자 키바인딩 파일 작성
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">~/.dbcode/keybindings.json</code>을 작성하여 기본
              단축키를 변경할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// ~/.dbcode/keybindings.json"}</span>
              {"\n"}
              {"{"}
              {"\n"}
              {"  "}
              <span className="str">&quot;bindings&quot;</span>: {"{"}
              {"\n"}
              {"    "}
              <span className="str">&quot;ctrl+k&quot;</span>:{" "}
              <span className="str">&quot;cancel&quot;</span>,{"\n"}
              {"    "}
              <span className="str">&quot;ctrl+q&quot;</span>:{" "}
              <span className="str">&quot;exit&quot;</span>
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">
                {"// → Escape의 cancel 바인딩이 자동 제거되고 Ctrl+K가 cancel로 동작"}
              </span>
              {"\n"}
              <span className="cm">
                {"// → Ctrl+D의 exit 바인딩이 자동 제거되고 Ctrl+Q가 exit로 동작"}
              </span>
            </CodeBlock>

            <DeepDive title="충돌 방지 메커니즘 상세">
              <p className="mb-3">
                <code className="text-cyan-600">getEffectiveBindings()</code>는 사용자가 재매핑한
                액션의 기본 키를 자동으로 제거합니다. 이 과정은 3단계로 진행됩니다:
              </p>
              <CodeBlock>
                <span className="cm">{"// 1단계: 기본 바인딩으로 시작"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">effective</span> = {"{"}{" "}
                ...<span className="prop">DEFAULT_BINDINGS</span> {"}"};{"\n"}
                {"\n"}
                <span className="cm">{"// 2단계: 사용자가 재매핑한 액션의 기본 키 제거"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">userActions</span> ={" "}
                <span className="kw">new</span> <span className="fn">Set</span>(
                <span className="fn">Object</span>.<span className="fn">values</span>(
                <span className="prop">userConfig</span>));
                {"\n"}
                <span className="kw">for</span> (<span className="kw">const</span> [
                <span className="prop">key</span>, <span className="prop">action</span>]{" "}
                <span className="kw">of</span> <span className="fn">Object</span>.
                <span className="fn">entries</span>(<span className="prop">effective</span>)) {"{"}
                {"\n"}
                {"  "}
                <span className="kw">if</span> (<span className="prop">userActions</span>.
                <span className="fn">has</span>(<span className="prop">action</span>)){" "}
                <span className="kw">delete</span> <span className="prop">effective</span>[
                <span className="prop">key</span>];
                {"\n"}
                {"}"}
                {"\n"}
                {"\n"}
                <span className="cm">{"// 3단계: 사용자 설정 적용"}</span>
                {"\n"}
                <span className="fn">Object</span>.<span className="fn">assign</span>(
                <span className="prop">effective</span>, <span className="prop">userConfig</span>);
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                예를 들어 사용자가 <code className="text-cyan-600">{`"ctrl+k": "cancel"`}</code>을
                설정하면, 기본 바인딩의{" "}
                <code className="text-cyan-600">{`"escape": "cancel"`}</code>이 제거됩니다.
                결과적으로 <code className="text-cyan-600">Escape</code> 키는 아무 동작도 하지 않게
                됩니다.
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
              키 매칭 흐름 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              키 입력이 감지되면 등록된 바인딩을 순회하며 매칭을 시도합니다. 특수 키(escape, tab)는
              별도 경로로 처리됩니다.
            </p>

            <MermaidDiagram
              title="키 입력 매칭 흐름"
              titleColor="purple"
              chart={`graph TD
  INPUT(("키 입력 감지"))
  LOOP["바인딩 배열 순회"]
  ESC{"escape 키?"}
  TAB{"tab 키?"}
  NORMAL{"일반 문자 매칭?"}
  MOD_CHECK["ctrl/meta 수식키 확인"]
  SHIFT_CHECK["shift 수식키 확인"]
  HANDLER["핸들러 호출 + return"]
  SKIP["다음 바인딩"]
  DONE(("매칭 없음 — 무시"))

  INPUT --> LOOP
  LOOP --> ESC
  ESC -->|"예 + 수식키 일치"| HANDLER
  ESC -->|"아니오"| TAB
  TAB -->|"예 + 수식키 일치"| SHIFT_CHECK
  SHIFT_CHECK -->|"일치"| HANDLER
  SHIFT_CHECK -->|"불일치"| SKIP
  TAB -->|"아니오"| NORMAL
  NORMAL -->|"일치"| MOD_CHECK
  MOD_CHECK -->|"일치"| HANDLER
  MOD_CHECK -->|"불일치"| SKIP
  NORMAL -->|"불일치"| SKIP
  SKIP --> LOOP
  LOOP -->|"모든 바인딩 소진"| DONE

  style INPUT fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style HANDLER fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style DONE fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">handleInput</code> 콜백의 매칭 로직입니다. 특수 키를
              우선 처리하고, 일반 문자는 <code className="text-cyan-600">input</code> 문자열로
              비교합니다.
            </p>
            <CodeBlock>
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">binding</span> <span className="kw">of</span>{" "}
              <span className="prop">stableBindings</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">ctrlMatch</span> ={" "}
              <span className="prop">binding</span>.<span className="prop">ctrl</span> ?{" "}
              <span className="prop">key</span>.<span className="prop">ctrl</span> : !
              <span className="prop">key</span>.<span className="prop">ctrl</span>;{"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">metaMatch</span> ={" "}
              <span className="prop">binding</span>.<span className="prop">meta</span> ?{" "}
              <span className="prop">key</span>.<span className="prop">meta</span> : !
              <span className="prop">key</span>.<span className="prop">meta</span>;{"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 특수 키: escape"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">binding</span>.
              <span className="prop">key</span> === <span className="str">&quot;escape&quot;</span>{" "}
              && <span className="prop">key</span>.<span className="prop">escape</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">ctrlMatch</span> &&{" "}
              <span className="prop">metaMatch</span>) {"{"} <span className="prop">binding</span>.
              <span className="fn">handler</span>(); <span className="kw">return</span>; {"}"}
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [2] 특수 키: tab (shift 수식키 별도 확인)"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">binding</span>.
              <span className="prop">key</span> === <span className="str">&quot;tab&quot;</span> &&{" "}
              <span className="prop">key</span>.<span className="prop">tab</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">shiftMatch</span> ={" "}
              <span className="prop">binding</span>.<span className="prop">shift</span> ?{" "}
              <span className="prop">key</span>.<span className="prop">shift</span> : !
              <span className="prop">key</span>.<span className="prop">shift</span>;{"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">ctrlMatch</span> &&{" "}
              <span className="prop">metaMatch</span> && <span className="prop">shiftMatch</span>){" "}
              {"{"}
              {"\n"}
              {"      "}
              <span className="prop">binding</span>.<span className="fn">handler</span>();{" "}
              <span className="kw">return</span>;{"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 일반 문자 키"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">input</span> ==={" "}
              <span className="prop">binding</span>.<span className="prop">key</span> &&{" "}
              <span className="prop">ctrlMatch</span> && <span className="prop">metaMatch</span>){" "}
              {"{"}
              {"\n"}
              {"    "}
              <span className="prop">binding</span>.<span className="fn">handler</span>();{" "}
              <span className="kw">return</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> Escape 키는 Ink의{" "}
                <code className="text-cyan-600">key.escape</code> 플래그로 감지합니다. 일반{" "}
                <code className="text-cyan-600">input</code> 문자열로는 매칭되지 않습니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> Tab 키는{" "}
                <code className="text-cyan-600">key.tab</code> 플래그로 감지하며, Shift+Tab을
                구분하기 위해 <code className="text-cyan-600">shift</code> 수식키를 추가로
                확인합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 일반 문자는{" "}
                <code className="text-cyan-600">input</code> 문자열과 직접 비교합니다. Ctrl이나
                Meta가 눌린 상태에서도 <code className="text-cyan-600">input</code>에 문자가
                전달됩니다.
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
                &quot;커스텀 키바인딩 파일을 만들었는데 적용이 안 돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">다음을 확인하세요:</p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  파일 경로가 <code className="text-cyan-600">~/.dbcode/keybindings.json</code>이
                  맞는지
                </li>
                <li>JSON 형식이 올바른지 (trailing comma 등 주의)</li>
                <li>
                  액션 이름이 <code className="text-cyan-600">ACTION_DESCRIPTIONS</code>에 정의된
                  값과 정확히 일치하는지
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Escape 키가 작동하지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                다른 터미널 프로그램이 Escape 키를 가로채고 있을 수 있습니다. 특히 tmux나
                screen에서는 Escape 키에 대기 시간(escape-time)이 설정되어 있어 즉시 전달되지 않을
                수 있습니다. tmux에서는 <code className="text-cyan-600">set -sg escape-time 0</code>
                으로 해결하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;기본 Escape 단축키를 다른 키로 바꿨더니 원래 Escape가 아무 동작도 안
                해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                의도된 동작입니다. 사용자가 <code className="text-cyan-600">cancel</code> 액션을
                다른 키로 재매핑하면, 기본 <code className="text-cyan-600">escape</code> 바인딩이
                자동으로 제거됩니다. 두 키 모두에서 cancel을 사용하려면, 두 항목 모두{" "}
                <code className="text-cyan-600">keybindings.json</code>에 명시하세요.
              </p>
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
                  name: "useInputHistory.ts",
                  slug: "use-input",
                  relation: "sibling",
                  desc: "입력 히스토리 관리 — 키바인딩에서 방향키 탐색 핸들러를 연결하는 훅",
                },
                {
                  name: "usePermissionPrompt.ts",
                  slug: "use-permission-prompt",
                  relation: "sibling",
                  desc: "권한 프롬프트 훅 — 키바인딩의 cycle-mode 액션과 연동",
                },
                {
                  name: "config-loader.ts",
                  slug: "config-loader",
                  relation: "child",
                  desc: "5-Layer 설정 병합 — keybindings.json도 설정 계층의 일부",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
