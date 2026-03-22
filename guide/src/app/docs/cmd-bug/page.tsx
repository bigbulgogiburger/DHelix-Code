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

export default function CmdBugPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/commands/bug.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              /bug 버그 리포트
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            시스템 진단 정보를 자동 수집하여 GitHub 이슈 형태의 버그 리포트를 생성하는 슬래시 명령어입니다.
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
              <code className="text-cyan-600">/bug</code> 명령어는 사용자가 dbcode에서 버그를 발견했을 때
              빠르게 리포트를 작성할 수 있도록 도와줍니다. 사용자가 설명을 입력하면 OS, Node.js 버전,
              현재 모델명, 세션 ID, 타임스탬프 등 시스템 진단 정보를 자동으로 수집합니다.
            </p>
            <p>
              수집된 정보는 마크다운 형식의 버그 리포트로 포맷되고, GitHub 이슈 생성 URL이 함께
              생성됩니다. 사용자는 URL을 클릭하면 제목, 본문, 라벨이 미리 채워진 GitHub 이슈
              페이지로 이동하여 한 번의 클릭으로 이슈를 등록할 수 있습니다.
            </p>
            <p>
              이 명령어는 두 개의 내부 헬퍼 함수(<code className="text-cyan-600">buildGitHubIssueUrl</code>,
              <code className="text-cyan-600">formatBugReport</code>)로 구성되어 있으며,
              외부 의존성 없이 순수하게 동작합니다.
            </p>
          </div>

          <MermaidDiagram
            title="/bug 명령어 실행 흐름"
            titleColor="purple"
            chart={`graph TD
  USER["사용자 입력<br/><small>/bug 설명 텍스트</small>"]
  CMD["bugCommand.execute()<br/><small>commands/bug.ts</small>"]
  FMT["formatBugReport()<br/><small>환경 정보 수집 + 마크다운 생성</small>"]
  URL["buildGitHubIssueUrl()<br/><small>GitHub 이슈 URL 생성</small>"]
  OUT["터미널 출력<br/><small>URL + 리포트 텍스트</small>"]

  USER -->|"설명 텍스트"| CMD
  CMD --> FMT
  CMD --> URL
  FMT -->|"마크다운 리포트"| URL
  URL -->|"완성된 URL"| OUT

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style FMT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style URL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style USER fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style OUT fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 고객센터에 전화했을 때 상담원이 자동으로 고객 정보(이름, 계정, 기기)를
            조회해 두는 것처럼, <code>/bug</code>는 버그 리포트에 필요한 환경 정보를 자동으로 채워서
            사용자가 설명에만 집중할 수 있게 해줍니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* buildGitHubIssueUrl */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function buildGitHubIssueUrl()
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            GitHub 이슈 생성 URL을 구성합니다. 제목, 본문, 라벨을 URL 쿼리 파라미터로 인코딩하여
            클릭 시 미리 채워진 이슈 생성 페이지로 이동합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">buildGitHubIssueUrl</span>(<span className="prop">title</span>: <span className="type">string</span>, <span className="prop">body</span>: <span className="type">string</span>): <span className="type">string</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "title", type: "string", required: true, desc: "버그 제목 (80자로 잘림, '[Bug]' 접두사 자동 추가)" },
              { name: "body", type: "string", required: true, desc: "버그 리포트 마크다운 본문" },
            ]}
          />
          <p className="text-[13px] text-gray-600 mt-2">
            <strong>반환값:</strong> <code className="text-cyan-600">string</code> &mdash; GitHub 이슈 생성 URL
            (예: <code className="text-gray-500">https://github.com/.../issues/new?title=...&amp;body=...&amp;labels=bug</code>)
          </p>

          {/* formatBugReport */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function formatBugReport()
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            사용자 설명에 환경 진단 정보를 추가하여 마크다운 형식의 버그 리포트를 생성합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">formatBugReport</span>(
            {"\n"}  <span className="prop">description</span>: <span className="type">string</span>,
            {"\n"}  <span className="prop">context</span>: {"{"} <span className="kw">readonly</span> <span className="prop">model</span>: <span className="type">string</span>; <span className="kw">readonly</span> <span className="prop">sessionId</span>?: <span className="type">string</span> {"}"}
            {"\n"}): <span className="type">string</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "description", type: "string", required: true, desc: "사용자가 입력한 버그 설명 텍스트" },
              { name: "context.model", type: "string", required: true, desc: "현재 사용 중인 LLM 모델명" },
              { name: "context.sessionId", type: "string | undefined", required: false, desc: "현재 세션 ID (없으면 'N/A'로 표시)" },
            ]}
          />

          {/* bugCommand */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            const bugCommand: SlashCommand
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            <code className="text-cyan-600">/bug</code> 슬래시 명령어의 등록 객체입니다.
            명령어 레지스트리에 등록되어 사용자 입력을 처리합니다.
          </p>
          <ParamTable
            params={[
              { name: "name", type: '"bug"', required: true, desc: "명령어 이름" },
              { name: "description", type: "string", required: true, desc: '"Generate a bug report with system diagnostics"' },
              { name: "usage", type: "string", required: true, desc: '"/bug <description>"' },
              { name: "execute", type: "(args, context) => Promise<CommandResult>", required: true, desc: "명령어 실행 함수" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              설명 없이 <code className="text-cyan-600">/bug</code>만 입력하면 사용법 안내가 표시됩니다.
              빈 문자열은 리포트를 생성하지 않습니다.
            </li>
            <li>
              제목은 <strong>80자</strong>로 잘립니다. 긴 설명은 본문에 전체가 포함되지만,
              GitHub 이슈 제목에는 앞 80자만 표시됩니다.
            </li>
            <li>
              생성된 URL은 터미널에 출력될 뿐, 브라우저를 자동으로 열지는 않습니다.
              사용자가 직접 URL을 클릭하거나 복사해야 합니다.
            </li>
            <li>
              <code className="text-cyan-600">APP_NAME</code>과 <code className="text-cyan-600">VERSION</code>은
              <code className="text-cyan-600">constants.ts</code>에서 가져옵니다. 버전을 업데이트하면
              리포트에 자동 반영됩니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 버그 리포트 생성</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            버그를 발견하면 <code className="text-cyan-600">/bug</code> 뒤에 설명을 작성합니다.
            시스템 정보가 자동으로 수집되어 완성된 리포트가 출력됩니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 버그 리포트 생성"}</span>
            {"\n"}<span className="fn">/bug</span> <span className="str">&quot;Tool output is truncated when response exceeds 4096 tokens&quot;</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 출력 결과:"}</span>
            {"\n"}<span className="cm">{"// Bug report generated."}</span>
            {"\n"}<span className="cm">{"// "}</span>
            {"\n"}<span className="cm">{"// Open in browser: https://github.com/.../issues/new?title=..."}</span>
            {"\n"}<span className="cm">{"// "}</span>
            {"\n"}<span className="cm">{"// Or copy the report below:"}</span>
            {"\n"}<span className="cm">{"// ---"}</span>
            {"\n"}<span className="cm">{"// ## Bug Report"}</span>
            {"\n"}<span className="cm">{"// **Description**: Tool output is truncated..."}</span>
            {"\n"}<span className="cm">{"// ### Environment"}</span>
            {"\n"}<span className="cm">{"// - dbcode: v0.1.0"}</span>
            {"\n"}<span className="cm">{"// - Platform: darwin (arm64)"}</span>
            {"\n"}<span className="cm">{"// - Node.js: v20.11.0"}</span>
            {"\n"}<span className="cm">{"// - Model: gpt-4o-mini"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> 리포트에는 현재 모델명, OS, Node.js 버전 등이 포함됩니다.
            민감한 정보가 포함되지는 않지만, 세션 ID가 노출될 수 있으므로
            공개 이슈로 등록할 때 확인하세요.
          </Callout>

          {/* 사용법 확인 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            사용법 확인
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            설명 없이 <code className="text-cyan-600">/bug</code>만 입력하면 사용법 안내가 표시됩니다.
          </p>
          <CodeBlock>
            <span className="fn">/bug</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 출력:"}</span>
            {"\n"}<span className="cm">{'// Usage: /bug <description>'}</span>
            {"\n"}<span className="cm">{"// "}</span>
            {"\n"}<span className="cm">{"// Generates a GitHub issue report with system diagnostics."}</span>
          </CodeBlock>

          <DeepDive title="리포트에 포함되는 환경 정보 상세">
            <p className="mb-3">
              <code className="text-cyan-600">formatBugReport()</code>가 자동으로 수집하는 정보입니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><strong>APP_NAME + VERSION</strong> &mdash; constants.ts에서 가져온 앱 이름과 버전</li>
              <li><strong>Platform</strong> &mdash; <code>process.platform</code> + <code>process.arch</code> (예: darwin arm64)</li>
              <li><strong>Node.js</strong> &mdash; <code>process.version</code> (예: v20.11.0)</li>
              <li><strong>Model</strong> &mdash; 현재 세션의 LLM 모델명 (context에서 전달)</li>
              <li><strong>Session</strong> &mdash; 현재 세션 ID (없으면 &quot;N/A&quot;)</li>
              <li><strong>Timestamp</strong> &mdash; ISO 8601 형식의 현재 시각</li>
            </ul>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>실행 흐름 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">execute()</code> 함수의 분기 로직입니다.
            설명이 비어있으면 사용법을 반환하고, 있으면 리포트를 생성합니다.
          </p>

          <MermaidDiagram
            title="/bug execute() 분기 흐름"
            titleColor="purple"
            chart={`graph TD
  START(("execute 호출")) --> TRIM["args.trim()"]
  TRIM -->|"빈 문자열"| USAGE["사용법 안내 반환<br/><small>success: true</small>"]
  TRIM -->|"설명 있음"| FMT["formatBugReport()<br/><small>마크다운 리포트 생성</small>"]
  FMT --> BUILD["buildGitHubIssueUrl()<br/><small>URL 쿼리 파라미터 인코딩</small>"]
  BUILD --> OUTPUT["URL + 리포트 출력<br/><small>success: true</small>"]

  style START fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style TRIM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style USAGE fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style FMT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style BUILD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style OUTPUT fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">buildGitHubIssueUrl()</code>의 URL 구성 로직입니다.
            <code className="text-cyan-600">URLSearchParams</code>를 사용하여 안전하게 인코딩합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">buildGitHubIssueUrl</span>(<span className="prop">title</span>: <span className="type">string</span>, <span className="prop">body</span>: <span className="type">string</span>): <span className="type">string</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] URL 파라미터 구성 — 제목 80자 제한 + [Bug] 접두사"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">params</span> = <span className="kw">new</span> <span className="fn">URLSearchParams</span>({"{"}
            {"\n"}{"    "}<span className="prop">title</span>: <span className="str">`[Bug] ${"{"}</span><span className="prop">title</span>.<span className="fn">slice</span>(<span className="num">0</span>, <span className="num">80</span>)<span className="str">{"}"}`</span>,
            {"\n"}{"    "}<span className="prop">body</span>,
            {"\n"}{"    "}<span className="prop">labels</span>: <span className="str">&quot;bug&quot;</span>,
            {"\n"}{"  "}{"}"});
            {"\n"}{"  "}<span className="cm">{"// [2] GitHub 이슈 생성 URL 반환"}</span>
            {"\n"}{"  "}<span className="kw">return</span> <span className="str">`https://github.com/bigbulgogiburger/dbcode/issues/new?${"{"}</span><span className="prop">params</span><span className="str">{"}"}`</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> <code className="text-cyan-600">URLSearchParams</code>가 자동으로 특수문자를 인코딩합니다. 제목은 80자로 잘려 GitHub UI에서 적절히 표시됩니다.</p>
            <p><strong className="text-gray-900">[2]</strong> GitHub의 <code className="text-cyan-600">/issues/new</code> 엔드포인트는 쿼리 파라미터로 제목, 본문, 라벨을 받아 미리 채워진 이슈 생성 폼을 보여줍니다.</p>
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
              &quot;URL을 클릭했는데 GitHub 페이지가 열리지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              터미널 에뮬레이터에 따라 URL 클릭이 지원되지 않을 수 있습니다.
              URL을 복사하여 브라우저에 직접 붙여넣으세요. 또한 URL이 너무 길면
              (본문이 매우 긴 경우) 일부 브라우저에서 잘릴 수 있습니다.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;리포트에 모델명이 &apos;undefined&apos;로 표시돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">context.model</code>이 올바르게 전달되지 않은 경우입니다.
              명령어 레지스트리가 context를 올바르게 주입하고 있는지 확인하세요.
              일반적으로 이 값은 현재 세션의 LLM 모델명이 자동으로 채워집니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;리포트에 버전이 오래된 것으로 표시돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">VERSION</code> 상수는
              <code className="text-cyan-600">src/constants.ts</code>에 하드코딩되어 있습니다.
              릴리스 시 이 값을 업데이트하지 않으면 리포트에 구 버전이 표시됩니다.
              <code className="text-cyan-600">package.json</code>의 version 필드와 동기화해야 합니다.
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
                name: "constants.ts",
                slug: "constants",
                relation: "sibling",
                desc: "APP_NAME, VERSION 등 /bug 리포트에 포함되는 전역 상수 정의",
              },
              {
                name: "registry.ts",
                slug: "cmd-registry",
                relation: "parent",
                desc: "SlashCommand 인터페이스 정의 및 명령어 등록/실행을 관리하는 레지스트리",
              },
              {
                name: "/copy",
                slug: "cmd-copy",
                relation: "sibling",
                desc: "생성된 리포트를 클립보드에 복사할 때 함께 사용할 수 있는 명령어",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
