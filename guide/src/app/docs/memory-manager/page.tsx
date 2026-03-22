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

export default function MemoryManagerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilePath path="src/memory/manager.ts" />
              <LayerBadge layer="leaf" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
              <span className="text-gray-900">Memory Manager</span>
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[640px]">
              프로젝트 스코프 메모리를 관리하는 중앙 클래스입니다. 하위 모듈(loader, writer,
              paths)을 <span className="text-cyan-600 font-semibold">하나의 인터페이스</span>로
              통합하여 프로젝트당 하나의 인스턴스로 CRUD 작업을 제공합니다.
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
              dbcode는 세션 간에 학습한 내용을 유지하기 위해 프로젝트별 메모리 시스템을 사용합니다.
              <strong className="text-gray-900"> MemoryManager</strong>는 이 시스템의{" "}
              <span className="text-cyan-600 font-semibold">파사드(Facade)</span>로,
              <code className="text-cyan-600 text-xs"> loader</code>,{" "}
              <code className="text-cyan-600 text-xs">writer</code>,
              <code className="text-cyan-600 text-xs"> paths</code> 모듈의 기능을 하나의 클래스로
              묶습니다. 프로젝트 경로의 SHA-256 해시 앞 16자를 사용하여 격리된 저장소를 보장합니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>저장 위치:</strong>{" "}
              <code className="text-cyan-600 text-xs">
                ~/.dbcode/projects/{"{프로젝트해시}"}/memory/MEMORY.md
              </code>
              &mdash; 프로젝트해시는{" "}
              <code className="text-cyan-600 text-xs">SHA-256(절대경로).slice(0, 16)</code>입니다.
            </Callout>

            <MermaidDiagram
              title="MemoryManager 아키텍처"
              titleColor="cyan"
              chart={`flowchart TB
  MM["MemoryManager<br/><small>Facade 클래스</small>"]
  LOADER["loader.ts<br/><small>loadProjectMemory<br/>loadTopicMemory<br/>listTopicFiles</small>"]
  WRITER["writer.ts<br/><small>appendMemory<br/>saveMemory<br/>writeTopicFile<br/>clearMemory</small>"]
  PATHS["paths.ts<br/><small>getMemoryDir<br/>getMemoryFilePath<br/>computeProjectHash</small>"]
  DISK["~/.dbcode/projects/{hash}/memory/<br/><small>MEMORY.md + 토픽파일들</small>"]

  MM --> LOADER
  MM --> WRITER
  MM --> PATHS
  LOADER --> DISK
  WRITER --> DISK
  PATHS --> DISK

  style MM fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style LOADER fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style WRITER fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style PATHS fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style DISK fill:#f8fafc,stroke:#ef4444,color:#1e293b`}
            />

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
              <h4 className="text-[14px] font-bold mb-3">MemoryManager가 제공하는 가치</h4>
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-cyan-600 font-bold shrink-0 w-28">경로 캡슐화</span>
                  <span>
                    <code className="text-cyan-600 text-xs">projectRoot</code>를 생성자에서 한 번만
                    설정하면 모든 메서드에서 재사용
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-violet-600 font-bold shrink-0 w-28">설정 중앙 관리</span>
                  <span>
                    <code className="text-cyan-600 text-xs">maxLoadLines</code>,{" "}
                    <code className="text-cyan-600 text-xs">maxMemoryLines</code> 등을 config로 일괄
                    관리
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-emerald-600 font-bold shrink-0 w-28">일관된 API</span>
                  <span>load / save / append / clear / topic CRUD를 하나의 인터페이스로 제공</span>
                </div>
              </div>
            </div>
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

            {/* constructor */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">new MemoryManager()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                프로젝트 루트 경로를 받아 메모리 관리자 인스턴스를 생성합니다. 설정은 기본값에
                사용자 오버라이드를 스프레드로 병합합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "projectRoot",
                    type: "string",
                    required: true,
                    desc: "프로젝트 루트의 절대 경로. SHA-256 해시로 저장소를 격리",
                  },
                  {
                    name: "config",
                    type: "Partial<MemoryConfig>",
                    required: false,
                    desc: "메모리 설정 오버라이드. maxLoadLines(기본 200), maxMemoryLines(기본 200), projectsBaseDir",
                  },
                ]}
              />
            </div>

            {/* loadMemory */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">loadMemory()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">
                  async
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                MEMORY.md의 처음 <code className="text-cyan-600 text-xs">maxLoadLines</code> 줄을
                로드합니다. 세션 시작 시 호출하여 시스템 프롬프트에 주입합니다.
              </p>
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환 타입:{" "}
                  <code className="text-violet-600 text-xs">Promise&lt;MemoryLoadResult&gt;</code>
                </h4>
                <ParamTable
                  params={[
                    {
                      name: "content",
                      type: "string",
                      required: true,
                      desc: "메모리 내용 (maxLoadLines까지 잘림)",
                    },
                    {
                      name: "memoryFilePath",
                      type: "string",
                      required: true,
                      desc: "MEMORY.md 절대 경로",
                    },
                    { name: "exists", type: "boolean", required: true, desc: "파일 존재 여부" },
                    {
                      name: "topicFiles",
                      type: "string[]",
                      required: true,
                      desc: "overflow된 토픽 파일 목록",
                    },
                  ]}
                />
              </div>
            </div>

            {/* appendMemory */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">appendMemory()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">
                  async
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                새 항목을 추가합니다. 중복 감지 + 자동 overflow를 포함합니다. 같은 내용이 이미
                있으면 건너뛰고, <code className="text-cyan-600 text-xs">maxMemoryLines</code>를
                초과하면 오래된 섹션을 토픽 파일로 분리합니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "entry",
                    type: "MemoryEntry",
                    required: true,
                    desc: "추가할 항목. { topic: string, content: string }",
                  },
                ]}
              />
              <div className="mt-3">
                <h4 className="text-[13px] font-bold text-gray-900 mb-2">
                  반환:{" "}
                  <code className="text-violet-600 text-xs">
                    {"{ written: boolean, overflowed: boolean }"}
                  </code>
                </h4>
              </div>
            </div>

            {/* saveMemory / clearMemory / topic methods */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">기타 메서드</span>
              </h3>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-40">
                      saveMemory(content)
                    </code>
                    <span>MEMORY.md 전체를 덮어쓰기 (대량 업데이트용)</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-40">clearMemory()</code>
                    <span>MEMORY.md 비우기 + 토픽 파일 삭제 (되돌릴 수 없음)</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-40">getTopicFiles()</code>
                    <span>overflow된 토픽 파일명 배열 반환</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-40">
                      readTopicFile(topic)
                    </code>
                    <span>특정 토픽 파일 내용 읽기 (없으면 null)</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-40">
                      writeTopicFile(t, c)
                    </code>
                    <span>토픽 파일 생성/덮어쓰기, 정규화된 파일명 반환</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-40">getProjectHash()</code>
                    <span>SHA-256 앞 16자 hex 반환 (디버깅용)</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-40">getMemoryDir()</code>
                    <span>메모리 디렉토리 절대 경로 반환</span>
                  </div>
                </div>
              </div>

              <Callout type="warn" icon="⚠️">
                <code className="text-red-600 text-xs">clearMemory()</code>는 되돌릴 수 없습니다.
                MEMORY.md를 비우고 모든 토픽 파일을 삭제합니다. 프로덕션 코드에서는 사용자 확인 후
                호출하세요.
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
              기본 사용 (세션 시작 시)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              프로젝트 루트를 전달하여 인스턴스를 생성하고,{" "}
              <code className="text-cyan-600 text-xs">loadMemory()</code>로 이전 세션의 학습 내용을
              로드합니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">MemoryManager</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./memory/manager.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">memory</span>{" "}
              <span className="text-[#c9d1d9]">=</span> <span className="text-[#ff7b72]">new</span>{" "}
              <span className="text-[#d2a8ff]">MemoryManager</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"./my-project"'}</span>
              <span className="text-[#c9d1d9]">);</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 세션 시작 시 이전 학습 내용 로드"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">loaded</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#c9d1d9]">memory.</span>
              <span className="text-[#d2a8ff]">loadMemory</span>
              <span className="text-[#c9d1d9]">();</span>
              {"\n"}
              <span className="text-[#8b949e]">{"// loaded.content → 시스템 프롬프트에 주입"}</span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              학습 내용 저장
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              AI가 새로운 것을 학습하면{" "}
              <code className="text-cyan-600 text-xs">appendMemory()</code>로 기록합니다. 중복은
              자동으로 건너뛰고, 줄 수 초과 시 overflow됩니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#c9d1d9]">memory.</span>
              <span className="text-[#d2a8ff]">appendMemory</span>
              <span className="text-[#c9d1d9]">({"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">topic</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"debugging"'}</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">content</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">
                {'"이 프로젝트는 ESM only이므로 .js 확장자 필수"'}
              </span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
              <span className="text-[#c9d1d9]">);</span>
            </CodeBlock>

            <DeepDive title="토픽 파일 직접 관리하기">
              <p className="mb-3">
                overflow된 토픽 파일에 직접 접근하거나 수동으로 토픽 파일을 만들 수 있습니다.
              </p>

              <CodeBlock>
                <span className="text-[#8b949e]">{"// 토픽 파일 목록 조회"}</span>
                {"\n"}
                <span className="text-[#ff7b72]">const</span>{" "}
                <span className="text-[#79c0ff]">topics</span>{" "}
                <span className="text-[#c9d1d9]">=</span>{" "}
                <span className="text-[#ff7b72]">await</span>{" "}
                <span className="text-[#c9d1d9]">memory.</span>
                <span className="text-[#d2a8ff]">getTopicFiles</span>
                <span className="text-[#c9d1d9]">();</span>
                {"\n"}
                <span className="text-[#8b949e]">{'// → ["debugging.md", "patterns.md"]'}</span>
                {"\n\n"}
                <span className="text-[#8b949e]">{"// 특정 토픽 읽기"}</span>
                {"\n"}
                <span className="text-[#ff7b72]">const</span>{" "}
                <span className="text-[#79c0ff]">content</span>{" "}
                <span className="text-[#c9d1d9]">=</span>{" "}
                <span className="text-[#ff7b72]">await</span>{" "}
                <span className="text-[#c9d1d9]">memory.</span>
                <span className="text-[#d2a8ff]">readTopicFile</span>
                <span className="text-[#c9d1d9]">(</span>
                <span className="text-[#a5d6ff]">{'"debugging"'}</span>
                <span className="text-[#c9d1d9]">);</span>
              </CodeBlock>
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
              Facade 패턴
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              MemoryManager는 GoF의 <strong>Facade</strong> 패턴을 사용합니다. 복잡한 하위
              모듈(loader, writer, paths)의 함수를 래핑하여
              <code className="text-cyan-600 text-xs"> projectRoot</code>를 매번 전달할 필요 없이,
              생성 시 한 번만 설정하면 됩니다.
            </p>

            <MermaidDiagram
              title="메모리 생명주기"
              titleColor="purple"
              chart={`stateDiagram-v2
  [*] --> Empty : 첫 세션
  Empty --> Loaded : loadMemory()
  Loaded --> Appended : appendMemory()
  Appended --> Appended : appendMemory() (중복 건너뜀)
  Appended --> Overflowed : maxLines 초과
  Overflowed --> Appended : 토픽 파일로 분리 후 계속
  Appended --> Cleared : clearMemory()
  Cleared --> Empty : 초기화 완료
  Loaded --> Saved : saveMemory() (전체 덮어쓰기)
  Saved --> Loaded : 다시 로드`}
            />

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              설정 병합 전략
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              기본값(<code className="text-cyan-600 text-xs">DEFAULT_CONFIG</code>)에 사용자 설정을
              스프레드로 얕은 병합합니다.
              <code className="text-cyan-600 text-xs"> maxLoadLines: 200</code>,
              <code className="text-cyan-600 text-xs"> maxMemoryLines: 200</code>이 기본값이며,
              <code className="text-cyan-600 text-xs"> projectsBaseDir</code>은
              <code className="text-cyan-600 text-xs"> ~/.dbcode/projects</code>입니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">
                {"// 기본 설정에 사용자 오버라이드를 스프레드 병합"}
              </span>
              {"\n"}
              <span className="text-[#ff7b72]">this</span>
              <span className="text-[#c9d1d9]">
                .config = {"{"} ...DEFAULT_CONFIG, ...config {"}"};
              </span>
            </CodeBlock>

            <Callout type="info" icon="📝">
              <strong>readonly 속성:</strong> <code className="text-cyan-600 text-xs">config</code>
              와 <code className="text-cyan-600 text-xs">projectRoot</code>는 모두{" "}
              <code className="text-cyan-600 text-xs">readonly</code>입니다. 인스턴스 생성 후에는
              변경할 수 없으며, 불변성을 보장합니다.
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
                  <span className="text-red-600">Q.</span> loadMemory()가 빈 content를 반환해요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 1:</strong> 아직 메모리가 저장된 적이
                    없습니다.
                    <code className="text-cyan-600 text-xs"> exists</code>가{" "}
                    <code className="text-cyan-600 text-xs">false</code>인지 확인하세요.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인 2:</strong>{" "}
                    <code className="text-cyan-600 text-xs">projectRoot</code>가 상대 경로입니다.
                    절대 경로를 사용해야 해시가 일관됩니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> appendMemory()의 written이 false예요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <strong className="text-gray-900">원인:</strong> 동일한 내용이 이미 MEMORY.md에
                    존재합니다. 중복 감지는 대소문자 무시 부분 문자열 매칭으로 수행됩니다. 내용을
                    수정하여 다시 시도하세요.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 다른 프로젝트의 메모리가 섞여요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <strong className="text-gray-900">원인:</strong> 같은 절대 경로를 사용하고
                    있거나, 심볼릭 링크로 인해 다른 경로가 같은 해시를 생성할 수 있습니다.
                    <code className="text-cyan-600 text-xs"> getProjectHash()</code>로 해시를
                    확인하세요.
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
                  name: "memory/writer.ts",
                  slug: "memory-writer",
                  relation: "child",
                  desc: "원자적 파일 쓰기, 중복 감지, overflow 처리를 담당하는 하위 모듈",
                },
                {
                  name: "memory/loader.ts",
                  slug: "memory-loader",
                  relation: "child",
                  desc: "MEMORY.md와 토픽 파일을 디스크에서 읽어오는 하위 모듈",
                },
                {
                  name: "system-prompt-builder.ts",
                  slug: "system-prompt-builder",
                  relation: "parent",
                  desc: "loadMemory() 결과를 시스템 프롬프트에 주입하는 상위 모듈",
                },
                {
                  name: "config/loader.ts",
                  slug: "config-loader",
                  relation: "sibling",
                  desc: "같은 Leaf Layer에서 설정 로딩을 담당하는 형제 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
