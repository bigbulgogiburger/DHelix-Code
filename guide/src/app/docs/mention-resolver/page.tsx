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

export default function MentionResolverPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/mentions/resolver.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Mention Resolver</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              파싱된 @멘션의 실제 콘텐츠를 파일 시스템, HTTP, MCP를 통해 병렬로 로드하는
              리졸버입니다.
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
                <code className="text-cyan-600">resolveMentions()</code>는 파서가 추출한 멘션을
                실제로 해석(resolve)하여 콘텐츠를 가져옵니다.{" "}
                <code className="text-cyan-600">@file</code> 멘션은 파일 시스템에서 읽고,
                <code className="text-cyan-600">@url</code> 멘션은 HTTP GET으로 가져오며,
                <code className="text-cyan-600">@mcp</code> 멘션은 MCP 클라이언트를 통해 조회합니다.
              </p>
              <p>
                모든 멘션은 <code className="text-cyan-600">Promise.all</code>로{" "}
                <strong>병렬</strong> 해석됩니다. 해석 실패는 에러를 던지지 않고, 결과에 실패 정보(
                <code className="text-cyan-600">success: false</code>)를 포함합니다. 이를 통해 일부
                멘션 실패가 전체 프로세스를 중단하지 않습니다.
              </p>
              <p>
                <code className="text-cyan-600">buildMentionContext()</code>는 해석 결과를
                <code className="text-cyan-600">&lt;referenced-content&gt;</code> 태그로 감싸 LLM
                컨텍스트에 주입할 수 있는 문자열로 조합합니다.
              </p>
            </div>

            <MermaidDiagram
              title="Mention Resolver 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  PARSER["parseMentions()<br/><small>mentions/parser.ts</small>"]
  RESOLVER["resolveMentions()<br/><small>mentions/resolver.ts</small>"]
  FILE["resolveFileMention()<br/><small>fs.readFile()</small>"]
  URL["resolveUrlMention()<br/><small>fetch() + 15s timeout</small>"]
  MCP["resolveMcpMention()<br/><small>MCP 클라이언트</small>"]
  BUILD["buildMentionContext()<br/><small>XML 문자열 생성</small>"]

  PARSER -->|"ParsedMention[]"| RESOLVER
  RESOLVER -->|"Promise.all"| FILE
  RESOLVER -->|"Promise.all"| URL
  RESOLVER -->|"Promise.all"| MCP
  FILE --> BUILD
  URL --> BUILD
  MCP --> BUILD

  style RESOLVER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PARSER fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style FILE fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style URL fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style MCP fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style BUILD fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 파서가 주소록에서 이름을 찾는 것이라면, 리졸버는 실제로 그
              주소를 방문하여 내용물을 가져오는 배달부입니다. 세 명의 배달부(파일, URL, MCP)가
              동시에 출발하여 병렬로 내용을 수집합니다.
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

            {/* ResolvedMention interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ResolvedMention
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              해석된 멘션 &mdash; 원본 멘션 정보와 로드된 콘텐츠를 함께 담고 있습니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "mention",
                  type: "ParsedMention",
                  required: true,
                  desc: "원본 파싱된 멘션 정보",
                },
                {
                  name: "content",
                  type: "string",
                  required: true,
                  desc: "해석된 콘텐츠 (파일 내용, URL 응답 본문, MCP 리소스)",
                },
                { name: "success", type: "boolean", required: true, desc: "해석 성공 여부" },
                {
                  name: "error",
                  type: "string | undefined",
                  required: false,
                  desc: "해석 실패 시 에러 메시지",
                },
              ]}
            />

            {/* MentionResolverOptions interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface MentionResolverOptions
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              멘션 해석에 필요한 설정 옵션입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "workingDirectory",
                  type: "string",
                  required: true,
                  desc: "파일 해석 시 상대 경로의 기준 디렉토리",
                },
                {
                  name: "mcpResolver",
                  type: "(server, uri) => Promise<string>",
                  required: false,
                  desc: "MCP 리소스 해석 함수 (서버이름, URI) → 콘텐츠",
                },
              ]}
            />

            {/* resolveMentions function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              resolveMentions(mentions, options)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              모든 멘션을 병렬로 해석합니다. 실패한 해석은 에러를 던지지 않고 결과에 실패 정보를
              포함합니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span> <span className="fn">resolveMentions</span>
              ({"\n"}
              {"  "}
              <span className="prop">mentions</span>: <span className="kw">readonly</span>{" "}
              <span className="type">ParsedMention</span>[],
              {"\n"}
              {"  "}
              <span className="prop">options</span>:{" "}
              <span className="type">MentionResolverOptions</span>,{"\n"}):{" "}
              <span className="type">Promise</span>&lt;<span className="kw">readonly</span>{" "}
              <span className="type">ResolvedMention</span>[]&gt;
            </CodeBlock>

            {/* buildMentionContext function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              buildMentionContext(resolved)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              해석된 멘션들을 <code className="text-cyan-600">&lt;referenced-content&gt;</code>{" "}
              태그로 감싼 컨텍스트 주입용 문자열로 결합합니다. 성공한 해석만 포함합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">buildMentionContext</span>(
              {"\n"}
              {"  "}
              <span className="prop">resolved</span>: <span className="kw">readonly</span>{" "}
              <span className="type">ResolvedMention</span>[],
              {"\n"}): <span className="type">string</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                URL 해석에는 <strong>15초 타임아웃</strong>이 설정되어 있습니다.
                <code className="text-cyan-600">AbortController</code>로 관리되며, 초과 시 실패로
                처리됩니다.
              </li>
              <li>
                URL 응답이 <strong>50,000자</strong>를 초과하면 자동으로 잘리고(truncate)
                <code className="text-cyan-600">[truncated]</code> 태그가 추가됩니다. 컨텍스트
                윈도우 보호를 위함입니다.
              </li>
              <li>
                MCP 해석은 <code className="text-cyan-600">mcpResolver</code> 함수가 제공되지 않으면
                항상 실패(<code className="text-cyan-600">success: false</code>)로 처리됩니다.
              </li>
              <li>
                파일 해석에서 절대 경로는 그대로 사용되고, 상대 경로는
                <code className="text-cyan-600">workingDirectory</code> 기준으로 해석됩니다.
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
              기본 사용법 &mdash; 파싱 + 해석 + 컨텍스트 빌드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              멘션 시스템의 전체 파이프라인입니다: 파싱 → 해석 → 컨텍스트 생성.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{ "}
              <span className="fn">parseMentions</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./mentions/parser.js&quot;</span>;{"\n"}
              <span className="kw">import</span> {"{ "}
              <span className="fn">resolveMentions</span>,{" "}
              <span className="fn">buildMentionContext</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./mentions/resolver.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 1. 멘션 파싱"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">mentions</span> ={" "}
              <span className="fn">parseMentions</span>(<span className="prop">userInput</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 멘션 해석 (파일/URL/MCP 병렬 로드)"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">resolved</span> ={" "}
              <span className="kw">await</span> <span className="fn">resolveMentions</span>(
              <span className="prop">mentions</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">workingDirectory</span>: <span className="fn">process</span>.
              <span className="fn">cwd</span>(),
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. LLM 컨텍스트용 문자열 생성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">context</span> ={" "}
              <span className="fn">buildMentionContext</span>(<span className="prop">resolved</span>
              );
              {"\n"}
              <span className="cm">
                {'// → "<referenced-content>\\n--- src/index.ts ---\\n...\\n</referenced-content>"'}
              </span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>resolveMentions()</code>는 실패해도 에러를 throw하지
              않습니다. 반드시 <code>success</code> 필드를 확인하여 실패한 멘션을 처리하세요.
            </Callout>

            {/* MCP 해석 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; MCP 리졸버 연결
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              MCP 멘션을 해석하려면 <code className="text-cyan-600">mcpResolver</code> 함수를
              제공해야 합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">resolved</span> ={" "}
              <span className="kw">await</span> <span className="fn">resolveMentions</span>(
              <span className="prop">mentions</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">workingDirectory</span>: <span className="fn">process</span>.
              <span className="fn">cwd</span>(),
              {"\n"}
              {"  "}
              <span className="prop">mcpResolver</span>: <span className="kw">async</span> (
              <span className="prop">server</span>, <span className="prop">uri</span>) {"=>"} {"{"}
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">client</span> ={" "}
              <span className="prop">mcpClients</span>.<span className="fn">get</span>(
              <span className="prop">server</span>);
              {"\n"}
              {"    "}
              <span className="kw">if</span> (!<span className="prop">client</span>){" "}
              <span className="kw">throw new</span> <span className="type">Error</span>(
              <span className="str">
                `Unknown server: ${"{"}server{"}"}`
              </span>
              );
              {"\n"}
              {"    "}
              <span className="kw">return</span> <span className="prop">client</span>.
              <span className="fn">readResource</span>(<span className="prop">uri</span>);
              {"\n"}
              {"  "}
              {"}"}
              {","}
              {"\n"}
              {"}"});
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>buildMentionContext()</code>는 성공한 해석만 포함하므로,
              실패한 멘션은 자동으로 컨텍스트에서 제외됩니다. 실패 정보는{" "}
              <code>resolved.filter(r =&gt; !r.success)</code>로 확인할 수 있습니다.
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
              해석 분배 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">resolveMentions()</code>는 멘션 타입에 따라 적절한
              해석 함수로 분배하고, <code className="text-cyan-600">Promise.all</code>로 병렬
              실행합니다.
            </p>

            <MermaidDiagram
              title="멘션 타입별 해석 분배"
              titleColor="purple"
              chart={`graph TD
  RESOLVE["resolveMentions()"]
  SWITCH{"mention.type?"}
  FILE["resolveFileMention()<br/><small>readFile() + 경로 해석</small>"]
  URL["resolveUrlMention()<br/><small>fetch() + 15s timeout</small><br/><small>50,000자 truncate</small>"]
  MCP["resolveMcpMention()<br/><small>mcpResolver 호출</small><br/><small>없으면 실패 반환</small>"]
  RESULT["ResolvedMention[]<br/><small>success/error 포함</small>"]

  RESOLVE --> SWITCH
  SWITCH -->|"file"| FILE
  SWITCH -->|"url"| URL
  SWITCH -->|"mcp"| MCP
  FILE --> RESULT
  URL --> RESULT
  MCP --> RESULT

  style RESOLVE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style SWITCH fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style FILE fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style URL fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style MCP fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              에러 처리 전략
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              각 해석 함수는 try-catch로 에러를 포착하여{" "}
              <code className="text-cyan-600">success: false</code>와 에러 메시지를 반환합니다. 이
              방식으로 하나의 실패가 다른 멘션 해석에 영향을 주지 않습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 각 해석 함수의 에러 처리 패턴"}</span>
              {"\n"}
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">content</span> ={" "}
              <span className="kw">await</span> <span className="fn">readFile</span>(
              <span className="prop">filePath</span>, <span className="str">&quot;utf-8&quot;</span>
              );
              {"\n"}
              {"  "}
              <span className="kw">return</span> {"{"} <span className="prop">mention</span>,{" "}
              <span className="prop">content</span>:{" "}
              <span className="str">
                `--- ${"{"}mention.value{"}"} ---\n${"{"}content{"}"}`
              </span>
              , <span className="prop">success</span>: <span className="num">true</span> {"}"};
              {"\n"}
              {"}"} <span className="kw">catch</span> (<span className="prop">error</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> {"{"} <span className="prop">mention</span>,{" "}
              <span className="prop">content</span>: <span className="str">&quot;&quot;</span>,{" "}
              <span className="prop">success</span>: <span className="num">false</span>,{" "}
              <span className="prop">error</span>: <span className="str">`Failed: ...`</span> {"}"};
              {"\n"}
              {"}"}
            </CodeBlock>

            <DeepDive title="URL 해석의 보안 고려사항">
              <p className="mb-3">
                URL 해석 시 <code className="text-cyan-600">User-Agent: dbcode/0.1.0</code> 헤더가
                설정됩니다. 이는 서버 측에서 봇 트래픽을 식별할 수 있게 합니다.
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>15초 타임아웃으로 느린 서버로 인한 블로킹 방지</li>
                <li>50,000자 제한으로 거대한 응답에 의한 컨텍스트 윈도우 오버플로 방지</li>
                <li>
                  HTTP 에러 응답(4xx, 5xx)은 <code className="text-cyan-600">success: false</code>로
                  처리
                </li>
              </ul>
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
                &quot;파일 멘션이 실패해요 — Failed to read file&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                상대 경로가 <code className="text-cyan-600">workingDirectory</code> 기준으로
                해석됩니다. 프로젝트 루트가 아닌 다른 디렉토리에서 실행하면 파일을 찾지 못할 수
                있습니다.
                <code className="text-cyan-600">process.cwd()</code> 대신 프로젝트 루트 경로를
                명시적으로 전달하세요.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;URL 멘션 결과가 [truncated]로 끝나요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                이는 정상 동작입니다. 50,000자를 초과하는 응답은 컨텍스트 윈도우 보호를 위해
                자동으로 잘립니다. 필요한 정보가 잘리는 경우, 더 구체적인 URL(API 엔드포인트 등)을
                사용하는 것을 권장합니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;MCP 멘션이 항상 실패해요 — MCP resolution not available&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">mcpResolver</code> 함수가 옵션에 제공되지 않으면 MCP
                멘션은 항상 실패합니다. MCP 서버가 연결되어 있는지 확인하고,
                <code className="text-cyan-600">MentionResolverOptions.mcpResolver</code>에 적절한
                함수를 전달하세요.
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
                  name: "resource-resolver.ts",
                  slug: "resource-resolver",
                  relation: "sibling",
                  desc: "MCP 리소스 전용 리졸버 — 자동완성과 캐싱 지원",
                },
                {
                  name: "context-manager.ts",
                  slug: "context-manager",
                  relation: "parent",
                  desc: "해석된 멘션 콘텐츠를 포함한 전체 컨텍스트 윈도우 관리",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
