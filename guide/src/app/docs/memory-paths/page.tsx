"use client";

import { FilePath } from "@/components/FilePath";
import { LayerBadge } from "@/components/LayerBadge";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { DeepDive } from "@/components/DeepDive";
import { ParamTable } from "@/components/ParamTable";
import { SeeAlso } from "@/components/SeeAlso";

export default function MemoryPathsPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilePath path="src/memory/paths.ts" />
              <LayerBadge layer="leaf" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
              <span className="text-gray-900">Memory Paths</span>
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[640px]">
              프로젝트 경로를 SHA-256 해시로 변환하여{" "}
              <span className="text-cyan-600 font-semibold">
                안전하고 안정적인 메모리 파일 경로
              </span>
              를 계산하는 순수 유틸리티 모듈입니다. 세션이 바뀌어도 같은 프로젝트는 항상 같은 메모리
              디렉토리를 가리킵니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ───────────────────── 2. 개요 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"📋"}</span> 개요
            </h2>
            <p className="text-[14px] text-gray-600 leading-relaxed mb-4">
              메모리 파일은 <code className="text-cyan-600 text-xs">~/.dhelix/projects/</code>{" "}
              아래에 저장됩니다. 프로젝트 루트 경로에 특수문자가 있어도 디렉토리명으로 안전하게
              사용할 수 있도록,{" "}
              <strong className="text-gray-900">절대 경로의 SHA-256 해시 앞 16자</strong>를
              디렉토리명으로 사용합니다. 같은 절대 경로는 항상 같은 해시를 생성하므로 세션 간 메모리
              일관성이 보장됩니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>순수 함수 모듈:</strong> paths.ts는 부작용 없는 순수 함수만 제공합니다. 파일
              시스템 읽기/쓰기는 <code className="text-cyan-600 text-xs">loader.ts</code>와{" "}
              <code className="text-cyan-600 text-xs">writer.ts</code>가 담당하며, paths.ts는 경로
              계산만 수행합니다.
            </Callout>

            <MermaidDiagram
              title="메모리 경로 구조"
              titleColor="cyan"
              chart={`flowchart TB
  PROJECT["프로젝트 루트<br/><small>/Users/alice/my-app</small>"]
  HASH["computeProjectHash()<br/><small>SHA-256 → 앞 16자</small>"]
  DIR["메모리 디렉토리<br/><small>~/.dhelix/projects/a1b2c3d4e5f6g7h8/memory/</small>"]
  MAIN["MEMORY.md<br/><small>주 메모리 파일</small>"]
  TOPIC["{토픽}.md<br/><small>overflow 섹션</small>"]

  PROJECT -->|resolve() 정규화| HASH
  HASH -->|getMemoryDir()| DIR
  DIR -->|getMemoryFilePath()| MAIN
  DIR -->|getTopicFilePath()| TOPIC

  style PROJECT fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style HASH fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style DIR fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style MAIN fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px
  style TOPIC fill:#f8fafc,stroke:#3b82f6,color:#3b82f6`}
            />
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 3. 레퍼런스 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"📖"}</span> 레퍼런스
            </h2>

            {/* computeProjectHash */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">computeProjectHash()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                프로젝트 루트의 절대 경로에서 16자 hex 해시를 생성합니다.{" "}
                <code className="text-cyan-600 text-xs">resolve()</code>로 경로를 정규화하므로 상대
                경로를 넘겨도 동일한 해시가 생성됩니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "projectRoot",
                    type: "string",
                    required: true,
                    desc: "프로젝트 루트 경로 (절대 또는 상대 — resolve()로 정규화됨)",
                  },
                ]}
              />
              <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 text-[13px] text-gray-600">
                <span className="font-bold text-gray-900">반환값:</span>{" "}
                <code className="text-cyan-600 text-xs">string</code> — SHA-256 해시의 앞 16자 (예:{" "}
                <code className="text-cyan-600 text-xs">"a1b2c3d4e5f6g7h8"</code>)
              </div>
            </div>

            {/* getMemoryDir */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">getMemoryDir()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                프로젝트의 메모리 디렉토리 경로를 반환합니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "projectRoot",
                    type: "string",
                    required: true,
                    desc: "프로젝트 루트 경로",
                  },
                ]}
              />
              <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 text-[13px] text-gray-600">
                <span className="font-bold text-gray-900">반환값:</span>{" "}
                <code className="text-cyan-600 text-xs">string</code> —{" "}
                <code className="text-cyan-600 text-xs">
                  {"~/.dhelix/projects/{해시16자}/memory/"}
                </code>
              </div>
            </div>

            {/* getMemoryFilePath */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">getMemoryFilePath()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                프로젝트의 메인 <code className="text-cyan-600 text-xs">MEMORY.md</code> 파일 경로를
                반환합니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "projectRoot",
                    type: "string",
                    required: true,
                    desc: "프로젝트 루트 경로",
                  },
                ]}
              />
            </div>

            {/* getTopicFilePath */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">getTopicFilePath()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                특정 토픽의 메모리 파일 경로를 반환합니다. MEMORY.md가 overflow될 때 오래된 섹션이
                토픽 파일로 분리됩니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "projectRoot",
                    type: "string",
                    required: true,
                    desc: "프로젝트 루트 경로",
                  },
                  {
                    name: "topicFileName",
                    type: "string",
                    required: true,
                    desc: '토픽 파일명 (예: "debugging.md")',
                  },
                ]}
              />
            </div>

            {/* getProjectsBaseDir */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">getProjectsBaseDir()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600">
                전체 프로젝트 메모리의 기본 디렉토리{" "}
                <code className="text-cyan-600 text-xs">~/.dhelix/projects/</code>를 반환합니다.
                메모리 디렉토리 목록 조회 등에 사용됩니다.
              </p>
            </div>

            <Callout type="warn" icon="⚠️">
              <strong>경로 일관성 주의:</strong> 같은 프로젝트라도{" "}
              <code className="text-red-600 text-xs">"/Users/alice/my-app"</code>과{" "}
              <code className="text-red-600 text-xs">"/Users/alice/my-app/"</code> (끝 슬래시)는
              다른 해시를 생성할 수 있습니다.{" "}
              <code className="text-cyan-600 text-xs">resolve()</code>를 통해 정규화하므로
              일반적으로 안전하지만, 심볼릭 링크나 마운트 경로는 주의가 필요합니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 4. 사용법 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"🚀"}</span> 사용법
            </h2>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              기본 경로 계산
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              프로젝트 루트 경로를 넘기면 MEMORY.md까지의 전체 경로를 얻을 수 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">getMemoryFilePath</span>
              <span className="text-[#c9d1d9]">{","}</span>{" "}
              <span className="text-[#79c0ff]">getMemoryDir</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./memory/paths.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">projectRoot</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#d2a8ff]">process</span>
              <span className="text-[#c9d1d9]">.cwd();</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// ~/.dhelix/projects/a1b2.../memory/"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">memDir</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#d2a8ff]">getMemoryDir</span>
              <span className="text-[#c9d1d9]">(projectRoot);</span>
              {"\n\n"}
              <span className="text-[#8b949e]">
                {"// ~/.dhelix/projects/a1b2.../memory/MEMORY.md"}
              </span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">memFile</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#d2a8ff]">getMemoryFilePath</span>
              <span className="text-[#c9d1d9]">(projectRoot);</span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              토픽 파일 경로
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              MEMORY.md가 너무 커지면 오래된 섹션이 토픽 파일로 분리됩니다. 토픽 파일 경로는 다음과
              같이 계산합니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">getTopicFilePath</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./memory/paths.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#8b949e]">
                {"// ~/.dhelix/projects/a1b2.../memory/debugging.md"}
              </span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">topicPath</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#d2a8ff]">getTopicFilePath</span>
              <span className="text-[#c9d1d9]">(projectRoot,</span>{" "}
              <span className="text-[#a5d6ff]">{'"debugging.md"'}</span>
              <span className="text-[#c9d1d9]">);</span>
            </CodeBlock>

            <DeepDive title="해시 충돌 가능성">
              <p className="mb-3">
                SHA-256 해시의 앞 16자(64비트)를 사용합니다. 두 프로젝트가 동일한 해시를 가질 확률은
                약 <strong>5.4 × 10⁻²⁰</strong>으로 사실상 0입니다. 실제 사용 환경(수백 개의
                프로젝트)에서 충돌은 발생하지 않는다고 봐도 무방합니다.
              </p>
              <p className="text-[13px] text-gray-600">
                충돌이 발생한다면 두 프로젝트가 같은 메모리 파일을 공유하게 되어 내용이 섞입니다. 이
                경우 해시 길이를 32자로 늘려 해결할 수 있습니다.
              </p>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 5. 내부 구현 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"⚙️"}</span> 내부 구현
            </h2>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "0", marginBottom: "16px" }}>
              해시 생성 흐름
            </h3>

            <MermaidDiagram
              title="computeProjectHash 내부 흐름"
              titleColor="purple"
              chart={`stateDiagram-v2
  [*] --> Normalize: 입력 projectRoot
  Normalize --> Hash: resolve() — 절대 경로 정규화
  Hash --> Slice: SHA-256 계산 (hex 문자열)
  Slice --> [*]: 앞 16자 반환

  note right of Normalize
    "/my/../my-app" → "/my-app"
    상대 경로 → 절대 경로
  end note
  note right of Hash
    node:crypto createHash("sha256")
    .update(absolutePath).digest("hex")
  end note`}
            />

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              경로 상수
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <code className="text-cyan-600 font-bold shrink-0 w-44">PROJECTS_BASE_DIR</code>
                  <span>
                    <code className="text-cyan-600 text-xs">~/.dhelix/projects/</code> — 모든
                    프로젝트 메모리의 루트
                  </span>
                </div>
                <div className="flex gap-3">
                  <code className="text-cyan-600 font-bold shrink-0 w-44">MEMORY_FILE</code>
                  <span>
                    <code className="text-cyan-600 text-xs">"MEMORY.md"</code> — 메인 메모리 파일명
                  </span>
                </div>
              </div>
            </div>

            <Callout type="info" icon="📝">
              <strong>APP_NAME 사용:</strong>{" "}
              <code className="text-cyan-600 text-xs">PROJECTS_BASE_DIR</code>은{" "}
              <code className="text-cyan-600 text-xs">constants.ts</code>의{" "}
              <code className="text-cyan-600 text-xs">APP_NAME</code>을 사용하여{" "}
              <code className="text-cyan-600 text-xs">~/.dhelix/projects/</code>를 생성합니다. 앱
              이름이 변경되면 메모리 경로도 함께 변경됩니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 6. 트러블슈팅 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"🔧"}</span> 트러블슈팅
            </h2>

            <div className="flex flex-col gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 세션마다 메모리가 비어 있습니다
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    프로젝트 루트 경로가 세션마다 달라지면 다른 해시가 생성됩니다.{" "}
                    <code className="text-cyan-600 text-xs">process.cwd()</code>가 항상 동일한 절대
                    경로를 반환하는지 확인하세요. 심볼릭 링크가 있으면{" "}
                    <code className="text-cyan-600 text-xs">fs.realpathSync()</code>로 정규화하는
                    것을 권장합니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 메모리 디렉토리를 찾을 수 없습니다
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    paths.ts는 디렉토리를 <strong>생성하지 않습니다</strong>. 경로 계산만 수행하며,
                    실제 디렉토리 생성은 <code className="text-cyan-600 text-xs">writer.ts</code>의{" "}
                    <code className="text-cyan-600 text-xs">ensureMemoryDir()</code>이 담당합니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> Windows 경로에서 해시가 일관되지 않습니다
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    Windows에서 드라이브 문자 대소문자 차이(
                    <code className="text-red-600 text-xs">C:\</code> vs{" "}
                    <code className="text-cyan-600 text-xs">c:\</code>)가 있으면 다른 해시가
                    생성됩니다. dhelix는 크로스 플랫폼을 위해{" "}
                    <code className="text-cyan-600 text-xs">src/utils/path.ts</code>의{" "}
                    <code className="text-cyan-600 text-xs">joinPath()</code>를 사용합니다.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 7. 관련 문서 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"🔗"}</span> 관련 문서
            </h2>

            <SeeAlso
              items={[
                {
                  name: "memory/manager.ts",
                  slug: "memory-manager",
                  relation: "parent",
                  desc: "paths.ts를 사용하여 메모리 CRUD를 통합 제공하는 파사드",
                },
                {
                  name: "memory/writer.ts",
                  slug: "memory-writer",
                  relation: "sibling",
                  desc: "getMemoryDir()로 경로를 받아 실제 파일 쓰기와 디렉토리 생성을 담당",
                },
                {
                  name: "memory/loader.ts",
                  slug: "memory-loader",
                  relation: "sibling",
                  desc: "getMemoryFilePath()로 경로를 받아 MEMORY.md를 읽는 로더",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
