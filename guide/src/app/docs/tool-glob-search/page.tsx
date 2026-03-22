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

export default function ToolGlobSearchPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/tools/definitions/glob-search.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">glob_search Tool</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              glob 패턴 파일 검색 도구 — 와일드카드 패턴으로 파일을 찾아 수정 시간순으로 반환합니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ─── 1. 개요 (Overview) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📋</span> 개요
            </h2>
            <div className="text-[14px] text-gray-600 leading-[1.85] mb-8 space-y-3">
              <p>
                <code className="text-cyan-600">glob_search</code>는 글로브(Glob) 패턴을 사용하여
                파일을 검색하는 도구입니다. <code className="text-cyan-600">grep_search</code>가
                파일 <em>내용</em>을 검색하는 반면,{" "}
                <code className="text-cyan-600">glob_search</code>는 파일 <em>이름</em>과
                <em>경로</em>를 패턴으로 검색합니다.
              </p>
              <p>
                <code className="text-cyan-600">fast-glob</code> 라이브러리를 사용하여 빠르게 파일을
                검색하고, 결과는 수정 시간(modification time) 기준 <strong>최신순</strong>으로
                정렬됩니다. 최근에 수정된 파일이 먼저 표시되므로, 작업 중인 파일을 쉽게 찾을 수
                있습니다.
              </p>
              <p>
                권한 수준은 <code className="text-emerald-600">&quot;safe&quot;</code>로, 파일
                시스템을 읽기만 하므로 사용자 확인 없이 실행됩니다. 소스 코드는{" "}
                <strong>102줄</strong>의 간결한 모듈입니다.
              </p>
            </div>

            <MermaidDiagram
              title="glob_search 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  EXEC["Tool Executor<br/><small>tools/executor.ts</small>"]
  GS["glob_search<br/><small>glob-search.ts</small>"]
  FG["fast-glob<br/><small>패턴 매칭 엔진</small>"]
  STAT["fs.stat<br/><small>수정 시간 조회</small>"]

  AGENT -->|"도구 호출"| EXEC
  EXEC -->|"glob_search 디스패치"| GS
  GS -->|"패턴 매칭"| FG
  GS -->|"mtime 조회"| STAT

  style GS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style FG fill:#dcfce7,stroke:#10b981,color:#065f46
  style STAT fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 파일 탐색기에서 <code>*.ts</code>로 검색하는 것과 같습니다.
              파일 내용은 보지 않고, 이름과 경로만으로 파일을 찾아줍니다. 결과는 &quot;최근 수정된
              파일부터&quot; 정렬되어, 지금 작업 중인 파일을 빠르게 찾을 수 있습니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 2. 레퍼런스 (Reference) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📖</span> 레퍼런스
            </h2>

            {/* paramSchema */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              매개변수 스키마 (paramSchema)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              Zod로 정의된 입력 매개변수입니다. pattern만 필수이고, path는 선택사항입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "pattern",
                  type: "string",
                  required: true,
                  desc: '글로브 패턴 (예: "**/*.ts", "src/**/*.tsx", "*.json")',
                },
                {
                  name: "path",
                  type: "string",
                  required: false,
                  desc: "검색 시작 디렉토리 (기본값: 작업 디렉토리)",
                },
              ]}
            />

            {/* ToolDefinition */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              globSearchTool (ToolDefinition)
            </h3>
            <ParamTable
              params={[
                {
                  name: "name",
                  type: '"glob_search"',
                  required: true,
                  desc: "도구 이름 — 레지스트리에서 이 이름으로 호출됨",
                },
                {
                  name: "permissionLevel",
                  type: '"safe"',
                  required: true,
                  desc: "읽기 전용이므로 사용자 확인 없이 실행",
                },
                { name: "timeoutMs", type: "30_000", required: true, desc: "30초 타임아웃" },
              ]}
            />

            {/* 반환 metadata */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              반환 metadata 필드
            </h3>
            <ParamTable
              params={[
                { name: "count", type: "number", required: true, desc: "매칭된 파일 수" },
                { name: "pattern", type: "string", required: true, desc: "사용된 글로브 패턴" },
              ]}
            />

            {/* 글로브 패턴 문법 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              글로브 패턴 문법
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              fast-glob이 지원하는 주요 글로브 패턴 문법입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "*",
                  type: "와일드카드",
                  required: true,
                  desc: "파일명의 임의 문자열 매칭 (디렉토리 구분자 제외)",
                },
                {
                  name: "**",
                  type: "재귀 와일드카드",
                  required: true,
                  desc: "0개 이상의 디렉토리를 재귀적으로 매칭",
                },
                { name: "?", type: "단일 문자", required: true, desc: "정확히 한 문자를 매칭" },
                {
                  name: "{a,b}",
                  type: "선택",
                  required: true,
                  desc: '여러 패턴 중 하나를 매칭 (예: "*.{ts,tsx}")',
                },
                {
                  name: "[abc]",
                  type: "문자 클래스",
                  required: true,
                  desc: "괄호 안의 문자 중 하나를 매칭",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">dot: false</code>로 설정되어 있어
                <code className="text-cyan-600"> .</code>으로 시작하는 파일(숨김 파일)은 기본적으로
                제외됩니다.
              </li>
              <li>
                <code className="text-cyan-600">onlyFiles: true</code>로 설정되어 디렉토리는 결과에
                포함되지 않습니다. 파일만 검색됩니다.
              </li>
              <li>
                <code className="text-cyan-600">stat()</code> 호출이 실패한 파일(삭제되었거나 권한
                없음)은 조용히 건너뜁니다. 에러를 발생시키지 않습니다.
              </li>
              <li>
                결과는 수정 시간 <strong>내림차순</strong>(최신 먼저)으로 정렬됩니다. 알파벳순이
                아닌 점에 주의하세요.
              </li>
            </ul>
          </section>
        </RevealOnScroll>

        {/* ─── 3. 사용법 (Usage) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🚀</span> 사용법
            </h2>

            {/* 기본 사용법 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 파일 찾기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              가장 기본적인 사용 패턴입니다. 글로브 패턴으로 파일을 찾습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 모든 TypeScript 파일 검색"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">execute</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">pattern</span>:{" "}
              <span className="str">&quot;**/*.ts&quot;</span>,{"\n"}
              {"}"}, <span className="prop">context</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 반환 형식 (수정 시간 최신순):"}</span>
              {"\n"}
              <span className="cm">{"// src/tools/definitions/file-read.ts"}</span>
              {"\n"}
              <span className="cm">{"// src/core/agent-loop.ts"}</span>
              {"\n"}
              <span className="cm">{"// src/utils/path.ts"}</span>
            </CodeBlock>

            {/* 특정 디렉토리 검색 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              디렉토리 지정 &mdash; 범위 좁히기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">path</code>로 특정 디렉토리 아래에서만 검색합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// src/tools 아래의 모든 테스트 파일"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">execute</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">pattern</span>:{" "}
              <span className="str">&quot;**/*.test.ts&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">path</span>: <span className="str">&quot;src/tools&quot;</span>
              ,{"\n"}
              {"}"}, <span className="prop">context</span>);
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 숨김 파일(<code>.env</code>, <code>.gitignore</code> 등)은
              기본적으로 검색 결과에 포함되지 않습니다. <code>dot: false</code>가 기본 설정이기
              때문입니다.
            </Callout>

            {/* 복합 패턴 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 복합 글로브 패턴
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              중괄호 선택(<code className="text-cyan-600">{"{}"}</code>)으로 여러 확장자를 한 번에
              검색할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// TypeScript + React 파일 모두 검색"}</span>
              {"\n"}
              <span className="fn">execute</span>({"{"} <span className="prop">pattern</span>:{" "}
              <span className="str">
                &quot;**/*.{"{"}ts,tsx{"}"}&quot;
              </span>{" "}
              {"}"}, <span className="prop">ctx</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 설정 파일 검색"}</span>
              {"\n"}
              <span className="fn">execute</span>({"{"} <span className="prop">pattern</span>:{" "}
              <span className="str">
                &quot;*.{"{"}json,yaml,yml,toml{"}"}&quot;
              </span>{" "}
              {"}"}, <span className="prop">ctx</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 특정 디렉토리의 인덱스 파일만"}</span>
              {"\n"}
              <span className="fn">execute</span>({"{"} <span className="prop">pattern</span>:{" "}
              <span className="str">&quot;src/**/index.ts&quot;</span> {"}"},{" "}
              <span className="prop">ctx</span>);
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 파일 내용을 검색하고 싶다면 <code>glob_search</code> 대신
              <code> grep_search</code>를 사용하세요. <code>glob_search</code>는 파일 이름/경로만
              검색합니다.
            </Callout>

            <DeepDive title="수정 시간(mtime) 정렬의 이유">
              <p className="mb-3">
                검색 결과를 알파벳순이 아닌 <strong>수정 시간 최신순</strong>으로 정렬하는 이유가
                있습니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  에이전트가 &quot;방금 수정한 파일&quot;을 먼저 볼 수 있어 맥락 파악이 빠릅니다
                </li>
                <li>작업 중인 파일이 상단에 위치하여 관련 파일을 찾기 쉽습니다</li>
                <li>오래된 파일(라이브러리, 설정 등)은 하단으로 밀려나 노이즈가 줄어듭니다</li>
              </ul>
              <p className="mt-3 text-gray-600">
                내부적으로 각 파일에 <code className="text-cyan-600">fs.stat()</code>를 호출하여
                <code className="text-cyan-600"> mtimeMs</code>(수정 시간, 밀리초 단위)를 가져온 뒤
                내림차순으로 정렬합니다.
              </p>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ─── 4. 내부 구현 (Internals) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>⚙️</span> 내부 구현
            </h2>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              실행 흐름 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">execute()</code> 함수의 전체 실행 흐름입니다.
              fast-glob으로 파일을 찾고, stat으로 수정 시간을 조회한 뒤 정렬합니다.
            </p>

            <MermaidDiagram
              title="glob_search 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("execute()")) --> DIR["검색 디렉토리 결정<br/><small>path or workingDir</small>"]
  DIR --> GLOB["fast-glob<br/><small>패턴 매칭</small>"]
  GLOB --> LOOP["각 파일에 stat() 호출<br/><small>수정 시간 조회</small>"]
  LOOP --> SORT["mtime 내림차순 정렬<br/><small>최신 먼저</small>"]
  SORT --> CHECK{"매칭 파일 있음?"}
  CHECK -->|"Yes"| RESULT(("파일 경로 목록"))
  CHECK -->|"No"| EMPTY["No files found"]

  style START fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style GLOB fill:#dcfce7,stroke:#10b981,color:#065f46
  style CHECK fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              간결한 구현입니다. fast-glob, stat, 정렬의 세 단계로 동작합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// [1] fast-glob으로 패턴 매칭"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">entries</span> ={" "}
              <span className="kw">await</span> <span className="fn">fg</span>(
              <span className="prop">pattern</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">cwd</span>: <span className="prop">searchDir</span>,{"\n"}
              {"  "}
              <span className="prop">dot</span>: <span className="kw">false</span>,{"       "}
              <span className="cm">{"// 숨김 파일 제외"}</span>
              {"\n"}
              {"  "}
              <span className="prop">onlyFiles</span>: <span className="kw">true</span>,{"  "}
              <span className="cm">{"// 파일만 (디렉토리 제외)"}</span>
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// [2] 각 파일의 수정 시간 조회"}</span>
              {"\n"}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">entry</span> <span className="kw">of</span>{" "}
              <span className="prop">entries</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">stats</span> ={" "}
              <span className="kw">await</span> <span className="fn">stat</span>(
              <span className="fn">join</span>(<span className="prop">searchDir</span>,{" "}
              <span className="prop">entry</span>));
              {"\n"}
              {"  "}
              <span className="prop">matches</span>.<span className="fn">push</span>({"{"}{" "}
              <span className="prop">path</span>: <span className="fn">normalizePath</span>(
              <span className="prop">entry</span>), <span className="prop">mtime</span>:{" "}
              <span className="prop">stats</span>.<span className="prop">mtimeMs</span> {"}"});
              {"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// [3] 수정 시간 내림차순 정렬 (최신 먼저)"}</span>
              {"\n"}
              <span className="prop">matches</span>.<span className="fn">sort</span>((
              <span className="prop">a</span>, <span className="prop">b</span>) =&gt;{" "}
              <span className="prop">b</span>.<span className="prop">mtime</span> -{" "}
              <span className="prop">a</span>.<span className="prop">mtime</span>);
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> fast-glob의{" "}
                <code className="text-cyan-600">dot: false</code>는 <code>.gitignore</code>,{" "}
                <code>.env</code> 같은 숨김 파일을 결과에서 제외합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> stat() 호출이 실패하는 파일(경합
                조건으로 삭제됨 등)은 <code className="text-cyan-600">try-catch</code>로 조용히
                건너뜁니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong>{" "}
                <code className="text-cyan-600">mtimeMs</code>는 밀리초 단위의 수정 시간입니다. 숫자
                뺄셈으로 내림차순 정렬합니다.
              </p>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 5. 트러블슈팅 (Troubleshooting) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔧</span> 트러블슈팅
            </h2>

            {/* FAQ 1 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;.env 파일이 검색 결과에 안 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">dot: false</code>가 기본 설정이라 <code>.</code>으로
                시작하는 숨김 파일은 결과에 포함되지 않습니다. 숨김 파일을 검색하려면
                <code className="text-cyan-600"> file_read</code>로 직접 경로를 지정하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;결과가 알파벳순이 아니라 순서가 이상해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                의도된 동작입니다. 결과는 <strong>수정 시간 최신순</strong>으로 정렬됩니다. 최근에
                수정한 파일이 상단에 위치하여 작업 중인 파일을 빠르게 찾을 수 있습니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;No files found인데 분명히 파일이 있어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">다음을 확인하세요:</p>
              <ul className="text-[13px] text-gray-600 space-y-1 list-disc list-inside">
                <li>
                  글로브 패턴이 올바른지 확인 (예: <code>*.ts</code>는 현재 디렉토리만,{" "}
                  <code>**/*.ts</code>는 재귀)
                </li>
                <li>
                  <code className="text-cyan-600">path</code> 디렉토리가 올바른지 확인
                </li>
                <li>
                  숨김 파일이 아닌지 확인 (<code>.</code>으로 시작하면 기본 제외)
                </li>
              </ul>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 6. 관련 문서 (See Also) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔗</span> 관련 문서
            </h2>
            <SeeAlso
              items={[
                {
                  name: "grep-search.ts",
                  slug: "tool-grep-search",
                  relation: "sibling",
                  desc: "정규식 검색 도구 — glob_search가 파일명을 검색하고, grep_search는 파일 내용을 검색합니다",
                },
                {
                  name: "file-read.ts",
                  slug: "tool-file-read",
                  relation: "sibling",
                  desc: "파일 읽기 도구 — glob_search로 파일을 찾은 후 file_read로 내용을 읽기",
                },
                {
                  name: "tool-registry.ts",
                  slug: "tool-registry",
                  relation: "parent",
                  desc: "도구 레지스트리 — globSearchTool을 등록하고 에이전트에 노출하는 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
