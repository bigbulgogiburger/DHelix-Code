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

export default function CmdDiffPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/diff.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/diff</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
              <span
                className="text-xs font-semibold rounded-md bg-cyan-100 text-cyan-700"
                style={{ padding: "5px 14px" }}
              >
                Slash Command
              </span>
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              git 변경 사항을 스테이징(staged)과 언스테이징(unstaged)으로 구분하여 파일별 추가/삭제
              줄 수와 함께 포맷된 요약을 보여주는 슬래시 명령어입니다.
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
                <code className="text-cyan-600">/diff</code> 명령어는 현재 작업 디렉토리의 git 변경
                사항을 한 눈에 파악할 수 있도록 정리된 요약을 제공합니다. 터미널에서{" "}
                <code className="text-cyan-600">git diff --numstat</code>을 직접 실행하지 않아도,
                대화 중에 바로 변경 현황을 확인할 수 있습니다.
              </p>
              <p>
                변경 사항은 <strong>Unstaged</strong>(아직 git add하지 않은 것)와{" "}
                <strong>Staged</strong>(커밋 대기 중인 것) 두 그룹으로 나뉘어 표시되며, 각 파일의
                추가/삭제 줄 수와 전체 통계가 포함됩니다.
              </p>
              <p>
                특정 파일 경로를 인자로 전달하면 해당 파일의 변경 사항만 필터링하여 볼 수도
                있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="/diff 명령어 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  USER["/diff 입력"] --> CMD["diffCommand.execute()"]
  CMD --> GIT_CHECK["git rev-parse<br/><small>git 저장소 확인</small>"]
  GIT_CHECK -->|"실패"| ERR["에러: Not a git repository"]
  GIT_CHECK -->|"성공"| UNSTAGED["git diff --numstat<br/><small>언스테이징 변경</small>"]
  UNSTAGED --> STAGED["git diff --cached --numstat<br/><small>스테이징 변경</small>"]
  STAGED --> PARSE["parseNumstat()<br/><small>DiffEntry[] 변환</small>"]
  PARSE --> FORMAT["formatEntry()<br/><small>포맷된 요약 생성</small>"]
  FORMAT --> OUTPUT["파일 수 + 추가/삭제 통계 출력"]

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PARSE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style FORMAT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style OUTPUT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> <code>/diff</code>는 마치 코드 변경의 &quot;영수증&quot;과
              같습니다. 어떤 파일에서 몇 줄이 추가되고 삭제되었는지, 그리고 커밋 준비가 된 것과 아직
              안 된 것이 무엇인지를 한 장의 요약으로 보여줍니다.
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

            {/* DiffEntry interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface DiffEntry
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">git diff --numstat</code> 출력에서 파싱된 단일 파일의
              변경 정보입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "additions",
                  type: "number",
                  required: true,
                  desc: "추가된 줄 수 (바이너리 파일은 0)",
                },
                {
                  name: "deletions",
                  type: "number",
                  required: true,
                  desc: "삭제된 줄 수 (바이너리 파일은 0)",
                },
                { name: "file", type: "string", required: true, desc: "변경된 파일 경로" },
              ]}
            />

            {/* parseNumstat */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              parseNumstat(output)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">git diff --numstat</code>의 원시 출력을 구조화된
              DiffEntry 배열로 변환합니다. 바이너리 파일은 추가/삭제 수가{" "}
              <code className="text-cyan-600">&quot;-&quot;</code>로 표시되므로 0으로 처리합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">parseNumstat</span>(
              <span className="prop">output</span>: <span className="type">string</span>):{" "}
              <span className="kw">readonly</span> <span className="type">DiffEntry</span>[]
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "output",
                  type: "string",
                  required: true,
                  desc: "git diff --numstat의 원시 출력 문자열",
                },
              ]}
            />

            {/* formatEntry */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              formatEntry(entry, prefix)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              단일 diff 항목을 포맷된 한 줄 문자열로 변환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">formatEntry</span>(
              <span className="prop">entry</span>: <span className="type">DiffEntry</span>,{" "}
              <span className="prop">prefix</span>: <span className="type">string</span>):{" "}
              <span className="type">string</span>
              {"\n"}
              <span className="cm">{'// 예: "    M src/index.ts    (+5, -3)"'}</span>
            </CodeBlock>
            <ParamTable
              params={[
                { name: "entry", type: "DiffEntry", required: true, desc: "diff 항목" },
                {
                  name: "prefix",
                  type: "string",
                  required: true,
                  desc: '상태 접두사 ("M"=수정됨, "A"=스테이징됨)',
                },
              ]}
            />

            {/* diffCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              diffCommand: SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">/diff</code> 슬래시 명령어의 메인 정의 객체입니다.
            </p>
            <ParamTable
              params={[
                { name: "name", type: '"diff"', required: true, desc: "명령어 이름" },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: '"Show git diff of current changes"',
                },
                { name: "usage", type: "string", required: true, desc: '"/diff [file path]"' },
                {
                  name: "execute",
                  type: "(args, context) => Promise<CommandResult>",
                  required: true,
                  desc: "명령어 실행 핸들러",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">execSync</code>를 사용하여 동기적으로 git 명령을
                실행합니다. 대규모 저장소에서는 약간의 블로킹이 발생할 수 있습니다.
              </li>
              <li>
                git이 설치되어 있지 않거나 git 저장소가 아닌 디렉토리에서 실행하면
                <code className="text-red-600"> &quot;Not a git repository&quot;</code> 에러를
                반환합니다.
              </li>
              <li>
                바이너리 파일의 추가/삭제 줄 수는 git이{" "}
                <code className="text-cyan-600">&quot;-&quot;</code>로 표시하므로 항상 0으로
                처리됩니다.
              </li>
              <li>
                파일 이름에 탭 문자가 포함된 경우도{" "}
                <code className="text-cyan-600">fileParts.join(&quot;\t&quot;)</code>로 올바르게
                처리됩니다.
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
              기본 사용법 &mdash; 전체 변경 사항 확인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자 없이 <code className="text-cyan-600">/diff</code>만 입력하면 현재 작업 디렉토리의
              모든 변경 사항을 요약합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 입력"}</span>
              {"\n"}
              <span className="str">/diff</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 예시"}</span>
              {"\n"}
              <span className="prop">Changes in working directory</span>
              {"\n"}
              <span className="prop">=============================</span>
              {"\n"}
              {"\n"}
              {"  "}
              <span className="prop">Modified: 3 files (+42, -15)</span>
              {"\n"}
              {"\n"}
              {"  "}
              <span className="prop">Unstaged:</span>
              {"\n"}
              {"    "}
              <span className="fn">M</span> <span className="type">src/index.ts</span>
              {"    "}
              <span className="str">(+12, -3)</span>
              {"\n"}
              {"    "}
              <span className="fn">M</span> <span className="type">src/utils.ts</span>
              {"    "}
              <span className="str">(+8, -7)</span>
              {"\n"}
              {"\n"}
              {"  "}
              <span className="prop">Staged:</span>
              {"\n"}
              {"    "}
              <span className="fn">A</span> <span className="type">src/config.ts</span>
              {"    "}
              <span className="str">(+22, -5)</span>
              {"\n"}
              {"\n"}
              {"  "}
              <span className="prop">Total: 3 files, +42 / -15</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> git 저장소가 아닌 디렉토리에서 실행하면 에러 메시지가
              표시됩니다. 반드시 git으로 관리되는 프로젝트 내에서 사용하세요.
            </Callout>

            {/* 특정 파일 필터링 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 특정 파일만 확인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              파일 경로를 인자로 전달하면 해당 파일의 변경 사항만 보여줍니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 특정 파일만 확인"}</span>
              {"\n"}
              <span className="str">/diff src/index.ts</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 변경 없는 파일을 지정하면"}</span>
              {"\n"}
              <span className="str">/diff README.md</span>
              {"\n"}
              <span className="cm">{'// → "No changes detected for: README.md"'}</span>
            </CodeBlock>

            <DeepDive title="출력 포맷 상세">
              <p className="mb-3">
                출력은 <strong>3개 섹션</strong>으로 구성됩니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>헤더</strong>: 전체 파일 수와 추가/삭제 합계
                </li>
                <li>
                  <strong>Unstaged</strong>: <code className="text-cyan-600">M</code> 접두사로
                  수정된 파일 목록
                </li>
                <li>
                  <strong>Staged</strong>: <code className="text-cyan-600">A</code> 접두사로
                  스테이징된 파일 목록
                </li>
              </ul>
              <p className="mt-3 text-gray-600">
                중복 파일(staged와 unstaged 양쪽에 있는 파일)은{" "}
                <code className="text-cyan-600">Set</code>으로 중복 제거하여 전체 파일 수에는 한
                번만 카운트됩니다.
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
              처리 파이프라인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">/diff</code> 명령어는 git CLI를 직접 호출하여 변경
              데이터를 수집하고 파싱한 뒤 포맷팅합니다.
            </p>

            <MermaidDiagram
              title="/diff 데이터 파이프라인"
              titleColor="purple"
              chart={`graph LR
  GIT_CMD["git diff --numstat"] --> RAW["원시 출력<br/><small>탭 구분 텍스트</small>"]
  RAW --> PARSE["parseNumstat()<br/><small>DiffEntry[] 변환</small>"]
  PARSE --> CALC["통계 계산<br/><small>Set 중복 제거</small>"]
  CALC --> FMT["formatEntry()<br/><small>줄별 포맷</small>"]
  FMT --> OUT["최종 출력"]

  style PARSE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CALC fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style FMT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">parseNumstat()</code> 함수의 파싱 로직입니다. git의{" "}
              <code className="text-cyan-600">--numstat</code>{" "}
              형식(&quot;추가수\t삭제수\t파일경로&quot;)을 구조화합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">parseNumstat</span>(
              <span className="prop">output</span>: <span className="type">string</span>):{" "}
              <span className="kw">readonly</span> <span className="type">DiffEntry</span>[] {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 빈 출력이면 빈 배열 반환"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (!<span className="prop">output</span>.
              <span className="fn">trim</span>()) <span className="kw">return</span> [];
              {"\n"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">output</span>.
              <span className="fn">trim</span>().<span className="fn">split</span>(
              <span className="str">&quot;\n&quot;</span>){"\n"}
              {"    "}.<span className="fn">filter</span>(<span className="prop">line</span> =&gt;{" "}
              <span className="prop">line</span>.<span className="fn">trim</span>().
              <span className="prop">length</span> &gt; <span className="num">0</span>){"\n"}
              {"    "}.<span className="fn">map</span>(<span className="prop">line</span> =&gt;{" "}
              {"{"}
              {"\n"}
              {"      "}
              <span className="cm">{"// [2] 탭으로 분리: 추가수, 삭제수, 파일경로"}</span>
              {"\n"}
              {"      "}
              <span className="kw">const</span> [<span className="prop">addStr</span>,{" "}
              <span className="prop">delStr</span>, ...<span className="prop">fileParts</span>] ={" "}
              <span className="prop">line</span>.<span className="fn">split</span>(
              <span className="str">&quot;\t&quot;</span>);
              {"\n"}
              {"      "}
              <span className="cm">{'// [3] 바이너리는 "-" → 0으로 처리'}</span>
              {"\n"}
              {"      "}
              <span className="kw">const</span> <span className="prop">additions</span> ={" "}
              <span className="prop">addStr</span> === <span className="str">&quot;-&quot;</span> ?{" "}
              <span className="num">0</span> : <span className="fn">parseInt</span>(
              <span className="prop">addStr</span>, <span className="num">10</span>);
              {"\n"}
              {"      "}
              <span className="kw">const</span> <span className="prop">deletions</span> ={" "}
              <span className="prop">delStr</span> === <span className="str">&quot;-&quot;</span> ?{" "}
              <span className="num">0</span> : <span className="fn">parseInt</span>(
              <span className="prop">delStr</span>, <span className="num">10</span>);
              {"\n"}
              {"      "}
              <span className="cm">{"// [4] 파일명에 탭이 있을 수 있으므로 join"}</span>
              {"\n"}
              {"      "}
              <span className="kw">const</span> <span className="prop">file</span> ={" "}
              <span className="prop">fileParts</span>.<span className="fn">join</span>(
              <span className="str">&quot;\t&quot;</span>);
              {"\n"}
              {"      "}
              <span className="kw">return</span> {"{"} <span className="prop">additions</span>,{" "}
              <span className="prop">deletions</span>, <span className="prop">file</span> {"}"};
              {"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"    "}.<span className="fn">filter</span>((<span className="prop">entry</span>):{" "}
              <span className="prop">entry</span> <span className="kw">is</span>{" "}
              <span className="type">DiffEntry</span> =&gt; <span className="prop">entry</span> !=={" "}
              <span className="kw">null</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 빈 출력(변경 없음)은 즉시 빈 배열을
                반환하여 불필요한 파싱을 건너뜁니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> git의 numstat 형식은 탭으로
                구분됩니다. <code className="text-cyan-600">destructuring</code>으로 깔끔하게
                분리합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 바이너리 파일은 줄 수를 셀 수 없어{" "}
                <code className="text-cyan-600">&quot;-&quot;</code>로 표시됩니다. 숫자 0으로
                안전하게 변환합니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> 파일 이름에 탭이 포함될 수 있는 극히
                드문 경우를 대비하여 나머지 부분을 다시 join합니다.
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
                &quot;Not a git repository (or git is not installed) 에러가 나요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                두 가지 원인이 있습니다:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>git 미설치:</strong> 시스템에 git이 설치되어 있는지 확인하세요.
                  <code className="text-cyan-600">git --version</code>으로 확인할 수 있습니다.
                </li>
                <li>
                  <strong>git 저장소 아님:</strong> 현재 작업 디렉토리가{" "}
                  <code className="text-cyan-600">.git</code> 폴더를 포함하고 있는지 확인하세요.{" "}
                  <code className="text-cyan-600">git init</code>으로 초기화할 수 있습니다.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;바이너리 파일의 줄 수가 항상 0으로 표시돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                정상입니다. git은 이미지, PDF 등 바이너리 파일의 줄 수를 셀 수 없으므로
                <code className="text-cyan-600">&quot;-&quot;</code>로 표시합니다.
                <code className="text-cyan-600">/diff</code>는 이를 0으로 변환하여 안전하게
                처리합니다. 바이너리 파일도 파일 목록에는 정상적으로 나타납니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;No changes detected라고 나오는데 분명히 파일을 수정했어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                이미 <code className="text-cyan-600">git commit</code>을 한 후라면 diff에 표시되지
                않습니다. 커밋 전의 변경 사항만 <code className="text-cyan-600">/diff</code>에
                나타납니다. 또한 <code className="text-cyan-600">.gitignore</code>에 포함된 파일도
                git이 추적하지 않으므로 표시되지 않습니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;특정 파일 경로로 필터링했는데 아무것도 안 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                경로가 정확한지 확인하세요. 상대 경로를 사용해야 하며, git의 작업 트리 기준입니다.
                예를 들어 <code className="text-cyan-600">/diff src/index.ts</code>처럼 프로젝트
                루트부터의 경로를 사용합니다.
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
                  name: "commands/registry.ts",
                  slug: "cmd-registry",
                  relation: "parent",
                  desc: "모든 슬래시 명령어를 등록하고 실행하는 레지스트리",
                },
                {
                  name: "commands/commit.ts",
                  slug: "cmd-commit",
                  relation: "sibling",
                  desc: "/commit 명령어 — diff 확인 후 커밋을 생성하는 관련 명령어",
                },
                {
                  name: "checkpoint-manager.ts",
                  slug: "checkpoint-manager",
                  relation: "sibling",
                  desc: "파일 변경 전 자동 체크포인트 — /diff와 함께 변경 추적에 활용",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
