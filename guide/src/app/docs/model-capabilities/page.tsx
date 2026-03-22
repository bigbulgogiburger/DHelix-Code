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

/* ────────────────────────────────────────────────────────────── */
/* 능력 티어별 모델 목록 (내부 구현 섹션에서 재사용)                */
/* ────────────────────────────────────────────────────────────── */
const tierModels = [
  {
    tier: "high",
    label: "High",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-l-accent-green",
    desc: "네이티브 function calling, 풍부한 컨텍스트 전략",
    models: [
      "GPT-4o", "GPT-4.1", "GPT-5", "GPT-5.1-codex",
      "o1 / o1-mini / o3 / o3-mini",
      "Claude Opus 4", "Claude Sonnet 4",
      "Claude 3 Opus / 3.5 Sonnet",
      "GPT-4 / GPT-4-turbo",
    ],
  },
  {
    tier: "medium",
    label: "Medium",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-l-accent-orange",
    desc: "구조화된 출력 가이드 필요, 기본적인 도구 지원",
    models: [
      "GPT-4o-mini", "GPT-5-mini / GPT-5-nano",
      "GPT-3.5",
      "Claude Haiku 4 / Claude 3 Haiku",
      "MiniMax-M2.5",
      "DeepSeek-v3 / DeepSeek-coder-v2",
      "Mistral Large / Medium",
    ],
  },
  {
    tier: "low",
    label: "Low",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-l-accent-red",
    desc: "텍스트 파싱 폴백, 제한적 컨텍스트",
    models: [
      "Llama 3 / 3.1+",
      "Codestral",
      "DeepSeek-coder (v1)",
      "Qwen 2.5 Coder (7B / 32B)",
      "Phi", "Gemma",
    ],
  },
];

