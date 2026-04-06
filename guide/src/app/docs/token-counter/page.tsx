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

export default function TokenCounterPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ──────────────────────────────────────────────
            1. Header
        ────────────────────────────────────────────── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/llm/token-counter.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4 text-gray-900">
              Token Counter
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              텍스트의 토큰 수를 정확하게 계산하거나 빠르게 추정하는 모듈입니다. LRU 캐시를 내장하여
              반복 계산을 방지합니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ──────────────────────────────────────────────
            2. 개요
        ────────────────────────────────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📋</span> 개요
            </h2>

            <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
              LLM(대규모 언어 모델)은 텍스트를 <strong className="text-gray-900">토큰</strong>{" "}
              단위로 처리합니다. 토큰은 단어, 단어의 일부, 또는 특수 문자일 수 있습니다. 예를 들어{" "}
              <code className="text-cyan-600 text-[13px]">{'"Hello, world!"'}</code>는
              <code className="text-cyan-600 text-[13px]">{`["Hello", ",", " world", "!"]`}</code>{" "}
              총 4개의 토큰으로 분리됩니다.
            </p>

            <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
              토큰 수를 정확히 아는 것이 중요한 이유는 세 가지입니다:
            </p>
            <ul className="list-none flex flex-col gap-2 mb-6 text-[14px] text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-cyan-600 mt-0.5">1.</span>
                <span>
                  <strong className="text-gray-900">컨텍스트 윈도우 관리</strong> — 모델마다 최대
                  토큰 한도(예: 128K)가 있어 초과하면 요청이 실패합니다.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-600 mt-0.5">2.</span>
                <span>
                  <strong className="text-gray-900">API 비용 계산</strong> — LLM API는 토큰 단위로
                  과금되므로, 비용 예측에 필수입니다.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-600 mt-0.5">3.</span>
                <span>
                  <strong className="text-gray-900">프롬프트 최적화</strong> — 토큰 수를 알아야
                  컨텍스트를 효율적으로 구성할 수 있습니다.
                </span>
              </li>
            </ul>

            <p className="text-[14px] text-gray-600 leading-[1.85] mb-6">
              이 모듈은 <strong className="text-gray-900">정확한 계산</strong>(
              <code className="text-cyan-600 text-[13px]">countTokens</code>)과{" "}
              <strong className="text-gray-900">빠른 추정</strong>(
              <code className="text-cyan-600 text-[13px]">estimateTokens</code>) 두 가지 방법을
              제공하며, 상황에 따라 적절한 함수를 선택해 사용합니다.
            </p>

            <MermaidDiagram
              title="LLM 레이어에서 Token Counter의 위치"
              titleColor="green"
              chart={`graph LR
  subgraph LLM["Layer 3: LLM"]
    CLIENT["llm/client.ts\\n(API 호출)<br/><small>LLM API 요청 전송</small>"]
    ROUTER["dual-model-router.ts\\n(모델 전환)<br/><small>모델 간 자동 라우팅</small>"]
    TC["token-counter.ts\\n(토큰 계산)<br/><small>토큰 수 계산 및 추정</small>"]
    CAP["model-capabilities.ts\\n(모델 정보)<br/><small>모델별 설정 레지스트리</small>"]
  end

  subgraph CORE["Layer 2: Core"]
    CTX["context-manager.ts<br/><small>대화 컨텍스트 관리</small>"]
    AGENT["agent-loop.ts<br/><small>ReAct 에이전트 루프</small>"]
  end

  CTX -->|"토큰 수 조회"| TC
  AGENT -->|"컨텍스트 크기 확인"| TC
  CLIENT -->|"요청 크기 계산"| TC
  TC -->|"인코딩 정보"| CAP

  style TC fill:#d1fae5,stroke:#10b981,color:#065f46,stroke-width:2px
  style CLIENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style ROUTER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CAP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CTX fill:#e0e7ff,stroke:#8b5cf6,color:#1e293b
  style AGENT fill:#e0e7ff,stroke:#8b5cf6,color:#1e293b`}
            />
          </section>
        </RevealOnScroll>

        {/* ──────────────────────────────────────────────
            3. 레퍼런스
        ────────────────────────────────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📖</span> 레퍼런스
            </h2>

            {/* countTokens */}
            <div className="mb-8">
              <h3
                className="text-[15px] font-bold text-cyan-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                countTokens(text): number
              </h3>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                tiktoken 라이브러리(<code className="text-violet-600 text-[12px]">o200k_base</code>{" "}
                인코딩)를 사용하여 텍스트의 토큰 수를{" "}
                <strong className="text-gray-900">정확하게</strong> 계산합니다. 내부적으로 LRU
                캐시를 사용하여 동일 텍스트에 대한 반복 계산을 방지합니다.
              </p>
              <ParamTable
                params={[
                  { name: "text", type: "string", required: true, desc: "토큰 수를 계산할 텍스트" },
                ]}
              />
              <p className="text-[12px] text-gray-400 mt-2">
                <strong>반환값:</strong> <code className="text-violet-600">number</code> — 정확한
                토큰 수
              </p>
            </div>

            {/* estimateTokens */}
            <div className="mb-8">
              <h3
                className="text-[15px] font-bold text-cyan-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                estimateTokens(text): number
              </h3>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                문자 수 기반으로 토큰 수를 <strong className="text-gray-900">빠르게 추정</strong>
                합니다. tiktoken보다 훨씬 빠르므로, 정확도보다 속도가 중요한 상황(예: 스트리밍 중
                실시간 표시)에서 사용합니다. 약{" "}
                <strong className="text-amber-600">~10% 오차</strong>가 있습니다.
              </p>
              <ParamTable
                params={[
                  { name: "text", type: "string", required: true, desc: "토큰 수를 추정할 텍스트" },
                ]}
              />
              <p className="text-[12px] text-gray-400 mt-2">
                <strong>반환값:</strong> <code className="text-violet-600">number</code> — 추정 토큰
                수
              </p>
            </div>

            {/* countMessageTokens */}
            <div className="mb-8">
              <h3
                className="text-[15px] font-bold text-cyan-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                {"countMessageTokens(messages): number"}
              </h3>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                채팅 메시지 배열의 총 토큰 수를 계산합니다. 각 메시지의 역할(role)/포맷팅
                오버헤드(~4토큰)와 마지막 어시스턴트 프라이밍(~2토큰)을 포함합니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "messages",
                    type: "readonly { role: string; content: string }[]",
                    required: true,
                    desc: "토큰 수를 계산할 채팅 메시지 배열",
                  },
                ]}
              />
              <p className="text-[12px] text-gray-400 mt-2">
                <strong>반환값:</strong> <code className="text-violet-600">number</code> — 오버헤드
                포함 총 토큰 수
              </p>
            </div>

            {/* getTokenCacheStats */}
            <div className="mb-8">
              <h3
                className="text-[15px] font-bold text-cyan-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                getTokenCacheStats(): TokenCacheStats
              </h3>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                현재 토큰 캐시의 적중/미적중 통계를 반환합니다. 진단(diagnostics) 용도로 사용합니다.
              </p>
              <p className="text-[12px] text-gray-400 mt-2">
                <strong>반환값:</strong> <code className="text-violet-600">TokenCacheStats</code> —
                hits, misses, hitRate, size 포함
              </p>
            </div>

            {/* resetTokenCache */}
            <div className="mb-8">
              <h3
                className="text-[15px] font-bold text-cyan-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                resetTokenCache(): void
              </h3>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                토큰 캐시를 완전히 초기화합니다. 모든 캐시 항목과 통계가 리셋됩니다. 주로 테스트에서
                격리(isolation)를 위해 사용합니다.
              </p>
            </div>

            {/* TokenCountCache class */}
            <div className="mb-8">
              <h3
                className="text-[15px] font-bold text-cyan-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                class TokenCountCache
              </h3>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                Map 기반 LRU(Least Recently Used) 캐시 클래스입니다. JavaScript{" "}
                <code className="text-violet-600 text-[12px]">Map</code>의 삽입 순서 보장 특성을
                활용하여 구현됩니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "maxSize",
                    type: "number",
                    required: false,
                    desc: "최대 캐시 항목 수 (기본값: 100)",
                  },
                ]}
              />
              <div className="mt-3 text-[13px] text-gray-600">
                <p className="mb-2">
                  <strong className="text-gray-900">메서드:</strong>
                </p>
                <ul className="list-none flex flex-col gap-1.5 ml-1">
                  <li>
                    <code className="text-cyan-600 text-[12px]">get(key)</code> — 캐시에서 토큰 수를
                    조회 (LRU 순서 갱신)
                  </li>
                  <li>
                    <code className="text-cyan-600 text-[12px]">set(key, count)</code> — 캐시에 토큰
                    수를 저장 (용량 초과 시 가장 오래된 항목 제거)
                  </li>
                  <li>
                    <code className="text-cyan-600 text-[12px]">getStats()</code> — 캐시 적중/미적중
                    통계 반환
                  </li>
                  <li>
                    <code className="text-cyan-600 text-[12px]">clear()</code> — 캐시 완전 초기화
                  </li>
                </ul>
              </div>
            </div>

            {/* TokenCacheStats interface */}
            <div className="mb-8">
              <h3
                className="text-[15px] font-bold text-cyan-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                interface TokenCacheStats
              </h3>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                캐시 통계를 표현하는 읽기 전용 인터페이스입니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "hits",
                    type: "readonly number",
                    required: true,
                    desc: "캐시 적중 횟수 - 캐시에서 바로 결과를 찾은 횟수",
                  },
                  {
                    name: "misses",
                    type: "readonly number",
                    required: true,
                    desc: "캐시 미적중 횟수 - 실제 계산을 수행한 횟수",
                  },
                  {
                    name: "hitRate",
                    type: "readonly number",
                    required: true,
                    desc: "적중률 (hits / total). 1에 가까울수록 캐시가 효과적",
                  },
                  {
                    name: "size",
                    type: "readonly number",
                    required: true,
                    desc: "현재 캐시에 저장된 항목 수",
                  },
                ]}
              />
            </div>

            {/* Caveats */}
            <DeepDive title="주의 사항 (Caveats)">
              <ul className="list-none flex flex-col gap-3">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5 shrink-0">1.</span>
                  <span>
                    <strong className="text-gray-900">인코딩 모델 고정:</strong> 현재{" "}
                    <code className="text-cyan-600 text-[12px]">o200k_base</code> 인코딩만
                    사용합니다. GPT-4o, GPT-5 등 최신 OpenAI 모델에 최적화되어 있으며, 다른
                    모델(Claude, Llama 등)에서는 실제 토큰 수와 차이가 있을 수 있습니다.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5 shrink-0">2.</span>
                  <span>
                    <strong className="text-gray-900">해시 충돌 가능성:</strong> LRU 캐시 키로
                    FNV-1a 해시를 사용하므로, 극히 드물지만 서로 다른 텍스트가 같은 해시 값을 가질
                    수 있습니다. 실무에서는 무시 가능한 수준입니다.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5 shrink-0">3.</span>
                  <span>
                    <strong className="text-gray-900">estimateTokens의 한계:</strong> 코드, 특수
                    문자가 많은 텍스트에서는 오차가 10%를 초과할 수 있습니다. 정확한 토큰 수가
                    필요한 경우 반드시{" "}
                    <code className="text-cyan-600 text-[12px]">countTokens</code>를 사용하세요.
                  </span>
                </li>
              </ul>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ──────────────────────────────────────────────
            4. 사용법
        ────────────────────────────────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🚀</span> 사용법
            </h2>

            {/* 기본 토큰 계산 */}
            <h3
              className="text-[15px] font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              기본 토큰 계산
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              가장 단순한 사용법입니다. 텍스트를 넘기면 tiktoken이 정확한 토큰 수를 반환합니다.
            </p>
            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#d2a8ff]">countTokens</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#d2a8ff]">estimateTokens</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./llm/token-counter.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 정확한 토큰 수 계산 (tiktoken 사용)"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">exact</span>{" "}
              <span className="text-[#ff7b72]">=</span>{" "}
              <span className="text-[#d2a8ff]">countTokens</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"Hello, world!"'}</span>
              <span className="text-[#c9d1d9]">);</span>
              {"\n"}
              <span className="text-[#8b949e]">{"// => 4"}</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 빠른 추정 (문자 수 기반, ~10% 오차)"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">estimated</span>{" "}
              <span className="text-[#ff7b72]">=</span>{" "}
              <span className="text-[#d2a8ff]">estimateTokens</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"Hello, world!"'}</span>
              <span className="text-[#c9d1d9]">);</span>
              {"\n"}
              <span className="text-[#8b949e]">
                {"// => 4  (영어 14글자 / 4 = 3.5, 올림하면 4)"}
              </span>
            </CodeBlock>

            {/* 메시지 토큰 계산 */}
            <h3
              className="text-[15px] font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              메시지 단위 토큰 계산
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              채팅 메시지 배열을 넘기면 각 메시지의 역할/포맷팅 오버헤드까지 포함하여 총 토큰 수를
              계산합니다. 이 함수는 내부적으로{" "}
              <code className="text-cyan-600 text-[12px]">countTokens</code>를 호출하므로 캐시
              혜택을 그대로 받습니다.
            </p>
            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#d2a8ff]">countMessageTokens</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./llm/token-counter.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">messages</span>{" "}
              <span className="text-[#ff7b72]">=</span> <span className="text-[#c9d1d9]">[</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  { "}</span>
              <span className="text-[#79c0ff]">role</span>
              <span className="text-[#c9d1d9]">: </span>
              <span className="text-[#a5d6ff]">{'"system"'}</span>
              <span className="text-[#c9d1d9]">, </span>
              <span className="text-[#79c0ff]">content</span>
              <span className="text-[#c9d1d9]">: </span>
              <span className="text-[#a5d6ff]">{'"You are a helpful assistant."'}</span>
              <span className="text-[#c9d1d9]">{" },"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  { "}</span>
              <span className="text-[#79c0ff]">role</span>
              <span className="text-[#c9d1d9]">: </span>
              <span className="text-[#a5d6ff]">{'"user"'}</span>
              <span className="text-[#c9d1d9]">, </span>
              <span className="text-[#79c0ff]">content</span>
              <span className="text-[#c9d1d9]">: </span>
              <span className="text-[#a5d6ff]">{'"Hello!"'}</span>
              <span className="text-[#c9d1d9]">{" },"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">];</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">total</span>{" "}
              <span className="text-[#ff7b72]">=</span>{" "}
              <span className="text-[#d2a8ff]">countMessageTokens</span>
              <span className="text-[#c9d1d9]">(messages);</span>
              {"\n"}
              <span className="text-[#8b949e]">
                {"// => 내용 토큰 + 메시지당 4토큰 오버헤드 + 어시스턴트 프라이밍 2토큰"}
              </span>
              {"\n"}
              <span className="text-[#8b949e]">{"// => (6 + 4) + (1 + 4) + 2 = 17"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!!">
              <p className="leading-relaxed">
                <strong className="text-gray-900">흔한 실수:</strong>{" "}
                <code className="text-cyan-600 text-[12px]">countTokens</code>로 메시지 배열의{" "}
                <code className="text-cyan-600 text-[12px]">content</code>만 합산하면
                오버헤드(메시지당 ~4토큰 + 프라이밍 ~2토큰)가 빠집니다. 채팅 메시지의 총 토큰 수가
                필요하면 반드시{" "}
                <code className="text-cyan-600 text-[12px]">countMessageTokens</code>를 사용하세요.
              </p>
            </Callout>

            <Callout type="info" icon="i">
              <p className="leading-relaxed">
                <strong className="text-gray-900">countTokens vs estimateTokens 선택 기준:</strong>{" "}
                컨텍스트 윈도우 한도 관리처럼 정확도가 중요한 곳에서는{" "}
                <code className="text-cyan-600 text-[12px]">countTokens</code>, 스트리밍 중 UI
                표시처럼 속도가 중요한 곳에서는{" "}
                <code className="text-cyan-600 text-[12px]">estimateTokens</code>를 사용합니다.
              </p>
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ──────────────────────────────────────────────
            5. 내부 구현
        ────────────────────────────────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>⚙️</span> 내부 구현
            </h2>

            <p className="text-[14px] text-gray-600 leading-[1.85] mb-6">
              이 모듈의 내부 동작은 크게 세 부분으로 나뉩니다: (1) tiktoken 인코더의 지연 초기화,
              (2) FNV-1a 해시 기반 LRU 캐시, (3) 문자 분류 기반 추정 알고리즘.
            </p>

            {/* 지연 초기화 */}
            <h3
              className="text-[15px] font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              1. tiktoken 인코더 — 지연 초기화 (Lazy Initialization)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              tiktoken 인코더는 생성 비용이 크기 때문에, 처음{" "}
              <code className="text-cyan-600 text-[12px]">countTokens</code>가 호출될 때 한 번만
              생성하고 이후에는 재사용합니다. 이것을{" "}
              <strong className="text-gray-900">싱글톤 패턴</strong>이라고 합니다.
            </p>
            <CodeBlock>
              <span className="text-[#8b949e]">
                {"// 인코더 인스턴스 — 아직 생성되지 않음 (undefined)"}
              </span>
              {"\n"}
              <span className="text-[#ff7b72]">let</span>{" "}
              <span className="text-[#79c0ff]">encoder</span>
              <span className="text-[#c9d1d9]">: </span>
              <span className="text-[#ffa657]">ReturnType</span>
              <span className="text-[#c9d1d9]">{"<"}</span>
              <span className="text-[#ff7b72]">typeof</span>{" "}
              <span className="text-[#d2a8ff]">getEncoding</span>
              <span className="text-[#c9d1d9]">{">"}</span>
              <span className="text-[#c9d1d9]"> | </span>
              <span className="text-[#ffa657]">undefined</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">function</span>{" "}
              <span className="text-[#d2a8ff]">getEncoder</span>
              <span className="text-[#c9d1d9]">() {"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#ff7b72]">if</span> <span className="text-[#c9d1d9]">(!</span>
              <span className="text-[#79c0ff]">encoder</span>
              <span className="text-[#c9d1d9]">) {"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"    "}</span>
              <span className="text-[#8b949e]">
                {"// 처음 호출 시에만 인코더 생성 (o200k_base = GPT-4o/5용)"}
              </span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"    "}</span>
              <span className="text-[#79c0ff]">encoder</span>{" "}
              <span className="text-[#ff7b72]">=</span>{" "}
              <span className="text-[#d2a8ff]">getEncoding</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"o200k_base"'}</span>
              <span className="text-[#c9d1d9]">);</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  }"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#ff7b72]">return</span>{" "}
              <span className="text-[#79c0ff]">encoder</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
            </CodeBlock>
            <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">
              만약 <code className="text-cyan-600 text-[12px]">estimateTokens</code>만 사용한다면
              인코더가 전혀 생성되지 않아 초기화 비용이 0입니다.
            </p>

            {/* FNV-1a 해시 */}
            <h3
              className="text-[15px] font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              2. FNV-1a 해시 — 캐시 키 생성
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              전체 텍스트를 캐시 키로 사용하면 메모리가 낭비됩니다. FNV-1a라는 빠르고 충돌이 적은
              비암호화 해시 알고리즘을 사용하여 텍스트를 짧은 해시 문자열로 변환합니다.
            </p>
            <CodeBlock>
              <span className="text-[#ff7b72]">function</span>{" "}
              <span className="text-[#d2a8ff]">hashString</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#ffa657]">str</span>
              <span className="text-[#c9d1d9]">: </span>
              <span className="text-[#ffa657]">string</span>
              <span className="text-[#c9d1d9]">): </span>
              <span className="text-[#ffa657]">string</span>
              <span className="text-[#c9d1d9]">{" {"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#ff7b72]">let</span>{" "}
              <span className="text-[#79c0ff]">hash</span> <span className="text-[#ff7b72]">=</span>{" "}
              <span className="text-[#79c0ff]">0x811c9dc5</span>
              <span className="text-[#c9d1d9]">;</span>
              <span className="text-[#8b949e]">{" // FNV-1a 초기값"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#ff7b72]">for</span> <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#ff7b72]">let</span> <span className="text-[#79c0ff]">i</span>{" "}
              <span className="text-[#ff7b72]">=</span> <span className="text-[#79c0ff]">0</span>
              <span className="text-[#c9d1d9]">; </span>
              <span className="text-[#79c0ff]">i</span>{" "}
              <span className="text-[#ff7b72]">{"<"}</span>{" "}
              <span className="text-[#79c0ff]">str</span>
              <span className="text-[#c9d1d9]">.length; </span>
              <span className="text-[#79c0ff]">i</span>
              <span className="text-[#ff7b72]">++</span>
              <span className="text-[#c9d1d9]">) {"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"    "}</span>
              <span className="text-[#79c0ff]">hash</span>{" "}
              <span className="text-[#ff7b72]">^=</span> <span className="text-[#79c0ff]">str</span>
              <span className="text-[#c9d1d9]">.charCodeAt(</span>
              <span className="text-[#79c0ff]">i</span>
              <span className="text-[#c9d1d9]">);</span>
              <span className="text-[#8b949e]">{" // XOR 연산"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"    "}</span>
              <span className="text-[#79c0ff]">hash</span> <span className="text-[#ff7b72]">=</span>{" "}
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#79c0ff]">hash</span> <span className="text-[#ff7b72]">*</span>{" "}
              <span className="text-[#79c0ff]">0x01000193</span>
              <span className="text-[#c9d1d9]">)</span>{" "}
              <span className="text-[#ff7b72]">{">>>"}</span>{" "}
              <span className="text-[#79c0ff]">0</span>
              <span className="text-[#c9d1d9]">;</span>
              <span className="text-[#8b949e]">{" // FNV prime"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  }"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#ff7b72]">return</span>{" "}
              <span className="text-[#79c0ff]">hash</span>
              <span className="text-[#c9d1d9]">.toString(</span>
              <span className="text-[#79c0ff]">36</span>
              <span className="text-[#c9d1d9]">);</span>
              <span className="text-[#8b949e]">{" // 36진수 변환"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
            </CodeBlock>
            <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">
              예를 들어 <code className="text-cyan-600 text-[12px]">{'"Hello, world!"'}</code> 같은
              긴 문자열이
              <code className="text-cyan-600 text-[12px]">{' "k7f3m2"'}</code> 같은 짧은 해시 키로
              변환되어 메모리를 절약합니다.
            </p>

            {/* 추정 알고리즘 */}
            <h3
              className="text-[15px] font-bold text-gray-900"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              3. 문자 분류 기반 토큰 추정 알고리즘
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600 text-[12px]">estimateTokens</code>는 유니코드
              코드포인트를 기준으로 ASCII 문자와 CJK(한중일) 문자를 분류하여 각각 다른 비율로 토큰
              수를 추정합니다.
            </p>
            <CodeBlock>
              <span className="text-[#8b949e]">{"// 유니코드 0x2E80 이상 = CJK 관련 문자"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">if</span> <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#79c0ff]">code</span>{" "}
              <span className="text-[#ff7b72]">{">"}</span>{" "}
              <span className="text-[#79c0ff]">0x2e80</span>
              <span className="text-[#c9d1d9]">) {"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">wideChars</span>
              <span className="text-[#ff7b72]">++</span>
              <span className="text-[#c9d1d9]">;</span>
              <span className="text-[#8b949e]">{" // 한글, 한자, 히라가나 등"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>{" "}
              <span className="text-[#ff7b72]">else</span>{" "}
              <span className="text-[#c9d1d9]">{"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">asciiChars</span>
              <span className="text-[#ff7b72]">++</span>
              <span className="text-[#c9d1d9]">;</span>
              <span className="text-[#8b949e]">{" // 영어, 숫자, 기호 등"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
              {"\n\n"}
              <span className="text-[#8b949e]">
                {"// ASCII: 4글자당 1토큰 | CJK: 2글자당 1토큰"}
              </span>
              {"\n"}
              <span className="text-[#ff7b72]">return</span>{" "}
              <span className="text-[#79c0ff]">Math</span>
              <span className="text-[#c9d1d9]">.ceil(</span>
              <span className="text-[#79c0ff]">asciiChars</span>{" "}
              <span className="text-[#ff7b72]">/</span> <span className="text-[#79c0ff]">4</span>{" "}
              <span className="text-[#ff7b72]">+</span>{" "}
              <span className="text-[#79c0ff]">wideChars</span>{" "}
              <span className="text-[#ff7b72]">/</span> <span className="text-[#79c0ff]">2</span>
              <span className="text-[#c9d1d9]">);</span>
            </CodeBlock>
            <p className="text-[12px] text-gray-400 mt-2 leading-relaxed">
              한국어 텍스트 <code className="text-cyan-600 text-[12px]">{'"안녕하세요"'}</code>
              (5글자)는 약 <code className="text-cyan-600 text-[12px]">
                Math.ceil(5/2) = 3
              </code>{" "}
              토큰으로 추정됩니다. 실제 tiktoken 결과와 비교하면 대부분 10% 이내의 오차를 보입니다.
            </p>

            <DeepDive title="LRU 캐시의 Map 기반 구현 원리">
              <p className="mb-3">
                JavaScript의 <code className="text-cyan-600 text-[12px]">Map</code>은 삽입 순서를
                보장합니다. 이 특성을 활용하면 별도의 연결 리스트 없이도 LRU 캐시를 간단하게 구현할
                수 있습니다.
              </p>
              <ul className="list-none flex flex-col gap-2">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 shrink-0">1.</span>
                  <span>
                    <strong className="text-gray-900">캐시 적중 시:</strong> 해당 항목을{" "}
                    <code className="text-cyan-600 text-[12px]">delete</code> 후{" "}
                    <code className="text-cyan-600 text-[12px]">set</code>으로 재삽입합니다. 이렇게
                    하면 삽입 순서가 맨 뒤로 이동하여 "최근 사용됨" 상태가 됩니다.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 shrink-0">2.</span>
                  <span>
                    <strong className="text-gray-900">용량 초과 시:</strong>{" "}
                    <code className="text-cyan-600 text-[12px]">Map.keys().next().value</code>로 첫
                    번째 키(가장 오래된 항목)를 가져와 제거합니다.
                  </span>
                </li>
              </ul>
              <p className="mt-3">
                이 방식은 시간 복잡도 O(1)로 get/set이 가능하며, 별도의 자료구조 없이 Map 하나로
                완결됩니다.
              </p>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ──────────────────────────────────────────────
            6. 트러블슈팅
        ────────────────────────────────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔧</span> 트러블슈팅
            </h2>

            <div className="flex flex-col gap-5">
              {/* FAQ 1 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold text-cyan-600 mb-2">
                  Q. countTokens와 estimateTokens 결과가 크게 다릅니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  <code className="text-cyan-600 text-[12px]">estimateTokens</code>는 문자 수 기반
                  추정이므로, 코드나 특수 문자가 많은 텍스트에서는 오차가 커질 수 있습니다. 정확한
                  값이 필요하면 항상 <code className="text-cyan-600 text-[12px]">countTokens</code>
                  를 사용하세요. 추정은 스트리밍 UI처럼 속도가 최우선인 곳에서만 쓰는 것이 좋습니다.
                </p>
              </div>

              {/* FAQ 2 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold text-cyan-600 mb-2">
                  Q. 다른 LLM 모델(Claude, Llama)에서도 정확한가요?
                </h4>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  현재 <code className="text-cyan-600 text-[12px]">o200k_base</code> 인코딩(OpenAI
                  계열)만 지원합니다. Claude, Llama 등 다른 모델은 자체 토크나이저를 사용하므로 실제
                  토큰 수와 차이가 있을 수 있습니다. 그러나 dhelix는 OpenAI 호환 API를 사용하는 것이
                  기본이므로, 대부분의 경우 이 인코딩으로 충분합니다. 향후 모델별 인코딩 전환 기능이
                  추가될 수 있습니다.
                </p>
              </div>

              {/* FAQ 3 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold text-cyan-600 mb-2">
                  Q. 캐시 적중률이 낮습니다. 어떻게 개선할 수 있나요?
                </h4>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  <code className="text-cyan-600 text-[12px]">getTokenCacheStats()</code>로 적중률을
                  확인하세요. 싱글톤 캐시의 기본 크기는 500개입니다. 매번 다른 텍스트를 계산한다면
                  캐시 효과가 적을 수 있습니다. 동일 텍스트가 반복 조회되는 패턴(예: 컨텍스트
                  관리에서 같은 메시지를 여러 번 조회)에서 캐시 효과가 극대화됩니다. 캐시 크기를
                  늘리려면 <code className="text-cyan-600 text-[12px]">TokenCountCache</code>{" "}
                  인스턴스를 직접 생성하여 사용할 수 있습니다.
                </p>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ──────────────────────────────────────────────
            7. 관련 문서
        ────────────────────────────────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔗</span> 관련 문서
            </h2>
            <SeeAlso
              items={[
                {
                  name: "llm/client.ts",
                  slug: "llm-client",
                  relation: "sibling",
                  desc: "OpenAI 호환 LLM API 클라이언트 -- 토큰 카운터를 사용하여 요청 크기를 계산합니다.",
                },
                {
                  name: "context-manager.ts",
                  slug: "context-manager",
                  relation: "parent",
                  desc: "3-Layer 토큰 관리 -- 토큰 카운터로 컨텍스트 윈도우 사용량을 추적합니다.",
                },
                {
                  name: "dual-model-router.ts",
                  slug: "dual-model-router",
                  relation: "sibling",
                  desc: "Architect/Editor 모델 자동 전환 라우터 -- 모델별 토큰 한도를 확인합니다.",
                },
                {
                  name: "model-capabilities.ts",
                  slug: "model-capabilities",
                  relation: "sibling",
                  desc: "모델 정보 레지스트리 -- 모델별 최대 토큰 수 등 capabilities를 관리합니다.",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
