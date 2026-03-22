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

export default function MCPToolFilterPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/mcp/tool-filter.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              MCPToolFilter
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            서버별 허용/차단 목록으로 MCP 도구를 필터링하는 모듈입니다.
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
              <code className="text-cyan-600">MCPToolFilter</code>는 MCP 서버가 제공하는 도구 중
              에이전트에 노출할 도구를 제어합니다.
              서버별로 허용 목록(allowlist)과 차단 목록(denylist)을 설정하여,
              필요한 도구만 선택적으로 활성화할 수 있습니다.
            </p>
            <p>
              필터 규칙은 명확한 우선순위를 가집니다:
              (1) allowlist만 설정하면 목록의 도구만 통과,
              (2) denylist만 설정하면 목록의 도구만 차단,
              (3) 둘 다 설정하면 allowlist 먼저 적용 후 denylist 적용,
              (4) 둘 다 미설정이면 모든 도구가 통과합니다.
            </p>
            <p>
              allowlist와 denylist에 같은 도구 이름이 있으면 모순이므로 에러를 던집니다.
              이 유효성 검사가 설정 실수를 사전에 방지합니다.
            </p>
          </div>

          <MermaidDiagram
            title="MCPToolFilter 필터링 파이프라인"
            titleColor="purple"
            chart={`graph TD
  TOOLS["MCP 도구 목록<br/><small>서버에서 조회</small>"]
  FILTER["MCPToolFilter<br/><small>tool-filter.ts</small>"]
  ALLOW["1단계: Allowlist<br/><small>목록에 있는 것만 유지</small>"]
  DENY["2단계: Denylist<br/><small>목록에 있는 것 제거</small>"]
  RESULT["필터링된 도구<br/><small>브리지에 전달</small>"]
  BRIDGE["Tool Bridge<br/><small>도구 등록</small>"]

  TOOLS --> FILTER
  FILTER --> ALLOW --> DENY --> RESULT
  RESULT --> BRIDGE

  style FILTER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style TOOLS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style ALLOW fill:#dcfce7,stroke:#10b981,color:#065f46
  style DENY fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style RESULT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style BRIDGE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> MCPToolFilter는 클럽의 &quot;출입 관리&quot;와 같습니다.
            VIP 목록(allowlist)에 있는 사람만 입장시키거나, 블랙리스트(denylist)에 있는 사람을
            차단합니다. 두 목록에 같은 이름이 있으면 모순이므로 즉시 에러를 발생시킵니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* MCPToolFilterError class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class MCPToolFilterError
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            필터 설정 오류 시 발생하는 에러 클래스입니다.
            에러 코드 <code className="text-cyan-600">&quot;MCP_TOOL_FILTER_ERROR&quot;</code>로 식별됩니다.
          </p>

          {/* MCPToolFilterConfig interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface MCPToolFilterConfig
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            서버별 도구 필터 설정입니다.
          </p>
          <ParamTable
            params={[
              { name: "allowlist", type: "readonly string[]", required: false, desc: "허용할 도구 이름 목록 (이 목록에 있는 도구만 통과)" },
              { name: "denylist", type: "readonly string[]", required: false, desc: "차단할 도구 이름 목록 (이 목록에 있는 도구는 제외)" },
            ]}
          />

          {/* MCPToolFilter class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class MCPToolFilter
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            서버별 허용/차단 목록으로 MCP 도구를 필터링하는 메인 클래스입니다.
          </p>

          {/* setFilter */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            setFilter(serverName, config)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            서버의 필터 설정을 등록합니다.
            allowlist와 denylist에 중복 항목이 있으면 에러를 던집니다.
          </p>
          <CodeBlock>
            <span className="fn">setFilter</span>(<span className="prop">serverName</span>: <span className="type">string</span>, <span className="prop">config</span>: <span className="type">MCPToolFilterConfig</span>): <span className="type">void</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "serverName", type: "string", required: true, desc: "서버 이름" },
              { name: "config", type: "MCPToolFilterConfig", required: true, desc: "필터 설정 (allowlist, denylist)" },
            ]}
          />

          {/* filterTools */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            filterTools(serverName, tools)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            도구 목록에 필터를 적용합니다. 원본 배열을 변경하지 않고 새 배열을 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">filterTools</span>(<span className="prop">serverName</span>: <span className="type">string</span>, <span className="prop">tools</span>: <span className="type">readonly MCPToolDefinition[]</span>): <span className="type">readonly MCPToolDefinition[]</span>
          </CodeBlock>

          {/* isToolAllowed */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            isToolAllowed(serverName, toolName)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            특정 도구가 서버에서 허용되는지 확인합니다.
          </p>
          <CodeBlock>
            <span className="fn">isToolAllowed</span>(<span className="prop">serverName</span>: <span className="type">string</span>, <span className="prop">toolName</span>: <span className="type">string</span>): <span className="type">boolean</span>
          </CodeBlock>

          {/* loadFromConfig */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            loadFromConfig(config)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            MCP 서버 설정에서 필터를 일괄 로드합니다.
            <code className="text-cyan-600">allowedTools</code>와 <code className="text-cyan-600">blockedTools</code> 필드를 읽어 필터로 등록합니다.
          </p>
          <CodeBlock>
            <span className="fn">loadFromConfig</span>(<span className="prop">config</span>: <span className="type">Record{"<"}string, {"{"} allowedTools?: string[]; blockedTools?: string[] {"}"}{">"}</span>): <span className="type">void</span>
          </CodeBlock>

          {/* getFilter / removeFilter / clear */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getFilter(serverName) / removeFilter(serverName) / clear()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            필터 설정을 조회, 삭제, 전체 초기화합니다.
          </p>
          <CodeBlock>
            <span className="fn">getFilter</span>(<span className="prop">serverName</span>: <span className="type">string</span>): <span className="type">MCPToolFilterConfig | undefined</span>
            {"\n"}<span className="fn">removeFilter</span>(<span className="prop">serverName</span>: <span className="type">string</span>): <span className="type">void</span>
            {"\n"}<span className="fn">clear</span>(): <span className="type">void</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              allowlist와 denylist에 <strong>같은 도구 이름</strong>이 있으면
              <code className="text-cyan-600">MCPToolFilterError</code>가 발생합니다.
              허용하면서 동시에 차단하는 것은 모순이므로 사전에 차단합니다.
            </li>
            <li>
              <code className="text-cyan-600">filterTools()</code>는 원본 배열을 변경하지 않습니다 (불변성 유지).
              항상 새 배열을 반환합니다.
            </li>
            <li>
              필터가 설정되지 않은 서버의 도구는 <strong>모두 통과</strong>합니다.
            </li>
            <li>
              <code className="text-cyan-600">loadFromConfig()</code>에서 필터할 내용이 없으면
              (allowedTools와 blockedTools 모두 없으면) 해당 서버의 필터를 등록하지 않습니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 도구 필터링</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 일반적인 사용 패턴입니다. 서버에 필터를 설정하고 도구 목록을 필터링합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">filter</span> = <span className="kw">new</span> <span className="fn">MCPToolFilter</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// allowlist: read와 search만 허용"}</span>
            {"\n"}<span className="prop">filter</span>.<span className="fn">setFilter</span>(<span className="str">&quot;my-server&quot;</span>, {"{"}
            {"\n"}{"  "}<span className="prop">allowlist</span>: [<span className="str">&quot;read&quot;</span>, <span className="str">&quot;search&quot;</span>],
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// denylist: delete만 차단"}</span>
            {"\n"}<span className="prop">filter</span>.<span className="fn">setFilter</span>(<span className="str">&quot;other-server&quot;</span>, {"{"}
            {"\n"}{"  "}<span className="prop">denylist</span>: [<span className="str">&quot;delete&quot;</span>, <span className="str">&quot;drop_database&quot;</span>],
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 도구 목록에 필터 적용"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">filtered</span> = <span className="prop">filter</span>.<span className="fn">filterTools</span>(<span className="str">&quot;my-server&quot;</span>, <span className="prop">tools</span>);
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> allowlist와 denylist에 같은 도구 이름을 넣으면
            <code>MCPToolFilterError</code>가 발생합니다. 설정 파일을 검수하세요.
          </Callout>

          {/* 설정에서 일괄 로드 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 설정 파일에서 일괄 로드
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MCP 설정 파일의 <code className="text-cyan-600">allowedTools</code>와
            <code className="text-cyan-600">blockedTools</code> 필드에서 필터를 일괄로 로드합니다.
          </p>
          <CodeBlock>
            <span className="prop">filter</span>.<span className="fn">loadFromConfig</span>({"{"}
            {"\n"}{"  "}<span className="str">&quot;my-server&quot;</span>: {"{"}
            {"\n"}{"    "}<span className="prop">allowedTools</span>: [<span className="str">&quot;read&quot;</span>, <span className="str">&quot;write&quot;</span>],
            {"\n"}{"    "}<span className="prop">blockedTools</span>: [<span className="str">&quot;delete&quot;</span>],
            {"\n"}{"  "}{"}"},
            {"\n"}{"  "}<span className="str">&quot;other-server&quot;</span>: {"{"}
            {"\n"}{"    "}<span className="prop">blockedTools</span>: [<span className="str">&quot;dangerous_tool&quot;</span>],
            {"\n"}{"  "}{"}"},
            {"\n"}{"}"});
          </CodeBlock>

          {/* 개별 도구 확인 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 개별 도구 허용 여부 확인
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            전체 목록을 필터링하지 않고 개별 도구의 허용 여부만 빠르게 확인할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">if</span> (<span className="prop">filter</span>.<span className="fn">isToolAllowed</span>(<span className="str">&quot;my-server&quot;</span>, <span className="str">&quot;delete&quot;</span>)) {"{"}
            {"\n"}{"  "}<span className="cm">{"// 도구 실행 허용"}</span>
            {"\n"}{"}"} <span className="kw">else</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// 도구 실행 거부"}</span>
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> 필터가 설정되지 않은 서버의 모든 도구는 기본적으로 허용됩니다.
            보안이 필요한 서버에는 반드시 allowlist를 설정하세요.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>필터 적용 흐름 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">filterTools()</code>의 2단계 필터 적용 과정입니다.
            allowlist가 먼저, denylist가 나중에 적용됩니다.
          </p>

          <MermaidDiagram
            title="filterTools() 2단계 필터링"
            titleColor="purple"
            chart={`graph TD
  INPUT["도구 목록 입력<br/><small>[read, write, delete, search]</small>"]
  CHECK["필터 설정 확인<br/><small>filters.get(serverName)</small>"]
  NO_FILTER["필터 없음<br/><small>전체 통과</small>"]
  HAS_FILTER["필터 있음"]
  ALLOW["1단계: Allowlist<br/><small>Set으로 변환 → filter()</small>"]
  DENY["2단계: Denylist<br/><small>Set으로 변환 → filter()</small>"]
  OUTPUT["필터링된 결과<br/><small>새 배열 반환</small>"]

  INPUT --> CHECK
  CHECK -->|"없음"| NO_FILTER
  CHECK -->|"있음"| HAS_FILTER
  HAS_FILTER --> ALLOW --> DENY --> OUTPUT

  style CHECK fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style ALLOW fill:#dcfce7,stroke:#10b981,color:#065f46
  style DENY fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style NO_FILTER fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style OUTPUT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style INPUT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style HAS_FILTER fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; filterTools()</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            2단계 필터링의 핵심 로직입니다. Set을 사용하여 O(1) 조회를 보장합니다.
          </p>
          <CodeBlock>
            <span className="fn">filterTools</span>(<span className="prop">serverName</span>: <span className="type">string</span>, <span className="prop">tools</span>: <span className="type">readonly MCPToolDefinition[]</span>) {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">config</span> = <span className="kw">this</span>.<span className="prop">filters</span>.<span className="fn">get</span>(<span className="prop">serverName</span>);
            {"\n"}{"  "}<span className="kw">if</span> (!<span className="prop">config</span>) <span className="kw">return</span> <span className="prop">tools</span>; <span className="cm">{"// 필터 없으면 전체 통과"}</span>
            {"\n"}
            {"\n"}{"  "}<span className="kw">let</span> <span className="prop">filtered</span> = [...<span className="prop">tools</span>]; <span className="cm">{"// 불변성: 복사본 생성"}</span>
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// 1단계: allowlist (있으면 목록에 있는 것만 유지)"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">config</span>.<span className="prop">allowlist</span>?.length) {"{"}
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">allowSet</span> = <span className="kw">new</span> <span className="fn">Set</span>(<span className="prop">config</span>.<span className="prop">allowlist</span>);
            {"\n"}{"    "}<span className="prop">filtered</span> = <span className="prop">filtered</span>.<span className="fn">filter</span>(<span className="prop">t</span> =&gt; <span className="prop">allowSet</span>.<span className="fn">has</span>(<span className="prop">t</span>.<span className="prop">name</span>));
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// 2단계: denylist (있으면 목록에 있는 것 제거)"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">config</span>.<span className="prop">denylist</span>?.length) {"{"}
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">denySet</span> = <span className="kw">new</span> <span className="fn">Set</span>(<span className="prop">config</span>.<span className="prop">denylist</span>);
            {"\n"}{"    "}<span className="prop">filtered</span> = <span className="prop">filtered</span>.<span className="fn">filter</span>(<span className="prop">t</span> =&gt; !<span className="prop">denySet</span>.<span className="fn">has</span>(<span className="prop">t</span>.<span className="prop">name</span>));
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="kw">return</span> <span className="prop">filtered</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">Set 변환:</strong> 배열을 Set으로 변환하여 <code>has()</code> 조회를 O(1)로 최적화합니다.</p>
            <p><strong className="text-gray-900">불변성:</strong> 원본 배열을 스프레드 연산자(<code>[...tools]</code>)로 복사합니다.</p>
            <p><strong className="text-gray-900">2단계 파이프라인:</strong> allowlist 적용 결과에 denylist를 다시 적용하므로, 두 필터가 모두 적용됩니다.</p>
          </div>

          <DeepDive title="validateConfig() — 교집합 검사 상세">
            <p className="mb-3">
              <code className="text-cyan-600">setFilter()</code> 호출 시 allowlist와 denylist의
              교집합을 검사하여 모순을 방지합니다:
            </p>
            <CodeBlock>
              <span className="kw">private</span> <span className="fn">validateConfig</span>(<span className="prop">serverName</span>: <span className="type">string</span>, <span className="prop">config</span>: <span className="type">MCPToolFilterConfig</span>) {"{"}
              {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">config</span>.<span className="prop">allowlist</span> && <span className="prop">config</span>.<span className="prop">denylist</span>) {"{"}
              {"\n"}{"    "}<span className="kw">const</span> <span className="prop">overlap</span> = <span className="prop">config</span>.<span className="prop">allowlist</span>.<span className="fn">filter</span>(
              {"\n"}{"      "}<span className="prop">name</span> =&gt; <span className="prop">config</span>.<span className="prop">denylist</span>!.<span className="fn">includes</span>(<span className="prop">name</span>)
              {"\n"}{"    "});
              {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">overlap</span>.<span className="prop">length</span> {">"} <span className="num">0</span>) {"{"}
              {"\n"}{"      "}<span className="kw">throw new</span> <span className="fn">MCPToolFilterError</span>(<span className="str">...</span>);
              {"\n"}{"    "}{"}"}
              {"\n"}{"  "}{"}"}
              {"\n"}{"}"}
            </CodeBlock>
            <p className="mt-3 text-amber-600">
              이 검사는 <code>setFilter()</code> 호출 시점에 즉시 수행됩니다.
              <code>filterTools()</code> 호출 시점이 아니므로, 잘못된 설정은 사전에 차단됩니다.
            </p>
          </DeepDive>
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
              &quot;Tool names appear in both allowlist and denylist 에러가 나요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              설정 파일에서 같은 도구 이름이 <code className="text-cyan-600">allowedTools</code>와
              <code className="text-cyan-600">blockedTools</code> 모두에 포함되어 있습니다.
              에러의 <code className="text-cyan-600">context.overlapping</code>에 중복된 도구 이름이 표시됩니다.
              하나의 목록에서만 사용하세요.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;allowlist를 설정했는데 도구가 하나도 안 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              allowlist의 도구 이름이 MCP 서버가 제공하는 도구 이름과 정확히 일치하는지 확인하세요.
              대소문자가 다르면 매칭되지 않습니다.
            </p>
            <Callout type="tip" icon="*">
              MCP 서버의 도구 이름은 <code>listTools()</code>로 확인할 수 있습니다.
              <code>/mcp</code> 명령어로도 확인 가능합니다.
            </Callout>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;필터를 설정하지 않았는데 모든 도구가 사용 가능해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              이것은 정상 동작입니다. 필터가 설정되지 않은 서버의 도구는 기본적으로
              모두 허용됩니다. 도구를 제한하고 싶다면 allowlist 또는 denylist를 명시적으로 설정하세요.
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
                name: "tool-bridge.ts",
                slug: "mcp-tool-bridge",
                relation: "sibling",
                desc: "필터링된 도구를 dbcode 레지스트리에 등록하는 브리지 모듈",
              },
              {
                name: "mcp-manager.ts",
                slug: "mcp-manager",
                relation: "parent",
                desc: "MCPToolFilter를 사용하여 서버별 도구 필터링을 관리하는 상위 매니저",
              },
              {
                name: "permission-manager.ts",
                slug: "permission-manager",
                relation: "sibling",
                desc: "도구 실행 권한을 관리하는 5-mode 권한 시스템 — 필터와는 별개의 보안 계층",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
