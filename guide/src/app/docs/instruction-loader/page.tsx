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

export default function InstructionLoaderPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilePath path="src/instructions/loader.ts" />
              <LayerBadge layer="leaf" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
              <span className="text-gray-900">Instruction Loader</span>
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[640px]">
              6단계 계층에서 DBCODE.md 인스트럭션을 로드하고 병합하는 모듈입니다. global부터
              local까지, 우선순위에 따라{" "}
              <span className="text-cyan-600 font-semibold">{`'\\n\\n---\\n\\n'`}</span> 구분자로
              합쳐져 LLM 시스템 프롬프트에 주입됩니다.
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
            <p className="text-[14px] text-gray-600 leading-relaxed mb-4">
              dbcode는 하나의 DBCODE.md에 의존하지 않습니다.
              <strong className="text-gray-900"> 6개 레이어</strong>에서 인스트럭션을 수집하여 낮은
              우선순위부터 높은 우선순위 순서로 합칩니다. 이 구조 덕분에 전역 규칙 위에 프로젝트
              규칙을 얹고, 경로별 조건부 규칙을 적용하고, 개인 오버라이드까지 지원할 수 있습니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>핵심 원칙:</strong> 높은 레이어가 낮은 레이어 위에 추가됩니다.
              DBCODE.local.md가 가장 높고,{" "}
              <code className="text-cyan-600 text-xs">~/.dbcode/DBCODE.md</code>가 가장 낮습니다.
              Config Loader와 달리 덮어쓰기가 아닌 <strong>이어붙이기(concatenation)</strong>입니다.
            </Callout>

            <MermaidDiagram
              title="6-Layer 인스트럭션 병합 순서"
              titleColor="orange"
              chart={`flowchart TB
  L1["🌍 Layer 1\\n~/.dbcode/DBCODE.md\\n(전역 인스트럭션)"]
  L2["📏 Layer 2\\n~/.dbcode/rules/*.md\\n(전역 경로 조건부 규칙)"]
  L3["📂 Layer 3\\n상위 디렉토리 DBCODE.md\\n(모노레포 지원)"]
  L4["📁 Layer 4\\n{projectRoot}/DBCODE.md\\n(프로젝트 인스트럭션)"]
  L5["🎯 Layer 5\\n.dbcode/rules/*.md\\n(프로젝트 경로 조건부)"]
  L6["🔒 Layer 6\\nDBCODE.local.md\\n(개인 오버라이드)"]

  L1 -->|concat| L2
  L2 -->|concat| L3
  L3 -->|concat| L4
  L4 -->|concat| L5
  L5 -->|concat| L6
  L6 -->|"join with ---"| FINAL["✅ combined<br/><small>병합된 최종 인스트럭션</small>"]

  style L1 fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style L2 fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style L3 fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style L4 fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style L5 fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style L6 fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style FINAL fill:#f8fafc,stroke:#06b6d4,color:#06b6d4,stroke-width:2px`}
            />

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
              <h4 className="text-[14px] font-bold mb-3">각 레이어가 존재하는 이유</h4>
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-20">Layer 1</span>
                  <span>
                    모든 프로젝트에 공통 적용되는{" "}
                    <strong className="text-gray-900">개인 글로벌 지시사항</strong> (코딩 스타일,
                    선호 도구 등)
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-violet-600 font-bold shrink-0 w-20">Layer 2</span>
                  <span>
                    전역 경로 조건부 규칙 &mdash; 특정 파일 패턴에만 적용 (예:{" "}
                    <code className="text-cyan-600 text-xs">*.test.ts</code>에만 테스트 규칙)
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-600 font-bold shrink-0 w-20">Layer 3</span>
                  <span>
                    모노레포 중첩 프로젝트 지원 &mdash; cwd에서 프로젝트 루트까지 상향 탐색하며 수집
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-emerald-600 font-bold shrink-0 w-20">Layer 4</span>
                  <span>
                    프로젝트 고유 인스트럭션 &mdash; 팀원과 Git으로 공유 (
                    <code className="text-cyan-600 text-xs">DBCODE.md</code>를 커밋)
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-cyan-600 font-bold shrink-0 w-20">Layer 5</span>
                  <span>
                    프로젝트 내 경로 조건부 규칙 &mdash; 프론트매터의{" "}
                    <code className="text-cyan-600 text-xs">paths:</code>로 적용 범위 제한
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-red-600 font-bold shrink-0 w-20">Layer 6</span>
                  <span>
                    개인 오버라이드 &mdash;{" "}
                    <code className="text-cyan-600 text-xs">DBCODE.local.md</code>는 gitignore
                    대상으로 팀에 공유되지 않음
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

            {/* InstructionLoadError */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">InstructionLoadError</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-600">
                  class
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                <code className="text-cyan-600 text-xs">BaseError</code>를 확장하는 인스트럭션 로딩
                전용 에러 클래스입니다. 에러 코드는{" "}
                <code className="text-cyan-600 text-xs">INSTRUCTION_LOAD_ERROR</code>이며, 추가
                컨텍스트 정보를 <code className="text-cyan-600 text-xs">context</code> 객체로 전달할
                수 있습니다.
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
                    desc: "에러 발생 상황에 대한 추가 정보 (기본값: {})",
                  },
                ]}
              />
            </div>

            {/* LoadedInstructions */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">LoadedInstructions</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                  interface
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                6개 레이어에서 로드된 인스트럭션 결과를 담는 인터페이스입니다. 각 레이어별 원본
                내용과, 모두 합산한 <code className="text-cyan-600 text-xs">combined</code> 문자열을
                포함합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "globalInstructions",
                    type: "string (readonly)",
                    required: true,
                    desc: "~/.dbcode/DBCODE.md에서 로드된 전역 사용자 인스트럭션",
                  },
                  {
                    name: "globalRules",
                    type: "string (readonly)",
                    required: true,
                    desc: "~/.dbcode/rules/*.md에서 로드된 전역 경로 조건부 규칙",
                  },
                  {
                    name: "parentInstructions",
                    type: "string (readonly)",
                    required: true,
                    desc: "cwd에서 프로젝트 루트까지 상향 탐색하며 수집한 상위 DBCODE.md 내용",
                  },
                  {
                    name: "projectInstructions",
                    type: "string (readonly)",
                    required: true,
                    desc: "프로젝트 루트의 DBCODE.md (또는 .dbcode/DBCODE.md 폴백) 내용",
                  },
                  {
                    name: "pathRules",
                    type: "string (readonly)",
                    required: true,
                    desc: ".dbcode/rules/*.md에서 현재 경로에 매칭된 프로젝트 경로 조건부 규칙",
                  },
                  {
                    name: "localInstructions",
                    type: "string (readonly)",
                    required: true,
                    desc: "DBCODE.local.md에서 로드된 개인 오버라이드 (gitignore 대상)",
                  },
                  {
                    name: "combined",
                    type: "string (readonly)",
                    required: true,
                    desc: "모든 레이어를 '\\n\\n---\\n\\n'으로 합산한 최종 텍스트 (시스템 프롬프트에 주입)",
                  },
                ]}
              />
            </div>

            {/* LoadInstructionsOptions */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">LoadInstructionsOptions</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                  interface
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                인스트럭션 로딩 시 전달할 수 있는 옵션입니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "excludePatterns",
                    type: "readonly string[]",
                    required: false,
                    desc: '특정 규칙 파일을 제외할 glob 패턴 배열 (예: ["test-*.md"])',
                  },
                ]}
              />
            </div>

            {/* loadInstructions() */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">loadInstructions()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">
                  async
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                6단계 계층 인스트럭션 로더의 메인 함수입니다. 모든 레이어에서 인스트럭션을 수집하고
                <code className="text-cyan-600 text-xs"> LoadedInstructions</code>를 반환합니다.
                내부적으로 프로젝트 루트를 상향 탐색으로 찾고, 각 레이어를 순차적으로 로드합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "workingDirectory",
                    type: "string",
                    required: true,
                    desc: "현재 작업 디렉토리 (cwd). 프로젝트 루트 탐색과 경로 규칙 매칭의 기준점",
                  },
                  {
                    name: "options",
                    type: "LoadInstructionsOptions",
                    required: false,
                    desc: "로딩 옵션. excludePatterns로 특정 규칙 파일을 건너뛸 수 있음",
                  },
                ]}
              />

              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환 타입:{" "}
                  <code className="text-violet-600 text-xs">{"Promise<LoadedInstructions>"}</code>
                </h4>
                <p className="text-[13px] text-gray-600">
                  각 레이어별 원본 내용과 합산된{" "}
                  <code className="text-cyan-600 text-xs">combined</code> 문자열을 포함하는 객체. 빈
                  레이어는 합산에서 제외되어 불필요한 구분선이 삽입되지 않습니다.
                </p>
              </div>

              <Callout type="warn" icon="⚠️">
                프로젝트 루트를 찾지 못하면 Layer 3~6은 모두 빈 문자열이 됩니다.
                <code className="text-cyan-600 text-xs"> DBCODE.md</code>나{" "}
                <code className="text-cyan-600 text-xs">.dbcode/</code> 디렉토리가 프로젝트 루트
                마커 역할을 합니다.
              </Callout>
            </div>

            {/* LazyInstructionLoader */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">LazyInstructionLoader</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-600">
                  class
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                파일 접근 시 해당 디렉토리의 DBCODE.md를 온디맨드 로드하는 지연 로더입니다. 시작 시
                모든 인스트럭션을 로드하는 대신, 도구가 특정 파일에 접근할 때 그 디렉토리의 규칙만
                로드합니다. 결과는 디렉토리별로 캐시됩니다.
              </p>

              <div className="mt-3 mb-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">생성자</h4>
                <ParamTable
                  params={[
                    {
                      name: "projectRoot",
                      type: "string",
                      required: true,
                      desc: "프로젝트 루트 경로. 이 위로는 탐색하지 않는 상한선 역할",
                    },
                  ]}
                />
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
                <h4 className="text-[13px] font-bold mb-3">메서드</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                          메서드
                        </th>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                          시그니처
                        </th>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                          설명
                        </th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-cyan-600 font-semibold">
                          getInstructionsForFile
                        </td>
                        <td className="p-2.5 text-gray-600 text-[11px]">
                          {"(filePath: string) => Promise<string>"}
                        </td>
                        <td className="p-2.5 text-gray-600 font-sans">
                          파일 경로에서 프로젝트 루트까지 상향 탐색하며 DBCODE.md 수집
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-cyan-600 font-semibold">invalidate</td>
                        <td className="p-2.5 text-gray-600 text-[11px]">
                          {"(dirPath: string) => void"}
                        </td>
                        <td className="p-2.5 text-gray-600 font-sans">
                          특정 디렉토리의 캐시를 무효화 (DBCODE.md 수정 시 호출)
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-cyan-600 font-semibold">clearCache</td>
                        <td className="p-2.5 text-gray-600 text-[11px]">{"() => void"}</td>
                        <td className="p-2.5 text-gray-600 font-sans">
                          모든 디렉토리의 캐시를 삭제
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <Callout type="info" icon="📝">
                프로젝트 외부 파일(<code className="text-cyan-600 text-xs">relative()</code> 결과가{" "}
                <code className="text-cyan-600 text-xs">..</code>으로 시작)에 대해서는 빈 문자열을
                반환합니다. 빈 문자열도 캐시하여 반복적인 디스크 I/O를 방지합니다.
              </Callout>
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
              기본 사용 (에이전트 루프 시작 시)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              에이전트 루프가 시작될 때{" "}
              <code className="text-cyan-600 text-xs">loadInstructions()</code>를 호출하여 현재 작업
              디렉토리의 인스트럭션을 로드합니다. 반환된{" "}
              <code className="text-cyan-600 text-xs">combined</code>가 시스템 프롬프트에
              주입됩니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">loadInstructions</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./instructions/loader.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">result</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">loadInstructions</span>
              <span className="text-[#c9d1d9]">(process.cwd());</span>
              {"\n\n"}
              <span className="text-[#8b949e]">
                {"// result.combined — 시스템 프롬프트에 주입할 최종 텍스트"}
              </span>
              {"\n"}
              <span className="text-[#8b949e]">
                {"// result.projectInstructions — 프로젝트 DBCODE.md만 확인 가능"}
              </span>
              {"\n"}
              <span className="text-[#8b949e]">
                {"// result.globalRules — 전역 규칙만 확인 가능"}
              </span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              특정 규칙 파일 제외하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">excludePatterns</code> 옵션으로 특정 패턴의
              규칙 파일을 로딩에서 제외할 수 있습니다. 테스트 환경이나 특수한 상황에서 유용합니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">result</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">loadInstructions</span>
              <span className="text-[#c9d1d9]">(process.cwd(), {"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">excludePatterns</span>
              <span className="text-[#c9d1d9]">{": ["}</span>
              <span className="text-[#a5d6ff]">{'"test-*.md"'}</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#a5d6ff]">{'"draft-*.md"'}</span>
              <span className="text-[#c9d1d9]">{"]"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"});"}</span>
              {"\n\n"}
              <span className="text-[#8b949e]">
                {"// test-*.md와 draft-*.md 규칙 파일이 모두 건너뛰어짐"}
              </span>
            </CodeBlock>

            <DeepDive title="LazyInstructionLoader로 온디맨드 로딩하기">
              <p className="mb-3">
                대규모 프로젝트에서는 시작 시 모든 디렉토리의 DBCODE.md를 로드하는 것이
                비효율적입니다.
                <code className="text-cyan-600 text-xs"> LazyInstructionLoader</code>를 사용하면
                실제로 파일에 접근할 때만 해당 디렉토리의 인스트럭션을 로드하고, 결과를 캐시합니다.
              </p>

              <CodeBlock>
                <span className="text-[#ff7b72]">import</span>{" "}
                <span className="text-[#c9d1d9]">{"{ "}</span>
                <span className="text-[#79c0ff]">LazyInstructionLoader</span>
                <span className="text-[#c9d1d9]">{" }"}</span>{" "}
                <span className="text-[#ff7b72]">from</span>{" "}
                <span className="text-[#a5d6ff]">{'"./instructions/loader.js"'}</span>
                <span className="text-[#c9d1d9]">;</span>
                {"\n\n"}
                <span className="text-[#ff7b72]">const</span>{" "}
                <span className="text-[#79c0ff]">loader</span>{" "}
                <span className="text-[#c9d1d9]">=</span>{" "}
                <span className="text-[#ff7b72]">new</span>{" "}
                <span className="text-[#d2a8ff]">LazyInstructionLoader</span>
                <span className="text-[#c9d1d9]">(</span>
                <span className="text-[#a5d6ff]">{'"./my-project"'}</span>
                <span className="text-[#c9d1d9]">);</span>
                {"\n\n"}
                <span className="text-[#8b949e]">
                  {"// 파일 접근 시 해당 디렉토리의 DBCODE.md를 자동 로드"}
                </span>
                {"\n"}
                <span className="text-[#ff7b72]">const</span>{" "}
                <span className="text-[#79c0ff]">rules</span>{" "}
                <span className="text-[#c9d1d9]">=</span>{" "}
                <span className="text-[#ff7b72]">await</span>{" "}
                <span className="text-[#c9d1d9]">loader.</span>
                <span className="text-[#d2a8ff]">getInstructionsForFile</span>
                <span className="text-[#c9d1d9]">(</span>
                {"\n"}
                <span className="text-[#c9d1d9]">{"  "}</span>
                <span className="text-[#a5d6ff]">{'"./my-project/src/components/Button.tsx"'}</span>
                {"\n"}
                <span className="text-[#c9d1d9]">);</span>
                {"\n\n"}
                <span className="text-[#8b949e]">{"// DBCODE.md 수정 후 캐시 무효화"}</span>
                {"\n"}
                <span className="text-[#c9d1d9]">loader.</span>
                <span className="text-[#d2a8ff]">invalidate</span>
                <span className="text-[#c9d1d9]">(</span>
                <span className="text-[#a5d6ff]">{'"./my-project/src/components"'}</span>
                <span className="text-[#c9d1d9]">);</span>
              </CodeBlock>

              <Callout type="warn" icon="⚠️">
                <code className="text-cyan-600 text-xs">LazyInstructionLoader</code>는 프로젝트 외부
                파일에 대해서는 빈 문자열을 반환합니다.{" "}
                <code className="text-cyan-600 text-xs">relative()</code> 결과가{" "}
                <code className="text-cyan-600 text-xs">..</code>으로 시작하면 프로젝트 외부로
                판단합니다.
              </Callout>
            </DeepDive>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              경로 조건부 규칙 작성하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">.dbcode/rules/</code> 디렉토리에{" "}
              <code className="text-cyan-600 text-xs">.md</code> 파일을 추가하면 경로 조건부 규칙이
              됩니다. 프론트매터의 <code className="text-cyan-600 text-xs">paths:</code>로 적용
              범위를 제한할 수 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"# .dbcode/rules/react-components.md"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">---</span>
              {"\n"}
              <span className="text-[#79c0ff]">paths</span>
              <span className="text-[#c9d1d9]">:</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  - "}</span>
              <span className="text-[#a5d6ff]">{'"src/components/**"'}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  - "}</span>
              <span className="text-[#a5d6ff]">{'"src/pages/**"'}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">---</span>
              {"\n\n"}
              <span className="text-[#c9d1d9]">React 컴포넌트 작성 규칙:</span>
              {"\n"}
              <span className="text-[#c9d1d9]">- 함수형 컴포넌트만 사용</span>
              {"\n"}
              <span className="text-[#c9d1d9]">- Props는 interface로 정의</span>
              {"\n"}
              <span className="text-[#c9d1d9]">- default export 금지</span>
            </CodeBlock>

            <Callout type="info" icon="📝">
              프론트매터가 없거나 <code className="text-cyan-600 text-xs">paths:</code> 필드가
              없으면 <code className="text-cyan-600 text-xs">**</code>(모든 경로)에 매칭됩니다.
              레거시 <code className="text-cyan-600 text-xs">pattern:</code> 필드도 지원하지만,{" "}
              <code className="text-cyan-600 text-xs">paths:</code>가 있으면 무시됩니다.
            </Callout>
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
              프로젝트 루트 탐색 알고리즘
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">findProjectRoot()</code>는 현재 디렉토리에서
              파일 시스템 루트까지 상향 탐색하며 프로젝트 마커를 찾습니다. 각 디렉토리에서 3가지를
              순서대로 확인합니다.
            </p>

            <MermaidDiagram
              title="프로젝트 루트 탐색 흐름"
              titleColor="cyan"
              chart={`flowchart TD
  START["findProjectRoot(startDir)<br/><small>프로젝트 루트 탐색 시작</small>"] --> CHECK1{"DBCODE.md\\n직접 존재?"}
  CHECK1 -->|Yes| FOUND["✅ 프로젝트 루트 발견<br/><small>현재 디렉토리 반환</small>"]
  CHECK1 -->|No| CHECK2{".dbcode/DBCODE.md\\n존재? (폴백)"}
  CHECK2 -->|Yes| FOUND
  CHECK2 -->|No| CHECK3{".dbcode/\\n디렉토리 존재?"}
  CHECK3 -->|Yes| FOUND
  CHECK3 -->|No| PARENT["상위 디렉토리로 이동<br/><small>한 단계 위로 올라감</small>"]
  PARENT --> ISROOT{"파일 시스템\\n루트인가?"}
  ISROOT -->|Yes| NULL["❌ null 반환<br/><small>프로젝트 루트 없음</small>"]
  ISROOT -->|No| CHECK1

  style START fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style CHECK1 fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style CHECK2 fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style CHECK3 fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style FOUND fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px
  style NULL fill:#f8fafc,stroke:#ef4444,color:#ef4444,stroke-width:2px`}
            />

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              프론트매터 패턴 파싱
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">parseFrontmatterPatterns()</code>는{" "}
              <code className="text-cyan-600 text-xs">rules/*.md</code> 파일의 프론트매터에서 경로
              패턴을 추출합니다. 두 가지 형식을 지원하며,{" "}
              <code className="text-cyan-600 text-xs">paths:</code>가{" "}
              <code className="text-cyan-600 text-xs">pattern:</code>보다 우선합니다.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
              <h4 className="text-[13px] font-bold mb-3">프론트매터 파싱 우선순위</h4>
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-emerald-600 font-bold shrink-0 w-24">1순위</span>
                  <span>
                    <code className="text-cyan-600 text-xs">paths:</code> 배열 형식 (권장) &mdash;
                    여러 경로 패턴을 YAML 리스트로 지정
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-24">2순위</span>
                  <span>
                    <code className="text-cyan-600 text-xs">pattern:</code> 단일 형식 (레거시)
                    &mdash; 하나의 glob 패턴만 지정
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-gray-400 font-bold shrink-0 w-24">폴백</span>
                  <span>
                    프론트매터 없거나 패턴 없음 &mdash;{" "}
                    <code className="text-cyan-600 text-xs">**</code> (모든 경로 매칭)
                  </span>
                </div>
              </div>
            </div>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              safeReadFile과 심볼릭 링크
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">safeReadFile()</code>은 파일을 읽기 전에{" "}
              <code className="text-cyan-600 text-xs">realpath()</code>로 심볼릭 링크를 해석합니다.
              여러 프로젝트에서 공유 인스트럭션 파일을 심볼릭 링크로 연결하는 패턴을 지원합니다.
              파일이 없거나 읽기 실패 시 에러를 던지지 않고 빈 문자열을 반환하는 &ldquo;조용한
              실패&rdquo; 전략입니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"// 심볼릭 링크 활용 예시"}</span>
              {"\n"}
              <span className="text-[#8b949e]">
                {"// 여러 프로젝트에서 공유 DBCODE.md를 심볼릭 링크로 연결"}
              </span>
              {"\n"}
              <span className="text-[#c9d1d9]">ln -s ~/shared/DBCODE.md ./DBCODE.md</span>
              {"\n\n"}
              <span className="text-[#8b949e]">
                {"// safeReadFile이 realpath()로 실제 경로를 해석하므로"}
              </span>
              {"\n"}
              <span className="text-[#8b949e]">{"// 심볼릭 링크 여부와 관계없이 정상 동작"}</span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              @import 지시어 처리
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              각 레이어의 DBCODE.md 파일은{" "}
              <code className="text-cyan-600 text-xs">parseInstructions()</code>를 통해 처리됩니다.
              이 함수는 <code className="text-cyan-600 text-xs">@import</code> 지시어를 해석하여
              외부 파일의 내용을 인라인으로 포함시킵니다. 이를 통해 인스트럭션을 여러 파일로
              분리하고 재사용할 수 있습니다.
            </p>

            <Callout type="info" icon="📝">
              <code className="text-cyan-600 text-xs">parseInstructions()</code>는 별도 모듈{" "}
              <code className="text-cyan-600 text-xs">instructions/parser.ts</code>에 구현되어
              있습니다. 경로 매칭은{" "}
              <code className="text-cyan-600 text-xs">instructions/path-matcher.ts</code>가
              담당합니다.
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
                  <span className="text-red-600">Q.</span> DBCODE.md를 만들었는데 인스트럭션이
                  적용되지 않아요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 1:</strong> 프로젝트 루트를 찾지 못하고
                    있습니다.
                    <code className="text-cyan-600 text-xs"> DBCODE.md</code>가 프로젝트 루트에
                    있거나, <code className="text-cyan-600 text-xs">.dbcode/</code> 디렉토리가
                    존재해야 합니다.
                  </p>
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 2:</strong> 작업 디렉토리(cwd)가
                    DBCODE.md 파일보다 상위에 있습니다.
                    <code className="text-cyan-600 text-xs"> findProjectRoot</code>는 현재
                    디렉토리에서 <em>위로만</em> 탐색합니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인 3:</strong>{" "}
                    <code className="text-cyan-600 text-xs">excludePatterns</code>에 의해 제외되고
                    있습니다. 옵션을 확인해보세요.
                  </p>
                </div>
              </div>

              {/* FAQ 2 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> rules/*.md 파일의 경로 조건이 작동하지
                  않아요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">확인 1:</strong> 프론트매터 형식이 올바른지
                    확인하세요. <code className="text-cyan-600 text-xs">---</code>로 감싸야 하고,{" "}
                    <code className="text-cyan-600 text-xs">paths:</code>는 YAML 리스트 형식이어야
                    합니다.
                  </p>
                  <p className="mb-2">
                    <strong className="text-gray-900">확인 2:</strong> glob 패턴이 정확한지
                    확인하세요. <code className="text-cyan-600 text-xs">src/components/**</code>는{" "}
                    <code className="text-cyan-600 text-xs">src/components/</code> 하위 모든 파일에
                    매칭됩니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">확인 3:</strong> 파일 확장자가{" "}
                    <code className="text-cyan-600 text-xs">.md</code>인지 확인하세요. 다른 확장자의
                    파일은 무시됩니다.
                  </p>
                </div>
              </div>

              {/* FAQ 3 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> DBCODE.local.md가 팀원에게 공유돼
                  버렸어요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <code className="text-cyan-600 text-xs">DBCODE.local.md</code>는 개인
                    오버라이드용 파일로, <code className="text-cyan-600 text-xs">.gitignore</code>에
                    추가해야 합니다. 프로젝트의{" "}
                    <code className="text-cyan-600 text-xs">.gitignore</code>에{" "}
                    <code className="text-cyan-600 text-xs">DBCODE.local.md</code>를 추가하세요.
                    이미 커밋된 경우{" "}
                    <code className="text-cyan-600 text-xs">git rm --cached DBCODE.local.md</code>로
                    추적을 해제할 수 있습니다.
                  </p>
                </div>
              </div>

              {/* FAQ 4 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> LazyInstructionLoader의 캐시가 오래된
                  내용을 반환해요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">해결:</strong>{" "}
                    <code className="text-cyan-600 text-xs">invalidate(dirPath)</code>로 해당
                    디렉토리의 캐시를 무효화하세요. DBCODE.md가 수정된 디렉토리 경로를 전달하면 다음
                    접근 시 재로딩됩니다.
                  </p>
                  <p>
                    전체 캐시를 지우려면 <code className="text-cyan-600 text-xs">clearCache()</code>
                    를 호출하세요. 다만, 모든 디렉토리가 재로딩되므로 대규모 프로젝트에서는 성능
                    영향이 있을 수 있습니다.
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
                  name: "config/loader.ts",
                  slug: "config-loader",
                  relation: "sibling",
                  desc: "5단계 설정 병합 로더 — instruction-loader와 함께 Leaf Layer를 구성",
                },
                {
                  name: "skills/manager.ts",
                  slug: "skill-manager",
                  relation: "sibling",
                  desc: "4개 디렉토리에서 스킬 로딩 — 인스트럭션과 독립적으로 동작하는 같은 레이어 모듈",
                },
                {
                  name: "core/system-prompt-builder.ts",
                  slug: "system-prompt-builder",
                  relation: "parent",
                  desc: "combined 인스트럭션을 소비하여 최종 시스템 프롬프트를 조립하는 상위 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
