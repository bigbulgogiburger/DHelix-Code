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

export default function LazyToolLoaderPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/tools/lazy-tool-loader.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Lazy Tool Loader
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            Deferred 도구 지연 로딩 — 모델 성능 등급에 따라 도구 스키마를 필요할 때만 로드하여 토큰 비용을 절약합니다.
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
              <code className="text-cyan-600">LazyToolLoader</code>는 도구가 수십~수백 개 있을 때
              모든 도구의 전체 스키마를 LLM에 보내지 않고, 성능 등급에 따라 전략적으로
              스키마를 관리하는 클래스입니다.
            </p>
            <p>
              전체 스키마를 한 번에 보내면 토큰 비용이 크게 증가하고, 모델의 주의(attention)가
              분산됩니다. 이 모듈은 고성능 모델에는 모든 스키마를 즉시 제공하고,
              저성능 모델에는 이름만 제공한 뒤 필요할 때 온디맨드(on-demand)로 전체 스키마를 로드합니다.
            </p>
            <p>
              3단계 전략: <code className="text-emerald-600">HIGH</code>(모든 도구 전체 스키마),
              <code className="text-amber-600">MEDIUM</code>(우선순위 도구 + 상위 10개만 전체 스키마),
              <code className="text-red-600">LOW</code>(모든 도구 이름만, 요청 시 로드).
            </p>
          </div>

          <MermaidDiagram
            title="Lazy Tool Loader 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  TR["Tool Registry<br/><small>tools/tool-registry.ts</small>"]
  LTL["Lazy Tool Loader<br/><small>tools/lazy-tool-loader.ts</small>"]
  AS["Adaptive Schema<br/><small>tools/adaptive-schema.ts</small>"]
  MC["Model Capabilities<br/><small>llm/model-capabilities.ts</small>"]
  LLM["LLM Client<br/><small>llm/client.ts</small>"]

  TR -->|"도구 등록"| LTL
  MC -->|"CapabilityTier"| LTL
  LTL -->|"요약 목록"| LLM
  LTL -->|"온디맨드 전체 스키마"| AS
  AS -->|"축소된 스키마"| LLM

  style LTL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style TR fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style AS fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 도서관의 목록 카드를 떠올리세요. 고성능 독자(HIGH)에게는
            모든 책의 전체 요약을 보여주고, 일반 독자(MEDIUM)에게는 인기 도서만 요약을 보여주며,
            초보 독자(LOW)에게는 책 제목만 보여준 뒤 관심 있는 책의 요약을 요청하면 그때 제공하는 것과 같습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* ToolSummary interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ToolSummary
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            도구의 요약 정보입니다. 전체 스키마 없이 이름과 간단한 설명만 포함합니다.
          </p>
          <ParamTable
            params={[
              { name: "name", type: "string", required: true, desc: "도구 이름" },
              { name: "shortDescription", type: "string", required: true, desc: "한 줄 요약 설명 (첫 번째 마침표 또는 줄바꿈까지)" },
              { name: "schemaLoaded", type: "boolean", required: true, desc: "전체 스키마가 이미 로드되었는지 여부" },
            ]}
          />

          {/* ToolSchema interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ToolSchema
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            도구의 전체 스키마입니다. 지연 로딩 시 반환되는 완전한 도구 정의입니다.
          </p>
          <ParamTable
            params={[
              { name: "name", type: "string", required: true, desc: "도구 이름" },
              { name: "description", type: "string", required: true, desc: "전체 설명" },
              { name: "parameters", type: "Record<string, unknown>", required: true, desc: "JSON Schema 형식의 매개변수 정의" },
            ]}
          />

          {/* LazyToolLoader class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class LazyToolLoader
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            모델 성능 등급에 따라 도구 스키마 로딩을 최적화하는 메인 클래스입니다.
          </p>

          {/* registerTool */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            registerTool(name, description, parameters)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            도구를 전체 스키마와 함께 등록합니다.
          </p>
          <CodeBlock>
            <span className="fn">registerTool</span>(<span className="prop">name</span>: <span className="type">string</span>, <span className="prop">description</span>: <span className="type">string</span>, <span className="prop">parameters</span>: <span className="type">Record</span>{"<"}<span className="type">string</span>, <span className="type">unknown</span>{">"}): <span className="type">void</span>
          </CodeBlock>

          {/* registerAll */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            registerAll(tools)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            여러 도구를 한 번에 등록합니다.
          </p>
          <CodeBlock>
            <span className="fn">registerAll</span>(<span className="prop">tools</span>: <span className="type">readonly</span> <span className="type">ToolEntry</span>[]): <span className="type">void</span>
          </CodeBlock>

          {/* getToolSummaries */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getToolSummaries(tier)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            성능 등급에 맞는 도구 요약 정보 목록을 생성합니다.
            등급에 따라 <code className="text-cyan-600">schemaLoaded</code> 값이 달라집니다.
          </p>
          <CodeBlock>
            <span className="fn">getToolSummaries</span>(<span className="prop">tier</span>: <span className="type">CapabilityTier</span>): <span className="type">readonly</span> <span className="type">ToolSummary</span>[]
          </CodeBlock>
          <ParamTable
            params={[
              { name: "tier", type: "CapabilityTier", required: true, desc: '모델 성능 등급 ("high" | "medium" | "low")' },
            ]}
          />

          {/* loadFullSchema */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            loadFullSchema(toolName)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            특정 도구의 전체 스키마를 온디맨드로 로드합니다.
            등록되지 않은 도구이면 <code className="text-cyan-600">null</code>을 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">loadFullSchema</span>(<span className="prop">toolName</span>: <span className="type">string</span>): <span className="type">ToolSchema</span> | <span className="type">null</span>
          </CodeBlock>

          {/* isSchemaLoaded */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            isSchemaLoaded(toolName)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            특정 도구의 전체 스키마가 이미 로드되었는지 확인합니다.
          </p>
          <CodeBlock>
            <span className="fn">isSchemaLoaded</span>(<span className="prop">toolName</span>: <span className="type">string</span>): <span className="type">boolean</span>
          </CodeBlock>

          {/* size / loadedCount */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            size / loadedCount (getter)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            등록된 도구의 총 개수와 전체 스키마가 로드된 도구의 개수를 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">get</span> <span className="prop">size</span>: <span className="type">number</span>{"      "}<span className="cm">// 등록된 도구 수</span>
            {"\n"}<span className="kw">get</span> <span className="prop">loadedCount</span>: <span className="type">number</span> <span className="cm">// 스키마 로드된 도구 수</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">MEDIUM_TIER_HOT_LIMIT</code>은 <strong>10</strong>으로 하드코딩되어 있습니다.
              우선순위 도구 6개 + 추가 4개까지 전체 스키마가 제공됩니다.
            </li>
            <li>
              <strong>우선순위 도구</strong>(PRIORITY_TOOLS)는 6개입니다:
              <code className="text-cyan-600">file_read</code>, <code className="text-cyan-600">file_write</code>,
              <code className="text-cyan-600">file_edit</code>, <code className="text-cyan-600">bash_exec</code>,
              <code className="text-cyan-600">grep_search</code>, <code className="text-cyan-600">glob_search</code>.
              이들은 어떤 등급에서든 MEDIUM에서 항상 전체 스키마가 로드됩니다.
            </li>
            <li>
              <code className="text-cyan-600">LOW</code> 등급에서는 <code className="text-cyan-600">shortDescription</code>이
              도구 이름 자체로 설정됩니다(설명 없음). 컨텍스트 윈도우를 최대한 절약하기 위해서입니다.
            </li>
            <li>
              <code className="text-cyan-600">loadFullSchema</code>를 호출하면 내부
              <code className="text-cyan-600">loadedSchemas</code> Set에 추가됩니다.
              이후 <code className="text-cyan-600">isSchemaLoaded</code>로 확인할 수 있습니다.
            </li>
            <li>
              <code className="text-cyan-600">getToolSummaries</code>를 호출하면 등급에 따라
              <code className="text-cyan-600">loadedSchemas</code>가 자동으로 업데이트됩니다.
              HIGH/MEDIUM에서 로드 표시된 도구는 자동으로 Set에 추가됩니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 도구 등록 및 요약 생성</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            모든 도구를 등록한 뒤, 모델의 성능 등급에 맞는 요약 목록을 생성합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. 로더 생성 및 도구 등록"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">loader</span> = <span className="kw">new</span> <span className="fn">LazyToolLoader</span>();
            {"\n"}<span className="prop">loader</span>.<span className="fn">registerTool</span>(<span className="str">&quot;file_read&quot;</span>, <span className="str">&quot;파일을 읽습니다.&quot;</span>, <span className="prop">schema</span>);
            {"\n"}<span className="prop">loader</span>.<span className="fn">registerTool</span>(<span className="str">&quot;bash_exec&quot;</span>, <span className="str">&quot;명령을 실행합니다.&quot;</span>, <span className="prop">schema</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 성능 등급에 맞는 요약 목록 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">summaries</span> = <span className="prop">loader</span>.<span className="fn">getToolSummaries</span>(<span className="str">&quot;medium&quot;</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 3. LLM에 요약 목록 전달"}</span>
            {"\n"}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">s</span> <span className="kw">of</span> <span className="prop">summaries</span>) {"{"}
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">s</span>.<span className="prop">schemaLoaded</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// 전체 스키마와 함께 전달"}</span>
            {"\n"}{"  "}<span className="kw">{"}"} else {"{"}</span>
            {"\n"}{"    "}<span className="cm">{"// 이름+설명만 전달 (deferred)"}</span>
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>getToolSummaries</code>를 호출하면 내부 <code>loadedSchemas</code> Set이
            변경됩니다. 같은 인스턴스에서 다른 등급으로 재호출하면 이전 등급의 로드 상태가 남아 있습니다.
            등급을 변경하려면 새 인스턴스를 생성하세요.
          </Callout>

          {/* 고급: 온디맨드 로딩 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 온디맨드 스키마 로딩
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            LLM이 특정 도구를 사용하겠다고 결정하면, 전체 스키마를 온디맨드로 로드합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// LLM이 \"glob_search\"를 사용하고 싶다고 요청"}</span>
            {"\n"}<span className="kw">if</span> (!<span className="prop">loader</span>.<span className="fn">isSchemaLoaded</span>(<span className="str">&quot;glob_search&quot;</span>)) {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">schema</span> = <span className="prop">loader</span>.<span className="fn">loadFullSchema</span>(<span className="str">&quot;glob_search&quot;</span>);
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">schema</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// 전체 스키마를 LLM에 제공하여 호출 가능하게 함"}</span>
            {"\n"}{"    "}<span className="fn">provideSchemaToLLM</span>(<span className="prop">schema</span>);
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 로딩 상태 확인"}</span>
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`총 도구: ${"{"}</span><span className="prop">loader</span>.<span className="prop">size</span><span className="str">{"}"}, 로드됨: ${"{"}</span><span className="prop">loader</span>.<span className="prop">loadedCount</span><span className="str">{"}"}`</span>);
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>loadFullSchema</code>는 등록되지 않은 도구에 대해
            <code>null</code>을 반환합니다. MCP 도구처럼 동적으로 추가되는 도구는
            먼저 <code>registerTool</code>로 등록해야 합니다.
          </Callout>

          <DeepDive title="PRIORITY_TOOLS — 우선순위 도구 목록">
            <p className="mb-3">
              코딩 작업에서 가장 빈번하게 사용되는 6개 핵심 도구입니다.
              MEDIUM 등급에서도 항상 전체 스키마가 로드됩니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">PRIORITY_TOOLS</span> = <span className="kw">new</span> <span className="fn">Set</span>([
              {"\n"}{"  "}<span className="str">&quot;file_read&quot;</span>,{"   "}<span className="cm">// 파일 읽기</span>
              {"\n"}{"  "}<span className="str">&quot;file_write&quot;</span>,{"  "}<span className="cm">// 파일 쓰기</span>
              {"\n"}{"  "}<span className="str">&quot;file_edit&quot;</span>,{"   "}<span className="cm">// 파일 편집</span>
              {"\n"}{"  "}<span className="str">&quot;bash_exec&quot;</span>,{"   "}<span className="cm">// 명령 실행</span>
              {"\n"}{"  "}<span className="str">&quot;grep_search&quot;</span>,{" "}<span className="cm">// 텍스트 검색</span>
              {"\n"}{"  "}<span className="str">&quot;glob_search&quot;</span>,{" "}<span className="cm">// 파일 검색</span>
              {"\n"}]);
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              이 목록은 <code className="text-cyan-600">ReadonlySet</code>으로 정의되어 있어
              런타임에 변경할 수 없습니다. 우선순위 도구를 변경하려면 소스 코드를 수정해야 합니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>등급별 스키마 로딩 전략</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">getToolSummaries</code>는 등급에 따라 서로 다른
            전략으로 도구 요약을 생성합니다. MEDIUM 등급의 &quot;hot limit&quot; 메커니즘이 핵심입니다.
          </p>

          <MermaidDiagram
            title="등급별 스키마 로딩 전략"
            titleColor="purple"
            chart={`graph TD
  REG["등록된 도구 N개<br/><small>tools Map</small>"]

  REG -->|"tier = high"| H["모두 schemaLoaded: true<br/><small>N개 전체 스키마</small>"]
  REG -->|"tier = medium"| M_CHECK{"우선순위 도구?<br/><small>PRIORITY_TOOLS</small>"}
  REG -->|"tier = low"| L["모두 schemaLoaded: false<br/><small>이름만 제공</small>"]

  M_CHECK -->|"Yes"| M_LOAD["schemaLoaded: true<br/><small>전체 스키마 제공</small>"]
  M_CHECK -->|"No + 로드 < 10"| M_LOAD
  M_CHECK -->|"No + 로드 >= 10"| M_DEFER["schemaLoaded: false<br/><small>이름+설명만</small>"]

  L -->|"LLM이 도구 요청"| ON_DEMAND["loadFullSchema()<br/><small>온디맨드 로드</small>"]

  style REG fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style H fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style M_CHECK fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style M_LOAD fill:#dcfce7,stroke:#10b981,color:#065f46
  style M_DEFER fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style L fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px
  style ON_DEMAND fill:#ede9fe,stroke:#8b5cf6,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; MEDIUM 등급 로직</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MEDIUM 등급에서의 &quot;hot limit&quot; 메커니즘입니다.
            우선순위 도구는 항상 로드하고, 나머지는 상위 10개까지만 로드합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// MEDIUM 등급 — 우선순위 + hot limit"}</span>
            {"\n"}<span className="kw">case</span> <span className="str">&quot;medium&quot;</span>:
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">entry</span> <span className="kw">of</span> <span className="prop">entries</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// [1] 우선순위 도구인지 확인"}</span>
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">isPriority</span> = <span className="prop">PRIORITY_TOOLS</span>.<span className="fn">has</span>(<span className="prop">entry</span>.<span className="prop">name</span>);
            {"\n"}{"    "}<span className="cm">{"// [2] 이미 로드된 수가 제한(10) 이내인지"}</span>
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">isWithinHotLimit</span> =
            {"\n"}{"      "}<span className="prop">summaries</span>.<span className="fn">filter</span>(<span className="prop">s</span> {"=>"} <span className="prop">s</span>.<span className="prop">schemaLoaded</span>).<span className="prop">length</span>
            {"\n"}{"      "}{"<"} <span className="prop">MEDIUM_TIER_HOT_LIMIT</span>;
            {"\n"}
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">isPriority</span> || <span className="prop">isWithinHotLimit</span>) {"{"}
            {"\n"}{"      "}<span className="cm">{"// [3] 전체 스키마 로드"}</span>
            {"\n"}{"      "}<span className="kw">this</span>.<span className="prop">loadedSchemas</span>.<span className="fn">add</span>(<span className="prop">entry</span>.<span className="prop">name</span>);
            {"\n"}{"      "}<span className="prop">summaries</span>.<span className="fn">push</span>({"{"} ..., <span className="prop">schemaLoaded</span>: <span className="kw">true</span> {"}"});
            {"\n"}{"    "}<span className="kw">{"}"} else {"{"}</span>
            {"\n"}{"      "}<span className="cm">{"// [4] 이름+설명만 (deferred)"}</span>
            {"\n"}{"      "}<span className="prop">summaries</span>.<span className="fn">push</span>({"{"} ..., <span className="prop">schemaLoaded</span>: <span className="kw">false</span> {"}"});
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> <code className="text-cyan-600">PRIORITY_TOOLS</code> Set에 포함된 도구(6개)는 제한에 관계없이 항상 전체 스키마가 로드됩니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 이미 로드된 도구 수를 실시간으로 계산합니다. <code className="text-cyan-600">MEDIUM_TIER_HOT_LIMIT(10)</code>에 도달하면 추가 로드를 중단합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 전체 스키마를 로드하고 <code className="text-cyan-600">loadedSchemas</code> Set에 추가합니다. <code className="text-cyan-600">isSchemaLoaded()</code>로 확인 가능합니다.</p>
            <p><strong className="text-gray-900">[4]</strong> 제한 초과 시 이름+설명만 제공합니다. LLM이 이 도구를 사용하려면 <code className="text-cyan-600">loadFullSchema()</code>를 호출해야 합니다.</p>
          </div>

          <DeepDive title="extractShortDescription — 한 줄 요약 추출">
            <p className="mb-3">
              전체 설명에서 첫 번째 마침표 또는 줄바꿈까지를 추출하는 내부 함수입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 마침표와 줄바꿈 중 먼저 나오는 지점까지"}</span>
              {"\n"}<span className="str">&quot;파일을 읽습니다. 오프셋을 지정할 수 있습니다.&quot;</span>
              {"\n"}<span className="cm">{"// → \"파일을 읽습니다.\""}</span>
              {"\n"}
              {"\n"}<span className="str">&quot;명령을 실행합니다\n옵션: timeout, cwd&quot;</span>
              {"\n"}<span className="cm">{"// → \"명령을 실행합니다\""}</span>
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              LOW 등급에서는 이 함수를 사용하지 않고 도구 이름 자체를 <code className="text-cyan-600">shortDescription</code>으로
              설정합니다. 최대한의 토큰 절약을 위해서입니다.
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
              &quot;MEDIUM 등급인데 특정 도구의 스키마가 로드되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">MEDIUM_TIER_HOT_LIMIT(10)</code>에 도달했을 수 있습니다.
              우선순위 도구 6개를 포함하여 최대 10개만 전체 스키마가 로드됩니다.
              나머지 도구는 <code className="text-cyan-600">loadFullSchema()</code>로 개별 로드해야 합니다.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;loadFullSchema가 null을 반환해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              도구가 등록되지 않았습니다. <code className="text-cyan-600">registerTool</code> 또는
              <code className="text-cyan-600">registerAll</code>로 먼저 등록했는지 확인하세요.
              MCP 도구처럼 동적으로 추가되는 도구도 등록이 필요합니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;LOW 등급인데 도구 설명이 없어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              이것은 의도된 동작입니다. LOW 등급에서는 <code className="text-cyan-600">shortDescription</code>이
              도구 이름 자체로 설정됩니다. 컨텍스트 윈도우를 최대한 절약하기 위한 전략입니다.
              도구를 사용하려면 <code className="text-cyan-600">loadFullSchema()</code>로 전체 설명을 가져와야 합니다.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;등급을 변경했는데 이전 로드 상태가 남아 있어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">loadedSchemas</code> Set은 누적됩니다.
              등급을 변경하려면 새로운 <code className="text-cyan-600">LazyToolLoader</code> 인스턴스를
              생성하고 도구를 다시 등록하세요.
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
                name: "adaptive-schema.ts",
                slug: "adaptive-schema",
                relation: "sibling",
                desc: "로드된 스키마를 등급에 맞게 추가 축소하는 모듈",
              },
              {
                name: "model-capabilities.ts",
                slug: "model-capabilities",
                relation: "parent",
                desc: "CapabilityTier를 결정하는 모델 성능 등급 시스템",
              },
              {
                name: "tool-registry.ts",
                slug: "tool-registry",
                relation: "sibling",
                desc: "도구 정의를 관리하는 레지스트리 — 도구 등록의 원천",
              },
              {
                name: "tool-call-corrector.ts",
                slug: "tool-call-corrector",
                relation: "sibling",
                desc: "도구 호출 인수 자동 교정 — 지연 로딩된 도구의 호출 오류 방지",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
