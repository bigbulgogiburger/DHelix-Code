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

export default function TelemetryConfigPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/telemetry/config.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">텔레메트리 설정</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              환경 변수에서 텔레메트리 활성화 여부, OTLP 엔드포인트, 내보내기 간격 등을 로드하고 Zod
              스키마로 유효성 검사하는 설정 모듈입니다. 기본값으로 텔레메트리는 비활성(프라이버시
              보호)입니다.
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
                <code className="text-cyan-600">config.ts</code>는 텔레메트리 시스템의 진입점입니다.
                <code className="text-cyan-600">loadTelemetryConfig()</code> 함수가{" "}
                <code className="text-cyan-600">process.env</code>에서 값을 읽어 Zod 스키마로
                파싱합니다. 스키마에 기본값이 정의되어 있어, 환경 변수가 없는 필드는 자동으로
                기본값이 채워집니다.
              </p>
              <p>
                두 가지 네이밍 규칙을 지원합니다: dbcode 전용 변수(
                <code className="text-cyan-600">DBCODE_TELEMETRY_*</code>)와 표준 OpenTelemetry
                변수(<code className="text-cyan-600">OTEL_*</code>). 전용 변수가 우선 적용되고,
                없으면 표준 변수로 폴백합니다.
              </p>
              <p>
                텔레메트리는 기본적으로 비활성(<code className="text-cyan-600">enabled: false</code>
                )입니다. 사용자가 명시적으로{" "}
                <code className="text-cyan-600">DBCODE_TELEMETRY=true</code> 또는{" "}
                <code className="text-cyan-600">DBCODE_TELEMETRY_ENABLED=true</code>를 설정해야
                활성화됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="텔레메트리 설정 로드 흐름"
              titleColor="purple"
              chart={`graph TD
  ENV["process.env<br/><small>DBCODE_TELEMETRY_*, OTEL_*</small>"]
  RAW["원시 값 추출<br/><small>undefined 제거</small>"]
  ZOD["Zod telemetryConfigSchema<br/><small>유효성 검사 + 기본값 적용</small>"]
  CONFIG["TelemetryConfig<br/><small>enabled, otlpEndpoint, prometheusPort,<br/>exportIntervalMs, serviceName, serviceVersion,<br/>resourceAttributes</small>"]
  EXPORTER["OTelExporter<br/><small>설정 주입</small>"]
  METRICS["MetricsCollector"]
  EVENTS["EventBuffer"]

  ENV --> RAW
  RAW --> ZOD
  ZOD --> CONFIG
  CONFIG --> EXPORTER
  EXPORTER --> METRICS
  EXPORTER --> EVENTS

  style CONFIG fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
  style ZOD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style ENV fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style EXPORTER fill:#dbeafe,stroke:#3b82f6,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>프라이버시 우선 설계:</strong> 텔레메트리는 옵트인(opt-in) 방식입니다.
              사용자가 명시적으로 활성화하지 않으면 어떤 데이터도 외부로 전송되지 않습니다. 이는 CLI
              도구에서 사용자 신뢰를 유지하는 중요한 설계 원칙입니다.
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
              loadTelemetryConfig()
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              환경 변수에서 텔레메트리 설정을 로드하여 파싱된{" "}
              <code className="text-cyan-600">TelemetryConfig</code> 객체를 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">loadTelemetryConfig</span>
              (): <span className="type">TelemetryConfig</span>
            </CodeBlock>

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "40px", marginBottom: "16px" }}
            >
              type TelemetryConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              Zod 스키마에서 추론된 텔레메트리 설정 타입입니다. 모든 필드에 기본값이 있습니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "enabled",
                  type: "boolean",
                  required: false,
                  desc: "텔레메트리 활성화 여부. 기본값: false (프라이버시 보호)",
                },
                {
                  name: "otlpEndpoint",
                  type: "string | undefined",
                  required: false,
                  desc: "OTLP 엔드포인트 URL. 유효한 URL 형식 필수",
                },
                {
                  name: "prometheusPort",
                  type: "number | undefined",
                  required: false,
                  desc: "Prometheus 메트릭 노출 포트 (선택적)",
                },
                {
                  name: "exportIntervalMs",
                  type: "number",
                  required: false,
                  desc: "내보내기 간격(밀리초). 기본값: 60000 (1분)",
                },
                {
                  name: "serviceName",
                  type: "string",
                  required: false,
                  desc: 'OTLP 리소스 서비스 이름. 기본값: "dbcode"',
                },
                {
                  name: "serviceVersion",
                  type: "string",
                  required: false,
                  desc: 'OTLP 리소스 서비스 버전. 기본값: "0.1.0"',
                },
                {
                  name: "resourceAttributes",
                  type: "Record<string, string>",
                  required: false,
                  desc: "OTel 리소스에 추가할 커스텀 속성. 기본값: {}",
                },
              ]}
            />

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "40px", marginBottom: "16px" }}
            >
              지원 환경 변수
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-3 font-semibold text-gray-700">환경 변수</th>
                    <th className="text-left p-3 font-semibold text-gray-700">매핑 필드</th>
                    <th className="text-left p-3 font-semibold text-gray-700">우선순위</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="p-3">
                      <code className="text-cyan-600">DBCODE_TELEMETRY</code>
                    </td>
                    <td className="p-3 text-gray-600">enabled</td>
                    <td className="p-3 text-gray-500">1순위</td>
                  </tr>
                  <tr>
                    <td className="p-3">
                      <code className="text-cyan-600">DBCODE_TELEMETRY_ENABLED</code>
                    </td>
                    <td className="p-3 text-gray-600">enabled</td>
                    <td className="p-3 text-gray-500">1순위</td>
                  </tr>
                  <tr>
                    <td className="p-3">
                      <code className="text-cyan-600">DBCODE_TELEMETRY_OTLP_ENDPOINT</code>
                    </td>
                    <td className="p-3 text-gray-600">otlpEndpoint</td>
                    <td className="p-3 text-gray-500">1순위</td>
                  </tr>
                  <tr>
                    <td className="p-3">
                      <code className="text-cyan-600">OTEL_EXPORTER_OTLP_ENDPOINT</code>
                    </td>
                    <td className="p-3 text-gray-600">otlpEndpoint</td>
                    <td className="p-3 text-gray-500">폴백</td>
                  </tr>
                  <tr>
                    <td className="p-3">
                      <code className="text-cyan-600">DBCODE_TELEMETRY_SERVICE_NAME</code>
                    </td>
                    <td className="p-3 text-gray-600">serviceName</td>
                    <td className="p-3 text-gray-500">1순위</td>
                  </tr>
                  <tr>
                    <td className="p-3">
                      <code className="text-cyan-600">OTEL_SERVICE_NAME</code>
                    </td>
                    <td className="p-3 text-gray-600">serviceName</td>
                    <td className="p-3 text-gray-500">폴백</td>
                  </tr>
                  <tr>
                    <td className="p-3">
                      <code className="text-cyan-600">DBCODE_TELEMETRY_PROMETHEUS_PORT</code>
                    </td>
                    <td className="p-3 text-gray-600">prometheusPort</td>
                    <td className="p-3 text-gray-500">1순위</td>
                  </tr>
                  <tr>
                    <td className="p-3">
                      <code className="text-cyan-600">DBCODE_TELEMETRY_EXPORT_INTERVAL_MS</code>
                    </td>
                    <td className="p-3 text-gray-600">exportIntervalMs</td>
                    <td className="p-3 text-gray-500">1순위</td>
                  </tr>
                  <tr>
                    <td className="p-3">
                      <code className="text-cyan-600">DBCODE_TELEMETRY_SERVICE_VERSION</code>
                    </td>
                    <td className="p-3 text-gray-600">serviceVersion</td>
                    <td className="p-3 text-gray-500">1순위</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">otlpEndpoint</code>는 유효한 URL 형식이어야 합니다.
                잘못된 URL을 입력하면 Zod 파싱 오류가 발생합니다.
              </li>
              <li>
                <code className="text-cyan-600">DBCODE_TELEMETRY=true</code>와{" "}
                <code className="text-cyan-600">DBCODE_TELEMETRY_ENABLED=true</code>는 OR
                조건입니다. 하나만 설정해도 활성화됩니다.
              </li>
              <li>
                환경 변수에 없는 필드는 Zod 스키마 기본값이 적용됩니다. 명시적으로{" "}
                <code className="text-cyan-600">undefined</code>인 값은{" "}
                <code className="text-cyan-600">Object.fromEntries(filter)</code>로 제거하여 Zod의
                기본값 적용을 보장합니다.
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
              기본 사용법 &mdash; 설정 로드 및 활성화 확인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">loadTelemetryConfig()</code>를 호출하여 설정을
              가져오고,
              <code className="text-cyan-600">enabled</code> 여부로 텔레메트리 초기화를 분기합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{ "}
              <span className="fn">loadTelemetryConfig</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./telemetry/config.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">config</span> ={" "}
              <span className="fn">loadTelemetryConfig</span>();{"\n"}
              {"\n"}
              <span className="kw">if</span> (<span className="prop">config</span>.
              <span className="prop">enabled</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="prop">console</span>.<span className="fn">log</span>(
              <span className="str">&quot;텔레메트리 활성화됨:&quot;</span>,{" "}
              <span className="prop">config</span>.<span className="prop">otlpEndpoint</span>);
              {"\n"}
              {"}"} <span className="kw">else</span> {"{"}
              {"\n"}
              {"  "}
              <span className="prop">console</span>.<span className="fn">log</span>(
              <span className="str">&quot;텔레메트리 비활성 상태&quot;</span>);{"\n"}
              {"}"}
            </CodeBlock>

            <h3 className="text-lg font-bold" style={{ marginTop: "40px", marginBottom: "16px" }}>
              환경 변수 설정 예시
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              셸 또는 <code className="text-cyan-600">.env</code> 파일에 다음 변수를 설정합니다.
            </p>
            <CodeBlock>
              <span className="cm"># 간편 활성화</span>
              {"\n"}
              <span className="prop">DBCODE_TELEMETRY</span>=<span className="str">true</span>
              {"\n"}
              {"\n"}
              <span className="cm">
                # OTLP 엔드포인트 (Grafana Agent, OpenTelemetry Collector 등)
              </span>
              {"\n"}
              <span className="prop">DBCODE_TELEMETRY_OTLP_ENDPOINT</span>=
              <span className="str">http://localhost:4318</span>
              {"\n"}
              {"\n"}
              <span className="cm"># 내보내기 간격 30초로 단축</span>
              {"\n"}
              <span className="prop">DBCODE_TELEMETRY_EXPORT_INTERVAL_MS</span>=
              <span className="str">30000</span>
              {"\n"}
              {"\n"}
              <span className="cm"># 표준 OTel 변수도 폴백으로 지원</span>
              {"\n"}
              <span className="prop">OTEL_SERVICE_NAME</span>=<span className="str">my-dbcode</span>
              {"\n"}
              <span className="prop">OTEL_EXPORTER_OTLP_ENDPOINT</span>=
              <span className="str">http://otel-collector:4318</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>otlpEndpoint</code>에 유효하지 않은 URL을 입력하면 Zod
              파싱 오류(<code>ZodError</code>)가 발생합니다. URL은 <code>http://</code> 또는{" "}
              <code>https://</code>로 시작해야 합니다.
            </Callout>

            <h3 className="text-lg font-bold" style={{ marginTop: "40px", marginBottom: "16px" }}>
              고급 &mdash; 커스텀 리소스 속성 추가
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">resourceAttributes</code>는 현재 환경 변수로 설정할 수
              없습니다. 코드에서 직접 설정을 조합하여 사용합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{ "}
              <span className="fn">loadTelemetryConfig</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./telemetry/config.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">baseConfig</span> ={" "}
              <span className="fn">loadTelemetryConfig</span>();{"\n"}
              <span className="kw">const</span> <span className="prop">config</span> = {"{"}
              {"\n"}
              {"  "}...<span className="prop">baseConfig</span>,{"\n"}
              {"  "}
              <span className="prop">resourceAttributes</span>: {"{"}
              {"\n"}
              {"    "}
              <span className="str">&quot;deployment.environment&quot;</span>:{" "}
              <span className="str">&quot;production&quot;</span>,{"\n"}
              {"    "}
              <span className="str">&quot;host.name&quot;</span>: <span className="prop">os</span>.
              <span className="fn">hostname</span>(),{"\n"}
              {"  "}
              {"}"},{"\n"}
              {"}"};
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 표준 OTel 환경 변수(
              <code>OTEL_SERVICE_NAME</code>, <code>OTEL_EXPORTER_OTLP_ENDPOINT</code>)를 이미
              설정한 환경이라면, <code>DBCODE_TELEMETRY=true</code>만 추가하면 바로 사용할 수
              있습니다.
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
              환경 변수 파싱 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              원시 값 추출 후 <code className="text-cyan-600">undefined</code> 제거, 그리고 Zod 파싱
              순서로 처리됩니다. Zod 기본값이 올바르게 적용되도록 undefined 값을 필터링합니다.
            </p>

            <MermaidDiagram
              title="환경 변수 파싱 상태 다이어그램"
              titleColor="purple"
              chart={`stateDiagram-v2
  [*] --> 환경변수읽기: process.env 접근
  환경변수읽기 --> 원시값추출: DBCODE_TELEMETRY_* / OTEL_* 매핑
  원시값추출 --> undefined제거: Object.fromEntries(filter)
  undefined제거 --> Zod파싱: telemetryConfigSchema.parse(cleaned)
  Zod파싱 --> 유효: 파싱 성공
  Zod파싱 --> 에러: ZodError (잘못된 URL 등)
  유효 --> TelemetryConfig: 기본값 적용 완료
  에러 --> [*]: 예외 전파`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              활성화 조건 판별
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              두 환경 변수 중 하나라도 <code className="text-cyan-600">&quot;true&quot;</code>이면
              활성화됩니다. OR 논리로 결합되어 있습니다.
            </p>
            <CodeBlock>
              <span className="prop">enabled</span>: <span className="prop">env</span>[
              <span className="str">
                `${"{"}ENV_PREFIX{"}"}ENABLED`
              </span>
              ] ===
              <span className="str">&quot;true&quot;</span> || <span className="prop">env</span>.
              <span className="prop">DBCODE_TELEMETRY</span> ===
              <span className="str">&quot;true&quot;</span>
            </CodeBlock>

            <DeepDive title="Zod 기본값 적용 메커니즘">
              <p className="mb-3">
                Zod의 <code className="text-cyan-600">.default(value)</code>는 값이{" "}
                <code className="text-cyan-600">undefined</code>일 때만 기본값을 적용합니다. 하지만
                자바스크립트에서 객체의 키가 존재하고 값이{" "}
                <code className="text-cyan-600">undefined</code>이면, Zod는 이를 &quot;값이
                없음&quot;으로 처리하지 않을 수 있습니다.
              </p>
              <p className="text-gray-600">
                이를 방지하기 위해 <code className="text-cyan-600">Object.fromEntries()</code>로
                <code className="text-cyan-600">undefined</code> 값을 가진 키를 완전히 제거합니다.
                이렇게 하면 Zod 파싱 시 해당 키가 아예 없는 것으로 처리되어 기본값이 올바르게
                적용됩니다.
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
                &quot;텔레메트리를 켰는데 데이터가 전송되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">loadTelemetryConfig()</code>가 반환한 객체의{" "}
                <code className="text-cyan-600">enabled</code> 값과{" "}
                <code className="text-cyan-600">otlpEndpoint</code>를 출력해 확인하세요. enabled가
                true여도 otlpEndpoint가 없으면 OTelExporter가 내보내기를 건너뜁니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;ZodError: Invalid url 오류가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">DBCODE_TELEMETRY_OTLP_ENDPOINT</code> 또는{" "}
                <code className="text-cyan-600">OTEL_EXPORTER_OTLP_ENDPOINT</code> 값이 유효한 URL
                형식이 아닙니다. 반드시 <code className="text-cyan-600">http://hostname:port</code>{" "}
                형식으로 입력하세요. 끝에 슬래시(/)나 경로를 붙이면 안 됩니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;exportIntervalMs 기본값이 너무 길어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                기본값은 60000ms(1분)입니다.{" "}
                <code className="text-cyan-600">DBCODE_TELEMETRY_EXPORT_INTERVAL_MS=10000</code>
                으로 10초로 단축할 수 있습니다. 단, 너무 짧으면 OTLP 엔드포인트에 부하가 증가할 수
                있습니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;기존 OTel 환경 변수가 있는데 dbcode 변수도 설정해야 하나요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">OTEL_EXPORTER_OTLP_ENDPOINT</code>와{" "}
                <code className="text-cyan-600">OTEL_SERVICE_NAME</code>은 폴백으로 지원됩니다. 이미
                표준 OTel 변수가 설정된 환경이라면{" "}
                <code className="text-cyan-600">DBCODE_TELEMETRY=true</code>만 추가하면 됩니다.
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
                  name: "otel-exporter.ts",
                  slug: "telemetry-otel",
                  relation: "child",
                  desc: "TelemetryConfig를 주입받아 OTLP 엔드포인트로 데이터를 전송",
                },
                {
                  name: "events.ts",
                  slug: "telemetry-events",
                  relation: "sibling",
                  desc: "이벤트 버퍼 및 6가지 텔레메트리 이벤트 타입 정의",
                },
                {
                  name: "metrics.ts",
                  slug: "telemetry-metrics",
                  relation: "sibling",
                  desc: "카운터 / 히스토그램 메트릭 수집기",
                },
                {
                  name: "config-loader.ts",
                  slug: "config-loader",
                  relation: "sibling",
                  desc: "dbcode 메인 설정 로드 — 5계층 계층적 설정 시스템",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
