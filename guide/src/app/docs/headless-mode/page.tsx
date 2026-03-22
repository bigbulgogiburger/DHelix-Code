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

export default function HeadlessModePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/cli/headless.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Headless Mode
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="cli" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            Ink UI 없이 프롬프트를 직접 에이전트에 전달하는 비대화형 실행 모드입니다.
            CI/CD 파이프라인, 스크립트 자동화, 다른 프로그램과의 파이프 연결에 최적화되어 있습니다.
          </p>
        </div>
      </RevealOnScroll>

      {/* ─── 1. 개요 (Overview) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📋</span> 개요
          </h2>
          <div className="text-[14px] text-gray-600 leading-[1.85] mb-8 space-y-3">
            <p>
              <code className="text-cyan-600">runHeadless()</code>는 <code className="text-cyan-600">dbcode -p &quot;질문&quot;</code>
              처럼 <code className="text-cyan-600">-p</code> 플래그로 실행할 때 호출됩니다.
              Ink 터미널 UI를 띄우지 않고, 프롬프트를 에이전트 루프에 직접 전달하여
              결과를 stdout으로 출력합니다.
            </p>
            <p>
              세 가지 출력 형식을 지원합니다: <code className="text-cyan-600">&quot;text&quot;</code>(기본값, 일반 텍스트),
              <code className="text-cyan-600">&quot;json&quot;</code>(구조화된 JSON),
              <code className="text-cyan-600">&quot;stream-json&quot;</code>(NDJSON &mdash; 줄 단위 JSON 스트리밍).
              이를 통해 다른 프로그램이 dbcode의 출력을 파싱하기 쉽습니다.
            </p>
            <p>
              <strong>HeadlessGuard</strong> 안정성 기능이 내장되어 있어, 에러 발생 시 stderr 출력과
              적절한 exit code를 보장하고, 빈 응답을 자동으로 재시도하며, ask_user 호출에
              합리적인 기본 응답을 자동으로 제공합니다.
            </p>
          </div>

          <MermaidDiagram
            title="Headless Mode 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  CLI["dbcode -p 'prompt'<br/><small>CLI 진입점</small>"]
  HL["runHeadless()<br/><small>headless.ts</small>"]
  INST["Instruction Loader<br/><small>DBCODE.md 로드</small>"]
  MEM["MemoryManager<br/><small>자동 메모리 로드</small>"]
  SPB["System Prompt Builder<br/><small>시스템 프롬프트 구성</small>"]
  AL["runAgentLoop()<br/><small>에이전트 루프 실행</small>"]
  OUT["stdout / stderr<br/><small>결과 출력</small>"]

  CLI -->|"-p flag"| HL
  HL --> INST
  HL --> MEM
  HL --> SPB
  SPB --> AL
  AL -->|"결과"| HL
  HL -->|"outputFormat"| OUT

  style HL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CLI fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style INST fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style MEM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SPB fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style AL fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style OUT fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px`}
          />

          <Callout type="info" icon="💡">
            <strong>App.tsx와의 차이:</strong> 대화형 모드에서는 <code>App.tsx</code>가 Ink UI를 렌더링하지만,
            헤드리스 모드에서는 <code>runHeadless()</code>가 에이전트 루프를 직접 호출합니다.
            두 경로 모두 같은 <code>runAgentLoop()</code>를 사용하므로 결과는 동일합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* HeadlessOutputFormat type */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            type HeadlessOutputFormat
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            헤드리스 모드에서 지원하는 세 가지 출력 형식입니다.
          </p>
          <CodeBlock>
            <span className="kw">type</span> <span className="type">HeadlessOutputFormat</span> = <span className="str">&quot;text&quot;</span> | <span className="str">&quot;json&quot;</span> | <span className="str">&quot;stream-json&quot;</span>;
          </CodeBlock>
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <code className="text-emerald-600">&quot;text&quot;</code> &mdash; 기본값. 마지막 어시스턴트 응답을 일반 텍스트로 출력합니다.</p>
            <p>&bull; <code className="text-blue-600">&quot;json&quot;</code> &mdash; 결과를 구조화된 JSON 객체로 출력합니다 (result, model, iterations, aborted 필드 포함).</p>
            <p>&bull; <code className="text-purple-600">&quot;stream-json&quot;</code> &mdash; NDJSON(Newline Delimited JSON) 형식으로 이벤트를 실시간 스트리밍합니다.</p>
          </div>

          {/* HeadlessOptions interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface HeadlessOptions
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            헤드리스 실행에 필요한 옵션을 정의합니다. 모든 필드는 <code className="text-cyan-600">readonly</code>입니다.
          </p>
          <ParamTable
            params={[
              { name: "prompt", type: "string", required: true, desc: "사용자가 입력한 프롬프트 문자열" },
              { name: "client", type: "LLMProvider", required: true, desc: "LLM API와 통신하는 프로바이더" },
              { name: "model", type: "string", required: true, desc: "사용할 모델명 (예: gpt-4o)" },
              { name: "strategy", type: "ToolCallStrategy", required: true, desc: "도구 호출 전략" },
              { name: "toolRegistry", type: "ToolRegistry", required: true, desc: "사용 가능한 도구 레지스트리" },
              { name: "outputFormat", type: "HeadlessOutputFormat", required: true, desc: "출력 형식 (text, json, stream-json)" },
              { name: "workingDirectory", type: "string", required: false, desc: "작업 디렉토리 경로 (기본값: process.cwd())" },
              { name: "maxIterations", type: "number", required: false, desc: "에이전트 루프 최대 반복 횟수" },
            ]}
          />

          {/* HeadlessJsonOutput interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface HeadlessJsonOutput
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            JSON 형식 출력의 구조체입니다. <code className="text-cyan-600">&quot;json&quot;</code> 또는
            에러 시 사용됩니다.
          </p>
          <ParamTable
            params={[
              { name: "result", type: "string", required: true, desc: "마지막 어시스턴트 응답 텍스트 (에러 시 빈 문자열)" },
              { name: "model", type: "string", required: true, desc: "사용된 모델명" },
              { name: "iterations", type: "number", required: true, desc: "에이전트 루프 실행 횟수" },
              { name: "aborted", type: "boolean", required: true, desc: "루프가 중단되었는지 여부" },
              { name: "error", type: "string", required: false, desc: "에러 메시지 (에러 발생 시에만 포함)" },
            ]}
          />

          {/* runHeadless function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            async function runHeadless()
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            헤드리스 모드의 메인 함수입니다. 시스템 프롬프트를 구성하고, 에이전트 루프를 실행한 뒤,
            결과를 outputFormat에 맞게 stdout에 출력합니다.
          </p>
          <CodeBlock>
            <span className="kw">export async function</span> <span className="fn">runHeadless</span>(<span className="prop">options</span>: <span className="type">HeadlessOptions</span>): <span className="type">Promise&lt;void&gt;</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              헤드리스 모드에서는 사용자 입력을 받을 수 없으므로, <code className="text-cyan-600">ask_user</code> 도구 호출에
              자동 응답이 제공됩니다. 선택지가 있으면 첫 번째 항목이 자동 선택됩니다.
            </li>
            <li>
              빈 응답 감지 시 최대 <code className="text-cyan-600">MAX_EMPTY_RESPONSE_RETRIES = 2</code>회까지
              자동 재시도합니다. 재시도 시 이전 대화 컨텍스트를 유지합니다.
            </li>
            <li>
              에이전트 루프 자체가 실패하면 <code className="text-cyan-600">process.exitCode = 1</code>로 설정되고,
              에러 정보가 stderr(text 모드) 또는 stdout(json/stream-json 모드)에 출력됩니다.
            </li>
            <li>
              시스템 프롬프트에 <code className="text-cyan-600">isHeadless: true</code>가 전달되어,
              LLM이 비대화형 환경임을 인지하고 적절히 동작합니다.
            </li>
          </ul>
        </section>
      </RevealOnScroll>

      {/* ─── 3. 사용법 (Usage) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🚀</span> 사용법
          </h2>

          {/* 기본 사용법 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; CLI에서 직접 실행</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">-p</code> 플래그로 프롬프트를 전달하면 자동으로 헤드리스 모드가 활성화됩니다.
          </p>
          <CodeBlock>
            <span className="cm">{"# 기본 (text 출력)"}</span>
            {"\n"}dbcode -p <span className="str">&quot;이 프로젝트의 구조를 설명해줘&quot;</span>
            {"\n"}
            {"\n"}<span className="cm">{"# JSON 출력"}</span>
            {"\n"}dbcode -p <span className="str">&quot;package.json 분석해줘&quot;</span> --format json
            {"\n"}
            {"\n"}<span className="cm">{"# NDJSON 스트리밍"}</span>
            {"\n"}dbcode -p <span className="str">&quot;코드 리뷰해줘&quot;</span> --format stream-json
          </CodeBlock>

          {/* 파이프라인 사용법 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            파이프라인 &mdash; 다른 프로그램과 연결
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            stdout 출력을 다른 프로그램에 파이프할 수 있습니다.
            JSON 형식은 <code className="text-cyan-600">jq</code>와 궁합이 좋습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"# jq로 결과만 추출"}</span>
            {"\n"}dbcode -p <span className="str">&quot;요약해줘&quot;</span> --format json | jq -r <span className="str">&apos;.result&apos;</span>
            {"\n"}
            {"\n"}<span className="cm">{"# CI/CD에서 코드 리뷰 자동화"}</span>
            {"\n"}dbcode -p <span className="str">&quot;git diff를 분석하고 문제점을 찾아줘&quot;</span> {">"} review.txt
            {"\n"}
            {"\n"}<span className="cm">{"# stream-json으로 실시간 모니터링"}</span>
            {"\n"}dbcode -p <span className="str">&quot;테스트 작성해줘&quot;</span> --format stream-json | \
            {"\n"}{"  "}while read line; do echo <span className="str">&quot;$line&quot;</span> | jq <span className="str">&apos;.type&apos;</span>; done
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> 헤드리스 모드에서는 <code>ask_user</code> 도구 호출에 자동 응답이 제공됩니다.
            LLM이 사용자 확인이 필요한 위험한 작업(파일 삭제 등)을 요청해도 자동으로 진행되므로,
            프롬프트를 신중하게 작성하세요. 필요하면 <code>--max-iterations</code>으로 반복 횟수를 제한하세요.
          </Callout>

          {/* stream-json 이벤트 타입 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            stream-json 이벤트 타입
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">&quot;stream-json&quot;</code> 형식에서 출력되는 NDJSON 이벤트 타입입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// LLM 텍스트 스트리밍"}</span>
            {"\n"}{"{"}  <span className="str">&quot;type&quot;</span>: <span className="str">&quot;text-delta&quot;</span>, <span className="str">&quot;text&quot;</span>: <span className="str">&quot;안녕하세요...&quot;</span> {"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 도구 실행 시작"}</span>
            {"\n"}{"{"}  <span className="str">&quot;type&quot;</span>: <span className="str">&quot;tool-start&quot;</span>, <span className="str">&quot;name&quot;</span>: <span className="str">&quot;file_read&quot;</span>, <span className="str">&quot;id&quot;</span>: <span className="str">&quot;call_123&quot;</span> {"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 도구 실행 완료"}</span>
            {"\n"}{"{"}  <span className="str">&quot;type&quot;</span>: <span className="str">&quot;tool-complete&quot;</span>, <span className="str">&quot;name&quot;</span>: <span className="str">&quot;file_read&quot;</span>, <span className="str">&quot;id&quot;</span>: <span className="str">&quot;call_123&quot;</span>, <span className="str">&quot;isError&quot;</span>: <span className="kw">false</span> {"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// ask_user 자동 응답"}</span>
            {"\n"}{"{"}  <span className="str">&quot;type&quot;</span>: <span className="str">&quot;ask_user&quot;</span>, <span className="str">&quot;question&quot;</span>: <span className="str">&quot;...&quot;</span>, <span className="str">&quot;autoAnswer&quot;</span>: <span className="str">&quot;...&quot;</span> {"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 최종 결과"}</span>
            {"\n"}{"{"}  <span className="str">&quot;type&quot;</span>: <span className="str">&quot;result&quot;</span>, <span className="str">&quot;text&quot;</span>: <span className="str">&quot;...&quot;</span>, <span className="str">&quot;iterations&quot;</span>: <span className="num">3</span>, <span className="str">&quot;aborted&quot;</span>: <span className="kw">false</span> {"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 에러"}</span>
            {"\n"}{"{"}  <span className="str">&quot;type&quot;</span>: <span className="str">&quot;error&quot;</span>, <span className="str">&quot;error&quot;</span>: <span className="str">&quot;에러 메시지&quot;</span> {"}"}
          </CodeBlock>

          <DeepDive title="HeadlessGuard 안정성 기능 상세">
            <p className="mb-3">
              HeadlessGuard는 헤드리스 모드의 안정성을 보장하는 네 가지 방어 기능입니다:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>
                <strong>Silent exit 0 방지:</strong> 에러가 발생해도 exit code 0으로 종료되는 것을 방지합니다.
                에이전트 루프 실패 시 반드시 stderr에 에러를 출력하고 <code className="text-cyan-600">process.exitCode = 1</code>을 설정합니다.
              </li>
              <li>
                <strong>빈 응답 자동 재시도:</strong> LLM이 빈 문자열을 반환하면 최대 2회까지 재시도합니다.
                재시도 시 이전 대화 컨텍스트를 유지하고 &quot;Your previous response was empty&quot; 메시지를 추가합니다.
              </li>
              <li>
                <strong>ask_user 자동 응답:</strong> 선택지가 있으면 첫 번째 항목을, 없으면 &quot;Headless mode: proceed with
                the most reasonable default&quot; 메시지를 자동으로 응답합니다.
              </li>
              <li>
                <strong>부분 결과 출력:</strong> 에러 발생 시에도 부분적으로 생성된 결과가 있으면 출력합니다.
                완전히 실패한 경우에만 에러 출력으로 대체됩니다.
              </li>
            </ul>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>실행 흐름 상태 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">runHeadless()</code>의 실행 흐름을 단계별로 나타냅니다.
            빈 응답 시 자동 재시도 루프가 핵심 방어 로직입니다.
          </p>

          <MermaidDiagram
            title="Headless 실행 흐름"
            titleColor="purple"
            chart={`graph TD
  START(("시작")) --> LOAD["지침 + 메모리 로드<br/><small>loadInstructions + MemoryManager</small>"]
  LOAD --> BUILD["시스템 프롬프트 빌드<br/><small>buildSystemPrompt(isHeadless=true)</small>"]
  BUILD --> LOOP["에이전트 루프 실행<br/><small>runAgentLoop()</small>"]
  LOOP -->|"성공"| CHECK["빈 응답 검사<br/><small>extractLastAssistantContent()</small>"]
  LOOP -->|"에러"| ERR["에러 출력<br/><small>stderr + exitCode=1</small>"]
  CHECK -->|"응답 있음"| OUTPUT["결과 출력<br/><small>emitHeadlessOutput()</small>"]
  CHECK -->|"빈 응답"| RETRY{"재시도 가능?<br/><small>retry < 2</small>"}
  RETRY -->|"예"| LOOP
  RETRY -->|"아니오"| OUTPUT
  OUTPUT --> END(("종료"))
  ERR --> END

  style LOAD fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style BUILD fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LOOP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style CHECK fill:#fef3c7,stroke:#d97706,color:#1e293b
  style RETRY fill:#fef3c7,stroke:#d97706,color:#1e293b
  style OUTPUT fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; ask_user 자동 응답</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            헤드리스 모드에서 사용자 입력을 받을 수 없으므로,
            <code className="text-cyan-600">ask_user:prompt</code> 이벤트에 자동으로 응답합니다.
          </p>
          <CodeBlock>
            <span className="prop">events</span>.<span className="fn">on</span>(<span className="str">&quot;ask_user:prompt&quot;</span>, (<span className="prop">data</span>) =&gt; {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">answer</span> = <span className="prop">data</span>.<span className="prop">choices</span>?.<span className="prop">length</span>
            {"\n"}{"    "}? <span className="fn">String</span>(<span className="prop">data</span>.<span className="prop">choices</span>[<span className="num">0</span>])
            {"\n"}{"    "}: <span className="str">&quot;Headless mode: proceed with the most reasonable default.&quot;</span>;
            {"\n"}
            {"\n"}{"  "}<span className="prop">events</span>.<span className="fn">emit</span>(<span className="str">&quot;ask_user:response&quot;</span>, {"{"}
            {"\n"}{"    "}<span className="prop">toolCallId</span>: <span className="prop">data</span>.<span className="prop">toolCallId</span>,
            {"\n"}{"    "}<span className="prop">answer</span>,
            {"\n"}{"  "}{"}"});
            {"\n"}{"}"});
          </CodeBlock>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; 빈 응답 재시도</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            에이전트 루프가 빈 응답을 반환하면, 이전 대화 컨텍스트를 유지한 채 재시도합니다.
          </p>
          <CodeBlock>
            <span className="kw">if</span> (<span className="prop">responseText</span>.<span className="fn">trim</span>() === <span className="str">&quot;&quot;</span> && !<span className="prop">result</span>.<span className="prop">aborted</span>) {"{"}
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">let</span> <span className="prop">retry</span> = <span className="num">0</span>; <span className="prop">retry</span> &lt; <span className="num">2</span>; <span className="prop">retry</span>++) {"{"}
            {"\n"}{"    "}<span className="cm">{"// 이전 메시지에 재시도 프롬프트 추가"}</span>
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">retryMessages</span> = [
            {"\n"}{"      "}...<span className="prop">result</span>.<span className="prop">messages</span>,
            {"\n"}{"      "}{"{"} <span className="prop">role</span>: <span className="str">&quot;user&quot;</span>, <span className="prop">content</span>: <span className="str">&quot;[System] Your previous response was empty...&quot;</span> {"}"},
            {"\n"}{"    "}];
            {"\n"}{"    "}<span className="prop">result</span> = <span className="kw">await</span> <span className="fn">runAgentLoop</span>(<span className="prop">config</span>, <span className="prop">retryMessages</span>);
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">responseText</span>.<span className="fn">trim</span>() !== <span className="str">&quot;&quot;</span>) <span className="kw">break</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>
        </section>
      </RevealOnScroll>

      {/* ─── 5. 트러블슈팅 (Troubleshooting) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔧</span> 트러블슈팅
          </h2>

          {/* FAQ 1 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;헤드리스 모드에서 아무 출력도 없이 종료돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              HeadlessGuard가 빈 응답을 최대 2회까지 재시도합니다.
              그래도 빈 응답이면 빈 문자열이 출력됩니다. 다음을 확인하세요:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>API 키가 올바르게 설정되어 있는지 (<code className="text-cyan-600">OPENAI_API_KEY</code> 또는 <code className="text-cyan-600">DBCODE_API_KEY</code>)</li>
              <li>모델이 존재하고 접근 가능한지</li>
              <li>stderr에 에러 메시지가 출력되었는지 (<code className="text-cyan-600">2&gt;error.log</code>로 확인)</li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;JSON 출력에서 error 필드가 포함돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              에이전트 루프 실행 중 에러가 발생하면 <code className="text-cyan-600">HeadlessJsonOutput</code>에
              <code className="text-cyan-600">error</code> 필드가 추가됩니다. 이 경우
              <code className="text-cyan-600">aborted: true</code>, <code className="text-cyan-600">result: &quot;&quot;</code>로 설정됩니다.
              <code className="text-cyan-600">process.exitCode</code>도 1로 설정되므로 CI/CD에서 실패를 감지할 수 있습니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;ask_user 자동 응답이 부적절해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              헤드리스 모드의 ask_user 자동 응답은 최소한의 기본값만 제공합니다.
              프롬프트를 더 구체적으로 작성하여 LLM이 사용자 확인 없이도 진행할 수 있도록 하세요.
              예: &quot;src/ 폴더의 모든 .ts 파일을 포맷해줘&quot; 대신
              &quot;src/ 폴더의 모든 .ts 파일을 prettier로 포맷해줘. 확인 없이 바로 실행해&quot;
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;stream-json에서 text-delta 이벤트가 없어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">stream-json</code> 형식의 이벤트 스트리밍은
              <code className="text-cyan-600">events.on(&quot;llm:text-delta&quot;, ...)</code>에 의존합니다.
              LLM 프로바이더가 스트리밍을 지원하지 않거나, 전체 응답을 한 번에 반환하는 경우
              text-delta 이벤트가 발생하지 않을 수 있습니다. 이 경우 최종
              <code className="text-cyan-600">result</code> 이벤트만 출력됩니다.
            </p>
          </div>
        </section>
      </RevealOnScroll>

      {/* ─── 6. 관련 문서 (See Also) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔗</span> 관련 문서
          </h2>
          <SeeAlso
            items={[
              {
                name: "App.tsx",
                slug: "app-entry",
                relation: "sibling",
                desc: "대화형 모드의 루트 컴포넌트 — Ink UI를 사용하는 대안 진입점",
              },
              {
                name: "agent-loop.ts",
                slug: "agent-loop",
                relation: "child",
                desc: "헤드리스와 대화형 모드 모두에서 사용되는 핵심 에이전트 루프",
              },
              {
                name: "system-prompt-builder.ts",
                slug: "system-prompt-builder",
                relation: "child",
                desc: "isHeadless 옵션에 따라 시스템 프롬프트를 분기하여 구성",
              },
              {
                name: "memory-manager.ts",
                slug: "memory-manager",
                relation: "sibling",
                desc: "프로젝트별 자동 메모리를 로드하여 시스템 프롬프트에 포함",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
