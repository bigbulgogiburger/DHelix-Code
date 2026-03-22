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

export default function CheckpointManagerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilePath path="src/core/checkpoint-manager.ts" />
              <LayerBadge layer="core" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
              <span className="text-gray-900">Checkpoint Manager</span>
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[640px]">
              파일 변경 전 자동 상태 스냅샷을 생성하여 안전한 되돌리기를 지원하는 모듈입니다.
              SHA-256 해시 기반 변경 감지와{" "}
              <span className="text-cyan-600 font-semibold">/undo</span>,{" "}
              <span className="text-violet-600 font-semibold">/rewind</span> 명령을 위한 핵심
              인프라입니다.
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
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
              <code className="text-cyan-600 text-xs">file_edit</code>이나{" "}
              <code className="text-cyan-600 text-xs">file_write</code> 같은 도구가 파일을 수정하기
              전에, CheckpointManager는{" "}
              <strong className="text-gray-900">해당 파일의 현재 상태를 스냅샷</strong>으로
              저장합니다. 게임에서 &quot;세이브 포인트&quot;를 만들어 두고, 잘못되면 되돌리는 것과
              같은 원리입니다. 각 파일의 내용을 복사하고{" "}
              <span className="text-violet-600 font-semibold">SHA-256 해시</span>를 기록하여, 나중에
              어떤 파일이 변경되었는지 정확하게 감지할 수 있습니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>핵심 원리:</strong> 체크포인트 = 메타데이터(JSON) + 파일 복사본(디렉토리).
              해시 비교로 변경 여부를 판단하므로, 파일 내용을 직접 비교하지 않아도 됩니다.
            </Callout>

            <MermaidDiagram
              title="Checkpoint Manager 동작 흐름"
              titleColor="purple"
              chart={`flowchart LR
  TOOL["Tool 실행<br/><small>file_edit, file_write 호출</small>"]
  CREATE["createCheckpoint<br/><small>파일 스냅샷 생성</small>"]
  STORE["저장<br/><small>cp-001.json + cp-001/</small>"]
  MODIFY["파일 수정<br/><small>도구가 실제 실행</small>"]
  DIFF["diffFromCheckpoint<br/><small>SHA-256 해시 비교</small>"]
  RESTORE["restoreCheckpoint<br/><small>파일 원본 복원</small>"]

  TOOL --> CREATE
  CREATE --> STORE
  STORE --> MODIFY
  MODIFY -->|문제 발생| DIFF
  DIFF -->|/undo, /rewind| RESTORE

  style CREATE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style STORE fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style TOOL fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style MODIFY fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style DIFF fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style RESTORE fill:#f8fafc,stroke:#ef4444,color:#ef4444,stroke-width:2px`}
            />

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
              <h4 className="text-[14px] font-bold mb-3">디렉토리 구조</h4>
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600 font-mono">
                <div className="flex gap-3">
                  <span className="text-violet-600 font-bold shrink-0">
                    {"{session-dir}"}/checkpoints/
                  </span>
                </div>
                <div className="flex gap-3 pl-4">
                  <span className="text-amber-600 shrink-0">cp-001.json</span>
                  <span className="font-sans text-gray-400">
                    &mdash; 체크포인트 메타데이터 (파일 목록, 해시, 크기)
                  </span>
                </div>
                <div className="flex gap-3 pl-4">
                  <span className="text-blue-600 shrink-0">cp-001/</span>
                  <span className="font-sans text-gray-400">&mdash; 저장된 파일 내용</span>
                </div>
                <div className="flex gap-3 pl-8">
                  <span className="text-cyan-600 shrink-0">src__index.ts</span>
                  <span className="font-sans text-gray-400">
                    &mdash; 원본 파일 복사본 (/ &rarr; __ 변환)
                  </span>
                </div>
                <div className="flex gap-3 pl-8">
                  <span className="text-cyan-600 shrink-0">src__utils__path.ts</span>
                  <span className="font-sans text-gray-400">&mdash; 중첩 경로도 평탄화</span>
                </div>
                <div className="flex gap-3 pl-4">
                  <span className="text-amber-600 shrink-0">cp-002.json</span>
                  <span className="font-sans text-gray-400">&mdash; 다음 체크포인트</span>
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
              <span>{"📖"}</span> 레퍼런스
            </h2>

            {/* CheckpointError */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-indigo-600 font-mono mb-2 flex items-center gap-2">
                <span>CheckpointError</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-600">
                  extends BaseError
                </span>
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
                체크포인트 관련 에러를 나타내는 클래스입니다. 에러 코드는{" "}
                <code className="text-cyan-600 text-xs">CHECKPOINT_ERROR</code>로 고정되며, 추가
                컨텍스트를 <code className="text-cyan-600 text-xs">context</code> 객체로 전달할 수
                있습니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "message",
                    type: "string",
                    required: true,
                    desc: '에러 메시지 (예: "Checkpoint not found")',
                  },
                  {
                    name: "context",
                    type: "Record<string, unknown>",
                    required: false,
                    desc: '추가 디버깅 정보 (예: { checkpointId: "cp-001" }). 기본값 {}',
                  },
                ]}
              />
            </div>

            {/* FileSnapshot */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-indigo-600 font-mono mb-2 flex items-center gap-2">
                <span>FileSnapshot</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                  interface
                </span>
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
                체크포인트 내 단일 파일의 스냅샷 정보입니다. 모든 필드가{" "}
                <code className="text-cyan-600 text-xs">readonly</code>로 선언되어 불변성이
                보장됩니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "relativePath",
                    type: "string",
                    required: true,
                    desc: '작업 디렉토리 기준 상대 경로 (예: "src/index.ts")',
                  },
                  {
                    name: "contentHash",
                    type: "string",
                    required: true,
                    desc: "파일 내용의 SHA-256 해시. 파일이 존재하지 않으면 빈 문자열",
                  },
                  {
                    name: "size",
                    type: "number",
                    required: true,
                    desc: "파일 크기(바이트). 파일이 존재하지 않으면 0",
                  },
                  {
                    name: "exists",
                    type: "boolean",
                    required: true,
                    desc: '체크포인트 시점에 파일이 존재했는지 여부. false이면 "없었다"는 것을 기록',
                  },
                ]}
              />
            </div>

            {/* Checkpoint */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-indigo-600 font-mono mb-2 flex items-center gap-2">
                <span>Checkpoint</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                  interface
                </span>
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
                체크포인트의 메타데이터입니다. JSON 파일(
                <code className="text-cyan-600 text-xs">cp-001.json</code>)로 직렬화됩니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "id",
                    type: "string",
                    required: true,
                    desc: '체크포인트 식별자 (예: "cp-001", "cp-002"). 3자리 zero-padded',
                  },
                  {
                    name: "sessionId",
                    type: "string",
                    required: true,
                    desc: "이 체크포인트가 속한 세션 ID",
                  },
                  {
                    name: "createdAt",
                    type: "string",
                    required: true,
                    desc: "생성 시각 (ISO 8601 형식)",
                  },
                  {
                    name: "description",
                    type: "string",
                    required: true,
                    desc: '체크포인트 설명 (예: "Before file_edit: index.ts")',
                  },
                  {
                    name: "messageIndex",
                    type: "number",
                    required: true,
                    desc: "체크포인트 생성 시점의 메시지 인덱스 (어느 턴에서 만들어졌는지 기록)",
                  },
                  {
                    name: "files",
                    type: "readonly FileSnapshot[]",
                    required: true,
                    desc: "스냅샷된 파일 목록. 존재하지 않는 파일도 exists: false로 포함",
                  },
                ]}
              />
            </div>

            {/* CreateCheckpointOptions */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-indigo-600 font-mono mb-2 flex items-center gap-2">
                <span>CreateCheckpointOptions</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                  interface
                </span>
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
                <code className="text-cyan-600 text-xs">createCheckpoint()</code> 메서드에 전달하는
                옵션 객체입니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "sessionId",
                    type: "string",
                    required: true,
                    desc: "세션 ID",
                  },
                  {
                    name: "description",
                    type: "string",
                    required: true,
                    desc: '체크포인트 설명 (예: "Before file_edit: index.ts")',
                  },
                  {
                    name: "messageIndex",
                    type: "number",
                    required: true,
                    desc: "현재 메시지 인덱스 (어느 시점인지 기록)",
                  },
                  {
                    name: "workingDirectory",
                    type: "string",
                    required: true,
                    desc: "작업 디렉토리 (파일 경로의 기준, 절대 경로)",
                  },
                  {
                    name: "trackedFiles",
                    type: "readonly string[]",
                    required: true,
                    desc: "스냅샷할 파일 경로 목록 (workingDirectory 기준 상대 경로)",
                  },
                ]}
              />
            </div>

            {/* RestoreResult */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-indigo-600 font-mono mb-2 flex items-center gap-2">
                <span>RestoreResult</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                  interface
                </span>
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
                <code className="text-cyan-600 text-xs">restoreCheckpoint()</code>의 반환
                타입입니다. 복원 성공/실패 파일을 분리하여 부분 실패 상황을 처리할 수 있습니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "restoredFiles",
                    type: "readonly string[]",
                    required: true,
                    desc: "성공적으로 복원된 파일의 상대 경로 목록",
                  },
                  {
                    name: "skippedFiles",
                    type: "readonly string[]",
                    required: true,
                    desc: "복원을 건너뛴 파일 경로 목록 (원본이 없었거나 복원 실패)",
                  },
                  {
                    name: "checkpoint",
                    type: "Checkpoint",
                    required: true,
                    desc: "복원에 사용된 체크포인트 정보",
                  },
                ]}
              />
            </div>

            {/* CheckpointManager class */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-indigo-600 font-mono mb-2 flex items-center gap-2">
                <span>CheckpointManager</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">
                  class
                </span>
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
                체크포인트 관리의 핵심 클래스입니다. 세션 디렉토리를 기반으로 인스턴스를 생성하며,
                체크포인트 생성, 조회, 복원, diff 기능을 제공합니다.
              </p>

              <h4 className="text-[13px] font-bold text-gray-900 mb-2">생성자</h4>
              <ParamTable
                params={[
                  {
                    name: "sessionDir",
                    type: "string",
                    required: true,
                    desc: "세션 디렉토리 경로. 하위에 checkpoints/ 디렉토리가 생성됩니다",
                  },
                ]}
              />

              <h4 className="text-[13px] font-bold text-gray-900 mt-4 mb-2">메서드</h4>
              <div className="flex flex-col gap-3">
                {/* createCheckpoint */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h5 className="text-[13px] font-bold font-mono text-cyan-600 mb-1">
                    createCheckpoint(options: CreateCheckpointOptions): Promise&lt;Checkpoint&gt;
                  </h5>
                  <p className="text-[13px] text-gray-600">
                    지정된 파일들의 체크포인트를 생성합니다. 각 파일의 내용을 체크포인트 디렉토리에
                    복사하고, SHA-256 해시와 크기 등의 메타데이터를 기록합니다. 기존 체크포인트를
                    확인하여 <code className="text-cyan-600 text-xs">syncNextId()</code>로 ID를 자동
                    동기화합니다.
                  </p>
                </div>

                {/* listCheckpoints */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h5 className="text-[13px] font-bold font-mono text-cyan-600 mb-1">
                    listCheckpoints(): Promise&lt;readonly Checkpoint[]&gt;
                  </h5>
                  <p className="text-[13px] text-gray-600">
                    모든 체크포인트 목록을 조회합니다. 생성 시간 순(오래된 것 먼저)으로 정렬됩니다.
                    체크포인트가 없으면 빈 배열을 반환합니다.
                  </p>
                </div>

                {/* getCheckpoint */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h5 className="text-[13px] font-bold font-mono text-cyan-600 mb-1">
                    getCheckpoint(checkpointId: string): Promise&lt;Checkpoint&gt;
                  </h5>
                  <p className="text-[13px] text-gray-600">
                    ID로 특정 체크포인트를 조회합니다. 찾을 수 없으면{" "}
                    <code className="text-red-600 text-xs">CheckpointError</code>를 던집니다.
                  </p>
                </div>

                {/* restoreCheckpoint */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h5 className="text-[13px] font-bold font-mono text-cyan-600 mb-1">
                    restoreCheckpoint(checkpointId: string, workingDirectory: string):
                    Promise&lt;RestoreResult&gt;
                  </h5>
                  <p className="text-[13px] text-gray-600">
                    체크포인트에서 파일들을 복원합니다. 체크포인트 시점에 존재하지 않았던 파일은
                    건너뜁니다. 개별 파일 복원 실패 시에도 전체 작업이 중단되지 않고{" "}
                    <code className="text-cyan-600 text-xs">skippedFiles</code>에 기록됩니다.
                  </p>
                </div>

                {/* diffFromCheckpoint */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h5 className="text-[13px] font-bold font-mono text-cyan-600 mb-1">
                    diffFromCheckpoint(checkpointId: string, workingDirectory: string):
                    Promise&lt;DiffResult[]&gt;
                  </h5>
                  <p className="text-[13px] text-gray-600">
                    체크포인트와 현재 파일 상태의 차이를 확인합니다. 각 파일에 대해{" "}
                    <code className="text-cyan-600 text-xs">unchanged</code>,{" "}
                    <code className="text-cyan-600 text-xs">modified</code>,{" "}
                    <code className="text-cyan-600 text-xs">deleted</code>,{" "}
                    <code className="text-cyan-600 text-xs">new</code> 중 하나의 상태를 반환합니다.
                  </p>
                </div>
              </div>

              <Callout type="warn" icon="⚠️">
                <code className="text-cyan-600 text-xs">restoreCheckpoint()</code>는{" "}
                <strong>체크포인트 시점에 없었던 파일(exists: false)은 삭제하지 않습니다.</strong>{" "}
                새로 생성된 파일을 제거하려면{" "}
                <code className="text-cyan-600 text-xs">diffFromCheckpoint()</code>로{" "}
                <code className="text-cyan-600 text-xs">new</code> 상태 파일을 확인하고 별도로
                삭제해야 합니다.
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
              기본 사용 (체크포인트 생성)
            </h3>
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
              도구가 파일을 수정하기 전에{" "}
              <code className="text-cyan-600 text-xs">createCheckpoint()</code>를 호출하여 현재 파일
              상태를 저장합니다. <code className="text-cyan-600 text-xs">trackedFiles</code>에
              스냅샷할 파일 목록을 전달합니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">CheckpointManager</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./core/checkpoint-manager.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 세션 디렉토리를 기반으로 인스턴스 생성"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">manager</span>{" "}
              <span className="text-[#c9d1d9]">=</span> <span className="text-[#ff7b72]">new</span>{" "}
              <span className="text-[#d2a8ff]">CheckpointManager</span>
              <span className="text-[#c9d1d9]">(sessionDir);</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 파일 수정 전에 체크포인트 생성"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">checkpoint</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#c9d1d9]">manager.</span>
              <span className="text-[#d2a8ff]">createCheckpoint</span>
              <span className="text-[#c9d1d9]">({"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">sessionId</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"session-abc"'}</span>
              <span className="text-[#c9d1d9]">{","}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">description</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"Before file_edit: index.ts"'}</span>
              <span className="text-[#c9d1d9]">{","}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">messageIndex</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">5</span>
              <span className="text-[#c9d1d9]">{","}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">workingDirectory</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"~/my-project"'}</span>
              <span className="text-[#c9d1d9]">{","}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">trackedFiles</span>
              <span className="text-[#c9d1d9]">{": ["}</span>
              <span className="text-[#a5d6ff]">{'"src/index.ts"'}</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#a5d6ff]">{'"src/utils/path.ts"'}</span>
              <span className="text-[#c9d1d9]">{"],"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"});"}</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{'// checkpoint.id === "cp-001"'}</span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              변경 사항 확인 (diff)
            </h3>
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
              체크포인트 이후 어떤 파일이 변경되었는지 확인합니다. SHA-256 해시를 비교하여 변경
              여부를 정확하게 판단합니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">diff</span> <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#c9d1d9]">manager.</span>
              <span className="text-[#d2a8ff]">diffFromCheckpoint</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"cp-001"'}</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#a5d6ff]">{'"~/my-project"'}</span>
              <span className="text-[#c9d1d9]">);</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 결과 예시:"}</span>
              {"\n"}
              <span className="text-[#8b949e]">
                {'// [{ path: "src/index.ts", status: "modified" },'}
              </span>
              {"\n"}
              <span className="text-[#8b949e]">
                {'//  { path: "src/utils/path.ts", status: "unchanged" }]'}
              </span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              파일 복원 (/undo, /rewind)
            </h3>
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
              잘못된 변경을 되돌리려면{" "}
              <code className="text-cyan-600 text-xs">restoreCheckpoint()</code>를 호출합니다.
              결과에 <code className="text-cyan-600 text-xs">restoredFiles</code>와{" "}
              <code className="text-cyan-600 text-xs">skippedFiles</code>가 분리되어 있어 부분 실패
              상황도 안전하게 처리됩니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">result</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#c9d1d9]">manager.</span>
              <span className="text-[#d2a8ff]">restoreCheckpoint</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"cp-001"'}</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#a5d6ff]">{'"~/my-project"'}</span>
              <span className="text-[#c9d1d9]">);</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{'// result.restoredFiles → ["src/index.ts"]'}</span>
              {"\n"}
              <span className="text-[#8b949e]">
                {'// result.skippedFiles  → ["src/new-file.ts"]  // 원래 없었던 파일'}
              </span>
              {"\n"}
              <span className="text-[#8b949e]">
                {"// result.checkpoint    → 사용된 체크포인트 정보"}
              </span>
            </CodeBlock>

            <DeepDive title="체크포인트 목록 조회와 특정 시점으로 되감기">
              <p className="mb-3">
                <code className="text-cyan-600 text-xs">/rewind</code> 명령은 여러 체크포인트 중
                특정 시점으로 되감는 기능입니다.{" "}
                <code className="text-cyan-600 text-xs">listCheckpoints()</code>로 전체 목록을
                조회한 뒤, 원하는 체크포인트를 선택하여 복원할 수 있습니다.
              </p>

              <CodeBlock>
                <span className="text-[#ff7b72]">const</span>{" "}
                <span className="text-[#79c0ff]">checkpoints</span>{" "}
                <span className="text-[#c9d1d9]">=</span>{" "}
                <span className="text-[#ff7b72]">await</span>{" "}
                <span className="text-[#c9d1d9]">manager.</span>
                <span className="text-[#d2a8ff]">listCheckpoints</span>
                <span className="text-[#c9d1d9]">();</span>
                {"\n\n"}
                <span className="text-[#8b949e]">
                  {"// 시간순 정렬 — 가장 최근 체크포인트 선택"}
                </span>
                {"\n"}
                <span className="text-[#ff7b72]">const</span>{" "}
                <span className="text-[#79c0ff]">latest</span>{" "}
                <span className="text-[#c9d1d9]">=</span>{" "}
                <span className="text-[#c9d1d9]">checkpoints[checkpoints.</span>
                <span className="text-[#79c0ff]">length</span>{" "}
                <span className="text-[#c9d1d9]">-</span> <span className="text-[#79c0ff]">1</span>
                <span className="text-[#c9d1d9]">];</span>
                {"\n\n"}
                <span className="text-[#8b949e]">{"// 특정 메시지 인덱스 이전으로 되감기"}</span>
                {"\n"}
                <span className="text-[#ff7b72]">const</span>{" "}
                <span className="text-[#79c0ff]">target</span>{" "}
                <span className="text-[#c9d1d9]">=</span>{" "}
                <span className="text-[#c9d1d9]">checkpoints.</span>
                <span className="text-[#d2a8ff]">findLast</span>
                <span className="text-[#c9d1d9]">(</span>
                {"\n"}
                <span className="text-[#c9d1d9]">{"  "}</span>
                <span className="text-[#79c0ff]">cp</span>{" "}
                <span className="text-[#ff7b72]">{"=>"}</span>{" "}
                <span className="text-[#c9d1d9]">cp.</span>
                <span className="text-[#79c0ff]">messageIndex</span>{" "}
                <span className="text-[#c9d1d9]">{"<="}</span>{" "}
                <span className="text-[#79c0ff]">targetIndex</span>
                {"\n"}
                <span className="text-[#c9d1d9]">);</span>
                {"\n"}
                <span className="text-[#ff7b72]">await</span>{" "}
                <span className="text-[#c9d1d9]">manager.</span>
                <span className="text-[#d2a8ff]">restoreCheckpoint</span>
                <span className="text-[#c9d1d9]">(target.</span>
                <span className="text-[#79c0ff]">id</span>
                <span className="text-[#c9d1d9]">{", workingDir);"}</span>
              </CodeBlock>

              <Callout type="warn" icon="⚠️">
                되감기 후에도 <strong>이전 체크포인트 파일은 삭제되지 않습니다.</strong>
                디스크 공간이 부족해지면 오래된 체크포인트를 수동으로 정리하세요.
              </Callout>
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

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              createCheckpoint 상태 흐름
            </h3>
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
              체크포인트 생성 시 <code className="text-cyan-600 text-xs">syncNextId()</code>로 기존
              체크포인트를 확인한 뒤, 각 파일을 순회하면서 내용을 복사하고 SHA-256 해시를
              계산합니다. 파일이 존재하지 않으면{" "}
              <code className="text-cyan-600 text-xs">exists: false</code>로 기록하여
              &quot;없었다&quot;는 사실 자체도 스냅샷에 포함합니다.
            </p>

            <MermaidDiagram
              title="createCheckpoint 내부 플로우"
              titleColor="cyan"
              chart={`flowchart TD
  START["createCheckpoint(options)<br/><small>체크포인트 생성 시작</small>"] --> ENSURE["ensureDir()<br/><small>checkpoints/ 디렉토리 보장</small>"]
  ENSURE --> SYNC["syncNextId()<br/><small>기존 cp-NNN.json 확인</small>"]
  SYNC --> GEN["ID 생성<br/><small>cp-001, cp-002 순번 할당</small>"]
  GEN --> MKDIR["디렉토리 생성<br/><small>cp-NNN/ 폴더 생성</small>"]
  MKDIR --> LOOP["trackedFiles 순회<br/><small>추적 파일 목록 반복</small>"]
  LOOP --> STAT{"파일 존재?<br/><small>stat() 확인</small>"}
  STAT -->|Yes| COPY["readFile → writeFile<br/><small>체크포인트에 복사</small>"]
  STAT -->|No| RECORD["exists: false<br/><small>빈 스냅샷 기록</small>"]
  COPY --> HASH["SHA-256 해시 계산<br/><small>내용 무결성 검증</small>"]
  HASH --> PUSH["snapshots[] 추가<br/><small>스냅샷 배열에 저장</small>"]
  RECORD --> PUSH
  PUSH -->|다음 파일| LOOP
  PUSH -->|완료| SAVE["cp-NNN.json 저장<br/><small>메타데이터 직렬화</small>"]

  style START fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style SYNC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style STAT fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style COPY fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style HASH fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style SAVE fill:#f8fafc,stroke:#06b6d4,color:#06b6d4,stroke-width:2px`}
            />

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              안전한 파일 이름 변환
            </h3>
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
              파일 경로를 체크포인트 디렉토리에 저장할 때, 경로 구분자(
              <code className="text-cyan-600 text-xs">/</code>)를{" "}
              <code className="text-cyan-600 text-xs">__</code>(더블 언더스코어)로 변환합니다.
              이렇게 하면 디렉토리 중첩 없이 단일 디렉토리에 모든 파일을 평탄하게 저장할 수
              있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"// 경로 변환 규칙: / → __"}</span>
              {"\n"}
              <span className="text-[#a5d6ff]">{'"src/index.ts"'}</span>
              <span className="text-[#c9d1d9]">{"      → "}</span>
              <span className="text-[#a5d6ff]">{'"src__index.ts"'}</span>
              {"\n"}
              <span className="text-[#a5d6ff]">{'"src/utils/path.ts"'}</span>
              <span className="text-[#c9d1d9]">{" → "}</span>
              <span className="text-[#a5d6ff]">{'"src__utils__path.ts"'}</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 실제 코드:"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">safeFileName</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#c9d1d9]">relativeTo.</span>
              <span className="text-[#d2a8ff]">replace</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#79c0ff]">{"/[\\\\\\\\]/g"}</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#a5d6ff]">{'"__"'}</span>
              <span className="text-[#c9d1d9]">);</span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              SHA-256 해시 비교 (diffFromCheckpoint)
            </h3>
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
              diff 연산의 핵심은 해시 비교입니다. 체크포인트에 저장된 해시와 현재 파일의 해시를
              비교하여 네 가지 상태를 판별합니다.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-[14px] font-bold mb-3">diff 상태 판별 매트릭스</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                        조건
                      </th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                        결과 상태
                      </th>
                      <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                        의미
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5">exists=true + 해시 일치</td>
                      <td className="p-2.5 font-mono text-emerald-600 font-semibold">unchanged</td>
                      <td className="p-2.5">체크포인트 이후 변경 없음</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5">exists=true + 해시 불일치</td>
                      <td className="p-2.5 font-mono text-amber-600 font-semibold">modified</td>
                      <td className="p-2.5">내용이 변경됨</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-2.5">exists=true + 파일 읽기 실패</td>
                      <td className="p-2.5 font-mono text-red-600 font-semibold">deleted</td>
                      <td className="p-2.5">체크포인트 시점에 있었으나 현재 삭제됨</td>
                    </tr>
                    <tr>
                      <td className="p-2.5">exists=false + 현재 파일 존재</td>
                      <td className="p-2.5 font-mono text-blue-600 font-semibold">new</td>
                      <td className="p-2.5">체크포인트 시점에 없었으나 새로 생성됨</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              syncNextId &mdash; 증분 ID 동기화
            </h3>
            <p className="text-[14px] text-gray-600 leading-[1.85] mb-3">
              체크포인트 ID는 <code className="text-cyan-600 text-xs">cp-001</code>,{" "}
              <code className="text-cyan-600 text-xs">cp-002</code> 형태로 증분됩니다.
              <code className="text-cyan-600 text-xs"> syncNextId()</code>는 기존 체크포인트 파일을
              스캔하여 가장 높은 번호를 찾고, 다음 ID를 설정합니다. 이렇게 하면 앱 재시작 후에도
              ID가 충돌하지 않습니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">
                {"// cp-001.json, cp-003.json이 이미 존재하면"}
              </span>
              {"\n"}
              <span className="text-[#8b949e]">{"// → maxId = 3"}</span>
              {"\n"}
              <span className="text-[#8b949e]">{"// → nextId = 4"}</span>
              {"\n"}
              <span className="text-[#8b949e]">{'// → 다음 체크포인트 ID는 "cp-004"'}</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">maxId</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#c9d1d9]">Math.</span>
              <span className="text-[#d2a8ff]">max</span>
              <span className="text-[#c9d1d9]">(</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  ...cpFiles."}</span>
              <span className="text-[#d2a8ff]">map</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#79c0ff]">f</span>{" "}
              <span className="text-[#ff7b72]">{"=>"}</span>{" "}
              <span className="text-[#d2a8ff]">parseInt</span>
              <span className="text-[#c9d1d9]">(f.</span>
              <span className="text-[#d2a8ff]">match</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#79c0ff]">{"/^cp-(\\\\d+)\\\\.json$/"}</span>
              <span className="text-[#c9d1d9]">)?.[</span>
              <span className="text-[#79c0ff]">1</span>
              <span className="text-[#c9d1d9]">]{", "}</span>
              <span className="text-[#79c0ff]">10</span>
              <span className="text-[#c9d1d9]">)</span>
              <span className="text-[#c9d1d9]">)</span>
              {"\n"}
              <span className="text-[#c9d1d9]">);</span>
            </CodeBlock>

            <Callout type="info" icon="📝">
              <strong>중간 번호가 빠져도 문제없습니다.</strong>{" "}
              <code className="text-cyan-600 text-xs">syncNextId()</code>는 항상 가장 높은 번호 +
              1을 사용하므로, cp-002를 삭제해도 다음 체크포인트는 cp-004(기존 최대가 cp-003인
              경우)로 생성됩니다.
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
              {/* FAQ 1 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> CheckpointError: Checkpoint not found
                  에러가 발생해요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인 1:</strong> 체크포인트 ID가
                    잘못되었습니다. <code className="text-cyan-600 text-xs">listCheckpoints()</code>
                    로 존재하는 체크포인트 목록을 확인하세요.
                  </p>
                  <p>
                    <strong className="text-gray-900">원인 2:</strong> 세션 디렉토리가
                    변경되었습니다. <code className="text-cyan-600 text-xs">CheckpointManager</code>
                    는 생성자에 전달된 <code className="text-cyan-600 text-xs">sessionDir</code>을
                    기준으로 동작합니다. 다른 세션 디렉토리의 체크포인트는 조회할 수 없습니다.
                  </p>
                </div>
              </div>

              {/* FAQ 2 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 복원했는데 새로 생긴 파일이 남아 있어요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">이것은 의도된 동작입니다.</strong>{" "}
                    <code className="text-cyan-600 text-xs">restoreCheckpoint()</code>는
                    체크포인트에 기록된 파일만 복원합니다. 체크포인트 시점에 존재하지 않았던 파일(
                    <code className="text-cyan-600 text-xs">exists: false</code>)은{" "}
                    <code className="text-cyan-600 text-xs">skippedFiles</code>에 포함되며 삭제되지
                    않습니다.
                  </p>
                  <p>
                    새로 생성된 파일을 제거하려면{" "}
                    <code className="text-cyan-600 text-xs">diffFromCheckpoint()</code>로{" "}
                    <code className="text-cyan-600 text-xs">new</code> 상태 파일을 확인하고 수동으로
                    삭제하세요.
                  </p>
                </div>
              </div>

              {/* FAQ 3 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 체크포인트 파일이 디스크를 많이 차지해요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    체크포인트는 파일의 <strong className="text-gray-900">전체 내용</strong>을
                    복사합니다. 대용량 파일이나 많은 파일을 추적하면 디스크 사용량이 증가합니다.
                  </p>
                  <p>
                    오래된 체크포인트는 세션 디렉토리의{" "}
                    <code className="text-cyan-600 text-xs">checkpoints/</code> 폴더에서
                    <code className="text-cyan-600 text-xs"> cp-NNN.json</code> 파일과{" "}
                    <code className="text-cyan-600 text-xs">cp-NNN/</code> 디렉토리를 함께 삭제하면
                    정리됩니다.
                  </p>
                </div>
              </div>

              {/* FAQ 4 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 일부 파일만 복원에 실패했어요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인:</strong> 체크포인트 디렉토리 내의 백업
                    파일이 손상되었거나, 대상 디렉토리에 쓰기 권한이 없는 경우입니다.
                  </p>
                  <p>
                    <code className="text-cyan-600 text-xs">RestoreResult.skippedFiles</code>에
                    실패한 파일 목록이 포함되어 있으므로, 이를 확인하고 수동으로 처리하세요. 나머지
                    파일은 정상적으로 복원됩니다 &mdash; 부분 실패 내성(partial failure tolerance)
                    설계입니다.
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
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "Agent Loop에서 도구 실행 전 자동으로 체크포인트를 생성 — CheckpointManager의 주요 소비자",
                },
                {
                  name: "recovery-executor.ts",
                  slug: "recovery-executor",
                  relation: "sibling",
                  desc: "에러 복구 시 체크포인트를 활용하여 안전하게 파일을 되돌리는 형제 모듈",
                },
                {
                  name: "context-manager.ts",
                  slug: "context-manager",
                  relation: "sibling",
                  desc: "3-Layer 컨텍스트 관리 — 체크포인트와 함께 Core Layer를 구성하는 형제 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
