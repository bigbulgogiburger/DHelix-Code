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

export default function LLMClientPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/llm/client.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              OpenAICompatibleClient
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            OpenAI 호환 LLM API 클라이언트 — 스트리밍, 자동 재시도, Responses API 분기, 에러 분류를 담당합니다.
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
              <code className="text-cyan-600">OpenAICompatibleClient</code>는 OpenAI API 형식을 따르는
              모든 LLM 서버와 HTTP 통신을 담당하는 핵심 인프라 모듈입니다.
              OpenAI, Azure OpenAI, Ollama, vLLM, llama.cpp 등 다양한 프로바이더를 하나의 인터페이스로 통합합니다.
            </p>
            <p>
              이 모듈은 <code className="text-cyan-600">LLMProvider</code> 인터페이스를 구현하여,
              상위 모듈(Agent Loop, Dual-Model Router)이 프로바이더 구현 세부사항을 몰라도
              LLM을 호출할 수 있게 합니다. 동기식 <code className="text-cyan-600">chat()</code>과
              실시간 <code className="text-cyan-600">stream()</code> 두 가지 호출 방식을 제공합니다.
            </p>
            <p>
              네트워크 불안정이나 서버 과부하 같은 일시적 에러가 발생하면 지수 백오프(exponential backoff)로
              자동 재시도합니다. 단, Rate Limit(429) 에러는 클라이언트 측 재시도가 오히려 상황을 악화시키므로
              즉시 실패 처리합니다. 또한 Codex 모델은 Chat Completions API 대신 Responses API로
              자동 라우팅됩니다.
            </p>
          </div>

          <MermaidDiagram
            title="LLM Client 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AL["Agent Loop<br/><small>core/agent-loop.ts</small>"]
  DR["Dual-Model Router<br/><small>llm/model-router.ts</small>"]
  CLIENT["OpenAICompatibleClient<br/><small>llm/client.ts</small>"]
  CF["Client Factory<br/><small>llm/client-factory.ts</small>"]
  MC["Model Capabilities<br/><small>llm/model-capabilities.ts</small>"]
  TC["Token Counter<br/><small>llm/token-counter.ts</small>"]
  API["OpenAI 호환 API 서버<br/><small>OpenAI / Azure / Ollama / vLLM</small>"]

  AL -->|"chat / stream"| DR
  DR -->|"요청 위임"| CLIENT
  CF -->|"클라이언트 생성"| CLIENT
  CLIENT -->|"모델 능력 조회"| MC
  CLIENT -->|"토큰 수 계산"| TC
  CLIENT -->|"HTTP 요청"| API

  style CLIENT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style DR fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CF fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style MC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style API fill:#f1f5f9,stroke:#22c55e,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 해외 여행 시 사용하는 멀티 어댑터(만능 충전기)를 떠올리세요.
            나라마다 콘센트 규격이 다르지만, 멀티 어댑터가 있으면 어디서든 같은 방식으로 충전할 수 있습니다.
            마찬가지로 이 모듈은 다양한 LLM API 서버의 차이를 흡수하여, 상위 모듈이 항상
            동일한 인터페이스로 LLM을 호출할 수 있게 합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* OpenAIClientConfig interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface OpenAIClientConfig
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            OpenAI 호환 클라이언트를 생성할 때 전달하는 설정 객체입니다.
            baseURL만 필수이고, 나머지는 선택적으로 제공합니다.
          </p>
          <ParamTable
            params={[
              { name: "baseURL", type: "string", required: true, desc: "API 서버의 기본 URL (예: \"https://api.openai.com/v1\")" },
              { name: "apiKey", type: "string | undefined", required: false, desc: "API 인증 키 (없으면 \"no-key-required\" — 로컬 모델용)" },
              { name: "timeout", type: "number | undefined", required: false, desc: "요청 타임아웃(밀리초) — 기본값 120,000ms (2분)" },
            ]}
          />

          {/* 재시도 관련 상수 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            재시도 관련 상수
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            자동 재시도 동작을 제어하는 모듈 내부 상수들입니다. 외부에서 변경할 수 없습니다.
          </p>
          <ParamTable
            params={[
              { name: "MAX_RETRIES_TRANSIENT", type: "3", required: true, desc: "일시적 에러(500, 502, 503)에 대한 최대 재시도 횟수" },
              { name: "MAX_RETRIES_RATE_LIMIT", type: "0", required: true, desc: "Rate Limit(429) 에러 시 재시도 횟수 — 0이므로 즉시 실패" },
              { name: "BASE_RETRY_DELAY_MS", type: "1,000", required: true, desc: "일시적 에러 재시도의 기본 대기 시간 (1초)" },
              { name: "BASE_RATE_LIMIT_DELAY_MS", type: "5,000", required: true, desc: "Rate Limit 에러 시 기본 대기 시간 (5초)" },
              { name: "MAX_RATE_LIMIT_DELAY_MS", type: "60,000", required: true, desc: "Rate Limit 백오프 최대 대기 시간 (60초 상한)" },
            ]}
          />

          {/* OpenAICompatibleClient class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class OpenAICompatibleClient implements LLMProvider
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            OpenAI API 형식을 따르는 모든 서비스와 통신할 수 있는 범용 LLM 클라이언트입니다.
            <code className="text-cyan-600">LLMProvider</code> 인터페이스를 구현하여 상위 모듈에서
            프로바이더 독립적으로 사용할 수 있습니다.
          </p>

          {/* Constructor */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            constructor
          </h4>
          <CodeBlock>
            <span className="kw">constructor</span>(<span className="prop">config</span>: <span className="type">OpenAIClientConfig</span>)
          </CodeBlock>
          <ParamTable
            params={[
              { name: "config", type: "OpenAIClientConfig", required: true, desc: "클라이언트 설정 — baseURL을 정규화하고, Azure인 경우 전용 헤더/쿼리를 자동 설정" },
            ]}
          />

          {/* chat */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            chat(request)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            동기식 채팅 요청을 보내고 전체 응답을 받습니다.
            일시적 에러 발생 시 지수 백오프로 최대 3번 재시도합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">chat</span>(<span className="prop">request</span>: <span className="type">ChatRequest</span>): <span className="type">Promise</span>&lt;<span className="type">ChatResponse</span>&gt;
          </CodeBlock>
          <ParamTable
            params={[
              { name: "request", type: "ChatRequest", required: true, desc: "채팅 요청 — model, messages, tools, maxTokens, temperature, signal 포함" },
            ]}
          />

          {/* stream */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            stream(request)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            스트리밍 채팅 요청을 보내고 실시간 청크를 받습니다.
            에러 발생 시 처음부터 재시도합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> *<span className="fn">stream</span>(<span className="prop">request</span>: <span className="type">ChatRequest</span>): <span className="type">AsyncIterable</span>&lt;<span className="type">ChatChunk</span>&gt;
          </CodeBlock>
          <ParamTable
            params={[
              { name: "request", type: "ChatRequest", required: true, desc: "채팅 요청 — chat()과 동일한 파라미터" },
            ]}
          />
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <code className="text-cyan-600">text-delta</code> &mdash; 텍스트 응답 조각</p>
            <p>&bull; <code className="text-cyan-600">tool-call-delta</code> &mdash; 도구 호출 인자 조각 (여러 청크에 걸쳐 누적됨)</p>
            <p>&bull; <code className="text-cyan-600">done</code> &mdash; 스트리밍 완료 신호 (usage + finishReason 포함)</p>
          </div>

          {/* countTokens */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            countTokens(text)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            텍스트의 토큰 수를 계산합니다. 내부적으로 <code className="text-cyan-600">token-counter</code> 모듈에 위임합니다.
          </p>
          <CodeBlock>
            <span className="fn">countTokens</span>(<span className="prop">text</span>: <span className="type">string</span>): <span className="type">number</span>
          </CodeBlock>

          {/* createLLMClient 팩토리 함수 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            createLLMClient(config)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            OpenAI 호환 클라이언트를 생성하는 팩토리 함수입니다.
            <code className="text-cyan-600">/model</code> 명령에서 프로바이더를 전환할 때
            새 클라이언트를 동적으로 생성하는 데 사용됩니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">createLLMClient</span>(<span className="prop">config</span>: <span className="type">OpenAIClientConfig</span>): <span className="type">OpenAICompatibleClient</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              Rate Limit(429) 에러는 <strong>클라이언트에서 재시도하지 않습니다</strong>.
              <code className="text-cyan-600">MAX_RETRIES_RATE_LIMIT = 0</code>이므로 즉시 실패 처리됩니다.
              서버 측에서 이미 요청을 제한하고 있으므로, 클라이언트에서 재시도하면 오히려 상황이 악화됩니다.
            </li>
            <li>
              OpenAI SDK의 내장 재시도 기능은 <code className="text-cyan-600">maxRetries: 0</code>으로
              비활성화되어 있습니다. 재시도 로직은 이 모듈이 직접 제어합니다.
            </li>
            <li>
              Codex 모델(<code className="text-cyan-600">gpt-5-codex</code> 등)은
              Chat Completions API 대신 Responses API(<code className="text-cyan-600">/responses</code> 엔드포인트)로
              자동 라우팅됩니다. 모델명에 &quot;codex&quot;가 포함되면 자동 감지됩니다.
            </li>
            <li>
              Azure OpenAI를 사용할 때는 baseURL이 자동으로 정규화되며,
              <code className="text-cyan-600">api-version</code> 쿼리와 <code className="text-cyan-600">api-key</code> 헤더가
              자동으로 추가됩니다.
            </li>
            <li>
              스트리밍에서 도구 호출 인자는 여러 청크에 걸쳐 점진적으로 조립됩니다.
              <code className="text-cyan-600">Map&lt;index, toolCall&gt;</code>으로 조각을 누적하므로,
              최종 <code className="text-cyan-600">done</code> 청크를 받기 전까지 도구 호출이 완전하지 않을 수 있습니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 클라이언트 생성 및 채팅 요청</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 기본적인 사용 패턴입니다. 클라이언트를 생성하고 동기식 채팅 요청을 보냅니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. 클라이언트 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">client</span> = <span className="fn">createLLMClient</span>({"{"}
            {"\n"}{"  "}<span className="prop">baseURL</span>: <span className="str">&quot;https://api.openai.com/v1&quot;</span>,
            {"\n"}{"  "}<span className="prop">apiKey</span>: <span className="prop">process</span>.<span className="prop">env</span>.<span className="prop">OPENAI_API_KEY</span>,
            {"\n"}{"  "}<span className="prop">timeout</span>: <span className="num">120_000</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 동기식 채팅 요청"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">response</span> = <span className="kw">await</span> <span className="prop">client</span>.<span className="fn">chat</span>({"{"}
            {"\n"}{"  "}<span className="prop">model</span>: <span className="str">&quot;gpt-4o&quot;</span>,
            {"\n"}{"  "}<span className="prop">messages</span>: [
            {"\n"}{"    "}{"{"} <span className="prop">role</span>: <span className="str">&quot;system&quot;</span>, <span className="prop">content</span>: <span className="str">&quot;You are a helpful assistant.&quot;</span> {"}"},
            {"\n"}{"    "}{"{"} <span className="prop">role</span>: <span className="str">&quot;user&quot;</span>, <span className="prop">content</span>: <span className="str">&quot;안녕하세요&quot;</span> {"}"},
            {"\n"}{"  "}],
            {"\n"}{"  "}<span className="prop">maxTokens</span>: <span className="num">1024</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="prop">response</span>.<span className="prop">content</span>);
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="prop">response</span>.<span className="prop">usage</span>.<span className="prop">totalTokens</span>);
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> baseURL에 <code>/chat/completions</code>이나 <code>/responses</code> 같은
            엔드포인트 경로를 포함하지 마세요. OpenAI SDK가 자동으로 추가하므로 중복됩니다.
            이 모듈이 <code>normalizeBaseUrl()</code>로 자동 제거하지만, 처음부터 포함하지 않는 것이 좋습니다.
          </Callout>

          {/* 스트리밍 사용법 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 스트리밍으로 실시간 응답 받기
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">stream()</code>은 <code className="text-cyan-600">AsyncIterable</code>을 반환합니다.
            <code className="text-cyan-600">for await...of</code> 루프로 실시간 청크를 처리합니다.
          </p>
          <CodeBlock>
            <span className="kw">for await</span> (<span className="kw">const</span> <span className="prop">chunk</span> <span className="kw">of</span> <span className="prop">client</span>.<span className="fn">stream</span>(<span className="prop">request</span>)) {"{"}
            {"\n"}{"  "}<span className="kw">switch</span> (<span className="prop">chunk</span>.<span className="prop">type</span>) {"{"}
            {"\n"}{"    "}<span className="kw">case</span> <span className="str">&quot;text-delta&quot;</span>:
            {"\n"}{"      "}<span className="cm">{"// 텍스트 조각을 UI에 실시간 표시"}</span>
            {"\n"}{"      "}<span className="prop">process</span>.<span className="prop">stdout</span>.<span className="fn">write</span>(<span className="prop">chunk</span>.<span className="prop">text</span>);
            {"\n"}{"      "}<span className="kw">break</span>;
            {"\n"}{"    "}<span className="kw">case</span> <span className="str">&quot;tool-call-delta&quot;</span>:
            {"\n"}{"      "}<span className="cm">{"// 도구 호출 인자가 점진적으로 도착"}</span>
            {"\n"}{"      "}<span className="fn">handleToolCallDelta</span>(<span className="prop">chunk</span>.<span className="prop">toolCall</span>);
            {"\n"}{"      "}<span className="kw">break</span>;
            {"\n"}{"    "}<span className="kw">case</span> <span className="str">&quot;done&quot;</span>:
            {"\n"}{"      "}<span className="cm">{"// 스트리밍 완료 — 토큰 사용량 확인"}</span>
            {"\n"}{"      "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">&quot;토큰:&quot;</span>, <span className="prop">chunk</span>.<span className="prop">usage</span>?.<span className="prop">totalTokens</span>);
            {"\n"}{"      "}<span className="kw">break</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> 스트리밍 중 도구 호출 인자는 여러 청크에 나뉘어 도착합니다.
            <code>tool-call-delta</code> 이벤트의 <code>arguments</code> 필드를 누적하여
            완전한 JSON을 조립해야 합니다. 이 모듈은 내부적으로 <code>Map&lt;index, toolCall&gt;</code>으로
            자동 누적합니다.
          </Callout>

          {/* 로컬 모델 사용 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 로컬 모델 (Ollama) 연결
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            로컬에서 실행되는 Ollama 같은 서버에 연결할 때는 API 키가 필요 없습니다.
            <code className="text-cyan-600">apiKey</code>를 생략하면 자동으로 <code className="text-cyan-600">&quot;no-key-required&quot;</code>로 설정됩니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">localClient</span> = <span className="fn">createLLMClient</span>({"{"}
            {"\n"}{"  "}<span className="prop">baseURL</span>: <span className="str">&quot;http://localhost:11434/v1&quot;</span>,
            {"\n"}{"  "}<span className="cm">{"// apiKey 생략 → \"no-key-required\"로 자동 설정"}</span>
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="kw">const</span> <span className="prop">response</span> = <span className="kw">await</span> <span className="prop">localClient</span>.<span className="fn">chat</span>({"{"}
            {"\n"}{"  "}<span className="prop">model</span>: <span className="str">&quot;llama3.1:8b&quot;</span>,
            {"\n"}{"  "}<span className="prop">messages</span>: [{"{"} <span className="prop">role</span>: <span className="str">&quot;user&quot;</span>, <span className="prop">content</span>: <span className="str">&quot;Hello&quot;</span> {"}"}],
            {"\n"}{"}"});
          </CodeBlock>

          <DeepDive title="Azure OpenAI 연결 시 URL 정규화 과정">
            <p className="mb-3">
              Azure OpenAI의 URL은 일반 OpenAI URL과 형식이 다릅니다. 이 모듈의
              <code className="text-cyan-600">normalizeBaseUrl()</code> 함수가 자동으로 처리합니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li>엔드포인트 경로(<code>/chat/completions</code>, <code>/responses</code>) 자동 제거</li>
              <li><code>api-version</code> 쿼리 파라미터 자동 추출 (기본값: <code>2025-01-01-preview</code>)</li>
              <li><code>/deployments/&#123;배포명&#125;/...</code> 경로 자동 제거</li>
              <li><code>api-key</code> 헤더 자동 추가</li>
            </ul>
            <p className="mt-3 text-gray-600">
              Azure 여부는 URL 도메인으로 판단합니다:
              <code className="text-cyan-600">.openai.azure.com</code> 또는
              <code className="text-cyan-600">.cognitiveservices.azure.com</code>이 포함되면 Azure로 인식합니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>요청 흐름 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">chat()</code>과 <code className="text-cyan-600">stream()</code> 메서드의
            내부 요청 흐름입니다. 모델에 따라 Chat Completions API 또는 Responses API로 분기하고,
            에러 발생 시 재시도 루프를 실행합니다.
          </p>

          <MermaidDiagram
            title="요청 처리 흐름"
            titleColor="purple"
            chart={`graph TD
  START(("시작")) --> REQ["요청 수신<br/><small>chat/stream 메서드 호출</small>"]
  REQ --> CODEX{"Codex 모델?<br/><small>모델명에 codex 포함?</small>"}

  CODEX -->|"일반 모델"| CHAT_API["Chat Completions API<br/><small>표준 OpenAI 호출</small>"]
  CODEX -->|"Codex 모델"| RESP_API["Responses API<br/><small>Codex 전용 엔드포인트</small>"]

  subgraph CHAT_DETAIL["Chat Completions 상세"]
    MSG_CONV["메시지 변환<br/><small>toOpenAIMessages 호출</small>"]
    PARAM["파라미터 조립<br/><small>max_tokens 설정</small>"]
    API_CALL["API 호출<br/><small>HTTP 요청 전송</small>"]
    MSG_CONV --> PARAM --> API_CALL
  end

  subgraph RESP_DETAIL["Responses API 상세"]
    INPUT_CONV["입력 변환<br/><small>toResponsesInput 호출</small>"]
    TOOL_CONV["도구 변환<br/><small>toResponsesTools 호출</small>"]
    RESP_CALL["Responses 호출<br/><small>HTTP 요청 전송</small>"]
    INPUT_CONV --> TOOL_CONV --> RESP_CALL
  end

  CHAT_API --> CHAT_DETAIL
  RESP_API --> RESP_DETAIL

  API_CALL --> RESULT{"결과 판단<br/><small>성공 또는 실패?</small>"}
  RESP_CALL --> RESULT

  RESULT -->|"성공"| RESPONSE["응답 반환<br/><small>ChatResponse 생성</small>"]
  RESULT -->|"실패"| ERR_CLASS{"에러 분류<br/><small>에러 유형 판별</small>"}

  ERR_CLASS -->|"일시적 에러<br/>(500/502/503)"| RETRY["재시도 대기<br/><small>지수 백오프 후 재시도</small>"]
  ERR_CLASS -->|"Rate Limit (429)"| FAIL["즉시 실패<br/><small>재시도 없이 에러 반환</small>"]
  ERR_CLASS -->|"영구적 에러<br/>(401/403)"| FAIL

  RETRY -->|"지수 백오프 후"| REQ
  FAIL --> LLM_ERR["LLMError<br/><small>분류된 에러 throw</small>"]
  RESPONSE --> END(("종료"))
  LLM_ERR --> END

  style RESPONSE fill:#dcfce7,stroke:#10b981,color:#065f46
  style FAIL fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style LLM_ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style RETRY fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style CHAT_API fill:#dbeafe,stroke:#3b82f6,color:#1e40af
  style RESP_API fill:#ede9fe,stroke:#8b5cf6,color:#5b21b6`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; 재시도 로직</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">chat()</code> 메서드의 재시도 루프입니다.
            에러 유형에 따라 재시도 여부와 대기 시간을 결정합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">chat</span>(<span className="prop">request</span>: <span className="type">ChatRequest</span>): <span className="type">Promise</span>&lt;<span className="type">ChatResponse</span>&gt; {"{"}
            {"\n"}{"  "}<span className="kw">let</span> <span className="prop">lastError</span>: <span className="type">unknown</span>;
            {"\n"}
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">let</span> <span className="prop">attempt</span> = <span className="num">0</span>; ; <span className="prop">attempt</span>++) {"{"}
            {"\n"}{"    "}<span className="kw">try</span> {"{"}
            {"\n"}{"      "}<span className="cm">{"// [1] 요청 실행 — 모델에 따라 API 자동 선택"}</span>
            {"\n"}{"      "}<span className="kw">return await</span> <span className="kw">this</span>.<span className="fn">_chatOnce</span>(<span className="prop">request</span>);
            {"\n"}{"    "}<span className="kw">{"}"} catch</span> (<span className="prop">error</span>) {"{"}
            {"\n"}{"      "}<span className="prop">lastError</span> = <span className="prop">error</span>;
            {"\n"}
            {"\n"}{"      "}<span className="cm">{"// [2] 이미 분류된 LLMError → 재시도 불필요"}</span>
            {"\n"}{"      "}<span className="kw">if</span> (<span className="prop">error</span> <span className="kw">instanceof</span> <span className="type">LLMError</span>) <span className="kw">throw</span> <span className="prop">error</span>;
            {"\n"}{"      "}<span className="cm">{"// [3] 재시도 불가능한 에러 → 루프 탈출"}</span>
            {"\n"}{"      "}<span className="kw">if</span> (!<span className="fn">isRetryableError</span>(<span className="prop">error</span>)) <span className="kw">break</span>;
            {"\n"}
            {"\n"}{"      "}<span className="cm">{"// [4] Rate Limit → limit=0이므로 즉시 탈출"}</span>
            {"\n"}{"      "}<span className="kw">const</span> <span className="prop">limit</span> = <span className="fn">isRateLimitError</span>(<span className="prop">error</span>) ? <span className="num">0</span> : <span className="num">3</span>;
            {"\n"}{"      "}<span className="kw">if</span> (<span className="prop">attempt</span> {">="} <span className="prop">limit</span>) <span className="kw">break</span>;
            {"\n"}
            {"\n"}{"      "}<span className="cm">{"// [5] 지수 백오프 대기: 1s → 2s → 4s"}</span>
            {"\n"}{"      "}<span className="kw">const</span> <span className="prop">delay</span> = <span className="fn">getRetryDelay</span>(<span className="prop">error</span>, <span className="prop">attempt</span>);
            {"\n"}{"      "}<span className="kw">await</span> <span className="fn">sleep</span>(<span className="prop">delay</span>);
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="cm">{"// [6] 모든 재시도 실패 → LLMError로 분류하여 throw"}</span>
            {"\n"}{"  "}<span className="kw">throw</span> <span className="fn">classifyError</span>(<span className="prop">lastError</span>, <span className="str">&quot;chat request&quot;</span>, <span className="prop">request</span>.<span className="prop">model</span>);
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> <code className="text-cyan-600">_chatOnce()</code>가 내부적으로 모델명을 확인하여 Chat Completions API 또는 Responses API를 선택합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 이미 <code className="text-cyan-600">LLMError</code>로 분류된 에러는 재시도 없이 그대로 전파합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 인증 에러(401), 권한 에러(403) 등 시간이 지나도 해결되지 않는 에러는 즉시 실패 처리합니다.</p>
            <p><strong className="text-gray-900">[4]</strong> Rate Limit(429) 에러의 재시도 한도가 0이므로, <code className="text-cyan-600">attempt &gt;= 0</code>은 항상 참이라 즉시 루프를 탈출합니다.</p>
            <p><strong className="text-gray-900">[5]</strong> 지수 백오프: <code className="text-cyan-600">BASE_RETRY_DELAY_MS * 2^attempt</code>로 대기 시간이 기하급수적으로 증가합니다. Retry-After 헤더가 있으면 서버 지정 시간을 우선 사용합니다.</p>
            <p><strong className="text-gray-900">[6]</strong> 모든 재시도가 실패하면 <code className="text-cyan-600">classifyError()</code>가 OpenAI SDK 에러를 사용자 친화적인 메시지의 <code className="text-cyan-600">LLMError</code>로 변환합니다.</p>
          </div>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>에러 분류 체계</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">classifyError()</code> 함수는 OpenAI SDK의 다양한 에러 타입을
            사용자가 이해할 수 있는 <code className="text-cyan-600">LLMError</code>로 변환합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 에러 분류 우선순위"}</span>
            {"\n"}<span className="type">AuthenticationError</span>  <span className="cm">→ &quot;API 키 확인 필요&quot;</span>
            {"\n"}<span className="type">PermissionDeniedError</span> <span className="cm">→ &quot;모델 접근 권한 없음&quot;</span>
            {"\n"}<span className="type">RateLimitError</span>       <span className="cm">→ &quot;요청 제한 초과&quot; + retryAfterMs</span>
            {"\n"}<span className="type">APIConnectionTimeoutError</span> <span className="cm">→ &quot;응답 타임아웃&quot;</span>
            {"\n"}<span className="type">APIConnectionError</span>   <span className="cm">→ &quot;네트워크 연결 실패&quot;</span>
            {"\n"}<span className="type">APIError</span>             <span className="cm">→ &quot;HTTP 상태 코드 + 메시지&quot;</span>
            {"\n"}<span className="type">unknown</span>              <span className="cm">→ &quot;LLM 작업 실패&quot;</span>
          </CodeBlock>

          <DeepDive title="스트리밍 도구 호출 누적(Map accumulation) 상세">
            <p className="mb-3">
              LLM은 도구 호출 인자를 한 번에 보내지 않고 여러 청크에 나눠서 전송합니다.
              이 모듈은 <code className="text-cyan-600">Map&lt;number, toolCall&gt;</code>으로
              각 도구 호출의 조각을 인덱스별로 누적합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 도구 호출 누적 구조"}</span>
              {"\n"}<span className="kw">const</span> <span className="prop">toolCallsInProgress</span> = <span className="kw">new</span> <span className="type">Map</span>&lt;<span className="type">number</span>, {"{"}
              {"\n"}{"  "}<span className="prop">id</span>: <span className="type">string</span>;
              {"\n"}{"  "}<span className="prop">name</span>: <span className="type">string</span>;
              {"\n"}{"  "}<span className="prop">arguments</span>: <span className="type">string</span>;  <span className="cm">{"// 점진적으로 이어 붙임"}</span>
              {"\n"}{"}"}{">"};
              {"\n"}
              {"\n"}<span className="cm">{"// 청크 도착 시:"}</span>
              {"\n"}<span className="cm">{"// 기존 도구 호출이면 → arguments에 조각을 이어 붙임"}</span>
              {"\n"}<span className="cm">{"// 새로운 도구 호출이면 → Map에 새 엔트리 추가"}</span>
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              <code className="text-cyan-600">tc.index</code>가 키이므로 LLM이 동시에 여러 도구를 호출할 때도
              각 도구 호출을 독립적으로 누적할 수 있습니다. 이 패턴은 Chat Completions API 스트리밍에서만
              사용되며, Responses API는 <code className="text-cyan-600">function_call_arguments.done</code>
              이벤트로 완성된 인자를 한 번에 전달합니다.
            </p>
          </DeepDive>
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
              &quot;Authentication failed. Check your API key&quot; 에러가 나요
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              API 키가 올바른지 확인하세요. 환경변수 <code className="text-cyan-600">OPENAI_API_KEY</code> 또는
              <code className="text-cyan-600">DBCODE_API_KEY</code>가 설정되어 있어야 합니다.
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>API 키가 만료되었거나 취소된 경우에도 이 에러가 발생합니다.</li>
              <li>로컬 모델(Ollama 등)을 사용한다면 <code className="text-cyan-600">apiKey</code>를 생략하거나 빈 문자열로 설정하세요.</li>
              <li>Azure OpenAI를 사용한다면 <code className="text-cyan-600">api-key</code> 헤더가 자동 추가되는지 확인하세요.</li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Rate limit exceeded&quot; 에러가 자주 발생해요
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              이 모듈은 Rate Limit(429) 에러를 <strong>재시도하지 않고</strong> 즉시 상위로 전파합니다.
              이는 의도된 동작입니다:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>서버가 이미 요청을 제한하고 있으므로, 클라이언트에서 재시도하면 제한이 더 길어질 수 있습니다.</li>
              <li>OpenAI 대시보드에서 사용량(Usage)을 확인하고, 필요하면 API 사용량 한도를 높이세요.</li>
              <li><code className="text-cyan-600">LLMError</code>의 <code className="text-cyan-600">retryAfterMs</code> 필드에 서버가 제안한 대기 시간이 포함됩니다.</li>
            </ul>
            <Callout type="tip" icon="*">
              <code>Retry-After</code> 헤더가 응답에 포함되어 있다면, <code>retryAfterMs</code> 값을 활용하여
              상위 모듈에서 적절한 시간만큼 대기 후 재시도할 수 있습니다.
            </Callout>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Request timed out&quot; 에러가 발생해요
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              기본 타임아웃은 120초(2분)입니다. 대형 모델이나 긴 프롬프트를 사용할 때
              응답 시간이 초과될 수 있습니다:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li><code className="text-cyan-600">OpenAIClientConfig</code>의 <code className="text-cyan-600">timeout</code>을 늘려보세요 (예: <code>180_000</code> = 3분).</li>
              <li>네트워크가 불안정한 경우에도 타임아웃 에러가 발생합니다. VPN이나 방화벽을 확인하세요.</li>
              <li>이 에러는 <code className="text-cyan-600">isRetryableError()</code>에서 재시도 대상으로 분류되므로, 자동으로 최대 3번 재시도합니다.</li>
            </ul>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              Codex 모델인데 Chat Completions API로 요청이 가요
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              Responses API 라우팅은 모델명에 <code className="text-cyan-600">&quot;codex&quot;</code> 문자열이
              포함되어 있는지로 판단합니다 (대소문자 무시):
            </p>
            <CodeBlock>
              <span className="cm">{"// 이 함수가 true를 반환하면 Responses API 사용"}</span>
              {"\n"}<span className="kw">function</span> <span className="fn">isResponsesApiModel</span>(<span className="prop">model</span>: <span className="type">string</span>): <span className="type">boolean</span> {"{"}
              {"\n"}{"  "}<span className="kw">return</span> <span className="prop">model</span>.<span className="fn">toLowerCase</span>().<span className="fn">includes</span>(<span className="str">&quot;codex&quot;</span>);
              {"\n"}{"}"}
            </CodeBlock>
            <p className="text-[13px] text-gray-600 leading-relaxed mt-3">
              모델명에 &quot;codex&quot;가 포함되지 않으면 일반 Chat Completions API로 요청됩니다.
              커스텀 모델명을 사용하는 경우 이 점을 확인하세요.
            </p>
          </div>

          {/* FAQ 5 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;No response choice from LLM&quot; 에러가 나요
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              LLM 서버가 응답을 반환했지만 <code className="text-cyan-600">choices</code> 배열이 비어 있을 때
              발생합니다. 주로 로컬 서버(vLLM, llama.cpp)에서 모델 로딩이 완료되지 않았거나,
              요청 파라미터가 해당 서버와 호환되지 않을 때 나타납니다.
              서버 로그를 확인하여 모델이 정상적으로 로드되었는지 점검하세요.
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
                name: "agent-loop.ts",
                slug: "agent-loop",
                relation: "parent",
                desc: "Agent Loop에서 LLM 클라이언트를 호출하여 ReAct 사이클을 실행하는 메인 루프",
              },
              {
                name: "dual-model-router.ts",
                slug: "dual-model-router",
                relation: "sibling",
                desc: "두 개의 LLM 클라이언트를 관리하여 작업 유형에 따라 적절한 모델로 라우팅",
              },
              {
                name: "model-capabilities.ts",
                slug: "model-capabilities",
                relation: "child",
                desc: "모델별 능력 정보(temperature 지원, system 메시지 지원 등)를 조회하여 요청 파라미터를 조정",
              },
              {
                name: "token-counter.ts",
                slug: "token-counter",
                relation: "child",
                desc: "텍스트의 토큰 수를 계산 — countTokens() 메서드가 내부적으로 위임하는 대상",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
