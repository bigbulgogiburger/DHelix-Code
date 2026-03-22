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

export default function CmdReviewPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/commands/review.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              /review
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            코드 변경 사항을 수집하여 LLM에게 버그, 보안, 코드 품질 관점의 체계적인 코드 리뷰를 요청하는 슬래시 명령어입니다.
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
              <code className="text-cyan-600">/review</code>는 커밋 전에 코드 변경 사항을 체계적으로 점검하는 명령어입니다.
              <code className="text-cyan-600">git diff</code>를 수집하여 LLM에게 4가지 관점(버그, 보안, 코드 품질, 에러 처리)으로
              리뷰를 요청하고, 각 이슈에 대해 심각도(CRITICAL/HIGH/MEDIUM/LOW)와 수정 제안을 받습니다.
            </p>
            <p>
              스테이징된 변경과 스테이징되지 않은 변경을 모두 수집하거나,
              <code className="text-cyan-600">--staged</code> 플래그로 스테이징된 변경만 리뷰할 수 있습니다.
              특정 파일 경로를 인자로 전달하면 해당 파일의 변경만 리뷰합니다.
            </p>
            <p>
              대용량 diff는 <code className="text-cyan-600">MAX_DIFF_SIZE</code> (50KB)로 잘라내어
              LLM 컨텍스트 윈도우를 보호합니다. 잘린 경우 LLM에게 해당 사실을 알려줍니다.
            </p>
          </div>

          <MermaidDiagram
            title="/review 실행 흐름"
            titleColor="purple"
            chart={`graph TD
  USER["사용자 입력<br/><small>/review [--staged] [file]</small>"]
  GIT["Git 저장소 확인"]
  PARSE["인자 파싱<br/><small>--staged, file path</small>"]
  DIFF["Diff 수집<br/><small>staged + unstaged</small>"]
  TRUNC["크기 검사<br/><small>50KB 초과 시 잘라내기</small>"]
  PROMPT["리뷰 프롬프트 생성<br/><small>4가지 분석 관점</small>"]
  LLM["LLM 에이전트<br/><small>코드 리뷰 수행</small>"]

  USER --> GIT
  GIT -->|"git repo 아님"| ERR["에러 반환"]
  GIT -->|"OK"| PARSE
  PARSE --> DIFF
  DIFF -->|"변경 없음"| EMPTY["No changes to review"]
  DIFF -->|"OK"| TRUNC
  TRUNC --> PROMPT
  PROMPT -->|"shouldInjectAsUserMessage"| LLM

  style PROMPT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style USER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TRUNC fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style GIT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PARSE fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style DIFF fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style EMPTY fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <Callout type="info" icon="💡">
            <strong>리뷰 관점:</strong> LLM은 4가지 카테고리로 코드를 분석합니다 &mdash;
            (1) 버그: 로직 에러, null 위험, 경계값 에러, 경쟁 조건 /
            (2) 보안: 인젝션 취약점, 노출된 비밀, 안전하지 않은 작업 /
            (3) 코드 품질: 가독성, 네이밍, 중복, 에러 처리 누락 /
            (4) 에러 처리: 처리되지 않은 예외, 누락된 엣지 케이스
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* MAX_DIFF_SIZE */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            MAX_DIFF_SIZE
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            diff 크기 제한 상수입니다. 이 값을 초과하는 diff는 잘라내어
            LLM 컨텍스트 윈도우를 보호합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">MAX_DIFF_SIZE</span> = <span className="num">50</span> * <span className="num">1024</span>; <span className="cm">{"// 50KB"}</span>
          </CodeBlock>

          {/* reviewCommand */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            reviewCommand: SlashCommand
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            <code className="text-cyan-600">/review</code> 슬래시 명령어의 정의 객체입니다.
            git diff를 수집하고 리뷰 프롬프트를 LLM에 주입합니다.
          </p>
          <ParamTable
            params={[
              { name: "name", type: '"review"', required: true, desc: "명령어 이름" },
              { name: "description", type: "string", required: true, desc: '"Review current code changes for bugs, security, and quality"' },
              { name: "usage", type: "string", required: true, desc: '"/review [--staged] [file path]"' },
              { name: "execute", type: "(args, context) => Promise<CommandResult>", required: true, desc: "명령어 실행 함수" },
            ]}
          />

          {/* gitExec */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            gitExec(cmd, cwd)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            git 명령어를 실행하고 stdout을 반환하는 내부 헬퍼 함수입니다.
            실패 시 빈 문자열을 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">gitExec</span>(<span className="prop">cmd</span>: <span className="type">string</span>, <span className="prop">cwd</span>: <span className="type">string</span>): <span className="type">string</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "cmd", type: "string", required: true, desc: "실행할 git 명령어" },
              { name: "cwd", type: "string", required: true, desc: "작업 디렉토리" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">--staged</code> 없이 실행하면 스테이징된 변경과
              스테이징되지 않은 변경을 <strong>모두</strong> 수집합니다.
              두 diff가 모두 있으면 &quot;=== Staged Changes ===&quot;와 &quot;=== Unstaged Changes ===&quot;로 구분합니다.
            </li>
            <li>
              <code className="text-cyan-600">MAX_DIFF_SIZE</code>는 <strong>바이트</strong> 기준입니다.
              <code className="text-cyan-600">Buffer.byteLength()</code>로 측정하므로
              UTF-8 멀티바이트 문자가 포함된 diff는 글자 수보다 더 빠르게 제한에 도달합니다.
            </li>
            <li>
              diff가 잘리면 <code className="text-cyan-600">string.slice()</code>로 단순 절단됩니다.
              diff 경계(hunk boundary)를 고려하지 않으므로 마지막 파일의 diff가 불완전할 수 있습니다.
            </li>
            <li>
              파일 경로 인자를 전달할 때 공백이 포함된 경로는 <code className="text-cyan-600">JSON.stringify()</code>로
              감싸서 안전하게 처리됩니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 모든 변경 리뷰</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            인자 없이 실행하면 모든 변경 사항(staged + unstaged)을 리뷰합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 모든 변경 사항 리뷰"}</span>
            {"\n"}<span className="fn">/review</span>
            {"\n"}
            {"\n"}<span className="cm">{"// LLM이 4가지 관점으로 분석하여 이슈 보고:"}</span>
            {"\n"}<span className="cm">{"// - CRITICAL: SQL injection risk in query builder"}</span>
            {"\n"}<span className="cm">{"// - HIGH: Missing null check on user.email"}</span>
            {"\n"}<span className="cm">{"// - MEDIUM: Variable name 'x' is not descriptive"}</span>
          </CodeBlock>

          {/* 스테이징 전용 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 스테이징된 변경만 리뷰
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">--staged</code> 플래그로 커밋 예정인 변경만 집중적으로 리뷰할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 스테이징된 변경만 리뷰 (커밋 전 최종 점검)"}</span>
            {"\n"}<span className="fn">/review</span> <span className="prop">--staged</span>
          </CodeBlock>

          {/* 특정 파일 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 특정 파일만 리뷰
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            파일 경로를 인자로 전달하면 해당 파일의 변경만 리뷰합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 특정 파일 리뷰"}</span>
            {"\n"}<span className="fn">/review</span> <span className="str">src/commands/review.ts</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 스테이징된 특정 파일만 리뷰"}</span>
            {"\n"}<span className="fn">/review</span> <span className="prop">--staged</span> <span className="str">src/core/agent-loop.ts</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> diff가 50KB를 초과하면 자동으로 잘립니다.
            대규모 리팩토링 시에는 파일별로 나눠서 리뷰하는 것이 더 정확한 결과를 얻을 수 있습니다.
          </Callout>

          <DeepDive title="리뷰 결과 활용 팁">
            <p className="mb-3">
              <code className="text-cyan-600">/review</code>의 결과를 최대한 활용하는 방법:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><strong>커밋 전 점검:</strong> <code>/review --staged</code> &rarr; 이슈 수정 &rarr; <code>/commit</code></li>
              <li><strong>PR 준비:</strong> 전체 변경을 리뷰한 후 CRITICAL/HIGH 이슈를 우선 수정</li>
              <li><strong>학습:</strong> MEDIUM/LOW 이슈의 수정 제안을 참고하여 코딩 습관 개선</li>
            </ul>
            <p className="mt-3 text-amber-600">
              CRITICAL 이슈가 있으면 <strong>반드시</strong> 수정 후 커밋하세요.
              보안 취약점이나 심각한 버그는 코드 리뷰로 사전에 차단하는 것이 가장 효과적입니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>Diff 수집 전략</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            인자에 따라 서로 다른 git diff 명령어 조합을 사용합니다.
            staged와 unstaged diff를 모두 수집할 때는 구분자를 넣어 LLM이 구별할 수 있도록 합니다.
          </p>

          <MermaidDiagram
            title="Diff 수집 분기 로직"
            titleColor="purple"
            chart={`graph TD
  INPUT["인자 파싱<br/><small>--staged, filePath</small>"]

  INPUT -->|"--staged"| STAGED_ONLY["git diff --cached<br/><small>스테이징된 변경만</small>"]
  INPUT -->|"기본"| BOTH["두 diff 모두 수집"]

  BOTH --> S["git diff --cached<br/><small>staged</small>"]
  BOTH --> U["git diff<br/><small>unstaged</small>"]

  S --> MERGE["병합<br/><small>=== Staged ===<br/>=== Unstaged ===</small>"]
  U --> MERGE

  STAGED_ONLY --> SIZE["크기 검사<br/><small>50KB 제한</small>"]
  MERGE --> SIZE

  SIZE -->|"초과"| TRUNC["잘라내기 + 경고"]
  SIZE -->|"OK"| PASS["그대로 전달"]

  style INPUT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style SIZE fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style STAGED_ONLY fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style BOTH fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style S fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style U fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style MERGE fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TRUNC fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style PASS fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            diff 수집과 병합의 핵심 로직입니다.
            staged와 unstaged 모두 존재할 때만 구분자를 넣어 병합합니다.
          </p>
          <CodeBlock>
            <span className="kw">if</span> (<span className="prop">stagedOnly</span>) {"{"}
            {"\n"}{"  "}<span className="prop">diff</span> = <span className="fn">gitExec</span>(<span className="str">`git diff --cached${"{"}<span className="prop">pathArg</span>{"}"}`</span>, <span className="prop">cwd</span>);
            {"\n"}{"}"} <span className="kw">else</span> {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">unstaged</span> = <span className="fn">gitExec</span>(<span className="str">`git diff${"{"}<span className="prop">pathArg</span>{"}"}`</span>, <span className="prop">cwd</span>);
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">staged</span> = <span className="fn">gitExec</span>(<span className="str">`git diff --cached${"{"}<span className="prop">pathArg</span>{"}"}`</span>, <span className="prop">cwd</span>);
            {"\n"}
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">staged</span> && <span className="prop">unstaged</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// 두 diff를 구분자로 병합"}</span>
            {"\n"}{"    "}<span className="prop">diff</span> = <span className="str">`=== Staged Changes ===\n${"{"}<span className="prop">staged</span>{"}"}\n\n=== Unstaged Changes ===\n${"{"}<span className="prop">unstaged</span>{"}"}`</span>;
            {"\n"}{"  "}<span className="kw">{"}"} else {"{"}</span>
            {"\n"}{"    "}<span className="prop">diff</span> = <span className="prop">staged</span> || <span className="prop">unstaged</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">staged 우선:</strong> <code className="text-cyan-600">staged || unstaged</code>에서 staged가 먼저 평가되므로, staged만 있으면 staged diff를 사용합니다.</p>
            <p><strong className="text-gray-900">구분자 삽입:</strong> 두 diff가 모두 있을 때만 &quot;=== Staged/Unstaged ===&quot; 구분자를 삽입하여 LLM이 구별할 수 있게 합니다.</p>
            <p><strong className="text-gray-900">크기 보호:</strong> <code className="text-cyan-600">Buffer.byteLength()</code>로 바이트 크기를 측정하여 50KB를 초과하면 <code className="text-cyan-600">string.slice()</code>로 잘라냅니다.</p>
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
              &quot;/review를 실행했는데 &apos;No changes to review&apos;가 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              스테이징된 변경도, 스테이징되지 않은 변경도 없는 상태입니다.
              파일을 수정하거나 <code className="text-cyan-600">git add</code>한 후 다시 시도하세요.
              이미 커밋된 변경은 <code className="text-cyan-600">/review</code>로 리뷰할 수 없습니다.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;diff가 잘렸다는 메시지가 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              diff 크기가 50KB를 초과한 경우입니다. 파일별로 나눠서 리뷰하세요:
            </p>
            <CodeBlock>
              <span className="cm">{"// 파일별로 나눠서 리뷰"}</span>
              {"\n"}<span className="fn">/review</span> <span className="str">src/core/agent-loop.ts</span>
              {"\n"}<span className="fn">/review</span> <span className="str">src/core/context-manager.ts</span>
            </CodeBlock>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;--staged와 파일 경로를 동시에 쓸 수 있나요?&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              네, 가능합니다. <code className="text-cyan-600">/review --staged src/app.ts</code>처럼
              조합하면 해당 파일의 스테이징된 변경만 리뷰합니다.
              인자 순서는 자유이며, <code className="text-cyan-600">--staged</code>가 아닌 인자가 파일 경로로 인식됩니다.
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
                desc: "모든 슬래시 명령어를 등록하고 관리하는 레지스트리 — reviewCommand도 여기에 등록됩니다",
              },
              {
                name: "commit.ts",
                slug: "cmd-commit",
                relation: "sibling",
                desc: "/commit — /review로 코드를 점검한 후 커밋할 때 사용하는 명령어",
              },
              {
                name: "secret-scanner.ts",
                slug: "secret-scanner",
                relation: "sibling",
                desc: "비밀 정보(API 키, 토큰) 탐지 모듈 — /review의 보안 점검을 보완하는 가드레일",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
