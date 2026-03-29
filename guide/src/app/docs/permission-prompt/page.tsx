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

export default function PermissionPromptPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/components/PermissionPrompt.tsx" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">PermissionPrompt</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              에이전트가 위험할 수 있는 도구를 실행하기 전에 사용자에게 권한을 묻는 프롬프트
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
                <code className="text-cyan-600">PermissionPrompt</code>는 에이전트가 잠재적으로
                위험한 도구 (bash_exec, file_write 등)를 실행하려 할 때 사용자에게 허용 여부를 묻는
                Ink 컴포넌트입니다. 노란색 둥근 테두리 안에 도구 이름과 실행 내용을 표시하고, 하단에
                세 가지 선택지를 가로로 나열합니다.
              </p>
              <p>
                사용자는 좌우 화살표로 옵션을 탐색하고 Enter로 확인합니다. 세 가지 옵션은:
                <code className="text-cyan-600">&quot;Allow once&quot;</code>(이번 한 번만 허용),
                <code className="text-cyan-600">&quot;Allow for session&quot;</code>(현재 세션 동안
                항상 허용),
                <code className="text-cyan-600">&quot;Deny&quot;</code>(거부)입니다.
              </p>
              <p>
                이 컴포넌트는 dhelix의 권한 시스템에서 사용자 인터페이스 부분을 담당합니다. 권한
                관리의 비즈니스 로직은 <code className="text-cyan-600">permission-manager.ts</code>
                에, 권한 모드 설정은 <code className="text-cyan-600">permission-modes.ts</code>에
                있으며, 이 컴포넌트는 순수하게 UI 표시와 사용자 입력 수신만 담당합니다.
              </p>
            </div>

            <MermaidDiagram
              title="PermissionPrompt 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AL["Agent Loop<br/><small>에이전트 루프 — 도구 실행 요청</small>"]
  PM["Permission Manager<br/><small>권한 검사 + 모드 관리</small>"]
  PP["PermissionPrompt<br/><small>권한 요청 프롬프트 UI</small>"]
  TCB["ToolCallBlock<br/><small>도구 실행 결과 표시</small>"]
  TE["Tool Executor<br/><small>실제 도구 실행</small>"]

  AL -->|"권한 필요?"| PM
  PM -->|"사용자 확인 필요"| PP
  PP -->|"yes / always / no"| PM
  PM -->|"허용됨"| TE
  TE --> TCB

  style PP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style PM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TCB fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TE fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> PermissionPrompt는 운영체제의 &quot;이 앱이 파일에 접근하려고
              합니다. 허용하시겠습니까?&quot; 대화 상자와 같은 역할입니다. 에이전트가 시스템에
              영향을 줄 수 있는 작업을 수행하기 전에 사용자의 명시적 동의를 받습니다.
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

            {/* PermissionPromptProps interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface PermissionPromptProps
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              PermissionPrompt 컴포넌트에 전달되는 Props입니다. 모든 프로퍼티는{" "}
              <code className="text-cyan-600">readonly</code>입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "toolName",
                  type: "string",
                  required: true,
                  desc: '권한을 요청하는 도구 이름 (예: "bash_exec", "file_write")',
                },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: "도구 호출의 상세 설명 (인수 포함, 사용자에게 보여줄 내용)",
                },
                {
                  name: "onResponse",
                  type: '(response: "yes" | "no" | "always") => void',
                  required: true,
                  desc: "사용자의 선택을 전달하는 콜백 함수",
                },
              ]}
            />

            {/* OPTIONS constant */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              OPTIONS
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              사용자가 선택할 수 있는 권한 옵션 목록입니다.{" "}
              <code className="text-cyan-600">as const</code>로 선언되어 타입이 고정됩니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">OPTIONS</span> = [{"\n"}
              {"  "}
              {"{"} <span className="prop">label</span>:{" "}
              <span className="str">&quot;Allow once&quot;</span>,{" "}
              <span className="prop">response</span>: <span className="str">&quot;yes&quot;</span>{" "}
              {"}"},{"\n"}
              {"  "}
              {"{"} <span className="prop">label</span>:{" "}
              <span className="str">&quot;Allow for session&quot;</span>,{" "}
              <span className="prop">response</span>:{" "}
              <span className="str">&quot;always&quot;</span> {"}"},{"\n"}
              {"  "}
              {"{"} <span className="prop">label</span>:{" "}
              <span className="str">&quot;Deny&quot;</span>, <span className="prop">response</span>:{" "}
              <span className="str">&quot;no&quot;</span> {"}"},{"\n"}]{" "}
              <span className="kw">as const</span>;
            </CodeBlock>
            <div className="text-[13px] text-gray-600 mt-3 space-y-1">
              <p>
                &bull; <code className="text-emerald-600">&quot;yes&quot;</code> (Allow once)
                &mdash; 이번 한 번만 실행을 허용합니다. 다음에 같은 도구를 호출하면 다시 묻습니다.
              </p>
              <p>
                &bull; <code className="text-cyan-600">&quot;always&quot;</code> (Allow for session)
                &mdash; 현재 세션 동안 이 도구를 항상 허용합니다. 세션이 끝나면 초기화됩니다.
              </p>
              <p>
                &bull; <code className="text-red-600">&quot;no&quot;</code> (Deny) &mdash; 실행을
                거부합니다. 도구 상태가 &quot;denied&quot;로 설정됩니다.
              </p>
            </div>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                사용자가 응답하면 컴포넌트는 즉시 <code className="text-cyan-600">null</code>을
                반환하여 화면에서 사라집니다. 한 번 응답하면 다시 표시할 수 없습니다.
              </li>
              <li>
                <code className="text-cyan-600">useInput</code> 훅은{" "}
                <code className="text-cyan-600">answered</code> state가 true가 되면 비활성화됩니다 (
                <code className="text-cyan-600">isActive: !answered</code>). 응답 후 추가 키 입력은
                무시됩니다.
              </li>
              <li>
                옵션 탐색은 순환합니다 &mdash; 마지막 옵션에서 오른쪽 화살표를 누르면 첫 번째로
                돌아갑니다. 모듈로 연산(<code className="text-cyan-600">% OPTIONS.length</code>)을
                사용합니다.
              </li>
              <li>
                이 컴포넌트는 <code className="text-cyan-600">React.memo</code>로 감싸져 있지{" "}
                <strong>않습니다</strong>. 프롬프트가 표시되는 동안은 한 번만 렌더링되고 사용자
                입력에 의한 state 변경만 발생하므로 최적화가 불필요합니다.
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
              기본 사용법 &mdash; 도구 권한 확인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              도구 실행 전에 사용자 확인이 필요할 때 이 컴포넌트를 렌더링합니다.
              <code className="text-cyan-600">onResponse</code> 콜백으로 사용자의 선택을 받습니다.
            </p>
            <CodeBlock>
              <span className="kw">{"<"}</span>
              <span className="fn">PermissionPrompt</span>
              {"\n"}
              {"  "}
              <span className="prop">toolName</span>=
              <span className="str">&quot;bash_exec&quot;</span>
              {"\n"}
              {"  "}
              <span className="prop">description</span>=
              <span className="str">&quot;command: rm -rf node_modules&quot;</span>
              {"\n"}
              {"  "}
              <span className="prop">onResponse</span>={"{"}
              {"{"}
              <span className="fn">handlePermission</span>
              {"}"}
              {"}"}
              {"\n"}
              <span className="kw">/{">"}</span>
            </CodeBlock>

            <CodeBlock>
              <span className="cm">{"// onResponse 콜백 처리"}</span>
              {"\n"}
              <span className="kw">function</span> <span className="fn">handlePermission</span>(
              <span className="prop">response</span>: <span className="str">&quot;yes&quot;</span> |{" "}
              <span className="str">&quot;no&quot;</span> |{" "}
              <span className="str">&quot;always&quot;</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">switch</span> (<span className="prop">response</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">case</span> <span className="str">&quot;yes&quot;</span>:{"\n"}
              {"      "}
              <span className="cm">{"// 이번 한 번만 허용 → 도구 실행"}</span>
              {"\n"}
              {"      "}
              <span className="fn">executeTool</span>(<span className="prop">toolCall</span>);
              {"\n"}
              {"      "}
              <span className="kw">break</span>;{"\n"}
              {"    "}
              <span className="kw">case</span> <span className="str">&quot;always&quot;</span>:
              {"\n"}
              {"      "}
              <span className="cm">
                {"// 세션 동안 항상 허용 → 세션 스토어에 기록 + 도구 실행"}
              </span>
              {"\n"}
              {"      "}
              <span className="fn">sessionStore</span>.<span className="fn">allow</span>(
              <span className="prop">toolName</span>);
              {"\n"}
              {"      "}
              <span className="fn">executeTool</span>(<span className="prop">toolCall</span>);
              {"\n"}
              {"      "}
              <span className="kw">break</span>;{"\n"}
              {"    "}
              <span className="kw">case</span> <span className="str">&quot;no&quot;</span>:{"\n"}
              {"      "}
              <span className="cm">{'// 거부 → 도구 상태를 "denied"로 설정'}</span>
              {"\n"}
              {"      "}
              <span className="fn">denyTool</span>(<span className="prop">toolCall</span>);
              {"\n"}
              {"      "}
              <span className="kw">break</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>onResponse</code>가 호출된 후 컴포넌트는 즉시 사라집니다.
              콜백에서 비동기 작업이 필요하면 콜백 내부에서 처리하세요. 컴포넌트가 사라진 후에는
              어떤 UI 업데이트도 할 수 없습니다.
            </Callout>

            {/* 키보드 조작 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 키보드 조작과 UI 구조
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              PermissionPrompt의 UI 구조와 키보드 인터랙션입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 표시 예시:"}</span>
              {"\n"}
              <span className="cm">{"// ╭────────────────────────────────────╮"}</span>
              {"\n"}
              <span className="cm">{"// │ Permission required               │"}</span>
              {"\n"}
              <span className="cm">{"// │ Tool: bash_exec                   │"}</span>
              {"\n"}
              <span className="cm">{"// │ command: rm -rf node_modules      │"}</span>
              {"\n"}
              <span className="cm">{"// │                                   │"}</span>
              {"\n"}
              <span className="cm">{"// │ ▸ Allow once  Allow for session  Deny │"}</span>
              {"\n"}
              <span className="cm">{"// ╰────────────────────────────────────╯"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 키보드 조작:"}</span>
              {"\n"}
              <span className="cm">{"// ← → : 옵션 이동 (순환)"}</span>
              {"\n"}
              <span className="cm">{"// Enter : 선택 확정"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 선택된 옵션은 시안색(<code className="text-cyan-600">cyan</code>
              )으로 강조되고 밑줄이 표시됩니다. 선택되지 않은 옵션은 흐린 회색으로 표시되어 현재
              위치를 쉽게 파악할 수 있습니다.
              <code className="text-cyan-600">Shift+Tab</code>으로 권한 모드 자체를 변경할 수도
              있습니다.
            </Callout>

            <DeepDive title="Ink의 useInput 훅과 isActive 패턴">
              <p className="mb-3">
                Ink의 <code className="text-cyan-600">useInput</code> 훅은 키보드 이벤트를
                수신합니다.
                <code className="text-cyan-600">isActive</code> 옵션이 false이면 이벤트 리스너가
                비활성화됩니다.
              </p>
              <CodeBlock>
                <span className="fn">useInput</span>({"\n"}
                {"  "}(<span className="prop">_input</span>, <span className="prop">key</span>)
                =&gt; {"{"}
                {"\n"}
                {"    "}
                <span className="kw">if</span> (<span className="prop">answered</span>){" "}
                <span className="kw">return</span>;{"\n"}
                {"    "}
                <span className="cm">{"// ... 키 처리 로직"}</span>
                {"\n"}
                {"  "}
                {"}"},{"\n"}
                {"  "}
                {"{"} <span className="prop">isActive</span>: !
                <span className="prop">answered</span> {"}"}
                {"\n"});
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                <code className="text-cyan-600">answered</code>가 true가 되면 이중으로 보호됩니다:
                (1) 콜백 내부의 early return, (2){" "}
                <code className="text-cyan-600">isActive: false</code>로 리스너 비활성화. 이를 통해
                사용자가 Enter를 빠르게 여러 번 누르더라도 콜백이 한 번만 호출됩니다.
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
              상태 전이 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              PermissionPrompt는 간단한 두 가지 상태만 가지고 있습니다: 표시 중(대기)과 응답
              완료(사라짐).
            </p>

            <MermaidDiagram
              title="PermissionPrompt 상태 전이"
              titleColor="purple"
              chart={`graph TD
  START(("렌더링")) --> WAITING["대기 중<br/><small>프롬프트 표시 + 키 입력 대기</small>"]
  WAITING -->|"← 화살표"| NAV_LEFT["옵션 이동 (왼쪽)<br/><small>selectedIndex 감소 (순환)</small>"]
  WAITING -->|"→ 화살표"| NAV_RIGHT["옵션 이동 (오른쪽)<br/><small>selectedIndex 증가 (순환)</small>"]
  NAV_LEFT --> WAITING
  NAV_RIGHT --> WAITING
  WAITING -->|"Enter"| ANSWERED["응답 완료<br/><small>answered = true</small>"]
  ANSWERED -->|"onResponse(선택값)"| CALLBACK["콜백 호출<br/><small>yes / always / no</small>"]
  ANSWERED -->|"컴포넌트"| NULL["null 반환<br/><small>화면에서 사라짐</small>"]

  style WAITING fill:#fef9c3,stroke:#eab308,color:#1e293b,stroke-width:2px
  style ANSWERED fill:#dcfce7,stroke:#10b981,color:#1e293b
  style NAV_LEFT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style NAV_RIGHT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style CALLBACK fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style NULL fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              키보드 입력 처리와 옵션 선택 로직의 핵심 부분입니다.
            </p>
            <CodeBlock>
              <span className="fn">useInput</span>((<span className="prop">_input</span>,{" "}
              <span className="prop">key</span>) =&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 이미 응답했으면 아무것도 하지 않음"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">answered</span>){" "}
              <span className="kw">return</span>;{"\n"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">key</span>.
              <span className="prop">leftArrow</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [2] 왼쪽 화살표 — 순환 이동"}</span>
              {"\n"}
              {"    "}
              <span className="fn">setSelectedIndex</span>((<span className="prop">prev</span>)
              =&gt;
              {"\n"}
              {"      "}(<span className="prop">prev</span> - <span className="num">1</span> +{" "}
              <span className="prop">OPTIONS</span>.<span className="prop">length</span>) %{" "}
              <span className="prop">OPTIONS</span>.<span className="prop">length</span>
              {"\n"}
              {"    "});
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"  "}
              <span className="kw">else if</span> (<span className="prop">key</span>.
              <span className="prop">rightArrow</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [3] 오른쪽 화살표 — 순환 이동"}</span>
              {"\n"}
              {"    "}
              <span className="fn">setSelectedIndex</span>((<span className="prop">prev</span>)
              =&gt;
              {"\n"}
              {"      "}(<span className="prop">prev</span> + <span className="num">1</span>) %{" "}
              <span className="prop">OPTIONS</span>.<span className="prop">length</span>
              {"\n"}
              {"    "});
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"  "}
              <span className="kw">else if</span> (<span className="prop">key</span>.
              <span className="prop">return</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [4] Enter — 선택 확정 + 콜백 호출"}</span>
              {"\n"}
              {"    "}
              <span className="fn">setAnswered</span>(<span className="kw">true</span>);
              {"\n"}
              {"    "}
              <span className="fn">onResponse</span>(<span className="prop">OPTIONS</span>[
              <span className="prop">selectedIndex</span>].<span className="prop">response</span>);
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"});
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 이미 응답한 상태에서는 추가 키 입력을
                무시합니다. Enter를 빠르게 두 번 눌러도 콜백이 한 번만 호출됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 왼쪽 화살표:{" "}
                <code className="text-cyan-600">(prev - 1 + length) % length</code>로 음수 인덱스를
                방지하면서 순환합니다. 첫 번째 옵션에서 왼쪽을 누르면 마지막으로 이동합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 오른쪽 화살표:{" "}
                <code className="text-cyan-600">(prev + 1) % length</code>로 순환합니다. 마지막
                옵션에서 오른쪽을 누르면 첫 번째로 돌아갑니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> Enter:{" "}
                <code className="text-cyan-600">answered</code>를 true로 설정(컴포넌트 사라짐)하고,
                현재 선택된 옵션의 response 값을 콜백으로 전달합니다.
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
                &quot;권한 프롬프트가 너무 자주 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                &quot;Allow once&quot; 대신 &quot;Allow for session&quot;을 선택하면 해당 도구에
                대해 현재 세션 동안 다시 묻지 않습니다. 또는{" "}
                <code className="text-cyan-600">Shift+Tab</code>으로 권한 모드를 변경하여 더 관대한
                모드를 사용할 수 있습니다.
              </p>
              <Callout type="tip" icon="*">
                권한 모드는 5가지가 있습니다. &quot;trust&quot; 모드에서는 모든 도구가 자동
                허용됩니다. 자세한 내용은 <code>permission-modes.ts</code> 문서를 참고하세요.
              </Callout>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;키보드가 먹히지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Ink의 <code className="text-cyan-600">useInput</code> 훅은 터미널이 raw 모드일 때만
                작동합니다. 파이프 입력이나 비인터랙티브 모드에서는 키 입력을 받을 수 없습니다. 또한
                다른 컴포넌트가 <code className="text-cyan-600">useInput</code>을 사용 중이면 충돌할
                수 있습니다. PermissionPrompt의 <code className="text-cyan-600">isActive</code>가
                true인지 확인하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;프롬프트가 사라진 후에도 도구가 실행되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">onResponse</code> 콜백에서 실제 도구 실행 로직이
                올바르게 연결되어 있는지 확인하세요. 이 컴포넌트는 순수하게 UI만 담당하며, 콜백 호출
                후의 동작은 부모 컴포넌트(또는 Permission Manager)의 책임입니다. &quot;no&quot;를
                선택했다면 도구 실행이 거부된 것이 정상입니다.
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
                  desc: "권한 검사의 비즈니스 로직을 담당하며 PermissionPrompt 표시 여부를 결정하는 모듈",
                },
                {
                  name: "permission-modes.ts",
                  slug: "permission-modes",
                  relation: "sibling",
                  desc: "5가지 권한 모드(trust, default, strict 등)를 정의하는 모듈",
                },
                {
                  name: "ToolCallBlock.tsx",
                  slug: "tool-call-block",
                  relation: "sibling",
                  desc: "권한이 허용/거부된 후 도구 실행 결과를 표시하는 컴포넌트",
                },
                {
                  name: "tool-executor.ts",
                  slug: "tool-executor",
                  relation: "sibling",
                  desc: "권한이 허용된 후 실제 도구를 실행하는 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
