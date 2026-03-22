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

export default function ConfigSchemaPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">

        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <FilePath path="src/config/schema.ts" />
            <LayerBadge layer="leaf" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
            <span className="text-gray-900">
              Config Schema
            </span>
          </h1>
          <p className="text-[16px] text-gray-600 max-w-[640px]">
            Zod를 사용한 런타임 설정 유효성 검증 모듈입니다.
            JSON 파일이나 환경변수에서 로드한 값이 올바른 형식인지 <span className="text-violet-600 font-semibold">런타임에 검증</span>하고,
            잘못된 값에 <span className="text-cyan-600 font-semibold">명확한 에러 메시지</span>를 제공합니다.
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
              TypeScript의 타입 검사는 컴파일 시점에만 동작합니다.
              JSON 파일이나 환경변수 같은 <strong className="text-gray-900">외부 입력</strong>은
              런타임에 어떤 값이 들어올지 알 수 없으므로, <span className="text-violet-600 font-semibold">Zod 스키마</span>로
              형식과 범위를 검증합니다.
              각 스키마의 <code className="text-cyan-600 text-xs">.default()</code>는 누락된 필드에 자동으로 기본값을 적용합니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>Zod의 장점:</strong> 검증과 타입 추론이 동시에 이루어집니다.
              <code className="text-cyan-600 text-xs"> z.infer&lt;typeof schema&gt;</code>로 스키마에서 TypeScript 타입을 자동 생성할 수 있습니다.
            </Callout>

            <MermaidDiagram
              title="스키마 계층 구조"
              titleColor="purple"
              chart={`flowchart TB
  ROOT["configSchema<br/><small>전체 설정 스키마</small>"]
  LLM["llmConfigSchema<br/><small>LLM 연결 설정</small>"]
  PERM["permissionModeSchema<br/><small>5가지 권한 모드</small>"]
  PERMS["permissionsConfigSchema<br/><small>allow/deny 규칙</small>"]
  SEC["securityConfigSchema<br/><small>보안/가드레일</small>"]
  UI["uiConfigSchema<br/><small>테마/렌더링</small>"]
  VOICE["voiceConfigSchema<br/><small>음성 입력</small>"]
  DUAL["dualModelConfigSchema<br/><small>Architect/Editor</small>"]

  ROOT --> LLM
  ROOT --> PERM
  ROOT --> PERMS
  ROOT --> SEC
  ROOT --> UI
  ROOT --> VOICE
  ROOT --> DUAL

  style ROOT fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style LLM fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style PERM fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style SEC fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style UI fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style DUAL fill:#f1f5f9,stroke:#3b82f6,color:#1e293b`}
            />
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 3. 레퍼런스 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"📋"}</span> 레퍼런스
            </h2>

            {/* llmConfigSchema */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">llmConfigSchema</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                LLM 제공자 연결 설정. 로컬 LLM(Ollama, LM Studio)과 외부 API(OpenAI, Anthropic) 모두 지원합니다.
              </p>
              <ParamTable
                params={[
                  { name: "baseUrl", type: "string (URL)", required: false, desc: 'API 엔드포인트 (기본: "https://api.openai.com/v1")' },
                  { name: "apiKey", type: "string?", required: false, desc: "API 인증 키 (로컬 LLM은 불필요)" },
                  { name: "model", type: "string", required: false, desc: '모델명 (기본: "gpt-5.1-codex-mini")' },
                  { name: "temperature", type: "number (0-2)", required: false, desc: "응답 온도 (기본: 0.0 — 결정적)" },
                  { name: "maxTokens", type: "number (+)", required: false, desc: "최대 생성 토큰 (기본: 32768)" },
                  { name: "contextWindow", type: "number (+)", required: false, desc: "컨텍스트 윈도우 (기본: 1,000,000)" },
                  { name: "timeout", type: "number (+)", required: false, desc: "API 타임아웃 ms (기본: 60,000)" },
                ]}
              />
            </div>

            {/* permissionModeSchema */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">permissionModeSchema</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                5가지 권한 모드를 정의하는 enum 스키마입니다.
              </p>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-36">"default"</code>
                    <span>위험한 작업만 확인 요청</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-36">"acceptEdits"</code>
                    <span>파일 편집은 자동 허용</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-36">"plan"</code>
                    <span>실행하지 않고 계획만 보여줌</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-amber-600 font-bold shrink-0 w-36">"dontAsk"</code>
                    <span>모든 작업 자동 허용 (주의!)</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-red-600 font-bold shrink-0 w-36">"bypassPermissions"</code>
                    <span>모든 권한 검사 건너뜀 (위험!)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* securityConfigSchema */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">securityConfigSchema</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                보안/가드레일 설정. 프롬프트 인젝션 방지, 비밀키 유출 방지, 요청 제한 등을 검증합니다.
              </p>
              <ParamTable
                params={[
                  { name: "mode", type: '"local"|"external"|"hybrid"', required: false, desc: '보안 모드 (기본: "local")' },
                  { name: "secretScanning", type: "boolean", required: false, desc: "비밀키 스캔 (기본: true)" },
                  { name: "inputFiltering", type: "boolean", required: false, desc: "프롬프트 인젝션 차단 (기본: true)" },
                  { name: "outputFiltering", type: "boolean", required: false, desc: "민감 정보 마스킹 (기본: true)" },
                  { name: "auditLogging", type: "boolean", required: false, desc: "감사 로깅 (기본: false)" },
                  { name: "rateLimit", type: "object", required: false, desc: "requestsPerMinute(60), tokensPerDay(1M)" },
                ]}
              />
            </div>

            {/* 기타 스키마 */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">기타 하위 스키마</span>
              </h3>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-44">uiConfigSchema</code>
                    <span>theme(auto/dark/light), markdown, syntaxHighlighting, spinner, statusBar</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-44">permissionsConfigSchema</code>
                    <span>allow/deny 패턴 배열 &mdash; deny가 항상 우선</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-44">voiceConfigSchema</code>
                    <span>STT 설정 &mdash; enabled, provider(openai/local), language, model</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-44">dualModelConfigSchema</code>
                    <span>Architect/Editor 듀얼 모델 라우팅 &mdash; enabled, 모델명, 전략</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-44">configSchema</code>
                    <span>전체 통합 스키마 &mdash; 위 모든 하위 스키마를 z.object()로 조합</span>
                  </div>
                </div>
              </div>

              <Callout type="warn" icon="⚠️">
                <strong>Zod .default() 주의:</strong> 기본값은 import 시점에 평가됩니다.
                <code className="text-cyan-600 text-xs"> process.env</code>가 아닌 하드코딩 값을 사용해야 합니다.
                환경변수 기반 오버라이드는 <code className="text-cyan-600 text-xs">config/loader.ts</code>의{" "}
                <code className="text-cyan-600 text-xs">loadEnvConfig()</code>에서 처리합니다.
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

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>설정 검증</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              병합된 설정 객체를 <code className="text-cyan-600 text-xs">configSchema.parse()</code>로 검증합니다.
              실패하면 Zod 에러가 발생합니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">configSchema</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./config/schema.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// 병합된 설정을 Zod로 검증 + 누락 필드에 기본값 적용"}</span>{"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">validated</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#c9d1d9]">configSchema.</span>
              <span className="text-[#d2a8ff]">parse</span>
              <span className="text-[#c9d1d9]">(mergedConfig);</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// 타입 추론도 자동으로 수행됨"}</span>{"\n"}
              <span className="text-[#8b949e]">{"// type AppConfig = z.infer<typeof configSchema>"}</span>
            </CodeBlock>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>개별 스키마 사용</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              하위 스키마를 독립적으로 사용하여 부분 설정을 검증할 수 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">llmConfigSchema</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./config/schema.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// LLM 설정만 따로 검증"}</span>{"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">llmConfig</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#c9d1d9]">llmConfigSchema.</span>
              <span className="text-[#d2a8ff]">parse</span>
              <span className="text-[#c9d1d9]">({"{"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">model</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"claude-opus-4-6"'}</span>
              <span className="text-[#c9d1d9]">,</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">temperature</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">0.5</span>{"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
              <span className="text-[#c9d1d9]">);</span>{"\n"}
              <span className="text-[#8b949e]">{"// 나머지 필드(baseUrl, timeout 등)에는 기본값이 적용됨"}</span>
            </CodeBlock>

            <DeepDive title="safeParse로 에러를 던지지 않고 검증하기">
              <p className="mb-3">
                <code className="text-cyan-600 text-xs">.safeParse()</code>를 사용하면 에러를 던지지 않고
                검증 결과를 객체로 받을 수 있습니다.
              </p>

              <CodeBlock>
                <span className="text-[#ff7b72]">const</span>{" "}
                <span className="text-[#79c0ff]">result</span>{" "}
                <span className="text-[#c9d1d9]">=</span>{" "}
                <span className="text-[#c9d1d9]">configSchema.</span>
                <span className="text-[#d2a8ff]">safeParse</span>
                <span className="text-[#c9d1d9]">(input);</span>{"\n\n"}
                <span className="text-[#ff7b72]">if</span>{" "}
                <span className="text-[#c9d1d9]">(result.success) {"{"}</span>{"\n"}
                <span className="text-[#c9d1d9]">{"  "}</span>
                <span className="text-[#8b949e]">{"// result.data: 검증된 AppConfig"}</span>{"\n"}
                <span className="text-[#c9d1d9]">{"} "}</span>
                <span className="text-[#ff7b72]">else</span>
                <span className="text-[#c9d1d9]">{" {"}</span>{"\n"}
                <span className="text-[#c9d1d9]">{"  "}</span>
                <span className="text-[#8b949e]">{"// result.error: ZodError (어떤 필드가 잘못됐는지 상세 정보)"}</span>{"\n"}
                <span className="text-[#c9d1d9]">{"}"}</span>
              </CodeBlock>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 5. 내부 구현 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"🔍"}</span> 내부 구현
            </h2>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>스키마 조합 전략</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">configSchema</code>는 7개 하위 스키마를{" "}
              <code className="text-cyan-600 text-xs">z.object()</code>로 조합합니다.
              각 하위 스키마는 독립적으로 <code className="text-cyan-600 text-xs">.default({})</code>를 가지므로
              전체 객체에 빈 객체만 전달해도 모든 필드에 기본값이 채워집니다.
            </p>

            <MermaidDiagram
              title="스키마 기본값 전파"
              titleColor="cyan"
              chart={`flowchart LR
  INPUT["{}<br/><small>빈 객체</small>"] --> PARSE["configSchema.parse({})"]
  PARSE --> LLM["llm: { baseUrl: ...<br/>model: ...<br/>temperature: 0 }"]
  PARSE --> SEC["security: { mode: 'local'<br/>secretScanning: true<br/>... }"]
  PARSE --> UI["ui: { theme: 'auto'<br/>markdown: true<br/>... }"]
  PARSE --> REST["... 나머지 필드"]

  style INPUT fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style PARSE fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style LLM fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px
  style SEC fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px
  style UI fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px`}
            />

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>검증 규칙 요약</h3>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-cyan-600 font-bold shrink-0 w-28">URL 검증</span>
                  <span><code className="text-cyan-600 text-xs">baseUrl</code>에 <code className="text-cyan-600 text-xs">z.string().url()</code> 적용 &mdash; 잘못된 URL은 즉시 거부</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-violet-600 font-bold shrink-0 w-28">범위 검증</span>
                  <span><code className="text-cyan-600 text-xs">temperature</code>에 <code className="text-cyan-600 text-xs">.min(0).max(2)</code> &mdash; 0~2 범위만 허용</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-emerald-600 font-bold shrink-0 w-28">양수 검증</span>
                  <span><code className="text-cyan-600 text-xs">maxTokens</code>, <code className="text-cyan-600 text-xs">timeout</code> 등에 <code className="text-cyan-600 text-xs">.positive()</code> &mdash; 0 이하 거부</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-28">열거형 검증</span>
                  <span><code className="text-cyan-600 text-xs">permissionMode</code>는 5가지, <code className="text-cyan-600 text-xs">tone</code>은 6가지 값만 허용</span>
                </div>
              </div>
            </div>

            <Callout type="info" icon="📝">
              <strong>tone 설정:</strong> <code className="text-cyan-600 text-xs">"normal"</code>,
              <code className="text-cyan-600 text-xs"> "cute"</code>,
              <code className="text-cyan-600 text-xs"> "senior"</code>,
              <code className="text-cyan-600 text-xs"> "friend"</code>,
              <code className="text-cyan-600 text-xs"> "mentor"</code>,
              <code className="text-cyan-600 text-xs"> "minimal"</code> &mdash;
              6가지 응답 톤을 지원하여 사용자 경험을 커스터마이징합니다.
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
                  <span className="text-red-600">Q.</span> ZodError: Expected string, received number
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    JSON에서 문자열이어야 할 필드에 숫자를 넣었습니다.
                    예: <code className="text-red-600 text-xs">{'"model": 4'}</code> 대신{" "}
                    <code className="text-cyan-600 text-xs">{'"model": "gpt-4o"'}</code>를 사용하세요.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> temperature 범위 에러
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <code className="text-cyan-600 text-xs">temperature</code>는 0~2 사이여야 합니다.
                    음수나 2 초과 값은 Zod가 거부합니다.
                    대부분의 코딩 작업에서는 <code className="text-cyan-600 text-xs">0.0</code>(결정적)이 권장됩니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> Invalid enum value for permissionMode
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    허용된 값: <code className="text-cyan-600 text-xs">"default"</code>,
                    <code className="text-cyan-600 text-xs"> "acceptEdits"</code>,
                    <code className="text-cyan-600 text-xs"> "plan"</code>,
                    <code className="text-cyan-600 text-xs"> "dontAsk"</code>,
                    <code className="text-cyan-600 text-xs"> "bypassPermissions"</code>.
                    대소문자에 주의하세요 &mdash; <code className="text-red-600 text-xs">"Plan"</code>은 유효하지 않습니다.
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
                  name: "config/defaults.ts",
                  slug: "config-defaults",
                  relation: "sibling",
                  desc: "하드코딩 기본값 — schema.ts의 .default() 값과 별도로 관리되는 Level 1 폴백",
                },
                {
                  name: "config/loader.ts",
                  slug: "config-loader",
                  relation: "parent",
                  desc: "5단계 병합 후 configSchema.parse()로 최종 검증을 수행하는 로더",
                },
                {
                  name: "hooks/loader.ts",
                  slug: "hook-loader",
                  relation: "sibling",
                  desc: "같은 Zod 기반 스키마 검증을 훅 설정에 적용하는 모듈",
                },
                {
                  name: "permission-manager.ts",
                  slug: "permission-manager",
                  relation: "parent",
                  desc: "permissionModeSchema의 5가지 모드를 실제로 적용하는 권한 관리자",
                },
              ]}
            />
          </section>
        </RevealOnScroll>

      </div>
    </div>
  );
}
