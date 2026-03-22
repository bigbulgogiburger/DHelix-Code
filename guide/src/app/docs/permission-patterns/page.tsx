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

export default function PermissionPatternsPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/permissions/pattern-parser.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Permission Patterns
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            권한 패턴 문자열을 파싱하고 도구 호출과 매칭하는 패턴 파서입니다.
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
              <code className="text-cyan-600">pattern-parser.ts</code>는 권한 패턴 문자열
              (예: <code className="text-cyan-600">&quot;Bash(npm *)&quot;</code>)을 구조화된 객체로 파싱하고,
              실제 도구 호출과 비교하는 기능을 제공합니다.
            </p>
            <p>
              패턴 문자열은 두 가지 형식을 지원합니다: 도구 이름만 있는 단순 패턴(<code className="text-cyan-600">&quot;Bash&quot;</code>)과
              인수 패턴이 포함된 복합 패턴(<code className="text-cyan-600">&quot;Bash(npm *)&quot;</code>).
              파서는 이 문자열을 <code className="text-cyan-600">toolName</code>과
              <code className="text-cyan-600">argPattern</code>으로 분리합니다.
            </p>
            <p>
              또한 glob 패턴을 정규식으로 변환하는 <code className="text-cyan-600">globToRegex</code>와
              파싱된 패턴으로 도구 호출을 매칭하는 <code className="text-cyan-600">matchesPermissionPattern</code>을
              제공합니다. 잘못된 패턴 형식에 대해서는
              <code className="text-cyan-600">PatternParseError</code>를 발생시킵니다.
            </p>
          </div>

          <MermaidDiagram
            title="Pattern Parser 처리 흐름"
            titleColor="purple"
            chart={`graph LR
  RAW["패턴 문자열<br/><small>Bash(npm *)</small>"]
  PARSE["parsePermissionPattern<br/><small>pattern-parser.ts</small>"]
  PARSED["ParsedPermissionPattern<br/><small>toolName + argPattern</small>"]
  MATCH["matchesPermissionPattern<br/><small>pattern-parser.ts</small>"]
  TOOL["도구 호출<br/><small>name + args</small>"]
  RESULT["boolean<br/><small>매칭 여부</small>"]

  RAW --> PARSE
  PARSE --> PARSED
  PARSED --> MATCH
  TOOL --> MATCH
  MATCH --> RESULT

  style PARSE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style MATCH fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PARSED fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RAW fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style TOOL fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 우편물 주소 파싱을 떠올리세요. &quot;서울시 강남구 역삼동 123&quot;이라는
            문자열을 &quot;시: 서울&quot;, &quot;구: 강남&quot;, &quot;동: 역삼&quot;으로 분리하는 것처럼,
            <code>&quot;Bash(npm *)&quot;</code>를 &quot;도구: Bash&quot;, &quot;패턴: npm *&quot;로 분리합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* PatternParseError */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class PatternParseError extends BaseError
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            권한 패턴 문자열이 잘못된 형식일 때 발생하는 에러입니다.
            에러 코드는 <code className="text-cyan-600">&quot;PATTERN_PARSE_ERROR&quot;</code>입니다.
          </p>
          <CodeBlock>
            <span className="kw">class</span> <span className="type">PatternParseError</span> <span className="kw">extends</span> <span className="type">BaseError</span> {"{"}
            {"\n"}{"  "}<span className="kw">constructor</span>(<span className="prop">message</span>: <span className="type">string</span>, <span className="prop">context</span>?: <span className="type">Record&lt;string, unknown&gt;</span>)
            {"\n"}{"}"}
          </CodeBlock>

          {/* ParsedPermissionPattern */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ParsedPermissionPattern
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            파싱된 권한 패턴을 나타내는 인터페이스입니다.
          </p>
          <ParamTable
            params={[
              { name: "toolName", type: "string", required: true, desc: '도구 이름 (예: "Bash", "Edit", "file_read")' },
              { name: "argPattern", type: "string | undefined", required: false, desc: '인수 매칭 패턴 (예: "npm *", "/src/**"), 없으면 undefined' },
            ]}
          />

          {/* parsePermissionPattern */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function parsePermissionPattern
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            권한 패턴 문자열을 구조화된 객체로 파싱합니다.
          </p>
          <CodeBlock>
            <span className="fn">parsePermissionPattern</span>(<span className="prop">raw</span>: <span className="type">string</span>): <span className="type">ParsedPermissionPattern</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "raw", type: "string", required: true, desc: '파싱할 권한 패턴 문자열 (예: "Bash", "Bash(npm *)", "Edit(/src/**)")' },
            ]}
          />
          <div className="text-[13px] text-gray-600 mt-3 space-y-1">
            <p><strong>입력 형식:</strong></p>
            <p>&bull; <code className="text-cyan-600">&quot;Bash&quot;</code> &rarr; <code>{"{"} toolName: &quot;Bash&quot;, argPattern: undefined {"}"}</code></p>
            <p>&bull; <code className="text-cyan-600">&quot;Bash(npm *)&quot;</code> &rarr; <code>{"{"} toolName: &quot;Bash&quot;, argPattern: &quot;npm *&quot; {"}"}</code></p>
            <p>&bull; <code className="text-cyan-600">&quot;Edit(/src/**)&quot;</code> &rarr; <code>{"{"} toolName: &quot;Edit&quot;, argPattern: &quot;/src/**&quot; {"}"}</code></p>
          </div>
          <div className="text-[13px] text-gray-600 mt-3 space-y-1">
            <p><strong>에러 발생 조건:</strong></p>
            <p>&bull; 빈 문자열</p>
            <p>&bull; 닫는 괄호만 있는 경우 (예: <code>&quot;Bash)&quot;</code>)</p>
            <p>&bull; 여는 괄호만 있는 경우 (예: <code>&quot;Bash(npm *&quot;</code>)</p>
            <p>&bull; 빈 도구 이름 (예: <code>&quot;(npm *)&quot;</code>)</p>
            <p>&bull; 빈 인수 패턴 (예: <code>&quot;Bash()&quot;</code>)</p>
          </div>

          {/* globToRegex (private) */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function globToRegex (private)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            glob 패턴을 정규식으로 변환합니다.
            <code className="text-cyan-600">rules.ts</code>의 <code className="text-cyan-600">matchPattern</code>과
            동일한 변환 로직입니다.
          </p>
          <CodeBlock>
            <span className="fn">globToRegex</span>(<span className="prop">pattern</span>: <span className="type">string</span>): <span className="type">RegExp</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "pattern", type: "string", required: true, desc: '변환할 glob 패턴 (예: "npm *", "/src/**")' },
            ]}
          />

          {/* matchesPermissionPattern */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function matchesPermissionPattern
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            도구 호출이 파싱된 권한 패턴과 매칭되는지 검사합니다.
            4단계 매칭 로직을 수행합니다.
          </p>
          <CodeBlock>
            <span className="fn">matchesPermissionPattern</span>(
            {"\n"}{"  "}<span className="prop">pattern</span>: <span className="type">ParsedPermissionPattern</span>,
            {"\n"}{"  "}<span className="prop">toolName</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">args</span>?: <span className="type">Readonly&lt;Record&lt;string, unknown&gt;&gt;</span>,
            {"\n"}): <span className="type">boolean</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "pattern", type: "ParsedPermissionPattern", required: true, desc: "파싱된 권한 패턴 객체" },
              { name: "toolName", type: "string", required: true, desc: '실행하려는 도구의 이름 (예: "Bash")' },
              { name: "args", type: "Readonly<Record<string, unknown>>", required: false, desc: "도구에 전달될 인수 객체 (선택적)" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">parsePermissionPattern</code>은 잘못된 형식에 대해
              <code className="text-cyan-600">PatternParseError</code>를 <strong>throw</strong>합니다.
              반드시 try/catch로 감싸세요.
            </li>
            <li>
              <code className="text-cyan-600">globToRegex</code>의 <code className="text-cyan-600">*</code>는
              경로 구분자를 포함하여 모든 문자와 매칭합니다.
              경로 레벨을 구분하려면 <code className="text-cyan-600">wildcard.ts</code>를 사용하세요.
            </li>
            <li>
              <code className="text-cyan-600">matchesPermissionPattern</code>은 인수의 <strong>문자열 값</strong>만
              비교합니다. 숫자, boolean, 객체 타입 인수는 무시됩니다.
            </li>
            <li>
              괄호 중첩은 지원하지 않습니다. <code className="text-cyan-600">&quot;Bash(cmd(x))&quot;</code>처럼
              괄호가 중첩되면 예기치 않은 결과가 발생할 수 있습니다.
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

          {/* 기본 사용법 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 패턴 파싱과 매칭</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            패턴 문자열을 파싱한 후, 도구 호출과 매칭하는 기본 흐름입니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="fn">parsePermissionPattern</span>, <span className="fn">matchesPermissionPattern</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./permissions/pattern-parser.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 1. 패턴 문자열 파싱"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">pattern</span> = <span className="fn">parsePermissionPattern</span>(<span className="str">&quot;Bash(npm *)&quot;</span>);
            {"\n"}<span className="cm">{"// pattern = { toolName: \"Bash\", argPattern: \"npm *\" }"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 도구 호출과 매칭"}</span>
            {"\n"}<span className="fn">matchesPermissionPattern</span>(<span className="prop">pattern</span>, <span className="str">&quot;Bash&quot;</span>, {"{"} <span className="prop">command</span>: <span className="str">&quot;npm install&quot;</span> {"}"});
            {"\n"}<span className="cm">{"// → true"}</span>
            {"\n"}
            {"\n"}<span className="fn">matchesPermissionPattern</span>(<span className="prop">pattern</span>, <span className="str">&quot;Bash&quot;</span>, {"{"} <span className="prop">command</span>: <span className="str">&quot;git push&quot;</span> {"}"});
            {"\n"}<span className="cm">{"// → false"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>parsePermissionPattern</code>은 잘못된 형식에
            <code>PatternParseError</code>를 throw합니다. 사용자 입력을 파싱할 때는 반드시
            try/catch로 감싸세요.
          </Callout>

          {/* 고급 사용법: 에러 처리 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 에러 처리
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            사용자 입력이나 설정 파일에서 읽은 패턴을 안전하게 파싱하는 방법입니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="fn">parsePermissionPattern</span>, <span className="type">PatternParseError</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./permissions/pattern-parser.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="kw">try</span> {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">pattern</span> = <span className="fn">parsePermissionPattern</span>(<span className="prop">userInput</span>);
            {"\n"}{"  "}<span className="cm">{"// 정상 파싱된 패턴 사용"}</span>
            {"\n"}{"}"} <span className="kw">catch</span> (<span className="prop">err</span>) {"{"}
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">err</span> <span className="kw">instanceof</span> <span className="type">PatternParseError</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// 패턴 형식 오류 처리"}</span>
            {"\n"}{"    "}<span className="fn">logger</span>.<span className="fn">warn</span>(<span className="str">`잘못된 패턴: ${"{"}</span><span className="prop">err</span>.<span className="prop">message</span><span className="str">{"}"}`</span>);
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          {/* 고급 사용법: 단순 패턴 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 도구 이름만으로 매칭
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            인수 패턴 없이 도구 이름만으로 매칭하면, 해당 도구의 모든 호출에 적용됩니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">pattern</span> = <span className="fn">parsePermissionPattern</span>(<span className="str">&quot;file_read&quot;</span>);
            {"\n"}<span className="cm">{"// pattern = { toolName: \"file_read\", argPattern: undefined }"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// argPattern이 undefined이므로 모든 호출에 매칭"}</span>
            {"\n"}<span className="fn">matchesPermissionPattern</span>(<span className="prop">pattern</span>, <span className="str">&quot;file_read&quot;</span>);{"           "}<span className="cm">{"// → true"}</span>
            {"\n"}<span className="fn">matchesPermissionPattern</span>(<span className="prop">pattern</span>, <span className="str">&quot;file_read&quot;</span>, {"{"} <span className="prop">path</span>: <span className="str">&quot;/any/path&quot;</span> {"}"});{"  "}<span className="cm">{"// → true"}</span>
            {"\n"}<span className="fn">matchesPermissionPattern</span>(<span className="prop">pattern</span>, <span className="str">&quot;file_write&quot;</span>);{"          "}<span className="cm">{"// → false (도구 이름 불일치)"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>parsePermissionPattern</code>과 <code>matchesPermissionPattern</code>을
            분리한 이유는 성능입니다. 패턴 문자열을 한 번만 파싱하고, 여러 도구 호출에 대해
            반복 매칭할 수 있습니다.
          </Callout>

          <DeepDive title="globToRegex vs wildcard.ts의 matchWildcard 차이">
            <p className="mb-3">
              두 모듈 모두 glob 패턴을 정규식으로 변환하지만, <code className="text-cyan-600">*</code>의
              동작이 다릅니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><code className="text-cyan-600">globToRegex</code> (pattern-parser.ts) &mdash; <code>*</code>는 경로 구분자 포함 모든 문자와 매칭. 단순한 명령어 패턴용</li>
              <li><code className="text-cyan-600">matchWildcard</code> (wildcard.ts) &mdash; <code>*</code>는 경로 구분자 제외, <code>**</code>는 모든 문자. 파일 경로 패턴용</li>
            </ul>
            <p className="mt-3 text-amber-600">
              명령어 패턴(<code>&quot;npm *&quot;</code>)에는 <code>globToRegex</code>,
              파일 경로 패턴(<code>&quot;/src/**/*.ts&quot;</code>)에는 <code>matchWildcard</code>를
              사용하세요.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>파싱 흐름도</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">parsePermissionPattern</code>은 괄호 위치를 기준으로
            패턴 문자열을 분석합니다.
          </p>

          <MermaidDiagram
            title="parsePermissionPattern 파싱 흐름"
            titleColor="purple"
            chart={`graph TD
  START(("입력")) --> TRIM["문자열 trim"]
  TRIM --> EMPTY{"빈 문자열?"}
  EMPTY -->|"Yes"| ERR1["PatternParseError"]
  EMPTY -->|"No"| FIND_PAREN{"여는 괄호 위치?"}
  FIND_PAREN -->|"없음"| HAS_CLOSE{"닫는 괄호 있음?"}
  HAS_CLOSE -->|"Yes"| ERR2["PatternParseError<br/><small>Unmatched closing</small>"]
  HAS_CLOSE -->|"No"| SIMPLE["도구 이름만 반환<br/><small>argPattern: undefined</small>"]
  FIND_PAREN -->|"있음"| ENDS_CLOSE{"닫는 괄호로<br/>끝나는가?"}
  ENDS_CLOSE -->|"No"| ERR3["PatternParseError<br/><small>No closing paren</small>"]
  ENDS_CLOSE -->|"Yes"| EXTRACT_TOOL["도구 이름 추출"]
  EXTRACT_TOOL --> TOOL_EMPTY{"도구 이름 빈 값?"}
  TOOL_EMPTY -->|"Yes"| ERR4["PatternParseError<br/><small>Empty tool name</small>"]
  TOOL_EMPTY -->|"No"| EXTRACT_ARG["인수 패턴 추출"]
  EXTRACT_ARG --> ARG_EMPTY{"인수 패턴 빈 값?"}
  ARG_EMPTY -->|"Yes"| ERR5["PatternParseError<br/><small>Empty arg pattern</small>"]
  ARG_EMPTY -->|"No"| RESULT["ParsedPermissionPattern 반환"]

  style SIMPLE fill:#dcfce7,stroke:#10b981,color:#065f46
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46
  style ERR1 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ERR2 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ERR3 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ERR4 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ERR5 fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; matchesPermissionPattern</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            4단계 매칭 로직의 전체 흐름입니다.
          </p>
          <CodeBlock>
            <span className="fn">matchesPermissionPattern</span>(<span className="prop">pattern</span>, <span className="prop">toolName</span>, <span className="prop">args</span>): <span className="type">boolean</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] 도구 이름 glob 매칭"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (!<span className="fn">globToRegex</span>(<span className="prop">pattern</span>.<span className="prop">toolName</span>).<span className="fn">test</span>(<span className="prop">toolName</span>)) {"{"}
            {"\n"}{"    "}<span className="kw">return</span> <span className="kw">false</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] argPattern 없으면 모든 호출에 매칭"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">pattern</span>.<span className="prop">argPattern</span> === <span className="kw">undefined</span>) {"{"}
            {"\n"}{"    "}<span className="kw">return</span> <span className="kw">true</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] argPattern 있지만 인수 없으면 매칭 실패"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (!<span className="prop">args</span>) <span className="kw">return</span> <span className="kw">false</span>;
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [4] 문자열 인수 중 하나라도 매칭되면 성공"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">argRegex</span> = <span className="fn">globToRegex</span>(<span className="prop">pattern</span>.<span className="prop">argPattern</span>);
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">stringValues</span> = <span className="type">Object</span>.<span className="fn">values</span>(<span className="prop">args</span>)
            {"\n"}{"    "}.<span className="fn">filter</span>((<span className="prop">v</span>): <span className="prop">v</span> <span className="kw">is</span> <span className="type">string</span> {"=>"} <span className="kw">typeof</span> <span className="prop">v</span> === <span className="str">&quot;string&quot;</span>);
            {"\n"}{"  "}<span className="kw">return</span> <span className="prop">stringValues</span>.<span className="fn">some</span>(<span className="prop">v</span> {"=>"} <span className="prop">argRegex</span>.<span className="fn">test</span>(<span className="prop">v</span>));
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 도구 이름을 패턴의 <code className="text-cyan-600">toolName</code>과 glob 매칭합니다. 이름이 맞지 않으면 즉시 false를 반환합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> <code className="text-cyan-600">argPattern</code>이 없으면(단순 패턴) 도구의 모든 호출에 매칭합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> <code className="text-cyan-600">argPattern</code>이 있는데 인수가 전달되지 않았으면 매칭 실패입니다.</p>
            <p><strong className="text-gray-900">[4]</strong> 인수 객체에서 문자열 값만 추출하여 패턴과 비교합니다. <code className="text-cyan-600">some()</code>을 사용하므로 하나라도 매칭되면 true입니다.</p>
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
              &quot;PatternParseError: Empty permission pattern&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              빈 문자열이나 공백만 있는 문자열을 파싱하려 했습니다.
              설정 파일에서 읽은 값이 빈 문자열인지 확인하세요.
              패턴 입력 전에 <code className="text-cyan-600">raw.trim().length &gt; 0</code> 검증을 추가하세요.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;PatternParseError: Unmatched closing parenthesis in pattern&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              여는 괄호 없이 닫는 괄호만 있는 패턴입니다. 예: <code>&quot;Bash)&quot;</code>.
              괄호 쌍이 올바른지 확인하세요. 괄호가 필요 없으면 제거하고,
              필요하면 <code>&quot;Bash(pattern)&quot;</code> 형식으로 수정하세요.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;패턴이 파싱은 되는데 매칭이 안 돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">matchesPermissionPattern</code>은 인수의 <strong>문자열 값</strong>만
              비교합니다. 다음을 확인하세요:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>인수 객체가 전달되었는지 확인 (args가 undefined면 항상 false)</li>
              <li>매칭하려는 인수가 문자열 타입인지 확인 (숫자/boolean은 무시됨)</li>
              <li>glob 패턴이 전체 문자열 매칭인지 확인 (<code>&quot;npm&quot;</code>은 <code>&quot;npm install&quot;</code>과 매칭 안 됨, <code>&quot;npm *&quot;</code> 사용)</li>
            </ul>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;경로 패턴에서 * 와 ** 의 차이가 없어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">globToRegex</code>에서는 <code>*</code>와 <code>**</code> 모두
              <code>.*</code>로 변환되어 동일하게 동작합니다. 경로 레벨을 구분하는 패턴이 필요하면
              <code className="text-cyan-600">wildcard.ts</code>의 <code className="text-cyan-600">matchWildcard</code>를
              사용하세요 (<code>*</code>는 한 레벨, <code>**</code>는 여러 레벨).
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
                desc: "파싱된 패턴을 사용하여 최종 권한을 결정하는 메인 매니저",
              },
              {
                name: "rules.ts",
                slug: "permission-rules",
                relation: "sibling",
                desc: "allow/deny 규칙 매칭 엔진 — 동일한 glob 매칭 로직 사용",
              },
              {
                name: "wildcard.ts",
                slug: "permission-wildcard",
                relation: "sibling",
                desc: "경로 안전한 와일드카드 매칭 — * vs ** 구분, Windows 대소문자 처리",
              },
              {
                name: "modes.ts",
                slug: "permission-modes",
                relation: "sibling",
                desc: "규칙 매칭 실패 시 적용되는 5가지 권한 모드 결정 모듈",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
