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

export default function ModelRouterPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/llm/model-router.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">ModelRouter</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              요청별 최적 모델을 선택하고, 주/대체 모델 간 자동 전환(재시도 + 폴백)을 관리하는
              라우터입니다.
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
                <code className="text-cyan-600">ModelRouter</code>는 LLM API 호출의 안정성을
                보장하는 핵심 모듈입니다. 자체적으로{" "}
                <code className="text-cyan-600">LLMProvider</code> 인터페이스를 구현하므로, 호출하는
                쪽에서는 일반 프로바이더처럼 사용할 수 있고, 내부적으로 재시도와 폴백 로직이
                자동으로 처리됩니다.
              </p>
              <p>
                에러를 4가지 클래스(<code className="text-cyan-600">transient</code>,
                <code className="text-cyan-600">overload</code>,{" "}
                <code className="text-cyan-600">auth</code>,
                <code className="text-cyan-600">permanent</code>)로 분류하여 각각에 적합한 전략을
                적용합니다. 과부하 에러는 대체 모델로 즉시 전환하고, 일시적 에러는 지수 백오프로
                재시도합니다.
              </p>
              <p>
                또한 <code className="text-cyan-600">resolveProvider()</code> 함수를 통해 모델
                이름에서 적절한 프로바이더(Anthropic, OpenAI, Responses API, Ollama)를 자동으로
                생성합니다.
              </p>
            </div>

            <MermaidDiagram
              title="ModelRouter 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AGENT["Agent Loop<br/><small>core/agent-loop.ts</small>"]
  ROUTER["ModelRouter<br/><small>model-router.ts</small>"]
  PRIMARY["주 모델 프로바이더<br/><small>예: AnthropicProvider</small>"]
  FALLBACK["대체 모델 프로바이더<br/><small>예: OpenAICompatibleClient</small>"]
  RESOLVE["resolveProvider()<br/><small>모델명 → 프로바이더 자동 생성</small>"]

  AGENT -->|"chat() / stream()"| ROUTER
  ROUTER -->|"정상 시"| PRIMARY
  ROUTER -->|"에러 시 폴백"| FALLBACK
  RESOLVE -->|"claude-*"| PRIMARY
  RESOLVE -->|"gpt-*, 기타"| FALLBACK

  style ROUTER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style PRIMARY fill:#dcfce7,stroke:#10b981,color:#1e293b
  style FALLBACK fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style RESOLVE fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>투명한 래퍼 패턴:</strong> ModelRouter는 LLMProvider 인터페이스를 구현하므로,
              에이전트 루프 입장에서는 일반 프로바이더와 구분할 수 없습니다. 재시도, 폴백, 에러
              분류가 모두 내부에서 자동으로 처리됩니다.
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

            {/* ModelRouterConfig */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ModelRouterConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              모델 라우터 생성 시 전달하는 설정 객체입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "primary",
                  type: "LLMProvider",
                  required: true,
                  desc: "주 모델 프로바이더 — 기본적으로 사용하는 LLM 클라이언트",
                },
                { name: "primaryModel", type: "string", required: true, desc: "주 모델 이름" },
                {
                  name: "fallback",
                  type: "LLMProvider",
                  required: false,
                  desc: "대체(fallback) 모델 프로바이더 — 주 모델 실패 시 사용",
                },
                { name: "fallbackModel", type: "string", required: false, desc: "대체 모델 이름" },
                {
                  name: "maxRetries",
                  type: "number",
                  required: false,
                  desc: "대체 모델로 전환하기 전 최대 재시도 횟수 (기본값: 3)",
                },
                {
                  name: "retryDelayMs",
                  type: "number",
                  required: false,
                  desc: "재시도 간 기본 대기 시간(ms) — 지수 백오프 기준값 (기본값: 1000)",
                },
                {
                  name: "complexityThreshold",
                  type: "number",
                  required: false,
                  desc: "복잡도 임계값 (토큰 수) — 향후 복잡도 기반 라우팅에 사용 예정",
                },
              ]}
            />

            {/* ErrorClass type */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              type ErrorClass
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              에러를 분류하여 재시도/폴백 전략을 결정하는 유니온 타입입니다.
            </p>
            <CodeBlock>
              <span className="kw">type</span> <span className="type">ErrorClass</span> ={" "}
              <span className="str">&quot;transient&quot;</span> |{" "}
              <span className="str">&quot;overload&quot;</span> |{" "}
              <span className="str">&quot;auth&quot;</span> |{" "}
              <span className="str">&quot;permanent&quot;</span>;
            </CodeBlock>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-cyan-600">&quot;transient&quot;</code> &mdash; 일시적
                에러 (타임아웃, 네트워크, 500/502/504) &rarr; 지수 백오프로 재시도
              </p>
              <p>
                &bull; <code className="text-amber-600">&quot;overload&quot;</code> &mdash;
                과부하/Rate Limit (429, 503) &rarr; 대체 모델로 즉시 전환
              </p>
              <p>
                &bull; <code className="text-red-600">&quot;auth&quot;</code> &mdash; 인증/권한 에러
                (401, 403) &rarr; 즉시 실패 (재시도 불가)
              </p>
              <p>
                &bull; <code className="text-red-600">&quot;permanent&quot;</code> &mdash; 영구적
                에러 &rarr; 즉시 실패 (재시도 불가)
              </p>
            </div>

            {/* ModelRouter class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class ModelRouter
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">LLMProvider</code> 인터페이스를 구현하는 라우터
              클래스입니다.
              <code className="text-cyan-600">name</code> 프로퍼티는{" "}
              <code className="text-cyan-600">&quot;model-router&quot;</code>입니다.
            </p>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">constructor(config)</h4>
            <CodeBlock>
              <span className="kw">constructor</span>(<span className="prop">config</span>:{" "}
              <span className="type">ModelRouterConfig</span>)
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">activeModel (getter)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              현재 활성화된 모델 이름을 반환합니다. 대체 모델 사용 중이면 fallbackModel을
              반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">get</span> <span className="prop">activeModel</span>:{" "}
              <span className="type">string</span>
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">isUsingFallback (getter)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              현재 대체 모델을 사용 중인지 확인합니다.
            </p>
            <CodeBlock>
              <span className="kw">get</span> <span className="prop">isUsingFallback</span>:{" "}
              <span className="type">boolean</span>
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">chat(request)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              동기식 채팅 요청을 수행합니다. 재시도 및 폴백 로직이 포함되어 있습니다.
            </p>
            <CodeBlock>
              <span className="fn">chat</span>(<span className="prop">request</span>:{" "}
              <span className="type">ChatRequest</span>): <span className="type">Promise</span>&lt;
              <span className="type">ChatResponse</span>&gt;
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">stream(request)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              스트리밍 채팅 요청을 수행합니다. 에러 시 대체 모델로 폴백합니다. 스트리밍은 부분
              데이터 수신 후 에러가 발생할 수 있으므로, 재시도보다 폴백에 중점을 둡니다.
            </p>
            <CodeBlock>
              <span className="fn">stream</span>(<span className="prop">request</span>:{" "}
              <span className="type">ChatRequest</span>):{" "}
              <span className="type">AsyncIterable</span>&lt;<span className="type">ChatChunk</span>
              &gt;
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">resetToPrimary()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              대체 모델 사용을 중단하고 주 모델로 복원합니다.
            </p>
            <CodeBlock>
              <span className="fn">resetToPrimary</span>(): <span className="type">void</span>
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">switchToFallback()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              대체 모델로 강제 전환합니다. fallback이 설정되지 않았으면 에러를 throw합니다.
            </p>
            <CodeBlock>
              <span className="fn">switchToFallback</span>(): <span className="type">void</span>
            </CodeBlock>

            {/* resolveProvider */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              resolveProvider(modelName, opts?)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              모델 이름을 기반으로 적절한 LLM 프로바이더를 자동으로 생성합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">resolveProvider</span>(
              <span className="prop">modelName</span>: <span className="type">string</span>,{" "}
              <span className="prop">opts</span>?:{" "}
              <span className="type">ResolveProviderOptions</span>):{" "}
              <span className="type">LLMProvider</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "modelName",
                  type: "string",
                  required: true,
                  desc: "모델 이름 (예: 'claude-sonnet-4-20250514', 'gpt-5-codex')",
                },
                {
                  name: "opts.baseUrl",
                  type: "string",
                  required: false,
                  desc: "API 서버 기본 URL (모델에 따라 자동 설정)",
                },
                { name: "opts.apiKey", type: "string", required: false, desc: "API 인증 키" },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">switchToFallback()</code>은 fallback 프로바이더가
                설정되지 않았으면
                <code className="text-red-600">LLMError</code>를 throw합니다. 반드시 fallback 설정
                여부를 확인하세요.
              </li>
              <li>
                과부하(<code className="text-cyan-600">overload</code>) 에러 발생 시 자동으로
                fallback으로 전환되면, 이후 요청도 계속 fallback을 사용합니다.{" "}
                <code className="text-cyan-600">resetToPrimary()</code>를 명시적으로 호출해야 주
                모델로 돌아갑니다.
              </li>
              <li>
                <code className="text-cyan-600">resolveProvider()</code>에서 인식되지 않는 모델명은
                로컬 Ollama 서버(<code className="text-cyan-600">localhost:11434</code>)로
                라우팅됩니다.
              </li>
              <li>
                <code className="text-cyan-600">sleep()</code> 함수는{" "}
                <code className="text-cyan-600">AbortSignal</code>을 지원합니다. 사용자가 Esc를
                누르면 재시도 대기 중에도 즉시 취소됩니다.
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

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 주/대체 모델 설정
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              주 모델과 대체 모델을 설정하면, 주 모델 장애 시 자동으로 대체 모델로 전환됩니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">router</span> ={" "}
              <span className="kw">new</span> <span className="fn">ModelRouter</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">primary</span>: <span className="fn">resolveProvider</span>(
              <span className="str">&quot;claude-sonnet-4-20250514&quot;</span>),
              {"\n"}
              {"  "}
              <span className="prop">primaryModel</span>:{" "}
              <span className="str">&quot;claude-sonnet-4-20250514&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">fallback</span>: <span className="fn">resolveProvider</span>(
              <span className="str">&quot;gpt-4o&quot;</span>),
              {"\n"}
              {"  "}
              <span className="prop">fallbackModel</span>:{" "}
              <span className="str">&quot;gpt-4o&quot;</span>,{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">
                {"// 일반 프로바이더처럼 사용 — 내부에서 재시도/폴백 자동 처리"}
              </span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">response</span> ={" "}
              <span className="kw">await</span> <span className="prop">router</span>.
              <span className="fn">chat</span>(<span className="prop">request</span>);
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> fallback 없이 ModelRouter를 생성하면, 주 모델 장애 시 폴백 없이
              에러가 전파됩니다. 프로덕션 환경에서는 반드시 fallback을 설정하세요.
            </Callout>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              resolveProvider를 통한 자동 프로바이더 생성
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              모델 이름만으로 적절한 프로바이더를 자동 생성할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// Claude 모델 → AnthropicProvider"}</span>
              {"\n"}
              <span className="fn">resolveProvider</span>(
              <span className="str">&quot;claude-sonnet-4-20250514&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// Codex 모델 → ResponsesAPIClient"}</span>
              {"\n"}
              <span className="fn">resolveProvider</span>(
              <span className="str">&quot;gpt-5-codex&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// GPT/o1/o3 모델 → OpenAICompatibleClient"}</span>
              {"\n"}
              <span className="fn">resolveProvider</span>(
              <span className="str">&quot;gpt-4o&quot;</span>);
              {"\n"}
              <span className="fn">resolveProvider</span>(
              <span className="str">&quot;o3-mini&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">
                {"// 기타 모델 → OpenAICompatibleClient (localhost:11434)"}
              </span>
              {"\n"}
              <span className="fn">resolveProvider</span>(
              <span className="str">&quot;llama3&quot;</span>);
            </CodeBlock>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 수동 폴백 제어
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              자동 폴백 외에도 수동으로 모델을 전환하거나 복원할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 대체 모델로 강제 전환"}</span>
              {"\n"}
              <span className="prop">router</span>.<span className="fn">switchToFallback</span>();
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">router</span>.<span className="prop">activeModel</span>);{" "}
              <span className="cm">{"// 'gpt-4o'"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 주 모델로 복원"}</span>
              {"\n"}
              <span className="prop">router</span>.<span className="fn">resetToPrimary</span>();
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">router</span>.<span className="prop">activeModel</span>);{" "}
              <span className="cm">{"// 'claude-sonnet-4-20250514'"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 현재 상태 확인"}</span>
              {"\n"}
              <span className="kw">if</span> (<span className="prop">router</span>.
              <span className="prop">isUsingFallback</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">&quot;대체 모델 사용 중&quot;</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <DeepDive title="에러 분류 로직 상세">
              <p className="mb-3">
                <code className="text-cyan-600">classifyError()</code> 함수는 에러 메시지에 포함된
                키워드를 기반으로 에러를 분류합니다. 에러 객체가{" "}
                <code className="text-cyan-600">Error</code> 인스턴스가 아니면{" "}
                <code className="text-cyan-600">&quot;permanent&quot;</code>으로 분류됩니다.
              </p>
              <div className="text-[13px] text-gray-600 space-y-2">
                <p>
                  <strong className="text-gray-900">overload 키워드:</strong>{" "}
                  <code className="text-cyan-600">&quot;rate limit&quot;</code>,{" "}
                  <code className="text-cyan-600">&quot;429&quot;</code>,{" "}
                  <code className="text-cyan-600">&quot;overload&quot;</code>,{" "}
                  <code className="text-cyan-600">&quot;503&quot;</code>,{" "}
                  <code className="text-cyan-600">&quot;capacity&quot;</code>
                </p>
                <p>
                  <strong className="text-gray-900">transient 키워드:</strong>{" "}
                  <code className="text-cyan-600">&quot;timeout&quot;</code>,{" "}
                  <code className="text-cyan-600">&quot;econnreset&quot;</code>,{" "}
                  <code className="text-cyan-600">&quot;econnrefused&quot;</code>,{" "}
                  <code className="text-cyan-600">&quot;500&quot;</code>,{" "}
                  <code className="text-cyan-600">&quot;502&quot;</code>,{" "}
                  <code className="text-cyan-600">&quot;504&quot;</code>,{" "}
                  <code className="text-cyan-600">&quot;network&quot;</code>
                </p>
                <p>
                  <strong className="text-gray-900">auth 키워드:</strong>{" "}
                  <code className="text-cyan-600">&quot;401&quot;</code>,{" "}
                  <code className="text-cyan-600">&quot;403&quot;</code>,{" "}
                  <code className="text-cyan-600">&quot;unauthorized&quot;</code>,{" "}
                  <code className="text-cyan-600">&quot;forbidden&quot;</code>
                </p>
              </div>
              <p className="mt-3 text-amber-600">
                에러 분류는 메시지의 <strong>소문자 변환</strong> 후 <code>includes()</code>로
                검사하므로, 대소문자를 구분하지 않습니다.
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
              chat() 요청 처리 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">chat()</code> 메서드의 재시도 및 폴백 로직입니다. 에러
              분류에 따라 처리 경로가 달라집니다.
            </p>

            <MermaidDiagram
              title="chat() 재시도 + 폴백 흐름"
              titleColor="purple"
              chart={`graph TD
  START["chat() 호출<br/><small>activeProvider로 요청</small>"]
  TRY["주 모델에 요청<br/><small>attempt 0..maxRetries</small>"]
  OK["응답 반환<br/><small>성공</small>"]
  ERR{"에러 분류"}
  AUTH_PERM["auth / permanent<br/><small>즉시 실패</small>"]
  OVERLOAD["overload<br/><small>Rate Limit / 503</small>"]
  TRANSIENT["transient<br/><small>타임아웃 / 네트워크</small>"]
  FALLBACK["대체 모델로 전환<br/><small>fallback.chat()</small>"]
  BACKOFF["지수 백오프 대기<br/><small>1초 → 2초 → 4초</small>"]
  LAST["최종 폴백 시도<br/><small>모든 재시도 실패 후</small>"]
  BOTH_FAIL["양쪽 모두 실패<br/><small>LLMError throw</small>"]

  START --> TRY
  TRY -->|"성공"| OK
  TRY -->|"에러"| ERR
  ERR -->|"auth/permanent"| AUTH_PERM
  ERR -->|"overload"| OVERLOAD
  ERR -->|"transient"| TRANSIENT
  OVERLOAD -->|"fallback 있음"| FALLBACK
  TRANSIENT --> BACKOFF
  BACKOFF -->|"재시도"| TRY
  BACKOFF -->|"maxRetries 초과"| LAST
  LAST -->|"fallback 있음"| FALLBACK
  FALLBACK -->|"성공"| OK
  FALLBACK -->|"실패"| BOTH_FAIL

  style START fill:#dbeafe,stroke:#3b82f6,color:#1e293b,stroke-width:2px
  style OK fill:#dcfce7,stroke:#10b981,color:#1e293b
  style OVERLOAD fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style TRANSIENT fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style AUTH_PERM fill:#fee2e2,stroke:#ef4444,color:#1e293b
  style FALLBACK fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style BACKOFF fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style LAST fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style BOTH_FAIL fill:#fee2e2,stroke:#ef4444,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              resolveProvider 라우팅 규칙
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              모델 이름의 접두사를 기반으로 프로바이더를 선택합니다.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">claude-*</strong> &mdash;{" "}
                <code className="text-cyan-600">AnthropicProvider</code> (Anthropic Messages API
                직접 호출)
              </p>
              <p>
                <strong className="text-gray-900">gpt-5-codex, gpt-5.1-codex-*</strong> &mdash;{" "}
                <code className="text-cyan-600">ResponsesAPIClient</code> (Responses API 전용)
              </p>
              <p>
                <strong className="text-gray-900">gpt-*, o1-*, o3-*</strong> &mdash;{" "}
                <code className="text-cyan-600">OpenAICompatibleClient</code> (OpenAI Chat
                Completions API)
              </p>
              <p>
                <strong className="text-gray-900">기타 모든 모델</strong> &mdash;{" "}
                <code className="text-cyan-600">OpenAICompatibleClient</code> (localhost:11434,
                Ollama 기본 주소)
              </p>
            </div>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              스트리밍 폴백
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">stream()</code> 메서드는 재시도 없이 바로 폴백합니다.
              스트리밍은 부분적으로 데이터를 받은 후 에러가 발생할 수 있어, 같은 요청을 재시도해도
              이미 전달된 데이터가 중복될 수 있기 때문입니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> *<span className="fn">stream</span>(
              <span className="prop">request</span>: <span className="type">ChatRequest</span>){" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"    "}
              <span className="kw">yield*</span> <span className="kw">this</span>.
              <span className="prop">activeProvider</span>.<span className="fn">stream</span>(
              <span className="prop">activeRequest</span>);
              {"\n"}
              {"  "}
              <span className="kw">{"}"} catch</span> (<span className="prop">error</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// overload/transient이고 fallback 사용 가능하면"}</span>
              {"\n"}
              {"    "}
              <span className="kw">this</span>.<span className="prop">usingFallback</span> ={" "}
              <span className="kw">true</span>;{"\n"}
              {"    "}
              <span className="kw">yield*</span> <span className="kw">this</span>.
              <span className="prop">fallback</span>.<span className="fn">stream</span>(
              <span className="prop">fallbackRequest</span>);
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>
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
                &quot;Both primary and fallback models failed 에러가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                주 모델과 대체 모델 모두 실패한 경우입니다. 에러 메시지에 양쪽의 에러 정보가
                포함되어 있으므로 확인하세요:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-1 list-disc list-inside">
                <li>양쪽 API 키가 모두 올바른지 확인</li>
                <li>양쪽 서비스의 상태 페이지를 확인 (동시 장애일 수 있음)</li>
                <li>네트워크 연결 상태를 확인</li>
              </ul>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;계속 대체 모델로 응답하고 주 모델로 안 돌아와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                overload 에러로 폴백되면 <code className="text-cyan-600">usingFallback</code>이{" "}
                <code className="text-cyan-600">true</code>로 유지됩니다.{" "}
                <code className="text-cyan-600">resetToPrimary()</code>를 명시적으로 호출해야 주
                모델로 복원됩니다. 에이전트 루프에서는 일정 주기마다 또는 새 대화 시작 시 이
                메서드를 호출하는 것이 권장됩니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;알 수 없는 모델이 Ollama로 라우팅돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">resolveProvider()</code>는 인식되지 않는 모델명을
                <code className="text-cyan-600">localhost:11434</code>(Ollama 기본 주소)로
                라우팅합니다. 의도한 것이 아니라면 모델 이름의 접두사를 확인하세요.
                <code className="text-cyan-600">baseUrl</code> 옵션으로 다른 서버를 지정할 수도
                있습니다.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;No fallback model configured 에러가 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">switchToFallback()</code>을 호출했지만 fallback
                프로바이더가 설정되지 않은 경우입니다. ModelRouter 생성 시{" "}
                <code className="text-cyan-600">fallback</code>과
                <code className="text-cyan-600">fallbackModel</code>을 함께 전달하세요.
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
                  name: "provider.ts",
                  slug: "llm-provider",
                  relation: "parent",
                  desc: "ModelRouter가 구현하는 LLMProvider 인터페이스 및 핵심 타입 정의",
                },
                {
                  name: "anthropic.ts",
                  slug: "anthropic-provider",
                  relation: "child",
                  desc: "resolveProvider()가 'claude-*' 모델에 대해 생성하는 Anthropic 프로바이더",
                },
                {
                  name: "responses-client.ts",
                  slug: "responses-client",
                  relation: "child",
                  desc: "resolveProvider()가 Codex 모델에 대해 생성하는 Responses API 클라이언트",
                },
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "ModelRouter를 생성하고 LLM 호출에 사용하는 에이전트 루프",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
