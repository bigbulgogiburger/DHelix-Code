"use client";

import { FilePath } from "@/components/FilePath";
import { LayerBadge } from "@/components/LayerBadge";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { DeepDive } from "@/components/DeepDive";
import { ParamTable } from "@/components/ParamTable";
import { SeeAlso } from "@/components/SeeAlso";

export default function ConfigDefaultsPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">

        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <FilePath path="src/config/defaults.ts" />
            <LayerBadge layer="leaf" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
            <span className="text-gray-900">
              Config Defaults
            </span>
          </h1>
          <p className="text-[16px] text-gray-600 max-w-[640px]">
            설정 계층의 최하위 레벨(Level 1) &mdash; 하드코딩된 기본값입니다.
            사용자나 프로젝트 설정이 없을 때 적용되는 <span className="text-cyan-600 font-semibold">폴백(fallback) 안전망</span>으로,
            아무 설정 없이도 앱이 정상 동작하도록 보장합니다.
          </p>
        </div>
        </RevealOnScroll>

        {/* ───────────────────── 2. 개요 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"📦"}</span> 개요
            </h2>
            <p className="text-[14px] text-gray-600 leading-relaxed mb-4">
              <code className="text-cyan-600 text-xs">DEFAULT_CONFIG</code>는 5단계 설정 병합에서 가장 낮은 우선순위(Level 1)를 가집니다.
              모든 설정 키에 <strong className="text-gray-900">합리적인 기본값</strong>을 제공하여,
              사용자가 아무것도 설정하지 않아도 앱이 즉시 동작합니다.
              모델명은 <code className="text-cyan-600 text-xs">constants.ts</code>의{" "}
              <span className="text-violet-600 font-semibold">환경변수 기반 단일 소스</span>에서 가져옵니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>단일 진실의 원천:</strong> 모델명과 LLM 기본값은{" "}
              <code className="text-cyan-600 text-xs">constants.ts</code>의{" "}
              <code className="text-cyan-600 text-xs">DEFAULT_MODEL</code>과{" "}
              <code className="text-cyan-600 text-xs">LLM_DEFAULTS</code>에서 가져옵니다.
              defaults.ts에 직접 하드코딩하지 않아 값 동기화 문제를 방지합니다.
            </Callout>

            <MermaidDiagram
              title="DEFAULT_CONFIG의 위치"
              titleColor="orange"
              chart={`flowchart TB
  DEF["DEFAULT_CONFIG<br/><small>Level 1 — 가장 낮은 우선순위</small>"]
  USER["사용자 설정<br/><small>Level 2 — ~/.dbcode/config.json</small>"]
  PROJ["프로젝트 설정<br/><small>Level 3 — .dbcode/config.json</small>"]
  ENV["환경변수<br/><small>Level 4 — DBCODE_*, OPENAI_*</small>"]
  CLI["CLI 플래그<br/><small>Level 5 — 가장 높은 우선순위</small>"]

  DEF -->|덮어쓰임| USER
  USER -->|덮어쓰임| PROJ
  PROJ -->|덮어쓰임| ENV
  ENV -->|덮어쓰임| CLI

  style DEF fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style USER fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style PROJ fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style ENV fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style CLI fill:#f1f5f9,stroke:#ef4444,color:#1e293b`}
            />
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 3. 레퍼런스 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"📋"}</span> 레퍼런스
            </h2>

            {/* DEFAULT_CONFIG */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">DEFAULT_CONFIG</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-600">const</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                <code className="text-violet-600 text-xs">AppConfig</code> 타입의 완전한 기본 설정 객체입니다.
                모든 필드에 값이 있으므로 어떤 설정이 누락되어도 이 값이 폴백됩니다.
              </p>
            </div>

            {/* LLM 설정 */}
            <div className="mb-8">
              <h3 className="text-[15px] font-bold mb-3">LLM 연결 설정</h3>
              <ParamTable
                params={[
                  { name: "llm.baseUrl", type: "string", required: true, desc: "OpenAI 호환 API 엔드포인트 (LLM_DEFAULTS에서 가져옴)" },
                  { name: "llm.model", type: "string", required: true, desc: "AI 모델명 (DEFAULT_MODEL — 환경변수 기반)" },
                  { name: "llm.temperature", type: "number", required: true, desc: "응답 창의성 (기본: 0.0 — 결정적)" },
                  { name: "llm.maxTokens", type: "number", required: true, desc: "최대 생성 토큰 수 (LLM_DEFAULTS에서 가져옴)" },
                  { name: "llm.contextWindow", type: "number", required: true, desc: "컨텍스트 윈도우 크기 (기본: 1,000,000)" },
                  { name: "llm.timeout", type: "number", required: true, desc: "API 타임아웃 ms (기본: 120,000 — bash 도구와 일치)" },
                ]}
              />
            </div>

            {/* 보안 설정 */}
            <div className="mb-8">
              <h3 className="text-[15px] font-bold mb-3">보안/가드레일 설정</h3>
              <ParamTable
                params={[
                  { name: "security.mode", type: '"local"', required: true, desc: "보안 모드 (기본: local — 로컬 전용)" },
                  { name: "security.secretScanning", type: "boolean", required: true, desc: "비밀키 스캔 (기본: true)" },
                  { name: "security.inputFiltering", type: "boolean", required: true, desc: "입력 필터링 — 프롬프트 인젝션 방지 (기본: true)" },
                  { name: "security.outputFiltering", type: "boolean", required: true, desc: "출력 필터링 — 민감 정보 마스킹 (기본: true)" },
                  { name: "security.auditLogging", type: "boolean", required: true, desc: "감사 로깅 (기본: false — 필요 시 활성화)" },
                  { name: "security.rateLimit", type: "object", required: true, desc: "분당 60 요청, 일일 1M 토큰 제한" },
                ]}
              />
            </div>

            {/* 기타 설정 */}
            <div className="mb-4">
              <h3 className="text-[15px] font-bold mb-3">기타 주요 설정</h3>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-36">permissionMode</code>
                    <span><code className="text-cyan-600 text-xs">"default"</code> — 위험한 작업만 확인</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-36">verbose</code>
                    <span><code className="text-cyan-600 text-xs">false</code> — 상세 로깅 비활성</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-36">locale</code>
                    <span><code className="text-cyan-600 text-xs">"ko"</code> — 한국어 응답</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-36">tone</code>
                    <span><code className="text-cyan-600 text-xs">"normal"</code> — 기본 톤</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-36">deferredTools</code>
                    <span><code className="text-cyan-600 text-xs">true</code> — MCP 도구 지연 로딩</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-36">dualModel.enabled</code>
                    <span><code className="text-cyan-600 text-xs">false</code> — 듀얼 모델 비활성</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-36">voice.enabled</code>
                    <span><code className="text-cyan-600 text-xs">false</code> — 음성 입력 비활성</span>
                  </div>
                </div>
              </div>

              <Callout type="warn" icon="⚠️">
                <code className="text-red-600 text-xs">dualModel.architectModel</code>과{" "}
                <code className="text-red-600 text-xs">editorModel</code>은 defaults.ts에 직접 하드코딩되어 있습니다.
                이 값들은 <code className="text-cyan-600 text-xs">constants.ts</code>의 단일 소스 패턴을 따르지 않으므로
                변경 시 주의가 필요합니다.
              </Callout>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 4. 사용법 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"🚀"}</span> 사용법
            </h2>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>config-loader에서의 사용</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">DEFAULT_CONFIG</code>는{" "}
              <code className="text-cyan-600 text-xs">loadConfig()</code>의 병합 기반(base)으로 사용됩니다.
              다른 레이어의 설정이 이 위에 deepMerge로 얹혀집니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">DEFAULT_CONFIG</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./config/defaults.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// Level 1 기본값에서 시작하여 순서대로 병합"}</span>{"\n"}
              <span className="text-[#ff7b72]">let</span>{" "}
              <span className="text-[#79c0ff]">merged</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#c9d1d9]">{"{ ...DEFAULT_CONFIG };"}</span>{"\n"}
              <span className="text-[#c9d1d9]">merged =</span>{" "}
              <span className="text-[#d2a8ff]">deepMerge</span>
              <span className="text-[#c9d1d9]">(merged, userConfig);</span>{" "}
              <span className="text-[#8b949e]">{"// Level 2"}</span>{"\n"}
              <span className="text-[#c9d1d9]">merged =</span>{" "}
              <span className="text-[#d2a8ff]">deepMerge</span>
              <span className="text-[#c9d1d9]">(merged, projectConfig);</span>{" "}
              <span className="text-[#8b949e]">{"// Level 3"}</span>{"\n"}
              <span className="text-[#c9d1d9]">merged =</span>{" "}
              <span className="text-[#d2a8ff]">deepMerge</span>
              <span className="text-[#c9d1d9]">(merged, envConfig);</span>{" "}
              <span className="text-[#8b949e]">{"// Level 4"}</span>{"\n"}
              <span className="text-[#c9d1d9]">merged =</span>{" "}
              <span className="text-[#d2a8ff]">deepMerge</span>
              <span className="text-[#c9d1d9]">(merged, cliOverrides);</span>{" "}
              <span className="text-[#8b949e]">{"// Level 5"}</span>
            </CodeBlock>

            <DeepDive title="기본값 변경 시 영향 범위">
              <p className="mb-3">
                <code className="text-cyan-600 text-xs">DEFAULT_CONFIG</code>를 변경하면
                설정 파일이나 환경변수를 지정하지 않은 <strong>모든 사용자</strong>에게 영향을 미칩니다.
              </p>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                  <div className="flex gap-3">
                    <span className="text-emerald-600 font-bold shrink-0 w-28">안전한 변경</span>
                    <span>UI 설정, verbose, locale 등 &mdash; 앱 동작에 큰 영향 없음</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-red-600 font-bold shrink-0 w-28">위험한 변경</span>
                    <span>모델명, API URL, 보안 설정 등 &mdash; 모든 사용자의 LLM 연결과 보안에 직접 영향</span>
                  </div>
                </div>
              </div>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 5. 내부 구현 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"🔍"}</span> 내부 구현
            </h2>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>constants.ts 의존성</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              모델명과 LLM 기본값은 <code className="text-cyan-600 text-xs">constants.ts</code>에서 가져옵니다.
              이 파일은 환경변수(<code className="text-cyan-600 text-xs">DBCODE_MODEL</code> 등)를 읽어
              단일 진실의 원천(single source of truth)으로 동작합니다.
            </p>

            <MermaidDiagram
              title="기본값 의존성 구조"
              titleColor="cyan"
              chart={`flowchart LR
  CONST["constants.ts<br/><small>DEFAULT_MODEL<br/>LLM_DEFAULTS</small>"]
  DEFAULTS["defaults.ts<br/><small>DEFAULT_CONFIG</small>"]
  LOADER["config/loader.ts<br/><small>loadConfig()</small>"]
  SCHEMA["config/schema.ts<br/><small>Zod 기본값 (별도)</small>"]

  CONST --> DEFAULTS
  DEFAULTS --> LOADER
  SCHEMA --> LOADER

  style CONST fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style DEFAULTS fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style LOADER fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style SCHEMA fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b`}
            />

            <Callout type="info" icon="📝">
              <strong>Zod 기본값과의 차이:</strong>{" "}
              <code className="text-cyan-600 text-xs">schema.ts</code>의 Zod <code className="text-cyan-600 text-xs">.default()</code> 값과
              <code className="text-cyan-600 text-xs"> defaults.ts</code>의 값이 일부 다를 수 있습니다.
              <code className="text-cyan-600 text-xs"> defaults.ts</code>는 <code className="text-cyan-600 text-xs">constants.ts</code>에서 동적으로 가져오지만,
              Zod <code className="text-cyan-600 text-xs">.default()</code>는 import 시점의 정적 값입니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 6. 트러블슈팅 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"🔧"}</span> 트러블슈팅
            </h2>

            <div className="flex flex-col gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 기본 모델이 예상과 다릅니다
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <code className="text-cyan-600 text-xs">DEFAULT_MODEL</code>은{" "}
                    <code className="text-cyan-600 text-xs">constants.ts</code>에서 환경변수를 확인하여 결정됩니다.
                    <code className="text-cyan-600 text-xs"> DBCODE_MODEL</code> 환경변수가 설정되어 있으면
                    defaults.ts의 모델명이 달라질 수 있습니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> Zod 기본값과 defaults.ts 값이 달라요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <strong className="text-gray-900">이것은 의도된 설계입니다.</strong> Zod의{" "}
                    <code className="text-cyan-600 text-xs">.default()</code>는 import 시점에 평가되므로
                    하드코딩된 값입니다. 반면 <code className="text-cyan-600 text-xs">defaults.ts</code>는{" "}
                    <code className="text-cyan-600 text-xs">constants.ts</code>를 통해 환경변수를 반영합니다.
                    실제 병합 시에는 <code className="text-cyan-600 text-xs">defaults.ts</code> 값이 사용됩니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> timeout이 120초로 길게 설정된 이유
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    bash 도구의 실행 타임아웃과 일치시키기 위함입니다.
                    복잡한 코드 생성 요청은 LLM 응답에 2분 이상 걸릴 수 있으므로,
                    API 타임아웃이 너무 짧으면 유효한 응답이 잘립니다.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 7. 관련 문서 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"🔗"}</span> 관련 문서
            </h2>

            <SeeAlso
              items={[
                {
                  name: "config/schema.ts",
                  slug: "config-schema",
                  relation: "sibling",
                  desc: "Zod 런타임 스키마 — defaults.ts와 함께 설정 시스템의 기반을 구성",
                },
                {
                  name: "config/loader.ts",
                  slug: "config-loader",
                  relation: "parent",
                  desc: "DEFAULT_CONFIG를 Level 1 기반으로 사용하여 5단계 병합을 수행",
                },
                {
                  name: "model-capabilities.ts",
                  slug: "model-capabilities",
                  relation: "sibling",
                  desc: "모델별 기능 맵 — defaults.ts의 모델명으로 기능을 조회",
                },
              ]}
            />
          </section>
        </RevealOnScroll>

      </div>
    </div>
  );
}
