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

export default function ToolListDirPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/tools/definitions/list-dir.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">list_dir Tool</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
              <span className="text-sm text-gray-500">디렉토리 트리 목록</span>
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              디렉토리 구조를 시각적인 트리 형식으로 출력하는 도구입니다. Unix의 <code>tree</code>{" "}
              명령과 유사하며, 불필요한 디렉토리를 자동으로 제외합니다.
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
                <code className="text-cyan-600">list_dir</code>은 에이전트가 코드베이스 구조를
                파악할 때 사용하는 도구입니다. 디렉토리와 파일을{" "}
                <code className="text-cyan-600">├──</code>,{" "}
                <code className="text-cyan-600">└──</code> 연결선으로 표현하여 계층 구조를
                직관적으로 보여줍니다.
              </p>
              <p>
                <code className="text-cyan-600">node_modules</code>,{" "}
                <code className="text-cyan-600">.git</code>,{" "}
                <code className="text-cyan-600">dist</code> 등 빌드 결과물과 패키지 캐시는 자동으로
                제외됩니다. 디렉토리가 먼저, 파일이 나중에 알파벳순으로 정렬됩니다.
              </p>
              <p>
                기본적으로 현재 레벨만 보여주지만(비재귀),{" "}
                <code className="text-cyan-600">recursive: true</code>와{" "}
                <code className="text-cyan-600">maxDepth</code>로 재귀 탐색 깊이를 제어할 수
                있습니다. 권한 수준은 <code className="text-emerald-600">&quot;safe&quot;</code>로,
                파일 시스템을 읽기만 하므로 사용자 확인 없이 실행됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="list_dir 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  EXEC["Tool Executor<br/><small>tools/executor.ts</small>"]
  LD["list_dir<br/><small>list-dir.ts</small>"]
  BUILD["buildTree()<br/><small>재귀 탐색</small>"]
  FORMAT["formatTree()<br/><small>트리 렌더링</small>"]
  FS["Node.js fs<br/><small>readdir withFileTypes</small>"]

  AGENT -->|"도구 호출"| EXEC
  EXEC --> LD
  LD --> BUILD
  BUILD -->|"readdir()"| FS
  BUILD --> FORMAT
  FORMAT --> LD

  style LD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style BUILD fill:#dcfce7,stroke:#10b981,color:#065f46
  style FORMAT fill:#dcfce7,stroke:#10b981,color:#065f46
  style FS fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 파인더(Finder)나 탐색기(Explorer)의 트리 뷰를 텍스트로 출력하는
              것과 같습니다. LLM이 &ldquo;이 프로젝트의 구조가 어떻게 생겼나요?&rdquo;라고 물어볼 때
              사용합니다.
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
              매개변수 스키마 (paramSchema)
            </h3>
            <ParamTable
              params={[
                {
                  name: "path",
                  type: "string",
                  required: true,
                  desc: "목록을 표시할 디렉토리 경로 (절대 또는 상대 경로)",
                },
                {
                  name: "recursive",
                  type: "boolean",
                  required: false,
                  desc: "재귀적으로 하위 디렉토리도 표시 — 기본값: false",
                },
                {
                  name: "maxDepth",
                  type: "number (1-10)",
                  required: false,
                  desc: "재귀 탐색 최대 깊이 — 기본값: 3, 최대: 10",
                },
              ]}
            />

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              자동 제외 디렉토리 (IGNORED_DIRS)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              다음 디렉토리는 항상 자동으로 제외됩니다.
            </p>
            <ParamTable
              params={[
                { name: ".git", type: "VCS", required: false, desc: "Git 저장소 내부 데이터" },
                {
                  name: "node_modules",
                  type: "패키지",
                  required: false,
                  desc: "npm/yarn 패키지 (수만 개의 파일)",
                },
                {
                  name: ".next / .nuxt",
                  type: "빌드",
                  required: false,
                  desc: "Next.js / Nuxt.js 빌드 결과물",
                },
                {
                  name: "__pycache__ / .venv",
                  type: "Python",
                  required: false,
                  desc: "Python 캐시 및 가상 환경",
                },
                {
                  name: "dist / build",
                  type: "빌드",
                  required: false,
                  desc: "빌드 배포 디렉토리",
                },
                {
                  name: ".gradle / .idea / .vscode",
                  type: "IDE",
                  required: false,
                  desc: "빌드 캐시 및 IDE 설정",
                },
              ]}
            />

            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                타임아웃은 30초입니다. 매우 깊은 디렉토리 구조나 느린 네트워크 드라이브에서는
                타임아웃이 발생할 수 있습니다.
              </li>
              <li>
                권한이 없는 하위 디렉토리는 탐색을 건너뜁니다. 에러를 발생시키지 않고 해당
                디렉토리의 자식 항목을 표시하지 않습니다.
              </li>
              <li>
                빈 디렉토리에서는 <code className="text-cyan-600">(empty directory)</code>를
                반환합니다.
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

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 현재 레벨 목록
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              지정된 경로의 직접 자식 항목만 나열합니다 (비재귀).
            </p>
            <CodeBlock>
              {"// 프로젝트 루트 목록\n"}
              {"{\n"}
              {"  path: '.'\n"}
              {"}\n"}
              {"\n"}
              {"// 출력 예시:\n"}
              {"// ├── src/\n"}
              {"// ├── test/\n"}
              {"// ├── package.json\n"}
              {"// └── tsconfig.json"}
            </CodeBlock>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 재귀 탐색
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">recursive: true</code>와{" "}
              <code className="text-cyan-600">maxDepth</code>로 전체 구조를 파악합니다.
            </p>
            <CodeBlock>
              {"// src 디렉토리 재귀 탐색 (최대 2단계)\n"}
              {"{\n"}
              {"  path: 'src',\n"}
              {"  recursive: true,\n"}
              {"  maxDepth: 2\n"}
              {"}\n"}
              {"\n"}
              {"// 출력 예시:\n"}
              {"// ├── cli/\n"}
              {"// │   ├── components/\n"}
              {"// │   └── hooks/\n"}
              {"// ├── core/\n"}
              {"// │   ├── agent-loop.ts\n"}
              {"// │   └── context-manager.ts\n"}
              {"// └── index.ts"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>maxDepth</code>를 너무 크게 설정하면 수천 개의 항목이
              반환될 수 있습니다. LLM 컨텍스트를 낭비하지 않도록 필요한 깊이만큼만 탐색하세요.
              일반적으로 <code>maxDepth: 3</code> 이하를 권장합니다.
            </Callout>

            <DeepDive title="트리 렌더링 알고리즘 상세">
              <p className="mb-3">
                <code className="text-cyan-600">formatTree()</code> 함수는 다음 규칙으로 트리를
                렌더링합니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600 text-[13px]">
                <li>
                  마지막 항목은 <code>&quot;└── &quot;</code>, 나머지는{" "}
                  <code>&quot;├── &quot;</code> 연결선을 사용합니다.
                </li>
                <li>
                  하위 항목의 접두사: 부모가 마지막 항목이면 <code>&quot; &quot;</code>(공백 4개),
                  아니면 <code>&quot;│ &quot;</code>(세로선 + 공백 3개).
                </li>
                <li>
                  디렉토리 이름 뒤에는 <code>/</code>를 붙여 파일과 구분합니다.
                </li>
              </ul>
              <p className="mt-3 text-gray-600 text-[13px]">
                2단계 구조(buildTree → formatTree)를 사용하여 데이터 수집과 표현을 분리합니다.
                테스트 시 <code>buildTree()</code>만 단위 테스트하고, <code>formatTree()</code>는
                별도로 렌더링 테스트할 수 있습니다.
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
              2단계 파이프라인: 데이터 수집(buildTree) → 렌더링(formatTree).
            </p>

            <MermaidDiagram
              title="list_dir 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("execute()")) --> RESOLVE["경로 resolve<br/><small>context.workingDirectory + path</small>"]
  RESOLVE --> BUILD["buildTree()<br/><small>재귀 탐색</small>"]
  BUILD --> READDIR["readdir(withFileTypes: true)"]
  READDIR --> FILTER["IGNORED_DIRS 필터링"]
  FILTER --> SORT["정렬<br/><small>디렉토리 먼저, 알파벳순</small>"]
  SORT --> DEPTH{"maxDepth<br/>도달?"}
  DEPTH -->|"아직"| RECURSE["하위 디렉토리 재귀"]
  DEPTH -->|"도달"| LEAF["리프 노드"]
  RECURSE --> BUILD
  LEAF --> FORMAT["formatTree()<br/><small>├──, └── 렌더링</small>"]
  FORMAT --> RESULT["ToolResult 반환"]

  style START fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style BUILD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style FORMAT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              정렬 로직: 디렉토리를 먼저 정렬하는 비교 함수입니다.
            </p>
            <CodeBlock>
              {"// 디렉토리 먼저, 같은 종류 내에서는 알파벳순\n"}
              {"const sorted = entries\n"}
              {"  .filter(e => !IGNORED_DIRS.has(e.name))\n"}
              {"  .sort((a, b) => {\n"}
              {"    if (a.isDirectory() !== b.isDirectory()) {\n"}
              {"      return a.isDirectory() ? -1 : 1;\n"}
              {"    }\n"}
              {"    return a.name.localeCompare(b.name);\n"}
              {"  });"}
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
                  Q: 출력이 너무 많아 LLM이 처리하기 어렵습니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  <code className="text-cyan-600">recursive: false</code>(기본값)로 먼저 전체 구조를
                  파악한 후, 관심 있는 하위 디렉토리만 <code>recursive: true</code>로 탐색하는
                  전략을 사용하세요. <code>maxDepth: 2</code>로 제한하는 것도 효과적입니다.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: &ldquo;(empty directory)&rdquo;가 반환됩니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  해당 디렉토리가 실제로 비어있거나, 모든 항목이{" "}
                  <code className="text-cyan-600">IGNORED_DIRS</code>에 해당하는 경우입니다.{" "}
                  <code>node_modules</code>만 있는 프로젝트 루트에서 발생할 수 있습니다.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: 특정 디렉토리가 제외되길 원하지 않습니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  <code className="text-cyan-600">IGNORED_DIRS</code>는 소스 코드에 하드코딩되어
                  있어 현재 런타임에서 변경할 수 없습니다. 제외된 디렉토리를 탐색하려면{" "}
                  <code className="text-cyan-600">bash_exec</code>로 <code>ls -la</code> 또는{" "}
                  <code>find</code>를 직접 실행하세요.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">Q: 타임아웃이 발생합니다.</h4>
                <p className="text-[13px] text-gray-600">
                  30초 타임아웃이 설정되어 있습니다. 매우 많은 파일이 있거나 느린 디스크인 경우
                  발생할 수 있습니다. <code className="text-cyan-600">maxDepth</code>를 줄이거나 더
                  구체적인 하위 경로를 지정하세요.
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
                  href: "/docs/tool-glob-search",
                  title: "glob_search Tool",
                  desc: "파일 이름 패턴으로 파일을 검색합니다",
                },
                {
                  href: "/docs/tool-file-read",
                  title: "file_read Tool",
                  desc: "파일 내용을 읽습니다",
                },
                {
                  href: "/docs/tool-grep-search",
                  title: "grep_search Tool",
                  desc: "파일 내용에서 패턴을 검색합니다",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
