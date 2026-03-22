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

export default function AppEntryPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/cli/App.tsx" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              App (Root Component)
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="cli" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            dbcode CLI 애플리케이션의 최상위 루트 컴포넌트입니다. 모든 훅과 하위 컴포넌트를 조합하여
            하나의 통합 터미널 인터페이스를 구성합니다.
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
              <code className="text-cyan-600">App</code>은 Ink(터미널용 React 라이브러리) 기반의 루트 컴포넌트로,
              CLI Layer(Layer 1)의 진입점 역할을 합니다. 사용자 입력, 에이전트 상태 표시, 권한 프롬프트,
              슬래시 명령 메뉴, 음성 입력, 키보드 단축키 등 모든 UI 기능을 총괄합니다.
            </p>
            <p>
              이 컴포넌트는 <code className="text-cyan-600">ErrorBoundary</code>로 감싸여 렌더링 에러를 안전하게 포착하며,
              내부적으로 <code className="text-cyan-600">useAgentLoop</code>, <code className="text-cyan-600">usePermissionPrompt</code>,
              <code className="text-cyan-600">useKeybindings</code>, <code className="text-cyan-600">useVoice</code> 등
              7개 커스텀 훅과 12개 하위 컴포넌트를 조합합니다.
            </p>
            <p>
              외부에서 주입받는 Props는 LLM 프로바이더, 도구 레지스트리, 권한 매니저, 세션 매니저 등
              핵심 인프라 객체들이며, App 자체는 이들의 생명주기를 관리하지 않고 &quot;조합&quot;만 담당합니다.
              생성과 초기화는 <code className="text-cyan-600">src/index.ts</code>에서 수행됩니다.
            </p>
          </div>

          <MermaidDiagram
            title="App 컴포넌트 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  INDEX["index.ts<br/><small>CLI 엔트리포인트</small>"]
  APP["App.tsx<br/><small>루트 컴포넌트</small>"]
  EB["ErrorBoundary<br/><small>렌더링 에러 포착</small>"]
  HOOKS["Hooks<br/><small>useAgentLoop, useKeybindings 등</small>"]
  COMP["Components<br/><small>UserInput, StatusBar 등 12개</small>"]
  AGENT["Agent Loop<br/><small>core/agent-loop.ts</small>"]
  LLM["LLM Provider<br/><small>llm/provider.ts</small>"]
  TOOLS["Tool Registry<br/><small>tools/registry.ts</small>"]
  PERM["Permission Manager<br/><small>permissions/manager.ts</small>"]

  INDEX -->|"Props 주입"| APP
  APP --> EB
  EB --> HOOKS
  EB --> COMP
  HOOKS -->|"이벤트 기반 통신"| AGENT
  AGENT --> LLM
  AGENT --> TOOLS
  APP -->|"권한 체크 위임"| PERM

  style APP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style INDEX fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EB fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style HOOKS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style COMP fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style AGENT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TOOLS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PERM fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>핵심 원칙:</strong> App 컴포넌트는 &quot;조합자(Compositor)&quot; 역할만 합니다.
            비즈니스 로직은 훅과 코어 모듈에 위임하고, UI 렌더링만 담당합니다.
            이를 통해 테스트 시 각 훅과 컴포넌트를 독립적으로 검증할 수 있습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* AppProps interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface AppProps
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            App 컴포넌트에 주입되는 모든 의존성을 정의합니다.
            모든 필드는 <code className="text-cyan-600">readonly</code>로 불변성을 보장합니다.
          </p>
          <ParamTable
            params={[
              { name: "client", type: "LLMProvider", required: true, desc: "LLM API와 통신하는 프로바이더 (OpenAI, Anthropic 등)" },
              { name: "model", type: "string", required: true, desc: "사용할 LLM 모델명 (예: gpt-4o, claude-sonnet-4-5-20250514)" },
              { name: "toolRegistry", type: "ToolRegistry", required: true, desc: "사용 가능한 도구(file_read, bash_exec 등)를 관리하는 레지스트리" },
              { name: "strategy", type: "ToolCallStrategy", required: true, desc: "도구 호출 전략 (순차/병렬 등)" },
              { name: "permissionManager", type: "PermissionManager", required: true, desc: "도구 실행 권한을 관리하는 매니저" },
              { name: "commandRegistry", type: "CommandRegistry", required: false, desc: "슬래시 명령(/model, /compact 등)을 관리하는 레지스트리" },
              { name: "contextManager", type: "ContextManager", required: false, desc: "LLM에 보낼 컨텍스트(대화 히스토리)를 관리" },
              { name: "hookRunner", type: "HookRunner", required: false, desc: "사용자 정의 훅(UserPromptSubmit, Stop 등)을 실행" },
              { name: "sessionManager", type: "SessionManager", required: false, desc: "대화 세션의 저장/복원을 관리" },
              { name: "skillManager", type: "SkillManager", required: false, desc: "스킬(재사용 가능한 프롬프트 템플릿)을 관리" },
              { name: "tasks", type: "readonly Task[]", required: false, desc: "표시할 작업 목록 (TaskListView에 전달)" },
              { name: "sessionId", type: "string", required: false, desc: "현재 세션의 고유 ID" },
              { name: "showStatusBar", type: "boolean", required: false, desc: "하단 상태 바 표시 여부 (기본값: true)" },
              { name: "initialLocale", type: "string", required: false, desc: "초기 언어 설정 (기본값: ko)" },
              { name: "initialTone", type: "string", required: false, desc: "초기 어조 설정 (기본값: normal)" },
              { name: "mcpConnector", type: "MCPManagerConnector", required: false, desc: "MCP(Model Context Protocol) 서버 연결 커넥터" },
              { name: "mcpManager", type: "MCPManager", required: false, desc: "MCP 매니저 인스턴스 (연결 상태 관리)" },
            ]}
          />

          {/* PERMISSION_MODE_CYCLE */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            const PERMISSION_MODE_CYCLE
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            Shift+Tab으로 순환하는 권한 모드의 순서를 정의하는 상수 배열입니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">PERMISSION_MODE_CYCLE</span>: <span className="type">readonly PermissionMode[]</span> = [
            {"\n"}{"  "}<span className="str">&quot;default&quot;</span>,{"      "}<span className="cm">{"// 기본 — 위험한 도구만 확인"}</span>
            {"\n"}{"  "}<span className="str">&quot;acceptEdits&quot;</span>,{" "}<span className="cm">{"// 파일 수정 자동 허용"}</span>
            {"\n"}{"  "}<span className="str">&quot;plan&quot;</span>,{"         "}<span className="cm">{"// 읽기 전용 — 수정 불가"}</span>
            {"\n"}{"  "}<span className="str">&quot;dontAsk&quot;</span>,{"      "}<span className="cm">{"// 모든 도구 자동 허용"}</span>
            {"\n"}{"  "}<span className="str">&quot;bypassPermissions&quot;</span>,{" "}<span className="cm">{"// 권한 시스템 완전 우회"}</span>
            {"\n"}];
          </CodeBlock>

          {/* MODE_LABELS */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            const MODE_LABELS
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            상태 바에 표시할 권한 모드의 짧은 레이블을 정의합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">MODE_LABELS</span>: <span className="type">Record&lt;PermissionMode, string&gt;</span> = {"{"}
            {"\n"}{"  "}<span className="prop">default</span>: <span className="str">&quot;Default&quot;</span>,
            {"\n"}{"  "}<span className="prop">acceptEdits</span>: <span className="str">&quot;Accept Edits&quot;</span>,
            {"\n"}{"  "}<span className="prop">plan</span>: <span className="str">&quot;Plan&quot;</span>,
            {"\n"}{"  "}<span className="prop">dontAsk</span>: <span className="str">&quot;Don&apos;t Ask&quot;</span>,
            {"\n"}{"  "}<span className="prop">bypassPermissions</span>: <span className="str">&quot;Bypass&quot;</span>,
            {"\n"}{"}"};
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              App 컴포넌트는 <code className="text-cyan-600">export function App</code>으로 named export됩니다.
              default export가 아닌 점에 주의하세요 (프로젝트 규칙).
            </li>
            <li>
              <code className="text-cyan-600">showStatusBar</code>의 기본값은 <code className="text-cyan-600">true</code>,
              <code className="text-cyan-600">initialLocale</code>은 <code className="text-cyan-600">&quot;ko&quot;</code>,
              <code className="text-cyan-600">initialTone</code>은 <code className="text-cyan-600">&quot;normal&quot;</code>입니다.
            </li>
            <li>
              MCP 연결 상태 메시지는 3초 후 자동으로 사라집니다 (<code className="text-cyan-600">setTimeout</code>).
              연결 실패 시에도 앱은 정상 동작하며, MCP 도구만 사용 불가능합니다.
            </li>
            <li>
              로고 출력은 이 컴포넌트가 아닌 <code className="text-cyan-600">src/index.ts</code>에서
              Ink 렌더링 전에 stdout에 직접 출력됩니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; index.ts에서 렌더링</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            App 컴포넌트는 <code className="text-cyan-600">src/index.ts</code>에서 Ink의
            <code className="text-cyan-600">render()</code>로 마운트됩니다. 필요한 모든 의존성은 Props로 주입합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="type">render</span> {"}"} <span className="kw">from</span> <span className="str">&quot;ink&quot;</span>;
            {"\n"}<span className="kw">import</span> {"{"} <span className="type">App</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./cli/App.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 의존성 생성 (생략)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">client</span> = <span className="fn">createLLMProvider</span>(<span className="prop">config</span>);
            {"\n"}<span className="kw">const</span> <span className="prop">toolRegistry</span> = <span className="fn">createToolRegistry</span>();
            {"\n"}<span className="kw">const</span> <span className="prop">permissionManager</span> = <span className="fn">createPermissionManager</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// Ink로 App 렌더링"}</span>
            {"\n"}<span className="fn">render</span>(
            {"\n"}{"  "}&lt;<span className="type">App</span>
            {"\n"}{"    "}<span className="prop">client</span>={"{"}client{"}"}
            {"\n"}{"    "}<span className="prop">model</span>={"{"}model{"}"}
            {"\n"}{"    "}<span className="prop">toolRegistry</span>={"{"}toolRegistry{"}"}
            {"\n"}{"    "}<span className="prop">strategy</span>={"{"}strategy{"}"}
            {"\n"}{"    "}<span className="prop">permissionManager</span>={"{"}permissionManager{"}"}
            {"\n"}{"    "}<span className="prop">commandRegistry</span>={"{"}commandRegistry{"}"}
            {"\n"}{"    "}<span className="prop">contextManager</span>={"{"}contextManager{"}"}
            {"\n"}{"  "}/&gt;
            {"\n"});
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> App 컴포넌트 내부에서 의존성을 직접 생성하지 마세요.
            모든 인프라 객체는 <code>index.ts</code>에서 생성하여 Props로 주입해야 합니다.
            이를 어기면 테스트 시 모킹이 어려워지고, 의존성 방향 규칙(top &rarr; bottom)을 위반합니다.
          </Callout>

          {/* 키보드 단축키 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            키보드 단축키 시스템
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            App은 <code className="text-cyan-600">useKeybindings</code> 훅을 통해 키보드 단축키를 등록합니다.
            사용자 설정(<code className="text-cyan-600">~/.dbcode/keybindings.json</code>)과 기본값을 병합하여
            최종 키바인딩을 구성합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// actionHandlers — 각 단축키에 연결된 액션"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">actionHandlers</span> = {"{"}
            {"\n"}{"  "}<span className="fn">cancel</span>: () =&gt; events.<span className="fn">emit</span>(<span className="str">&quot;input:abort&quot;</span>),{"     "}<span className="cm">{"// Esc"}</span>
            {"\n"}{"  "}<span className="str">&quot;cycle-mode&quot;</span>: () =&gt; {"{"}...{"}"},{"            "}<span className="cm">{"// Shift+Tab"}</span>
            {"\n"}{"  "}<span className="str">&quot;toggle-verbose&quot;</span>: () =&gt; {"{"}...{"}"},{"        "}<span className="cm">{"// Ctrl+O"}</span>
            {"\n"}{"  "}<span className="fn">exit</span>: () =&gt; process.<span className="fn">exit</span>(<span className="num">0</span>),{"          "}<span className="cm">{"// Ctrl+D"}</span>
            {"\n"}{"  "}<span className="str">&quot;toggle-thinking&quot;</span>: () =&gt; {"{"}...{"}"},{"       "}<span className="cm">{"// Alt+T"}</span>
            {"\n"}{"  "}<span className="str">&quot;toggle-voice&quot;</span>: () =&gt; <span className="fn">toggleRecording</span>(),{"  "}<span className="cm">{"// 음성 토글"}</span>
            {"\n"}{"}"};
          </CodeBlock>

          {/* 이벤트 기반 통신 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            이벤트 기반 통신
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            App은 이벤트 이미터를 통해 하위 컴포넌트 및 코어 모듈과 통신합니다.
            주요 이벤트 채널은 다음과 같습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 주요 이벤트 채널"}</span>
            {"\n"}<span className="str">&quot;input:abort&quot;</span>{"         "}<span className="cm">{"// Esc 키 → 에이전트 루프 중단"}</span>
            {"\n"}<span className="str">&quot;voice:toggle&quot;</span>{"        "}<span className="cm">{"// /voice 명령 → 음성 기능 토글"}</span>
            {"\n"}<span className="str">&quot;permission:mode-change&quot;</span>{" "}<span className="cm">{"// /plan 명령 → 권한 모드 변경"}</span>
            {"\n"}<span className="str">&quot;ask_user:prompt&quot;</span>{"      "}<span className="cm">{"// 에이전트 → 사용자에게 질문"}</span>
            {"\n"}<span className="str">&quot;ask_user:response&quot;</span>{"    "}<span className="cm">{"// 사용자 응답 → 에이전트로 전달"}</span>
          </CodeBlock>

          <DeepDive title="권한 모드 순환 동작 상세">
            <p className="mb-3">
              Shift+Tab을 누르면 <code className="text-cyan-600">cycle-mode</code> 액션이 실행됩니다.
              현재 모드의 인덱스를 찾아 다음 모드로 순환합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// default → acceptEdits → plan → dontAsk → bypass → default..."}</span>
              {"\n"}<span className="kw">const</span> <span className="prop">currentIndex</span> = <span className="prop">PERMISSION_MODE_CYCLE</span>.<span className="fn">indexOf</span>(<span className="prop">permissionMode</span>);
              {"\n"}<span className="kw">const</span> <span className="prop">nextIndex</span> = (<span className="prop">currentIndex</span> + <span className="num">1</span>) % <span className="prop">PERMISSION_MODE_CYCLE</span>.<span className="prop">length</span>;
              {"\n"}<span className="kw">const</span> <span className="prop">nextMode</span> = <span className="prop">PERMISSION_MODE_CYCLE</span>[<span className="prop">nextIndex</span>];
              {"\n"}<span className="prop">permissionManager</span>.<span className="fn">setMode</span>(<span className="prop">nextMode</span>);
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              모드가 변경되면 2초간 노란색 알림 배너가 표시되어 사용자에게 현재 모드를 알려줍니다.
              <code className="text-cyan-600">bypassPermissions</code> 모드는 보안 위험이 있으므로
              프로덕션 환경에서는 주의해서 사용하세요.
            </p>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>컴포넌트 렌더링 트리</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            App 컴포넌트의 JSX 렌더링 순서를 나타냅니다.
            각 컴포넌트는 조건부로 렌더링되며, 상태에 따라 동적으로 표시/숨김됩니다.
          </p>

          <MermaidDiagram
            title="App 렌더링 트리"
            titleColor="purple"
            chart={`graph TD
  EB["ErrorBoundary<br/><small>렌더링 에러 포착</small>"]
  BOX["Box flexDirection=column<br/><small>전체 레이아웃</small>"]
  AF["ActivityFeed<br/><small>대화 히스토리 표시</small>"]
  AS["AgentStatus<br/><small>처리 중 상태 표시</small>"]
  RC["RetryCountdown<br/><small>재시도 카운트다운</small>"]
  PP["PermissionPrompt<br/><small>권한 확인 프롬프트</small>"]
  SL["SelectList<br/><small>대화형 선택 목록</small>"]
  AU["AskUser<br/><small>에이전트 질문 표시</small>"]
  CO["CommandOutput<br/><small>명령 결과 표시</small>"]
  VI["VoiceIndicator<br/><small>음성 입력 상태</small>"]
  ERR["ErrorBanner<br/><small>에러 메시지 표시</small>"]
  NF["Notification<br/><small>단축키 피드백</small>"]
  TL["TaskListView<br/><small>작업 목록</small>"]
  UI["UserInput<br/><small>텍스트 입력</small>"]
  SM["SlashCommandMenu<br/><small>명령 자동완성</small>"]
  SB["StatusBar<br/><small>하단 상태 바</small>"]

  EB --> BOX
  BOX --> AF
  BOX -->|"isProcessing"| AS
  BOX -->|"retryInfo"| RC
  BOX -->|"pendingPermission"| PP
  BOX -->|"interactiveSelect"| SL
  BOX -->|"pendingAskUser"| AU
  BOX -->|"commandOutput"| CO
  BOX -->|"voiceEnabled"| VI
  BOX -->|"error"| ERR
  BOX -->|"notification"| NF
  BOX -->|"tasks"| TL
  BOX --> UI
  BOX -->|"slashMenuVisible"| SM
  BOX -->|"showStatusBar"| SB

  style EB fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style BOX fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style AF fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style UI fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style SB fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style AS fill:#fef3c7,stroke:#d97706,color:#1e293b
  style PP fill:#fef3c7,stroke:#d97706,color:#1e293b
  style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>사용자 입력 제출 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">onUserSubmit</code> 콜백은 사용자 입력을 두 가지 경로로 분기합니다.
            <code className="text-cyan-600">pendingAskUser</code> 대기 중이면 에이전트의 질문에 대한 응답으로 처리하고,
            아니면 일반 에이전트 루프 입력으로 전달합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="fn">onUserSubmit</span> = <span className="fn">useCallback</span>((<span className="prop">input</span>: <span className="type">string</span>) =&gt; {"{"}
            {"\n"}{"  "}<span className="cm">{"// ask_user 대기 중이면 응답으로 전달"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">pendingAskUser</span> && !<span className="prop">pendingAskUser</span>.<span className="prop">choices</span>?.<span className="prop">length</span>) {"{"}
            {"\n"}{"    "}<span className="prop">events</span>.<span className="fn">emit</span>(<span className="str">&quot;ask_user:response&quot;</span>, {"{"}
            {"\n"}{"      "}<span className="prop">toolCallId</span>: <span className="prop">pendingAskUser</span>.<span className="prop">toolCallId</span>,
            {"\n"}{"      "}<span className="prop">answer</span>: <span className="prop">input</span>,
            {"\n"}{"    "}{"}"});
            {"\n"}{"    "}<span className="fn">setPendingAskUser</span>(<span className="kw">null</span>);
            {"\n"}{"    "}<span className="kw">return</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="cm">{"// 일반 입력 → 에이전트 루프에 전달"}</span>
            {"\n"}{"  "}<span className="kw">void</span> <span className="fn">handleSubmit</span>(<span className="prop">input</span>);
            {"\n"}{"}"});
          </CodeBlock>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>MCP 연결 관리</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MCP 매니저가 주입되면 <code className="text-cyan-600">useEffect</code>에서 자동으로
            모든 MCP 서버 연결을 시도합니다. 결과는 StatusBar에 일시적으로 표시됩니다.
          </p>
          <CodeBlock>
            <span className="fn">useEffect</span>(() =&gt; {"{"}
            {"\n"}{"  "}<span className="kw">if</span> (!<span className="prop">mcpManager</span>) <span className="kw">return</span>;
            {"\n"}{"  "}<span className="fn">setMcpStatus</span>(<span className="str">&quot;MCP 연결 중...&quot;</span>);
            {"\n"}{"  "}<span className="prop">mcpManager</span>.<span className="fn">connectAll</span>().<span className="fn">then</span>((<span className="prop">result</span>) =&gt; {"{"}
            {"\n"}{"    "}<span className="cm">{"// 성공: 'MCP: server-name ✓' 표시"}</span>
            {"\n"}{"    "}<span className="cm">{"// 실패: 'MCP: server-name ✗' 표시"}</span>
            {"\n"}{"    "}<span className="fn">setTimeout</span>(() =&gt; <span className="fn">setMcpStatus</span>(<span className="kw">undefined</span>), <span className="num">3000</span>);
            {"\n"}{"  "}{"}"});
            {"\n"}{"}"}, [<span className="prop">mcpManager</span>]);
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
              &quot;슬래시 명령 메뉴가 나타나지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              슬래시 메뉴는 세 가지 조건을 <strong>모두</strong> 만족해야 표시됩니다:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>에이전트가 처리 중이 아닐 것 (<code className="text-cyan-600">!isProcessing</code>)</li>
              <li>권한 프롬프트가 표시되지 않을 것 (<code className="text-cyan-600">!pendingPermission</code>)</li>
              <li>입력이 <code className="text-cyan-600">/</code>로 시작하고 공백이 없을 것 (명령어 이름만 입력 중)</li>
            </ul>
            <p className="text-[13px] text-gray-600 leading-relaxed mt-3">
              또한 <code className="text-cyan-600">commandRegistry</code>가 Props로 전달되지 않으면
              메뉴 자체가 렌더링되지 않습니다.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Shift+Tab으로 권한 모드가 변경되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              권한 프롬프트가 표시 중이면 키바인딩이 비활성화됩니다.
              <code className="text-cyan-600">useKeybindings</code>의 두 번째 인자로
              <code className="text-cyan-600">!pendingPermission</code>을 전달하여,
              프롬프트가 사라진 후에만 단축키가 동작하도록 합니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;MCP 연결 상태가 계속 표시돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              정상적으로는 3초 후 자동으로 사라집니다. 계속 표시된다면 MCP 서버 연결이
              Promise를 resolve하지 않는 상태(hang)일 수 있습니다. MCP 서버 프로세스가
              정상 실행 중인지 확인하세요.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;확장 사고(Extended Thinking) 토글이 안 돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              현재 모델이 확장 사고를 지원하는지 확인하세요.
              <code className="text-cyan-600">getModelCapabilities(activeModel).supportsThinking</code>이
              <code className="text-cyan-600">false</code>이면 토글이 차단되고
              &quot;This model does not support extended thinking&quot; 알림이 표시됩니다.
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
                name: "useAgentLoop (Hook)",
                slug: "use-agent-loop",
                relation: "child",
                desc: "에이전트 루프를 React 훅으로 감싸서 상태 관리와 이벤트 핸들링을 제공",
              },
              {
                name: "UserInput",
                slug: "user-input",
                relation: "child",
                desc: "사용자 텍스트 입력 컴포넌트 — 커서 이동, 히스토리, 자동완성",
              },
              {
                name: "StatusBar",
                slug: "status-bar",
                relation: "child",
                desc: "하단 상태바 — 모델, 토큰 사용량, 비용, 권한 모드 표시",
              },
              {
                name: "ActivityFeed",
                slug: "activity-feed",
                relation: "child",
                desc: "대화 히스토리와 도구 실행 결과를 시각화하는 피드 컴포넌트",
              },
              {
                name: "headless.ts",
                slug: "headless-mode",
                relation: "sibling",
                desc: "비대화형 모드 — Ink UI 대신 stdout으로 결과를 출력하는 대안 진입점",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
