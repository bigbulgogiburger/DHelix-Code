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

export default function ToolGrepSearchPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/tools/definitions/grep-search.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              grep_search Tool
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            ripgrep 기반 코드 검색 도구 — 정규식 패턴으로 파일 내용을 고속 검색합니다.
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
              <code className="text-cyan-600">grep_search</code>는 정규식 패턴으로 파일 내용을 검색하여
              매칭된 줄을 파일 경로, 줄 번호와 함께 반환하는 도구입니다.
              두 가지 검색 엔진을 사용합니다.
            </p>
            <p>
              1순위는 <strong>ripgrep(rg)</strong> &mdash; Rust로 작성된 초고속 검색 도구로,
              .gitignore를 자동으로 존중하고 바이너리 파일을 건너뛰며 수만 개 파일에서도
              밀리초 단위로 검색합니다.
            </p>
            <p>
              ripgrep이 시스템에 설치되어 있지 않으면 <strong>JavaScript 내장 구현</strong>으로
              자동 폴백됩니다. fast-glob으로 파일 목록을 가져오고 Node.js의 RegExp로 매칭하는 방식입니다.
              ripgrep보다 느리지만 Node.js만으로 동작합니다.
            </p>
          </div>

          <MermaidDiagram
            title="grep_search 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  EXEC["Tool Executor<br/><small>tools/executor.ts</small>"]
  GS["grep_search<br/><small>grep-search.ts</small>"]
  RG["ripgrep (rg)<br/><small>Rust 바이너리</small>"]
  JS["JavaScript 폴백<br/><small>fast-glob + RegExp</small>"]
  FS["파일 시스템<br/><small>.gitignore 존중</small>"]

  AGENT -->|"도구 호출"| EXEC
  EXEC -->|"grep_search 디스패치"| GS
  GS -->|"rg 설치됨"| RG
  GS -->|"rg 미설치 or 에러"| JS
  RG --> FS
  JS --> FS

  style GS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style RG fill:#dcfce7,stroke:#10b981,color:#065f46
  style JS fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style FS fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 도서관의 전자 카탈로그를 떠올리세요. ripgrep은 초고속 인덱스 검색 엔진이고,
            JavaScript 폴백은 책장을 하나하나 넘기며 찾는 수동 검색입니다. 둘 다 같은 결과를 찾지만,
            속도 차이가 큽니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* paramSchema */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            매개변수 스키마 (paramSchema)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            Zod로 정의된 입력 매개변수입니다. pattern만 필수이고 나머지는 선택사항입니다.
          </p>
          <ParamTable
            params={[
              { name: "pattern", type: "string", required: true, desc: '검색할 정규식 패턴 (예: "function\\s+\\w+", "import.*from")' },
              { name: "path", type: "string", required: false, desc: "검색할 파일 또는 디렉토리 경로 (기본값: 작업 디렉토리)" },
              { name: "include", type: "string", required: false, desc: '글로브 패턴으로 검색 대상 필터링 (예: "*.ts", "*.{js,jsx}")' },
              { name: "contextLines", type: "number", required: false, desc: "매칭 줄 앞뒤에 표시할 컨텍스트 줄 수 (rg -C 옵션)" },
              { name: "caseSensitive", type: "boolean", required: false, desc: "대소문자 구분 여부 (기본값: true, false면 무시)" },
              { name: "fileType", type: "string", required: false, desc: '언어별 파일 타입 필터 (예: "ts", "py", "js"). ripgrep 내장 타입' },
              { name: "multiline", type: "boolean", required: false, desc: "멀티라인 매칭 활성화 — 패턴이 여러 줄에 걸쳐 매칭 (rg -U)" },
            ]}
          />

          {/* ToolDefinition */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            grepSearchTool (ToolDefinition)
          </h3>
          <ParamTable
            params={[
              { name: "name", type: '"grep_search"', required: true, desc: "도구 이름 — 레지스트리에서 이 이름으로 호출됨" },
              { name: "permissionLevel", type: '"safe"', required: true, desc: "읽기 전용이므로 사용자 확인 없이 실행" },
              { name: "timeoutMs", type: "30_000", required: true, desc: "30초 타임아웃" },
            ]}
          />

          {/* 내부 함수 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            내부 함수 및 유틸리티
          </h3>
          <ParamTable
            params={[
              { name: "isRipgrepAvailable()", type: "async () => boolean", required: true, desc: "시스템에 rg가 설치되어 있는지 확인 (결과 캐싱)" },
              { name: "searchWithRipgrep()", type: "async (...) => RipgrepResult", required: true, desc: "ripgrep 서브프로세스를 사용한 검색 — 파일당 최대 200개 매칭" },
              { name: "searchWithJavaScript()", type: "async (...) => ToolResult", required: true, desc: "JavaScript 폴백 검색 — fast-glob + RegExp 조합" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              ripgrep은 <strong>파일당 최대 200개</strong> 매칭으로 제한됩니다
              (<code className="text-cyan-600">--max-count 200</code>). 과도한 결과를 방지하기 위한 설정입니다.
            </li>
            <li>
              ripgrep 사용 가능 여부는 프로세스 수명 동안 <strong>캐싱</strong>됩니다.
              첫 검색 시 한 번만 확인하고 이후 재사용합니다.
            </li>
            <li>
              ripgrep exit code 1은 &quot;매칭 없음&quot;이고, exit code 2는 &quot;실제 에러&quot;입니다.
              exit code 2일 때만 JavaScript 폴백으로 재시도합니다.
            </li>
            <li>
              출력 결과의 파일 경로는 작업 디렉토리 기준 <strong>상대 경로</strong>로 정규화됩니다.
              Windows 백슬래시/포워드슬래시 양쪽 모두 처리합니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 정규식 패턴 검색</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 기본적인 사용 패턴입니다. 정규식 패턴을 지정하면 전체 작업 디렉토리에서 검색합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 모든 함수 선언 검색"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">execute</span>({"{"}
            {"\n"}{"  "}<span className="prop">pattern</span>: <span className="str">&quot;function\\s+\\w+&quot;</span>,
            {"\n"}{"}"}, <span className="prop">context</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 반환 형식:"}</span>
            {"\n"}<span className="cm">{"// Found 15 matches in 8 files: src/a.ts, src/b.ts, ..."}</span>
            {"\n"}<span className="cm">{"// ---"}</span>
            {"\n"}<span className="cm">{"// src/a.ts:10: function handleRequest(req: Request) {"}</span>
            {"\n"}<span className="cm">{"// src/b.ts:25: function parseConfig(path: string) {"}</span>
          </CodeBlock>

          {/* 필터와 컨텍스트 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>고급 &mdash; 파일 타입 필터와 컨텍스트</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">fileType</code>으로 특정 언어 파일만 검색하고,
            <code className="text-cyan-600"> contextLines</code>로 매칭 줄 주변 코드도 볼 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// TypeScript 파일에서만, 매칭 줄 앞뒤 3줄 포함"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">execute</span>({"{"}
            {"\n"}{"  "}<span className="prop">pattern</span>: <span className="str">&quot;CircuitBreaker&quot;</span>,
            {"\n"}{"  "}<span className="prop">fileType</span>: <span className="str">&quot;ts&quot;</span>,
            {"\n"}{"  "}<span className="prop">contextLines</span>: <span className="num">3</span>,
            {"\n"}{"}"}, <span className="prop">context</span>);
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>fileType</code>은 ripgrep의 내장 타입 정의를 사용합니다.
            JavaScript 폴백에서는 <code>fileType</code> 옵션이 무시될 수 있으므로, ripgrep 설치를 권장합니다.
          </Callout>

          {/* 의존성 분석 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; import/의존성 분석 패턴
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            패키지 사용 여부를 확인할 때는 4가지 import 스타일을 모두 커버하는 포괄적 패턴을 사용하세요.
          </p>
          <CodeBlock>
            <span className="cm">{"// 모든 import 스타일을 커버하는 4-clause 패턴"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">execute</span>({"{"}
            {"\n"}{"  "}<span className="prop">pattern</span>: <span className="str">&quot;(from\\s+[&apos;&quot;]zod[&apos;&quot;]|require\\s*\\(\\s*[&apos;&quot;]zod[&apos;&quot;]\\s*\\)|import\\s*\\(\\s*[&apos;&quot;]zod[&apos;&quot;]\\s*\\)|^import\\s+[&apos;&quot;]zod[&apos;&quot;])&quot;</span>,
            {"\n"}{"}"}, <span className="prop">context</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 이 패턴이 커버하는 import 스타일:"}</span>
            {"\n"}<span className="cm">{"// 1. ESM: import { z } from 'zod'"}</span>
            {"\n"}<span className="cm">{"// 2. CJS: require('zod')"}</span>
            {"\n"}<span className="cm">{"// 3. Dynamic: import('zod')"}</span>
            {"\n"}<span className="cm">{"// 4. Side-effect: import 'zod'"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> 검색 결과의 헤더에 매칭된 파일 목록이 포함됩니다.
            결과가 잘리더라도 모든 파일명은 헤더에서 확인할 수 있습니다.
          </Callout>

          <DeepDive title="ripgrep vs JavaScript 폴백 성능 비교">
            <p className="mb-3">
              ripgrep은 Rust로 작성되어 <strong>멀티스레드</strong> 검색을 지원하고,
              .gitignore를 자동으로 존중하여 불필요한 파일을 건너뛰므로 매우 빠릅니다.
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><strong>ripgrep:</strong> 10만 파일 기준 100ms 이내 (멀티스레드, .gitignore 존중)</li>
              <li><strong>JavaScript:</strong> 10만 파일 기준 수 초 ~ 수십 초 (싱글스레드, 모든 파일 순회)</li>
            </ul>
            <p className="mt-3 text-amber-600">
              ripgrep이 없으면 자동으로 JavaScript 폴백을 사용하지만, 대규모 프로젝트에서는
              ripgrep 설치를 강력히 권장합니다: <code>brew install ripgrep</code> (macOS)
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>검색 엔진 선택 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">execute()</code>는 ripgrep 사용 가능 여부를 확인한 뒤,
            적절한 검색 엔진으로 분기합니다. ripgrep 에러 시 JavaScript 폴백으로 재시도합니다.
          </p>

          <MermaidDiagram
            title="grep_search 검색 엔진 선택"
            titleColor="purple"
            chart={`graph TD
  START(("execute()")) --> PATH["검색 경로 결정<br/><small>path or workingDir</small>"]
  PATH --> CHECK{"isRipgrepAvailable()?"}
  CHECK -->|"Yes"| RG["searchWithRipgrep"]
  CHECK -->|"No"| JS["searchWithJavaScript"]
  RG --> RESULT{"결과?"}
  RESULT -->|"매칭 있음"| OK(("ToolResult"))
  RESULT -->|"exit code 1"| NONE["No matches found"]
  RESULT -->|"exit code 2 (에러)"| JS
  JS --> OK

  style START fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style CHECK fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style RESULT fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style RG fill:#dcfce7,stroke:#10b981,color:#065f46
  style JS fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style OK fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; ripgrep 명령 구성</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            ripgrep에 전달하는 명령행 인수를 동적으로 구성합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">args</span>: <span className="type">string</span>[] = [
            {"\n"}{"  "}<span className="str">&quot;--line-number&quot;</span>,{"     "}<span className="cm">{"// 줄 번호 표시"}</span>
            {"\n"}{"  "}<span className="str">&quot;--no-heading&quot;</span>,{"      "}<span className="cm">{"// 파일별 그룹핑 비활성화"}</span>
            {"\n"}{"  "}<span className="str">&quot;--color&quot;</span>, <span className="str">&quot;never&quot;</span>,{"  "}<span className="cm">{"// 색상 코드 비활성화"}</span>
            {"\n"}{"  "}<span className="str">&quot;--max-count&quot;</span>, <span className="str">&quot;200&quot;</span>,<span className="cm">{"// 파일당 최대 200 매칭"}</span>
            {"\n"}];
            {"\n"}
            {"\n"}<span className="cm">{"// 조건부 옵션 추가"}</span>
            {"\n"}<span className="kw">if</span> (<span className="prop">caseSensitive</span> === <span className="kw">false</span>) <span className="prop">args</span>.<span className="fn">push</span>(<span className="str">&quot;--ignore-case&quot;</span>);
            {"\n"}<span className="kw">if</span> (<span className="prop">contextLines</span>){"           "}<span className="prop">args</span>.<span className="fn">push</span>(<span className="str">&quot;-C&quot;</span>, <span className="fn">String</span>(<span className="prop">contextLines</span>));
            {"\n"}<span className="kw">if</span> (<span className="prop">include</span>){"                "}<span className="prop">args</span>.<span className="fn">push</span>(<span className="str">&quot;--glob&quot;</span>, <span className="prop">include</span>);
            {"\n"}<span className="kw">if</span> (<span className="prop">fileType</span>){"               "}<span className="prop">args</span>.<span className="fn">push</span>(<span className="str">&quot;--type&quot;</span>, <span className="prop">fileType</span>);
            {"\n"}<span className="kw">if</span> (<span className="prop">multiline</span>){"              "}<span className="prop">args</span>.<span className="fn">push</span>(<span className="str">&quot;--multiline&quot;</span>);
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">maxBuffer:</strong> <code className="text-cyan-600">10 * 1024 * 1024</code> (10MB) &mdash; 대규모 검색 결과를 처리할 수 있도록 버퍼 크기를 넉넉하게 설정합니다.</p>
            <p><strong className="text-gray-900">timeout:</strong> <code className="text-cyan-600">25_000</code> (25초) &mdash; ripgrep 프로세스의 타임아웃. 도구 전체 타임아웃(30초)보다 5초 짧게 설정하여 정리 시간을 확보합니다.</p>
            <p><strong className="text-gray-900">경로 정규화:</strong> ripgrep은 절대 경로를 반환하므로, 작업 디렉토리를 제거하여 상대 경로로 변환합니다. Windows의 포워드/백슬래시 양쪽 모두 처리합니다.</p>
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
              &quot;검색 결과가 너무 많거나 잘려있어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              파일당 최대 200개 매칭으로 제한됩니다. JavaScript 폴백도 총 200개까지만 표시합니다.
              <code className="text-cyan-600"> include</code>나 <code className="text-cyan-600">fileType</code>으로
              검색 범위를 좁히세요.
            </p>
            <CodeBlock>
              <span className="cm">{"// 범위를 좁혀서 검색"}</span>
              {"\n"}<span className="fn">execute</span>({"{"} <span className="prop">pattern</span>: <span className="str">&quot;TODO&quot;</span>, <span className="prop">include</span>: <span className="str">&quot;*.ts&quot;</span>, <span className="prop">path</span>: <span className="str">&quot;src/core&quot;</span> {"}"});
            </CodeBlock>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;ripgrep이 설치되어 있는지 어떻게 확인하나요?&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              터미널에서 <code className="text-cyan-600">rg --version</code>을 실행하세요.
              검색 결과의 <code className="text-cyan-600">metadata.backend</code> 필드가
              <code className="text-emerald-600"> &quot;ripgrep&quot;</code> 또는
              <code className="text-amber-600"> &quot;javascript&quot;</code>로 어떤 엔진이 사용되었는지 알려줍니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;대소문자 무시 검색이 안 돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              기본값은 대소문자 <strong>구분</strong>입니다.
              <code className="text-cyan-600"> caseSensitive: false</code>를 명시적으로 설정해야
              대소문자 무시 검색이 됩니다.
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
                name: "glob-search.ts",
                slug: "tool-glob-search",
                relation: "sibling",
                desc: "글로브 패턴 파일 검색 — grep_search가 내용을 검색하고, glob_search는 파일명을 검색합니다",
              },
              {
                name: "tool-registry.ts",
                slug: "tool-registry",
                relation: "parent",
                desc: "도구 레지스트리 — grepSearchTool을 등록하고 에이전트에 노출하는 모듈",
              },
              {
                name: "file-read.ts",
                slug: "tool-file-read",
                relation: "sibling",
                desc: "파일 읽기 도구 — grep_search로 위치를 찾은 후 file_read로 해당 파일을 상세히 읽기",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
