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

export default function ToolExecutorPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/tools/executor.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Tool Executor</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              도구 실행 파이프라인 — Zod 검증, 인자 자동 교정, 타임아웃, 재시도, 백그라운드 프로세스
              관리를 담당하는 모듈입니다.
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
                <code className="text-cyan-600">Tool Executor</code>는 LLM이 요청한 도구 호출을
                실제로 실행하는 엔진입니다. 에이전트 루프가 LLM 응답에서 도구 호출을 추출하면, 이
                모듈이 레지스트리에서 도구를 찾고, 인수를 검증하고, 안전하게 실행합니다.
              </p>
              <p>
                단순 실행뿐 아니라 여러 안전 장치를 포함합니다. 저성능 모델이 잘못된 인수를 보내면
                <code className="text-cyan-600">correctToolCall()</code>이 자동으로 교정하고,
                <code className="text-cyan-600">parseToolArguments()</code>가 Zod 스키마로 최종
                검증합니다. 네트워크 오류처럼 일시적인 에러가 발생하면 지수 백오프(exponential
                backoff)로 자동 재시도하며, 타임아웃과 AbortSignal로 무한 대기를 방지합니다.
              </p>
              <p>
                또한 <code className="text-cyan-600">BackgroundProcessManager</code>를 통해
                <code className="text-cyan-600">npm run dev</code>처럼 오래 걸리는 명령을
                백그라운드에서 비동기적으로 관리할 수 있습니다. 각 프로세스의 출력을 임시 파일에
                기록하고, 증분 읽기(incremental read)로 새 출력만 효율적으로 확인합니다.
              </p>
            </div>

            <MermaidDiagram
              title="Tool Executor 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AL["Agent Loop<br/><small>agent-loop.ts</small>"]
  TE["Tool Executor<br/><small>tools/executor.ts</small>"]
  TR["Tool Registry<br/><small>tools/registry.ts</small>"]
  TV["Validation<br/><small>tools/validation.ts</small>"]
  TC["Tool Call Corrector<br/><small>tools/tool-call-corrector.ts</small>"]
  PM["Permission Manager<br/><small>permissions/manager.ts</small>"]
  BPM["Background Process Manager<br/><small>(executor.ts 내부)</small>"]

  AL -->|"executeToolCall()"| TE
  TE -->|"registry.get(name)"| TR
  TE -->|"correctToolCall()"| TC
  TE -->|"parseToolArguments()"| TV
  TE -->|"tool.execute()"| PM
  TE -.->|"spawn()"| BPM

  style TE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TR fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TV fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style BPM fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 도구 실행기는 공장의 품질 관리 라인과 비슷합니다. 원재료(LLM
              인수)가 들어오면 먼저 교정(corrector)하고, 검증(Zod)을 통과해야만 실제 가공(실행)에
              들어갑니다. 불량품(에러)이 나오면 재작업(재시도)하고, 시간이 너무 오래 걸리면 라인을
              멈춥니다(타임아웃).
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

            {/* executeTool function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              executeTool(tool, args, options?)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              단일 도구를 안전하게 실행합니다. 인수 교정, Zod 검증, 타임아웃 관리, 일시적 에러
              재시도를 모두 포함하는 핵심 실행 함수입니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span> <span className="fn">executeTool</span>(
              {"\n"}
              {"  "}
              <span className="prop">tool</span>: <span className="type">ToolDefinition</span>,
              {"\n"}
              {"  "}
              <span className="prop">args</span>: <span className="type">Record</span>
              {"<"}
              <span className="type">string</span>, <span className="type">unknown</span>
              {">"},{"\n"}
              {"  "}
              <span className="prop">options</span>?: {"{"}
              {"\n"}
              {"    "}
              <span className="prop">workingDirectory</span>?: <span className="type">string</span>;
              {"\n"}
              {"    "}
              <span className="prop">signal</span>?: <span className="type">AbortSignal</span>;
              {"\n"}
              {"    "}
              <span className="prop">events</span>?: <span className="type">AppEventEmitter</span>;
              {"\n"}
              {"    "}
              <span className="prop">toolCallId</span>?: <span className="type">string</span>;{"\n"}
              {"    "}
              <span className="prop">capabilityTier</span>?:{" "}
              <span className="type">CapabilityTier</span>;{"\n"}
              {"    "}
              <span className="prop">activeClient</span>?: <span className="type">LLMProvider</span>
              ;{"\n"}
              {"    "}
              <span className="prop">activeModel</span>?: <span className="type">string</span>;
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}): <span className="type">Promise</span>
              {"<"}
              <span className="type">ToolResult</span>
              {">"}
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "tool",
                  type: "ToolDefinition",
                  required: true,
                  desc: "실행할 도구의 정의 객체 (이름, 스키마, execute 함수 포함)",
                },
                {
                  name: "args",
                  type: "Record<string, unknown>",
                  required: true,
                  desc: "LLM이 전달한 원시 인수 (검증 전 상태)",
                },
                {
                  name: "options.workingDirectory",
                  type: "string",
                  required: false,
                  desc: "도구 실행의 작업 디렉토리 (기본값: process.cwd())",
                },
                {
                  name: "options.signal",
                  type: "AbortSignal",
                  required: false,
                  desc: "부모에서 전달된 취소 신호 — 사용자 Esc 등",
                },
                {
                  name: "options.events",
                  type: "AppEventEmitter",
                  required: false,
                  desc: "이벤트 발행기 — 도구 실행 이벤트를 UI에 전달",
                },
                {
                  name: "options.toolCallId",
                  type: "string",
                  required: false,
                  desc: "LLM 응답에서 추출한 도구 호출 고유 ID",
                },
                {
                  name: "options.capabilityTier",
                  type: "CapabilityTier",
                  required: false,
                  desc: "모델 성능 등급 (low/medium/high) — 인수 교정 결정에 사용",
                },
                {
                  name: "options.activeClient",
                  type: "LLMProvider",
                  required: false,
                  desc: "현재 활성 LLM 프로바이더 — 도구 컨텍스트에 전달",
                },
                {
                  name: "options.activeModel",
                  type: "string",
                  required: false,
                  desc: "현재 활성 모델명 — 도구 컨텍스트에 전달",
                },
              ]}
            />

            {/* executeToolCall function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              executeToolCall(registry, call, options?)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              레지스트리에서 도구를 이름으로 찾아{" "}
              <code className="text-cyan-600">executeTool()</code>을 호출하는 상위 래퍼(wrapper)
              함수입니다. 에이전트 루프가 직접 호출하는 진입점입니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span> <span className="fn">executeToolCall</span>
              ({"\n"}
              {"  "}
              <span className="prop">registry</span>: <span className="type">ToolRegistry</span>,
              {"\n"}
              {"  "}
              <span className="prop">call</span>: <span className="type">ExtractedToolCall</span>,
              {"\n"}
              {"  "}
              <span className="prop">options</span>?: {"{"} ... {"}"}
              {"\n"}): <span className="type">Promise</span>
              {"<"}
              <span className="type">ToolCallResult</span>
              {">"}
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "registry",
                  type: "ToolRegistry",
                  required: true,
                  desc: "도구 레지스트리 — 등록된 모든 도구를 보관하는 저장소",
                },
                {
                  name: "call",
                  type: "ExtractedToolCall",
                  required: true,
                  desc: "LLM 응답에서 추출한 도구 호출 정보 (id, name, arguments)",
                },
                {
                  name: "options",
                  type: "object",
                  required: false,
                  desc: "executeTool과 동일한 옵션 (workingDirectory, signal 등)",
                },
              ]}
            />
            <div className="text-[13px] text-gray-600 mt-3 space-y-1">
              <p>
                &bull; 도구를 찾을 수 없으면{" "}
                <code className="text-red-600">&quot;Unknown tool: {"{name}"}&quot;</code> 에러
                결과를 반환합니다.
              </p>
              <p>
                &bull; LLM이 존재하지 않는 도구를 &quot;환각(hallucinate)&quot;했을 때 이 경로를
                탑니다.
              </p>
            </div>

            {/* BackgroundProcessStatus interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface BackgroundProcessStatus
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              백그라운드 프로세스의 상태 정보입니다.{" "}
              <code className="text-cyan-600">getStatus()</code> 메서드가 반환합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "pid",
                  type: "number (readonly)",
                  required: true,
                  desc: "운영체제 PID (Process ID) — 프로세스 고유 번호",
                },
                {
                  name: "processId",
                  type: "string (readonly)",
                  required: true,
                  desc: '사람이 읽기 쉬운 프로세스 ID (예: "bg-1", "bg-2")',
                },
                {
                  name: "command",
                  type: "string (readonly)",
                  required: true,
                  desc: "실행 중인 명령어 문자열",
                },
                {
                  name: "running",
                  type: "boolean (readonly)",
                  required: true,
                  desc: "현재 실행 중 여부",
                },
                {
                  name: "exitCode",
                  type: "number | null (readonly)",
                  required: true,
                  desc: "종료 코드 (실행 중이면 null, 0이면 성공, 그 외 에러)",
                },
                {
                  name: "outputFile",
                  type: "string (readonly)",
                  required: true,
                  desc: "출력이 기록되는 임시 파일 경로",
                },
              ]}
            />

            {/* BackgroundProcessInfo interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface BackgroundProcessInfo
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">list()</code> 메서드에서 반환하는 간략한 프로세스
              정보입니다.
              <code className="text-cyan-600">BackgroundProcessStatus</code>에서{" "}
              <code className="text-cyan-600">outputFile</code>을 제외한 형태입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "processId",
                  type: "string (readonly)",
                  required: true,
                  desc: "사람이 읽기 쉬운 프로세스 ID",
                },
                { name: "pid", type: "number (readonly)", required: true, desc: "운영체제 PID" },
                {
                  name: "command",
                  type: "string (readonly)",
                  required: true,
                  desc: "실행 중인 명령어",
                },
                {
                  name: "running",
                  type: "boolean (readonly)",
                  required: true,
                  desc: "현재 실행 중 여부",
                },
                {
                  name: "exitCode",
                  type: "number | null (readonly)",
                  required: true,
                  desc: "종료 코드",
                },
              ]}
            />

            {/* BackgroundProcessManager class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class BackgroundProcessManager
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              장시간 실행 명령을 비동기적으로 관리하는 클래스입니다. 프로세스를 detached 모드로
              실행하고, 임시 파일에 출력을 기록하며,
              <code className="text-cyan-600">&quot;bg-1&quot;</code>,{" "}
              <code className="text-cyan-600">&quot;bg-2&quot;</code> 같은 사람이 읽기 쉬운 ID로
              식별합니다. 싱글톤 인스턴스{" "}
              <code className="text-cyan-600">backgroundProcessManager</code>가 전역으로 제공됩니다.
            </p>

            {/* start */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">start(command, cwd)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              셸 명령을 백그라운드에서 시작합니다. detached 모드로 실행되어 부모 프로세스와
              독립적으로 동작합니다.
            </p>
            <CodeBlock>
              <span className="fn">start</span>(<span className="prop">command</span>:{" "}
              <span className="type">string</span>, <span className="prop">cwd</span>:{" "}
              <span className="type">string</span>): {"{"}
              {"\n"}
              {"  "}
              <span className="prop">pid</span>: <span className="type">number</span>;{"\n"}
              {"  "}
              <span className="prop">processId</span>: <span className="type">string</span>;{"\n"}
              {"  "}
              <span className="prop">outputFile</span>: <span className="type">string</span>;{"\n"}
              {"}"}
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "command",
                  type: "string",
                  required: true,
                  desc: '실행할 셸 명령어 (예: "npm run dev")',
                },
                { name: "cwd", type: "string", required: true, desc: "작업 디렉토리 경로" },
              ]}
            />

            {/* getStatus */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getStatus(idOrPid)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              프로세스의 현재 상태를 조회합니다. 프로세스 ID(
              <code className="text-cyan-600">&quot;bg-1&quot;</code>)나 숫자 PID 모두 사용할 수
              있습니다.
            </p>
            <CodeBlock>
              <span className="fn">getStatus</span>(<span className="prop">idOrPid</span>:{" "}
              <span className="type">string</span> | <span className="type">number</span>):{" "}
              <span className="type">BackgroundProcessStatus</span> |{" "}
              <span className="type">undefined</span>
            </CodeBlock>

            {/* getOutput */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getOutput(idOrPid)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              프로세스의 전체 출력을 반환합니다. 출력 파일의 전체 내용을 읽어옵니다.
            </p>
            <CodeBlock>
              <span className="fn">getOutput</span>(<span className="prop">idOrPid</span>:{" "}
              <span className="type">string</span> | <span className="type">number</span>):{" "}
              <span className="type">string</span>
            </CodeBlock>

            {/* getIncrementalOutput */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              getIncrementalOutput(idOrPid)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              마지막으로 읽은 위치 이후의 새 출력만 반환합니다 (증분 읽기). LLM이 이미 본 출력을
              중복 수신하지 않도록 바이트 오프셋을 추적합니다.
            </p>
            <CodeBlock>
              <span className="fn">getIncrementalOutput</span>(<span className="prop">idOrPid</span>
              : <span className="type">string</span> | <span className="type">number</span>): {"{"}
              {"\n"}
              {"  "}
              <span className="prop">output</span>: <span className="type">string</span>;{"\n"}
              {"  "}
              <span className="prop">running</span>: <span className="type">boolean</span>;{"\n"}
              {"  "}
              <span className="prop">exitCode</span>: <span className="type">number</span> |{" "}
              <span className="type">null</span>;{"\n"}
              {"}"}
            </CodeBlock>

            {/* kill */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">kill(idOrPid, signal?)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              프로세스에 시그널을 보내 종료합니다. 프로세스 그룹(-pid)에 먼저 시도하고, 실패하면
              개별 프로세스에 직접 시그널을 보냅니다.
            </p>
            <CodeBlock>
              <span className="fn">kill</span>(<span className="prop">idOrPid</span>:{" "}
              <span className="type">string</span> | <span className="type">number</span>,{" "}
              <span className="prop">signal</span>?: <span className="type">NodeJS.Signals</span>):{" "}
              <span className="type">boolean</span>
              {"\n"}
              <span className="cm">// 기본 signal: &quot;SIGTERM&quot; (정상 종료 요청)</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "idOrPid",
                  type: "string | number",
                  required: true,
                  desc: '프로세스 ID ("bg-1") 또는 숫자 PID',
                },
                {
                  name: "signal",
                  type: "NodeJS.Signals",
                  required: false,
                  desc: "보낼 시그널 (기본값: SIGTERM)",
                },
              ]}
            />

            {/* list */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">list()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              추적 중인 모든 백그라운드 프로세스 목록을 반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">list</span>(): <span className="type">readonly</span>{" "}
              <span className="type">BackgroundProcessInfo</span>[]
            </CodeBlock>

            {/* cleanup */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">cleanup()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              모든 실행 중인 백그라운드 프로세스에 SIGTERM을 보내 종료합니다. 애플리케이션 종료 시
              정리(cleanup)에 사용됩니다.
            </p>
            <CodeBlock>
              <span className="fn">cleanup</span>(): <span className="type">void</span>
            </CodeBlock>

            {/* Key constants */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              주요 상수
            </h3>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">MAX_TOOL_RETRIES</span> ={" "}
              <span className="num">1</span>;{"\n"}
              <span className="cm">// 일시적 에러 발생 시 최대 재시도 횟수</span>
              {"\n"}
              {"\n"}
              <span className="cm">// 재시도 대상 에러 코드 (isTransientError):</span>
              {"\n"}
              <span className="cm">// ECONNRESET — 연결이 강제로 끊김</span>
              {"\n"}
              <span className="cm">// ETIMEDOUT — 연결 시간 초과</span>
              {"\n"}
              <span className="cm">// ENOTFOUND — DNS 조회 실패</span>
              {"\n"}
              <span className="cm">// EPIPE — 파이프가 깨짐</span>
              {"\n"}
              <span className="cm">// EAI_AGAIN — DNS 조회 일시적 실패</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">MAX_TOOL_RETRIES = 1</code>이므로 최대 2번
                실행됩니다 (최초 1회 + 재시도 1회). 일시적 에러가 아닌 경우에는 재시도 없이 즉시
                실패합니다.
              </li>
              <li>
                <code className="text-cyan-600">executeTool()</code>은 예외를 throw하지 않습니다.
                모든 에러를{" "}
                <code className="text-cyan-600">{'{ output: "...", isError: true }'}</code> 형태로
                반환합니다.
              </li>
              <li>
                타임아웃은 도구별 <code className="text-cyan-600">tool.timeoutMs</code>가 우선이고,
                없으면 <code className="text-cyan-600">TOOL_TIMEOUTS.default</code>가 사용됩니다.
              </li>
              <li>
                인수 자동 교정(<code className="text-cyan-600">correctToolCall</code>)은
                <code className="text-cyan-600">capabilityTier</code>가 기본값{" "}
                <code className="text-cyan-600">&quot;high&quot;</code>이면 최소한의 교정만
                수행합니다. 저성능 모델일수록 더 적극적으로 교정합니다.
              </li>
              <li>
                <code className="text-cyan-600">BackgroundProcessManager</code>의 프로세스는
                <code className="text-cyan-600">detached + unref()</code>로 실행되어 부모
                프로세스(dbcode)가 종료되어도 계속 실행됩니다. 반드시{" "}
                <code className="text-cyan-600">cleanup()</code>으로 정리하세요.
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
              기본 사용법 &mdash; 에이전트 루프에서 도구 실행
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              가장 일반적인 사용 패턴입니다. 에이전트 루프가 LLM 응답에서 도구 호출을 추출하면,
              <code className="text-cyan-600">executeToolCall()</code>로 실행합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. LLM 응답에서 도구 호출 추출"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">toolCalls</span> ={" "}
              <span className="fn">extractToolCalls</span>(<span className="prop">response</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 각 도구 호출을 순차 실행"}</span>
              {"\n"}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">call</span> <span className="kw">of</span>{" "}
              <span className="prop">toolCalls</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">executeToolCall</span>(
              <span className="prop">registry</span>, <span className="prop">call</span>, {"{"}
              {"\n"}
              {"    "}
              <span className="prop">workingDirectory</span>: <span className="prop">cwd</span>,
              {"\n"}
              {"    "}
              <span className="prop">signal</span>: <span className="prop">abortController</span>.
              <span className="prop">signal</span>,{"\n"}
              {"    "}
              <span className="prop">capabilityTier</span>:{" "}
              <span className="str">&quot;high&quot;</span>,{"\n"}
              {"  "}
              {"}"});
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// 3. 결과를 대화 이력에 추가"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">result</span>.
              <span className="prop">isError</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="fn">logger</span>.<span className="fn">warn</span>(
              <span className="str">`도구 실패: ${"{"}</span>
              <span className="prop">result</span>.<span className="prop">output</span>
              <span className="str">{"}"}`</span>);
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"  "}
              <span className="prop">messages</span>.<span className="fn">push</span>(
              <span className="fn">toolResultMessage</span>(<span className="prop">result</span>));
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>executeToolCall()</code>은 예외를 throw하지 않고 항상{" "}
              <code>ToolCallResult</code>를 반환합니다. 에러 발생 시 <code>isError: true</code>를
              확인하여 처리하세요. try-catch로 감싸도 에러가 잡히지 않습니다.
            </Callout>

            {/* 고급: AbortSignal 연쇄 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; AbortSignal 연쇄와 타임아웃
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">executeTool()</code>은 내부적으로 독립
              AbortController를 생성하고, 부모의 signal과 타임아웃을 모두 연결합니다. 사용자가 Esc를
              누르거나 타임아웃이 발생하면 도구 실행이 안전하게 취소됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// AbortSignal 연쇄 구조"}</span>
              {"\n"}
              <span className="cm">{"// 부모 AbortController (에이전트 루프)"}</span>
              {"\n"}
              <span className="cm">{"//   └─ 자식 AbortController (executeTool 내부)"}</span>
              {"\n"}
              <span className="cm">{"//       ├─ 부모 signal 이벤트 리스너"}</span>
              {"\n"}
              <span className="cm">{"//       └─ setTimeout (타임아웃)"}</span>
              {"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">parentController</span> ={" "}
              <span className="kw">new</span> <span className="fn">AbortController</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 사용자가 Esc를 누르면 부모 → 자식으로 취소가 전파됨"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">executeTool</span>(
              <span className="prop">tool</span>, <span className="prop">args</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">signal</span>: <span className="prop">parentController</span>.
              <span className="prop">signal</span>,{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 타임아웃 발생 시 결과:"}</span>
              {"\n"}
              <span className="cm">
                {"// { output: 'Tool \"bash\" timed out after 30000ms', isError: true }"}
              </span>
            </CodeBlock>

            {/* 고급: 백그라운드 프로세스 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 백그라운드 프로세스 관리
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">BackgroundProcessManager</code>로 장시간 실행 명령을
              비동기적으로 관리합니다. 프로세스 시작, 출력 확인, 종료를 독립적으로 수행할 수
              있습니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"}{" "}
              <span className="prop">backgroundProcessManager</span> {"}"}{" "}
              <span className="kw">from</span>{" "}
              <span className="str">&quot;./executor.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 1. 프로세스 시작"}</span>
              {"\n"}
              <span className="kw">const</span> {"{"} <span className="prop">pid</span>,{" "}
              <span className="prop">processId</span>, <span className="prop">outputFile</span>{" "}
              {"}"} ={"\n"}
              {"  "}
              <span className="prop">backgroundProcessManager</span>.
              <span className="fn">start</span>(<span className="str">&quot;npm run dev&quot;</span>
              , <span className="str">&quot;/project&quot;</span>);
              {"\n"}
              <span className="cm">{'// processId = "bg-1", pid = 12345'}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 새 출력만 확인 (증분 읽기)"}</span>
              {"\n"}
              <span className="kw">const</span> {"{"} <span className="prop">output</span>,{" "}
              <span className="prop">running</span> {"}"} ={"\n"}
              {"  "}
              <span className="prop">backgroundProcessManager</span>.
              <span className="fn">getIncrementalOutput</span>(
              <span className="str">&quot;bg-1&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. 프로세스 종료"}</span>
              {"\n"}
              <span className="prop">backgroundProcessManager</span>.
              <span className="fn">kill</span>(<span className="str">&quot;bg-1&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 4. 앱 종료 시 전체 정리"}</span>
              {"\n"}
              <span className="prop">backgroundProcessManager</span>.
              <span className="fn">cleanup</span>();
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>getIncrementalOutput()</code>은 마지막 읽기 이후 추가된
              출력만 반환합니다. 반복 호출해도 같은 내용이 중복되지 않으므로, LLM에게 새 출력만
              효율적으로 전달할 수 있습니다.
            </Callout>

            <DeepDive title="프로세스 그룹 종료 (-pid)의 이해">
              <p className="mb-3">
                <code className="text-cyan-600">kill()</code> 메서드는 먼저{" "}
                <code className="text-cyan-600">process.kill(-pid, signal)</code>을 호출합니다. 음수
                PID는 &quot;해당 PID의 프로세스 그룹 전체&quot;를 의미합니다.
              </p>
              <p className="mb-3">
                예를 들어 <code className="text-cyan-600">npm run dev</code>를 실행하면 npm
                프로세스가 내부적으로 webpack이나 vite 같은 자식 프로세스를 추가로 실행합니다. 개별
                프로세스만 종료하면 자식들이 좀비 프로세스로 남을 수 있습니다.
              </p>
              <p className="text-gray-600">
                프로세스 그룹 시그널이 실패하면(권한 문제 등) 개별 프로세스에 직접 시그널을 보내는
                폴백(fallback) 로직이 있습니다.
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
              도구 실행 파이프라인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">executeTool()</code>의 전체 실행 흐름입니다. 인수가
              교정과 검증을 거친 후 실행되며, 에러 유형에 따라 재시도 또는 즉시 실패합니다.
            </p>

            <MermaidDiagram
              title="executeTool 실행 파이프라인"
              titleColor="purple"
              chart={`graph TD
  START(("시작")) --> ABORT["AbortSignal 연결<br/><small>부모 취소 신호 구독</small>"]
  ABORT --> TIMEOUT["타임아웃 설정<br/><small>도구별 제한 시간 적용</small>"]
  TIMEOUT --> CORRECT["인수 교정<br/><small>경로 교정 + 타입 변환</small>"]
  CORRECT --> ZOD["Zod 검증<br/><small>스키마 기반 인수 검증</small>"]

  ZOD --> EXEC["도구 실행<br/><small>tool.execute() 호출</small>"]
  EXEC -->|"정상 완료"| SUCCESS["성공<br/><small>결과 반환 준비</small>"]
  EXEC -->|"예외 발생"| JUDGE{"에러 판별<br/><small>재시도 가능 여부 확인</small>"}

  JUDGE -->|"일시적 에러 +\\n재시도 남음"| BACKOFF["대기 후 재시도<br/><small>1초 × (attempt+1) 대기</small>"]
  BACKOFF --> EXEC

  JUDGE -->|"비일시적 에러 or\\n재시도 소진"| FAIL["실패 반환<br/><small>에러 결과 생성</small>"]
  JUDGE -->|"AbortSignal\\n활성화"| TIMEOUT_ERR["타임아웃 에러<br/><small>시간 초과 결과 생성</small>"]

  SUCCESS --> CLEANUP["타이머 정리<br/><small>리소스 해제 후 반환</small>"]
  FAIL --> CLEANUP
  TIMEOUT_ERR --> CLEANUP
  CLEANUP --> END(("종료"))

  style SUCCESS fill:#dcfce7,stroke:#10b981,color:#065f46
  style FAIL fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style TIMEOUT_ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style EXEC fill:#dbeafe,stroke:#3b82f6,color:#1e40af
  style BACKOFF fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style ZOD fill:#ede9fe,stroke:#8b5cf6,color:#5b21b6`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석 &mdash; 재시도 루프
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">executeTool()</code> 내부의 재시도 로직입니다. 일시적
              네트워크 에러만 재시도하고, 그 외 에러는 즉시 throw합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 재시도 루프 — 최대 MAX_TOOL_RETRIES(1)회 재시도"}</span>
              {"\n"}
              <span className="kw">let</span> <span className="prop">lastError</span>:{" "}
              <span className="type">unknown</span>;{"\n"}
              <span className="kw">for</span> (<span className="kw">let</span>{" "}
              <span className="prop">attempt</span> = <span className="num">0</span>;{" "}
              <span className="prop">attempt</span> {"<="}{" "}
              <span className="prop">MAX_TOOL_RETRIES</span>; <span className="prop">attempt</span>
              ++) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [1] 도구 실행 시도"}</span>
              {"\n"}
              {"    "}
              <span className="kw">return await</span> <span className="prop">tool</span>.
              <span className="fn">execute</span>(<span className="prop">validatedArgs</span>,{" "}
              <span className="prop">context</span>);
              {"\n"}
              {"  "}
              <span className="kw">{"}"} catch</span> (<span className="prop">execError</span>){" "}
              {"{"}
              {"\n"}
              {"    "}
              <span className="prop">lastError</span> = <span className="prop">execError</span>;
              {"\n"}
              {"    "}
              <span className="cm">{"// [2] 일시적 에러이고 재시도 가능하면 대기 후 재시도"}</span>
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">attempt</span> {"<"}{" "}
              <span className="prop">MAX_TOOL_RETRIES</span> &&{" "}
              <span className="fn">isTransientError</span>(<span className="prop">execError</span>)){" "}
              {"{"}
              {"\n"}
              {"      "}
              <span className="cm">{"// [3] 지수 백오프: 1초, 2초, ..."}</span>
              {"\n"}
              {"      "}
              <span className="kw">await new</span> <span className="fn">Promise</span>(
              <span className="prop">r</span> ={">"} <span className="fn">setTimeout</span>(
              <span className="prop">r</span>, <span className="num">1000</span> * (
              <span className="prop">attempt</span> + <span className="num">1</span>)));
              {"\n"}
              {"      "}
              <span className="kw">continue</span>;{"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [4] 비일시적 에러 또는 재시도 소진 → 즉시 throw"}</span>
              {"\n"}
              {"    "}
              <span className="kw">throw</span> <span className="prop">execError</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 교정 및 검증이 완료된 인수와
                컨텍스트로 도구를 실행합니다. 성공하면 즉시 결과를 반환합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong>{" "}
                <code className="text-cyan-600">isTransientError()</code>는 에러 메시지에
                ECONNRESET, ETIMEDOUT, ENOTFOUND, EPIPE, EAI_AGAIN이 포함되어 있는지 정규식으로
                검사합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 지수 백오프(exponential backoff)
                &mdash; 재시도 간격이 attempt에 비례하여 증가합니다. 첫 재시도는 1초, 두 번째는 2초
                대기합니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> Zod 검증 에러, 권한 에러, 파일 시스템
                에러 등 재시도해도 해결되지 않는 에러는 즉시 실패합니다. 외부 catch 블록에서 에러
                결과로 변환됩니다.
              </p>
            </div>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              증분 읽기 (Incremental Read) 메커니즘
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">getIncrementalOutput()</code>은 저수준 파일 I/O를
              사용하여 정확한 바이트 오프셋부터 새 데이터만 읽습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 파일 크기 확인"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">totalBytes</span> ={" "}
              <span className="fn">statSync</span>(<span className="prop">outputFile</span>).
              <span className="prop">size</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 2. 새 데이터가 없으면 빈 문자열 반환"}</span>
              {"\n"}
              <span className="kw">if</span> (<span className="prop">totalBytes</span> {"<="}{" "}
              <span className="prop">lastReadOffset</span>) <span className="kw">return</span>{" "}
              <span className="str">&quot;&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 3. 마지막 읽은 위치부터 새 데이터만 읽기"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">fd</span> ={" "}
              <span className="fn">openSync</span>(<span className="prop">outputFile</span>,{" "}
              <span className="str">&quot;r&quot;</span>);
              {"\n"}
              <span className="kw">const</span> <span className="prop">buffer</span> ={" "}
              <span className="fn">Buffer.alloc</span>(<span className="prop">totalBytes</span> -{" "}
              <span className="prop">lastReadOffset</span>);
              {"\n"}
              <span className="fn">readSync</span>(<span className="prop">fd</span>,{" "}
              <span className="prop">buffer</span>, <span className="num">0</span>,{" "}
              <span className="prop">buffer</span>.<span className="prop">length</span>,{" "}
              <span className="prop">lastReadOffset</span>);
              {"\n"}
              <span className="fn">closeSync</span>(<span className="prop">fd</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 4. 오프셋 업데이트 → 다음 호출에서 중복 방지"}</span>
              {"\n"}
              <span className="prop">lastReadOffset</span> ={" "}
              <span className="prop">totalBytes</span>;
            </CodeBlock>

            <DeepDive title="왜 readFileSync 대신 저수준 I/O를 사용하나요?">
              <p className="mb-3">
                <code className="text-cyan-600">readFileSync()</code>는 파일 전체를 읽어야 합니다.
                백그라운드 프로세스의 출력 파일은 계속 커지기 때문에, 매번 전체를 읽으면 메모리와
                시간이 낭비됩니다.
              </p>
              <p className="mb-3">
                <code className="text-cyan-600">openSync + readSync</code>는 특정 바이트 오프셋부터
                원하는 만큼만 정확히 읽을 수 있습니다. 이렇게 하면 10MB 로그 파일에서 마지막
                100바이트만 효율적으로 읽을 수 있습니다.
              </p>
              <p className="text-gray-600">
                참고: <code className="text-cyan-600">getOutput()</code>은 전체 출력이 필요한 경우를
                위해
                <code className="text-cyan-600">readFileSync()</code>를 사용합니다. 용도에 따라 두
                메서드를 구분하여 사용하세요.
              </p>
            </DeepDive>
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
                &quot;Tool &apos;xyz&apos; timed out after 30000ms 에러가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                도구 실행이 지정된 타임아웃 시간 내에 완료되지 않았습니다. 두 가지 해결 방법이
                있습니다:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>도구 정의의 timeoutMs 증가:</strong> 해당 도구의{" "}
                  <code className="text-cyan-600">ToolDefinition</code>에서
                  <code className="text-cyan-600">timeoutMs</code> 값을 늘려주세요.
                </li>
                <li>
                  <strong>장시간 명령은 백그라운드로:</strong>{" "}
                  <code className="text-cyan-600">npm run dev</code>처럼 오래 걸리는 명령은{" "}
                  <code className="text-cyan-600">BackgroundProcessManager</code>를 사용하여
                  백그라운드에서 실행하세요.
                </li>
              </ul>
              <Callout type="tip" icon="*">
                타임아웃은 도구별 <code>tool.timeoutMs</code> → 전역{" "}
                <code>TOOL_TIMEOUTS.default</code> 순으로 적용됩니다. 전역 기본값은{" "}
                <code>constants.ts</code>에서 확인하세요.
              </Callout>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Unknown tool: xxx 에러가 계속 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                LLM이 존재하지 않는 도구 이름을 호출한 것입니다. 이는 LLM의
                &quot;환각(hallucination)&quot;에 해당합니다.
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  시스템 프롬프트에 사용 가능한 도구 목록이 정확히 포함되어 있는지 확인하세요.
                </li>
                <li>
                  도구 이름의 대소문자가 정확한지 확인하세요. 레지스트리는 정확한 문자열 매칭을
                  합니다.
                </li>
                <li>
                  MCP 도구가 아직 로드되지 않은 상태에서 호출된 것일 수 있습니다. MCP 서버 연결
                  상태를 확인하세요.
                </li>
              </ul>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;저성능 모델에서 도구 인수 에러가 자주 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">capabilityTier</code> 설정을 확인하세요.
                <code className="text-cyan-600">executeTool()</code>에
                <code className="text-cyan-600">capabilityTier</code>를 전달하면
                <code className="text-cyan-600">correctToolCall()</code>이 더 적극적으로 인수를
                교정합니다.
              </p>
              <CodeBlock>
                <span className="cm">{"// capabilityTier를 모델에 맞게 설정"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">result</span> ={" "}
                <span className="kw">await</span> <span className="fn">executeTool</span>(
                <span className="prop">tool</span>, <span className="prop">args</span>, {"{"}
                {"\n"}
                {"  "}
                <span className="prop">capabilityTier</span>:{" "}
                <span className="str">&quot;low&quot;</span>,{" "}
                <span className="cm">{"// 저성능 모델 → 적극적 교정"}</span>
                {"\n"}
                {"}"});
              </CodeBlock>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;백그라운드 프로세스가 앱 종료 후에도 계속 실행돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">detached + unref()</code> 모드로 실행되므로 의도된
                동작입니다. 앱 종료 전에 반드시 <code className="text-cyan-600">cleanup()</code>을
                호출하세요.
              </p>
              <CodeBlock>
                <span className="cm">{"// 앱 종료 시 정리"}</span>
                {"\n"}
                <span className="prop">process</span>.<span className="fn">on</span>(
                <span className="str">&quot;exit&quot;</span>, () ={">"} {"{"}
                {"\n"}
                {"  "}
                <span className="prop">backgroundProcessManager</span>.
                <span className="fn">cleanup</span>();
                {"\n"}
                {"}"});
              </CodeBlock>
              <p className="text-[13px] text-gray-600 leading-relaxed mt-3">
                이미 좀비 프로세스가 남아있다면 <code className="text-cyan-600">list()</code>로
                PID를 확인하고 터미널에서 <code className="text-cyan-600">kill {"{pid}"}</code>로
                수동 종료하세요.
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
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "executeToolCall()을 호출하여 LLM이 요청한 도구를 실행하는 메인 에이전트 루프",
                },
                {
                  name: "tool-registry.ts",
                  slug: "tool-registry",
                  relation: "sibling",
                  desc: "도구 정의를 등록하고 이름으로 조회하는 레지스트리 — executeToolCall이 내부적으로 사용",
                },
                {
                  name: "permission-manager.ts",
                  slug: "permission-manager",
                  relation: "sibling",
                  desc: "도구 실행 전 사용자 권한을 확인하는 5-mode 권한 관리 시스템",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
