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

export default function SubagentSpawnerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/subagents/spawner.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Subagent Spawner</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              서브에이전트 생성 + 설정 + 실행 &mdash; 메인 에이전트가 복잡한 작업을 분할하여 별도
              에이전트에게 위임하는 핵심 모듈입니다.
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
                서브에이전트(Subagent)란 메인 에이전트가 복잡한 작업을 분할하여 별도의 에이전트에게
                위임하는 패턴입니다. 각 서브에이전트는 독립된 컨텍스트(대화 히스토리), 도구 세트,
                이벤트 발행기를 가지며, 실행이 완료되면 결과를 메인 에이전트에게 반환합니다.
              </p>
              <p>
                이 모듈은 서브에이전트 시스템의 중심입니다. 도구 필터링(허용/차단 목록), 모델
                오버라이드(sonnet/opus/haiku/inherit), 시스템 프롬프트 구성(내장 유형 또는 커스텀
                에이전트 정의) 등 서브에이전트 생성에 필요한 모든 설정을 처리합니다.
              </p>
              <p>
                고급 기능으로 백그라운드 실행, Git 워크트리 격리, 대화 이력 재개(resume), 공유
                상태를 통한 에이전트 간 통신, 그리고 병렬 실행(
                <code className="text-cyan-600">spawnParallelSubagents</code>)을 지원합니다.
              </p>
            </div>

            <MermaidDiagram
              title="Subagent Spawner 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AL["Agent Loop<br/><small>core/agent-loop.ts — 메인 루프</small>"]
  SP["Spawner<br/><small>subagents/spawner.ts — 생성 + 실행</small>"]
  TM["Team Manager<br/><small>subagents/team-manager.ts</small>"]
  SS["Shared State<br/><small>subagents/shared-state.ts</small>"]
  LLM["LLM Client<br/><small>llm/client.ts — API 호출</small>"]
  TR["Tool Registry<br/><small>tools/registry.ts — 도구 관리</small>"]
  MR["Model Router<br/><small>llm/model-router.ts — 프로바이더 선택</small>"]

  AL -->|"spawnSubagent(config)"| SP
  TM -->|"executor로 위임"| SP
  SP -->|"runAgentLoop()"| AL
  SP -->|"공유 상태 주입"| SS
  SP -->|"모델 오버라이드"| MR
  SP -->|"도구 필터링"| TR
  SP -->|"LLM 호출"| LLM

  style SP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TR fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style MR fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 회사의 매니저가 큰 프로젝트를 받으면, 직접 모든 일을 하지 않고
              전문가 팀원들에게 하위 작업을 위임합니다. 각 팀원(서브에이전트)은 자신의 작업 공간에서
              독립적으로 작업하고, 결과를 매니저에게 보고합니다.
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

            {/* SubagentError class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class SubagentError
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              서브에이전트 실행 중 발생하는 에러 클래스입니다.
              <code className="text-cyan-600"> BaseError</code>를 확장하며, 에러 코드
              <code className="text-cyan-600"> &quot;SUBAGENT_ERROR&quot;</code>와 에이전트 ID, 유형
              등의 컨텍스트를 포함합니다.
            </p>
            <CodeBlock>
              <span className="kw">class</span> <span className="type">SubagentError</span>{" "}
              <span className="kw">extends</span> <span className="type">BaseError</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">constructor</span>(<span className="prop">message</span>:{" "}
              <span className="type">string</span>, <span className="prop">context</span>?:{" "}
              <span className="type">Record</span>
              {"<"}
              <span className="type">string</span>, <span className="type">unknown</span>
              {">"}){"\n"}
              {"}"}
            </CodeBlock>

            {/* SubagentType */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              type SubagentType
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              서브에이전트의 유형입니다. 내장 유형 3가지와 커스텀 이름을 지원합니다.
            </p>
            <CodeBlock>
              <span className="kw">type</span> <span className="type">SubagentType</span> ={" "}
              <span className="str">&quot;explore&quot;</span> |{" "}
              <span className="str">&quot;plan&quot;</span> |{" "}
              <span className="str">&quot;general&quot;</span> | (
              <span className="type">string</span> & {"{}"});
            </CodeBlock>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-emerald-600">&quot;explore&quot;</code> &mdash; 읽기
                전용 탐색 에이전트. 코드 분석, 파일 탐색에 특화
              </p>
              <p>
                &bull; <code className="text-emerald-600">&quot;plan&quot;</code> &mdash; 계획 수립
                에이전트. 안전한 도구만 사용 가능 (MCP, 위험 도구 차단)
              </p>
              <p>
                &bull; <code className="text-emerald-600">&quot;general&quot;</code> &mdash; 범용
                에이전트. 모든 허용된 도구 사용 가능
              </p>
              <p>
                &bull; <code className="text-gray-500">string</code> &mdash;{" "}
                <code>.dhelix/agents/*.md</code> 파일로 정의한 커스텀 에이전트 이름
              </p>
            </div>

            {/* SubagentConfig interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface SubagentConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">spawnSubagent()</code>에 전달하는 모든 설정입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "type",
                  type: "SubagentType",
                  required: true,
                  desc: '서브에이전트 유형 ("explore", "plan", "general", 또는 커스텀)',
                },
                {
                  name: "prompt",
                  type: "string",
                  required: true,
                  desc: "서브에이전트에게 전달할 작업 지시(프롬프트)",
                },
                {
                  name: "client",
                  type: "LLMProvider",
                  required: true,
                  desc: "LLM API 클라이언트 (OpenAI 호환 인터페이스)",
                },
                { name: "model", type: "string", required: true, desc: "사용할 AI 모델 식별자" },
                {
                  name: "strategy",
                  type: "ToolCallStrategy",
                  required: true,
                  desc: "도구 호출 전략 (LLM이 도구를 어떻게 호출할지 결정)",
                },
                {
                  name: "toolRegistry",
                  type: "ToolRegistry",
                  required: true,
                  desc: "사용 가능한 도구들의 레지스트리",
                },
                {
                  name: "workingDirectory",
                  type: "string",
                  required: false,
                  desc: "작업 디렉토리",
                },
                {
                  name: "maxIterations",
                  type: "number",
                  required: false,
                  desc: "최대 반복 횟수 (기본값: 20)",
                },
                {
                  name: "signal",
                  type: "AbortSignal",
                  required: false,
                  desc: "외부에서 실행을 취소할 수 있는 시그널",
                },
                {
                  name: "allowedTools",
                  type: "readonly string[]",
                  required: false,
                  desc: "허용할 도구 이름 목록 (화이트리스트)",
                },
                {
                  name: "disallowedTools",
                  type: "readonly string[]",
                  required: false,
                  desc: "차단할 도구 이름 목록 (블랙리스트)",
                },
                {
                  name: "run_in_background",
                  type: "boolean",
                  required: false,
                  desc: "true이면 즉시 반환하고 나중에 이벤트로 결과 알림",
                },
                {
                  name: "isolation",
                  type: '"worktree"',
                  required: false,
                  desc: "Git 워크트리에서 격리 실행 (메인 코드 보호)",
                },
                {
                  name: "resume",
                  type: "string",
                  required: false,
                  desc: "이전 서브에이전트의 대화를 이어받을 에이전트 ID",
                },
                {
                  name: "sharedState",
                  type: "SharedAgentState",
                  required: false,
                  desc: "에이전트 간 통신을 위한 공유 상태",
                },
                {
                  name: "modelOverride",
                  type: "AgentModel",
                  required: false,
                  desc: '모델 오버라이드: "sonnet"|"opus"|"haiku"|"inherit"',
                },
              ]}
            />

            {/* SubagentResult interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface SubagentResult
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              서브에이전트 실행 완료 후 반환되는 결과입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "agentId",
                  type: "string",
                  required: true,
                  desc: "이 실행의 고유 에이전트 ID (UUID)",
                },
                { name: "type", type: "SubagentType", required: true, desc: "서브에이전트 유형" },
                {
                  name: "response",
                  type: "string",
                  required: true,
                  desc: "서브에이전트의 최종 응답 텍스트",
                },
                { name: "iterations", type: "number", required: true, desc: "실행한 총 반복 횟수" },
                {
                  name: "aborted",
                  type: "boolean",
                  required: true,
                  desc: "실행이 중단(abort)되었는지 여부",
                },
                {
                  name: "messages",
                  type: "readonly ChatMessage[]",
                  required: true,
                  desc: "전체 대화 히스토리 (resume 용도)",
                },
                {
                  name: "workingDirectory",
                  type: "string | undefined",
                  required: false,
                  desc: "사용된 작업 디렉토리 (워크트리 격리 시 다름)",
                },
                {
                  name: "sharedState",
                  type: "SharedAgentState | undefined",
                  required: false,
                  desc: "실행 중 사용된 공유 상태 인스턴스",
                },
              ]}
            />

            {/* spawnSubagent */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              spawnSubagent(config)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              서브에이전트를 생성하고 실행하는 핵심 함수입니다. 격리된 컨텍스트에서 실행되며, 독립된
              이벤트 발행기, 필터링된 도구 세트, 독립된 대화 히스토리를 가집니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">spawnSubagent</span>(
              <span className="prop">config</span>: <span className="type">SubagentConfig</span>):{" "}
              <span className="type">Promise</span>
              {"<"}
              <span className="type">SubagentResult</span>
              {">"}
            </CodeBlock>

            {/* spawnParallelSubagents */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              spawnParallelSubagents(configs)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              여러 서브에이전트를 병렬로 실행하고 결과를 수집합니다. SharedAgentState가 자동으로
              생성되어 모든 설정에 주입됩니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">spawnParallelSubagents</span>(
              {"\n"}
              {"  "}
              <span className="prop">configs</span>: <span className="kw">readonly</span>{" "}
              <span className="type">SubagentConfig</span>[],
              {"\n"}): <span className="type">Promise</span>
              {"<"}
              <span className="kw">readonly</span> <span className="type">SubagentResult</span>[]
              {">"}
            </CodeBlock>

            {/* getAgentHistory */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              getAgentHistory(agentId)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              이전 에이전트의 대화 히스토리를 조회합니다 (resume 기능용). 메모리 캐시 &rarr; 디스크
              순서로 조회하며, 디스크에서 로드된 경우 메모리 캐시에 재등록합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">getAgentHistory</span>({"\n"}
              {"  "}
              <span className="prop">agentId</span>: <span className="type">string</span>,{"\n"}):{" "}
              <span className="type">Promise</span>
              {"<"}
              <span className="kw">readonly</span> <span className="type">ChatMessage</span>[] |{" "}
              <span className="type">undefined</span>
              {">"}
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "agentId",
                  type: "string",
                  required: true,
                  desc: "조회할 에이전트의 고유 ID",
                },
              ]}
            />

            {/* cleanOrphanedWorktrees */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              cleanOrphanedWorktrees(repoRoot)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              고아(orphaned) 워크트리를 감지하고 정리합니다. 앱 시작 시 호출되어 이전 세션에서
              정리되지 않은 워크트리를 안전하게 제거합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">cleanOrphanedWorktrees</span>(
              <span className="prop">repoRoot</span>: <span className="type">string</span>):{" "}
              <span className="type">Promise</span>
              {"<"}
              <span className="type">number</span>
              {">"}
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                서브에이전트에는 5분(300초) 타임아웃이 적용됩니다. 초과하면
                <code className="text-cyan-600"> SubagentError</code>가 발생합니다.
              </li>
              <li>
                <code className="text-cyan-600">run_in_background: true</code>일 때 반환되는
                <code className="text-cyan-600"> SubagentResult</code>는 플레이스홀더입니다. 실제
                결과는 <code className="text-cyan-600">parentEvents</code>를 통해 이벤트로
                전달됩니다.
              </li>
              <li>
                <code className="text-cyan-600">plan</code> 모드에서는 MCP 도구와
                <code className="text-cyan-600"> permissionLevel !== &quot;safe&quot;</code>인
                도구가 자동으로 차단됩니다.
              </li>
              <li>
                대화 히스토리 캐시는 메모리에 최대 50개, 디스크에 최대 20개를 유지합니다. 초과 시
                오래된 것부터 자동 삭제됩니다.
              </li>
              <li>
                워크트리 격리 모드에서 변경 사항이 있으면 브랜치가 유지되고, 없으면 자동으로
                워크트리와 브랜치가 정리됩니다.
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
              기본 사용법 &mdash; 서브에이전트 생성 및 실행
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              가장 일반적인 패턴입니다. 탐색(explore) 유형의 서브에이전트를 생성하여 코드 분석
              작업을 위임합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="prop">spawnSubagent</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./subagents/spawner.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">spawnSubagent</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">type</span>: <span className="str">&quot;explore&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">prompt</span>:{" "}
              <span className="str">&quot;src/llm 디렉토리의 모듈 구조를 분석해주세요&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">client</span>: <span className="prop">llmClient</span>,{"\n"}
              {"  "}
              <span className="prop">model</span>:{" "}
              <span className="str">&quot;claude-sonnet-4-5-20250514&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">strategy</span>: <span className="prop">toolCallStrategy</span>
              ,{"\n"}
              {"  "}
              <span className="prop">toolRegistry</span>: <span className="prop">registry</span>,
              {"\n"}
              {"  "}
              <span className="prop">workingDirectory</span>:{" "}
              <span className="str">&quot;/path/to/project&quot;</span>,{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">result</span>.<span className="prop">response</span>);
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">`반복: ${"{"}</span>
              <span className="prop">result</span>.<span className="prop">iterations</span>
              <span className="str">
                {"}"}, 중단: ${"{"}
              </span>
              <span className="prop">result</span>.<span className="prop">aborted</span>
              <span className="str">{"}"}`</span>);
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 서브에이전트에는 5분 타임아웃이 적용됩니다. 복잡한 작업이라면{" "}
              <code>maxIterations</code>를 적절히 설정하고, 작업을 더 작은 단위로 분할하는 것이
              좋습니다.
            </Callout>

            {/* 고급: 백그라운드 실행 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 백그라운드 실행
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">run_in_background: true</code>로 설정하면 즉시
              반환되고, 완료 시 <code className="text-cyan-600">parentEvents</code>를 통해 이벤트로
              결과가 전달됩니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">placeholder</span> ={" "}
              <span className="kw">await</span> <span className="fn">spawnSubagent</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">type</span>: <span className="str">&quot;general&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">prompt</span>:{" "}
              <span className="str">&quot;대규모 리팩토링을 수행하세요&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">run_in_background</span>: <span className="kw">true</span>,
              {"\n"}
              {"  "}
              <span className="prop">parentEvents</span>: <span className="prop">events</span>,
              {"\n"}
              {"  "}
              <span className="cm">{"// ...기타 필수 설정"}</span>
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 즉시 반환됨 — placeholder.response는 안내 메시지"}</span>
              {"\n"}
              <span className="cm">
                {"// 실제 결과는 events.on('tool:complete', ...) 으로 수신"}
              </span>
            </CodeBlock>

            {/* 고급: 워크트리 격리 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; Git 워크트리 격리
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">isolation: &quot;worktree&quot;</code>로 설정하면
              별도의 Git 워크트리에서 실행되어 메인 코드에 영향을 주지 않습니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">spawnSubagent</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">type</span>: <span className="str">&quot;general&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">prompt</span>:{" "}
              <span className="str">&quot;실험적인 리팩토링을 시도하세요&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">isolation</span>:{" "}
              <span className="str">&quot;worktree&quot;</span>,{"\n"}
              {"  "}
              <span className="cm">{"// ...기타 필수 설정"}</span>
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">
                {"// result.workingDirectory → .dhelix/worktrees/{agentId}"}
              </span>
              {"\n"}
              <span className="cm">{"// 변경 사항이 있으면 브랜치 유지, 없으면 자동 정리"}</span>
            </CodeBlock>

            {/* 고급: 병렬 실행 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 병렬 실행과 공유 상태
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">spawnParallelSubagents</code>로 여러 에이전트를 동시에
              실행합니다. 자동으로 생성된 <code className="text-cyan-600">SharedAgentState</code>를
              통해 에이전트 간 데이터 공유가 가능합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"}{" "}
              <span className="prop">spawnParallelSubagents</span> {"}"}{" "}
              <span className="kw">from</span>{" "}
              <span className="str">&quot;./subagents/spawner.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">results</span> ={" "}
              <span className="kw">await</span> <span className="fn">spawnParallelSubagents</span>([
              {"\n"}
              {"  "}
              {"{"} <span className="prop">type</span>:{" "}
              <span className="str">&quot;explore&quot;</span>, <span className="prop">prompt</span>
              : <span className="str">&quot;프론트엔드 분석&quot;</span>, ...
              <span className="prop">baseConfig</span> {"}"},{"\n"}
              {"  "}
              {"{"} <span className="prop">type</span>:{" "}
              <span className="str">&quot;explore&quot;</span>, <span className="prop">prompt</span>
              : <span className="str">&quot;백엔드 분석&quot;</span>, ...
              <span className="prop">baseConfig</span> {"}"},{"\n"}
              {"  "}
              {"{"} <span className="prop">type</span>:{" "}
              <span className="str">&quot;explore&quot;</span>, <span className="prop">prompt</span>
              : <span className="str">&quot;테스트 분석&quot;</span>, ...
              <span className="prop">baseConfig</span> {"}"},{"\n"}]);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3개 결과가 배열로 반환 (입력 순서와 동일)"}</span>
              {"\n"}
              <span className="prop">results</span>.<span className="fn">forEach</span>((
              <span className="prop">r</span>) ={">"} <span className="fn">console</span>.
              <span className="fn">log</span>(<span className="prop">r</span>.
              <span className="prop">response</span>));
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>spawnParallelSubagents</code>는 내부적으로
              <code> Promise.all</code>을 사용하므로, 하나라도 실패하면 전체가 reject됩니다. 각
              에이전트의 에러를 개별 처리하려면 <code>spawnSubagent</code>를 직접 호출하고
              <code> Promise.allSettled</code>로 감싸세요.
            </Callout>

            <DeepDive title="모델 오버라이드와 별칭 매핑">
              <p className="mb-3">
                <code className="text-cyan-600">modelOverride</code>로 서브에이전트의 모델을 변경할
                수 있습니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <code className="text-emerald-600">&quot;inherit&quot;</code> 또는 미설정 &mdash;
                  부모 에이전트의 모델을 그대로 상속
                </li>
                <li>
                  <code className="text-emerald-600">&quot;sonnet&quot;</code> &rarr;{" "}
                  <code>claude-sonnet-4-5-20250514</code>
                </li>
                <li>
                  <code className="text-emerald-600">&quot;opus&quot;</code> &rarr;{" "}
                  <code>claude-opus-4-5-20250514</code>
                </li>
                <li>
                  <code className="text-emerald-600">&quot;haiku&quot;</code> &rarr;{" "}
                  <code>claude-haiku-4-5-20251001</code>
                </li>
              </ul>
              <p className="mt-3 text-gray-600">
                별칭에 해당하지 않는 문자열은 그대로 모델 ID로 사용됩니다. 모델 변경 시 적절한
                프로바이더도 자동으로 선택됩니다 (
                <code className="text-cyan-600">resolveProvider</code>).
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
              실행 흐름 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">spawnSubagent</code>가 호출되면 8단계의 파이프라인을
              거쳐 실행됩니다.
            </p>

            <MermaidDiagram
              title="spawnSubagent 실행 파이프라인"
              titleColor="purple"
              chart={`graph TD
  START["spawnSubagent(config)<br/><small>설정 수신 + UUID 생성</small>"]
  BG{"background?<br/><small>비동기 모드 확인</small>"}
  EXEC["executeSubagent<br/><small>실제 실행 로직</small>"]
  PH["placeholder 반환<br/><small>이벤트로 결과 전달</small>"]
  M1["1. 모델 오버라이드<br/><small>별칭 → 실제 모델 ID</small>"]
  M2["2. 워크트리 격리<br/><small>선택적 Git worktree 생성</small>"]
  M3["3. 도구 필터링<br/><small>허용/차단 목록 적용</small>"]
  M4["4. 시스템 프롬프트<br/><small>유형별 프롬프트 구성</small>"]
  M5["5. 초기 메시지<br/><small>resume 시 이전 히스토리 로드</small>"]
  M6["6. Agent Loop 실행<br/><small>5분 타임아웃 적용</small>"]
  M7["7. 히스토리 저장<br/><small>메모리 캐시 + 디스크</small>"]
  RESULT["SubagentResult 반환<br/><small>응답 + 메타데이터</small>"]

  START --> BG
  BG -->|"Yes"| PH
  BG -->|"No"| EXEC
  PH -.->|"비동기"| EXEC
  EXEC --> M1
  M1 --> M2
  M2 --> M3
  M3 --> M4
  M4 --> M5
  M5 --> M6
  M6 --> M7
  M7 --> RESULT

  style START fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style BG fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style EXEC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PH fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style M6 fill:#dcfce7,stroke:#10b981,color:#065f46
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              도구 레지스트리 필터링 로직입니다. 허용 목록과 차단 목록을 순차적으로 적용합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// [1] 허용 목록과 차단 목록을 모두 적용"}</span>
              {"\n"}
              <span className="kw">let</span> <span className="prop">agentRegistry</span> ={" "}
              <span className="fn">createFilteredRegistryWithBlacklist</span>({"\n"}
              {"  "}
              <span className="prop">toolRegistry</span>, <span className="prop">allowedTools</span>
              , <span className="prop">disallowedTools</span>,{"\n"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// [2] plan 모드에서는 추가 필터링"}</span>
              {"\n"}
              <span className="kw">if</span> (<span className="prop">permissionMode</span> ==={" "}
              <span className="str">&quot;plan&quot;</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">planSafe</span> ={" "}
              <span className="kw">new</span> <span className="fn">ToolRegistry</span>();
              {"\n"}
              {"  "}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">tool</span> <span className="kw">of</span>{" "}
              <span className="prop">agentRegistry</span>.<span className="fn">getAll</span>()){" "}
              {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [3] MCP 도구(외부 서비스 통신) 차단"}</span>
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">tool</span>.
              <span className="prop">name</span>.<span className="fn">startsWith</span>(
              <span className="str">&quot;mcp__&quot;</span>)) <span className="kw">continue</span>;
              {"\n"}
              {"    "}
              <span className="cm">{"// [4] 안전하지 않은 도구(파일 수정 등) 차단"}</span>
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">tool</span>.
              <span className="prop">permissionLevel</span> !=={" "}
              <span className="str">&quot;safe&quot;</span>) <span className="kw">continue</span>;
              {"\n"}
              {"    "}
              <span className="prop">planSafe</span>.<span className="fn">register</span>(
              <span className="prop">tool</span>);
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"  "}
              <span className="prop">agentRegistry</span> = <span className="prop">planSafe</span>;
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 허용 목록이 있으면 먼저
                적용(화이트리스트)하고, 그 결과에서 차단 목록으로 추가 제거합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong>{" "}
                <code className="text-cyan-600">plan</code> 모드는 읽기 전용 계획 수립용이므로 더
                엄격한 도구 제한이 적용됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong>{" "}
                <code className="text-cyan-600">mcp__</code> 접두사로 시작하는 도구는 외부 MCP
                서버와 통신하므로 plan 모드에서 차단됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong>{" "}
                <code className="text-cyan-600">permissionLevel !== &quot;safe&quot;</code>인
                도구(파일 수정, 코드 실행 등)도 plan 모드에서 차단됩니다.
              </p>
            </div>

            <DeepDive title="히스토리 저장소 아키텍처">
              <p className="mb-3">서브에이전트의 대화 히스토리는 2계층 캐시로 관리됩니다:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>메모리 캐시</strong> (Map): 최대 50개, LRU 방식으로 오래된 것부터 삭제
                </li>
                <li>
                  <strong>디스크</strong> (~/.dhelix/agent-history/): 최대 20개 JSON 파일, 수정 시각
                  기준 정리
                </li>
              </ul>
              <p className="mt-3 text-gray-600">
                <code className="text-cyan-600">resume</code> 기능으로 이전 에이전트의 대화를
                이어받을 때, 먼저 메모리 캐시를 확인하고, 없으면 디스크에서 로드합니다. 디스크
                영속화는 best-effort 방식으로, 실패해도 에이전트 실행에 영향을 주지 않습니다.
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
                &quot;서브에이전트가 5분 후에 타임아웃됩니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                기본 타임아웃은 5분(300초)입니다. 다음을 확인하세요:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <code className="text-cyan-600">maxIterations</code>를 줄여서 반복 횟수를
                  제한하세요. 기본값은 20회이지만, 복잡한 작업이면 적절히 조절하세요.
                </li>
                <li>
                  작업을 더 작은 단위로 분할하여 여러 서브에이전트에게 위임하세요 (
                  <code className="text-cyan-600">spawnParallelSubagents</code> 활용).
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;resume로 이전 대화를 이어받으려는데 히스토리가 없어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                메모리 캐시(50개)와 디스크(20개)의 크기 제한을 확인하세요. 오래된 히스토리는 자동
                삭제됩니다. 또한 디스크 영속화는 best-effort이므로, 디스크 공간 부족이나 권한 문제로
                저장에 실패했을 수 있습니다.
                <code className="text-cyan-600"> DHELIX_VERBOSE=1</code>로 로그를 확인하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;워크트리가 정리되지 않고 남아 있어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                워크트리에 변경 사항이 있으면 의도적으로 유지됩니다 (사용자 검토 대기). 수동으로
                정리하려면:
              </p>
              <CodeBlock>
                <span className="cm">{"// 앱 시작 시 자동 정리"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">cleaned</span> ={" "}
                <span className="kw">await</span> <span className="fn">cleanOrphanedWorktrees</span>
                (<span className="prop">repoRoot</span>);
                {"\n"}
                {"\n"}
                <span className="cm">{"// 또는 git 명령으로 직접 정리"}</span>
                {"\n"}
                <span className="cm">
                  {"// git worktree remove --force .dhelix/worktrees/<agentId>"}
                </span>
              </CodeBlock>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;plan 모드에서 필요한 도구를 사용할 수 없어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">plan</code> 모드에서는{" "}
                <code className="text-cyan-600">permissionLevel === &quot;safe&quot;</code>인 도구만
                허용됩니다. 파일 수정이나 코드 실행이 필요하다면
                <code className="text-cyan-600"> type: &quot;general&quot;</code>로 변경하세요.
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
                  desc: "서브에이전트가 내부적으로 실행하는 에이전트 루프 — runAgentLoop()를 호출합니다",
                },
                {
                  name: "team-manager.ts",
                  slug: "team-manager",
                  relation: "sibling",
                  desc: "여러 서브에이전트를 팀으로 구성하고 의존성 기반으로 실행하는 오케스트레이터",
                },
                {
                  name: "model-router.ts",
                  slug: "model-router",
                  relation: "sibling",
                  desc: "모델 오버라이드 시 적절한 프로바이더를 선택하는 라우터 모듈",
                },
                {
                  name: "tool-registry.ts",
                  slug: "tool-registry",
                  relation: "sibling",
                  desc: "서브에이전트의 도구 필터링(허용/차단 목록)에 사용되는 레지스트리",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
