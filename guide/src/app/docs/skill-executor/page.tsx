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

export default function SkillExecutorPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilePath path="src/skills/executor.ts" />
              <LayerBadge layer="leaf" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
              <span className="text-gray-900">Skill Executor</span>
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[640px]">
              스킬 실행 엔진 &mdash; SKILL.md의 본문을 파싱하여{" "}
              <span className="text-cyan-600 font-semibold">변수 치환</span>과
              <span className="text-violet-600 font-semibold"> 동적 컨텍스트 주입</span>을 수행한 뒤
              최종 프롬프트를 생성합니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ───────────────────── 2. 개요 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"📦"}</span> 개요
            </h2>
            <p className="text-[14px] text-gray-600 leading-relaxed mb-4">
              Skill Executor는 로드된 스킬 정의(SkillDefinition)를 받아{" "}
              <strong className="text-gray-900">3단계 파이프라인</strong>으로 처리합니다. 먼저{" "}
              <code className="text-cyan-600 text-xs">$ARGUMENTS</code>,{" "}
              <code className="text-cyan-600 text-xs">$0</code> 등의 변수를 실제 값으로 치환하고,
              <code className="text-cyan-600 text-xs">{" `!command`"}</code> 구문을 셸 명령 실행
              결과로 교체한 뒤, 최종 프롬프트와 실행 옵션을 반환합니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>핵심 원칙:</strong> 변수 치환은 동기, 동적 컨텍스트 주입은 비동기입니다. 셸
              명령 실패 시에도 프로세스를 중단하지 않고 에러 메시지를 본문에 삽입합니다.
            </Callout>

            <MermaidDiagram
              title="스킬 실행 3단계 파이프라인"
              titleColor="orange"
              chart={`flowchart LR
  INPUT["📄 스킬 본문\\n+ SkillContext"]
  STEP1["1️⃣ 변수 치환\\n$ARGUMENTS, $0, $1\\n${"${DBCODE_*}"}"]
  STEP2["2️⃣ 동적 컨텍스트\\n${"`!git status`"}\\n→ 셸 실행 결과"]
  STEP3["3️⃣ 결과 조립\\nprompt + model\\n+ fork + tools"]
  OUTPUT["✅ SkillExecutionResult\\nLLM 전송 준비 완료"]

  INPUT --> STEP1 --> STEP2 --> STEP3 --> OUTPUT

  style INPUT fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style STEP1 fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style STEP2 fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style STEP3 fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style OUTPUT fill:#f8fafc,stroke:#06b6d4,color:#06b6d4,stroke-width:2px`}
            />

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
              <h4 className="text-[14px] font-bold mb-3">지원하는 변수 문법</h4>
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-36">
                    <code className="text-xs">$ARGUMENTS</code>
                  </span>
                  <span>
                    전체 인자 문자열 (예:{" "}
                    <code className="text-cyan-600 text-xs">/commit fix auth bug</code> &rarr;{" "}
                    <code className="text-cyan-600 text-xs">fix auth bug</code>)
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-violet-600 font-bold shrink-0 w-36">
                    <code className="text-xs">$ARGUMENTS[N]</code>
                  </span>
                  <span>N번째 인자 접근 (0부터 시작)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-600 font-bold shrink-0 w-36">
                    <code className="text-xs">$0, $1, $2...</code>
                  </span>
                  <span>
                    위치별 인자 &mdash; <code className="text-cyan-600 text-xs">$ARGUMENTS[N]</code>
                    과 동일
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-emerald-600 font-bold shrink-0 w-36">
                    <code className="text-xs">{"${DBCODE_*}"}</code>
                  </span>
                  <span>세션 ID, 스킬 디렉토리, 프로젝트 디렉토리 환경 변수</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-red-600 font-bold shrink-0 w-36">
                    <code className="text-xs">{"`!command`"}</code>
                  </span>
                  <span>셸 명령 실행 결과로 교체 (동적 컨텍스트)</span>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 3. 레퍼런스 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"📋"}</span> 레퍼런스
            </h2>

            {/* SkillExecutionError */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">SkillExecutionError</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-600">
                  class
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                스킬 실행 중 발생한 오류를 래핑하는 에러 클래스입니다.
                <code className="text-cyan-600 text-xs"> BaseError</code>를 상속하며, 에러 코드는{" "}
                <code className="text-red-600 text-xs">SKILL_EXECUTION_ERROR</code>입니다. 본문이
                비어있는 스킬 실행 시 이 에러가 발생합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "message",
                    type: "string",
                    required: true,
                    desc: "에러 메시지",
                  },
                  {
                    name: "context",
                    type: "Record<string, unknown>",
                    required: false,
                    desc: "추가 컨텍스트 정보 (skill 이름 등). 기본값 {}",
                  },
                ]}
              />
            </div>

            {/* executeSkill */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">executeSkill()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">
                  async
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                스킬을 실행하여 최종 프롬프트를 생성하는 메인 함수입니다. 변수 치환 &rarr; 동적
                컨텍스트 주입 &rarr; 결과 조립의 3단계를 수행합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "skill",
                    type: "SkillDefinition",
                    required: true,
                    desc: "실행할 스킬 정의 (프론트매터 + 본문)",
                  },
                  {
                    name: "context",
                    type: "SkillContext",
                    required: true,
                    desc: "런타임 컨텍스트 (인자, 세션 정보, 작업 디렉토리 등)",
                  },
                ]}
              />

              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환 타입:{" "}
                  <code className="text-violet-600 text-xs">{"Promise<SkillExecutionResult>"}</code>
                </h4>
                <ParamTable
                  params={[
                    {
                      name: "prompt",
                      type: "string",
                      required: true,
                      desc: "변수 치환 + 동적 컨텍스트 주입이 완료된 최종 프롬프트",
                    },
                    {
                      name: "model",
                      type: "string | undefined",
                      required: false,
                      desc: "프론트매터에서 지정한 모델 오버라이드 (없으면 세션 기본 모델 사용)",
                    },
                    {
                      name: "fork",
                      type: "boolean",
                      required: true,
                      desc: "true이면 서브에이전트(fork)로 분리 실행",
                    },
                    {
                      name: "agentType",
                      type: '"explore" | "plan" | "general"',
                      required: false,
                      desc: "fork 실행 시 서브에이전트 유형",
                    },
                    {
                      name: "allowedTools",
                      type: "readonly string[]",
                      required: false,
                      desc: "이 스킬 실행 중 사용 가능한 도구 목록",
                    },
                  ]}
                />
              </div>

              <Callout type="warn" icon="⚠️">
                스킬 본문이 비어있으면{" "}
                <code className="text-red-600 text-xs">SkillExecutionError</code>를 던집니다.
                프론트매터만 있고 본문이 없는 스킬은 실행할 수 없습니다.
              </Callout>
            </div>

            {/* interpolateVariables (내부 함수) */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">interpolateVariables()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-50 text-gray-400">
                  internal
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                스킬 본문의 변수 플레이스홀더를 SkillContext의 실제 값으로 치환합니다. 정규식
                기반으로 동기 처리됩니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "body",
                    type: "string",
                    required: true,
                    desc: "변수가 포함된 스킬 본문 원본",
                  },
                  {
                    name: "context",
                    type: "SkillContext",
                    required: true,
                    desc: "변수에 대입할 런타임 컨텍스트 정보",
                  },
                ]}
              />
            </div>

            {/* resolveDynamicContext (내부 함수) */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">resolveDynamicContext()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-50 text-gray-400">
                  internal
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">
                  async
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                <code className="text-cyan-600 text-xs">{"`!command`"}</code> 백틱 구문을 찾아 셸
                명령을 실행하고, 결과로 교체합니다. 명령은 순차 실행됩니다(순서 의존성 가능).
              </p>
              <ParamTable
                params={[
                  {
                    name: "body",
                    type: "string",
                    required: true,
                    desc: "동적 컨텍스트 구문이 포함된 본문",
                  },
                  {
                    name: "cwd",
                    type: "string",
                    required: true,
                    desc: "명령 실행 시 작업 디렉토리",
                  },
                ]}
              />
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 4. 사용법 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"🚀"}</span> 사용법
            </h2>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              기본 스킬 실행
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">executeSkill()</code>에 로드된 스킬과 런타임
              컨텍스트를 전달하면 변수가 치환된 최종 프롬프트를 받을 수 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">executeSkill</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./skills/executor.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">result</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">executeSkill</span>
              <span className="text-[#c9d1d9]">(skill, {"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">arguments</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"fix auth bug"'}</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">positionalArgs</span>
              <span className="text-[#c9d1d9]">{": ["}</span>
              <span className="text-[#a5d6ff]">{'"fix"'}</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#a5d6ff]">{'"auth"'}</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#a5d6ff]">{'"bug"'}</span>
              <span className="text-[#c9d1d9]">{"],"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">workingDirectory</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"~/my-project"'}</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"});"}</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// result.prompt  → 완성된 프롬프트 텍스트"}</span>
              {"\n"}
              <span className="text-[#8b949e]">{"// result.fork    → false (inline 스킬)"}</span>
              {"\n"}
              <span className="text-[#8b949e]">
                {"// result.model   → undefined (세션 기본 모델 사용)"}
              </span>
            </CodeBlock>

            <DeepDive title="동적 컨텍스트 주입 예시">
              <p className="mb-3">
                스킬 본문에 <code className="text-cyan-600 text-xs">{"`!command`"}</code> 구문을
                넣으면 실행 시점에 셸 명령 결과가 자동으로 삽입됩니다.
              </p>

              <CodeBlock>
                <span className="text-[#8b949e]">{"// 스킬 본문 (변환 전)"}</span>
                {"\n"}
                <span className="text-[#c9d1d9]">
                  {"현재 브랜치: `!git branch --show-current`"}
                </span>
                {"\n"}
                <span className="text-[#c9d1d9]">{"변경된 파일:\\n`!git diff --name-only`"}</span>
                {"\n\n"}
                <span className="text-[#8b949e]">{"// 실행 후 결과"}</span>
                {"\n"}
                <span className="text-[#c9d1d9]">{"현재 브랜치: feat/auth-fix"}</span>
                {"\n"}
                <span className="text-[#c9d1d9]">
                  {"변경된 파일:\\nsrc/auth.ts\\nsrc/login.tsx"}
                </span>
              </CodeBlock>

              <Callout type="warn" icon="⚠️">
                셸 명령 타임아웃은 <strong>10초</strong>입니다. 명령 실패 시{" "}
                <code className="text-cyan-600 text-xs">[Command failed: ...]</code> 메시지가 본문에
                삽입되며, 프로세스 전체가 중단되지는 않습니다.
              </Callout>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 5. 내부 구현 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"🔍"}</span> 내부 구현
            </h2>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              변수 치환 순서
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">interpolateVariables()</code>는 정규식을
              순서대로 적용합니다.
              <code className="text-cyan-600 text-xs"> $ARGUMENTS</code>를 먼저 치환하여{" "}
              <code className="text-cyan-600 text-xs">$ARGUMENTS[N]</code>과 충돌을 방지합니다.
            </p>

            <MermaidDiagram
              title="변수 치환 순서"
              titleColor="cyan"
              chart={`flowchart TD
  BODY["원본 본문"] --> V1["$ARGUMENTS 치환\\n(뒤에 [ 없는 경우만)"]
  V1 --> V2["$ARGUMENTS[N] 치환\\n배열 인덱스 접근"]
  V2 --> V3["$0, $1, $2... 치환\\n위치별 인자"]
  V3 --> V4["${"${DBCODE_SESSION_ID}"} 치환"]
  V4 --> V5["${"${DBCODE_SKILL_DIR}"} 치환"]
  V5 --> V6["${"${DBCODE_PROJECT_DIR}"} 치환"]
  V6 --> DONE["치환 완료된 본문"]

  style BODY fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style V1 fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style V2 fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style V3 fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style V4 fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style V5 fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style V6 fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style DONE fill:#f8fafc,stroke:#06b6d4,color:#06b6d4,stroke-width:2px`}
            />

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              동적 컨텍스트의 순차 실행
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">{"`!command`"}</code> 구문은 병렬이 아닌{" "}
              <strong className="text-gray-900">순차적으로</strong> 실행됩니다. 이전 명령의 결과가
              다음 명령에 영향을 줄 수 있기 때문입니다(순서 의존성).
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"// 패턴: /`!([^`]+)`/g"}</span>
              {"\n"}
              <span className="text-[#8b949e]">{"// 매칭된 모든 `!command`를 순차 실행"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">for</span> <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">match</span>{" "}
              <span className="text-[#ff7b72]">of</span>{" "}
              <span className="text-[#79c0ff]">matches</span>
              <span className="text-[#c9d1d9]">) {"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">output</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">executeShellCommand</span>
              <span className="text-[#c9d1d9]">(command, cwd);</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  result = result."}</span>
              <span className="text-[#d2a8ff]">replace</span>
              <span className="text-[#c9d1d9]">(match[</span>
              <span className="text-[#79c0ff]">0</span>
              <span className="text-[#c9d1d9]">], output);</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
            </CodeBlock>

            <Callout type="info" icon="📝">
              <code className="text-cyan-600 text-xs">executeShellCommand()</code>는
              <code className="text-cyan-600 text-xs"> child_process.exec</code>를 사용하며,
              타임아웃 <strong>10초</strong>(
              <code className="text-cyan-600 text-xs">COMMAND_TIMEOUT_MS</code>)가 설정되어
              있습니다. 실패 시 에러를 던지지 않고{" "}
              <code className="text-cyan-600 text-xs">[Command failed: ...]</code> 문자열을
              반환합니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 6. 트러블슈팅 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"🔧"}</span> 트러블슈팅
            </h2>

            <div className="flex flex-col gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 스킬 실행 시 "[Command failed: ...]"
                  메시지가 프롬프트에 포함돼요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인:</strong>{" "}
                    <code className="text-cyan-600 text-xs">{"`!command`"}</code> 구문의 셸 명령이
                    실패했습니다. 명령어가 올바른지, 해당 프로그램이 설치되어 있는지 확인하세요.
                  </p>
                  <p>
                    <strong className="text-gray-900">해결:</strong> 명령을 터미널에서 직접 실행하여
                    정상 동작하는지 확인하세요. 타임아웃(10초) 초과 시에도 실패합니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> $ARGUMENTS가 빈 문자열로 치환돼요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <code className="text-cyan-600 text-xs">/commit</code>처럼 인자 없이 명령을
                    호출하면
                    <code className="text-cyan-600 text-xs"> $ARGUMENTS</code>는 빈 문자열로
                    치환됩니다. 인자가 필수인 스킬은 프론트매터에{" "}
                    <code className="text-cyan-600 text-xs">argumentHint</code>를 설정하여 사용법을
                    안내하세요.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> SkillExecutionError: Skill has no body
                  content
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    프론트매터만 있고 본문이 없는 스킬 파일입니다. 두 번째{" "}
                    <code className="text-cyan-600 text-xs">---</code> 이후에 프롬프트 텍스트를
                    작성하세요.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 7. 관련 문서 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"🔗"}</span> 관련 문서
            </h2>

            <SeeAlso
              items={[
                {
                  name: "skills/loader.ts",
                  slug: "skill-loader",
                  relation: "sibling",
                  desc: "스킬 파일을 파싱하고 SkillDefinition을 생성하는 로더",
                },
                {
                  name: "skills/command-bridge.ts",
                  slug: "skill-command-bridge",
                  relation: "sibling",
                  desc: "executeSkill 결과를 슬래시 명령어 응답으로 변환하는 브릿지",
                },
                {
                  name: "skills/types.ts",
                  slug: "skill-manager",
                  relation: "sibling",
                  desc: "SkillDefinition, SkillContext, SkillExecutionResult 타입 정의",
                },
                {
                  name: "agent/loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "스킬 실행 결과를 LLM에 전달하거나 서브에이전트를 생성하는 에이전트 루프",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
