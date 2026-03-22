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

export default function MCPServePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/mcp/serve.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              MCPServer
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            dbcode 자체를 MCP 서버로 실행하여 외부 클라이언트가 dbcode의 도구를 사용할 수 있게 하는 모듈입니다.
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
              <code className="text-cyan-600">MCPServer</code>는 dbcode의 내부 도구를 MCP 프로토콜로 외부에 노출합니다.
              다른 MCP 클라이언트(Claude Code, AI 에이전트 등)가 dbcode에 연결하여
              Read, Grep, Glob 같은 도구를 직접 사용할 수 있게 합니다.
            </p>
            <p>
              stdin/stdout을 통한 JSON-RPC 2.0 프로토콜로 통신하며,
              <code className="text-cyan-600">initialize</code>, <code className="text-cyan-600">tools/list</code>,
              <code className="text-cyan-600">tools/call</code>, <code className="text-cyan-600">ping</code>
              메서드를 지원합니다. 보안을 위해 기본적으로 &quot;safe&quot; 권한 레벨의 도구만 노출합니다.
            </p>
            <p>
              dbcode를 MCP 서버로 실행하면, dbcode의 강력한 도구 세트를 다른 AI 에이전트에서도
              활용할 수 있습니다. 예를 들어, Claude Code에서 dbcode의 코드 검색 도구를
              MCP를 통해 사용할 수 있습니다.
            </p>
          </div>

          <MermaidDiagram
            title="MCPServer 통신 구조"
            titleColor="purple"
            chart={`graph LR
  CLIENT["외부 MCP 클라이언트<br/><small>Claude Code 등</small>"]
  STDIN["stdin<br/><small>JSON-RPC 요청</small>"]
  SERVER["MCPServer<br/><small>mcp/serve.ts</small>"]
  REG["ToolRegistry<br/><small>tools/registry.ts</small>"]
  STDOUT["stdout<br/><small>JSON-RPC 응답</small>"]

  CLIENT -->|"JSON-RPC"| STDIN
  STDIN --> SERVER
  SERVER -->|"도구 조회/실행"| REG
  SERVER --> STDOUT
  STDOUT -->|"JSON-RPC"| CLIENT

  style SERVER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CLIENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style REG fill:#dcfce7,stroke:#10b981,color:#1e293b
  style STDIN fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style STDOUT fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 레스토랑 주방을 떠올리세요. dbcode는 주방(도구 보유),
            MCPServer는 서빙 카운터(외부에 도구를 노출),
            외부 MCP 클라이언트는 주문을 넣는 손님입니다.
            손님은 메뉴(tools/list)를 보고 주문(tools/call)하면 요리(도구 실행 결과)를 받습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* JSON_RPC_ERRORS */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            const JSON_RPC_ERRORS
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            JSON-RPC 2.0 표준 에러 코드입니다.
          </p>
          <ParamTable
            params={[
              { name: "PARSE_ERROR", type: "-32700", required: true, desc: "잘못된 JSON 형식" },
              { name: "INVALID_REQUEST", type: "-32600", required: true, desc: "유효하지 않은 JSON-RPC 요청" },
              { name: "METHOD_NOT_FOUND", type: "-32601", required: true, desc: "존재하지 않는 메서드" },
              { name: "INVALID_PARAMS", type: "-32602", required: true, desc: "잘못된 매개변수" },
              { name: "INTERNAL_ERROR", type: "-32603", required: true, desc: "서버 내부 에러" },
            ]}
          />

          {/* MCPServeConfig */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface MCPServeConfig
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            MCP 서버 생성 시 필요한 설정입니다.
          </p>
          <ParamTable
            params={[
              { name: "name", type: "string", required: false, desc: '서버 이름 (기본: "dbcode")' },
              { name: "version", type: "string", required: false, desc: "서버 버전 (기본: 상수에서 가져옴)" },
              { name: "toolRegistry", type: "ToolRegistry", required: true, desc: "노출할 도구가 등록된 레지스트리" },
              { name: "exposedTools", type: "readonly string[]", required: false, desc: "노출할 도구 화이트리스트 (기본: 모든 safe 도구)" },
              { name: "workingDirectory", type: "string", required: false, desc: "도구 실행 시 작업 디렉토리 (기본: process.cwd())" },
              { name: "stdin", type: "NodeJS.ReadableStream", required: false, desc: "stdin 오버라이드 (테스트용)" },
              { name: "stdout", type: "NodeJS.WritableStream", required: false, desc: "stdout 오버라이드 (테스트용)" },
            ]}
          />

          {/* MCPServer class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class MCPServer
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            dbcode의 내부 도구를 MCP 도구로 노출하는 서버 클래스입니다.
          </p>

          {/* Constructor */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            constructor
          </h4>
          <CodeBlock>
            <span className="kw">constructor</span>(<span className="prop">config</span>: <span className="type">MCPServeConfig</span>)
          </CodeBlock>

          {/* start / stop */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            start() / stop()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            stdin에서 JSON-RPC 메시지 수신을 시작/중지합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">start</span>(): <span className="type">Promise</span>&lt;<span className="type">void</span>&gt;
            {"\n"}<span className="kw">async</span> <span className="fn">stop</span>(): <span className="type">Promise</span>&lt;<span className="type">void</span>&gt;
          </CodeBlock>

          {/* handleMessage */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            handleMessage(message)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            단일 JSON-RPC 메시지를 처리합니다. stdin/stdout 없이 직접 테스트할 수 있도록 공개됩니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">handleMessage</span>(<span className="prop">message</span>: <span className="type">string</span>): <span className="type">Promise</span>&lt;<span className="type">string</span> | <span className="type">null</span>&gt;
            {"\n"}<span className="cm">// null 반환 → 알림(Notification)이므로 응답 불필요</span>
          </CodeBlock>

          {/* isRunning / isInitialized */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            isRunning() / isInitialized()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            서버 상태를 확인합니다.
          </p>
          <CodeBlock>
            <span className="fn">isRunning</span>(): <span className="type">boolean</span>
            {"\n"}<span className="fn">isInitialized</span>(): <span className="type">boolean</span>
            {"\n"}<span className="cm">// isInitialized: 클라이언트의 &quot;initialize&quot; 핸드셰이크 완료 여부</span>
          </CodeBlock>

          {/* getExposedToolNames */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getExposedToolNames()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            노출된 도구 이름 집합을 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">getExposedToolNames</span>(): <span className="type">ReadonlySet</span>&lt;<span className="type">string</span>&gt;
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">initialize</code> 메서드를 먼저 호출하지 않으면
              다른 모든 메서드가 <code className="text-red-600">INVALID_REQUEST</code> 에러를 반환합니다.
            </li>
            <li>
              <code className="text-cyan-600">exposedTools</code>를 지정하지 않으면
              <code className="text-cyan-600">permissionLevel: &quot;safe&quot;</code>인 도구만 자동으로 노출됩니다.
            </li>
            <li>
              도구 실행 기본 타임아웃은 30초입니다. 도구 정의의 <code className="text-cyan-600">timeoutMs</code>로
              개별 타임아웃을 설정할 수 있습니다.
            </li>
            <li>
              도구 실행 중 에러가 발생하면 JSON-RPC 에러 응답이 아닌
              성공 응답 + <code className="text-cyan-600">isError: true</code>로 반환됩니다. (MCP 스펙 준수)
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; MCP 서버 시작</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            dbcode를 MCP 서버로 실행하여 외부 클라이언트의 연결을 대기합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">server</span> = <span className="kw">new</span> <span className="fn">MCPServer</span>({"{"}
            {"\n"}{"  "}<span className="prop">toolRegistry</span>: <span className="prop">myRegistry</span>,
            {"\n"}{"  "}<span className="prop">exposedTools</span>: [<span className="str">&quot;Read&quot;</span>, <span className="str">&quot;Grep&quot;</span>, <span className="str">&quot;Glob&quot;</span>],
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// stdin에서 JSON-RPC 메시지 수신 시작"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">server</span>.<span className="fn">start</span>();
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> MCP 서버는 stdin/stdout을 점유합니다.
            서버 모드에서는 일반적인 CLI 상호작용이 불가능합니다.
            서버를 중지하려면 stdin을 닫거나 <code>stop()</code>을 호출하세요.
          </Callout>

          {/* JSON-RPC 통신 예시 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; JSON-RPC 통신 프로토콜
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            클라이언트와 서버 간의 JSON-RPC 메시지 교환 순서입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1단계: 클라이언트 → 서버 (핸드셰이크)"}</span>
            {"\n"}{"{"}<span className="str">&quot;jsonrpc&quot;</span>: <span className="str">&quot;2.0&quot;</span>, <span className="str">&quot;id&quot;</span>: <span className="num">1</span>, <span className="str">&quot;method&quot;</span>: <span className="str">&quot;initialize&quot;</span>{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 2단계: 서버 → 클라이언트 (서버 정보)"}</span>
            {"\n"}{"{"}<span className="str">&quot;jsonrpc&quot;</span>: <span className="str">&quot;2.0&quot;</span>, <span className="str">&quot;id&quot;</span>: <span className="num">1</span>, <span className="str">&quot;result&quot;</span>: {"{"}
            {"\n"}{"  "}<span className="str">&quot;protocolVersion&quot;</span>: <span className="str">&quot;2024-11-05&quot;</span>,
            {"\n"}{"  "}<span className="str">&quot;serverInfo&quot;</span>: {"{"} <span className="str">&quot;name&quot;</span>: <span className="str">&quot;dbcode&quot;</span>, <span className="str">&quot;version&quot;</span>: <span className="str">&quot;...&quot;</span> {"}"}
            {"\n"}{"}}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 3단계: 도구 목록 요청"}</span>
            {"\n"}{"{"}<span className="str">&quot;jsonrpc&quot;</span>: <span className="str">&quot;2.0&quot;</span>, <span className="str">&quot;id&quot;</span>: <span className="num">2</span>, <span className="str">&quot;method&quot;</span>: <span className="str">&quot;tools/list&quot;</span>{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 4단계: 도구 실행"}</span>
            {"\n"}{"{"}<span className="str">&quot;jsonrpc&quot;</span>: <span className="str">&quot;2.0&quot;</span>, <span className="str">&quot;id&quot;</span>: <span className="num">3</span>, <span className="str">&quot;method&quot;</span>: <span className="str">&quot;tools/call&quot;</span>,
            {"\n"}{"  "}<span className="str">&quot;params&quot;</span>: {"{"} <span className="str">&quot;name&quot;</span>: <span className="str">&quot;Grep&quot;</span>, <span className="str">&quot;arguments&quot;</span>: {"{"} <span className="str">&quot;pattern&quot;</span>: <span className="str">&quot;TODO&quot;</span> {"}"} {"}"}
            {"\n"}{"}"}
          </CodeBlock>

          {/* 테스트용: handleMessage 직접 호출 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 테스트 시 직접 메시지 처리
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">handleMessage()</code>를 직접 호출하여
            stdin/stdout 없이 서버를 테스트할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">server</span> = <span className="kw">new</span> <span className="fn">MCPServer</span>({"{"} <span className="prop">toolRegistry</span> {"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 핸드셰이크"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">initResp</span> = <span className="kw">await</span> <span className="prop">server</span>.<span className="fn">handleMessage</span>(
            {"\n"}{"  "}<span className="fn">JSON</span>.<span className="fn">stringify</span>({"{"} <span className="prop">jsonrpc</span>: <span className="str">&quot;2.0&quot;</span>, <span className="prop">id</span>: <span className="num">1</span>, <span className="prop">method</span>: <span className="str">&quot;initialize&quot;</span> {"}"})
            {"\n"});
            {"\n"}
            {"\n"}<span className="cm">{"// 도구 목록 조회"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">listResp</span> = <span className="kw">await</span> <span className="prop">server</span>.<span className="fn">handleMessage</span>(
            {"\n"}{"  "}<span className="fn">JSON</span>.<span className="fn">stringify</span>({"{"} <span className="prop">jsonrpc</span>: <span className="str">&quot;2.0&quot;</span>, <span className="prop">id</span>: <span className="num">2</span>, <span className="prop">method</span>: <span className="str">&quot;tools/list&quot;</span> {"}"})
            {"\n"});
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> 알림(Notification)은 <code>id</code>가 없는 메시지입니다.
            <code>handleMessage()</code>는 알림에 대해 <code>null</code>을 반환하며,
            응답을 보내지 않습니다.
          </Callout>

          <DeepDive title="도구 노출 결정 로직">
            <p className="mb-3">
              노출할 도구는 두 가지 방식으로 결정됩니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 방식 1: 명시적 화이트리스트"}</span>
              {"\n"}<span className="kw">const</span> <span className="prop">server</span> = <span className="kw">new</span> <span className="fn">MCPServer</span>({"{"}
              {"\n"}{"  "}<span className="prop">exposedTools</span>: [<span className="str">&quot;Read&quot;</span>, <span className="str">&quot;Grep&quot;</span>],
              {"\n"}{"  "}<span className="cm">{"// → Read, Grep만 노출"}</span>
              {"\n"}{"}"});
              {"\n"}
              {"\n"}<span className="cm">{"// 방식 2: 자동 (safe 도구만)"}</span>
              {"\n"}<span className="kw">const</span> <span className="prop">server</span> = <span className="kw">new</span> <span className="fn">MCPServer</span>({"{"}
              {"\n"}{"  "}<span className="cm">{"// exposedTools 생략"}</span>
              {"\n"}{"  "}<span className="cm">{"// → permissionLevel='safe'인 도구 자동 노출"}</span>
              {"\n"}{"}"});
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              보안 민감한 환경에서는 <code className="text-cyan-600">exposedTools</code>를 명시적으로 지정하여
              필요한 도구만 노출하는 것을 권장합니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>요청 처리 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            stdin에서 수신한 JSON-RPC 메시지의 처리 흐름입니다.
          </p>

          <MermaidDiagram
            title="JSON-RPC 요청 처리 파이프라인"
            titleColor="purple"
            chart={`graph TD
  LINE["stdin 줄 입력"] --> PARSE{"JSON 파싱<br/>성공?"}
  PARSE -->|"실패"| ERR1["PARSE_ERROR<br/><small>-32700</small>"]
  PARSE -->|"성공"| VALID{"jsonrpc=2.0?<br/>method=string?"}
  VALID -->|"실패"| ERR2["INVALID_REQUEST<br/><small>-32600</small>"]
  VALID -->|"성공"| HASID{"id 존재?"}
  HASID -->|"없음"| NOTIF["Notification 처리<br/><small>응답 없음</small>"]
  HASID -->|"있음"| INIT{"method=<br/>initialize?"}
  INIT -->|"Yes"| HAND["핸드셰이크 처리"]
  INIT -->|"No"| INITCHK{"초기화<br/>완료?"}
  INITCHK -->|"No"| ERR3["INVALID_REQUEST"]
  INITCHK -->|"Yes"| ROUTE{"메서드 라우팅"}
  ROUTE -->|"tools/list"| LIST["도구 목록"]
  ROUTE -->|"tools/call"| CALL["도구 실행"]
  ROUTE -->|"ping"| PONG["빈 응답"]
  ROUTE -->|"기타"| ERR4["METHOD_NOT_FOUND"]

  style LINE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CALL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style LIST fill:#dcfce7,stroke:#10b981,color:#1e293b
  style ERR1 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ERR2 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ERR3 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ERR4 fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>도구 실행 핵심 코드</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">handleToolsCall()</code>의 핵심 실행 흐름입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// [1] 매개변수 검증"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">parseResult</span> = <span className="prop">toolDef</span>.<span className="prop">parameterSchema</span>.<span className="fn">safeParse</span>(<span className="prop">toolArgs</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// [2] AbortController로 타임아웃 제어"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">abortController</span> = <span className="kw">new</span> <span className="fn">AbortController</span>();
            {"\n"}<span className="kw">const</span> <span className="prop">timer</span> = <span className="fn">setTimeout</span>(() ={">"} <span className="prop">abortController</span>.<span className="fn">abort</span>(), <span className="prop">timeout</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// [3] 도구 실행"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="prop">toolDef</span>.<span className="fn">execute</span>(<span className="prop">parseResult</span>.<span className="prop">data</span>, <span className="prop">context</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// [4] MCP 형식으로 변환"}</span>
            {"\n"}<span className="kw">return</span> {"{"} <span className="prop">content</span>: [{"{"} <span className="prop">type</span>: <span className="str">&quot;text&quot;</span>, <span className="prop">text</span>: <span className="prop">result</span>.<span className="prop">output</span> {"}"}], <span className="prop">isError</span>: <span className="prop">result</span>.<span className="prop">isError</span> {"}"};
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> Zod 스키마로 인자를 엄격하게 검증합니다. 실패 시 <code className="text-cyan-600">INVALID_PARAMS</code> 에러를 반환합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> <code className="text-cyan-600">AbortController</code>로 타임아웃을 관리합니다. 기본 30초 후 자동 중단됩니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 도구를 실행합니다. 에러가 발생해도 catch하여 <code className="text-cyan-600">isError: true</code>로 반환합니다.</p>
            <p><strong className="text-gray-900">[4]</strong> dbcode 내부 결과를 MCP <code className="text-cyan-600">MCPToolCallResult</code> 형식으로 변환합니다.</p>
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
              &quot;Server not initialized&quot; 에러가 발생해요
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">initialize</code> 메서드를 먼저 호출해야 합니다.
              MCP 프로토콜에서 핸드셰이크는 필수입니다. 클라이언트가 연결 후 가장 먼저
              <code className="text-cyan-600">initialize</code> 요청을 보내야 합니다.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;tools/list에 원하는 도구가 없어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              두 가지 원인이 가능합니다:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">exposedTools</code>를 지정하지 않았다면, <code className="text-cyan-600">permissionLevel: &quot;safe&quot;</code>인
                도구만 노출됩니다. 원하는 도구가 &quot;unsafe&quot; 레벨이면 <code className="text-cyan-600">exposedTools</code>에 명시적으로 추가하세요.
              </li>
              <li>
                <code className="text-cyan-600">exposedTools</code>를 지정했다면, 도구 이름이 정확한지 확인하세요. (대소문자 구분)
              </li>
            </ul>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;도구 실행이 타임아웃으로 중단돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              기본 타임아웃은 30초입니다. 오래 걸리는 도구(대규모 파일 검색 등)에서는
              도구 정의의 <code className="text-cyan-600">timeoutMs</code>를 늘려야 합니다.
              <code className="text-cyan-600">AbortController</code>가 타임아웃 시 도구 실행을 취소합니다.
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
                name: "mcp/manager.ts",
                slug: "mcp-manager",
                relation: "sibling",
                desc: "MCP 클라이언트 측 서버 연결 관리 — MCPServer와 반대 역할 (클라이언트 vs 서버)",
              },
              {
                name: "tools/registry.ts",
                slug: "tool-registry",
                relation: "child",
                desc: "MCPServer가 도구를 조회하는 레지스트리 — getAll(), get() 사용",
              },
              {
                name: "permissions/manager.ts",
                slug: "permission-manager",
                relation: "sibling",
                desc: "도구 권한 레벨 관리 — safe/unsafe 결정이 도구 노출에 영향",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
