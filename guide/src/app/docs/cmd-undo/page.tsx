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

export default function CmdUndoPage() {
  return (
    <div className="min-h-screen pt-10 pb-20">
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/undo.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/undo</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              git restore를 사용하여 파일 변경을 되돌리는 슬래시 명령어입니다. 특정 파일 또는 모든
              변경을 마지막 커밋 상태로 복원합니다.
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
                <code className="text-cyan-600">/undo</code> 명령어는 LLM이 잘못 수정한 파일을
                빠르게 되돌리고 싶을 때 사용합니다. 내부적으로{" "}
                <code className="text-cyan-600">git checkout --</code>
                명령을 사용하여 워킹 디렉토리의 파일을 마지막 커밋 상태로 복원합니다.
              </p>
              <p>
                세 가지 모드로 동작합니다: 인자 없이 실행하면 수정된 파일 목록을 표시하고, 특정 파일
                경로를 지정하면 해당 파일만 복원하며,
                <code className="text-cyan-600">all</code>을 지정하면 모든 변경을 한꺼번에
                되돌립니다.
              </p>
              <p>
                비슷한 명령어인 <code className="text-cyan-600">/rewind</code>와의 차이점을 이해하는
                것이 중요합니다.
                <code className="text-cyan-600">/undo</code>는 git의 마지막 커밋 상태로 돌아가지만,
                <code className="text-cyan-600">/rewind</code>는 dhelix 체크포인트(LLM 수정 전)
                상태로 돌아갑니다.
              </p>
            </div>

            <MermaidDiagram
              title="/undo 실행 분기"
              titleColor="purple"
              chart={`graph TD
  USER["사용자 입력<br/><small>/undo [target]</small>"]
  CMD["undoCommand.execute()<br/><small>commands/undo.ts</small>"]
  GIT_CHECK["git rev-parse --git-dir<br/><small>git 저장소 확인</small>"]

  CMD --> GIT_CHECK
  GIT_CHECK -->|"git 아님"| ERR["에러 반환<br/><small>Not a git repository</small>"]
  GIT_CHECK -->|"git 확인"| BRANCH{{"target 확인"}}

  BRANCH -->|"빈 문자열"| LIST["git diff --name-only<br/><small>수정 파일 목록</small>"]
  BRANCH -->|'"all"'| RESTORE_ALL["git checkout -- .<br/><small>모든 변경 되돌리기</small>"]
  BRANCH -->|"파일 경로"| RESTORE_ONE["git checkout -- file<br/><small>특정 파일 되돌리기</small>"]

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style GIT_CHECK fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style BRANCH fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style LIST fill:#dcfce7,stroke:#10b981,color:#065f46
  style RESTORE_ALL fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style RESTORE_ONE fill:#dcfce7,stroke:#10b981,color:#065f46
  style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 문서 편집기의 &quot;되돌리기(Ctrl+Z)&quot;와 비슷하지만,
              <code>/undo</code>는 파일 전체를 마지막 저장(커밋) 상태로 되돌립니다. 부분적인 수정
              취소가 아니라 &quot;전체 파일 원복&quot;이라는 점을 기억하세요.
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

            {/* undoCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              const undoCommand: SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">/undo</code> 슬래시 명령어의 등록 객체입니다. git
              명령어를 <code className="text-cyan-600">execSync</code>로 동기 실행합니다.
            </p>
            <ParamTable
              params={[
                { name: "name", type: '"undo"', required: true, desc: "명령어 이름" },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: '"Undo file changes (git restore)"',
                },
                {
                  name: "usage",
                  type: "string",
                  required: true,
                  desc: '"/undo [file path | all]"',
                },
                {
                  name: "execute",
                  type: "(args, context) => Promise<CommandResult>",
                  required: true,
                  desc: "명령어 실행 함수",
                },
              ]}
            />

            {/* execute 인자 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              execute(args, context)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">args</code>에 따라 세 가지 모드로 동작합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "args (빈 문자열)",
                  type: "string",
                  required: false,
                  desc: "수정된 파일 목록을 표시합니다 (git diff --name-only + --cached)",
                },
                {
                  name: 'args ("all")',
                  type: "string",
                  required: false,
                  desc: "모든 수정된 파일을 마지막 커밋 상태로 복원합니다 (git checkout -- .)",
                },
                {
                  name: "args (파일 경로)",
                  type: "string",
                  required: false,
                  desc: "지정된 파일만 마지막 커밋 상태로 복원합니다 (git checkout -- <file>)",
                },
                {
                  name: "context.workingDirectory",
                  type: "string",
                  required: true,
                  desc: "git 명령어를 실행할 작업 디렉토리 (cwd)",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>git 저장소 필수:</strong> git 저장소가 아닌 디렉토리에서는 &quot;Not a git
                repository&quot; 에러가 반환됩니다.
              </li>
              <li>
                <code className="text-cyan-600">/undo all</code>은{" "}
                <strong>되돌릴 수 없습니다</strong>. 커밋하지 않은 모든 변경이 영구적으로
                사라집니다. 신중하게 사용하세요.
              </li>
              <li>
                <code className="text-cyan-600">execSync</code>를 사용하므로 대규모 저장소에서는
                잠시 블로킹될 수 있습니다. 비동기 <code className="text-cyan-600">exec</code>가 아닌
                동기 호출을 사용하는 이유는 명령어의 결과를 즉시 반환해야 하기 때문입니다.
              </li>
              <li>
                파일 목록 표시 시 <code className="text-cyan-600">git diff --name-only</code>와
                <code className="text-cyan-600">git diff --cached --name-only</code>를 합산하여
                스테이지된 파일과 미스테이지된 파일을 모두 보여줍니다.
                <code className="text-cyan-600">Set</code>으로 중복을 제거합니다.
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

            {/* 파일 목록 확인 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 수정된 파일 목록 확인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자 없이 실행하면 되돌릴 수 있는 수정된 파일 목록을 보여줍니다.
            </p>
            <CodeBlock>
              <span className="fn">/undo</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력:"}</span>
              {"\n"}
              <span className="cm">{"// Modified files:"}</span>
              {"\n"}
              <span className="cm">{"//   src/core/agent-loop.ts"}</span>
              {"\n"}
              <span className="cm">{"//   src/tools/executor.ts"}</span>
              {"\n"}
              <span className="cm">{"// "}</span>
              {"\n"}
              <span className="cm">{"// Usage: /undo <file> to revert a specific file"}</span>
              {"\n"}
              <span className="cm">{"//        /undo all  to revert all changes"}</span>
            </CodeBlock>

            {/* 특정 파일 되돌리기 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              특정 파일 되돌리기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              파일 경로를 지정하여 해당 파일만 마지막 커밋 상태로 복원합니다.
            </p>
            <CodeBlock>
              <span className="fn">/undo</span> <span className="str">src/core/agent-loop.ts</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력: Reverted: src/core/agent-loop.ts"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>/undo all</code>은 모든 변경을{" "}
              <strong>영구적으로</strong> 되돌립니다. 실행 취소가 불가능하므로, 중요한 변경이 있다면
              먼저 <code>git stash</code>로 저장하세요.
            </Callout>

            {/* 모든 변경 되돌리기 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              모든 변경 되돌리기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">all</code> 키워드로 모든 수정된 파일을 한꺼번에
              되돌립니다.
            </p>
            <CodeBlock>
              <span className="fn">/undo</span> <span className="str">all</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력: All file changes reverted."}</span>
            </CodeBlock>

            <DeepDive title="/undo vs /rewind 차이점 상세">
              <p className="mb-3">두 명령어 모두 &quot;되돌리기&quot;이지만 기준점이 다릅니다:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>/undo</strong> &mdash; git의 마지막 커밋 상태로 복원.{" "}
                  <code>git checkout --</code> 사용
                </li>
                <li>
                  <strong>/rewind</strong> &mdash; dhelix 체크포인트(LLM이 수정하기 전) 상태로 복원.
                  내부 체크포인트 시스템 사용
                </li>
              </ul>
              <p className="mt-3 text-gray-600">예를 들어, 커밋 후 LLM이 파일을 3번 수정했다면:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 mt-2">
                <li>
                  <code>/undo</code> &rarr; 커밋 시점으로 돌아감 (3번의 수정 모두 취소)
                </li>
                <li>
                  <code>/rewind</code> &rarr; LLM이 수정하기 직전 체크포인트로 돌아감 (점진적 취소
                  가능)
                </li>
              </ul>
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
              git 명령어 매핑
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              각 모드에서 실행되는 git 명령어입니다. 모든 명령어는{" "}
              <code className="text-cyan-600">execSync</code>로 동기 실행되며,
              <code className="text-cyan-600">cwd</code>는{" "}
              <code className="text-cyan-600">context.workingDirectory</code>입니다.
            </p>

            <MermaidDiagram
              title="모드별 git 명령어 매핑"
              titleColor="purple"
              chart={`graph LR
  VERIFY["git rev-parse --git-dir<br/><small>저장소 확인</small>"]
  LIST["git diff --name-only<br/>+ git diff --cached --name-only<br/><small>파일 목록</small>"]
  SINGLE["git checkout -- file<br/><small>단일 파일 복원</small>"]
  ALL["git checkout -- .<br/><small>전체 복원</small>"]

  VERIFY -->|"성공"| LIST
  VERIFY -->|"성공"| SINGLE
  VERIFY -->|"성공"| ALL

  style VERIFY fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LIST fill:#dcfce7,stroke:#10b981,color:#065f46
  style SINGLE fill:#dcfce7,stroke:#10b981,color:#065f46
  style ALL fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              파일 목록을 구성하는 로직입니다. staged와 unstaged 변경을 합산하고 중복을 제거합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// [1] unstaged 변경 파일"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">diff</span> ={" "}
              <span className="fn">execSync</span>(
              <span className="str">&quot;git diff --name-only&quot;</span>, {"{"}{" "}
              <span className="prop">cwd</span>, ... {"}"}).<span className="fn">trim</span>();
              {"\n"}
              <span className="cm">{"// [2] staged 변경 파일"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">staged</span> ={" "}
              <span className="fn">execSync</span>(
              <span className="str">&quot;git diff --cached --name-only&quot;</span>, {"{"}{" "}
              <span className="prop">cwd</span>, ... {"}"}).<span className="fn">trim</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// [3] Set으로 중복 제거 후 합산"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">allFiles</span> = [{"\n"}
              {"  "}...<span className="kw">new</span> <span className="fn">Set</span>([
              {"\n"}
              {"    "}...(<span className="prop">diff</span> ? <span className="prop">diff</span>.
              <span className="fn">split</span>(<span className="str">&quot;\n&quot;</span>) : []),
              {"\n"}
              {"    "}...(<span className="prop">staged</span> ?{" "}
              <span className="prop">staged</span>.<span className="fn">split</span>(
              <span className="str">&quot;\n&quot;</span>) : []),
              {"\n"}
              {"  "}]),
              {"\n"}];
              {"\n"}
              {"\n"}
              <span className="cm">{"// [4] 수정 파일이 없으면 안내 메시지"}</span>
              {"\n"}
              <span className="kw">if</span> (<span className="prop">allFiles</span>.
              <span className="prop">length</span> === <span className="num">0</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> {"{"} <span className="prop">output</span>:{" "}
              <span className="str">&quot;No modified files to undo.&quot;</span>,{" "}
              <span className="prop">success</span>: <span className="kw">true</span> {"}"};{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1-2]</strong>{" "}
                <code className="text-cyan-600">git diff --name-only</code>는 unstaged,{" "}
                <code className="text-cyan-600">--cached</code>는 staged 변경을 반환합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 같은 파일이 staged이면서 unstaged일
                수 있으므로 <code className="text-cyan-600">Set</code>으로 중복을 제거합니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> 변경이 없으면 &quot;No modified
                files&quot; 메시지를 <code className="text-cyan-600">success: true</code>로
                반환합니다 (에러가 아님).
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
                &quot;Not a git repository 에러가 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                현재 작업 디렉토리가 git 저장소가 아닙니다.{" "}
                <code className="text-cyan-600">/undo</code>는 git에 의존하므로,{" "}
                <code>git init</code>이 된 프로젝트에서만 사용할 수 있습니다.
                <code className="text-cyan-600">context.workingDirectory</code>가 올바른 프로젝트
                루트를 가리키고 있는지 확인하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;/undo all 후에 되돌릴 수 없나요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">git checkout -- .</code>은 워킹 디렉토리의 변경을
                영구적으로 삭제합니다. git reflog에도 기록되지 않으므로 복구가 불가능합니다. 중요한
                변경이 있다면 <code>/undo</code> 전에 <code>git stash</code>를 실행하거나,
                <code>/rewind</code>(체크포인트 기반)를 사용하는 것이 더 안전합니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;새로 추가한 파일(untracked)은 /undo로 삭제되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">git checkout --</code>은 추적 중인(tracked) 파일의
                변경만 되돌립니다. 새로 생성된 untracked 파일은 <code>git diff</code>에 나타나지
                않으며,
                <code>git clean -f</code>를 별도로 실행해야 삭제됩니다.
                <code>/undo</code>는 안전을 위해 untracked 파일 삭제를 지원하지 않습니다.
              </p>
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
                  name: "checkpoint-manager.ts",
                  slug: "checkpoint-manager",
                  relation: "sibling",
                  desc: "/rewind 명령어가 사용하는 체크포인트 시스템 — LLM 수정 전 상태를 스냅샷으로 저장",
                },
                {
                  name: "registry.ts",
                  slug: "cmd-registry",
                  relation: "parent",
                  desc: "SlashCommand 인터페이스 정의 및 명령어 등록/실행을 관리하는 레지스트리",
                },
                {
                  name: "tool-bash-exec.ts",
                  slug: "tool-bash-exec",
                  relation: "sibling",
                  desc: "/undo가 내부적으로 사용하는 것과 유사한 셸 명령 실행 패턴",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
