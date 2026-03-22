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

export default function HookLoaderPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">

        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <FilePath path="src/hooks/loader.ts" />
            <LayerBadge layer="leaf" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
            <span className="text-gray-900">
              Hook Loader
            </span>
          </h1>
          <p className="text-[16px] text-gray-600 max-w-[640px]">
            settings.json에서 훅 설정을 읽고 <span className="text-violet-600 font-semibold">Zod 스키마</span>로 검증하는 모듈입니다.
            <span className="text-cyan-600 font-semibold"> discriminatedUnion</span>으로 핸들러 타입별 필수 필드를 엄격하게 확인합니다.
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
              Hook Loader는 <code className="text-cyan-600 text-xs">.dbcode/settings.json</code>의
              <code className="text-cyan-600 text-xs"> "hooks"</code> 키에서 훅 설정을 로드합니다.
              Zod의 <strong className="text-gray-900">discriminatedUnion</strong>을 활용하여
              <code className="text-cyan-600 text-xs"> type</code> 필드에 따라 서로 다른 스키마를 적용합니다.
              파일이 없거나 <code className="text-cyan-600 text-xs">"hooks"</code> 키가 없으면 빈 설정을 반환합니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>타입 안전성:</strong> <code className="text-cyan-600 text-xs">type: "command"</code>이면 <code className="text-cyan-600 text-xs">command</code> 필드 필수,
              <code className="text-cyan-600 text-xs"> type: "http"</code>이면 <code className="text-cyan-600 text-xs">url</code> 필드 필수 &mdash;
              잘못된 조합은 Zod가 파싱 단계에서 거부합니다.
            </Callout>

            <MermaidDiagram
              title="훅 설정 로딩 흐름"
              titleColor="purple"
              chart={`flowchart TB
  FILE[".dbcode/settings.json"] --> READ["파일 읽기 + JSON 파싱"]
  READ -->|ENOENT| EMPTY["빈 설정 반환 {}"]
  READ -->|성공| EXTRACT['"hooks" 키 추출']
  EXTRACT -->|없음| EMPTY2["빈 설정 반환 {}"]
  EXTRACT -->|있음| VALIDATE["이벤트 이름 검증<br/><small>HOOK_EVENTS 목록과 대조</small>"]
  VALIDATE -->|잘못된 이름| ERROR["HookLoadError 던짐"]
  VALIDATE -->|통과| ZOD["Zod 스키마 파싱<br/><small>discriminatedUnion</small>"]
  ZOD -->|실패| ERROR2["HookLoadError 던짐"]
  ZOD -->|성공| CONFIG["HookConfig 반환"]

  style FILE fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style VALIDATE fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style ZOD fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style CONFIG fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px
  style ERROR fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style ERROR2 fill:#f1f5f9,stroke:#ef4444,color:#1e293b`}
            />
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 3. 레퍼런스 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"📋"}</span> 레퍼런스
            </h2>

            {/* loadHookConfig */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">loadHookConfig()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">async</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                settings.json에서 훅 설정을 로드합니다. 파일이 없으면 빈 설정을 반환합니다.
              </p>
              <ParamTable
                params={[
                  { name: "settingsDir", type: "string", required: true, desc: 'settings.json이 있는 디렉토리 (예: ".dbcode")' },
                ]}
              />
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">반환: <code className="text-violet-600 text-xs">Promise&lt;HookConfig&gt;</code></h4>
                <p className="text-[13px] text-gray-600">
                  이벤트 이름을 키로, 규칙 배열을 값으로 가진 객체. 예:{" "}
                  <code className="text-cyan-600 text-xs">{"{ PostToolUse: [{ matcher: \"file_edit\", hooks: [...] }] }"}</code>
                </p>
              </div>
            </div>

            {/* parseHookConfig */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">parseHookConfig()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                원시 객체를 파싱하고 검증하여 타입 안전한 HookConfig를 반환합니다.
                이벤트 이름 검증 + Zod 스키마 검증의 2단계를 수행합니다.
              </p>
              <ParamTable
                params={[
                  { name: "raw", type: "unknown", required: true, desc: "JSON 파싱 결과 (null/undefined 허용 → 빈 설정 반환)" },
                ]}
              />
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">반환: <code className="text-violet-600 text-xs">HookConfig</code></h4>
              </div>
            </div>

            {/* Zod 스키마 구조 */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">Zod 스키마 구조</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-50 text-gray-400">internal</span>
              </h3>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-36">hookHandlerSchema</code>
                    <span>discriminatedUnion("type") &mdash; command / http / prompt / agent 4가지</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-36">hookRuleSchema</code>
                    <span>matcher(선택) + hooks 배열(최소 1개)</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-36">hookConfigSchema</code>
                    <span>이벤트 이름(string) → 규칙 배열의 Record</span>
                  </div>
                </div>
              </div>

              <Callout type="warn" icon="⚠️">
                이벤트 이름 검증은 Zod 스키마와 별도로 수행됩니다.
                <code className="text-cyan-600 text-xs"> HOOK_EVENTS</code> 목록에 없는 이벤트 이름은
                <code className="text-red-600 text-xs"> HookLoadError</code>를 던집니다.
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

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>settings.json에서 훅 설정</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">.dbcode/settings.json</code>의{" "}
              <code className="text-cyan-600 text-xs">"hooks"</code> 키에 다음과 같이 설정합니다:
            </p>

            <CodeBlock>
              <span className="text-[#c9d1d9]">{"{"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#7ee787]">{'"hooks"'}</span>
              <span className="text-[#c9d1d9]">{": {"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"    "}</span>
              <span className="text-[#7ee787]">{'"PostToolUse"'}</span>
              <span className="text-[#c9d1d9]">{": [{"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"      "}</span>
              <span className="text-[#7ee787]">{'"matcher"'}</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"file_edit"'}</span>
              <span className="text-[#c9d1d9]">,</span>{"\n"}
              <span className="text-[#c9d1d9]">{"      "}</span>
              <span className="text-[#7ee787]">{'"hooks"'}</span>
              <span className="text-[#c9d1d9]">{": [{"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"        "}</span>
              <span className="text-[#7ee787]">{'"type"'}</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"command"'}</span>
              <span className="text-[#c9d1d9]">,</span>{"\n"}
              <span className="text-[#c9d1d9]">{"        "}</span>
              <span className="text-[#7ee787]">{'"command"'}</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"eslint --fix $FILE_PATH"'}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"      }]"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"    }]"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  }"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
            </CodeBlock>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>프로그래밍 방식으로 로드</h3>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">loadHookConfig</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./hooks/loader.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>{"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">config</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">loadHookConfig</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"./my-project/.dbcode"'}</span>
              <span className="text-[#c9d1d9]">);</span>{"\n"}
              <span className="text-[#8b949e]">{"// config.PostToolUse → 규칙 배열 또는 undefined"}</span>
            </CodeBlock>

            <DeepDive title="핸들러 타입별 필수 필드">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">type</th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">필수 필드</th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">선택 필드</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 font-mono text-emerald-600">command</td>
                      <td className="p-2.5"><code className="text-cyan-600">command</code></td>
                      <td className="p-2.5">timeoutMs, blocking</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 font-mono text-violet-600">http</td>
                      <td className="p-2.5"><code className="text-cyan-600">url</code> (유효한 URL)</td>
                      <td className="p-2.5">headers, timeoutMs, blocking</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 font-mono text-blue-600">prompt</td>
                      <td className="p-2.5"><code className="text-cyan-600">prompt</code>, <code className="text-cyan-600">promptMessage</code></td>
                      <td className="p-2.5">timeout, model, timeoutMs, blocking</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-red-600">agent</td>
                      <td className="p-2.5"><code className="text-cyan-600">prompt</code>, <code className="text-cyan-600">validator</code>, <code className="text-cyan-600">description</code></td>
                      <td className="p-2.5">allowedTools, model, timeoutMs, blocking</td>
                    </tr>
                  </tbody>
                </table>
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

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>2단계 검증 전략</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              설정 검증은 두 단계로 분리되어 있습니다. 이벤트 이름은 Zod로는 열거할 수 없는 동적 키이므로
              별도의 <code className="text-cyan-600 text-xs">validateEventNames()</code>로 먼저 확인합니다.
            </p>

            <MermaidDiagram
              title="2단계 검증 파이프라인"
              titleColor="cyan"
              chart={`flowchart LR
  RAW["원시 객체"] --> STEP1["1단계: 이벤트 이름 검증<br/><small>validateEventNames()</small>"]
  STEP1 --> STEP2["2단계: Zod 스키마 파싱<br/><small>hookConfigSchema.parse()</small>"]
  STEP2 --> CAST["HookEvent 타입 캐스팅"]
  CAST --> CONFIG["HookConfig 반환"]

  style RAW fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style STEP1 fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style STEP2 fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style CONFIG fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px`}
            />

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>에러 처리 전략</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">loadHookConfig()</code>은 3가지 경우를 구분합니다:
            </p>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-emerald-600 font-bold shrink-0 w-28">ENOENT</span>
                  <span>파일 없음 &rarr; 빈 설정 반환 (정상 &mdash; 훅 미사용)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-red-600 font-bold shrink-0 w-28">HookLoadError</span>
                  <span>검증 실패 &rarr; 그대로 상위로 전파</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-28">기타 에러</span>
                  <span>JSON 파싱 실패 등 &rarr; HookLoadError로 래핑하여 던짐</span>
                </div>
              </div>
            </div>

            <Callout type="info" icon="📝">
              <strong>null/undefined 허용:</strong> <code className="text-cyan-600 text-xs">parseHookConfig(null)</code>이나
              <code className="text-cyan-600 text-xs"> parseHookConfig(undefined)</code>는 에러 없이 빈 설정을 반환합니다.
              settings.json에 <code className="text-cyan-600 text-xs">"hooks"</code> 키가 아예 없는 경우를 우아하게 처리합니다.
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
                  <span className="text-red-600">Q.</span> HookLoadError: Unknown hook event
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    이벤트 이름에 오타가 있습니다. 유효한 이벤트 이름은{" "}
                    <code className="text-cyan-600 text-xs">HOOK_EVENTS</code> 목록에 정의되어 있습니다.
                    예: <code className="text-cyan-600 text-xs">"PostToolUse"</code>,{" "}
                    <code className="text-cyan-600 text-xs">"PreToolUse"</code>.
                    대소문자에 주의하세요.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> Zod 파싱 에러: Required at "hooks[0].command"
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <code className="text-cyan-600 text-xs">type: "command"</code>인 핸들러에{" "}
                    <code className="text-cyan-600 text-xs">command</code> 필드가 없습니다.
                    discriminatedUnion은 <code className="text-cyan-600 text-xs">type</code> 값에 따라
                    필수 필드를 결정합니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 훅 설정이 무시돼요 (빈 설정으로 로드됨)
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 1:</strong> settings.json의 JSON 문법 오류.
                    파싱 실패 시 ENOENT가 아닌 다른 에러가 발생하여 HookLoadError로 래핑됩니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인 2:</strong>{" "}
                    <code className="text-cyan-600 text-xs">"hooks"</code>가 아닌 다른 키 이름을 사용했습니다.
                    정확히 <code className="text-cyan-600 text-xs">"hooks"</code>여야 합니다.
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
                  name: "hooks/runner.ts",
                  slug: "hook-runner",
                  relation: "sibling",
                  desc: "로드된 HookConfig를 받아 실제 핸들러를 실행하는 엔진",
                },
                {
                  name: "config/schema.ts",
                  slug: "config-schema",
                  relation: "sibling",
                  desc: "같은 Zod 기반 스키마 검증을 사용하는 설정 스키마 모듈",
                },
                {
                  name: "config/loader.ts",
                  slug: "config-loader",
                  relation: "sibling",
                  desc: "비슷한 JSON 파일 로딩 패턴을 사용하는 설정 로더",
                },
              ]}
            />
          </section>
        </RevealOnScroll>

      </div>
    </div>
  );
}
