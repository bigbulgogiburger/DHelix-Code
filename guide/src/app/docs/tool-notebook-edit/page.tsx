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

export default function ToolNotebookEditPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/tools/definitions/notebook-edit.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              notebook_edit
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
            <span className="text-sm text-gray-500">Jupyter 노트북 편집 도구</span>
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            Jupyter Notebook(.ipynb) 파일의 셀을 추가, 교체, 삭제하는 도구입니다.
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
              <code className="text-cyan-600">notebook_edit</code>는 Jupyter Notebook의 개별 셀을
              프로그래밍 방식으로 편집하는 도구입니다. .ipynb 파일은 JSON 형식으로 저장되며,
              코드 셀과 마크다운 셀로 구성됩니다.
            </p>
            <p>
              세 가지 작업을 지원합니다: <code className="text-cyan-600">&quot;add&quot;</code>(새 셀 삽입),
              <code className="text-cyan-600">&quot;replace&quot;</code>(기존 셀 교체),
              <code className="text-cyan-600">&quot;delete&quot;</code>(셀 삭제).
              편집 후 노트북을 JSON으로 직렬화하여 파일에 다시 저장합니다.
            </p>
            <p>
              권한 수준은 <code className="text-amber-600">&quot;confirm&quot;</code>입니다.
              파일을 직접 변경하므로 사용자 확인이 필요합니다.
              30초 타임아웃이 설정되어 있으며, 경로 해석에 <code className="text-cyan-600">resolvePath()</code>를 사용합니다.
            </p>
          </div>

          <MermaidDiagram
            title="notebook_edit 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  EXEC["Tool Executor<br/><small>tools/executor.ts</small>"]
  NE["notebook_edit<br/><small>definitions/notebook-edit.ts</small>"]
  FS["File System<br/><small>node:fs/promises</small>"]
  IPYNB["*.ipynb 파일<br/><small>JSON 형식</small>"]

  AGENT -->|"도구 호출"| EXEC
  EXEC -->|"execute()"| NE
  NE -->|"readFile()"| FS
  FS -->|"JSON 파싱"| NE
  NE -->|"셀 편집"| NE
  NE -->|"writeFile()"| IPYNB

  style NE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style FS fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style IPYNB fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 스프레드시트에서 행을 추가, 수정, 삭제하는 것과 같습니다.
            노트북의 각 &quot;셀&quot;이 스프레드시트의 &quot;행&quot;에 해당하고,
            셀 인덱스가 행 번호에 해당합니다. 0-based 인덱스를 사용합니다.
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
            paramSchema (Zod)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            노트북 경로, 작업 종류, 셀 인덱스, 셀 타입, 소스 내용을 정의하는 입력 매개변수 스키마입니다.
          </p>
          <ParamTable
            params={[
              { name: "path", type: "string", required: true, desc: "편집할 .ipynb 노트북 파일 경로" },
              { name: "action", type: '"add" | "replace" | "delete"', required: true, desc: "수행할 작업: add(추가), replace(교체), delete(삭제)" },
              { name: "cellIndex", type: "number (0-based)", required: false, desc: "셀 인덱스. add: 삽입 위치(미지정 시 맨 끝), replace/delete: 대상 셀(필수)" },
              { name: "cellType", type: '"code" | "markdown"', required: false, desc: '셀 타입 (기본값: "code")' },
              { name: "source", type: "string", required: false, desc: "셀 내용. add와 replace에서 필수" },
            ]}
          />

          {/* NotebookCell interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface NotebookCell
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            Jupyter Notebook JSON 구조에서 단일 셀을 나타내는 내부 인터페이스입니다.
          </p>
          <ParamTable
            params={[
              { name: "cell_type", type: "string", required: true, desc: '셀 타입: "code", "markdown", "raw"' },
              { name: "source", type: "string[]", required: true, desc: "줄별 문자열 배열 (마지막 줄 제외 모든 줄에 \\n 포함)" },
              { name: "metadata", type: "Record<string, unknown>", required: true, desc: "셀 메타데이터" },
              { name: "outputs", type: "unknown[]", required: false, desc: "코드 셀의 출력 (코드 셀에만 존재)" },
              { name: "execution_count", type: "number | null", required: false, desc: "실행 카운트 (미실행 시 null, 코드 셀에만 존재)" },
            ]}
          />

          {/* Notebook interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface Notebook
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            .ipynb 파일의 최상위 JSON 구조입니다.
          </p>
          <ParamTable
            params={[
              { name: "cells", type: "NotebookCell[]", required: true, desc: "모든 셀의 배열" },
              { name: "metadata", type: "Record<string, unknown>", required: true, desc: "노트북 메타데이터 (커널, 언어 정보 등)" },
              { name: "nbformat", type: "number", required: true, desc: "Notebook 형식 메이저 버전 (보통 4)" },
              { name: "nbformat_minor", type: "number", required: true, desc: "Notebook 형식 마이너 버전" },
            ]}
          />

          {/* ToolDefinition */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            notebookEditTool (ToolDefinition)
          </h3>
          <ParamTable
            params={[
              { name: "name", type: '"notebook_edit"', required: true, desc: "도구 이름 식별자" },
              { name: "permissionLevel", type: '"confirm"', required: true, desc: "확인 등급 — 파일 변경이므로 사용자 승인 필요" },
              { name: "timeoutMs", type: "30_000", required: true, desc: "30초 타임아웃" },
            ]}
          />

          {/* 내부 함수 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            내부 함수
          </h3>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            createCell(cellType, source)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            Jupyter 형식에 맞는 새 셀 객체를 생성합니다. 소스 텍스트를 줄별 배열로 변환하고,
            코드 셀인 경우 빈 outputs와 null execution_count를 추가합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">createCell</span>(
            {"\n"}{"  "}<span className="prop">cellType</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">source</span>: <span className="type">string</span>,
            {"\n"}): <span className="type">NotebookCell</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              노트북 파일이 이미 존재해야 합니다. 새 노트북을 생성하는 기능은 제공하지 않습니다.
            </li>
            <li>
              <code className="text-cyan-600">cellIndex</code>는 0-based입니다.
              <code className="text-cyan-600">replace</code>와 <code className="text-cyan-600">delete</code> 작업에서는 필수이고,
              <code className="text-cyan-600">add</code>에서는 미지정 시 맨 끝에 추가됩니다.
            </li>
            <li>
              <code className="text-cyan-600">source</code>는 <code className="text-cyan-600">add</code>와
              <code className="text-cyan-600">replace</code> 작업에서 필수입니다.
              <code className="text-cyan-600">delete</code>에서는 무시됩니다.
            </li>
            <li>
              저장 시 <code className="text-cyan-600">JSON.stringify(notebook, null, 1)</code>로 indent 1을 사용합니다.
              원본 파일의 들여쓰기와 다를 수 있습니다.
            </li>
            <li>
              소스 텍스트는 줄별 배열로 변환됩니다. Jupyter 형식에서 마지막 줄을 제외한 모든 줄에
              <code className="text-cyan-600">\n</code>이 붙습니다.
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

          {/* 기본: 셀 추가 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 코드 셀 추가</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            노트북 맨 끝에 새 코드 셀을 추가하는 가장 기본적인 사용법입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 맨 끝에 코드 셀 추가"}</span>
            {"\n"}{"{"}
            {"\n"}{"  "}<span className="prop">path</span>: <span className="str">&quot;analysis.ipynb&quot;</span>,
            {"\n"}{"  "}<span className="prop">action</span>: <span className="str">&quot;add&quot;</span>,
            {"\n"}{"  "}<span className="prop">cellType</span>: <span className="str">&quot;code&quot;</span>,
            {"\n"}{"  "}<span className="prop">source</span>: <span className="str">&quot;import pandas as pd\ndf = pd.read_csv(&apos;data.csv&apos;)\ndf.head()&quot;</span>
            {"\n"}{"}"}
          </CodeBlock>

          {/* 셀 교체 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>셀 교체 &mdash; 기존 셀 내용 변경</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            특정 인덱스의 셀을 새 내용으로 교체합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 2번째 셀(index 1)을 마크다운 셀로 교체"}</span>
            {"\n"}{"{"}
            {"\n"}{"  "}<span className="prop">path</span>: <span className="str">&quot;analysis.ipynb&quot;</span>,
            {"\n"}{"  "}<span className="prop">action</span>: <span className="str">&quot;replace&quot;</span>,
            {"\n"}{"  "}<span className="prop">cellIndex</span>: <span className="num">1</span>,
            {"\n"}{"  "}<span className="prop">cellType</span>: <span className="str">&quot;markdown&quot;</span>,
            {"\n"}{"  "}<span className="prop">source</span>: <span className="str">&quot;## Data Analysis\n\nThis section analyzes the dataset.&quot;</span>
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>replace</code>와 <code>delete</code> 작업에서
            <code>cellIndex</code>가 범위를 벗어나면 에러가 반환됩니다.
            <code>cellIndex</code>는 0부터 시작하며, 유효 범위는 <code>[0, totalCells-1]</code>입니다.
          </Callout>

          {/* 셀 삭제 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            셀 삭제 &mdash; 특정 셀 제거
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            특정 인덱스의 셀을 삭제합니다. 삭제 후 뒤의 셀들의 인덱스가 자동으로 조정됩니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 3번째 셀(index 2) 삭제"}</span>
            {"\n"}{"{"}
            {"\n"}{"  "}<span className="prop">path</span>: <span className="str">&quot;analysis.ipynb&quot;</span>,
            {"\n"}{"  "}<span className="prop">action</span>: <span className="str">&quot;delete&quot;</span>,
            {"\n"}{"  "}<span className="prop">cellIndex</span>: <span className="num">2</span>
            {"\n"}{"}"}
          </CodeBlock>

          <DeepDive title="Jupyter source 배열 형식 상세">
            <p className="mb-3">
              Jupyter Notebook은 셀의 소스를 줄별 문자열 배열로 저장합니다.
              마지막 줄을 제외한 모든 줄에 <code className="text-cyan-600">\n</code>이 붙습니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 입력 텍스트"}</span>
              {"\n"}<span className="str">&quot;import pandas as pd\ndf = pd.read_csv(&apos;data.csv&apos;)&quot;</span>
              {"\n"}
              {"\n"}<span className="cm">{"// Jupyter source 배열로 변환"}</span>
              {"\n"}[<span className="str">&quot;import pandas as pd\n&quot;</span>, <span className="str">&quot;df = pd.read_csv(&apos;data.csv&apos;)&quot;</span>]
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              <code className="text-cyan-600">createCell()</code> 함수가 이 변환을 자동으로 처리합니다.
              코드 셀인 경우 빈 <code className="text-cyan-600">outputs: []</code>와
              <code className="text-cyan-600">execution_count: null</code>도 자동 추가됩니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>실행 흐름 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">execute()</code> 함수의 전체 실행 흐름입니다.
            파일 읽기, 유효성 확인, 작업 수행, 파일 저장 순서로 처리됩니다.
          </p>

          <MermaidDiagram
            title="notebook_edit 실행 흐름"
            titleColor="purple"
            chart={`graph TD
  START(("execute()")) --> RESOLVE["resolvePath()<br/><small>경로 해석</small>"]
  RESOLVE --> READ["readFile()<br/><small>JSON 파싱</small>"]
  READ --> VALID{"cells 배열<br/>존재?"}
  VALID -->|"없음"| ERROR["에러 반환<br/><small>Invalid notebook</small>"]
  VALID -->|"있음"| ACTION{"action 분기"}
  ACTION -->|"add"| ADD["splice(idx, 0, cell)<br/><small>셀 삽입</small>"]
  ACTION -->|"replace"| REPLACE["cells[idx] = cell<br/><small>셀 교체</small>"]
  ACTION -->|"delete"| DELETE["splice(idx, 1)<br/><small>셀 제거</small>"]
  ADD --> WRITE["writeFile()<br/><small>JSON.stringify + indent 1</small>"]
  REPLACE --> WRITE
  DELETE --> WRITE
  WRITE --> RESULT["성공 메시지 반환<br/><small>Added/Replaced/Deleted</small>"]

  style START fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style ACTION fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style ADD fill:#dcfce7,stroke:#10b981,color:#065f46
  style REPLACE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style DELETE fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style WRITE fill:#dcfce7,stroke:#10b981,color:#065f46
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">createCell()</code> 함수의 소스 텍스트 변환 로직입니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">createCell</span>(<span className="prop">cellType</span>: <span className="type">string</span>, <span className="prop">source</span>: <span className="type">string</span>): <span className="type">NotebookCell</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] 소스 텍스트를 줄별 배열로 분할"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">sourceLines</span> = <span className="prop">source</span>
            {"\n"}{"    "}.<span className="fn">split</span>(<span className="str">&quot;\\n&quot;</span>)
            {"\n"}{"    "}.<span className="fn">map</span>((<span className="prop">line</span>, <span className="prop">i</span>, <span className="prop">arr</span>) =&gt;
            {"\n"}{"      "}<span className="cm">{"// [2] 마지막 줄 제외 모든 줄에 \\n 추가"}</span>
            {"\n"}{"      "}<span className="prop">i</span> &lt; <span className="prop">arr</span>.<span className="prop">length</span> - <span className="num">1</span> ? <span className="str">`${"{"}<span className="prop">line</span>{"}"}\\n`</span> : <span className="prop">line</span>
            {"\n"}{"    "});
            {"\n"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">cell</span>: <span className="type">NotebookCell</span> = {"{"}
            {"\n"}{"    "}<span className="prop">cell_type</span>: <span className="prop">cellType</span>,
            {"\n"}{"    "}<span className="prop">source</span>: <span className="prop">sourceLines</span>,
            {"\n"}{"    "}<span className="prop">metadata</span>: {"{}"},
            {"\n"}{"  "}{"}"};
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 코드 셀에만 outputs와 execution_count 추가"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">cellType</span> === <span className="str">&quot;code&quot;</span>) {"{"}
            {"\n"}{"    "}<span className="prop">cell</span>.<span className="prop">outputs</span> = [];
            {"\n"}{"    "}<span className="prop">cell</span>.<span className="prop">execution_count</span> = <span className="kw">null</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="kw">return</span> <span className="prop">cell</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 소스 텍스트를 <code className="text-cyan-600">\n</code>으로 분할하여 줄별 배열로 변환합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> Jupyter 형식 규칙에 따라 마지막 줄을 제외한 모든 줄에 <code className="text-cyan-600">\n</code>을 붙입니다. 이는 Jupyter가 셀을 렌더링할 때 줄바꿈을 올바르게 처리하기 위함입니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 코드 셀에는 실행 결과를 저장하는 <code className="text-cyan-600">outputs</code> 배열과 실행 횟수를 나타내는 <code className="text-cyan-600">execution_count</code>가 필요합니다. 새로 생성된 셀은 아직 실행하지 않았으므로 null입니다.</p>
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
              &quot;Invalid notebook format: missing &apos;cells&apos; array&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              .ipynb 파일이 유효한 Jupyter Notebook 형식이 아닙니다.
              파일이 올바른 JSON이고 <code className="text-cyan-600">cells</code> 배열이 최상위에 존재하는지 확인하세요.
              빈 파일이나 손상된 파일은 이 에러를 발생시킵니다.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;cellIndex out of range&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              지정한 <code className="text-cyan-600">cellIndex</code>가 유효 범위를 벗어났습니다.
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>add:</strong> 유효 범위는 <code className="text-cyan-600">[0, totalCells]</code> (맨 끝 포함)
              </li>
              <li>
                <strong>replace/delete:</strong> 유효 범위는 <code className="text-cyan-600">[0, totalCells-1]</code>
              </li>
            </ul>
            <Callout type="tip" icon="*">
              노트북의 현재 셀 수를 확인하려면 먼저 <code>read_file</code> 도구로
              .ipynb 파일을 읽어 셀 수를 확인하세요.
            </Callout>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Failed to parse notebook&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              .ipynb 파일의 JSON이 올바르지 않습니다. 파일이 손상되었거나,
              다른 프로그램에 의해 잘못된 형식으로 저장되었을 수 있습니다.
              JSON 유효성 검사 도구로 파일을 확인하세요.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;저장 후 들여쓰기가 변했어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              이 도구는 <code className="text-cyan-600">JSON.stringify(notebook, null, 1)</code>로
              indent 1을 사용합니다. 원본 파일이 다른 들여쓰기(예: 2 또는 4)를 사용했다면
              저장 후 들여쓰기가 변경됩니다. 기능에는 영향이 없지만 git diff에 노이즈가 발생할 수 있습니다.
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
                name: "tool-registry.ts",
                slug: "tool-registry",
                relation: "parent",
                desc: "notebook_edit를 포함한 모든 도구를 등록하고 관리하는 레지스트리",
              },
              {
                name: "permission-manager.ts",
                slug: "permission-manager",
                relation: "sibling",
                desc: "confirm 권한 수준 도구의 실행 승인을 관리하는 모듈",
              },
              {
                name: "agent-loop.ts",
                slug: "agent-loop",
                relation: "parent",
                desc: "notebook_edit를 호출하는 메인 에이전트 루프",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
