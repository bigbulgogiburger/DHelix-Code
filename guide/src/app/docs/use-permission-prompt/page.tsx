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

export default function UsePermissionPromptPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/hooks/usePermissionPrompt.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">usePermissionPrompt</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              도구 실행 권한 확인과 사용자 프롬프트를 관리하는 React 훅입니다.
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
                <code className="text-cyan-600">usePermissionPrompt</code>는 에이전트가 도구를
                실행하려 할 때 사용자의 승인을 받는 핵심 브릿지 훅입니다. 에이전트 루프(비동기
                코어)와 권한 프롬프트 UI(React 컴포넌트) 사이를{" "}
                <code className="text-cyan-600">Promise</code>로 연결합니다.
              </p>
              <p>
                동작 흐름은 3단계입니다: 에이전트 루프가{" "}
                <code className="text-cyan-600">checkPermission(call)</code>을 호출하면, 먼저{" "}
                <code className="text-cyan-600">PermissionManager</code>에서 자동 허용 여부를
                확인합니다. 자동 허용되지 않으면 <code className="text-cyan-600">Promise</code>를
                생성하고
                <code className="text-cyan-600">pendingPermission</code> 상태를 설정하여 UI에
                프롬프트를 표시합니다.
              </p>
              <p>
                사용자가 &quot;yes&quot;, &quot;always&quot;, &quot;no&quot; 중 하나로 응답하면,
                <code className="text-cyan-600">resolve()</code>를 통해 에이전트 루프에 결과가
                전달되고 루프가 재개됩니다. &quot;always&quot;를 선택하면 해당 도구는 세션 동안 다시
                묻지 않습니다.
              </p>
            </div>

            <MermaidDiagram
              title="usePermissionPrompt 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AL["Agent Loop<br/><small>agent-loop.ts</small>"]
  PP["usePermissionPrompt<br/><small>usePermissionPrompt.ts</small>"]
  PM["PermissionManager<br/><small>permissions/manager.ts</small>"]
  TR["ToolRegistry<br/><small>tools/registry.ts</small>"]
  UI["PermissionPrompt UI<br/><small>React 컴포넌트</small>"]

  AL -->|"checkPermission(call)"| PP
  PP -->|"check()"| PM
  PP -->|"get(call.name)"| TR
  PP -->|"pendingPermission"| UI
  UI -->|"handlePermissionResponse"| PP
  PP -->|"resolve(result)"| AL

  style PP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style PM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TR fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style UI fill:#dcfce7,stroke:#10b981,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 스마트폰에서 앱이 카메라 접근을 요청하면 시스템이
              &quot;허용하시겠습니까?&quot; 팝업을 보여주는 것과 같습니다. 에이전트가 파일 수정이나
              명령 실행을 요청하면, 이 훅이 사용자에게 승인 여부를 묻고 그 결과를 에이전트에
              전달합니다.
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

            {/* PendingPermission interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface PendingPermission
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              대기 중인 권한 요청 객체입니다. 도구 호출 정보와 결과를 에이전트 루프에 전달할{" "}
              <code className="text-cyan-600">resolve</code> 함수를 포함합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "call",
                  type: "ExtractedToolCall",
                  required: true,
                  desc: "도구 호출 정보 (도구 이름, 인수 등)",
                },
                {
                  name: "resolve",
                  type: "(result: PermissionResult) => void",
                  required: true,
                  desc: "에이전트 루프에 결과를 전달하는 콜백. 호출 시 루프가 재개됨",
                },
              ]}
            />

            {/* usePermissionPrompt hook */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              usePermissionPrompt(permissionManager, toolRegistry)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              도구 권한 프롬프트를 관리하는 메인 훅입니다. 에이전트 루프에 전달할{" "}
              <code className="text-cyan-600">checkPermission</code> 함수와 UI에 전달할
              상태/핸들러를 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">usePermissionPrompt</span>(
              {"\n"}
              {"  "}
              <span className="prop">permissionManager</span>:{" "}
              <span className="type">PermissionManager</span>,{"\n"}
              {"  "}
              <span className="prop">toolRegistry</span>: <span className="type">ToolRegistry</span>
              {"\n"}): {"{"}
              {"\n"}
              {"  "}
              <span className="prop">pendingPermission</span>:{" "}
              <span className="type">PendingPermission | null</span>;{"\n"}
              {"  "}
              <span className="prop">handlePermissionResponse</span>: (
              <span className="prop">response</span>: <span className="str">&quot;yes&quot;</span> |{" "}
              <span className="str">&quot;no&quot;</span> |{" "}
              <span className="str">&quot;always&quot;</span>) =&gt;{" "}
              <span className="type">void</span>;{"\n"}
              {"  "}
              <span className="prop">checkPermission</span>: (<span className="prop">call</span>:{" "}
              <span className="type">ExtractedToolCall</span>) =&gt;{" "}
              <span className="type">Promise&lt;PermissionResult&gt;</span>;{"\n"}
              {"}"}
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "permissionManager",
                  type: "PermissionManager",
                  required: true,
                  desc: "권한 정책(모드별 자동 허용 규칙 등)을 관리하는 객체",
                },
                {
                  name: "toolRegistry",
                  type: "ToolRegistry",
                  required: true,
                  desc: "도구의 permissionLevel을 조회하기 위한 레지스트리",
                },
              ]}
            />

            {/* Return values */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">반환값</h4>
            <ParamTable
              params={[
                {
                  name: "pendingPermission",
                  type: "PendingPermission | null",
                  required: true,
                  desc: "현재 대기 중인 권한 요청. null이면 대기 없음",
                },
                {
                  name: "handlePermissionResponse",
                  type: "(response) => void",
                  required: true,
                  desc: "사용자 응답 처리 함수. UI 컴포넌트에서 호출",
                },
                {
                  name: "checkPermission",
                  type: "(call) => Promise<PermissionResult>",
                  required: true,
                  desc: "에이전트 루프에 전달할 권한 확인 함수",
                },
              ]}
            />

            {/* Response types */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">사용자 응답 유형</h4>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-emerald-600">&quot;yes&quot;</code> &mdash; 이번만
                허용. <code className="text-cyan-600">approve()</code> 호출 후{" "}
                <code className="text-cyan-600">allowed: true</code> 반환
              </p>
              <p>
                &bull; <code className="text-blue-600">&quot;always&quot;</code> &mdash; 이 세션
                동안 이 도구를 항상 허용. <code className="text-cyan-600">approveAll()</code> 호출
              </p>
              <p>
                &bull; <code className="text-red-600">&quot;no&quot;</code> &mdash; 거부.{" "}
                <code className="text-cyan-600">
                  allowed: false, reason: &quot;User denied&quot;
                </code>{" "}
                반환
              </p>
            </div>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">checkPermission</code>은 <strong>async</strong>{" "}
                함수입니다. 프롬프트가 필요할 때 <code className="text-cyan-600">Promise</code>를
                생성하고, 사용자가 응답할 때까지 에이전트 루프를 블로킹합니다.
              </li>
              <li>
                <code className="text-cyan-600">toolRegistry</code>에 없는 도구는 즉시
                <code className="text-cyan-600">
                  allowed: false, reason: &quot;Unknown tool&quot;
                </code>
                을 반환합니다. MCP 도구가 아직 로드되지 않은 시점에 호출하면 거부될 수 있습니다.
              </li>
              <li>
                <code className="text-cyan-600">pendingPermission</code>이 존재하는 동안 에이전트
                루프는 <code className="text-cyan-600">await</code>로 대기 중입니다. UI가 이 상태를
                반드시 처리해야 루프가 멈추지 않습니다.
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
              기본 사용법 &mdash; 에이전트 루프와 연결하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              훅에서 반환된 <code className="text-cyan-600">checkPermission</code>을 에이전트 루프
              설정에 전달하고, <code className="text-cyan-600">pendingPermission</code>으로 UI를
              조건부 렌더링합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> {"{"}{" "}
              <span className="prop">pendingPermission</span>,{" "}
              <span className="prop">handlePermissionResponse</span>,{" "}
              <span className="prop">checkPermission</span> {"}"}
              {"\n"}
              {"  "}= <span className="fn">usePermissionPrompt</span>(
              <span className="prop">permissionManager</span>,{" "}
              <span className="prop">toolRegistry</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 에이전트 루프에 권한 확인 함수 전달"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">agentConfig</span> = {"{"}
              {"\n"}
              {"  "}
              <span className="prop">checkPermission</span>,{" "}
              <span className="cm">{"// 도구 실행 전 호출됨"}</span>
              {"\n"}
              {"  "}...<span className="prop">otherConfig</span>,{"\n"}
              {"}"};{"\n"}
              {"\n"}
              <span className="cm">{"// UI에서 프롬프트 표시"}</span>
              {"\n"}
              <span className="kw">return</span> ({"\n"}
              {"  "}&lt;&gt;
              {"\n"}
              {"    "}
              {"{"}pendingPermission && ({"\n"}
              {"      "}&lt;<span className="type">PermissionPrompt</span>
              {"\n"}
              {"        "}
              <span className="prop">call</span>={"{"}pendingPermission.call{"}"}
              {"\n"}
              {"        "}
              <span className="prop">onResponse</span>={"{"}handlePermissionResponse{"}"}
              {"\n"}
              {"      "}/&gt;
              {"\n"}
              {"    "}
              {")"}
              {"\n"}
              {"  "}&lt;/&gt;
              {"\n"});
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>pendingPermission</code>이 <code>null</code>이 아닌데
              UI에서 프롬프트를 표시하지 않으면, 에이전트 루프가 영원히 <code>await</code> 상태에
              머물게 됩니다. 반드시 UI에서 이 상태를 처리하세요.
            </Callout>

            {/* 고급: 응답 흐름 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 응답별 처리 상세
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              각 응답이 <code className="text-cyan-600">PermissionManager</code>와 에이전트 루프에
              어떤 영향을 미치는지 확인하세요.
            </p>
            <CodeBlock>
              <span className="cm">{'// "yes" 응답 시:'}</span>
              {"\n"}
              <span className="prop">permissionManager</span>.<span className="fn">approve</span>(
              <span className="prop">call</span>.<span className="prop">name</span>,{" "}
              <span className="prop">call</span>.<span className="prop">arguments</span>);
              {"\n"}
              <span className="fn">resolve</span>({"{"} <span className="prop">allowed</span>:{" "}
              <span className="kw">true</span> {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{'// "always" 응답 시:'}</span>
              {"\n"}
              <span className="prop">permissionManager</span>.<span className="fn">approveAll</span>
              (<span className="prop">call</span>.<span className="prop">name</span>);
              {"\n"}
              <span className="fn">resolve</span>({"{"} <span className="prop">allowed</span>:{" "}
              <span className="kw">true</span> {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{'// "no" 응답 시:'}</span>
              {"\n"}
              <span className="fn">resolve</span>({"{"} <span className="prop">allowed</span>:{" "}
              <span className="kw">false</span>, <span className="prop">reason</span>:{" "}
              <span className="str">&quot;User denied&quot;</span> {"}"});
            </CodeBlock>

            <DeepDive title="Promise 브릿지 패턴 상세">
              <p className="mb-3">
                이 훅의 핵심 패턴은 &quot;Promise 브릿지&quot;입니다. 비동기 코어(에이전트 루프)와
                동기 UI(React 상태) 사이를 <code className="text-cyan-600">Promise</code>로
                연결합니다.
              </p>
              <CodeBlock>
                <span className="cm">{"// checkPermission 내부에서 Promise 생성"}</span>
                {"\n"}
                <span className="kw">return new</span> <span className="type">Promise</span>&lt;
                <span className="type">PermissionResult</span>&gt;((
                <span className="prop">resolve</span>) =&gt; {"{"}
                {"\n"}
                {"  "}
                <span className="cm">{"// resolve를 React 상태에 저장"}</span>
                {"\n"}
                {"  "}
                <span className="fn">setPendingPermission</span>({"{"}{" "}
                <span className="prop">call</span>, <span className="prop">resolve</span> {"}"});
                {"\n"}
                {"}"});
                {"\n"}
                {"\n"}
                <span className="cm">{"// → 에이전트 루프는 이 Promise를 await"}</span>
                {"\n"}
                <span className="cm">
                  {"// → UI가 handlePermissionResponse() 호출 시 resolve() 실행"}
                </span>
                {"\n"}
                <span className="cm">{"// → Promise가 해소되고 에이전트 루프 재개"}</span>
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                이 패턴 덕분에 에이전트 루프는 UI의 존재를 몰라도 되고, UI는 에이전트 루프의 내부
                구조를 몰라도 됩니다. 두 레이어가 <code className="text-cyan-600">Promise</code>를
                통해 느슨하게 결합됩니다.
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
              권한 확인 흐름 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">checkPermission(call)</code> 호출부터 에이전트 루프
              재개까지의 전체 흐름입니다.
            </p>

            <MermaidDiagram
              title="권한 확인 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("checkPermission(call)"))
  LOOKUP{"toolRegistry.get(name)<br/>도구 존재?"}
  CHECK{"permissionManager.check()<br/>자동 허용?"}
  PROMPT{"requiresPrompt?"}
  AUTO_OK["즉시 allowed: true"]
  DENY["allowed: false<br/>Denied by mode"]
  UNKNOWN["allowed: false<br/>Unknown tool"]
  PROMISE["Promise 생성<br/>setPendingPermission"]
  UI["UI 프롬프트 표시"]
  USER{"사용자 응답"}
  YES["approve() + resolve"]
  ALWAYS["approveAll() + resolve"]
  NO["resolve(denied)"]

  START --> LOOKUP
  LOOKUP -->|"없음"| UNKNOWN
  LOOKUP -->|"있음"| CHECK
  CHECK -->|"allowed"| AUTO_OK
  CHECK -->|"not allowed"| PROMPT
  PROMPT -->|"yes"| PROMISE
  PROMPT -->|"no"| DENY
  PROMISE --> UI
  UI --> USER
  USER -->|"yes"| YES
  USER -->|"always"| ALWAYS
  USER -->|"no"| NO

  style START fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style PROMISE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style AUTO_OK fill:#dcfce7,stroke:#10b981,color:#065f46
  style UNKNOWN fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style DENY fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">checkPermission</code> 함수의 3단계 판단 로직입니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">checkPermission</span> ={" "}
              <span className="fn">useCallback</span>({"\n"}
              {"  "}
              <span className="kw">async</span> (<span className="prop">call</span>:{" "}
              <span className="type">ExtractedToolCall</span>):{" "}
              <span className="type">Promise&lt;PermissionResult&gt;</span> =&gt; {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [1] 도구 존재 확인"}</span>
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">tool</span> ={" "}
              <span className="prop">toolRegistry</span>.<span className="fn">get</span>(
              <span className="prop">call</span>.<span className="prop">name</span>);
              {"\n"}
              {"    "}
              <span className="kw">if</span> (!<span className="prop">tool</span>){" "}
              <span className="kw">return</span> {"{"} <span className="prop">allowed</span>:{" "}
              <span className="kw">false</span>, <span className="prop">reason</span>:{" "}
              <span className="str">&quot;Unknown tool&quot;</span> {"}"};{"\n"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [2] 자동 허용 여부 확인"}</span>
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">check</span> ={" "}
              <span className="prop">permissionManager</span>.<span className="fn">check</span>(
              {"\n"}
              {"      "}
              <span className="prop">call</span>.<span className="prop">name</span>,{" "}
              <span className="prop">tool</span>.<span className="prop">permissionLevel</span>,{" "}
              <span className="prop">call</span>.<span className="prop">arguments</span>
              {"\n"}
              {"    "});
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">check</span>.
              <span className="prop">allowed</span>) <span className="kw">return</span> {"{"}{" "}
              <span className="prop">allowed</span>: <span className="kw">true</span> {"}"};{"\n"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [3] 프롬프트가 필요하면 Promise로 대기"}</span>
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">check</span>.
              <span className="prop">requiresPrompt</span>) {"{"}
              {"\n"}
              {"      "}
              <span className="kw">return new</span> <span className="type">Promise</span>((
              <span className="prop">resolve</span>) =&gt; {"{"}
              {"\n"}
              {"        "}
              <span className="fn">setPendingPermission</span>({"{"}{" "}
              <span className="prop">call</span>, <span className="prop">resolve</span> {"}"});
              {"\n"}
              {"      "}
              {"}"});
              {"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"\n"}
              {"    "}
              <span className="kw">return</span> {"{"} <span className="prop">allowed</span>:{" "}
              <span className="kw">false</span>, <span className="prop">reason</span>:{" "}
              <span className="prop">check</span>.<span className="prop">reason</span> ??{" "}
              <span className="str">&quot;Denied by mode&quot;</span> {"}"};{"\n"}
              {"  "}
              {"}"}, [<span className="prop">toolRegistry</span>,{" "}
              <span className="prop">permissionManager</span>]{"\n"});
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong>{" "}
                <code className="text-cyan-600">toolRegistry.get()</code>으로 도구가 존재하는지 먼저
                확인합니다. 미등록 도구는 즉시 거부합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong>{" "}
                <code className="text-cyan-600">permissionManager.check()</code>가 현재
                모드(trust/ask/deny 등)에 따라 자동 허용 여부를 판단합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 사용자 확인이 필요하면{" "}
                <code className="text-cyan-600">new Promise</code>를 생성하고{" "}
                <code className="text-cyan-600">resolve</code>를 React 상태에 저장합니다. 이
                Promise가 해소될 때까지 에이전트 루프가 대기합니다.
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
                &quot;에이전트가 멈추고 아무 응답도 없어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">pendingPermission</code>이{" "}
                <code className="text-cyan-600">null</code>이 아닌데 UI에서 프롬프트를 표시하지
                않으면 이런 현상이 발생합니다. 에이전트 루프가 Promise를 await 중이므로, 반드시
                UI에서
                <code className="text-cyan-600">handlePermissionResponse</code>를 호출해야 합니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;always를 선택했는데 다음에 또 물어봐요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                &quot;always&quot;는 <strong>현재 세션</strong>에서만 유효합니다. 앱을 재시작하면{" "}
                <code className="text-cyan-600">PermissionManager</code>의 세션 캐시가 초기화되므로
                다시 물어봅니다. 영구 허용은{" "}
                <code className="text-cyan-600">permission-persistent-store</code>의 설정 파일에서
                관리됩니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Unknown tool 에러가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">toolRegistry</code>에 도구가 등록되기 전에
                <code className="text-cyan-600">checkPermission</code>이 호출되면 발생합니다. MCP
                도구는 서버 연결 후에 등록되므로, 연결 완료 전에 호출하면 &quot;Unknown tool&quot;로
                거부됩니다. MCP 서버의 연결 상태를 확인하세요.
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
                  relation: "child",
                  desc: "5단계 권한 결정 트리 — 이 훅이 check()와 approve()를 호출하는 대상",
                },
                {
                  name: "tool-registry.ts",
                  slug: "tool-registry",
                  relation: "child",
                  desc: "도구 등록/조회 — permissionLevel을 조회하기 위해 사용",
                },
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "ReAct 패턴 메인 루프 — checkPermission을 콜백으로 받아 도구 실행 전 호출",
                },
                {
                  name: "permission-session-store.ts",
                  slug: "permission-session-store",
                  relation: "sibling",
                  desc: "세션별 권한 허용 캐시 — approveAll()이 저장되는 곳",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
