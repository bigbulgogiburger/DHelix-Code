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

export default function MCPTransportStdioPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/mcp/transports/stdio.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">StdioTransport</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              자식 프로세스의 stdin/stdout을 통한 JSON-RPC 통신을 구현하는 트랜스포트입니다.
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
                <code className="text-cyan-600">StdioTransport</code>는 가장 일반적인 MCP 트랜스포트
                방식입니다. 자식 프로세스(child process)를{" "}
                <code className="text-cyan-600">spawn</code>하고, 표준 입력(stdin)으로 JSON-RPC
                메시지를 전송하며, 표준 출력(stdout)에서 응답을 줄 단위로 읽습니다.
              </p>
              <p>
                로컬에서 실행되는 MCP 서버(예:{" "}
                <code className="text-cyan-600">npx @modelcontextprotocol/server-filesystem</code>
                )와 통신할 때 주로 사용됩니다. 네트워크가 필요 없고 프로세스 간 파이프(pipe)만
                사용하므로 가장 빠르고 간단한 방식입니다.
              </p>
              <p>
                각 메시지는 한 줄의 JSON 문자열이며 줄바꿈(<code className="text-cyan-600">\n</code>
                )으로 구분됩니다.
                <code className="text-cyan-600">readline</code> 인터페이스로 stdout을 줄 단위로
                파싱하고, 비-JSON 출력(디버그 메시지 등)은 자동으로 무시합니다.
              </p>
            </div>

            <MermaidDiagram
              title="StdioTransport 통신 흐름"
              titleColor="purple"
              chart={`graph LR
  DBCODE["dbcode<br/><small>부모 프로세스</small>"]
  MCP["MCP 서버<br/><small>자식 프로세스</small>"]

  DBCODE -->|"stdin<br/>JSON-RPC 요청/알림"| MCP
  MCP -->|"stdout<br/>JSON-RPC 응답/알림"| DBCODE
  MCP -.->|"stderr<br/>디버그 출력"| DBCODE

  style DBCODE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b,stroke-width:2px
  style MCP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 두 사람이 종이 메모를 주고받는 것과 비슷합니다. 한 쪽(dbcode)이
              메모를 써서 구멍에 넣으면(stdin), 상대방(MCP 서버)이 읽고 응답 메모를 다른 구멍으로
              보냅니다(stdout). 각 메모는 한 줄씩이고, 줄바꿈이 &quot;다음 메모&quot;의 신호입니다.
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

            {/* StdioTransportError */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class StdioTransportError
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              Stdio 트랜스포트 전용 에러 클래스입니다.
              <code className="text-cyan-600">BaseError</code>를 상속하며 에러 코드는
              <code className="text-cyan-600">&quot;STDIO_TRANSPORT_ERROR&quot;</code>입니다.
            </p>
            <CodeBlock>
              <span className="kw">class</span> <span className="type">StdioTransportError</span>{" "}
              <span className="kw">extends</span> <span className="type">BaseError</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">constructor</span>(<span className="prop">message</span>:{" "}
              <span className="type">string</span>, <span className="prop">context</span>?:{" "}
              <span className="type">Record</span>&lt;<span className="type">string</span>,{" "}
              <span className="type">unknown</span>&gt;)
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* StdioTransport class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class StdioTransport
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">MCPTransportLayer</code> 인터페이스의 stdio
              구현체입니다. 자식 프로세스를 관리하고, readline으로 stdout을 파싱합니다.
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
                  desc: "MCP 서버 설정 (command와 args 필수)",
                },
              ]}
            />

            {/* connect */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">connect()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              자식 프로세스를 시작하고 통신 채널을 설정합니다. 설정의{" "}
              <code className="text-cyan-600">command</code>와{" "}
              <code className="text-cyan-600">args</code>로 프로세스를 spawn하고, readline
              인터페이스를 연결합니다.
            </p>
            <CodeBlock>
              <span className="fn">connect</span>(): <span className="type">Promise</span>&lt;
              <span className="type">void</span>&gt;
            </CodeBlock>

            {/* disconnect */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">disconnect()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              자식 프로세스를 종료하고 리소스를 정리합니다. readline 인터페이스를 닫고 프로세스를
              kill합니다.
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
              JSON-RPC 요청을 자식 프로세스의 stdin으로 전송합니다. JSON 직렬화 후 줄바꿈을
              추가합니다.
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
              JSON-RPC 알림(응답 불필요)을 stdin으로 전송합니다.
            </p>
            <CodeBlock>
              <span className="fn">sendNotification</span>(<span className="prop">method</span>:{" "}
              <span className="type">string</span>, <span className="prop">params</span>:{" "}
              <span className="type">Record</span>&lt;<span className="type">string</span>,{" "}
              <span className="type">unknown</span>&gt;): <span className="type">void</span>
            </CodeBlock>

            {/* resolveCommand helper */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              resolveCommand(command)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              Windows에서 npx/npm 등 Node.js CLI 도구의 ENOENT 에러를 방지하기 위한 헬퍼 함수입니다.
              Windows에서는 <code className="text-cyan-600">.cmd</code> 확장자를 자동 추가합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">resolveCommand</span>(
              <span className="prop">command</span>: <span className="type">string</span>):{" "}
              <span className="type">string</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "command",
                  type: "string",
                  required: true,
                  desc: "실행할 커맨드 (예: 'npx', 'node')",
                },
              ]}
            />

            {/* resolveEnvVars */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              resolveEnvVars(env) [private]
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              환경 변수 값에서 <code className="text-cyan-600">{"${VAR}"}</code> 및
              <code className="text-cyan-600">{"${VAR:-default}"}</code> 패턴을 실제 값으로
              치환합니다.
            </p>
            <CodeBlock>
              <span className="cm">{'// 입력: { API_KEY: "${OPENAI_KEY:-sk-test}" }'}</span>
              {"\n"}
              <span className="cm">{'// OPENAI_KEY가 설정됨 → { API_KEY: "실제값" }'}</span>
              {"\n"}
              <span className="cm">{'// OPENAI_KEY가 없음  → { API_KEY: "sk-test" }'}</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">command</code>가 설정에 없으면{" "}
                <code className="text-cyan-600">StdioTransportError</code>가 발생합니다. stdio
                트랜스포트에는 반드시 command 필드가 필요합니다.
              </li>
              <li>
                Windows에서는 <code className="text-cyan-600">shell: true</code>로 프로세스를
                시작합니다. npx, npm 등 CLI 도구가 <code className="text-cyan-600">.cmd</code>{" "}
                래퍼로 제공되기 때문입니다.
              </li>
              <li>
                stdout에서 JSON으로 파싱할 수 없는 줄은 자동으로 무시됩니다. 서버가 디버그 메시지를
                stderr 대신 stdout에 출력하는 경우를 처리하기 위함입니다.
              </li>
              <li>
                stdin이 쓰기 가능 상태가 아닐 때{" "}
                <code className="text-cyan-600">sendRequest()</code>를 호출하면
                <code className="text-cyan-600">StdioTransportError</code>가 즉시 throw됩니다.
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
              기본 사용법 &mdash; 로컬 MCP 서버 연결
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              로컬 MCP 서버를 자식 프로세스로 시작하고 통신하는 가장 기본적인 패턴입니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">transport</span> ={" "}
              <span className="kw">new</span> <span className="fn">StdioTransport</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">name</span>:{" "}
              <span className="str">&quot;filesystem&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">transport</span>:{" "}
              <span className="str">&quot;stdio&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">command</span>: <span className="str">&quot;npx&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">args</span>: [
              <span className="str">&quot;@modelcontextprotocol/server-filesystem&quot;</span>,{" "}
              <span className="str">&quot;/home/user&quot;</span>],
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 핸들러 등록"}</span>
              {"\n"}
              <span className="prop">transport</span>.<span className="fn">onMessage</span>((
              <span className="prop">msg</span>) =&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">&quot;수신:&quot;</span>, <span className="prop">msg</span>);
              {"\n"}
              {"}"});
              {"\n"}
              <span className="prop">transport</span>.<span className="fn">onError</span>((
              <span className="prop">err</span>) =&gt; <span className="fn">console</span>.
              <span className="fn">error</span>(<span className="prop">err</span>));
              {"\n"}
              {"\n"}
              <span className="cm">{"// 연결 수립 (프로세스 시작)"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="prop">transport</span>.
              <span className="fn">connect</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 요청 전송"}</span>
              {"\n"}
              <span className="prop">transport</span>.<span className="fn">sendRequest</span>(
              <span className="num">1</span>, <span className="str">&quot;initialize&quot;</span>,{" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="prop">protocolVersion</span>:{" "}
              <span className="str">&quot;2024-11-05&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">capabilities</span>: {"{"}
              {"}"},{"\n"}
              {"  "}
              <span className="prop">clientInfo</span>: {"{"} <span className="prop">name</span>:{" "}
              <span className="str">&quot;dbcode&quot;</span> {"}"},{"\n"}
              {"}"});
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 자식 프로세스가 종료되면 <code>onError</code>와{" "}
              <code>onClose</code> 핸들러가 순서대로 호출됩니다. 프로세스가 비정상 종료된 경우 exit
              code가 에러 메시지에 포함됩니다.
            </Callout>

            {/* 고급: 환경 변수 치환 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 환경 변수 치환
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              설정의 <code className="text-cyan-600">env</code> 필드에서{" "}
              <code className="text-cyan-600">{"${VAR}"}</code>
              구문을 사용하면, 자식 프로세스에 전달할 환경 변수를 동적으로 설정할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">transport</span> ={" "}
              <span className="kw">new</span> <span className="fn">StdioTransport</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">name</span>:{" "}
              <span className="str">&quot;api-server&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">transport</span>:{" "}
              <span className="str">&quot;stdio&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">command</span>: <span className="str">&quot;node&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">args</span>: [
              <span className="str">&quot;server.js&quot;</span>],
              {"\n"}
              {"  "}
              <span className="prop">env</span>: {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// ${VAR} → 환경 변수 값 치환"}</span>
              {"\n"}
              {"    "}
              <span className="prop">API_KEY</span>:{" "}
              <span className="str">&quot;{"${OPENAI_API_KEY}"}&quot;</span>,{"\n"}
              {"    "}
              <span className="cm">{"// ${VAR:-default} → 없으면 기본값 사용"}</span>
              {"\n"}
              {"    "}
              <span className="prop">PORT</span>:{" "}
              <span className="str">&quot;{"${SERVER_PORT:-3000}"}&quot;</span>,{"\n"}
              {"  "}
              {"}"},{"\n"}
              {"}"});
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 환경 변수 치환은 부모 프로세스의 <code>process.env</code>에서
              값을 읽습니다.
              <code>{"${VAR:-default}"}</code> 구문으로 기본값을 지정하면 환경 변수가 없을 때도
              안전합니다.
            </Callout>

            <DeepDive title="Windows 호환성: resolveCommand()의 역할">
              <p className="mb-3">
                Windows에서 Node.js CLI 도구(npx, npm, yarn 등)는{" "}
                <code className="text-cyan-600">.cmd</code> 래퍼 스크립트로 제공됩니다.{" "}
                <code className="text-cyan-600">spawn()</code>으로 직접 실행하면
                <code className="text-red-600">ENOENT</code> 에러가 발생할 수 있습니다.
              </p>
              <p className="text-gray-600">
                <code className="text-cyan-600">resolveCommand()</code>는 Windows 환경에서만
                동작하며, 알려진 Node CLI 도구(npx, npm, yarn, pnpm, tsx, ts-node)에{" "}
                <code>.cmd</code> 확장자를 자동 추가합니다. 비-Windows 환경에서는 원래 명령어를
                그대로 반환합니다.
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
              connect() 시퀀스
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              자식 프로세스 시작부터 통신 채널 설정까지의 전체 흐름입니다.
            </p>

            <MermaidDiagram
              title="StdioTransport connect() 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("connect()")) --> ENV["환경 변수 치환<br/><small>resolveEnvVars()</small>"]
  ENV --> CMD["커맨드 해석<br/><small>resolveCommand()</small>"]
  CMD --> SPAWN["자식 프로세스 시작<br/><small>spawn(command, args)</small>"]
  SPAWN --> CHECK{"stdin/stdout<br/>연결 확인"}
  CHECK -->|"성공"| RL["readline 인터페이스 생성<br/><small>stdout 줄 단위 읽기</small>"]
  CHECK -->|"실패"| ERR["StdioTransportError<br/>throw"]
  RL --> EVENTS["이벤트 핸들러 등록<br/><small>exit, error</small>"]
  EVENTS --> DONE(("연결 완료"))

  style START fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style SPAWN fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
  style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style RL fill:#dcfce7,stroke:#10b981,color:#065f46
  style DONE fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              메시지 송수신 핵심 코드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              stdin 쓰기와 stdout 파싱의 핵심 로직입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// [송신] stdin에 JSON + 줄바꿈 쓰기"}</span>
              {"\n"}
              <span className="kw">private</span> <span className="fn">writeLine</span>(
              <span className="prop">line</span>: <span className="type">string</span>):{" "}
              <span className="type">void</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (!<span className="kw">this</span>.
              <span className="prop">process</span>?.<span className="prop">stdin</span>?.
              <span className="prop">writable</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">throw new</span> <span className="fn">StdioTransportError</span>(
              <span className="str">&quot;Server stdin not writable&quot;</span>);
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"  "}
              <span className="kw">this</span>.<span className="prop">process</span>.
              <span className="prop">stdin</span>.<span className="fn">write</span>(
              <span className="prop">line</span> + <span className="str">&quot;\n&quot;</span>);
              {"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// [수신] stdout에서 한 줄을 JSON-RPC 메시지로 파싱"}</span>
              {"\n"}
              <span className="kw">private</span> <span className="fn">handleLine</span>(
              <span className="prop">line</span>: <span className="type">string</span>):{" "}
              <span className="type">void</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">trimmed</span> ={" "}
              <span className="prop">line</span>.<span className="fn">trim</span>();
              {"\n"}
              {"  "}
              <span className="kw">if</span> (!<span className="prop">trimmed</span>){" "}
              <span className="kw">return</span>;{"\n"}
              {"\n"}
              {"  "}
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">message</span> ={" "}
              <span className="fn">JSON</span>.<span className="fn">parse</span>(
              <span className="prop">trimmed</span>);
              {"\n"}
              {"    "}
              <span className="kw">this</span>.<span className="prop">messageHandler</span>?.(
              <span className="prop">message</span>);
              {"\n"}
              {"  "}
              <span className="kw">
                {"}"} catch {"{"}
              </span>
              {"\n"}
              {"    "}
              <span className="cm">{"// JSON이 아닌 줄은 무시 (디버그 출력 등)"}</span>
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">writeLine:</strong> JSON 직렬화된 문자열에{" "}
                <code>\n</code>을 추가하여 stdin에 씁니다. 줄바꿈이 메시지 구분자 역할입니다.
              </p>
              <p>
                <strong className="text-gray-900">handleLine:</strong> stdout의 한 줄을 JSON으로
                파싱합니다. 실패하면 조용히 무시하여 비-JSON 출력(디버그 메시지)을 자연스럽게
                처리합니다.
              </p>
              <p>
                <strong className="text-gray-900">에러 처리:</strong> 프로세스 ENOENT 에러 시
                커맨드를 찾을 수 없다는 명확한 메시지를 제공합니다.
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
                &quot;Command not found: npx 에러가 발생합니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                Node.js가 시스템 PATH에 포함되어 있는지 확인하세요. Windows에서는
                <code className="text-cyan-600">resolveCommand()</code>가 자동으로 <code>.cmd</code>
                확장자를 추가하지만, Node.js 자체가 설치되어 있지 않으면 여전히 실패합니다.
              </p>
              <Callout type="tip" icon="*">
                <code>which npx</code> (macOS/Linux) 또는 <code>where npx</code> (Windows)로 npx가
                PATH에 있는지 확인하세요.
              </Callout>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Server stdin not writable 에러가 발생합니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                자식 프로세스가 이미 종료되었거나 stdin 파이프가 닫힌 상태입니다.
                <code className="text-cyan-600">onClose</code> 핸들러에서 재연결 로직을 구현하거나,
                프로세스가 비정상 종료된 원인을 stderr 출력에서 확인하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;서버가 응답하지 않습니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                MCP 서버가 stdout에 줄바꿈으로 끝나는 JSON을 출력하는지 확인하세요. readline은
                줄바꿈(<code>\n</code>)이 도착해야 한 줄을 완성합니다. 줄바꿈 없이 데이터만 보내면
                메시지가 수신되지 않습니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;환경 변수가 자식 프로세스에 전달되지 않습니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                설정의 <code className="text-cyan-600">env</code> 필드에{" "}
                <code className="text-cyan-600">{"${VAR}"}</code>
                구문을 사용했다면, 부모 프로세스의{" "}
                <code className="text-cyan-600">process.env</code>에 해당 변수가 설정되어 있는지
                확인하세요.
                <code className="text-cyan-600">{"${VAR:-default}"}</code> 구문으로 기본값을
                지정하면 안전합니다.
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
                  desc: "SSE(Server-Sent Events) 기반 양방향 통신 구현체",
                },
                {
                  name: "mcp/transports/http.ts",
                  slug: "mcp-transport-http",
                  relation: "sibling",
                  desc: "Streamable HTTP POST 기반 통신 구현체",
                },
                {
                  name: "mcp/client.ts",
                  slug: "mcp-client",
                  relation: "parent",
                  desc: "StdioTransport를 사용하여 로컬 MCP 서버와 통신하는 클라이언트",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
