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

export default function TelemetryMetricsPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/telemetry/metrics.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              MetricsCollector
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            카운터와 히스토그램 메트릭을 인메모리에서 수집하는 텔레메트리 모듈입니다.
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
              <code className="text-cyan-600">MetricsCollector</code>는 세션 수, 토큰 사용량, 도구 실행 시간,
              에이전트 반복 횟수 등의 수치 데이터를 인메모리에서 수집합니다.
              수집된 메트릭은 OTLP 또는 Prometheus 형식으로 내보낼 수 있습니다.
            </p>
            <p>
              두 가지 메트릭 타입을 지원합니다: <strong>카운터(Counter)</strong>는 토큰 수처럼
              누적되는 값이고, <strong>히스토그램(Histogram)</strong>은 도구 실행 시간처럼
              분포를 관찰하는 값입니다.
            </p>
            <p>
              앱 전체에서 공유되는 싱글톤 인스턴스 <code className="text-cyan-600">metrics</code>가
              export되어 있어, 어디서든 <code className="text-cyan-600">metrics.increment()</code>나
              <code className="text-cyan-600">metrics.observe()</code>로 메트릭을 기록할 수 있습니다.
            </p>
          </div>

          <MermaidDiagram
            title="MetricsCollector 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  TOOLS["Tool Executor<br/><small>tools/executor.ts</small>"]
  LLM["LLM Client<br/><small>llm/client.ts</small>"]
  METRICS["MetricsCollector<br/><small>telemetry/metrics.ts</small>"]
  EXPORTER["OTelExporter<br/><small>telemetry/otel-exporter.ts</small>"]
  OTLP["OTLP Endpoint<br/><small>/v1/metrics</small>"]

  AGENT -->|"increment(sessionsTotal)"| METRICS
  TOOLS -->|"observe(toolDuration)"| METRICS
  LLM -->|"increment(tokensUsed)"| METRICS
  METRICS -->|"getCounterData()"| EXPORTER
  METRICS -->|"getHistogramData()"| EXPORTER
  EXPORTER -->|"HTTP POST"| OTLP

  style METRICS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TOOLS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style EXPORTER fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style OTLP fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 자동차의 계기판을 떠올리세요.
            MetricsCollector는 주행거리(카운터)와 속도 분포(히스토그램)를 기록하는 계기판입니다.
            운전 중에는 데이터가 쌓이기만 하고, 주기적으로 정비소(OTLP)에 데이터를 전송합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* CounterMetric */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface CounterMetric
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            카운터 메트릭 정의 &mdash; 누적 값을 추적합니다 (항상 증가).
          </p>
          <ParamTable
            params={[
              { name: "name", type: "string", required: true, desc: "메트릭 이름 (예: \"dbcode.tokens.total\")" },
              { name: "description", type: "string", required: true, desc: "메트릭 설명" },
              { name: "labels", type: "readonly string[]", required: true, desc: "사용 가능한 레이블 키 목록" },
            ]}
          />

          {/* HistogramMetric */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface HistogramMetric
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            히스토그램 메트릭 정의 &mdash; 값의 분포를 관찰합니다 (예: 지연 시간).
          </p>
          <ParamTable
            params={[
              { name: "name", type: "string", required: true, desc: "메트릭 이름" },
              { name: "description", type: "string", required: true, desc: "메트릭 설명" },
              { name: "labels", type: "readonly string[]", required: true, desc: "사용 가능한 레이블 키 목록" },
              { name: "buckets", type: "readonly number[] | undefined", required: false, desc: "히스토그램 버킷 경계값 (분포 기준점)" },
            ]}
          />

          {/* COUNTERS */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            COUNTERS (정의된 카운터 목록)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            앱 전체에서 사용되는 7개 카운터 메트릭 정의입니다.
          </p>
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2">
            <p><code className="text-cyan-600">sessionsTotal</code> &mdash; 시작된 총 세션 수</p>
            <p><code className="text-cyan-600">tokensUsed</code> &mdash; 사용된 총 토큰 수 (레이블: type, model)</p>
            <p><code className="text-cyan-600">tokenCost</code> &mdash; 추정 비용 USD (레이블: model)</p>
            <p><code className="text-cyan-600">toolInvocations</code> &mdash; 도구 호출 횟수 (레이블: tool, status)</p>
            <p><code className="text-cyan-600">toolDecisions</code> &mdash; 도구 결정 결과 (레이블: tool, decision)</p>
            <p><code className="text-cyan-600">linesOfCode</code> &mdash; 영향받은 코드 줄 수 (레이블: action)</p>
            <p><code className="text-cyan-600">errors</code> &mdash; 카테고리별 에러 수 (레이블: category)</p>
          </div>

          {/* HISTOGRAMS */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            HISTOGRAMS (정의된 히스토그램 목록)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            앱 전체에서 사용되는 4개 히스토그램 메트릭 정의입니다.
          </p>
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2">
            <p><code className="text-cyan-600">sessionDuration</code> &mdash; 세션 지속 시간 (초), 버킷: 10~3600</p>
            <p><code className="text-cyan-600">toolDuration</code> &mdash; 도구 실행 시간 (ms), 버킷: 10~30000</p>
            <p><code className="text-cyan-600">agentIterations</code> &mdash; 작업당 에이전트 반복 횟수, 버킷: 1~50</p>
            <p><code className="text-cyan-600">llmLatency</code> &mdash; LLM API 호출 지연 시간 (ms), 버킷: 100~30000</p>
          </div>

          {/* MetricsCollector class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class MetricsCollector
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            인메모리 메트릭 수집기입니다. 카운터 증가와 히스토그램 관찰을 지원합니다.
          </p>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">increment(metric, value?, labels?)</h4>
          <p className="text-[13px] text-gray-600 mb-3">
            카운터 메트릭의 값을 증가시킵니다. 기존 카운터는 마지막 값에 누적됩니다.
          </p>
          <CodeBlock>
            <span className="fn">increment</span>(<span className="prop">metric</span>: <span className="type">CounterMetric</span>, <span className="prop">value</span>?: <span className="type">number</span>, <span className="prop">labels</span>?: <span className="type">MetricLabels</span>): <span className="type">void</span>
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">observe(metric, value, labels?)</h4>
          <p className="text-[13px] text-gray-600 mb-3">
            히스토그램 메트릭에 관찰값을 기록합니다. 각 관찰값은 독립적으로 저장됩니다.
          </p>
          <CodeBlock>
            <span className="fn">observe</span>(<span className="prop">metric</span>: <span className="type">HistogramMetric</span>, <span className="prop">value</span>: <span className="type">number</span>, <span className="prop">labels</span>?: <span className="type">MetricLabels</span>): <span className="type">void</span>
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getCounter(metric, labels?)</h4>
          <p className="text-[13px] text-gray-600 mb-3">
            특정 카운터의 현재 값을 조회합니다. 없으면 0을 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">getCounter</span>(<span className="prop">metric</span>: <span className="type">CounterMetric</span>, <span className="prop">labels</span>?: <span className="type">MetricLabels</span>): <span className="type">number</span>
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">reset()</h4>
          <p className="text-[13px] text-gray-600 mb-3">
            모든 메트릭 데이터를 초기화합니다. 테스트 등에서 사용합니다.
          </p>
          <CodeBlock>
            <span className="fn">reset</span>(): <span className="type">void</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">metrics</code>는 <strong>싱글톤</strong>입니다.
              앱 전체에서 하나의 인스턴스를 공유하므로, <code className="text-cyan-600">reset()</code>을
              호출하면 모든 곳의 메트릭이 초기화됩니다.
            </li>
            <li>
              레이블 조합이 다르면 <strong>별도의 메트릭</strong>으로 관리됩니다.
              <code className="text-cyan-600">{`{model: "gpt-4o"}`}</code>와
              <code className="text-cyan-600">{`{model: "claude-3"}`}</code>는 다른 키로 저장됩니다.
            </li>
            <li>
              키 생성 시 레이블은 <strong>키 이름으로 정렬</strong>되므로,
              레이블 순서가 달라도 같은 키가 생성됩니다.
            </li>
            <li>
              인메모리 저장이므로 앱 재시작 시 모든 메트릭이 사라집니다.
              영속화가 필요하면 OTelExporter를 통해 외부 시스템으로 내보내야 합니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 카운터와 히스토그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            싱글톤 <code className="text-cyan-600">metrics</code>를 통해 메트릭을 기록합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{ "}<span className="prop">metrics</span>, <span className="prop">COUNTERS</span>, <span className="prop">HISTOGRAMS</span>{" }"} <span className="kw">from</span> <span className="str">&quot;./telemetry/metrics.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 카운터 증가: 토큰 150개 사용"}</span>
            {"\n"}<span className="prop">metrics</span>.<span className="fn">increment</span>(<span className="prop">COUNTERS</span>.<span className="prop">tokensUsed</span>, <span className="num">150</span>, {"{"} <span className="prop">type</span>: <span className="str">&quot;input&quot;</span>, <span className="prop">model</span>: <span className="str">&quot;gpt-4o&quot;</span> {"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 히스토그램 관찰: 도구 실행에 245ms 소요"}</span>
            {"\n"}<span className="prop">metrics</span>.<span className="fn">observe</span>(<span className="prop">HISTOGRAMS</span>.<span className="prop">toolDuration</span>, <span className="num">245</span>, {"{"} <span className="prop">tool</span>: <span className="str">&quot;file_read&quot;</span> {"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 현재 값 조회"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">total</span> = <span className="prop">metrics</span>.<span className="fn">getCounter</span>(<span className="prop">COUNTERS</span>.<span className="prop">tokensUsed</span>, {"{"} <span className="prop">type</span>: <span className="str">&quot;input&quot;</span>, <span className="prop">model</span>: <span className="str">&quot;gpt-4o&quot;</span> {"}"});
            {"\n"}<span className="cm">{"// → 150"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>increment()</code>의 기본 증가량은 1입니다.
            토큰 수처럼 한 번에 많은 양을 누적해야 할 때는 반드시 두 번째 인자에 값을 전달하세요.
          </Callout>

          {/* 고급: 레이블 활용 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 레이블로 메트릭 분류
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            레이블을 사용하면 같은 메트릭을 다양한 차원으로 분류할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 모델별 토큰 추적"}</span>
            {"\n"}<span className="prop">metrics</span>.<span className="fn">increment</span>(<span className="prop">COUNTERS</span>.<span className="prop">tokensUsed</span>, <span className="num">100</span>, {"{"} <span className="prop">type</span>: <span className="str">&quot;input&quot;</span>, <span className="prop">model</span>: <span className="str">&quot;gpt-4o&quot;</span> {"}"});
            {"\n"}<span className="prop">metrics</span>.<span className="fn">increment</span>(<span className="prop">COUNTERS</span>.<span className="prop">tokensUsed</span>, <span className="num">200</span>, {"{"} <span className="prop">type</span>: <span className="str">&quot;output&quot;</span>, <span className="prop">model</span>: <span className="str">&quot;gpt-4o&quot;</span> {"}"});
            {"\n"}<span className="prop">metrics</span>.<span className="fn">increment</span>(<span className="prop">COUNTERS</span>.<span className="prop">tokensUsed</span>, <span className="num">50</span>, {"{"} <span className="prop">type</span>: <span className="str">&quot;input&quot;</span>, <span className="prop">model</span>: <span className="str">&quot;claude-3&quot;</span> {"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 각각 별도의 키로 저장됨:"}</span>
            {"\n"}<span className="cm">{"// \"dbcode.tokens.total{model=gpt-4o,type=input}\"  → 100"}</span>
            {"\n"}<span className="cm">{"// \"dbcode.tokens.total{model=gpt-4o,type=output}\" → 200"}</span>
            {"\n"}<span className="cm">{"// \"dbcode.tokens.total{model=claude-3,type=input}\" → 50"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> 레이블 키는 메트릭 정의의 <code>labels</code> 배열에 선언된 키만
            사용하는 것이 좋습니다. 미선언 키도 동작하지만, OTLP 내보내기 시 불필요한 cardinality를
            증가시킬 수 있습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>키 생성 방식</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            메트릭 이름과 레이블 조합으로 고유 키를 생성합니다.
            레이블 키를 정렬하여 동일한 레이블 조합이 항상 같은 키를 생성하도록 보장합니다.
          </p>

          <MermaidDiagram
            title="메트릭 키 생성과 저장 구조"
            titleColor="purple"
            chart={`graph LR
  INPUT["increment(tokensUsed, 150,<br/>{type: 'input', model: 'gpt-4o'})"]
  MAKEKEY["makeKey()<br/><small>레이블 키 정렬</small>"]
  KEY["'dbcode.tokens.total<br/>{model=gpt-4o,type=input}'"]
  MAP["Map&lt;string, MetricValue[]&gt;<br/><small>인메모리 저장소</small>"]

  INPUT --> MAKEKEY
  MAKEKEY --> KEY
  KEY --> MAP

  style INPUT fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style MAKEKEY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style KEY fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style MAP fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>카운터 vs 히스토그램 저장 차이</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            카운터는 마지막 값에 <strong>누적</strong>하고, 히스토그램은 관찰값을 <strong>독립적으로 추가</strong>합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 카운터: 마지막 값에 누적"}</span>
            {"\n"}<span className="fn">increment</span>(<span className="prop">metric</span>, <span className="prop">value</span>) {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">existing</span> = <span className="kw">this</span>.<span className="prop">counters</span>.<span className="fn">get</span>(<span className="prop">key</span>);
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">existing</span>) {"{"}
            {"\n"}{"    "}<span className="prop">existing</span>[<span className="prop">existing</span>.<span className="prop">length</span> - <span className="num">1</span>].<span className="prop">value</span> += <span className="prop">value</span>; <span className="cm">{"// 누적"}</span>
            {"\n"}{"  "}<span className="kw">{"}"} else {"{"}</span>
            {"\n"}{"    "}<span className="kw">this</span>.<span className="prop">counters</span>.<span className="fn">set</span>(<span className="prop">key</span>, [{"{"}value, labels, timestamp{"}"}]);
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 히스토그램: 관찰값 독립 추가"}</span>
            {"\n"}<span className="fn">observe</span>(<span className="prop">metric</span>, <span className="prop">value</span>) {"{"}
            {"\n"}{"  "}<span className="prop">existing</span>.<span className="fn">push</span>({"{"}<span className="prop">value</span>, <span className="prop">labels</span>, <span className="prop">timestamp</span>{"}"});  <span className="cm">{"// 독립 추가"}</span>
            {"\n"}{"}"}
          </CodeBlock>

          <DeepDive title="히스토그램 버킷(bucket)이란?">
            <p className="mb-3">
              히스토그램의 <code className="text-cyan-600">buckets</code>는 값의 분포를 나누는 경계점입니다.
              예를 들어 <code className="text-cyan-600">[10, 50, 100, 500]</code>이면:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li>&le; 10ms: 매우 빠른 실행</li>
              <li>10~50ms: 빠른 실행</li>
              <li>50~100ms: 보통 실행</li>
              <li>100~500ms: 느린 실행</li>
              <li>&gt; 500ms: 매우 느린 실행</li>
            </ul>
            <p className="mt-3 text-gray-600">
              현재 구현에서 버킷 경계는 OTLP 내보내기 시 사용되며,
              인메모리 저장소에서는 원시 관찰값이 그대로 보관됩니다.
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

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;getCounter()가 항상 0을 반환해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              레이블 조합이 정확히 일치해야 합니다.
              <code className="text-cyan-600">{`{type: "input", model: "gpt-4o"}`}</code>로 기록했다면,
              조회 시에도 동일한 레이블을 전달해야 합니다.
              레이블 하나라도 빠지면 다른 키로 간주됩니다.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;메트릭이 OTLP에 나타나지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">OTelExporter</code>가 시작되었는지 확인하세요.
              텔레메트리가 비활성(<code className="text-cyan-600">enabled: false</code>)이거나
              OTLP 엔드포인트가 설정되지 않으면 내보내기가 수행되지 않습니다.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;앱 재시작 후 메트릭이 사라졌어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              MetricsCollector는 인메모리 저장소이므로 앱 재시작 시 데이터가 사라집니다.
              이는 의도된 동작입니다. 영속화가 필요하면 <code className="text-cyan-600">OTelExporter</code>를
              통해 Prometheus나 Grafana 같은 외부 시스템으로 주기적으로 내보내세요.
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
                name: "events.ts",
                slug: "telemetry-events",
                relation: "sibling",
                desc: "도구 결정, 에러, 세션 라이프사이클 등의 구조화된 이벤트 정의",
              },
              {
                name: "token-counter.ts",
                slug: "token-counter",
                relation: "sibling",
                desc: "LLM 토큰 사용량을 정확히 계산하는 모듈 — 메트릭 기록의 데이터 소스",
              },
              {
                name: "agent-loop.ts",
                slug: "agent-loop",
                relation: "parent",
                desc: "에이전트 루프 — 반복마다 sessionsTotal, tokensUsed 등을 기록",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
