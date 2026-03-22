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

export default function MCPTransportBasePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/mcp/transports/base.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">MCPTransportLayer</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              MCP 서버와의 JSON-RPC 통신을 위한 트랜스포트 추상 인터페이스와 팩토리 함수입니다.
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
                <code className="text-cyan-600">MCPTransportLayer</code>는 MCP 클라이언트와 서버
                사이의 실제 데이터 전송 방법을 추상화하는 인터페이스입니다. 세 가지 구현체(stdio,
                HTTP, SSE)가 이 인터페이스를 구현하며, 클라이언트는 구체적인 전송 방식을 알 필요
                없이 동일한 메서드로 통신할 수 있습니다.
              </p>
              <p>
                <code className="text-cyan-600">createTransport()</code> 팩토리 함수는 서버 설정의
                <code className="text-cyan-600">transport</code> 필드를 읽어 적절한 구현체를 자동
                생성합니다. 이 패턴 덕분에 새 트랜스포트를 추가할 때 클라이언트 코드를 수정할 필요가
                없습니다.
              </p>
              <p>
                JSON-RPC 2.0 프로토콜을 기반으로 하며, 요청(request)과 알림(notification) 두 종류의
                메시지를 구분합니다. 요청에는 <code className="text-cyan-600">id</code>가 있어
                응답을 매칭할 수 있고, 알림은 응답을 기대하지 않는 fire-and-forget 방식입니다.
              </p>
            </div>

            <MermaidDiagram
              title="트랜스포트 계층 아키텍처"
              titleColor="purple"
              chart={`graph TD
  CLIENT["MCPClient<br/><small>mcp/client.ts</small>"]
  IFACE["MCPTransportLayer<br/><small>interface</small>"]
  FACTORY["createTransport()<br/><small>팩토리 함수</small>"]
  STDIO["StdioTransport<br/><small>stdio.ts</small>"]
  HTTP["HttpTransport<br/><small>http.ts</small>"]
  SSE["SseTransport<br/><small>sse.ts</small>"]
  CONFIG["MCPServerConfig<br/><small>transport 필드</small>"]

  CLIENT -->|"인터페이스로 통신"| IFACE
  CONFIG -->|"설정 전달"| FACTORY
  FACTORY -->|"stdio"| STDIO
  FACTORY -->|"http"| HTTP
  FACTORY -->|"sse"| SSE
  STDIO -.->|"implements"| IFACE
  HTTP -.->|"implements"| IFACE
  SSE -.->|"implements"| IFACE

  style IFACE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style FACTORY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style CLIENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style STDIO fill:#dcfce7,stroke:#10b981,color:#065f46
  style HTTP fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
  style SSE fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style CONFIG fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> USB 포트를 떠올리세요. USB-A, USB-C, Lightning 등 물리적
              커넥터는 다르지만, &quot;데이터를 주고받는다&quot;는 추상 인터페이스는 동일합니다.
              MCPTransportLayer도 마찬가지로, stdio/HTTP/SSE라는 서로 다른 통신 방식을 하나의
              인터페이스로 통일합니다.
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

            {/* MCPTransportLayer interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface MCPTransportLayer
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              MCP JSON-RPC 통신을 위한 트랜스포트 계층 인터페이스입니다. 이 인터페이스를 구현하는
              클래스는 실제 데이터 전송 방법(stdio, HTTP, SSE)을 제공합니다.
            </p>

            {/* connect */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">connect()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              트랜스포트 연결을 수립합니다. 구현체별로 자식 프로세스 시작, HTTP 핸드셰이크, SSE
              스트림 오픈 등 다른 동작을 수행합니다.
            </p>
            <CodeBlock>
              <span className="fn">connect</span>(): <span className="type">Promise</span>&lt;
              <span className="type">void</span>&gt;
            </CodeBlock>

            {/* disconnect */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">disconnect()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              트랜스포트 연결을 정상적으로 종료합니다. 리소스 정리와 프로세스 종료를 수행합니다.
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
              JSON-RPC 요청을 전송합니다. <code className="text-cyan-600">id</code>가 있어 응답을
              매칭할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="fn">sendRequest</span>({"\n"}
              {"  "}
              <span className="prop">id</span>: <span className="type">string</span> |{" "}
              <span className="type">number</span>,{"\n"}
              {"  "}
              <span className="prop">method</span>: <span className="type">string</span>,{"\n"}
              {"  "}
              <span className="prop">params</span>: <span className="type">Record</span>&lt;
              <span className="type">string</span>, <span className="type">unknown</span>&gt;
              {"\n"}): <span className="type">void</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "id",
                  type: "string | number",
                  required: true,
                  desc: "요청 고유 식별자 (응답 매칭용)",
                },
                {
                  name: "method",
                  type: "string",
                  required: true,
                  desc: "호출할 JSON-RPC 메서드 이름",
                },
                {
                  name: "params",
                  type: "Record<string, unknown>",
                  required: true,
                  desc: "메서드에 전달할 매개변수 객체",
                },
              ]}
            />

            {/* sendNotification */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              sendNotification(method, params)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              JSON-RPC 알림을 전송합니다. <code className="text-cyan-600">id</code>가 없어 응답을
              기대하지 않습니다.
            </p>
            <CodeBlock>
              <span className="fn">sendNotification</span>({"\n"}
              {"  "}
              <span className="prop">method</span>: <span className="type">string</span>,{"\n"}
              {"  "}
              <span className="prop">params</span>: <span className="type">Record</span>&lt;
              <span className="type">string</span>, <span className="type">unknown</span>&gt;
              {"\n"}): <span className="type">void</span>
            </CodeBlock>
            <ParamTable
              params={[
                { name: "method", type: "string", required: true, desc: "알림 메서드 이름" },
                {
                  name: "params",
                  type: "Record<string, unknown>",
                  required: true,
                  desc: "알림 매개변수 객체",
                },
              ]}
            />

            {/* onMessage */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">onMessage(handler)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              수신 메시지 핸들러를 등록합니다. 서버에서 JSON-RPC 메시지가 도착하면 콜백이
              호출됩니다.
            </p>
            <CodeBlock>
              <span className="fn">onMessage</span>(<span className="prop">handler</span>: (
              <span className="prop">message</span>: <span className="type">JsonRpcMessage</span>)
              =&gt; <span className="type">void</span>): <span className="type">void</span>
            </CodeBlock>

            {/* onError */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">onError(handler)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              에러 핸들러를 등록합니다. 통신 에러 발생 시 콜백이 호출됩니다.
            </p>
            <CodeBlock>
              <span className="fn">onError</span>(<span className="prop">handler</span>: (
              <span className="prop">error</span>: <span className="type">Error</span>) =&gt;{" "}
              <span className="type">void</span>): <span className="type">void</span>
            </CodeBlock>

            {/* onClose */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">onClose(handler)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              연결 종료 핸들러를 등록합니다. 트랜스포트 연결이 닫힐 때 콜백이 호출됩니다.
            </p>
            <CodeBlock>
              <span className="fn">onClose</span>(<span className="prop">handler</span>: () =&gt;{" "}
              <span className="type">void</span>): <span className="type">void</span>
            </CodeBlock>

            {/* createTransport factory */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              createTransport(config)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              서버 설정에 따라 적절한 트랜스포트 인스턴스를 생성하는 팩토리 함수입니다.
              <code className="text-cyan-600">config.transport</code> 필드를 읽어 구현체를
              결정합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">createTransport</span>(
              <span className="prop">config</span>: <span className="type">MCPServerConfig</span>):{" "}
              <span className="type">MCPTransportLayer</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "config",
                  type: "MCPServerConfig",
                  required: true,
                  desc: "MCP 서버 설정 (transport 필드로 타입 결정)",
                },
              ]}
            />
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-emerald-600">&quot;stdio&quot;</code> &mdash;
                StdioTransport 인스턴스 생성
              </p>
              <p>
                &bull; <code className="text-blue-600">&quot;http&quot;</code> &mdash; HttpTransport
                인스턴스 생성
              </p>
              <p>
                &bull; <code className="text-amber-600">&quot;sse&quot;</code> &mdash; SseTransport
                인스턴스 생성
              </p>
              <p>
                &bull; 그 외 &mdash; <code className="text-red-600">Error</code> 발생
              </p>
            </div>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">sendRequest()</code>와{" "}
                <code className="text-cyan-600">sendNotification()</code>은 동기(sync)
                시그니처입니다. 실제 전송은 내부에서 비동기로 처리되며, 에러는{" "}
                <code className="text-cyan-600">onError</code> 핸들러로 전달됩니다.
              </li>
              <li>
                핸들러(<code className="text-cyan-600">onMessage</code>,{" "}
                <code className="text-cyan-600">onError</code>,
                <code className="text-cyan-600">onClose</code>)는{" "}
                <code className="text-cyan-600">connect()</code> 전에 등록해야 초기 메시지를 놓치지
                않습니다.
              </li>
              <li>
                <code className="text-cyan-600">createTransport()</code>는 인스턴스를 생성만 하고,
                연결은 수립하지 않습니다. 반드시 <code className="text-cyan-600">connect()</code>를
                별도로 호출해야 합니다.
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
              기본 사용법 &mdash; 팩토리로 트랜스포트 생성
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              가장 일반적인 패턴입니다. 서버 설정을{" "}
              <code className="text-cyan-600">createTransport()</code>에 전달하면 적절한 구현체가
              자동 생성됩니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="prop">createTransport</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./transports/base.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 1. 설정에 따라 트랜스포트 자동 생성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">transport</span> ={" "}
              <span className="fn">createTransport</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">name</span>: <span className="str">&quot;my-server&quot;</span>
              ,{"\n"}
              {"  "}
              <span className="prop">transport</span>:{" "}
              <span className="str">&quot;stdio&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">command</span>: <span className="str">&quot;npx&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">args</span>: [
              <span className="str">&quot;my-mcp-server&quot;</span>],
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 핸들러 등록 (connect 전에!)"}</span>
              {"\n"}
              <span className="prop">transport</span>.<span className="fn">onMessage</span>((
              <span className="prop">msg</span>) =&gt; <span className="fn">handleMessage</span>(
              <span className="prop">msg</span>));
              {"\n"}
              <span className="prop">transport</span>.<span className="fn">onError</span>((
              <span className="prop">err</span>) =&gt; <span className="fn">handleError</span>(
              <span className="prop">err</span>));
              {"\n"}
              <span className="prop">transport</span>.<span className="fn">onClose</span>(() =&gt;{" "}
              <span className="fn">handleClose</span>());
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. 연결 수립"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="prop">transport</span>.
              <span className="fn">connect</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 4. 요청 전송"}</span>
              {"\n"}
              <span className="prop">transport</span>.<span className="fn">sendRequest</span>(
              <span className="num">1</span>, <span className="str">&quot;tools/list&quot;</span>,{" "}
              {"{}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 5. 종료"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="prop">transport</span>.
              <span className="fn">disconnect</span>();
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>onMessage</code>, <code>onError</code>,{" "}
              <code>onClose</code> 핸들러는 반드시 <code>connect()</code> <strong>이전에</strong>{" "}
              등록하세요. 연결 수립 과정에서 바로 메시지가 도착할 수 있기 때문입니다.
            </Callout>

            {/* 고급: 트랜스포트 타입별 설정 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 트랜스포트 타입별 설정 차이
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              각 트랜스포트는 설정에서 필요한 필드가 다릅니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// stdio: command + args 필요"}</span>
              {"\n"}
              <span className="fn">createTransport</span>({"{"}{" "}
              <span className="prop">transport</span>:{" "}
              <span className="str">&quot;stdio&quot;</span>, <span className="prop">command</span>:{" "}
              <span className="str">&quot;node&quot;</span>, <span className="prop">args</span>: [
              <span className="str">&quot;server.js&quot;</span>] {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// http: url 필요"}</span>
              {"\n"}
              <span className="fn">createTransport</span>({"{"}{" "}
              <span className="prop">transport</span>: <span className="str">&quot;http&quot;</span>
              , <span className="prop">url</span>:{" "}
              <span className="str">&quot;https://api.example.com/mcp&quot;</span> {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// sse: url 필요"}</span>
              {"\n"}
              <span className="fn">createTransport</span>({"{"}{" "}
              <span className="prop">transport</span>: <span className="str">&quot;sse&quot;</span>,{" "}
              <span className="prop">url</span>:{" "}
              <span className="str">&quot;https://api.example.com/sse&quot;</span> {"}"});
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 인터페이스 기반 설계 덕분에, 클라이언트 코드는 어떤 트랜스포트를
              사용하든 동일합니다. 설정만 바꾸면 통신 방식이 자동으로 전환됩니다.
            </Callout>

            <DeepDive title="팩토리 패턴의 장점">
              <p className="mb-3">
                팩토리 패턴(Factory Pattern)은 객체 생성을 전문 함수에 위임하는 디자인 패턴입니다.
                이 모듈에서 팩토리 패턴을 사용하는 이유:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>개방-폐쇄 원칙:</strong> 새 트랜스포트 추가 시 switch문에 케이스만
                  추가하면 됩니다
                </li>
                <li>
                  <strong>일관된 생성:</strong> 설정에서 트랜스포트 타입을 문자열로 지정하여
                  런타임에 결정
                </li>
                <li>
                  <strong>단일 진입점:</strong> 클라이언트는 createTransport()만 알면 되고, 개별
                  클래스를 import할 필요 없음
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
              트랜스포트 선택 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">createTransport()</code>는 설정의
              <code className="text-cyan-600">transport</code> 필드를 switch문으로 분기하여 적절한
              구현체를 반환합니다.
            </p>

            <MermaidDiagram
              title="createTransport() 팩토리 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("MCPServerConfig")) --> SW{"config.transport"}
  SW -->|"stdio"| STDIO["new StdioTransport(config)"]
  SW -->|"http"| HTTP["new HttpTransport(config)"]
  SW -->|"sse"| SSE["new SseTransport(config)"]
  SW -->|"unknown"| ERR["throw Error"]

  STDIO --> RET(("MCPTransportLayer"))
  HTTP --> RET
  SSE --> RET

  style SW fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style RET fill:#dcfce7,stroke:#10b981,color:#065f46
  style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style STDIO fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style HTTP fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style SSE fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              팩토리 함수의 전체 구현입니다. switch문 기반의 간결한 분기 로직입니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span>{" "}
              <span className="fn">createTransport</span>(<span className="prop">config</span>:{" "}
              <span className="type">MCPServerConfig</span>):{" "}
              <span className="type">MCPTransportLayer</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">switch</span> (<span className="prop">config</span>.
              <span className="prop">transport</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">case</span> <span className="str">&quot;stdio&quot;</span>:{"\n"}
              {"      "}
              <span className="kw">return new</span> <span className="fn">StdioTransport</span>(
              <span className="prop">config</span>);
              {"\n"}
              {"    "}
              <span className="kw">case</span> <span className="str">&quot;http&quot;</span>:{"\n"}
              {"      "}
              <span className="kw">return new</span> <span className="fn">HttpTransport</span>(
              <span className="prop">config</span>);
              {"\n"}
              {"    "}
              <span className="kw">case</span> <span className="str">&quot;sse&quot;</span>:{"\n"}
              {"      "}
              <span className="kw">return new</span> <span className="fn">SseTransport</span>(
              <span className="prop">config</span>);
              {"\n"}
              {"    "}
              <span className="kw">default</span>:{"\n"}
              {"      "}
              <span className="kw">throw new</span> <span className="fn">Error</span>(
              <span className="str">`Unknown transport type: ${"{"}</span>
              <span className="prop">config</span>.<span className="prop">transport</span>
              <span className="str">{"}"}`</span>);
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">인터페이스 6개 메서드:</strong> connect,
                disconnect, sendRequest, sendNotification, onMessage, onError, onClose의 계약을
                정의합니다.
              </p>
              <p>
                <strong className="text-gray-900">팩토리 함수:</strong> 설정을 받아 적절한 구현체를
                반환하며, 알 수 없는 타입에는 명확한 에러 메시지를 던집니다.
              </p>
              <p>
                <strong className="text-gray-900">의존 방향:</strong> base.ts는 세 구현체를
                import하지만, 구현체들은 base.ts의 인터페이스만 import합니다 (단방향 의존).
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
                &quot;Unknown transport type 에러가 발생합니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                서버 설정의 <code className="text-cyan-600">transport</code> 필드가
                <code className="text-cyan-600">&quot;stdio&quot;</code>,
                <code className="text-cyan-600">&quot;http&quot;</code>,
                <code className="text-cyan-600">&quot;sse&quot;</code> 중 하나인지 확인하세요.
                오타나 대소문자 차이가 원인일 수 있습니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;connect() 후에 메시지가 수신되지 않습니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">onMessage()</code> 핸들러를
                <code className="text-cyan-600">connect()</code> <strong>이전에</strong> 등록했는지
                확인하세요. 연결 수립 직후 서버가 메시지를 보낼 수 있으며, 핸들러가 없으면 메시지가
                유실됩니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;어떤 트랜스포트를 선택해야 하나요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                로컬 MCP 서버(npx로 실행)에는 <code className="text-cyan-600">stdio</code>가 가장
                적합합니다. 원격 서버에는 <code className="text-cyan-600">http</code>(Streamable
                HTTP, MCP 최신 스펙)를, 레거시 원격 서버에는{" "}
                <code className="text-cyan-600">sse</code>를 사용하세요.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;sendRequest()에서 에러가 발생하는데 catch할 수 없습니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">sendRequest()</code>는 동기 함수이므로 try-catch로
                잡을 수 없습니다. 전송 에러는 <code className="text-cyan-600">onError()</code>{" "}
                핸들러로 전달됩니다. 반드시 에러 핸들러를 등록하세요.
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
                  name: "mcp/transports/stdio.ts",
                  slug: "mcp-transport-stdio",
                  relation: "child",
                  desc: "자식 프로세스의 stdin/stdout을 통한 JSON-RPC 통신 구현체",
                },
                {
                  name: "mcp/transports/sse.ts",
                  slug: "mcp-transport-sse",
                  relation: "child",
                  desc: "Server-Sent Events 기반 양방향 통신 구현체",
                },
                {
                  name: "mcp/transports/http.ts",
                  slug: "mcp-transport-http",
                  relation: "child",
                  desc: "Streamable HTTP POST 기반 통신 구현체",
                },
                {
                  name: "mcp/client.ts",
                  slug: "mcp-client",
                  relation: "parent",
                  desc: "MCPTransportLayer를 사용하여 MCP 서버와 통신하는 클라이언트",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
