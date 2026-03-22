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

export default function SandboxNetworkProxyPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/sandbox/network-proxy.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              네트워크 프록시
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            네트워크 정책을 적용하는 HTTP 프록시 서버입니다.
            샌드박스 프로세스의 네트워크 트래픽을 검사하고,
            허용된 호스트만 통과시킵니다.
            <code className="text-cyan-600 ml-1">sandboxed-network.ts</code>와 함께
            정책 기반 샌드박스 실행을 구성합니다.
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
              <code className="text-cyan-600">network-proxy.ts</code>는 로컬(127.0.0.1)에서
              HTTP 프록시 서버를 시작하여 샌드박스 프로세스의 네트워크 트래픽을 제어합니다.
              HTTP 요청은 직접 전달(forwarding)하고, HTTPS 요청은 CONNECT 메서드를 통한
              TCP 터널링으로 처리합니다. TLS 내용은 검사하지 않습니다(투명 터널).
            </p>
            <p>
              <code className="text-cyan-600">sandboxed-network.ts</code>는 이 프록시와 기존 샌드박스
              (Seatbelt/Bubblewrap)를 통합하는 모듈입니다. 네트워크 정책이 설정되면 프록시를 시작하고,
              <code className="text-cyan-600">HTTP_PROXY</code>/<code className="text-cyan-600">HTTPS_PROXY</code>
              환경 변수를 설정하여 샌드박스 프로세스가 프록시를 경유하도록 합니다.
              실행 완료 후 프록시는 <code className="text-cyan-600">finally</code>에서 반드시 정리됩니다.
            </p>
            <p>
              정책이 없거나 &quot;모두 허용&quot;인 경우, 프록시 오버헤드 없이 직접 샌드박스를 실행합니다.
              이를 통해 불필요한 성능 저하를 방지합니다.
            </p>
          </div>

          <MermaidDiagram
            title="네트워크 프록시 + 정책 통합 아키텍처"
            titleColor="purple"
            chart={`graph TD
  SANDNET["sandboxed-network.ts<br/><small>정책 통합 샌드박스</small>"]
  PROXY["network-proxy.ts<br/><small>HTTP 프록시 서버</small>"]
  POLICY["network-policy.ts<br/><small>규칙 엔진</small>"]
  SEATBELT["seatbelt.ts<br/><small>macOS 샌드박스</small>"]
  SANDBOX["샌드박스 프로세스<br/><small>HTTP_PROXY 경유</small>"]
  TARGET["대상 서버<br/><small>api.openai.com 등</small>"]

  SANDNET --> PROXY
  SANDNET --> SEATBELT
  PROXY -->|"isHostAllowed()"| POLICY
  SANDBOX -->|"HTTP/HTTPS 요청"| PROXY
  PROXY -->|"허용"| TARGET
  PROXY -->|"차단"| BLOCKED["403 Forbidden"]

  style PROXY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style SANDNET fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style POLICY fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SEATBELT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style BLOCKED fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 공항의 세관 검사소를 떠올리세요.
            모든 나가는 짐(네트워크 요청)이 검사소(프록시)를 통과해야 하고,
            허용 목록에 있는 목적지만 통과시키며, 차단된 목적지는 돌려보냅니다(403 Forbidden).
            검사소가 없는 공항(정책 없음)에서는 바로 탑승합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* network-proxy.ts 섹션 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
            <p className="text-xs font-mono text-gray-400 mb-2">network-proxy.ts</p>

            {/* ProxyOptions interface */}
            <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "16px", marginBottom: "16px" }}>
              interface ProxyOptions
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              프록시 서버 시작 옵션입니다.
            </p>
            <ParamTable
              params={[
                { name: "port", type: "number", required: true, desc: "리스닝 포트 (0이면 OS가 자동 할당)" },
                { name: "policy", type: "NetworkPolicy", required: true, desc: "적용할 네트워크 정책" },
                { name: "onBlocked", type: "(host: string) => void", required: false, desc: "연결이 차단될 때 호출되는 콜백 (모니터링/로깅용)" },
              ]}
            />

            {/* ProxyHandle interface */}
            <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
              interface ProxyHandle
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              프록시 서버 핸들입니다. 실제 포트 번호와 종료 함수를 포함합니다.
            </p>
            <ParamTable
              params={[
                { name: "port", type: "number", required: true, desc: "프록시가 실제로 리스닝 중인 포트 번호" },
                { name: "stop", type: "() => Promise<void>", required: true, desc: "프록시를 종료하고 리소스를 정리하는 함수" },
              ]}
            />

            {/* startNetworkProxy */}
            <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
              startNetworkProxy(options)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              네트워크 정책을 적용하는 HTTP 프록시 서버를 시작합니다.
              127.0.0.1에서만 리스닝하여 외부 접근을 차단합니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span> <span className="fn">startNetworkProxy</span>(
              {"\n"}{"  "}<span className="prop">options</span>: <span className="type">ProxyOptions</span>
              {"\n"}): <span className="type">Promise</span>&lt;<span className="type">ProxyHandle</span>&gt;
            </CodeBlock>
          </div>

          {/* sandboxed-network.ts 섹션 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
            <p className="text-xs font-mono text-gray-400 mb-2">sandboxed-network.ts</p>

            {/* NetworkSandboxConfig interface */}
            <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "16px", marginBottom: "16px" }}>
              interface NetworkSandboxConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              네트워크 정책이 추가된 확장 샌드박스 설정입니다.
              <code className="text-cyan-600">SandboxConfig</code>를 확장합니다.
            </p>
            <ParamTable
              params={[
                { name: "...SandboxConfig", type: "-", required: true, desc: "SandboxConfig의 모든 프로퍼티 (command, args, projectDir 등)" },
                { name: "networkPolicy", type: "NetworkPolicy | undefined", required: false, desc: "적용할 네트워크 정책 (생략하면 기본 정책)" },
              ]}
            />

            {/* executeSandboxedWithNetwork */}
            <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
              executeSandboxedWithNetwork(config)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              네트워크 정책을 적용하여 샌드박스 안에서 명령을 실행합니다.
              정책이 없거나 &quot;모두 허용&quot;이면 프록시 없이 직접 실행합니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span> <span className="fn">executeSandboxedWithNetwork</span>(
              {"\n"}{"  "}<span className="prop">config</span>: <span className="type">NetworkSandboxConfig</span>
              {"\n"}): <span className="type">Promise</span>&lt;{"{"}
              {"\n"}{"  "}<span className="prop">stdout</span>: <span className="type">string</span>;
              {"\n"}{"  "}<span className="prop">stderr</span>: <span className="type">string</span>;
              {"\n"}{"}"}&gt;
            </CodeBlock>
          </div>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              프록시는 <code className="text-cyan-600">127.0.0.1</code>에서만 리스닝합니다.
              외부 네트워크에서 프록시에 직접 접근할 수 없습니다.
            </li>
            <li>
              HTTPS 요청은 CONNECT 터널링으로 처리됩니다. TLS 내용은 복호화하지 않으므로,
              호스트 이름으로만 정책을 적용합니다.
            </li>
            <li>
              포트 <code className="text-cyan-600">0</code>을 지정하면 OS가 사용 가능한 포트를 자동 할당합니다.
              <code className="text-cyan-600">ProxyHandle.port</code>에서 실제 포트를 확인하세요.
            </li>
            <li>
              <code className="text-cyan-600">stop()</code> 호출 시
              <code className="text-cyan-600">closeAllConnections()</code>으로
              남아있는 연결을 강제 종료합니다.
            </li>
            <li>
              <code className="text-cyan-600">executeSandboxedWithNetwork()</code>은
              차단된 호스트 목록을 에러 컨텍스트에 포함시켜 디버깅을 돕습니다.
            </li>
            <li>
              <code className="text-cyan-600">HTTP_PROXY</code>와 <code className="text-cyan-600">http_proxy</code>
              (대/소문자 모두) 환경 변수를 동시에 설정하여 다양한 도구와의 호환성을 확보합니다.
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

          {/* 기본 사용법: 통합 실행 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 네트워크 정책 적용 샌드박스 실행</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 일반적인 패턴입니다. <code className="text-cyan-600">executeSandboxedWithNetwork()</code>가
            프록시 시작, 환경 변수 설정, 샌드박스 실행, 프록시 정리를 모두 자동으로 처리합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">executeSandboxedWithNetwork</span>({"{"}
            {"\n"}{"  "}<span className="prop">command</span>: <span className="str">&quot;curl&quot;</span>,
            {"\n"}{"  "}<span className="prop">args</span>: [<span className="str">&quot;https://api.openai.com/v1/models&quot;</span>],
            {"\n"}{"  "}<span className="prop">projectDir</span>: <span className="str">&quot;/project&quot;</span>,
            {"\n"}{"  "}<span className="prop">networkPolicy</span>: {"{"}
            {"\n"}{"    "}<span className="prop">defaultAction</span>: <span className="str">&quot;deny&quot;</span>,
            {"\n"}{"    "}<span className="prop">allowlist</span>: [<span className="str">&quot;*.openai.com&quot;</span>],
            {"\n"}{"    "}<span className="prop">denylist</span>: [],
            {"\n"}{"  "}{"}"},
            {"\n"}{"}"});
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>networkPolicy</code>를 생략하거나 기본 &quot;모두 허용&quot; 정책이면
            프록시를 시작하지 않고 직접 샌드박스를 실행합니다. 반드시 정책을 설정해야 네트워크 제어가 적용됩니다.
          </Callout>

          {/* 프록시 직접 사용 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 프록시 서버 직접 관리
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">startNetworkProxy()</code>로 프록시를 직접 시작하고 관리할 수 있습니다.
            여러 프로세스가 동일한 프록시를 공유하거나, 차단 이벤트를 모니터링할 때 유용합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 차단 이벤트 모니터링"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">blockedHosts</span>: <span className="type">string</span>[] = [];
            {"\n"}
            {"\n"}<span className="kw">const</span> <span className="prop">proxy</span> = <span className="kw">await</span> <span className="fn">startNetworkProxy</span>({"{"}
            {"\n"}{"  "}<span className="prop">port</span>: <span className="num">0</span>, <span className="cm">{"// OS가 포트 자동 할당"}</span>
            {"\n"}{"  "}<span className="prop">policy</span>: {"{"}
            {"\n"}{"    "}<span className="prop">defaultAction</span>: <span className="str">&quot;deny&quot;</span>,
            {"\n"}{"    "}<span className="prop">allowlist</span>: [<span className="str">&quot;*.openai.com&quot;</span>],
            {"\n"}{"    "}<span className="prop">denylist</span>: [],
            {"\n"}{"  "}{"}"},{"\n"}{"  "}<span className="prop">onBlocked</span>: (<span className="prop">host</span>) =&gt; {"{"}
            {"\n"}{"    "}<span className="prop">blockedHosts</span>.<span className="fn">push</span>(<span className="prop">host</span>);
            {"\n"}{"    "}<span className="fn">console</span>.<span className="fn">warn</span>(<span className="str">`차단됨: ${"{"}</span><span className="prop">host</span><span className="str">{"}"}`</span>);
            {"\n"}{"  "}{"}"},{"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`프록시 포트: ${"{"}</span><span className="prop">proxy</span>.<span className="prop">port</span><span className="str">{"}"}`</span>);
            {"\n"}
            {"\n"}<span className="kw">try</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// 프록시를 사용하는 작업 수행"}</span>
            {"\n"}{"}"} <span className="kw">finally</span> {"{"}
            {"\n"}{"  "}<span className="kw">await</span> <span className="prop">proxy</span>.<span className="fn">stop</span>();
            {"\n"}{"}"}
          </CodeBlock>

          {/* 프록시 우회 조건 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 프록시 우회 조건 이해하기
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">executeSandboxedWithNetwork()</code>는 다음 조건에서
            프록시를 시작하지 않고 직접 샌드박스를 실행합니다:
          </p>
          <CodeBlock>
            <span className="cm">{"// 조건 1: networkPolicy가 undefined"}</span>
            {"\n"}<span className="fn">executeSandboxedWithNetwork</span>({"{"} ...<span className="prop">config</span> {"}"});
            {"\n"}<span className="cm">{"// → executeSandboxed()로 직접 위임"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 조건 2: 기본 '모두 허용' 정책"}</span>
            {"\n"}<span className="fn">executeSandboxedWithNetwork</span>({"{"}
            {"\n"}{"  "}...<span className="prop">config</span>,
            {"\n"}{"  "}<span className="prop">networkPolicy</span>: {"{"}
            {"\n"}{"    "}<span className="prop">defaultAction</span>: <span className="str">&quot;allow&quot;</span>,
            {"\n"}{"    "}<span className="prop">allowlist</span>: [],
            {"\n"}{"    "}<span className="prop">denylist</span>: [],
            {"\n"}{"  "}{"}"},{"\n"}{"}"});
            {"\n"}<span className="cm">{"// → 프록시 없이 직접 실행 (불필요한 오버헤드 방지)"}</span>
          </CodeBlock>

          <DeepDive title="HTTP_PROXY 환경 변수 호환성">
            <p className="mb-3">
              <code className="text-cyan-600">executeSandboxedWithNetwork()</code>는 프록시 URL을
              대문자와 소문자 환경 변수 모두에 설정합니다:
            </p>
            <CodeBlock>
              <span className="prop">HTTP_PROXY</span>  = <span className="str">&quot;http://127.0.0.1:54321&quot;</span>  <span className="cm">{"// 대문자 (표준)"}</span>
              {"\n"}<span className="prop">HTTPS_PROXY</span> = <span className="str">&quot;http://127.0.0.1:54321&quot;</span>  <span className="cm">{"// 대문자 (표준)"}</span>
              {"\n"}<span className="prop">http_proxy</span>  = <span className="str">&quot;http://127.0.0.1:54321&quot;</span>  <span className="cm">{"// 소문자 (일부 도구)"}</span>
              {"\n"}<span className="prop">https_proxy</span> = <span className="str">&quot;http://127.0.0.1:54321&quot;</span>  <span className="cm">{"// 소문자 (일부 도구)"}</span>
            </CodeBlock>
            <p className="mt-3 text-amber-600">
              <code className="text-cyan-600">curl</code>은 소문자를,
              <code className="text-cyan-600">Node.js</code>의 일부 HTTP 라이브러리는 대문자를 사용합니다.
              양쪽 모두 설정하여 최대 호환성을 확보합니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>프록시 요청 처리 플로우</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            프록시는 HTTP와 HTTPS 요청을 다르게 처리합니다.
          </p>

          <MermaidDiagram
            title="프록시 요청 처리 플로우"
            titleColor="purple"
            chart={`graph TD
  REQ(("요청 수신")) --> TYPE{"요청 유형?"}
  TYPE -->|"CONNECT<br/>(HTTPS)"| CONNECT["호스트 추출<br/><small>host:port 파싱</small>"]
  TYPE -->|"일반 HTTP"| HTTP["호스트 추출<br/><small>Host 헤더 / URL 파싱</small>"]

  CONNECT --> CHECK1{"isHostAllowed()?"}
  HTTP --> CHECK2{"isHostAllowed()?"}

  CHECK1 -->|"허용"| TUNNEL["TCP 터널 수립<br/><small>200 Connection Established</small><br/>양방향 pipe"]
  CHECK1 -->|"차단"| BLOCK1["403 Forbidden<br/><small>onBlocked 콜백</small>"]

  CHECK2 -->|"허용"| FORWARD["대상 서버와 연결<br/><small>요청 + 헤더 전달</small><br/>응답 pipe"]
  CHECK2 -->|"차단"| BLOCK2["403 Forbidden<br/><small>onBlocked 콜백</small>"]

  style TUNNEL fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style FORWARD fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style BLOCK1 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style BLOCK2 fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>HTTPS CONNECT 터널링</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            HTTPS 연결은 CONNECT 메서드를 통해 TCP 터널을 수립합니다.
            프록시는 TLS 내용을 복호화하지 않고 양방향으로 데이터를 전달합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// CONNECT 처리 핵심 로직"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">serverSocket</span> = <span className="fn">connect</span>(<span className="prop">targetPort</span>, <span className="prop">targetHost</span>, () =&gt; {"{"}
            {"\n"}{"  "}<span className="cm">{"// 1. 클라이언트에게 터널 수립 성공 알림"}</span>
            {"\n"}{"  "}<span className="prop">clientSocket</span>.<span className="fn">write</span>(<span className="str">&quot;HTTP/1.1 200 Connection Established\\r\\n\\r\\n&quot;</span>);
            {"\n"}{"  "}<span className="cm">{"// 2. 초기 데이터 전달"}</span>
            {"\n"}{"  "}<span className="prop">serverSocket</span>.<span className="fn">write</span>(<span className="prop">head</span>);
            {"\n"}{"  "}<span className="cm">{"// 3. 양방향 파이프 설정"}</span>
            {"\n"}{"  "}<span className="prop">serverSocket</span>.<span className="fn">pipe</span>(<span className="prop">clientSocket</span>);
            {"\n"}{"  "}<span className="prop">clientSocket</span>.<span className="fn">pipe</span>(<span className="prop">serverSocket</span>);
            {"\n"}{"}"});
          </CodeBlock>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>정책 통합 실행 플로우 (sandboxed-network.ts)</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">executeSandboxedWithNetwork()</code>의 전체 실행 과정입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 정책 통합 실행 과정"}</span>
            {"\n"}<span className="kw">async function</span> <span className="fn">executeSandboxedWithNetwork</span>(<span className="prop">config</span>) {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] 정책 없음 → 직접 실행"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (!<span className="prop">networkPolicy</span>) <span className="kw">return</span> <span className="fn">executeSandboxed</span>(...);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] '모두 허용' 정책 → 프록시 없이 직접 실행"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">isDefaultAllow</span>) <span className="kw">return</span> <span className="fn">executeSandboxed</span>(...);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 프록시 시작 (포트 0 = OS 자동 할당)"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">proxy</span> = <span className="kw">await</span> <span className="fn">startNetworkProxy</span>({"{"}...{"}"});
            {"\n"}
            {"\n"}{"  "}<span className="kw">try</span> {"{"}
            {"\n"}{"    "}<span className="cm">{"// [4] HTTP_PROXY 환경 변수 설정"}</span>
            {"\n"}{"    "}<span className="cm">{"// [5] 샌드박스 실행 (프록시 경유)"}</span>
            {"\n"}{"  "}<span className="kw">{"}"} catch</span> {"{"}
            {"\n"}{"    "}<span className="cm">{"// [6] 차단된 호스트 정보를 에러에 포함"}</span>
            {"\n"}{"  "}<span className="kw">{"}"} finally</span> {"{"}
            {"\n"}{"    "}<span className="cm">{"// [7] 프록시 반드시 정리"}</span>
            {"\n"}{"    "}<span className="kw">await</span> <span className="prop">proxy</span>.<span className="fn">stop</span>();
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1-2] 최적화:</strong> 네트워크 제어가 불필요한 경우 프록시를 시작하지 않아 성능 오버헤드를 제거합니다.</p>
            <p><strong className="text-gray-900">[6] 디버깅:</strong> 차단된 호스트 목록(<code className="text-cyan-600">blockedHosts</code>)을 에러 컨텍스트에 포함시켜, 어떤 도메인이 차단되었는지 확인할 수 있습니다.</p>
            <p><strong className="text-gray-900">[7] 리소스 정리:</strong> <code className="text-cyan-600">finally</code>에서 프록시를 반드시 종료하여 포트 누수를 방지합니다.</p>
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
              &quot;프록시를 설정했는데 네트워크 제어가 적용되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              실행하는 도구가 <code className="text-cyan-600">HTTP_PROXY</code> 환경 변수를 지원하는지 확인하세요.
              일부 도구(예: <code className="text-cyan-600">go</code> 바이너리)는 프록시 환경 변수를 무시합니다.
            </p>
            <Callout type="tip" icon="*">
              <code>curl</code>은 <code>http_proxy</code>(소문자)를,
              <code>npm</code>/<code>node</code>는 <code>HTTP_PROXY</code>(대문자)를 사용합니다.
              두 가지 모두 자동으로 설정되므로 대부분의 도구에서 동작합니다.
            </Callout>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Sandboxed command failed with blocked network access 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              샌드박스 내부의 명령이 차단된 도메인에 접근을 시도했습니다.
              에러의 <code className="text-cyan-600">blockedHosts</code> 필드에서
              어떤 도메인이 차단되었는지 확인하고, 필요한 도메인을
              <code className="text-cyan-600">allowlist</code>에 추가하세요.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Failed to start network proxy 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              지정한 포트가 이미 사용 중일 수 있습니다.
              <code className="text-cyan-600">port: 0</code>을 사용하여
              OS가 자동으로 사용 가능한 포트를 할당하도록 하세요.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;프록시 종료 후에도 포트가 사용 중이에요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">stop()</code>은 <code className="text-cyan-600">closeAllConnections()</code>을
              호출하여 남아있는 연결을 강제 종료합니다.
              그래도 포트가 해제되지 않으면, TIME_WAIT 상태의 소켓이 있을 수 있습니다.
              잠시 후 다시 시도하거나 다른 포트를 사용하세요.
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
                name: "network-policy.ts",
                slug: "sandbox-network-policy",
                relation: "sibling",
                desc: "네트워크 접근 정책 — 도메인별 허용/차단 규칙 엔진",
              },
              {
                name: "seatbelt.ts",
                slug: "sandbox-seatbelt",
                relation: "parent",
                desc: "macOS Seatbelt 샌드박스 — 프로세스 격리 실행",
              },
              {
                name: "linux.ts",
                slug: "sandbox-linux",
                relation: "parent",
                desc: "Linux Bubblewrap 샌드박스 — Linux 환경 프로세스 격리",
              },
              {
                name: "bubblewrap.ts",
                slug: "sandbox-bubblewrap",
                relation: "sibling",
                desc: "Bubblewrap 래퍼 — bwrap 인수 생성과 격리 실행",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
