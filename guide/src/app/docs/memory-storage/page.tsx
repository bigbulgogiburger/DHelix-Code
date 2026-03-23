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

export default function MemoryStoragePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/core/memory-storage.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Memory Storage</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="core" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              프로젝트별·전역 메모리 파일(.md)의 읽기, 쓰기, 목록 조회, 삭제를 담당하는 AI
              어시스턴트의 장기 기억 저장소 모듈입니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ─── 1. 개요 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📋</span> 개요
            </h2>

            <div className="text-[14px] text-gray-600 leading-[1.85] space-y-4">
              <p>
                Memory Storage는 에이전트가{" "}
                <strong className="text-gray-900">세션 간에 정보를 기억</strong>하는 데 사용하는
                마크다운 파일 시스템입니다. 메모리는 두 가지 스코프로 나뉩니다: 특정 프로젝트에서만
                사용하는 <strong>프로젝트 메모리</strong>({"{"}프로젝트{"}"}/
                <code className="text-cyan-600 text-[13px]">.dbcode/memory/</code>)와 모든
                프로젝트에서 공유되는 <strong>전역 메모리</strong>(
                <code className="text-cyan-600 text-[13px]">~/.dbcode/memory/</code>).
              </p>
              <p>
                메인 파일(<code className="text-cyan-600 text-[13px]">MEMORY.md</code>)은 최대
                200줄, 주제별 파일(예:{" "}
                <code className="text-cyan-600 text-[13px]">debugging.md</code>)은 최대 500줄로
                제한되어 시스템 프롬프트 토큰 과소비를 방지합니다. 제한을 초과하는 내용은
                잘라냅니다.
              </p>
              <p>
                모든 파일 I/O는 비동기(async)로 처리되며, 파일 없음(ENOENT) 에러는 예외 대신 null/빈
                문자열로 처리하여 호출부 코드를 간결하게 유지합니다.
              </p>
            </div>

            <MermaidDiagram
              title="메모리 스코프 구조"
              titleColor="cyan"
              chart={`graph TD
    subgraph PROJECT["프로젝트 메모리 (.dbcode/memory/)"]
        PM["MEMORY.md<br/><small>최대 200줄 — 프로젝트 아키텍처, 패턴</small>"]
        PT["debugging.md<br/><small>최대 500줄 — 주제별 분리 저장</small>"]
        PT2["patterns.md<br/><small>최대 500줄 — 반복 패턴 기록</small>"]
    end
    subgraph GLOBAL["전역 메모리 (~/.dbcode/memory/)"]
        GM["MEMORY.md<br/><small>최대 200줄 — 크로스 프로젝트 패턴</small>"]
    end
    subgraph AGENT["에이전트 (Agent Loop)"]
        READ["readMainMemory()<br/>readGlobalMemory()"]
        WRITE["writeMainMemory()<br/>writeTopicMemory()"]
    end

    AGENT --> READ
    AGENT --> WRITE
    READ -->|"줄 수 제한 적용"| PM
    READ --> GM
    WRITE --> PM
    WRITE --> PT
    WRITE --> PT2

    style PM fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
    style GM fill:#1a3a2a,stroke:#10b981,color:#f1f5f9`}
            />
          </section>
        </RevealOnScroll>

        {/* ─── 2. 레퍼런스 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📖</span> 레퍼런스
            </h2>

            {/* getMemoryPaths */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                getMemoryPaths()
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                프로젝트 디렉토리에 대한 기본 메모리 경로 설정을 생성합니다. 프로젝트 메모리와 전역
                메모리 경로, 줄 수 제한값이 포함됩니다.
              </p>
              <CodeBlock>
                <span className="text-[#ff7b72]">function</span>{" "}
                <span className="text-[#d2a8ff]">getMemoryPaths</span>({"\n"}
                {"  "}
                <span className="text-[#ffa657]">projectDir</span>:{" "}
                <span className="text-[#79c0ff]">string</span>
                {"\n"}): <span className="text-[#79c0ff]">MemoryConfig</span>
              </CodeBlock>
              <ParamTable
                params={[
                  {
                    name: "projectDir",
                    type: "string",
                    required: true,
                    desc: "프로젝트 루트 디렉토리 경로. 프로젝트 메모리 경로({projectDir}/.dbcode/memory/)를 생성하는 기준입니다.",
                  },
                ]}
              />
            </div>

            {/* readMainMemory */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                readMainMemory() / readGlobalMemory()
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                메인 MEMORY.md 또는 전역 MEMORY.md를 읽어 반환합니다. 파일이 없으면 빈 문자열을
                반환합니다. maxMainLines(200)를 초과하는 내용은 잘려납니다.
              </p>
              <CodeBlock>
                <span className="text-[#ff7b72]">async function</span>{" "}
                <span className="text-[#d2a8ff]">readMainMemory</span>(
                <span className="text-[#ffa657]">config</span>:{" "}
                <span className="text-[#79c0ff]">MemoryConfig</span>):{" "}
                <span className="text-[#79c0ff]">Promise</span>
                {"<"}
                <span className="text-[#79c0ff]">string</span>
                {">"}
                {"\n"}
                <span className="text-[#ff7b72]">async function</span>{" "}
                <span className="text-[#d2a8ff]">readGlobalMemory</span>(
                <span className="text-[#ffa657]">config</span>:{" "}
                <span className="text-[#79c0ff]">MemoryConfig</span>):{" "}
                <span className="text-[#79c0ff]">Promise</span>
                {"<"}
                <span className="text-[#79c0ff]">string</span>
                {">"}
              </CodeBlock>
            </div>

            {/* readTopicMemory */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                readTopicMemory()
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                주제별 메모리 파일을 읽습니다. 파일이 없으면 null을 반환합니다(빈 문자열과 구분).
                maxTopicLines(500)을 초과하는 내용은 잘려납니다.
              </p>
              <CodeBlock>
                <span className="text-[#ff7b72]">async function</span>{" "}
                <span className="text-[#d2a8ff]">readTopicMemory</span>({"\n"}
                {"  "}
                <span className="text-[#ffa657]">config</span>:{" "}
                <span className="text-[#79c0ff]">MemoryConfig</span>,{"\n"}
                {"  "}
                <span className="text-[#ffa657]">topic</span>:{" "}
                <span className="text-[#79c0ff]">string</span>
                {"\n"}): <span className="text-[#79c0ff]">Promise</span>
                {"<"}
                <span className="text-[#79c0ff]">string | null</span>
                {">"}
              </CodeBlock>
            </div>

            {/* writeMainMemory, writeTopicMemory, writeGlobalMemory */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                writeMainMemory() / writeTopicMemory() / writeGlobalMemory()
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                메모리 파일에 내용을 씁니다. 디렉토리가 없으면 자동 생성(recursive: true). 기존
                내용은 덮어씁니다.
              </p>
            </div>

            {/* listMemoryFiles */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                listMemoryFiles()
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                프로젝트 메모리 디렉토리의 모든 .md 파일 목록을 이름 순으로 반환합니다. 각 파일의
                이름, 경로, 크기(bytes), 수정일, 줄 수를 포함합니다.
              </p>
              <CodeBlock>
                <span className="text-[#ff7b72]">async function</span>{" "}
                <span className="text-[#d2a8ff]">listMemoryFiles</span>({"\n"}
                {"  "}
                <span className="text-[#ffa657]">config</span>:{" "}
                <span className="text-[#79c0ff]">MemoryConfig</span>
                {"\n"}): <span className="text-[#79c0ff]">Promise</span>
                {"<"}
                <span className="text-[#79c0ff]">readonly MemoryFileInfo[]</span>
                {">"}
              </CodeBlock>
            </div>

            {/* MemoryConfig */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                MemoryConfig 인터페이스
              </h3>
              <ParamTable
                params={[
                  {
                    name: "projectDir",
                    type: "string",
                    required: true,
                    desc: "프로젝트 루트 디렉토리 경로.",
                  },
                  {
                    name: "globalDir",
                    type: "string",
                    required: true,
                    desc: "전역 메모리 디렉토리 경로 (~/.dbcode/memory/).",
                  },
                  {
                    name: "maxMainLines",
                    type: "number",
                    required: true,
                    desc: "MEMORY.md의 최대 줄 수. 기본값 200.",
                  },
                  {
                    name: "maxTopicLines",
                    type: "number",
                    required: true,
                    desc: "주제별 파일의 최대 줄 수. 기본값 500.",
                  },
                ]}
              />
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 3. 사용법 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🚀</span> 사용법
            </h2>

            <p className="text-[14px] text-gray-600 leading-[1.85] mb-6">
              기본 사용 흐름은 경로 설정 생성 → 읽기/쓰기 순서입니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">// 1. 설정 생성</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span> config ={" "}
              <span className="text-[#d2a8ff]">getMemoryPaths</span>(process.env.
              <span className="text-[#79c0ff]">PWD</span> ??{" "}
              <span className="text-[#a5d6ff]">"."</span>);{"\n\n"}
              <span className="text-[#8b949e]">// 2. 프로젝트 메모리 읽기</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span> memory ={" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">readMainMemory</span>(config);{"\n\n"}
              <span className="text-[#8b949e]">// 3. 메모리 업데이트</span>
              {"\n"}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">writeMainMemory</span>(config, memory +{" "}
              <span className="text-[#a5d6ff]">"\n## 새 항목\n내용"</span>);{"\n\n"}
              <span className="text-[#8b949e]">// 4. 주제별 파일 읽기 (없으면 null)</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span> debugMem ={" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">readTopicMemory</span>(config,{" "}
              <span className="text-[#a5d6ff]">"debugging"</span>);
            </CodeBlock>

            <Callout type="warn" icon="⚠️">
              <span className="text-[13px]">
                <strong>주의:</strong> 쓰기 함수들은 기존 내용을 <strong>덮어씁니다</strong>. 기존
                내용을 보존하려면 먼저 읽은 뒤 추가하여 다시 쓰세요.{" "}
                <code className="text-cyan-600">maxMainLines</code>는 읽기 시에만 적용됩니다. 쓰기
                시에는 제한이 없으므로, 너무 긴 내용을 직접 저장하면 다음 읽기 때 잘려서 반환됩니다.
              </span>
            </Callout>

            <DeepDive title="주제별 파일(Topic Files) 전략">
              <div className="space-y-3">
                <p>
                  하나의 <code className="text-cyan-600">MEMORY.md</code>에 모든 정보를 넣으면 200줄
                  제한에 빨리 도달합니다. 주제별로 분리하면 각 파일이 500줄까지 늘어나고, 시스템
                  프롬프트에는 필요한 주제 파일만 포함할 수 있습니다.
                </p>
                <CodeBlock>
                  <span className="text-[#8b949e]">// 권장: 주제별 분리</span>
                  {"\n"}
                  <span className="text-[#d2a8ff]">writeTopicMemory</span>(config,{" "}
                  <span className="text-[#a5d6ff]">"architecture"</span>, arch);{"\n"}
                  <span className="text-[#d2a8ff]">writeTopicMemory</span>(config,{" "}
                  <span className="text-[#a5d6ff]">"debugging"</span>, debug);{"\n\n"}
                  <span className="text-[#8b949e]">// .md 확장자는 자동 추가됨</span>
                  {"\n"}
                  <span className="text-[#8b949e]">// "debugging" → "debugging.md"</span>
                </CodeBlock>
              </div>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ─── 4. 내부 구현 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>⚙️</span> 내부 구현
            </h2>

            <MermaidDiagram
              title="readFileSafe() — ENOENT 에러 처리 흐름"
              titleColor="blue"
              chart={`flowchart TD
    CALL["readFileSafe(filePath)"] --> TRY["readFile(path, 'utf-8')"]
    TRY -->|"성공"| RETURN["내용 반환"]
    TRY -->|"에러"| CHECK{"ENOENT?\\n(파일 없음)"}
    CHECK -->|"YES"| NULL["null 반환"]
    CHECK -->|"NO"| THROW["MemoryStorageError throw"]

    style RETURN fill:#1a3a2a,stroke:#10b981,color:#f1f5f9
    style NULL fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
    style THROW fill:#3a1a1a,stroke:#ef4444,color:#f1f5f9`}
            />

            <div className="text-[14px] text-gray-600 leading-[1.85] space-y-4 mt-6">
              <p>
                <strong className="text-gray-900">listMemoryFiles() 최적화:</strong> 각 파일의
                stat()과 readFile()을 <code className="text-cyan-600">Promise.all</code>로 병렬
                처리합니다. 파일이 20개라면 순차 처리 대비 약 10~20배 빠릅니다.
              </p>
              <p>
                <strong className="text-gray-900">truncateLines():</strong> 줄 수 제한은 단순히
                split("\n")으로 구현됩니다. 이는 UTF-8 멀티바이트 문자나 CRLF 줄 끝을 포함한 모든
                텍스트에 안전하게 동작합니다.
              </p>
            </div>

            <CodeBlock>
              <span className="text-[#8b949e]">// buildFileInfo() — stat + readFile 병렬 처리</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span> [fileStat, content] ={" "}
              <span className="text-[#ff7b72]">await</span> Promise.
              <span className="text-[#d2a8ff]">all</span>([{"\n"}
              {"  "}
              <span className="text-[#d2a8ff]">stat</span>(filePath),{"\n"}
              {"  "}
              <span className="text-[#d2a8ff]">readFile</span>(filePath,{" "}
              <span className="text-[#a5d6ff]">"utf-8"</span>){"\n"}]);{"\n\n"}
              <span className="text-[#8b949e]">// ensureMarkdownExtension() — .md 자동 추가</span>
              {"\n"}
              <span className="text-[#8b949e]">// "debugging" → "debugging.md"</span>
              {"\n"}
              <span className="text-[#8b949e]">// "MEMORY.md" → "MEMORY.md" (변경 없음)</span>
            </CodeBlock>

            <Callout type="info" icon="💡">
              <span className="text-[13px]">
                <strong>MemoryStorageError:</strong>{" "}
                <code className="text-cyan-600">BaseError</code>를 확장한 타입으로, code 필드에{" "}
                <code className="text-cyan-600">"MEMORY_STORAGE_ERROR"</code>를 가집니다. context
                객체에 실패한 경로와 원인이 포함되어 디버깅이 용이합니다.
              </span>
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 5. 트러블슈팅 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔧</span> 트러블슈팅
            </h2>

            <div className="space-y-5">
              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-500">Q.</span>
                  메모리를 저장했는데 다음 세션에서 읽히지 않습니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span>{" "}
                  <code className="text-cyan-600">getMemoryPaths()</code>에 올바른 프로젝트 경로가
                  전달되었는지 확인하세요. 다른 경로를 사용하면 다른 위치에 저장됩니다.
                  <code className="text-cyan-600"> listMemoryFiles()</code>로 실제 저장된 파일
                  목록을 확인하는 것이 좋습니다.
                </p>
              </div>

              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-500">Q.</span>
                  readMainMemory()가 잘린 내용을 반환합니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span> 파일이{" "}
                  <code className="text-cyan-600">maxMainLines</code>(기본 200줄)를 초과했습니다.
                  중요한 정보는 파일 상단에 위치시키세요. 또는 주제별 파일로 분리하면(최대 500줄) 더
                  많은 내용을 저장할 수 있습니다.
                </p>
              </div>

              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-500">Q.</span>
                  MemoryStorageError가 발생합니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span> error.context 객체에서{" "}
                  <code className="text-cyan-600">dir</code> 또는{" "}
                  <code className="text-cyan-600">filePath</code>와{" "}
                  <code className="text-cyan-600">cause</code>를 확인하세요. 가장 흔한 원인은 쓰기
                  권한 문제(EACCES)나 디스크 공간 부족(ENOSPC)입니다.
                </p>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 6. 관련 문서 ─── */}
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
                  name: "auto-memory.ts",
                  slug: "auto-memory",
                  relation: "parent",
                  desc: "Memory Storage를 호출하여 대화에서 중요 정보를 자동으로 추출하고 저장하는 상위 모듈입니다.",
                },
                {
                  name: "system-prompt-builder.ts",
                  slug: "system-prompt-builder",
                  relation: "sibling",
                  desc: "readMainMemory()와 readGlobalMemory()로 읽은 내용을 시스템 프롬프트에 삽입합니다.",
                },
                {
                  name: "context-manager.ts",
                  slug: "context-manager",
                  relation: "sibling",
                  desc: "컨텍스트 최적화 시 메모리 정보를 포함하여 토큰 예산을 관리합니다.",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
