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

export default function TelemetryOtelPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/telemetry/otel-exporter.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">OTel Exporter</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              OTel SDK 없이 순수 HTTP/JSON으로 OTLP 엔드포인트에 메트릭과 이벤트를 전송하는 경량
              내보내기(Exporter)입니다. 주기적 자동 내보내기와 수동 내보내기를 모두 지원합니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ─── 1. 개요 ─── */}
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
                <code className="text-cyan-600">OTelExporter</code>는 OpenTelemetry SDK 전체를
                의존하지 않고 직접 JSON 페이로드를 구성하여 OTLP HTTP 엔드포인트로 전송하는 경량
                클래스입니다. 메트릭은 <code className="text-cyan-600">/v1/metrics</code>(OTLP
                Metrics), 이벤트는 <code className="text-cyan-600">/v1/logs</code>(OTLP Logs) 형태로
                분리하여 전송합니다.
              </p>
              <p>
                <code className="text-cyan-600">start()</code>를 호출하면{" "}
                <code className="text-cyan-600">exportIntervalMs</code> 간격으로{" "}
                <code className="text-cyan-600">export()</code>가 자동 실행됩니다.{" "}
                <code className="text-cyan-600">stop()</code>으로 타이머를 정리하고, 앱 종료 직전에
                <code className="text-cyan-600">export()</code>를 수동 호출하여 마지막 데이터를
                플러시합니다.
              </p>
              <p>
                텔레메트리가 비활성이거나 OTLP 엔드포인트가 설정되지 않으면 모든 메서드가 즉시
                반환합니다. 네트워크 전송에는 10초 타임아웃과{" "}
                <code className="text-cyan-600">AbortController</code>가 적용되어 지연 전송으로 인한
                앱 블록킹을 방지합니다.
              </p>
            </div>

            <MermaidDiagram
              title="OTelExporter 아키텍처"
              titleColor="purple"
              chart={`graph TD
  CONFIG["TelemetryConfig<br/><small>enabled, otlpEndpoint, exportIntervalMs</small>"]
  METRICS["MetricsCollector<br/><small>카운터 / 히스토그램</small>"]
  EVENTS["EventBuffer<br/><small>인메모리 이벤트</small>"]
  EXPORTER["OTelExporter"]
  TIMER["setInterval<br/><small>exportIntervalMs</small>"]
  PARALLEL["Promise.all"]
  METRIC_EP["/v1/metrics<br/><small>OTLP Metrics</small>"]
  LOG_EP["/v1/logs<br/><small>OTLP Logs</small>"]
  GRAFANA["Grafana / Jaeger<br/><small>외부 관찰 도구</small>"]

  CONFIG --> EXPORTER
  METRICS --> EXPORTER
  EVENTS --> EXPORTER
  TIMER -->|"주기적 export()"| EXPORTER
  EXPORTER --> PARALLEL
  PARALLEL -->|"exportMetrics()"| METRIC_EP
  PARALLEL -->|"exportEvents()"| LOG_EP
  METRIC_EP --> GRAFANA
  LOG_EP --> GRAFANA

  style EXPORTER fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
  style PARALLEL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style CONFIG fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style METRICS fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style EVENTS fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 우체국 정기 수거를 생각하세요. 메트릭과 이벤트는
              편지(데이터)로, EventBuffer/MetricsCollector는 우편함입니다. OTelExporter는 정해진
              시간마다 우편함을 비우고(flush) OTLP 서버(우체국)로 전달합니다. 전달 실패 시에도 앱
              실행은 계속됩니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 2. 레퍼런스 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📖</span> 레퍼런스
            </h2>

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class OTelExporter
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              생성자는 설정, 메트릭 수집기, 이벤트 버퍼를 주입받습니다.
            </p>
            <CodeBlock>
              <span className="kw">new</span> <span className="type">OTelExporter</span>({"\n"}
              {"  "}
              <span className="prop">config</span>: <span className="type">TelemetryConfig</span>,
              {"\n"}
              {"  "}
              <span className="prop">metricsCollector</span>:{" "}
              <span className="type">MetricsCollector</span>,{"\n"}
              {"  "}
              <span className="prop">eventBuffer</span>: <span className="type">EventBuffer</span>,
              {"\n"})
            </CodeBlock>

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "40px", marginBottom: "16px" }}
            >
              메서드
            </h3>
            <ParamTable
              params={[
                {
                  name: "start()",
                  type: "void",
                  required: false,
                  desc: "주기적 내보내기 시작. 텔레메트리 비활성 또는 엔드포인트 미설정 시 no-op",
                },
                {
                  name: "stop()",
                  type: "void",
                  required: false,
                  desc: "주기적 내보내기 타이머 정리. 앱 종료 전 반드시 호출",
                },
                {
                  name: "export()",
                  type: "Promise<void>",
                  required: false,
                  desc: "메트릭 + 이벤트를 즉시 한 번 내보내기. Promise.all 병렬 실행",
                },
              ]}
            />

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "40px", marginBottom: "16px" }}
            >
              class TelemetryExportError
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              내보내기 실패 시 던지는 에러 클래스입니다.{" "}
              <code className="text-cyan-600">BaseError</code>를 상속하며{" "}
              <code className="text-cyan-600">TELEMETRY_EXPORT_ERROR</code> 코드를 가집니다.
            </p>
            <CodeBlock>
              <span className="kw">class</span> <span className="type">TelemetryExportError</span>{" "}
              <span className="kw">extends</span> <span className="type">BaseError</span> {"{"}
              {"\n"}
              {"  "}
              <span className="fn">constructor</span>({"\n"}
              {"    "}
              <span className="prop">message</span>: <span className="type">string</span>,{"\n"}
              {"    "}
              <span className="prop">context</span>: <span className="type">Record</span>&lt;
              <span className="type">string</span>, <span className="type">unknown</span>&gt; = {},
              {"\n"}
              {"  "}){"\n"}
              {"}"}
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">export()</code>는{" "}
                <code className="text-cyan-600">TelemetryExportError</code>를 던집니다. 주기적
                내보내기는 fire-and-forget(<code className="text-cyan-600">void this.export()</code>
                ) 이므로 에러가 조용히 무시될 수 있습니다. 중요 오류는 별도 로깅을 권장합니다.
              </li>
              <li>
                메트릭과 이벤트 내보내기는 <code className="text-cyan-600">Promise.all</code>로 병렬
                실행됩니다. 하나가 실패하면 나머지도 취소됩니다.
              </li>
              <li>
                HTTP 요청에 10초 타임아웃이 설정됩니다. OTLP 엔드포인트가 느린 경우를 대비합니다.
              </li>
              <li>
                이벤트 버퍼는 <code className="text-cyan-600">flush()</code> 후 비워집니다. 내보내기
                실패 시 해당 배치 이벤트는 손실됩니다.
              </li>
            </ul>
          </section>
        </RevealOnScroll>

        {/* ─── 3. 사용법 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🚀</span> 사용법
            </h2>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 주기적 내보내기 시작/종료
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">loadTelemetryConfig()</code>로 설정을 로드하고,{" "}
              <code className="text-cyan-600">OTelExporter</code> 인스턴스를 생성한 뒤{" "}
              <code className="text-cyan-600">start()</code>를 호출합니다.
            </p>
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
              <span className="fn">loadTelemetryConfig</span>();{"\n"}
              <span className="kw">const</span> <span className="prop">exporter</span> ={" "}
              <span className="kw">new</span> <span className="type">OTelExporter</span>(
              <span className="prop">config</span>, <span className="prop">metrics</span>,{" "}
              <span className="prop">eventBuffer</span>);{"\n"}
              {"\n"}
              <span className="prop">exporter</span>.<span className="fn">start</span>();{" "}
              <span className="cm">{"// exportIntervalMs마다 자동 내보내기"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 앱 종료 시"}</span>
              {"\n"}
              <span className="prop">exporter</span>.<span className="fn">stop</span>();
              {"\n"}
              <span className="kw">await</span> <span className="prop">exporter</span>.
              <span className="fn">export</span>();{" "}
              <span className="cm">{"// 남은 데이터 최종 플러시"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 환경 변수 <code>DHELIX_TELEMETRY=true</code>와{" "}
              <code>DHELIX_TELEMETRY_OTLP_ENDPOINT</code>가 설정되지 않으면 <code>start()</code>/
              <code>export()</code>가 모두 no-op로 동작합니다. 데이터가 전송되지 않는다면 이 두 환경
              변수를 먼저 확인하세요.
            </Callout>

            <h3 className="text-lg font-bold" style={{ marginTop: "40px", marginBottom: "16px" }}>
              고급 &mdash; 수동 즉시 내보내기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">export()</code>를 직접 호출하여 주기를 기다리지 않고
              즉시 데이터를 전송할 수 있습니다. CI 테스트나 배치 작업 마무리 시 유용합니다.
            </p>
            <CodeBlock>
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">await</span> <span className="prop">exporter</span>.
              <span className="fn">export</span>();{"\n"}
              {"  "}
              <span className="prop">console</span>.<span className="fn">log</span>(
              <span className="str">&quot;텔레메트리 전송 완료&quot;</span>);{"\n"}
              {"}"} <span className="kw">catch</span> (<span className="prop">err</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="prop">console</span>.<span className="fn">error</span>(
              <span className="str">&quot;텔레메트리 전송 실패:&quot;</span>,{" "}
              <span className="prop">err</span>);{"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 주기적 내보내기와 수동 내보내기를 함께 사용할 수 있습니다. 예를
              들어 <code>start()</code>로 1분 주기 자동 전송을 켜두고, 세션 종료 시{" "}
              <code>stop()</code> 후 <code>export()</code>를 호출하면 마지막 배치까지 안전하게
              전송됩니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 4. 내부 구현 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>⚙️</span> 내부 구현
            </h2>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              OTLP 페이로드 변환 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              메트릭은 OTLP Metrics(Sum) 형식으로, 이벤트는 OTLP Logs 형식으로 각각 변환됩니다.
              타임스탬프는 밀리초에서 나노초로 변환됩니다.
            </p>

            <MermaidDiagram
              title="OTLP 페이로드 구성 과정"
              titleColor="purple"
              chart={`graph LR
  COUNTER["MetricsCollector<br/>.getCounterData()"]
  EBUF["EventBuffer<br/>.flush()"]

  METRIC_PAYLOAD["OTLP Metrics Payload<br/><small>resourceMetrics → scopeMetrics → metrics(Sum)</small>"]
  LOG_PAYLOAD["OTLP Logs Payload<br/><small>resourceLogs → scopeLogs → logRecords</small>"]

  RESOURCE["리소스 속성<br/><small>service.name, service.version</small>"]

  METRIC_EP["POST /v1/metrics<br/><small>10s timeout</small>"]
  LOG_EP["POST /v1/logs<br/><small>10s timeout</small>"]

  COUNTER --> METRIC_PAYLOAD
  EBUF --> LOG_PAYLOAD
  RESOURCE --> METRIC_PAYLOAD
  RESOURCE --> LOG_PAYLOAD
  METRIC_PAYLOAD --> METRIC_EP
  LOG_PAYLOAD --> LOG_EP

  style METRIC_PAYLOAD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style LOG_PAYLOAD fill:#dbeafe,stroke:#3b82f6,color:#1e293b,stroke-width:2px
  style RESOURCE fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              타임스탬프 변환
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              OTLP 규격은 나노초 단위의 Unix 타임스탬프를 문자열로 요구합니다. JavaScript의 밀리초
              타임스탬프에 <code className="text-cyan-600">1_000_000</code>을 곱합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 밀리초 → 나노초 (OTLP 규격)"}</span>
              {"\n"}
              <span className="prop">timeUnixNano</span>: <span className="type">String</span>(
              <span className="kw">new</span> <span className="type">Date</span>(
              <span className="prop">event</span>.<span className="prop">timestamp</span>).
              <span className="fn">getTime</span>() * <span className="num">1_000_000</span>)
            </CodeBlock>

            <DeepDive title="OTel SDK를 사용하지 않는 이유">
              <p className="mb-3">
                OpenTelemetry JavaScript SDK는 강력하지만 번들 크기와 부팅 시간에 큰 영향을
                미칩니다. dhelix는 CLI 도구로서 빠른 부팅(
                <code className="text-cyan-600">~150ms</code>)이 최우선 요구사항이므로, 순수
                HTTP/JSON으로 OTLP 프로토콜을 직접 구현했습니다.
              </p>
              <p className="text-gray-600">
                현재 구현은 카운터(Sum) 메트릭만 지원합니다. 히스토그램 지원은{" "}
                <code className="text-cyan-600">OTLPMetricPayload</code>의{" "}
                <code className="text-cyan-600">histogram</code> 필드에 구조가 준비되어 있으며, 추후
                확장할 수 있습니다.
              </p>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ─── 5. 트러블슈팅 ─── */}
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
                &quot;데이터가 Grafana에 나타나지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                1. <code className="text-cyan-600">DHELIX_TELEMETRY=true</code> 설정 여부 확인. 2.{" "}
                <code className="text-cyan-600">DHELIX_TELEMETRY_OTLP_ENDPOINT</code>가 올바른
                URL인지 확인(예: <code className="text-cyan-600">http://localhost:4318</code>). 3.{" "}
                <code className="text-cyan-600">exporter.start()</code>를 호출했는지 확인. 세 조건이
                모두 충족되어야 데이터가 전송됩니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;TelemetryExportError가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                에러의 <code className="text-cyan-600">context.endpoint</code>와{" "}
                <code className="text-cyan-600">context.cause</code>를 확인하세요. 주로 OTLP 서버가
                실행 중이지 않거나, 방화벽이 포트를 차단하거나, 엔드포인트 URL이 잘못된 경우입니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;메트릭 이름에 레이블 부분이 포함돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">buildMetricPayload()</code>에서 키를{" "}
                <code className="text-cyan-600">&quot;{"{"}&quot;</code>로 분리하여 메트릭 이름을
                추출합니다. 예를 들어{" "}
                <code className="text-cyan-600">dhelix.tokens.total{"{type=input}"}</code>에서 이름
                부분은 <code className="text-cyan-600">dhelix.tokens.total</code>이고, 레이블은 OTLP
                속성(attributes)으로 분리됩니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;이벤트가 배치 전송 실패로 사라졌어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">flush()</code>는 버퍼를 즉시 비우므로, 전송 실패 시
                해당 배치의 이벤트가 손실됩니다. 중요 이벤트는 별도 로깅 채널(예: 파일 로그)에도
                기록하는 이중화를 고려하세요.
              </p>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 6. 관련 문서 ─── */}
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
                  name: "config.ts",
                  slug: "telemetry-config",
                  relation: "sibling",
                  desc: "OTLP 엔드포인트, 내보내기 간격 등 텔레메트리 설정 로드",
                },
                {
                  name: "events.ts",
                  slug: "telemetry-events",
                  relation: "sibling",
                  desc: "EventBuffer와 6가지 이벤트 타입 정의 — OTelExporter의 이벤트 소스",
                },
                {
                  name: "metrics.ts",
                  slug: "telemetry-metrics",
                  relation: "sibling",
                  desc: "MetricsCollector — OTelExporter의 메트릭 소스",
                },
                {
                  name: "utils-error.ts",
                  slug: "utils-error",
                  relation: "parent",
                  desc: "BaseError 기반 클래스 — TelemetryExportError의 부모",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
