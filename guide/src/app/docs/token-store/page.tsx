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

export default function TokenStorePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/auth/token-store.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Token Store</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              API 토큰을 환경 변수와 자격 증명 파일에서 로드하고 저장하는 영속 저장소 모듈입니다.
              파일 권한 0o600으로 보안을 보장합니다.
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
                <code className="text-cyan-600">token-store</code>는 API 토큰을 두 가지 소스에서
                관리합니다: 환경 변수(<code className="text-cyan-600">DHELIX_API_KEY</code>,{" "}
                <code className="text-cyan-600">OPENAI_API_KEY</code>)와 자격 증명 파일(
                <code className="text-cyan-600">~/.dhelix/credentials.json</code>).
              </p>
              <p>
                환경 변수가 최우선입니다. CI/CD 파이프라인이나 Docker 환경에서 파일 없이 토큰을
                주입할 수 있어 보안적으로 우수합니다. 로컬 개발에서는 자격 증명 파일을 사용합니다.
              </p>
              <p>
                토큰 파일은 Unix 파일 권한 <code className="text-cyan-600">0o600</code>(소유자만
                읽기/쓰기)으로 저장되어 다른 사용자가 토큰을 읽을 수 없습니다.
              </p>
            </div>

            <MermaidDiagram
              title="토큰 해석 우선순위"
              titleColor="purple"
              chart={`graph TD
  RESOLVE["resolveToken()"]
  ENV{"환경 변수<br/>DHELIX_API_KEY<br/>OPENAI_API_KEY"}
  FILE{"자격 증명 파일<br/>~/.dhelix/credentials.json"}
  RESULT_ENV["ResolvedToken<br/><small>source: environment</small>"]
  RESULT_FILE["ResolvedToken<br/><small>source: file</small>"]
  NONE["undefined<br/><small>토큰 없음</small>"]

  RESOLVE -->|"우선순위 1"| ENV
  ENV -->|"존재"| RESULT_ENV
  ENV -->|"없음"| FILE
  FILE -->|"존재 + 유효"| RESULT_FILE
  FILE -->|"없음 / 파싱 실패"| NONE

  style RESOLVE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style RESULT_ENV fill:#dcfce7,stroke:#10b981,color:#065f46
  style RESULT_FILE fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style NONE fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <Callout type="info" icon="💡">
              <strong>보안 설계:</strong> 자격 증명 파일의 권한이 <code>0o600</code>입니다. 이는
              Unix 파일 권한에서 소유자만 읽기(4)+쓰기(2)=6이고, 그룹(0)과 기타(0)는 접근 불가를
              의미합니다.
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

            {/* resolveToken */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              resolveToken()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              사용 가능한 모든 소스에서 API 토큰을 찾아 반환합니다. 환경 변수를 먼저 확인하고,
              없으면 자격 증명 파일을 확인합니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span> <span className="fn">resolveToken</span>():{" "}
              <span className="type">Promise&lt;ResolvedToken | undefined&gt;</span>
            </CodeBlock>

            {/* saveToken */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              saveToken(config)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              API 토큰을 자격 증명 파일에 저장합니다. 디렉토리가 없으면 자동 생성하고, 파일 권한을
              0o600으로 설정합니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span> <span className="fn">saveToken</span>(
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

            {/* Environment variables */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              환경 변수 (우선순위 순)
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <code className="text-cyan-600">DHELIX_API_KEY</code> &mdash; dhelix 전용 API 키
                (최우선)
              </p>
              <p>
                <code className="text-cyan-600">OPENAI_API_KEY</code> &mdash; OpenAI 호환 API 키
                (많은 LLM 서비스가 사용)
              </p>
            </div>
            <p className="text-[13px] text-gray-600 mt-2">
              환경 변수에서 로드된 토큰은 기본적으로 <code className="text-cyan-600">bearer</code>{" "}
              인증 방식을 사용합니다.
            </p>

            {/* File format */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              자격 증명 파일 형식
            </h3>
            <CodeBlock>
              <span className="cm">{"// ~/.dhelix/credentials.json"}</span>
              {"\n"}
              {"{"}
              {"\n"}
              {"  "}
              <span className="str">&quot;method&quot;</span>:{" "}
              <span className="str">&quot;bearer&quot;</span>,{"\n"}
              {"  "}
              <span className="str">&quot;token&quot;</span>:{" "}
              <span className="str">&quot;sk-...&quot;</span>,{"\n"}
              {"  "}
              <span className="str">&quot;headerName&quot;</span>:{" "}
              <span className="str">&quot;Authorization&quot;</span>{" "}
              <span className="cm">{"// custom-header일 때만 사용"}</span>
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                환경 변수가 설정되어 있으면 파일은 확인하지 않습니다. 환경 변수를 제거해야 파일의
                토큰이 사용됩니다.
              </li>
              <li>
                자격 증명 파일이 없거나 JSON 파싱에 실패해도 에러를 던지지 않고
                <code className="text-cyan-600">undefined</code>를 반환합니다. 첫 실행 시 파일이
                없는 것이 정상입니다.
              </li>
              <li>
                <code className="text-cyan-600">saveToken()</code>이 실패하면
                <code className="text-cyan-600">AuthError</code>를 던집니다 (파일 쓰기 권한 부족
                등).
              </li>
              <li>
                빈 문자열 토큰은 유효하지 않은 것으로 취급됩니다 (
                <code className="text-cyan-600">token.length &gt; 0</code> 검사).
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
              기본 사용법 &mdash; 토큰 해석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              일반적으로 <code className="text-cyan-600">TokenManager</code>를 통해 간접적으로
              사용하지만, 직접 호출도 가능합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="prop">resolveToken</span>,{" "}
              <span className="prop">saveToken</span> {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./auth/token-store.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 토큰 해석 (환경 변수 → 파일 순서)"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">resolved</span> ={" "}
              <span className="kw">await</span> <span className="fn">resolveToken</span>();
              {"\n"}
              <span className="kw">if</span> (<span className="prop">resolved</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">resolved</span>.<span className="prop">source</span>);{" "}
              <span className="cm">{'// "environment" 또는 "file"'}</span>
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">resolved</span>.<span className="prop">config</span>.
              <span className="prop">method</span>); <span className="cm">{'// "bearer"'}</span>
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* 토큰 저장 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              토큰 저장
            </h3>
            <CodeBlock>
              <span className="cm">{"// 자격 증명 파일에 토큰 저장 (권한 0o600)"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="fn">saveToken</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">method</span>: <span className="str">&quot;bearer&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">token</span>:{" "}
              <span className="str">&quot;sk-your-api-key-here&quot;</span>,{"\n"}
              {"}"});
              {"\n"}
              <span className="cm">{"// → ~/.dhelix/credentials.json 생성 (mode: 0o600)"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 토큰 파일을 수동으로 편집할 때 <code>method</code> 필드를
              빠뜨리면 기본값 <code>&quot;bearer&quot;</code>가 사용됩니다.
              <code>token</code> 필드는 필수이며 빈 문자열이면 무효합니다.
            </Callout>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> CI/CD 환경에서는 파일 대신 환경 변수를 사용하세요.
              <code>export DHELIX_API_KEY=sk-...</code>만으로 인증이 설정됩니다. 파일 기반 토큰보다
              보안적으로 우수합니다.
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
              토큰 로드 소스별 처리
            </h3>

            <MermaidDiagram
              title="토큰 로드 흐름 상세"
              titleColor="purple"
              chart={`graph TD
  subgraph ENV_LOAD["loadFromEnv()"]
    E1["process.env.DHELIX_API_KEY"]
    E2["process.env.OPENAI_API_KEY"]
    E3["TokenConfig<br/><small>method: bearer</small>"]
    E1 -->|"존재"| E3
    E1 -->|"없음"| E2
    E2 -->|"존재"| E3
  end

  subgraph FILE_LOAD["loadFromFile()"]
    F1["readFile(TOKEN_FILE)"]
    F2["JSON.parse()"]
    F3{"token.length > 0?"}
    F4["TokenConfig"]
    F5["undefined"]
    F1 --> F2 --> F3
    F3 -->|"Yes"| F4
    F3 -->|"No"| F5
  end

  subgraph SAVE["saveToken()"]
    S1["mkdir(CONFIG_DIR)"]
    S2["JSON.stringify(config)"]
    S3["writeFile(TOKEN_FILE,<br/>mode: 0o600)"]
    S1 --> S2 --> S3
  end

  style E3 fill:#dcfce7,stroke:#10b981,color:#065f46
  style F4 fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style S3 fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px`}
            />

            <DeepDive title="파일 권한 0o600의 의미">
              <p className="mb-3">Unix 파일 권한은 3자리 8진수로 표현됩니다:</p>
              <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2">
                <p>
                  <strong className="text-gray-900">6</strong> (소유자) = 읽기(4) + 쓰기(2) = rw-
                </p>
                <p>
                  <strong className="text-gray-900">0</strong> (그룹) = 권한 없음 = ---
                </p>
                <p>
                  <strong className="text-gray-900">0</strong> (기타) = 권한 없음 = ---
                </p>
              </div>
              <p className="mt-3 text-gray-600">
                결과: <code className="text-cyan-600">-rw-------</code>. 파일 소유자만 읽고 쓸 수
                있으며, 같은 시스템의 다른 사용자는 토큰 파일을 열 수 없습니다. 이는 SSH 키(
                <code>~/.ssh/id_rsa</code>)와 동일한 권한 수준입니다.
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
                &quot;Failed to save token 에러가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">~/.dhelix/</code> 디렉토리에 쓰기 권한이 있는지
                확인하세요. 홈 디렉토리가 읽기 전용이거나, 디스크 용량이 부족한 경우에도 발생합니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;환경 변수를 설정했는데 파일의 토큰이 사용돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                환경 변수가 현재 셸 세션에 올바르게 설정되었는지 확인하세요.
                <code className="text-cyan-600">echo $DHELIX_API_KEY</code>로 값을 확인하세요. 또한
                TokenManager의 캐시가 이전 값을 유지하고 있을 수 있으므로 dhelix를 재시작하세요.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;credentials.json을 직접 만들었는데 인식되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                JSON 형식이 올바른지 확인하세요. <code className="text-cyan-600">token</code> 필드가
                비어 있지 않은 문자열이어야 합니다. <code className="text-cyan-600">method</code>{" "}
                필드가 없으면 <code>&quot;bearer&quot;</code>가 기본값으로 사용됩니다.
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
                  name: "token-manager.ts",
                  slug: "token-manager-auth",
                  relation: "parent",
                  desc: "토큰 저장소의 상위 추상화 — 캐싱과 인증 헤더 변환을 담당합니다",
                },
                {
                  name: "error.ts",
                  slug: "utils-error",
                  relation: "child",
                  desc: "saveToken() 실패 시 AuthError를 발생시킵니다",
                },
                {
                  name: "path.ts",
                  slug: "utils-path",
                  relation: "child",
                  desc: "자격 증명 파일 경로를 joinPath()로 생성합니다",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
