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

export default function MCPToolSearchPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/mcp/tool-search.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">MCPToolSearch</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              대규모 MCP 도구 세트를 위한 지연 로딩(deferred) 검색 모듈입니다.
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
                <code className="text-cyan-600">MCPToolSearch</code>는 MCP 서버가 많은 도구를 제공할
                때 LLM 컨텍스트 토큰을 절약하기 위한 &quot;지연 로딩(deferred loading)&quot; 패턴을
                구현합니다. 모든 도구의 전체 스키마를 한꺼번에 로딩하는 대신, 이름과 설명만 초기
                저장하고 필요할 때 전체 스키마를 검색(resolve)합니다.
              </p>
              <p>
                두 가지 검색 방식을 지원합니다: (1){" "}
                <code className="text-cyan-600">&quot;select:Name1,Name2&quot;</code> 구문으로
                정확한 이름 매칭, (2) 자유 텍스트로 이름/설명 기반 퍼지 매칭. 퍼지 매칭은 관련도
                점수(0~1)를 계산하여 가장 관련 있는 도구를 우선 반환합니다.
              </p>
              <p>
                시스템 프롬프트에는 도구 이름 목록만 주입하여 토큰을 절약하고, LLM이 필요한 도구를
                선택하면 그때 전체 스키마를 로딩합니다.
              </p>
            </div>

            <MermaidDiagram
              title="MCPToolSearch 지연 로딩 흐름"
              titleColor="purple"
              chart={`graph TD
  SERVER["MCP 서버<br/><small>많은 도구 제공</small>"]
  REG["registerDeferredTools()<br/><small>이름+설명만 저장</small>"]
  DEFERRED["Deferred Tools Map<br/><small>이름, 설명 (경량)</small>"]
  CACHE["Full Tool Cache<br/><small>전체 스키마 (캐시)</small>"]
  PROMPT["시스템 프롬프트<br/><small>도구 이름 목록만 주입</small>"]
  LLM["LLM<br/><small>필요한 도구 선택</small>"]
  SEARCH["search() / resolveByNames()<br/><small>전체 스키마 반환</small>"]

  SERVER -->|"listTools()"| REG
  REG --> DEFERRED
  REG --> CACHE
  DEFERRED -->|"generateDeferredToolsSummary()"| PROMPT
  PROMPT --> LLM
  LLM -->|"ToolSearch 요청"| SEARCH
  CACHE -->|"전체 스키마"| SEARCH

  style REG fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style DEFERRED fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CACHE fill:#dcfce7,stroke:#10b981,color:#065f46
  style PROMPT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SEARCH fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style SERVER fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> MCPToolSearch는 도서관의 &quot;카탈로그&quot;와 같습니다.
              도서관의 모든 책을 한꺼번에 책상에 펼쳐놓는 대신, 카탈로그(이름 목록)만 보여주고
              필요한 책을 선택하면 그때 서고에서 가져옵니다 (전체 스키마 로딩).
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

            {/* DeferredTool interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface DeferredTool
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              지연 로딩 도구 항목입니다. 이름과 설명만 저장하여 토큰을 절약합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "name",
                  type: "string",
                  required: true,
                  desc: "도구의 원래 이름 (서버 측)",
                },
                {
                  name: "namespacedName",
                  type: "string",
                  required: true,
                  desc: "네임스페이싱된 이름: mcp__서버이름__도구이름",
                },
                { name: "description", type: "string", required: true, desc: "도구 설명" },
                {
                  name: "serverName",
                  type: "string",
                  required: true,
                  desc: "도구를 제공하는 서버 이름",
                },
              ]}
            />

            {/* ToolSearchResult interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ToolSearchResult
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              도구 검색 결과입니다. 전체 도구 정의와 관련도 점수를 포함합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "tool",
                  type: "MCPToolDefinition",
                  required: true,
                  desc: "전체 MCP 도구 정의 (스키마 포함)",
                },
                { name: "serverName", type: "string", required: true, desc: "서버 이름" },
                {
                  name: "namespacedName",
                  type: "string",
                  required: true,
                  desc: "네임스페이싱된 도구 이름",
                },
                {
                  name: "score",
                  type: "number",
                  required: true,
                  desc: "관련도 점수 (0~1) — 1에 가까울수록 관련성 높음",
                },
              ]}
            />

            {/* MCPToolSearch class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class MCPToolSearch
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              대규모 MCP 도구 세트를 위한 지연 로딩 관리자입니다.
            </p>

            {/* registerDeferredTools */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              registerDeferredTools(client, serverName)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              서버의 도구를 지연 로딩 형태로 등록합니다. 이름과 설명만 deferredTools에, 전체
              스키마는 fullToolCache에 저장합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">registerDeferredTools</span>(
              <span className="prop">client</span>:{" "}
              <span className="type">ToolSearchableClient</span>,{" "}
              <span className="prop">serverName</span>: <span className="type">string</span>):{" "}
              <span className="type">
                Promise{"<"}readonly DeferredTool[]{">"}
              </span>
            </CodeBlock>

            {/* search */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              search(query, maxResults?)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              쿼리 문자열로 도구를 검색합니다.
              <code className="text-cyan-600">&quot;select:Name1,Name2&quot;</code> 또는 자유
              텍스트를 지원합니다.
            </p>
            <CodeBlock>
              <span className="fn">search</span>(<span className="prop">query</span>:{" "}
              <span className="type">string</span>, <span className="prop">maxResults</span>?:{" "}
              <span className="type">number</span>):{" "}
              <span className="type">readonly ToolSearchResult[]</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "query",
                  type: "string",
                  required: true,
                  desc: '검색 쿼리 ("select:Name" 또는 자유 텍스트)',
                },
                {
                  name: "maxResults",
                  type: "number",
                  required: false,
                  desc: "최대 결과 수 (기본: 5)",
                },
              ]}
            />

            {/* resolveByNames */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">resolveByNames(names)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              정확한 이름 매칭으로 도구 정의를 조회합니다. 일반 이름과 네임스페이싱된 이름 모두
              지원합니다.
            </p>
            <CodeBlock>
              <span className="fn">resolveByNames</span>(<span className="prop">names</span>:{" "}
              <span className="type">readonly string[]</span>):{" "}
              <span className="type">readonly ToolSearchResult[]</span>
            </CodeBlock>

            {/* getToolDefinition */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              getToolDefinition(namespacedName)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              네임스페이싱된 이름으로 특정 도구의 전체 정의를 조회합니다.
            </p>
            <CodeBlock>
              <span className="fn">getToolDefinition</span>(
              <span className="prop">namespacedName</span>: <span className="type">string</span>):{" "}
              <span className="type">ToolSearchResult | undefined</span>
            </CodeBlock>

            {/* generateDeferredToolsSummary */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              generateDeferredToolsSummary()
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              시스템 프롬프트에 주입할 지연 도구 요약을 생성합니다. XML 태그로 감싼 도구 이름 목록을
              반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">generateDeferredToolsSummary</span>():{" "}
              <span className="type">string</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 예시:"}</span>
              {"\n"}
              <span className="cm">{"// <available-deferred-tools>"}</span>
              {"\n"}
              <span className="cm">{"// mcp__github__create_issue"}</span>
              {"\n"}
              <span className="cm">{"// mcp__github__search"}</span>
              {"\n"}
              <span className="cm">{"// </available-deferred-tools>"}</span>
            </CodeBlock>

            {/* estimateTokens / size / has / clear */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              estimateTokens() / size / has(name) / clear()
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">유틸리티 메서드들입니다.</p>
            <CodeBlock>
              <span className="fn">estimateTokens</span>(): <span className="type">number</span>{" "}
              <span className="cm">{"// 토큰 사용량 추정 (4자 = 1토큰)"}</span>
              {"\n"}
              <span className="kw">get</span> <span className="prop">size</span>:{" "}
              <span className="type">number</span>{" "}
              <span className="cm">{"// 지연 도구 총 수"}</span>
              {"\n"}
              <span className="fn">has</span>(<span className="prop">name</span>:{" "}
              <span className="type">string</span>): <span className="type">boolean</span>{" "}
              <span className="cm">{"// 도구 존재 여부"}</span>
              {"\n"}
              <span className="fn">clear</span>(): <span className="type">void</span>{" "}
              <span className="cm">{"// 전체 초기화"}</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                빈 쿼리 문자열로 <code className="text-cyan-600">search()</code>를 호출하면 빈
                배열을 반환합니다.
              </li>
              <li>
                <code className="text-cyan-600">resolveByNames()</code>에서 알 수 없는 이름은 조용히
                건너뜁니다. 에러를 던지지 않습니다.
              </li>
              <li>
                토큰 추정은 <strong>4문자 = 1토큰</strong> 근사치를 사용합니다. 실제 토큰 수와
                차이가 있을 수 있습니다.
              </li>
              <li>
                <code className="text-cyan-600">generateDeferredToolsSummary()</code>는 도구가
                없으면 빈 문자열을 반환합니다.
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
              기본 사용법 &mdash; 지연 도구 등록과 검색
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              서버의 도구를 지연 로딩으로 등록하고, 필요할 때 검색합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">toolSearch</span> ={" "}
              <span className="kw">new</span> <span className="fn">MCPToolSearch</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 1. 도구를 지연 로딩 형태로 등록"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">deferred</span> ={" "}
              <span className="kw">await</span> <span className="prop">toolSearch</span>.
              <span className="fn">registerDeferredTools</span>(<span className="prop">client</span>
              , <span className="str">&quot;github&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 시스템 프롬프트에 도구 목록 주입"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">summary</span> ={" "}
              <span className="prop">toolSearch</span>.
              <span className="fn">generateDeferredToolsSummary</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. LLM이 요청하면 검색으로 전체 스키마 반환"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">results</span> ={" "}
              <span className="prop">toolSearch</span>.<span className="fn">search</span>(
              <span className="str">&quot;create issue&quot;</span>);
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>registerDeferredTools()</code>는{" "}
              <code>client.listTools()</code>를 호출합니다. 클라이언트가 연결된 상태여야 합니다.
            </Callout>

            {/* 정확한 이름 매칭 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 정확한 이름 매칭 (select: 구문)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">&quot;select:&quot;</code> 접두사로 정확한 이름 매칭을
              수행합니다. 콤마로 여러 도구를 한 번에 조회할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 정확한 이름으로 여러 도구 한 번에 조회"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">tools</span> ={" "}
              <span className="prop">toolSearch</span>.<span className="fn">search</span>(
              <span className="str">&quot;select:create_issue,search_code&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 네임스페이싱된 이름으로도 조회 가능"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">tool</span> ={" "}
              <span className="prop">toolSearch</span>.<span className="fn">getToolDefinition</span>
              (<span className="str">&quot;mcp__github__create_issue&quot;</span>);
            </CodeBlock>

            {/* 토큰 예산 관리 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 토큰 예산 관리
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              시스템 프롬프트에 주입할 토큰 예산을 사전에 확인할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 지연 도구 목록의 토큰 사용량 추정"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">tokens</span> ={" "}
              <span className="prop">toolSearch</span>.<span className="fn">estimateTokens</span>();
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">`지연 도구 목록: ~${"{"}</span>
              <span className="prop">tokens</span>
              <span className="str">{"}"} 토큰`</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 총 도구 수 확인"}</span>
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">`등록된 지연 도구: ${"{"}</span>
              <span className="prop">toolSearch</span>.<span className="prop">size</span>
              <span className="str">{"}"} 개`</span>);
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>MCPToolBridge.shouldDeferTools()</code>와 함께 사용하세요.
              MCP 도구 토큰이 컨텍스트의 10%를 초과하면 자동으로 지연 로딩으로 전환됩니다.
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
              관련도 점수 계산 알고리즘
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">computeRelevanceScore()</code>가 쿼리와 도구 사이의
              관련도를 0~1 사이 점수로 계산합니다. 여러 기준을 조합합니다.
            </p>

            <MermaidDiagram
              title="관련도 점수 계산 알고리즘"
              titleColor="purple"
              chart={`graph TD
  QUERY["검색 쿼리<br/><small>소문자 정규화</small>"]
  EXACT["정확한 이름 매칭?<br/><small>name === query</small>"]
  SCORE_1["점수: 1.0"]
  NAME_INC["이름에 포함?<br/><small>name.includes(query)</small>"]
  SCORE_07["점수: 0.7"]
  DESC_INC["설명에 포함?<br/><small>desc.includes(query)</small>"]
  SCORE_04["점수: 0.4"]
  WORDS["단어 겹침<br/><small>queryWords vs targetWords</small>"]
  BONUS["보너스: 비율 x 0.3"]
  FINAL["최종 점수<br/><small>min(1.0, max(scores))</small>"]

  QUERY --> EXACT
  EXACT -->|"예"| SCORE_1
  EXACT -->|"아니오"| NAME_INC
  NAME_INC -->|"예"| SCORE_07
  NAME_INC -->|"아니오"| DESC_INC
  DESC_INC -->|"예"| SCORE_04
  DESC_INC -->|"아니오"| WORDS
  WORDS --> BONUS
  SCORE_07 --> FINAL
  SCORE_04 --> FINAL
  BONUS --> FINAL
  SCORE_1 --> FINAL

  style QUERY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style SCORE_1 fill:#dcfce7,stroke:#10b981,color:#065f46
  style SCORE_07 fill:#dcfce7,stroke:#10b981,color:#065f46
  style SCORE_04 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style FINAL fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style EXACT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style NAME_INC fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style DESC_INC fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style WORDS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style BONUS fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석 &mdash; search() 메서드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              검색 메서드의 분기 로직입니다.
              <code className="text-cyan-600">&quot;select:&quot;</code> 구문과 자유 텍스트를 분기
              처리합니다.
            </p>
            <CodeBlock>
              <span className="fn">search</span>(<span className="prop">query</span>:{" "}
              <span className="type">string</span>, <span className="prop">maxResults</span> ={" "}
              <span className="num">5</span>):{" "}
              <span className="type">readonly ToolSearchResult[]</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">trimmed</span> ={" "}
              <span className="prop">query</span>.<span className="fn">trim</span>();
              {"\n"}
              {"  "}
              <span className="kw">if</span> (!<span className="prop">trimmed</span>){" "}
              <span className="kw">return</span> [];
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{'// "select:Name1,Name2" → 정확한 이름 매칭'}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">trimmed</span>.
              <span className="fn">startsWith</span>(
              <span className="str">&quot;select:&quot;</span>)) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">names</span> ={" "}
              <span className="prop">trimmed</span>.<span className="fn">slice</span>(
              <span className="num">7</span>).<span className="fn">split</span>(
              <span className="str">&quot;,&quot;</span>).<span className="fn">map</span>(
              <span className="prop">n</span> =&gt; <span className="prop">n</span>.
              <span className="fn">trim</span>());
              {"\n"}
              {"    "}
              <span className="kw">return</span> <span className="kw">this</span>.
              <span className="fn">resolveByNames</span>(<span className="prop">names</span>);
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// 자유 텍스트: 관련도 점수 계산 + 정렬"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">results</span> = [...
              <span className="kw">this</span>.<span className="prop">deferredTools</span>]{"\n"}
              {"    "}.<span className="fn">map</span>(([<span className="prop">ns</span>,{" "}
              <span className="prop">d</span>]) =&gt; ({"{"} <span className="prop">ns</span>,{" "}
              <span className="prop">score</span>: <span className="fn">computeRelevanceScore</span>
              (<span className="prop">trimmed</span>, <span className="prop">d</span>.
              <span className="prop">name</span>, <span className="prop">d</span>.
              <span className="prop">description</span>) {"}"}))
              {"\n"}
              {"    "}.<span className="fn">filter</span>(<span className="prop">r</span> =&gt;{" "}
              <span className="prop">r</span>.<span className="prop">score</span> {">"}{" "}
              <span className="num">0</span>){"\n"}
              {"    "}.<span className="fn">sort</span>((<span className="prop">a</span>,{" "}
              <span className="prop">b</span>) =&gt; <span className="prop">b</span>.
              <span className="prop">score</span> - <span className="prop">a</span>.
              <span className="prop">score</span>){"\n"}
              {"    "}.<span className="fn">slice</span>(<span className="num">0</span>,{" "}
              <span className="prop">maxResults</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">select: 분기:</strong> 콤마로 구분된 이름을 배열로
                파싱하여 <code className="text-cyan-600">resolveByNames()</code>에 위임합니다.
              </p>
              <p>
                <strong className="text-gray-900">퍼지 매칭:</strong> 모든 지연 도구에 대해 관련도
                점수를 계산하고, 0점 초과인 것만 필터링한 뒤 내림차순 정렬합니다.
              </p>
              <p>
                <strong className="text-gray-900">동점 처리:</strong> 점수가 같으면 이름
                알파벳순으로 정렬하여 안정적인 결과를 보장합니다.
              </p>
            </div>

            <DeepDive title="resolveByNames() — 2단계 이름 해석">
              <p className="mb-3">정확한 이름 매칭은 두 단계로 수행됩니다:</p>
              <ol className="list-decimal list-inside space-y-2 text-gray-600">
                <li>
                  <strong>네임스페이싱된 이름으로 직접 조회:</strong>
                  <code className="text-cyan-600">
                    fullToolCache.get(&quot;mcp__github__create_issue&quot;)
                  </code>
                </li>
                <li>
                  <strong>일반 이름으로 전체 서버 검색:</strong>
                  <code className="text-cyan-600">deferredTools</code>를 순회하며
                  <code className="text-cyan-600">
                    deferred.name === &quot;create_issue&quot;
                  </code>{" "}
                  비교
                </li>
              </ol>
              <p className="mt-3 text-amber-600">
                같은 이름의 도구가 여러 서버에 있으면 모두 반환됩니다. 알 수 없는 이름은 에러 없이
                건너뜁니다.
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

            {/* FAQ 1 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;검색해도 원하는 도구가 안 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                관련도 점수가 0인 도구는 결과에서 제외됩니다.
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>쿼리가 도구 이름이나 설명에 포함되어 있는지 확인하세요.</li>
                <li>
                  정확한 이름을 알고 있다면{" "}
                  <code className="text-cyan-600">&quot;select:도구이름&quot;</code> 구문을
                  사용하세요.
                </li>
                <li>
                  <code className="text-cyan-600">has(namespacedName)</code>으로 도구 등록 여부를
                  확인하세요.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;지연 로딩된 도구 목록이 시스템 프롬프트에 안 나타나요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">generateDeferredToolsSummary()</code>가 빈 문자열을
                반환하는 경우,
                <code className="text-cyan-600">registerDeferredTools()</code>가 호출되었는지
                확인하세요.
                <code className="text-cyan-600">size</code> 속성으로 등록된 도구 수를 확인할 수
                있습니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;토큰 추정값이 실제와 많이 달라요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">estimateTokens()</code>는 4문자 = 1토큰 근사치를
                사용합니다. 한글이나 특수문자가 많으면 실제 토큰 수가 더 높을 수 있습니다. 정확한
                토큰 계산이 필요하면 <code className="text-cyan-600">token-counter</code> 모듈을
                사용하세요.
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
                  name: "tool-bridge.ts",
                  slug: "mcp-tool-bridge",
                  relation: "sibling",
                  desc: "지연 로딩 임계값(shouldDeferTools)을 판단하고 도구를 레지스트리에 등록하는 브리지",
                },
                {
                  name: "client.ts",
                  slug: "mcp-client",
                  relation: "sibling",
                  desc: "ToolSearchableClient 인터페이스를 구현하는 JSON-RPC MCP 클라이언트",
                },
                {
                  name: "token-counter.ts",
                  slug: "token-counter",
                  relation: "sibling",
                  desc: "정확한 토큰 계산 모듈 — estimateTokens()의 근사치보다 정밀한 계산이 필요할 때",
                },
                {
                  name: "system-prompt-builder.ts",
                  slug: "system-prompt-builder",
                  relation: "sibling",
                  desc: "generateDeferredToolsSummary()의 결과를 시스템 프롬프트에 주입하는 빌더",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