export default function ModelCapabilitiesPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">

        {/* ───────────── 1. Header ───────────── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/llm/model-capabilities.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-3 mb-3 text-gray-900">
                Model Capabilities
            </h1>
            <div className="flex items-center gap-3 mb-4">
              <LayerBadge layer="infra" />
              <span className="text-[13px] text-gray-600">
                각 LLM 모델의 특성과 제한을 관리하는 중앙 레지스트리
              </span>
            </div>
          </div>
        </RevealOnScroll>

        {/* ───────────── 2. 개요 ───────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>🗺️</span> 개요
            </h2>

            <p className="text-[14px] text-gray-600 leading-relaxed mb-5">
              <span className="font-mono text-cyan-600">model-capabilities</span> 모듈은 dbcode가 지원하는
              모든 LLM 모델의 <strong className="text-gray-900">기능 플래그</strong>,{" "}
              <strong className="text-gray-900">컨텍스트 크기</strong>,{" "}
              <strong className="text-gray-900">토큰 가격</strong>,{" "}
              <strong className="text-gray-900">능력 티어</strong>를 정의하는 중앙 레지스트리입니다.
            </p>
            <p className="text-[14px] text-gray-600 leading-relaxed mb-5">
              LLM 모델마다 도구 호출 지원 여부, 시스템 메시지 형식, temperature 파라미터 사용 가능 여부 등이 다릅니다.
              이 모듈이 없으면 모든 모델을 동일하게 취급하게 되어, o1 모델에 temperature를 보내거나
              Llama3에 function calling을 시도하는 등의 런타임 오류가 발생합니다.
            </p>

            <Callout type="info" icon="💡">
              <span className="text-gray-900 font-semibold">왜 중요한가?</span>{" "}
              Agent Loop, System Prompt Builder, LLM Client 모두 이 모듈을 통해
              모델별 동작을 결정합니다. 새 모델을 추가할 때 이 파일 하나만 수정하면 됩니다.
            </Callout>

            <MermaidDiagram
              title="model-capabilities의 위치와 의존 관계"
              titleColor="green"
              chart={`graph TB
    subgraph CORE["Layer 2: Core"]
      AGENT["Agent Loop<br/><small>ReAct 에이전트 루프</small>"]
      PROMPT["System Prompt Builder<br/><small>시스템 프롬프트 생성</small>"]
    end
    subgraph INFRA["Layer 3: Infrastructure"]
      LLM["LLM Client<br/><small>LLM API 호출 클라이언트</small>"]
      MC["model-capabilities.ts<br/><small>모델별 능력 레지스트리</small>"]
      ROUTER["Dual-Model Router<br/><small>모델 간 자동 전환</small>"]
    end

    AGENT -->|"능력 조회"| MC
    PROMPT -->|"티어별 프롬프트 결정"| MC
    LLM -->|"요청 파라미터 조정"| MC
    ROUTER -->|"모델 선택 시 확인"| MC

    style MC fill:#d1fae5,stroke:#10b981,color:#065f46
    style CORE fill:rgba(139,92,246,0.1),stroke:#8b5cf6
    style INFRA fill:rgba(16,185,129,0.1),stroke:#10b981`}
            />
          </section>
        </RevealOnScroll>

        {/* ───────────── 3. 레퍼런스 ───────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>📖</span> 레퍼런스
            </h2>

            {/* --- CapabilityTier type --- */}
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-purple" />
              <span className="font-mono text-violet-600">CapabilityTier</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">Type</span>
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              모델의 전반적인 성능 수준을 나타내는 유니언 타입입니다. 프롬프트 스타일, 컨텍스트 전략,
              도구 호출 방식을 결정하는 데 사용됩니다.
            </p>
            <CodeBlock>
              <span className="text-[#ff7b72]">type</span>{" "}
              <span className="text-[#ffa657]">CapabilityTier</span>{" "}
              <span className="text-[#ff7b72]">=</span>{" "}
              <span className="text-[#a5d6ff]">{'"high"'}</span>{" "}
              <span className="text-[#ff7b72]">|</span>{" "}
              <span className="text-[#a5d6ff]">{'"medium"'}</span>{" "}
              <span className="text-[#ff7b72]">|</span>{" "}
              <span className="text-[#a5d6ff]">{'"low"'}</span>
            </CodeBlock>

            {/* --- ModelPricingInfo interface --- */}
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-purple" />
              <span className="font-mono text-violet-600">ModelPricingInfo</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">Interface</span>
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              모델의 토큰 가격 정보를 담는 인터페이스입니다. USD 기준, 100만 토큰당 가격입니다.
            </p>
            <ParamTable
              params={[
                { name: "inputPerMillion", type: "number", required: true, desc: "입력 토큰 100만개당 가격 (USD)" },
                { name: "outputPerMillion", type: "number", required: true, desc: "출력 토큰 100만개당 가격 (USD)" },
              ]}
            />

            {/* --- ModelCapabilities interface --- */}
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-purple" />
              <span className="font-mono text-violet-600">ModelCapabilities</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">Interface</span>
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              모델의 모든 능력 플래그를 담는 핵심 인터페이스입니다. 요청(request) 형식, 토크나이저,
              가격 정보, 능력 티어 등을 포함합니다. 모든 프로퍼티가{" "}
              <span className="font-mono text-cyan-600">readonly</span>입니다.
            </p>
            <ParamTable
              params={[
                { name: "supportsTools", type: "boolean", required: true, desc: "도구(function calling) 지원 여부. false이면 텍스트 파싱으로 대체" },
                { name: "supportsSystemMessage", type: "boolean", required: true, desc: "system 역할 메시지 지원 여부. false이면 user 메시지로 변환" },
                { name: "supportsTemperature", type: "boolean", required: true, desc: "temperature 파라미터 지원 여부. o1/o3 추론 모델은 미지원" },
                { name: "supportsStreaming", type: "boolean", required: true, desc: "스트리밍 응답 지원 여부" },
                { name: "maxContextTokens", type: "number", required: true, desc: "최대 컨텍스트 윈도우 크기 (입력+출력 합산 토큰 수)" },
                { name: "maxOutputTokens", type: "number", required: true, desc: "한 번의 응답에서 생성할 수 있는 최대 토큰 수" },
                { name: "tokenizer", type: '"cl100k" | "o200k" | "llama"', required: true, desc: "사용할 토크나이저 종류" },
                { name: "useDeveloperRole", type: "boolean", required: true, desc: "o1/o3 추론 모델 전용 — system을 developer 역할로 변환" },
                { name: "pricing", type: "ModelPricingInfo", required: true, desc: "토큰 가격 정보 (미지 모델은 $1/$3 기본값)" },
                { name: "useMaxCompletionTokens", type: "boolean", required: true, desc: "true: max_completion_tokens 사용, false: max_tokens 사용 (레거시)" },
                { name: "capabilityTier", type: "CapabilityTier", required: true, desc: "능력 티어 — 적응형 프롬프트/컨텍스트 전략에 사용" },
                { name: "supportsCaching", type: "boolean", required: true, desc: "명시적 프롬프트 캐싱 지원 여부 (Anthropic 전용)" },
                { name: "supportsThinking", type: "boolean", required: true, desc: "Extended Thinking(확장 사고) 지원 여부 (Claude 모델)" },
                { name: "defaultThinkingBudget", type: "number", required: true, desc: "기본 사고 예산 (토큰 수, 0이면 컨텍스트 기반 자동 계산)" },
              ]}
            />

            <Callout type="warn" icon="⚠️">
              <span className="text-gray-900 font-semibold">주의사항:</span>{" "}
              <span className="font-mono text-cyan-600">useMaxCompletionTokens</span>와{" "}
              <span className="font-mono text-cyan-600">useDeveloperRole</span>은
              OpenAI API의 세대 차이를 처리하기 위한 플래그입니다. 레거시 모델(GPT-3.5, GPT-4)은{" "}
              <span className="font-mono text-amber-600">max_tokens</span>를,
              최신 모델은{" "}
              <span className="font-mono text-amber-600">max_completion_tokens</span>를 사용합니다.
            </Callout>

            {/* --- getModelCapabilities function --- */}
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
              <span className="font-mono text-emerald-600">getModelCapabilities()</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">Function</span>
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              모델 이름을 받아 해당 모델의 능력 정보를 반환하는 메인 조회 함수입니다.
              내부의 <span className="font-mono text-cyan-600">MODEL_OVERRIDES</span> 배열에서 정규식 패턴을 순서대로 매칭하여
              첫 번째 일치하는 설정을 기본값에 병합(spread)합니다.
            </p>
            <ParamTable
              params={[
                { name: "modelName", type: "string", required: true, desc: '모델 이름 (예: "gpt-4o", "claude-sonnet-4-20250514", "llama3.1")' },
              ]}
            />
            <p className="text-[13px] text-gray-600 mt-2 mb-1">
              <strong className="text-gray-900">반환값:</strong>{" "}
              <span className="font-mono text-violet-600">ModelCapabilities</span> 객체.
              일치하는 패턴이 없으면 안전한 기본값을 반환합니다.
            </p>
          </section>
        </RevealOnScroll>

        {/* ───────────── 4. 사용법 ───────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>🔍</span> 사용법
            </h2>

            {/* 모델 능력 조회 */}
            <h3 className="text-base font-bold text-gray-900" style={{ marginTop: "32px", marginBottom: "16px" }}>
              모델 능력 조회하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              모델 이름만 전달하면 해당 모델의 전체 능력 정보를 얻을 수 있습니다.
            </p>
            <CodeBlock>
              <span className="text-[#8b949e]">{"// 모델 능력 조회 — 가장 기본적인 사용법"}</span>{"\n"}
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#e6edf3]">{"{ "}</span>
              <span className="text-[#ffa657]">getModelCapabilities</span>
              <span className="text-[#e6edf3]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{"'./llm/model-capabilities.js'"}</span>
              <span className="text-[#e6edf3]">;</span>{"\n\n"}

              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#e6edf3]">caps</span>{" "}
              <span className="text-[#ff7b72]">=</span>{" "}
              <span className="text-[#ffa657]">getModelCapabilities</span>
              <span className="text-[#e6edf3]">(</span>
              <span className="text-[#a5d6ff]">{'"gpt-4o"'}</span>
              <span className="text-[#e6edf3]">);</span>{"\n\n"}

              <span className="text-[#8b949e]">{"// 도구 지원 여부에 따른 분기"}</span>{"\n"}
              <span className="text-[#ff7b72]">if</span>{" "}
              <span className="text-[#e6edf3]">(caps.</span>
              <span className="text-[#79c0ff]">supportsTools</span>
              <span className="text-[#e6edf3]">) {"{"}</span>{"\n"}
              {"  "}<span className="text-[#8b949e]">{"// 네이티브 function calling 사용"}</span>{"\n"}
              <span className="text-[#e6edf3]">{"}"}</span>{" "}
              <span className="text-[#ff7b72]">else</span>{" "}
              <span className="text-[#e6edf3]">{"{"}</span>{"\n"}
              {"  "}<span className="text-[#8b949e]">{"// 텍스트 파싱 폴백"}</span>{"\n"}
              <span className="text-[#e6edf3]">{"}"}</span>
            </CodeBlock>

            {/* 요청 파라미터 동적 조정 */}
            <h3 className="text-base font-bold text-gray-900" style={{ marginTop: "32px", marginBottom: "16px" }}>
              요청 파라미터 동적 조정
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              LLM Client에서 실제로 사용하는 패턴입니다. 모델마다 다른 API 파라미터를 자동으로 적용합니다.
            </p>
            <CodeBlock>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#e6edf3]">caps</span>{" "}
              <span className="text-[#ff7b72]">=</span>{" "}
              <span className="text-[#ffa657]">getModelCapabilities</span>
              <span className="text-[#e6edf3]">(modelName);</span>{"\n\n"}

              <span className="text-[#8b949e]">{"// temperature 지원 여부에 따른 파라미터 구성"}</span>{"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#e6edf3]">params</span>{" "}
              <span className="text-[#ff7b72]">=</span>{" "}
              <span className="text-[#e6edf3]">{"{"}</span>{"\n"}
              {"  "}<span className="text-[#e6edf3]">model: modelName,</span>{"\n"}
              {"  "}<span className="text-[#e6edf3]">...(caps.</span>
              <span className="text-[#79c0ff]">supportsTemperature</span>
              <span className="text-[#e6edf3]">{" && { temperature: 0.7 }),"}</span>{"\n"}
              {"  "}<span className="text-[#e6edf3]">...(caps.</span>
              <span className="text-[#79c0ff]">useMaxCompletionTokens</span>{"\n"}
              {"    "}<span className="text-[#e6edf3]">{"? { max_completion_tokens: caps.maxOutputTokens }"}</span>{"\n"}
              {"    "}<span className="text-[#e6edf3]">{"  : { max_tokens: caps.maxOutputTokens }),"}</span>{"\n"}
              <span className="text-[#e6edf3]">{"};"}</span>
            </CodeBlock>

            {/* 새 모델 등록 */}
            <h3 className="text-base font-bold text-gray-900" style={{ marginTop: "32px", marginBottom: "16px" }}>
              새 모델 등록하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <span className="font-mono text-cyan-600">MODEL_OVERRIDES</span> 배열에 정규식 패턴과
              기본값에서 덮어쓸 속성을 추가합니다. 기본값(<span className="font-mono text-cyan-600">DEFAULTS</span>)에서
              변경이 필요한 속성만 지정하면 됩니다.
            </p>
            <CodeBlock>
              <span className="text-[#8b949e]">{"// MODEL_OVERRIDES 배열에 새 모델 추가 예시"}</span>{"\n"}
              <span className="text-[#e6edf3]">[</span>{"\n"}
              {"  "}<span className="text-[#ffa657]">{"/^my-custom-model/i"}</span>
              <span className="text-[#e6edf3]">,</span>{"\n"}
              {"  "}<span className="text-[#e6edf3]">{"{"}</span>{"\n"}
              {"    "}<span className="text-[#79c0ff]">maxContextTokens</span>
              <span className="text-[#e6edf3]">: </span>
              <span className="text-[#79c0ff]">64_000</span>
              <span className="text-[#e6edf3]">,</span>{"\n"}
              {"    "}<span className="text-[#79c0ff]">maxOutputTokens</span>
              <span className="text-[#e6edf3]">: </span>
              <span className="text-[#79c0ff]">8192</span>
              <span className="text-[#e6edf3]">,</span>{"\n"}
              {"    "}<span className="text-[#79c0ff]">supportsTools</span>
              <span className="text-[#e6edf3]">: </span>
              <span className="text-[#79c0ff]">true</span>
              <span className="text-[#e6edf3]">,</span>{"\n"}
              {"    "}<span className="text-[#79c0ff]">pricing</span>
              <span className="text-[#e6edf3]">{": { inputPerMillion: 1.5, outputPerMillion: 5 },"}</span>{"\n"}
              {"    "}<span className="text-[#79c0ff]">capabilityTier</span>
              <span className="text-[#e6edf3]">: </span>
              <span className="text-[#a5d6ff]">{'"medium"'}</span>
              <span className="text-[#e6edf3]">,</span>{"\n"}
              {"  "}<span className="text-[#e6edf3]">{"},"}</span>{"\n"}
              <span className="text-[#e6edf3]">],</span>
            </CodeBlock>

            <Callout type="danger" icon="🚨">
              <span className="text-gray-900 font-semibold">패턴 순서가 중요합니다!</span>{" "}
              정규식 매칭은 배열 순서대로 이루어지며, 첫 번째 일치하는 패턴이 사용됩니다.
              더 구체적인 패턴을 먼저 배치해야 합니다.
              예를 들어 <span className="font-mono text-cyan-600">gpt-4o-mini</span>가{" "}
              <span className="font-mono text-cyan-600">gpt-4o</span>보다 반드시 위에 있어야 합니다.
            </Callout>

            {/* DeepDive: 능력 티어 상세 */}
            <DeepDive title="능력 티어(Capability Tier) 상세">
              <p className="mb-4">
                능력 티어는 모델의 전반적인 성능 수준을 3단계로 분류합니다.
                Agent Loop, System Prompt Builder 등 여러 모듈이 이 티어를 기준으로
                프롬프트 스타일과 컨텍스트 전략을 결정합니다.
              </p>

              <div className="flex flex-col gap-3">
                {tierModels.map((t) => (
                  <div
                    key={t.tier}
                    className={`${t.bg} border-l-[3px] ${t.border} rounded-r-lg p-4`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-sm font-extrabold ${t.color}`}>{t.label}</span>
                      <span className="text-[11px] text-gray-400">— {t.desc}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {t.models.map((m) => (
                        <span
                          key={m}
                          className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-50 text-gray-600"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <Callout type="tip" icon="✅">
                <span className="text-gray-900 font-semibold">Tip:</span>{" "}
                로컬 모델(Ollama)을 사용할 때 pricing을{" "}
                <span className="font-mono text-cyan-600">{`{ inputPerMillion: 0, outputPerMillion: 0 }`}</span>으로
                설정하면 비용 추적에서 제외됩니다.
              </Callout>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ───────────── 5. 내부 구현 ───────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>🏗️</span> 내부 구현
            </h2>

            <p className="text-[14px] text-gray-600 leading-relaxed mb-5">
              능력 레지스트리는 3개의 구성 요소로 이루어져 있습니다:
            </p>

            {/* 구조 다이어그램 */}
            <MermaidDiagram
              title="능력 레지스트리 내부 구조"
              titleColor="cyan"
              chart={`graph LR
    INPUT["modelName\n(string)<br/><small>조회할 모델 이름</small>"] --> MATCH{"MODEL_OVERRIDES\n정규식 순차 매칭"}
    MATCH -->|"일치"| MERGE["DEFAULTS + overrides\nspread 병합<br/><small>기본값에 오버라이드 적용</small>"]
    MATCH -->|"불일치"| DEFAULT["DEFAULTS 복사본\n반환<br/><small>기본 능력값 사용</small>"]
    MERGE --> OUTPUT["ModelCapabilities<br/><small>최종 모델 능력 객체</small>"]
    DEFAULT --> OUTPUT

    style INPUT fill:#dbeafe,stroke:#3b82f6,color:#1e40af
    style MATCH fill:#fef3c7,stroke:#f59e0b,color:#92400e
    style MERGE fill:#d1fae5,stroke:#10b981,color:#065f46
    style DEFAULT fill:#f1f5f9,stroke:#64748b,color:#334155
    style OUTPUT fill:#ede9fe,stroke:#8b5cf6,color:#5b21b6`}
            />

            {/* DEFAULTS */}
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="text-[13px]">1.</span> DEFAULTS 기본값
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              MODEL_OVERRIDES에서 매칭되지 않는 알 수 없는 모델에 적용되는 안전한 기본값입니다.
              대부분의 현대 모델이 지원하는 일반적인 기능을 기본으로 설정합니다.
            </p>
            <CodeBlock>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#e6edf3]">DEFAULTS</span>
              <span className="text-[#ff7b72]">:</span>{" "}
              <span className="text-[#ffa657]">ModelCapabilities</span>{" "}
              <span className="text-[#ff7b72]">=</span>{" "}
              <span className="text-[#e6edf3]">{"{"}</span>{"\n"}
              {"  "}<span className="text-[#79c0ff]">supportsTools</span><span className="text-[#e6edf3]">: </span><span className="text-[#79c0ff]">true</span><span className="text-[#e6edf3]">,</span>{"\n"}
              {"  "}<span className="text-[#79c0ff]">supportsSystemMessage</span><span className="text-[#e6edf3]">: </span><span className="text-[#79c0ff]">true</span><span className="text-[#e6edf3]">,</span>{"\n"}
              {"  "}<span className="text-[#79c0ff]">supportsTemperature</span><span className="text-[#e6edf3]">: </span><span className="text-[#79c0ff]">true</span><span className="text-[#e6edf3]">,</span>{"\n"}
              {"  "}<span className="text-[#79c0ff]">supportsStreaming</span><span className="text-[#e6edf3]">: </span><span className="text-[#79c0ff]">true</span><span className="text-[#e6edf3]">,</span>{"\n"}
              {"  "}<span className="text-[#79c0ff]">maxContextTokens</span><span className="text-[#e6edf3]">: </span><span className="text-[#79c0ff]">128_000</span><span className="text-[#e6edf3]">,</span>
              {"  "}<span className="text-[#8b949e]">{"// 128K"}</span>{"\n"}
              {"  "}<span className="text-[#79c0ff]">maxOutputTokens</span><span className="text-[#e6edf3]">: </span><span className="text-[#79c0ff]">4096</span><span className="text-[#e6edf3]">,</span>{"\n"}
              {"  "}<span className="text-[#79c0ff]">tokenizer</span><span className="text-[#e6edf3]">: </span><span className="text-[#a5d6ff]">{'"o200k"'}</span><span className="text-[#e6edf3]">,</span>{"\n"}
              {"  "}<span className="text-[#79c0ff]">capabilityTier</span><span className="text-[#e6edf3]">: </span><span className="text-[#a5d6ff]">{'"medium"'}</span><span className="text-[#e6edf3]">,</span>{"\n"}
              {"  "}<span className="text-[#79c0ff]">pricing</span><span className="text-[#e6edf3]">{": { inputPerMillion: 1, outputPerMillion: 3 },"}</span>{"\n"}
              {"  "}<span className="text-[#8b949e]">{"// ... 나머지는 false/0"}</span>{"\n"}
              <span className="text-[#e6edf3]">{"};"}</span>
            </CodeBlock>

            {/* MODEL_OVERRIDES */}
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="text-[13px]">2.</span> MODEL_OVERRIDES 패턴 배열
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <span className="font-mono text-cyan-600">[RegExp, Partial{"<ModelCapabilities>"}]</span> 쌍의
              읽기 전용 배열입니다. 현재 등록된 모델 그룹:
            </p>
            <div className="bg-white border border-gray-200 rounded-xl p-5 my-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[12px]">
                {[
                  { vendor: "OpenAI", models: "GPT-3.5, 4, 4o, 4.1, 5 시리즈", count: 10 },
                  { vendor: "OpenAI (추론)", models: "o1, o1-mini, o3, o3-mini", count: 4 },
                  { vendor: "Anthropic", models: "Claude 3/3.5/4 시리즈", count: 7 },
                  { vendor: "Meta", models: "Llama 3, 3.1+", count: 2 },
                  { vendor: "Mistral", models: "Codestral, Large, Medium", count: 2 },
                  { vendor: "DeepSeek", models: "Coder v1, v2, v3", count: 2 },
                  { vendor: "Alibaba", models: "Qwen 2.5 Coder", count: 2 },
                  { vendor: "Microsoft", models: "Phi", count: 1 },
                  { vendor: "Google", models: "Gemma", count: 1 },
                  { vendor: "MiniMax", models: "MiniMax-M2.5", count: 1 },
                ].map((v) => (
                  <div key={v.vendor} className="bg-gray-50 rounded-lg p-3">
                    <div className="font-bold text-cyan-600 mb-0.5">{v.vendor}</div>
                    <div className="text-gray-400 text-[11px]">{v.models}</div>
                    <div className="text-[10px] text-gray-400 mt-1">{v.count}개 패턴</div>
                  </div>
                ))}
              </div>
            </div>

            {/* getModelCapabilities 함수 */}
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="text-[13px]">3.</span> getModelCapabilities 매칭 알고리즘
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              단순한 선형 탐색(linear scan)입니다. MODEL_OVERRIDES 배열을 순회하면서
              첫 번째로 매칭되는 패턴의 재정의 값을 DEFAULTS에 spread 병합합니다.
            </p>
            <CodeBlock>
              <span className="text-[#ff7b72]">export function</span>{" "}
              <span className="text-[#ffa657]">getModelCapabilities</span>
              <span className="text-[#e6edf3]">(modelName: </span>
              <span className="text-[#79c0ff]">string</span>
              <span className="text-[#e6edf3]">): </span>
              <span className="text-[#ffa657]">ModelCapabilities</span>{" "}
              <span className="text-[#e6edf3]">{"{"}</span>{"\n"}
              {"  "}<span className="text-[#ff7b72]">for</span>{" "}
              <span className="text-[#e6edf3]">(</span>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#e6edf3]">[pattern, overrides] </span>
              <span className="text-[#ff7b72]">of</span>{" "}
              <span className="text-[#e6edf3]">MODEL_OVERRIDES) {"{"}</span>{"\n"}
              {"    "}<span className="text-[#ff7b72]">if</span>{" "}
              <span className="text-[#e6edf3]">(pattern.</span>
              <span className="text-[#ffa657]">test</span>
              <span className="text-[#e6edf3]">(modelName)) {"{"}</span>{"\n"}
              {"      "}<span className="text-[#ff7b72]">return</span>{" "}
              <span className="text-[#e6edf3]">{"{ ...DEFAULTS, ...overrides };"}</span>{"\n"}
              {"    "}<span className="text-[#e6edf3]">{"}"}</span>{"\n"}
              {"  "}<span className="text-[#e6edf3]">{"}"}</span>{"\n"}
              {"  "}<span className="text-[#ff7b72]">return</span>{" "}
              <span className="text-[#e6edf3]">{"{ ...DEFAULTS };"}</span>
              {"  "}<span className="text-[#8b949e]">{"// 알 수 없는 모델"}</span>{"\n"}
              <span className="text-[#e6edf3]">{"}"}</span>
            </CodeBlock>

            <Callout type="tip" icon="💡">
              <span className="text-gray-900 font-semibold">설계 포인트:</span>{" "}
              매번 새 객체를 반환(<span className="font-mono text-cyan-600">{"{ ...DEFAULTS }"}</span>)하므로
              호출자가 반환값을 수정해도 원본 DEFAULTS에 영향을 주지 않습니다.
              불변성(immutability) 원칙을 지키는 패턴입니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ───────────── 6. 트러블슈팅 ───────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>🔧</span> 트러블슈팅
            </h2>

            <div className="flex flex-col gap-4">
              {/* FAQ 1 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <span className="text-amber-600">Q.</span>
                  새 모델을 추가했는데 기본값(DEFAULTS)이 적용됩니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  <span className="text-emerald-600 font-bold">A.</span>{" "}
                  정규식 패턴이 모델 이름과 일치하는지 확인하세요.
                  모든 패턴은 대소문자 무시(<span className="font-mono text-cyan-600">/i</span>) 플래그를 사용합니다.
                  패턴 테스트:{" "}
                  <span className="font-mono text-cyan-600">
                    /^my-model/i.test("my-model-v2")
                  </span>가{" "}
                  <span className="font-mono text-emerald-600">true</span>를 반환하는지 확인하세요.
                  또한 더 일반적인 패턴이 위에 있어서 먼저 매칭되고 있을 수 있습니다.
                </p>
              </div>

              {/* FAQ 2 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <span className="text-amber-600">Q.</span>
                  gpt-4o-mini에 gpt-4o의 설정이 적용됩니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  <span className="text-emerald-600 font-bold">A.</span>{" "}
                  MODEL_OVERRIDES 배열에서 패턴 순서를 확인하세요.{" "}
                  <span className="font-mono text-cyan-600">/^gpt-4o-mini/i</span>가{" "}
                  <span className="font-mono text-cyan-600">/^gpt-4o/i</span>보다{" "}
                  <strong className="text-gray-900">위에(먼저)</strong> 배치되어야 합니다.
                  첫 번째 매칭이 사용되므로, 구체적인 패턴이 범용 패턴보다 항상 앞에 와야 합니다.
                </p>
              </div>

              {/* FAQ 3 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <span className="text-amber-600">Q.</span>
                  Ollama 로컬 모델의 비용이 잘못 추적됩니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  <span className="text-emerald-600 font-bold">A.</span>{" "}
                  로컬 모델의 pricing을{" "}
                  <span className="font-mono text-cyan-600">{`{ inputPerMillion: 0, outputPerMillion: 0 }`}</span>으로
                  설정해야 합니다. 이 값이 없으면 기본 가격($1/$3)이 적용되어
                  로컬 모델임에도 비용이 계산됩니다. Llama, Phi, Gemma, Qwen 등
                  이미 등록된 로컬 모델은 이미 0으로 설정되어 있습니다.
                </p>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────── 7. 관련 문서 ───────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>🔗</span> 관련 문서
            </h2>

            <SeeAlso
              items={[
                {
                  name: "llm/client.ts",
                  slug: "llm-client",
                  relation: "sibling",
                  desc: "OpenAI 호환 LLM API 클라이언트 — model-capabilities를 사용하여 요청 파라미터를 동적 조정",
                },
                {
                  name: "llm/dual-model-router.ts",
                  slug: "dual-model-router",
                  relation: "sibling",
                  desc: "Architect/Editor 모델 자동 전환 라우터 — 모델 선택 시 능력 정보 참조",
                },
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "ReAct 패턴 메인 루프 — 티어별 프롬프트 전략과 도구 호출 방식 결정",
                },
                {
                  name: "system-prompt-builder.ts",
                  slug: "system-prompt-builder",
                  relation: "parent",
                  desc: "동적 시스템 프롬프트 조립 — 능력 티어에 따른 프롬프트 스타일 분기",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
