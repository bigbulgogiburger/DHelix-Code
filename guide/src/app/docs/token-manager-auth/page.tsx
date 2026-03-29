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

export default function TokenManagerAuthPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/auth/token-manager.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">TokenManager</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              API 토큰의 해석, 캐싱, 제공을 담당하는 모듈입니다. 환경 변수나 파일에서 토큰을 찾아
              메모리에 캐시하고, HTTP 인증 헤더로 변환합니다.
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
                <code className="text-cyan-600">TokenManager</code>는 토큰 저장소(token-store.ts)의
                상위 추상화 계층입니다. 토큰의 생명주기를 3단계로 관리합니다: 해석(Resolve) &rarr;
                캐싱(Cache) &rarr; 제공(Provide).
              </p>
              <p>
                LLM 클라이언트가 API를 호출할 때마다{" "}
                <code className="text-cyan-600">getAuthHeaders()</code>를 통해 인증 헤더를
                가져옵니다. 캐시가 있으면 파일 I/O 없이 즉시 반환하고, 없으면 환경 변수 &rarr; 자격
                증명 파일 순서로 토큰을 찾습니다.
              </p>
              <p>
                Bearer, API-Key, Custom-Header 세 가지 인증 방식을 지원하며, 토큰이 설정되지 않으면{" "}
                <code className="text-cyan-600">AuthError</code>를 발생시킵니다.
              </p>
            </div>

            <MermaidDiagram
              title="TokenManager 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  LLM["LLM Client<br/><small>llm/client.ts</small>"]
  TM["TokenManager<br/><small>auth/token-manager.ts</small>"]
  TS["Token Store<br/><small>auth/token-store.ts</small>"]
  ENV["환경 변수<br/><small>DHELIX_API_KEY</small>"]
  FILE["자격 증명 파일<br/><small>~/.dhelix/credentials.json</small>"]
  CACHE["메모리 캐시<br/><small>cachedToken</small>"]

  LLM -->|"getAuthHeaders()"| TM
  TM -->|"캐시 미스"| TS
  TM -->|"캐시 히트"| CACHE
  TS -->|"우선순위 1"| ENV
  TS -->|"우선순위 2"| FILE

  style TM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style LLM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TS fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style ENV fill:#dcfce7,stroke:#10b981,color:#065f46
  style FILE fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style CACHE fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>설계 원칙:</strong> TokenManager는 토큰의 &quot;어디서 왔는지&quot;(환경 변수
              vs 파일)를 추상화합니다. LLM 클라이언트는 토큰 출처를 알 필요 없이{" "}
              <code>getAuthHeaders()</code>만 호출하면 됩니다.
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

            {/* class TokenManager */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class TokenManager
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              API 토큰의 해석, 캐싱, 인증 헤더 변환을 담당하는 클래스입니다.
            </p>

            {/* getToken */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getToken()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              현재 API 토큰을 가져옵니다. 캐시가 있으면 캐시를 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">getToken</span>():{" "}
              <span className="type">Promise&lt;ResolvedToken | undefined&gt;</span>
            </CodeBlock>

            {/* requireToken */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">requireToken()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              토큰을 가져오되, 없으면 <code className="text-cyan-600">AuthError</code>를 던집니다.
              API 호출 직전처럼 토큰이 반드시 필요한 상황에서 사용합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">requireToken</span>():{" "}
              <span className="type">Promise&lt;ResolvedToken&gt;</span>
              {"\n"}
              <span className="cm">// throws AuthError: "No API token configured..."</span>
            </CodeBlock>

            {/* setToken */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">setToken(config)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              새로운 토큰을 자격 증명 파일에 저장하고 캐시를 즉시 업데이트합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">setToken</span>(
              <span className="prop">config</span>: <span className="type">TokenConfig</span>):{" "}
              <span className="type">Promise&lt;void&gt;</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "config",
                  type: "TokenConfig",
                  required: true,
                  desc: "저장할 토큰 설정 (method, token, headerName?)",
                },
              ]}
            />

            {/* clearCache */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">clearCache()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              캐시된 토큰을 초기화합니다. 다음 <code className="text-cyan-600">getToken()</code>{" "}
              호출 시 환경 변수와 파일에서 다시 해석합니다.
            </p>
            <CodeBlock>
              <span className="fn">clearCache</span>(): <span className="type">void</span>
            </CodeBlock>

            {/* getAuthHeaders */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getAuthHeaders()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              현재 토큰을 HTTP 인증 헤더 형태로 변환합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">getAuthHeaders</span>():{" "}
              <span className="type">Promise&lt;Record&lt;string, string&gt;&gt;</span>
            </CodeBlock>
            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-3 text-[13px] text-gray-600 space-y-2">
              <p>
                &bull; <code className="text-cyan-600">bearer</code> &rarr;{" "}
                <code>{`{ "Authorization": "Bearer sk-..." }`}</code>
              </p>
              <p>
                &bull; <code className="text-cyan-600">api-key</code> &rarr;{" "}
                <code>{`{ "X-API-Key": "sk-..." }`}</code>
              </p>
              <p>
                &bull; <code className="text-cyan-600">custom-header</code> &rarr;{" "}
                <code>{`{ "<headerName>": "sk-..." }`}</code>
              </p>
              <p>
                &bull; 토큰 없음 &rarr; <code>{`{}`}</code> (빈 객체)
              </p>
            </div>

            {/* Related types */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              관련 타입 (auth/types.ts)
            </h3>
            <ParamTable
              params={[
                {
                  name: "AuthMethod",
                  type: '"bearer" | "api-key" | "custom-header"',
                  required: true,
                  desc: "인증 방법 타입",
                },
                {
                  name: "TokenConfig",
                  type: "{ method, token, headerName? }",
                  required: true,
                  desc: "토큰 설정 객체",
                },
                {
                  name: "TokenSource",
                  type: '"environment" | "file" | "keychain" | "config"',
                  required: true,
                  desc: "토큰 출처",
                },
                {
                  name: "ResolvedToken",
                  type: "{ config, source, expiresAt? }",
                  required: true,
                  desc: "해석된 토큰 (설정 + 메타데이터)",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                캐시가 있으면 파일/환경 변수 변경을 감지하지 않습니다. 환경 변수를 변경한 후에는{" "}
                <code className="text-cyan-600">clearCache()</code>를 호출하세요.
              </li>
              <li>
                <code className="text-cyan-600">getAuthHeaders()</code>는 토큰이 없으면 빈 객체를
                반환합니다. 에러를 던지지 않으므로, 토큰이 반드시 필요하면{" "}
                <code className="text-cyan-600">requireToken()</code>을 사용하세요.
              </li>
              <li>
                <code className="text-cyan-600">setToken()</code>은 파일에 저장하면서 캐시도
                업데이트합니다. 파일 저장이 실패하면{" "}
                <code className="text-cyan-600">AuthError</code>가 발생합니다.
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
              기본 사용법 &mdash; API 호출에 인증 헤더 추가
            </h3>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">manager</span> ={" "}
              <span className="kw">new</span> <span className="fn">TokenManager</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 인증 헤더 가져오기"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">headers</span> ={" "}
              <span className="kw">await</span> <span className="prop">manager</span>.
              <span className="fn">getAuthHeaders</span>();
              {"\n"}
              <span className="cm">{'// → { "Authorization": "Bearer sk-..." }'}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// HTTP 요청에 헤더 추가"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">response</span> ={" "}
              <span className="kw">await</span> <span className="fn">fetch</span>(
              <span className="prop">url</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">headers</span>: {"{"} ...<span className="prop">headers</span>,{" "}
              <span className="str">&quot;Content-Type&quot;</span>:{" "}
              <span className="str">&quot;application/json&quot;</span> {"}"},{"\n"}
              {"}"});
            </CodeBlock>

            {/* 토큰 필수 확인 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              토큰 필수 확인
            </h3>
            <CodeBlock>
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">token</span> ={" "}
              <span className="kw">await</span> <span className="prop">manager</span>.
              <span className="fn">requireToken</span>();
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">`출처: ${"{"}</span>
              <span className="prop">token</span>.<span className="prop">source</span>
              <span className="str">{"}"}`</span>);{" "}
              <span className="cm">{'// "environment" 또는 "file"'}</span>
              {"\n"}
              {"}"} <span className="kw">catch</span> (<span className="prop">e</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{'// AuthError: "No API token configured..."'}</span>
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">&quot;dhelix auth 명령으로 토큰을 설정하세요&quot;</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>getToken()</code>은 토큰이 없으면 <code>undefined</code>
              를 반환하고 에러를 던지지 않습니다. API 호출 직전에는 반드시
              <code>requireToken()</code>을 사용하세요.
            </Callout>

            {/* 토큰 저장 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 토큰 저장과 캐시 관리
            </h3>
            <CodeBlock>
              <span className="cm">{"// 새 토큰 저장 (파일 + 캐시 동시 업데이트)"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="prop">manager</span>.
              <span className="fn">setToken</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">method</span>: <span className="str">&quot;bearer&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">token</span>:{" "}
              <span className="str">&quot;sk-new-token-value&quot;</span>,{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 환경 변수 변경 후 캐시 초기화"}</span>
              {"\n"}
              <span className="prop">manager</span>.<span className="fn">clearCache</span>();
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 환경 변수(<code>DHELIX_API_KEY</code>)가 설정되어 있으면 파일보다
              우선합니다. CI/CD 환경에서는 환경 변수를, 로컬 개발에서는
              <code>dhelix auth</code> 명령(파일 저장)을 사용하세요.
            </Callout>
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
              토큰 해석 흐름
            </h3>

            <MermaidDiagram
              title="토큰 해석 및 캐싱 흐름"
              titleColor="purple"
              chart={`sequenceDiagram
  participant Client as LLM Client
  participant TM as TokenManager
  participant Cache as 메모리 캐시
  participant Store as Token Store
  participant Env as 환경 변수
  participant File as credentials.json

  Client->>TM: getAuthHeaders()
  TM->>Cache: cachedToken?
  alt 캐시 히트
    Cache-->>TM: ResolvedToken
  else 캐시 미스
    TM->>Store: resolveToken()
    Store->>Env: DHELIX_API_KEY / OPENAI_API_KEY
    alt 환경 변수 존재
      Env-->>Store: TokenConfig
      Store-->>TM: {config, source: "environment"}
    else 환경 변수 없음
      Store->>File: ~/.dhelix/credentials.json
      File-->>Store: TokenConfig 또는 undefined
      Store-->>TM: {config, source: "file"} 또는 undefined
    end
    TM->>Cache: 캐시 저장
  end
  TM-->>Client: {"Authorization": "Bearer ..."}`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              인증 헤더 변환 로직
            </h3>
            <CodeBlock>
              <span className="kw">switch</span> (<span className="prop">token</span>.
              <span className="prop">config</span>.<span className="prop">method</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">case</span> <span className="str">&quot;bearer&quot;</span>:
              {"\n"}
              {"    "}
              <span className="kw">return</span> {"{"} <span className="prop">Authorization</span>:{" "}
              <span className="str">`Bearer ${"{"}</span>
              <span className="prop">token</span>.<span className="prop">config</span>.
              <span className="prop">token</span>
              <span className="str">{"}"}`</span> {"}"};{"\n"}
              {"  "}
              <span className="kw">case</span> <span className="str">&quot;api-key&quot;</span>:
              {"\n"}
              {"    "}
              <span className="kw">return</span> {"{"}{" "}
              <span className="str">&quot;X-API-Key&quot;</span>:{" "}
              <span className="prop">token</span>.<span className="prop">config</span>.
              <span className="prop">token</span> {"}"};{"\n"}
              {"  "}
              <span className="kw">case</span>{" "}
              <span className="str">&quot;custom-header&quot;</span>:{"\n"}
              {"    "}
              <span className="kw">return</span> {"{"} [<span className="prop">token</span>.
              <span className="prop">config</span>.<span className="prop">headerName</span> ??{" "}
              <span className="str">&quot;Authorization&quot;</span>]:{" "}
              <span className="prop">token</span>.<span className="prop">config</span>.
              <span className="prop">token</span> {"}"};{"\n"}
              {"}"}
            </CodeBlock>

            <DeepDive title="캐시 전략: undefined vs null 구분">
              <p className="mb-3">
                <code className="text-cyan-600">cachedToken</code>의 상태는 두 가지입니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <code className="text-cyan-600">undefined</code> &mdash; 아직 토큰을 해석하지
                  않았거나 캐시가 초기화된 상태
                </li>
                <li>
                  <code className="text-cyan-600">ResolvedToken</code> &mdash; 토큰이 해석되어
                  캐시된 상태
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                주의: 토큰이 없는 경우(resolveToken()이 undefined 반환) 캐시가 설정되지 않아 매번
                파일/환경 변수를 다시 확인합니다. 이는 의도적인 설계로, 사용자가 토큰을 설정한 후
                즉시 반영되도록 합니다.
              </p>
            </DeepDive>
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

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;No API token configured 에러가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                환경 변수(<code className="text-cyan-600">DHELIX_API_KEY</code> 또는
                <code className="text-cyan-600">OPENAI_API_KEY</code>)를 설정하거나,
                <code className="text-cyan-600">dhelix auth</code> 명령으로 토큰을 저장하세요.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;환경 변수를 바꿨는데 이전 토큰이 사용돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                TokenManager는 한 번 해석된 토큰을 메모리에 캐시합니다. 환경 변수 변경 후에는{" "}
                <code className="text-cyan-600">clearCache()</code>를 호출하거나, dhelix를
                재시작하세요.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;커스텀 헤더 이름을 사용하고 싶어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">setToken()</code>에{" "}
                <code className="text-cyan-600">method: &quot;custom-header&quot;</code>와
                <code className="text-cyan-600">headerName</code>을 지정하세요. 예:{" "}
                <code>{`{ method: "custom-header", token: "...", headerName: "X-My-Auth" }`}</code>
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
                  name: "token-store.ts",
                  slug: "token-store",
                  relation: "child",
                  desc: "토큰을 환경 변수와 파일에서 로드하고 저장하는 저수준 모듈",
                },
                {
                  name: "llm-client.ts",
                  slug: "llm-client",
                  relation: "parent",
                  desc: "API 호출 시 getAuthHeaders()로 인증 헤더를 가져옵니다",
                },
                {
                  name: "error.ts",
                  slug: "utils-error",
                  relation: "child",
                  desc: "토큰 미설정 시 AuthError를 발생시킵니다",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
