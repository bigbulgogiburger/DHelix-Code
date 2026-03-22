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

export default function MCPClientPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/mcp/client.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              MCPClient
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            외부 MCP 서버와 JSON-RPC 2.0으로 통신하는 핵심 클라이언트 모듈입니다.
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
              <code className="text-cyan-600">MCPClient</code>는 MCP(Model Context Protocol) 서버에 연결하여
              도구(Tool)를 검색하고 실행하며, 리소스(Resource)를 읽을 수 있게 해주는 클라이언트입니다.
              JSON-RPC 2.0 프로토콜을 기반으로 요청/응답을 주고받습니다.
            </p>
            <p>
              트랜스포트 계층(stdio, http, sse)을 플러그인 방식으로 교체할 수 있어,
              로컬 프로세스 기반 서버와 원격 HTTP 서버 모두 동일한 인터페이스로 사용 가능합니다.
              연결 시 <code className="text-cyan-600">initialize</code> 핸드셰이크로 양측의 기능(Capabilities)을 교환합니다.
            </p>
            <p>
              모든 요청에는 30초 타임아웃이 적용되며, 각 요청은 UUID로 식별되어
              비동기 응답과 정확하게 매칭됩니다. 트랜스포트 에러나 연결 끊김 시
              대기 중인 모든 요청이 자동으로 reject됩니다.
            </p>
          </div>

          <MermaidDiagram
            title="MCPClient 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  SM["Scope Manager<br/><small>scope-manager.ts</small>"]
  CLIENT["MCPClient<br/><small>client.ts</small>"]
  BRIDGE["Tool Bridge<br/><small>tool-bridge.ts</small>"]
  TRANSPORT["Transport Layer<br/><small>stdio / http / sse</small>"]
  SERVER["외부 MCP 서버<br/><small>External Process</small>"]

  SM -->|"설정 제공"| CLIENT
  CLIENT -->|"도구 목록 조회"| BRIDGE
  BRIDGE -->|"도구 호출 프록시"| CLIENT
  CLIENT -->|"JSON-RPC 2.0"| TRANSPORT
  TRANSPORT -->|"물리적 연결"| SERVER

  style CLIENT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style SM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style BRIDGE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TRANSPORT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SERVER fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> MCPClient는 전화기와 같습니다. 전화기(트랜스포트)를 들고, 상대방(MCP 서버)에게
            전화를 걸고(connect), 대화(JSON-RPC)를 나눈 뒤, 전화를 끊습니다(disconnect).
            대화 중에는 요청번호(UUID)로 &quot;어떤 질문에 대한 답변인지&quot; 정확히 매칭합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* MCPClientError class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class MCPClientError
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            MCP 클라이언트에서 발생하는 모든 에러를 나타내는 클래스입니다.
            에러 코드 <code className="text-cyan-600">&quot;MCP_CLIENT_ERROR&quot;</code>로 식별됩니다.
          </p>
          <CodeBlock>
            <span className="kw">class</span> <span className="type">MCPClientError</span> <span className="kw">extends</span> <span className="type">BaseError</span> {"{"}
            {"\n"}{"  "}<span className="kw">constructor</span>(<span className="prop">message</span>: <span className="type">string</span>, <span className="prop">context</span>?: <span className="type">Record{"<"}string, unknown{">"}</span>)
            {"\n"}{"}"}
          </CodeBlock>

          {/* PendingRequest interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface PendingRequest
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            비동기 요청/응답 매칭을 위한 내부 추적기입니다.
            각 요청의 Promise 콜백과 타임아웃 타이머를 관리합니다.
          </p>
          <ParamTable
            params={[
              { name: "resolve", type: "(result: unknown) => void", required: true, desc: "성공 시 호출할 resolve 콜백" },
              { name: "reject", type: "(error: Error) => void", required: true, desc: "실패 시 호출할 reject 콜백" },
              { name: "timer", type: "ReturnType<typeof setTimeout>", required: true, desc: "타임아웃 타이머 (30초 내 응답 없으면 자동 reject)" },
            ]}
          />

          {/* MCPClient class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class MCPClient
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MCP 서버와 JSON-RPC 2.0으로 통신하는 메인 클래스입니다.
            연결 수명주기 관리, 도구 검색/실행, 리소스 조회를 제공합니다.
          </p>

          {/* Constructor */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            constructor
          </h4>
          <CodeBlock>
            <span className="kw">constructor</span>(<span className="prop">config</span>: <span className="type">MCPServerConfig</span>)
          </CodeBlock>
          <ParamTable
            params={[
              { name: "config", type: "MCPServerConfig", required: true, desc: "MCP 서버 연결 설정 (이름, 트랜스포트 타입, 명령어/URL 등)" },
            ]}
          />

          {/* connect */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            connect()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            MCP 서버에 연결합니다. 트랜스포트 생성, 이벤트 핸들러 등록, 핸드셰이크를 수행합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">connect</span>(): <span className="type">Promise{"<"}void{">"}</span>
          </CodeBlock>

          {/* disconnect */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            disconnect()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            서버와의 연결을 끊습니다. 대기 중인 모든 요청을 reject하고 트랜스포트를 정리합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">disconnect</span>(): <span className="type">Promise{"<"}void{">"}</span>
          </CodeBlock>

          {/* getState */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getState()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            현재 연결 상태를 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">getState</span>(): <span className="type">MCPConnectionState</span>
            {"\n"}<span className="cm">// "disconnected" | "connecting" | "connected" | "error"</span>
          </CodeBlock>

          {/* listTools */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            listTools()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            서버에서 사용 가능한 도구 목록을 조회합니다.
            MCP의 <code className="text-cyan-600">&quot;tools/list&quot;</code> 메서드를 호출합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">listTools</span>(): <span className="type">Promise{"<"}readonly MCPToolDefinition[]{">"}</span>
          </CodeBlock>

          {/* callTool */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            callTool(name, args)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            서버의 도구를 실행합니다. <code className="text-cyan-600">&quot;tools/call&quot;</code> 메서드를 사용합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">callTool</span>(<span className="prop">name</span>: <span className="type">string</span>, <span className="prop">args</span>: <span className="type">Record{"<"}string, unknown{">"}</span>): <span className="type">Promise{"<"}MCPToolCallResult{">"}</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "name", type: "string", required: true, desc: "실행할 도구 이름" },
              { name: "args", type: "Record<string, unknown>", required: true, desc: "도구에 전달할 인자(매개변수)" },
            ]}
          />

          {/* listResources / readResource */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            listResources() / readResource(uri)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            리소스 목록을 조회하거나, URI로 특정 리소스를 읽어 텍스트로 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">listResources</span>(): <span className="type">Promise{"<"}readonly MCPResource[]{">"}</span>
            {"\n"}<span className="kw">async</span> <span className="fn">readResource</span>(<span className="prop">uri</span>: <span className="type">string</span>): <span className="type">Promise{"<"}string{">"}</span>
          </CodeBlock>

          {/* setToolsChangedCallback */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            setToolsChangedCallback(callback)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            서버가 <code className="text-cyan-600">&quot;notifications/tools/list_changed&quot;</code> 알림을 보내면
            호출될 콜백을 등록합니다.
          </p>
          <CodeBlock>
            <span className="fn">setToolsChangedCallback</span>(<span className="prop">callback</span>: () =&gt; <span className="type">void</span>): <span className="type">void</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              연결되지 않은 상태에서 <code className="text-cyan-600">listTools()</code>,
              <code className="text-cyan-600">callTool()</code> 등을 호출하면
              <code className="text-cyan-600">MCPClientError</code>가 발생합니다.
            </li>
            <li>
              모든 요청에는 <strong>30초 타임아웃</strong>이 적용됩니다
              (<code className="text-cyan-600">DEFAULT_REQUEST_TIMEOUT_MS = 30_000</code>).
              타임아웃 내에 응답이 없으면 자동으로 reject됩니다.
            </li>
            <li>
              이미 <code className="text-cyan-600">&quot;connected&quot;</code> 상태에서
              <code className="text-cyan-600">connect()</code>를 호출하면 아무 작업도 하지 않습니다 (idempotent).
            </li>
            <li>
              트랜스포트 에러/종료 시 대기 중인 <strong>모든</strong> 요청이 일괄 reject됩니다
              (<code className="text-cyan-600">rejectAllPending</code>).
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 서버 연결과 도구 실행</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 일반적인 사용 패턴입니다.
            클라이언트를 생성하고, 서버에 연결한 뒤, 도구를 조회하고 실행합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. MCP 클라이언트 생성 (stdio 트랜스포트)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">client</span> = <span className="kw">new</span> <span className="fn">MCPClient</span>({"{"}{"\n"}{"  "}<span className="prop">name</span>: <span className="str">&quot;my-server&quot;</span>,
            {"\n"}{"  "}<span className="prop">transport</span>: <span className="str">&quot;stdio&quot;</span>,
            {"\n"}{"  "}<span className="prop">command</span>: <span className="str">&quot;node&quot;</span>,
            {"\n"}{"  "}<span className="prop">args</span>: [<span className="str">&quot;server.js&quot;</span>],
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 서버에 연결 (핸드셰이크 포함)"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">client</span>.<span className="fn">connect</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 사용 가능한 도구 목록 조회"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">tools</span> = <span className="kw">await</span> <span className="prop">client</span>.<span className="fn">listTools</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 4. 도구 실행"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="prop">client</span>.<span className="fn">callTool</span>(<span className="str">&quot;search&quot;</span>, {"{"} <span className="prop">query</span>: <span className="str">&quot;hello&quot;</span> {"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 5. 연결 종료"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">client</span>.<span className="fn">disconnect</span>();
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>connect()</code>를 호출하지 않고 <code>listTools()</code>나
            <code>callTool()</code>을 호출하면 <code>MCPClientError</code>가 발생합니다.
            반드시 연결을 먼저 수립하세요.
          </Callout>

          {/* 고급 사용법: 도구 변경 알림 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 도구 목록 변경 감지
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MCP 서버가 도구 목록을 동적으로 변경할 수 있습니다.
            콜백을 등록하면 변경 시 자동으로 알림을 받을 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 도구 변경 시 알림 수신"}</span>
            {"\n"}<span className="prop">client</span>.<span className="fn">setToolsChangedCallback</span>(() =&gt; {"{"}
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">&quot;도구 목록이 변경되었습니다!&quot;</span>);
            {"\n"}{"  "}<span className="cm">{"// 도구 목록 다시 조회"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">updated</span> = <span className="kw">await</span> <span className="prop">client</span>.<span className="fn">listTools</span>();
            {"\n"}{"}"});
          </CodeBlock>

          {/* 고급 사용법: 리소스 읽기 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 리소스 조회 및 읽기
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MCP 서버가 리소스(파일, 데이터 등)를 제공하는 경우,
            URI로 리소스를 조회하고 읽을 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 리소스 목록 조회"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">resources</span> = <span className="kw">await</span> <span className="prop">client</span>.<span className="fn">listResources</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 특정 리소스 읽기"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">content</span> = <span className="kw">await</span> <span className="prop">client</span>.<span className="fn">readResource</span>(<span className="str">&quot;file:///path/to/file&quot;</span>);
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>getCapabilities()</code>로 서버가 리소스를 지원하는지 미리 확인할 수 있습니다.
            <code>connect()</code> 이후에만 유효한 값을 반환합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>연결 수명주기 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MCPClient의 연결은 4단계 상태를 거칩니다.
            <code className="text-cyan-600">&quot;disconnected&quot;</code>에서 시작하여,
            <code className="text-cyan-600">connect()</code> 호출 시 핸드셰이크를 수행하고
            <code className="text-emerald-600">&quot;connected&quot;</code>로 전이합니다.
          </p>

          <MermaidDiagram
            title="MCPClient 연결 수명주기"
            titleColor="purple"
            chart={`graph TD
  START(("시작")) --> DISC["disconnected<br/><small>초기 상태</small>"]
  DISC -->|"connect() 호출"| CING["connecting<br/><small>트랜스포트 생성 + 핸드셰이크</small>"]
  CING -->|"initialize 성공"| CONN["connected<br/><small>도구/리소스 사용 가능</small>"]
  CING -->|"연결 실패"| ERR["error<br/><small>에러 상태</small>"]
  CONN -->|"disconnect() 호출"| DISC
  CONN -->|"트랜스포트 에러"| ERR
  CONN -->|"트랜스포트 종료"| DISC

  style DISC fill:#f1f5f9,stroke:#64748b,color:#1e293b,stroke-width:2px
  style CING fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style CONN fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; connect() 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">connect()</code> 메서드의 5단계 연결 과정입니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">connect</span>(): <span className="type">Promise{"<"}void{">"}</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] 이미 연결된 상태면 아무 작업도 하지 않음"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="kw">this</span>.<span className="prop">state</span> === <span className="str">&quot;connected&quot;</span>) <span className="kw">return</span>;
            {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">state</span> = <span className="str">&quot;connecting&quot;</span>;
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 설정에 맞는 트랜스포트 생성 (stdio/http/sse)"}</span>
            {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">transport</span> = <span className="fn">createTransport</span>(<span className="kw">this</span>.<span className="prop">config</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 이벤트 핸들러 등록 (메시지, 에러, 종료)"}</span>
            {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">transport</span>.<span className="fn">onMessage</span>((<span className="prop">msg</span>) =&gt; <span className="kw">this</span>.<span className="fn">handleMessage</span>(<span className="prop">msg</span>));
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [4] initialize 핸드셰이크 — 프로토콜 버전 + 기능 교환"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="kw">this</span>.<span className="fn">sendRequest</span>(<span className="str">&quot;initialize&quot;</span>, {"{"}
            {"\n"}{"    "}<span className="prop">protocolVersion</span>: <span className="str">&quot;2024-11-05&quot;</span>,
            {"\n"}{"    "}<span className="prop">clientInfo</span>: {"{"} <span className="prop">name</span>: <span className="str">&quot;dbcode&quot;</span>, <span className="prop">version</span>: <span className="str">&quot;0.1.0&quot;</span> {"}"},
            {"\n"}{"  "}{"}"});
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [5] initialized 알림 전송 — 초기화 완료 통지"}</span>
            {"\n"}{"  "}<span className="kw">this</span>.<span className="fn">sendNotification</span>(<span className="str">&quot;notifications/initialized&quot;</span>, {"{}"});
            {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">state</span> = <span className="str">&quot;connected&quot;</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> idempotent 패턴 &mdash; 이미 연결된 상태에서 재호출해도 안전합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 팩토리 함수 <code className="text-cyan-600">createTransport()</code>가 설정의 transport 타입에 따라 적절한 인스턴스를 생성합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 연결 전에 이벤트 핸들러를 등록해야 메시지를 놓치지 않습니다.</p>
            <p><strong className="text-gray-900">[4]</strong> 핸드셰이크에서 서버의 Capabilities(도구/리소스 지원 여부)를 받아 저장합니다.</p>
            <p><strong className="text-gray-900">[5]</strong> 클라이언트가 초기화를 완료했음을 서버에 알리는 단방향 알림입니다.</p>
          </div>

          <DeepDive title="JSON-RPC 메시지 처리 로직 상세">
            <p className="mb-3">
              <code className="text-cyan-600">handleMessage()</code>는 수신된 메시지를 3단계로 분류합니다:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li><strong>id 없음</strong> &rarr; 알림(Notification)으로 처리 &mdash; <code className="text-cyan-600">handleNotification()</code>에 위임</li>
              <li><strong>id 있음 + error 필드</strong> &rarr; 에러 응답 &mdash; 대기 중인 요청을 <code className="text-red-600">reject</code></li>
              <li><strong>id 있음 + result 필드</strong> &rarr; 성공 응답 &mdash; 대기 중인 요청을 <code className="text-emerald-600">resolve</code></li>
            </ol>
            <p className="mt-3 text-amber-600">
              매칭되지 않는 id의 응답은 조용히 무시됩니다.
              타임아웃 후 뒤늦게 도착한 응답이 이에 해당합니다.
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
              &quot;Not connected to MCP server 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">connect()</code>를 호출하지 않았거나, 연결이 끊어진 상태에서
              도구/리소스 API를 호출한 경우입니다.
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li><code className="text-cyan-600">getState()</code>로 현재 상태를 확인하세요.</li>
              <li>상태가 <code className="text-red-600">&quot;error&quot;</code>라면 트랜스포트 문제가 발생한 것입니다.</li>
              <li><code className="text-cyan-600">disconnect()</code> 후 <code className="text-cyan-600">connect()</code>를 다시 호출하세요.</li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Request timed out 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              서버가 30초 내에 응답하지 않은 경우입니다.
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>MCP 서버 프로세스가 정상적으로 실행 중인지 확인하세요.</li>
              <li>서버 측에서 오래 걸리는 작업이 타임아웃을 초과한 것일 수 있습니다.</li>
              <li>트랜스포트가 stdio인 경우, 서버의 stdout이 막혀 있지 않은지 확인하세요.</li>
            </ul>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Transport closed 에러가 갑자기 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              MCP 서버 프로세스가 예기치 않게 종료된 경우입니다.
              서버의 로그를 확인하고, 메모리 부족이나 충돌 여부를 점검하세요.
              <code className="text-cyan-600">rejectAllPending()</code>이 호출되어
              대기 중인 모든 요청이 자동으로 실패 처리됩니다.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;connect() 호출 시 Failed to connect 에러가 나요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              트랜스포트 생성 또는 핸드셰이크 단계에서 실패한 것입니다.
              MCP 서버 설정(command, args, url)이 올바른지 확인하세요.
              에러의 <code className="text-cyan-600">context.cause</code>에 상세 원인이 기록됩니다.
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
                name: "scope-manager.ts",
                slug: "mcp-scope-manager",
                relation: "sibling",
                desc: "3-Scope 설정 관리 — MCPClient에 전달할 서버 설정을 로드하고 병합",
              },
              {
                name: "tool-bridge.ts",
                slug: "mcp-tool-bridge",
                relation: "sibling",
                desc: "MCP 도구를 dbcode 도구 레지스트리에 브리지하여 에이전트가 사용 가능하게 변환",
              },
              {
                name: "mcp-manager.ts",
                slug: "mcp-manager",
                relation: "parent",
                desc: "MCPClient 인스턴스를 생성하고 수명주기를 관리하는 상위 매니저",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
