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

export default function ToolAgentPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/tools/definitions/agent.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">agent</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
              <span className="text-sm text-gray-500">서브에이전트 스폰 도구</span>
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              독립적인 서브에이전트를 생성하여 작업을 위임하는 도구입니다. 팩토리 패턴으로 의존성을
              주입받습니다.
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
                <code className="text-cyan-600">agent</code> 도구는 메인 에이전트가 복잡한 작업을
                처리할 때 서브에이전트를 생성하여 특정 작업을 격리된 컨텍스트에서 수행하도록
                위임합니다. 세 가지 유형의 서브에이전트를 지원합니다.
              </p>
              <p>
                <code className="text-cyan-600">&quot;explore&quot;</code>는 코드베이스 조사(읽기
                위주),
                <code className="text-cyan-600">&quot;plan&quot;</code>은 구현 계획 수립,
                <code className="text-cyan-600">&quot;general&quot;</code>은 일반 작업
                실행(읽기+쓰기)입니다. 백그라운드 실행, Git 워크트리 격리, 이전 세션 재개도
                지원합니다.
              </p>
              <p>
                다른 도구들과 달리 <strong>팩토리 패턴</strong>을 사용합니다. LLM 클라이언트, 도구
                레지스트리 등 ToolContext에 포함되지 않는 의존성을 외부에서 주입받아 도구를
                생성합니다. 권한 수준은 <code className="text-amber-600">&quot;confirm&quot;</code>
                입니다.
              </p>
            </div>

            <MermaidDiagram
              title="agent 도구 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AGENT["Main Agent Loop<br/><small>agent-loop.ts</small>"]
  EXEC["Tool Executor<br/><small>tools/executor.ts</small>"]
  AT["agent 도구<br/><small>definitions/agent.ts</small>"]
  SPAWN["spawnSubagent()<br/><small>subagents/spawner.ts</small>"]
  SUB["Subagent Loop<br/><small>독립적인 에이전트 루프</small>"]
  LLM["LLM Provider<br/><small>llm/provider.ts</small>"]

  AGENT -->|"도구 호출"| EXEC
  EXEC -->|"execute()"| AT
  AT -->|"팩토리 주입"| SPAWN
  SPAWN --> SUB
  SUB --> LLM

  style AT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SPAWN fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style SUB fill:#dcfce7,stroke:#10b981,color:#065f46
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 회사에서 팀장이 팀원에게 특정 업무를 위임하는 것과 같습니다.
              &quot;explore&quot; 타입은 리서치 담당자, &quot;plan&quot;은 기획자,
              &quot;general&quot;은 실무 담당자에 해당합니다. 각 팀원은 자체 업무 루프를 실행하고
              결과를 보고합니다.
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

            {/* paramSchema */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              paramSchema (Zod)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              서브에이전트의 작업 설명, 유형, 실행 옵션을 정의하는 입력 매개변수 스키마입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "prompt",
                  type: "string",
                  required: true,
                  desc: "서브에이전트에게 전달할 작업 설명 또는 질문",
                },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: "서브에이전트 목적에 대한 간단한 설명 (UI에 표시)",
                },
                {
                  name: "subagent_type",
                  type: '"explore" | "plan" | "general"',
                  required: true,
                  desc: "서브에이전트 유형: explore(조사), plan(계획), general(실행)",
                },
                {
                  name: "run_in_background",
                  type: "boolean",
                  required: false,
                  desc: "백그라운드 실행 여부 (true이면 즉시 에이전트 ID 반환)",
                },
                {
                  name: "isolation",
                  type: '"worktree"',
                  required: false,
                  desc: "격리 모드 — Git 워크트리에서 파일 안전하게 수정",
                },
                {
                  name: "resume",
                  type: "string",
                  required: false,
                  desc: "이전 서브에이전트 ID를 전달하여 세션 재개",
                },
                {
                  name: "allowed_tools",
                  type: "string[]",
                  required: false,
                  desc: "서브에이전트가 사용할 수 있는 도구를 이 목록으로 제한",
                },
              ]}
            />

            {/* AgentToolDeps interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface AgentToolDeps
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              팩토리 함수에 주입되는 의존성 인터페이스입니다. ToolContext에 포함되지 않는 추가
              의존성을 정의합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "client",
                  type: "LLMProvider",
                  required: true,
                  desc: "LLM API 클라이언트 — 서브에이전트의 LLM 통신에 사용",
                },
                {
                  name: "model",
                  type: "string",
                  required: true,
                  desc: '사용할 LLM 모델 이름 (예: "gpt-4", "claude-3-opus")',
                },
                {
                  name: "strategy",
                  type: "ToolCallStrategy",
                  required: true,
                  desc: "LLM 응답에서 도구 호출을 추출하는 전략",
                },
                {
                  name: "toolRegistry",
                  type: "ToolRegistry",
                  required: true,
                  desc: "서브에이전트가 사용할 수 있는 도구 레지스트리",
                },
                {
                  name: "events",
                  type: "AppEventEmitter",
                  required: false,
                  desc: "부모 에이전트의 이벤트 시스템에 연결",
                },
              ]}
            />

            {/* createAgentTool factory */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              createAgentTool(deps)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              팩토리 함수 &mdash; 의존성을 주입받아 완전한{" "}
              <code className="text-cyan-600">ToolDefinition</code>을 생성합니다. 클로저로 의존성을
              캡처하여 execute 함수에서 사용합니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span>{" "}
              <span className="fn">createAgentTool</span>({"\n"}
              {"  "}
              <span className="prop">deps</span>: <span className="type">AgentToolDeps</span>,{"\n"}
              ): <span className="type">ToolDefinition</span>&lt;
              <span className="type">Params</span>&gt;
            </CodeBlock>

            {/* 반환값 metadata */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              반환 metadata
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              도구 실행 후 반환되는 <code className="text-cyan-600">ToolResult.metadata</code>에
              포함되는 정보입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "agentId",
                  type: "string",
                  required: true,
                  desc: "서브에이전트 고유 ID (재개 시 사용)",
                },
                {
                  name: "type",
                  type: "SubagentType",
                  required: true,
                  desc: "서브에이전트 유형 (explore/plan/general)",
                },
                {
                  name: "iterations",
                  type: "number",
                  required: true,
                  desc: "에이전트 루프 반복 횟수",
                },
                {
                  name: "aborted",
                  type: "boolean",
                  required: true,
                  desc: "사용자에 의해 중단되었는지 여부",
                },
                {
                  name: "workingDirectory",
                  type: "string",
                  required: true,
                  desc: "서브에이전트의 작업 디렉토리",
                },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: "서브에이전트 목적 설명",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                팩토리 패턴을 사용하므로, 도구 레지스트리에 직접 등록할 수 없습니다.
                <code className="text-cyan-600">createAgentTool(deps)</code>를 먼저 호출하여
                인스턴스를 생성한 후 등록해야 합니다.
              </li>
              <li>
                <code className="text-cyan-600">context.activeClient</code>와{" "}
                <code className="text-cyan-600">context.activeModel</code>이 있으면 팩토리 주입 시
                전달된 <code className="text-cyan-600">deps.client</code> /{" "}
                <code className="text-cyan-600">deps.model</code>
                대신 사용합니다. 이는 <code className="text-cyan-600">/model</code> 전환 시 최신
                클라이언트를 반영합니다.
              </li>
              <li>
                서브에이전트는 자체 에이전트 루프를 실행하므로, 토큰 소비가 많을 수 있습니다.
                <code className="text-cyan-600">allowed_tools</code>로 도구를 제한하면 비용을 줄일
                수 있습니다.
              </li>
              <li>
                <code className="text-cyan-600">isolation: &quot;worktree&quot;</code>를 사용하면
                Git 워크트리가 생성됩니다. 워크트리가 정리되지 않으면 디스크 공간을 차지합니다.
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
              기본 사용법 &mdash; 서브에이전트 유형별 호출
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              LLM이 복잡한 작업을 분리하여 처리할 때 서브에이전트를 생성합니다. 유형에 따라 적절한
              도구 세트와 시스템 프롬프트가 자동으로 설정됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 코드베이스 조사용 서브에이전트"}</span>
              {"\n"}
              {"{"}
              {"\n"}
              {"  "}
              <span className="prop">prompt</span>:{" "}
              <span className="str">
                &quot;src/ 디렉토리의 모듈 의존성 구조를 분석해주세요&quot;
              </span>
              ,{"\n"}
              {"  "}
              <span className="prop">description</span>:{" "}
              <span className="str">&quot;코드베이스 의존성 분석&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">subagent_type</span>:{" "}
              <span className="str">&quot;explore&quot;</span>
              {"\n"}
              {"}"}
            </CodeBlock>

            <CodeBlock>
              <span className="cm">{"// 구현 계획 수립용 서브에이전트"}</span>
              {"\n"}
              {"{"}
              {"\n"}
              {"  "}
              <span className="prop">prompt</span>:{" "}
              <span className="str">
                &quot;캐시 시스템을 Redis로 마이그레이션하는 단계별 계획을 세워주세요&quot;
              </span>
              ,{"\n"}
              {"  "}
              <span className="prop">description</span>:{" "}
              <span className="str">&quot;Redis 마이그레이션 계획&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">subagent_type</span>:{" "}
              <span className="str">&quot;plan&quot;</span>
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 서브에이전트는 자체 에이전트 루프를 실행하므로, 많은 토큰을
              소비할 수 있습니다. 간단한 작업에는 서브에이전트 대신 직접 도구를 호출하는 것이
              효율적입니다.
            </Callout>

            {/* 고급: 백그라운드 실행 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 백그라운드 실행과 워크트리 격리
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">run_in_background</code>를 사용하면 서브에이전트가
              비동기로 실행되어 메인 에이전트가 다른 작업을 계속할 수 있습니다.
              <code className="text-cyan-600">isolation: &quot;worktree&quot;</code>를 사용하면 Git
              워크트리에서 파일을 안전하게 수정할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 백그라운드 + 워크트리 격리 실행"}</span>
              {"\n"}
              {"{"}
              {"\n"}
              {"  "}
              <span className="prop">prompt</span>:{" "}
              <span className="str">&quot;테스트 파일을 리팩토링해주세요&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">description</span>:{" "}
              <span className="str">&quot;테스트 리팩토링&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">subagent_type</span>:{" "}
              <span className="str">&quot;general&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">run_in_background</span>: <span className="kw">true</span>,
              {"\n"}
              {"  "}
              <span className="prop">isolation</span>:{" "}
              <span className="str">&quot;worktree&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">allowed_tools</span>: [
              <span className="str">&quot;read_file&quot;</span>,{" "}
              <span className="str">&quot;write_file&quot;</span>,{" "}
              <span className="str">&quot;bash&quot;</span>]{"\n"}
              {"}"}
            </CodeBlock>

            <DeepDive title="팩토리 패턴의 이유">
              <p className="mb-3">
                대부분의 도구는 <code className="text-cyan-600">Params</code>와{" "}
                <code className="text-cyan-600">ToolContext</code>만으로 충분하지만, agent 도구는
                LLM 클라이언트, 전략, 레지스트리 등 추가 의존성이 필요합니다.
              </p>
              <p className="text-gray-600 mb-3">
                이 의존성들은 앱 초기화 시점에만 알 수 있으므로, 팩토리 함수로 의존성을 클로저에
                캡처하여 execute 함수에서 사용합니다:
              </p>
              <CodeBlock>
                <span className="cm">{"// 앱 초기화 시점에 도구 생성"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">agentTool</span> ={" "}
                <span className="fn">createAgentTool</span>({"{"}
                {"\n"}
                {"  "}
                <span className="prop">client</span>: <span className="prop">llmProvider</span>,
                {"\n"}
                {"  "}
                <span className="prop">model</span>:{" "}
                <span className="str">&quot;claude-3-opus&quot;</span>,{"\n"}
                {"  "}
                <span className="prop">strategy</span>:{" "}
                <span className="prop">toolCallStrategy</span>,{"\n"}
                {"  "}
                <span className="prop">toolRegistry</span>: <span className="prop">registry</span>,
                {"\n"}
                {"}"});
                {"\n"}
                {"\n"}
                <span className="cm">{"// 레지스트리에 등록"}</span>
                {"\n"}
                <span className="prop">registry</span>.<span className="fn">register</span>(
                <span className="prop">agentTool</span>);
              </CodeBlock>
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
              서브에이전트 생성 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">execute()</code> 함수는{" "}
              <code className="text-cyan-600">spawnSubagent()</code>를 호출하여 새로운 에이전트
              루프를 생성합니다.
            </p>

            <MermaidDiagram
              title="서브에이전트 생성 흐름"
              titleColor="purple"
              chart={`graph TD
  EXEC(("execute()")) --> RESOLVE["클라이언트/모델 결정<br/><small>activeClient or deps.client</small>"]
  RESOLVE --> SPAWN["spawnSubagent()<br/><small>spawner.ts</small>"]
  SPAWN --> TYPE{"subagent_type"}
  TYPE -->|"explore"| EXP["Explore Agent<br/><small>읽기 위주 도구</small>"]
  TYPE -->|"plan"| PLAN["Plan Agent<br/><small>분석+계획 도구</small>"]
  TYPE -->|"general"| GEN["General Agent<br/><small>전체 도구 세트</small>"]
  EXP --> LOOP["Agent Loop 실행"]
  PLAN --> LOOP
  GEN --> LOOP
  LOOP --> RESULT["result.response<br/><small>텍스트 결과 반환</small>"]

  style EXEC fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SPAWN fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style TYPE fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style EXP fill:#dcfce7,stroke:#10b981,color:#065f46
  style PLAN fill:#dcfce7,stroke:#10b981,color:#065f46
  style GEN fill:#dcfce7,stroke:#10b981,color:#065f46
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">execute()</code> 함수의 핵심 로직입니다. 팩토리에서
              캡처한 의존성과 ToolContext의 활성 클라이언트를 결합합니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span> <span className="fn">execute</span>(
              <span className="prop">params</span>: <span className="type">Params</span>,{" "}
              <span className="prop">context</span>: <span className="type">ToolContext</span>){" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] /model 전환 시 최신 클라이언트를 우선 사용"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">spawnSubagent</span>({"{"}
              {"\n"}
              {"    "}
              <span className="prop">type</span>: <span className="prop">params</span>.
              <span className="prop">subagent_type</span>,{"\n"}
              {"    "}
              <span className="prop">prompt</span>: <span className="prop">params</span>.
              <span className="prop">prompt</span>,{"\n"}
              {"    "}
              <span className="cm">{"// [2] activeClient가 있으면 deps.client 대신 사용"}</span>
              {"\n"}
              {"    "}
              <span className="prop">client</span>: <span className="prop">context</span>.
              <span className="prop">activeClient</span> ?? <span className="prop">deps</span>.
              <span className="prop">client</span>,{"\n"}
              {"    "}
              <span className="prop">model</span>: <span className="prop">context</span>.
              <span className="prop">activeModel</span> ?? <span className="prop">deps</span>.
              <span className="prop">model</span>,{"\n"}
              {"    "}
              <span className="cm">{"// [3] 팩토리에서 캡처한 의존성"}</span>
              {"\n"}
              {"    "}
              <span className="prop">strategy</span>: <span className="prop">deps</span>.
              <span className="prop">strategy</span>,{"\n"}
              {"    "}
              <span className="prop">toolRegistry</span>: <span className="prop">deps</span>.
              <span className="prop">toolRegistry</span>,{"\n"}
              {"    "}
              <span className="prop">signal</span>: <span className="prop">context</span>.
              <span className="prop">abortSignal</span>,{"\n"}
              {"  "}
              {"}"});
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 사용자가{" "}
                <code className="text-cyan-600">/model</code> 명령으로 모델을 전환했을 때,
                서브에이전트도 최신 모델을 사용하도록 합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong>{" "}
                <code className="text-cyan-600">context.activeClient</code>는 런타임에 동적으로
                변경될 수 있어, 팩토리 주입 시점의 클라이언트보다 우선합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> strategy, toolRegistry 등은 앱 수명
                동안 변하지 않으므로 팩토리의 클로저에서 안전하게 참조합니다.
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
                &quot;서브에이전트가 너무 많은 토큰을 소비해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                서브에이전트는 자체 에이전트 루프를 실행하므로 토큰 소비가 클 수 있습니다.
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>allowed_tools로 도구 제한:</strong> 필요한 도구만 허용하면 불필요한 도구
                  호출을 방지할 수 있습니다.
                </li>
                <li>
                  <strong>explore 타입 사용:</strong> 읽기 전용 작업에는 &quot;explore&quot; 타입을
                  사용하면 쓰기 도구가 제한되어 토큰을 절약할 수 있습니다.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;서브에이전트가 이전 모델을 사용해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">/model</code> 명령으로 모델을 전환했는데
                서브에이전트가 이전 모델을 사용한다면,
                <code className="text-cyan-600">context.activeClient</code>와{" "}
                <code className="text-cyan-600">context.activeModel</code>이 올바르게 설정되어
                있는지 확인하세요. 이 값들이 <code className="text-cyan-600">undefined</code>이면
                팩토리의 초기 값이 사용됩니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;워크트리가 정리되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">isolation: &quot;worktree&quot;</code>를 사용하면
                Git 워크트리가 생성됩니다. 서브에이전트가 비정상 종료되면 워크트리가 정리되지 않을
                수 있습니다.
                <code className="text-cyan-600">git worktree list</code>로 확인하고
                <code className="text-cyan-600">git worktree remove</code>로 수동 정리하세요.
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
                  desc: "서브에이전트가 내부적으로 실행하는 메인 에이전트 루프",
                },
                {
                  name: "tool-registry.ts",
                  slug: "tool-registry",
                  relation: "sibling",
                  desc: "agent 도구를 포함한 모든 도구를 등록하고 관리하는 레지스트리",
                },
                {
                  name: "permission-manager.ts",
                  slug: "permission-manager",
                  relation: "sibling",
                  desc: "confirm 권한 수준 도구의 실행 승인을 관리하는 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
