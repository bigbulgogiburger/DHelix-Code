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

export default function SkillManagerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilePath path="src/skills/manager.ts" />
              <LayerBadge layer="leaf" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
              <span className="text-gray-900">Skill Manager</span>
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[640px]">
              4개 디렉토리에서 스킬을 로딩하고, 우선순위에 따라 병합하여 관리하는 중앙 허브입니다.
              시스템 프롬프트에 스킬 목록을 삽입하고,{" "}
              <span className="text-cyan-600 font-semibold">이름 기반 실행</span>을 위임합니다.
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
              <span>{"📋"}</span> 개요
            </h2>
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
              dhelix의 스킬 시스템은 마크다운 파일(
              <code className="text-cyan-600 text-xs">.md</code>)로 작성된 재사용 가능한 프롬프트
              템플릿입니다.
              <code className="text-cyan-600 text-xs"> SkillManager</code>는 이 스킬들을
              <strong className="text-gray-900"> 4개 디렉토리</strong>에서 수집하고,
              <span className="text-violet-600 font-semibold"> 우선순위 기반 Map</span>으로
              관리합니다. 같은 이름의 스킬이 여러 디렉토리에 있으면 프로젝트 레벨이 전역 레벨을
              덮어쓰므로, 전역 스킬을 프로젝트별로 커스터마이징할 수 있습니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>핵심 원칙:</strong> 낮은 우선순위부터 순서대로 Map에{" "}
              <code className="text-cyan-600 text-xs">set()</code>하여, 같은 이름이면 나중에 로드된
              것(높은 우선순위)이 자동으로 덮어씁니다.
            </Callout>

            <MermaidDiagram
              title="4-Directory 스킬 로딩 우선순위"
              titleColor="orange"
              chart={`flowchart TB
  D1["📁 Dir 1\\n~/.dhelix/skills/\\n(전역 스킬 — 가장 낮은 우선순위)"]
  D2["📁 Dir 2\\n~/.dhelix/commands/\\n(전역 커맨드)"]
  D3["📂 Dir 3\\n{cwd}/.dhelix/skills/\\n(프로젝트 스킬)"]
  D4["📂 Dir 4\\n{cwd}/.dhelix/commands/\\n(프로젝트 커맨드 — 가장 높은 우선순위)"]

  D1 -->|"Map.set(name)"| MAP["🗺️ skills Map\\n(같은 이름 → 덮어쓰기)<br/><small>우선순위 기반 스킬 저장소</small>"]
  D2 -->|"Map.set(name)"| MAP
  D3 -->|"Map.set(name)"| MAP
  D4 -->|"Map.set(name)"| MAP

  MAP --> OUT1["getAll()\\ngetUserInvocable()\\ngetModelVisible()<br/><small>스킬 조회 API</small>"]
  MAP --> OUT2["execute(name)\\nbuildPromptSection()<br/><small>스킬 실행 및 프롬프트 생성</small>"]

  style D1 fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style D2 fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style D3 fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style D4 fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style MAP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style OUT1 fill:#f8fafc,stroke:#06b6d4,color:#06b6d4,stroke-width:2px
  style OUT2 fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px`}
            />

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
              <h4 className="text-[14px] font-bold mb-3">각 디렉토리의 역할</h4>
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-44">~/.dhelix/skills/</span>
                  <span>
                    사용자 전역 스킬 &mdash; 모든 프로젝트에서 공통 사용하는 스킬 (가장 낮은
                    우선순위)
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-44">
                    ~/.dhelix/commands/
                  </span>
                  <span>
                    사용자 전역 커맨드 &mdash; skills/와 기능적 차이 없이, 조직화 목적으로 분리
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-violet-600 font-bold shrink-0 w-44">
                    {"{cwd}"}/.dhelix/skills/
                  </span>
                  <span>프로젝트 로컬 스킬 &mdash; 해당 프로젝트에서만 사용하는 스킬</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-violet-600 font-bold shrink-0 w-44">
                    {"{cwd}"}/.dhelix/commands/
                  </span>
                  <span>
                    프로젝트 로컬 커맨드 &mdash;{" "}
                    <strong className="text-gray-900">가장 높은 우선순위</strong>로 전역 스킬
                    덮어쓰기 가능
                  </span>
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
              <span>{"📖"}</span> 레퍼런스
            </h2>

            {/* SkillManager class */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-indigo-600 font-mono mb-2">
                SkillManager
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 ml-2">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 ml-1">
                  class
                </span>
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
                스킬의 로드, 조회, 실행을 관리하는 클래스입니다. 내부적으로{" "}
                <code className="text-cyan-600 text-xs">Map&lt;string, SkillDefinition&gt;</code>에
                스킬을 저장하며, 같은 이름의 스킬이 여러 번 로드되면 마지막에 로드된 것(높은
                우선순위)이 이전 것을 덮어씁니다.
              </p>
            </div>

            {/* loadAll */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-indigo-600 font-mono mb-2">
                loadAll(workingDirectory)
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 ml-2">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600 ml-1">
                  async
                </span>
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
                4개 디렉토리에서 모든 스킬을 순서대로 로드합니다. 낮은 우선순위부터 로드하여, 높은
                우선순위 스킬이 Map에서 같은 키를 자연스럽게 덮어씁니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "workingDirectory",
                    type: "string",
                    required: true,
                    desc: "프로젝트 루트 디렉토리 경로. 프로젝트 레벨 스킬 검색 기준 ({cwd}/.dhelix/skills/, {cwd}/.dhelix/commands/)",
                  },
                ]}
              />

              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환 타입: <code className="text-violet-600 text-xs">Promise&lt;void&gt;</code>
                </h4>
                <p className="text-[13px] text-gray-600">
                  로드된 스킬은 내부 <code className="text-cyan-600 text-xs">skills</code> Map에
                  저장됩니다. 반환값 없이 인스턴스 상태를 변경합니다.
                </p>
              </div>
            </div>

            {/* getAll */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-indigo-600 font-mono mb-2">
                getAll()
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 ml-2">
                  exported
                </span>
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
                모든 로드된 스킬을 읽기 전용 배열로 반환합니다.
              </p>
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환 타입:{" "}
                  <code className="text-violet-600 text-xs">readonly SkillDefinition[]</code>
                </h4>
              </div>
            </div>

            {/* get / has */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-indigo-600 font-mono mb-2">
                get(name) / has(name)
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 ml-2">
                  exported
                </span>
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
                이름으로 스킬을 검색하거나 존재 여부를 확인합니다.
                <code className="text-cyan-600 text-xs"> get()</code>은{" "}
                <code className="text-cyan-600 text-xs">SkillDefinition | undefined</code>를
                반환하고,
                <code className="text-cyan-600 text-xs"> has()</code>는{" "}
                <code className="text-cyan-600 text-xs">boolean</code>을 반환합니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "name",
                    type: "string",
                    required: true,
                    desc: '스킬 이름 (프론트매터의 name 필드, 예: "commit", "review-pr")',
                  },
                ]}
              />
            </div>

            {/* getUserInvocable / getModelVisible */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-indigo-600 font-mono mb-2">
                getUserInvocable() / getModelVisible()
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 ml-2">
                  exported
                </span>
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
                특정 조건으로 스킬을 필터링합니다.
              </p>

              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                          메서드
                        </th>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                          필터 조건
                        </th>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                          사용처
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-600">
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 font-mono text-cyan-600">getUserInvocable()</td>
                        <td className="p-2.5">
                          <code className="text-xs">userInvocable === true</code>
                        </td>
                        <td className="p-2.5">/help 목록에 표시할 스킬</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-mono text-cyan-600">getModelVisible()</td>
                        <td className="p-2.5">
                          <code className="text-xs">disableModelInvocation === false</code>
                        </td>
                        <td className="p-2.5">LLM 시스템 프롬프트에 포함할 스킬</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* execute */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-indigo-600 font-mono mb-2">
                execute(name, args, options)
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 ml-2">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600 ml-1">
                  async
                </span>
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
                이름으로 스킬을 찾아 실행합니다. 스킬이 존재하지 않으면 에러를 던지지 않고
                <code className="text-cyan-600 text-xs"> null</code>을 반환합니다. 내부적으로{" "}
                <code className="text-cyan-600 text-xs">SkillContext</code>를 구성하여
                <code className="text-cyan-600 text-xs"> executeSkill()</code>에 위임합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "name",
                    type: "string",
                    required: true,
                    desc: "실행할 스킬 이름",
                  },
                  {
                    name: "args",
                    type: "string",
                    required: true,
                    desc: '스킬에 전달할 인자 문자열 (예: "fix auth bug" → $ARGUMENTS로 치환됨)',
                  },
                  {
                    name: "options.workingDirectory",
                    type: "string",
                    required: true,
                    desc: "현재 작업 디렉토리 (셸 명령 실행 시 cwd로 사용)",
                  },
                  {
                    name: "options.sessionId",
                    type: "string",
                    required: false,
                    desc: "현재 세션 ID (세션 추적용)",
                  },
                  {
                    name: "options.projectDir",
                    type: "string",
                    required: false,
                    desc: "프로젝트 루트 디렉토리. 미지정 시 workingDirectory 사용",
                  },
                ]}
              />

              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환 타입:{" "}
                  <code className="text-violet-600 text-xs">
                    Promise&lt;SkillExecutionResult | null&gt;
                  </code>
                </h4>
                <ParamTable
                  params={[
                    {
                      name: "prompt",
                      type: "string",
                      required: true,
                      desc: "변수 치환이 완료된 최종 프롬프트 텍스트",
                    },
                    {
                      name: "fork",
                      type: "boolean",
                      required: true,
                      desc: "true이면 서브에이전트(fork)로 실행",
                    },
                    {
                      name: "model",
                      type: "string",
                      required: false,
                      desc: "스킬이 지정한 모델 오버라이드",
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
                      desc: "이 스킬 실행 중 사용 가능한 도구 제한 목록",
                    },
                  ]}
                />
              </div>

              <Callout type="warn" icon="⚠️">
                스킬이 존재하지 않으면 <code className="text-red-600 text-xs">null</code>을
                반환합니다. 에러를 던지지 않으므로 호출부에서 반드시{" "}
                <code className="text-cyan-600 text-xs">null</code> 체크를 해야 합니다.
              </Callout>
            </div>

            {/* buildPromptSection */}
            <div className="mb-4">
              <h3 className="text-lg font-bold text-indigo-600 font-mono mb-2">
                buildPromptSection()
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 ml-2">
                  exported
                </span>
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
                LLM 시스템 프롬프트에 삽입할{" "}
                <code className="text-cyan-600 text-xs"># Available Skills</code> 마크다운 섹션을
                생성합니다.
                <code className="text-cyan-600 text-xs"> getModelVisible()</code>로 필터링된 스킬만
                포함합니다. 스킬이 없으면 <code className="text-cyan-600 text-xs">null</code>을
                반환합니다.
              </p>

              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환 타입: <code className="text-violet-600 text-xs">string | null</code>
                </h4>
                <p className="text-[13px] text-gray-600">
                  LLM이 볼 수 있는 스킬이 1개 이상이면 마크다운 문자열, 0개이면{" "}
                  <code className="text-cyan-600 text-xs">null</code>.
                </p>
              </div>
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
              기본 사용 (애플리케이션 부팅 시)
            </h3>
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
              앱이 시작될 때 <code className="text-cyan-600 text-xs">SkillManager</code> 인스턴스를
              생성하고
              <code className="text-cyan-600 text-xs"> loadAll()</code>을 호출합니다. 이후{" "}
              <code className="text-cyan-600 text-xs">execute()</code>로 스킬을 실행하거나,
              <code className="text-cyan-600 text-xs"> buildPromptSection()</code>으로 시스템
              프롬프트에 스킬 목록을 삽입합니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">SkillManager</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./skills/manager.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">skillManager</span>{" "}
              <span className="text-[#c9d1d9]">=</span> <span className="text-[#ff7b72]">new</span>{" "}
              <span className="text-[#d2a8ff]">SkillManager</span>
              <span className="text-[#c9d1d9]">();</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 4개 디렉토리에서 모든 스킬 로드"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#c9d1d9]">skillManager.</span>
              <span className="text-[#d2a8ff]">loadAll</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"./my-project"'}</span>
              <span className="text-[#c9d1d9]">);</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 로드된 스킬 개수 확인"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">console.</span>
              <span className="text-[#d2a8ff]">log</span>
              <span className="text-[#c9d1d9]">(skillManager.</span>
              <span className="text-[#d2a8ff]">getAll</span>
              <span className="text-[#c9d1d9]">().length);</span>
              <span className="text-[#8b949e]">{" // → 42"}</span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              스킬 실행하기
            </h3>
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
              사용자가 <code className="text-cyan-600 text-xs">/commit fix auth bug</code>을
              입력하면,
              <code className="text-cyan-600 text-xs">
                {" "}
                execute(&quot;commit&quot;, &quot;fix auth bug&quot;, options)
              </code>
              를 호출합니다. 인자 문자열은 공백으로 분리되어{" "}
              <code className="text-cyan-600 text-xs">$0</code>,{" "}
              <code className="text-cyan-600 text-xs">$1</code>,{" "}
              <code className="text-cyan-600 text-xs">$2</code>
              변수에 매핑됩니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"// /commit fix auth bug 실행"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">result</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#c9d1d9]">skillManager.</span>
              <span className="text-[#d2a8ff]">execute</span>
              <span className="text-[#c9d1d9]">(</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#a5d6ff]">{'"commit"'}</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#a5d6ff]">{'"fix auth bug"'}</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  { "}</span>
              <span className="text-[#79c0ff]">workingDirectory</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"./my-project"'}</span>
              <span className="text-[#c9d1d9]">{" }"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">);</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">if</span>{" "}
              <span className="text-[#c9d1d9]">(result) {"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  console."}</span>
              <span className="text-[#d2a8ff]">log</span>
              <span className="text-[#c9d1d9]">(result.prompt);</span>
              <span className="text-[#8b949e]">{" // 변수 치환된 프롬프트"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  console."}</span>
              <span className="text-[#d2a8ff]">log</span>
              <span className="text-[#c9d1d9]">(result.fork);</span>
              <span className="text-[#8b949e]">{"   // false (inline 스킬)"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>{" "}
              <span className="text-[#ff7b72]">else</span>{" "}
              <span className="text-[#c9d1d9]">{"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#8b949e]">{"// 스킬이 존재하지 않음 — null 반환"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              시스템 프롬프트에 스킬 목록 삽입
            </h3>
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
              <code className="text-cyan-600 text-xs">buildPromptSection()</code>은 LLM이 사용
              가능한 스킬 목록을 마크다운 형식으로 생성합니다. 시스템 프롬프트 빌더에서 이 출력을
              삽입하여 LLM이 사용자의 /명령어를 이해할 수 있게 합니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">section</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#c9d1d9]">skillManager.</span>
              <span className="text-[#d2a8ff]">buildPromptSection</span>
              <span className="text-[#c9d1d9]">();</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 출력 예시:"}</span>
              {"\n"}
              <span className="text-[#8b949e]">{"// # Available Skills"}</span>
              {"\n"}
              <span className="text-[#8b949e]">{"// "}</span>
              {"\n"}
              <span className="text-[#8b949e]">
                {"// The user has configured the following skills..."}
              </span>
              {"\n"}
              <span className="text-[#8b949e]">{"// "}</span>
              {"\n"}
              <span className="text-[#8b949e]">{"// - **/commit [message]**: Git 커밋 생성"}</span>
              {"\n"}
              <span className="text-[#8b949e]">{"// - **/review-pr [number]**: PR 코드 리뷰"}</span>
              {"\n"}
              <span className="text-[#8b949e]">
                {"// - **(internal) security-check**: 보안 분석"}
              </span>
            </CodeBlock>

            <DeepDive title="스킬 파일 작성법 — 프론트매터와 변수 치환">
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
                스킬은 마크다운 파일로 작성합니다. 상단의 YAML 프론트매터에 메타데이터를 정의하고,
                본문에 LLM에 전달할 프롬프트 템플릿을 작성합니다.
              </p>

              <CodeBlock>
                <span className="text-[#8b949e]">{"# ~/.dhelix/skills/commit.md"}</span>
                {"\n"}
                <span className="text-[#c9d1d9]">---</span>
                {"\n"}
                <span className="text-[#79c0ff]">name</span>
                <span className="text-[#c9d1d9]">: commit</span>
                {"\n"}
                <span className="text-[#79c0ff]">description</span>
                <span className="text-[#c9d1d9]">: Git 커밋 메시지 생성</span>
                {"\n"}
                <span className="text-[#79c0ff]">argumentHint</span>
                <span className="text-[#c9d1d9]">: [message]</span>
                {"\n"}
                <span className="text-[#79c0ff]">userInvocable</span>
                <span className="text-[#c9d1d9]">: true</span>
                {"\n"}
                <span className="text-[#79c0ff]">context</span>
                <span className="text-[#c9d1d9]">: inline</span>
                {"\n"}
                <span className="text-[#c9d1d9]">---</span>
                {"\n\n"}
                <span className="text-[#c9d1d9]">
                  변경사항을 분석하고 커밋 메시지를 작성하세요.
                </span>
                {"\n"}
                <span className="text-[#c9d1d9]">사용자 메시지: $ARGUMENTS</span>
                {"\n"}
                <span className="text-[#c9d1d9]">첫 번째 인자: $0</span>
              </CodeBlock>

              <div className="bg-white border border-gray-200 rounded-xl p-4 mt-3">
                <h4 className="text-[13px] font-bold mb-3">사용 가능한 변수</h4>
                <div className="flex flex-col gap-2 text-[12px] text-gray-600 font-mono">
                  <div className="flex gap-3">
                    <span className="text-violet-600 font-bold shrink-0 w-28">$ARGUMENTS</span>
                    <span className="font-sans">
                      전체 인자 문자열 (예: &quot;fix auth bug&quot;)
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-violet-600 font-bold shrink-0 w-28">$0, $1, $2...</span>
                    <span className="font-sans">위치별 인자 (공백 분리)</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-violet-600 font-bold shrink-0 w-28">$SESSION_ID</span>
                    <span className="font-sans">현재 세션 ID</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-violet-600 font-bold shrink-0 w-28">$SKILL_DIR</span>
                    <span className="font-sans">스킬 파일이 위치한 디렉토리 경로</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-violet-600 font-bold shrink-0 w-28">$PROJECT_DIR</span>
                    <span className="font-sans">프로젝트 루트 디렉토리 경로</span>
                  </div>
                </div>
              </div>
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
              <span>{"⚙️"}</span> 내부 구현
            </h2>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              loadAll 로딩 순서
            </h3>
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
              <code className="text-cyan-600 text-xs">loadAll()</code>은 4개 디렉토리를{" "}
              <strong className="text-gray-900">낮은 우선순위부터</strong> 순서대로 로드합니다.
              <code className="text-cyan-600 text-xs"> Map.set()</code>의 특성을 활용하여, 같은 키를
              나중에 다시 <code className="text-cyan-600 text-xs">set()</code>하면 이전 값이
              자연스럽게 대체됩니다. 이로 인해 별도의 우선순위 비교 로직 없이도 올바른 덮어쓰기가
              보장됩니다.
            </p>

            <MermaidDiagram
              title="loadAll() 실행 흐름"
              titleColor="cyan"
              chart={`flowchart TD
  START["loadAll(workingDirectory)<br/><small>전체 스킬 로딩 시작</small>"] --> DIR1["1. loadSkillsFromDirectory\\n(~/.dhelix/skills/)<br/><small>전역 스킬 디렉토리 읽기</small>"]
  DIR1 --> SET1["skills.set(name, skill)\\n— 전역 스킬 등록<br/><small>Map에 스킬 저장</small>"]
  SET1 --> DIR2["2. loadSkillsFromDirectory\\n(~/.dhelix/commands/)<br/><small>전역 커맨드 디렉토리 읽기</small>"]
  DIR2 --> SET2["skills.set(name, skill)\\n— 전역 커맨드 등록\\n(같은 이름 → 덮어쓰기)<br/><small>중복 시 최신으로 교체</small>"]
  SET2 --> DIR3["3. loadSkillsFromDirectory\\n({cwd}/.dhelix/skills/)<br/><small>프로젝트 스킬 디렉토리 읽기</small>"]
  DIR3 --> SET3["skills.set(name, skill)\\n— 프로젝트 스킬 등록<br/><small>전역 스킬보다 우선</small>"]
  SET3 --> DIR4["4. loadSkillsFromDirectory\\n({cwd}/.dhelix/commands/)<br/><small>프로젝트 커맨드 디렉토리 읽기</small>"]
  DIR4 --> SET4["skills.set(name, skill)\\n— 프로젝트 커맨드 등록\\n(최종 우선순위)<br/><small>가장 높은 우선순위 적용</small>"]
  SET4 --> DONE["✅ Map 완성\\n— 각 이름에 최고 우선순위 스킬만 남음<br/><small>최종 스킬 맵 반환</small>"]

  style START fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style DIR1 fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style DIR2 fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style DIR3 fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style DIR4 fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style DONE fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px
  style SET1 fill:#f1f5f9,stroke:#475569,color:#94a3b8
  style SET2 fill:#f1f5f9,stroke:#475569,color:#94a3b8
  style SET3 fill:#f1f5f9,stroke:#475569,color:#94a3b8
  style SET4 fill:#f1f5f9,stroke:#475569,color:#94a3b8`}
            />

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              execute() 내부 동작
            </h3>
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
              <code className="text-cyan-600 text-xs">execute()</code>는 3단계로 동작합니다: 스킬
              조회, 컨텍스트 구성, 실행 위임. 인자 문자열은 공백으로 분리되어 위치별 인자 배열로
              변환되고,
              <code className="text-cyan-600 text-xs"> SkillContext</code>에 담겨{" "}
              <code className="text-cyan-600 text-xs">executeSkill()</code>에 전달됩니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"// 1. Map에서 스킬 조회"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">skill</span>{" "}
              <span className="text-[#c9d1d9]">=</span> <span className="text-[#ff7b72]">this</span>
              <span className="text-[#c9d1d9]">.skills.</span>
              <span className="text-[#d2a8ff]">get</span>
              <span className="text-[#c9d1d9]">(name);</span>
              {"\n"}
              <span className="text-[#ff7b72]">if</span>{" "}
              <span className="text-[#c9d1d9]">(!skill)</span>{" "}
              <span className="text-[#ff7b72]">return</span>{" "}
              <span className="text-[#79c0ff]">null</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 2. 인자 분리 + 컨텍스트 구성"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">positionalArgs</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#c9d1d9]">args.</span>
              <span className="text-[#d2a8ff]">trim</span>
              <span className="text-[#c9d1d9]">() ? args.</span>
              <span className="text-[#d2a8ff]">trim</span>
              <span className="text-[#c9d1d9]">().</span>
              <span className="text-[#d2a8ff]">split</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{"/\\s+/"}</span>
              <span className="text-[#c9d1d9]">) : [];</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">context</span>
              <span className="text-[#c9d1d9]">: SkillContext = {"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">arguments</span>
              <span className="text-[#c9d1d9]">: args,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">
                {"  positionalArgs,  sessionId,  skillDir,  projectDir,  workingDirectory"}
              </span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"};"}</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 3. executor에 위임"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">return</span>{" "}
              <span className="text-[#d2a8ff]">executeSkill</span>
              <span className="text-[#c9d1d9]">(skill, context);</span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              buildPromptSection() 출력 형식
            </h3>
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
              <code className="text-cyan-600 text-xs">userInvocable</code>가 true인 스킬은{" "}
              <code className="text-cyan-600 text-xs">/name</code> 형식으로, false인 스킬은{" "}
              <code className="text-cyan-600 text-xs">(internal) name</code> 형식으로 표시됩니다.
              <code className="text-cyan-600 text-xs"> argumentHint</code>가 있으면 이름 뒤에
              추가됩니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">
                {'// userInvocable=true, argumentHint="[message]"'}
              </span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"- "}</span>
              <span className="text-[#79c0ff]">{"**/commit [message]**"}</span>
              <span className="text-[#c9d1d9]">{": Git 커밋 생성"}</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// userInvocable=false (LLM만 호출 가능)"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"- "}</span>
              <span className="text-[#79c0ff]">{"**(internal) security-check**"}</span>
              <span className="text-[#c9d1d9]">{": 보안 분석 실행"}</span>
            </CodeBlock>

            <Callout type="info" icon="📝">
              <strong>skills/와 commands/의 차이:</strong> 기능적 차이는 없습니다.
              <code className="text-cyan-600 text-xs"> SKILL_DIRS</code> 상수에서 정의된 4개 경로
              모두 동일한
              <code className="text-cyan-600 text-xs"> loadSkillsFromDirectory()</code>로
              로드됩니다. 분리는 순수하게 조직화 목적입니다.
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
              {/* FAQ 1 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> /help에 내 스킬이 표시되지 않아요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 1:</strong> 프론트매터에{" "}
                    <code className="text-cyan-600 text-xs">userInvocable: false</code>가 설정되어
                    있습니다.
                    <code className="text-cyan-600 text-xs"> getUserInvocable()</code>이 이 스킬을
                    필터링합니다.
                    <code className="text-cyan-600 text-xs"> userInvocable: true</code>로 변경하세요
                    (기본값은 true이므로, 해당 필드를 제거해도 됩니다).
                  </p>
                  <p>
                    <strong className="text-gray-900">원인 2:</strong> 스킬 파일이 올바른 디렉토리에
                    있지 않습니다.
                    <code className="text-cyan-600 text-xs"> ~/.dhelix/skills/</code> 또는{" "}
                    <code className="text-cyan-600 text-xs">.dhelix/skills/</code>에 위치해야
                    합니다.
                  </p>
                </div>
              </div>

              {/* FAQ 2 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 전역 스킬을 프로젝트에서 커스터마이징하고
                  싶어요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    프로젝트 디렉토리의{" "}
                    <code className="text-cyan-600 text-xs">.dhelix/skills/</code> 또는{" "}
                    <code className="text-cyan-600 text-xs">.dhelix/commands/</code>에{" "}
                    <strong className="text-gray-900">같은 이름</strong>의 스킬 파일을 만드세요.
                    프로젝트 레벨이 전역 레벨보다 우선순위가 높으므로, 전역 스킬이 자동으로
                    덮어씌워집니다. 이렇게 하면 다른 프로젝트에서는 전역 스킬이 그대로 유지됩니다.
                  </p>
                </div>
              </div>

              {/* FAQ 3 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> /명령어를 입력했는데 아무 반응이 없어요
                  (null 반환)
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">확인 1:</strong> 스킬 파일의 프론트매터에서{" "}
                    <code className="text-cyan-600 text-xs">name</code> 필드가 입력한 명령어와
                    정확히 일치하는지 확인하세요.
                    <code className="text-cyan-600 text-xs"> execute()</code>는 Map에서 이름을
                    정확히 매칭합니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">확인 2:</strong> 프론트매터의 YAML 문법이
                    올바른지 확인하세요.
                    <code className="text-cyan-600 text-xs"> ---</code> 구분자가 상단과 하단에 모두
                    있어야 합니다. Zod 스키마 검증에 실패하면 해당 스킬이 로드되지 않습니다.
                  </p>
                </div>
              </div>

              {/* FAQ 4 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> LLM이 내 스킬을 자동으로 호출하지 못하게
                  하고 싶어요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    프론트매터에{" "}
                    <code className="text-cyan-600 text-xs">disableModelInvocation: true</code>를
                    설정하세요.
                    <code className="text-cyan-600 text-xs"> getModelVisible()</code>이 이 스킬을
                    필터링하여 시스템 프롬프트에 포함되지 않습니다. 사용자는 여전히{" "}
                    <code className="text-cyan-600 text-xs">/name</code>으로 직접 호출할 수
                    있습니다.
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
                  name: "config-loader.ts",
                  slug: "config-loader",
                  relation: "sibling",
                  desc: "5단계 계층 설정 로더 — skill-manager와 함께 Leaf Layer를 구성하는 형제 모듈",
                },
                {
                  name: "instruction-loader.ts",
                  slug: "instruction-loader",
                  relation: "sibling",
                  desc: "6단계 DHELIX.md 로딩 체인 — 같은 레이어에서 지시사항을 수집하는 형제 모듈",
                },
                {
                  name: "system-prompt-builder.ts",
                  slug: "system-prompt-builder",
                  relation: "parent",
                  desc: "buildPromptSection()의 출력을 소비하여 최종 시스템 프롬프트를 조립하는 상위 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
