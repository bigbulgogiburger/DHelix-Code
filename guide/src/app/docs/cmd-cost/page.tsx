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

export default function CmdCostPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/cost.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/cost 비용 확인</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              현재 세션의 토큰 사용량, 예상 비용, 효율성 메트릭을 상세히 보여주는 슬래시
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
                <code className="text-cyan-600">/cost</code> 명령어는 API 비용을 투명하게 추적하기
                위한 도구입니다. 현재 세션에서 소비된 입력/출력 토큰 수, 모델별 가격 정보, 총 예상
                비용을 한눈에 보여줍니다.
              </p>
              <p>
                내부적으로 텔레메트리 시스템(<code className="text-cyan-600">metrics</code>)에서
                토큰 카운터를 읽고, 모델 능력 정보(
                <code className="text-cyan-600">getModelCapabilities</code>)에서 가격 정보를 가져와
                비용을 계산합니다. 추가로 턴당 비용, 턴당 토큰 수, 출력 비율 같은 효율성 메트릭도
                제공합니다.
              </p>
              <p>
                세 개의 유틸리티 함수(<code className="text-cyan-600">formatTokenCount</code>,
                <code className="text-cyan-600">formatCost</code>,
                <code className="text-cyan-600">calculateEfficiency</code>)가 export되어 다른
                모듈에서도 재사용할 수 있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="/cost 데이터 흐름"
              titleColor="purple"
              chart={`graph TD
  CMD["costCommand.execute()<br/><small>commands/cost.ts</small>"]
  METRICS["metrics.getCounter()<br/><small>telemetry/metrics.ts</small>"]
  CAPS["getModelCapabilities()<br/><small>llm/model-capabilities.ts</small>"]
  CALC["calculateEfficiency()<br/><small>효율성 메트릭 계산</small>"]
  FMT["formatTokenCount() +<br/>formatCost()<br/><small>포맷팅</small>"]
  OUT["터미널 출력<br/><small>Token Usage & Cost</small>"]

  CMD --> METRICS
  CMD --> CAPS
  METRICS -->|"입력/출력 토큰"| CALC
  CAPS -->|"가격 정보"| CMD
  CALC -->|"효율성 데이터"| FMT
  FMT --> OUT

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style METRICS fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CAPS fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CALC fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style FMT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style OUT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 통신사 앱에서 이번 달 데이터 사용량과 요금을 확인하는 것처럼,
              <code>/cost</code>는 현재 세션의 토큰 &quot;데이터 사용량&quot;과 &quot;요금&quot;을
              실시간으로 보여줍니다.
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

            {/* formatTokenCount */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              function formatTokenCount()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              토큰 수를 천 단위 구분자(,)와 함께 포맷하고 지정 너비로 우측 정렬합니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span>{" "}
              <span className="fn">formatTokenCount</span>(<span className="prop">n</span>:{" "}
              <span className="type">number</span>, <span className="prop">width</span>:{" "}
              <span className="type">number</span>): <span className="type">string</span>
            </CodeBlock>
            <ParamTable
              params={[
                { name: "n", type: "number", required: true, desc: "포맷할 토큰 수" },
                {
                  name: "width",
                  type: "number",
                  required: true,
                  desc: '최소 출력 너비 (우측 정렬 패딩, 예: 8 → "  12,345")',
                },
              ]}
            />

            {/* formatCost */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              function formatCost()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              달러 금액을 크기에 따라 적절한 소수점 자릿수로 포맷합니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span> <span className="fn">formatCost</span>(
              <span className="prop">cost</span>: <span className="type">number</span>):{" "}
              <span className="type">string</span>
            </CodeBlock>
            <ParamTable
              params={[{ name: "cost", type: "number", required: true, desc: "포맷할 달러 금액" }]}
            />
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-cyan-600">0</code> &rarr;{" "}
                <code>&quot;$0.00&quot;</code>
              </p>
              <p>
                &bull; <code className="text-cyan-600">0.0023</code> &rarr;{" "}
                <code>&quot;$0.0023&quot;</code> (소수점 4자리)
              </p>
              <p>
                &bull; <code className="text-cyan-600">0.123</code> &rarr;{" "}
                <code>&quot;$0.123&quot;</code> (소수점 3자리)
              </p>
              <p>
                &bull; <code className="text-cyan-600">1.5</code> &rarr;{" "}
                <code>&quot;$1.50&quot;</code> (소수점 2자리)
              </p>
            </div>

            {/* calculateEfficiency */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              function calculateEfficiency()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              토큰 사용량과 턴 수로부터 효율성 메트릭을 계산합니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span>{" "}
              <span className="fn">calculateEfficiency</span>({"\n"}{" "}
              <span className="prop">inputTokens</span>: <span className="type">number</span>,{"\n"}{" "}
              <span className="prop">outputTokens</span>: <span className="type">number</span>,
              {"\n"} <span className="prop">totalCost</span>: <span className="type">number</span>,
              {"\n"} <span className="prop">turns</span>: <span className="type">number</span>
              {"\n"}): {"{"} <span className="kw">readonly</span>{" "}
              <span className="prop">costPerTurn</span>: <span className="type">number</span>;{" "}
              <span className="prop">tokensPerTurn</span>: <span className="type">number</span>;{" "}
              <span className="prop">outputRatio</span>: <span className="type">number</span> {"}"}
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "inputTokens",
                  type: "number",
                  required: true,
                  desc: "입력 토큰 수 (사용자 메시지 + 시스템 프롬프트)",
                },
                {
                  name: "outputTokens",
                  type: "number",
                  required: true,
                  desc: "출력 토큰 수 (LLM이 생성한 텍스트)",
                },
                { name: "totalCost", type: "number", required: true, desc: "총 비용 (달러)" },
                { name: "turns", type: "number", required: true, desc: "사용자 턴 수 (대화 회차)" },
              ]}
            />
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <strong>costPerTurn</strong> &mdash; 턴당 평균 비용 (totalCost / turns)
              </p>
              <p>
                &bull; <strong>tokensPerTurn</strong> &mdash; 턴당 평균 토큰 수 (반올림)
              </p>
              <p>
                &bull; <strong>outputRatio</strong> &mdash; 출력 토큰 비율 (%, 높을수록 LLM이 많이
                생성)
              </p>
            </div>

            {/* costCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              const costCommand: SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">/cost</code> 슬래시 명령어의 등록 객체입니다.
            </p>
            <ParamTable
              params={[
                { name: "name", type: '"cost"', required: true, desc: "명령어 이름" },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: '"Show token usage and cost breakdown"',
                },
                { name: "usage", type: "string", required: true, desc: '"/cost"' },
                {
                  name: "execute",
                  type: "(args, context) => Promise<CommandResult>",
                  required: true,
                  desc: "명령어 실행 함수",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                비용은 <strong>예상치</strong>입니다. 텔레메트리에 기록된{" "}
                <code className="text-cyan-600">trackedCost</code>가 있으면 그 값을 사용하고, 없으면
                토큰 수와 가격 정보로 직접 계산합니다.
              </li>
              <li>
                <code className="text-cyan-600">turns</code>는{" "}
                <code className="text-cyan-600">context.messages</code>에서
                <code className="text-cyan-600">role === &quot;user&quot;</code>인 메시지 수로
                계산됩니다. 시스템 메시지는 턴에 포함되지 않습니다.
              </li>
              <li>
                턴이 0이면 효율성 메트릭이 모두 0으로 표시되고 &quot;No turns recorded yet.&quot;
                메시지가 나옵니다.
              </li>
              <li>
                마지막에 <code className="text-cyan-600">/model</code>로 저렴한 모델 전환을 제안하는
                팁이 항상 포함됩니다.
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
              기본 사용법 &mdash; 비용 확인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자 없이 <code className="text-cyan-600">/cost</code>만 입력하면 현재 세션의 전체
              비용 정보가 출력됩니다.
            </p>
            <CodeBlock>
              <span className="fn">/cost</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 예시:"}</span>
              {"\n"}
              <span className="cm">{"// Token Usage & Cost"}</span>
              {"\n"}
              <span className="cm">{"// ==================="}</span>
              {"\n"}
              <span className="cm">{"// "}</span>
              {"\n"}
              <span className="cm">{"//   Current Model: gpt-4o-mini"}</span>
              {"\n"}
              <span className="cm">{"// "}</span>
              {"\n"}
              <span className="cm">{"//   Token Breakdown:"}</span>
              {"\n"}
              <span className="cm">{"//     Input:   45,230  ($0.0068)"}</span>
              {"\n"}
              <span className="cm">{"//     Output:  12,840  ($0.0077)"}</span>
              {"\n"}
              <span className="cm">{"//     Total:   58,070"}</span>
              {"\n"}
              <span className="cm">{"// "}</span>
              {"\n"}
              <span className="cm">{"//   Estimated Cost: $0.0145"}</span>
              {"\n"}
              <span className="cm">{"// "}</span>
              {"\n"}
              <span className="cm">{"//   Pricing:"}</span>
              {"\n"}
              <span className="cm">{"//     Input:  $0.15 / 1M tokens"}</span>
              {"\n"}
              <span className="cm">{"//     Output: $0.60 / 1M tokens"}</span>
              {"\n"}
              <span className="cm">{"// "}</span>
              {"\n"}
              <span className="cm">{"//   Efficiency:"}</span>
              {"\n"}
              <span className="cm">{"//     Cost per turn: $0.0029"}</span>
              {"\n"}
              <span className="cm">{"//     Tokens per turn: ~11,614"}</span>
              {"\n"}
              <span className="cm">{"//     Output ratio: 22.1%"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 비용은 세션 내 누적치입니다. 세션을 재시작하면 카운터가
              리셋됩니다. 전체 사용량을 추적하려면 외부 대시보드(예: OpenAI Usage 페이지)를
              확인하세요.
            </Callout>

            {/* 유틸리티 함수 재사용 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 유틸리티 함수 재사용
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">formatTokenCount</code>,{" "}
              <code className="text-cyan-600">formatCost</code>,
              <code className="text-cyan-600">calculateEfficiency</code>는 export되어 다른
              모듈에서도 사용할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="prop">formatCost</span>,{" "}
              <span className="prop">calculateEfficiency</span> {"}"}{" "}
              <span className="kw">from</span>{" "}
              <span className="str">&quot;./commands/cost.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 비용 포맷팅"}</span>
              {"\n"}
              <span className="fn">formatCost</span>(<span className="num">0.0023</span>);{" "}
              <span className="cm">{'// → "$0.0023"'}</span>
              {"\n"}
              <span className="fn">formatCost</span>(<span className="num">1.5</span>);{" "}
              <span className="cm">{'// → "$1.50"'}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 효율성 계산"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">eff</span> ={" "}
              <span className="fn">calculateEfficiency</span>(<span className="num">50000</span>,{" "}
              <span className="num">15000</span>, <span className="num">0.05</span>,{" "}
              <span className="num">5</span>);
              {"\n"}
              <span className="cm">
                {"// → { costPerTurn: 0.01, tokensPerTurn: 13000, outputRatio: 23.1 }"}
              </span>
            </CodeBlock>

            <DeepDive title="formatCost 정밀도 선택 로직 상세">
              <p className="mb-3">금액의 크기에 따라 다른 소수점 자릿수를 적용하는 이유:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>$0</strong> &mdash; 비용이 없으면 <code>&quot;$0.00&quot;</code>으로
                  명확하게 표시
                </li>
                <li>
                  <strong>$0.01 미만</strong> &mdash; API 비용이 매우 작을 때 (예: gpt-4o-mini),
                  소수점 4자리까지 표시해야 의미 있는 숫자가 보임
                </li>
                <li>
                  <strong>$0.01 ~ $1</strong> &mdash; 일반적인 세션 비용, 소수점 3자리로 충분
                </li>
                <li>
                  <strong>$1 이상</strong> &mdash; 큰 비용은 센트 단위까지만 표시
                </li>
              </ul>
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
              비용 계산 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              비용은 두 가지 경로로 결정됩니다: 텔레메트리에 이미 기록된 비용이 있으면 그 값을
              사용하고, 없으면 토큰 수와 모델 가격으로 직접 계산합니다.
            </p>

            <MermaidDiagram
              title="비용 계산 결정 트리"
              titleColor="purple"
              chart={`graph TD
  START(("execute 호출")) --> READ["metrics.getCounter()<br/><small>입력/출력 토큰 읽기</small>"]
  READ --> TRACKED["trackedCost 조회<br/><small>metrics에 기록된 비용</small>"]
  TRACKED -->|"trackedCost > 0"| USE_TRACKED["trackedCost 사용"]
  TRACKED -->|"trackedCost = 0"| CALC["직접 계산<br/><small>tokens / 1M * price</small>"]
  CALC --> TOTAL["totalCost 결정"]
  USE_TRACKED --> TOTAL
  TOTAL --> EFF["calculateEfficiency()<br/><small>턴당 비용/토큰/비율</small>"]
  EFF --> FORMAT["포맷팅 + 출력"]

  style START fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style READ fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TRACKED fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style USE_TRACKED fill:#dcfce7,stroke:#10b981,color:#065f46
  style CALC fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style TOTAL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EFF fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style FORMAT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">calculateEfficiency()</code>의 핵심 로직입니다. 0
              나눗셈을 안전하게 처리합니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span>{" "}
              <span className="fn">calculateEfficiency</span>({"\n"}{" "}
              <span className="prop">inputTokens</span>: <span className="type">number</span>,{" "}
              <span className="prop">outputTokens</span>: <span className="type">number</span>,
              {"\n"} <span className="prop">totalCost</span>: <span className="type">number</span>,{" "}
              <span className="prop">turns</span>: <span className="type">number</span>
              {"\n"}) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">totalTokens</span> ={" "}
              <span className="prop">inputTokens</span> + <span className="prop">outputTokens</span>
              ;{"\n"}
              {"  "}
              <span className="cm">
                {"// [1] 턴이 0이면 모든 메트릭을 0으로 반환 (0 나눗셈 방지)"}
              </span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">turns</span> ==={" "}
              <span className="num">0</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">return</span> {"{"} <span className="prop">costPerTurn</span>:{" "}
              <span className="num">0</span>, <span className="prop">tokensPerTurn</span>:{" "}
              <span className="num">0</span>, <span className="prop">outputRatio</span>:{" "}
              <span className="num">0</span> {"}"};{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [2] 턴당 비용 = 총 비용 / 턴 수"}</span>
              {"\n"}
              {"    "}
              <span className="prop">costPerTurn</span>: <span className="prop">totalCost</span> /{" "}
              <span className="prop">turns</span>,{"\n"}
              {"    "}
              <span className="cm">{"// [3] 턴당 토큰 = 총 토큰 / 턴 수 (반올림)"}</span>
              {"\n"}
              {"    "}
              <span className="prop">tokensPerTurn</span>: <span className="fn">Math.round</span>(
              <span className="prop">totalTokens</span> / <span className="prop">turns</span>),
              {"\n"}
              {"    "}
              <span className="cm">{"// [4] 출력 비율 = 출력 토큰 / 총 토큰 * 100"}</span>
              {"\n"}
              {"    "}
              <span className="prop">outputRatio</span>: <span className="prop">totalTokens</span>{" "}
              {">"} <span className="num">0</span> ? (<span className="prop">outputTokens</span> /{" "}
              <span className="prop">totalTokens</span>) * <span className="num">100</span> :{" "}
              <span className="num">0</span>,{"\n"}
              {"  "}
              {"}"};{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 턴이 0인 경우는 세션 시작 직후이므로,
                0 나눗셈 대신 모든 값을 0으로 반환합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 턴당 비용이 높으면 모델 전환을 고려할
                신호입니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong>{" "}
                <code className="text-cyan-600">Math.round</code>로 반올림하여 읽기 쉬운 정수로
                표시합니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> 출력 비율이 높으면 LLM이 많이
                생성하고 있다는 뜻으로, 비용이 빠르게 증가할 수 있습니다.
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
                &quot;비용이 $0.00으로 표시돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                세션 시작 직후이거나 LLM 호출이 아직 발생하지 않은 경우입니다. 메시지를 몇 번
                주고받은 후 다시 <code className="text-cyan-600">/cost</code>를 실행하세요.
                텔레메트리 카운터가 올바르게 기록되고 있는지 확인하려면
                <code className="text-cyan-600">Ctrl+O</code>(verbose 모드)를 켜고 토큰 로그를
                확인하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;실제 API 청구액과 /cost 결과가 달라요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">/cost</code>는 로컬 텔레메트리 기반의{" "}
                <strong>예상치</strong>입니다. 실제 API 사업자의 청구는 캐시 히트, 배치 할인,
                프롬프트 캐싱 등으로 다를 수 있습니다. 정확한 비용은 API 제공자의 사용량
                대시보드에서 확인하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Efficiency 섹션에 &apos;No turns recorded yet.&apos;만 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">context.messages</code>에서{" "}
                <code className="text-cyan-600">role === &quot;user&quot;</code>인 메시지가 없는
                경우입니다. 명령어 레지스트리가 messages 배열을 context에 올바르게 전달하고 있는지
                확인하세요.
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
                  name: "model-capabilities.ts",
                  slug: "model-capabilities",
                  relation: "sibling",
                  desc: "모델별 가격 정보(pricing.inputPerMillion, outputPerMillion)를 제공하는 모듈",
                },
                {
                  name: "cost-tracker.ts",
                  slug: "cost-tracker",
                  relation: "sibling",
                  desc: "세션 전체의 비용을 추적하고 텔레메트리에 기록하는 모듈",
                },
                {
                  name: "token-counter.ts",
                  slug: "token-counter",
                  relation: "sibling",
                  desc: "토큰 수를 정확하게 계산하는 유틸리티 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
