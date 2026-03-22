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

export default function InstructionParserPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilePath path="src/instructions/parser.ts" />
              <LayerBadge layer="leaf" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
              <span className="text-gray-900">Instruction Parser</span>
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[640px]">
              DBCODE.md 파일의 <span className="text-cyan-600 font-semibold">@import</span> 지시어를
              해석하고 가져온 파일 내용을 병합하는 파서 모듈입니다. 순환 참조 감지, 최대 깊이 제한,{" "}
              <span className="text-violet-600 font-semibold">.md 전용</span> 보안 정책을
              적용합니다.
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
              대규모 인스트럭션을 여러 마크다운 파일로 분리하여 관리할 수 있도록
              <strong className="text-gray-900"> @import</strong> 기능을 제공합니다. 표준 형식(
              <code className="text-cyan-600 text-xs">@import "./path.md"</code>)과 단축 형식(
              <code className="text-cyan-600 text-xs">@./path.md</code>)을 모두 지원하며, 재귀적으로
              중첩 임포트를 해석합니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>안전 장치 3가지:</strong> (1){" "}
              <code className="text-cyan-600 text-xs">.md</code> 파일만 임포트 가능, (2) 최대 5단계
              중첩, (3) 순환 참조 자동 감지 및 건너뛰기.
            </Callout>

            <MermaidDiagram
              title="@import 해석 파이프라인"
              titleColor="orange"
              chart={`flowchart TD
  INPUT["📄 DBCODE.md 원본\\n@import 지시어 포함"]
  EXTRACT["🔍 임포트 경로 추출\\n표준 + 단축 형식"]
  VALIDATE{"✅ 검증\\n.md 파일?\\n순환 참조?\\n깊이 초과?"}
  READ["📖 파일 읽기\\nreadFile(utf-8)"]
  RECURSE["🔄 재귀 해석\\n중첩 @import 처리"]
  REPLACE["✂️ 내용 교체\\n@import → 파일 내용"]
  OUTPUT["📋 최종 텍스트\\n모든 임포트 해석 완료"]

  INPUT --> EXTRACT --> VALIDATE
  VALIDATE -->|통과| READ --> RECURSE --> REPLACE --> OUTPUT
  VALIDATE -->|실패| SKIP["<!-- 주석으로 교체 -->"]
  SKIP --> OUTPUT

  style INPUT fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style EXTRACT fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style VALIDATE fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style READ fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style RECURSE fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style REPLACE fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style SKIP fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style OUTPUT fill:#f8fafc,stroke:#06b6d4,color:#06b6d4,stroke-width:2px`}
            />

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
              <h4 className="text-[14px] font-bold mb-3">지원하는 @import 문법</h4>
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-28">표준 형식</span>
                  <span>
                    <code className="text-cyan-600 text-xs">@import "./rules/frontend.md"</code>{" "}
                    &mdash; 따옴표 필수, 뒤에 # 코멘트 가능
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-violet-600 font-bold shrink-0 w-28">단축 형식</span>
                  <span>
                    <code className="text-cyan-600 text-xs">@./rules/frontend.md</code> &mdash;
                    경로가 <code className="text-cyan-600 text-xs">./</code>,{" "}
                    <code className="text-cyan-600 text-xs">../</code>,{" "}
                    <code className="text-cyan-600 text-xs">/</code>로 시작해야 함
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-600 font-bold shrink-0 w-28">코멘트</span>
                  <span>
                    <code className="text-cyan-600 text-xs">
                      @import "./path.md" # 이 부분은 무시됨
                    </code>
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
              <span>{"📋"}</span> 레퍼런스
            </h2>

            {/* InstructionParseError */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">InstructionParseError</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-600">
                  class
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                파일 임포트 처리 중 발생한 오류를 래핑하는 에러 클래스입니다.
                <code className="text-cyan-600 text-xs"> BaseError</code>를 상속하며, 에러 코드는{" "}
                <code className="text-red-600 text-xs">INSTRUCTION_PARSE_ERROR</code>입니다.
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
                    desc: "추가 컨텍스트 정보. 기본값 {}",
                  },
                ]}
              />
            </div>

            {/* parseInstructions */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">parseInstructions()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">
                  async
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                인스트럭션 파싱의 편의 래퍼(wrapper) 함수입니다. 내부적으로{" "}
                <code className="text-cyan-600 text-xs">resolveImports()</code>를 호출하여 모든
                @import를 해석합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "content",
                    type: "string",
                    required: true,
                    desc: "파싱할 인스트럭션 원본 텍스트 (@import 포함)",
                  },
                  {
                    name: "baseDir",
                    type: "string",
                    required: true,
                    desc: "상대 경로 해석 기준 디렉토리 (보통 DBCODE.md가 있는 디렉토리)",
                  },
                ]}
              />

              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환 타입: <code className="text-violet-600 text-xs">{"Promise<string>"}</code>
                </h4>
                <p className="text-[13px] text-gray-600">
                  모든 @import가 실제 파일 내용으로 교체된 최종 인스트럭션 텍스트.
                </p>
              </div>
            </div>

            {/* resolveImports */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">resolveImports()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">
                  async
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                @import 지시어를 재귀적으로 해석하여 가져온 파일 내용으로 교체합니다. 순환 참조, .md
                확장자 검증, 최대 깊이 제한을 적용합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "content",
                    type: "string",
                    required: true,
                    desc: "@import가 포함된 원본 내용",
                  },
                  {
                    name: "baseDir",
                    type: "string",
                    required: true,
                    desc: "상대 경로를 해석할 기준 디렉토리",
                  },
                  {
                    name: "depth",
                    type: "number",
                    required: false,
                    desc: "현재 재귀 깊이 (내부용, 기본값 0). MAX_IMPORT_DEPTH(5) 도달 시 해석 중단",
                  },
                  {
                    name: "visited",
                    type: "Set<string>",
                    required: false,
                    desc: "이미 방문한 파일 경로 집합 (순환 참조 방지, 내부용)",
                  },
                ]}
              />

              <Callout type="warn" icon="⚠️">
                <code className="text-cyan-600 text-xs">.md</code> 이외의 파일을 임포트하면
                <code className="text-cyan-600 text-xs">
                  {" <!-- import skipped (not .md): path -->"}
                </code>{" "}
                주석으로 교체됩니다. 보안을 위해 마크다운 파일만 임포트를 허용합니다.
              </Callout>
            </div>

            {/* extractImports */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">extractImports()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                내용에서 @import 경로만 추출합니다(실제 파일 읽기 없이). 표준 형식과 단축 형식 모두
                검색합니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "content",
                    type: "string",
                    required: true,
                    desc: "임포트 지시어가 포함된 원본 텍스트",
                  },
                ]}
              />
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환 타입: <code className="text-violet-600 text-xs">{"readonly string[]"}</code>
                </h4>
                <p className="text-[13px] text-gray-600">발견된 임포트 경로 배열.</p>
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
              기본 사용 (DBCODE.md 파싱)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              DBCODE.md 파일을 읽은 후{" "}
              <code className="text-cyan-600 text-xs">parseInstructions()</code>에 전달하면 모든
              @import가 해석된 최종 텍스트를 받을 수 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">parseInstructions</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./instructions/parser.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">raw</span> <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">readFile</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"./DBCODE.md"'}</span>
              <span className="text-[#c9d1d9]">,</span>{" "}
              <span className="text-[#a5d6ff]">{'"utf-8"'}</span>
              <span className="text-[#c9d1d9]">);</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">resolved</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">parseInstructions</span>
              <span className="text-[#c9d1d9]">(raw,</span>{" "}
              <span className="text-[#a5d6ff]">{'"."'}</span>
              <span className="text-[#c9d1d9]">);</span>
              {"\n\n"}
              <span className="text-[#8b949e]">
                {"// resolved에는 @import가 모두 실제 내용으로 교체됨"}
              </span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              DBCODE.md에서 @import 활용
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              프로젝트 인스트럭션을 주제별로 분리하여 관리할 수 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"# DBCODE.md"}</span>
              {"\n\n"}
              <span className="text-[#c9d1d9]">이 프로젝트는 React + TypeScript 기반입니다.</span>
              {"\n\n"}
              <span className="text-[#79c0ff]">@import</span>{" "}
              <span className="text-[#a5d6ff]">{'"./rules/coding-style.md"'}</span>
              {"\n"}
              <span className="text-[#79c0ff]">@import</span>{" "}
              <span className="text-[#a5d6ff]">{'"./rules/testing.md"'}</span>
              <span className="text-[#8b949e]">{" # 테스트 규칙"}</span>
              {"\n"}
              <span className="text-[#79c0ff]">@./rules/security.md</span>
              <span className="text-[#8b949e]">{""}</span>
              {"\n\n"}
              <span className="text-[#c9d1d9]">위 규칙을 반드시 준수하세요.</span>
            </CodeBlock>

            <DeepDive title="중첩 @import와 순환 참조 처리">
              <p className="mb-3">
                가져온 파일 내부에 또 다른 @import가 있으면 재귀적으로 해석합니다. 최대 5단계까지
                지원하며, 순환 참조가 감지되면 주석으로 교체합니다.
              </p>

              <CodeBlock>
                <span className="text-[#8b949e]">
                  {"// rules/coding-style.md 내부에도 @import 가능"}
                </span>
                {"\n"}
                <span className="text-[#79c0ff]">@import</span>{" "}
                <span className="text-[#a5d6ff]">{'"./naming-conventions.md"'}</span>
                {"\n\n"}
                <span className="text-[#8b949e]">{"// 순환 참조 시 자동 건너뜀"}</span>
                {"\n"}
                <span className="text-[#8b949e]">
                  {"// → <!-- circular import skipped: ./coding-style.md -->"}
                </span>
                {"\n\n"}
                <span className="text-[#8b949e]">{"// .md 아닌 파일 임포트 시"}</span>
                {"\n"}
                <span className="text-[#8b949e]">
                  {"// → <!-- import skipped (not .md): ./config.json -->"}
                </span>
              </CodeBlock>

              <Callout type="warn" icon="⚠️">
                심볼릭 링크(symlink)가 있으면{" "}
                <code className="text-cyan-600 text-xs">realpath()</code>로 실제 경로를 해석하여
                순환 참조를 정확히 감지합니다. 같은 파일을 다른 경로로 참조해도 감지됩니다.
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
              resolveImports 재귀 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">resolveImports()</code>는 각 @import에 대해
              검증 &rarr; 파일 읽기 &rarr; 재귀 해석 &rarr; 내용 교체를 반복합니다.
            </p>

            <MermaidDiagram
              title="resolveImports 재귀 처리"
              titleColor="cyan"
              chart={`flowchart TD
  START["resolveImports(content, baseDir, depth, visited)"]
  DEPTH{"depth >= 5?"}
  DEPTH -->|Yes| STOP["현재 내용 그대로 반환\\n(더 이상 해석 안 함)"]
  DEPTH -->|No| FIND["@import 패턴 매칭\\n표준 + 단축 형식"]
  FIND --> LOOP["각 매칭에 대해 반복"]
  LOOP --> ISMD{".md 파일?"}
  ISMD -->|No| SKIPMD["<!-- import skipped -->"]
  ISMD -->|Yes| RESOLVE["절대 경로 해석\\nrealpath() 정규화"]
  RESOLVE --> CIRCULAR{"visited에\\n이미 있음?"}
  CIRCULAR -->|Yes| SKIPC["<!-- circular import skipped -->"]
  CIRCULAR -->|No| READF["visited.add()\\nreadFile()"]
  READF --> RECURSE["resolveImports(imported,\\nnewBaseDir, depth+1, visited)"]
  RECURSE --> REPLACE["@import 줄 → 내용 교체"]

  style START fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style DEPTH fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style ISMD fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style CIRCULAR fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style RECURSE fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style REPLACE fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px
  style STOP fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style SKIPMD fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style SKIPC fill:#f1f5f9,stroke:#ef4444,color:#1e293b`}
            />

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              정규식 패턴 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              두 가지 정규식으로 @import 경로를 추출합니다.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                        패턴
                      </th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                        정규식
                      </th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                        매칭 예시
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 text-gray-600">표준</td>
                      <td className="p-2.5 text-emerald-600 text-[11px]">
                        {'^@import\\s+"([^"]+)"\\s*(?:#.*)?$'}
                      </td>
                      <td className="p-2.5 text-violet-600">@import "./rules.md" # comment</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-gray-600">단축</td>
                      <td className="p-2.5 text-emerald-600 text-[11px]">
                        {"^@(\\.{1,2}\\/[^\\s]+|\\/[^\\s]+)$"}
                      </td>
                      <td className="p-2.5 text-violet-600">@./rules.md, @../parent.md</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <Callout type="info" icon="📝">
              단축 형식에서 경로가 <code className="text-cyan-600 text-xs">./</code>,{" "}
              <code className="text-cyan-600 text-xs">../</code>,
              <code className="text-cyan-600 text-xs"> /</code>로 시작해야 하는 이유는
              <code className="text-cyan-600 text-xs"> @mention</code>(사람 언급)과 구분하기
              위해서입니다.
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
                  <span className="text-red-600">Q.</span> @import한 파일 내용이 적용되지 않아요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 1:</strong> 파일이 존재하지 않습니다.
                    상대 경로가 DBCODE.md 기준인지 확인하세요. 결과에{" "}
                    <code className="text-cyan-600 text-xs">{"<!-- import not found -->"}</code>{" "}
                    주석이 있으면 파일을 찾지 못한 것입니다.
                  </p>
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 2:</strong> 파일 확장자가{" "}
                    <code className="text-cyan-600 text-xs">.md</code>가 아닙니다. 보안 정책에 의해
                    마크다운 파일만 임포트할 수 있습니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인 3:</strong> 중첩 깊이가 5단계를
                    초과했습니다. 파일 구조를 단순화하세요.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 순환 참조 경고가 나타나요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    A.md가 B.md를 임포트하고, B.md가 다시 A.md를 임포트하는 경우입니다. 파서는{" "}
                    <code className="text-cyan-600 text-xs">
                      {"<!-- circular import skipped -->"}
                    </code>{" "}
                    주석을 삽입하고 에러 없이 계속 진행합니다. 파일 구조를 검토하여 순환 의존을
                    제거하세요.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> @import 단축 형식이 인식되지 않아요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    단축 형식은 <code className="text-cyan-600 text-xs">@./</code>,{" "}
                    <code className="text-cyan-600 text-xs">@../</code>,
                    <code className="text-cyan-600 text-xs"> @/</code>로 시작해야 합니다.
                    <code className="text-cyan-600 text-xs"> @rules.md</code>처럼 경로 접두사 없이
                    쓰면 인식되지 않습니다. 표준 형식{" "}
                    <code className="text-cyan-600 text-xs">@import "rules.md"</code>를 사용하세요.
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
                  name: "instructions/path-matcher.ts",
                  slug: "instruction-path-matcher",
                  relation: "sibling",
                  desc: "경로 조건부 규칙 매칭 — 작업 경로에 따라 적용할 규칙 결정",
                },
                {
                  name: "instructions/loader.ts",
                  slug: "instruction-loader",
                  relation: "parent",
                  desc: "6단계 DBCODE.md 로딩 체인 — parser를 내부적으로 사용",
                },
                {
                  name: "config/loader.ts",
                  slug: "config-loader",
                  relation: "sibling",
                  desc: "5단계 계층 설정 로더 — 같은 Leaf Layer의 설정 모듈",
                },
                {
                  name: "core/prompt-builder.ts",
                  slug: "system-prompt-builder",
                  relation: "parent",
                  desc: "파싱된 인스트럭션을 시스템 프롬프트에 주입하는 빌더",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
