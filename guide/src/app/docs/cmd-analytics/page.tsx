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

export default function CmdAnalyticsPage() {
  return (
    <div className="min-h-screen pt-10 pb-20">
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/analytics.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/analytics</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              현재 세션의 토큰 사용량, 비용, 모델 분포, 도구 빈도 등 종합 분석 메트릭을 표시하는
              명령어입니다.
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
                <code className="text-cyan-600">/analytics</code>는{" "}
                <code className="text-cyan-600">/stats</code>보다 더 상세한 세션 분석 정보를
                제공합니다. 세션 개요(지속 시간, 모델, 턴 수), 토큰 사용량과 비용 추정, 모델별 분포
                차트, 도구 사용 빈도/성공률, 에이전트 성능 지표, 토큰 캐시 통계, 활동 타임라인을
                종합적으로 보여줍니다.
              </p>
              <p>
                텔레메트리(telemetry) 시스템에서 수집한 카운터와 히스토그램 데이터를 기반으로 실시간
                분석을 수행합니다. 모든 데이터는 현재 세션 범위로 한정되며, 세션이 종료되면
                초기화됩니다.
              </p>
              <p>
                텍스트 기반 막대 차트(<code className="text-cyan-600">makeBar()</code>)를 사용하여
                터미널에서도 시각적으로 데이터를 확인할 수 있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="/analytics 데이터 흐름"
              titleColor="purple"
              chart={`graph TD
  USER["사용자 입력<br/><small>/analytics</small>"]
  CMD["analyticsCommand<br/><small>analytics.ts</small>"]
  METRICS["Telemetry Metrics<br/><small>metrics.ts</small>"]
  STATS["Stats Helpers<br/><small>stats.ts</small>"]
  COST["Cost Formatter<br/><small>cost.ts</small>"]
  CAPS["Model Capabilities<br/><small>model-capabilities.ts</small>"]
  CACHE["Token Cache<br/><small>token-counter.ts</small>"]

  USER -->|"슬래시 명령"| CMD
  CMD -->|"카운터/히스토그램"| METRICS
  CMD -->|"formatDuration, getToolBreakdown"| STATS
  CMD -->|"formatCost"| COST
  CMD -->|"가격 정보"| CAPS
  CMD -->|"캐시 통계"| CACHE

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style METRICS fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style STATS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style COST fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CAPS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CACHE fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 자동차의 대시보드를 떠올리세요. 속도계, 연료계, 주행거리, 엔진
              온도 등을 한눈에 보여주듯, <code>/analytics</code>는 세션의 &quot;주행 현황&quot;을
              종합적으로 대시보드 형태로 보여줍니다.
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

            {/* getModelDistribution */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              getModelDistribution()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              텔레메트리 카운터에서 모델별 입력/출력 토큰 분포를 수집합니다. 총 토큰 수 기준
              내림차순으로 정렬된 배열을 반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">getModelDistribution</span>():{" "}
              <span className="type">ReadonlyArray</span>&lt;{"{"}
              {"\n"}
              {"  "}
              <span className="prop">model</span>: <span className="type">string</span>;{"\n"}
              {"  "}
              <span className="prop">inputTokens</span>: <span className="type">number</span>;{"\n"}
              {"  "}
              <span className="prop">outputTokens</span>: <span className="type">number</span>;
              {"\n"}
              {"}"}&gt;
            </CodeBlock>

            {/* getToolSuccessRate */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              getToolSuccessRate()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              도구 호출의 성공률을 계산합니다. 전체 호출 수, 성공 수, 실패 수, 백분율을 반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">getToolSuccessRate</span>(): {"{"}
              {"\n"}
              {"  "}
              <span className="prop">total</span>: <span className="type">number</span>;{"\n"}
              {"  "}
              <span className="prop">succeeded</span>: <span className="type">number</span>;{"\n"}
              {"  "}
              <span className="prop">failed</span>: <span className="type">number</span>;{"\n"}
              {"  "}
              <span className="prop">rate</span>: <span className="type">number</span>;{"  "}
              <span className="cm">// 0-100 백분율</span>
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* getAverageIterations */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              getAverageIterations()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              에이전트 루프의 요청당 평균 반복 횟수를 계산합니다. 히스토그램 데이터가 없으면 0을
              반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">getAverageIterations</span>():{" "}
              <span className="type">number</span>
            </CodeBlock>

            {/* makeBar / formatPercent */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              makeBar(length, maxLength?) / formatPercent(value)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              터미널 출력용 헬퍼 함수들입니다.
            </p>
            <ParamTable
              params={[
                { name: "length", type: "number", required: true, desc: "막대 길이 (0 이상)" },
                {
                  name: "maxLength",
                  type: "number",
                  required: false,
                  desc: "최대 막대 길이 (기본값: 20)",
                },
                {
                  name: "value",
                  type: "number",
                  required: true,
                  desc: '백분율 값 (예: 85.123 → "85.1%")',
                },
              ]}
            />

            {/* 출력 섹션 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              출력 섹션 구성
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2">
              <p>
                <strong className="text-gray-900">1. Overview</strong> &mdash; 세션 지속 시간, 활성
                모델, 세션 ID, 사용자 턴 수
              </p>
              <p>
                <strong className="text-gray-900">2. Token Usage</strong> &mdash; 입력/출력/전체
                토큰 수 + 추정 비용
              </p>
              <p>
                <strong className="text-gray-900">3. Model Distribution</strong> &mdash; 모델별 토큰
                비율 + 막대 차트 (모델이 여러 개일 때만)
              </p>
              <p>
                <strong className="text-gray-900">4. Tool Usage</strong> &mdash; 전체 호출 수,
                성공/실패 수, 성공률
              </p>
              <p>
                <strong className="text-gray-900">5. Tool Frequency</strong> &mdash; 도구별 호출
                빈도 + 막대 차트
              </p>
              <p>
                <strong className="text-gray-900">6. Agent Performance</strong> &mdash; 요청당 평균
                반복 횟수, LLM 에러 수
              </p>
              <p>
                <strong className="text-gray-900">7. Token Cache</strong> &mdash; 캐시 크기,
                히트/미스 수, 히트율
              </p>
              <p>
                <strong className="text-gray-900">8. Activity Timeline</strong> &mdash; 분당 턴 수,
                분당 토큰 수
              </p>
            </div>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                비용 추정은 <code className="text-cyan-600">getModelCapabilities()</code>의 가격
                정보를 기반으로 합니다. 실제 청구 금액과 다를 수 있습니다 (캐시 할인, 배치 할인 등
                미반영).
              </li>
              <li>
                <code className="text-cyan-600">sessionStartedAt</code>은 모듈 로드 시점의
                타임스탬프입니다. dbcode 프로세스 시작 시각과 약간의 차이가 있을 수 있습니다.
              </li>
              <li>
                도구 성공률에서 <code className="text-cyan-600">tool=&quot;*&quot;</code> 와일드카드
                카운터는 이중 집계를 방지하기 위해 제외됩니다.
              </li>
              <li>
                Activity Timeline의 토큰/분은 세션이 1분 미만일 때 &quot;({"<"} 1 min)&quot;으로
                표시됩니다.
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
              기본 사용법
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자 없이 <code className="text-cyan-600">/analytics</code>를 입력하면 전체 세션
              분석이 표시됩니다.
            </p>
            <CodeBlock>
              <span className="str">/analytics</span>
              {"\n"}
              {"\n"}
              <span className="prop">Session Analytics</span>
              {"\n"}
              <span className="prop">==================</span>
              {"\n"}
              {"\n"}
              {"  "}
              <span className="prop">Overview</span>
              {"\n"}
              {"  "}--------
              {"\n"}
              {"    "}Duration: 12m 34s
              {"\n"}
              {"    "}Active Model: gpt-4o
              {"\n"}
              {"    "}Session: abc-123-def
              {"\n"}
              {"    "}User Turns: 8{"\n"}
              {"\n"}
              {"  "}
              <span className="prop">Token Usage</span>
              {"\n"}
              {"  "}-----------
              {"\n"}
              {"    "}Input: 24,150
              {"\n"}
              {"    "}Output: 8,432
              {"\n"}
              {"    "}Total: 32,582
              {"\n"}
              {"    "}Est. Cost: $0.12
              {"\n"}
              {"\n"}
              {"  "}
              <span className="prop">Model Distribution</span>
              {"\n"}
              {"  "}------------------
              {"\n"}
              {"    "}gpt-4o 78.2% <span className="str">{"████████████"}</span>
              {"\n"}
              {"    "}gpt-4o-mini 21.8% <span className="str">{"███"}</span>
              {"\n"}
              {"\n"}
              {"  "}
              <span className="prop">Tool Usage</span>
              {"\n"}
              {"  "}----------
              {"\n"}
              {"    "}Total Invocations: 42
              {"\n"}
              {"    "}Succeeded: 40
              {"\n"}
              {"    "}Failed: 2{"\n"}
              {"    "}Success Rate: 95.2%
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 비용 추정(<code>Est. Cost</code>)은 모델의 공식 가격표
              기준이며, 실제 청구 금액과 다를 수 있습니다. 캐시 할인, 배치 할인, 프리 티어 등은
              반영되지 않습니다.
            </Callout>

            {/* /stats와의 차이 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; /stats와 /analytics 비교
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">/stats</code>는 핵심 지표만 간단히 보여주고,
              <code className="text-cyan-600">/analytics</code>는 모델 분포, 도구 빈도, 캐시 통계,
              활동 타임라인 등 심층 분석을 제공합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// /stats — 핵심 지표 요약"}</span>
              {"\n"}
              <span className="prop">Tokens</span>: 32,582 | <span className="prop">Cost</span>:
              $0.12 | <span className="prop">Duration</span>: 12m 34s
              {"\n"}
              {"\n"}
              <span className="cm">{"// /analytics — 위 내용 + 아래 추가 분석"}</span>
              {"\n"}
              <span className="prop">Model Distribution</span>,{" "}
              <span className="prop">Tool Frequency</span>,{" "}
              <span className="prop">Token Cache</span>,{"\n"}
              <span className="prop">Agent Performance</span>,{" "}
              <span className="prop">Activity Timeline</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 비용이 높다면 Model Distribution을 확인하세요. 비싼 모델이
              불필요하게 많이 사용되고 있다면 <code>/model</code>로 비용 효율적인 모델로 전환할 수
              있습니다.
            </Callout>

            <DeepDive title="비용 계산 로직 상세">
              <p className="mb-3">비용은 두 가지 소스에서 결정됩니다:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>trackedCost:</strong> 텔레메트리에서 직접 추적한 비용 (있으면 우선 사용)
                </li>
                <li>
                  <strong>calculatedCost:</strong> 토큰 수 x 모델 가격으로 계산한 추정 비용
                  (trackedCost가 0일 때)
                </li>
              </ul>
              <CodeBlock>
                <span className="cm">{"// trackedCost가 있으면 그대로 사용, 없으면 계산"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">totalCost</span> ={" "}
                <span className="prop">trackedCost</span> {">"} <span className="num">0</span>
                {"\n"}
                {"  "}? <span className="prop">trackedCost</span>
                {"\n"}
                {"  "}: <span className="prop">calculatedInputCost</span> +{" "}
                <span className="prop">calculatedOutputCost</span>;
              </CodeBlock>
              <p className="mt-3 text-amber-600">
                <code className="text-cyan-600">getModelCapabilities()</code>의 pricing 정보가 실제
                과금 체계와 다를 수 있으므로, 정확한 비용은 API 프로바이더의 사용량 대시보드에서
                확인하세요.
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
              데이터 수집 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">/analytics</code>는 여러 데이터 소스에서 메트릭을
              수집합니다.
            </p>

            <MermaidDiagram
              title="메트릭 수집 및 집계"
              titleColor="purple"
              chart={`graph LR
  COUNTERS["Counters<br/><small>tokensUsed, tokenCost,<br/>toolInvocations, errors</small>"]
  HISTOGRAMS["Histograms<br/><small>agentIterations</small>"]
  CONTEXT["CommandContext<br/><small>model, sessionId, messages</small>"]
  CACHE["TokenCacheStats<br/><small>size, hits, misses, hitRate</small>"]

  COUNTERS --> COLLECT["데이터 수집"]
  HISTOGRAMS --> COLLECT
  CONTEXT --> COLLECT
  CACHE --> COLLECT
  COLLECT --> DIST["getModelDistribution()"]
  COLLECT --> RATE["getToolSuccessRate()"]
  COLLECT --> AVG["getAverageIterations()"]
  COLLECT --> FORMAT["텍스트 포맷팅<br/><small>makeBar(), formatPercent()</small>"]
  FORMAT --> OUTPUT["터미널 출력"]

  style COLLECT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style OUTPUT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              모델별 토큰 분포를 수집하는{" "}
              <code className="text-cyan-600">getModelDistribution()</code>의 핵심 로직입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 카운터 키에서 model=, type= 라벨을 정규식으로 추출"}</span>
              {"\n"}
              <span className="kw">for</span> (<span className="kw">const</span> [
              <span className="prop">key</span>, <span className="prop">values</span>]{" "}
              <span className="kw">of</span> <span className="prop">counterData</span>.
              <span className="fn">entries</span>()) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (!<span className="prop">key</span>.
              <span className="fn">startsWith</span>(<span className="prop">tokenPrefix</span>)){" "}
              <span className="kw">continue</span>;{"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">modelMatch</span> ={" "}
              <span className="prop">key</span>.<span className="fn">match</span>(
              <span className="str">/model=([^,{"}"}]+)/</span>);
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">typeMatch</span> ={" "}
              <span className="prop">key</span>.<span className="fn">match</span>(
              <span className="str">/type=(input|output)/</span>);
              {"\n"}
              {"  "}
              {"\n"}
              {"  "}
              <span className="cm">{"// Map에 모델별 input/output 토큰 누적"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">entry</span> ={" "}
              <span className="prop">models</span>.<span className="fn">get</span>(
              <span className="prop">model</span>)!;
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">type</span> ==={" "}
              <span className="str">&quot;input&quot;</span>) <span className="prop">entry</span>.
              <span className="prop">input</span> = <span className="prop">value</span>;{"\n"}
              {"  "}
              <span className="kw">else</span> <span className="prop">entry</span>.
              <span className="prop">output</span> = <span className="prop">value</span>;{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">카운터 키 포맷:</strong>{" "}
                <code className="text-cyan-600">tokens_used{"{model=gpt-4o,type=input}"}</code>{" "}
                형태의 키에서 정규식으로 라벨을 추출합니다.
              </p>
              <p>
                <strong className="text-gray-900">마지막 값 사용:</strong>{" "}
                <code className="text-cyan-600">values[values.length - 1].value</code> &mdash;
                카운터는 누적값이므로 마지막 값이 현재 총계입니다.
              </p>
              <p>
                <strong className="text-gray-900">내림차순 정렬:</strong> 총 토큰 수(input + output)
                기준으로 정렬하여 가장 많이 사용된 모델이 먼저 표시됩니다.
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
                &quot;토큰 수가 0으로 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                세션을 시작한 직후거나 아직 LLM 호출이 이루어지지 않았을 때 발생합니다. 대화를
                진행한 후 다시 <code className="text-cyan-600">/analytics</code>를 실행하세요.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                또한 텔레메트리 카운터의 모델 라벨이 현재 활성 모델과 일치하는지 확인하세요. 세션
                중간에 모델을 변경한 경우, 이전 모델의 토큰은 Model Distribution에서 확인할 수
                있습니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;비용 추정이 실제 청구 금액과 달라요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                추정 비용은 <code className="text-cyan-600">model-capabilities.ts</code>에 정의된
                가격표를 기반으로 합니다. 캐시 할인, 배치 할인, 프리 티어, 프롬프트 캐싱 등은
                반영되지 않습니다. 정확한 비용은 API 프로바이더(OpenAI, Anthropic 등)의 사용량
                대시보드에서 확인하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Model Distribution이 표시되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                단일 모델만 사용한 경우에도 표시됩니다. 하지만 텔레메트리 카운터에 모델별 데이터가
                기록되지 않았다면(예: 로컬 LLM에서 카운터 미지원) 섹션이 비어 있을 수 있습니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Avg Iterations/Request가 N/A로 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                에이전트 루프 히스토그램 데이터가 없을 때 표시됩니다. 대화를 더 진행하면 에이전트
                루프가 실행되고 평균 반복 횟수가 계산됩니다.
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
                  name: "token-counter.ts",
                  slug: "token-counter",
                  relation: "sibling",
                  desc: "토큰 캐시 통계(size, hits, misses, hitRate)를 제공하는 모듈",
                },
                {
                  name: "model-capabilities.ts",
                  slug: "model-capabilities",
                  relation: "sibling",
                  desc: "모델별 가격 정보(inputPerMillion, outputPerMillion)를 제공하는 모듈",
                },
                {
                  name: "cost-tracker.ts",
                  slug: "cost-tracker",
                  relation: "sibling",
                  desc: "실시간 비용 추적 — trackedCost 카운터의 데이터 소스",
                },
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "에이전트 반복 횟수 히스토그램(agentIterations)을 기록하는 메인 루프",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
