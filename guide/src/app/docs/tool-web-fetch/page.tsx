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

export default function ToolWebFetchPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/tools/definitions/web-fetch.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">web_fetch</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
              <span className="text-sm text-gray-500">URL 콘텐츠 가져오기 도구</span>
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              URL의 내용을 텍스트로 가져오는 도구입니다. HTML 자동 정리, 응답 캐싱, HTTPS
              업그레이드를 지원합니다.
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
                <code className="text-cyan-600">web_fetch</code>는 주어진 URL에 HTTP 요청을 보내고
                응답 내용을 텍스트로 반환하는 도구입니다. HTML 응답은 자동으로 정리되어(스크립트,
                스타일, 내비게이션 등 제거) 본문 텍스트만 추출됩니다.
              </p>
              <p>
                응답 캐싱(15분 TTL), HTTP &rarr; HTTPS 자동 업그레이드, 리다이렉트 추적(최대 5회),
                콘텐츠 크기 제한(50,000자), 추출 프롬프트 등 다양한 기능을 제공합니다.
              </p>
              <p>
                권한 수준은 <code className="text-amber-600">&quot;confirm&quot;</code>입니다. 외부
                네트워크 요청이므로 사용자 확인이 필요합니다. 30초 타임아웃이 설정되어 있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="web_fetch 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  EXEC["Tool Executor<br/><small>tools/executor.ts</small>"]
  WF["web_fetch<br/><small>definitions/web-fetch.ts</small>"]
  CACHE["Response Cache<br/><small>Map&lt;URL, CacheEntry&gt;</small>"]
  WEB["External Web Server<br/><small>HTTP/HTTPS</small>"]

  AGENT -->|"도구 호출"| EXEC
  EXEC -->|"execute()"| WF
  WF -->|"캐시 히트"| CACHE
  WF -->|"캐시 미스"| WEB
  WEB -->|"응답 저장"| CACHE

  style WF fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CACHE fill:#dcfce7,stroke:#10b981,color:#065f46
  style WEB fill:#fef3c7,stroke:#f59e0b,color:#78350f`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 웹 브라우저의 &quot;페이지 소스 보기&quot;와 비슷하지만,
              불필요한 HTML 태그를 자동으로 제거하고 순수 텍스트만 추출합니다. 한 번 방문한 페이지는
              15분간 캐시에 저장되어 다시 요청하면 즉시 반환됩니다.
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

            {/* paramSchema */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              paramSchema (Zod)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              URL, 최대 길이, 추출 프롬프트를 정의하는 입력 매개변수 스키마입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "url",
                  type: "string (URL)",
                  required: true,
                  desc: "가져올 URL. Zod의 url() 검증을 통과해야 함",
                },
                {
                  name: "maxLength",
                  type: "number",
                  required: false,
                  desc: "최대 응답 길이 (문자 수, 기본값: 50,000)",
                },
                {
                  name: "prompt",
                  type: "string",
                  required: false,
                  desc: "추출 프롬프트 — 페이지에서 어떤 정보를 추출할지 안내",
                },
              ]}
            />

            {/* CacheEntry interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface CacheEntry
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              URL 응답을 캐시에 저장할 때 사용하는 내부 인터페이스입니다. 모든 프로퍼티가{" "}
              <code className="text-cyan-600">readonly</code>입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "content",
                  type: "string",
                  required: true,
                  desc: "정리된(HTML 태그 제거된) 응답 텍스트",
                },
                {
                  name: "timestamp",
                  type: "number",
                  required: true,
                  desc: "캐시된 시간 (Unix timestamp)",
                },
                {
                  name: "finalUrl",
                  type: "string",
                  required: true,
                  desc: "리다이렉트 후 최종 URL",
                },
                {
                  name: "contentType",
                  type: "string",
                  required: true,
                  desc: "HTTP Content-Type 헤더 값",
                },
                { name: "status", type: "number", required: true, desc: "HTTP 상태 코드" },
              ]}
            />

            {/* 상수 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              상수 (Constants)
            </h3>
            <ParamTable
              params={[
                {
                  name: "CACHE_TTL_MS",
                  type: "900,000",
                  required: true,
                  desc: "캐시 유효 기간: 15분 (밀리초)",
                },
                {
                  name: "MAX_CACHE_SIZE",
                  type: "50",
                  required: true,
                  desc: "캐시 최대 크기: 50개 URL",
                },
                {
                  name: "CONTENT_SIZE_LIMIT",
                  type: "50,000",
                  required: true,
                  desc: "응답 텍스트 최대 크기 (문자)",
                },
                { name: "MAX_REDIRECTS", type: "5", required: true, desc: "리다이렉트 최대 횟수" },
              ]}
            />

            {/* ToolDefinition */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              webFetchTool (ToolDefinition)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              도구 레지스트리에 등록되는 최종 도구 정의 객체입니다.
            </p>
            <ParamTable
              params={[
                { name: "name", type: '"web_fetch"', required: true, desc: "도구 이름 식별자" },
                {
                  name: "permissionLevel",
                  type: '"confirm"',
                  required: true,
                  desc: "확인 등급 — 사용자 승인 후 실행",
                },
                { name: "timeoutMs", type: "30_000", required: true, desc: "30초 타임아웃" },
              ]}
            />

            {/* 핵심 함수들 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              내부 함수
            </h3>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">stripHtmlTags(html)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              HTML 태그를 제거하고 텍스트만 추출합니다. script, style, nav, footer, header를 통째로
              제거합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">stripHtmlTags</span>(
              <span className="prop">html</span>: <span className="type">string</span>):{" "}
              <span className="type">string</span>
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              fetchWithRedirectTracking(url, signal)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              리다이렉트를 수동으로 추적하면서 HTTP 요청을 실행합니다. 최대 5회까지 리다이렉트를
              따라갑니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span>{" "}
              <span className="fn">fetchWithRedirectTracking</span>({"\n"}
              {"  "}
              <span className="prop">url</span>: <span className="type">string</span>,{"\n"}
              {"  "}
              <span className="prop">signal</span>: <span className="type">AbortSignal</span>,{"\n"}
              ): <span className="type">Promise</span>&lt;{"{"}{" "}
              <span className="prop">response</span>: <span className="type">Response</span>;{" "}
              <span className="prop">finalUrl</span>: <span className="type">string</span>;{" "}
              <span className="prop">redirected</span>: <span className="type">boolean</span> {"}"}
              &gt;
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">upgradeToHttps(url)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              HTTP URL을 HTTPS로 업그레이드합니다. 이미 HTTPS이거나 HTTP가 아니면{" "}
              <code className="text-cyan-600">undefined</code>를 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">upgradeToHttps</span>(
              <span className="prop">url</span>: <span className="type">string</span>):{" "}
              <span className="type">string | undefined</span>
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">clearCache()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              응답 캐시를 전체 초기화합니다. 테스트에서 클린 상태로 리셋할 때 사용합니다. 외부로{" "}
              <code className="text-cyan-600">export</code>됩니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span> <span className="fn">clearCache</span>():{" "}
              <span className="type">void</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                응답이 <code className="text-cyan-600">maxLength</code>(기본 50,000자)를 초과하면
                자동으로 잘립니다. 잘린 경우 &quot;[Truncated: showing first N of M chars]&quot;
                메시지가 추가됩니다.
              </li>
              <li>
                캐시는 모듈 수준 <code className="text-cyan-600">Map</code>에 저장되므로 프로세스가
                재시작되면 초기화됩니다. 캐시 크기가 50개를 초과하면 가장 오래된 항목부터
                제거됩니다(LRU 방식).
              </li>
              <li>
                <code className="text-cyan-600">redirect: &quot;manual&quot;</code>을 사용하므로,
                리다이렉트가 5회를 초과하면 &quot;Too many redirects&quot; 에러가 발생합니다.
              </li>
              <li>
                HTTP URL은 자동으로 HTTPS로 먼저 시도합니다. HTTPS 연결이 실패하면 원래 HTTP URL로
                폴백합니다.
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
              기본 사용법 &mdash; URL 콘텐츠 가져오기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              LLM이 특정 URL의 콘텐츠를 읽어야 할 때 이 도구를 호출합니다. HTML 페이지는 자동으로
              정리되어 본문 텍스트만 반환됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// LLM이 호출하는 도구 매개변수 예시"}</span>
              {"\n"}
              {"{"}
              {"\n"}
              {"  "}
              <span className="prop">url</span>:{" "}
              <span className="str">&quot;https://docs.example.com/api/v2&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">maxLength</span>: <span className="num">10000</span>
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 이 도구는 <code>permissionLevel: &quot;confirm&quot;</code>
              이므로, 실행 전 사용자에게 확인을 요청합니다. 자동 실행이 필요하면 권한 모드를
              &quot;yolo&quot;로 설정해야 합니다.
            </Callout>

            {/* 추출 프롬프트 사용 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 추출 프롬프트로 특정 정보 추출하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">prompt</code> 매개변수를 사용하면 페이지에서 어떤
              정보를 추출해야 하는지 힌트를 제공할 수 있습니다. 이 텍스트는 응답 앞에 표시됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 특정 정보만 추출하도록 프롬프트 전달"}</span>
              {"\n"}
              {"{"}
              {"\n"}
              {"  "}
              <span className="prop">url</span>:{" "}
              <span className="str">&quot;https://example.com/pricing&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">prompt</span>:{" "}
              <span className="str">&quot;Extract pricing tiers and their features&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">maxLength</span>: <span className="num">5000</span>
              {"\n"}
              {"}"}
            </CodeBlock>

            <p className="text-[13px] text-gray-600 mb-4 mt-4 leading-relaxed">
              반환되는 결과에 프롬프트 정보가 포함됩니다:
            </p>
            <CodeBlock>
              <span className="str">
                [Extraction prompt: Extract pricing tiers and their features]
              </span>
              {"\n"}
              {"\n"}
              <span className="str">Free Plan - 1 user, 100 requests/month...</span>
              {"\n"}
              <span className="str">Pro Plan - 10 users, 10,000 requests/month...</span>
            </CodeBlock>

            <DeepDive title="캐시 동작 상세">
              <p className="mb-3">
                같은 URL을 15분 이내에 다시 요청하면 네트워크 요청 없이 캐시에서 즉시 반환됩니다.
                캐시된 응답에는 <code className="text-cyan-600">[Cached response]</code> 태그가
                붙습니다.
              </p>
              <p className="text-gray-600 mb-3">
                캐시 키는 원본 URL이며, 리다이렉트 후 최종 URL은{" "}
                <code className="text-cyan-600">finalUrl</code>에 별도 저장됩니다. 캐시 크기가
                50개를 초과하면 <code className="text-cyan-600">Map</code>의 삽입 순서를 활용하여
                가장 오래된 항목을 제거합니다.
              </p>
              <CodeBlock>
                <span className="cm">{"// 캐시 TTL 확인 로직"}</span>
                {"\n"}
                <span className="kw">if</span> (<span className="fn">Date</span>.
                <span className="fn">now</span>() - <span className="prop">entry</span>.
                <span className="prop">timestamp</span> &gt; <span className="num">900_000</span>){" "}
                {"{"}
                {"\n"}
                {"  "}
                <span className="prop">responseCache</span>.<span className="fn">delete</span>(
                <span className="prop">url</span>);
                {"\n"}
                {"  "}
                <span className="kw">return</span> <span className="kw">undefined</span>;{"\n"}
                {"}"}
              </CodeBlock>
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
              실행 흐름 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">execute()</code> 함수의 전체 실행 흐름입니다. 캐시
              확인, HTTPS 업그레이드, 리다이렉트 추적, HTML 정리, 크기 제한 순서로 처리됩니다.
            </p>

            <MermaidDiagram
              title="web_fetch 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("execute()")) --> CACHE{"캐시 확인"}
  CACHE -->|"히트"| HIT["캐시 응답 반환<br/><small>[Cached response]</small>"]
  CACHE -->|"미스"| HTTPS{"HTTP URL?"}
  HTTPS -->|"예"| UPGRADE["HTTPS 업그레이드 시도"]
  HTTPS -->|"아니오"| FETCH["fetchWithRedirectTracking()"]
  UPGRADE -->|"성공"| FETCH
  UPGRADE -->|"실패"| FALLBACK["원래 HTTP URL로 폴백"]
  FALLBACK --> FETCH
  FETCH --> HTML{"Content-Type<br/>text/html?"}
  HTML -->|"예"| STRIP["stripHtmlTags()<br/><small>태그 제거</small>"]
  HTML -->|"아니오"| RAW["원본 텍스트 유지"]
  STRIP --> SAVE["캐시에 저장"]
  RAW --> SAVE
  SAVE --> TRIM{"maxLength<br/>초과?"}
  TRIM -->|"예"| TRUNCATE["잘라내기 + 안내 메시지"]
  TRIM -->|"아니오"| RESULT["ToolResult 반환"]
  TRUNCATE --> RESULT

  style START fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CACHE fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style HIT fill:#dcfce7,stroke:#10b981,color:#065f46
  style STRIP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">stripHtmlTags()</code> 함수의 HTML 정리
              파이프라인입니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">stripHtmlTags</span>(
              <span className="prop">html</span>: <span className="type">string</span>):{" "}
              <span className="type">string</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">html</span>
              {"\n"}
              {"    "}
              <span className="cm">{"// [1] 불필요한 태그와 내용을 통째로 제거"}</span>
              {"\n"}
              {"    "}.<span className="fn">replace</span>(
              <span className="str">/&lt;script[\\s\\S]*?&lt;\\/script&gt;/gi</span>,{" "}
              <span className="str">&quot;&quot;</span>){"\n"}
              {"    "}.<span className="fn">replace</span>(
              <span className="str">/&lt;style[\\s\\S]*?&lt;\\/style&gt;/gi</span>,{" "}
              <span className="str">&quot;&quot;</span>){"\n"}
              {"    "}.<span className="fn">replace</span>(
              <span className="str">/&lt;nav[\\s\\S]*?&lt;\\/nav&gt;/gi</span>,{" "}
              <span className="str">&quot;&quot;</span>){"\n"}
              {"    "}
              <span className="cm">{"// [2] 블록 요소를 줄바꿈으로 변환"}</span>
              {"\n"}
              {"    "}.<span className="fn">replace</span>(
              <span className="str">/&lt;\\/?(p|div|br|...)\\b[^&gt;]*&gt;/gi</span>,{" "}
              <span className="str">&quot;\\n&quot;</span>){"\n"}
              {"    "}
              <span className="cm">{"// [3] 나머지 HTML 태그 제거"}</span>
              {"\n"}
              {"    "}.<span className="fn">replace</span>(
              <span className="str">/&lt;[^&gt;]*&gt;/g</span>,{" "}
              <span className="str">&quot;&quot;</span>){"\n"}
              {"    "}
              <span className="cm">{"// [4] HTML 엔티티 디코딩"}</span>
              {"\n"}
              {"    "}.<span className="fn">replace</span>(
              <span className="str">/&amp;nbsp;/g</span>, <span className="str">&quot; &quot;</span>
              ){"\n"}
              {"    "}
              <span className="cm">{"// [5] 과도한 공백 정리"}</span>
              {"\n"}
              {"    "}.<span className="fn">replace</span>(<span className="str">/[ \\t]+/g</span>,{" "}
              <span className="str">&quot; &quot;</span>){"\n"}
              {"    "}.<span className="fn">trim</span>();
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> script, style, nav, footer, header
                태그와 내용을 통째로 제거하여 본문만 남깁니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> p, div, br 등의 블록 요소를
                줄바꿈으로 변환하여 단락 구분을 유지합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 나머지 인라인 태그(a, span, strong
                등)를 모두 제거하여 순수 텍스트만 남깁니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> &amp;amp;, &amp;lt;, &amp;gt; 등의
                HTML 엔티티를 실제 문자로 디코딩합니다.
              </p>
              <p>
                <strong className="text-gray-900">[5]</strong> 연속 공백과 과도한 빈 줄을 정리하여
                깔끔한 텍스트를 만듭니다.
              </p>
            </div>

            <DeepDive title="리다이렉트 추적 상세">
              <p className="mb-3">
                <code className="text-cyan-600">fetchWithRedirectTracking()</code>은{" "}
                <code className="text-cyan-600">redirect: &quot;manual&quot;</code>을 사용하여
                리다이렉트를 자동으로 따라가지 않습니다. 대신{" "}
                <code className="text-cyan-600">Location</code> 헤더를 확인하고 수동으로 다음 URL로
                이동합니다.
              </p>
              <p className="text-gray-600">
                이를 통해 리다이렉트 횟수를 제한(최대 5회)하고, 최종 URL을 정확히 추적하며, 상대
                리다이렉트(<code className="text-cyan-600">new URL(location, currentUrl)</code>)를
                올바르게 처리합니다.
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
                &quot;HTTP 403 Forbidden 에러가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                서버가 자동화된 요청을 차단하고 있습니다. User-Agent 헤더로
                <code className="text-cyan-600">&quot;dhelix/1.0&quot;</code>을 보내는데, 일부
                사이트는 봇을 차단합니다.
              </p>
              <Callout type="tip" icon="*">
                대안으로 해당 페이지의 내용을 <code>web_search</code>로 검색하여 스니펫에서 필요한
                정보를 얻을 수 있습니다.
              </Callout>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;응답이 잘려서 전체 내용을 볼 수 없어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                기본 <code className="text-cyan-600">maxLength</code>가 50,000자입니다. 더 긴 내용이
                필요하면 <code className="text-cyan-600">maxLength</code> 매개변수를 더 큰 값으로
                설정하세요. 단, LLM 컨텍스트 윈도우를 고려하여 적절한 크기를 선택해야 합니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Too many redirects 에러가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                URL이 5회 이상 리다이렉트되고 있습니다. 무한 리다이렉트 루프가 있는지 확인하세요.
                최종 목적지 URL을 직접 입력하면 해결될 수 있습니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;캐시된 오래된 내용이 반환돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                캐시 TTL은 15분입니다. 15분 이내에 같은 URL을 요청하면 이전 응답이 반환됩니다. 최신
                내용이 필요하면 15분 후에 다시 요청하거나, 개발 중이라면
                <code className="text-cyan-600">clearCache()</code>를 호출하세요.
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
                  name: "web-search.ts",
                  slug: "tool-web-search",
                  relation: "sibling",
                  desc: "웹 검색으로 URL을 찾고, web_fetch로 해당 URL의 콘텐츠를 가져오는 조합 패턴",
                },
                {
                  name: "tool-registry.ts",
                  slug: "tool-registry",
                  relation: "parent",
                  desc: "web_fetch를 포함한 모든 도구를 등록하고 관리하는 레지스트리",
                },
                {
                  name: "permission-manager.ts",
                  slug: "permission-manager",
                  relation: "sibling",
                  desc: "confirm 권한 수준 도구의 실행 승인을 관리하는 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
