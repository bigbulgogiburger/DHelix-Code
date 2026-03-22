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

export default function ResourceResolverPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/mentions/resource-resolver.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">MCPResourceResolver</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              MCP 리소스 멘션의 해석, 자동완성, 캐싱을 담당하는 통합 리졸버 클래스입니다.
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
                <code className="text-cyan-600">MCPResourceResolver</code>는{" "}
                <code className="text-cyan-600">MCPResourceManager</code>와 @멘션 시스템을 통합하여,
                사용자가 <code className="text-cyan-600">@server:resource</code> 형식으로 MCP
                리소스를 참조하면 해당 콘텐츠를 가져와 컨텍스트에 주입합니다.
              </p>
              <p>
                단순 해석 외에도 <strong>자동완성</strong>(입력 도중 서버/리소스 제안),
                <strong>캐싱</strong>(서버별 리소스 목록 캐시), <strong>토큰 추정</strong>(주입
                콘텐츠의 토큰 수 예측)을 지원합니다.
              </p>
              <p>
                해석 결과는 <code className="text-cyan-600">&lt;mcp-resources&gt;</code> XML
                형식으로 포맷되어 시스템 프롬프트에 주입됩니다.{" "}
                <code className="text-cyan-600">Promise.allSettled</code>를 사용하여 일부 리소스
                실패가 전체를 중단하지 않습니다.
              </p>
            </div>

            <MermaidDiagram
              title="MCPResourceResolver 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  INPUT["사용자 입력<br/><small>@postgres:sql://users/schema</small>"]
  RESOLVER["MCPResourceResolver<br/><small>mentions/resource-resolver.ts</small>"]
  MANAGER["MCPResourceManager<br/><small>mcp/resources.ts</small>"]
  CLIENT["MCPClient<br/><small>mcp/client.ts</small>"]
  CONTEXT["contextXml<br/><small>&lt;mcp-resources&gt;...&lt;/mcp-resources&gt;</small>"]
  AUTOCOMPLETE["getSuggestions()<br/><small>자동완성 제안</small>"]

  INPUT -->|"resolveAll()"| RESOLVER
  INPUT -->|"getSuggestions()"| AUTOCOMPLETE
  RESOLVER -->|"parseResourceMentions()"| MANAGER
  RESOLVER -->|"readResource()"| CLIENT
  RESOLVER --> CONTEXT
  AUTOCOMPLETE -->|"discoverResources()"| MANAGER

  style RESOLVER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style INPUT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MANAGER fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CLIENT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CONTEXT fill:#dcfce7,stroke:#10b981,color:#065f46
  style AUTOCOMPLETE fill:#dbeafe,stroke:#3b82f6,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 도서관의 사서를 떠올리세요. MCPResourceResolver는 여러
              도서관(MCP 서버)의 카탈로그를 캐시하고, 사용자가 책 이름을 입력하면 자동완성으로
              제안하며, 선택한 책의 내용을 가져다주는 역할입니다.
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

            {/* ResolvedResourceContext */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ResolvedResourceContext
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              해석된 MCP 리소스 &mdash; 컨텍스트 주입 준비가 완료된 데이터입니다.
            </p>
            <ParamTable
              params={[
                { name: "serverName", type: "string", required: true, desc: "MCP 서버 이름" },
                { name: "resourceUri", type: "string", required: true, desc: "리소스 URI" },
                {
                  name: "content",
                  type: "string",
                  required: true,
                  desc: "리소스 콘텐츠 (잘림 처리 가능)",
                },
                {
                  name: "mimeType",
                  type: "string | undefined",
                  required: false,
                  desc: "콘텐츠 MIME 타입",
                },
                {
                  name: "truncated",
                  type: "boolean",
                  required: true,
                  desc: "최대 길이 초과로 잘렸는지 여부",
                },
                {
                  name: "originalLength",
                  type: "number",
                  required: true,
                  desc: "원본 콘텐츠 길이 (잘리기 전)",
                },
              ]}
            />

            {/* ResourceResolutionResult */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ResourceResolutionResult
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">resolveAll()</code>의 반환 타입 &mdash; 해석의 모든
              결과를 포함합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "resolvedResources",
                  type: "readonly ResolvedResourceContext[]",
                  required: true,
                  desc: "성공적으로 해석된 리소스 목록",
                },
                {
                  name: "failedResources",
                  type: "readonly { mention, error }[]",
                  required: true,
                  desc: "해석 실패한 리소스 (멘션 + 에러)",
                },
                {
                  name: "contextXml",
                  type: "string",
                  required: true,
                  desc: "XML 형태 컨텍스트 문자열",
                },
                {
                  name: "strippedText",
                  type: "string",
                  required: true,
                  desc: "멘션이 제거/치환된 원본 텍스트",
                },
                {
                  name: "totalTokensEstimate",
                  type: "number",
                  required: true,
                  desc: "추정 토큰 수 (1 토큰 ≈ 4 문자)",
                },
              ]}
            />

            {/* class MCPResourceResolver */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class MCPResourceResolver
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              MCP 리소스 멘션의 해석, 자동완성, 캐싱을 담당하는 메인 클래스입니다.
            </p>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">constructor</h4>
            <CodeBlock>
              <span className="kw">constructor</span>(<span className="prop">config</span>:{" "}
              <span className="type">ResourceResolverConfig</span>)
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "config.resourceManager",
                  type: "MCPResourceManager",
                  required: true,
                  desc: "MCP 리소스 매니저 인스턴스",
                },
                {
                  name: "config.clients",
                  type: "Map<string, MCPClient>",
                  required: true,
                  desc: "서버이름 → MCP 클라이언트 매핑",
                },
                {
                  name: "config.maxContentLength",
                  type: "number | undefined",
                  required: false,
                  desc: "리소스당 최대 콘텐츠 길이 (기본: 50,000)",
                },
              ]}
            />

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">resolveAll(text)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              텍스트의 모든 리소스 멘션을 해석하고, XML 컨텍스트와 토큰 추정치를 포함한 결과를
              반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">resolveAll</span>(
              <span className="prop">text</span>: <span className="type">string</span>):{" "}
              <span className="type">Promise</span>&lt;
              <span className="type">ResourceResolutionResult</span>&gt;
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getSuggestions(partial)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              부분 입력에 대한 자동완성 제안을 반환합니다.
              <code className="text-cyan-600">@</code> 뒤에 콜론이 없으면 서버 이름을, 콜론 이후에는
              리소스를 제안합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">getSuggestions</span>(
              <span className="prop">partial</span>: <span className="type">string</span>):{" "}
              <span className="type">Promise</span>&lt;<span className="kw">readonly</span>{" "}
              <span className="type">ResourceSuggestion</span>[]&gt;
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">refreshCatalog()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              모든 연결된 서버의 리소스 카탈로그를 새로고침합니다. 캐시를 비우고 재조회합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">refreshCatalog</span>():{" "}
              <span className="type">Promise</span>&lt;<span className="type">void</span>&gt;
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">updateClients(clients)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              서버 연결 상태가 변경될 때 클라이언트 매핑을 업데이트합니다. 연결 해제된 서버의 캐시도
              함께 제거됩니다.
            </p>
            <CodeBlock>
              <span className="fn">updateClients</span>(<span className="prop">clients</span>:{" "}
              <span className="type">Map</span>&lt;<span className="type">string</span>,{" "}
              <span className="type">MCPClient</span>&gt;): <span className="type">void</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                리소스 콘텐츠가 <strong>50,000자</strong>(기본값)를 초과하면 자동으로 잘리며
                <code className="text-cyan-600">[truncated]</code>가 추가됩니다.
              </li>
              <li>
                자동완성 캐시는 <strong>서버 이름 기준</strong>으로 관리됩니다. 캐시가 없는 서버는
                첫 조회 시 자동으로 <code className="text-cyan-600">discoverResources()</code>를
                호출합니다.
              </li>
              <li>
                <code className="text-cyan-600">updateClients()</code>를 호출하면 연결 해제된 서버의
                캐시가 자동으로 삭제되지만, 새로 추가된 서버의 캐시는 첫 조회 시 생성됩니다.
              </li>
              <li>
                토큰 추정은 <strong>1 토큰 ≈ 4 문자</strong> 근사값을 사용합니다. 한국어
                텍스트에서는 실제 토큰 수가 더 많을 수 있습니다.
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
              기본 사용법 &mdash; 리소스 멘션 해석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              MCPResourceResolver를 생성하고, 사용자 입력의 리소스 멘션을 해석합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">resolver</span> ={" "}
              <span className="kw">new</span> <span className="fn">MCPResourceResolver</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">resourceManager</span>,{"\n"}
              {"  "}
              <span className="prop">clients</span>: <span className="kw">new</span>{" "}
              <span className="type">Map</span>([
              {"\n"}
              {"    "}[<span className="str">&quot;postgres&quot;</span>,{" "}
              <span className="prop">pgClient</span>],
              {"\n"}
              {"    "}[<span className="str">&quot;redis&quot;</span>,{" "}
              <span className="prop">redisClient</span>],
              {"\n"}
              {"  "}]),
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 리소스 멘션 해석"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="prop">resolver</span>.
              <span className="fn">resolveAll</span>(
              <span className="str">&quot;@postgres:sql://users/schema를 보여줘&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 결과 확인"}</span>
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">result</span>.<span className="prop">contextXml</span>);
              {"\n"}
              <span className="cm">
                {
                  '// → "<mcp-resources>\\n<resource server=\\"postgres\\" uri=\\"sql://users/schema\\">\\n...\\n</resource>\\n</mcp-resources>"'
                }
              </span>
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">result</span>.<span className="prop">totalTokensEstimate</span>
              );
              {"\n"}
              <span className="cm">{"// → 1250 (추정 토큰 수)"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 연결되지 않은 서버의 리소스를 참조하면
              <code>failedResources</code>에 <code>&quot;Server is not connected&quot;</code> 에러가
              포함됩니다.
              <code>resolver.getAvailableServers()</code>로 연결된 서버 목록을 먼저 확인하세요.
            </Callout>

            {/* 자동완성 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 자동완성 제안
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              사용자가 <code className="text-cyan-600">@</code>를 입력하기 시작하면 서버와 리소스를
              제안합니다.
            </p>
            <CodeBlock>
              <span className="cm">{'// "@" 입력 → 서버 이름 제안'}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">servers</span> ={" "}
              <span className="kw">await</span> <span className="prop">resolver</span>.
              <span className="fn">getSuggestions</span>(<span className="str">&quot;@&quot;</span>
              );
              {"\n"}
              <span className="cm">
                {'// → [{ display: "@postgres:", ... }, { display: "@redis:", ... }]'}
              </span>
              {"\n"}
              {"\n"}
              <span className="cm">{'// "@post" 입력 → 접두사 필터링'}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">filtered</span> ={" "}
              <span className="kw">await</span> <span className="prop">resolver</span>.
              <span className="fn">getSuggestions</span>(
              <span className="str">&quot;@post&quot;</span>);
              {"\n"}
              <span className="cm">{'// → [{ display: "@postgres:", ... }]'}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{'// "@postgres:" 입력 → 서버의 리소스 목록'}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">resources</span> ={" "}
              <span className="kw">await</span> <span className="prop">resolver</span>.
              <span className="fn">getSuggestions</span>(
              <span className="str">&quot;@postgres:&quot;</span>);
              {"\n"}
              <span className="cm">{'// → [{ display: "@postgres:sql://users", ... }, ...]'}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>refreshCatalog()</code>를 호출하면 모든 서버의 리소스
              목록을 새로고침합니다. 서버에 리소스가 추가/삭제된 경우 자동완성 제안을 최신 상태로
              유지할 수 있습니다.
            </Callout>
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
              resolveAll() 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">resolveAll()</code>는 5단계로 실행됩니다: 멘션 파싱 →
              클라이언트 확인 → 콘텐츠 로드 → truncate → XML 생성.
            </p>

            <MermaidDiagram
              title="resolveAll() 처리 흐름"
              titleColor="purple"
              chart={`graph TD
  TEXT["입력 텍스트"] --> PARSE["1. parseMentions()<br/><small>MCPResourceManager에 위임</small>"]
  PARSE --> CHECK["2. 서버 클라이언트 확인<br/><small>clients.get(serverName)</small>"]
  CHECK -->|"클라이언트 없음"| FAIL["failedResources에 기록"]
  CHECK -->|"클라이언트 있음"| LOAD["3. readResource()<br/><small>Promise.allSettled 병렬</small>"]
  LOAD --> TRUNC["4. Truncate<br/><small>maxContentLength 초과 시 자름</small>"]
  TRUNC --> XML["5. buildContextXml()<br/><small>&lt;mcp-resources&gt; 생성</small>"]
  XML --> RESULT["ResourceResolutionResult<br/><small>+ strippedText + tokenEstimate</small>"]

  style PARSE fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style CHECK fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style LOAD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style TRUNC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style XML fill:#dcfce7,stroke:#10b981,color:#065f46
  style FAIL fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style TEXT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              캐싱 전략
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              자동완성을 위한 리소스 목록은 서버별로 캐시됩니다. Lazy 로딩 방식으로, 첫 조회 시에만
              서버에서 리소스를 디스커버합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 캐시 조회 흐름"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">cached</span> ={" "}
              <span className="kw">this</span>.<span className="prop">resourceCache</span>.
              <span className="fn">get</span>(<span className="prop">serverName</span>);
              {"\n"}
              <span className="kw">if</span> (<span className="prop">cached</span>){" "}
              <span className="kw">return</span> <span className="prop">cached</span>;{" "}
              <span className="cm">{"// 캐시 히트"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 캐시 미스 → 서버에서 조회 + 캐시 저장"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">resources</span> ={" "}
              <span className="kw">await</span> <span className="kw">this</span>.
              <span className="prop">resourceManager</span>.
              <span className="fn">discoverResources</span>(<span className="prop">client</span>,{" "}
              <span className="prop">serverName</span>);
              {"\n"}
              <span className="kw">this</span>.<span className="prop">resourceCache</span>.
              <span className="fn">set</span>(<span className="prop">serverName</span>,{" "}
              <span className="prop">suggestions</span>);
            </CodeBlock>

            <DeepDive title="stripMentions vs buildContextXml 차이">
              <p className="mb-3">두 함수는 멘션을 서로 다른 방식으로 처리합니다:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <code className="text-cyan-600">stripMentions()</code> &mdash; 텍스트에서 멘션을
                  <code className="text-cyan-600">[resource: server/uri]</code> 플레이스홀더로
                  치환합니다. 사용자에게 보여줄 깨끗한 텍스트를 만듭니다.
                </li>
                <li>
                  <code className="text-cyan-600">buildContextXml()</code> &mdash; 해석된 리소스를
                  <code className="text-cyan-600">
                    &lt;resource server=&quot;...&quot; uri=&quot;...&quot;&gt;
                  </code>
                  XML 태그로 감싸 LLM 컨텍스트에 주입합니다.
                </li>
              </ul>
              <p className="mt-3 text-gray-600">
                두 결과 모두 <code className="text-cyan-600">ResourceResolutionResult</code>에
                포함되므로 용도에 맞게 선택하여 사용할 수 있습니다.
              </p>
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

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;자동완성에 리소스가 표시되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">refreshCatalog()</code>를 호출하여 캐시를
                새로고침하세요. 서버가 연결된 후에 리소스 목록이 캐시되므로, 서버가 늦게 연결되면
                캐시가 비어 있을 수 있습니다.
                <code className="text-cyan-600">getAvailableServers()</code>로 연결 상태를
                확인하세요.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;리소스 콘텐츠가 잘려서 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                기본 최대 길이는 50,000자입니다.{" "}
                <code className="text-cyan-600">maxContentLength</code>
                설정으로 늘릴 수 있지만, 컨텍스트 윈도우 크기를 고려해야 합니다.
                <code className="text-cyan-600">truncated: true</code>인 리소스는
                <code className="text-cyan-600">originalLength</code>로 원본 크기를 확인할 수
                있습니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;서버 연결이 끊어진 후에도 캐시가 남아 있어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">updateClients()</code>를 새 클라이언트 맵과 함께
                호출하면 연결 해제된 서버의 캐시가 자동으로 제거됩니다. 서버 연결 상태가 변경될
                때마다 이 메서드를 호출하는 것이 권장됩니다.
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
                  name: "parser.ts",
                  slug: "mention-parser",
                  relation: "sibling",
                  desc: "사용자 입력에서 @file, @url, @mcp 멘션을 추출하는 파서",
                },
                {
                  name: "resolver.ts",
                  slug: "mention-resolver",
                  relation: "sibling",
                  desc: "파싱된 멘션의 실제 콘텐츠를 병렬로 로드하는 범용 리졸버",
                },
                {
                  name: "mcp-manager.ts",
                  slug: "mcp-manager",
                  relation: "parent",
                  desc: "MCP 서버 연결 관리 및 클라이언트 라이프사이클",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
