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

export default function SkillCommandBridgePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">

        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <FilePath path="src/skills/command-bridge.ts" />
            <LayerBadge layer="leaf" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
            <span className="text-gray-900">
              Skill Command Bridge
            </span>
          </h1>
          <p className="text-[16px] text-gray-600 max-w-[640px]">
            슬래시 명령(/command)과 스킬 시스템을 연결하는 브릿지 모듈입니다.
            사용자 호출 가능한 스킬을 <span className="text-cyan-600 font-semibold">SlashCommand</span>로 변환하고,
            <span className="text-violet-600 font-semibold"> inline/fork</span> 분기 처리를 수행합니다.
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
              사용자가 <code className="text-cyan-600 text-xs">/commit</code>이나 <code className="text-cyan-600 text-xs">/review-pr</code>처럼
              스킬 기반 명령어를 입력하면, 이 브릿지 모듈이 <strong className="text-gray-900">SkillManager</strong>를 통해
              해당 스킬을 찾아 실행하고, 결과를 <span className="text-cyan-600 font-semibold">CommandResult</span>로 변환합니다.
              <strong className="text-gray-900"> inline</strong> 스킬은 프롬프트를 사용자 메시지로 주입하고,
              <strong className="text-gray-900"> fork</strong> 스킬은 서브에이전트를 생성합니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>핵심 원칙:</strong> 스킬의 프론트매터에서 <code className="text-cyan-600 text-xs">userInvocable: true</code>인 것만
              슬래시 명령어로 등록됩니다. <code className="text-cyan-600 text-xs">[skill]</code> 접두사로 일반 명령어와 구분됩니다.
            </Callout>

            <MermaidDiagram
              title="슬래시 명령어 실행 흐름"
              titleColor="orange"
              chart={`flowchart TD
  USER["👤 사용자 입력\\n/commit 'fix auth'"]
  BRIDGE["🔗 Command Bridge\\nSkillManager.execute()"]
  RESULT{"실행 결과\\nfork 여부?"}
  INLINE["💬 inline 스킬\\npromplt → 사용자 메시지 주입\\nshouldInjectAsUserMessage"]
  FORK["🔀 fork 스킬\\nskill:fork 이벤트 발행\\n→ 서브에이전트 생성"]
  LLM["🤖 LLM 처리\\n프롬프트 기반 응답"]
  SUBAGENT["🧵 서브에이전트\\n별도 컨텍스트 실행"]

  USER --> BRIDGE --> RESULT
  RESULT -->|"context: inline"| INLINE --> LLM
  RESULT -->|"context: fork"| FORK --> SUBAGENT

  style USER fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style BRIDGE fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style RESULT fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style INLINE fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style FORK fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style LLM fill:#f8fafc,stroke:#06b6d4,color:#06b6d4,stroke-width:2px
  style SUBAGENT fill:#f8fafc,stroke:#06b6d4,color:#06b6d4,stroke-width:2px`}
            />

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
              <h4 className="text-[14px] font-bold mb-3">inline vs fork 스킬 비교</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">속성</th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">inline</th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">fork</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 text-gray-600">실행 방식</td>
                      <td className="p-2.5 text-emerald-600">현재 대화에 프롬프트 주입</td>
                      <td className="p-2.5 text-violet-600">서브에이전트로 분리 실행</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 text-gray-600">컨텍스트</td>
                      <td className="p-2.5 text-emerald-600">기존 대화 컨텍스트 공유</td>
                      <td className="p-2.5 text-violet-600">별도 컨텍스트 생성</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 text-gray-600">CommandResult 핵심 필드</td>
                      <td className="p-2.5 text-emerald-600">shouldInjectAsUserMessage</td>
                      <td className="p-2.5 text-violet-600">skill:fork 이벤트</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-gray-600">모델 오버라이드</td>
                      <td className="p-2.5 text-emerald-600">modelOverride 필드</td>
                      <td className="p-2.5 text-violet-600">이벤트 payload.model</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 3. 레퍼런스 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"📋"}</span> 레퍼런스
            </h2>

            {/* createSkillCommands */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">createSkillCommands()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                SkillManager에서 사용자 호출 가능한(userInvocable) 스킬을 가져와
                각각을 <code className="text-cyan-600 text-xs">SlashCommand</code> 인터페이스에 맞게 래핑합니다.
                반환된 명령어 배열은 <code className="text-cyan-600 text-xs">CommandRegistry</code>에 등록됩니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "skillManager",
                    type: "SkillManager",
                    required: true,
                    desc: "로드된 스킬들을 관리하는 매니저 인스턴스",
                  },
                ]}
              />

              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">반환 타입: <code className="text-violet-600 text-xs">{"readonly SlashCommand[]"}</code></h4>
                <ParamTable
                  params={[
                    {
                      name: "name",
                      type: "string",
                      required: true,
                      desc: "명령어 이름 (프론트매터의 name 필드와 동일)",
                    },
                    {
                      name: "description",
                      type: "string",
                      required: true,
                      desc: "[skill] 접두사 + 프론트매터의 description",
                    },
                    {
                      name: "usage",
                      type: "string",
                      required: true,
                      desc: "/name + argumentHint (예: /commit [message])",
                    },
                    {
                      name: "execute",
                      type: "(args, ctx) => Promise<CommandResult>",
                      required: true,
                      desc: "스킬 실행 핸들러 — inline/fork 분기 처리 포함",
                    },
                  ]}
                />
              </div>

              <Callout type="warn" icon="⚠️">
                <code className="text-cyan-600 text-xs">userInvocable: false</code>인 스킬은 슬래시 명령어로 등록되지 않습니다.
                LLM 전용 스킬(시스템 내부용)은 이 플래그를 false로 설정하세요.
              </Callout>
            </div>

            {/* execute 핸들러 (내부 로직) */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">execute()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-50 text-gray-400">internal handler</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">async</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                각 SlashCommand의 실행 핸들러입니다. SkillManager를 통해 스킬을 실행하고,
                결과에 따라 <strong className="text-gray-900">inline</strong>(프롬프트 주입) 또는 <strong className="text-gray-900">fork</strong>(서브에이전트 생성)를 처리합니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "args",
                    type: "string",
                    required: true,
                    desc: "명령어 뒤에 전달된 인자 문자열",
                  },
                  {
                    name: "commandContext",
                    type: "CommandContext",
                    required: true,
                    desc: "세션 ID, 작업 디렉토리, 이벤트 emitter 등",
                  },
                ]}
              />
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 4. 사용법 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"🚀"}</span> 사용법
            </h2>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>CommandRegistry에 스킬 명령어 등록</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              앱 초기화 시 <code className="text-cyan-600 text-xs">createSkillCommands()</code>를 호출하여
              스킬 기반 슬래시 명령어를 레지스트리에 일괄 등록합니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">createSkillCommands</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./skills/command-bridge.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// SkillManager가 스킬을 로딩한 후"}</span>{"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">skillCommands</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#d2a8ff]">createSkillCommands</span>
              <span className="text-[#c9d1d9]">(skillManager);</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// CommandRegistry에 등록"}</span>{"\n"}
              <span className="text-[#ff7b72]">for</span>{" "}
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">cmd</span>{" "}
              <span className="text-[#ff7b72]">of</span>{" "}
              <span className="text-[#79c0ff]">skillCommands</span>
              <span className="text-[#c9d1d9]">) {"{"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  registry."}</span>
              <span className="text-[#d2a8ff]">register</span>
              <span className="text-[#c9d1d9]">(cmd);</span>{"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
            </CodeBlock>

            <DeepDive title="fork 스킬의 이벤트 기반 실행">
              <p className="mb-3">
                fork 스킬은 <code className="text-cyan-600 text-xs">skill:fork</code> 이벤트를 발행하여
                에이전트 루프가 서브에이전트를 생성하도록 합니다. 이벤트 페이로드에는 프롬프트, 모델, 에이전트 유형, 허용 도구가 포함됩니다.
              </p>

              <CodeBlock>
                <span className="text-[#8b949e]">{"// fork 스킬 실행 시 내부 동작"}</span>{"\n"}
                <span className="text-[#c9d1d9]">commandContext.</span>
                <span className="text-[#d2a8ff]">emit</span>
                <span className="text-[#c9d1d9]">(</span>
                <span className="text-[#a5d6ff]">{'"skill:fork"'}</span>
                <span className="text-[#c9d1d9]">, {"{"}</span>{"\n"}
                <span className="text-[#c9d1d9]">{"  "}</span>
                <span className="text-[#79c0ff]">prompt</span>
                <span className="text-[#c9d1d9]">{": result.prompt,"}</span>{"\n"}
                <span className="text-[#c9d1d9]">{"  "}</span>
                <span className="text-[#79c0ff]">model</span>
                <span className="text-[#c9d1d9]">{": result.model,"}</span>{"\n"}
                <span className="text-[#c9d1d9]">{"  "}</span>
                <span className="text-[#79c0ff]">agentType</span>
                <span className="text-[#c9d1d9]">{": result.agentType,"}</span>{"\n"}
                <span className="text-[#c9d1d9]">{"  "}</span>
                <span className="text-[#79c0ff]">allowedTools</span>
                <span className="text-[#c9d1d9]">{": result.allowedTools,"}</span>{"\n"}
                <span className="text-[#c9d1d9]">{"});"}</span>
              </CodeBlock>

              <Callout type="warn" icon="⚠️">
                fork 스킬의 출력 메시지는 <code className="text-cyan-600 text-xs">{"Skill 'name' launched as general subagent."}</code> 형태입니다.
                실제 실행은 에이전트 루프의 이벤트 핸들러가 담당하며, 별도 컨텍스트에서 진행됩니다.
              </Callout>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 5. 내부 구현 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"🔍"}</span> 내부 구현
            </h2>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>CommandResult 생성 로직</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              execute 핸들러는 SkillManager의 실행 결과에 따라 세 가지 경로로 분기합니다.
            </p>

            <MermaidDiagram
              title="CommandResult 분기 로직"
              titleColor="cyan"
              chart={`flowchart TD
  EXEC["skillManager.execute(name, args)"] --> CHECK{"result\\n존재?"}
  CHECK -->|null| FAIL["{ output: 'failed',\\nsuccess: false }"]
  CHECK -->|Yes| FORK{"result.fork\\n= true?"}
  FORK -->|Yes| EMIT["emit('skill:fork', payload)\\n{ output: 'launched...', success: true }"]
  FORK -->|No| INJECT["{ output: result.prompt,\\nsuccess: true,\\nshouldInjectAsUserMessage: true,\\nmodelOverride: result.model }"]

  style EXEC fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style CHECK fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style FORK fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style FAIL fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style EMIT fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style INJECT fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px`}
            />

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>shouldInjectAsUserMessage 동작</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              inline 스킬에서 <code className="text-cyan-600 text-xs">shouldInjectAsUserMessage: true</code>로 반환하면,
              에이전트 루프의 <code className="text-cyan-600 text-xs">handleSubmit</code>이 이 출력을 화면에 표시하지 않고
              LLM에 사용자 메시지로 직접 전달합니다. 이를 통해 스킬이 생성한 프롬프트가 자연스럽게 대화에 주입됩니다.
            </p>

            <Callout type="info" icon="📝">
              <code className="text-cyan-600 text-xs">[skill]</code> 접두사는 <code className="text-cyan-600 text-xs">/help</code> 명령어에서
              스킬 기반 명령어와 내장 명령어를 구분하기 위해 추가됩니다.
              예: <code className="text-cyan-600 text-xs">[skill] Git 커밋 메시지 생성</code>
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
                  <span className="text-red-600">Q.</span> 스킬이 /help에 나타나지만 실행하면 "failed to execute" 에러가 나요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 1:</strong> 스킬 본문(body)이 비어있습니다.
                    프론트매터 이후에 프롬프트 텍스트가 있는지 확인하세요.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인 2:</strong> SkillManager.execute()가 내부적으로 실패했습니다.
                    동적 컨텍스트(<code className="text-cyan-600 text-xs">{"`!command`"}</code>)에서 치명적 에러가 발생했을 수 있습니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> fork 스킬을 실행했는데 아무 일도 안 일어나요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <code className="text-cyan-600 text-xs">skill:fork</code> 이벤트를 수신하는 리스너가 등록되어 있는지 확인하세요.
                    에이전트 루프가 이 이벤트를 핸들링하여 서브에이전트를 생성합니다.
                    리스너가 없으면 이벤트는 발행되지만 아무 동작도 일어나지 않습니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 스킬 명령어가 /help 목록에 보이지 않아요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    프론트매터에 <code className="text-cyan-600 text-xs">userInvocable: false</code>가 설정되어 있지 않은지 확인하세요.
                    기본값은 <code className="text-cyan-600 text-xs">true</code>이지만, 명시적으로 false로 설정하면
                    <code className="text-cyan-600 text-xs"> createSkillCommands()</code>에서 제외됩니다.
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
                  name: "skills/loader.ts",
                  slug: "skill-loader",
                  relation: "sibling",
                  desc: "스킬 .md 파일을 파싱하고 SkillDefinition을 생성하는 로더",
                },
                {
                  name: "skills/executor.ts",
                  slug: "skill-executor",
                  relation: "sibling",
                  desc: "변수 치환 + 동적 컨텍스트 주입으로 최종 프롬프트를 생성하는 실행 엔진",
                },
                {
                  name: "skills/manager.ts",
                  slug: "skill-manager",
                  relation: "parent",
                  desc: "스킬 로딩/검색/실행을 총괄하는 매니저 — command-bridge가 의존",
                },
                {
                  name: "commands/registry.ts",
                  slug: "tool-registry",
                  relation: "parent",
                  desc: "SlashCommand를 등록/조회하는 커맨드 레지스트리",
                },
              ]}
            />
          </section>
        </RevealOnScroll>

      </div>
    </div>
  );
}
