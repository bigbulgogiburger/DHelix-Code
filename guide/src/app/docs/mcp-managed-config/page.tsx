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

export default function MCPManagedConfigPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/mcp/managed-config.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              MCPManagedConfig
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            기업/조직 환경에서 관리자가 MCP 서버 설정에 대한 정책을 강제하는 관리형 설정 모듈입니다.
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
              <code className="text-cyan-600">MCPManagedConfig</code>는 관리자(Admin)가 MCP 서버 설정을
              중앙에서 제어할 수 있도록 하는 정책 관리 모듈입니다. 설정 파일
              <code className="text-cyan-600">~/.dbcode/managed-mcp.json</code>을 통해
              서버 사전 등록, 도구 허용/차단 목록 강제, 사용자 서버 추가 제한 등의 정책을 적용합니다.
            </p>
            <p>
              관리자 설정은 사용자/프로젝트 설정보다 항상 우선합니다. 예를 들어, 관리자가
              <code className="text-cyan-600">readOnly: true</code>로 설정한 서버는 사용자가 수정할 수 없고,
              <code className="text-cyan-600">enforceAllowlist: true</code>이면 관리자가 허용한 도구만 사용 가능합니다.
            </p>
            <p>
              설정 파일이 없으면 모든 정책이 허용적(permissive)으로 동작하므로,
              개인 환경에서는 이 모듈의 존재를 의식할 필요가 없습니다. Zod 스키마를 사용하여
              설정 파일의 유효성을 런타임에 검증합니다.
            </p>
          </div>

          <MermaidDiagram
            title="MCPManagedConfig 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  MGR["MCPManager<br/><small>mcp/manager.ts</small>"]
  MC["MCPManagedConfig<br/><small>mcp/managed-config.ts</small>"]
  DISK["managed-mcp.json<br/><small>~/.dbcode/</small>"]
  USR["사용자/프로젝트 설정<br/><small>settings.json</small>"]
  MERGED["병합된 서버 설정"]
  TF["MCPToolFilter<br/><small>mcp/tool-filter.ts</small>"]

  MGR -->|"load()"| MC
  MC -->|"readFile"| DISK
  MC -->|"mergeWithUserConfigs()"| MERGED
  USR -->|"사용자 서버"| MC
  MC -->|"getEffectiveToolFilter()"| TF

  style MC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style MGR fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style DISK fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style USR fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style MERGED fill:#dcfce7,stroke:#10b981,color:#1e293b
  style TF fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 회사에서 IT 관리자가 직원 컴퓨터에 소프트웨어 설치 정책을 적용하는 것과 같습니다.
            관리자가 &quot;승인된 소프트웨어만 설치 가능&quot;이라는 정책을 설정하면,
            직원은 목록에 없는 소프트웨어를 설치할 수 없습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* ManagedServerConfig */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            type ManagedServerConfig
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            관리자가 사전 등록하는 MCP 서버의 설정 항목입니다. Zod 스키마에서 추론됩니다.
          </p>
          <ParamTable
            params={[
              { name: "transport", type: '"stdio" | "http" | "sse"', required: false, desc: '트랜스포트 타입 (기본: "stdio")' },
              { name: "command", type: "string", required: false, desc: "실행할 명령어 (stdio용)" },
              { name: "args", type: "string[]", required: false, desc: "명령어 인자 (stdio용)" },
              { name: "url", type: "string", required: false, desc: "서버 URL (http/sse용)" },
              { name: "env", type: "Record<string, string>", required: false, desc: "환경 변수" },
              { name: "allowedTools", type: "string[]", required: false, desc: "허용할 도구 목록 — 이 목록의 도구만 사용 가능" },
              { name: "blockedTools", type: "string[]", required: false, desc: "차단할 도구 목록 — 이 목록의 도구는 사용 불가" },
              { name: "enforceAllowlist", type: "boolean", required: false, desc: "true면 사용자가 추가 도구를 허용할 수 없음" },
              { name: "readOnly", type: "boolean", required: false, desc: "true면 사용자가 이 서버 설정을 수정할 수 없음" },
              { name: "maxOutputTokens", type: "number", required: false, desc: "최대 출력 토큰 수" },
            ]}
          />

          {/* ManagedPolicies */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            type ManagedPolicies
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            조직 전체에 적용되는 글로벌 관리자 정책입니다.
          </p>
          <ParamTable
            params={[
              { name: "allowUserServers", type: "boolean", required: true, desc: "사용자가 자체 서버를 추가할 수 있는지 (기본: true)" },
              { name: "requireApproval", type: "boolean", required: true, desc: "새 서버 추가 시 관리자 승인 필요 여부 (기본: false)" },
              { name: "maxServers", type: "number", required: true, desc: "최대 서버 수 (기본: 20)" },
              { name: "blockedTransports", type: '("stdio" | "http" | "sse")[]', required: true, desc: "차단할 트랜스포트 타입 목록 (기본: 빈 배열)" },
            ]}
          />

          {/* ManagedConfigValidationResult */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ManagedConfigValidationResult
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            사용자 서버 설정의 관리자 정책 검증 결과를 나타냅니다.
          </p>
          <ParamTable
            params={[
              { name: "valid", type: "boolean", required: true, desc: "검증 통과 여부" },
              { name: "errors", type: "readonly string[]", required: true, desc: "검증 실패 사유 목록 (차단 사유)" },
              { name: "warnings", type: "readonly string[]", required: true, desc: "경고 목록 (차단하지는 않지만 주의 필요)" },
            ]}
          />

          {/* detectTransportType */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function detectTransportType()
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            서버 설정에서 트랜스포트 타입을 자동 감지합니다.
          </p>
          <CodeBlock>
            <span className="fn">detectTransportType</span>(<span className="prop">config</span>: <span className="type">RawServerConfigInput</span>): <span className="str">&quot;stdio&quot;</span> | <span className="str">&quot;http&quot;</span> | <span className="str">&quot;sse&quot;</span>
          </CodeBlock>
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <code className="text-cyan-600">transport</code>가 명시되어 있으면 해당 값 사용</p>
            <p>&bull; <code className="text-cyan-600">url</code>이 있으면 &rarr; <code className="text-emerald-600">&quot;http&quot;</code></p>
            <p>&bull; <code className="text-cyan-600">command</code>가 있으면 &rarr; <code className="text-emerald-600">&quot;stdio&quot;</code></p>
            <p>&bull; 기본값 &rarr; <code className="text-emerald-600">&quot;stdio&quot;</code></p>
          </div>

          {/* MCPManagedConfig class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class MCPManagedConfig
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            관리자 수준의 MCP 서버 설정을 처리하는 메인 클래스입니다.
          </p>

          {/* Constructor */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            constructor
          </h4>
          <CodeBlock>
            <span className="kw">constructor</span>(<span className="prop">configPath</span>?: <span className="type">string</span>)
          </CodeBlock>
          <ParamTable
            params={[
              { name: "configPath", type: "string | undefined", required: false, desc: "설정 파일 경로 (기본: ~/.dbcode/managed-mcp.json)" },
            ]}
          />

          {/* load */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            load()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            디스크에서 관리자 설정을 로드하고 Zod 스키마로 검증합니다. 파일이 없으면 기본 허용적 설정을 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">load</span>(): <span className="type">Promise</span>&lt;<span className="type">ManagedConfig</span>&gt;
          </CodeBlock>

          {/* getManagedServers */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getManagedServers()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            관리자가 사전 등록한 서버 목록을 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">getManagedServers</span>(): <span className="type">ReadonlyMap</span>&lt;<span className="type">string</span>, <span className="type">ManagedServerConfig</span>&gt;
          </CodeBlock>

          {/* mergeWithUserConfigs */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            mergeWithUserConfigs(userConfigs)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            관리자 설정과 사용자/프로젝트 설정을 병합합니다. 관리자 설정이 항상 우선합니다.
          </p>
          <CodeBlock>
            <span className="fn">mergeWithUserConfigs</span>(<span className="prop">userConfigs</span>: <span className="type">Record</span>&lt;<span className="type">string</span>, <span className="type">MCPServerConfig</span>&gt;): <span className="type">Record</span>&lt;<span className="type">string</span>, <span className="type">MCPServerConfig</span>&gt;
          </CodeBlock>

          {/* validateServerConfig */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            validateServerConfig(name, config)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            사용자가 제공한 서버 설정을 관리자 정책에 따라 검증합니다.
          </p>
          <CodeBlock>
            <span className="fn">validateServerConfig</span>(<span className="prop">name</span>: <span className="type">string</span>, <span className="prop">config</span>: <span className="type">MCPServerConfig</span>): <span className="type">ManagedConfigValidationResult</span>
          </CodeBlock>

          {/* getEffectiveToolFilter */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getEffectiveToolFilter(serverName, userAllowlist?, userDenylist?)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            관리자 설정과 사용자 필터를 병합하여 유효 도구 필터를 계산합니다.
          </p>
          <CodeBlock>
            <span className="fn">getEffectiveToolFilter</span>(<span className="prop">serverName</span>: <span className="type">string</span>, <span className="prop">userAllowlist</span>?: <span className="type">readonly string</span>[], <span className="prop">userDenylist</span>?: <span className="type">readonly string</span>[]): {"{"} <span className="prop">allowlist</span>?: <span className="type">readonly string</span>[]; <span className="prop">denylist</span>?: <span className="type">readonly string</span>[] {"}"}
          </CodeBlock>

          {/* canAddServer */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            canAddServer(currentServerCount)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            현재 서버 수로 새 서버를 추가할 수 있는지 확인합니다.
          </p>
          <CodeBlock>
            <span className="fn">canAddServer</span>(<span className="prop">currentServerCount</span>: <span className="type">number</span>): <span className="type">boolean</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">load()</code>를 호출하기 전에 다른 메서드를 호출하면
              <code className="text-cyan-600">MCPManagedConfigError</code>가 발생합니다.
            </li>
            <li>
              설정 파일이 없으면 모든 정책이 허용적(permissive)으로 동작합니다. 이것은 의도된 동작입니다.
            </li>
            <li>
              <code className="text-cyan-600">enforceAllowlist</code>가 true이면 사용자 허용 목록은 완전히 무시되고,
              관리자 허용 목록만 적용됩니다.
            </li>
            <li>
              허용 목록은 교집합(intersection), 차단 목록은 합집합(union)으로 계산됩니다.
              즉, 차단 목록은 양쪽 모두의 차단 항목을 합칩니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 관리자 설정 로드 및 병합</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 일반적인 패턴입니다. 관리자 설정을 로드한 뒤
            사용자 설정과 병합하여 최종 서버 목록을 생성합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. 인스턴스 생성 (기본 경로 사용)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">managedConfig</span> = <span className="kw">new</span> <span className="fn">MCPManagedConfig</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 디스크에서 설정 로드"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">managedConfig</span>.<span className="fn">load</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 사용자 설정과 병합"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">userConfigs</span> = {"{"} <span className="str">&quot;my-server&quot;</span>: {"{"} <span className="prop">transport</span>: <span className="str">&quot;stdio&quot;</span>, ... {"}"} {"}"};
            {"\n"}<span className="kw">const</span> <span className="prop">merged</span> = <span className="prop">managedConfig</span>.<span className="fn">mergeWithUserConfigs</span>(<span className="prop">userConfigs</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// merged에는 관리자 서버 + 허용된 사용자 서버가 포함됨"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>load()</code>를 호출하지 않고 <code>mergeWithUserConfigs()</code>나
            <code>getManagedServers()</code>를 호출하면 에러가 발생합니다.
            반드시 <code>load()</code>를 먼저 호출하세요.
          </Callout>

          {/* 고급: 정책 검증 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 서버 설정 정책 검증
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            사용자가 추가하려는 서버가 관리자 정책을 만족하는지 사전에 검증할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">result</span> = <span className="prop">managedConfig</span>.<span className="fn">validateServerConfig</span>(<span className="str">&quot;new-server&quot;</span>, {"{"}{"\n"}{"  "}<span className="prop">transport</span>: <span className="str">&quot;http&quot;</span>,{"\n"}{"  "}<span className="prop">url</span>: <span className="str">&quot;https://mcp.example.com&quot;</span>,{"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="kw">if</span> (!<span className="prop">result</span>.<span className="prop">valid</span>) {"{"}
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">error</span>(<span className="str">&quot;차단:&quot;</span>, <span className="prop">result</span>.<span className="prop">errors</span>);
            {"\n"}{"}"}
            {"\n"}<span className="kw">if</span> (<span className="prop">result</span>.<span className="prop">warnings</span>.<span className="prop">length</span> {">"} <span className="num">0</span>) {"{"}
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">warn</span>(<span className="str">&quot;경고:&quot;</span>, <span className="prop">result</span>.<span className="prop">warnings</span>);
            {"\n"}{"}"}
          </CodeBlock>

          {/* 고급: 도구 필터 계산 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 유효 도구 필터 계산
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            관리자와 사용자의 허용/차단 목록을 병합하여 최종 필터를 계산합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">filter</span> = <span className="prop">managedConfig</span>.<span className="fn">getEffectiveToolFilter</span>(
            {"\n"}{"  "}<span className="str">&quot;my-server&quot;</span>,
            {"\n"}{"  "}<span className="cm">{"// 사용자 허용 목록"}</span>
            {"\n"}{"  "}[<span className="str">&quot;read&quot;</span>, <span className="str">&quot;write&quot;</span>, <span className="str">&quot;search&quot;</span>],
            {"\n"}{"  "}<span className="cm">{"// 사용자 차단 목록"}</span>
            {"\n"}{"  "}[<span className="str">&quot;delete&quot;</span>],
            {"\n"});
            {"\n"}
            {"\n"}<span className="cm">{"// filter.allowlist: 관리자 ∩ 사용자 (교집합)"}</span>
            {"\n"}<span className="cm">{"// filter.denylist:  관리자 ∪ 사용자 (합집합)"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>enforceAllowlist: true</code>이면 사용자 허용 목록은 완전히 무시됩니다.
            관리자가 지정한 도구만 사용 가능하므로, 보안이 중요한 환경에서 권장됩니다.
          </Callout>

          <DeepDive title="설정 파일(managed-mcp.json) 예시">
            <CodeBlock>
              {"{"}
              {"\n"}{"  "}<span className="str">&quot;mcpServers&quot;</span>: {"{"}
              {"\n"}{"    "}<span className="str">&quot;company-tools&quot;</span>: {"{"}
              {"\n"}{"      "}<span className="str">&quot;transport&quot;</span>: <span className="str">&quot;http&quot;</span>,
              {"\n"}{"      "}<span className="str">&quot;url&quot;</span>: <span className="str">&quot;https://mcp.company.com&quot;</span>,
              {"\n"}{"      "}<span className="str">&quot;readOnly&quot;</span>: <span className="kw">true</span>,
              {"\n"}{"      "}<span className="str">&quot;allowedTools&quot;</span>: [<span className="str">&quot;search&quot;</span>, <span className="str">&quot;read&quot;</span>],
              {"\n"}{"      "}<span className="str">&quot;enforceAllowlist&quot;</span>: <span className="kw">true</span>
              {"\n"}{"    "}{"}"}
              {"\n"}{"  "}{"}"},{"\n"}{"  "}<span className="str">&quot;policies&quot;</span>: {"{"}
              {"\n"}{"    "}<span className="str">&quot;allowUserServers&quot;</span>: <span className="kw">true</span>,
              {"\n"}{"    "}<span className="str">&quot;maxServers&quot;</span>: <span className="num">10</span>,
              {"\n"}{"    "}<span className="str">&quot;blockedTransports&quot;</span>: [<span className="str">&quot;sse&quot;</span>]
              {"\n"}{"  "}{"}"}{"\n"}{"}"}
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              이 예시에서: <code className="text-cyan-600">company-tools</code> 서버는 읽기 전용이며
              search와 read 도구만 허용됩니다. 사용자는 최대 10개 서버를 추가할 수 있지만,
              SSE 트랜스포트는 차단됩니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>설정 병합 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">mergeWithUserConfigs()</code>의 핵심 로직입니다.
            관리자 서버를 우선 추가한 뒤, 정책이 허용하면 사용자 서버를 추가합니다.
          </p>

          <MermaidDiagram
            title="설정 병합 흐름"
            titleColor="purple"
            chart={`graph TD
  START(("시작")) --> ADM["관리자 서버 순회"]
  ADM -->|"readOnly?"| RO["관리자 설정만 사용"]
  ADM -->|"사용자 설정 있음"| MERGE["연결정보: 사용자<br/>정책: 관리자"]
  ADM -->|"사용자 설정 없음"| RO
  RO --> RESULT["병합된 결과"]
  MERGE --> RESULT
  RESULT --> CHK{"allowUserServers?"}
  CHK -->|"true"| UADD["사용자 전용 서버 추가"]
  CHK -->|"false"| DONE(("완료"))
  UADD --> DONE

  style ADM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style RO fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style MERGE fill:#dcfce7,stroke:#10b981,color:#065f46
  style CHK fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>허용 목록 계산 로직</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">computeAllowlist()</code>의 네 가지 경우의 수입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 경우 1: enforceAllowlist=true → 관리자 목록만"}</span>
            {"\n"}<span className="kw">if</span> (<span className="prop">managed</span>.<span className="prop">enforceAllowlist</span> && <span className="prop">managedAllowlist</span>) {"{"}
            {"\n"}{"  "}<span className="kw">return</span> [...<span className="prop">managedAllowlist</span>];
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 경우 2: 둘 다 있으면 → 교집합"}</span>
            {"\n"}<span className="kw">if</span> (<span className="prop">managedAllowlist</span> && <span className="prop">userAllowlist</span>) {"{"}
            {"\n"}{"  "}<span className="kw">return</span> <span className="prop">userAllowlist</span>.<span className="fn">filter</span>(<span className="prop">t</span> ={">"} <span className="prop">managedSet</span>.<span className="fn">has</span>(<span className="prop">t</span>));
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 경우 3: 하나만 있으면 → 해당 목록"}</span>
            {"\n"}<span className="cm">{"// 경우 4: 둘 다 없으면 → undefined (전체 허용)"}</span>
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">교집합 (Intersection)</strong> &mdash; 관리자와 사용자 모두 허용한 도구만 통과합니다. 가장 보수적인 결과를 생성합니다.</p>
            <p><strong className="text-gray-900">합집합 (Union)</strong> &mdash; 차단 목록은 양쪽의 차단 항목을 모두 합칩니다. 즉, 어느 쪽에서든 차단하면 차단됩니다.</p>
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
              &quot;Policy does not allow user-defined servers&quot; 에러가 발생해요
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              관리자가 <code className="text-cyan-600">allowUserServers: false</code>로 설정했습니다.
              사용자 정의 서버를 추가할 수 없으며, 관리자가 사전 등록한 서버만 사용 가능합니다.
              IT 관리자에게 서버 추가를 요청하세요.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;관리자 설정 파일이 있는데 아무 효과가 없어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              두 가지를 확인하세요:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                파일 경로가 정확한지 확인: <code className="text-cyan-600">~/.dbcode/managed-mcp.json</code>
              </li>
              <li>
                JSON 형식이 올바른지 확인: 잘못된 JSON이면 <code className="text-cyan-600">MCPManagedConfigError</code>가
                발생하며, 기본 허용적 설정으로 대체되지 않습니다.
              </li>
            </ul>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;사용자가 추가한 도구가 작동하지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              관리자가 해당 서버에 <code className="text-cyan-600">enforceAllowlist: true</code>와
              <code className="text-cyan-600">allowedTools</code>를 설정했을 수 있습니다.
              이 경우 관리자가 명시적으로 허용한 도구만 사용 가능합니다.
              <code className="text-cyan-600">getEffectiveToolFilter()</code>로 최종 필터를 확인하세요.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;서버 수가 최대 제한에 도달했어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">policies.maxServers</code>(기본: 20)에 도달했습니다.
              <code className="text-cyan-600">canAddServer()</code>로 추가 가능 여부를 사전에 확인하세요.
              불필요한 서버를 제거하거나, 관리자에게 제한 상향을 요청하세요.
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
                name: "mcp/manager.ts",
                slug: "mcp-manager",
                relation: "parent",
                desc: "MCPManagedConfig를 로드하고 서버 연결 시 관리자 정책을 적용하는 매니저",
              },
              {
                name: "mcp/manager-connector.ts",
                slug: "mcp-manager-connector",
                relation: "sibling",
                desc: "6개 MCP 서브 모듈을 통합 관리하는 오케스트레이터 — 도구 필터, 출력 제한 포함",
              },
              {
                name: "mcp/output-limiter.ts",
                slug: "mcp-output-limiter",
                relation: "sibling",
                desc: "MCP 도구 출력의 지능적 잘림 — 관리자가 maxOutputTokens를 설정할 수 있음",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
