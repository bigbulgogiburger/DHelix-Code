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

export default function CmdMemoryPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/memory.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/memory 메모리 관리</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              세션 간 영구적으로 기억해야 할 정보를 마크다운 파일로 관리하는 프로젝트 메모리
              시스템입니다.
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
                <code className="text-cyan-600">/memory</code>는 dhelix가 세션 사이에 기억해야 할
                정보를 저장하고 관리하는 명령어입니다. 프로젝트별 규칙, 이전 세션에서 발견한 사항,
                자주 참조하는 정보를 <code className="text-cyan-600">.dhelix/memory/</code>{" "}
                디렉토리에 마크다운 파일로 영구 저장합니다.
              </p>
              <p>
                7개의 서브커맨드를 제공하며, 하위 호환성을 위해
                <code className="text-cyan-600">/memory &lt;이름&gt;</code>으로 직접 조회하거나
                <code className="text-cyan-600">/memory &lt;이름&gt; &lt;내용&gt;</code>으로 직접
                쓰는 것도 가능합니다.
              </p>
              <p>
                메모리는 <strong>프로젝트 스코프</strong>와 <strong>전역 스코프</strong> 두 가지로
                나뉩니다. 프로젝트 메모리는 해당 프로젝트에서만, 전역 메모리는 모든 프로젝트에서
                참조됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="/memory 명령어 아키텍처"
              titleColor="purple"
              chart={`graph TD
  CMD["/memory 명령어"]
  ROUTER["서브커맨드 라우터<br/><small>switch/case 분기</small>"]
  LIST["list<br/><small>파일 목록 + 메타데이터</small>"]
  VIEW["view<br/><small>파일 내용 조회</small>"]
  EDIT["edit<br/><small>파일 생성/수정</small>"]
  DEL["delete<br/><small>파일 삭제</small>"]
  STATUS["status<br/><small>프로젝트/전역 상태</small>"]
  TOPICS["topics<br/><small>토픽 파일 목록</small>"]
  SEARCH["search<br/><small>전체 텍스트 검색</small>"]
  FS[".dhelix/memory/<br/><small>마크다운 파일 저장소</small>"]

  CMD --> ROUTER
  ROUTER --> LIST
  ROUTER --> VIEW
  ROUTER --> EDIT
  ROUTER --> DEL
  ROUTER --> STATUS
  ROUTER --> TOPICS
  ROUTER --> SEARCH
  LIST --> FS
  VIEW --> FS
  EDIT --> FS
  DEL --> FS
  SEARCH --> FS

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style ROUTER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style FS fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> /memory는 프로젝트의 &quot;노트북&quot;입니다. 각 세션에서
              발견한 중요한 정보를 적어두면, 다음 세션에서 dhelix가 그 노트를 읽고 이전 맥락을
              이해한 채로 작업을 시작합니다.
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

            {/* MemoryFileInfo interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface MemoryFileInfo
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              단일 메모리 파일의 메타데이터입니다. 목록 조회 시 각 파일의 정보를 나타냅니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "name",
                  type: "string",
                  required: true,
                  desc: '파일명 (예: "architecture.md")',
                },
                { name: "sizeBytes", type: "number", required: true, desc: "파일 크기 (바이트)" },
                { name: "lineCount", type: "number", required: true, desc: "파일의 줄 수" },
              ]}
            />

            {/* 서브커맨드 레퍼런스 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              서브커맨드
            </h3>
            <ParamTable
              params={[
                {
                  name: "/memory",
                  type: "list",
                  required: false,
                  desc: "모든 메모리 파일 목록 (크기, 줄 수 포함)",
                },
                {
                  name: "/memory view <이름>",
                  type: "read",
                  required: false,
                  desc: "특정 메모리 파일 내용 조회 (.md 확장자 자동 추가)",
                },
                {
                  name: "/memory edit <이름> <내용>",
                  type: "write",
                  required: false,
                  desc: "메모리 파일 생성 또는 수정 (디렉토리 자동 생성)",
                },
                {
                  name: "/memory delete <이름>",
                  type: "delete",
                  required: false,
                  desc: "메모리 파일 삭제",
                },
                {
                  name: "/memory status",
                  type: "info",
                  required: false,
                  desc: "프로젝트/전역 메모리 상태 (파일 수, 줄 수, 메인 파일 여부)",
                },
                {
                  name: "/memory topics",
                  type: "list",
                  required: false,
                  desc: "토픽 파일만 표시 (MEMORY.md 메인 파일 제외)",
                },
                {
                  name: "/memory search <쿼리>",
                  type: "search",
                  required: false,
                  desc: "모든 메모리 파일에서 대소문자 무시 텍스트 검색",
                },
              ]}
            />

            {/* 핵심 헬퍼 함수 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              핵심 헬퍼 함수
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              메모리 파일 CRUD를 담당하는 내부 함수들입니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span>{" "}
              <span className="fn">listMemoryFilesDetailed</span>(
              <span className="prop">memoryDir</span>): <span className="type">Promise</span>&lt;
              <span className="type">MemoryFileInfo[]</span>&gt;
              {"\n"}
              <span className="kw">async function</span> <span className="fn">readMemoryFile</span>(
              <span className="prop">memoryDir</span>, <span className="prop">name</span>):{" "}
              <span className="type">Promise</span>&lt;<span className="type">string | null</span>
              &gt;
              {"\n"}
              <span className="kw">async function</span> <span className="fn">writeMemoryFile</span>
              (<span className="prop">memoryDir</span>, <span className="prop">name</span>,{" "}
              <span className="prop">content</span>): <span className="type">Promise</span>&lt;
              <span className="type">void</span>&gt;
              {"\n"}
              <span className="kw">async function</span>{" "}
              <span className="fn">deleteMemoryFile</span>(<span className="prop">memoryDir</span>,{" "}
              <span className="prop">name</span>): <span className="type">Promise</span>&lt;
              <span className="type">boolean</span>&gt;
              {"\n"}
              <span className="kw">async function</span>{" "}
              <span className="fn">searchMemoryFiles</span>(<span className="prop">memoryDir</span>,{" "}
              <span className="prop">query</span>): <span className="type">Promise</span>&lt;
              <span className="type">SearchResult[]</span>&gt;
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                파일명에 <code className="text-cyan-600">.md</code> 확장자를 생략해도 자동으로
                추가됩니다.
                <code className="text-cyan-600">/memory view architecture</code>는
                <code>architecture.md</code>를 조회합니다.
              </li>
              <li>
                <code className="text-cyan-600">writeMemoryFile()</code>은 메모리 디렉토리가 없으면
                <code>mkdir recursive</code>로 자동 생성합니다.
              </li>
              <li>
                검색(<code className="text-cyan-600">search</code>)은{" "}
                <strong>대소문자를 무시</strong>합니다. 정규식은 지원하지 않으며 순수 문자열 매칭만
                수행합니다.
              </li>
              <li>
                메인 메모리 파일(<code className="text-cyan-600">MEMORY.md</code>)은 최대 줄 수 제한
                (<code>MEMORY_MAX_MAIN_LINES</code>)이 있으며, <code>/memory status</code>에서 확인
                가능합니다.
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
              기본 사용법 &mdash; 메모리 목록 조회
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자 없이 <code className="text-cyan-600">/memory</code>를 입력하면 모든 메모리 파일의
              이름, 줄 수, 크기를 한눈에 확인할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="str">/memory</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 예시:"}</span>
              {"\n"}
              <span className="cm">{"// Memory files (.dhelix/memory/):"}</span>
              {"\n"}
              <span className="cm">
                {"//   MEMORY.md                       42 lines     1.2KB"}
              </span>
              {"\n"}
              <span className="cm">
                {"//   architecture.md                 28 lines     0.8KB"}
              </span>
              {"\n"}
              <span className="cm">
                {"//   testing-rules.md                15 lines     0.4KB"}
              </span>
              {"\n"}
              <span className="cm">{"//   Total: 3 file(s)"}</span>
            </CodeBlock>

            {/* 파일 조회 및 편집 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              파일 조회 및 편집
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              개별 메모리 파일의 내용을 읽거나, 새로운 메모리를 생성하거나, 기존 내용을 수정할 수
              있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 특정 메모리 파일 읽기"}</span>
              {"\n"}
              <span className="str">/memory view architecture</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 새 메모리 파일 생성 (디렉토리 자동 생성)"}</span>
              {"\n"}
              <span className="str">
                /memory edit deploy-notes 배포 시 주의사항: staging 먼저 확인
              </span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 메모리 파일 삭제"}</span>
              {"\n"}
              <span className="str">/memory delete old-notes</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 하위 호환 단축키"}</span>
              {"\n"}
              <span className="str">/memory architecture</span>
              {"           "}
              <span className="cm">{"// = /memory view architecture"}</span>
              {"\n"}
              <span className="str">/memory todo 할일 목록 정리</span>
              {"   "}
              <span className="cm">{"// = /memory edit todo 할일 목록 정리"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>/memory edit</code>은 파일 전체를 덮어씁니다. 기존 내용에
              추가하려면 먼저 <code>/memory view</code>로 현재 내용을 확인한 후 전체 내용을 포함하여
              다시 작성하세요.
            </Callout>

            {/* 고급 사용법 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 상태 확인 및 검색
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              프로젝트와 전역 메모리의 전체 상태를 확인하거나, 모든 파일에서 키워드를 검색할 수
              있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 프로젝트 + 전역 메모리 상태"}</span>
              {"\n"}
              <span className="str">/memory status</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 예시:"}</span>
              {"\n"}
              <span className="cm">{"// Project Memory:"}</span>
              {"\n"}
              <span className="cm">{"//   Main file:   exists (42/200 lines)"}</span>
              {"\n"}
              <span className="cm">{"//   Files:       3"}</span>
              {"\n"}
              <span className="cm">{"//   Total lines: 85"}</span>
              {"\n"}
              <span className="cm">{"// Global Memory:"}</span>
              {"\n"}
              <span className="cm">{"//   Files:       1"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 전체 메모리에서 텍스트 검색"}</span>
              {"\n"}
              <span className="str">/memory search TypeScript</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 토픽 파일만 보기 (MEMORY.md 제외)"}</span>
              {"\n"}
              <span className="str">/memory topics</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>/memory status</code>에서 메인 파일의 줄 수가 상한에
              가까우면 토픽별로 파일을 분리하는 것이 좋습니다. 예:{" "}
              <code>/memory edit auth-rules ...</code>,<code>/memory edit api-conventions ...</code>
            </Callout>

            <DeepDive title="프로젝트 vs 전역 메모리">
              <p className="mb-3">메모리는 두 가지 스코프로 나뉩니다:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>프로젝트 메모리:</strong> <code>.dhelix/memory/</code> &mdash; 해당
                  프로젝트에서만 유효. git으로 팀과 공유 가능.
                </li>
                <li>
                  <strong>전역 메모리:</strong> <code>~/.dhelix/memory/</code> &mdash; 모든
                  프로젝트에서 참조. 개인 글로벌 규칙 저장용.
                </li>
              </ul>
              <p className="mt-3 text-gray-600">
                <code>/memory</code> 명령어는 기본적으로 <strong>프로젝트 메모리</strong>를 대상으로
                합니다. 전역 메모리 상태는 <code>/memory status</code>로 확인할 수 있습니다.
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
              서브커맨드 라우팅 플로우
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">execute()</code> 함수는 첫 번째 단어를 서브커맨드로
              파싱하고, 인식되지 않는 경우 하위 호환 모드로 폴백합니다.
            </p>

            <MermaidDiagram
              title="/memory 서브커맨드 라우팅"
              titleColor="purple"
              chart={`graph TD
  INPUT["/memory args"]
  PARSE["첫 번째 단어 파싱"]
  EMPTY{"인자 없음?"}
  SW{"switch(firstWord)"}
  LIST["handleList()"]
  VIEW["handleView()"]
  EDIT["handleEdit()"]
  DEL["handleDelete()"]
  STAT["handleStatus()"]
  TOP["handleTopics()"]
  SRCH["handleSearch()"]
  COMPAT{"하위 호환 모드"}
  READ["readMemoryFile()"]
  WRITE["writeMemoryFile()"]

  INPUT --> PARSE
  PARSE --> EMPTY
  EMPTY -->|"예"| LIST
  EMPTY -->|"아니오"| SW
  SW -->|"view"| VIEW
  SW -->|"edit"| EDIT
  SW -->|"delete"| DEL
  SW -->|"status"| STAT
  SW -->|"topics"| TOP
  SW -->|"search"| SRCH
  SW -->|"그 외"| COMPAT
  COMPAT -->|"내용 있음"| WRITE
  COMPAT -->|"이름만"| READ

  style INPUT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style SW fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style COMPAT fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              하위 호환 모드에서의 읽기/쓰기 분기 로직입니다. 서브커맨드로 인식되지 않는 첫 번째
              단어는 파일명으로 취급됩니다.
            </p>
            <CodeBlock>
              <span className="kw">default</span>: {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">name</span> ={" "}
              <span className="prop">firstWord</span>;{"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">content</span> ={" "}
              <span className="prop">rest</span>;{"\n"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">content</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// /memory <이름> <내용> → 파일 쓰기"}</span>
              {"\n"}
              {"    "}
              <span className="kw">await</span> <span className="fn">writeMemoryFile</span>(
              <span className="prop">memoryDir</span>, <span className="prop">name</span>,{" "}
              <span className="prop">content</span>);
              {"\n"}
              {"    "}
              <span className="kw">return</span> {"{"} <span className="prop">output</span>:{" "}
              <span className="str">
                `Memory file written: ${"{"}
                <span className="prop">fileName</span>
                {"}"}`
              </span>{" "}
              {"}"};{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// /memory <이름> → 파일 읽기"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">fileContent</span> ={" "}
              <span className="kw">await</span> <span className="fn">readMemoryFile</span>(
              <span className="prop">memoryDir</span>, <span className="prop">name</span>);
              {"\n"}
              {"  "}
              <span className="kw">return</span> {"{"} <span className="prop">output</span>:{" "}
              <span className="str">
                `--- ${"{"}
                <span className="prop">fileName</span>
                {"}"} ---\n\n${"{"}
                <span className="prop">fileContent</span>
                {"}"}`
              </span>{" "}
              {"}"};{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">ensureMdExtension()</strong> &mdash; 파일명이
                .md로 끝나지 않으면 자동으로 추가합니다. 사용자 편의를 위한 헬퍼입니다.
              </p>
              <p>
                <strong className="text-gray-900">formatBytes()</strong> &mdash; 바이트 수를 사람이
                읽기 쉬운 형식으로 변환합니다 (512B, 1.5KB, 2.3MB).
              </p>
              <p>
                <strong className="text-gray-900">Promise.all</strong> &mdash; status 핸들러에서
                프로젝트/전역 메모리를 동시에 조회하여 성능을 최적화합니다.
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
                &quot;/memory view로 파일을 찾을 수 없다고 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                파일명이 정확한지 확인하세요. <code className="text-cyan-600">/memory</code>로 전체
                목록을 조회하면 현재 저장된 파일명을 확인할 수 있습니다. .md 확장자는 생략
                가능하지만 파일명 자체는 정확히 일치해야 합니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;/memory edit으로 기존 내용에 추가하고 싶어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code>/memory edit</code>은 파일 전체를 덮어씁니다. 기존 내용을 유지하려면 먼저{" "}
                <code>/memory view &lt;이름&gt;</code>으로 현재 내용을 확인하고, 기존 내용과 새
                내용을 합쳐서 <code>/memory edit</code>을 실행하세요. 또는 LLM에게 &quot;이 메모리
                파일에 추가해주세요&quot;라고 요청할 수도 있습니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;전역 메모리를 직접 편집할 수 있나요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code>/memory</code> 명령어는 프로젝트 메모리만 편집합니다. 전역 메모리는{" "}
                <code>~/.dhelix/memory/</code> 디렉토리에 직접 마크다운 파일을 생성하거나 편집하면
                됩니다. <code>/memory status</code>로 전역 메모리의 상태를 확인할 수 있습니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;메모리 파일이 너무 많아졌어요. 정리 방법은?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code>/memory topics</code>로 토픽 파일만 확인하고, 불필요한 파일을
                <code>/memory delete &lt;이름&gt;</code>으로 삭제하세요. 관련 내용은 하나의 파일로
                합치는 것이 좋습니다. 메인 파일(MEMORY.md)의 줄 수 상한도{" "}
                <code>/memory status</code>에서 모니터링하세요.
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
                  name: "memory-manager.ts",
                  slug: "memory-manager",
                  relation: "sibling",
                  desc: "자동 메모리 기록/로드 — 세션 시작 시 메모리 파일을 자동으로 시스템 프롬프트에 주입",
                },
                {
                  name: "memory-writer.ts",
                  slug: "memory-writer",
                  relation: "sibling",
                  desc: "에이전트 루프가 자동으로 중요 정보를 메모리에 기록하는 라이터 모듈",
                },
                {
                  name: "auto-memory.ts",
                  slug: "auto-memory",
                  relation: "sibling",
                  desc: "자동 메모리 수집 — 세션 중 발견한 패턴과 규칙을 자동으로 기록",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
