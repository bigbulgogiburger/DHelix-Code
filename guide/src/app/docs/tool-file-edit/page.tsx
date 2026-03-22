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

export default function ToolFileEditPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/tools/definitions/file-edit.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              file_edit Tool
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            파일 수정 도구 — 파일 내 특정 문자열을 정확히 찾아 교체하는 안전한 편집 도구입니다.
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
              <code className="text-cyan-600">file_edit</code>는 파일의 특정 부분만 정밀하게 수정하는 도구입니다.
              전체 파일을 덮어쓰는 <code className="text-cyan-600">file_write</code>와 달리,
              정확한 문자열 매칭으로 원하는 부분만 안전하게 교체합니다.
            </p>
            <p>
              핵심 안전 장치로, <code className="text-cyan-600">old_string</code>이 파일 내에서
              <strong>고유</strong>해야 합니다. 여러 곳에 존재하면 에러를 반환하여 의도치 않은
              다중 수정을 방지합니다. 모든 발생 위치를 교체하려면
              <code className="text-cyan-600"> replace_all: true</code>를 명시적으로 설정해야 합니다.
            </p>
            <p>
              편집 후에는 변경 위치 주변의 컨텍스트 라인(+-3줄)을 metadata에 포함하여 UI에서
              diff 미리보기를 보여줄 수 있습니다. 권한 수준은
              <code className="text-amber-600"> &quot;confirm&quot;</code>으로,
              파일을 변경하므로 사용자 확인이 필요합니다.
            </p>
          </div>

          <MermaidDiagram
            title="file_edit 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  EXEC["Tool Executor<br/><small>tools/executor.ts</small>"]
  FE["file_edit<br/><small>file-edit.ts</small>"]
  FR["file_read<br/><small>file-read.ts</small>"]
  PERM["Permission Manager<br/><small>permissions/</small>"]
  FS["Node.js fs<br/><small>readFile / writeFile</small>"]
  HINT["Import Hint<br/><small>import-hint.ts</small>"]

  AGENT -->|"도구 호출"| EXEC
  EXEC -->|"권한 확인"| PERM
  PERM -->|"confirm"| FE
  FR -.->|"먼저 읽기"| FE
  FE -->|"read → replace → write"| FS
  FE -->|"관련 파일 안내"| HINT

  style FE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style FR fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PERM fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style HINT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style FS fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 문서의 &quot;찾기 및 바꾸기&quot;를 떠올리세요. 하지만 일반 에디터와 달리,
            찾으려는 텍스트가 문서에 딱 하나만 있을 때만 교체를 허용합니다. 여러 곳에 있으면
            &quot;어디를 바꿀지 모호합니다&quot;라고 알려주어 실수를 방지합니다.
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
            Zod로 정의된 입력 매개변수입니다. path, old_string, new_string이 필수입니다.
          </p>
          <ParamTable
            params={[
              { name: "path", type: "string", required: true, desc: "편집할 파일 경로" },
              { name: "old_string", type: "string", required: true, desc: "찾을 문자열 — 공백/들여쓰기 포함 정확히 일치해야 함" },
              { name: "new_string", type: "string", required: true, desc: "교체할 문자열 — old_string을 이 문자열로 바꿈" },
              { name: "replace_all", type: "boolean", required: false, desc: "모든 발생 위치를 교체할지 여부 (기본값: false)" },
            ]}
          />

          {/* ToolDefinition */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            fileEditTool (ToolDefinition)
          </h3>
          <ParamTable
            params={[
              { name: "name", type: '"file_edit"', required: true, desc: "도구 이름 — 레지스트리에서 이 이름으로 호출됨" },
              { name: "permissionLevel", type: '"confirm"', required: true, desc: "파일 변경이므로 사용자 확인 필요" },
              { name: "timeoutMs", type: "30_000", required: true, desc: "30초 타임아웃" },
            ]}
          />

          {/* 반환 metadata */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            반환 metadata 필드
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            성공 시 반환되는 metadata에는 변경 위치 정보가 포함됩니다.
          </p>
          <ParamTable
            params={[
              { name: "path", type: "string", required: true, desc: "정규화된 파일 경로" },
              { name: "lineNumber", type: "number", required: true, desc: "변경이 시작된 줄 번호 (1-based)" },
              { name: "linesAdded", type: "number", required: true, desc: "추가된 줄 수" },
              { name: "linesRemoved", type: "number", required: true, desc: "삭제된 줄 수" },
              { name: "contextLines", type: "string[]", required: true, desc: "변경 위치 주변 +-3줄의 코드" },
              { name: "contextStartLine", type: "number", required: true, desc: "컨텍스트 시작 줄 번호 (1-based)" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">old_string</code>은 공백, 탭, 줄바꿈을 포함하여
              <strong>정확히</strong> 일치해야 합니다. 들여쓰기가 다르면 매칭되지 않습니다.
            </li>
            <li>
              <code className="text-cyan-600">replace_all: false</code>(기본값)일 때
              <code className="text-cyan-600"> old_string</code>이 2개 이상 존재하면 에러를 반환합니다.
              더 많은 주변 컨텍스트를 포함하여 고유하게 만드세요.
            </li>
            <li>
              반드시 <code className="text-cyan-600">file_read</code>로 파일 내용을 먼저 확인한 후 사용하세요.
              읽지 않고 수정하면 들여쓰기나 공백이 맞지 않아 매칭 실패할 수 있습니다.
            </li>
            <li>
              편집 후 <code className="text-cyan-600">buildImportHint()</code>가 수정된 파일을 import하는
              다른 파일 목록을 안내합니다. 인터페이스 변경 시 관련 파일도 확인하세요.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 단일 문자열 교체</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 일반적인 사용 패턴입니다. 파일에서 고유한 문자열을 찾아 교체합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. 먼저 file_read로 파일 내용 확인"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">content</span> = <span className="kw">await</span> <span className="fn">fileRead</span>({"{"} <span className="prop">path</span>: <span className="str">&quot;src/config.ts&quot;</span> {"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 고유한 문자열을 찾아 교체"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">fileEdit</span>({"{"}
            {"\n"}{"  "}<span className="prop">path</span>: <span className="str">&quot;src/config.ts&quot;</span>,
            {"\n"}{"  "}<span className="prop">old_string</span>: <span className="str">&quot;const MAX_RETRIES = 3;&quot;</span>,
            {"\n"}{"  "}<span className="prop">new_string</span>: <span className="str">&quot;const MAX_RETRIES = 5;&quot;</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 결과: Successfully edited src/config.ts"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>old_string</code>은 반드시 파일에 존재하는 <strong>정확한</strong> 문자열이어야 합니다.
            공백이나 탭 하나라도 다르면 &quot;String not found&quot; 에러가 발생합니다.
          </Callout>

          {/* 모든 발생 위치 교체 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 모든 발생 위치 교체 (replace_all)
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            변수 이름 변경 등 파일 전체에서 동일한 문자열을 모두 교체하려면
            <code className="text-cyan-600"> replace_all: true</code>를 사용합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 변수 이름을 전체 교체"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">fileEdit</span>({"{"}
            {"\n"}{"  "}<span className="prop">path</span>: <span className="str">&quot;src/utils.ts&quot;</span>,
            {"\n"}{"  "}<span className="prop">old_string</span>: <span className="str">&quot;oldVarName&quot;</span>,
            {"\n"}{"  "}<span className="prop">new_string</span>: <span className="str">&quot;newVarName&quot;</span>,
            {"\n"}{"  "}<span className="prop">replace_all</span>: <span className="kw">true</span>,
            {"\n"}{"}"});
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>replace_all</code>은 내부적으로 <code>split(old).join(new)</code> 방식으로
            모든 발생 위치를 한 번에 교체합니다. 정규식이 아닌 정확한 문자열 매칭입니다.
          </Callout>

          <DeepDive title="고유성 검사의 동작 방식">
            <p className="mb-3">
              <code className="text-cyan-600">replace_all: false</code>(기본값)일 때, 내부적으로
              <code className="text-cyan-600"> indexOf()</code>를 두 번 호출하여 고유성을 확인합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 첫 번째 발견 위치"}</span>
              {"\n"}<span className="kw">const</span> <span className="prop">firstIdx</span> = <span className="prop">content</span>.<span className="fn">indexOf</span>(<span className="prop">old_string</span>);
              {"\n"}<span className="cm">{"// 두 번째 발견 위치 (firstIdx + 1부터 검색)"}</span>
              {"\n"}<span className="kw">const</span> <span className="prop">secondIdx</span> = <span className="prop">content</span>.<span className="fn">indexOf</span>(<span className="prop">old_string</span>, <span className="prop">firstIdx</span> + <span className="num">1</span>);
              {"\n"}
              {"\n"}<span className="cm">{"// secondIdx !== -1이면 2개 이상 존재 → 에러"}</span>
              {"\n"}<span className="cm">{"// 총 발생 횟수도 세어 에러 메시지에 포함"}</span>
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              여러 곳에 존재할 때는 <strong>주변 컨텍스트를 더 포함</strong>하여 <code className="text-cyan-600">old_string</code>을
              고유하게 만들거나, <code className="text-cyan-600">replace_all: true</code>를 사용하세요.
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
            <code className="text-cyan-600">execute()</code> 함수는 읽기 → 검증 → 교체 → 쓰기의
            4단계로 동작합니다.
          </p>

          <MermaidDiagram
            title="file_edit 실행 흐름"
            titleColor="purple"
            chart={`graph TD
  START(("execute()")) --> READ["readFile<br/><small>파일 전체 읽기</small>"]
  READ --> FIND{"indexOf(old_string)"}
  FIND -->|"not found"| ERR1["에러: String not found"]
  FIND -->|"found"| CHECK{"replace_all?"}
  CHECK -->|"false"| UNIQUE{"고유한가?"}
  CHECK -->|"true"| REPLACE_ALL["split().join()<br/><small>모든 위치 교체</small>"]
  UNIQUE -->|"2개 이상"| ERR2["에러: N occurrences found"]
  UNIQUE -->|"고유"| REPLACE["replace()<br/><small>첫 번째만 교체</small>"]
  REPLACE --> WRITE["writeFile<br/><small>결과 저장</small>"]
  REPLACE_ALL --> WRITE
  WRITE --> CONTEXT["컨텍스트 +-3줄 추출"]
  CONTEXT --> HINT["buildImportHint<br/><small>관련 파일 안내</small>"]
  HINT --> RESULT(("ToolResult"))

  style START fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style FIND fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style CHECK fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style UNIQUE fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style ERR1 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ERR2 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; 교체 및 통계</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            교체 수행 후 변경 통계(줄 번호, 추가/삭제 줄 수)를 계산하고 컨텍스트를 추출합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// [1] 변경 시작 줄 번호 계산"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">lineNumber</span> = <span className="prop">content</span>.<span className="fn">slice</span>(<span className="num">0</span>, <span className="prop">firstIdx</span>).<span className="fn">split</span>(<span className="str">&quot;\n&quot;</span>).<span className="prop">length</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// [2] 교체 수행 (방식이 다름)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">updated</span> = <span className="prop">params</span>.<span className="prop">replace_all</span>
            {"\n"}{"  "}? <span className="prop">content</span>.<span className="fn">split</span>(<span className="prop">old_string</span>).<span className="fn">join</span>(<span className="prop">new_string</span>)
            {"\n"}{"  "}: <span className="prop">content</span>.<span className="fn">replace</span>(<span className="prop">old_string</span>, <span className="prop">new_string</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// [3] 파일에 쓰기"}</span>
            {"\n"}<span className="kw">await</span> <span className="fn">writeFile</span>(<span className="prop">filePath</span>, <span className="prop">updated</span>, <span className="str">&quot;utf-8&quot;</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// [4] 변경 위치 주변 +-3줄 컨텍스트 추출"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">startLine</span> = <span className="fn">Math.max</span>(<span className="num">0</span>, <span className="prop">lineNumber</span> - <span className="num">1</span> - <span className="num">3</span>);
            {"\n"}<span className="kw">const</span> <span className="prop">endLine</span> = <span className="fn">Math.min</span>(<span className="prop">lines</span>.<span className="prop">length</span>, <span className="prop">lineNumber</span> - <span className="num">1</span> + <span className="prop">linesAdded</span> + <span className="num">3</span>);
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 첫 번째 발견 위치 앞의 줄바꿈 개수를 세어 줄 번호를 계산합니다 (1-based).</p>
            <p><strong className="text-gray-900">[2]</strong> <code className="text-cyan-600">replace_all</code>이면 <code>split().join()</code> 방식으로 모든 위치를 교체하고, 아니면 <code>String.replace()</code>로 첫 번째만 교체합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 교체된 전체 내용을 UTF-8로 파일에 씁니다.</p>
            <p><strong className="text-gray-900">[4]</strong> 변경 위치 앞뒤 3줄을 추출하여 UI에서 diff 미리보기를 보여줄 수 있도록 합니다.</p>
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
              &quot;String not found in file 에러가 나요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">old_string</code>이 파일 내용과 정확히 일치하지 않습니다.
              들여쓰기(탭 vs 스페이스), 줄바꿈 문자, 후행 공백을 확인하세요.
            </p>
            <Callout type="tip" icon="*">
              먼저 <code>file_read</code>로 파일을 읽어 <strong>정확한 내용</strong>을 확인한 후,
              해당 내용을 그대로 복사하여 <code>old_string</code>에 사용하세요.
            </Callout>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Found N occurrences 에러가 나요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">old_string</code>이 파일에 여러 번 존재합니다.
              두 가지 해결 방법이 있습니다:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>주변 코드를 포함:</strong> <code className="text-cyan-600">old_string</code>에
                앞뒤 줄을 더 포함하여 고유하게 만드세요.
              </li>
              <li>
                <strong>replace_all 사용:</strong> 모든 위치를 교체하는 것이 맞다면
                <code className="text-cyan-600"> replace_all: true</code>를 설정하세요.
              </li>
            </ul>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;편집 후 import 관련 안내 메시지가 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">buildImportHint()</code>가 수정된 파일을 import하는 다른 파일을
              찾아 안내합니다. 인터페이스나 export를 변경했다면 안내된 파일들도 함께 수정해야 할 수 있습니다.
              이는 정보 제공 목적이며, 에러가 아닙니다.
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
                name: "file-read.ts",
                slug: "tool-file-read",
                relation: "sibling",
                desc: "파일 읽기 도구 — file_edit 전에 반드시 file_read로 내용을 확인해야 합니다",
              },
              {
                name: "tool-registry.ts",
                slug: "tool-registry",
                relation: "parent",
                desc: "도구 레지스트리 — fileEditTool을 등록하고 에이전트에 노출하는 모듈",
              },
              {
                name: "permission-manager.ts",
                slug: "permission-manager",
                relation: "sibling",
                desc: "권한 관리자 — file_edit의 'confirm' 권한 수준을 검증하는 모듈",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
