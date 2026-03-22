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

export default function SandboxNetworkPolicyPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/sandbox/network-policy.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              네트워크 접근 정책
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            샌드박스 프로세스의 네트워크 접근을 허용 목록(allowlist)과
            차단 목록(denylist) 기반으로 제어하는 규칙 엔진입니다.
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
              <code className="text-cyan-600">network-policy.ts</code>는 샌드박스 프로세스가 접속할 수 있는
              도메인과 IP를 제어하는 순수한 규칙 엔진입니다.
              네트워크 연결을 직접 차단하지는 않고,
              <code className="text-cyan-600">isHostAllowed()</code> 함수로 &quot;이 호스트에 접속해도 되는가?&quot;를 판정합니다.
              실제 차단은 <code className="text-cyan-600">network-proxy.ts</code>가 수행합니다.
            </p>
            <p>
              평가 우선순위는 명확합니다: (1) denylist가 최우선 &mdash; 차단 목록에 있으면 무조건 거부,
              (2) allowlist &mdash; 허용 목록에 있으면 허용,
              (3) defaultAction &mdash; 어느 목록에도 없으면 기본 동작 적용.
              이 3단계 규칙으로 유연하고 예측 가능한 네트워크 제어가 가능합니다.
            </p>
            <p>
              와일드카드 패턴(<code className="text-cyan-600">*.openai.com</code>)을 지원하여
              서브도메인 전체를 한 번에 허용하거나 차단할 수 있습니다.
              <code className="text-cyan-600">parseNetworkPolicy()</code>로 외부 설정(JSON 등)을
              안전하게 파싱할 수 있으며, 유효하지 않은 입력에는 기본 정책을 반환합니다.
            </p>
          </div>

          <MermaidDiagram
            title="네트워크 정책 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  PROXY["network-proxy.ts<br/><small>HTTP 프록시 서버</small>"]
  POLICY["network-policy.ts<br/><small>규칙 엔진</small>"]
  SANDNET["sandboxed-network.ts<br/><small>정책 통합 샌드박스</small>"]
  SEATBELT["seatbelt.ts<br/><small>macOS 샌드박스</small>"]
  CONFIG["설정 파일<br/><small>JSON / DBCODE.md</small>"]

  PROXY -->|"isHostAllowed()"| POLICY
  SANDNET --> PROXY
  SANDNET --> SEATBELT
  CONFIG -->|"parseNetworkPolicy()"| POLICY

  style POLICY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PROXY fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SANDNET fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SEATBELT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CONFIG fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 클럽의 출입 명단을 떠올리세요.
            VIP 목록(allowlist)에 있으면 입장 가능, 블랙리스트(denylist)에 있으면 무조건 거부.
            어느 목록에도 없으면 클럽의 기본 정책(defaultAction)에 따릅니다.
            블랙리스트가 항상 VIP보다 우선합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* NetworkPolicy interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface NetworkPolicy
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            샌드박스 프로세스의 네트워크 접근 정책을 정의합니다.
          </p>
          <ParamTable
            params={[
              { name: "defaultAction", type: '"allow" | "deny"', required: true, desc: "기본 동작: 모두 허용(allow) 또는 모두 차단(deny)" },
              { name: "allowlist", type: "readonly string[]", required: true, desc: "명시적 허용 도메인/IP 목록 (와일드카드 *.도메인 지원)" },
              { name: "denylist", type: "readonly string[]", required: true, desc: "명시적 차단 도메인/IP 목록 (allowlist보다 우선)" },
            ]}
          />

          {/* DEFAULT_NETWORK_POLICY */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            DEFAULT_NETWORK_POLICY
          </h3>
          <p className="text-[13px] text-gray-600 mb-3">
            기본 정책 상수입니다. 모든 트래픽을 허용하며, 정책이 설정되지 않은 경우 사용됩니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">DEFAULT_NETWORK_POLICY</span>: <span className="type">NetworkPolicy</span> = {"{"}
            {"\n"}{"  "}<span className="prop">defaultAction</span>: <span className="str">&quot;allow&quot;</span>,
            {"\n"}{"  "}<span className="prop">allowlist</span>: [],
            {"\n"}{"  "}<span className="prop">denylist</span>: [],
            {"\n"}{"}"};
          </CodeBlock>

          {/* isHostAllowed */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            isHostAllowed(host, policy)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3">
            도메인/호스트가 네트워크 정책에 의해 허용되는지 확인합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">isHostAllowed</span>(
            {"\n"}{"  "}<span className="prop">host</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">policy</span>: <span className="type">NetworkPolicy</span>
            {"\n"}): <span className="type">boolean</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "host", type: "string", required: true, desc: '확인할 호스트 이름 (예: "api.openai.com")' },
              { name: "policy", type: "NetworkPolicy", required: true, desc: "적용할 네트워크 정책" },
            ]}
          />

          {/* parseNetworkPolicy */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            parseNetworkPolicy(config)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3">
            알 수 없는(unknown) 설정 값에서 NetworkPolicy를 안전하게 파싱합니다.
            유효하지 않은 입력에 대해서는 <code className="text-cyan-600">DEFAULT_NETWORK_POLICY</code>를 반환합니다.
            반환값은 <code className="text-cyan-600">Object.freeze()</code>로 불변 객체입니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">parseNetworkPolicy</span>(<span className="prop">config</span>: <span className="type">unknown</span>): <span className="type">NetworkPolicy</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">denylist</code>가
              <code className="text-cyan-600">allowlist</code>보다 항상 우선합니다.
              두 목록에 동시에 있는 호스트는 차단됩니다.
            </li>
            <li>
              와일드카드 <code className="text-cyan-600">*.openai.com</code>은
              <code className="text-cyan-600">api.openai.com</code>과 매칭되지만,
              <code className="text-cyan-600">openai.com</code> 자체와는 매칭되지 않습니다
              (서브도메인이 반드시 필요).
            </li>
            <li>
              빈 문자열(<code className="text-cyan-600">&quot;&quot;</code>) 호스트는 무조건 거부됩니다.
            </li>
            <li>
              호스트 비교는 대소문자를 무시합니다(case-insensitive).
              <code className="text-cyan-600">&quot;API.OpenAI.com&quot;</code>과
              <code className="text-cyan-600">&quot;api.openai.com&quot;</code>은 동일하게 취급됩니다.
            </li>
            <li>
              <code className="text-cyan-600">parseNetworkPolicy()</code>는
              <code className="text-cyan-600">allowlist</code>/<code className="text-cyan-600">denylist</code>에서
              문자열이 아닌 항목을 자동으로 필터링합니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 호스트 허용 여부 확인</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            정책을 생성하고, 특정 호스트가 허용되는지 확인합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">policy</span>: <span className="type">NetworkPolicy</span> = {"{"}
            {"\n"}{"  "}<span className="prop">defaultAction</span>: <span className="str">&quot;deny&quot;</span>,
            {"\n"}{"  "}<span className="prop">allowlist</span>: [<span className="str">&quot;*.openai.com&quot;</span>, <span className="str">&quot;api.anthropic.com&quot;</span>],
            {"\n"}{"  "}<span className="prop">denylist</span>: [<span className="str">&quot;malicious.example.com&quot;</span>],
            {"\n"}{"}"};
            {"\n"}
            {"\n"}<span className="fn">isHostAllowed</span>(<span className="str">&quot;api.openai.com&quot;</span>, <span className="prop">policy</span>);
            {"\n"}<span className="cm">{"// → true (allowlist의 *.openai.com에 매칭)"}</span>
            {"\n"}
            {"\n"}<span className="fn">isHostAllowed</span>(<span className="str">&quot;evil.com&quot;</span>, <span className="prop">policy</span>);
            {"\n"}<span className="cm">{"// → false (어디에도 없으므로 defaultAction: deny)"}</span>
            {"\n"}
            {"\n"}<span className="fn">isHostAllowed</span>(<span className="str">&quot;malicious.example.com&quot;</span>, <span className="prop">policy</span>);
            {"\n"}<span className="cm">{"// → false (denylist에 있으므로 무조건 차단)"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>isHostAllowed()</code>는 판정만 합니다.
            실제로 네트워크 연결을 차단하려면 <code>network-proxy.ts</code>와 함께 사용해야 합니다.
          </Callout>

          {/* 외부 설정 파싱 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 외부 설정에서 정책 파싱
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            JSON 파싱 결과 등 <code className="text-cyan-600">unknown</code> 타입의 값에서
            안전하게 정책을 추출합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// JSON에서 파싱"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">raw</span> = <span className="fn">JSON</span>.<span className="fn">parse</span>(<span className="prop">configFile</span>);
            {"\n"}<span className="kw">const</span> <span className="prop">policy</span> = <span className="fn">parseNetworkPolicy</span>(<span className="prop">raw</span>.<span className="prop">networkPolicy</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 유효하지 않은 입력 → 기본 정책 반환"}</span>
            {"\n"}<span className="fn">parseNetworkPolicy</span>(<span className="kw">null</span>);      <span className="cm">{"// → DEFAULT_NETWORK_POLICY"}</span>
            {"\n"}<span className="fn">parseNetworkPolicy</span>(<span className="kw">undefined</span>); <span className="cm">{"// → DEFAULT_NETWORK_POLICY"}</span>
            {"\n"}<span className="fn">parseNetworkPolicy</span>(<span className="num">42</span>);         <span className="cm">{"// → DEFAULT_NETWORK_POLICY"}</span>
          </CodeBlock>

          {/* 와일드카드 패턴 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 와일드카드 패턴 활용
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">*.도메인</code> 패턴으로 서브도메인 전체를 허용하거나 차단합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">policy</span>: <span className="type">NetworkPolicy</span> = {"{"}
            {"\n"}{"  "}<span className="prop">defaultAction</span>: <span className="str">&quot;deny&quot;</span>,
            {"\n"}{"  "}<span className="prop">allowlist</span>: [<span className="str">&quot;*.openai.com&quot;</span>],
            {"\n"}{"  "}<span className="prop">denylist</span>: [],
            {"\n"}{"}"};
            {"\n"}
            {"\n"}<span className="fn">isHostAllowed</span>(<span className="str">&quot;api.openai.com&quot;</span>, <span className="prop">policy</span>);     <span className="cm">{"// → true"}</span>
            {"\n"}<span className="fn">isHostAllowed</span>(<span className="str">&quot;beta.openai.com&quot;</span>, <span className="prop">policy</span>);    <span className="cm">{"// → true"}</span>
            {"\n"}<span className="fn">isHostAllowed</span>(<span className="str">&quot;openai.com&quot;</span>, <span className="prop">policy</span>);        <span className="cm">{"// → false (서브도메인 필수!)"}</span>
            {"\n"}<span className="fn">isHostAllowed</span>(<span className="str">&quot;not-openai.com&quot;</span>, <span className="prop">policy</span>);    <span className="cm">{"// → false"}</span>
          </CodeBlock>

          <DeepDive title="denylist가 allowlist보다 우선하는 이유">
            <p className="mb-3">
              보안에서 &quot;차단&quot;은 항상 &quot;허용&quot;보다 강력해야 합니다.
              만약 allowlist가 우선한다면, 실수로 악성 도메인을 allowlist에 포함했을 때
              denylist로 차단할 수 없게 됩니다.
            </p>
            <p className="mb-3">
              denylist 우선순위 덕분에 관리자는 allowlist에 <code className="text-cyan-600">*.example.com</code>을
              추가하면서도, 특정 악성 서브도메인은 denylist로 차단할 수 있습니다:
            </p>
            <CodeBlock>
              <span className="prop">allowlist</span>: [<span className="str">&quot;*.example.com&quot;</span>]
              {"\n"}<span className="prop">denylist</span>:  [<span className="str">&quot;evil.example.com&quot;</span>]
              {"\n"}<span className="cm">{"// evil.example.com → 차단 (denylist 우선)"}</span>
              {"\n"}<span className="cm">{"// good.example.com → 허용 (allowlist 매칭)"}</span>
            </CodeBlock>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>정책 평가 플로우</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">isHostAllowed()</code>의 3단계 평가 과정입니다.
          </p>

          <MermaidDiagram
            title="네트워크 정책 평가 플로우"
            titleColor="purple"
            chart={`graph TD
  START(("호스트 확인")) --> EMPTY{"빈 문자열?"}
  EMPTY -->|"예"| DENY_EMPTY["거부"]
  EMPTY -->|"아니오"| DENYLIST{"denylist에<br/>매칭?"}
  DENYLIST -->|"예"| DENY["거부<br/><small>최우선 — 무조건 차단</small>"]
  DENYLIST -->|"아니오"| ALLOWLIST{"allowlist에<br/>매칭?"}
  ALLOWLIST -->|"예"| ALLOW["허용"]
  ALLOWLIST -->|"아니오"| DEFAULT{"defaultAction?"}
  DEFAULT -->|"allow"| ALLOW_DEFAULT["허용<br/><small>기본 허용</small>"]
  DEFAULT -->|"deny"| DENY_DEFAULT["거부<br/><small>기본 차단</small>"]

  style DENY fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px
  style DENY_EMPTY fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style DENY_DEFAULT fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ALLOW fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style ALLOW_DEFAULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>와일드카드 매칭 알고리즘</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">matchesPattern()</code>의 내부 로직입니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">matchesPattern</span>(<span className="prop">host</span>: <span className="type">string</span>, <span className="prop">pattern</span>: <span className="type">string</span>): <span className="type">boolean</span> {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">normalizedHost</span> = <span className="prop">host</span>.<span className="fn">toLowerCase</span>();
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">normalizedPattern</span> = <span className="prop">pattern</span>.<span className="fn">toLowerCase</span>();
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// 와일드카드: *.domain 형식"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">normalizedPattern</span>.<span className="fn">startsWith</span>(<span className="str">&quot;*.&quot;</span>)) {"{"}
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">suffix</span> = <span className="prop">normalizedPattern</span>.<span className="fn">slice</span>(<span className="num">1</span>);
            {"\n"}{"    "}<span className="cm">{"// '.openai.com' → 'api.openai.com' OK"}</span>
            {"\n"}{"    "}<span className="cm">{"// '.openai.com' → 'openai.com' NG (서브도메인 필수)"}</span>
            {"\n"}{"    "}<span className="kw">return</span> <span className="prop">normalizedHost</span>.<span className="fn">endsWith</span>(<span className="prop">suffix</span>)
            {"\n"}{"      "}&& <span className="prop">normalizedHost</span> !== <span className="prop">suffix</span>.<span className="fn">slice</span>(<span className="num">1</span>);
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// 정확한 일치 (대소문자 무시)"}</span>
            {"\n"}{"  "}<span className="kw">return</span> <span className="prop">normalizedHost</span> === <span className="prop">normalizedPattern</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">toLowerCase():</strong> 대소문자 무시를 위해 호스트와 패턴 모두 소문자로 정규화합니다.</p>
            <p><strong className="text-gray-900">slice(1):</strong> <code className="text-cyan-600">*.openai.com</code>에서 <code className="text-cyan-600">.openai.com</code>을 추출하여 접미사 비교합니다.</p>
            <p><strong className="text-gray-900">Object.freeze():</strong> <code className="text-cyan-600">parseNetworkPolicy()</code>의 반환값은 불변 객체로, 정책이 실행 중에 수정되는 것을 방지합니다.</p>
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
              &quot;*.openai.com을 허용했는데 openai.com이 차단돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              와일드카드 <code className="text-cyan-600">*.openai.com</code>은 서브도메인에만 매칭됩니다.
              <code className="text-cyan-600">openai.com</code> 자체를 허용하려면
              allowlist에 <code className="text-cyan-600">&quot;openai.com&quot;</code>도 별도로 추가해야 합니다.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;allowlist에 넣었는데도 차단돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              denylist를 확인하세요. denylist가 allowlist보다 항상 우선합니다.
              해당 호스트가 denylist의 패턴에도 매칭되면 차단됩니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;parseNetworkPolicy()가 기본 정책만 반환해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              입력 값의 형식을 확인하세요. 다음 조건을 만족해야 합니다:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-1 list-disc list-inside">
              <li>입력이 <code className="text-cyan-600">object</code> 타입이어야 합니다 (null, undefined, 숫자, 문자열 불가)</li>
              <li><code className="text-cyan-600">defaultAction</code>은 <code className="text-cyan-600">&quot;allow&quot;</code> 또는 <code className="text-cyan-600">&quot;deny&quot;</code>만 허용</li>
              <li><code className="text-cyan-600">allowlist</code>/<code className="text-cyan-600">denylist</code>는 문자열 배열이어야 합니다</li>
            </ul>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;isHostAllowed()만으로 네트워크가 차단되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">isHostAllowed()</code>는 순수한 판정 함수입니다.
              실제 네트워크 차단은 <code className="text-cyan-600">network-proxy.ts</code>의
              HTTP 프록시가 수행합니다. 반드시 함께 사용해야 합니다.
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
                name: "network-proxy.ts",
                slug: "sandbox-network-proxy",
                relation: "sibling",
                desc: "네트워크 프록시 — 정책을 실제로 적용하는 HTTP 프록시 서버",
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
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
