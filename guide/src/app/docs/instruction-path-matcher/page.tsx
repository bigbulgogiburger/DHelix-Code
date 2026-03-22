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

export default function InstructionPathMatcherPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilePath path="src/instructions/path-matcher.ts" />
              <LayerBadge layer="leaf" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
              <span className="text-gray-900">Instruction Path Matcher</span>
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[640px]">
              경로 조건부 규칙 매칭 모듈 &mdash; 작업 디렉토리/파일 경로에 따라 적용할 규칙을
              결정합니다. <span className="text-cyan-600 font-semibold">glob 패턴</span>을
              <span className="text-violet-600 font-semibold"> 정규식</span>으로 변환하여 경로를
              매칭합니다.
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
              <code className="text-cyan-600 text-xs">.dbcode/rules/</code> 디렉토리의 규칙 파일에
              프론트매터로 <strong className="text-gray-900">경로 패턴</strong>을 지정하면, 해당
              경로에서 작업할 때만 해당 규칙이 시스템 프롬프트에 포함됩니다. 예를 들어,{" "}
              <code className="text-cyan-600 text-xs">src/components/**</code> 패턴을 지정하면 React
              컴포넌트 작업 시에만 프론트엔드 규칙이 적용됩니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>핵심 원칙:</strong> 규칙의 patterns 배열은 <strong>OR 조건</strong>입니다.
              하나라도 일치하면 해당 규칙이 적용됩니다. Windows 경로(백슬래시)도 자동으로
              정규화합니다.
            </Callout>

            <MermaidDiagram
              title="경로 기반 규칙 매칭 흐름"
              titleColor="orange"
              chart={`flowchart LR
  RULES["📋 PathRule[]\\npatterns + content"]
  PATH["📂 현재 경로\\nsrc/components/Button.tsx"]
  GLOB["🔄 glob → RegExp\\nglobToRegex()"]
  MATCH["✅ 매칭 테스트\\nregex.test(path)"]
  FILTER["🎯 매칭된 규칙만\\nfilterMatchingRules()"]
  COLLECT["📝 내용 수집\\ncollectMatchingContent()"]

  RULES --> GLOB
  PATH --> MATCH
  GLOB --> MATCH --> FILTER --> COLLECT

  style RULES fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style PATH fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style GLOB fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style MATCH fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style FILTER fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style COLLECT fill:#f8fafc,stroke:#06b6d4,color:#06b6d4,stroke-width:2px`}
            />

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
              <h4 className="text-[14px] font-bold mb-3">지원하는 glob 패턴</h4>
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-16">
                    <code className="text-xs">*</code>
                  </span>
                  <span>
                    슬래시(/)를 제외한 모든 문자 &mdash; 한 디렉토리 레벨만 매칭 (예:{" "}
                    <code className="text-cyan-600 text-xs">src/*.ts</code>)
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-violet-600 font-bold shrink-0 w-16">
                    <code className="text-xs">**</code>
                  </span>
                  <span>
                    슬래시 포함 모든 문자 &mdash; 여러 디렉토리 횡단 (예:{" "}
                    <code className="text-cyan-600 text-xs">src/**/*.tsx</code>)
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-600 font-bold shrink-0 w-16">
                    <code className="text-xs">?</code>
                  </span>
                  <span>
                    슬래시를 제외한 단일 문자 (예:{" "}
                    <code className="text-cyan-600 text-xs">src/?.ts</code> &rarr;{" "}
                    <code className="text-cyan-600 text-xs">a.ts</code>)
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-emerald-600 font-bold shrink-0 w-16">
                    <code className="text-xs">.</code>
                  </span>
                  <span>
                    리터럴 점 (자동으로 <code className="text-cyan-600 text-xs">\.</code>로
                    이스케이프)
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

            {/* PathRule 인터페이스 */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">PathRule</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                  interface
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                경로 기반 규칙 조건 인터페이스입니다. patterns 배열 중 하나라도 일치하면 이 규칙이
                적용됩니다 (OR 조건).
              </p>

              <ParamTable
                params={[
                  {
                    name: "patterns",
                    type: "readonly string[]",
                    required: true,
                    desc: "경로 매칭에 사용할 glob 패턴 배열 (하나라도 매칭되면 적용)",
                  },
                  {
                    name: "content",
                    type: "string",
                    required: true,
                    desc: "패턴이 매칭될 때 시스템 프롬프트에 포함할 규칙 내용",
                  },
                  {
                    name: "description",
                    type: "string",
                    required: false,
                    desc: "규칙에 대한 선택적 설명 (디버깅/로깅용)",
                  },
                ]}
              />
            </div>

            {/* LegacyPathRule 인터페이스 */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">LegacyPathRule</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                  interface
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-600">
                  deprecated
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                단일 <code className="text-cyan-600 text-xs">pattern</code> 필드를 사용하는 이전
                버전 인터페이스입니다.
                <code className="text-cyan-600 text-xs"> normalizeLegacyRule()</code>로 새 형식으로
                변환할 수 있습니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "pattern",
                    type: "string",
                    required: true,
                    desc: "단일 glob 패턴 (새 형식에서는 patterns 배열 사용)",
                  },
                  {
                    name: "content",
                    type: "string",
                    required: true,
                    desc: "패턴 매칭 시 포함할 내용",
                  },
                  {
                    name: "description",
                    type: "string",
                    required: false,
                    desc: "규칙 설명",
                  },
                ]}
              />
            </div>

            {/* normalizeLegacyRule */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">normalizeLegacyRule()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                이전 형식(단일 패턴)의 규칙을 새 형식(패턴 배열)으로 변환합니다. 단일 pattern 값을
                patterns 배열에 넣어 PathRule로 반환합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "rule",
                    type: "LegacyPathRule",
                    required: true,
                    desc: "변환할 이전 형식 규칙",
                  },
                ]}
              />
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환 타입: <code className="text-violet-600 text-xs">PathRule</code>
                </h4>
              </div>
            </div>

            {/* matchPath */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">matchPath()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                경로가 단일 glob 패턴과 일치하는지 확인합니다. 내부적으로{" "}
                <code className="text-cyan-600 text-xs">globToRegex()</code>로 패턴을 정규식으로
                변환합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "path",
                    type: "string",
                    required: true,
                    desc: "확인할 파일/디렉토리 경로 (백슬래시는 자동 정규화)",
                  },
                  {
                    name: "pattern",
                    type: "string",
                    required: true,
                    desc: "매칭할 glob 패턴 문자열",
                  },
                ]}
              />
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환 타입: <code className="text-violet-600 text-xs">boolean</code>
                </h4>
              </div>
            </div>

            {/* matchAnyPattern */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">matchAnyPattern()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                경로가 패턴 배열 중 하나라도 일치하는지 확인합니다 (OR 조건).
                <code className="text-cyan-600 text-xs"> Array.some()</code>을 사용하여 첫 매칭에서
                즉시 반환합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "path",
                    type: "string",
                    required: true,
                    desc: "확인할 경로",
                  },
                  {
                    name: "patterns",
                    type: "readonly string[]",
                    required: true,
                    desc: "매칭할 glob 패턴 배열",
                  },
                ]}
              />
            </div>

            {/* filterMatchingRules */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">filterMatchingRules()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                주어진 경로에 매칭되는 규칙만 필터링합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "rules",
                    type: "readonly PathRule[]",
                    required: true,
                    desc: "필터링할 규칙 배열",
                  },
                  {
                    name: "currentPath",
                    type: "string",
                    required: true,
                    desc: "현재 작업 경로",
                  },
                ]}
              />
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환 타입:{" "}
                  <code className="text-violet-600 text-xs">{"readonly PathRule[]"}</code>
                </h4>
              </div>
            </div>

            {/* collectMatchingContent */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">collectMatchingContent()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                매칭된 규칙의 content를 모두 수집하여 하나의 문자열로 합칩니다. 여러 규칙이 매칭되면
                빈 줄(<code className="text-cyan-600 text-xs">\n\n</code>)로 구분합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "rules",
                    type: "readonly PathRule[]",
                    required: true,
                    desc: "검색할 규칙 배열",
                  },
                  {
                    name: "currentPath",
                    type: "string",
                    required: true,
                    desc: "현재 작업 경로",
                  },
                ]}
              />
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환 타입: <code className="text-violet-600 text-xs">string</code>
                </h4>
                <p className="text-[13px] text-gray-600">
                  매칭된 규칙 내용을 합친 문자열 (매칭 없으면 빈 문자열).
                </p>
              </div>

              <Callout type="warn" icon="⚠️">
                매칭 결과가 없으면 빈 문자열을 반환합니다. 시스템 프롬프트 빌더에서 빈 문자열은 해당
                섹션을 생략하는 데 사용됩니다.
              </Callout>
            </div>

            {/* globToRegex (내부 함수) */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">globToRegex()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-50 text-gray-400">
                  internal
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                glob 패턴을 정규식(RegExp)으로 변환합니다.{" "}
                <code className="text-cyan-600 text-xs">^</code>와
                <code className="text-cyan-600 text-xs"> $</code>로 감싸 전체 문자열 매칭하며,
                대소문자를 무시합니다(<code className="text-cyan-600 text-xs">i</code> 플래그).
              </p>
              <ParamTable
                params={[
                  {
                    name: "pattern",
                    type: "string",
                    required: true,
                    desc: "변환할 glob 패턴 문자열",
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
              규칙 파일 작성 예시
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">.dbcode/rules/</code> 디렉토리에 프론트매터로
              경로 패턴을 지정한 규칙 파일을 만들면, 해당 경로에서 작업할 때만 규칙이 적용됩니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"# .dbcode/rules/frontend.md"}</span>
              {"\n"}
              <span className="text-[#8b949e]">{"---"}</span>
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
              <span className="text-[#8b949e]">{"---"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">React 컴포넌트는 함수형으로 작성하세요.</span>
              {"\n"}
              <span className="text-[#c9d1d9]">Props 인터페이스를 항상 정의하세요.</span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              코드에서 규칙 매칭
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">collectMatchingContent()</code>로 현재 작업
              경로에 해당하는 모든 규칙을 한 번에 수집할 수 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">collectMatchingContent</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./instructions/path-matcher.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">extra</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#d2a8ff]">collectMatchingContent</span>
              <span className="text-[#c9d1d9]">(rules,</span>{" "}
              <span className="text-[#a5d6ff]">{'"src/components/Button.tsx"'}</span>
              <span className="text-[#c9d1d9]">);</span>
              {"\n\n"}
              <span className="text-[#8b949e]">
                {'// extra === "React 컴포넌트는 함수형으로..."'}
              </span>
              {"\n"}
              <span className="text-[#8b949e]">{"// 매칭되는 규칙이 없으면 빈 문자열"}</span>
            </CodeBlock>

            <DeepDive title="레거시 형식(단일 패턴) 변환">
              <p className="mb-3">
                이전 버전에서는 단일 <code className="text-cyan-600 text-xs">pattern</code> 필드를
                사용했습니다.
                <code className="text-cyan-600 text-xs"> normalizeLegacyRule()</code>로 새 형식으로
                변환할 수 있습니다.
              </p>

              <CodeBlock>
                <span className="text-[#ff7b72]">import</span>{" "}
                <span className="text-[#c9d1d9]">{"{ "}</span>
                <span className="text-[#79c0ff]">normalizeLegacyRule</span>
                <span className="text-[#c9d1d9]">{" }"}</span>{" "}
                <span className="text-[#ff7b72]">from</span>{" "}
                <span className="text-[#a5d6ff]">{'"./instructions/path-matcher.js"'}</span>
                <span className="text-[#c9d1d9]">;</span>
                {"\n\n"}
                <span className="text-[#8b949e]">{"// 이전 형식"}</span>
                {"\n"}
                <span className="text-[#ff7b72]">const</span>{" "}
                <span className="text-[#79c0ff]">legacy</span>{" "}
                <span className="text-[#c9d1d9]">= {"{ "}</span>
                <span className="text-[#79c0ff]">pattern</span>
                <span className="text-[#c9d1d9]">{": "}</span>
                <span className="text-[#a5d6ff]">{'"src/**"'}</span>
                <span className="text-[#c9d1d9]">{", "}</span>
                <span className="text-[#79c0ff]">content</span>
                <span className="text-[#c9d1d9]">{": "}</span>
                <span className="text-[#a5d6ff]">{'"규칙..."'}</span>
                <span className="text-[#c9d1d9]">{" };"}</span>
                {"\n\n"}
                <span className="text-[#8b949e]">{"// 새 형식으로 변환"}</span>
                {"\n"}
                <span className="text-[#ff7b72]">const</span>{" "}
                <span className="text-[#79c0ff]">rule</span>{" "}
                <span className="text-[#c9d1d9]">=</span>{" "}
                <span className="text-[#d2a8ff]">normalizeLegacyRule</span>
                <span className="text-[#c9d1d9]">(legacy);</span>
                {"\n"}
                <span className="text-[#8b949e]">{'// rule.patterns === ["src/**"]'}</span>
              </CodeBlock>

              <Callout type="warn" icon="⚠️">
                <code className="text-cyan-600 text-xs">LegacyPathRule</code> 인터페이스는{" "}
                <code className="text-red-600 text-xs">@deprecated</code>입니다. 새 코드에서는{" "}
                <code className="text-cyan-600 text-xs">PathRule</code>의{" "}
                <code className="text-cyan-600 text-xs">patterns</code> 배열을 사용하세요.
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
              globToRegex 변환 규칙
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              glob 패턴의 각 문자를 정규식 토큰으로 변환합니다. 백슬래시는 슬래시로 먼저 정규화하여
              Windows 경로를 지원합니다.
            </p>

            <MermaidDiagram
              title="glob → RegExp 변환"
              titleColor="cyan"
              chart={`flowchart TD
  INPUT["glob 패턴 입력\\nsrc/**/*.tsx"]
  NORM["경로 정규화\\n백슬래시 → 슬래시"]
  SCAN["문자별 스캔"]
  STAR2{"** ?"}
  STAR2 -->|Yes| DOT_STAR[".* 추가\\n(전체 매칭)"]
  STAR2 -->|No| STAR1{"* ?"}
  STAR1 -->|Yes| NOT_SLASH["[^/]* 추가\\n(디렉토리 내)"]
  STAR1 -->|No| QMARK{"? ?"}
  QMARK -->|Yes| SINGLE["[^/] 추가\\n(단일 문자)"]
  QMARK -->|No| DOT_Q{". ?"}
  DOT_Q -->|Yes| ESCAPE["\\\\. 추가\\n(이스케이프)"]
  DOT_Q -->|No| LITERAL["문자 그대로 추가"]
  WRAP["^...$ + i 플래그"]

  INPUT --> NORM --> SCAN
  SCAN --> STAR2
  DOT_STAR --> WRAP
  NOT_SLASH --> WRAP
  SINGLE --> WRAP
  ESCAPE --> WRAP
  LITERAL --> WRAP

  style INPUT fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style SCAN fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style STAR2 fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style STAR1 fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style QMARK fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style DOT_Q fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style WRAP fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px`}
            />

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              변환 예시
            </h3>

            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                        glob 패턴
                      </th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                        변환된 정규식
                      </th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                        매칭 예시
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 text-gray-600">src/*.ts</td>
                      <td className="p-2.5 text-emerald-600">{"^src/[^/]*\\.ts$"}</td>
                      <td className="p-2.5 text-violet-600">src/index.ts</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 text-gray-600">src/**/*.tsx</td>
                      <td className="p-2.5 text-emerald-600">{"^src/.*[^/]*\\.tsx$"}</td>
                      <td className="p-2.5 text-violet-600">src/pages/home/index.tsx</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5 text-gray-600">test/?.spec.ts</td>
                      <td className="p-2.5 text-emerald-600">{"^test/[^/]\\.spec\\.ts$"}</td>
                      <td className="p-2.5 text-violet-600">test/a.spec.ts</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-gray-600">**</td>
                      <td className="p-2.5 text-emerald-600">{"^.*$"}</td>
                      <td className="p-2.5 text-violet-600">모든 경로</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <Callout type="info" icon="📝">
              <strong>대소문자 무시:</strong> 정규식에{" "}
              <code className="text-cyan-600 text-xs">i</code> 플래그가 설정되어 있어
              <code className="text-cyan-600 text-xs"> src/Button.TSX</code>와{" "}
              <code className="text-cyan-600 text-xs">src/button.tsx</code> 모두 매칭됩니다.
              macOS/Windows의 대소문자 비구분 파일시스템을 지원하기 위한 설계입니다.
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
                  <span className="text-red-600">Q.</span> 규칙이 특정 경로에서 적용되지 않아요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 1:</strong> glob 패턴이 전체 경로에
                    매칭되어야 합니다.
                    <code className="text-cyan-600 text-xs"> ^</code>와{" "}
                    <code className="text-cyan-600 text-xs">$</code>로 감싸져 있으므로 부분 매칭이
                    아닌 전체 매칭입니다. <code className="text-cyan-600 text-xs">*.ts</code>는
                    <code className="text-cyan-600 text-xs"> src/index.ts</code>에 매칭되지
                    않습니다.
                    <code className="text-cyan-600 text-xs"> **/*.ts</code>를 사용하세요.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인 2:</strong> Windows 경로를 사용하는 경우.
                    <code className="text-cyan-600 text-xs"> globToRegex()</code>가 백슬래시를
                    자동으로 슬래시로 정규화하지만, 입력 경로도 동일하게 정규화되는지 확인하세요.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 여러 규칙이 동시에 적용되는데 하나만
                  원해요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <code className="text-cyan-600 text-xs">filterMatchingRules()</code>는 매칭되는{" "}
                    <strong>모든</strong> 규칙을 반환합니다. 우선순위나 배타적 매칭이 필요하다면
                    패턴을 더 구체적으로 작성하세요. 현재는 우선순위 시스템이 없으며, 모든 매칭
                    규칙이 시스템 프롬프트에 포함됩니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> **/ 뒤의 경로가 매칭되지 않아요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <code className="text-cyan-600 text-xs">**/</code>는{" "}
                    <code className="text-cyan-600 text-xs">.*</code>로 변환되고 후행 슬래시는
                    건너뜁니다. <code className="text-cyan-600 text-xs">src/**/test.ts</code>는
                    <code className="text-cyan-600 text-xs"> src/a/b/test.ts</code>에 매칭됩니다.
                    패턴 끝에 <code className="text-cyan-600 text-xs">**</code>만 쓰면 모든 하위
                    경로에 매칭됩니다.
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
                  name: "instructions/parser.ts",
                  slug: "instruction-parser",
                  relation: "sibling",
                  desc: "DBCODE.md @import 파싱 — 같은 instructions 모듈",
                },
                {
                  name: "instructions/loader.ts",
                  slug: "instruction-loader",
                  relation: "parent",
                  desc: "6단계 DBCODE.md 로딩 체인 — path-matcher를 내부적으로 사용",
                },
                {
                  name: "core/prompt-builder.ts",
                  slug: "system-prompt-builder",
                  relation: "parent",
                  desc: "매칭된 규칙을 시스템 프롬프트에 주입하는 빌더",
                },
                {
                  name: "tools/path-filter.ts",
                  slug: "path-filter",
                  relation: "sibling",
                  desc: "도구 실행 시 경로 필터링 — 유사한 glob 매칭 로직 사용",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
