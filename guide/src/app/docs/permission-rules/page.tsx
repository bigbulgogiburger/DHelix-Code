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

export default function PermissionRulesPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/permissions/rules.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Permission Rules</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              도구 호출이 사전 설정된 allow/deny 규칙에 매칭되는지 검사하는 규칙 엔진입니다.
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
                <code className="text-cyan-600">rules.ts</code>는 권한 시스템의 규칙 매칭
                엔진입니다. 사용자가 미리 설정한 권한 규칙(예: &quot;Bash(npm *)은 허용&quot;,
                &quot;file_read는 항상 허용&quot;)을 실제 도구 호출과 비교하여 allow/deny 여부를
                결정합니다.
              </p>
              <p>
                이 모듈은 두 가지 핵심 기능을 제공합니다: glob 스타일 패턴 매칭(
                <code className="text-cyan-600">matchPattern</code>)과 규칙 목록 순회 검색(
                <code className="text-cyan-600">findMatchingRule</code>). 규칙은 배열 순서대로
                검사하며, 첫 번째로 매칭되는 규칙이 반환됩니다.
              </p>
              <p>
                패턴 매칭은 <code className="text-cyan-600">*</code>(임의 문자열)와
                <code className="text-cyan-600">?</code>(임의 한 문자)를 지원하는 간단한 glob 문법을
                정규식으로 변환하여 처리합니다.
              </p>
            </div>

            <MermaidDiagram
              title="Permission Rules 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  PM["Permission Manager<br/><small>permission-manager.ts</small>"]
  RULES["Permission Rules<br/><small>rules.ts</small>"]
  MODES["Permission Modes<br/><small>modes.ts</small>"]
  PP["Pattern Parser<br/><small>pattern-parser.ts</small>"]
  WC["Wildcard<br/><small>wildcard.ts</small>"]
  TOOLS["Tool Executor<br/><small>tools/executor.ts</small>"]

  PM -->|"규칙 매칭 요청"| RULES
  PM -->|"모드 검사"| MODES
  RULES -->|"glob 패턴 변환"| PP
  PP -->|"와일드카드 매칭"| WC
  TOOLS -->|"실행 전 권한 확인"| PM

  style RULES fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MODES fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PP fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style WC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TOOLS fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 건물 출입 카드 시스템을 떠올리세요. 각 카드에는 &quot;3층
              연구실 출입 가능&quot;, &quot;지하 서버실 출입 불가&quot; 같은 규칙이 저장되어
              있습니다. 이 모듈은 &quot;이 사람이 이 문을 열 수 있는가?&quot;를 규칙 목록에서 찾아
              판단하는 카드 리더기 역할을 합니다.
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

            {/* matchPattern (private) */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              function matchPattern (private)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              값이 glob 스타일 패턴과 매칭되는지 검사합니다. glob 패턴을 정규식으로 변환하여 전체
              문자열 매칭을 수행합니다.
            </p>
            <CodeBlock>
              <span className="fn">matchPattern</span>(<span className="prop">value</span>:{" "}
              <span className="type">string</span>, <span className="prop">pattern</span>:{" "}
              <span className="type">string</span>): <span className="type">boolean</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "value",
                  type: "string",
                  required: true,
                  desc: '검사할 문자열 (예: "npm install")',
                },
                {
                  name: "pattern",
                  type: "string",
                  required: true,
                  desc: 'glob 패턴 (예: "npm *")',
                },
              ]}
            />
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-cyan-600">*</code> &mdash; 임의의 문자열 (0자 이상)과
                매칭
              </p>
              <p>
                &bull; <code className="text-cyan-600">?</code> &mdash; 임의의 한 문자와 매칭
              </p>
            </div>

            {/* findMatchingRule */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              function findMatchingRule
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              도구 호출이 권한 규칙 목록 중 하나와 매칭되는지 검사합니다. 규칙 배열을 순서대로
              순회하며 첫 번째로 매칭되는 규칙을 반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">findMatchingRule</span>({"\n"}
              {"  "}
              <span className="prop">rules</span>:{" "}
              <span className="type">readonly PermissionRule[]</span>,{"\n"}
              {"  "}
              <span className="prop">toolName</span>: <span className="type">string</span>,{"\n"}
              {"  "}
              <span className="prop">args</span>?:{" "}
              <span className="type">Readonly&lt;Record&lt;string, unknown&gt;&gt;</span>,{"\n"}):{" "}
              <span className="type">PermissionRule | undefined</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "rules",
                  type: "readonly PermissionRule[]",
                  required: true,
                  desc: "검사할 권한 규칙 배열 (순서대로 검사, 첫 매칭 반환)",
                },
                {
                  name: "toolName",
                  type: "string",
                  required: true,
                  desc: '실행하려는 도구의 이름 (예: "Bash", "file_read")',
                },
                {
                  name: "args",
                  type: "Readonly<Record<string, unknown>>",
                  required: false,
                  desc: "도구에 전달될 인수 객체 (선택적)",
                },
              ]}
            />

            {/* PermissionRule type reference */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface PermissionRule (from types.ts)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              권한 규칙 하나를 정의하는 인터페이스입니다.{" "}
              <code className="text-cyan-600">findMatchingRule</code>이 검사하는 대상입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "toolName",
                  type: "string",
                  required: true,
                  desc: '매칭할 도구 이름 패턴 (예: "Bash", "file_*")',
                },
                {
                  name: "pattern",
                  type: "string | undefined",
                  required: false,
                  desc: '인수 매칭 패턴 (예: "npm *"), 없으면 도구 이름만으로 매칭',
                },
                {
                  name: "allowed",
                  type: "boolean",
                  required: true,
                  desc: "매칭 시 허용(true) 또는 거부(false)",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                규칙 배열의 <strong>순서가 중요합니다</strong>. 첫 번째로 매칭되는 규칙이
                반환되므로, 더 구체적인 규칙을 앞에 배치해야 합니다.
              </li>
              <li>
                <code className="text-cyan-600">pattern</code>이 있는 규칙은 인수의{" "}
                <strong>문자열 값</strong>만 비교합니다. 숫자나 boolean 인수는 무시됩니다.
              </li>
              <li>
                <code className="text-cyan-600">matchPattern</code>의{" "}
                <code className="text-cyan-600">*</code>는 경로 구분자(<code>/</code>)를 포함하여
                모든 문자와 매칭됩니다. 경로 안전한 매칭이 필요하면
                <code className="text-cyan-600">wildcard.ts</code>의{" "}
                <code className="text-cyan-600">matchWildcard</code>를 사용하세요.
              </li>
              <li>
                매칭되는 규칙이 없으면 <code className="text-cyan-600">undefined</code>를
                반환합니다. 이 경우 호출자가 기본 동작(예: 사용자 확인 요청)을 결정해야 합니다.
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
              기본 사용법 &mdash; 도구 호출 권한 확인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              가장 일반적인 패턴입니다. 도구 실행 전에 규칙 목록에서 매칭 여부를 확인합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="fn">findMatchingRule</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./permissions/rules.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 권한 규칙 정의"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">rules</span> = [{"\n"}
              {"  "}
              {"{"} <span className="prop">toolName</span>:{" "}
              <span className="str">&quot;file_read&quot;</span>,{" "}
              <span className="prop">allowed</span>: <span className="kw">true</span> {"}"},{"  "}
              <span className="cm">{"// 파일 읽기 항상 허용"}</span>
              {"\n"}
              {"  "}
              {"{"} <span className="prop">toolName</span>:{" "}
              <span className="str">&quot;Bash&quot;</span>, <span className="prop">pattern</span>:{" "}
              <span className="str">&quot;npm *&quot;</span>, <span className="prop">allowed</span>:{" "}
              <span className="kw">true</span> {"}"},{"  "}
              <span className="cm">{"// npm 명령만 허용"}</span>
              {"\n"}
              {"  "}
              {"{"} <span className="prop">toolName</span>:{" "}
              <span className="str">&quot;Bash&quot;</span>, <span className="prop">allowed</span>:{" "}
              <span className="kw">false</span> {"}"},{"  "}
              <span className="cm">{"// 나머지 Bash는 거부"}</span>
              {"\n"}];
              {"\n"}
              {"\n"}
              <span className="cm">{"// 도구 호출 시 규칙 매칭"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">match</span> ={" "}
              <span className="fn">findMatchingRule</span>(<span className="prop">rules</span>,{" "}
              <span className="str">&quot;Bash&quot;</span>, {"{"}{" "}
              <span className="prop">command</span>:{" "}
              <span className="str">&quot;npm install&quot;</span> {"}"});
              {"\n"}
              <span className="cm">{"// match?.allowed === true (두 번째 규칙에 매칭)"}</span>
              {"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">denied</span> ={" "}
              <span className="fn">findMatchingRule</span>(<span className="prop">rules</span>,{" "}
              <span className="str">&quot;Bash&quot;</span>, {"{"}{" "}
              <span className="prop">command</span>:{" "}
              <span className="str">&quot;rm -rf /&quot;</span> {"}"});
              {"\n"}
              <span className="cm">{"// denied?.allowed === false (세 번째 규칙에 매칭)"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 규칙 순서가 결과를 결정합니다. 위 예시에서 &quot;Bash
              거부&quot; 규칙을 &quot;npm 허용&quot; 규칙보다 앞에 놓으면, npm 명령도 거부됩니다. 더
              구체적인 규칙을 항상 앞에 배치하세요.
            </Callout>

            {/* 고급 사용법: 와일드카드 패턴 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 와일드카드 패턴 활용
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              도구 이름에도 glob 패턴을 사용할 수 있어, 여러 도구를 한 규칙으로 매칭할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">rules</span> = [{"\n"}
              {"  "}
              <span className="cm">
                {"// file_로 시작하는 모든 도구 허용 (file_read, file_write, file_edit)"}
              </span>
              {"\n"}
              {"  "}
              {"{"} <span className="prop">toolName</span>:{" "}
              <span className="str">&quot;file_*&quot;</span>, <span className="prop">allowed</span>
              : <span className="kw">true</span> {"}"},{"\n"}
              {"  "}
              <span className="cm">{"// ? 패턴: file_read만 매칭 (file_?ead)"}</span>
              {"\n"}
              {"  "}
              {"{"} <span className="prop">toolName</span>:{" "}
              <span className="str">&quot;file_?ead&quot;</span>,{" "}
              <span className="prop">allowed</span>: <span className="kw">true</span> {"}"},{"\n"}];
            </CodeBlock>

            {/* 고급 사용법: 매칭 실패 처리 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 매칭 실패 시 기본 동작
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">findMatchingRule</code>이{" "}
              <code className="text-cyan-600">undefined</code>를 반환하면 어떤 규칙도 매칭되지 않은
              것이므로, 권한 모드에 따른 기본 동작을 적용합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">match</span> ={" "}
              <span className="fn">findMatchingRule</span>(<span className="prop">rules</span>,{" "}
              <span className="prop">toolName</span>, <span className="prop">args</span>);
              {"\n"}
              {"\n"}
              <span className="kw">if</span> (<span className="prop">match</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// 규칙에 의한 명시적 허용/거부"}</span>
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">match</span>.
              <span className="prop">allowed</span>;{"\n"}
              {"}"} <span className="kw">else</span> {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// 규칙 없음 → 권한 모드(modes.ts)에 따라 결정"}</span>
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="fn">checkPermissionByMode</span>(
              <span className="prop">mode</span>, <span className="prop">permissionLevel</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 규칙 매칭은 권한 검사의 첫 번째 단계입니다. 규칙이 없을 때는
              <code>modes.ts</code>의 권한 모드가 두 번째 방어선 역할을 합니다.
            </Callout>

            <DeepDive title="matchPattern의 정규식 변환 상세">
              <p className="mb-3">
                <code className="text-cyan-600">matchPattern</code>은 glob 패턴을 정규식으로
                변환합니다. 변환 과정은 세 단계입니다:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
                <li>
                  정규식 특수 문자를 이스케이프합니다 (<code className="text-cyan-600">.</code>,{" "}
                  <code className="text-cyan-600">+</code>, <code className="text-cyan-600">^</code>{" "}
                  등)
                </li>
                <li>
                  <code className="text-cyan-600">*</code>를{" "}
                  <code className="text-cyan-600">.*</code>로 변환합니다 (임의 문자열)
                </li>
                <li>
                  <code className="text-cyan-600">?</code>를{" "}
                  <code className="text-cyan-600">.</code>로 변환합니다 (한 문자)
                </li>
              </ol>
              <p className="mt-3 text-amber-600">
                전체 문자열 매칭을 위해 <code>^...$</code>로 앵커링됩니다. 부분 매칭은 지원하지
                않으므로, <code>&quot;npm&quot;</code> 패턴은 정확히 <code>&quot;npm&quot;</code>만
                매칭합니다.
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
              규칙 매칭 흐름도
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">findMatchingRule</code>은 규칙 배열을 순서대로
              순회하며 2단계 매칭을 수행합니다.
            </p>

            <MermaidDiagram
              title="findMatchingRule 매칭 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("시작")) --> LOOP["규칙 배열 순회"]
  LOOP --> CHECK_NAME{"도구 이름이<br/>규칙 패턴과 매칭?"}
  CHECK_NAME -->|"No"| NEXT["다음 규칙"]
  NEXT --> LOOP
  CHECK_NAME -->|"Yes"| HAS_PATTERN{"규칙에<br/>인수 패턴 있음?"}
  HAS_PATTERN -->|"No"| RETURN_RULE["규칙 반환"]
  HAS_PATTERN -->|"Yes"| CHECK_ARGS{"인수의 문자열 값 중<br/>패턴과 매칭되는 것?"}
  CHECK_ARGS -->|"Yes"| RETURN_RULE
  CHECK_ARGS -->|"No"| NEXT
  LOOP -->|"규칙 소진"| RETURN_UNDEF["undefined 반환"]

  style CHECK_NAME fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style CHECK_ARGS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style RETURN_RULE fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style RETURN_UNDEF fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">findMatchingRule</code>의 전체 로직입니다. 간결하지만
              2단계 매칭의 핵심이 모두 담겨 있습니다.
            </p>
            <CodeBlock>
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">rule</span> <span className="kw">of</span>{" "}
              <span className="prop">rules</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 도구 이름 매칭"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="fn">matchPattern</span>(
              <span className="prop">toolName</span>, <span className="prop">rule</span>.
              <span className="prop">toolName</span>)) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">rule</span>.
              <span className="prop">pattern</span> && <span className="prop">args</span>) {"{"}
              {"\n"}
              {"      "}
              <span className="cm">{"// [2] 인수 패턴이 있는 경우 — 문자열 인수만 추출"}</span>
              {"\n"}
              {"      "}
              <span className="kw">const</span> <span className="prop">argValues</span> ={" "}
              <span className="type">Object</span>.<span className="fn">values</span>(
              <span className="prop">args</span>){"\n"}
              {"        "}.<span className="fn">filter</span>((<span className="prop">v</span>):{" "}
              <span className="prop">v</span> <span className="kw">is</span>{" "}
              <span className="type">string</span> {"=>"} <span className="kw">typeof</span>{" "}
              <span className="prop">v</span> === <span className="str">&quot;string&quot;</span>);
              {"\n"}
              {"      "}
              <span className="cm">{"// [3] 문자열 인수 중 하나라도 패턴 매칭되면 반환"}</span>
              {"\n"}
              {"      "}
              <span className="kw">if</span> (<span className="prop">argValues</span>.
              <span className="fn">some</span>(<span className="prop">v</span> {"=>"}{" "}
              <span className="fn">matchPattern</span>(<span className="prop">v</span>,{" "}
              <span className="prop">rule</span>.<span className="prop">pattern</span>!))) {"{"}
              {"\n"}
              {"        "}
              <span className="kw">return</span> <span className="prop">rule</span>;{"\n"}
              {"      "}
              {"}"}
              {"\n"}
              {"    "}
              {"}"} <span className="kw">else</span> {"{"}
              {"\n"}
              {"      "}
              <span className="cm">{"// [4] 인수 패턴 없으면 도구 이름만으로 매칭 완료"}</span>
              {"\n"}
              {"      "}
              <span className="kw">return</span> <span className="prop">rule</span>;{"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
              {"\n"}
              <span className="kw">return</span> <span className="kw">undefined</span>;
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 도구 이름을 규칙의{" "}
                <code className="text-cyan-600">toolName</code> 패턴과 glob 매칭합니다.{" "}
                <code>&quot;file_*&quot;</code>는 <code>&quot;file_read&quot;</code>,{" "}
                <code>&quot;file_write&quot;</code> 등과 매칭됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 규칙에 인수 패턴이 있으면, 도구 인수
                객체에서 문자열 값만 추출합니다. 숫자, boolean 등은 무시됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 추출된 문자열 인수 중 하나라도 패턴과
                매칭되면 해당 규칙을 반환합니다. <code>some()</code>을 사용하므로 첫 번째 매칭에서
                중단됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> 규칙에 인수 패턴이 없으면 도구 이름
                매칭만으로 충분합니다. 해당 도구의 모든 호출에 적용됩니다.
              </p>
            </div>

            <DeepDive title="matchPattern의 정규식 변환 과정">
              <p className="mb-3">
                glob 패턴 <code className="text-cyan-600">&quot;npm *&quot;</code>가 정규식으로
                변환되는 과정입니다:
              </p>
              <CodeBlock>
                <span className="cm">{'// 입력: "npm *"'}</span>
                {"\n"}
                <span className="cm">
                  {'// 1단계: 정규식 특수문자 이스케이프 → "npm *" (변화 없음)'}
                </span>
                {"\n"}
                <span className="cm">{'// 2단계: * → .* → "npm .*"'}</span>
                {"\n"}
                <span className="cm">{"// 3단계: ^...$ 앵커링 → /^npm .*$/"}</span>
                {"\n"}
                {"\n"}
                <span className="cm">{'// 결과: /^npm .*$/.test("npm install") → true'}</span>
                {"\n"}
                <span className="cm">{'// 결과: /^npm .*$/.test("yarn add")     → false'}</span>
              </CodeBlock>
            </DeepDive>
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
                &quot;규칙을 설정했는데 매칭이 안 돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                두 가지를 확인하세요:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>도구 이름 정확성:</strong> 규칙의{" "}
                  <code className="text-cyan-600">toolName</code>이 실제 도구 이름과 일치하는지
                  확인하세요. 대소문자를 구분합니다.
                  <code>&quot;bash&quot;</code>와 <code>&quot;Bash&quot;</code>는 다릅니다.
                </li>
                <li>
                  <strong>인수 패턴 범위:</strong> 인수 패턴은 문자열 인수만 검사합니다. 도구 인수가
                  숫자나 boolean이면 패턴 매칭 대상에서 제외됩니다.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;허용 규칙을 넣었는데 거부되는 경우가 있어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                규칙 순서를 확인하세요. <code className="text-cyan-600">findMatchingRule</code>은
                <strong>첫 번째</strong> 매칭 규칙을 반환합니다. 더 넓은 거부 규칙이 앞에 있으면
                구체적인 허용 규칙에 도달하지 못합니다.
              </p>
              <Callout type="tip" icon="*">
                규칙 배열은 &quot;구체적 → 일반적&quot; 순서로 정렬하세요. 예:{" "}
                <code>Bash(npm *)</code> 허용 → <code>Bash</code> 거부.
              </Callout>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;경로 패턴에서 하위 디렉토리가 매칭되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">matchPattern</code>의{" "}
                <code className="text-cyan-600">*</code>는 경로 구분자를 포함하여 모든 문자와
                매칭합니다. 따라서 <code>&quot;/src/*&quot;</code> 패턴은
                <code>&quot;/src/utils/path.ts&quot;</code>에도 매칭됩니다. 경로 레벨을 구분하려면
                <code className="text-cyan-600">wildcard.ts</code>의{" "}
                <code className="text-cyan-600">matchWildcard</code>를 사용하세요 (<code>*</code>는
                한 레벨, <code>**</code>는 여러 레벨).
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
                  name: "permission-manager.ts",
                  slug: "permission-manager",
                  relation: "parent",
                  desc: "규칙 매칭과 모드 검사를 통합하여 최종 권한을 결정하는 메인 매니저",
                },
                {
                  name: "modes.ts",
                  slug: "permission-modes",
                  relation: "sibling",
                  desc: "5가지 권한 모드별 도구 실행 허용 여부를 결정하는 모듈",
                },
                {
                  name: "pattern-parser.ts",
                  slug: "permission-patterns",
                  relation: "sibling",
                  desc: "권한 패턴 문자열을 파싱하고 매칭하는 모듈",
                },
                {
                  name: "wildcard.ts",
                  slug: "permission-wildcard",
                  relation: "sibling",
                  desc: "경로 안전한 와일드카드 매칭 — * vs ** 구분",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
