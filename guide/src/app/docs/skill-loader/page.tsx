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

export default function SkillLoaderPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">

        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <FilePath path="src/skills/loader.ts" />
            <LayerBadge layer="leaf" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
            <span className="text-gray-900">
              Skill Loader
            </span>
          </h1>
          <p className="text-[16px] text-gray-600 max-w-[640px]">
            디렉토리에서 스킬 파일(.md)을 탐색하고 로딩하는 모듈입니다.
            프론트매터(YAML 메타데이터)를 파싱하고 <span className="text-cyan-600 font-semibold">Zod 스키마</span>로 검증하여
            <span className="text-violet-600 font-semibold"> SkillDefinition</span> 객체를 생성합니다.
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
              스킬은 <strong className="text-gray-900">마크다운 파일</strong>로 작성된 재사용 가능한 프롬프트 템플릿입니다.
              Skill Loader는 디렉토리를 순회하며 <code className="text-cyan-600 text-xs">.md</code> 파일을 찾고,
              각 파일의 <span className="text-violet-600 font-semibold">프론트매터</span>를 파싱한 뒤
              <span className="text-cyan-600 font-semibold"> Zod 스키마</span>로 검증합니다.
              개별 파일 로딩 실패는 해당 스킬만 건너뛰고 나머지를 계속 로딩하는 <strong className="text-gray-900">비치명적 오류</strong> 전략을 사용합니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>핵심 원칙:</strong> 스킬 파일 하나가 잘못되어도 전체 로딩이 실패하지 않습니다.
              디렉토리가 존재하지 않으면 에러 없이 빈 배열을 반환합니다.
            </Callout>

            <MermaidDiagram
              title="스킬 로딩 파이프라인"
              titleColor="orange"
              chart={`flowchart LR
  DIR["📁 스킬 디렉토리\\n~/.dbcode/skills/ 등"]
  SCAN["🔍 .md 파일 필터링\\nreaddir + extname"]
  READ["📄 파일 읽기\\nreadFile(utf-8)"]
  SPLIT["✂️ 프론트매터 분리\\n--- 구분자 기준"]
  PARSE["🔧 YAML 파싱\\nparseFrontmatter()"]
  ZOD["✅ Zod 검증\\nskillFrontmatterSchema"]
  DEF["📋 SkillDefinition\\nfrontmatter + body + path"]

  DIR --> SCAN --> READ --> SPLIT --> PARSE --> ZOD --> DEF

  style DIR fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style SCAN fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style READ fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style SPLIT fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style PARSE fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style ZOD fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style DEF fill:#f8fafc,stroke:#06b6d4,color:#06b6d4,stroke-width:2px`}
            />

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
              <h4 className="text-[14px] font-bold mb-3">스킬 파일(.md) 구조</h4>
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-28">프론트매터</span>
                  <span><code className="text-cyan-600 text-xs">---</code> 사이의 YAML 메타데이터 (name, description, context 등)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-violet-600 font-bold shrink-0 w-28">본문 (body)</span>
                  <span>프론트매터 이후의 마크다운 텍스트 &mdash; 프롬프트 템플릿으로 사용</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-600 font-bold shrink-0 w-28">변수</span>
                  <span><code className="text-cyan-600 text-xs">$ARGUMENTS</code>, <code className="text-cyan-600 text-xs">$0</code>, <code className="text-cyan-600 text-xs">{"`!command`"}</code> 등 실행 시 치환</span>
                </div>
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

            {/* SkillLoadError */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">SkillLoadError</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-600">class</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                스킬 파일 읽기/파싱 실패 시 발생하는 에러 클래스입니다.
                <code className="text-cyan-600 text-xs"> BaseError</code>를 상속하며,
                에러 코드는 <code className="text-red-600 text-xs">SKILL_LOAD_ERROR</code>입니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "message",
                    type: "string",
                    required: true,
                    desc: "에러 메시지 (어떤 파일에서 실패했는지 포함)",
                  },
                  {
                    name: "context",
                    type: "Record<string, unknown>",
                    required: false,
                    desc: "추가 컨텍스트 정보 (path, cause 등). 기본값 {}",
                  },
                ]}
              />
            </div>

            {/* loadSkill */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">loadSkill()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">async</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                단일 마크다운 파일에서 스킬을 로드합니다. 파일을 읽고, 프론트매터와 본문을 분리한 후,
                프론트매터를 <code className="text-cyan-600 text-xs">Zod 스키마</code>로 검증하여
                <code className="text-violet-600 text-xs"> SkillDefinition</code>을 반환합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "filePath",
                    type: "string",
                    required: true,
                    desc: "스킬 .md 파일의 절대 경로",
                  },
                ]}
              />

              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">반환 타입: <code className="text-violet-600 text-xs">{"Promise<SkillDefinition>"}</code></h4>
                <ParamTable
                  params={[
                    {
                      name: "frontmatter",
                      type: "SkillFrontmatter",
                      required: true,
                      desc: "파싱/검증된 프론트매터 메타데이터 (name, description, context 등)",
                    },
                    {
                      name: "body",
                      type: "string",
                      required: true,
                      desc: "프론트매터 이후의 마크다운 본문 텍스트 (프롬프트 템플릿)",
                    },
                    {
                      name: "sourcePath",
                      type: "string",
                      required: true,
                      desc: "이 스킬이 로드된 파일의 절대 경로",
                    },
                  ]}
                />
              </div>

              <Callout type="warn" icon="⚠️">
                프론트매터가 없거나 Zod 검증에 실패하면 <code className="text-red-600 text-xs">SkillLoadError</code>를 던집니다.
                프론트매터의 <code className="text-cyan-600 text-xs">name</code>과 <code className="text-cyan-600 text-xs">description</code>은 필수 필드입니다.
              </Callout>
            </div>

            {/* loadSkillsFromDirectory */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">loadSkillsFromDirectory()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">async</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                디렉토리의 모든 <code className="text-cyan-600 text-xs">.md</code> 파일에서 스킬을 로드합니다.
                개별 파일 로딩 실패는 해당 스킬만 건너뛰고 계속 진행합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "directory",
                    type: "string",
                    required: true,
                    desc: "스킬 파일이 있는 디렉토리 경로. 존재하지 않으면 빈 배열 반환",
                  },
                ]}
              />

              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">반환 타입: <code className="text-violet-600 text-xs">{"Promise<readonly SkillDefinition[]>"}</code></h4>
              </div>
            </div>

            {/* parseFrontmatter (내부 함수) */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">parseFrontmatter()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-50 text-gray-400">internal</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                YAML 유사 프론트매터를 파싱하여 키-값 객체로 변환합니다.
                kebab-case 키는 자동으로 camelCase로 변환됩니다.
              </p>

              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
                <h4 className="text-[13px] font-bold mb-3">지원하는 값 타입</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">입력</th>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">결과</th>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">타입</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-gray-600">true / false</td>
                        <td className="p-2.5 text-emerald-600">true / false</td>
                        <td className="p-2.5 text-violet-600">boolean</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-gray-600">null / ~</td>
                        <td className="p-2.5 text-emerald-600">null</td>
                        <td className="p-2.5 text-violet-600">null</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-gray-600">[a, b, c]</td>
                        <td className="p-2.5 text-emerald-600">["a", "b", "c"]</td>
                        <td className="p-2.5 text-violet-600">string[]</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-gray-600">42</td>
                        <td className="p-2.5 text-emerald-600">42</td>
                        <td className="p-2.5 text-violet-600">number</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-gray-600">allowed-tools</td>
                        <td className="p-2.5 text-emerald-600">allowedTools</td>
                        <td className="p-2.5 text-violet-600">camelCase 키</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* splitFrontmatterAndBody (내부 함수) */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">splitFrontmatterAndBody()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-50 text-gray-400">internal</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                스킬 파일을 프론트매터와 본문으로 분리합니다.
                첫 줄이 <code className="text-cyan-600 text-xs">---</code>가 아니면 프론트매터 없음으로 판단하고
                전체 내용을 본문으로 취급합니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "content",
                    type: "string",
                    required: true,
                    desc: "스킬 파일의 전체 내용",
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

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>단일 스킬 파일 로딩</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              특정 <code className="text-cyan-600 text-xs">.md</code> 파일에서 하나의 스킬을 로드합니다.
              프론트매터가 유효해야 하며, 검증 실패 시 에러를 던집니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">loadSkill</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./skills/loader.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>{"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">skill</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">loadSkill</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"~/.dbcode/skills/commit.md"'}</span>
              <span className="text-[#c9d1d9]">);</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// skill.frontmatter.name === \"commit\""}</span>{"\n"}
              <span className="text-[#8b949e]">{"// skill.frontmatter.context === \"inline\""}</span>{"\n"}
              <span className="text-[#8b949e]">{"// skill.body === \"프롬프트 템플릿 본문...\""}</span>
            </CodeBlock>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>디렉토리 전체 스킬 로딩</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              디렉토리 내 모든 <code className="text-cyan-600 text-xs">.md</code> 파일을 순회하며 스킬을 일괄 로드합니다.
              개별 파일 실패는 무시되고 성공한 것만 반환됩니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">loadSkillsFromDirectory</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./skills/loader.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// 디렉토리가 없으면 빈 배열 반환 (에러 아님)"}</span>{"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">skills</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">loadSkillsFromDirectory</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"~/.dbcode/skills"'}</span>
              <span className="text-[#c9d1d9]">);</span>{"\n\n"}
              <span className="text-[#8b949e]">{"// skills: readonly SkillDefinition[]"}</span>{"\n"}
              <span className="text-[#8b949e]">{"// 유효한 스킬만 포함, 실패한 파일은 자동 건너뜀"}</span>
            </CodeBlock>

            <DeepDive title="스킬 파일 작성 예시">
              <p className="mb-3">
                스킬 파일은 프론트매터와 본문으로 구성됩니다. 프론트매터에서 스킬의 메타데이터를 정의하고,
                본문에 LLM에 전달할 프롬프트 템플릿을 작성합니다.
              </p>

              <CodeBlock>
                <span className="text-[#8b949e]">{"---"}</span>{"\n"}
                <span className="text-[#79c0ff]">name</span>
                <span className="text-[#c9d1d9]">: commit</span>{"\n"}
                <span className="text-[#79c0ff]">description</span>
                <span className="text-[#c9d1d9]">: Git 커밋 메시지 생성</span>{"\n"}
                <span className="text-[#79c0ff]">context</span>
                <span className="text-[#c9d1d9]">: inline</span>{"\n"}
                <span className="text-[#79c0ff]">allowed-tools</span>
                <span className="text-[#c9d1d9]">: [Bash, Read, Grep]</span>{"\n"}
                <span className="text-[#8b949e]">{"---"}</span>{"\n\n"}
                <span className="text-[#c9d1d9]">현재 변경사항을 분석하고 커밋 메시지를 작성하세요.</span>{"\n"}
                <span className="text-[#c9d1d9]">인자: $ARGUMENTS</span>
              </CodeBlock>

              <Callout type="warn" icon="⚠️">
                <code className="text-cyan-600 text-xs">allowed-tools</code>는 kebab-case로 작성하세요.
                로더가 자동으로 <code className="text-cyan-600 text-xs">allowedTools</code>(camelCase)로 변환합니다.
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

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>프론트매터 분리 알고리즘</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">splitFrontmatterAndBody()</code>는
              파일 첫 줄이 <code className="text-cyan-600 text-xs">---</code>인지 확인하고,
              두 번째 <code className="text-cyan-600 text-xs">---</code>까지를 프론트매터로 분리합니다.
            </p>

            <MermaidDiagram
              title="프론트매터 분리 흐름"
              titleColor="cyan"
              chart={`flowchart TD
  START["splitFrontmatterAndBody(content)"] --> CHECK{"첫 줄이\\n--- 인가?"}
  CHECK -->|No| NOBODY["프론트매터 없음\\nbody = 전체 content"]
  CHECK -->|Yes| FIND["두 번째 --- 탐색\\nlines.indexOf('---', 1)"]
  FIND --> FOUND{"두 번째\\n--- 발견?"}
  FOUND -->|No| NOBODY
  FOUND -->|Yes| SPLIT["프론트매터 = lines[1..endIdx]\\nbody = lines[endIdx+1..]"]
  SPLIT --> RETURN["{ frontmatterRaw, body }"]

  style START fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style CHECK fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style FOUND fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style SPLIT fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style NOBODY fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style RETURN fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px`}
            />

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>에러 처리 전략</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">loadSkillsFromDirectory()</code>는 두 가지 에러 수준을 구분합니다.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-28">비치명적</span>
                  <span>개별 스킬 파일 로딩 실패 &mdash; 해당 스킬만 건너뛰고 나머지 계속 로딩</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-red-600 font-bold shrink-0 w-28">무시</span>
                  <span>디렉토리 미존재(ENOENT) &mdash; 빈 배열 반환, 에러 없음</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-red-600 font-bold shrink-0 w-28">치명적</span>
                  <span>디렉토리 읽기 자체 실패(ENOENT 외) &mdash; <code className="text-red-600 text-xs">SkillLoadError</code> throw</span>
                </div>
              </div>
            </div>

            <Callout type="info" icon="📝">
              <strong>SkillLoadError</strong>는 <code className="text-cyan-600 text-xs">BaseError</code>를 상속하며,
              에러 코드 <code className="text-cyan-600 text-xs">SKILL_LOAD_ERROR</code>와 함께 파일 경로, 원인 정보를 context로 전달합니다.
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
                  <span className="text-red-600">Q.</span> 스킬 파일을 만들었는데 /명령어로 나타나지 않아요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 1:</strong> 프론트매터가 없거나 형식이 잘못되었습니다.
                    파일 첫 줄이 <code className="text-cyan-600 text-xs">---</code>로 시작하는지, 닫는 <code className="text-cyan-600 text-xs">---</code>가 있는지 확인하세요.
                  </p>
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 2:</strong>{" "}
                    <code className="text-cyan-600 text-xs">name</code>과 <code className="text-cyan-600 text-xs">description</code>이 비어있습니다.
                    두 필드는 필수이며, 빈 문자열이면 Zod 검증에 실패합니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인 3:</strong> 파일 확장자가 <code className="text-cyan-600 text-xs">.md</code>가 아닙니다.
                    로더는 <code className="text-cyan-600 text-xs">.md</code> 확장자만 필터링합니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> allowed-tools가 인식되지 않아요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    프론트매터에서 <code className="text-cyan-600 text-xs">allowed-tools: [Bash, Read]</code>처럼
                    kebab-case로 작성했는지 확인하세요. 로더가 자동으로 camelCase(<code className="text-cyan-600 text-xs">allowedTools</code>)로 변환합니다.
                    YAML 인라인 배열 문법(<code className="text-cyan-600 text-xs">[item1, item2]</code>)을 사용해야 합니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 디렉토리가 없다는 에러가 나요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <code className="text-cyan-600 text-xs">loadSkillsFromDirectory()</code>는 디렉토리가 없으면 에러 없이 빈 배열을 반환합니다.
                    에러가 발생한다면 권한 문제 등 <code className="text-cyan-600 text-xs">ENOENT</code> 외의 파일시스템 에러입니다.
                    디렉토리 경로와 권한을 확인하세요.
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
                  name: "skills/executor.ts",
                  slug: "skill-executor",
                  relation: "sibling",
                  desc: "로드된 스킬의 변수 치환과 동적 컨텍스트 주입을 수행하는 실행 엔진",
                },
                {
                  name: "skills/command-bridge.ts",
                  slug: "skill-command-bridge",
                  relation: "sibling",
                  desc: "스킬을 슬래시 명령어로 변환하는 브릿지 모듈",
                },
                {
                  name: "skills/manager.ts",
                  slug: "skill-manager",
                  relation: "parent",
                  desc: "4개 디렉토리에서 스킬을 관리하는 매니저 — loader를 내부적으로 사용",
                },
                {
                  name: "config/loader.ts",
                  slug: "config-loader",
                  relation: "sibling",
                  desc: "5단계 계층 설정 로더 — 같은 Leaf Layer의 설정 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>

      </div>
    </div>
  );
}
