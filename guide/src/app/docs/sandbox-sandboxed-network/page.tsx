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

export default function SandboxSandboxedNetworkPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/sandbox/sandboxed-network.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">네트워크 정책 샌드박스</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              네트워크 정책을 기존 샌드박스(Seatbelt/Bubblewrap) 실행에 통합하는 모듈입니다. 프록시
              서버를 시작하고 <code className="text-cyan-600 ml-1">HTTP_PROXY</code>/
              <code className="text-cyan-600">HTTPS_PROXY</code> 환경 변수를 주입하여 허용된
              도메인에만 접속을 허용합니다.
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
                <code className="text-cyan-600">sandboxed-network.ts</code>는 네트워크 정책 프록시와
                기존 샌드박스 실행을 하나의 함수로 묶어줍니다.{" "}
                <code className="text-cyan-600">network-proxy.ts</code>가 실제 HTTP 프록시 서버를
                담당한다면, 이 모듈은 프록시 수명 주기 관리와 환경 변수 주입을 책임집니다.
              </p>
              <p>
                실행 흐름: 네트워크 정책이 설정되면{" "}
                <code className="text-cyan-600">startNetworkProxy()</code>를 호출하여 로컬 프록시를
                시작하고, <code className="text-cyan-600">HTTP_PROXY</code>/
                <code className="text-cyan-600">HTTPS_PROXY</code> 환경 변수를 프록시 URL로 설정한
                뒤 <code className="text-cyan-600">executeSandboxed()</code>를 실행합니다. 완료
                후(에러 발생 시도) <code className="text-cyan-600">finally</code> 블록에서 프록시를
                반드시 종료합니다.
              </p>
              <p>
                정책이 없거나 &quot;모두 허용&quot; 기본 정책(allowlist·denylist 모두 비어 있음)인
                경우에는 프록시 오버헤드 없이 표준{" "}
                <code className="text-cyan-600">executeSandboxed()</code>로 직접 위임합니다.
              </p>
            </div>

            <MermaidDiagram
              title="네트워크 정책 샌드박스 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  ENTRY["executeSandboxedWithNetwork(config)"]
  CHECK_POLICY{"networkPolicy 있음?"}
  CHECK_ALLOW{"모두 허용<br/>(allow + 빈 목록)?"}
  DIRECT["executeSandboxed()<br/><small>프록시 없이 직접 실행</small>"]
  START_PROXY["startNetworkProxy()<br/><small>port: 0 (자동 할당)</small>"]
  ENV["HTTP_PROXY / HTTPS_PROXY<br/><small>환경 변수 주입</small>"]
  EXEC["executeSandboxed()<br/><small>프록시 경유 실행</small>"]
  STOP["proxy.stop()<br/><small>finally — 항상 정리</small>"]
  ERROR{"차단된 호스트<br/>있음?"}
  RETHROW["SandboxError + blockedHosts"]

  ENTRY --> CHECK_POLICY
  CHECK_POLICY -->|"없음"| DIRECT
  CHECK_POLICY -->|"있음"| CHECK_ALLOW
  CHECK_ALLOW -->|"예"| DIRECT
  CHECK_ALLOW -->|"아니오"| START_PROXY
  START_PROXY --> ENV
  ENV --> EXEC
  EXEC --> STOP
  EXEC -->|"실패"| ERROR
  ERROR -->|"예"| RETHROW
  ERROR -->|"아니오"| STOP

  style ENTRY fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
  style START_PROXY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style ENV fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style STOP fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style RETHROW fill:#fee2e2,stroke:#ef4444,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 건물 입구의 보안 게이트를 생각해보세요.{" "}
              <code>executeSandboxedWithNetwork</code>는 건물(샌드박스)에 입주하기 전에 게이트
              (프록시)를 세우고, 퇴장 시 반드시 게이트를 철거합니다. 방문객(네트워크 요청)은 허가
              목록에 있는 경우에만 통과할 수 있습니다.
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
              interface NetworkSandboxConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">SandboxConfig</code>를 확장하여{" "}
              <code className="text-cyan-600">networkPolicy</code> 필드를 추가한 설정
              인터페이스입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "networkPolicy",
                  type: "NetworkPolicy",
                  required: false,
                  desc: "적용할 네트워크 정책. 생략하면 프록시 없이 직접 실행",
                },
                {
                  name: "command",
                  type: "string",
                  required: true,
                  desc: "실행할 명령어 (SandboxConfig 상속)",
                },
                {
                  name: "args",
                  type: "string[]",
                  required: false,
                  desc: "명령어 인수 목록 (SandboxConfig 상속)",
                },
                {
                  name: "env",
                  type: "Record<string, string>",
                  required: false,
                  desc: "추가 환경 변수. 프록시 URL이 병합되어 주입됨",
                },
                {
                  name: "projectDir",
                  type: "string",
                  required: false,
                  desc: "실행 작업 디렉토리 (SandboxConfig 상속)",
                },
              ]}
            />

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "40px", marginBottom: "16px" }}
            >
              executeSandboxedWithNetwork(config)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              네트워크 정책을 적용하여 샌드박스 안에서 명령을 실행합니다. 반환값은{" "}
              <code className="text-cyan-600">{`{ stdout, stderr }`}</code>입니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span>{" "}
              <span className="fn">executeSandboxedWithNetwork</span>({"\n"}
              {"  "}
              <span className="prop">config</span>:{" "}
              <span className="type">NetworkSandboxConfig</span>,{"\n"}
              ): <span className="type">Promise</span>&lt;{"{ "}
              <span className="prop">stdout</span>: <span className="type">string</span>;{" "}
              <span className="prop">stderr</span>: <span className="type">string</span> {"}"}&gt;
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">port: 0</code>을 사용하여 OS가 사용 가능한 포트를
                자동 할당합니다. 고정 포트 충돌 걱정이 없습니다.
              </li>
              <li>
                HTTP_PROXY/HTTPS_PROXY를 대소문자 모두 설정합니다(
                <code className="text-cyan-600">HTTP_PROXY</code>,{" "}
                <code className="text-cyan-600">http_proxy</code>). 일부 도구는 소문자 변수만 읽기
                때문입니다.
              </li>
              <li>
                차단된 호스트가 있고 실행이 실패하면,{" "}
                <code className="text-cyan-600">SandboxError</code>에{" "}
                <code className="text-cyan-600">blockedHosts</code> 배열이 포함됩니다.
              </li>
              <li>
                <code className="text-cyan-600">finally</code> 블록에서 프록시를 반드시 종료하므로,
                실행 실패 시에도 포트가 누수되지 않습니다.
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
              기본 사용법 &mdash; 특정 도메인만 허용
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">networkPolicy</code>의{" "}
              <code className="text-cyan-600">defaultAction</code>을{" "}
              <code className="text-cyan-600">&quot;deny&quot;</code>로 설정하고,{" "}
              <code className="text-cyan-600">allowlist</code>에 허용할 도메인 패턴을 추가합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{ "}
              <span className="fn">executeSandboxedWithNetwork</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./sandbox/sandboxed-network.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span>{" "}
              <span className="fn">executeSandboxedWithNetwork</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">command</span>: <span className="str">&quot;curl&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">args</span>: [
              <span className="str">&quot;https://api.openai.com/v1/models&quot;</span>],{"\n"}
              {"  "}
              <span className="prop">projectDir</span>:{" "}
              <span className="str">&quot;/project&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">networkPolicy</span>: {"{"}
              {"\n"}
              {"    "}
              <span className="prop">defaultAction</span>:{" "}
              <span className="str">&quot;deny&quot;</span>,{"\n"}
              {"    "}
              <span className="prop">allowlist</span>: [
              <span className="str">&quot;*.openai.com&quot;</span>],{"\n"}
              {"    "}
              <span className="prop">denylist</span>: [],{"\n"}
              {"  "}
              {"}"},{"\n"}
              {"}"});{"\n"}
              {"\n"}
              <span className="prop">console</span>.<span className="fn">log</span>(
              <span className="prop">result</span>.<span className="prop">stdout</span>);
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>networkPolicy</code>를 생략하거나{" "}
              <code>defaultAction: &quot;allow&quot;</code>에 빈 목록을 전달하면 프록시 없이 직접
              실행됩니다. 정책을 의도적으로 적용하려면 반드시 <code>networkPolicy</code> 필드를
              명시하세요.
            </Callout>

            <h3 className="text-lg font-bold" style={{ marginTop: "40px", marginBottom: "16px" }}>
              고급 &mdash; 차단된 호스트 추적
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              실행 실패 시 <code className="text-cyan-600">SandboxError</code>의{" "}
              <code className="text-cyan-600">context.blockedHosts</code>에서 차단된 호스트 목록을
              확인할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{ "}
              <span className="type">SandboxError</span>
              {" }"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./sandbox/seatbelt.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">await</span>{" "}
              <span className="fn">executeSandboxedWithNetwork</span>(config);{"\n"}
              {"}"} <span className="kw">catch</span> (<span className="prop">error</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">error</span>{" "}
              <span className="kw">instanceof</span> <span className="type">SandboxError</span>){" "}
              {"{"}
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">blocked</span> ={" "}
              <span className="prop">error</span>.<span className="prop">context</span>.
              <span className="prop">blockedHosts</span> <span className="kw">as</span>{" "}
              <span className="type">string</span>[];{"\n"}
              {"    "}
              <span className="prop">console</span>.<span className="fn">log</span>(
              <span className="str">&quot;차단된 호스트:&quot;</span>,{" "}
              <span className="prop">blocked</span>);{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 개발 중 어떤 호스트가 차단되는지 파악하려면{" "}
              <code>onBlocked</code> 콜백(network-proxy.ts)을 직접 사용하거나,{" "}
              <code>SandboxError.context.blockedHosts</code>를 로깅하세요.
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
              프록시 수명 주기 관리
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              프록시 시작부터 종료까지 <code className="text-cyan-600">try/finally</code> 패턴으로
              안전하게 관리합니다. 에러가 발생해도 포트 누수가 없습니다.
            </p>

            <MermaidDiagram
              title="프록시 수명 주기 상태 다이어그램"
              titleColor="purple"
              chart={`stateDiagram-v2
  [*] --> 정책확인: executeSandboxedWithNetwork()
  정책확인 --> 직접실행: 정책 없음 / 모두 허용
  정책확인 --> 프록시시작: 제한 정책 있음
  프록시시작 --> 환경변수주입: startNetworkProxy() 완료
  환경변수주입 --> 샌드박스실행: HTTP_PROXY 설정됨
  샌드박스실행 --> 성공종료: 실행 성공
  샌드박스실행 --> 실패종료: 실행 실패
  성공종료 --> 프록시정리: finally
  실패종료 --> 오류분석: catch
  오류분석 --> 프록시정리: finally
  프록시정리 --> [*]: proxy.stop()
  직접실행 --> [*]`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              환경 변수 병합 전략
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              기존 <code className="text-cyan-600">config.env</code>를 보존하면서 프록시 URL을
              스프레드로 병합합니다. 대소문자 모두 설정하여 호환성을 높입니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">proxyUrl</span> ={" "}
              <span className="str">`http://127.0.0.1:${"{"}</span>
              <span className="prop">proxy</span>.<span className="prop">port</span>
              <span className="str">{"}"}`</span>;{"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">proxyEnv</span>:{" "}
              <span className="type">Record</span>&lt;
              <span className="type">string</span>, <span className="type">string</span>&gt; = {"{"}
              {"\n"}
              {"  "}...<span className="prop">sandboxConfig</span>.<span className="prop">env</span>
              ,{"\n"}
              {"  "}
              <span className="prop">HTTP_PROXY</span>: <span className="prop">proxyUrl</span>,
              {"  "}
              <span className="cm">{"// 대문자 (표준)"}</span>
              {"\n"}
              {"  "}
              <span className="prop">HTTPS_PROXY</span>: <span className="prop">proxyUrl</span>,
              {"\n"}
              {"  "}
              <span className="prop">http_proxy</span>: <span className="prop">proxyUrl</span>,
              {"  "}
              <span className="cm">{"// 소문자 (일부 도구 호환)"}</span>
              {"\n"}
              {"  "}
              <span className="prop">https_proxy</span>: <span className="prop">proxyUrl</span>,
              {"\n"}
              {"}"};
            </CodeBlock>

            <DeepDive title="최적화: 불필요한 프록시 오버헤드 방지">
              <p className="mb-3">
                모든 정책에 프록시를 적용하면 불필요한 오버헤드가 발생합니다. 다음 두 조건 중 하나에
                해당하면 프록시 없이 직접 실행합니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <code className="text-cyan-600">networkPolicy</code>가 <code>undefined</code>인
                  경우 (정책 미지정)
                </li>
                <li>
                  <code className="text-cyan-600">defaultAction === &quot;allow&quot;</code>이고
                  allowlist와 denylist가 모두 비어 있는 경우 (기본 허용 정책)
                </li>
              </ul>
              <p className="mt-3 text-gray-600">
                이 분기는 네트워크 정책이 설정되지 않은 일반 실행 환경에서 불필요한 TCP 연결
                오버헤드를 제거합니다.
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
                &quot;허용한 도메인인데 연결이 차단돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">allowlist</code>의 와일드카드 패턴을 확인하세요.
                예를 들어 <code className="text-cyan-600">&quot;api.openai.com&quot;</code>은
                서브도메인을 포함하지 않습니다.{" "}
                <code className="text-cyan-600">&quot;*.openai.com&quot;</code>을 사용하면 모든
                서브도메인이 허용됩니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;HTTPS 요청이 작동하지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">HTTPS_PROXY</code>와{" "}
                <code className="text-cyan-600">https_proxy</code>가 모두 설정되는지 확인하세요.
                일부 CLI 도구(예: curl)는 소문자 변수를 우선합니다. 또한 프록시는 CONNECT 방식 TCP
                터널링만 지원하므로 TLS 인증서 오류가 발생하지는 않습니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;프록시가 종료되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">executeSandboxedWithNetwork</code>는{" "}
                <code className="text-cyan-600">finally</code> 블록에서{" "}
                <code className="text-cyan-600">proxy.stop()</code>을 항상 호출합니다. 만약 직접
                <code className="text-cyan-600">startNetworkProxy()</code>를 사용한다면,
                try/finally로 반드시 정리해야 합니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;SandboxError에 blockedHosts가 없어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                네트워크 정책이 &quot;모두 허용&quot;이거나 정책이 없는 경우, 프록시 없이 직접
                실행되므로 <code className="text-cyan-600">blockedHosts</code>가 채워지지 않습니다.
                제한 정책(<code className="text-cyan-600">defaultAction: &quot;deny&quot;</code>)을
                설정해야 차단 추적이 활성화됩니다.
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
                  name: "network-proxy.ts",
                  slug: "sandbox-network-proxy",
                  relation: "sibling",
                  desc: "실제 HTTP 프록시 서버 구현 — 정책 기반 요청 허용/차단",
                },
                {
                  name: "network-policy.ts",
                  slug: "sandbox-network-policy",
                  relation: "sibling",
                  desc: "allowlist/denylist 규칙 엔진 — 호스트 허용 여부 판정",
                },
                {
                  name: "seatbelt.ts",
                  slug: "sandbox-seatbelt",
                  relation: "parent",
                  desc: "macOS 샌드박스 실행 기반 — executeSandboxed() 제공",
                },
                {
                  name: "sandbox-linux.ts",
                  slug: "sandbox-linux",
                  relation: "sibling",
                  desc: "Linux(bubblewrap/landlock) 샌드박스 실행",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
