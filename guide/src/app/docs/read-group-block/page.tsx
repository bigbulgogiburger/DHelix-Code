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

export default function ReadGroupBlockPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/components/ReadGroupBlock.tsx" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">ReadGroupBlock</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              에이전트가 연속으로 읽은 여러 파일을 하나의 그룹으로 압축하여 표시하는 컴포넌트입니다.
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
                <code className="text-cyan-600">ReadGroupBlock</code>은 에이전트가 여러 파일을
                연속으로 읽을 때 각각을 개별 표시하면 화면이 너무 길어지는 문제를 해결합니다.
                &quot;Read 5 files&quot;처럼 하나의 블록으로 압축하여 보여줍니다.
              </p>
              <p>
                두 가지 표시 모드를 지원합니다:
                <strong>축소 모드</strong>(기본)에서는 &quot;Read N files&quot; 헤더와 처음 3개
                파일명 + &quot;+N more&quot;를,
                <strong>확장 모드</strong>(Ctrl+O)에서는 모든 파일명과 줄 수를 트리 형태로
                표시합니다.
              </p>
              <p>
                이 컴포넌트는 활동 피드(Activity Feed)에서 연속된 file_read 도구 호출을 그룹화할 때
                사용됩니다. 트리 커넥터(<code className="text-cyan-600">⎿</code>)로 파일 목록을
                시각적으로 연결합니다.
              </p>
            </div>

            <MermaidDiagram
              title="ReadGroupBlock 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AF["ActivityFeed<br/><small>활동 피드 컴포넌트</small>"]
  RGB["ReadGroupBlock<br/><small>파일 읽기 그룹</small>"]
  SP["shortenPath<br/><small>경로 축약 헬퍼</small>"]
  FR["file_read 도구<br/><small>tools/file-read.ts</small>"]
  CTRL["Ctrl+O 토글<br/><small>verbose 모드</small>"]

  AF -->|"entries 배열"| RGB
  RGB -->|"긴 경로 축약"| SP
  FR -->|"읽기 결과"| AF
  CTRL -->|"isExpanded 전환"| RGB

  style RGB fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AF fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style FR fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CTRL fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 이메일의 &quot;첨부파일 5개&quot; 요약을 떠올리세요.
              기본적으로는 첨부파일 수만 보여주고, 클릭하면 각 파일의 상세 정보(이름, 크기)가
              펼쳐지는 것처럼, ReadGroupBlock도 축소/확장 모드로 정보 밀도를 조절합니다.
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

            {/* ReadGroupEntry */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ReadGroupEntry
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              읽기 그룹의 개별 파일 항목입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "filePath",
                  type: "string",
                  required: true,
                  desc: "파일 경로 (축소 모드에서 30자, 확장 모드에서 50자 제한)",
                },
                {
                  name: "lineCount",
                  type: "number",
                  required: false,
                  desc: "읽은 줄 수 (확장 모드에서만 표시, undefined면 생략)",
                },
              ]}
            />

            {/* ReadGroupBlockProps */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ReadGroupBlockProps
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">ReadGroupBlock</code> 컴포넌트의 Props입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "entries",
                  type: "readonly ReadGroupEntry[]",
                  required: true,
                  desc: "그룹화된 파일 읽기 항목 배열",
                },
                {
                  name: "isExpanded",
                  type: "boolean",
                  required: false,
                  desc: "확장 모드 여부 (기본값: false, Ctrl+O로 토글)",
                },
              ]}
            />

            {/* shortenPath */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              function shortenPath (내부)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              긴 파일 경로를 축약하는 내부 헬퍼 함수입니다. export되지 않습니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">shortenPath</span>(
              <span className="prop">filePath</span>: <span className="type">string</span>,{" "}
              <span className="prop">maxLen</span> = <span className="num">50</span>):{" "}
              <span className="type">string</span>
              {"\n"}
              <span className="cm">{'// 예시: "/Users/dev/project/src/components/App.tsx"'}</span>
              {"\n"}
              <span className="cm">{'//    → "…/components/App.tsx"'}</span>
            </CodeBlock>
            <ParamTable
              params={[
                { name: "filePath", type: "string", required: true, desc: "원본 파일 경로" },
                {
                  name: "maxLen",
                  type: "number",
                  required: false,
                  desc: "최대 표시 길이 (기본값: 50, 축소 모드에서는 30으로 호출)",
                },
              ]}
            />

            {/* ReadGroupBlock component */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              const ReadGroupBlock
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">React.memo</code>로 감싸진 메인 컴포넌트입니다.
              entries가 변경되지 않으면 리렌더링하지 않습니다.
            </p>
            <CodeBlock>
              <span className="kw">export const</span> <span className="prop">ReadGroupBlock</span>{" "}
              = <span className="type">React</span>.<span className="fn">memo</span>({"\n"}
              {"  "}
              <span className="kw">function</span> <span className="fn">ReadGroupBlock</span>({"{"}{" "}
              <span className="prop">entries</span>, <span className="prop">isExpanded</span> {"}"}:{" "}
              <span className="type">ReadGroupBlockProps</span>){"\n"});
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">shortenPath</code>는 경로 세그먼트가 2개 이하이면
                축약하지 않고 원본 경로를 반환합니다.
              </li>
              <li>
                축소 모드에서 파일 경로의 최대 길이는 30자이고, 확장 모드에서는 50자입니다. 두
                모드에서 <code className="text-cyan-600">shortenPath</code>의{" "}
                <code className="text-cyan-600">maxLen</code>
                인자가 다르게 호출됩니다.
              </li>
              <li>
                축소 모드에서는 최대 3개 파일명만 표시하고, 나머지는 &quot;+N more&quot;로
                표시합니다. 3개 이하일 때는 모든 파일이 쉼표로 구분되어 표시됩니다.
              </li>
              <li>
                파일이 1개일 때는 &quot;Read 1 file&quot;(단수), 2개 이상이면 &quot;Read N
                files&quot;(복수)로 표시됩니다.
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

            {/* 축소 모드 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 축소 모드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              기본적으로 축소 모드로 렌더링되며, 파일 수와 처음 3개 파일명이 표시됩니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="type">ReadGroupBlock</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./ReadGroupBlock.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">entries</span> = [{"\n"}
              {"  "}
              {"{"} <span className="prop">filePath</span>:{" "}
              <span className="str">&quot;src/core/agent-loop.ts&quot;</span>,{" "}
              <span className="prop">lineCount</span>: <span className="num">450</span> {"}"},{"\n"}
              {"  "}
              {"{"} <span className="prop">filePath</span>:{" "}
              <span className="str">&quot;src/core/circuit-breaker.ts&quot;</span>,{" "}
              <span className="prop">lineCount</span>: <span className="num">120</span> {"}"},{"\n"}
              {"  "}
              {"{"} <span className="prop">filePath</span>:{" "}
              <span className="str">&quot;src/core/recovery-executor.ts&quot;</span>,{" "}
              <span className="prop">lineCount</span>: <span className="num">280</span> {"}"},{"\n"}
              {"  "}
              {"{"} <span className="prop">filePath</span>:{" "}
              <span className="str">&quot;src/utils/logger.ts&quot;</span>,{" "}
              <span className="prop">lineCount</span>: <span className="num">95</span> {"}"},{"\n"}
              {"  "}
              {"{"} <span className="prop">filePath</span>:{" "}
              <span className="str">&quot;src/utils/events.ts&quot;</span>,{" "}
              <span className="prop">lineCount</span>: <span className="num">60</span> {"}"},{"\n"}
              ];
              {"\n"}
              {"\n"}
              <span className="cm">{"// 축소 모드 (기본)"}</span>
              {"\n"}&lt;<span className="type">ReadGroupBlock</span>{" "}
              <span className="prop">entries</span>={"{"}entries{"}"} /&gt;
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력:"}</span>
              {"\n"}
              <span className="cm">{"// Read 5 files"}</span>
              {"\n"}
              <span className="cm">
                {"// ⎿ agent-loop.ts, circuit-breaker.ts, recovery-executor.ts, +2 more"}
              </span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>entries</code> 배열이 비어 있어도 &quot;Read 0
              files&quot; 헤더가 표시됩니다. 비어 있는 경우를 숨기려면 부모 컴포넌트에서{" "}
              <code>entries.length &gt; 0</code>을 체크하세요.
            </Callout>

            {/* 확장 모드 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 확장 모드 (Ctrl+O)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">isExpanded</code>를{" "}
              <code className="text-cyan-600">true</code>로 설정하면 모든 파일을 트리 형태로
              보여줍니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 확장 모드 — 모든 파일과 줄 수 표시"}</span>
              {"\n"}&lt;<span className="type">ReadGroupBlock</span>{" "}
              <span className="prop">entries</span>={"{"}entries{"}"}{" "}
              <span className="prop">isExpanded</span>={"{"}true{"}"} /&gt;
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력:"}</span>
              {"\n"}
              <span className="cm">{"// Read 5 files"}</span>
              {"\n"}
              <span className="cm">{"// ⎿  src/core/agent-loop.ts (450 lines)"}</span>
              {"\n"}
              <span className="cm">{"//    src/core/circuit-breaker.ts (120 lines)"}</span>
              {"\n"}
              <span className="cm">{"//    src/core/recovery-executor.ts (280 lines)"}</span>
              {"\n"}
              <span className="cm">{"//    src/utils/logger.ts (95 lines)"}</span>
              {"\n"}
              <span className="cm">{"//    src/utils/events.ts (60 lines)"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 확장 모드에서는 첫 번째 파일만 트리 커넥터(<code>⎿</code>)가
              붙고, 나머지는 동일한 들여쓰기(공백 3칸)로 정렬됩니다.
              <code>lineCount</code>가 <code>undefined</code>이면 줄 수가 생략됩니다.
            </Callout>

            <DeepDive title="경로 축약(shortenPath) 로직 상세">
              <p className="mb-3">
                <code className="text-cyan-600">shortenPath</code>는 긴 파일 경로를 최대 길이에 맞게
                축약합니다.
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  경로 길이가 <code>maxLen</code> 이하이면 원본을 그대로 반환합니다.
                </li>
                <li>
                  경로 세그먼트가 2개 이하이면 (예: <code>&quot;file.ts&quot;</code>) 축약하지
                  않습니다.
                </li>
                <li>
                  3개 이상이면 <code>&quot;…/마지막 폴더/파일명&quot;</code> 형태로 축약합니다.
                </li>
              </ul>
              <p className="mt-3">
                <strong>예시:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 mt-1">
                <li>
                  <code>&quot;/Users/dev/project/src/components/App.tsx&quot;</code> →{" "}
                  <code>&quot;…/components/App.tsx&quot;</code>
                </li>
                <li>
                  <code>&quot;src/App.tsx&quot;</code> → <code>&quot;src/App.tsx&quot;</code>{" "}
                  (세그먼트 2개, 축약 안 함)
                </li>
                <li>
                  <code>&quot;short.ts&quot;</code> → <code>&quot;short.ts&quot;</code> (길이
                  미초과)
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                축소 모드에서는 <code>maxLen=30</code>으로, 확장 모드에서는 기본값{" "}
                <code>maxLen=50</code>으로 호출됩니다. 경로가 짧으면 두 모드에서 동일하게
                표시됩니다.
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
              렌더링 분기 구조
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">isExpanded</code> 값에 따라 두 가지 렌더링 경로로
              분기됩니다.
            </p>

            <MermaidDiagram
              title="ReadGroupBlock 렌더링 분기"
              titleColor="purple"
              chart={`graph TD
  ENTRIES["entries 배열 전달"] --> HEADER["헤더 렌더링<br/><small>'Read N file(s)' (파란 볼드)</small>"]
  HEADER --> MODE{"isExpanded?"}

  MODE -->|"false (기본)"| COLLAPSED["축소 모드"]
  COLLAPSED --> CHECK{"entries <= 3?"}
  CHECK -->|"예"| ALL3["모든 파일명 나열<br/><small>쉼표로 구분</small>"]
  CHECK -->|"아니오"| FIRST3["처음 3개 + '+N more'<br/><small>shortenPath(path, 30)</small>"]

  MODE -->|"true"| EXPANDED["확장 모드"]
  EXPANDED --> TREE["트리 형태 표시<br/><small>⎿ 커넥터 + 줄 수</small>"]
  TREE --> EACH["각 파일 순회<br/><small>shortenPath(path, 50)</small>"]

  style ENTRIES fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style HEADER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MODE fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style COLLAPSED fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style EXPANDED fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CHECK fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style ALL3 fill:#dcfce7,stroke:#10b981,color:#1e293b
  style FIRST3 fill:#dcfce7,stroke:#10b981,color:#1e293b
  style TREE fill:#dcfce7,stroke:#10b981,color:#1e293b
  style EACH fill:#dcfce7,stroke:#10b981,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              축소/확장 모드의 핵심 렌더링 로직입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// [1] 헤더 — 단수/복수 자동 처리"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">count</span> ={" "}
              <span className="prop">entries</span>.<span className="prop">length</span>;{"\n"}
              <span className="kw">const</span> <span className="prop">fileWord</span> ={" "}
              <span className="prop">count</span> === <span className="num">1</span> ?{" "}
              <span className="str">&quot;file&quot;</span> :{" "}
              <span className="str">&quot;files&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// [2] 확장 모드 — 트리 형태로 각 파일 표시"}</span>
              {"\n"}
              <span className="cm">{"//     첫 번째 파일: ⎿ 커넥터, 나머지: 공백 정렬"}</span>
              {"\n"}
              <span className="cm">{"//     lineCount가 있으면 (N lines) 표시"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// [3] 축소 모드 — 3개까지 쉼표로 나열"}</span>
              {"\n"}
              <span className="cm">{"//     초과분은 '+N more'로 압축"}</span>
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 파일 수에 따라
                &quot;file&quot;(단수)과 &quot;files&quot;(복수)를 자동으로 구분합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 확장 모드에서는 첫 번째 파일에만 트리
                커넥터(<code className="text-cyan-600">⎿</code>)를 붙이고, 나머지는 동일한
                들여쓰기(공백 3칸)로 정렬합니다. <code className="text-cyan-600">lineCount</code>가{" "}
                <code className="text-cyan-600">null/undefined</code>가 아닐 때만 줄 수를
                표시합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 축소 모드에서는 3개 이하면 모두
                쉼표로 나열하고, 초과하면 처음 3개만 보여주고 나머지를 &quot;+N more&quot;로
                압축합니다.
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
                &quot;파일 경로가 '…'으로 시작해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                이것은 정상적인 동작입니다. <code className="text-cyan-600">shortenPath</code>가 긴
                경로를 축약할 때 선행 세그먼트를 &quot;…&quot;으로 대체합니다. 확장
                모드(Ctrl+O)에서는
                <code className="text-cyan-600">maxLen</code>이 50으로 늘어나므로 더 긴 경로가
                표시됩니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;줄 수가 표시되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                두 가지 원인이 있습니다:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>축소 모드:</strong> 줄 수는 확장 모드에서만 표시됩니다. Ctrl+O로 verbose
                  모드를 활성화하세요.
                </li>
                <li>
                  <strong>
                    <code>lineCount</code>가 undefined:
                  </strong>{" "}
                  엔트리에
                  <code className="text-cyan-600">lineCount</code> 필드가 없으면 줄 수가 생략됩니다.
                </li>
              </ul>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Ctrl+O를 눌러도 확장되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                이 컴포넌트 자체는 Ctrl+O 입력을 처리하지 않습니다. 부모 컴포넌트(활동 피드)에서
                verbose 상태를 관리하고
                <code className="text-cyan-600">isExpanded</code> prop으로 전달합니다. verbose
                모드가 올바르게 토글되고 있는지 확인하세요.
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
                  name: "activity-feed.tsx",
                  slug: "activity-feed",
                  relation: "parent",
                  desc: "에이전트 활동을 표시하는 피드 컴포넌트 — ReadGroupBlock을 포함",
                },
                {
                  name: "tool-file-read.ts",
                  slug: "tool-file-read",
                  relation: "sibling",
                  desc: "파일 읽기 도구 — ReadGroupBlock에 표시될 데이터를 생성",
                },
                {
                  name: "tool-call-block.tsx",
                  slug: "tool-call-block",
                  relation: "sibling",
                  desc: "도구 호출을 표시하는 블록 컴포넌트 — ReadGroupBlock과 유사한 표시 패턴",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
