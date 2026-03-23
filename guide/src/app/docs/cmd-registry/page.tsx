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

export default function CmdRegistryPage() {
  return (
    <div className="min-h-screen pt-10 pb-20">
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/registry.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">명령어 레지스트리</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              슬래시 명령어의 등록, 조회, 실행을 관리하는 핵심 레지스트리 모듈입니다. 모든 명령어
              시스템의 기반이 됩니다.
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
                <code className="text-cyan-600">registry.ts</code>는 dbcode의 슬래시 명령어 시스템의
                기반을 제공하는 모듈입니다. 명령어의 타입 정의(SlashCommand, CommandResult,
                CommandContext), 에러 클래스(CommandError), 그리고 명령어를 등록/조회/실행하는
                레지스트리 클래스(CommandRegistry)를 모두 포함하고 있습니다.
              </p>
              <p>
                모든 슬래시 명령어 파일(commit.ts, review.ts, resume.ts 등)은 이 모듈에서 정의된
                <code className="text-cyan-600">SlashCommand</code> 인터페이스를 구현합니다. 앱
                초기화 시 각 명령어를{" "}
                <code className="text-cyan-600">CommandRegistry.register()</code>로 등록하면,
                사용자가 &quot;/&quot;로 시작하는 입력을 보낼 때 자동으로 해당 명령어를 찾아
                실행합니다.
              </p>
              <p>
                <code className="text-cyan-600">CommandResult</code> 인터페이스는 단순한 텍스트 출력
                외에도 모델 변경, 대화 초기화, LLM 메시지 주입, 대화형 선택 등 다양한 부가 효과(side
                effect)를 플래그로 전달할 수 있어, 명령어가 앱 전체 상태에 영향을 줄 수 있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="CommandRegistry 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  APP["App.tsx<br/><small>사용자 입력 처리</small>"]
  REG["CommandRegistry<br/><small>registry.ts</small>"]
  COMMIT["commitCommand<br/><small>commit.ts</small>"]
  REVIEW["reviewCommand<br/><small>review.ts</small>"]
  RESUME["resumeCommand<br/><small>resume.ts</small>"]
  STATS["statsCommand<br/><small>stats.ts</small>"]
  MORE["... 기타 명령어"]

  APP -->|"execute(input, ctx)"| REG
  REG -->|"register()"| COMMIT
  REG -->|"register()"| REVIEW
  REG -->|"register()"| RESUME
  REG -->|"register()"| STATS
  REG -->|"register()"| MORE
  REG -->|"CommandResult"| APP

  style REG fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style APP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style COMMIT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style REVIEW fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style RESUME fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style STATS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style MORE fill:#f1f5f9,stroke:#94a3b8,color:#64748b`}
            />

            <Callout type="info" icon="💡">
              <strong>설계 원칙:</strong> 각 명령어는 독립적인 파일에서 <code>SlashCommand</code>{" "}
              객체를 export하고, 레지스트리가 이를 Map에 등록합니다. 새 명령어를 추가할 때
              레지스트리 코드를 수정할 필요 없이 register() 호출만 추가하면 됩니다.
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

            {/* CommandError */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class CommandError
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              슬래시 명령어 실행 중 발생하는 에러 클래스입니다.
              <code className="text-cyan-600">BaseError</code>를 상속하여 에러 코드(
              <code className="text-cyan-600">COMMAND_ERROR</code>)와 컨텍스트 정보를 포함합니다.
            </p>
            <CodeBlock>
              <span className="kw">class</span> <span className="type">CommandError</span>{" "}
              <span className="kw">extends</span> <span className="type">BaseError</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">constructor</span>(<span className="prop">message</span>:{" "}
              <span className="type">string</span>, <span className="prop">context</span>?:{" "}
              <span className="type">Record</span>&lt;<span className="type">string</span>,{" "}
              <span className="type">unknown</span>&gt;)
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* SelectOption */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface SelectOption
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              대화형 선택 목록의 단일 항목입니다.
              <code className="text-cyan-600">/model</code>,{" "}
              <code className="text-cyan-600">/resume</code> 등에서 사용자가 화살표 키로 선택할 수
              있는 목록 항목을 정의합니다.
            </p>
            <ParamTable
              params={[
                { name: "label", type: "string", required: true, desc: "화면에 표시되는 텍스트" },
                { name: "value", type: "string", required: true, desc: "선택 시 전달되는 값" },
                { name: "description", type: "string", required: false, desc: "선택적 부가 설명" },
              ]}
            />

            {/* InteractiveSelect */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface InteractiveSelect
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              대화형 선택 프롬프트 설정입니다. 사용자에게 선택 목록을 보여주기 위한 구성을
              정의합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "options",
                  type: "readonly SelectOption[]",
                  required: true,
                  desc: "선택 가능한 옵션 배열",
                },
                {
                  name: "prompt",
                  type: "string",
                  required: true,
                  desc: '선택 안내 메시지 (예: "모델을 선택하세요:")',
                },
                {
                  name: "onSelect",
                  type: "string",
                  required: true,
                  desc: '선택 후 실행할 명령어 (예: "/resume")',
                },
              ]}
            />

            {/* CommandContext */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface CommandContext
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              명령어 실행에 필요한 세션 상태 정보입니다. 모든 슬래시 명령어의{" "}
              <code className="text-cyan-600">execute</code> 함수가 두 번째 매개변수로 받습니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "workingDirectory",
                  type: "string",
                  required: true,
                  desc: "현재 작업 디렉토리 (프로젝트 루트)",
                },
                { name: "sessionId", type: "string", required: false, desc: "현재 세션 ID" },
                {
                  name: "model",
                  type: "string",
                  required: true,
                  desc: '현재 활성 모델명 (예: "gpt-4o")',
                },
                {
                  name: "emit",
                  type: "(event, data?) => void",
                  required: true,
                  desc: "이벤트 발생 함수",
                },
                {
                  name: "messages",
                  type: "readonly Message[]",
                  required: false,
                  desc: "현재 대화 메시지 배열",
                },
                {
                  name: "mcpManager",
                  type: "MCPManager",
                  required: false,
                  desc: "MCP 매니저 인스턴스 (/mcp 명령어용)",
                },
              ]}
            />

            {/* CommandResult */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface CommandResult
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              명령어 실행 결과와 부가 효과(side effect)를 전달하는 인터페이스입니다. 각 플래그는
              상위 컴포넌트(App, AgentLoop)가 처리합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "output",
                  type: "string",
                  required: true,
                  desc: "사용자에게 표시할 텍스트 출력",
                },
                { name: "success", type: "boolean", required: true, desc: "명령어 성공 여부" },
                {
                  name: "shouldClear",
                  type: "boolean",
                  required: false,
                  desc: "true면 대화 내역 초기화 (/clear)",
                },
                {
                  name: "shouldExit",
                  type: "boolean",
                  required: false,
                  desc: "true면 애플리케이션 종료",
                },
                {
                  name: "newModel",
                  type: "string",
                  required: false,
                  desc: "변경된 모델명 (/model)",
                },
                {
                  name: "newProvider",
                  type: "{ model, baseURL, apiKey }",
                  required: false,
                  desc: "프로바이더 전환 (/model Local↔Cloud)",
                },
                {
                  name: "shouldInjectAsUserMessage",
                  type: "boolean",
                  required: false,
                  desc: "true면 LLM에 사용자 메시지로 주입 (/commit, /review)",
                },
                {
                  name: "interactiveSelect",
                  type: "InteractiveSelect",
                  required: false,
                  desc: "대화형 선택 목록 표시 (/model, /resume)",
                },
                {
                  name: "shouldCompact",
                  type: "boolean",
                  required: false,
                  desc: "true면 컨텍스트 압축 트리거 (/compact)",
                },
              ]}
            />

            {/* SlashCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              개별 슬래시 명령어의 정의 인터페이스입니다. 각 명령어 파일이 이 인터페이스를 구현한
              객체를 export합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "name",
                  type: "string",
                  required: true,
                  desc: '명령어 이름 ("/" 접두사 제외, 예: "commit")',
                },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: "/help와 자동 완성에 표시되는 짧은 설명",
                },
                {
                  name: "usage",
                  type: "string",
                  required: true,
                  desc: '사용법 구문 (예: "/commit [message hint]")',
                },
                {
                  name: "execute",
                  type: "(args: string, context: CommandContext) => Promise<CommandResult>",
                  required: true,
                  desc: "명령어 실행 함수 — args는 명령어 이름 뒤의 인자 문자열",
                },
              ]}
            />

            {/* CommandRegistry class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class CommandRegistry
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              슬래시 명령어의 등록, 조회, 실행을 관리하는 메인 클래스입니다.
              <code className="text-cyan-600">Map&lt;string, SlashCommand&gt;</code>로 명령어를
              저장합니다.
            </p>

            {/* register */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">register(command)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              명령어를 레지스트리에 등록합니다. 중복 이름이면{" "}
              <code className="text-cyan-600">CommandError</code>를 throw합니다.
            </p>
            <CodeBlock>
              <span className="fn">register</span>(<span className="prop">command</span>:{" "}
              <span className="type">SlashCommand</span>): <span className="type">void</span>
            </CodeBlock>

            {/* get */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">get(name)</h4>
            <p className="text-[13px] text-gray-600 mb-3">이름으로 명령어를 조회합니다.</p>
            <CodeBlock>
              <span className="fn">get</span>(<span className="prop">name</span>:{" "}
              <span className="type">string</span>): <span className="type">SlashCommand</span> |{" "}
              <span className="type">undefined</span>
            </CodeBlock>

            {/* has */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">has(name)</h4>
            <p className="text-[13px] text-gray-600 mb-3">명령어 존재 여부를 확인합니다.</p>
            <CodeBlock>
              <span className="fn">has</span>(<span className="prop">name</span>:{" "}
              <span className="type">string</span>): <span className="type">boolean</span>
            </CodeBlock>

            {/* getAll */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getAll()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              등록된 모든 명령어를 배열로 반환합니다. <code className="text-cyan-600">/help</code>{" "}
              명령어 목록 생성에 사용됩니다.
            </p>
            <CodeBlock>
              <span className="fn">getAll</span>(): <span className="kw">readonly</span>{" "}
              <span className="type">SlashCommand</span>[]
            </CodeBlock>

            {/* getCompletions */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getCompletions(prefix)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              접두사에 매칭되는 명령어를 반환합니다. 자동 완성(autocomplete) UI에서 사용됩니다.
            </p>
            <CodeBlock>
              <span className="fn">getCompletions</span>(<span className="prop">prefix</span>:{" "}
              <span className="type">string</span>): <span className="kw">readonly</span>{" "}
              <span className="type">SlashCommand</span>[]
              {"\n"}
              <span className="cm">
                {"// 예: getCompletions('co') → [commit, compact, config, context, copy, cost]"}
              </span>
            </CodeBlock>

            {/* execute */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">execute(input, context)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              사용자 입력을 파싱하여 슬래시 명령어를 실행합니다. &quot;/&quot;로 시작하지 않으면{" "}
              <code className="text-cyan-600">null</code>을 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">execute</span>(
              <span className="prop">input</span>: <span className="type">string</span>,{" "}
              <span className="prop">context</span>: <span className="type">CommandContext</span>):{" "}
              <span className="type">Promise</span>&lt;<span className="type">CommandResult</span> |{" "}
              <span className="type">null</span>&gt;
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "input",
                  type: "string",
                  required: true,
                  desc: '사용자 입력 문자열 (예: "/model gpt-4o")',
                },
                {
                  name: "context",
                  type: "CommandContext",
                  required: true,
                  desc: "명령어 실행 컨텍스트",
                },
              ]}
            />

            {/* isCommand */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">isCommand(input)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              입력 문자열이 슬래시 명령어인지 확인합니다. &quot;/&quot;로 시작하면{" "}
              <code className="text-cyan-600">true</code>를 반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">isCommand</span>(<span className="prop">input</span>:{" "}
              <span className="type">string</span>): <span className="type">boolean</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">register()</code>는 같은 이름의 명령어를 두 번
                등록하면
                <code className="text-cyan-600">CommandError</code>를 throw합니다. 앱 초기화 시 중복
                등록에 주의하세요.
              </li>
              <li>
                <code className="text-cyan-600">execute()</code>에서 명령어 실행 중 에러가 발생하면
                <code className="text-cyan-600">try/catch</code>로 잡아서 에러 메시지를{" "}
                <code className="text-cyan-600">CommandResult</code>로 래핑하여 반환합니다. 에러가
                상위로 전파되지 않습니다.
              </li>
              <li>
                <code className="text-cyan-600">getCompletions()</code>는 소문자로 변환하여
                비교합니다. 사용자가 대문자로 입력해도 정상 매칭됩니다.
              </li>
              <li>
                <code className="text-cyan-600">CommandResult</code>의 부가 효과 플래그들은 상호
                배타적이지 않습니다. 여러 플래그를 동시에 설정할 수 있으며, 상위 컴포넌트가 순서대로
                처리합니다.
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

            {/* 기본 사용법: 명령어 등록 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 명령어 등록 및 실행
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              앱 초기화 시 명령어를 등록하고, 사용자 입력을 처리하는 기본 패턴입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 레지스트리 생성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">registry</span> ={" "}
              <span className="kw">new</span> <span className="fn">CommandRegistry</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 명령어 등록"}</span>
              {"\n"}
              <span className="prop">registry</span>.<span className="fn">register</span>(
              <span className="prop">commitCommand</span>);
              {"\n"}
              <span className="prop">registry</span>.<span className="fn">register</span>(
              <span className="prop">reviewCommand</span>);
              {"\n"}
              <span className="prop">registry</span>.<span className="fn">register</span>(
              <span className="prop">resumeCommand</span>);
              {"\n"}
              <span className="prop">registry</span>.<span className="fn">register</span>(
              <span className="prop">statsCommand</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. 사용자 입력 처리"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="prop">registry</span>.
              <span className="fn">execute</span>(
              <span className="str">&quot;/commit fix auth bug&quot;</span>,{" "}
              <span className="prop">context</span>);
              {"\n"}
              <span className="kw">if</span> (<span className="prop">result</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">result</span>.<span className="prop">output</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* 자동 완성 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 자동 완성 구현
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">getCompletions()</code>를 활용하여 사용자가
              &quot;/&quot;를 입력하면 매칭되는 명령어 목록을 실시간으로 제안합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 사용자가 '/co' 입력 시"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">suggestions</span> ={" "}
              <span className="prop">registry</span>.<span className="fn">getCompletions</span>(
              <span className="str">&quot;co&quot;</span>);
              {"\n"}
              <span className="cm">{"// → [commit, compact, config, context, copy, cost]"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 각 제안의 설명 표시"}</span>
              {"\n"}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">cmd</span> <span className="kw">of</span>{" "}
              <span className="prop">suggestions</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">
                `/${"{"}
                <span className="prop">cmd</span>.<span className="prop">name</span>
                {"}"} — ${"{"}
                <span className="prop">cmd</span>.<span className="prop">description</span>
                {"}"}`
              </span>
              );
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 같은 이름의 명령어를 두 번 <code>register()</code>하면
              <code>CommandError</code>가 throw됩니다. 앱 초기화 코드에서 조건부 등록이 필요한 경우{" "}
              <code>has()</code>로 먼저 확인하세요.
            </Callout>

            <DeepDive title="CommandResult 부가 효과 체이닝">
              <p className="mb-3">
                <code className="text-cyan-600">CommandResult</code>의 플래그들은 독립적으로
                동작하며, 여러 개를 동시에 설정할 수 있습니다:
              </p>
              <CodeBlock>
                <span className="cm">{"// 모델 변경 + 설정 리로드"}</span>
                {"\n"}
                <span className="kw">return</span> {"{"}
                {"\n"}
                {"  "}
                <span className="prop">output</span>:{" "}
                <span className="str">&quot;모델이 변경되었습니다.&quot;</span>,{"\n"}
                {"  "}
                <span className="prop">success</span>: <span className="kw">true</span>,{"\n"}
                {"  "}
                <span className="prop">newModel</span>:{" "}
                <span className="str">&quot;gpt-4o&quot;</span>,{"\n"}
                {"  "}
                <span className="prop">refreshInstructions</span>: <span className="kw">true</span>,
                {"\n"}
                {"}"};
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                상위 컴포넌트(App.tsx)는 <code className="text-cyan-600">CommandResult</code>를
                받으면 각 플래그를 순서대로 확인하여 필요한 부가 동작을 수행합니다.
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
              명령어 실행 파이프라인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">execute()</code> 메서드는 사용자 입력을 파싱 &rarr;
              명령어 조회 &rarr; 실행 &rarr; 에러 래핑의 파이프라인으로 처리합니다.
            </p>

            <MermaidDiagram
              title="execute() 파이프라인"
              titleColor="purple"
              chart={`graph TD
  INPUT["사용자 입력<br/><small>/model gpt-4o</small>"]

  INPUT --> TRIM["trim() 처리"]
  TRIM --> CHECK{"'/'로<br/>시작?"}

  CHECK -->|"No"| NULL["null 반환<br/><small>슬래시 명령어 아님</small>"]
  CHECK -->|"Yes"| PARSE["파싱<br/><small>name='model', args='gpt-4o'</small>"]

  PARSE --> LOOKUP{"명령어<br/>존재?"}
  LOOKUP -->|"No"| UNKNOWN["Unknown command 에러"]
  LOOKUP -->|"Yes"| EXEC["command.execute(args, ctx)"]

  EXEC -->|"성공"| RESULT["CommandResult 반환"]
  EXEC -->|"에러"| CATCH["에러 → CommandResult 래핑"]

  style PARSE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CHECK fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style LOOKUP fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style INPUT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46
  style NULL fill:#f1f5f9,stroke:#94a3b8,color:#64748b
  style UNKNOWN fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style CATCH fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style TRIM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">execute()</code> 메서드의 전체 로직입니다. 입력
              파싱부터 에러 처리까지 하나의 메서드에서 처리합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">execute</span>(
              <span className="prop">input</span>: <span className="type">string</span>,{" "}
              <span className="prop">context</span>: <span className="type">CommandContext</span>):{" "}
              <span className="type">Promise</span>&lt;<span className="type">CommandResult</span> |{" "}
              <span className="type">null</span>&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] '/'로 시작하지 않으면 null"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">trimmed</span> ={" "}
              <span className="prop">input</span>.<span className="fn">trim</span>();
              {"\n"}
              {"  "}
              <span className="kw">if</span> (!<span className="prop">trimmed</span>.
              <span className="fn">startsWith</span>(<span className="str">&quot;/&quot;</span>)){" "}
              <span className="kw">return</span> <span className="kw">null</span>;{"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [2] 명령어 이름과 인자 분리"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> [<span className="prop">commandName</span>, ...
              <span className="prop">argParts</span>] = <span className="prop">trimmed</span>.
              <span className="fn">slice</span>(<span className="num">1</span>).
              <span className="fn">split</span>(<span className="str">/\\s+/</span>);
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">args</span> ={" "}
              <span className="prop">argParts</span>.<span className="fn">join</span>(
              <span className="str">&quot; &quot;</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 명령어 조회"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">command</span> ={" "}
              <span className="kw">this</span>.<span className="prop">commands</span>.
              <span className="fn">get</span>(<span className="prop">commandName</span>);
              {"\n"}
              {"  "}
              <span className="kw">if</span> (!<span className="prop">command</span>){" "}
              <span className="kw">return</span> {"{"} <span className="prop">output</span>:{" "}
              <span className="str">`Unknown command`</span>, <span className="prop">success</span>:{" "}
              <span className="kw">false</span> {"}"};{"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [4] 실행 + 에러 래핑"}</span>
              {"\n"}
              {"  "}
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"    "}
              <span className="kw">return await</span> <span className="prop">command</span>.
              <span className="fn">execute</span>(<span className="prop">args</span>,{" "}
              <span className="prop">context</span>);
              {"\n"}
              {"  "}
              <span className="kw">{"}"} catch</span> (<span className="prop">error</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">return</span> {"{"} <span className="prop">output</span>:{" "}
              <span className="str">`Command error: ...`</span>,{" "}
              <span className="prop">success</span>: <span className="kw">false</span> {"}"};{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1] null 반환:</strong> &quot;/&quot;로 시작하지
                않는 입력은 일반 대화로 처리되어야 하므로{" "}
                <code className="text-cyan-600">null</code>을 반환하여 상위에서 판단합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2] 인자 분리:</strong>{" "}
                <code className="text-cyan-600">/model gpt-4o</code>에서{" "}
                <code className="text-cyan-600">commandName=&quot;model&quot;</code>,{" "}
                <code className="text-cyan-600">args=&quot;gpt-4o&quot;</code>로 분리합니다. 공백
                기준으로 split합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3] 에러 메시지:</strong> 등록되지 않은 명령어는
                &quot;Unknown command: /xyz. Type /help for available commands.&quot; 메시지를
                반환합니다.
              </p>
              <p>
                <strong className="text-gray-900">[4] 에러 래핑:</strong> 명령어 실행 중 throw된
                에러를 catch하여 <code className="text-cyan-600">CommandResult</code>로 변환합니다.
                에러가 상위로 전파되지 않아 앱이 크래시되지 않습니다.
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
                &quot;Unknown command 에러가 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                입력한 명령어가 레지스트리에 등록되지 않은 경우입니다.
                <code className="text-cyan-600">/help</code>를 입력하면 사용 가능한 모든 명령어
                목록을 확인할 수 있습니다. 오타가 없는지도 확인하세요 &mdash; 명령어 이름은
                대소문자를 구분합니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Command already registered 에러가 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                같은 이름의 명령어를 두 번 <code className="text-cyan-600">register()</code>한
                경우입니다. 앱 초기화 코드에서 중복 등록이 없는지 확인하세요. 조건부 등록이
                필요하다면 <code className="text-cyan-600">registry.has(name)</code>으로 먼저 존재
                여부를 확인한 후 등록하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;자동 완성이 동작하지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                자동 완성은 <code className="text-cyan-600">getCompletions()</code>가 입력 접두사로
                등록된 명령어를 필터링하여 제공합니다. CLI의 입력 컴포넌트에서 이 메서드를 호출하고
                있는지 확인하세요. 접두사가 빈 문자열이면 모든 명령어가 반환됩니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;명령어 실행 중 에러가 발생했는데 앱이 멈추지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                이것은 의도된 동작입니다. <code className="text-cyan-600">execute()</code>는 명령어
                실행 중 발생한 모든 에러를 <code className="text-cyan-600">try/catch</code>로 잡아서
                에러 메시지를 <code className="text-cyan-600">CommandResult</code>로 래핑하여
                반환합니다. 에러가 상위로 전파되지 않으므로 앱은 안정적으로 계속 실행됩니다.
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
                  name: "commit.ts",
                  slug: "cmd-commit",
                  relation: "child",
                  desc: "/commit — 스테이징된 변경 사항을 자동 커밋 메시지와 함께 커밋하는 명령어",
                },
                {
                  name: "review.ts",
                  slug: "cmd-review",
                  relation: "child",
                  desc: "/review — 코드 변경 사항을 버그, 보안, 품질 관점으로 리뷰하는 명령어",
                },
                {
                  name: "resume.ts",
                  slug: "cmd-resume",
                  relation: "child",
                  desc: "/resume — 이전 세션 목록을 조회하거나 재개하는 명령어",
                },
                {
                  name: "stats.ts",
                  slug: "cmd-stats",
                  relation: "child",
                  desc: "/stats — 세션 통계를 시각적 막대 차트와 함께 표시하는 명령어",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
