"use client";

import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { FilePath } from "@/components/FilePath";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { DeepDive } from "@/components/DeepDive";
import { ParamTable } from "@/components/ParamTable";
import { LayerBadge } from "@/components/LayerBadge";
import { SeeAlso } from "@/components/SeeAlso";

export default function PermissionWildcardPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/permissions/wildcard.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Permission Wildcard
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            경로 안전한 와일드카드 매칭과 도구별 인수 매핑을 제공하는 유틸리티 모듈입니다.
          </p>
        </div>
      </RevealOnScroll>

      {/* ─── 1. 개요 (Overview) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📋</span> 개요
          </h2>
          <div className="text-[14px] text-gray-600 leading-[1.85] mb-8 space-y-3">
            <p>
              <code className="text-cyan-600">wildcard.ts</code>는 파일 시스템의 glob 패턴과 유사한
              와일드카드 매칭 기능을 제공합니다.
              <code className="text-cyan-600">pattern-parser.ts</code>의 <code className="text-cyan-600">globToRegex</code>와 달리,
              경로 구분자(<code>/</code>)를 인식하여 디렉토리 레벨을 구분합니다.
            </p>
            <p>
              세 가지 와일드카드를 지원합니다:
              <code className="text-cyan-600">*</code>(한 레벨 내 임의 문자열),
              <code className="text-cyan-600">**</code>(여러 레벨 횡단),
              <code className="text-cyan-600">?</code>(한 문자).
              Windows에서는 대소문자를 무시합니다.
            </p>
            <p>
              또한 규칙 문자열의 파싱/포맷팅(<code className="text-cyan-600">parseRuleString</code>,
              <code className="text-cyan-600">formatRuleString</code>)과
              도구별 인수 키 매핑(<code className="text-cyan-600">matchToolArgs</code>)을 제공합니다.
              도구마다 어떤 인수를 패턴과 비교할지 미리 정의되어 있어, 정확한 매칭이 가능합니다.
            </p>
          </div>

          <MermaidDiagram
            title="Wildcard 모듈 구조"
            titleColor="purple"
            chart={`graph TD
  MW["matchWildcard<br/><small>경로 안전 매칭</small>"]
  PRS["parseRuleString<br/><small>규칙 문자열 파싱</small>"]
  FRS["formatRuleString<br/><small>규칙 문자열 생성</small>"]
  MTA["matchToolArgs<br/><small>도구별 인수 매칭</small>"]
  TAK["TOOL_ARG_KEYS<br/><small>도구-인수 매핑 테이블</small>"]

  MTA --> MW
  MTA --> TAK
  PRS -.->|"역변환"| FRS

  PM["Permission Manager<br/><small>permission-manager.ts</small>"]
  PM --> MTA
  PM --> PRS

  style MW fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style MTA fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PRS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style FRS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TAK fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style PM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 파일 탐색기에서 <code>*.txt</code>로 검색하면 현재 폴더의 텍스트 파일만
            찾지만, <code>**/*.txt</code>로 검색하면 하위 폴더까지 모두 찾는 것과 같습니다.
            <code>*</code>는 &quot;이 층에서만&quot;, <code>**</code>는 &quot;모든 층에서&quot; 찾습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* matchWildcard */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function matchWildcard
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            값이 와일드카드 패턴과 매칭되는지 검사합니다.
            경로 구분자를 인식하여 디렉토리 레벨을 정확히 구분합니다.
          </p>
          <CodeBlock>
            <span className="fn">matchWildcard</span>(<span className="prop">value</span>: <span className="type">string</span>, <span className="prop">pattern</span>: <span className="type">string</span>): <span className="type">boolean</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "value", type: "string", required: true, desc: '검사할 문자열 (예: "src/utils/path.ts")' },
              { name: "pattern", type: "string", required: true, desc: '와일드카드 패턴 (예: "src/**", "npm *")' },
            ]}
          />
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <code className="text-cyan-600">*</code> &mdash; 경로 구분자를 제외한 임의의 문자열 (한 디렉토리 레벨 내)</p>
            <p>&bull; <code className="text-cyan-600">**</code> &mdash; 경로 구분자를 포함한 모든 문자열 (여러 레벨 횡단)</p>
            <p>&bull; <code className="text-cyan-600">?</code> &mdash; 경로 구분자를 제외한 한 문자</p>
            <p>&bull; Windows에서는 대소문자를 무시 (<code className="text-cyan-600">i</code> 플래그)</p>
          </div>

          {/* parseRuleString */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function parseRuleString
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            규칙 문자열을 파싱하여 도구 이름과 패턴을 분리합니다.
            반환값은 <code className="text-cyan-600">Object.freeze()</code>로 불변 처리됩니다.
          </p>
          <CodeBlock>
            <span className="fn">parseRuleString</span>(<span className="prop">rule</span>: <span className="type">string</span>): {"{"} <span className="kw">readonly</span> <span className="prop">tool</span>: <span className="type">string</span>; <span className="kw">readonly</span> <span className="prop">pattern</span>: <span className="type">string | undefined</span> {"}"}
          </CodeBlock>
          <ParamTable
            params={[
              { name: "rule", type: "string", required: true, desc: '파싱할 규칙 문자열 (예: "Bash(npm *)", "file_read")' },
            ]}
          />
          <div className="text-[13px] text-gray-600 mt-3 space-y-1">
            <p>&bull; <code className="text-cyan-600">&quot;Bash(npm *)&quot;</code> &rarr; <code>{"{"} tool: &quot;Bash&quot;, pattern: &quot;npm *&quot; {"}"}</code></p>
            <p>&bull; <code className="text-cyan-600">&quot;file_read&quot;</code> &rarr; <code>{"{"} tool: &quot;file_read&quot;, pattern: undefined {"}"}</code></p>
          </div>

          {/* formatRuleString */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function formatRuleString
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            도구 이름과 패턴을 규칙 문자열로 포맷팅합니다.
            <code className="text-cyan-600">parseRuleString</code>의 역변환입니다.
          </p>
          <CodeBlock>
            <span className="fn">formatRuleString</span>(<span className="prop">tool</span>: <span className="type">string</span>, <span className="prop">pattern</span>?: <span className="type">string</span>): <span className="type">string</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "tool", type: "string", required: true, desc: "도구 이름" },
              { name: "pattern", type: "string", required: false, desc: "인수 패턴 (선택적, 없으면 도구 이름만 반환)" },
            ]}
          />

          {/* TOOL_ARG_KEYS */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            const TOOL_ARG_KEYS
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            도구별 패턴 매칭에 사용할 인수 필드를 지정하는 매핑 테이블입니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-gray-600 border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-3 py-2 text-left font-bold text-gray-900">도구 이름</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-bold text-gray-900">인수 키</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-bold text-gray-900">설명</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-3 py-2 font-mono">Bash / bash_exec</td>
                  <td className="border border-gray-200 px-3 py-2 font-mono text-cyan-600">command</td>
                  <td className="border border-gray-200 px-3 py-2">실행할 쉘 명령어</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="border border-gray-200 px-3 py-2 font-mono">Edit / file_edit</td>
                  <td className="border border-gray-200 px-3 py-2 font-mono text-cyan-600">file_path</td>
                  <td className="border border-gray-200 px-3 py-2">편집할 파일 경로</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2 font-mono">Write / file_write</td>
                  <td className="border border-gray-200 px-3 py-2 font-mono text-cyan-600">file_path</td>
                  <td className="border border-gray-200 px-3 py-2">쓸 파일 경로</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="border border-gray-200 px-3 py-2 font-mono">Read / file_read</td>
                  <td className="border border-gray-200 px-3 py-2 font-mono text-cyan-600">file_path</td>
                  <td className="border border-gray-200 px-3 py-2">읽을 파일 경로</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2 font-mono">glob_search / grep_search</td>
                  <td className="border border-gray-200 px-3 py-2 font-mono text-cyan-600">pattern</td>
                  <td className="border border-gray-200 px-3 py-2">검색 패턴</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* matchToolArgs */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function matchToolArgs
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            도구 호출의 인수가 와일드카드 패턴과 매칭되는지 검사합니다.
            <code className="text-cyan-600">TOOL_ARG_KEYS</code>를 참조하여 어떤 인수를 비교할지 결정합니다.
          </p>
          <CodeBlock>
            <span className="fn">matchToolArgs</span>(
            {"\n"}{"  "}<span className="prop">tool</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">pattern</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">args</span>?: <span className="type">Record&lt;string, unknown&gt;</span>,
            {"\n"}): <span className="type">boolean</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "tool", type: "string", required: true, desc: '도구 이름 (예: "Bash", "Edit")' },
              { name: "pattern", type: "string", required: true, desc: '와일드카드 패턴 (예: "npm *", "/src/**")' },
              { name: "args", type: "Record<string, unknown>", required: false, desc: "도구에 전달된 인수 객체 (없으면 false 반환)" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">matchWildcard</code>의 <code className="text-cyan-600">*</code>는
              경로 구분자(<code>/</code>, <code>\</code>)를 <strong>넘지 않습니다</strong>.
              <code>&quot;src/*&quot;</code>는 <code>&quot;src/app.ts&quot;</code>에 매칭되지만
              <code>&quot;src/utils/app.ts&quot;</code>에는 매칭되지 않습니다.
            </li>
            <li>
              <code className="text-cyan-600">TOOL_ARG_KEYS</code>에 없는 도구는 <strong>모든 문자열 인수</strong>에
              대해 매칭을 시도합니다. 예기치 않은 인수가 매칭될 수 있습니다.
            </li>
            <li>
              Windows에서는 대소문자를 무시합니다 (<code className="text-cyan-600">isWindows()</code> 체크).
              macOS와 Linux에서는 대소문자를 구분합니다.
            </li>
            <li>
              <code className="text-cyan-600">parseRuleString</code>은 <code className="text-cyan-600">pattern-parser.ts</code>의
              <code className="text-cyan-600">parsePermissionPattern</code>과 유사하지만,
              에러를 throw하지 않고 항상 결과를 반환합니다.
            </li>
          </ul>
        </section>
      </RevealOnScroll>

      {/* ─── 3. 사용법 (Usage) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🚀</span> 사용법
          </h2>

          {/* 기본 사용법: matchWildcard */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 와일드카드 매칭</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            파일 경로나 명령어를 와일드카드 패턴과 비교하는 기본 사용법입니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="fn">matchWildcard</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./permissions/wildcard.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// * 는 경로 구분자를 넘지 않음"}</span>
            {"\n"}<span className="fn">matchWildcard</span>(<span className="str">&quot;src/app.ts&quot;</span>, <span className="str">&quot;src/*&quot;</span>);{"          "}<span className="cm">{"// true"}</span>
            {"\n"}<span className="fn">matchWildcard</span>(<span className="str">&quot;src/utils/path.ts&quot;</span>, <span className="str">&quot;src/*&quot;</span>);{"  "}<span className="cm">{"// false (/ 를 넘지 않음)"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// ** 는 경로 구분자를 포함하여 매칭"}</span>
            {"\n"}<span className="fn">matchWildcard</span>(<span className="str">&quot;src/utils/path.ts&quot;</span>, <span className="str">&quot;src/**&quot;</span>);{"  "}<span className="cm">{"// true"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// ? 는 경로 구분자를 제외한 한 문자"}</span>
            {"\n"}<span className="fn">matchWildcard</span>(<span className="str">&quot;npm install&quot;</span>, <span className="str">&quot;npm ?nstall&quot;</span>);{"       "}<span className="cm">{"// true"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 명령어 패턴에서는 * 가 공백 포함 매칭"}</span>
            {"\n"}<span className="fn">matchWildcard</span>(<span className="str">&quot;npm install express&quot;</span>, <span className="str">&quot;npm *&quot;</span>);{"  "}<span className="cm">{"// true (공백은 경로 구분자 아님)"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>*</code>와 <code>**</code>의 차이를 잘 구분하세요.
            파일 경로 패턴에서 <code>src/*</code>는 직접 하위 파일만,
            <code>src/**</code>는 모든 하위 경로를 매칭합니다.
          </Callout>

          {/* 기본 사용법: matchToolArgs */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 도구별 인수 매칭</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">matchToolArgs</code>는 도구 이름에 따라 어떤 인수를
            패턴과 비교할지 자동으로 결정합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="fn">matchToolArgs</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./permissions/wildcard.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// Bash → command 인수와 비교"}</span>
            {"\n"}<span className="fn">matchToolArgs</span>(<span className="str">&quot;Bash&quot;</span>, <span className="str">&quot;npm *&quot;</span>, {"{"} <span className="prop">command</span>: <span className="str">&quot;npm install&quot;</span> {"}"});
            {"\n"}<span className="cm">{"// → true (TOOL_ARG_KEYS[\"Bash\"] = \"command\")"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// Edit → file_path 인수와 비교"}</span>
            {"\n"}<span className="fn">matchToolArgs</span>(<span className="str">&quot;Edit&quot;</span>, <span className="str">&quot;/src/**&quot;</span>, {"{"} <span className="prop">file_path</span>: <span className="str">&quot;/src/app.ts&quot;</span> {"}"});
            {"\n"}<span className="cm">{"// → true (TOOL_ARG_KEYS[\"Edit\"] = \"file_path\")"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 매핑에 없는 도구 → 모든 문자열 인수 시도"}</span>
            {"\n"}<span className="fn">matchToolArgs</span>(<span className="str">&quot;custom_tool&quot;</span>, <span className="str">&quot;hello *&quot;</span>, {"{"} <span className="prop">msg</span>: <span className="str">&quot;hello world&quot;</span> {"}"});
            {"\n"}<span className="cm">{"// → true (폴백: 모든 문자열 인수에 대해 시도)"}</span>
          </CodeBlock>

          {/* 고급 사용법: 규칙 문자열 파싱/포맷팅 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 규칙 문자열 파싱과 포맷팅
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">parseRuleString</code>과 <code className="text-cyan-600">formatRuleString</code>은
            서로 역변환 관계입니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="fn">parseRuleString</span>, <span className="fn">formatRuleString</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./permissions/wildcard.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 파싱"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">parsed</span> = <span className="fn">parseRuleString</span>(<span className="str">&quot;Bash(npm *)&quot;</span>);
            {"\n"}<span className="cm">{"// parsed = { tool: \"Bash\", pattern: \"npm *\" }"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 포맷팅 (역변환)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">formatted</span> = <span className="fn">formatRuleString</span>(<span className="prop">parsed</span>.<span className="prop">tool</span>, <span className="prop">parsed</span>.<span className="prop">pattern</span>);
            {"\n"}<span className="cm">{"// formatted = \"Bash(npm *)\""}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 패턴 없는 경우"}</span>
            {"\n"}<span className="fn">formatRuleString</span>(<span className="str">&quot;file_read&quot;</span>);{"  "}<span className="cm">{"// → \"file_read\""}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>parseRuleString</code>은 에러를 throw하지 않습니다.
            잘못된 형식이어도 도구 이름만 추출하여 반환합니다. 엄격한 검증이 필요하면
            <code>pattern-parser.ts</code>의 <code>parsePermissionPattern</code>을 사용하세요.
          </Callout>

          <DeepDive title="matchWildcard의 ** 처리 과정">
            <p className="mb-3">
              <code className="text-cyan-600">**</code>와 <code className="text-cyan-600">*</code>를
              구분하기 위해 임시 토큰 치환 기법을 사용합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 입력 패턴: \"src/**/*.ts\""}</span>
              {"\n"}<span className="cm">{"// 1단계: 특수문자 이스케이프 → \"src/**/*\\.ts\""}</span>
              {"\n"}<span className="cm">{"// 2단계: ** → 임시 토큰  → \"src/\\0DOUBLESTAR\\0/*\\.ts\""}</span>
              {"\n"}<span className="cm">{"// 3단계: * → [^/\\\\]*    → \"src/\\0DOUBLESTAR\\0/[^/\\\\]*\\.ts\""}</span>
              {"\n"}<span className="cm">{"// 4단계: 토큰 → .*       → \"src/.*/[^/\\\\]*\\.ts\""}</span>
              {"\n"}<span className="cm">{"// 5단계: ? → [^/\\\\]     → (변화 없음)"}</span>
              {"\n"}<span className="cm">{"// 최종: /^src\\/.*\\/[^/\\\\]*\\.ts$/"}</span>
            </CodeBlock>
            <p className="mt-3 text-amber-600">
              임시 토큰(<code>\0DOUBLESTAR\0</code>)은 null 문자를 포함하여
              실제 패턴에서 나타날 수 없는 문자열입니다.
              이를 통해 <code>**</code>와 <code>*</code>를 안전하게 구분합니다.
            </p>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>matchToolArgs 결정 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">matchToolArgs</code>는 도구 이름으로 인수 키를 찾고,
            해당 인수를 와일드카드 패턴과 비교합니다.
          </p>

          <MermaidDiagram
            title="matchToolArgs 결정 흐름"
            titleColor="purple"
            chart={`graph TD
  START(("입력")) --> HAS_ARGS{"args가 있는가?"}
  HAS_ARGS -->|"No"| FALSE1["false 반환"]
  HAS_ARGS -->|"Yes"| LOOKUP["TOOL_ARG_KEYS에서<br/>인수 키 조회"]
  LOOKUP --> FOUND{"매핑 있음?"}
  FOUND -->|"Yes"| GET_VALUE["해당 인수 값 추출"]
  GET_VALUE --> IS_STRING{"문자열인가?"}
  IS_STRING -->|"Yes"| MATCH["matchWildcard<br/>패턴 비교"]
  IS_STRING -->|"No"| FALSE2["false 반환"]
  FOUND -->|"No"| FALLBACK["폴백: 모든<br/>문자열 인수 추출"]
  FALLBACK --> ANY_MATCH{"하나라도<br/>매칭?"}
  ANY_MATCH -->|"Yes"| TRUE["true 반환"]
  ANY_MATCH -->|"No"| FALSE3["false 반환"]
  MATCH -->|"매칭"| TRUE2["true 반환"]
  MATCH -->|"불일치"| FALSE4["false 반환"]

  style LOOKUP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style MATCH fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style TRUE fill:#dcfce7,stroke:#10b981,color:#065f46
  style TRUE2 fill:#dcfce7,stroke:#10b981,color:#065f46
  style FALSE1 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style FALSE2 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style FALSE3 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style FALSE4 fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; matchWildcard</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            와일드카드 패턴을 정규식으로 변환하는 5단계 과정입니다.
          </p>
          <CodeBlock>
            <span className="fn">matchWildcard</span>(<span className="prop">value</span>: <span className="type">string</span>, <span className="prop">pattern</span>: <span className="type">string</span>): <span className="type">boolean</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] Windows 대소문자 무시"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">flags</span> = <span className="fn">isWindows</span>() ? <span className="str">&quot;i&quot;</span> : <span className="str">&quot;&quot;</span>;
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 정규식 특수문자 이스케이프"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">escaped</span> = <span className="prop">pattern</span>.<span className="fn">replace</span>(<span className="str">/[.+^${}()|[\\]\\\\]/g</span>, <span className="str">&quot;\\$&&quot;</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] ** → 임시 토큰 (단일 *와 구분)"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">step1</span> = <span className="prop">escaped</span>.<span className="fn">replace</span>(<span className="str">/\\*\\*/g</span>, <span className="str">&quot;\\0DOUBLESTAR\\0&quot;</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [4] * → [^/\\\\]* (경로 구분자 제외)"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">step2</span> = <span className="prop">step1</span>.<span className="fn">replace</span>(<span className="str">/\\*/g</span>, <span className="str">&quot;[^/\\\\\\\\]*&quot;</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [5] 임시 토큰 → .* (모든 문자)"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">step3</span> = <span className="prop">step2</span>.<span className="fn">replace</span>(<span className="str">/\\0DOUBLESTAR\\0/g</span>, <span className="str">&quot;.*&quot;</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [6] ? → [^/\\\\] (경로 구분자 제외 한 문자)"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">final</span> = <span className="prop">step3</span>.<span className="fn">replace</span>(<span className="str">/\\?/g</span>, <span className="str">&quot;[^/\\\\\\\\]&quot;</span>);
            {"\n"}
            {"\n"}{"  "}<span className="kw">return</span> <span className="kw">new</span> <span className="type">RegExp</span>(<span className="str">`^${"{"}<span className="prop">final</span>{"}"}$`</span>, <span className="prop">flags</span>).<span className="fn">test</span>(<span className="prop">value</span>);
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> Windows의 NTFS 파일 시스템은 대소문자를 구분하지 않으므로, <code className="text-cyan-600">i</code> 플래그를 추가합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> <code>.</code>, <code>+</code>, <code>^</code> 등 정규식 특수문자를 이스케이프합니다. <code>*</code>와 <code>?</code>는 와일드카드이므로 제외합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> <code>**</code>를 먼저 임시 토큰으로 치환합니다. 이렇게 해야 다음 단계에서 단일 <code>*</code>만 변환할 수 있습니다.</p>
            <p><strong className="text-gray-900">[4]</strong> 단일 <code>*</code>를 <code>[^/\\]*</code>로 변환합니다. 슬래시와 백슬래시를 제외한 문자만 매칭합니다.</p>
            <p><strong className="text-gray-900">[5]</strong> 임시 토큰을 <code>.*</code>로 복원합니다. 경로 구분자를 포함한 모든 문자와 매칭합니다.</p>
            <p><strong className="text-gray-900">[6]</strong> <code>?</code>를 경로 구분자를 제외한 한 문자로 변환합니다.</p>
          </div>
        </section>
      </RevealOnScroll>

      {/* ─── 5. 트러블슈팅 (Troubleshooting) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔧</span> 트러블슈팅
          </h2>

          {/* FAQ 1 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;src/* 패턴이 하위 디렉토리의 파일을 매칭하지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              정상 동작입니다. <code className="text-cyan-600">*</code>는 경로 구분자(<code>/</code>)를
              넘지 않으므로, <code>&quot;src/*&quot;</code>는 <code>&quot;src/app.ts&quot;</code>에만 매칭되고
              <code>&quot;src/utils/app.ts&quot;</code>에는 매칭되지 않습니다.
              하위 디렉토리까지 포함하려면 <code>&quot;src/**&quot;</code>를 사용하세요.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;matchToolArgs에서 커스텀 도구의 특정 인수만 비교하고 싶어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">TOOL_ARG_KEYS</code>에 등록되지 않은 도구는
              모든 문자열 인수에 대해 매칭을 시도합니다. 특정 인수만 비교하려면
              <code className="text-cyan-600">TOOL_ARG_KEYS</code>에 매핑을 추가하세요.
            </p>
            <Callout type="tip" icon="*">
              현재 <code>TOOL_ARG_KEYS</code>는 모듈 상수로 정의되어 있어 외부에서 수정할 수 없습니다.
              새 도구를 추가하려면 소스 코드를 직접 수정해야 합니다.
            </Callout>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Windows에서 대소문자가 달라 매칭이 안 되는 문제&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">matchWildcard</code>는 Windows에서 자동으로 대소문자를 무시합니다.
              <code className="text-cyan-600">isWindows()</code>가 <code>true</code>면 정규식에
              <code className="text-cyan-600">i</code> 플래그가 추가됩니다. macOS나 Linux에서
              대소문자 무시가 필요하면 패턴과 값을 모두 소문자로 변환하세요.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;parseRuleString vs parsePermissionPattern 어떤 것을 사용해야 하나요?&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">parseRuleString</code>은 에러 없이 항상 결과를 반환하므로
              내부 로직에서 안전하게 사용합니다. <code className="text-cyan-600">parsePermissionPattern</code>은
              잘못된 형식에 에러를 throw하므로, 사용자 입력 검증에 적합합니다.
            </p>
          </div>
        </section>
      </RevealOnScroll>

      {/* ─── 6. 관련 문서 (See Also) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔗</span> 관련 문서
          </h2>
          <SeeAlso
            items={[
              {
                name: "permission-manager.ts",
                slug: "permission-manager",
                relation: "parent",
                desc: "와일드카드 매칭을 활용하여 최종 권한을 결정하는 메인 매니저",
              },
              {
                name: "rules.ts",
                slug: "permission-rules",
                relation: "sibling",
                desc: "allow/deny 규칙 매칭 엔진 — 단순 glob 매칭 (경로 구분자 구분 없음)",
              },
              {
                name: "pattern-parser.ts",
                slug: "permission-patterns",
                relation: "sibling",
                desc: "패턴 문자열 파싱 — globToRegex와 matchWildcard의 차이를 이해하는 데 필수",
              },
              {
                name: "modes.ts",
                slug: "permission-modes",
                relation: "sibling",
                desc: "5가지 권한 모드별 도구 실행 허용 여부 결정",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
