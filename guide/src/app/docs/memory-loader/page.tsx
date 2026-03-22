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

export default function MemoryLoaderPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">

        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <FilePath path="src/memory/loader.ts" />
            <LayerBadge layer="leaf" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
            <span className="text-gray-900">
              Memory Loader
            </span>
          </h1>
          <p className="text-[16px] text-gray-600 max-w-[640px]">
            프로젝트 메모리 파일을 디스크에서 읽어오는 모듈입니다.
            세션 시작 시 MEMORY.md를 읽어 시스템 프롬프트에 주입하여,
            AI가 이전 세션에서 학습한 내용을 <span className="text-cyan-600 font-semibold">기억</span>하도록 합니다.
          </p>
        </div>
        </RevealOnScroll>

        {/* ───────────────────── 2. 개요 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"📦"}</span> 개요
            </h2>
            <p className="text-[14px] text-gray-600 leading-relaxed mb-4">
              메모리 로더는 MEMORY.md를 <code className="text-cyan-600 text-xs">maxLines</code>까지만 읽어
              <span className="text-violet-600 font-semibold"> 컨텍스트 윈도우를 절약</span>합니다.
              파일이 없으면 에러를 던지지 않고 빈 결과를 <strong className="text-gray-900">우아하게(gracefully)</strong> 반환합니다.
              overflow된 토픽 파일에 대한 개별 접근도 지원합니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>컨텍스트 절약:</strong> MEMORY.md가 1000줄이어도 기본값 200줄까지만 로드합니다.
              나머지는 토픽 파일로 분리되어 필요할 때 <code className="text-cyan-600 text-xs">loadTopicMemory()</code>로 접근합니다.
            </Callout>

            <MermaidDiagram
              title="메모리 로딩 흐름"
              titleColor="purple"
              chart={`flowchart TB
  START["loadProjectMemory()"] --> CHECK{"메모리 디렉토리<br/>존재?"}
  CHECK -->|없음| EMPTY["빈 결과 반환<br/><small>exists: false</small>"]
  CHECK -->|있음| READ["MEMORY.md 읽기"]
  READ --> TRUNC["maxLines까지 잘라내기<br/><small>컨텍스트 윈도우 절약</small>"]
  TRUNC --> TOPICS["토픽 파일 목록 조회<br/><small>listTopicFiles()</small>"]
  TOPICS --> RESULT["MemoryLoadResult 반환<br/><small>content + topicFiles</small>"]
  READ -->|읽기 실패| ERROR["MemoryLoadError 던짐"]

  style START fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style CHECK fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style EMPTY fill:#f1f5f9,stroke:#94a3b8,color:#1e293b
  style TRUNC fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style RESULT fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px
  style ERROR fill:#f1f5f9,stroke:#ef4444,color:#1e293b`}
            />
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 3. 레퍼런스 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"📋"}</span> 레퍼런스
            </h2>

            {/* loadProjectMemory */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">loadProjectMemory()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">async</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                MEMORY.md의 처음 <code className="text-cyan-600 text-xs">maxLines</code> 줄을 읽어 반환합니다.
                파일이 없으면 빈 결과를 반환하고, 읽기 실패 시에만 에러를 던집니다.
              </p>

              <ParamTable
                params={[
                  { name: "projectRoot", type: "string", required: true, desc: "프로젝트 루트의 절대 경로" },
                  { name: "maxLines", type: "number", required: false, desc: "로드할 최대 줄 수 (기본: 200)" },
                ]}
              />

              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">반환 타입: <code className="text-violet-600 text-xs">Promise&lt;MemoryLoadResult&gt;</code></h4>
                <ParamTable
                  params={[
                    { name: "content", type: "string", required: true, desc: "maxLines까지 잘린 메모리 내용" },
                    { name: "memoryFilePath", type: "string", required: true, desc: "MEMORY.md 절대 경로" },
                    { name: "exists", type: "boolean", required: true, desc: "파일 존재 여부 (없으면 false)" },
                    { name: "topicFiles", type: "readonly string[]", required: true, desc: "overflow된 토픽 파일명 목록 (정렬됨)" },
                  ]}
                />
              </div>
            </div>

            {/* loadTopicMemory */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">loadTopicMemory()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">async</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                특정 토픽 파일의 내용을 읽습니다. 토픽 이름은 자동으로 안전한 파일명으로 정규화됩니다.
              </p>
              <ParamTable
                params={[
                  { name: "projectRoot", type: "string", required: true, desc: "프로젝트 루트의 절대 경로" },
                  { name: "topic", type: "string", required: true, desc: "토픽 이름 또는 파일명" },
                ]}
              />
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">반환: <code className="text-violet-600 text-xs">Promise&lt;string | null&gt;</code> &mdash; 파일 없으면 null</h4>
              </div>
            </div>

            {/* listTopicFiles */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">listTopicFiles()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">async</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                메모리 디렉토리의 모든 토픽 파일 목록을 반환합니다.
                MEMORY.md를 제외한 <code className="text-cyan-600 text-xs">.md</code> 파일들을 정렬하여 반환합니다.
              </p>
              <ParamTable
                params={[
                  { name: "projectRoot", type: "string", required: true, desc: "프로젝트 루트의 절대 경로" },
                ]}
              />
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">반환: <code className="text-violet-600 text-xs">{"Promise<readonly string[]>"}</code> &mdash; 파일명만 (경로 제외)</h4>
              </div>
            </div>

            {/* normalizeTopicFileName */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">normalizeTopicFileName()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">exported</span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                토픽 이름을 안전한 파일명으로 정규화합니다. 소문자 변환, 특수문자 치환, 연속 하이픈 제거를 수행합니다.
              </p>
              <ParamTable
                params={[
                  { name: "topic", type: "string", required: true, desc: '토픽 이름 (예: "User Preferences!")' },
                ]}
              />
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">반환: <code className="text-violet-600 text-xs">string</code> &mdash; 예: <code className="text-cyan-600 text-xs">"user-preferences.md"</code></h4>
              </div>

              <Callout type="warn" icon="⚠️">
                빈 문자열이나 특수문자만으로 구성된 토픽 이름은 <code className="text-red-600 text-xs">"untitled.md"</code>로 정규화됩니다.
                의미 있는 토픽 이름을 사용하세요.
              </Callout>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 4. 사용법 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"🚀"}</span> 사용법
            </h2>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>세션 시작 시 메모리 로드</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              세션이 시작되면 MEMORY.md를 읽어 시스템 프롬프트에 주입합니다.
              <code className="text-cyan-600 text-xs"> exists</code>가 <code className="text-cyan-600 text-xs">false</code>이면
              첫 번째 세션입니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">loadProjectMemory</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./memory/loader.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>{"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">result</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">loadProjectMemory</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"./my-project"'}</span>
              <span className="text-[#c9d1d9]">);</span>{"\n\n"}
              <span className="text-[#ff7b72]">if</span>{" "}
              <span className="text-[#c9d1d9]">(result.exists) {"{"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  systemPrompt += result.content;"}</span>{"\n"}
              <span className="text-[#c9d1d9]">{"  console."}</span>
              <span className="text-[#d2a8ff]">log</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"토픽 파일:"'}</span>
              <span className="text-[#c9d1d9]">, result.topicFiles);</span>{"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
            </CodeBlock>

            <DeepDive title="토픽 파일 조회 및 읽기">
              <p className="mb-3">
                overflow된 토픽 파일의 목록을 확인하고 필요한 토픽만 선택적으로 읽을 수 있습니다.
              </p>

              <CodeBlock>
                <span className="text-[#ff7b72]">import</span>{" "}
                <span className="text-[#c9d1d9]">{"{ "}</span>
                <span className="text-[#79c0ff]">listTopicFiles</span>
                <span className="text-[#c9d1d9]">{", "}</span>
                <span className="text-[#79c0ff]">loadTopicMemory</span>
                <span className="text-[#c9d1d9]">{" }"}</span>{" "}
                <span className="text-[#ff7b72]">from</span>{" "}
                <span className="text-[#a5d6ff]">{'"./memory/loader.js"'}</span>
                <span className="text-[#c9d1d9]">;</span>{"\n\n"}
                <span className="text-[#8b949e]">{"// 모든 토픽 파일 목록"}</span>{"\n"}
                <span className="text-[#ff7b72]">const</span>{" "}
                <span className="text-[#79c0ff]">topics</span>{" "}
                <span className="text-[#c9d1d9]">=</span>{" "}
                <span className="text-[#ff7b72]">await</span>{" "}
                <span className="text-[#d2a8ff]">listTopicFiles</span>
                <span className="text-[#c9d1d9]">(</span>
                <span className="text-[#a5d6ff]">{'"./my-project"'}</span>
                <span className="text-[#c9d1d9]">);</span>{"\n"}
                <span className="text-[#8b949e]">{'// → ["debugging.md", "patterns.md"]'}</span>{"\n\n"}
                <span className="text-[#8b949e]">{"// 특정 토픽 내용 읽기"}</span>{"\n"}
                <span className="text-[#ff7b72]">const</span>{" "}
                <span className="text-[#79c0ff]">content</span>{" "}
                <span className="text-[#c9d1d9]">=</span>{" "}
                <span className="text-[#ff7b72]">await</span>{" "}
                <span className="text-[#d2a8ff]">loadTopicMemory</span>
                <span className="text-[#c9d1d9]">(</span>
                <span className="text-[#a5d6ff]">{'"./my-project"'}</span>
                <span className="text-[#c9d1d9]">,</span>{" "}
                <span className="text-[#a5d6ff]">{'"debugging"'}</span>
                <span className="text-[#c9d1d9]">);</span>{"\n"}
                <span className="text-[#8b949e]">{"// content === null 이면 파일 없음"}</span>
              </CodeBlock>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 5. 내부 구현 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"🔍"}</span> 내부 구현
            </h2>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>파일명 정규화 파이프라인</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">normalizeTopicFileName()</code>은 다음 파이프라인으로 안전한 파일명을 생성합니다:
            </p>

            <MermaidDiagram
              title="파일명 정규화 파이프라인"
              titleColor="cyan"
              chart={`flowchart LR
  INPUT['"User Preferences!"'] --> STRIP[".md 확장자 제거"]
  STRIP --> LOWER["소문자 변환<br/><small>user preferences!</small>"]
  LOWER --> SAFE["특수문자 → 하이픈<br/><small>user-preferences-</small>"]
  SAFE --> DEDUP["연속 하이픈 제거<br/><small>user-preferences-</small>"]
  DEDUP --> TRIM["양 끝 하이픈 제거<br/><small>user-preferences</small>"]
  TRIM --> EXT['".md" 추가<br/><small>user-preferences.md</small>']

  style INPUT fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style EXT fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px`}
            />

            <h3 className="text-[15px] font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>에러 전략</h3>
            <p className="text-[13px] text-gray-600 mb-3">
              로더는 두 가지 에러 전략을 사용합니다:
            </p>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-emerald-600 font-bold shrink-0 w-28">Graceful</span>
                  <span>파일/디렉토리 부재 &rarr; 빈 결과 반환 (첫 사용은 정상 상황)</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-red-600 font-bold shrink-0 w-28">Strict</span>
                  <span>파일 존재하지만 읽기 실패 &rarr; <code className="text-red-600 text-xs">MemoryLoadError</code> 던짐</span>
                </div>
              </div>
            </div>

            <Callout type="info" icon="📝">
              <strong>listTopicFiles 방어:</strong> <code className="text-cyan-600 text-xs">readdir</code> 실패 시에도
              에러를 던지지 않고 빈 배열을 반환합니다. 토픽 파일 목록은 보조 정보이므로
              실패가 전체 로딩을 방해하지 않도록 설계되었습니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 6. 트러블슈팅 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"🔧"}</span> 트러블슈팅
            </h2>

            <div className="flex flex-col gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> MemoryLoadError: Failed to load project memory
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인:</strong> MEMORY.md 파일이 존재하지만 읽기 권한이 없거나 인코딩 문제가 있습니다.
                    파일이 UTF-8로 인코딩되어 있는지 확인하세요.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 메모리가 잘려서 로드돼요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <strong className="text-gray-900">이것은 의도된 동작입니다.</strong>{" "}
                    <code className="text-cyan-600 text-xs">maxLines</code> (기본 200)까지만 로드하여
                    컨텍스트 윈도우를 절약합니다. 나머지는 토픽 파일로 분리되어 있으며
                    <code className="text-cyan-600 text-xs"> loadTopicMemory()</code>로 접근하세요.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> loadTopicMemory()가 null을 반환해요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    토픽 이름이 정규화된 파일명과 일치하지 않을 수 있습니다.
                    <code className="text-cyan-600 text-xs"> normalizeTopicFileName()</code>으로
                    실제 파일명을 확인하세요. 예: <code className="text-cyan-600 text-xs">"User Preferences"</code> &rarr;
                    <code className="text-cyan-600 text-xs"> "user-preferences.md"</code>
                  </p>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 7. 관련 문서 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>{"🔗"}</span> 관련 문서
            </h2>

            <SeeAlso
              items={[
                {
                  name: "memory/manager.ts",
                  slug: "memory-manager",
                  relation: "parent",
                  desc: "loader를 래핑하는 Facade 클래스 — 일반적으로 이 모듈을 통해 사용",
                },
                {
                  name: "memory/writer.ts",
                  slug: "memory-writer",
                  relation: "sibling",
                  desc: "읽기의 반대쪽 — MEMORY.md와 토픽 파일을 디스크에 쓰는 모듈",
                },
                {
                  name: "system-prompt-builder.ts",
                  slug: "system-prompt-builder",
                  relation: "parent",
                  desc: "loadProjectMemory() 결과를 시스템 프롬프트에 주입하는 상위 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>

      </div>
    </div>
  );
}
