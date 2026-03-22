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

export default function CmdCommitPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/commands/commit.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              /commit
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            스테이징된 변경 사항을 분석하여 Conventional Commits 형식의 커밋 메시지를 자동 생성하고 실행하는 슬래시 명령어입니다.
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
              <code className="text-cyan-600">/commit</code>은 사용자가 <code className="text-cyan-600">git add</code>로
              스테이징한 파일들의 diff를 자동으로 수집하고, 변경 패턴을 분석하여 커밋 타입(feat/fix/test/docs)과
              스코프를 자동 감지한 뒤 LLM에게 최종 커밋 메시지 생성을 위임하는 명령어입니다.
            </p>
            <p>
              내부적으로 <code className="text-cyan-600">git diff --cached</code>로 변경 내역을 수집하고,
              최근 5개 커밋 히스토리를 참조하여 프로젝트의 커밋 스타일을 따르는 메시지를 제안합니다.
              생성된 프롬프트는 <code className="text-cyan-600">shouldInjectAsUserMessage: true</code>로
              에이전트에게 전달되어 LLM이 diff를 분석하고 <code className="text-cyan-600">git commit</code>을 실행합니다.
            </p>
            <p>
              Conventional Commits란 <code className="text-cyan-600">type(scope): description</code> 형식의
              표준 커밋 메시지 규칙입니다. 예를 들어 <code className="text-cyan-600">feat(auth): add login validation</code>처럼
              변경의 성격과 영향 범위를 한눈에 파악할 수 있습니다.
            </p>
          </div>

          <MermaidDiagram
            title="/commit 실행 흐름"
            titleColor="purple"
            chart={`graph TD
  USER["사용자 입력<br/><small>/commit [hint]</small>"]
  GIT["Git 저장소 확인<br/><small>git rev-parse --git-dir</small>"]
  STAGED["스테이징 확인<br/><small>git diff --cached --name-status</small>"]
  ANALYZE["패턴 분석<br/><small>detectCommitType + extractScope</small>"]
  PROMPT["프롬프트 생성<br/><small>diff + history + suggestion</small>"]
  LLM["LLM 에이전트<br/><small>메시지 생성 + git commit 실행</small>"]

  USER --> GIT
  GIT -->|"git repo 아님"| ERR1["에러: Not a git repository"]
  GIT -->|"OK"| STAGED
  STAGED -->|"스테이징 없음"| ERR2["에러: No staged changes"]
  STAGED -->|"OK"| ANALYZE
  ANALYZE --> PROMPT
  PROMPT -->|"shouldInjectAsUserMessage"| LLM

  style ANALYZE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style USER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style GIT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style STAGED fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PROMPT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style ERR1 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ERR2 fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <Callout type="info" icon="💡">
            <strong>핵심 원리:</strong> <code>/commit</code>은 직접 커밋을 실행하지 않습니다.
            대신 diff 컨텍스트와 분석 결과를 담은 프롬프트를 LLM에게 주입하여,
            에이전트가 변경 내역을 직접 리뷰하고 최적의 커밋 메시지를 생성하도록 위임합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* commitCommand */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            commitCommand: SlashCommand
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            <code className="text-cyan-600">/commit</code> 슬래시 명령어의 정의 객체입니다.
            스테이징된 변경 사항을 분석하여 LLM에게 커밋 메시지 생성을 위임합니다.
          </p>
          <ParamTable
            params={[
              { name: "name", type: '"commit"', required: true, desc: "명령어 이름" },
              { name: "description", type: "string", required: true, desc: '"Commit staged changes with an auto-generated message"' },
              { name: "usage", type: "string", required: true, desc: '"/commit [message hint]"' },
              { name: "execute", type: "(args, context) => Promise<CommandResult>", required: true, desc: "명령어 실행 함수" },
            ]}
          />

          {/* gitExec */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            gitExec(cmd, cwd)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            git 명령어를 실행하고 stdout을 반환하는 내부 헬퍼 함수입니다.
            실패 시 빈 문자열을 반환하여 호출자가 안전하게 처리할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">gitExec</span>(<span className="prop">cmd</span>: <span className="type">string</span>, <span className="prop">cwd</span>: <span className="type">string</span>): <span className="type">string</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "cmd", type: "string", required: true, desc: '실행할 git 명령어 (예: "git diff --cached --name-status")' },
              { name: "cwd", type: "string", required: true, desc: "명령어를 실행할 작업 디렉토리" },
            ]}
          />

          {/* detectCommitType */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            detectCommitType(files)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            변경된 파일 경로 패턴을 분석하여 커밋 타입을 자동 감지합니다.
            파일명에 포함된 키워드와 git 상태 코드를 기반으로 판단합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">detectCommitType</span>(<span className="prop">files</span>: <span className="kw">readonly</span> <span className="type">string</span>[]): <span className="type">string</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "files", type: "readonly string[]", required: true, desc: "변경된 파일 목록 (git diff --name-status 형식)" },
            ]}
          />
          <div className="text-[13px] text-gray-600 mt-3 space-y-1">
            <p>&bull; 파일명에 <code className="text-cyan-600">test</code> / <code className="text-cyan-600">spec</code>이 절반 이상 &rarr; <code className="text-emerald-600">&quot;test&quot;</code></p>
            <p>&bull; 파일명에 <code className="text-cyan-600">docs/</code> 또는 <code className="text-cyan-600">.md</code>가 절반 이상 &rarr; <code className="text-emerald-600">&quot;docs&quot;</code></p>
            <p>&bull; <code className="text-cyan-600">A</code> (Added) 상태 파일이 절반 이상 &rarr; <code className="text-emerald-600">&quot;feat&quot;</code></p>
            <p>&bull; 그 외 &rarr; <code className="text-emerald-600">&quot;fix&quot;</code></p>
          </div>

          {/* extractScope */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            extractScope(files)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            변경된 파일들에서 가장 빈번한 디렉토리를 스코프로 추출합니다.
            <code className="text-cyan-600">src/</code> 하위에 있으면 두 번째 레벨 디렉토리를 사용합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">extractScope</span>(<span className="prop">files</span>: <span className="kw">readonly</span> <span className="type">string</span>[]): <span className="type">string</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "files", type: "readonly string[]", required: true, desc: "변경된 파일 목록" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">git add</code>로 스테이징하지 않은 파일은 분석 대상에 포함되지 않습니다.
              반드시 커밋하고 싶은 파일을 먼저 스테이징하세요.
            </li>
            <li>
              <code className="text-cyan-600">detectCommitType</code>은 파일명 기반 휴리스틱이므로
              실제 변경 내용과 다를 수 있습니다. LLM이 diff를 분석하여 최종 판단합니다.
            </li>
            <li>
              <code className="text-cyan-600">extractScope</code>은 <code className="text-cyan-600">src/</code> 하위에서는
              두 번째 레벨(예: <code className="text-cyan-600">src/commands</code> &rarr; <code className="text-cyan-600">commands</code>),
              그 외에는 첫 번째 레벨 디렉토리를 사용합니다.
            </li>
            <li>
              <code className="text-cyan-600">shouldInjectAsUserMessage: true</code>이므로 결과가
              에이전트에게 사용자 메시지로 주입됩니다. 이를 통해 LLM이 추가 분석과 커밋을 수행합니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 자동 커밋 메시지 생성</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            파일을 스테이징한 후 <code className="text-cyan-600">/commit</code>을 입력하면
            LLM이 diff를 분석하여 적절한 커밋 메시지를 생성하고 커밋을 실행합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. 파일 스테이징"}</span>
            {"\n"}<span className="fn">git</span> <span className="prop">add</span> <span className="str">src/commands/commit.ts</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 2. /commit 실행 → LLM이 diff 분석 후 커밋"}</span>
            {"\n"}<span className="fn">/commit</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 결과: feat(commands): add auto-generated commit message"}</span>
          </CodeBlock>

          {/* 힌트 사용법 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 사용자 힌트로 메시지 가이드
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">/commit</code> 뒤에 힌트를 추가하면
            LLM이 해당 힌트를 반영하여 커밋 메시지를 생성합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 힌트를 포함한 커밋"}</span>
            {"\n"}<span className="fn">/commit</span> <span className="str">로그인 유효성 검사 추가</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 결과: feat(auth): add login validation"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> 스테이징된 파일이 없으면 <code>/commit</code>은 실패합니다.
            반드시 <code>git add</code>로 파일을 먼저 스테이징한 후 사용하세요.
            <code>git add -p</code>로 부분 스테이징도 가능합니다.
          </Callout>

          <DeepDive title="커밋 타입 자동 감지 규칙 상세">
            <p className="mb-3">
              <code className="text-cyan-600">detectCommitType()</code>은 변경된 파일 목록을
              순차적으로 검사하여 가장 먼저 매칭되는 타입을 반환합니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><strong>test:</strong> 파일명에 &quot;test&quot; 또는 &quot;spec&quot; 포함 파일이 전체의 50% 초과</li>
              <li><strong>docs:</strong> &quot;docs/&quot; 경로이거나 &quot;.md&quot; 확장자 파일이 전체의 50% 초과</li>
              <li><strong>feat:</strong> git 상태가 &quot;A&quot; (Added)인 새 파일이 전체의 50% 초과</li>
              <li><strong>fix:</strong> 위 조건에 해당하지 않는 모든 경우 (기본값)</li>
            </ul>
            <p className="mt-3 text-amber-600">
              이 결과는 LLM에게 <strong>제안</strong>으로 전달됩니다. LLM이 실제 diff를 분석한 후
              더 적절한 타입으로 변경할 수 있습니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>프롬프트 생성 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">execute()</code> 함수는 git 명령어를 순차적으로 실행하여
            컨텍스트를 수집한 뒤 구조화된 프롬프트를 생성합니다.
          </p>

          <MermaidDiagram
            title="프롬프트 구성 요소"
            titleColor="purple"
            chart={`graph LR
  D1["git diff --cached<br/>--stat"]
  D2["git diff --cached<br/>--name-status"]
  D3["git log<br/>--oneline -5"]

  D1 --> PROMPT["프롬프트 조합"]
  D2 --> ANALYZE["타입 + 스코프<br/>자동 감지"]
  D3 --> PROMPT
  ANALYZE --> PROMPT
  PROMPT --> INJECT["LLM에 주입<br/><small>shouldInjectAsUserMessage</small>"]

  style PROMPT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style ANALYZE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style D1 fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style D2 fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style D3 fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style INJECT fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">extractScope()</code> 함수의 핵심 로직입니다.
            Map을 사용하여 디렉토리별 빈도를 집계하고 가장 빈번한 디렉토리를 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">extractScope</span>(<span className="prop">files</span>: <span className="kw">readonly</span> <span className="type">string</span>[]): <span className="type">string</span> {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">dirs</span> = <span className="kw">new</span> <span className="type">Map</span>&lt;<span className="type">string</span>, <span className="type">number</span>&gt;();
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">file</span> <span className="kw">of</span> <span className="prop">files</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// tab으로 분리된 name-status 형식 처리"}</span>
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">path</span> = <span className="prop">file</span>.<span className="fn">includes</span>(<span className="str">&quot;\\t&quot;</span>) ? <span className="prop">file</span>.<span className="fn">split</span>(<span className="str">&quot;\\t&quot;</span>)[<span className="num">1</span>] : <span className="prop">file</span>;
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">parts</span> = <span className="prop">path</span>.<span className="fn">split</span>(<span className="str">&quot;/&quot;</span>);
            {"\n"}{"    "}<span className="cm">{"// src/ 하위면 2번째 레벨, 그 외면 1번째 레벨"}</span>
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">scope</span> = <span className="prop">parts</span>[<span className="num">0</span>] === <span className="str">&quot;src&quot;</span> && <span className="prop">parts</span>.<span className="prop">length</span> {">"} <span className="num">2</span>
            {"\n"}{"      "}? <span className="prop">parts</span>[<span className="num">1</span>] : <span className="prop">parts</span>[<span className="num">0</span>];
            {"\n"}{"    "}<span className="prop">dirs</span>.<span className="fn">set</span>(<span className="prop">scope</span>, (<span className="prop">dirs</span>.<span className="fn">get</span>(<span className="prop">scope</span>) ?? <span className="num">0</span>) + <span className="num">1</span>);
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="cm">{"// 가장 빈번한 디렉토리를 반환"}</span>
            {"\n"}{"  "}<span className="kw">return</span> <span className="prop">maxDir</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">name-status 파싱:</strong> <code className="text-cyan-600">git diff --name-status</code>는 &quot;M\tsrc/commands/foo.ts&quot; 형식을 출력합니다. 탭으로 분리하여 파일 경로만 추출합니다.</p>
            <p><strong className="text-gray-900">스코프 레벨 결정:</strong> <code className="text-cyan-600">src/commands/foo.ts</code> &rarr; <code className="text-cyan-600">commands</code> (2번째 레벨), <code className="text-cyan-600">docs/guide.md</code> &rarr; <code className="text-cyan-600">docs</code> (1번째 레벨)</p>
            <p><strong className="text-gray-900">빈도 집계:</strong> Map으로 디렉토리별 파일 수를 카운팅한 뒤, 가장 많은 파일이 변경된 디렉토리를 스코프로 선택합니다.</p>
          </div>

          <DeepDive title="LLM에 주입되는 프롬프트 구조">
            <p className="mb-3">
              최종적으로 LLM에 주입되는 프롬프트는 다음 섹션으로 구성됩니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><strong>Staged Changes (stat):</strong> 변경 파일별 추가/삭제 라인 수 통계</li>
              <li><strong>Changed Files:</strong> 파일별 상태 코드(A/M/D)와 경로</li>
              <li><strong>Recent Commits:</strong> 최근 5개 커밋 메시지 (스타일 참조용)</li>
              <li><strong>Auto-detected:</strong> 자동 감지된 타입, 스코프, 제안 메시지</li>
              <li><strong>Instructions:</strong> diff 리뷰 &rarr; 메시지 생성 &rarr; git commit 실행 지시</li>
            </ul>
            <p className="mt-3 text-gray-600">
              사용자 힌트가 제공되면 <code className="text-cyan-600">User hint</code> 필드가 추가되어
              LLM이 해당 의도를 커밋 메시지에 반영합니다.
            </p>
          </DeepDive>
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
              &quot;/commit을 실행했는데 &apos;No staged changes to commit&apos;이 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">git add</code>로 파일을 스테이징하지 않은 상태입니다.
              먼저 커밋할 파일을 스테이징한 후 다시 시도하세요.
            </p>
            <CodeBlock>
              <span className="cm">{"// 특정 파일 스테이징"}</span>
              {"\n"}<span className="fn">git</span> <span className="prop">add</span> <span className="str">src/commands/commit.ts</span>
              {"\n"}
              {"\n"}<span className="cm">{"// 대화형 부분 스테이징"}</span>
              {"\n"}<span className="fn">git</span> <span className="prop">add</span> <span className="str">-p</span>
              {"\n"}
              {"\n"}<span className="cm">{"// 이제 /commit 실행"}</span>
              {"\n"}<span className="fn">/commit</span>
            </CodeBlock>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;커밋 타입이 자동 감지와 다른 결과로 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">detectCommitType()</code>은 파일명 기반 휴리스틱일 뿐입니다.
              LLM은 실제 diff 내용을 분석하여 더 적합한 타입을 선택할 수 있습니다.
              자동 감지 결과는 &quot;제안&quot;이며, LLM의 판단이 우선합니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Not a git repository 에러가 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              현재 작업 디렉토리가 git 저장소가 아닌 경우 발생합니다.
              <code className="text-cyan-600">git init</code>으로 저장소를 초기화하거나,
              git 저장소가 있는 디렉토리로 이동하세요.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;힌트를 줬는데 무시되는 것 같아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              힌트는 프롬프트의 &quot;User hint&quot; 필드로 전달되며, LLM의 Instructions 4번 항목에서
              반영하도록 지시됩니다. LLM이 diff 분석 결과와 힌트를 종합하여 판단하므로,
              힌트의 내용이 구체적일수록 더 잘 반영됩니다.
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
                name: "registry.ts",
                slug: "cmd-registry",
                relation: "parent",
                desc: "모든 슬래시 명령어를 등록하고 관리하는 레지스트리 — commitCommand도 여기에 등록됩니다",
              },
              {
                name: "review.ts",
                slug: "cmd-review",
                relation: "sibling",
                desc: "/review — 코드 변경 사항을 리뷰하는 명령어. /commit 전에 사용하면 코드 품질을 높일 수 있습니다",
              },
              {
                name: "agent-loop.ts",
                slug: "agent-loop",
                relation: "parent",
                desc: "shouldInjectAsUserMessage로 전달된 프롬프트를 처리하여 LLM이 커밋을 실행하는 메인 루프",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
