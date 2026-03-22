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

export default function ErrorBannerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/components/ErrorBanner.tsx" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">ErrorBanner</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              에러 메시지를 자동 분류하여 유형별 아이콘과 한국어 해결 가이드를 표시하는 배너
              컴포넌트입니다.
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
                <code className="text-cyan-600">ErrorBanner</code>는 에러가 발생했을 때 사용자에게
                무엇이 잘못되었고 어떻게 해결할 수 있는지를 시각적으로 안내하는 컴포넌트입니다. 에러
                메시지를 분석하여 6가지 유형(rate_limit, network, token_limit, auth,
                model_not_found, unknown) 중 하나로 자동 분류하고, 각 유형에 맞는 이모지 아이콘과
                한국어 해결 가이드를 함께 표시합니다.
              </p>
              <p>
                빨간색 둥근 테두리(
                <code className="text-cyan-600">borderStyle=&quot;round&quot;</code>) 안에 에러
                정보를 보여주며, 비차단(non-blocking) 방식으로 작동합니다. 즉, 에러 배너가
                표시되어도 앱은 계속 실행됩니다. 이는 터미널 앱에서 사용자 경험을 해치지 않으면서
                에러를 알리는 중요한 설계 원칙입니다.
              </p>
              <p>
                분류 로직은 키워드 매칭 방식입니다. 에러 메시지에 &quot;429&quot;가 포함되면
                rate_limit, &quot;timeout&quot;이 포함되면 network 등으로 판별합니다.
              </p>
            </div>

            <MermaidDiagram
              title="ErrorBanner 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  APP["App.tsx<br/><small>메인 앱</small>"]
  EB["ErrorBanner<br/><small>에러 배너</small>"]
  CF["classifyError()<br/><small>에러 자동 분류</small>"]
  AGENT["Agent Loop<br/><small>에러 이벤트</small>"]
  LLM["LLM Client<br/><small>API 에러</small>"]
  RE["Recovery Executor<br/><small>복구 실패</small>"]

  AGENT -->|"에러 발생"| APP
  LLM -->|"API 에러"| APP
  RE -->|"복구 실패"| APP
  APP -->|"message + details"| EB
  EB --> CF
  CF -->|"type + icon + guide"| EB

  style EB fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CF fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style APP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style AGENT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style RE fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 웹 브라우저의 &quot;이 사이트에 연결할 수 없습니다&quot; 에러
              페이지를 생각하세요. 단순히 에러 코드만 보여주는 것이 아니라, &quot;인터넷 연결을
              확인하세요&quot; 같은 해결 가이드를 함께 보여줍니다. ErrorBanner도 같은 역할을
              터미널에서 수행합니다.
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

            {/* ErrorBannerProps */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ErrorBannerProps
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              ErrorBanner 컴포넌트에 전달하는 props입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "message",
                  type: "string",
                  required: true,
                  desc: "에러 메시지. 빨간색 굵은 글씨로 표시되며, classifyError()의 입력으로도 사용됩니다.",
                },
                {
                  name: "details",
                  type: "string | undefined",
                  required: false,
                  desc: "추가 상세 정보. 회색 dim 처리되어 메시지 아래에 표시됩니다.",
                },
              ]}
            />

            {/* ErrorClassification */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ErrorClassification
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">classifyError()</code>의 반환값입니다. 에러 유형, 해결
              가이드, 아이콘을 담고 있습니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "type",
                  type: "ErrorType",
                  required: true,
                  desc: "에러 유형: 'rate_limit' | 'network' | 'token_limit' | 'auth' | 'model_not_found' | 'unknown'",
                },
                {
                  name: "guide",
                  type: "string",
                  required: true,
                  desc: "사용자를 위한 한국어 해결 가이드 (unknown이면 빈 문자열)",
                },
                {
                  name: "icon",
                  type: "string",
                  required: true,
                  desc: "에러 유형에 맞는 이모지 아이콘",
                },
              ]}
            />

            {/* classifyError */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              classifyError(message)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              에러 메시지를 분석하여 유형을 자동 분류합니다. 메시지를 소문자로 변환한 후 키워드 포함
              여부를 순서대로 검사합니다.
            </p>
            <CodeBlock>
              <span className="fn">classifyError</span>(<span className="prop">message</span>:{" "}
              <span className="type">string</span>):{" "}
              <span className="type">ErrorClassification</span>
            </CodeBlock>

            {/* 분류 테이블 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">rate_limit</strong> (&#9203;) &mdash; 키워드:{" "}
                <code>429</code>, <code>rate limit</code>, <code>rate_limit</code> &rarr; &quot;API
                사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.&quot;
              </p>
              <p>
                <strong className="text-gray-900">network</strong> (&#128268;) &mdash; 키워드:{" "}
                <code>econnrefused</code>, <code>timeout</code>, <code>network</code>,{" "}
                <code>enotfound</code>, <code>socket</code> &rarr; &quot;네트워크를 확인하세요.
                서버가 실행 중인지 확인: dbcode --base-url &lt;url&gt;&quot;
              </p>
              <p>
                <strong className="text-gray-900">token_limit</strong> (&#128207;) &mdash; 키워드:{" "}
                <code>too many tokens</code>, <code>request too large</code>,{" "}
                <code>context_length</code> &rarr; &quot;대화가 너무 깁니다. /compact로
                압축하세요.&quot;
              </p>
              <p>
                <strong className="text-gray-900">auth</strong> (&#128273;) &mdash; 키워드:{" "}
                <code>401</code>, <code>unauthorized</code>, <code>api key</code>,{" "}
                <code>api_key</code> &rarr; &quot;API 키가 유효하지 않습니다. --api-key 또는
                환경변수를 확인하세요.&quot;
              </p>
              <p>
                <strong className="text-gray-900">model_not_found</strong> (&#129302;) &mdash;
                키워드: <code>404</code> + <code>model</code> &rarr; &quot;모델을 찾을 수 없습니다.
                /model로 변경하세요.&quot;
              </p>
              <p>
                <strong className="text-gray-900">unknown</strong> (&#10060;) &mdash; 어떤
                키워드에도 매칭되지 않음 &rarr; 가이드 없이 에러 메시지만 표시
              </p>
            </div>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">classifyError()</code>는
                <code className="text-cyan-600">message + details</code>를 합쳐서 분류합니다.
                details에 키워드가 포함되어도 분류에 영향을 줍니다.
              </li>
              <li>
                분류 순서가 중요합니다. 예를 들어 메시지에 &quot;429&quot;와 &quot;timeout&quot;이
                모두 포함되면 먼저 검사되는 <code className="text-cyan-600">rate_limit</code>으로
                분류됩니다.
              </li>
              <li>
                <code className="text-cyan-600">model_not_found</code>는 &quot;404&quot;와
                &quot;model&quot;이 <strong>둘 다</strong> 포함되어야 합니다. 단순 404 에러는
                매칭되지 않습니다.
              </li>
              <li>
                이 컴포넌트는 비차단(non-blocking)입니다. 에러 배너가 표시되어도 사용자는 계속
                입력할 수 있고, 앱은 정상 작동합니다.
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
              기본 사용법 &mdash; 에러 표시
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              에러 메시지만 전달하면 자동으로 유형을 분류하고 적절한 가이드를 표시합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="type">ErrorBanner</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./ErrorBanner.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// Rate limit 에러 → ⏳ 아이콘 + 가이드 자동 표시"}</span>
              {"\n"}
              {"<"}
              <span className="type">ErrorBanner</span> <span className="prop">message</span>=
              <span className="str">&quot;429 Too Many Requests&quot;</span> {"/>"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// 상세 정보 포함"}</span>
              {"\n"}
              {"<"}
              <span className="type">ErrorBanner</span>
              {"\n"}
              {"  "}
              <span className="prop">message</span>=
              <span className="str">&quot;Request timeout&quot;</span>
              {"\n"}
              {"  "}
              <span className="prop">details</span>=
              <span className="str">&quot;ECONNREFUSED 127.0.0.1:11434&quot;</span>
              {"\n"}
              {"/>"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>details</code>의 키워드도 분류에 영향을 줍니다. 예를 들어{" "}
              <code>message=&quot;Unknown error&quot;</code>이지만
              <code>details=&quot;status: 429&quot;</code>이면
              <code>rate_limit</code>으로 올바르게 분류됩니다.
            </Callout>

            {/* 렌더링 결과 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              터미널 출력 예시
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              각 에러 유형별 터미널 출력 형태입니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// rate_limit:"}</span>
              {"\n"}
              <span className="cm">{"// ╭──────────────────────────────────────╮"}</span>
              {"\n"}
              <span className="cm">{"// │ ⏳ Error: 429 Too Many Requests      │"}</span>
              {"\n"}
              <span className="cm">{"// │ API 사용량이 초과되었습니다.          │"}</span>
              {"\n"}
              <span className="cm">{"// │ 잠시 후 다시 시도해주세요.            │"}</span>
              {"\n"}
              <span className="cm">{"// ╰──────────────────────────────────────╯"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// auth:"}</span>
              {"\n"}
              <span className="cm">{"// ╭──────────────────────────────────────╮"}</span>
              {"\n"}
              <span className="cm">{"// │ 🔑 Error: 401 Unauthorized           │"}</span>
              {"\n"}
              <span className="cm">{"// │ API 키가 유효하지 않습니다.           │"}</span>
              {"\n"}
              <span className="cm">{"// │ --api-key 또는 환경변수를 확인하세요. │"}</span>
              {"\n"}
              <span className="cm">{"// ╰──────────────────────────────────────╯"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 새로운 에러 유형을 추가하려면
              <code>classifyError()</code> 함수에 새로운 <code>if</code> 블록을 추가하면 됩니다.
              기존 분류보다 앞에 추가하면 더 높은 우선순위를 가집니다.
            </Callout>

            <DeepDive title="에러 분류 확장 시 주의사항">
              <p className="mb-3">
                <code className="text-cyan-600">classifyError()</code>는 <code>if-else</code>{" "}
                체인으로 구현되어 있으므로, 순서가 중요합니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>더 구체적인 키워드를 가진 분류를 먼저 배치하세요</li>
                <li>
                  <code>model_not_found</code>처럼 복합 조건(404 + model)은 단일 조건보다 뒤에
                  배치해야 합니다
                </li>
                <li>
                  새 유형 추가 시 <code>ErrorClassification.type</code> 유니온에도 타입을 추가해야
                  합니다
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                메시지를 소문자로 변환한 후 비교하므로, 키워드는 항상 소문자로 작성하세요.
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
              에러 분류 흐름도
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">classifyError()</code>는 메시지를 소문자로 변환한 후
              키워드를 순서대로 검사하여 첫 번째 매칭에서 반환합니다.
            </p>

            <MermaidDiagram
              title="classifyError() 분류 흐름"
              titleColor="purple"
              chart={`graph TD
  INPUT["message.toLowerCase()"] --> C1{"429 / rate limit?"}
  C1 -->|"Yes"| R1["rate_limit ⏳"]
  C1 -->|"No"| C2{"timeout / network?"}
  C2 -->|"Yes"| R2["network 🔌"]
  C2 -->|"No"| C3{"too many tokens?"}
  C3 -->|"Yes"| R3["token_limit 📏"]
  C3 -->|"No"| C4{"401 / api key?"}
  C4 -->|"Yes"| R4["auth 🔑"]
  C4 -->|"No"| C5{"404 + model?"}
  C5 -->|"Yes"| R5["model_not_found 🤖"]
  C5 -->|"No"| R6["unknown ❌"]

  style INPUT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style C1 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style C2 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style C3 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style C4 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style C5 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style R1 fill:#dcfce7,stroke:#10b981,color:#065f46
  style R2 fill:#dcfce7,stroke:#10b981,color:#065f46
  style R3 fill:#dcfce7,stroke:#10b981,color:#065f46
  style R4 fill:#dcfce7,stroke:#10b981,color:#065f46
  style R5 fill:#dcfce7,stroke:#10b981,color:#065f46
  style R6 fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              ErrorBanner 컴포넌트의 렌더링 로직입니다.
              <code className="text-cyan-600">classifyError()</code>의 결과를 기반으로 3개의 Text
              요소를 조건부로 렌더링합니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span> <span className="fn">ErrorBanner</span>(
              {"{"} <span className="prop">message</span>, <span className="prop">details</span>{" "}
              {"}"}: <span className="type">ErrorBannerProps</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] message + details를 합쳐서 분류"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">classification</span> ={" "}
              <span className="fn">classifyError</span>(<span className="prop">message</span> + (
              <span className="prop">details</span> ?? <span className="str">&quot;&quot;</span>));
              {"\n"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> ({"\n"}
              {"    "}
              <span className="cm">{"// [2] 빨간색 둥근 테두리 박스"}</span>
              {"\n"}
              {"    "}
              {"<"}
              <span className="type">Box</span> <span className="prop">borderStyle</span>=
              <span className="str">&quot;round&quot;</span>{" "}
              <span className="prop">borderColor</span>=<span className="str">&quot;red&quot;</span>
              {">"}
              {"\n"}
              {"      "}
              <span className="cm">{"// [3] 아이콘 + 에러 메시지 (빨간색, 굵게)"}</span>
              {"\n"}
              {"      "}
              {"<"}
              <span className="type">Text</span> <span className="prop">color</span>=
              <span className="str">&quot;red&quot;</span> <span className="prop">bold</span>
              {">"}
              {"\n"}
              {"        "}
              {"{"}classification.icon{"}"} Error: {"{"}message{"}"}
              {"\n"}
              {"      "}
              {"</"}
              <span className="type">Text</span>
              {">"}
              {"\n"}
              {"      "}
              <span className="cm">{"// [4] details가 있으면 회색으로 표시"}</span>
              {"\n"}
              {"      "}
              {"{"}details ? {"<"}
              <span className="type">Text</span> <span className="prop">dimColor</span>
              {">"}
              {"{"}details{"}"}
              {"</"}
              <span className="type">Text</span>
              {">"} : null{"}"}
              {"\n"}
              {"      "}
              <span className="cm">{"// [5] 가이드가 있으면 dim으로 표시"}</span>
              {"\n"}
              {"      "}
              {"{"}classification.guide ? {"<"}
              <span className="type">Text</span> <span className="prop">dimColor</span>
              {">"}
              {"{"}classification.guide{"}"}
              {"</"}
              <span className="type">Text</span>
              {">"} : null{"}"}
              {"\n"}
              {"    "}
              {"</"}
              <span className="type">Box</span>
              {">"}
              {"\n"}
              {"  "});
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong>{" "}
                <code className="text-cyan-600">message</code>와{" "}
                <code className="text-cyan-600">details</code>를 합쳐서 분류합니다. details가 없으면
                빈 문자열을 사용합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> Ink의{" "}
                <code className="text-cyan-600">Box</code> 컴포넌트로 둥근 테두리(round)를 만듭니다.
                빨간색 테두리가 에러임을 시각적으로 강조합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 분류된 아이콘과 에러 메시지를 빨간색
                굵은 글씨로 첫 줄에 표시합니다.
              </p>
              <p>
                <strong className="text-gray-900">[4-5]</strong> details와 guide는 조건부
                렌더링됩니다. 없으면 해당 줄이 표시되지 않습니다.
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
                &quot;에러가 항상 &#10060;(unknown)으로 표시돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                에러 메시지에 분류 키워드가 포함되어 있지 않을 때 발생합니다.
                <code className="text-cyan-600">classifyError()</code>에 새로운 키워드 패턴을
                추가하여 해당 에러 유형을 지원할 수 있습니다. 메시지는 소문자로 변환되므로
                대소문자는 무관합니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;에러 유형이 잘못 분류돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                키워드 매칭은 순서대로 진행됩니다. 메시지에 여러 유형의 키워드가 포함되면 먼저
                검사되는 유형으로 분류됩니다. 예: &quot;429 timeout&quot;이면 rate_limit이
                network보다 먼저 매칭됩니다. 분류 우선순위를 변경하려면{" "}
                <code className="text-cyan-600">classifyError()</code>의 if-else 순서를 조정하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;가이드 메시지가 영어로 보여야 해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                현재 가이드 메시지는 한국어로 하드코딩되어 있습니다. 다국어 지원이 필요하면{" "}
                <code className="text-cyan-600">classifyError()</code>의 guide 문자열을 i18n
                시스템과 연동하거나, locale 파라미터를 추가하는 확장이 필요합니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;에러 배너가 너무 넓어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Ink의 <code className="text-cyan-600">Box</code> 컴포넌트는 기본적으로 터미널 전체
                너비를 사용합니다. <code className="text-cyan-600">paddingX={"{1}"}</code>로 좌우
                패딩이 적용되어 있지만, 너비 제한은 부모 컴포넌트에서 설정해야 합니다.
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
                  name: "recovery-executor.ts",
                  slug: "recovery-executor",
                  relation: "sibling",
                  desc: "에러 유형별 복구 전략을 실행하는 모듈 — ErrorBanner와 유사한 에러 분류 체계를 사용",
                },
                {
                  name: "utils-notifications",
                  slug: "utils-notifications",
                  relation: "sibling",
                  desc: "에러 발생 시 데스크톱 알림을 전송하는 유틸리티 — ErrorBanner의 시각적 알림과 보완적 역할",
                },
                {
                  name: "circuit-breaker.ts",
                  slug: "circuit-breaker",
                  relation: "sibling",
                  desc: "에이전트 루프 무한 반복 방지 — 차단 시 ErrorBanner로 사유가 표시될 수 있음",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
