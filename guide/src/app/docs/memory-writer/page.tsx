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

export default function MemoryWriterPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilePath path="src/memory/writer.ts" />
              <LayerBadge layer="leaf" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
              <span className="text-gray-900">Memory Writer</span>
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[640px]">
              프로젝트 메모리를 디스크에 안전하게 기록하는 모듈입니다.
              <span className="text-cyan-600 font-semibold"> 원자적 파일 쓰기</span>,{" "}
              <span className="text-violet-600 font-semibold">중복 감지</span>,{" "}
              <span className="text-emerald-600 font-semibold">자동 overflow</span>를 통해 데이터
              안정성을 보장합니다.
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
              <span>{"📦"}</span> 개요
            </h2>
            <p className="text-[14px] text-gray-600 leading-relaxed mb-4">
              메모리 라이터는 MEMORY.md에 새 항목을 추가하거나 전체를 덮어쓰는 쓰기 작업을
              담당합니다. 모든 파일 쓰기는 <strong className="text-gray-900">원자적(atomic)</strong>
              으로 수행되어, 프로세스가 중간에 죽어도 기존 파일이 손상되지 않습니다. MEMORY.md가{" "}
              <code className="text-cyan-600 text-xs">maxLines</code>를 초과하면 오래된 섹션을{" "}
              <span className="text-violet-600 font-semibold">토픽 파일</span>로 자동 분리합니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>원자적 쓰기 원리:</strong> 임시 파일(
              <code className="text-cyan-600 text-xs">{"{file}.tmp.{timestamp}"}</code>)에 먼저
              쓰고,
              <code className="text-cyan-600 text-xs"> rename()</code>으로 교체합니다. 같은
              파일시스템에서 rename은 원자적 작업이므로 부분 쓰기가 불가능합니다.
            </Callout>

            <MermaidDiagram
              title="appendMemory 처리 흐름"
              titleColor="green"
              chart={`flowchart TB
  START["appendMemory(entry)"] --> ENSURE["메모리 디렉토리 확인/생성"]
  ENSURE --> READ["기존 MEMORY.md 읽기"]
  READ --> DUP{"중복 검사<br/><small>같은 내용 존재?</small>"}
  DUP -->|중복| SKIP["written: false 반환<br/><small>건너뜀</small>"]
  DUP -->|새로운 내용| FORMAT["마크다운 리스트 포맷팅<br/><small>- 내용</small>"]
  FORMAT --> SECTION["## 섹션에 항목 추가"]
  SECTION --> CHECK{"줄 수 > maxLines?"}
  CHECK -->|초과| OVERFLOW["handleOverflow()<br/><small>오래된 섹션 → 토픽 파일</small>"]
  CHECK -->|정상| WRITE["atomicWrite()<br/><small>임시파일 → rename</small>"]
  OVERFLOW --> DONE["written: true<br/>overflowed: true"]
  WRITE --> DONE2["written: true<br/>overflowed: false"]

  style START fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style DUP fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style SKIP fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style OVERFLOW fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style WRITE fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style DONE fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px
  style DONE2 fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px`}
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
              <span>{"📋"}</span> 레퍼런스
            </h2>

            {/* appendMemory */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">appendMemory()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">
                  async
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                MEMORY.md에 새 항목을 추가합니다. 중복 감지, 섹션 삽입, overflow를 자동 처리합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "projectRoot",
                    type: "string",
                    required: true,
                    desc: "프로젝트 루트 절대 경로",
                  },
                  {
                    name: "entry",
                    type: "MemoryEntry",
                    required: true,
                    desc: "추가할 항목 { topic: string, content: string }",
                  },
                  {
                    name: "maxLines",
                    type: "number",
                    required: false,
                    desc: "MEMORY.md 최대 줄 수 (기본: 200). 초과 시 overflow",
                  },
                ]}
              />
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환:{" "}
                  <code className="text-violet-600 text-xs">
                    {"Promise<{ written: boolean, overflowed: boolean }>"}
                  </code>
                </h4>
              </div>
            </div>

            {/* saveMemory */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">saveMemory()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">
                  async
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                MEMORY.md 전체를 덮어씁니다. 대량 업데이트나 메모리 재구성 시 사용합니다.
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
                    name: "content",
                    type: "string",
                    required: true,
                    desc: "저장할 전체 마크다운 내용",
                  },
                ]}
              />
            </div>

            {/* writeTopicFile */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">writeTopicFile()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">
                  async
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                토픽 파일을 생성하거나 덮어씁니다. 토픽 이름은 안전한 파일명으로 자동 정규화됩니다.
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
                    name: "topic",
                    type: "string",
                    required: true,
                    desc: "토픽 이름 (파일명으로 정규화됨)",
                  },
                  { name: "content", type: "string", required: true, desc: "저장할 마크다운 내용" },
                ]}
              />
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환: <code className="text-violet-600 text-xs">{"Promise<string>"}</code> &mdash;
                  정규화된 파일명 (예: <code className="text-cyan-600 text-xs">"debugging.md"</code>
                  )
                </h4>
              </div>
            </div>

            {/* clearMemory */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">clearMemory()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">
                  async
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                MEMORY.md를 비우고 모든 토픽 파일을 삭제합니다. 토픽 파일 삭제는 병렬로 수행되며,
                개별 실패는 무시됩니다 (best-effort).
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

              <Callout type="warn" icon="⚠️">
                이 작업은 <strong>되돌릴 수 없습니다.</strong> MEMORY.md를 빈 문자열로 덮어쓰고,
                모든 <code className="text-red-600 text-xs">.md</code> 토픽 파일(MEMORY.md 제외)을
                삭제합니다.
              </Callout>
            </div>
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
              직접 호출 (MemoryManager 없이)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              일반적으로는 <code className="text-cyan-600 text-xs">MemoryManager</code>를 통해
              사용하지만, 직접 호출도 가능합니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">appendMemory</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#79c0ff]">clearMemory</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./memory/writer.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#8b949e]">
                {"// 메모리에 항목 추가 (maxLines: 100으로 제한)"}
              </span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">result</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">appendMemory</span>
              <span className="text-[#c9d1d9]">(</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#a5d6ff]">{'"./my-project"'}</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  { "}</span>
              <span className="text-[#79c0ff]">topic</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"patterns"'}</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#79c0ff]">content</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"싱글톤 대신 DI 사용"'}</span>
              <span className="text-[#c9d1d9]">{" },"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">100</span>{" "}
              <span className="text-[#8b949e]">{"// maxLines"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">);</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">if</span>{" "}
              <span className="text-[#c9d1d9]">(result.overflowed) {"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  console."}</span>
              <span className="text-[#d2a8ff]">log</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"오래된 섹션이 토픽 파일로 분리되었습니다"'}</span>
              <span className="text-[#c9d1d9]">);</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
            </CodeBlock>

            <DeepDive title="overflow 동작 상세">
              <p className="mb-3">overflow가 발생하면 다음과 같이 처리됩니다:</p>
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
                <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                  <div className="flex gap-3">
                    <span className="text-amber-600 font-bold shrink-0 w-6">1.</span>
                    <span>
                      MEMORY.md 내용을 <code className="text-cyan-600 text-xs">## 섹션</code> 단위로
                      분리
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-amber-600 font-bold shrink-0 w-6">2.</span>
                    <span>최근 2개 섹션은 MEMORY.md에 유지</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-amber-600 font-bold shrink-0 w-6">3.</span>
                    <span>
                      나머지 섹션은 개별 토픽 파일로 저장 (예:{" "}
                      <code className="text-cyan-600 text-xs">debugging.md</code>)
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-amber-600 font-bold shrink-0 w-6">4.</span>
                    <span>MEMORY.md에 "Archived Topics" 섹션으로 링크 추가</span>
                  </div>
                </div>
              </div>
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
              <span>{"🔍"}</span> 내부 구현
            </h2>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              원자적 파일 쓰기
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">atomicWrite()</code>는 데이터 무결성을
              보장하는 핵심 함수입니다. 직접 파일을 쓰는 대신, 임시 파일에 먼저 쓰고{" "}
              <code className="text-cyan-600 text-xs">rename()</code>으로 교체합니다.
            </p>

            <MermaidDiagram
              title="atomicWrite 동작"
              titleColor="cyan"
              chart={`flowchart LR
  CONTENT["내용 준비"] --> TMP["file.tmp.{ts} 에 쓰기"]
  TMP --> RENAME["rename() 원자적 교체"]
  RENAME --> DONE["최종 파일 완성"]
  TMP -->|실패| CLEANUP["임시 파일 삭제<br/><small>best-effort</small>"]
  CLEANUP --> ERROR["MemoryWriteError 던짐"]

  style CONTENT fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style TMP fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style RENAME fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style DONE fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px
  style ERROR fill:#f1f5f9,stroke:#ef4444,color:#1e293b`}
            />

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              중복 감지 알고리즘
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">isDuplicate()</code>는 대소문자를 무시하고 새
              내용이 기존 내용의 부분 문자열인지 확인합니다. 빈 내용이면 항상 비중복으로 판단합니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">
                {"// 중복 감지: 대소문자 무시 + 부분 문자열 포함 검사"}
              </span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">normalizedExisting</span>{" "}
              <span className="text-[#c9d1d9]">= existingContent.</span>
              <span className="text-[#d2a8ff]">toLowerCase</span>
              <span className="text-[#c9d1d9]">();</span>
              {"\n"}
              <span className="text-[#ff7b72]">return</span>{" "}
              <span className="text-[#c9d1d9]">normalizedExisting.</span>
              <span className="text-[#d2a8ff]">includes</span>
              <span className="text-[#c9d1d9]">(normalizedNew);</span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              섹션 삽입 전략
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">appendToSection()</code>은 다음 3가지 경우를
              처리합니다:
            </p>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-cyan-600 font-bold shrink-0 w-32">파일이 비어있음</span>
                  <span>
                    <code className="text-cyan-600 text-xs"># Project Memory</code> 헤더와 함께 새로
                    생성
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-violet-600 font-bold shrink-0 w-32">섹션이 존재</span>
                  <span>
                    해당 <code className="text-cyan-600 text-xs">##</code> 섹션 끝(다음 ## 직전)에
                    항목 추가
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-emerald-600 font-bold shrink-0 w-32">섹션이 없음</span>
                  <span>
                    파일 끝에 새 <code className="text-cyan-600 text-xs">## 섹션</code> 생성 후 항목
                    추가
                  </span>
                </div>
              </div>
            </div>

            <Callout type="info" icon="📝">
              <strong>토픽 이름 정규화:</strong>{" "}
              <code className="text-cyan-600 text-xs">capitalize()</code>로 첫 글자를 대문자로
              변환하여
              <code className="text-cyan-600 text-xs"> ## Debugging</code> 같은 일관된 섹션 헤더를
              생성합니다.
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
                  <span className="text-red-600">Q.</span> MemoryWriteError: Failed to write memory
                  file atomically
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 1:</strong> 디스크 공간 부족. 임시 파일
                    쓰기가 실패합니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인 2:</strong> 파일 시스템 권한 문제.
                    <code className="text-cyan-600 text-xs"> ~/.dhelix/projects/</code> 디렉토리의
                    쓰기 권한을 확인하세요.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> overflow가 너무 자주 발생해요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <code className="text-cyan-600 text-xs">maxLines</code> 기본값이 200입니다.
                    <code className="text-cyan-600 text-xs"> MemoryManager</code> 생성 시
                    <code className="text-cyan-600 text-xs">{" { maxMemoryLines: 500 }"}</code>으로
                    더 큰 값을 설정할 수 있습니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> .tmp 파일이 남아있어요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    원자적 쓰기 중 프로세스가 강제 종료된 경우 임시 파일이 남을 수 있습니다.
                    <code className="text-cyan-600 text-xs"> *.tmp.*</code> 파일을 수동으로 삭제해도
                    안전합니다.
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
                  desc: "writer를 래핑하는 Facade 클래스 — 일반적으로 이 모듈을 통해 사용",
                },
                {
                  name: "memory/loader.ts",
                  slug: "memory-loader",
                  relation: "sibling",
                  desc: "쓰기의 반대쪽 — MEMORY.md와 토픽 파일을 디스크에서 읽는 모듈",
                },
                {
                  name: "utils/error.ts",
                  slug: "recovery-executor",
                  relation: "child",
                  desc: "MemoryWriteError의 베이스 클래스인 BaseError를 제공",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
