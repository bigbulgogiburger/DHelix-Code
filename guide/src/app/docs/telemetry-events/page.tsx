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

export default function TelemetryEventsPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/telemetry/events.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Telemetry Events</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              도구 결정, LLM 호출, 에러, 세션 라이프사이클 등의 구조화된 텔레메트리 이벤트를
              정의하고 버퍼링하는 모듈입니다.
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
                텔레메트리 이벤트는 앱의 주요 동작을 구조화된 형태로 기록합니다. 메트릭(
                <code className="text-cyan-600">metrics.ts</code>)이 &quot;얼마나&quot;를
                추적한다면, 이벤트는 &quot;무엇이, 언제, 왜&quot;를 기록합니다.
              </p>
              <p>
                6가지 이벤트 타입이 정의되어 있습니다: <strong>도구 결정</strong>(승인/거부),
                <strong>도구 실행</strong>(성공/실패), <strong>LLM 호출</strong>(모델, 토큰, 지연),
                <strong>세션</strong>(시작/종료), <strong>에러</strong>(카테고리별),
                <strong>에이전트 반복</strong>(반복 번호, 도구 호출 수).
              </p>
              <p>
                <code className="text-cyan-600">EventBuffer</code>에 인메모리로 수집되며,
                <code className="text-cyan-600">OTelExporter</code>가 주기적으로 OTLP{" "}
                <code className="text-cyan-600">/v1/logs</code>
                엔드포인트로 내보냅니다. 설정은 <code className="text-cyan-600">config.ts</code>의
                환경 변수로 관리되며, 기본적으로 텔레메트리는 비활성(프라이버시 보호)입니다.
              </p>
            </div>

            <MermaidDiagram
              title="텔레메트리 이벤트 시스템 전체 구조"
              titleColor="purple"
              chart={`graph TD
  AGENT["Agent Loop"]
  TOOLS["Tool Executor"]
  LLM["LLM Client"]
  PERM["Permission Manager"]

  CREATE["createEvent()<br/><small>타임스탬프 자동 생성</small>"]
  BUFFER["EventBuffer<br/><small>인메모리 (최대 1000개)</small>"]
  CONFIG["loadTelemetryConfig()<br/><small>환경 변수 → Zod 파싱</small>"]
  EXPORTER["OTelExporter<br/><small>주기적 flush + HTTP POST</small>"]
  OTLP["OTLP /v1/logs<br/><small>Grafana, Jaeger 등</small>"]

  AGENT -->|"session_start/end"| CREATE
  TOOLS -->|"tool_execution"| CREATE
  LLM -->|"llm_call"| CREATE
  PERM -->|"tool_decision"| CREATE
  CREATE --> BUFFER
  CONFIG -->|"enabled, endpoint"| EXPORTER
  BUFFER -->|"flush()"| EXPORTER
  EXPORTER -->|"HTTP POST"| OTLP

  style BUFFER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CREATE fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style EXPORTER fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CONFIG fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style AGENT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TOOLS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PERM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style OTLP fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 비행기의 블랙박스를 떠올리세요. 이벤트 버퍼는 비행 중의 모든
              주요 행동(이륙, 착륙, 터뷸런스)을 기록하고, 주기적으로 지상 관제소(OTLP)에 전송합니다.
              버퍼가 가득 차면 가장 오래된 기록부터 덮어씁니다.
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

            {/* 이벤트 타입들 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              이벤트 타입 (6가지)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              모든 이벤트는 <code className="text-cyan-600">BaseEvent</code>(timestamp, sessionId)를
              확장합니다.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 text-[13px] text-gray-600 space-y-3">
              <div>
                <p className="font-bold text-gray-900 mb-1">ToolDecisionEvent</p>
                <p>
                  도구 호출 승인/거부 결정. <code className="text-cyan-600">decision</code>:
                  approved, denied, auto_approved, blocked_by_hook
                </p>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-1">ToolExecutionEvent</p>
                <p>
                  도구 실행 결과. <code className="text-cyan-600">toolName</code>,{" "}
                  <code className="text-cyan-600">success</code>,{" "}
                  <code className="text-cyan-600">durationMs</code>
                </p>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-1">LLMCallEvent</p>
                <p>
                  LLM API 호출 정보. <code className="text-cyan-600">model</code>,{" "}
                  <code className="text-cyan-600">inputTokens</code>,{" "}
                  <code className="text-cyan-600">outputTokens</code>,{" "}
                  <code className="text-cyan-600">durationMs</code>
                </p>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-1">SessionEvent</p>
                <p>
                  세션 시작/종료. type: <code className="text-cyan-600">session_start</code> |{" "}
                  <code className="text-cyan-600">session_end</code>. 종료 시 durationSeconds,
                  totalTokens 포함
                </p>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-1">ErrorEvent</p>
                <p>
                  주요 에러 발생. <code className="text-cyan-600">category</code>: llm, tool,
                  permission, config, internal. <code className="text-cyan-600">recoverable</code>{" "}
                  여부 포함
                </p>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-1">AgentIterationEvent</p>
                <p>
                  에이전트 루프 반복. <code className="text-cyan-600">iteration</code> 번호,{" "}
                  <code className="text-cyan-600">toolCalls</code> 수,{" "}
                  <code className="text-cyan-600">model</code>
                </p>
              </div>
            </div>

            {/* EventBuffer */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class EventBuffer
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인메모리 이벤트 버퍼입니다. 최대 크기(기본 1000)를 초과하면 가장 오래된 이벤트부터
              제거됩니다.
            </p>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">record(event)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              이벤트를 버퍼에 기록합니다. 가득 차면 오래된 이벤트를 제거합니다.
            </p>
            <CodeBlock>
              <span className="fn">record</span>(<span className="prop">event</span>:{" "}
              <span className="type">TelemetryEvent</span>): <span className="type">void</span>
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">flush()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              모든 버퍼된 이벤트를 가져오고 버퍼를 비웁니다. OTLP 내보내기 후 호출합니다.
            </p>
            <CodeBlock>
              <span className="fn">flush</span>(): <span className="kw">readonly</span>{" "}
              <span className="type">TelemetryEvent</span>[]
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">peek()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              버퍼를 비우지 않고 현재 이벤트를 조회합니다. 디버깅용입니다.
            </p>
            <CodeBlock>
              <span className="fn">peek</span>(): <span className="kw">readonly</span>{" "}
              <span className="type">TelemetryEvent</span>[]
            </CodeBlock>

            {/* createEvent */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              createEvent&lt;T&gt;(event)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              타임스탬프를 자동으로 현재 시간(ISO 8601)으로 채워주는 팩토리 함수입니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">createEvent</span>&lt;
              <span className="type">T</span> <span className="kw">extends</span>{" "}
              <span className="type">TelemetryEvent</span>&gt;(
              {"\n"}
              {"  "}
              <span className="prop">event</span>: <span className="type">Omit</span>&lt;
              <span className="type">T</span>, <span className="str">&quot;timestamp&quot;</span>
              &gt; & {"{"} <span className="prop">timestamp</span>?:{" "}
              <span className="type">string</span> {"}"},{"\n"}): <span className="type">T</span>
            </CodeBlock>

            {/* TelemetryConfig (from config.ts) */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              loadTelemetryConfig() <span className="text-gray-400 text-sm">(config.ts)</span>
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              환경 변수에서 텔레메트리 설정을 로드합니다. Zod 스키마로 유효성 검사와 기본값을
              적용합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "enabled",
                  type: "boolean",
                  required: false,
                  desc: "텔레메트리 활성화 (기본: false)",
                },
                {
                  name: "otlpEndpoint",
                  type: "string",
                  required: false,
                  desc: "OTLP 엔드포인트 URL",
                },
                {
                  name: "prometheusPort",
                  type: "number",
                  required: false,
                  desc: "Prometheus 메트릭 포트",
                },
                {
                  name: "exportIntervalMs",
                  type: "number",
                  required: false,
                  desc: "내보내기 간격 (기본: 60000ms)",
                },
                {
                  name: "serviceName",
                  type: "string",
                  required: false,
                  desc: '서비스 이름 (기본: "dhelix")',
                },
                {
                  name: "serviceVersion",
                  type: "string",
                  required: false,
                  desc: '서비스 버전 (기본: "0.1.0")',
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">eventBuffer</code>는 <strong>싱글톤</strong>입니다.
                앱 전체에서 하나의 버퍼를 공유합니다.
              </li>
              <li>
                버퍼 최대 크기(기본 1000)를 초과하면 <strong>가장 오래된 이벤트부터 제거</strong>
                됩니다.
                <code className="text-cyan-600">slice(-maxSize)</code>로 구현되어 있습니다.
              </li>
              <li>
                <code className="text-cyan-600">flush()</code>는 버퍼를{" "}
                <strong>완전히 비웁니다</strong>. 내보내기 실패 시 이벤트가 손실될 수 있으므로,
                OTelExporter가 에러 처리를 담당합니다.
              </li>
              <li>
                텔레메트리는 기본적으로 <strong>비활성</strong>입니다.
                <code className="text-cyan-600">DHELIX_TELEMETRY=true</code> 환경 변수로 활성화해야
                합니다.
              </li>
              <li>
                <code className="text-cyan-600">OTEL_EXPORTER_OTLP_ENDPOINT</code> 표준 OTel 환경
                변수도 폴백으로 지원됩니다.
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
              기본 사용법 &mdash; 이벤트 기록
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">createEvent()</code>로 이벤트를 생성하고
              <code className="text-cyan-600">eventBuffer.record()</code>로 기록합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{ "}
              <span className="prop">eventBuffer</span>, <span className="fn">createEvent</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./telemetry/events.js&quot;</span>;{"\n"}
              <span className="kw">import</span> <span className="kw">type</span> {"{ "}
              <span className="type">ToolExecutionEvent</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./telemetry/events.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 도구 실행 이벤트 기록"}</span>
              {"\n"}
              <span className="prop">eventBuffer</span>.<span className="fn">record</span>(
              <span className="fn">createEvent</span>&lt;
              <span className="type">ToolExecutionEvent</span>&gt;({"{"}
              {"\n"}
              {"  "}
              <span className="prop">type</span>:{" "}
              <span className="str">&quot;tool_execution&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">toolName</span>:{" "}
              <span className="str">&quot;file_read&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">success</span>: <span className="num">true</span>,{"\n"}
              {"  "}
              <span className="prop">durationMs</span>: <span className="num">45</span>,{"\n"}
              {"}"}));
              {"\n"}
              <span className="cm">{'// timestamp는 자동 생성: "2024-01-15T10:30:00.000Z"'}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>createEvent()</code>를 사용하지 않고 직접 이벤트 객체를
              만들 수도 있지만,
              <code>timestamp</code>를 수동으로 채워야 합니다. <code>createEvent()</code>를 사용하면
              실수를 방지할 수 있습니다.
            </Callout>

            {/* 텔레메트리 활성화 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 텔레메트리 활성화와 OTLP 내보내기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              환경 변수를 설정하여 텔레메트리를 활성화하고, OTelExporter를 시작합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 환경 변수 설정 (셸 또는 .env)"}</span>
              {"\n"}
              <span className="prop">DHELIX_TELEMETRY</span>=<span className="str">true</span>
              {"\n"}
              <span className="prop">DHELIX_TELEMETRY_OTLP_ENDPOINT</span>=
              <span className="str">http://localhost:4318</span>
              {"\n"}
              <span className="prop">DHELIX_TELEMETRY_EXPORT_INTERVAL_MS</span>=
              <span className="str">30000</span>
            </CodeBlock>
            <CodeBlock>
              <span className="kw">import</span> {"{ "}
              <span className="fn">loadTelemetryConfig</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./telemetry/config.js&quot;</span>;{"\n"}
              <span className="kw">import</span> {"{ "}
              <span className="type">OTelExporter</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./telemetry/otel-exporter.js&quot;</span>;{"\n"}
              <span className="kw">import</span> {"{ "}
              <span className="prop">metrics</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./telemetry/metrics.js&quot;</span>;{"\n"}
              <span className="kw">import</span> {"{ "}
              <span className="prop">eventBuffer</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./telemetry/events.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">config</span> ={" "}
              <span className="fn">loadTelemetryConfig</span>();
              {"\n"}
              <span className="kw">const</span> <span className="prop">exporter</span> ={" "}
              <span className="kw">new</span> <span className="type">OTelExporter</span>(
              <span className="prop">config</span>, <span className="prop">metrics</span>,{" "}
              <span className="prop">eventBuffer</span>);
              {"\n"}
              <span className="prop">exporter</span>.<span className="fn">start</span>();{" "}
              <span className="cm">{"// 30초마다 자동 내보내기"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 앱 종료 시"}</span>
              {"\n"}
              <span className="prop">exporter</span>.<span className="fn">stop</span>();
              {"\n"}
              <span className="kw">await</span> <span className="prop">exporter</span>.
              <span className="fn">export</span>(); <span className="cm">{"// 마지막 flush"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>peek()</code>로 버퍼 내용을 확인하여 디버깅할 수 있습니다.
              <code>flush()</code>와 달리 버퍼를 비우지 않으므로 안전하게 조회할 수 있습니다.
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
              이벤트 → OTLP 변환 과정
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              OTelExporter는 이벤트를 OTLP Logs 형식으로 변환하여 전송합니다. 이벤트의 타입은{" "}
              <code className="text-cyan-600">event.type</code> 속성으로 분류됩니다.
            </p>

            <MermaidDiagram
              title="이벤트 내보내기 흐름"
              titleColor="purple"
              chart={`graph TD
  RECORD["eventBuffer.record()"] --> BUFFER["EventBuffer<br/><small>인메모리 배열</small>"]
  BUFFER -->|"flush()"| EXPORTER["OTelExporter.exportEvents()"]
  EXPORTER --> PAYLOAD["OTLP Logs Payload<br/><small>resourceLogs → scopeLogs → logRecords</small>"]
  PAYLOAD -->|"HTTP POST"| ENDPOINT["/v1/logs<br/><small>10초 타임아웃</small>"]

  TIMER["setInterval<br/><small>exportIntervalMs</small>"] -.->|"주기적"| EXPORTER

  style BUFFER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style EXPORTER fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style PAYLOAD fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style RECORD fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style ENDPOINT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style TIMER fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              버퍼 오버플로 전략
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              버퍼가 최대 크기를 초과하면 <code className="text-cyan-600">slice(-maxSize)</code>로
              가장 오래된 이벤트를 제거합니다. 최신 이벤트가 항상 보존됩니다.
            </p>
            <CodeBlock>
              <span className="fn">record</span>(<span className="prop">event</span>:{" "}
              <span className="type">TelemetryEvent</span>): <span className="type">void</span>{" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="kw">this</span>.<span className="prop">events</span>.
              <span className="fn">push</span>(<span className="prop">event</span>);
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="kw">this</span>.
              <span className="prop">events</span>.<span className="prop">length</span> {">"}{" "}
              <span className="kw">this</span>.<span className="prop">maxSize</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// 오래된 이벤트 제거 — 최신 maxSize개만 유지"}</span>
              {"\n"}
              {"    "}
              <span className="kw">this</span>.<span className="prop">events</span> ={" "}
              <span className="kw">this</span>.<span className="prop">events</span>.
              <span className="fn">slice</span>(-<span className="kw">this</span>.
              <span className="prop">maxSize</span>);
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <DeepDive title="config.ts — 환경 변수 매핑 상세">
              <p className="mb-3">텔레메트리 설정은 두 가지 네이밍 규칙을 지원합니다:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <code className="text-cyan-600">DHELIX_TELEMETRY_*</code> &mdash; 전용 환경 변수
                  (우선순위 높음)
                </li>
                <li>
                  <code className="text-cyan-600">OTEL_*</code> &mdash; 표준 OpenTelemetry 환경 변수
                  (폴백)
                </li>
              </ul>
              <p className="mt-3 text-gray-600">
                예를 들어 OTLP 엔드포인트는{" "}
                <code className="text-cyan-600">DHELIX_TELEMETRY_OTLP_ENDPOINT</code>가 먼저
                확인되고, 없으면 <code className="text-cyan-600">OTEL_EXPORTER_OTLP_ENDPOINT</code>
                를 사용합니다. Zod 스키마가 유효성 검사와 기본값 적용을 담당합니다.
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

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;이벤트가 OTLP에 전송되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">DHELIX_TELEMETRY=true</code> 환경 변수가 설정되어
                있는지,
                <code className="text-cyan-600">DHELIX_TELEMETRY_OTLP_ENDPOINT</code>가 올바른
                URL인지 확인하세요. 두 조건이 모두 충족되어야 내보내기가 활성화됩니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;오래된 이벤트가 사라졌어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                EventBuffer의 기본 최대 크기는 1000개입니다. 이벤트가 빠르게 쌓이는 환경에서는
                오래된 이벤트가 제거됩니다. <code className="text-cyan-600">exportIntervalMs</code>
                를 줄여 더 자주 내보내거나, 버퍼 크기를 늘리는 것을 고려하세요.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;flush() 후 내보내기 실패 시 이벤트가 손실돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">flush()</code>는 버퍼를 완전히 비우므로, 내보내기
                실패 시 이벤트가 손실됩니다. 이는 현재 설계의 한계이며, fire-and-forget 패턴을
                사용하고 있습니다. 중요한 이벤트는 별도 로깅 시스템에도 기록하는 것이 권장됩니다.
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
                  name: "metrics.ts",
                  slug: "telemetry-metrics",
                  relation: "sibling",
                  desc: "카운터와 히스토그램 메트릭 수집 — 이벤트와 함께 텔레메트리의 양대 축",
                },
                {
                  name: "permission-manager.ts",
                  slug: "permission-manager",
                  relation: "parent",
                  desc: "도구 승인/거부 결정을 내리고 tool_decision 이벤트를 생성",
                },
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "세션 시작/종료, 에이전트 반복 이벤트의 주 생성자",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
