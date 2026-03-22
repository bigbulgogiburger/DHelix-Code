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

export default function ToolCallBlockPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/components/ToolCallBlock.tsx" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">ToolCallBlock</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              에이전트가 도구를 호출할 때의 상태와 결과를 리치하게 표시하는 블록 컴포넌트입니다.
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
                <code className="text-cyan-600">ToolCallBlock</code>은 에이전트 루프에서
                도구(file_read, bash_exec, file_edit 등)를 호출할 때의 진행 상태와 실행 결과를
                터미널 UI로 표시하는 Ink 컴포넌트입니다.
                <code className="text-cyan-600">tool-display.ts</code>의 렌더러를 사용하여 각 도구에
                맞는 의미 있는 헤더와 미리보기를 생성합니다.
              </p>
              <p>
                실행 중에는 노란색 스피너가 회전하고, 완료 시 성공/에러/거부 아이콘으로 전환됩니다.
                file_edit의 diff는 초록(추가)/빨강(삭제) 색상으로 미리보기가 표시되며, 장시간 실행
                도구(bash_exec 등)는 실시간 스트리밍 출력을 보여줍니다.
              </p>
              <p>
                MCP 도구도 완전히 지원합니다. <code className="text-cyan-600">[serverName]</code>{" "}
                접두사 표시, 출력 잘림 경고, 에러 시 디버그 인수 구조화 등 MCP 전용 기능이 포함되어
                있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="ToolCallBlock 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AL["Agent Loop<br/><small>에이전트 루프 — 도구 호출 조율</small>"]
  TCB["ToolCallBlock<br/><small>도구 호출 표시 블록</small>"]
  TD["tool-display.ts<br/><small>도구별 헤더/미리보기 렌더러</small>"]
  SM["StreamingMessage<br/><small>LLM 텍스트 스트리밍</small>"]
  PP["PermissionPrompt<br/><small>권한 요청 프롬프트</small>"]

  AL -->|"도구 호출 결과 전달"| TCB
  TCB -->|"getToolHeaderInfo()"| TD
  TCB -->|"getToolPreview()"| TD
  AL --> SM
  AL --> PP

  style TCB fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TD fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PP fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> ToolCallBlock은 터미널의 &quot;작업 상태 표시줄&quot;입니다.
              파일을 읽고 있으면 &quot;Reading src/foo.ts&quot;, 명령어를 실행 중이면 &quot;Running
              npm test&quot;처럼 사용자가 에이전트의 현재 작업을 직관적으로 파악할 수 있게 해줍니다.
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

            {/* ToolCallBlockProps interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ToolCallBlockProps
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              ToolCallBlock 컴포넌트에 전달되는 Props입니다. 모든 프로퍼티는{" "}
              <code className="text-cyan-600">readonly</code>입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "name",
                  type: "string",
                  required: true,
                  desc: '도구 이름 (예: "file_read", "bash_exec", "file_edit")',
                },
                {
                  name: "status",
                  type: '"running" | "complete" | "error" | "denied"',
                  required: true,
                  desc: "현재 도구 호출 상태 (실행 중 / 완료 / 에러 / 거부)",
                },
                {
                  name: "args",
                  type: "Record<string, unknown>",
                  required: false,
                  desc: "도구에 전달된 인수 (파일 경로, 명령어 등)",
                },
                {
                  name: "output",
                  type: "string",
                  required: false,
                  desc: "도구 실행 결과 출력 문자열",
                },
                {
                  name: "metadata",
                  type: "Record<string, unknown>",
                  required: false,
                  desc: "도구 실행 추가 메타데이터 (줄 수, 종료 코드, MCP 서버명 등)",
                },
                {
                  name: "isExpanded",
                  type: "boolean",
                  required: false,
                  desc: "출력을 확장 표시할지 여부 (Ctrl+O, 기본값: false)",
                },
                {
                  name: "startTime",
                  type: "number",
                  required: false,
                  desc: "도구 실행 시작 시간 (Date.now() 값, 소요시간 계산용)",
                },
                {
                  name: "streamingOutput",
                  type: "string",
                  required: false,
                  desc: "장시간 실행 도구의 실시간 스트리밍 출력",
                },
              ]}
            />

            {/* useSpinner hook */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              useSpinner(active)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              도구 실행 중 표시되는 스피너 애니메이션 훅입니다.{" "}
              <code className="text-cyan-600">active</code>가 true일 때 500ms 간격으로{" "}
              <code className="text-cyan-600">SPINNER_FRAMES</code> 배열의 프레임을 순환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">useSpinner</span>(
              <span className="prop">active</span>: <span className="type">boolean</span>):{" "}
              <span className="type">string</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "active",
                  type: "boolean",
                  required: true,
                  desc: '스피너 활성화 여부 (status === "running"일 때 true)',
                },
              ]}
            />

            {/* DiffPreview component */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              DiffPreview
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              file_edit 도구의 diff 미리보기를 색상으로 렌더링하는 내부 컴포넌트입니다. 줄 번호와
              함께 추가(+, 초록)와 삭제(-, 빨강) 줄을 구분하여 표시합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">DiffPreview</span>({"{"}{" "}
              <span className="prop">preview</span>: <span className="type">string</span> {"}"})
            </CodeBlock>

            {/* parseMCPDebugError */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              parseMCPDebugError(output)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              MCP 에러 출력에서 &quot;[Debug] Arguments sent:&quot; 이후의 JSON 인수를 추출합니다.
              디버그 정보가 없으면 <code className="text-cyan-600">undefined</code>를 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">parseMCPDebugError</span>(
              <span className="prop">output</span>: <span className="type">string</span>): {"{"}{" "}
              <span className="prop">message</span>: <span className="type">string</span>;{" "}
              <span className="prop">argsPreview</span>: <span className="type">string</span> {"}"}{" "}
              | <span className="type">undefined</span>
            </CodeBlock>
            <ParamTable
              params={[
                { name: "output", type: "string", required: true, desc: "도구의 에러 출력 문자열" },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">React.memo</code>로 감싸져 있어 Props가 변경되지
                않으면 리렌더링되지 않습니다. 성능 최적화를 위해 불필요한 렌더링을 방지합니다.
              </li>
              <li>
                <code className="text-cyan-600">isExpanded</code>가 false일 때 출력은 최대 3줄까지만
                표시되고, 나머지는 &quot;+N lines (ctrl+o to show all)&quot;로 축약됩니다.
              </li>
              <li>
                확장 표시(<code className="text-cyan-600">isExpanded: true</code>)에서도 출력이
                2000자를 초과하면 잘려서 표시됩니다.
              </li>
              <li>
                <code className="text-cyan-600">metadata.displayOutput</code>이 있으면 원본 output
                대신 마스킹된 버전을 표시합니다 (.env 등 민감 파일 보호).
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
              기본 사용법 &mdash; 도구 호출 결과 표시
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              가장 기본적인 사용 패턴입니다. 도구 이름과 상태, 인수를 전달하면 도구에 맞는 적절한
              헤더와 아이콘이 자동으로 표시됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 파일 읽기 — 실행 중"}</span>
              {"\n"}
              <span className="kw">{"<"}</span>
              <span className="fn">ToolCallBlock</span>
              {"\n"}
              {"  "}
              <span className="prop">name</span>=<span className="str">&quot;file_read&quot;</span>
              {"\n"}
              {"  "}
              <span className="prop">status</span>=<span className="str">&quot;running&quot;</span>
              {"\n"}
              {"  "}
              <span className="prop">args</span>={"{"}
              {"{"} <span className="prop">file_path</span>:{" "}
              <span className="str">&quot;src/index.ts&quot;</span> {"}"}
              {"}"}
              {"\n"}
              {"  "}
              <span className="prop">startTime</span>={"{"}
              {"{"}
              <span className="fn">Date</span>.<span className="fn">now</span>(){"}"}
              {"}"}
              {"\n"}
              <span className="kw">/{">"}</span>
              {"\n"}
              <span className="cm">{"// 표시: ⠋ Reading src/index.ts"}</span>
            </CodeBlock>

            <CodeBlock>
              <span className="cm">{"// 파일 읽기 — 완료"}</span>
              {"\n"}
              <span className="kw">{"<"}</span>
              <span className="fn">ToolCallBlock</span>
              {"\n"}
              {"  "}
              <span className="prop">name</span>=<span className="str">&quot;file_read&quot;</span>
              {"\n"}
              {"  "}
              <span className="prop">status</span>=<span className="str">&quot;complete&quot;</span>
              {"\n"}
              {"  "}
              <span className="prop">args</span>={"{"}
              {"{"} <span className="prop">file_path</span>:{" "}
              <span className="str">&quot;src/index.ts&quot;</span> {"}"}
              {"}"}
              {"\n"}
              {"  "}
              <span className="prop">output</span>=
              <span className="str">&quot;const app = ...&quot;</span>
              {"\n"}
              {"  "}
              <span className="prop">startTime</span>={"{"}
              {"{"}
              <span className="num">1700000000000</span>
              {"}"}
              {"}"}
              {"\n"}
              <span className="kw">/{">"}</span>
              {"\n"}
              <span className="cm">{"// 표시: Read src/index.ts (0.2s)"}</span>
              {"\n"}
              <span className="cm">{"//  ⎿  42 lines"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>startTime</code>을 전달하지 않으면 완료 후에도 소요시간이
              표시되지 않습니다. 도구 실행 시작 시점의 <code>Date.now()</code> 값을 반드시 기록해
              두세요.
            </Callout>

            {/* 고급 사용법: diff 미리보기 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; Diff 미리보기와 스트리밍 출력
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              file_edit 도구에서 diff 정보가 있으면 자동으로 색상 미리보기가 표시됩니다. bash_exec
              등 장시간 실행 도구는 <code className="text-cyan-600">streamingOutput</code>으로
              실시간 출력을 보여줄 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// bash_exec — 실시간 스트리밍 출력"}</span>
              {"\n"}
              <span className="kw">{"<"}</span>
              <span className="fn">ToolCallBlock</span>
              {"\n"}
              {"  "}
              <span className="prop">name</span>=<span className="str">&quot;bash_exec&quot;</span>
              {"\n"}
              {"  "}
              <span className="prop">status</span>=<span className="str">&quot;running&quot;</span>
              {"\n"}
              {"  "}
              <span className="prop">args</span>={"{"}
              {"{"} <span className="prop">command</span>:{" "}
              <span className="str">&quot;npm test&quot;</span> {"}"}
              {"}"}
              {"\n"}
              {"  "}
              <span className="prop">streamingOutput</span>=
              <span className="str">&quot;PASS src/foo.test.ts\nPASS src/bar.test.ts&quot;</span>
              {"\n"}
              <span className="kw">/{">"}</span>
              {"\n"}
              <span className="cm">{"// 표시: ⠋ Running npm test"}</span>
              {"\n"}
              <span className="cm">{"//     PASS src/foo.test.ts"}</span>
              {"\n"}
              <span className="cm">{"//     PASS src/bar.test.ts"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 스트리밍 출력은 최대 8줄까지만 표시됩니다. 긴 출력은 마지막 8줄만
              보여주므로 사용자가 가장 최신 진행 상황을 확인할 수 있습니다.
            </Callout>

            {/* MCP 도구 표시 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; MCP 도구 표시
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              MCP 서버의 도구를 호출하면 <code className="text-cyan-600">metadata.serverName</code>
              이 자동으로 헤더에 접두사로 표시됩니다. 출력이 잘린 경우 경고도 표시됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// MCP 도구 호출 — 서버 이름 접두사 표시"}</span>
              {"\n"}
              <span className="kw">{"<"}</span>
              <span className="fn">ToolCallBlock</span>
              {"\n"}
              {"  "}
              <span className="prop">name</span>=
              <span className="str">&quot;search_docs&quot;</span>
              {"\n"}
              {"  "}
              <span className="prop">status</span>=<span className="str">&quot;complete&quot;</span>
              {"\n"}
              {"  "}
              <span className="prop">metadata</span>={"{"}
              {"{"} <span className="prop">serverName</span>:{" "}
              <span className="str">&quot;context7&quot;</span>,{" "}
              <span className="prop">truncated</span>: <span className="kw">true</span> {"}"}
              {"}"}
              {"\n"}
              <span className="kw">/{">"}</span>
              {"\n"}
              <span className="cm">{"// 표시: [context7] search_docs"}</span>
              {"\n"}
              <span className="cm">{"//  ⎿  [Output truncated — exceeded token limit]"}</span>
            </CodeBlock>

            <DeepDive title="민감 파일 출력 마스킹">
              <p className="mb-3">
                <code className="text-cyan-600">.env</code> 등 민감 파일을 읽을 때,
                <code className="text-cyan-600">metadata.displayOutput</code>에 마스킹된 버전이
                전달됩니다. ToolCallBlock은 이 값이 있으면 원본{" "}
                <code className="text-cyan-600">output</code> 대신 마스킹된 버전을 표시합니다.
              </p>
              <CodeBlock>
                <span className="cm">{"// 축소 표시와 확장 표시 모두 마스킹 적용"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">displayText</span> = (
                {"\n"}
                {"  "}
                <span className="kw">typeof</span> <span className="prop">metadata</span>?.
                <span className="prop">displayOutput</span> ==={" "}
                <span className="str">&quot;string&quot;</span>
                {"\n"}
                {"    "}? <span className="prop">metadata</span>.
                <span className="prop">displayOutput</span>
                {"\n"}
                {"    "}: <span className="prop">output</span>
                {"\n"});
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                이 로직은 축소 표시(3줄 미리보기)와 확장 표시(전체) 모두에 적용되므로, 어떤
                모드에서든 민감 정보가 노출되지 않습니다.
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
              표시 구조 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              ToolCallBlock의 렌더링은 상태와 데이터에 따라 여러 영역이 조건부로 표시됩니다. 아래
              다이어그램은 각 영역의 표시 조건을 보여줍니다.
            </p>

            <MermaidDiagram
              title="ToolCallBlock 렌더링 흐름"
              titleColor="purple"
              chart={`graph TD
  ROOT["ToolCallBlock<br/><small>최상위 컨테이너 (marginLeft: 2)</small>"]
  HDR["Header Row<br/><small>[스피너/아이콘] [서버명] 동사 인수 (소요시간)</small>"]
  SUB["Subtext Row<br/><small>⎿  서브텍스트 (추가 정보)</small>"]
  TRUNC["Truncation Warning<br/><small>⎿  [Output truncated]</small>"]
  MCP_ERR["MCP Debug Error<br/><small>에러 메시지 + 인수 미리보기</small>"]
  STREAM["Streaming Output<br/><small>실행 중 실시간 출력 (최대 8줄)</small>"]
  DIFF["DiffPreview<br/><small>file_edit diff 미리보기 (+/- 색상)</small>"]
  COLLAPSED["Collapsed Output<br/><small>최대 3줄 + '...+N lines'</small>"]
  EXPANDED["Expanded Output<br/><small>전체 출력 (최대 2000자)</small>"]

  ROOT --> HDR
  ROOT -->|"headerInfo.subtext 존재"| SUB
  ROOT -->|"metadata.truncated"| TRUNC
  ROOT -->|"MCP 에러 + 디버그 정보"| MCP_ERR
  ROOT -->|"status=running + streamingOutput"| STREAM
  ROOT -->|"diff preview 존재"| DIFF
  ROOT -->|"!isExpanded + output 존재"| COLLAPSED
  ROOT -->|"isExpanded + output 존재"| EXPANDED

  style ROOT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style HDR fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style SUB fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style TRUNC fill:#fef9c3,stroke:#eab308,color:#1e293b
  style MCP_ERR fill:#fee2e2,stroke:#ef4444,color:#1e293b
  style STREAM fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style DIFF fill:#dcfce7,stroke:#10b981,color:#1e293b
  style COLLAPSED fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style EXPANDED fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              ToolCallBlock 컴포넌트의 핵심 렌더링 로직입니다. 상태별로 적절한 아이콘과 색상을
              결정하고,
              <code className="text-cyan-600">tool-display.ts</code>의 함수를 사용하여 헤더와
              미리보기를 생성합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// [1] tool-display.ts에서 도구별 헤더 정보 획득"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">headerInfo</span> ={" "}
              <span className="fn">getToolHeaderInfo</span>(<span className="prop">name</span>,{" "}
              <span className="prop">status</span>, <span className="prop">args</span>,{" "}
              <span className="prop">output</span>, <span className="prop">duration</span>,{" "}
              <span className="prop">metadata</span>);
              {"\n"}
              <span className="kw">const</span> <span className="prop">preview</span> ={" "}
              <span className="fn">getToolPreview</span>(<span className="prop">name</span>,{" "}
              <span className="prop">status</span>, <span className="prop">args</span>,{" "}
              <span className="prop">output</span>, <span className="prop">metadata</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// [2] 에러/거부 시 색상 오버라이드"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">effectiveColor</span> ={"\n"}
              {"  "}
              <span className="prop">status</span> ==={" "}
              <span className="str">&quot;error&quot;</span> || <span className="prop">status</span>{" "}
              === <span className="str">&quot;denied&quot;</span>
              {"\n"}
              {"    "}? <span className="str">&quot;red&quot;</span> :{" "}
              <span className="prop">headerInfo</span>.<span className="prop">color</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// [3] MCP 서버 이름 추출"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">mcpServerName</span> ={"\n"}
              {"  "}
              <span className="prop">metadata</span> && <span className="kw">typeof</span>{" "}
              <span className="prop">metadata</span>.<span className="prop">serverName</span> ==={" "}
              <span className="str">&quot;string&quot;</span>
              {"\n"}
              {"    "}? <span className="prop">metadata</span>.
              <span className="prop">serverName</span> : <span className="kw">undefined</span>;
              {"\n"}
              {"\n"}
              <span className="cm">{"// [4] 헤더 텍스트 조합 (MCP 접두사 포함)"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">headerText</span> ={" "}
              <span className="prop">mcpServerName</span>
              {"\n"}
              {"  "}? <span className="str">`[${"{"}</span>
              <span className="prop">mcpServerName</span>
              <span className="str">
                {"}"}] ${"{"}
              </span>
              <span className="prop">headerInfo</span>.<span className="prop">header</span>
              <span className="str">{"}"}`</span>
              {"\n"}
              {"  "}: <span className="prop">headerInfo</span>.<span className="prop">header</span>;
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong>{" "}
                <code className="text-cyan-600">getToolHeaderInfo()</code>는 도구 이름과 상태에 따라
                적절한 동사(Reading/Read), 인수 요약, 색상, 서브텍스트를 반환합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 에러 또는 거부 상태에서는 도구별
                색상과 관계없이 항상 빨간색으로 표시됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> MCP 도구의 경우{" "}
                <code className="text-cyan-600">metadata.serverName</code>에서 서버 이름을
                추출합니다. 내장 도구에는 이 값이 없습니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> MCP 서버 이름이 있으면{" "}
                <code className="text-cyan-600">[serverName] 헤더</code> 형태로, 없으면 헤더만
                표시합니다.
              </p>
            </div>

            <DeepDive title="parseDiffLine 파싱 로직 상세">
              <p className="mb-3">
                diff 미리보기의 각 줄을 정규식으로 파싱하여 줄 번호, 마커, 내용을 분리합니다:
              </p>
              <CodeBlock>
                <span className="cm">{'// 추가/삭제 줄: "  42 + new content"'}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">match</span> ={" "}
                <span className="prop">line</span>.<span className="fn">match</span>(
                <span className="str">{"/^(\\s*\\d+)\\s([+-])\\s(.*)$/"}</span>);
                {"\n"}
                {"\n"}
                <span className="cm">{'// 컨텍스트 줄: "  42  unchanged content"'}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">ctxMatch</span> ={" "}
                <span className="prop">line</span>.<span className="fn">match</span>(
                <span className="str">{"/^(\\s*\\d+)\\s{2}(.*)$/"}</span>);
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                추가 줄은 초록색(+), 삭제 줄은 빨간색(-), 컨텍스트 줄은 회색으로 렌더링됩니다. 어떤
                패턴에도 매칭되지 않으면 줄 전체를 회색 텍스트로 표시합니다.
              </p>
            </DeepDive>
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
                &quot;도구 출력이 잘려서 보여요. 전체를 보려면 어떻게 하나요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                기본적으로 출력은 3줄까지만 표시됩니다.{" "}
                <code className="text-cyan-600">Ctrl+O</code>를 눌러 상세 모드(verbose)를 활성화하면{" "}
                <code className="text-cyan-600">isExpanded</code>가 true로 설정되어 전체 출력을 볼
                수 있습니다. 단, 확장 모드에서도 2000자 제한이 있습니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;MCP 도구 에러인데 디버그 정보가 안 보여요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                MCP 디버그 정보는 에러 출력에{" "}
                <code className="text-cyan-600">[Debug] Arguments sent: </code>
                마커가 포함된 경우에만 표시됩니다. MCP 서버가 이 형식의 디버그 출력을 생성하지
                않으면 일반 에러 메시지만 표시됩니다. 또한{" "}
                <code className="text-cyan-600">metadata.serverName</code>이 설정되어 있어야 MCP
                에러로 인식합니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;스피너가 멈추지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                스피너는 <code className="text-cyan-600">status</code>가 &quot;running&quot;인
                동안에만 표시됩니다. 도구 실행이 완료되면 부모 컴포넌트가 status를
                &quot;complete&quot; 또는 &quot;error&quot;로 변경해야 합니다. status가 변경되면{" "}
                <code className="text-cyan-600">useSpinner</code> 훅의 interval이 자동으로
                정리(cleanup)됩니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;소요시간이 표시되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                소요시간은 <code className="text-cyan-600">startTime</code> Props가 전달되고
                status가 &quot;running&quot;이 아닌 경우에만 계산됩니다.
                <code className="text-cyan-600">startTime</code>을 전달하지 않으면
                <code className="text-cyan-600">duration</code>이{" "}
                <code className="text-cyan-600">undefined</code>가 되어 소요시간이 표시되지
                않습니다.
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
                  name: "StreamingMessage.tsx",
                  slug: "streaming-message",
                  relation: "sibling",
                  desc: "LLM 응답 텍스트를 실시간 스트리밍으로 표시하는 동반 컴포넌트",
                },
                {
                  name: "PermissionPrompt.tsx",
                  slug: "permission-prompt",
                  relation: "sibling",
                  desc: "도구 실행 전 사용자에게 권한을 묻는 프롬프트 컴포넌트",
                },
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "도구 호출을 조율하고 ToolCallBlock에 상태를 전달하는 메인 루프",
                },
                {
                  name: "tool-executor.ts",
                  slug: "tool-executor",
                  relation: "sibling",
                  desc: "실제 도구 실행을 담당하며 결과와 메타데이터를 생성하는 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
