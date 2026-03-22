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

export default function ToolWebSearchPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/tools/definitions/web-search.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              web_search
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
            <span className="text-sm text-gray-500">웹 검색 도구</span>
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            실시간 웹 검색을 수행하여 제목, URL, 스니펫을 반환하는 도구입니다.
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
              <code className="text-cyan-600">web_search</code>는 에이전트가 실시간 웹 정보를 검색할 수 있게 해주는
              도구입니다. 두 가지 검색 엔진을 지원하며, 환경변수에 따라 자동으로 선택됩니다.
            </p>
            <p>
              <code className="text-cyan-600">BRAVE_SEARCH_API_KEY</code> 환경변수가 설정되어 있으면
              <strong> Brave Search API</strong>(공식 JSON API)를 사용하고, 설정되어 있지 않으면
              <strong> DuckDuckGo</strong>(HTML 파싱 폴백)를 사용합니다.
            </p>
            <p>
              권한 수준은 <code className="text-emerald-600">&quot;safe&quot;</code>입니다.
              검색만 수행하고 시스템을 변경하지 않으므로, 사용자 확인 없이 즉시 실행됩니다.
              10초 타임아웃이 설정되어 있어 느린 검색 응답에 대비합니다.
            </p>
          </div>

          <MermaidDiagram
            title="web_search 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  EXEC["Tool Executor<br/><small>tools/executor.ts</small>"]
  WS["web_search<br/><small>definitions/web-search.ts</small>"]
  BRAVE["Brave Search API<br/><small>api.search.brave.com</small>"]
  DDG["DuckDuckGo HTML<br/><small>html.duckduckgo.com</small>"]

  AGENT -->|"도구 호출"| EXEC
  EXEC -->|"execute()"| WS
  WS -->|"API 키 있으면"| BRAVE
  WS -->|"API 키 없으면"| DDG

  style WS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style BRAVE fill:#dcfce7,stroke:#10b981,color:#065f46
  style DDG fill:#fef3c7,stroke:#f59e0b,color:#78350f`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 도서관에서 사서에게 책을 찾아달라고 요청하는 것과 같습니다.
            Brave Search는 전문 사서(공식 API)이고, DuckDuckGo는 스스로 서가를 뒤지는 방식(HTML 파싱)입니다.
            전문 사서가 있으면 먼저 활용하고, 없으면 직접 찾습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* paramSchema */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            paramSchema (Zod)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            검색 쿼리와 최대 결과 수를 정의하는 입력 매개변수 스키마입니다.
          </p>
          <ParamTable
            params={[
              { name: "query", type: "string", required: true, desc: "검색할 쿼리 문자열" },
              { name: "max_results", type: "number (1-10)", required: false, desc: "최대 결과 수 (기본값: 5). 1~10 범위의 정수" },
            ]}
          />

          {/* SearchResult interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface SearchResult
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            단일 검색 결과를 나타내는 내부 인터페이스입니다. 모든 프로퍼티가 <code className="text-cyan-600">readonly</code>입니다.
          </p>
          <ParamTable
            params={[
              { name: "title", type: "string", required: true, desc: "검색 결과 제목" },
              { name: "url", type: "string", required: true, desc: "결과 페이지 URL" },
              { name: "snippet", type: "string", required: true, desc: "검색 결과 요약(스니펫)" },
            ]}
          />

          {/* ToolDefinition export */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            webSearchTool (ToolDefinition)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            도구 레지스트리에 등록되는 최종 도구 정의 객체입니다.
          </p>
          <ParamTable
            params={[
              { name: "name", type: '"web_search"', required: true, desc: "도구 이름 식별자" },
              { name: "permissionLevel", type: '"safe"', required: true, desc: "안전 등급 — 사용자 확인 없이 실행" },
              { name: "timeoutMs", type: "10_000", required: true, desc: "10초 타임아웃" },
            ]}
          />

          {/* 핵심 함수들 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            내부 함수
          </h3>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            searchBrave(query, maxResults, apiKey, signal)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            Brave Search REST API에 요청을 보내고 JSON 형식의 검색 결과를 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">searchBrave</span>(
            {"\n"}{"  "}<span className="prop">query</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">maxResults</span>: <span className="type">number</span>,
            {"\n"}{"  "}<span className="prop">apiKey</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">signal</span>: <span className="type">AbortSignal</span>,
            {"\n"}): <span className="type">Promise</span>&lt;<span className="type">readonly SearchResult[]</span>&gt;
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            searchDuckDuckGo(query, maxResults, signal)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            DuckDuckGo HTML 페이지를 파싱하여 검색 결과를 추출합니다. API 키가 필요 없습니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">searchDuckDuckGo</span>(
            {"\n"}{"  "}<span className="prop">query</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">maxResults</span>: <span className="type">number</span>,
            {"\n"}{"  "}<span className="prop">signal</span>: <span className="type">AbortSignal</span>,
            {"\n"}): <span className="type">Promise</span>&lt;<span className="type">readonly SearchResult[]</span>&gt;
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            formatResults(query, results)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            검색 결과를 마크다운 형식의 문자열로 변환합니다. 번호 매기기와 마크다운 링크를 포함합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">formatResults</span>(
            {"\n"}{"  "}<span className="prop">query</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">results</span>: <span className="type">readonly SearchResult[]</span>,
            {"\n"}): <span className="type">string</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              DuckDuckGo 검색은 HTML 파싱에 의존하므로, DuckDuckGo의 UI가 변경되면 결과 추출이 실패할 수 있습니다.
              이 경우 정규식 패턴을 업데이트해야 합니다.
            </li>
            <li>
              Brave Search API를 사용하려면 <code className="text-cyan-600">BRAVE_SEARCH_API_KEY</code> 환경변수를
              설정해야 합니다. API 키는 <code className="text-cyan-600">https://brave.com/search/api/</code>에서 발급받을 수 있습니다.
            </li>
            <li>
              10초 타임아웃이 초과하면 <code className="text-cyan-600">AbortError</code>가 발생하고,
              &quot;Search timed out&quot; 메시지가 반환됩니다.
            </li>
            <li>
              DuckDuckGo URL은 <code className="text-cyan-600">uddg</code> 리다이렉트 파라미터로 감싸져 있으므로,
              도구 내부에서 실제 URL을 자동 추출합니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; LLM이 웹 검색을 호출하는 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            에이전트 루프에서 LLM이 최신 정보가 필요할 때 이 도구를 호출합니다.
            결과는 마크다운 형식으로 반환되어 LLM이 바로 해석할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// LLM이 호출하는 도구 매개변수 예시"}</span>
            {"\n"}{"{"}
            {"\n"}{"  "}<span className="prop">query</span>: <span className="str">&quot;TypeScript 5.5 new features&quot;</span>,
            {"\n"}{"  "}<span className="prop">max_results</span>: <span className="num">5</span>
            {"\n"}{"}"}
          </CodeBlock>

          <p className="text-[13px] text-gray-600 mb-4 mt-4 leading-relaxed">
            반환되는 결과 형식:
          </p>
          <CodeBlock>
            <span className="str">Web search results for &quot;TypeScript 5.5 new features&quot;:</span>
            {"\n"}
            {"\n"}<span className="str">1. [TypeScript 5.5 Release Notes](https://...)</span>
            {"\n"}<span className="str">{"   "}TypeScript 5.5 introduces inferred type predicates...</span>
            {"\n"}
            {"\n"}<span className="str">2. [What&apos;s New in TypeScript 5.5](https://...)</span>
            {"\n"}<span className="str">{"   "}Key features include isolated declarations...</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> 검색 결과의 정확성은 검색 엔진에 의존합니다.
            DuckDuckGo 폴백은 HTML 파싱이므로 UI 변경 시 빈 결과가 반환될 수 있습니다.
            프로덕션 환경에서는 <code>BRAVE_SEARCH_API_KEY</code>를 설정하는 것을 권장합니다.
          </Callout>

          {/* 고급: 환경변수 설정 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; Brave Search API 키 설정
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            Brave Search API를 사용하면 공식 JSON API를 통해 더 안정적이고 정확한 결과를 얻을 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// .env 파일 또는 셸 환경변수"}</span>
            {"\n"}<span className="prop">BRAVE_SEARCH_API_KEY</span>=<span className="str">BSA-xxxxxxxxxxxxxxxx</span>
          </CodeBlock>

          <DeepDive title="검색 엔진 선택 로직 상세">
            <p className="mb-3">
              <code className="text-cyan-600">execute()</code> 함수는 실행 시점에
              <code className="text-cyan-600">process.env.BRAVE_SEARCH_API_KEY</code>를 확인합니다.
              값이 존재하면 Brave Search를, 없으면 DuckDuckGo를 사용합니다.
            </p>
            <p className="text-gray-600">
              반환되는 <code className="text-cyan-600">metadata.engine</code> 필드에
              실제 사용된 검색 엔진 이름(&quot;Brave Search&quot; 또는 &quot;DuckDuckGo&quot;)이 포함됩니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>실행 흐름 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">execute()</code> 함수가 호출되면, 환경변수를 확인하고
            적절한 검색 엔진을 선택한 뒤, 결과를 마크다운으로 변환하여 반환합니다.
          </p>

          <MermaidDiagram
            title="web_search 실행 흐름"
            titleColor="purple"
            chart={`graph TD
  START(("execute()")) --> TIMER["AbortController 생성<br/><small>10초 타임아웃</small>"]
  TIMER --> CHECK{"BRAVE_SEARCH_API_KEY<br/>존재 여부"}
  CHECK -->|"있음"| BRAVE["searchBrave()<br/><small>REST API 호출</small>"]
  CHECK -->|"없음"| DDG["searchDuckDuckGo()<br/><small>HTML 파싱</small>"]
  BRAVE --> FORMAT["formatResults()<br/><small>마크다운 변환</small>"]
  DDG --> FORMAT
  FORMAT --> RESULT["ToolResult 반환<br/><small>output + metadata</small>"]
  TIMER -->|"10초 초과"| TIMEOUT["AbortError<br/><small>타임아웃 메시지</small>"]

  style START fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CHECK fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style BRAVE fill:#dcfce7,stroke:#10b981,color:#065f46
  style DDG fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style FORMAT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46
  style TIMEOUT fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">execute()</code> 함수의 타임아웃 관리 및 검색 엔진 분기 로직입니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">execute</span>(<span className="prop">params</span>: <span className="type">Params</span>, <span className="prop">context</span>: <span className="type">ToolContext</span>): <span className="type">Promise</span>&lt;<span className="type">ToolResult</span>&gt; {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] 독립적인 취소 제어기 생성 (10초 타임아웃)"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">controller</span> = <span className="kw">new</span> <span className="fn">AbortController</span>();
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">timeout</span> = <span className="fn">setTimeout</span>(() =&gt; <span className="prop">controller</span>.<span className="fn">abort</span>(), <span className="num">10_000</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 부모 취소 신호와 연결"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">onParentAbort</span> = () =&gt; <span className="prop">controller</span>.<span className="fn">abort</span>();
            {"\n"}{"  "}<span className="prop">context</span>.<span className="prop">abortSignal</span>.<span className="fn">addEventListener</span>(<span className="str">&quot;abort&quot;</span>, <span className="prop">onParentAbort</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 환경변수에서 API 키 확인"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">braveApiKey</span> = <span className="prop">process</span>.<span className="prop">env</span>.<span className="prop">BRAVE_SEARCH_API_KEY</span>;
            {"\n"}
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">braveApiKey</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// [4] Brave Search API 사용"}</span>
            {"\n"}{"    "}<span className="prop">results</span> = <span className="kw">await</span> <span className="fn">searchBrave</span>(<span className="prop">params</span>.<span className="prop">query</span>, ...);
            {"\n"}{"  "}<span className="kw">{"}"} else {"{"}</span>
            {"\n"}{"    "}<span className="cm">{"// [5] DuckDuckGo 폴백"}</span>
            {"\n"}{"    "}<span className="prop">results</span> = <span className="kw">await</span> <span className="fn">searchDuckDuckGo</span>(<span className="prop">params</span>.<span className="prop">query</span>, ...);
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 독립적인 AbortController를 생성하여 10초 후 자동 취소합니다. 검색이 오래 걸리면 타임아웃으로 중단됩니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 부모의 취소 신호(사용자 Esc)와 연결하여, 사용자가 취소하면 검색도 즉시 중단됩니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 환경변수에서 Brave Search API 키를 확인합니다. 런타임에 매번 확인하므로 동적으로 전환 가능합니다.</p>
            <p><strong className="text-gray-900">[4-5]</strong> API 키가 있으면 Brave Search를, 없으면 DuckDuckGo를 사용합니다. finally 블록에서 타이머와 이벤트 리스너를 정리합니다.</p>
          </div>

          <DeepDive title="DuckDuckGo HTML 파싱 상세">
            <p className="mb-3">
              DuckDuckGo 검색은 <code className="text-cyan-600">html.duckduckgo.com</code>에 POST 요청을 보내고,
              응답 HTML에서 정규식으로 검색 결과를 추출합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// HTML에서 결과를 추출하는 정규식 패턴"}</span>
              {"\n"}<span className="kw">const</span> <span className="prop">resultPattern</span> =
              {"\n"}{"  "}<span className="str">/<span className="cm">&lt;a class=&quot;result__a&quot; href=&quot;(URL)&quot;&gt;</span></span>
              {"\n"}{"  "}<span className="str"><span className="cm">(제목)&lt;/a&gt; ... &lt;a class=&quot;result__snippet&quot;&gt;(스니펫)&lt;/a&gt;</span>/g</span>;
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              URL은 DuckDuckGo의 리다이렉트(<code className="text-cyan-600">uddg</code> 파라미터)로 감싸져 있으므로,
              <code className="text-cyan-600">decodeURIComponent()</code>로 실제 URL을 추출합니다.
              HTML 엔티티도 <code className="text-cyan-600">decodeHtmlEntities()</code>로 디코딩합니다.
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
              &quot;검색 결과가 비어 있어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              두 가지 원인이 있을 수 있습니다:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>DuckDuckGo UI 변경:</strong> DuckDuckGo의 HTML 구조가 변경되면 정규식 패턴이 더 이상
                매칭되지 않을 수 있습니다. <code className="text-cyan-600">resultPattern</code> 정규식을 업데이트하세요.
              </li>
              <li>
                <strong>네트워크 문제:</strong> 10초 타임아웃 내에 응답을 받지 못하면 &quot;Search timed out&quot;
                에러가 반환됩니다.
              </li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Brave Search API 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">BRAVE_SEARCH_API_KEY</code>가 올바른지 확인하세요.
              잘못된 키를 사용하면 <code className="text-cyan-600">401 Unauthorized</code> 또는
              <code className="text-cyan-600">403 Forbidden</code> 에러가 발생합니다.
            </p>
            <Callout type="tip" icon="*">
              API 키가 만료되었거나 요청 한도를 초과했을 수 있습니다.
              Brave Search 대시보드에서 사용량을 확인하세요.
            </Callout>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;DuckDuckGo 결과의 URL이 이상해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              DuckDuckGo는 검색 결과 URL을 자체 리다이렉트로 감싸서 반환합니다.
              도구 내부에서 <code className="text-cyan-600">uddg</code> 파라미터를 파싱하여 실제 URL을 추출하지만,
              이 패턴이 변경되면 리다이렉트 URL이 그대로 노출될 수 있습니다.
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
                name: "web-fetch.ts",
                slug: "tool-web-fetch",
                relation: "sibling",
                desc: "검색 결과 URL의 콘텐츠를 실제로 가져오는 도구 — web_search와 함께 사용",
              },
              {
                name: "tool-registry.ts",
                slug: "tool-registry",
                relation: "parent",
                desc: "web_search를 포함한 모든 도구를 등록하고 관리하는 레지스트리",
              },
              {
                name: "permission-manager.ts",
                slug: "permission-manager",
                relation: "sibling",
                desc: "도구의 권한 수준(safe/confirm/danger)을 관리하는 모듈",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
