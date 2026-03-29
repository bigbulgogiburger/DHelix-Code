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

export default function ImportHintPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/tools/import-hint.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Import Hint</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
              <span className="text-sm text-gray-500">멀티파일 편집 보조 힌트</span>
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              TypeScript/JavaScript 파일 편집 후, 해당 파일을 import하는 다른 파일 목록을 LLM에게
              힌트로 제공하여 멀티파일 편집 시 관련 파일을 놓치지 않도록 합니다.
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
                <code className="text-cyan-600">import-hint.ts</code>는 독립적인 도구가 아니라{" "}
                <code className="text-cyan-600">file_edit</code>과{" "}
                <code className="text-cyan-600">file_write</code> 도구의 결과에 자동으로 추가되는
                보조 유틸리티입니다. LLM이 TypeScript 파일을 수정할 때, &ldquo;이 파일을 import하는
                다른 파일들도 확인하세요&rdquo;라는 맥락 힌트를 제공합니다.
              </p>
              <p>
                동작 원리: 편집된 파일의 export 심볼을 정규식으로 추출하고,{" "}
                <strong>ripgrep(rg)</strong>으로 프로젝트 전체에서 해당 파일을 import하는 파일들을
                검색합니다. ripgrep이 없으면 힌트 생성을 조용히 건너뜁니다 (성능 우선).
              </p>
              <p>
                TypeScript/JavaScript 파일(
                <code className="text-cyan-600">.ts, .tsx, .js, .jsx, .mts, .mjs</code> 등)에서만
                동작합니다. 최대 20개 파일까지 표시하며, ripgrep 검색 타임아웃은 5초입니다. 힌트
                생성 실패는 도구 실행을 실패시키지 않습니다.
              </p>
            </div>

            <MermaidDiagram
              title="import-hint 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  FE["file_edit / file_write<br/><small>도구 실행 완료</small>"]
  IH["buildImportHint()<br/><small>import-hint.ts</small>"]
  EXT["extractExportedSymbols()<br/><small>정규식 export 추출</small>"]
  RG["ripgrep(rg)<br/><small>import 역참조 검색</small>"]
  HINT["힌트 문자열 생성"]
  RESULT["ToolResult.output에<br/>힌트 append"]

  FE -->|"파일 경로 전달"| IH
  IH --> EXT
  IH --> RG
  EXT -->|"심볼 목록"| HINT
  RG -->|"importing 파일 목록"| HINT
  HINT --> RESULT

  style IH fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style FE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RG fill:#dcfce7,stroke:#10b981,color:#065f46
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> IDE의 &ldquo;Find Usages&rdquo; 기능과 같습니다. 함수 이름을
              바꾸면 IDE가 &ldquo;이 함수를 쓰는 파일이 5개 있습니다&rdquo;라고 알려주는 것처럼,
              import-hint는 파일 편집 후 자동으로 같은 정보를 LLM에게 제공합니다.
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

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              buildImportHint(filePath, workingDirectory)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              메인 진입점. 파일을 분석하고 힌트 문자열을 반환합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "filePath",
                  type: "string",
                  required: true,
                  desc: "편집/생성된 파일의 절대 경로",
                },
                {
                  name: "workingDirectory",
                  type: "string",
                  required: true,
                  desc: "프로젝트 루트 디렉토리 (ripgrep 검색 범위)",
                },
                {
                  name: "returns",
                  type: "Promise<string>",
                  required: false,
                  desc: "힌트 문자열 (힌트 없으면 빈 문자열 반환)",
                },
              ]}
            />

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              extractExportedSymbols(content)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              파일 내용에서 export된 심볼 이름들을 추출합니다. 감지하는 패턴은 다음과 같습니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "export function foo",
                  type: "Named",
                  required: false,
                  desc: "함수 export (async 포함)",
                },
                {
                  name: "export const/let/var foo",
                  type: "Named",
                  required: false,
                  desc: "변수 export",
                },
                {
                  name: "export class/interface/type/enum Foo",
                  type: "Named",
                  required: false,
                  desc: "클래스, 인터페이스, 타입, enum export",
                },
                {
                  name: "export { foo, bar as baz }",
                  type: "Re-export",
                  required: false,
                  desc: "이름 변경 포함 re-export",
                },
                {
                  name: "export default",
                  type: "Default",
                  required: false,
                  desc: '"default" 심볼로 추가',
                },
              ]}
            />

            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">상수</h4>
            <ParamTable
              params={[
                {
                  name: "MAX_HINT_FILES",
                  type: "20",
                  required: false,
                  desc: "힌트에 표시할 최대 파일 수",
                },
                {
                  name: "HINT_TIMEOUT_MS",
                  type: "5000",
                  required: false,
                  desc: "ripgrep 검색 타임아웃 (ms)",
                },
                {
                  name: "TS_JS_EXTENSIONS",
                  type: "Set<string>",
                  required: false,
                  desc: ".ts .tsx .js .jsx .mts .mjs .cts .cjs",
                },
              ]}
            />

            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                ripgrep이 설치되어 있지 않으면 힌트를 생성하지 않습니다. 빈 문자열을 반환하며 에러를
                발생시키지 않습니다.
              </li>
              <li>
                정규식 기반 심볼 추출이므로 동적 export (<code>module.exports = </code> 등)나 복잡한
                재-export 패턴은 감지하지 못할 수 있습니다.
              </li>
              <li>TypeScript가 아닌 파일(.py, .json 등)에서는 힌트를 생성하지 않습니다.</li>
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

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              실제 힌트 출력 예시
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">file_edit</code>으로 파일을 수정하면 ToolResult.output
              끝에 다음과 같은 힌트가 자동으로 추가됩니다.
            </p>
            <CodeBlock>
              {"// file_edit 결과 출력에 자동으로 추가됨:\n"}
              {"\n"}
              {"[Hint] This file (src/tools/registry.ts) exports: ToolRegistry, createRegistry.\n"}
              {"Imported by: src/core/agent-loop.ts, src/tools/executor.ts,\n"}
              {"             src/index.ts (+2 more).\n"}
              {"If your edit changes these exports, update the importing files too."}
            </CodeBlock>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              도구 통합 방법
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">file_edit</code>이나{" "}
              <code className="text-cyan-600">file_write</code>의 실행 함수에서 직접 호출합니다.
            </p>
            <CodeBlock>
              {"// file_edit execute() 내부\n"}
              {"import { buildImportHint } from '../import-hint.js';\n"}
              {"\n"}
              {"const hint = await buildImportHint(\n"}
              {"  resolvedPath,\n"}
              {"  context.workingDirectory\n"}
              {");\n"}
              {"\n"}
              {"return {\n"}
              {"  output: `File edited successfully.${hint}`,\n"}
              {"  isError: false,\n"}
              {"};"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>buildImportHint()</code>는 내부적으로 파일 읽기와 ripgrep
              실행을 수행합니다. 힌트 생성 중 발생하는 모든 에러는 조용히 무시되며 빈 문자열을
              반환합니다. 도구 실행을 실패시키지 않습니다.
            </Callout>

            <DeepDive title="ripgrep 검색 패턴 상세">
              <p className="mb-3">
                <code className="text-cyan-600">findImportingFiles()</code>가 ripgrep에 전달하는
                검색 패턴입니다. 파일명 기반으로 import/require 구문을 찾습니다.
              </p>
              <CodeBlock>
                {"// 파일명 'registry'에 대한 검색 패턴 (정규식)\n"}
                {"(from\\s+['\"][^'\"]*\\/registry(?:\\.[^'\"]*)?['\"]|\n"}
                {" require\\s*\\(\\s*['\"][^'\"]*\\/registry(?:\\.[^'\"]*)?['\"]\\s*\\)|\n"}
                {" from\\s+['\"]\\.\\/registry(?:\\.[^'\"]*)?['\"])"}
              </CodeBlock>
              <p className="mt-3 text-gray-600 text-[13px]">
                ripgrep 옵션: <code className="text-cyan-600">--files-with-matches</code>(파일명만),{" "}
                <code className="text-cyan-600">--type ts --type js</code>(TS/JS만 검색),{" "}
                <code className="text-cyan-600">--no-heading --color never</code>(출력 정규화).
              </p>
              <p className="mt-2 text-gray-600 text-[13px]">
                검색 결과에서 편집 대상 파일 자체는 제외됩니다. 결과 경로는 작업 디렉토리 기준 상대
                경로로 정규화됩니다.
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
              실행 흐름 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">buildImportHint()</code>의 전체 흐름입니다. 실패는
              모두 빈 문자열 반환으로 처리됩니다.
            </p>

            <MermaidDiagram
              title="buildImportHint 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("buildImportHint()")) --> EXT_CHECK{"TS/JS<br/>확장자?"}
  EXT_CHECK -->|"아님"| EMPTY["빈 문자열 반환"]
  EXT_CHECK -->|"맞음"| READ["파일 내용 읽기"]
  READ --> EXTRACT["extractExportedSymbols()"]
  EXTRACT --> SYM_CHECK{"심볼 있음?"}
  SYM_CHECK -->|"없음"| EMPTY
  SYM_CHECK -->|"있음"| RG["ripgrep 검색<br/><small>findImportingFiles()</small>"]
  RG --> FILE_CHECK{"importing<br/>파일 있음?"}
  FILE_CHECK -->|"없음"| EMPTY
  FILE_CHECK -->|"있음"| HINT["힌트 문자열 조합"]
  HINT --> RETURN["힌트 반환"]

  style START fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXT_CHECK fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style RG fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style RETURN fill:#dcfce7,stroke:#10b981,color:#065f46
  style EMPTY fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              최종 힌트 문자열을 조합하는 로직입니다.
            </p>
            <CodeBlock>
              {"// 심볼 목록 (최대 10개 표시)\n"}
              {"const symbolList = exportedSymbols.length <= 10\n"}
              {"  ? exportedSymbols.join(', ')\n"}
              {"  : `${exportedSymbols.slice(0, 10).join(', ')} (+N more)`;\n"}
              {"\n"}
              {"// 파일 목록 (최대 20개)\n"}
              {"const fileList = importingFiles.slice(0, MAX_HINT_FILES).join(', ');\n"}
              {"\n"}
              {"// 힌트 문자열 템플릿\n"}
              {"return `\\n[Hint] This file (${relPath}) exports: ${symbolList}. ` +\n"}
              {"       `Imported by: ${fileList}${truncated}. ` +\n"}
              {"       `If your edit changes these exports, update the importing files too.`;"}
            </CodeBlock>
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

            <div className="space-y-6">
              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: 파일을 편집해도 힌트가 표시되지 않습니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  세 가지 이유 중 하나입니다: (1) ripgrep이 설치되지 않음, (2) 편집된 파일에 export
                  심볼이 없음, (3) 해당 파일을 import하는 파일이 없음. ripgrep 설치 여부는
                  터미널에서 <code className="text-cyan-600">rg --version</code>으로 확인하세요.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: 힌트에 관련 없는 파일이 포함됩니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  파일명 기반 검색이므로 동일한 이름의 다른 모듈을 import하는 파일이 포함될 수
                  있습니다. 예를 들어 <code>utils.ts</code>를 편집하면 다른 패키지의{" "}
                  <code>utils</code>를 import하는 파일도 결과에 포함될 수 있습니다. 이는 알려진
                  제한사항입니다.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: &ldquo;export default&rdquo;가 감지되지 않습니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  <code className="text-cyan-600">export default</code>가 있으면{" "}
                  <code className="text-cyan-600">&quot;default&quot;</code>라는 심볼로 추가됩니다.
                  하지만 dhelix 프로젝트는 default export를 사용하지 않으므로 일반적으로 이 경우는
                  발생하지 않습니다.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: 힌트 생성에 시간이 많이 걸립니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  ripgrep 검색 타임아웃은 5초입니다. 매우 큰 프로젝트에서는 5초를 초과할 수 있으며,
                  이 경우 힌트 없이 빈 문자열을 반환합니다. 도구 실행에는 영향을 주지 않습니다.
                </p>
              </div>
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
              links={[
                {
                  href: "/docs/tool-file-edit",
                  title: "file_edit Tool",
                  desc: "파일 편집 도구 — import-hint가 통합된 주 도구",
                },
                {
                  href: "/docs/tool-grep-search",
                  title: "grep_search Tool",
                  desc: "파일 내용 패턴 검색 — ripgrep을 직접 활용하는 도구",
                },
                {
                  href: "/docs/tool-registry",
                  title: "Tool Registry",
                  desc: "모든 도구를 등록하고 관리하는 중앙 저장소",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
