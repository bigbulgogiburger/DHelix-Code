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

export default function MCPManagerConnectorPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/mcp/manager-connector.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">MCPManagerConnector</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              6개의 MCP 서브 모듈을 통합 관리하는 오케스트레이터 &mdash; 리소스, 프롬프트, 도구
              검색, OAuth, 필터, 출력 제한을 조율합니다.
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
                <code className="text-cyan-600">MCPManagerConnector</code>는 MCP 시스템의 6개 서브
                모듈을 하나의 오케스트레이터로 통합합니다. MCPManager가 서버 연결(transport)을
                담당한다면, 이 커넥터는 연결된 서버에 대한 부가 기능들을 초기화하고 조율합니다.
              </p>
              <p>
                통합하는 6개 서브 모듈: <code className="text-cyan-600">MCPResourceManager</code>
                (리소스 검색/캐싱),
                <code className="text-cyan-600">MCPPromptManager</code>(프롬프트/슬래시 명령),
                <code className="text-cyan-600">MCPToolSearch</code>(지연 로딩 도구 검색),
                <code className="text-cyan-600">MCPOAuthManager</code>(OAuth 토큰 관리),
                <code className="text-cyan-600">MCPToolFilter</code>(허용/차단 필터),
                <code className="text-cyan-600">MCPOutputLimiter</code>(출력 크기 제한).
              </p>
              <p>
                각 서브 모듈은 독립적으로 활성화/비활성화할 수 있으며, 서버 연결 시 자동으로
                초기화됩니다. 부분 실패를 허용하여 하나의 서버 초기화가 실패해도 나머지는 정상
                동작합니다.
              </p>
            </div>

            <MermaidDiagram
              title="MCPManagerConnector와 6개 서브 모듈"
              titleColor="purple"
              chart={`graph TD
  MGR["MCPManager<br/><small>mcp/manager.ts</small>"]
  CONN["MCPManagerConnector<br/><small>manager-connector.ts</small>"]
  RES["ResourceManager<br/><small>리소스 검색/캐싱</small>"]
  PRM["PromptManager<br/><small>프롬프트/슬래시 명령</small>"]
  TS["ToolSearch<br/><small>지연 로딩 검색</small>"]
  OA["OAuthManager<br/><small>토큰 관리</small>"]
  TF["ToolFilter<br/><small>허용/차단 필터</small>"]
  OL["OutputLimiter<br/><small>출력 크기 제한</small>"]

  MGR -->|"connectAllServers()"| CONN
  CONN --> RES
  CONN --> PRM
  CONN --> TS
  CONN --> OA
  CONN --> TF
  CONN --> OL

  style CONN fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style MGR fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RES fill:#dcfce7,stroke:#10b981,color:#1e293b
  style PRM fill:#dcfce7,stroke:#10b981,color:#1e293b
  style TS fill:#dcfce7,stroke:#10b981,color:#1e293b
  style OA fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style TF fill:#dcfce7,stroke:#10b981,color:#1e293b
  style OL fill:#dcfce7,stroke:#10b981,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 공항 터미널을 떠올리세요. MCPManager가 비행기(서버)를 활주로에
              착륙시키는 관제탑이라면, MCPManagerConnector는 착륙한 비행기에 대해 수하물 처리, 입국
              심사, 세관 검사, 연결편 안내 등 6가지 부가 서비스를 조율하는 터미널 관리자입니다.
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

            {/* MCPConnectorConfig */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface MCPConnectorConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              각 서브 모듈의 활성화 여부와 세부 설정을 지정합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "enableResources",
                  type: "boolean",
                  required: false,
                  desc: "리소스 관리 활성화 (기본: true)",
                },
                {
                  name: "enablePrompts",
                  type: "boolean",
                  required: false,
                  desc: "프롬프트 관리 활성화 (기본: true)",
                },
                {
                  name: "enableToolSearch",
                  type: "boolean",
                  required: false,
                  desc: "도구 검색(지연 로딩) 활성화 (기본: true)",
                },
                {
                  name: "enableOAuth",
                  type: "boolean",
                  required: false,
                  desc: "OAuth 관리 활성화 (기본: true)",
                },
                {
                  name: "enableToolFilter",
                  type: "boolean",
                  required: false,
                  desc: "도구 필터 활성화 (기본: true)",
                },
                {
                  name: "enableOutputLimiter",
                  type: "boolean",
                  required: false,
                  desc: "출력 제한 활성화 (기본: true)",
                },
                {
                  name: "toolSearchThreshold",
                  type: "number",
                  required: false,
                  desc: "이 도구 수를 초과하면 지연 로딩으로 전환 (기본: 50)",
                },
                {
                  name: "outputLimiterConfig",
                  type: "Partial<OutputLimitConfig>",
                  required: false,
                  desc: "출력 제한 세부 설정",
                },
              ]}
            />

            {/* MCPServerConnectionResult */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface MCPServerConnectionResult
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              단일 MCP 서버의 연결 결과를 보고합니다.
            </p>
            <ParamTable
              params={[
                { name: "serverName", type: "string", required: true, desc: "서버 이름" },
                { name: "resourceCount", type: "number", required: true, desc: "발견된 리소스 수" },
                { name: "promptCount", type: "number", required: true, desc: "발견된 프롬프트 수" },
                {
                  name: "toolCount",
                  type: "number",
                  required: true,
                  desc: "사용 가능한 도구 수 (필터링 후)",
                },
                {
                  name: "deferredToolCount",
                  type: "number",
                  required: true,
                  desc: "지연 로딩으로 전환된 도구 수",
                },
                {
                  name: "oauthRequired",
                  type: "boolean",
                  required: true,
                  desc: "OAuth 인증 필요 여부",
                },
                {
                  name: "filteredToolCount",
                  type: "number",
                  required: true,
                  desc: "필터에 의해 제외된 도구 수",
                },
              ]}
            />

            {/* MCPConnectorResult */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface MCPConnectorResult
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              전체 서버 연결 결과의 집계입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "servers",
                  type: "readonly MCPServerConnectionResult[]",
                  required: true,
                  desc: "각 서버의 연결 결과 배열",
                },
                {
                  name: "totalResources",
                  type: "number",
                  required: true,
                  desc: "전체 리소스 수 합계",
                },
                {
                  name: "totalPrompts",
                  type: "number",
                  required: true,
                  desc: "전체 프롬프트 수 합계",
                },
                { name: "totalTools", type: "number", required: true, desc: "전체 도구 수 합계" },
                {
                  name: "totalDeferredTools",
                  type: "number",
                  required: true,
                  desc: "전체 지연 로딩 도구 수 합계",
                },
                {
                  name: "errors",
                  type: "readonly { serverName, error }[]",
                  required: true,
                  desc: "연결 실패한 서버 목록",
                },
              ]}
            />

            {/* MCPManagerConnector class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class MCPManagerConnector
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              6개의 MCP 서브 모듈을 통합하여 서버 수명주기를 관리하는 메인 클래스입니다.
            </p>

            {/* Constructor */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">constructor</h4>
            <CodeBlock>
              <span className="kw">constructor</span>(<span className="prop">config</span>?:{" "}
              <span className="type">MCPConnectorConfig</span>)
            </CodeBlock>

            {/* connectServer */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              connectServer(client, serverName, serverConfig)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">단일 서버의 6단계 초기화를 수행합니다.</p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">connectServer</span>({"\n"}
              {"  "}
              <span className="prop">client</span>: <span className="type">MCPClient</span>,{"\n"}
              {"  "}
              <span className="prop">serverName</span>: <span className="type">string</span>,{"\n"}
              {"  "}
              <span className="prop">serverConfig</span>:{" "}
              <span className="type">MCPServerConfig</span>
              {"\n"}): <span className="type">Promise</span>&lt;
              <span className="type">MCPServerConnectionResult</span>&gt;
            </CodeBlock>

            {/* connectAllServers */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              connectAllServers(clients, configs)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              모든 서버를 병렬로 초기화합니다. 부분 실패를 허용합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">connectAllServers</span>({"\n"}
              {"  "}
              <span className="prop">clients</span>: <span className="type">ReadonlyMap</span>&lt;
              <span className="type">string</span>, <span className="type">MCPClient</span>&gt;,
              {"\n"}
              {"  "}
              <span className="prop">configs</span>: <span className="type">Record</span>&lt;
              <span className="type">string</span>, <span className="type">MCPServerConfig</span>
              &gt;
              {"\n"}): <span className="type">Promise</span>&lt;
              <span className="type">MCPConnectorResult</span>&gt;
            </CodeBlock>

            {/* disconnectAll */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">disconnectAll()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              모든 서브 모듈의 상태를 정리합니다 (캐시, 인덱스, 필터 초기화).
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">disconnectAll</span>():{" "}
              <span className="type">Promise</span>&lt;<span className="type">void</span>&gt;
            </CodeBlock>

            {/* limitToolOutput */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              limitToolOutput(content, serverName?)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              MCP 도구 실행 결과의 출력을 제한합니다.
            </p>
            <CodeBlock>
              <span className="fn">limitToolOutput</span>(<span className="prop">content</span>:{" "}
              <span className="type">string</span>, <span className="prop">serverName</span>?:{" "}
              <span className="type">string</span>): <span className="type">string</span>
            </CodeBlock>

            {/* getter 메서드들 */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">서브 모듈 접근자</h4>
            <p className="text-[13px] text-gray-600 mb-3">각 서브 모듈의 인스턴스를 반환합니다.</p>
            <CodeBlock>
              <span className="fn">getResourceManager</span>():{" "}
              <span className="type">MCPResourceManager</span>
              {"\n"}
              <span className="fn">getPromptManager</span>():{" "}
              <span className="type">MCPPromptManager</span>
              {"\n"}
              <span className="fn">getToolSearch</span>():{" "}
              <span className="type">MCPToolSearch</span>
              {"\n"}
              <span className="fn">getOAuthManager</span>():{" "}
              <span className="type">MCPOAuthManager</span>
              {"\n"}
              <span className="fn">getToolFilter</span>():{" "}
              <span className="type">MCPToolFilter</span>
              {"\n"}
              <span className="fn">getOutputLimiter</span>():{" "}
              <span className="type">MCPOutputLimiter</span>
            </CodeBlock>

            {/* getStats */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getStats()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              커넥터의 운영 통계를 반환합니다 (리소스 캐시, 출력 제한, 도구 검색 등).
            </p>
            <CodeBlock>
              <span className="fn">getStats</span>():{" "}
              <span className="type">MCPConnectorStats</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                리소스/프롬프트 검색 실패는 치명적이지 않으므로 조용히 무시됩니다. 도구 목록 조회
                실패만 에러를 던집니다.
              </li>
              <li>
                도구 수가 <code className="text-cyan-600">toolSearchThreshold</code>(기본: 50)를
                초과해야 지연 로딩이 활성화됩니다. 그 이하에서는 모든 도구가 즉시 로딩됩니다.
              </li>
              <li>
                <code className="text-cyan-600">connectAllServers()</code>는{" "}
                <code className="text-cyan-600">Promise.allSettled()</code>를 사용하므로, 일부
                서버가 실패해도 나머지는 정상 초기화됩니다.
              </li>
              <li>
                프롬프트 기능은 MCPClient가 <code className="text-cyan-600">listPrompts</code>,
                <code className="text-cyan-600">getPrompt</code> 메서드를 가지고 있을 때만
                활성화됩니다 (타입 가드).
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
              기본 사용법 &mdash; 전체 서버 초기화
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              MCPManager로 서버에 연결한 후, 커넥터로 부가 기능을 초기화합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">connector</span> ={" "}
              <span className="kw">new</span> <span className="fn">MCPManagerConnector</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// MCPManager가 서버에 연결한 후..."}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="prop">connector</span>.
              <span className="fn">connectAllServers</span>({"\n"}
              {"  "}
              <span className="prop">connectedClients</span>,{" "}
              <span className="cm">{"// Map<string, MCPClient>"}</span>
              {"\n"}
              {"  "}
              <span className="prop">serverConfigs</span>,{" "}
              <span className="cm">{"// Record<string, MCPServerConfig>"}</span>
              {"\n"});
              {"\n"}
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">`도구: ${"{"}</span>
              <span className="prop">result</span>.<span className="prop">totalTools</span>
              <span className="str">
                {"}"}, 리소스: ${"{"}
              </span>
              <span className="prop">result</span>.<span className="prop">totalResources</span>
              <span className="str">{"}"}`</span>);
              {"\n"}
              <span className="kw">if</span> (<span className="prop">result</span>.
              <span className="prop">errors</span>.<span className="prop">length</span> {">"}{" "}
              <span className="num">0</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">warn</span>(
              <span className="str">&quot;일부 서버 초기화 실패:&quot;</span>,{" "}
              <span className="prop">result</span>.<span className="prop">errors</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>connectAllServers()</code>를 호출하기 전에 MCPManager로
              서버에 먼저 연결해야 합니다. 클라이언트가 연결되지 않은 상태에서 호출하면 도구 목록
              조회가 실패합니다.
            </Callout>

            {/* 선택적 모듈 비활성화 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 선택적 모듈 비활성화
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              필요하지 않은 서브 모듈을 비활성화하여 리소스를 절약할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">connector</span> ={" "}
              <span className="kw">new</span> <span className="fn">MCPManagerConnector</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">enableResources</span>: <span className="kw">false</span>,{" "}
              <span className="cm">{"// 리소스 검색 비활성화"}</span>
              {"\n"}
              {"  "}
              <span className="prop">enablePrompts</span>: <span className="kw">false</span>,{" "}
              <span className="cm">{"// 프롬프트 검색 비활성화"}</span>
              {"\n"}
              {"  "}
              <span className="prop">enableOAuth</span>: <span className="kw">false</span>,{" "}
              <span className="cm">{"// OAuth 비활성화"}</span>
              {"\n"}
              {"  "}
              <span className="prop">toolSearchThreshold</span>: <span className="num">100</span>,{" "}
              <span className="cm">{"// 100개 초과 시에만 지연 로딩"}</span>
              {"\n"}
              {"  "}
              <span className="prop">outputLimiterConfig</span>: {"{"}
              {"\n"}
              {"    "}
              <span className="prop">maxTokens</span>: <span className="num">20000</span>,{"\n"}
              {"    "}
              <span className="prop">strategy</span>: <span className="str">&quot;smart&quot;</span>
              ,{"\n"}
              {"  "}
              {"}"},{"\n"}
              {"}"});
            </CodeBlock>

            {/* 시스템 프롬프트 생성 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 시스템 프롬프트 섹션 생성
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              MCP 상태를 기반으로 LLM에 주입할 시스템 프롬프트 텍스트를 생성합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">sections</span> ={" "}
              <span className="prop">connector</span>.
              <span className="fn">generateSystemPromptSections</span>();
              {"\n"}
              {"\n"}
              <span className="cm">
                {"// sections.mcpServers     → 'Server: my-server\\nServer: other-server'"}
              </span>
              {"\n"}
              <span className="cm">{"// sections.deferredTools  → 지연 로딩 도구 이름 목록"}</span>
              {"\n"}
              <span className="cm">
                {"// sections.promptCommands → '/mcp__server__prompt — 설명'"}
              </span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>getStats()</code>로 리소스 캐시 히트율, 출력 제한 효과,
              도구 검색 토큰 사용량 등 운영 통계를 모니터링할 수 있습니다.
            </Callout>

            <DeepDive title="connectServer() 6단계 초기화 순서">
              <p className="mb-3">각 서버에 대해 다음 6단계가 순서대로 실행됩니다:</p>
              <div className="text-[13px] text-gray-600 space-y-2">
                <p>
                  <strong className="text-gray-900">1단계 OAuth</strong> &mdash; 저장된 토큰이
                  있는지 확인합니다. 실패해도 계속 진행합니다.
                </p>
                <p>
                  <strong className="text-gray-900">2단계 도구 필터</strong> &mdash; 도구 목록을
                  조회하고 허용/차단 필터를 적용합니다.
                </p>
                <p>
                  <strong className="text-gray-900">3단계 지연 로딩</strong> &mdash; 도구 수가
                  임계값(50)을 초과하면 지연 로딩으로 전환합니다.
                </p>
                <p>
                  <strong className="text-gray-900">4단계 리소스</strong> &mdash; 서버의 리소스를
                  검색합니다. 실패해도 치명적이지 않습니다.
                </p>
                <p>
                  <strong className="text-gray-900">5단계 프롬프트</strong> &mdash; 프롬프트를
                  검색합니다 (클라이언트가 지원하는 경우만).
                </p>
                <p>
                  <strong className="text-gray-900">6단계 출력 제한</strong> &mdash; 서버별 출력
                  제한 설정을 적용합니다.
                </p>
              </div>
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
              서버 초기화 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">connectServer()</code>의 6단계 초기화
              파이프라인입니다.
            </p>

            <MermaidDiagram
              title="connectServer() 6단계 파이프라인"
              titleColor="purple"
              chart={`graph TD
  START(("서버 연결")) --> S1["1. OAuth<br/><small>토큰 확인</small>"]
  S1 --> S2["2. 도구 목록<br/><small>listTools() + 필터</small>"]
  S2 --> S3{"도구 수 ><br/>threshold?"}
  S3 -->|"Yes"| S3A["3. 지연 로딩 등록"]
  S3 -->|"No"| S4
  S3A --> S4["4. 리소스 검색<br/><small>비치명적</small>"]
  S4 --> S5["5. 프롬프트 검색<br/><small>비치명적</small>"]
  S5 --> S6["6. 출력 제한 설정"]
  S6 --> DONE(("완료"))

  style START fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style S2 fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style S3A fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style S4 fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style S5 fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style DONE fill:#dcfce7,stroke:#10b981,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              병렬 서버 초기화 코드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">connectAllServers()</code>는{" "}
              <code className="text-cyan-600">Promise.allSettled()</code>로 모든 서버를 병렬
              처리하고, 부분 실패를 허용합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 모든 서버를 병렬로 초기화"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">settled</span> ={" "}
              <span className="kw">await</span> <span className="fn">Promise</span>.
              <span className="fn">allSettled</span>({"\n"}
              {"  "}
              <span className="prop">entries</span>.<span className="fn">map</span>(
              <span className="kw">async</span> ([<span className="prop">serverName</span>,{" "}
              <span className="prop">client</span>]) ={">"} {"{"}
              {"\n"}
              {"    "}
              <span className="kw">return</span> <span className="kw">this</span>.
              <span className="fn">connectServer</span>(<span className="prop">client</span>,{" "}
              <span className="prop">serverName</span>, <span className="prop">config</span>);
              {"\n"}
              {"  "}
              {"}"}){"\n"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 성공/실패 분류"}</span>
              {"\n"}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">result</span> <span className="kw">of</span>{" "}
              <span className="prop">settled</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">result</span>.
              <span className="prop">status</span> ==={" "}
              <span className="str">&quot;fulfilled&quot;</span>){" "}
              <span className="prop">results</span>.<span className="fn">push</span>(
              <span className="prop">result</span>.<span className="prop">value</span>);
              {"\n"}
              {"  "}
              <span className="kw">else</span> <span className="prop">errors</span>.
              <span className="fn">push</span>({"{"} <span className="prop">serverName</span>,{" "}
              <span className="prop">error</span>: <span className="prop">result</span>.
              <span className="prop">reason</span> {"}"});
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">Promise.allSettled()</strong> &mdash;{" "}
                <code className="text-cyan-600">Promise.all()</code>과 달리 하나가 실패해도 나머지를
                기다립니다. 부분 실패가 허용되는 MCP 시스템에 적합합니다.
              </p>
              <p>
                <strong className="text-gray-900">타입 가드</strong> &mdash;{" "}
                <code className="text-cyan-600">isPromptCapable()</code>는 런타임에 MCPClient가
                프롬프트 기능을 지원하는지 확인합니다. TypeScript에서 타입을 좁혀주는 함수입니다.
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
                &quot;Failed to list tools&quot; 에러로 서버 초기화가 실패해요
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                도구 목록 조회는 필수 단계입니다. MCPClient가 서버에 정상적으로 연결되어 있는지,
                서버가 <code className="text-cyan-600">tools/list</code> 메서드를 지원하는지
                확인하세요. 네트워크 문제나 서버 타임아웃일 수도 있습니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;프롬프트가 검색되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                프롬프트 기능은 MCPClient가 <code className="text-cyan-600">listPrompts</code>와
                <code className="text-cyan-600">getPrompt</code> 메서드를 모두 가지고 있을 때만
                활성화됩니다.
                <code className="text-cyan-600">isPromptCapable()</code> 타입 가드가 이를
                확인합니다. 서버가 프롬프트를 지원하는지 확인하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;지연 로딩이 활성화되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                도구 수가 <code className="text-cyan-600">toolSearchThreshold</code>(기본: 50)를
                초과해야 지연 로딩이 활성화됩니다. 서버의 도구 수를 확인하거나, 임계값을 낮게
                설정하세요:
                <code className="text-cyan-600">{"{ toolSearchThreshold: 10 }"}</code>
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;일부 서버만 초기화에 실패했는데 전체가 실패한 것 같아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">connectAllServers()</code>의 반환값에서
                <code className="text-cyan-600">errors</code> 배열과{" "}
                <code className="text-cyan-600">servers</code> 배열을 모두 확인하세요. 성공한 서버는{" "}
                <code className="text-cyan-600">servers</code>에, 실패한 서버는{" "}
                <code className="text-cyan-600">errors</code>에 기록됩니다.
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
                  name: "mcp/manager.ts",
                  slug: "mcp-manager",
                  relation: "parent",
                  desc: "서버 연결(transport)을 담당하는 매니저 — Connector의 상위 모듈",
                },
                {
                  name: "mcp/output-limiter.ts",
                  slug: "mcp-output-limiter",
                  relation: "child",
                  desc: "Connector가 관리하는 6개 서브 모듈 중 하나 — 도구 출력 크기 제한",
                },
                {
                  name: "mcp/oauth.ts",
                  slug: "mcp-oauth",
                  relation: "child",
                  desc: "Connector가 관리하는 6개 서브 모듈 중 하나 — OAuth 2.0 토큰 관리",
                },
                {
                  name: "mcp/managed-config.ts",
                  slug: "mcp-managed-config",
                  relation: "sibling",
                  desc: "관리자 정책 설정 — Connector의 도구 필터와 연동",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
