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

export default function MCPTransportSsePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/mcp/transports/sse.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">SseTransport</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              Server-Sent Events(SSE)를 사용한 양방향 JSON-RPC 통신 트랜스포트입니다.
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
                <code className="text-cyan-600">SseTransport</code>는 SSE(Server-Sent Events)
                프로토콜을 사용하여 원격 MCP 서버와 양방향 통신을 구현합니다. SSE는 서버가
                클라이언트에게 실시간으로 데이터를 &quot;푸시(push)&quot;할 수 있는 HTTP 기반 단방향
                스트리밍 프로토콜입니다.
              </p>
              <p>
                양방향 통신을 위해 두 가지 채널을 조합합니다: 클라이언트에서 서버로는 HTTP POST
                요청으로 JSON-RPC 메시지를 전송하고, 서버에서 클라이언트로는 SSE 연결로 실시간
                메시지를 수신합니다. POST URL은 서버가 SSE &quot;endpoint&quot; 이벤트를 통해
                동적으로 제공할 수 있습니다.
              </p>
              <p>
                연결이 끊기면 <strong>지수 백오프(exponential backoff)</strong> 전략으로 자동
                재연결합니다. 기본 딜레이 1초에서 시작하여 2배씩 증가하며(1초, 2초, 4초, 8초, 16초),
                최대 30초를 초과하지 않습니다. 5회 재연결 실패 시 연결을 포기합니다.
              </p>
            </div>

            <MermaidDiagram
              title="SseTransport 양방향 통신 구조"
              titleColor="purple"
              chart={`graph LR
  CLIENT["dbcode<br/><small>클라이언트</small>"]
  SERVER["MCP 서버<br/><small>원격</small>"]

  CLIENT -->|"HTTP POST<br/>JSON-RPC 요청/알림"| SERVER
  SERVER -->|"SSE 스트림<br/>JSON-RPC 응답/알림"| CLIENT
  SERVER -.->|"endpoint 이벤트<br/>POST URL 동적 제공"| CLIENT

  style CLIENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b,stroke-width:2px
  style SERVER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 라디오 방송국을 떠올리세요. 서버(방송국)는 SSE로 계속 메시지를
              &quot;방송&quot;하고, 클라이언트(청취자)는 그 방송을 듣습니다. 요청을 보내야 할 때는
              별도로 전화(HTTP POST)를 걸어 메시지를 전달합니다. 방송이 끊기면 자동으로 다시 채널을
              맞춥니다(재연결).
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

            {/* SseTransportError */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class SseTransportError
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              SSE 트랜스포트 전용 에러 클래스입니다. 에러 코드는
              <code className="text-cyan-600">&quot;SSE_TRANSPORT_ERROR&quot;</code>입니다.
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
                  name: "DEFAULT_POST_TIMEOUT_MS",
                  type: "30_000",
                  required: true,
                  desc: "HTTP POST 요청 타임아웃 (30초)",
                },
                {
                  name: "MAX_RECONNECT_ATTEMPTS",
                  type: "5",
                  required: true,
                  desc: "SSE 스트림 최대 재연결 시도 횟수",
                },
                {
                  name: "RECONNECT_BASE_DELAY_MS",
                  type: "1_000",
                  required: true,
                  desc: "지수 백오프 기본 딜레이 (1초)",
                },
                {
                  name: "MAX_RECONNECT_DELAY_MS",
                  type: "30_000",
                  required: true,
                  desc: "재연결 최대 딜레이 (30초)",
                },
              ]}
            />

            {/* SseTransport class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class SseTransport
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">MCPTransportLayer</code> 인터페이스의 SSE
              구현체입니다. SSE 스트림과 HTTP POST를 조합하여 양방향 통신을 구현합니다.
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

            {/* connect */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">connect()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              SSE 연결을 수립합니다. AbortController를 생성하고 SSE 스트림을 열어 메시지 수신을
              시작합니다.
            </p>
            <CodeBlock>
              <span className="fn">connect</span>(): <span className="type">Promise</span>&lt;
              <span className="type">void</span>&gt;
            </CodeBlock>

            {/* disconnect */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">disconnect()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              SSE 연결을 종료합니다. AbortController로 진행 중인 SSE 스트림을 취소합니다.
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
              JSON-RPC 요청을 HTTP POST로 비동기 전송합니다. 전송 실패 시 에러 핸들러가 호출됩니다.
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
              JSON-RPC 알림을 HTTP POST로 전송합니다. 응답을 기대하지 않습니다.
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
                <code className="text-cyan-600">SseTransportError</code>가 발생합니다.
              </li>
              <li>
                POST URL은 기본적으로 SSE URL과 동일하지만, 서버가 &quot;endpoint&quot; SSE 이벤트를
                보내면 동적으로 변경됩니다. 이 동작을 인식하지 못하면 POST가 잘못된 URL로 전송될 수
                있습니다.
              </li>
              <li>
                POST 응답이 <code className="text-cyan-600">202</code>(Accepted) 또는
                <code className="text-cyan-600">204</code>(No Content)이면 본문을 읽지 않습니다.
                일부 서버는 POST 응답에 JSON-RPC 결과를 바로 반환하므로, 다른 상태 코드의 경우
                <code className="text-cyan-600">application/json</code> 응답을 메시지 핸들러로
                전달합니다.
              </li>
              <li>
                5회 재연결 실패 후 <code className="text-cyan-600">connected</code>가
                <code className="text-cyan-600">false</code>로 변경되고{" "}
                <code className="text-cyan-600">onClose</code>가 호출됩니다. 이후에는 수동으로{" "}
                <code className="text-cyan-600">connect()</code>를 다시 호출해야 합니다.
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
              원격 MCP 서버에 SSE로 연결하는 기본 패턴입니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">transport</span> ={" "}
              <span className="kw">new</span> <span className="fn">SseTransport</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">name</span>:{" "}
              <span className="str">&quot;remote-server&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">transport</span>: <span className="str">&quot;sse&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">url</span>:{" "}
              <span className="str">&quot;https://mcp.example.com/sse&quot;</span>,{"\n"}
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
              <span className="fn">error</span>(<span className="str">&quot;SSE 에러:&quot;</span>,{" "}
              <span className="prop">err</span>));
              {"\n"}
              <span className="prop">transport</span>.<span className="fn">onClose</span>(() =&gt;{" "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">&quot;SSE 연결 종료&quot;</span>));
              {"\n"}
              {"\n"}
              <span className="cm">{"// 연결 수립 (SSE 스트림 오픈)"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="prop">transport</span>.
              <span className="fn">connect</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 요청 전송 (HTTP POST)"}</span>
              {"\n"}
              <span className="prop">transport</span>.<span className="fn">sendRequest</span>(
              <span className="num">1</span>, <span className="str">&quot;tools/list&quot;</span>,{" "}
              {"{}"});
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> SSE 트랜스포트는 재연결 시도 중에도 <code>sendRequest()</code>
              를 호출할 수 있습니다. 이때 POST 요청이 실패하면 에러 핸들러가 호출됩니다. 재연결 완료
              후 자동으로 요청이 재전송되지는 않으므로, 필요하다면 에러 핸들러에서 재시도 로직을
              구현하세요.
            </Callout>

            {/* 고급: SSE 이벤트 형식 이해 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; SSE 이벤트 형식 이해
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              SSE 프로토콜은 특정 텍스트 형식으로 이벤트를 전송합니다. SseTransport가 내부적으로
              파싱하는 이벤트 구조입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// SSE 이벤트 기본 형식"}</span>
              {"\n"}
              <span className="str">event: message</span>
              {"          "}
              <span className="cm">{"// 이벤트 타입 (선택)"}</span>
              {"\n"}
              <span className="str">data: {'{"jsonrpc":"2.0"}'}</span>{" "}
              <span className="cm">{"// 실제 데이터"}</span>
              {"\n"}
              <span className="str">id: 123</span>
              {"                "}
              <span className="cm">{"// 이벤트 ID (재연결 복원용)"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 특수 이벤트: endpoint (POST URL 동적 변경)"}</span>
              {"\n"}
              <span className="str">event: endpoint</span>
              {"\n"}
              <span className="str">data: /api/v1/messages</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 이벤트는 빈 줄(\\n\\n)로 구분됩니다"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>Last-Event-ID</code> 헤더를 사용하여 재연결 시 마지막으로
              수신한 이벤트 위치부터 이어받습니다. 이 동작은 SSE 표준에 정의된 자동 복구
              메커니즘입니다.
            </Callout>

            <DeepDive title="지수 백오프(Exponential Backoff) 상세">
              <p className="mb-3">
                네트워크 연결이 끊겼을 때 즉시 재연결하면, 서버에 부하가 집중될 수 있습니다. 지수
                백오프는 재시도 간격을 점진적으로 늘려 이를 방지합니다.
              </p>
              <CodeBlock>
                <span className="cm">
                  {"// 딜레이 계산: baseDelay * 2^attempt (최대 maxDelay)"}
                </span>
                {"\n"}
                <span className="cm">{"// 시도 0: 1,000ms (1초)"}</span>
                {"\n"}
                <span className="cm">{"// 시도 1: 2,000ms (2초)"}</span>
                {"\n"}
                <span className="cm">{"// 시도 2: 4,000ms (4초)"}</span>
                {"\n"}
                <span className="cm">{"// 시도 3: 8,000ms (8초)"}</span>
                {"\n"}
                <span className="cm">{"// 시도 4: 16,000ms (16초)"}</span>
                {"\n"}
                <span className="cm">{"// 최대: 30,000ms (30초)"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">delay</span> ={" "}
                <span className="fn">Math</span>.<span className="fn">min</span>({"\n"}
                {"  "}
                <span className="num">1000</span> * <span className="fn">Math</span>.
                <span className="fn">pow</span>(<span className="num">2</span>,{" "}
                <span className="prop">attempt</span>),
                {"\n"}
                {"  "}
                <span className="num">30000</span>
                {"\n"});
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                5회 시도 후에도 연결이 복원되지 않으면, 에러 핸들러를 호출하고 연결을 포기합니다.
                이후 수동으로 <code className="text-cyan-600">connect()</code>를 호출해야 합니다.
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
              SSE 연결 및 재연결 상태 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              SSE 연결의 생명주기와 재연결 로직입니다.
            </p>

            <MermaidDiagram
              title="SseTransport 상태 전이"
              titleColor="purple"
              chart={`graph TD
  START(("connect()")) --> OPEN_SSE["SSE 스트림 오픈<br/><small>GET + Accept: text/event-stream</small>"]
  OPEN_SSE --> CONNECTED["연결됨<br/><small>connected = true</small>"]
  CONNECTED -->|"메시지 수신"| PARSE["parseSSEEvent()<br/><small>data/event/id 파싱</small>"]
  PARSE -->|"endpoint 이벤트"| UPDATE_URL["postUrl 업데이트"]
  PARSE -->|"data 이벤트"| HANDLER["messageHandler 호출"]
  CONNECTED -->|"스트림 종료/에러"| RECONNECT{"재연결 시도?"}
  RECONNECT -->|"시도 < 5"| BACKOFF["지수 백오프 대기<br/><small>1s, 2s, 4s, 8s, 16s</small>"]
  BACKOFF --> OPEN_SSE
  RECONNECT -->|"시도 >= 5"| FAIL["연결 포기<br/><small>onClose() 호출</small>"]
  CONNECTED -->|"disconnect()"| ABORT["AbortController.abort()<br/><small>connected = false</small>"]

  style CONNECTED fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style FAIL fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style BACKOFF fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style PARSE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              SSE 이벤트 파싱 핵심 코드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              SSE 스트림에서 수신한 이벤트 블록을 파싱하는 핵심 로직입니다.
            </p>
            <CodeBlock>
              <span className="kw">private</span> <span className="fn">parseSSEEvent</span>(
              <span className="prop">event</span>: <span className="type">string</span>):{" "}
              <span className="type">void</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">let</span> <span className="prop">data</span> ={" "}
              <span className="str">&quot;&quot;</span>;{"\n"}
              {"  "}
              <span className="kw">let</span> <span className="prop">eventType</span> ={" "}
              <span className="str">&quot;&quot;</span>;{"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// 각 줄에서 data, event, id 필드 추출"}</span>
              {"\n"}
              {"  "}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">line</span> <span className="kw">of</span>{" "}
              <span className="prop">event</span>.<span className="fn">split</span>(
              <span className="str">&quot;\n&quot;</span>)) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">line</span>.
              <span className="fn">startsWith</span>(<span className="str">&quot;data: &quot;</span>
              )) <span className="prop">data</span> += <span className="prop">line</span>.
              <span className="fn">slice</span>(<span className="num">6</span>);
              {"\n"}
              {"    "}
              <span className="kw">else if</span> (<span className="prop">line</span>.
              <span className="fn">startsWith</span>(
              <span className="str">&quot;event: &quot;</span>)){" "}
              <span className="prop">eventType</span> = <span className="prop">line</span>.
              <span className="fn">slice</span>(<span className="num">7</span>).
              <span className="fn">trim</span>();
              {"\n"}
              {"    "}
              <span className="kw">else if</span> (<span className="prop">line</span>.
              <span className="fn">startsWith</span>(<span className="str">&quot;id: &quot;</span>)){" "}
              <span className="kw">this</span>.<span className="prop">lastEventId</span> ={" "}
              <span className="prop">line</span>.<span className="fn">slice</span>(
              <span className="num">4</span>).<span className="fn">trim</span>();
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// endpoint 이벤트: POST URL 동적 변경"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">eventType</span> ==={" "}
              <span className="str">&quot;endpoint&quot;</span> &&{" "}
              <span className="prop">data</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">this</span>.<span className="prop">postUrl</span> ={" "}
              <span className="kw">new</span> <span className="fn">URL</span>(
              <span className="prop">data</span>, <span className="kw">this</span>.
              <span className="prop">url</span>).<span className="fn">toString</span>();
              {"\n"}
              {"    "}
              <span className="kw">return</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// 일반 데이터: JSON-RPC 메시지로 파싱"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">message</span> ={" "}
              <span className="fn">JSON</span>.<span className="fn">parse</span>(
              <span className="prop">data</span>);
              {"\n"}
              {"  "}
              <span className="kw">this</span>.<span className="prop">messageHandler</span>?.(
              <span className="prop">message</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">이벤트 구분:</strong> SSE 스트림은 이중 줄바꿈(
                <code>\n\n</code>)으로 이벤트를 구분합니다. ReadableStream에서 바이트를 읽어 버퍼에
                축적하고, 이중 줄바꿈을 발견하면 완전한 이벤트로 파싱합니다.
              </p>
              <p>
                <strong className="text-gray-900">endpoint 이벤트:</strong> 서버가 POST 요청을 받을
                URL을 동적으로 알려주는 특수 이벤트입니다. 상대 URL이면 SSE URL을 기준으로 절대
                URL로 변환합니다.
              </p>
              <p>
                <strong className="text-gray-900">lastEventId:</strong> 재연결 시{" "}
                <code>Last-Event-ID</code> 헤더에 포함되어, 서버가 놓친 이벤트부터 다시 전송할 수
                있게 합니다.
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
                &quot;SSE reconnection failed after max attempts 에러가 발생합니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                5회 재연결을 모두 실패한 경우입니다. 서버가 다운되었거나 네트워크 연결이 장기간
                끊어진 상태입니다. 서버 상태를 확인하고 필요하면{" "}
                <code className="text-cyan-600">connect()</code>를 수동으로 호출하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;POST failed: HTTP 404 에러가 발생합니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                POST URL이 잘못되었을 수 있습니다. 서버가 &quot;endpoint&quot; SSE 이벤트로 별도의
                POST URL을 제공하는지 확인하세요. 기본적으로 SSE URL과 동일한 URL로 POST를
                전송하지만, 서버에 따라 다른 URL을 사용할 수 있습니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;SSE 연결이 계속 끊기고 재연결됩니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                서버의 SSE 스트림 타임아웃이 짧게 설정되어 있을 수 있습니다. 또는
                로드밸런서/프록시가 유휴 연결을 끊고 있을 수 있습니다. 재연결 자체는 정상
                동작이지만, 너무 빈번하면 서버 쪽 타임아웃 설정을 확인하세요.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;POST 타임아웃(30초)이 너무 짧습니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">DEFAULT_POST_TIMEOUT_MS</code>는 모듈 내부에
                하드코딩(30초)되어 있습니다. 현재 외부에서 변경할 수 없으므로, 긴 작업이 필요하면
                서버 쪽에서 비동기 처리 후 SSE로 결과를 보내는 방식을 고려하세요.
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
                  name: "mcp/transports/http.ts",
                  slug: "mcp-transport-http",
                  relation: "sibling",
                  desc: "Streamable HTTP 트랜스포트 — SSE 대신 HTTP POST만으로 통신하는 최신 방식",
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
                  desc: "SseTransport를 사용하여 원격 MCP 서버와 통신하는 클라이언트",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
