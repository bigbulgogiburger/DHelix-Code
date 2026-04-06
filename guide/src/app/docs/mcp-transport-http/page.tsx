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

export default function MCPTransportHttpPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/mcp/transports/http.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">HttpTransport</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              Streamable HTTP POST를 통한 JSON-RPC 통신 트랜스포트입니다.
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
                <code className="text-cyan-600">HttpTransport</code>는 네이티브{" "}
                <code className="text-cyan-600">fetch()</code> API를 사용하여 MCP 서버와 HTTP
                기반으로 통신합니다. MCP 최신 스펙의 &quot;Streamable HTTP&quot; 방식을 구현하며, 각
                요청은 독립적인 HTTP POST로 전송됩니다.
              </p>
              <p>
                HTTP는 본래 상태가 없는(stateless) 프로토콜이지만,
                <code className="text-cyan-600">Mcp-Session-Id</code> 헤더를 통해 세션 상태를
                유지합니다. 서버가 첫 응답에서 세션 ID를 반환하면 이후 모든 요청에 자동으로
                포함됩니다. Bearer 토큰을 통한 OAuth 인증도 지원합니다.
              </p>
              <p>
                응답은 일반 JSON 또는 SSE 스트림 형식으로 수신할 수 있습니다. 서버가
                <code className="text-cyan-600">text/event-stream</code> Content-Type으로 응답하면
                SSE 파싱 로직으로 전환됩니다. 5xx 에러와 네트워크 에러에 대해서는 지수 백오프로 최대
                3회 자동 재시도합니다.
              </p>
            </div>

            <MermaidDiagram
              title="HttpTransport 통신 구조"
              titleColor="purple"
              chart={`graph TD
  CLIENT["dhelix<br/><small>클라이언트</small>"]
  SERVER["MCP 서버<br/><small>원격</small>"]

  CLIENT -->|"HTTP POST<br/>JSON-RPC + Session-Id"| SERVER
  SERVER -->|"JSON 응답<br/>또는 SSE 스트림"| CLIENT

  CLIENT -.->|"Authorization<br/>Bearer 토큰"| SERVER
  SERVER -.->|"Mcp-Session-Id<br/>세션 ID 발급"| CLIENT

  style CLIENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b,stroke-width:2px
  style SERVER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 우체국 택배를 떠올리세요. 매번 독립적인 택배(HTTP POST)를
              보내지만, 송장 번호(Session ID)가 있으면 같은 거래로 묶어서 추적할 수 있습니다. 배송
              실패(5xx)하면 자동으로 재배송(재시도)을 시도하지만, 주소 오류(4xx)면 즉시 반송합니다.
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

            {/* HttpTransportError */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class HttpTransportError
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              HTTP 트랜스포트 전용 에러 클래스입니다. 에러 코드는
              <code className="text-cyan-600">&quot;HTTP_TRANSPORT_ERROR&quot;</code>이며,
              <code className="text-cyan-600">context</code>에 HTTP 상태 코드가 포함됩니다.
            </p>

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
                  name: "DEFAULT_HTTP_TIMEOUT_MS",
                  type: "30_000",
                  required: true,
                  desc: "HTTP 요청 기본 타임아웃 (30초)",
                },
                {
                  name: "MAX_RETRIES",
                  type: "3",
                  required: true,
                  desc: "5xx/네트워크 에러 최대 재시도 횟수",
                },
                {
                  name: "RETRY_BASE_DELAY_MS",
                  type: "1_000",
                  required: true,
                  desc: "지수 백오프 기본 딜레이 (1초)",
                },
              ]}
            />

            {/* HttpTransport class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class HttpTransport
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">MCPTransportLayer</code> 인터페이스의 HTTP
              구현체입니다. fetch() API로 JSON-RPC 메시지를 POST하고, JSON 또는 SSE 형식의 응답을
              처리합니다.
            </p>

            {/* Constructor */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">constructor(config)</h4>
            <CodeBlock>
              <span className="kw">constructor</span>(<span className="prop">config</span>:{" "}
              <span className="type">MCPServerConfig</span>)
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "config",
                  type: "MCPServerConfig",
                  required: true,
                  desc: "MCP 서버 설정 (url 필수)",
                },
              ]}
            />

            {/* setAuthToken */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">setAuthToken(token)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              Bearer 인증 토큰을 설정합니다. 설정된 토큰은 이후 모든 HTTP 요청의
              <code className="text-cyan-600">Authorization</code> 헤더에 포함됩니다.
            </p>
            <CodeBlock>
              <span className="fn">setAuthToken</span>(<span className="prop">token</span>:{" "}
              <span className="type">string</span>): <span className="type">void</span>
            </CodeBlock>
            <ParamTable
              params={[
                { name: "token", type: "string", required: true, desc: "Bearer 토큰 문자열" },
              ]}
            />

            {/* connect */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">connect()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              HTTP 트랜스포트 연결을 수립합니다.
              <code className="text-cyan-600">initialize</code> 요청을 POST로 전송하여 서버 도달
              가능성을 확인하고, 응답에서 세션 ID를 추출합니다.
            </p>
            <CodeBlock>
              <span className="fn">connect</span>(): <span className="type">Promise</span>&lt;
              <span className="type">void</span>&gt;
            </CodeBlock>

            {/* disconnect */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">disconnect()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              HTTP 트랜스포트 연결을 종료합니다. HTTP는 stateless이므로 실제 연결을 끊을 필요 없이
              종료 핸들러만 호출합니다.
            </p>
            <CodeBlock>
              <span className="fn">disconnect</span>(): <span className="type">Promise</span>&lt;
              <span className="type">void</span>&gt;
            </CodeBlock>

            {/* sendRequest */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              sendRequest(id, method, params)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              JSON-RPC 요청을 HTTP POST로 전송합니다.
              <code className="text-cyan-600">postWithRetry()</code>를 사용하여 5xx 에러 시 자동
              재시도합니다.
            </p>
            <CodeBlock>
              <span className="fn">sendRequest</span>(<span className="prop">id</span>:{" "}
              <span className="type">string</span> | <span className="type">number</span>,{" "}
              <span className="prop">method</span>: <span className="type">string</span>,{" "}
              <span className="prop">params</span>: <span className="type">Record</span>&lt;
              <span className="type">string</span>, <span className="type">unknown</span>&gt;):{" "}
              <span className="type">void</span>
            </CodeBlock>

            {/* sendNotification */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              sendNotification(method, params)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              JSON-RPC 알림을 HTTP POST로 전송합니다. 재시도 로직 없이 단일 전송합니다.
            </p>
            <CodeBlock>
              <span className="fn">sendNotification</span>(<span className="prop">method</span>:{" "}
              <span className="type">string</span>, <span className="prop">params</span>:{" "}
              <span className="type">Record</span>&lt;<span className="type">string</span>,{" "}
              <span className="type">unknown</span>&gt;): <span className="type">void</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">url</code>이 설정에 없으면 생성자에서 즉시
                <code className="text-cyan-600">HttpTransportError</code>가 발생합니다.
              </li>
              <li>
                <code className="text-cyan-600">connect()</code>는 실제 HTTP 연결이 아니라
                <code className="text-cyan-600">initialize</code> 핸드셰이크입니다. 서버가 MCP
                initialize 프로토콜을 지원하지 않으면 실패합니다.
              </li>
              <li>
                <code className="text-cyan-600">sendRequest()</code>는 재시도 로직(
                <code className="text-cyan-600">postWithRetry</code>)을 사용하지만,{" "}
                <code className="text-cyan-600">sendNotification()</code>은 단일 전송(
                <code className="text-cyan-600">postMessage</code>)만 합니다. 알림은 응답이 필요
                없으므로 재시도가 불필요합니다.
              </li>
              <li>
                4xx 에러(400~499)는 클라이언트 에러이므로 재시도하지 않고 즉시 throw합니다. 5xx
                에러(500~599)와 네트워크 에러만 재시도 대상입니다.
              </li>
              <li>
                <code className="text-cyan-600">Mcp-Session-Id</code>는 모든 응답에서 추출합니다.
                서버가 세션을 변경하면 자동으로 업데이트됩니다.
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
              기본 사용법 &mdash; 원격 MCP 서버 연결
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              원격 MCP 서버에 HTTP로 연결하는 기본 패턴입니다. 가장 간단한 방식으로, 세션 관리와
              에러 재시도가 자동으로 처리됩니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">transport</span> ={" "}
              <span className="kw">new</span> <span className="fn">HttpTransport</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">name</span>:{" "}
              <span className="str">&quot;remote-api&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">transport</span>: <span className="str">&quot;http&quot;</span>
              ,{"\n"}
              {"  "}
              <span className="prop">url</span>:{" "}
              <span className="str">&quot;https://mcp.example.com/api&quot;</span>,{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 핸들러 등록"}</span>
              {"\n"}
              <span className="prop">transport</span>.<span className="fn">onMessage</span>((
              <span className="prop">msg</span>) =&gt; <span className="fn">handleResponse</span>(
              <span className="prop">msg</span>));
              {"\n"}
              <span className="prop">transport</span>.<span className="fn">onError</span>((
              <span className="prop">err</span>) =&gt; <span className="fn">console</span>.
              <span className="fn">error</span>(<span className="prop">err</span>));
              {"\n"}
              {"\n"}
              <span className="cm">{"// 연결 (initialize 핸드셰이크)"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="prop">transport</span>.
              <span className="fn">connect</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 이후 요청은 자동으로 Session-Id 포함"}</span>
              {"\n"}
              <span className="prop">transport</span>.<span className="fn">sendRequest</span>(
              <span className="num">1</span>, <span className="str">&quot;tools/list&quot;</span>,{" "}
              {"{}"});
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>connect()</code>에서 <code>initialize</code> 요청을
              보내므로, 서버가 MCP initialize 프로토콜을 지원해야 합니다. 일반 HTTP API 서버에는
              사용할 수 없습니다.
            </Callout>

            {/* 고급: OAuth 인증 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; OAuth Bearer 토큰 인증
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인증이 필요한 MCP 서버에는 Bearer 토큰을 설정합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">transport</span> ={" "}
              <span className="kw">new</span> <span className="fn">HttpTransport</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">name</span>:{" "}
              <span className="str">&quot;secure-server&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">transport</span>: <span className="str">&quot;http&quot;</span>
              ,{"\n"}
              {"  "}
              <span className="prop">url</span>:{" "}
              <span className="str">&quot;https://api.example.com/mcp&quot;</span>,{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// connect 전에 토큰 설정"}</span>
              {"\n"}
              <span className="prop">transport</span>.<span className="fn">setAuthToken</span>(
              <span className="str">&quot;eyJhbGciOiJSUzI1NiIs...&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 모든 요청에 Authorization: Bearer ... 헤더 포함"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="prop">transport</span>.
              <span className="fn">connect</span>();
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>setAuthToken()</code>은 <code>connect()</code> 이전에
              호출해야 initialize 요청에도 인증 헤더가 포함됩니다.
            </Callout>

            <DeepDive title="재시도(Retry) vs 재연결(Reconnect) 차이">
              <p className="mb-3">
                HttpTransport의 <strong>재시도</strong>와 SseTransport의 <strong>재연결</strong>은
                다른 개념입니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>재시도(Retry):</strong> 개별 HTTP 요청이 5xx 에러로 실패했을 때, 같은
                  요청을 다시 보냅니다. 요청 수준의 복구입니다.
                </li>
                <li>
                  <strong>재연결(Reconnect):</strong> SSE 스트림 자체가 끊겼을 때, 새 연결을
                  수립합니다. 연결 수준의 복구입니다.
                </li>
              </ul>
              <p className="mt-3 text-gray-600">
                HttpTransport는 stateless이므로 &quot;재연결&quot; 개념이 없고, 각 요청 단위로
                재시도합니다. 4xx 에러는 클라이언트 잘못이므로 재시도해도 동일하게 실패하여 즉시
                throw합니다.
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
              요청/응답 처리 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              HTTP POST 요청 전송부터 응답 처리, 재시도까지의 전체 흐름입니다.
            </p>

            <MermaidDiagram
              title="HttpTransport 요청 처리 흐름"
              titleColor="purple"
              chart={`graph TD
  REQ(("sendRequest()")) --> RETRY["postWithRetry()<br/><small>최대 3회 시도</small>"]
  RETRY --> POST["postMessage()<br/><small>fetch() POST</small>"]
  POST --> CHECK{"응답 상태"}
  CHECK -->|"200 OK"| CT{"Content-Type?"}
  CT -->|"application/json"| JSON["JSON 파싱<br/>messageHandler 호출"]
  CT -->|"text/event-stream"| SSE["SSE 스트림 소비<br/>consumeSSEStream()"]
  CHECK -->|"202 Accepted"| DONE(("완료"))
  CHECK -->|"4xx"| FAIL_NOW["즉시 throw<br/><small>재시도 불가</small>"]
  CHECK -->|"5xx"| BACKOFF["지수 백오프<br/><small>1s, 2s, 4s</small>"]
  BACKOFF --> POST

  POST -.->|"Mcp-Session-Id<br/>추출"| SESSION["세션 ID 저장"]

  style RETRY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style FAIL_NOW fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style BACKOFF fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style JSON fill:#dcfce7,stroke:#10b981,color:#065f46
  style SSE fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              재시도 로직 핵심 코드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">postWithRetry()</code>의 지수 백오프 재시도
              로직입니다.
            </p>
            <CodeBlock>
              <span className="kw">private async</span> <span className="fn">postWithRetry</span>(
              <span className="prop">message</span>: <span className="type">Record</span>&lt;
              <span className="type">string</span>, <span className="type">unknown</span>&gt;):{" "}
              <span className="type">Promise</span>&lt;<span className="type">void</span>&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="kw">let</span> <span className="prop">lastError</span>:{" "}
              <span className="type">Error</span> | <span className="type">null</span> ={" "}
              <span className="kw">null</span>;{"\n"}
              {"\n"}
              {"  "}
              <span className="kw">for</span> (<span className="kw">let</span>{" "}
              <span className="prop">attempt</span> = <span className="num">0</span>;{" "}
              <span className="prop">attempt</span> {"<"} <span className="num">3</span>;{" "}
              <span className="prop">attempt</span>++) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"      "}
              <span className="kw">await</span> <span className="kw">this</span>.
              <span className="fn">postMessage</span>(<span className="prop">message</span>);
              {"\n"}
              {"      "}
              <span className="kw">return</span>;{" "}
              <span className="cm">{"// 성공 시 즉시 반환"}</span>
              {"\n"}
              {"    "}
              <span className="kw">{"}"} catch</span> (<span className="prop">error</span>) {"{"}
              {"\n"}
              {"      "}
              <span className="prop">lastError</span> = <span className="prop">error</span>;{"\n"}
              {"\n"}
              {"      "}
              <span className="cm">{"// 4xx: 클라이언트 에러 → 재시도 불가"}</span>
              {"\n"}
              {"      "}
              <span className="kw">if</span> (<span className="prop">status</span> {">="}{" "}
              <span className="num">400</span> && <span className="prop">status</span> {"<"}{" "}
              <span className="num">500</span>) <span className="kw">throw</span>{" "}
              <span className="prop">error</span>;{"\n"}
              {"\n"}
              {"      "}
              <span className="cm">{"// 5xx/네트워크: 지수 백오프 대기"}</span>
              {"\n"}
              {"      "}
              <span className="kw">const</span> <span className="prop">delay</span> ={" "}
              <span className="num">1000</span> * <span className="fn">Math</span>.
              <span className="fn">pow</span>(<span className="num">2</span>,{" "}
              <span className="prop">attempt</span>);
              {"\n"}
              {"      "}
              <span className="kw">await</span> <span className="kw">new</span>{" "}
              <span className="fn">Promise</span>(<span className="prop">r</span> =&gt;{" "}
              <span className="fn">setTimeout</span>(<span className="prop">r</span>,{" "}
              <span className="prop">delay</span>));
              {"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"  "}
              <span className="kw">throw</span> <span className="prop">lastError</span>;{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">세션 관리:</strong> <code>buildHeaders()</code>가
                매 요청마다 <code>Mcp-Session-Id</code>와 <code>Authorization</code> 헤더를 조건부로
                추가합니다.
              </p>
              <p>
                <strong className="text-gray-900">응답 분기:</strong> Content-Type이{" "}
                <code>text/event-stream</code>이면 SSE 파싱, 그 외는 JSON 파싱으로 처리합니다. 202
                Accepted는 본문 없이 성공 처리됩니다.
              </p>
              <p>
                <strong className="text-gray-900">재시도 판단:</strong> 4xx는 클라이언트 잘못이므로
                즉시 throw, 5xx와 네트워크 에러만 재시도합니다. 이 구분은 불필요한 재시도를
                방지합니다.
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
                &quot;Request failed after retries 에러가 발생합니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                3회 재시도를 모두 실패한 경우입니다. 서버가 다운되었거나 네트워크 연결에 문제가
                있습니다. 서버 로그를 확인하고, 방화벽이나 프록시 설정이 HTTP POST를 차단하지 않는지
                확인하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;HTTP 401 Unauthorized 에러가 발생합니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                인증 토큰이 설정되지 않았거나 만료되었습니다.
                <code className="text-cyan-600">setAuthToken()</code>으로 유효한 토큰을 설정하세요.
                401은 4xx 에러이므로 재시도 없이 즉시 실패합니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;connect()에서 타임아웃이 발생합니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                30초 내에 서버가 initialize 응답을 보내지 않은 경우입니다. 서버 URL이 올바른지,
                서버가 실행 중인지 확인하세요. 타임아웃은 내부 상수(
                <code className="text-cyan-600">DEFAULT_HTTP_TIMEOUT_MS</code>)로 하드코딩되어
                외부에서 변경할 수 없습니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;세션이 유지되지 않습니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                서버가 <code className="text-cyan-600">Mcp-Session-Id</code> 응답 헤더를 반환하지
                않으면 세션 ID가 저장되지 않습니다. 서버가 세션을 지원하는지 확인하세요. 세션 없이도
                통신은 가능하지만, 서버가 요청 간 상태를 유지할 수 없습니다.
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
                  name: "mcp/transports/base.ts",
                  slug: "mcp-transport-base",
                  relation: "parent",
                  desc: "MCPTransportLayer 인터페이스와 createTransport() 팩토리 함수 정의",
                },
                {
                  name: "mcp/transports/sse.ts",
                  slug: "mcp-transport-sse",
                  relation: "sibling",
                  desc: "SSE 기반 양방향 통신 — 레거시 원격 서버용",
                },
                {
                  name: "mcp/transports/stdio.ts",
                  slug: "mcp-transport-stdio",
                  relation: "sibling",
                  desc: "로컬 프로세스 stdin/stdout 기반 트랜스포트",
                },
                {
                  name: "mcp/client.ts",
                  slug: "mcp-client",
                  relation: "parent",
                  desc: "HttpTransport를 사용하여 원격 MCP 서버와 통신하는 클라이언트",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
