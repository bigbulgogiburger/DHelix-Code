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

export default function MCPOutputLimiterPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/mcp/output-limiter.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">MCPOutputLimiter</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              MCP 도구 결과의 지능적 출력 잘림(truncation)으로 LLM 컨텍스트 윈도우를 절약하는
              모듈입니다.
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
                <code className="text-cyan-600">MCPOutputLimiter</code>는 MCP 도구가 반환하는 출력이
                너무 길 때 지능적으로 잘라내어 LLM 컨텍스트 윈도우를 과도하게 소비하지 않도록
                합니다. 단순히 앞이나 뒤를 자르는 것이 아니라, 콘텐츠의 형식(JSON, Markdown, 일반
                텍스트)을 자동으로 감지하여 구조를 보존하며 잘라냅니다.
              </p>
              <p>
                세 가지 잘림 전략을 제공합니다:{" "}
                <code className="text-cyan-600">&quot;head&quot;</code>(앞부분 유지),
                <code className="text-cyan-600">&quot;tail&quot;</code>(뒷부분 유지),
                <code className="text-cyan-600">&quot;smart&quot;</code>(구조 보존). 기본 전략은
                <code className="text-emerald-600">&quot;smart&quot;</code>이며, 대부분의 경우에
                최적입니다.
              </p>
              <p>
                서버별로 개별 설정이 가능하고, 사용 통계(잘린 횟수, 절약된 토큰 등)를 추적합니다.
                토큰 추정은 4문자 = 1토큰 비율로 계산하며, 실제 토크나이저와 약간의 차이가 있을 수
                있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="MCPOutputLimiter 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  CONN["MCPManagerConnector<br/><small>manager-connector.ts</small>"]
  OL["MCPOutputLimiter<br/><small>output-limiter.ts</small>"]
  TOOL["MCP Tool 실행 결과"]
  LLM["LLM Context Window"]
  STATS["사용 통계<br/><small>totalTokensSaved</small>"]

  TOOL -->|"원본 출력"| OL
  CONN -->|"limitToolOutput()"| OL
  OL -->|"잘린 출력"| LLM
  OL -->|"추적"| STATS

  style OL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CONN fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TOOL fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style LLM fill:#dcfce7,stroke:#10b981,color:#1e293b
  style STATS fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 뉴스 기사의 &quot;더보기&quot; 버튼을 떠올리세요. 기사가 너무
              길면 핵심 내용만 보여주고 나머지를 접어둡니다. MCPOutputLimiter도 마찬가지로, 도구
              출력이 너무 길면 구조를 보존하면서 핵심만 남기고 나머지를 잘라냅니다.
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

            {/* OutputLimitConfig */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface OutputLimitConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              출력 제한 설정입니다. 토큰 제한과 문자 제한 중 더 작은 값이 적용됩니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "maxTokens",
                  type: "number",
                  required: true,
                  desc: "최대 토큰 수 (기본: 10,000) — 대략 1토큰 = 4자",
                },
                {
                  name: "maxCharacters",
                  type: "number",
                  required: true,
                  desc: "최대 문자 수 (기본: 40,000)",
                },
                {
                  name: "strategy",
                  type: '"head" | "tail" | "smart"',
                  required: true,
                  desc: '잘림 전략 (기본: "smart")',
                },
                {
                  name: "includeSummary",
                  type: "boolean",
                  required: true,
                  desc: "잘린 콘텐츠에 요약 메시지 포함 여부 (기본: true)",
                },
              ]}
            />

            {/* LimitedOutput */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface LimitedOutput
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              출력 제한 결과입니다. 잘림 메타데이터를 포함합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "content",
                  type: "string",
                  required: true,
                  desc: "제한된 (또는 원본 그대로인) 콘텐츠",
                },
                {
                  name: "wasTruncated",
                  type: "boolean",
                  required: true,
                  desc: "잘림이 적용되었는지 여부",
                },
                {
                  name: "originalTokens",
                  type: "number",
                  required: true,
                  desc: "원본 콘텐츠의 추정 토큰 수",
                },
                {
                  name: "resultTokens",
                  type: "number",
                  required: true,
                  desc: "결과 콘텐츠의 추정 토큰 수",
                },
                {
                  name: "originalCharacters",
                  type: "number",
                  required: true,
                  desc: "원본 콘텐츠의 문자 수",
                },
                {
                  name: "truncationMessage",
                  type: "string | undefined",
                  required: false,
                  desc: "잘림 안내 메시지 (잘렸을 때만 존재)",
                },
              ]}
            />

            {/* OutputLimiterStats */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface OutputLimiterStats
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              출력 제한기의 전체 사용 현황을 추적하는 통계입니다.
            </p>
            <ParamTable
              params={[
                { name: "totalCalls", type: "number", required: true, desc: "총 호출 횟수" },
                {
                  name: "truncatedCalls",
                  type: "number",
                  required: true,
                  desc: "잘림이 발생한 횟수",
                },
                {
                  name: "totalTokensSaved",
                  type: "number",
                  required: true,
                  desc: "잘림으로 절약된 총 토큰 수",
                },
                {
                  name: "averageOriginalTokens",
                  type: "number",
                  required: true,
                  desc: "원본 콘텐츠의 평균 토큰 수",
                },
              ]}
            />

            {/* MCPOutputLimiter class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class MCPOutputLimiter
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              설정 가능하고 지능적인 출력 잘림을 제공하는 메인 클래스입니다.
            </p>

            {/* Constructor */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">constructor</h4>
            <CodeBlock>
              <span className="kw">constructor</span>(<span className="prop">config</span>?:{" "}
              <span className="type">Partial</span>&lt;
              <span className="type">OutputLimitConfig</span>&gt;)
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "config",
                  type: "Partial<OutputLimitConfig>",
                  required: false,
                  desc: "전역 설정 오버라이드 (기본값에 병합됨)",
                },
              ]}
            />

            {/* setServerLimit */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              setServerLimit(serverName, config)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              서버별 출력 제한 설정을 지정합니다. 전역 설정을 기반으로 오버라이드를 적용합니다.
            </p>
            <CodeBlock>
              <span className="fn">setServerLimit</span>(<span className="prop">serverName</span>:{" "}
              <span className="type">string</span>, <span className="prop">config</span>:{" "}
              <span className="type">Partial</span>&lt;
              <span className="type">OutputLimitConfig</span>&gt;):{" "}
              <span className="type">void</span>
            </CodeBlock>

            {/* limitOutput */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              limitOutput(content, serverName?)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              출력 콘텐츠에 제한을 적용합니다. 제한 내에 있으면 원본 그대로 반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">limitOutput</span>(<span className="prop">content</span>:{" "}
              <span className="type">string</span>, <span className="prop">serverName</span>?:{" "}
              <span className="type">string</span>): <span className="type">LimitedOutput</span>
            </CodeBlock>

            {/* smartTruncate */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              smartTruncate(content, maxChars)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              콘텐츠 형식을 감지하고 구조를 보존하며 잘라냅니다.
            </p>
            <CodeBlock>
              <span className="fn">smartTruncate</span>(<span className="prop">content</span>:{" "}
              <span className="type">string</span>, <span className="prop">maxChars</span>:{" "}
              <span className="type">number</span>): {"{"} <span className="prop">truncated</span>:{" "}
              <span className="type">string</span>; <span className="prop">summary</span>:{" "}
              <span className="type">string</span> {"}"}
            </CodeBlock>

            {/* estimateTokens */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">estimateTokens(text)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              4문자 = 1토큰 비율로 토큰 수를 추정합니다.
            </p>
            <CodeBlock>
              <span className="fn">estimateTokens</span>(<span className="prop">text</span>:{" "}
              <span className="type">string</span>): <span className="type">number</span>
            </CodeBlock>

            {/* getStats / resetStats */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getStats() / resetStats()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              사용 통계의 스냅샷을 반환하거나, 모든 통계를 초기화합니다.
            </p>
            <CodeBlock>
              <span className="fn">getStats</span>():{" "}
              <span className="type">OutputLimiterStats</span>
              {"\n"}
              <span className="fn">resetStats</span>(): <span className="type">void</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                토큰 추정은 <code className="text-cyan-600">4문자 = 1토큰</code> 비율을 사용합니다.
                실제 토크나이저(tiktoken 등)와 차이가 있을 수 있지만, 빠른 근사치로 충분합니다.
              </li>
              <li>
                <code className="text-cyan-600">&quot;smart&quot;</code> 전략에서 JSON 파싱이
                실패하면 일반 텍스트 잘림으로 자동 폴백합니다.
              </li>
              <li>
                토큰 제한과 문자 제한 중 <strong>더 작은 값</strong>이 적용됩니다. 예:
                maxTokens=10,000(=40,000자), maxCharacters=30,000이면 30,000자가 기준입니다.
              </li>
              <li>
                잘림 안내 메시지(<code className="text-cyan-600">truncationMessage</code>)는 결과
                콘텐츠 끝에 자동으로 추가됩니다. 이 메시지의 토큰도 결과에 포함됩니다.
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
              기본 사용법 &mdash; 출력 제한 적용
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              가장 일반적인 패턴입니다. 기본 설정(10,000토큰, smart 전략)으로 출력을 제한합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">limiter</span> ={" "}
              <span className="kw">new</span> <span className="fn">MCPOutputLimiter</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// MCP 도구 실행 결과"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">toolOutput</span> ={" "}
              <span className="kw">await</span> <span className="fn">executeToolOnServer</span>(
              <span className="str">&quot;my-tool&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 제한 적용"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="prop">limiter</span>.<span className="fn">limitOutput</span>(
              <span className="prop">toolOutput</span>,{" "}
              <span className="str">&quot;server-name&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="kw">if</span> (<span className="prop">result</span>.
              <span className="prop">wasTruncated</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">`${"{"}</span>
              <span className="prop">result</span>.<span className="prop">originalTokens</span>
              <span className="str">
                {"}"} → ${"{"}
              </span>
              <span className="prop">result</span>.<span className="prop">resultTokens</span>
              <span className="str">{"}"} 토큰으로 축소`</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 출력 제한은 정보 손실을 수반합니다. LLM이 잘린 부분의 정보가
              필요한 경우 정확하지 않은 결과를 생성할 수 있습니다. 중요한 데이터에는{" "}
              <code>maxTokens</code>를 충분히 높게 설정하세요.
            </Callout>

            {/* 서버별 설정 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 서버별 개별 설정
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              특정 서버의 출력만 다른 전략으로 제한할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">limiter</span> ={" "}
              <span className="kw">new</span> <span className="fn">MCPOutputLimiter</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 로그 서버: 뒷부분(최신)이 중요 → tail 전략"}</span>
              {"\n"}
              <span className="prop">limiter</span>.<span className="fn">setServerLimit</span>(
              <span className="str">&quot;log-server&quot;</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">strategy</span>: <span className="str">&quot;tail&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">maxTokens</span>: <span className="num">5000</span>,{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">
                {"// 문서 서버: 구조 보존이 중요 → smart 전략 + 높은 제한"}
              </span>
              {"\n"}
              <span className="prop">limiter</span>.<span className="fn">setServerLimit</span>(
              <span className="str">&quot;docs-server&quot;</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">strategy</span>: <span className="str">&quot;smart&quot;</span>
              ,{"\n"}
              {"  "}
              <span className="prop">maxTokens</span>: <span className="num">20000</span>,{"\n"}
              {"}"});
            </CodeBlock>

            {/* 통계 모니터링 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 사용 통계 모니터링
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              잘림 빈도와 절약된 토큰 수를 확인할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">stats</span> ={" "}
              <span className="prop">limiter</span>.<span className="fn">getStats</span>();
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">`총 호출: ${"{"}</span>
              <span className="prop">stats</span>.<span className="prop">totalCalls</span>
              <span className="str">{"}"}`</span>);
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">`잘림 발생: ${"{"}</span>
              <span className="prop">stats</span>.<span className="prop">truncatedCalls</span>
              <span className="str">{"}"} 회`</span>);
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">`절약된 토큰: ${"{"}</span>
              <span className="prop">stats</span>.<span className="prop">totalTokensSaved</span>
              <span className="str">{"}"}`</span>);
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">`평균 원본 크기: ${"{"}</span>
              <span className="prop">stats</span>.
              <span className="prop">averageOriginalTokens</span>
              <span className="str">{"}"} 토큰`</span>);
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>resetStats()</code>로 통계를 초기화할 수 있습니다. 세션별로
              통계를 추적하려면 세션 시작 시 리셋하세요.
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
              Smart 잘림 전략 분기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">smartTruncate()</code>는 콘텐츠 형식을 자동 감지하여
              가장 적절한 잘림 방식을 선택합니다.
            </p>

            <MermaidDiagram
              title="Smart 잘림 전략 분기"
              titleColor="purple"
              chart={`graph TD
  INPUT["콘텐츠 입력"] --> CHK1{"JSON 형태?"}
  CHK1 -->|"Yes"| JSON["JSON 잘림<br/><small>최상위 키/요소 단위</small>"]
  CHK1 -->|"No"| CHK2{"Markdown 형태?"}
  CHK2 -->|"Yes"| MD["Markdown 잘림<br/><small>섹션 단위</small>"]
  CHK2 -->|"No"| TXT["텍스트 잘림<br/><small>단락 경계</small>"]
  JSON -->|"파싱 실패"| TXT

  JSON --> OUT["잘린 콘텐츠<br/>+ 요약 메시지"]
  MD --> OUT
  TXT --> OUT

  style INPUT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style JSON fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style MD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style TXT fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style OUT fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              JSON 잘림 핵심 코드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              JSON 객체는 최상위 키를 하나씩 추가하면서 제한을 초과하면 중단합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 객체: 키 단위로 점진적 추가"}</span>
              {"\n"}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">key</span> <span className="kw">of</span>{" "}
              <span className="prop">keys</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">candidate</span> = {"{"} ...
              <span className="prop">result</span>, [<span className="prop">key</span>]:{" "}
              <span className="prop">obj</span>[<span className="prop">key</span>] {"}"};{"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">json</span> ={" "}
              <span className="fn">JSON</span>.<span className="fn">stringify</span>(
              <span className="prop">candidate</span>, <span className="kw">null</span>,{" "}
              <span className="num">2</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">json</span>.
              <span className="prop">length</span> {">"} <span className="prop">maxChars</span>){" "}
              {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// 초과 시 해당 키를 '[truncated]'로 대체"}</span>
              {"\n"}
              {"    "}
              <span className="kw">break</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"  "}
              <span className="prop">result</span>[<span className="prop">key</span>] ={" "}
              <span className="prop">obj</span>[<span className="prop">key</span>];
              {"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">
                {"// 요약: [Truncated: 10000→5000 tokens. Kept 3/8 keys.]"}
              </span>
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">JSON 객체</strong> &mdash; 키를 하나씩 추가하다
                제한 초과 시 중단. 마지막 키는 <code className="text-cyan-600">[truncated]</code>{" "}
                플레이스홀더로 대체됩니다.
              </p>
              <p>
                <strong className="text-gray-900">JSON 배열</strong> &mdash; 요소를 하나씩 추가하다
                제한 초과 시 중단. 앞쪽 요소가 우선 보존됩니다.
              </p>
              <p>
                <strong className="text-gray-900">Markdown</strong> &mdash;{" "}
                <code className="text-cyan-600">
                  #{"{"}1,6{"}"}\s
                </code>{" "}
                패턴으로 섹션을 분리하고, 앞쪽 섹션부터 보존합니다.
              </p>
              <p>
                <strong className="text-gray-900">일반 텍스트</strong> &mdash; 빈 줄(
                <code className="text-cyan-600">\n\n</code>)로 단락을 분리하고, 단락 경계에서
                잘라냅니다.
              </p>
            </div>

            <DeepDive title="콘텐츠 형식 감지 로직">
              <p className="mb-3">콘텐츠 형식은 두 개의 헬퍼 함수로 감지합니다:</p>
              <CodeBlock>
                <span className="cm">{"// JSON 감지: 공백 제거 후 { 또는 [ 로 시작"}</span>
                {"\n"}
                <span className="kw">function</span> <span className="fn">looksLikeJson</span>(
                <span className="prop">content</span>): <span className="type">boolean</span> {"{"}
                {"\n"}
                {"  "}
                <span className="kw">return</span> <span className="prop">content</span>.
                <span className="fn">trimStart</span>().<span className="fn">startsWith</span>(
                <span className="str">&quot;{"{"}&quot;</span>) || ...;
                {"\n"}
                {"}"}
                {"\n"}
                {"\n"}
                <span className="cm">{"// Markdown 감지: 처음 20줄에서 패턴 탐색"}</span>
                {"\n"}
                <span className="kw">function</span> <span className="fn">looksLikeMarkdown</span>(
                <span className="prop">content</span>): <span className="type">boolean</span> {"{"}
                {"\n"}
                {"  "}
                <span className="cm">{"// # 헤딩, *** 수평선, ``` 코드블록"}</span>
                {"\n"}
                {"  "}
                <span className="kw">return</span> <span className="prop">lines</span>.
                <span className="fn">some</span>(<span className="prop">line</span> ={">"}{" "}
                <span className="prop">headingRegex</span>.<span className="fn">test</span>(
                <span className="prop">line</span>));
                {"\n"}
                {"}"}
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                감지 우선순위: JSON &gt; Markdown &gt; 일반 텍스트. JSON처럼 보이지만 파싱에
                실패하면 일반 텍스트로 폴백합니다.
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
                &quot;JSON 출력이 중간에 잘려서 구조가 깨졌어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">&quot;smart&quot;</code> 전략을 사용하면 JSON 구조를
                보존하며 잘라냅니다.
                <code className="text-cyan-600">&quot;head&quot;</code>나{" "}
                <code className="text-cyan-600">&quot;tail&quot;</code> 전략은 바이트 단위로
                자르므로 JSON이 깨질 수 있습니다. 전략 설정을 확인하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;실제 토큰 수와 추정치가 많이 차이나요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                토큰 추정은 <code className="text-cyan-600">4문자 = 1토큰</code> 비율을 사용합니다.
                한국어, 중국어 등 유니코드 문자는 실제로 더 많은 토큰을 소비하므로, 다국어
                콘텐츠에서는 추정치보다 실제 토큰이 더 많을 수 있습니다. 이 경우{" "}
                <code className="text-cyan-600">maxCharacters</code>를 낮게 설정하여 보정하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;특정 서버의 출력만 제한하고 싶어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">setServerLimit()</code>로 서버별 설정을 지정하세요.
                서버별 설정이 없는 서버는 전역 설정이 적용됩니다.
                <code className="text-cyan-600">getEffectiveConfig(serverName)</code>으로 해당
                서버에 적용되는 유효 설정을 확인할 수 있습니다.
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
                  name: "mcp/manager-connector.ts",
                  slug: "mcp-manager-connector",
                  relation: "parent",
                  desc: "OutputLimiter를 생성하고 limitToolOutput()을 호출하는 오케스트레이터",
                },
                {
                  name: "mcp/managed-config.ts",
                  slug: "mcp-managed-config",
                  relation: "sibling",
                  desc: "관리자가 maxOutputTokens를 서버별로 설정할 수 있는 정책 모듈",
                },
                {
                  name: "llm/token-counter.ts",
                  slug: "token-counter",
                  relation: "sibling",
                  desc: "tiktoken 기반 정확 토큰 계산 — OutputLimiter의 추정치와 비교용",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
