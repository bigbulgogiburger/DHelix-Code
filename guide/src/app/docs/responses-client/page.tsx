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

export default function ResponsesClientPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/llm/responses-client.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              ResponsesAPIClient
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            Responses API 전용 클라이언트로, Chat Completions API를 지원하지 않는 Codex 모델과 통신합니다.
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
              GPT-5 Codex 계열 모델(<code className="text-cyan-600">gpt-5-codex</code>,
              <code className="text-cyan-600">gpt-5.1-codex-mini</code> 등)은 기존 Chat Completions API를
              지원하지 않고, <code className="text-cyan-600">/responses</code> 엔드포인트만 지원합니다.
              이 모듈은 해당 API를 직접 호출하는 전용 클라이언트입니다.
            </p>
            <p>
              OpenAI SDK에 의존하지 않고 <code className="text-cyan-600">fetch</code>로 HTTP 요청을 직접 수행합니다.
              Azure OpenAI와 표준 OpenAI 엔드포인트를 모두 지원하며,
              인증 헤더 형식(<code className="text-cyan-600">api-key</code> vs <code className="text-cyan-600">Authorization: Bearer</code>)을
              자동으로 구분합니다.
            </p>
            <p>
              자동 재시도 로직이 내장되어 있으며, 지수 백오프에 <strong>지터(jitter)</strong>를 추가하여
              여러 클라이언트가 동시에 재시도하는 &quot;thundering herd&quot; 문제를 방지합니다.
              또한 <code className="text-cyan-600">function_call</code>과 <code className="text-cyan-600">function_call_output</code>의
              일관성을 자동으로 검증하여 Responses API 400 에러를 예방합니다.
            </p>
          </div>

          <MermaidDiagram
            title="ResponsesAPIClient 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  ROUTER["ModelRouter<br/><small>model-router.ts</small>"]
  RESOLVE["resolveProvider()<br/><small>Codex 모델 감지</small>"]
  RC["ResponsesAPIClient<br/><small>responses-client.ts</small>"]
  BUILD["buildResponsesEndpoint()<br/><small>URL 정규화</small>"]
  CONVERT["toResponsesInput()<br/><small>메시지 형식 변환</small>"]
  VALIDATE["function_call/output<br/><small>일관성 검증</small>"]
  API["Responses API<br/><small>/responses 엔드포인트</small>"]

  ROUTER -->|"Codex 모델"| RESOLVE
  RESOLVE -->|"생성"| RC
  RC -->|"URL 생성"| BUILD
  RC -->|"메시지 변환"| CONVERT
  CONVERT -->|"자동 검증"| VALIDATE
  RC -->|"fetch"| API

  style RC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style ROUTER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RESOLVE fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style BUILD fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style CONVERT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style VALIDATE fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style API fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>왜 별도 클라이언트?</strong> Responses API는 Chat Completions API와 요청/응답 형식이 완전히 다릅니다.
            시스템 메시지가 <code>instructions</code> 파라미터로 전달되고, 도구 호출이
            <code>function_call</code>/<code>function_call_output</code> 아이템으로 표현됩니다.
            기존 <code>OpenAICompatibleClient</code>로는 처리할 수 없어 전용 클라이언트가 필요합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* isResponsesOnlyModel */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            isResponsesOnlyModel(model)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            모델이 Responses API 전용인지 확인합니다. Codex 모델만 해당됩니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">isResponsesOnlyModel</span>(<span className="prop">model</span>: <span className="type">string</span>): <span className="type">boolean</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 내부 정규식: /^gpt-5(\\.\\d+)?-codex/i"}</span>
            {"\n"}<span className="cm">{"// 매칭 예: 'gpt-5-codex', 'gpt-5.1-codex-mini'"}</span>
          </CodeBlock>

          {/* ResponsesClientConfig */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ResponsesClientConfig
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            클라이언트 생성 시 전달하는 설정 객체입니다.
          </p>
          <ParamTable
            params={[
              { name: "baseURL", type: "string", required: true, desc: "API 서버의 기본 URL (Azure 또는 OpenAI)" },
              { name: "apiKey", type: "string", required: false, desc: "API 인증 키 (없으면 'no-key-required')" },
              { name: "timeout", type: "number", required: false, desc: "요청 타임아웃(밀리초) — 기본값 120,000 (2분)" },
            ]}
          />

          {/* ResponsesAPIClient class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class ResponsesAPIClient
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">LLMProvider</code> 인터페이스를 구현하는 Responses API 전용 클래스입니다.
            <code className="text-cyan-600">name</code> 프로퍼티는 <code className="text-cyan-600">&quot;azure-responses&quot;</code>입니다.
          </p>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            constructor(config)
          </h4>
          <CodeBlock>
            <span className="kw">constructor</span>(<span className="prop">config</span>: <span className="type">ResponsesClientConfig</span>)
          </CodeBlock>
          <p className="text-[13px] text-gray-600 mt-2 mb-4">
            <code className="text-cyan-600">buildResponsesEndpoint()</code>로 baseURL에서 <code className="text-cyan-600">/responses</code>
            엔드포인트를 정규화합니다. Azure 여부도 자동으로 감지합니다.
          </p>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            chat(request)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            동기식 채팅 요청을 수행합니다. HTTP 에러와 네트워크 에러를 구분하여 적절한 재시도 전략을 적용합니다.
          </p>
          <CodeBlock>
            <span className="fn">chat</span>(<span className="prop">request</span>: <span className="type">ChatRequest</span>): <span className="type">Promise</span>&lt;<span className="type">ChatResponse</span>&gt;
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            stream(request)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            스트리밍 채팅 요청을 수행합니다. SSE를 직접 파싱하여 <code className="text-cyan-600">ChatChunk</code>를 yield합니다.
          </p>
          <CodeBlock>
            <span className="fn">stream</span>(<span className="prop">request</span>: <span className="type">ChatRequest</span>): <span className="type">AsyncIterable</span>&lt;<span className="type">ChatChunk</span>&gt;
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            countTokens(text)
          </h4>
          <CodeBlock>
            <span className="fn">countTokens</span>(<span className="prop">text</span>: <span className="type">string</span>): <span className="type">number</span>
          </CodeBlock>

          {/* 내부 유틸리티 함수 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            내부 유틸리티 함수
          </h3>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            buildResponsesEndpoint(baseURL)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            설정된 기본 URL에서 Responses API 엔드포인트를 정규화합니다.
            기존 엔드포인트 접미사와 배포명 경로를 제거한 후 <code className="text-cyan-600">/responses</code>를 추가합니다.
          </p>
          <CodeBlock>
            <span className="fn">buildResponsesEndpoint</span>(<span className="prop">baseURL</span>: <span className="type">string</span>): {"{"}
            {"\n"}{"  "}<span className="prop">endpoint</span>: <span className="type">string</span>;
            {"\n"}{"  "}<span className="prop">isAzure</span>: <span className="type">boolean</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            toResponsesInput(messages)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            내부 <code className="text-cyan-600">ChatMessage</code> 배열을 Responses API 입력 형식으로 변환하고,
            <code className="text-cyan-600">function_call</code>/<code className="text-cyan-600">function_call_output</code>
            일관성을 자동 검증합니다.
          </p>
          <CodeBlock>
            <span className="fn">toResponsesInput</span>(<span className="prop">messages</span>: <span className="kw">readonly</span> <span className="type">ChatMessage</span>[]): <span className="type">unknown</span>[]
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            addJitter(delayMs)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            대기 시간에 +/-20% 무작위 편차를 추가하여 thundering herd 문제를 방지합니다.
          </p>
          <CodeBlock>
            <span className="fn">addJitter</span>(<span className="prop">delayMs</span>: <span className="type">number</span>): <span className="type">number</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">isResponsesOnlyModel()</code>은 <code className="text-cyan-600">/^gpt-5(\.\d+)?-codex/i</code>
              정규식만 매칭합니다. 새로운 Codex 모델이 추가되면 정규식 업데이트가 필요합니다.
            </li>
            <li>
              Azure OpenAI와 표준 OpenAI는 인증 헤더 형식이 다릅니다.
              Azure는 <code className="text-cyan-600">api-key</code> 헤더를, 표준은 <code className="text-cyan-600">Authorization: Bearer</code>를 사용합니다.
            </li>
            <li>
              <code className="text-cyan-600">function_call</code>에 매칭되는 <code className="text-cyan-600">function_call_output</code>이
              없으면 자동으로 플레이스홀더가 생성됩니다. 이는 Responses API의 400 에러를 방지하기 위한 방어 코드입니다.
            </li>
            <li>
              <code className="text-cyan-600">name</code> 프로퍼티가 <code className="text-cyan-600">&quot;azure-responses&quot;</code>이지만,
              Azure뿐만 아니라 표준 OpenAI Responses API도 지원합니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; resolveProvider를 통한 자동 생성</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            일반적으로 직접 생성하지 않고 <code className="text-cyan-600">resolveProvider()</code>가
            <code className="text-cyan-600">isResponsesOnlyModel()</code>로 Codex 모델을 감지하여 자동으로 생성합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// resolveProvider가 자동으로 ResponsesAPIClient를 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">provider</span> = <span className="fn">resolveProvider</span>(<span className="str">&quot;gpt-5-codex&quot;</span>);
            {"\n"}
            {"\n"}<span className="kw">const</span> <span className="prop">response</span> = <span className="kw">await</span> <span className="prop">provider</span>.<span className="fn">chat</span>({"{"}
            {"\n"}{"  "}<span className="prop">model</span>: <span className="str">&quot;gpt-5-codex&quot;</span>,
            {"\n"}{"  "}<span className="prop">messages</span>: [
            {"\n"}{"    "}{"{"} <span className="prop">role</span>: <span className="str">&quot;system&quot;</span>, <span className="prop">content</span>: <span className="str">&quot;코딩 어시스턴트&quot;</span> {"}"},
            {"\n"}{"    "}{"{"} <span className="prop">role</span>: <span className="str">&quot;user&quot;</span>, <span className="prop">content</span>: <span className="str">&quot;이 함수를 최적화해주세요&quot;</span> {"}"},
            {"\n"}{"  "}],
            {"\n"}{"}"});
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> Codex 모델은 Chat Completions API를 지원하지 않습니다.
            <code>OpenAICompatibleClient</code>로 Codex 모델을 호출하면 404 에러가 발생합니다.
            반드시 <code>resolveProvider()</code>를 사용하거나 직접 <code>ResponsesAPIClient</code>를 생성하세요.
          </Callout>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; Azure OpenAI에서 사용
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            Azure OpenAI 엔드포인트를 사용할 때는 <code className="text-cyan-600">baseURL</code>에 Azure URL을 전달합니다.
            <code className="text-cyan-600">buildResponsesEndpoint()</code>가 자동으로 Azure 여부를 감지하고
            인증 헤더를 적절히 설정합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">client</span> = <span className="kw">new</span> <span className="fn">ResponsesAPIClient</span>({"{"}
            {"\n"}{"  "}<span className="prop">baseURL</span>: <span className="str">&quot;https://my-resource.openai.azure.com/openai&quot;</span>,
            {"\n"}{"  "}<span className="prop">apiKey</span>: <span className="prop">process</span>.<span className="prop">env</span>.<span className="prop">AZURE_OPENAI_API_KEY</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// Azure: api-key 헤더로 인증"}</span>
            {"\n"}<span className="cm">{"// 표준 OpenAI: Authorization: Bearer 헤더로 인증"}</span>
          </CodeBlock>

          <DeepDive title="function_call/output 일관성 검증">
            <p className="mb-3">
              Responses API는 모든 <code className="text-cyan-600">function_call</code>에 대응하는
              <code className="text-cyan-600">function_call_output</code>이 있어야 합니다.
              누락되면 400 에러가 발생합니다.
            </p>
            <p className="mb-3">
              <code className="text-cyan-600">toResponsesInput()</code>은 이 일관성을 자동으로 검증합니다.
              도구 실행이 중단된 경우(Esc 누름 등) 매칭되지 않는 <code className="text-cyan-600">function_call</code>이
              발생할 수 있는데, 이때 플레이스홀더 출력을 자동 생성합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 자동 생성되는 플레이스홀더"}</span>
              {"\n"}{"{"}
              {"\n"}{"  "}<span className="prop">type</span>: <span className="str">&quot;function_call_output&quot;</span>,
              {"\n"}{"  "}<span className="prop">call_id</span>: <span className="str">&quot;원래 call_id&quot;</span>,
              {"\n"}{"  "}<span className="prop">output</span>: <span className="str">&quot;[No output - tool execution may have been interrupted]&quot;</span>,
              {"\n"}{"}"}
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>메시지 변환 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            내부 <code className="text-cyan-600">ChatMessage</code>가 Responses API 입력으로 어떻게 변환되는지를 보여줍니다.
          </p>

          <MermaidDiagram
            title="메시지 변환 흐름"
            titleColor="purple"
            chart={`graph LR
  SYS["system 메시지<br/><small>시스템 지시사항</small>"]
  USER["user 메시지<br/><small>사용자 입력</small>"]
  ASST["assistant 메시지<br/><small>텍스트 + 도구 호출</small>"]
  TOOL["tool 메시지<br/><small>도구 실행 결과</small>"]

  INST["instructions 파라미터<br/><small>별도 분리</small>"]
  U_IN["{ role: 'user', content }<br/><small>그대로 전달</small>"]
  MSG["message + function_call<br/><small>텍스트와 호출 분리</small>"]
  FCO["function_call_output<br/><small>call_id로 매칭</small>"]

  SYS -->|"추출"| INST
  USER -->|"변환"| U_IN
  ASST -->|"분할"| MSG
  TOOL -->|"변환"| FCO

  style SYS fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style USER fill:#dcfce7,stroke:#10b981,color:#1e293b
  style ASST fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style TOOL fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style INST fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style U_IN fill:#dcfce7,stroke:#10b981,color:#1e293b
  style MSG fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style FCO fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>재시도 전략 &mdash; 지터(Jitter) 적용</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            AnthropicProvider와 달리, ResponsesAPIClient는 재시도 대기 시간에
            <strong> +/-20% 지터</strong>를 추가합니다. 이는 여러 클라이언트가 동시에
            재시도하는 &quot;thundering herd&quot; 문제를 방지합니다.
          </p>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">MAX_RETRIES_TRANSIENT</strong> &mdash; <code className="text-cyan-600">3</code> (일시적 에러 최대 재시도)</p>
            <p><strong className="text-gray-900">MAX_RETRIES_RATE_LIMIT</strong> &mdash; <code className="text-cyan-600">5</code> (Rate Limit 최대 재시도)</p>
            <p><strong className="text-gray-900">Retry-After 헤더</strong> &mdash; 서버가 Retry-After 헤더를 반환하면 해당 값을 우선 사용</p>
            <p><strong className="text-gray-900">지수 백오프 + 지터</strong> &mdash; Rate Limit: <code className="text-cyan-600">5초 * 2^attempt * (0.8~1.2)</code> / 일시적 에러: <code className="text-cyan-600">1초 * 2^attempt * (0.8~1.2)</code></p>
            <p><strong className="text-gray-900">네트워크 에러 감지</strong> &mdash; DNS 실패, 연결 거부, 타임아웃 등 HTTP 상태 코드 없는 에러도 재시도 대상</p>
          </div>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>URL 정규화</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">buildResponsesEndpoint()</code>는 다양한 URL 형식을 정규화합니다:
          </p>
          <CodeBlock>
            <span className="cm">{"// 입력 → 출력"}</span>
            {"\n"}<span className="str">&quot;https://api.openai.com/v1&quot;</span>
            {"\n"}{"  "}<span className="cm">{"→ endpoint: 'https://api.openai.com/v1/responses'"}</span>
            {"\n"}
            {"\n"}<span className="str">&quot;https://api.openai.com/v1/chat/completions&quot;</span>
            {"\n"}{"  "}<span className="cm">{"→ endpoint: 'https://api.openai.com/v1/responses'"}</span>
            {"\n"}
            {"\n"}<span className="str">&quot;https://my.openai.azure.com/openai/deployments/codex&quot;</span>
            {"\n"}{"  "}<span className="cm">{"→ endpoint: 'https://my.openai.azure.com/openai/responses'"}</span>
            {"\n"}{"  "}<span className="cm">{"→ isAzure: true"}</span>
          </CodeBlock>
        </section>
      </RevealOnScroll>

      {/* ─── 5. 트러블슈팅 (Troubleshooting) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔧</span> 트러블슈팅
          </h2>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Responses API 400 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              가장 흔한 원인은 <code className="text-cyan-600">function_call</code>에 매칭되는
              <code className="text-cyan-600">function_call_output</code>이 누락된 경우입니다.
              dbcode는 이를 자동으로 감지하여 플레이스홀더를 생성하지만, 다른 원인일 수 있습니다:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-1 list-disc list-inside">
              <li>빈 <code className="text-cyan-600">input</code> 배열 &mdash; 최소 하나의 메시지가 필요</li>
              <li>잘못된 모델 이름 &mdash; Codex 모델명을 정확히 확인하세요</li>
              <li>지원되지 않는 파라미터 &mdash; Responses API는 Chat Completions API의 모든 파라미터를 지원하지 않습니다</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Model or endpoint not found (404) 에러가 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">baseURL</code>이 올바른지 확인하세요.
              <code className="text-cyan-600">buildResponsesEndpoint()</code>가 URL을 정규화하지만,
              기본 경로 자체가 잘못되면 404가 발생합니다. Azure를 사용하는 경우
              <code className="text-cyan-600">api-version</code> 쿼리 파라미터도 확인하세요.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Failed to connect to Responses API after retries&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              네트워크 수준의 에러(DNS 실패, 연결 거부 등)가 3회 재시도 후에도 해결되지 않았습니다.
              인터넷 연결, 프록시 설정, 방화벽 규칙을 확인하세요.
              <code className="text-cyan-600">DBCODE_VERBOSE=1</code> 환경변수를 설정하면
              상세 로그를 확인할 수 있습니다.
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
                name: "provider.ts",
                slug: "llm-provider",
                relation: "parent",
                desc: "ResponsesAPIClient가 구현하는 LLMProvider 인터페이스 및 핵심 타입 정의",
              },
              {
                name: "model-router.ts",
                slug: "model-router",
                relation: "sibling",
                desc: "resolveProvider()가 Codex 모델을 감지하여 ResponsesAPIClient를 생성하는 라우터",
              },
              {
                name: "anthropic.ts",
                slug: "anthropic-provider",
                relation: "sibling",
                desc: "Anthropic Claude 전용 프로바이더 — 유사한 fetch 기반 직접 구현 패턴",
              },
              {
                name: "token-counter.ts",
                slug: "token-counter",
                relation: "sibling",
                desc: "countTokens() 메서드가 위임하는 실제 토큰 계산 모듈",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
