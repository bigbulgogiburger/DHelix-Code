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

export default function CmdInitPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/commands/init.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              /init 프로젝트 초기화
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            프로젝트의 DBCODE.md와 .dbcode/ 디렉토리를 생성하여 AI 코딩 어시스턴트의 프로젝트 이해를 돕는 초기화 명령어입니다.
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
              <code className="text-cyan-600">/init</code>은 프로젝트를 dbcode와 함께 사용하기 위한 첫 번째 단계입니다.
              이 명령어는 프로젝트 루트에 <code className="text-cyan-600">DBCODE.md</code> 파일과
              <code className="text-cyan-600">.dbcode/</code> 설정 디렉토리를 생성합니다.
            </p>
            <p>
              두 가지 실행 모드를 지원합니다. <strong>CLI 모드</strong>(<code>dbcode init</code>)는
              LLM 없이 프로젝트 설정 파일을 분석하여 정적 템플릿을 생성하고,
              <strong>세션 내 모드</strong>(<code>/init</code>)는 LLM이 12단계 분석으로 풍부한 문서를 생성합니다.
            </p>
            <p>
              추가로 <strong>인터랙티브 모드</strong>(<code>/init -i</code>)를 지원하여 사용자와 4단계
              대화를 통해 맞춤형 DBCODE.md를 생성할 수 있습니다. 모듈 구조는 4개의 하위 파일로 분리되어
              각 책임을 명확히 합니다.
            </p>
          </div>

          <MermaidDiagram
            title="/init 명령어 아키텍처"
            titleColor="purple"
            chart={`graph TD
  INIT["init.ts<br/><small>명령어 진입점</small>"]
  CFG["config-setup.ts<br/><small>.dbcode/ 디렉토리 생성</small>"]
  ANALYSIS["analysis-prompt.ts<br/><small>12단계 LLM 분석 프롬프트</small>"]
  TMPL["template-generator.ts<br/><small>15+ 프로젝트 타입 감지</small>"]
  IFLOW["interactive-flow.ts<br/><small>4단계 대화형 플로우</small>"]
  AGENT["Agent Loop<br/><small>LLM 분석 실행</small>"]

  INIT -->|"세션 내 모드"| CFG
  INIT -->|"일반 모드"| ANALYSIS
  INIT -->|"-i 플래그"| IFLOW
  INIT -->|"CLI 폴백"| TMPL
  ANALYSIS -->|"shouldInjectAsUserMessage"| AGENT
  IFLOW -->|"shouldInjectAsUserMessage"| AGENT

  style INIT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CFG fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style ANALYSIS fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TMPL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style IFLOW fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style AGENT fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>핵심 원리:</strong> /init의 세션 내 모드는 직접 파일을 쓰지 않습니다.
            대신 <code>shouldInjectAsUserMessage: true</code>로 LLM에게 분석 프롬프트를 전달하여
            에이전트 루프가 코드베이스를 탐색하고 DBCODE.md를 작성하게 합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* InitResult interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface InitResult
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            CLI 모드에서 <code className="text-cyan-600">initProject()</code>의 반환값입니다.
            프로젝트 초기화 결과를 나타냅니다.
          </p>
          <ParamTable
            params={[
              { name: "created", type: "boolean", required: true, desc: "새로운 파일/디렉토리가 생성되었으면 true, 이미 존재하면 false" },
              { name: "path", type: "string", required: true, desc: ".dbcode/ 디렉토리의 절대 경로" },
              { name: "detail", type: "object | undefined", required: false, desc: "세부 생성 정보 (dbcodeMdCreated, configDirCreated)" },
            ]}
          />

          {/* initProject function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            initProject(cwd)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            CLI 폴백용 프로젝트 초기화 함수입니다. <code className="text-cyan-600">dbcode init</code> 명령으로
            에이전트 루프 외부에서 호출됩니다. DBCODE.md와 .dbcode/ 디렉토리를 독립적으로 처리하여,
            각각 없는 경우에만 생성합니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">initProject</span>(<span className="prop">cwd</span>: <span className="type">string</span>): <span className="type">Promise</span>&lt;<span className="type">InitResult</span>&gt;
          </CodeBlock>
          <ParamTable
            params={[
              { name: "cwd", type: "string", required: true, desc: "프로젝트 루트 디렉토리 경로" },
            ]}
          />

          {/* initCommand */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            initCommand: SlashCommand
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            /init 슬래시 명령어 정의입니다. 인자에 따라 일반 모드 또는 인터랙티브 모드로 분기합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 사용법"}</span>
            {"\n"}<span className="str">/init</span>{"                "}<span className="cm">{"// 일반 모드: 12단계 LLM 분석"}</span>
            {"\n"}<span className="str">/init -i</span>{"             "}<span className="cm">{"// 인터랙티브 모드: 4단계 대화형"}</span>
            {"\n"}<span className="str">/init --interactive</span>{"  "}<span className="cm">{"// 인터랙티브 모드 (풀네임)"}</span>
          </CodeBlock>

          {/* 하위 모듈 테이블 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            하위 모듈 구조
          </h3>
          <ParamTable
            params={[
              { name: "config-setup.ts", type: "모듈", required: true, desc: ".dbcode/ 디렉토리 생성, .gitignore 관리, 기본 settings.json 작성" },
              { name: "analysis-prompt.ts", type: "모듈", required: true, desc: "12단계 코드베이스 분석 프롬프트 빌더 (7가지 분석 항목)" },
              { name: "template-generator.ts", type: "모듈", required: true, desc: "15+ 프로젝트 타입 자동 감지 후 정적 DBCODE.md 템플릿 생성" },
              { name: "interactive-flow.ts", type: "모듈", required: true, desc: "4단계 대화형 초기화 플로우 (사용자 선택 → 탐색 → 질문 → 확인)" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              DBCODE.md와 .dbcode/ 디렉토리는 <strong>독립적</strong>입니다.
              git clone으로 한쪽만 존재할 수 있으며, 각각 없는 경우에만 생성합니다.
            </li>
            <li>
              세션 내 모드의 <code className="text-cyan-600">refreshInstructions: true</code>는
              생성 후 프로젝트 설정을 자동으로 다시 로드하여 즉시 반영합니다.
            </li>
            <li>
              CLI 모드는 LLM을 사용하지 않으므로 <code className="text-cyan-600">template-generator.ts</code>의
              정적 분석에 의존합니다. 더 풍부한 결과를 원하면 세션 내 <code>/init</code>을 사용하세요.
            </li>
            <li>
              <code className="text-cyan-600">DBCODE.local.md</code>는 자동으로 .gitignore에 추가되어
              개인 설정이 팀 리포지토리에 커밋되지 않도록 보호합니다.
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

          {/* CLI 모드 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>CLI 모드 &mdash; 빠른 프로젝트 셋업</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            터미널에서 <code className="text-cyan-600">dbcode init</code>을 실행하면 LLM 없이
            프로젝트 설정 파일(package.json, tsconfig.json 등)을 분석하여 기본 DBCODE.md를 생성합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 터미널에서 실행"}</span>
            {"\n"}<span className="fn">$</span> <span className="str">dbcode init</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 결과:"}</span>
            {"\n"}<span className="cm">{"//   .dbcode/settings.json  — 모델 및 도구 설정"}</span>
            {"\n"}<span className="cm">{"//   .dbcode/rules/         — 커스텀 규칙 디렉토리"}</span>
            {"\n"}<span className="cm">{"//   DBCODE.md              — 프로젝트 가이드 (정적 템플릿)"}</span>
          </CodeBlock>

          {/* 세션 내 모드 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>세션 내 모드 &mdash; LLM 기반 12단계 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            세션 안에서 <code className="text-cyan-600">/init</code>을 입력하면 LLM이 코드베이스를
            12단계로 심층 분석하여 풍부한 DBCODE.md를 자동 생성합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 세션 내에서 슬래시 명령어로 실행"}</span>
            {"\n"}<span className="str">/init</span>
            {"\n"}
            {"\n"}<span className="cm">{"// LLM이 수행하는 12단계:"}</span>
            {"\n"}<span className="cm">{"//  1. 프로젝트 설정 파일 읽기 (package.json, Cargo.toml 등)"}</span>
            {"\n"}<span className="cm">{"//  2. 디렉토리 구조 탐색"}</span>
            {"\n"}<span className="cm">{"//  3. README.md 검토"}</span>
            {"\n"}<span className="cm">{"//  4. 핵심 소스 파일 패턴 분석"}</span>
            {"\n"}<span className="cm">{"//  5. git 히스토리 확인"}</span>
            {"\n"}<span className="cm">{"//  6. 모노레포 구조 감지"}</span>
            {"\n"}<span className="cm">{"//  7. CI/CD 설정 읽기"}</span>
            {"\n"}<span className="cm">{"//  8. 환경변수 확인"}</span>
            {"\n"}<span className="cm">{"//  9. Docker 설정 분석"}</span>
            {"\n"}<span className="cm">{"// 10. 테스트 구조 분석"}</span>
            {"\n"}<span className="cm">{"// 11. 기존 규칙 중복 방지"}</span>
            {"\n"}<span className="cm">{"// 12. 진입점 의존성 추적"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> 이미 DBCODE.md가 존재하면 <strong>업데이트 모드</strong>로 전환됩니다.
            LLM이 기존 파일을 먼저 읽고, 누락되거나 오래된 내용을 보완합니다.
            기존 내용을 덮어쓰지 않고 개선하는 방식입니다.
          </Callout>

          {/* 인터랙티브 모드 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 인터랙티브 모드 (4단계 대화형)
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">/init -i</code>는 사용자와 4단계 대화를 통해
            맞춤형 DBCODE.md를 생성합니다. 원샷 분석과 달리 사용자의 피드백을 반영할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="str">/init -i</span>
            {"\n"}
            {"\n"}<span className="cm">{"// Phase 1: 사용자 선택 — 생성할 항목 선택"}</span>
            {"\n"}<span className="cm">{"//   \"다음 중 생성할 항목을 선택하세요:\""}</span>
            {"\n"}<span className="cm">{"//   1. DBCODE.md  2. rules/  3. 커스텀 규칙"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// Phase 2: 서브에이전트 탐색 — 깊이 분석"}</span>
            {"\n"}<span className="cm">{"//   서브에이전트가 코드베이스를 탐색하고 요약 보고"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// Phase 3: 후속 질문 — 명확화"}</span>
            {"\n"}<span className="cm">{"//   \"배포 대상 환경은?\", \"특별한 워크플로우?\""}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// Phase 4: 미리보기 및 확인"}</span>
            {"\n"}<span className="cm">{"//   초안 표시 → 사용자 확인(y/n/수정사항)"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> 대규모 프로젝트(50+ 소스 파일)에서는 인터랙티브 모드가 서브에이전트를
            활용하여 메인 컨텍스트를 오염시키지 않고 깊은 탐색을 수행합니다.
          </Callout>

          <DeepDive title="생성되는 .dbcode/ 디렉토리 구조">
            <p className="mb-3">
              <code className="text-cyan-600">ensureConfigDir()</code>가 생성하는 기본 디렉토리 구조입니다.
              이미 존재하면 건드리지 않습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// .dbcode/ 디렉토리 구조"}</span>
              {"\n"}<span className="prop">.dbcode/</span>
              {"\n"}{"  "}<span className="prop">settings.json</span>{"    "}<span className="cm">{"// 모델: 기본값, 허용 도구 6개"}</span>
              {"\n"}{"  "}<span className="prop">rules/</span>
              {"\n"}{"    "}<span className="prop">.gitkeep</span>{"         "}<span className="cm">{"// 빈 디렉토리 유지"}</span>
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              <code className="text-cyan-600">settings.json</code>에는 기본 모델과 6개의 허용 도구
              (<code>file_read</code>, <code>file_write</code>, <code>file_edit</code>,
              <code>bash_exec</code>, <code>glob_search</code>, <code>grep_search</code>)가
              설정됩니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>실행 플로우 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            /init 명령어는 모드에 따라 다른 경로를 따릅니다.
            CLI 모드는 정적 템플릿을 직접 생성하고, 세션 내 모드는 LLM에게 프롬프트를 주입합니다.
          </p>

          <MermaidDiagram
            title="/init 실행 플로우"
            titleColor="purple"
            chart={`graph TD
  START(("시작")) --> MODE{"실행 모드?"}
  MODE -->|"dbcode init<br/>(CLI)"| CLI["initProject()"]
  MODE -->|"/init<br/>(세션 내)"| SESSION["execute()"]

  CLI --> CHK_EXIST{"DBCODE.md +<br/>.dbcode/ 존재?"}
  CHK_EXIST -->|"둘 다 존재"| SKIP["건너뜀<br/>created: false"]
  CHK_EXIST -->|"일부 없음"| CREATE["없는 것만 생성"]
  CREATE --> TMPL["generateTemplate()<br/>15+ 타입 감지"]
  TMPL --> WRITE["DBCODE.md 작성"]

  SESSION --> CFGDIR["ensureConfigDir()"]
  CFGDIR --> GITIGN["ensureGitignoreEntry()"]
  GITIGN --> IFLAG{"-i 플래그?"}
  IFLAG -->|"있음"| INTER["buildInteractivePrompt()<br/>4단계 대화형"]
  IFLAG -->|"없음"| ANAL["buildAnalysisPrompt()<br/>12단계 분석"]
  INTER --> INJECT["shouldInjectAsUserMessage"]
  ANAL --> INJECT

  style START fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style MODE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style CLI fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SESSION fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style INJECT fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            슬래시 명령어의 <code className="text-cyan-600">execute()</code> 함수는 3단계로 작동합니다.
          </p>
          <CodeBlock>
            <span className="fn">execute</span>: <span className="kw">async</span> (<span className="prop">args</span>, <span className="prop">context</span>) =&gt; {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">cwd</span> = <span className="prop">context</span>.<span className="prop">workingDirectory</span>;
            {"\n"}{"  "}<span className="kw">const</span> {"{"} <span className="prop">interactive</span> {"}"} = <span className="fn">parseInteractiveArgs</span>(<span className="prop">args</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// Phase 1: .dbcode/ 디렉토리 구조 생성"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">configDirCreated</span> = <span className="kw">await</span> <span className="fn">ensureConfigDir</span>(<span className="prop">cwd</span>);
            {"\n"}{"  "}<span className="kw">await</span> <span className="fn">ensureGitignoreEntry</span>(<span className="prop">cwd</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// Phase 2: DBCODE.md 존재 여부 확인"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">dbcodeMdExists</span> = <span className="kw">await</span> <span className="fn">fileExists</span>(...);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// Phase 3: 모드에 따라 적절한 프롬프트 구성"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">prompt</span> = <span className="prop">interactive</span>
            {"\n"}{"    "}? <span className="fn">buildInteractivePrompt</span>(<span className="prop">configDirCreated</span>, <span className="prop">dbcodeMdExists</span>)
            {"\n"}{"    "}: <span className="fn">buildAnalysisPrompt</span>(<span className="prop">dbcodeMdExists</span>, <span className="prop">configDirCreated</span>);
            {"\n"}
            {"\n"}{"  "}<span className="kw">return</span> {"{"}
            {"\n"}{"    "}<span className="prop">output</span>: <span className="prop">prompt</span>,
            {"\n"}{"    "}<span className="prop">shouldInjectAsUserMessage</span>: <span className="kw">true</span>,
            {"\n"}{"    "}<span className="prop">refreshInstructions</span>: <span className="kw">true</span>,
            {"\n"}{"  "}{"}"};
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">shouldInjectAsUserMessage</strong> &mdash; 프롬프트가 사용자 메시지로 에이전트 루프에 주입됩니다. LLM이 이 지시에 따라 코드베이스를 분석합니다.</p>
            <p><strong className="text-gray-900">refreshInstructions</strong> &mdash; DBCODE.md 생성 후 프로젝트 설정을 자동으로 다시 로드합니다. 새로 생성된 규칙이 즉시 적용됩니다.</p>
            <p><strong className="text-gray-900">독립적 산출물</strong> &mdash; DBCODE.md와 .dbcode/는 서로 독립적으로 존재할 수 있어, git clone 환경에서도 안전하게 동작합니다.</p>
          </div>

          <DeepDive title="template-generator의 15+ 프로젝트 감지 목록">
            <p className="mb-3">
              CLI 모드에서 사용되는 정적 템플릿 생성기는 다음 설정 파일들을 감지합니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><strong>Node.js:</strong> package.json (이름, 스크립트, 모듈 타입, 워크스페이스)</li>
              <li><strong>TypeScript:</strong> tsconfig.json (strict, target, module, path aliases)</li>
              <li><strong>Rust:</strong> Cargo.toml (edition, workspace members, features)</li>
              <li><strong>Go:</strong> go.mod (모듈 경로, Go 버전)</li>
              <li><strong>Python:</strong> pyproject.toml (빌드 시스템: poetry/hatch/setuptools)</li>
              <li><strong>Java:</strong> pom.xml (Spring Boot, 모듈), build.gradle(.kts)</li>
              <li><strong>Ruby:</strong> Gemfile (Ruby/Rails 버전)</li>
              <li><strong>CI/CD:</strong> .github/workflows/, .gitlab-ci.yml, Jenkinsfile</li>
              <li><strong>Container:</strong> Dockerfile (베이스 이미지), docker-compose (서비스)</li>
              <li><strong>환경변수:</strong> .env.example (변수명, 값 제외)</li>
              <li><strong>모노레포:</strong> nx.json, turbo.json, lerna.json</li>
              <li><strong>빌드:</strong> Makefile (주요 타겟, 최대 10개)</li>
              <li><strong>테스트:</strong> vitest.config, jest.config, pytest.ini</li>
            </ul>
          </DeepDive>
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
              &quot;/init을 실행했는데 DBCODE.md가 생성되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              세션 내 <code>/init</code>은 직접 파일을 생성하지 않습니다.
              LLM에게 분석 프롬프트를 주입하여 에이전트 루프가 작성하게 합니다.
              LLM이 분석을 완료하고 <code>file_write</code> 도구로 파일을 생성할 때까지 기다려주세요.
            </p>
            <Callout type="tip" icon="*">
              즉시 기본 템플릿이 필요하다면 터미널에서 <code>dbcode init</code>을 사용하세요.
              LLM 없이 정적 템플릿이 바로 생성됩니다.
            </Callout>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;이미 DBCODE.md가 있는데 /init을 다시 실행하면 덮어쓰나요?&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              아닙니다. DBCODE.md가 이미 존재하면 <strong>업데이트 모드</strong>로 전환됩니다.
              LLM이 기존 파일을 먼저 읽고, 누락된 부분을 보완하거나 오래된 내용을 갱신합니다.
              CLI 모드(<code>dbcode init</code>)에서는 이미 존재하면 아예 건드리지 않습니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;인터랙티브 모드에서 Phase가 건너뛰어져요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              인터랙티브 모드의 4단계 플로우는 LLM에게 &quot;각 단계에서 사용자 입력을 기다리라&quot;고
              지시하는 프롬프트입니다. LLM이 지시를 무시하고 건너뛸 수 있습니다.
              이 경우 &quot;Phase 3부터 다시 진행해주세요&quot;라고 명시적으로 요청하세요.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;.gitignore에 DBCODE.local.md가 추가되지 않았어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">ensureGitignoreEntry()</code>는 .gitignore 파일이
              <strong>이미 존재하는 경우에만</strong> 항목을 추가합니다. 프로젝트 루트에 .gitignore가 없으면
              아무 작업도 수행하지 않습니다. <code>git init</code>으로 .gitignore를 먼저 생성하세요.
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
                name: "config-loader.ts",
                slug: "config-loader",
                relation: "sibling",
                desc: "DBCODE.md를 포함한 5-Layer 설정 병합 — /init이 생성한 파일을 로드하는 모듈",
              },
              {
                name: "instruction-loader.ts",
                slug: "instruction-loader",
                relation: "sibling",
                desc: "DBCODE.md의 규칙을 시스템 프롬프트에 주입하는 인스트럭션 로더",
              },
              {
                name: "skill-manager.ts",
                slug: "skill-manager",
                relation: "sibling",
                desc: "슬래시 명령어 등록 및 실행 — /init 명령어를 관리하는 스킬 매니저",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
