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

export default function HookAutoLintPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilePath path="src/hooks/auto-lint.ts" />
              <LayerBadge layer="leaf" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
              <span className="text-gray-900">Hook Auto-Lint</span>
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[640px]">
              파일 수정 도구 실행 후{" "}
              <span className="text-cyan-600 font-semibold">린터를 자동으로 실행</span>하여 코드
              품질 문제를 즉시 에이전트에게 피드백하는 모듈입니다. .ts, .py, .go, .rs 등{" "}
              <span className="text-violet-600 font-semibold">다중 언어 린터</span>를 지원합니다.
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
            <p className="text-[14px] text-gray-600 leading-relaxed mb-4">
              에이전트가 파일을 수정한 뒤 린트 에러를 즉시 발견하지 못하면, 다음 도구 호출에서야
              문제를 알게 됩니다. auto-lint는{" "}
              <code className="text-cyan-600 text-xs">file_write</code>나{" "}
              <code className="text-cyan-600 text-xs">file_edit</code> 완료 직후{" "}
              <strong className="text-gray-900">lint:request 이벤트</strong>를 발행하여 CLI 레이어가
              린터를 실행하게 합니다. 린트 에러가 있으면 에이전트 대화에 피드백이 주입되어{" "}
              <span className="text-violet-600 font-semibold">자동 수정 루프</span>가 시작됩니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>이벤트 기반 설계:</strong> auto-lint는 린트 명령을 직접 실행하지 않습니다.{" "}
              <code className="text-cyan-600 text-xs">lint:request</code> 이벤트를 발행하면 CLI
              레이어가 실제 실행을 담당합니다. 이를 통해 Core 레이어가 CLI 의존성 없이 동작합니다.
            </Callout>

            <MermaidDiagram
              title="자동 린트 피드백 루프"
              titleColor="cyan"
              chart={`flowchart LR
  EDIT["file_edit / file_write<br/><small>파일 수정 완료</small>"]
  REGISTER["registerAutoLint()<br/><small>tool:complete 리스너</small>"]
  EVENT["lint:request 이벤트<br/><small>{ toolName, lintCommand }</small>"]
  CLI["CLI 레이어<br/><small>실제 린트 실행</small>"]
  FEEDBACK["buildLintFeedback()<br/><small>에러 분석 → 메시지</small>"]
  AGENT["에이전트 대화<br/><small>피드백 주입 → 자동 수정</small>"]

  EDIT -->|tool:complete 이벤트| REGISTER
  REGISTER -->|emit| EVENT
  EVENT --> CLI
  CLI -->|결과| FEEDBACK
  FEEDBACK -->|에러 있을 때| AGENT

  style EDIT fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style REGISTER fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style EVENT fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b
  style FEEDBACK fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style AGENT fill:#f8fafc,stroke:#ef4444,color:#ef4444,stroke-width:2px`}
            />
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

            {/* AutoLintConfig */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">AutoLintConfig</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                  interface
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                자동 린트 피드백 루프의 설정 인터페이스입니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "enabled",
                    type: "boolean",
                    required: true,
                    desc: "자동 린트 활성화 여부 (기본값: true)",
                  },
                  {
                    name: "lintCommand",
                    type: "string",
                    required: true,
                    desc: '실행할 린트 명령어 (기본값: "npx eslint --no-warn-ignored")',
                  },
                  {
                    name: "testCommand",
                    type: "string?",
                    required: false,
                    desc: "실행할 테스트 명령어 (선택, 기본값: 없음)",
                  },
                  {
                    name: "maxIterations",
                    type: "number",
                    required: true,
                    desc: "무한 루프 방지를 위한 최대 자동 수정 반복 횟수 (기본값: 3)",
                  },
                ]}
              />
            </div>

            {/* registerAutoLint */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">registerAutoLint()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                이벤트 버스에 자동 린트 핸들러를 등록합니다.{" "}
                <code className="text-cyan-600 text-xs">tool:complete</code> 이벤트를 수신하여 파일
                수정 도구가 성공적으로 완료되면{" "}
                <code className="text-cyan-600 text-xs">lint:request</code> 이벤트를 발행합니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "events",
                    type: "AppEventEmitter",
                    required: true,
                    desc: "앱 이벤트 에미터",
                  },
                  {
                    name: "_hookRunner",
                    type: "HookRunner",
                    required: true,
                    desc: "훅 러너 (현재 미사용, 향후 확장용)",
                  },
                  {
                    name: "config",
                    type: "AutoLintConfig",
                    required: false,
                    desc: "자동 린트 설정 (기본값: DEFAULT_AUTO_LINT_CONFIG)",
                  },
                ]}
              />
            </div>

            {/* buildLintFeedback */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">buildLintFeedback()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                린트 결과 배열을 분석하여 에이전트에게 전달할 피드백 메시지를 생성합니다. 에러가
                없으면 <code className="text-cyan-600 text-xs">null</code>을 반환합니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "results",
                    type: "readonly AutoLintResult[]",
                    required: true,
                    desc: "자동 린트 결과 배열",
                  },
                ]}
              />
              <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 text-[13px] text-gray-600">
                <span className="font-bold text-gray-900">반환값:</span>{" "}
                <code className="text-cyan-600 text-xs">string | null</code> — 에러가 있으면 피드백
                문자열, 없으면 null
              </div>
            </div>

            {/* createAutoLintHookRule */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">createAutoLintHookRule()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                파일 확장자에 맞는 PostToolUse 훅 규칙을 생성합니다.{" "}
                <code className="text-cyan-600 text-xs">file_edit</code>과{" "}
                <code className="text-cyan-600 text-xs">file_write</code> 도구에 매칭되며, 해당
                확장자의 린터를 command 핸들러로 실행합니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "fileExtension",
                    type: "string",
                    required: true,
                    desc: '대상 파일 확장자 (예: ".ts", ".py")',
                  },
                  {
                    name: "config",
                    type: "AutoLintHookRuleConfig",
                    required: false,
                    desc: "훅 규칙 설정 (기본값: { enabled: true })",
                  },
                ]}
              />
              <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 text-[13px] text-gray-600">
                <span className="font-bold text-gray-900">반환값:</span>{" "}
                <code className="text-cyan-600 text-xs">HookRule | null</code> — 비활성이거나 미지원
                확장자면 null
              </div>
            </div>

            {/* 지원 언어 */}
            <div className="mb-4">
              <h3 className="text-[15px] font-bold mb-3">지원 언어별 기본 린터</h3>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-20">.ts/.tsx</code>
                    <span>
                      <code className="text-cyan-600 text-xs">npx eslint --fix $FILE_PATH</code>{" "}
                      (폴백: Prettier)
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-20">.js/.jsx</code>
                    <span>
                      <code className="text-cyan-600 text-xs">npx eslint --fix $FILE_PATH</code>{" "}
                      (폴백: Prettier)
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-20">.py</code>
                    <span>
                      <code className="text-cyan-600 text-xs">
                        ruff check --fix $FILE_PATH || black $FILE_PATH
                      </code>
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-20">.go</code>
                    <span>
                      <code className="text-cyan-600 text-xs">gofmt -w $FILE_PATH</code>
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-20">.rs</code>
                    <span>
                      <code className="text-cyan-600 text-xs">rustfmt $FILE_PATH</code>
                    </span>
                  </div>
                </div>
              </div>

              <Callout type="warn" icon="⚠️">
                <code className="text-red-600 text-xs">$FILE_PATH</code>는 런타임에 실제 파일 경로로
                치환됩니다. 린터가 설치되어 있지 않으면 명령이 실패하지만,{" "}
                <code className="text-cyan-600 text-xs">blocking: false</code>로 설정되어 있으므로
                에이전트 실행이 중단되지 않습니다.
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

            <h3 className="text-[15px] font-bold" style={{ marginTop: "0", marginBottom: "16px" }}>
              기본 등록
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              앱 초기화 시 <code className="text-cyan-600 text-xs">registerAutoLint()</code>를
              호출하면 파일 수정 이벤트에 자동으로 반응합니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">registerAutoLint</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./hooks/auto-lint.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#8b949e]">
                {"// 기본 설정으로 등록 (ESLint, maxIterations: 3)"}
              </span>
              {"\n"}
              <span className="text-[#d2a8ff]">registerAutoLint</span>
              <span className="text-[#c9d1d9]">(events, hookRunner);</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 커스텀 설정으로 등록"}</span>
              {"\n"}
              <span className="text-[#d2a8ff]">registerAutoLint</span>
              <span className="text-[#c9d1d9]">(events, hookRunner, {"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">enabled</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">true</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">lintCommand</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"pnpm eslint --fix"'}</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">testCommand</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"pnpm test --run"'}</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">maxIterations</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">5</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"});</span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              훅 규칙 생성
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">createAutoLintHookRule()</code>로 파일
              확장자별 PostToolUse 훅 규칙을 생성하여 훅 로더에 주입할 수 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">createAutoLintHookRule</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./hooks/auto-lint.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">tsRule</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#d2a8ff]">createAutoLintHookRule</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"ts"'}</span>
              <span className="text-[#c9d1d9]">);</span>
              {"\n"}
              <span className="text-[#8b949e]">
                {"// → { matcher: 'file_edit|file_write', hooks: [{ type: 'command', ... }] }"}
              </span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 커스텀 린터 재정의"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">pyRule</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#d2a8ff]">createAutoLintHookRule</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"py"'}</span>
              <span className="text-[#c9d1d9]">, {"{"}</span>{" "}
              <span className="text-[#79c0ff]">enabled</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">true</span>
              <span className="text-[#c9d1d9]">,</span>{" "}
              <span className="text-[#79c0ff]">linterOverride</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"mypy $FILE_PATH"'}</span>{" "}
              <span className="text-[#c9d1d9]">{"}"});</span>
            </CodeBlock>

            <DeepDive title="린터 명령어 우선순위">
              <p className="mb-3">린터 명령어는 다음 우선순위로 결정됩니다:</p>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                  <div className="flex gap-3">
                    <span className="text-emerald-600 font-bold shrink-0 w-8">1순위</span>
                    <span>
                      <code className="text-cyan-600 text-xs">config.linterOverride</code> —
                      사용자가 명시적으로 지정한 명령어
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-blue-600 font-bold shrink-0 w-8">2순위</span>
                    <span>
                      <code className="text-cyan-600 text-xs">DEFAULT_LINTERS</code> — 확장자별 기본
                      린터 (ESLint, ruff, gofmt, rustfmt)
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-amber-600 font-bold shrink-0 w-8">3순위</span>
                    <span>Prettier 폴백 — JS/TS 계열 파일에만 적용</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-gray-500 font-bold shrink-0 w-8">null</span>
                    <span>지원하지 않는 확장자 — 훅 규칙 생성 안 됨</span>
                  </div>
                </div>
              </div>
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

            <h3 className="text-[15px] font-bold" style={{ marginTop: "0", marginBottom: "16px" }}>
              이벤트 흐름
            </h3>

            <MermaidDiagram
              title="registerAutoLint 내부 이벤트 흐름"
              titleColor="purple"
              chart={`stateDiagram-v2
  [*] --> Listening: registerAutoLint() 호출
  Listening --> CheckTool: tool:complete 이벤트 수신
  CheckTool --> Ignore: 파일 수정 도구 아님 / isError
  CheckTool --> Emit: file_write 또는 file_edit 성공
  Emit --> Listening: lint:request 이벤트 발행
  Ignore --> Listening

  note right of Emit
    emit("lint:request", {
      toolName, toolId,
      lintCommand, testCommand
    })
  end note`}
            />

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              extractMutatedFiles
            </h3>
            <p className="text-[13px] text-gray-600 mb-4">
              도구 출력에서 수정된 파일 경로를 추출합니다. "wrote", "created", "edited", "modified"
              패턴을 우선 검색하고, 없으면 파일 확장자 패턴(
              <code className="text-cyan-600 text-xs">[^\s]+\.[a-zA-Z]{"{1,10}"}</code>)으로
              폴백합니다.
            </p>

            <Callout type="info" icon="📝">
              <strong>non-blocking 린트:</strong> 생성되는 훅 규칙의{" "}
              <code className="text-cyan-600 text-xs">blocking: false</code>로 설정됩니다. 린트가
              실패해도 에이전트 흐름이 중단되지 않으며, 피드백만 주입됩니다. 린트 에러를 강제로
              차단하려면 <code className="text-cyan-600 text-xs">blocking: true</code>로 변경하면
              됩니다.
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
                  <span className="text-red-600">Q.</span> 린트가 자동 실행되지 않습니다
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <code className="text-cyan-600 text-xs">registerAutoLint()</code>가 앱 초기화
                    시점에 호출되었는지 확인하세요.{" "}
                    <code className="text-cyan-600 text-xs">config.enabled</code>가{" "}
                    <code className="text-cyan-600 text-xs">false</code>이면 즉시 반환합니다. 이벤트
                    에미터 인스턴스가 에이전트 루프와 동일한 인스턴스인지도 확인하세요.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> "npx eslint" 명령을 찾을 수 없습니다
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    ESLint가 프로젝트에 설치되어 있지 않거나 node_modules가 없습니다.{" "}
                    <code className="text-cyan-600 text-xs">lintCommand</code>를{" "}
                    <code className="text-cyan-600 text-xs">"./node_modules/.bin/eslint"</code> 같은
                    직접 경로로 설정하거나,{" "}
                    <code className="text-cyan-600 text-xs">enabled: false</code>로 비활성화하세요.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 에이전트가 무한 수정 루프에 빠집니다
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <code className="text-cyan-600 text-xs">maxIterations</code>를 줄이세요 (기본값:
                    3). 린터가 자동으로 고칠 수 없는 에러를 계속 보고하면 루프가 반복됩니다. 린터
                    설정(예: <code className="text-cyan-600 text-xs">.eslintrc</code>)을 검토하여
                    자동 수정 불가 규칙을 비활성화하는 것도 방법입니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> Python 파일에 ruff가 없습니다
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    ruff가 설치되어 있지 않으면 black으로 폴백됩니다(
                    <code className="text-cyan-600 text-xs">||</code> 연산). black도 없으면 명령이
                    실패하지만 non-blocking이므로 에이전트는 계속 실행됩니다.
                    <code className="text-cyan-600 text-xs"> linterOverride</code>로 직접 경로를
                    지정하는 것을 권장합니다.
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
                  name: "hooks/runner.ts",
                  slug: "hook-runner",
                  relation: "parent",
                  desc: "훅 실행 엔진 — auto-lint가 생성한 HookRule을 실제로 실행",
                },
                {
                  name: "hooks/loader.ts",
                  slug: "hook-loader",
                  relation: "sibling",
                  desc: "settings.json의 훅 설정을 로드 — auto-lint 훅 규칙과 함께 동작",
                },
                {
                  name: "hooks/team-events.ts",
                  slug: "hook-team-events",
                  relation: "sibling",
                  desc: "팀 이벤트 훅 — auto-lint와 함께 훅 시스템을 구성하는 다른 통합 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
