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

export default function CostTrackerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/llm/cost-tracker.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              CostTracker
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            토큰 비용 실시간 추적 &mdash; LLM API 호출의 토큰 사용량과 비용을 세션 단위로 누적 추적하는 모듈입니다.
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
              <code className="text-cyan-600">CostTracker</code>는 에이전트 세션 동안 발생하는
              모든 LLM 호출의 토큰 사용량과 비용을 기록합니다. 모델별 가격 정보를 기반으로
              자동으로 비용을 계산하며, 세션 종료 시 총 비용과 모델별 사용량 분석(breakdown)을 제공합니다.
            </p>
            <p>
              가격 정보는 <code className="text-cyan-600">model-capabilities</code> 모듈을
              단일 진실 공급원(single source of truth)으로 사용하여 중앙에서 관리됩니다.
              한 번 기록된 항목은 수정할 수 없는 불변(immutable) 데이터이며,
              Node.js의 단일 스레드 특성 덕분에 동시 접근 문제가 없습니다.
            </p>
            <p>
              에이전트 루프가 반복될 때마다 <code className="text-cyan-600">addFromTokenUsage()</code>로
              사용량을 기록하고, 세션 종료 시 <code className="text-cyan-600">getSummary()</code>로
              총 비용과 모델별 분석을 확인할 수 있습니다.
            </p>
          </div>

          <MermaidDiagram
            title="CostTracker 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AL["Agent Loop<br/><small>agent-loop.ts</small>"]
  LLM["LLM Client<br/><small>llm/client.ts</small>"]
  CT["CostTracker<br/><small>llm/cost-tracker.ts</small>"]
  MC["Model Capabilities<br/><small>llm/model-capabilities.ts</small>"]
  UI["Activity Feed<br/><small>components/ActivityFeed.tsx</small>"]

  AL -->|"매 LLM 호출 후"| CT
  LLM -->|"TokenUsage 반환"| AL
  CT -->|"가격 조회"| MC
  CT -->|"getSummary()"| UI

  style CT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style MC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style UI fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 택시의 미터기를 떠올리세요. 주행 중 거리와 시간을 실시간으로 누적하여
            최종 요금을 계산하듯, CostTracker는 매 LLM 호출마다 입력/출력 토큰 수를 누적하고
            모델별 단가를 적용하여 총 비용을 산출합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* ModelPricing interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ModelPricing
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            모델의 토큰 가격 정보입니다. USD 기준, 100만 토큰당 가격으로 표현됩니다.
          </p>
          <ParamTable
            params={[
              { name: "inputPerMillion", type: "number", required: true, desc: "입력 토큰 100만개당 가격 (USD)" },
              { name: "outputPerMillion", type: "number", required: true, desc: "출력 토큰 100만개당 가격 (USD)" },
            ]}
          />

          {/* TokenUsageEntry interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface TokenUsageEntry
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            하나의 토큰 사용 기록입니다. LLM 호출 한 번에 대한 사용량과 비용을 나타냅니다.
          </p>
          <ParamTable
            params={[
              { name: "model", type: "string", required: true, desc: "사용된 모델 이름 (예: \"gpt-4o\", \"claude-sonnet-4-20250514\")" },
              { name: "promptTokens", type: "number", required: true, desc: "입력(프롬프트)에 사용된 토큰 수" },
              { name: "completionTokens", type: "number", required: true, desc: "출력(응답)에 사용된 토큰 수" },
              { name: "totalTokens", type: "number", required: true, desc: "총 토큰 수 (prompt + completion)" },
              { name: "cost", type: "number", required: true, desc: "이 호출의 비용 (USD) — 모델 가격 기반 자동 계산" },
              { name: "timestamp", type: "number", required: true, desc: "기록 시간 (Unix timestamp, 밀리초)" },
              { name: "iteration", type: "number", required: true, desc: "에이전트 루프의 몇 번째 반복에서 발생했는지" },
            ]}
          />

          {/* CostSummary interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface CostSummary
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            전체 세션의 비용 요약입니다. 누적된 모든 사용 기록의 집계 결과를 담고 있습니다.
          </p>
          <ParamTable
            params={[
              { name: "totalCost", type: "number", required: true, desc: "총 비용 (USD)" },
              { name: "totalTokens", type: "number", required: true, desc: "총 토큰 수" },
              { name: "totalPromptTokens", type: "number", required: true, desc: "총 입력 토큰 수" },
              { name: "totalCompletionTokens", type: "number", required: true, desc: "총 출력 토큰 수" },
              { name: "entries", type: "readonly TokenUsageEntry[]", required: true, desc: "모든 사용 기록의 배열 (시간순)" },
              { name: "modelBreakdown", type: "ReadonlyMap<string, {tokens, cost}>", required: true, desc: "모델별 사용량 분석 — 어떤 모델에서 얼마나 소비했는지" },
            ]}
          />

          {/* getModelPricing function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function getModelPricing(modelName)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            모델 이름으로 가격 정보를 조회합니다.
            <code className="text-cyan-600">model-capabilities</code> 모듈을 단일 진실 공급원으로 사용합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">getModelPricing</span>(<span className="prop">modelName</span>: <span className="type">string</span>): <span className="type">ModelPricing</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "modelName", type: "string", required: true, desc: "모델 이름 (예: \"gpt-4o\")" },
            ]}
          />

          {/* calculateCost function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function calculateCost(model, promptTokens, completionTokens)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            토큰 사용량과 모델 정보로 비용(USD)을 계산합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">calculateCost</span>(
            {"\n"}{"  "}<span className="prop">model</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">promptTokens</span>: <span className="type">number</span>,
            {"\n"}{"  "}<span className="prop">completionTokens</span>: <span className="type">number</span>,
            {"\n"}): <span className="type">number</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "model", type: "string", required: true, desc: "모델 이름" },
              { name: "promptTokens", type: "number", required: true, desc: "입력 토큰 수" },
              { name: "completionTokens", type: "number", required: true, desc: "출력 토큰 수" },
            ]}
          />

          {/* CostTracker class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class CostTracker
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            에이전트 세션의 LLM 사용량과 비용을 누적 추적하는 메인 클래스입니다.
            한 번 기록된 항목은 수정할 수 없는 불변 데이터입니다.
          </p>

          {/* addUsage */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            addUsage(entry)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            사용 기록을 추가합니다. 비용(cost)과 타임스탬프(timestamp)는 자동 생성됩니다.
          </p>
          <CodeBlock>
            <span className="fn">addUsage</span>(<span className="prop">entry</span>: <span className="type">Omit&lt;TokenUsageEntry, &quot;cost&quot; | &quot;timestamp&quot;&gt;</span>): <span className="type">void</span>
          </CodeBlock>

          {/* addFromTokenUsage */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            addFromTokenUsage(model, usage, iteration)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            TokenUsage 객체에서 직접 사용 기록을 추가하는 편의 메서드입니다.
            에이전트 루프에서 주로 사용합니다.
          </p>
          <CodeBlock>
            <span className="fn">addFromTokenUsage</span>(
            {"\n"}{"  "}<span className="prop">model</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">usage</span>: <span className="type">TokenUsage</span>,
            {"\n"}{"  "}<span className="prop">iteration</span>: <span className="type">number</span>,
            {"\n"}): <span className="type">void</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "model", type: "string", required: true, desc: "모델 이름" },
              { name: "usage", type: "TokenUsage", required: true, desc: "TokenUsage 객체 (promptTokens, completionTokens, totalTokens)" },
              { name: "iteration", type: "number", required: true, desc: "에이전트 루프의 반복 번호" },
            ]}
          />

          {/* getSummary */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getSummary()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            모든 기록의 집계 요약을 반환합니다. 총 비용, 총 토큰 수, 모델별 사용량 분석을 포함합니다.
          </p>
          <CodeBlock>
            <span className="fn">getSummary</span>(): <span className="type">CostSummary</span>
          </CodeBlock>

          {/* reset */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            reset()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            모든 기록을 초기화합니다. 새 세션 시작 시 사용합니다.
          </p>
          <CodeBlock>
            <span className="fn">reset</span>(): <span className="type">void</span>
          </CodeBlock>

          {/* entryCount */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            get entryCount
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            기록된 항목 수를 반환하는 getter 프로퍼티입니다.
          </p>
          <CodeBlock>
            <span className="kw">get</span> <span className="prop">entryCount</span>: <span className="type">number</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">getSummary()</code>가 반환하는 <code className="text-cyan-600">entries</code>는
              원본 배열의 <strong>복사본</strong>입니다. 반환된 배열을 수정해도 내부 상태에는 영향이 없습니다.
            </li>
            <li>
              <code className="text-cyan-600">modelBreakdown</code>의 Map은 참조 타입이므로,
              내부 값을 직접 수정하면 요약 데이터가 오염될 수 있습니다.
            </li>
            <li>
              <code className="text-cyan-600">reset()</code>은 <code className="text-cyan-600">_entries.length = 0</code>으로
              배열을 비웁니다. 새 배열을 할당하지 않으므로 기존 참조가 유지됩니다.
            </li>
            <li>
              모든 가격 정보는 <code className="text-cyan-600">model-capabilities</code> 모듈에서 중앙 관리됩니다.
              가격을 변경하려면 해당 모듈을 수정해야 합니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 에이전트 루프에서 비용 추적하기</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 일반적인 사용 패턴입니다. 에이전트 루프에서 LLM 호출 후
            반환된 TokenUsage를 기록하고, 세션 종료 시 요약을 확인합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. CostTracker 인스턴스 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">tracker</span> = <span className="kw">new</span> <span className="fn">CostTracker</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 에이전트 루프에서 매 LLM 호출 후 기록"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">response</span> = <span className="kw">await</span> <span className="fn">llmClient</span>.<span className="fn">chat</span>(<span className="prop">messages</span>);
            {"\n"}<span className="prop">tracker</span>.<span className="fn">addFromTokenUsage</span>(
            {"\n"}{"  "}<span className="str">&quot;gpt-4o&quot;</span>,
            {"\n"}{"  "}<span className="prop">response</span>.<span className="prop">usage</span>,
            {"\n"}{"  "}<span className="prop">currentIteration</span>,
            {"\n"});
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 세션 종료 시 요약 확인"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">summary</span> = <span className="prop">tracker</span>.<span className="fn">getSummary</span>();
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">{"`총 비용: $${summary.totalCost.toFixed(4)}`"}</span>);
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">{"`총 토큰: ${summary.totalTokens}`"}</span>);
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>addFromTokenUsage()</code>를 호출하지 않으면 비용이 기록되지 않습니다.
            에이전트 루프에서 <strong>매 LLM 호출 후</strong> 반드시 호출하세요.
            빠뜨리면 실제 비용과 추적 비용이 불일치합니다.
          </Callout>

          {/* 고급 사용법: 모델별 분석 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 모델별 사용량 분석
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">modelBreakdown</code>으로 어떤 모델이 비용을 가장 많이 사용했는지 분석할 수 있습니다.
            듀얼 모델(Sonnet + Haiku) 사용 시 특히 유용합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">summary</span> = <span className="prop">tracker</span>.<span className="fn">getSummary</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 모델별 비용 분석"}</span>
            {"\n"}<span className="kw">for</span> (<span className="kw">const</span> [<span className="prop">model</span>, <span className="prop">data</span>] <span className="kw">of</span> <span className="prop">summary</span>.<span className="prop">modelBreakdown</span>) {"{"}
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">{"`${model}: ${data.tokens} tokens, $${data.cost.toFixed(4)}`"}</span>);
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 출력 예시:"}</span>
            {"\n"}<span className="cm">{"// gpt-4o: 12500 tokens, $0.0375"}</span>
            {"\n"}<span className="cm">{"// gpt-4o-mini: 8200 tokens, $0.0012"}</span>
          </CodeBlock>

          {/* 고급 사용법: 비용 계산 직접 사용 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 비용 계산 함수 직접 사용
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">calculateCost()</code>를 독립적으로 호출하여
            CostTracker 없이 단일 호출의 비용을 계산할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{ "}<span className="fn">calculateCost</span>{" }"} <span className="kw">from</span> <span className="str">&quot;./cost-tracker.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 단일 호출 비용 계산"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">cost</span> = <span className="fn">calculateCost</span>(
            {"\n"}{"  "}<span className="str">&quot;gpt-4o&quot;</span>,
            {"\n"}{"  "}<span className="num">1000</span>,{"  "}<span className="cm">{"// 입력 토큰"}</span>
            {"\n"}{"  "}<span className="num">500</span>,{"   "}<span className="cm">{"// 출력 토큰"}</span>
            {"\n"});
            {"\n"}<span className="cm">{"// 계산식: (1000/1M * inputRate) + (500/1M * outputRate)"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>calculateCost()</code>는 순수 함수입니다. 부작용이 없으므로
            예산 예측이나 비용 시뮬레이션에 독립적으로 사용할 수 있습니다.
          </Callout>

          <DeepDive title="reset()과 세션 관리">
            <p className="mb-3">
              <code className="text-cyan-600">reset()</code>은 내부 배열의 길이를 0으로 설정하여 모든 기록을 삭제합니다.
              새 배열을 할당하는 대신 <code className="text-cyan-600">_entries.length = 0</code>을 사용하여
              기존 참조를 유지합니다. 다음 상황에서 사용하세요:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li>새로운 대화/세션을 시작할 때</li>
              <li>사용자가 비용 카운터 초기화를 요청했을 때</li>
              <li>테스트에서 각 테스트 케이스 사이에 상태를 정리할 때</li>
            </ul>
            <p className="mt-3 text-amber-600">
              <code>reset()</code> 후에는 이전 <code>getSummary()</code> 반환값도 의미가 없어집니다.
              리셋 전에 필요한 데이터를 미리 저장해 두세요.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>비용 계산 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">addUsage()</code> 호출 시 내부에서 자동으로
            비용을 계산하고 타임스탬프를 부여하는 과정입니다.
          </p>

          <MermaidDiagram
            title="CostTracker 비용 계산 흐름"
            titleColor="purple"
            chart={`graph TD
  ADD["addUsage(entry)"] --> CALC["calculateCost()"]
  CALC --> PRICING["getModelPricing(model)"]
  PRICING --> CAPS["getModelCapabilities(model)"]
  CAPS --> RETURN["pricing.inputPerMillion<br/>pricing.outputPerMillion"]
  RETURN --> FORMULA["(input/1M * rate)<br/>+ (output/1M * rate)"]
  FORMULA --> PUSH["_entries.push({<br/>...entry, cost, timestamp<br/>})"]

  style ADD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style CALC fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style PRICING fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style CAPS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style RETURN fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style FORMULA fill:#dcfce7,stroke:#10b981,color:#065f46
  style PUSH fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">getSummary()</code> 메서드의 핵심 로직입니다.
            모든 기록을 순회하며 총 비용과 모델별 사용량을 집계합니다.
          </p>
          <CodeBlock>
            <span className="fn">getSummary</span>(): <span className="type">CostSummary</span> {"{"}
            {"\n"}{"  "}<span className="kw">let</span> <span className="prop">totalCost</span> = <span className="num">0</span>;
            {"\n"}{"  "}<span className="kw">let</span> <span className="prop">totalTokens</span> = <span className="num">0</span>;
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">breakdown</span> = <span className="kw">new</span> <span className="type">Map</span>();
            {"\n"}
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">entry</span> <span className="kw">of</span> <span className="kw">this</span>.<span className="prop">_entries</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// [1] 총 비용/토큰 누적"}</span>
            {"\n"}{"    "}<span className="prop">totalCost</span> += <span className="prop">entry</span>.<span className="prop">cost</span>;
            {"\n"}{"    "}<span className="prop">totalTokens</span> += <span className="prop">entry</span>.<span className="prop">totalTokens</span>;
            {"\n"}
            {"\n"}{"    "}<span className="cm">{"// [2] 모델별 집계 — 같은 모델의 사용량을 누적"}</span>
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">existing</span> = <span className="prop">breakdown</span>.<span className="fn">get</span>(<span className="prop">entry</span>.<span className="prop">model</span>);
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">existing</span>) {"{"}
            {"\n"}{"      "}<span className="prop">existing</span>.<span className="prop">tokens</span> += <span className="prop">entry</span>.<span className="prop">totalTokens</span>;
            {"\n"}{"      "}<span className="prop">existing</span>.<span className="prop">cost</span> += <span className="prop">entry</span>.<span className="prop">cost</span>;
            {"\n"}{"    "}<span className="kw">{"}"} else {"{"}</span>
            {"\n"}{"      "}<span className="prop">breakdown</span>.<span className="fn">set</span>(<span className="prop">entry</span>.<span className="prop">model</span>, {"{ "}
            {"\n"}{"        "}<span className="prop">tokens</span>: <span className="prop">entry</span>.<span className="prop">totalTokens</span>,
            {"\n"}{"        "}<span className="prop">cost</span>: <span className="prop">entry</span>.<span className="prop">cost</span>,
            {"\n"}{"      "});
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 원본 배열의 복사본을 반환하여 불변성 보장"}</span>
            {"\n"}{"  "}<span className="kw">return</span> {"{"} <span className="prop">totalCost</span>, <span className="prop">totalTokens</span>, ..., <span className="prop">entries</span>: [...<span className="kw">this</span>.<span className="prop">_entries</span>] {"}"};
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 모든 엔트리를 순회하며 총 비용과 토큰 수를 누적합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> Map을 사용하여 모델별로 토큰과 비용을 분리 집계합니다. 같은 모델이 이미 있으면 누적, 없으면 새로 추가합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> <code className="text-cyan-600">[...this._entries]</code>로 스프레드 복사하여 외부에서 원본을 변경할 수 없도록 보장합니다.</p>
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
              &quot;비용이 0으로 표시돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              두 가지 원인이 있을 수 있습니다:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>모델 가격 미등록:</strong> <code className="text-cyan-600">model-capabilities</code>에
                해당 모델의 pricing 정보가 없으면 기본값 0이 사용됩니다. 새 모델을 추가했다면 pricing도 함께 등록하세요.
              </li>
              <li>
                <strong>토큰 수가 0:</strong> LLM 응답의 usage 객체에서 promptTokens/completionTokens가 0으로 보고되는 경우입니다.
                LLM 클라이언트의 응답 파싱을 확인하세요.
              </li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;세션 중간에 비용 요약이 필요해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">getSummary()</code>는 언제든 호출할 수 있습니다.
              세션이 끝나지 않아도 현재까지의 누적 비용을 반환합니다.
              반환값은 스냅샷이므로 이후 기록이 추가되어도 이전 반환값은 변하지 않습니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;듀얼 모델 사용 시 모델별 비용을 구분하고 싶어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">getSummary().modelBreakdown</code>을 사용하세요.
              Map의 키가 모델 이름이고, 값에 해당 모델의 총 토큰 수와 비용이 들어있습니다.
              Sonnet과 Haiku의 비용을 별도로 확인하여 최적의 모델 배분을 찾을 수 있습니다.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;reset() 후에도 이전 데이터에 접근하고 싶어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">reset()</code> 호출 전에 <code className="text-cyan-600">getSummary()</code>를
              호출하여 결과를 저장해 두세요. <code className="text-cyan-600">entries</code>는 복사본이므로
              리셋 후에도 안전하게 참조할 수 있습니다.
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
                name: "model-capabilities.ts",
                slug: "model-capabilities",
                relation: "sibling",
                desc: "모델별 가격(pricing) 정보의 단일 진실 공급원 — CostTracker가 비용 계산에 사용",
              },
              {
                name: "llm-client.ts",
                slug: "llm-client",
                relation: "parent",
                desc: "LLM 호출 후 TokenUsage를 반환하는 클라이언트 — CostTracker에 데이터를 공급",
              },
              {
                name: "token-counter.ts",
                slug: "token-counter",
                relation: "sibling",
                desc: "토큰 수 사전 계산 유틸리티 — 비용 예측에 함께 사용 가능",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
