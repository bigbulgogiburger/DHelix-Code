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

export default function MCPOAuthPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/mcp/oauth.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">MCPOAuthManager</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              외부 MCP 서버 인증을 위한 OAuth 2.0 Authorization Code Flow 구현 모듈입니다.
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
                <code className="text-cyan-600">MCPOAuthManager</code>는 OAuth 2.0
                &quot;Authorization Code Flow&quot;를 구현합니다. 사용자가 비밀번호를 직접 제공하지
                않고도 외부 MCP 서버에 안전하게 인증할 수 있습니다. 인증 URL을 생성하고, 로컬 콜백
                서버로 인증 코드를 수신하며, 토큰을 교환합니다.
              </p>
              <p>
                발급된 토큰은 메모리에 캐시하고 디스크 (
                <code className="text-cyan-600">~/.dhelix/oauth-tokens/</code>)에 영속 저장합니다.
                프로그램 재시작 시 디스크에서 토큰을 로드하여 재인증을 방지합니다. 액세스 토큰이
                만료되면 리프레시 토큰으로 자동 갱신합니다.
              </p>
              <p>
                보안 기능으로 <code className="text-cyan-600">state</code> 파라미터를 사용한 CSRF
                공격 방지, 60초 만료 버퍼(실제 만료 전에 갱신 시도), 5분 콜백 타임아웃을 제공합니다.
              </p>
            </div>

            <MermaidDiagram
              title="OAuth 2.0 Authorization Code Flow"
              titleColor="purple"
              chart={`graph TD
  USER["사용자"] -->|"1. authorize() 호출"| MGR["MCPOAuthManager"]
  MGR -->|"2. 인증 URL 생성"| BROWSER["브라우저<br/><small>인증 서버 페이지</small>"]
  BROWSER -->|"3. 사용자 승인 후<br/>코드 리다이렉트"| CALLBACK["로컬 콜백 서버<br/><small>localhost:8912</small>"]
  CALLBACK -->|"4. 인증 코드 전달"| MGR
  MGR -->|"5. 코드 → 토큰 교환"| AUTH["인증 서버<br/><small>토큰 엔드포인트</small>"]
  AUTH -->|"6. 토큰 발급"| MGR
  MGR -->|"7. 저장"| DISK["디스크 저장<br/><small>~/.dhelix/oauth-tokens/</small>"]

  style MGR fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style USER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style BROWSER fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style CALLBACK fill:#dcfce7,stroke:#10b981,color:#1e293b
  style AUTH fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style DISK fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 호텔 체크인을 떠올리세요. 직접 방 열쇠를 만들지 않고, 프런트
              데스크(인증 서버)에서 신분증(인증 코드)을 확인한 뒤 카드키(액세스 토큰)를
              발급받습니다. 카드키가 만료되면 프런트에 갱신을 요청합니다(리프레시 토큰).
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

            {/* MCPOAuthConfig */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface MCPOAuthConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              MCP 서버에 대한 OAuth 2.0 설정입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "clientId",
                  type: "string",
                  required: true,
                  desc: "클라이언트 ID — 인증 서버에 등록된 애플리케이션 식별자",
                },
                {
                  name: "clientSecret",
                  type: "string",
                  required: false,
                  desc: "클라이언트 시크릿 — 공개 클라이언트는 생략 가능",
                },
                {
                  name: "authorizationUrl",
                  type: "string",
                  required: true,
                  desc: "인증 URL — 사용자를 인증 페이지로 보낼 때 사용",
                },
                {
                  name: "tokenUrl",
                  type: "string",
                  required: true,
                  desc: "토큰 URL — 인증 코드를 토큰으로 교환할 때 사용",
                },
                {
                  name: "scopes",
                  type: "readonly string[]",
                  required: false,
                  desc: '요청할 권한 범위 (예: ["read", "write"])',
                },
                {
                  name: "redirectPort",
                  type: "number",
                  required: false,
                  desc: "로컬 콜백 서버 포트 (기본: 8912)",
                },
              ]}
            />

            {/* OAuthToken */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface OAuthToken
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              인증 서버로부터 발급받은 토큰 정보입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "accessToken",
                  type: "string",
                  required: true,
                  desc: "액세스 토큰 — API 요청 시 Authorization 헤더에 포함",
                },
                {
                  name: "refreshToken",
                  type: "string",
                  required: false,
                  desc: "리프레시 토큰 — 액세스 토큰 만료 시 갱신에 사용",
                },
                {
                  name: "expiresAt",
                  type: "number",
                  required: false,
                  desc: "만료 시각 (Unix ms) — undefined면 만료되지 않는 토큰",
                },
                {
                  name: "tokenType",
                  type: "string",
                  required: true,
                  desc: '토큰 타입 — 보통 "Bearer"',
                },
                { name: "scope", type: "string", required: false, desc: "허용된 권한 범위" },
              ]}
            />

            {/* MCPOAuthManager class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class MCPOAuthManager
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              MCP 서버에 대한 OAuth 2.0 인증 흐름을 관리하는 메인 클래스입니다.
            </p>

            {/* authorize */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              authorize(serverName, config)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              전체 Authorization Code Flow를 실행합니다: 인증 URL 생성 &rarr; 콜백 서버 시작 &rarr;
              토큰 교환 &rarr; 저장.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">authorize</span>(
              <span className="prop">serverName</span>: <span className="type">string</span>,{" "}
              <span className="prop">config</span>: <span className="type">MCPOAuthConfig</span>):{" "}
              <span className="type">Promise</span>&lt;<span className="type">OAuthToken</span>&gt;
            </CodeBlock>

            {/* getAccessToken */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              getAccessToken(serverName, config)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              유효한 액세스 토큰을 반환합니다. 메모리 &rarr; 디스크 &rarr; 리프레시 순서로
              조회합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">getAccessToken</span>(
              <span className="prop">serverName</span>: <span className="type">string</span>,{" "}
              <span className="prop">config</span>: <span className="type">MCPOAuthConfig</span>):{" "}
              <span className="type">Promise</span>&lt;<span className="type">string</span> |{" "}
              <span className="type">null</span>&gt;
            </CodeBlock>

            {/* isTokenExpired */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">isTokenExpired(token)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              토큰이 만료되었는지 확인합니다. 60초 버퍼를 적용합니다.
            </p>
            <CodeBlock>
              <span className="fn">isTokenExpired</span>(<span className="prop">token</span>:{" "}
              <span className="type">OAuthToken</span>): <span className="type">boolean</span>
            </CodeBlock>

            {/* refreshToken */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              refreshToken(serverName, config, refreshTokenValue)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              리프레시 토큰을 사용하여 만료된 액세스 토큰을 갱신합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">refreshToken</span>({"\n"}
              {"  "}
              <span className="prop">serverName</span>: <span className="type">string</span>,{"\n"}
              {"  "}
              <span className="prop">config</span>: <span className="type">MCPOAuthConfig</span>,
              {"\n"}
              {"  "}
              <span className="prop">refreshTokenValue</span>: <span className="type">string</span>
              {"\n"}): <span className="type">Promise</span>&lt;
              <span className="type">OAuthToken</span>&gt;
            </CodeBlock>

            {/* exchangeCode */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              exchangeCode(code, config, redirectUri)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              인증 코드를 액세스 토큰으로 교환합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">exchangeCode</span>(
              <span className="prop">code</span>: <span className="type">string</span>,{" "}
              <span className="prop">config</span>: <span className="type">MCPOAuthConfig</span>,{" "}
              <span className="prop">redirectUri</span>: <span className="type">string</span>):{" "}
              <span className="type">Promise</span>&lt;<span className="type">OAuthToken</span>&gt;
            </CodeBlock>

            {/* saveToken / loadToken / revokeToken */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              saveToken() / loadToken() / revokeToken()
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">토큰의 디스크 영속화를 관리합니다.</p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">saveToken</span>(
              <span className="prop">serverName</span>: <span className="type">string</span>,{" "}
              <span className="prop">token</span>: <span className="type">OAuthToken</span>):{" "}
              <span className="type">Promise</span>&lt;<span className="type">void</span>&gt;
              {"\n"}
              <span className="kw">async</span> <span className="fn">loadToken</span>(
              <span className="prop">serverName</span>: <span className="type">string</span>):{" "}
              <span className="type">Promise</span>&lt;<span className="type">OAuthToken</span> |{" "}
              <span className="type">null</span>&gt;
              {"\n"}
              <span className="kw">async</span> <span className="fn">revokeToken</span>(
              <span className="prop">serverName</span>: <span className="type">string</span>):{" "}
              <span className="type">Promise</span>&lt;<span className="type">void</span>&gt;
            </CodeBlock>

            {/* buildAuthorizationUrl */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              buildAuthorizationUrl(config, state, redirectUri)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              완성된 인증 URL을 쿼리 파라미터와 함께 생성합니다.
            </p>
            <CodeBlock>
              <span className="fn">buildAuthorizationUrl</span>(<span className="prop">config</span>
              : <span className="type">MCPOAuthConfig</span>, <span className="prop">state</span>:{" "}
              <span className="type">string</span>, <span className="prop">redirectUri</span>:{" "}
              <span className="type">string</span>): <span className="type">string</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                콜백 서버는 기본 포트 <code className="text-cyan-600">8912</code>를 사용합니다. 해당
                포트가 이미 사용 중이면 <code className="text-cyan-600">MCPOAuthError</code>가
                발생합니다.
                <code className="text-cyan-600">redirectPort</code>로 다른 포트를 지정하세요.
              </li>
              <li>
                콜백 대기 타임아웃은 5분(300초)입니다. 사용자가 시간 내에 브라우저에서 인증하지
                않으면 타임아웃 에러가 발생합니다.
              </li>
              <li>
                토큰 만료 판정에 60초 버퍼를 적용합니다. 실제 만료 60초 전에 &quot;만료됨&quot;으로
                간주하여 갱신을 시도합니다.
              </li>
              <li>
                리프레시 토큰이 없는 상태에서 액세스 토큰이 만료되면
                <code className="text-cyan-600">getAccessToken()</code>이{" "}
                <code className="text-cyan-600">null</code>을 반환합니다. 재인증(
                <code className="text-cyan-600">authorize()</code>)이 필요합니다.
              </li>
              <li>
                토큰 파일은{" "}
                <code className="text-cyan-600">
                  ~/.dhelix/oauth-tokens/{"{"}서버이름{"}"}.json
                </code>
                에 저장됩니다. 이 디렉토리의 권한을 적절히 관리하세요.
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
              기본 사용법 &mdash; 전체 인증 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">authorize()</code>를 호출하면 전체 OAuth 흐름이
              자동으로 실행됩니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">oauthManager</span> ={" "}
              <span className="kw">new</span> <span className="fn">MCPOAuthManager</span>();
              {"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">config</span>:{" "}
              <span className="type">MCPOAuthConfig</span> = {"{"}
              {"\n"}
              {"  "}
              <span className="prop">clientId</span>:{" "}
              <span className="str">&quot;my-client-id&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">authorizationUrl</span>:{" "}
              <span className="str">&quot;https://auth.example.com/authorize&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">tokenUrl</span>:{" "}
              <span className="str">&quot;https://auth.example.com/token&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">scopes</span>: [<span className="str">&quot;read&quot;</span>,{" "}
              <span className="str">&quot;write&quot;</span>],
              {"\n"}
              {"}"};{"\n"}
              {"\n"}
              <span className="cm">
                {"// 전체 흐름 실행: URL 출력 → 브라우저 인증 → 토큰 발급"}
              </span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">token</span> ={" "}
              <span className="kw">await</span> <span className="prop">oauthManager</span>.
              <span className="fn">authorize</span>(
              <span className="str">&quot;my-server&quot;</span>,{" "}
              <span className="prop">config</span>);
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">&quot;인증 완료:&quot;</span>,{" "}
              <span className="prop">token</span>.<span className="prop">tokenType</span>);
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>authorize()</code>는 사용자가 브라우저에서 인증을 완료할
              때까지 대기합니다 (최대 5분). CLI 환경에서 브라우저가 열리지 않으면 출력된 URL을
              수동으로 복사하여 브라우저에 붙여넣으세요.
            </Callout>

            {/* 토큰 조회 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 캐시된 토큰 사용
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              이미 인증이 완료된 경우, <code className="text-cyan-600">getAccessToken()</code>으로
              유효한 토큰을 가져옵니다. 만료 시 자동으로 갱신합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">accessToken</span> ={" "}
              <span className="kw">await</span> <span className="prop">oauthManager</span>.
              <span className="fn">getAccessToken</span>(
              <span className="str">&quot;my-server&quot;</span>,{" "}
              <span className="prop">config</span>);
              {"\n"}
              {"\n"}
              <span className="kw">if</span> (<span className="prop">accessToken</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// 유효한 토큰으로 API 요청"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">headers</span> = {"{"}{" "}
              <span className="str">&quot;Authorization&quot;</span>:{" "}
              <span className="str">`Bearer ${"{"}</span>
              <span className="prop">accessToken</span>
              <span className="str">{"}"}`</span> {"}"};{"\n"}
              {"}"} <span className="kw">else</span> {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// 토큰 없음 → 재인증 필요"}</span>
              {"\n"}
              {"  "}
              <span className="kw">await</span> <span className="prop">oauthManager</span>.
              <span className="fn">authorize</span>(
              <span className="str">&quot;my-server&quot;</span>,{" "}
              <span className="prop">config</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* 토큰 철회 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 토큰 철회
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              서버와의 연결을 해제할 때 토큰을 메모리와 디스크에서 모두 제거합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 토큰 삭제 (메모리 + 디스크)"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="prop">oauthManager</span>.
              <span className="fn">revokeToken</span>(
              <span className="str">&quot;my-server&quot;</span>);
              {"\n"}
              <span className="cm">{"// ~/.dhelix/oauth-tokens/my-server.json 파일도 삭제됨"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>loadToken()</code>은 파일이 없거나 유효하지 않은 형식이면
              <code>null</code>을 반환합니다. 에러를 던지지 않으므로 안전하게 호출할 수 있습니다.
            </Callout>

            <DeepDive title="토큰 조회 우선순위 (getAccessToken)">
              <p className="mb-3">
                <code className="text-cyan-600">getAccessToken()</code>은 다음 순서로 토큰을
                찾습니다:
              </p>
              <div className="text-[13px] text-gray-600 space-y-2">
                <p>
                  <strong className="text-gray-900">1. 메모리 캐시</strong> &mdash; Map에서 즉시
                  조회합니다. 가장 빠릅니다.
                </p>
                <p>
                  <strong className="text-gray-900">2. 디스크 로드</strong> &mdash; 메모리에 없으면{" "}
                  <code className="text-cyan-600">~/.dhelix/oauth-tokens/</code>에서 읽습니다.
                </p>
                <p>
                  <strong className="text-gray-900">3. 만료 확인</strong> &mdash; 토큰을 찾았으면
                  만료 여부를 확인합니다 (60초 버퍼).
                </p>
                <p>
                  <strong className="text-gray-900">4. 리프레시</strong> &mdash; 만료되었고 리프레시
                  토큰이 있으면 자동 갱신합니다.
                </p>
                <p>
                  <strong className="text-gray-900">5. null 반환</strong> &mdash; 토큰이 없거나,
                  만료 + 리프레시 불가이면 <code className="text-cyan-600">null</code>입니다.
                </p>
              </div>
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
              토큰 수명주기 상태 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              토큰은 발급 &rarr; 유효 &rarr; 만료 &rarr; 갱신/재인증의 수명주기를 가집니다.
            </p>

            <MermaidDiagram
              title="토큰 수명주기"
              titleColor="purple"
              chart={`graph TD
  NONE["토큰 없음"] -->|"authorize()"| VALID["유효<br/><small>accessToken 사용 가능</small>"]
  VALID -->|"시간 경과"| EXPCHK{"만료<br/>확인"}
  EXPCHK -->|"유효"| VALID
  EXPCHK -->|"만료<br/>(60초 버퍼)"| EXPIRED["만료됨"]
  EXPIRED -->|"refreshToken<br/>있음"| REFRESH["갱신 시도"]
  EXPIRED -->|"refreshToken<br/>없음"| NONE
  REFRESH -->|"성공"| VALID
  REFRESH -->|"실패"| NONE
  VALID -->|"revokeToken()"| NONE

  style NONE fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style VALID fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style EXPIRED fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style REFRESH fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              콜백 서버 핵심 코드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              로컬 HTTP 서버에서 인증 코드를 수신하는 핵심 로직입니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">server</span> ={" "}
              <span className="fn">createServer</span>((<span className="prop">req</span>,{" "}
              <span className="prop">res</span>) ={">"} {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">url</span> ={" "}
              <span className="kw">new</span> <span className="fn">URL</span>(
              <span className="prop">req</span>.<span className="prop">url</span>,{" "}
              <span className="str">`http://localhost:${"{"}</span>
              <span className="prop">port</span>
              <span className="str">{"}"}`</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// /callback 외의 경로는 404"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">url</span>.
              <span className="prop">pathname</span> !=={" "}
              <span className="str">&quot;/callback&quot;</span>) <span className="kw">return</span>
              ;{"\n"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">code</span> ={" "}
              <span className="prop">url</span>.<span className="prop">searchParams</span>.
              <span className="fn">get</span>(<span className="str">&quot;code&quot;</span>);
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">state</span> ={" "}
              <span className="prop">url</span>.<span className="prop">searchParams</span>.
              <span className="fn">get</span>(<span className="str">&quot;state&quot;</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// CSRF 방지: state 검증"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">state</span> !=={" "}
              <span className="prop">expectedState</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="fn">reject</span>(<span className="kw">new</span>{" "}
              <span className="fn">MCPOAuthError</span>(
              <span className="str">&quot;state mismatch&quot;</span>));
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="fn">resolve</span>({"{"} <span className="prop">code</span>,{" "}
              <span className="prop">server</span> {"}"});
              {"\n"}
              {"}"});
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">state 파라미터</strong> &mdash;{" "}
                <code className="text-cyan-600">randomUUID()</code>로 생성된 랜덤 값입니다. 인증
                요청 시 보내고, 콜백에서 돌아온 값과 비교하여 CSRF 공격을 방지합니다.
              </p>
              <p>
                <strong className="text-gray-900">expires_in → expiresAt</strong> &mdash; 인증
                서버가 보내는 <code className="text-cyan-600">expires_in</code>(초 단위)을{" "}
                <code className="text-cyan-600">Date.now() + expires_in * 1000</code>으로 변환하여
                절대 만료 시각(ms)으로 저장합니다.
              </p>
              <p>
                <strong className="text-gray-900">리프레시 토큰 보존</strong> &mdash; 토큰 갱신 시
                서버가 새 리프레시 토큰을 발급하지 않으면 기존 리프레시 토큰을 유지합니다.
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
                &quot;OAuth callback timed out&quot; 에러가 발생해요
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                5분 내에 브라우저에서 인증을 완료하지 않으면 타임아웃이 발생합니다. 출력된 인증
                URL을 브라우저에 복사하여 열고, 인증 서버에서 승인을 완료하세요. 방화벽이 로컬
                포트(8912)를 차단하고 있는지도 확인하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Failed to start OAuth callback server&quot; 에러
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                포트 <code className="text-cyan-600">8912</code>가 이미 사용 중입니다. 다른
                프로세스가 해당 포트를 점유하고 있는지 확인하세요.
                <code className="text-cyan-600">redirectPort</code>를 다른 값으로 변경하여 해결할 수
                있습니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;토큰이 계속 만료돼서 매번 재인증해야 해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                두 가지 원인이 가능합니다:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  인증 서버가 <code className="text-cyan-600">refresh_token</code>을 발급하지 않을
                  수 있습니다. 인증 서버의 설정에서 리프레시 토큰 발급을 확인하세요.
                </li>
                <li>
                  토큰 파일(<code className="text-cyan-600">~/.dhelix/oauth-tokens/</code>)의 쓰기
                  권한이 없으면 디스크에 저장되지 않아, 프로그램 재시작 시 토큰이 사라집니다.
                </li>
              </ul>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Authorization denied by user&quot; 에러
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                사용자가 인증 서버에서 &quot;거부&quot; 버튼을 클릭했습니다. 인증을 다시 시도하고,
                요청된 권한 범위(<code className="text-cyan-600">scopes</code>)가 적절한지
                확인하세요.
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
                  name: "mcp/manager-connector.ts",
                  slug: "mcp-manager-connector",
                  relation: "parent",
                  desc: "OAuthManager를 생성하고 서버 연결 시 토큰을 확인하는 오케스트레이터",
                },
                {
                  name: "mcp/manager.ts",
                  slug: "mcp-manager",
                  relation: "sibling",
                  desc: "MCP 서버 연결을 담당 — OAuth가 필요한 서버에 토큰을 헤더로 전달",
                },
                {
                  name: "mcp/managed-config.ts",
                  slug: "mcp-managed-config",
                  relation: "sibling",
                  desc: "관리자 정책 설정 — 서버별 인증 요구사항을 중앙에서 관리",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
