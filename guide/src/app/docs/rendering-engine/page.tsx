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

export default function RenderingEnginePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/renderer/" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Rendering Engine</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              도구 실행 결과를 ANSI 색상으로 렌더링하는 터미널 출력 엔진입니다. 5개 모듈로 구성:
              tool-display, syntax, markdown, theme, synchronized-output.
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
                <code className="text-cyan-600">renderer/</code> 디렉토리는 CLI의 시각적 출력을
                담당하는 5개 모듈로 구성됩니다. 에이전트가 실행하는 도구의 상태를 사람이 읽기 쉬운
                형태로 변환하고, 마크다운과 코드 블록에 구문 강조를 적용하며, 터미널 깜빡임을
                방지하는 동기화 출력까지 처리합니다.
              </p>
              <p>
                <strong>tool-display.ts</strong>는 핵심 모듈로, 16개 내장 도구와 MCP 도구의 실행
                상태를 헤더, 서브텍스트, diff 미리보기로 변환합니다.
                <strong>syntax.ts</strong>는 shiki 라이브러리로 코드에 ANSI 색상을 입히고,
                <strong>markdown.ts</strong>는 marked + marked-terminal로 마크다운을 터미널용으로
                렌더링합니다.
              </p>
              <p>
                <strong>theme.ts</strong>는 4가지 테마(dark/light/auto/colorblind)의 색상 토큰을
                관리하며,
                <strong>synchronized-output.ts</strong>는 DEC Private Mode 2026을 사용하여 터미널의
                부분 렌더링으로 인한 깜빡임을 제거합니다.
              </p>
            </div>

            <MermaidDiagram
              title="렌더링 엔진 아키텍처"
              titleColor="purple"
              chart={`graph TD
  TCB["ToolCallBlock<br/><small>React 컴포넌트</small>"]
  AF["ActivityFeed<br/><small>React 컴포넌트</small>"]
  TD["tool-display.ts<br/><small>도구 상태 렌더링</small>"]
  SY["syntax.ts<br/><small>shiki 구문 강조</small>"]
  MD["markdown.ts<br/><small>마크다운 렌더링</small>"]
  TH["theme.ts<br/><small>4가지 테마</small>"]
  SO["synchronized-output.ts<br/><small>DEC 2026 동기화</small>"]
  INK["Ink stdout<br/><small>터미널 출력</small>"]

  TCB -->|"getToolHeaderInfo()"| TD
  TCB -->|"getToolPreview()"| TD
  AF -->|"getToolDisplayText()"| TD
  MD -->|"highlightCodeSync()"| SY
  TCB --> TH
  SO -->|"patchInkRendering()"| INK

  style TD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style SY fill:#dbeafe,stroke:#3b82f6,color:#1e293b,stroke-width:2px
  style MD fill:#dbeafe,stroke:#3b82f6,color:#1e293b,stroke-width:2px
  style TH fill:#dcfce7,stroke:#10b981,color:#1e293b,stroke-width:2px
  style SO fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style TCB fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style AF fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style INK fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 게임 엔진이 3D 모델을 화면에 렌더링하듯, 이 모듈은 도구 호출
              데이터를 터미널 화면에 렌더링합니다. 도구마다 다른 &quot;셰이더&quot;(표시 설정)가
              적용되어, 파일 읽기는 파란색, 편집은 시안색, bash는 노란색으로 표시됩니다.
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

            {/* ── tool-display.ts ── */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
              <h3 className="text-lg font-bold text-violet-600 mb-4">📄 tool-display.ts</h3>

              {/* ToolHeaderInfo */}
              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "16px", marginBottom: "12px" }}
              >
                interface ToolHeaderInfo
              </h4>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                도구 헤더 정보입니다. ToolCallBlock 컴포넌트의 상단에 표시됩니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "header",
                    type: "string",
                    required: true,
                    desc: '메인 헤더 텍스트 (예: "Read src/App.tsx")',
                  },
                  {
                    name: "color",
                    type: "string",
                    required: true,
                    desc: "헤더 색상 (Ink 색상명: blue, cyan, yellow 등)",
                  },
                  {
                    name: "subtext",
                    type: "string | undefined",
                    required: false,
                    desc: '추가 정보 (예: "352 lines", "exit 0")',
                  },
                ]}
              />

              {/* ToolDisplayConfig */}
              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "24px", marginBottom: "12px" }}
              >
                interface ToolDisplayConfig
              </h4>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                도구별 표시 설정입니다. 실행 중/완료 시 동사, 색상, 상세 정보 추출기를 정의합니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "running",
                    type: "string",
                    required: true,
                    desc: '실행 중 동사 (예: "Reading", "Running")',
                  },
                  {
                    name: "complete",
                    type: "string",
                    required: true,
                    desc: '완료 동사 (예: "Read", "Ran")',
                  },
                  {
                    name: "headerVerb",
                    type: "string",
                    required: true,
                    desc: '헤더에 표시할 동사 (예: "Read", "Bash")',
                  },
                  {
                    name: "runningHeaderVerb",
                    type: "string",
                    required: true,
                    desc: '실행 중 헤더 동사 (예: "Reading", "Running")',
                  },
                  {
                    name: "headerColor",
                    type: "string",
                    required: true,
                    desc: "헤더 색상 (blue, cyan, yellow, magenta, green, red)",
                  },
                  {
                    name: "extractDetail",
                    type: "function",
                    required: false,
                    desc: "인수/출력/메타에서 상세 정보 추출",
                  },
                  {
                    name: "extractPreview",
                    type: "function",
                    required: false,
                    desc: "diff 또는 출력 미리보기 추출",
                  },
                  {
                    name: "extractHeaderArg",
                    type: "function",
                    required: false,
                    desc: "헤더에 표시할 주요 인수 추출",
                  },
                  {
                    name: "extractSubtext",
                    type: "function",
                    required: false,
                    desc: "서브텍스트 추출 (줄 수, 바이트 수 등)",
                  },
                ]}
              />

              {/* getToolHeaderInfo */}
              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "24px", marginBottom: "12px" }}
              >
                getToolHeaderInfo(name, status, args?, output?, duration?, metadata?)
              </h4>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                도구의 헤더 정보를 생성합니다. <code className="text-cyan-600">toolDisplayMap</code>
                에 정의된 설정을 기반으로 동사, 인수, 서브텍스트를 조합합니다.
              </p>
              <CodeBlock>
                <span className="fn">getToolHeaderInfo</span>(
                <span className="str">&quot;file_read&quot;</span>,{" "}
                <span className="str">&quot;complete&quot;</span>, args, output)
                {"\n"}
                <span className="cm">
                  {'// → { header: "Read src/App.tsx", color: "blue", subtext: "352 lines" }'}
                </span>
              </CodeBlock>

              {/* getToolDisplayText */}
              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "24px", marginBottom: "12px" }}
              >
                getToolDisplayText(name, status, args?, output?, duration?, metadata?)
              </h4>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                도구의 상태를 한 줄 텍스트로 반환합니다.
              </p>
              <CodeBlock>
                <span className="fn">getToolDisplayText</span>(
                <span className="str">&quot;bash_exec&quot;</span>,{" "}
                <span className="str">&quot;complete&quot;</span>, args, output,{" "}
                <span className="num">1500</span>){"\n"}
                <span className="cm">{'// → "Ran ls -la — exit 0 (1.5s)"'}</span>
              </CodeBlock>

              {/* getToolPreview */}
              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "24px", marginBottom: "12px" }}
              >
                getToolPreview(name, status, args?, output?, metadata?)
              </h4>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                도구 상태 줄 아래에 표시할 미리보기 스니펫을 반환합니다. file_edit는 diff,
                bash_exec는 출력 미리보기를 제공합니다.
              </p>

              {/* toolDisplayMap 도구 목록 */}
              <h4 className="text-base font-bold text-gray-900 mt-6 mb-3">
                등록된 도구 렌더링 설정
              </h4>
              <div className="text-[13px] text-gray-600 space-y-1">
                <p>
                  &bull; <code className="text-blue-600">file_read</code> &mdash; 파란색, 줄 수/범위
                  표시, 이미지/PDF/노트북 유형 감지
                </p>
                <p>
                  &bull; <code className="text-cyan-600">file_write</code> &mdash; 시안색, 줄 수 +
                  바이트 크기 표시
                </p>
                <p>
                  &bull; <code className="text-cyan-600">file_edit</code> &mdash; 시안색, +/-줄 수 +
                  diff 미리보기
                </p>
                <p>
                  &bull; <code className="text-yellow-600">bash_exec</code> &mdash; 노란색, 명령어
                  표시 + 출력 미리보기 (최대 5줄)
                </p>
                <p>
                  &bull; <code className="text-yellow-600">bash_output</code> &mdash; 노란색,
                  프로세스 ID 표시
                </p>
                <p>
                  &bull; <code className="text-red-600">kill_shell</code> &mdash; 빨간색, 프로세스
                  ID + 시그널 표시
                </p>
                <p>
                  &bull; <code className="text-pink-600">glob_search</code> &mdash; 마젠타, 매칭
                  파일 수 표시
                </p>
                <p>
                  &bull; <code className="text-pink-600">grep_search</code> &mdash; 마젠타, 패턴 +
                  매칭 수 표시
                </p>
                <p>
                  &bull; <code className="text-pink-600">web_fetch / web_search</code> &mdash;
                  마젠타, URL + 크기/결과 수
                </p>
                <p>
                  &bull; <code className="text-blue-600">list_dir</code> &mdash; 파란색, 디렉토리
                  경로 + 항목 수
                </p>
                <p>
                  &bull; <code className="text-green-600">agent</code> &mdash; 초록색, 에이전트 타입
                  + 설명
                </p>
                <p>
                  &bull; <code className="text-yellow-600">todo_write / ask_user</code> &mdash;
                  노란색, 진행률/질문 표시
                </p>
                <p>
                  &bull; <code className="text-gray-500">MCP 도구</code> &mdash; 도구명에서 유형을
                  휴리스틱으로 판별하여 색상 자동 할당
                </p>
              </div>
            </div>

            {/* ── syntax.ts ── */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
              <h3 className="text-lg font-bold text-violet-600 mb-4">📄 syntax.ts</h3>
              <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
                shiki 라이브러리를 사용하여 코드를 ANSI 24비트 True Color로 구문 강조합니다. VS
                Code와 동일한 TextMate 문법을 사용하여 정확한 토큰 분석을 제공합니다.
              </p>

              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "16px", marginBottom: "12px" }}
              >
                initHighlighter()
              </h4>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                shiki 하이라이터 싱글톤을 미리 워밍합니다. 앱 시작 시 호출하면 첫 사용 시 지연이
                없습니다.
              </p>
              <CodeBlock>
                <span className="kw">async function</span>{" "}
                <span className="fn">initHighlighter</span>():{" "}
                <span className="type">Promise&lt;void&gt;</span>
              </CodeBlock>

              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "24px", marginBottom: "12px" }}
              >
                highlightCodeSync(code, language)
              </h4>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                동기 방식 구문 강조입니다. 마크다운 렌더링에서 사용됩니다. 하이라이터가 초기화되지
                않았으면 일반 텍스트를 반환합니다.
              </p>
              <CodeBlock>
                <span className="kw">function</span> <span className="fn">highlightCodeSync</span>(
                <span className="prop">code</span>: <span className="type">string</span>,{" "}
                <span className="prop">language</span>: <span className="type">string</span>):{" "}
                <span className="type">string</span>
              </CodeBlock>

              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "24px", marginBottom: "12px" }}
              >
                highlightCode(code, language, theme?)
              </h4>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                비동기 방식 구문 강조입니다. 언어가 지원되지 않으면 원본 코드를 반환합니다. 기본
                테마는 <code className="text-cyan-600">github-dark</code>입니다.
              </p>

              <h4 className="text-base font-bold text-gray-900 mt-4 mb-3">지원 언어 별칭</h4>
              <div className="text-[13px] text-gray-600 space-y-1">
                <p>
                  &bull; <code className="text-cyan-600">js</code> = javascript,{" "}
                  <code className="text-cyan-600">ts</code> = typescript,{" "}
                  <code className="text-cyan-600">py</code> = python
                </p>
                <p>
                  &bull; <code className="text-cyan-600">rb</code> = ruby,{" "}
                  <code className="text-cyan-600">sh/shell</code> = bash,{" "}
                  <code className="text-cyan-600">yml</code> = yaml,{" "}
                  <code className="text-cyan-600">md</code> = markdown
                </p>
                <p>&bull; shiki의 모든 내장 언어(200+)도 직접 사용 가능</p>
              </div>
            </div>

            {/* ── markdown.ts ── */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
              <h3 className="text-lg font-bold text-violet-600 mb-4">📄 markdown.ts</h3>
              <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
                marked + marked-terminal을 사용하여 마크다운을 터미널용 ANSI 출력으로 변환합니다.
                코드 블록에는 <code className="text-cyan-600">syntax.ts</code>의 구문 강조가 자동
                적용됩니다.
              </p>

              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "16px", marginBottom: "12px" }}
              >
                renderMarkdown(text)
              </h4>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                마크다운 텍스트를 ANSI 이스케이프 코드가 포함된 터미널용 문자열로 변환합니다. 실패
                시 원본 텍스트를 반환합니다.
              </p>
              <CodeBlock>
                <span className="kw">function</span> <span className="fn">renderMarkdown</span>(
                <span className="prop">text</span>: <span className="type">string</span>):{" "}
                <span className="type">string</span>
              </CodeBlock>

              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "24px", marginBottom: "12px" }}
              >
                hasMarkdown(text)
              </h4>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                텍스트에 마크다운 서식이 포함되어 있는지 빠르게 확인합니다. 마크다운이 없으면{" "}
                <code className="text-cyan-600">renderMarkdown</code>을 건너뛰어 성능을 절약합니다.
              </p>
              <CodeBlock>
                <span className="kw">function</span> <span className="fn">hasMarkdown</span>(
                <span className="prop">text</span>: <span className="type">string</span>):{" "}
                <span className="type">boolean</span>
                {"\n"}
                <span className="cm">
                  {"// #, *, `, [, ], _, ~, >, |, ```, 목록(-/*) 패턴 감지"}
                </span>
              </CodeBlock>

              <div className="text-[13px] text-gray-600 mt-3 space-y-1">
                <p>
                  &bull; <strong>코드 블록:</strong> 언어 지원 시{" "}
                  <code className="text-cyan-600">highlightCodeSync()</code>로 구문 강조
                </p>
                <p>
                  &bull; <strong>링크:</strong> OSC 8 하이퍼링크 (지원 터미널에서 클릭 가능)
                </p>
                <p>
                  &bull; <strong>텍스트 리플로:</strong> 터미널 너비(
                  <code className="text-cyan-600">process.stdout.columns</code>)에 맞게 자동 줄바꿈
                </p>
              </div>
            </div>

            {/* ── theme.ts ── */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
              <h3 className="text-lg font-bold text-violet-600 mb-4">📄 theme.ts</h3>
              <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
                4가지 테마를 관리하는 테마 시스템입니다. 모든 UI 컴포넌트에서 일관된 색상 토큰을
                제공합니다.
              </p>

              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "16px", marginBottom: "12px" }}
              >
                type ThemeName
              </h4>
              <CodeBlock>
                <span className="kw">type</span> <span className="type">ThemeName</span> ={" "}
                <span className="str">&quot;dark&quot;</span> |{" "}
                <span className="str">&quot;light&quot;</span> |{" "}
                <span className="str">&quot;auto&quot;</span> |{" "}
                <span className="str">&quot;colorblind&quot;</span>
              </CodeBlock>

              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "24px", marginBottom: "12px" }}
              >
                interface ThemeColors
              </h4>
              <ParamTable
                params={[
                  {
                    name: "primary",
                    type: "string",
                    required: true,
                    desc: "주요 색상 (dark: cyan, light: blue)",
                  },
                  {
                    name: "secondary",
                    type: "string",
                    required: true,
                    desc: "보조 색상 (magenta)",
                  },
                  {
                    name: "success",
                    type: "string",
                    required: true,
                    desc: "성공 (dark: green, colorblind: blue)",
                  },
                  { name: "warning", type: "string", required: true, desc: "경고 (yellow)" },
                  { name: "error", type: "string", required: true, desc: "에러 (red)" },
                  {
                    name: "info",
                    type: "string",
                    required: true,
                    desc: "정보 (dark: blue, light: cyan)",
                  },
                  { name: "muted", type: "string", required: true, desc: "흐린 텍스트 (gray)" },
                  {
                    name: "text",
                    type: "string",
                    required: true,
                    desc: "기본 텍스트 (dark: white, light: black)",
                  },
                  {
                    name: "highlight",
                    type: "string",
                    required: true,
                    desc: "강조 (dark: yellowBright)",
                  },
                  {
                    name: "code",
                    type: "string",
                    required: true,
                    desc: "코드 (dark: greenBright)",
                  },
                ]}
              />

              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "24px", marginBottom: "12px" }}
              >
                getTheme(name) / setActiveTheme(name) / getActiveTheme()
              </h4>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                테마 조회, 전역 활성 테마 변경, 현재 테마 조회 함수입니다.
                <code className="text-cyan-600">&quot;auto&quot;</code>는{" "}
                <code className="text-cyan-600">COLORFGBG</code> 환경변수로 시스템 테마를 자동
                감지합니다.
              </p>
            </div>

            {/* ── synchronized-output.ts ── */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
              <h3 className="text-lg font-bold text-violet-600 mb-4">📄 synchronized-output.ts</h3>
              <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
                DEC Private Mode 2026을 사용하여 터미널 출력의 깜빡임을 제거합니다. Ghostty, iTerm2
                3.5+, WezTerm, kitty, VSCode 터미널, tmux 3.4+ 등을 지원합니다.
              </p>

              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "16px", marginBottom: "12px" }}
              >
                withSynchronizedOutput(fn)
              </h4>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                함수 실행을 동기화 마커로 감쌉니다. 실행 전에 BEGIN, 실행 후에 END를 보냅니다.
              </p>
              <CodeBlock>
                <span className="fn">withSynchronizedOutput</span>(() =&gt; {"{"}
                {"\n"}
                {"  "}
                <span className="cm">{"// 이 블록의 모든 출력이 터미널에 원자적으로 표시됨"}</span>
                {"\n"}
                {"  "}
                <span className="fn">renderFrame</span>();
                {"\n"}
                {"}"});
              </CodeBlock>

              <h4
                className="text-base font-bold text-indigo-600 font-mono"
                style={{ marginTop: "24px", marginBottom: "12px" }}
              >
                patchInkRendering()
              </h4>
              <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
                Ink의 <code className="text-cyan-600">stdout.write</code>를 몽키패치하여 렌더
                사이클을 자동으로 동기화 출력으로 감쌉니다. Ink의{" "}
                <code className="text-cyan-600">render()</code> 전에 한 번만 호출하세요.
              </p>
            </div>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">toolDisplayMap</code>에 없는 도구는 기본 형식
                (&quot;Running tool_name&quot; / &quot;Tool tool_name&quot;)으로 표시됩니다. 새
                도구를 추가할 때 이 맵에 항목을 추가하세요.
              </li>
              <li>
                <code className="text-cyan-600">highlightCodeSync()</code>는 하이라이터가
                <code className="text-cyan-600">initHighlighter()</code>로 워밍되기 전에는 일반
                텍스트를 반환합니다. 앱 시작 시 워밍을 호출하세요.
              </li>
              <li>
                <code className="text-cyan-600">patchInkRendering()</code>은{" "}
                <code className="text-cyan-600">process.stdout.write</code>를 교체합니다. 다른
                라이브러리와 충돌할 수 있으므로 한 번만 호출하세요.
              </li>
              <li>
                <code className="text-cyan-600">colorblind</code> 테마는
                적록색맹(protanopia/deuteranopia) 안전입니다. success 색상으로 green 대신 blue를
                사용합니다.
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

            {/* 도구 헤더 렌더링 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 도구 실행 상태 렌더링
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              도구 호출의 이름, 상태, 인수를 전달하면 사람이 읽기 쉬운 헤더와 서브텍스트를
              반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="fn">getToolHeaderInfo</span>
              , <span className="fn">getToolPreview</span> {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./tool-display.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 실행 중인 도구의 헤더 정보"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">info</span> ={" "}
              <span className="fn">getToolHeaderInfo</span>({"\n"}
              {"  "}
              <span className="str">&quot;file_read&quot;</span>,{" "}
              <span className="str">&quot;running&quot;</span>,{"\n"}
              {"  "}
              {"{"} <span className="prop">file_path</span>:{" "}
              <span className="str">&quot;src/App.tsx&quot;</span> {"}"},{"\n"});
              {"\n"}
              <span className="cm">{'// → { header: "Reading src/App.tsx", color: "blue" }'}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 완료된 도구의 diff 미리보기"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">preview</span> ={" "}
              <span className="fn">getToolPreview</span>({"\n"}
              {"  "}
              <span className="str">&quot;file_edit&quot;</span>,{" "}
              <span className="str">&quot;complete&quot;</span>,{"\n"}
              {"  "}
              {"{"} <span className="prop">old_string</span>:{" "}
              <span className="str">&quot;foo&quot;</span>, <span className="prop">new_string</span>
              : <span className="str">&quot;bar&quot;</span> {"}"},{"\n"});
              {"\n"}
              <span className="cm">{"// → diff 미리보기 문자열 (줄 번호 + 삭제/추가 줄)"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 새 도구를 추가할 때 <code>toolDisplayMap</code>에 항목을
              추가하지 않으면, &quot;Running tool_name&quot; / &quot;Tool tool_name&quot; 같은 기본
              형식으로 표시됩니다. 사용자 경험을 위해 반드시 도구별 설정을 추가하세요.
            </Callout>

            {/* 마크다운 렌더링 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              마크다운 렌더링 + 구문 강조
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              LLM 응답에 마크다운이 포함되어 있으면 터미널용으로 렌더링합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="fn">renderMarkdown</span>,{" "}
              <span className="fn">hasMarkdown</span> {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./markdown.js&quot;</span>;{"\n"}
              <span className="kw">import</span> {"{"} <span className="fn">initHighlighter</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./syntax.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 앱 시작 시 하이라이터 워밍 (선택적이지만 권장)"}</span>
              {"\n"}
              <span className="kw">await</span> <span className="fn">initHighlighter</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// LLM 응답 렌더링"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">text</span> ={" "}
              <span className="prop">llmResponse</span>.<span className="prop">content</span>;{"\n"}
              <span className="kw">const</span> <span className="prop">rendered</span> ={" "}
              <span className="fn">hasMarkdown</span>(<span className="prop">text</span>){"\n"}
              {"  "}? <span className="fn">renderMarkdown</span>(<span className="prop">text</span>)
              {"\n"}
              {"  "}: <span className="prop">text</span>;
            </CodeBlock>

            {/* 테마 설정 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 테마 변경과 동기화 출력
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              테마를 변경하고 동기화 출력을 활성화하는 방법입니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="fn">setActiveTheme</span>,{" "}
              <span className="fn">getActiveTheme</span> {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./theme.js&quot;</span>;{"\n"}
              <span className="kw">import</span> {"{"} <span className="fn">patchInkRendering</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./synchronized-output.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 테마 변경 (auto는 시스템 감지)"}</span>
              {"\n"}
              <span className="fn">setActiveTheme</span>(
              <span className="str">&quot;auto&quot;</span>);
              {"\n"}
              <span className="kw">const</span> <span className="prop">theme</span> ={" "}
              <span className="fn">getActiveTheme</span>();
              {"\n"}
              <span className="cm">{"// → theme.colors.primary, theme.colors.error 등 사용"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// Ink 렌더링 전에 동기화 출력 패치 (한 번만)"}</span>
              {"\n"}
              <span className="fn">patchInkRendering</span>();
            </CodeBlock>

            <DeepDive title="MCP 도구의 자동 색상 할당">
              <p className="mb-3">
                <code className="text-cyan-600">toolDisplayMap</code>에 없는 MCP 도구는 도구
                이름에서 유형을 휴리스틱으로 판별하여 색상을 자동 할당합니다.
              </p>
              <div className="text-[13px] text-gray-600 space-y-1">
                <p>
                  &bull; <code className="text-cyan-600">&quot;search&quot;</code> 포함 &rarr;
                  마젠타, &quot;Searching&quot; 동사
                </p>
                <p>
                  &bull; <code className="text-cyan-600">&quot;read&quot;</code> 또는{" "}
                  <code className="text-cyan-600">&quot;get&quot;</code> 포함 &rarr; 파랑,
                  &quot;Reading&quot; 동사
                </p>
                <p>
                  &bull; <code className="text-cyan-600">&quot;write/create/edit/update&quot;</code>{" "}
                  포함 &rarr; 시안, &quot;Writing&quot; 동사
                </p>
                <p>
                  &bull; <code className="text-cyan-600">&quot;navigate/click/snapshot&quot;</code>{" "}
                  포함 &rarr; 초록, &quot;Browsing&quot; 동사
                </p>
                <p>
                  &bull; <code className="text-cyan-600">&quot;run/execute/eval&quot;</code> 포함
                  &rarr; 노랑, &quot;Running&quot; 동사
                </p>
                <p>&bull; 기본값 &rarr; 회색, &quot;Running&quot; 동사</p>
              </div>
              <p className="mt-3 text-gray-600">
                헤더에는 <code className="text-cyan-600">[MCP:서버명] 도구명</code> 형태로
                표시됩니다. 예:{" "}
                <code className="text-cyan-600">[MCP:playwright] browser_click</code>
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
              렌더링 파이프라인 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              도구 호출 데이터가 최종 터미널 출력으로 변환되는 전체 파이프라인입니다.
            </p>

            <MermaidDiagram
              title="렌더링 파이프라인"
              titleColor="purple"
              chart={`graph LR
  DATA["도구 호출 데이터<br/><small>name, args, output</small>"]
  MAP["toolDisplayMap<br/><small>도구별 설정 조회</small>"]
  MCP_H["getMCPToolDisplay<br/><small>MCP 도구 휴리스틱</small>"]
  HEADER["헤더 + 서브텍스트<br/><small>동사 + 인수 조합</small>"]
  PREVIEW["미리보기<br/><small>diff, 출력 요약</small>"]
  THEME["ThemeColors<br/><small>색상 토큰 적용</small>"]
  SYNC["동기화 출력<br/><small>DEC 2026 감싸기</small>"]
  OUT["터미널 출력<br/><small>ANSI 색상 포함</small>"]

  DATA --> MAP
  DATA -->|"mcp__ 접두사"| MCP_H
  MAP --> HEADER
  MCP_H --> HEADER
  MAP --> PREVIEW
  HEADER --> THEME
  PREVIEW --> THEME
  THEME --> SYNC
  SYNC --> OUT

  style MAP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style MCP_H fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style SYNC fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style OUT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              동기화 출력 핵심 코드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">patchInkRendering()</code>의 핵심 로직입니다. Ink의
              렌더 사이클을 감지하여 동기화 마커를 자동 삽입합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// DEC Private Mode 2026 이스케이프 시퀀스"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">BEGIN</span> ={" "}
              <span className="str">&quot;\\x1b[?2026h&quot;</span>;{" "}
              <span className="cm">{"// hold (버퍼링 시작)"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">END</span> ={" "}
              <span className="str">&quot;\\x1b[?2026l&quot;</span>;{" "}
              <span className="cm">{"// let go (버퍼 플러시)"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// Ink의 렌더 사이클 감지: 커서 이동 시퀀스로 시작"}</span>
              {"\n"}
              <span className="kw">if</span> (<span className="prop">str</span>.
              <span className="fn">startsWith</span>(<span className="str">&quot;\\x1b[&quot;</span>
              ) || <span className="prop">str</span>.<span className="fn">startsWith</span>(
              <span className="str">&quot;\\x1b7&quot;</span>)) {"{"}
              {"\n"}
              {"  "}
              <span className="fn">originalWrite</span>(<span className="prop">BEGIN</span>);
              {"\n"}
              {"  "}
              <span className="fn">originalWrite</span>(<span className="prop">chunk</span>);
              {"\n"}
              {"  "}
              <span className="fn">queueMicrotask</span>(() =&gt;{" "}
              <span className="fn">originalWrite</span>(<span className="prop">END</span>));
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">BEGIN</strong> 시퀀스를 보내면 터미널이 출력을
                버퍼에 모으기 시작합니다.
              </p>
              <p>
                <strong className="text-gray-900">END</strong> 시퀀스를 보내면 버퍼의 내용을
                한꺼번에 화면에 표시합니다.
              </p>
              <p>
                <strong className="text-gray-900">queueMicrotask</strong>를 사용하여 Ink의 전체 렌더
                사이클이 완료된 후에 END를 보냅니다. 이로써 전체 프레임이 원자적으로 표시됩니다.
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
                &quot;코드 블록에 색상이 적용되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">initHighlighter()</code>가 호출되었는지 확인하세요.
                하이라이터가 초기화되기 전에는{" "}
                <code className="text-cyan-600">highlightCodeSync()</code>가 일반 텍스트를
                반환합니다. 또한 터미널이 24비트 True Color를 지원하는지 확인하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;화면이 깜빡거려요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">patchInkRendering()</code>이 앱 시작 시 호출되었는지
                확인하세요. 또한 터미널이 DEC Private Mode 2026을 지원하는지 확인하세요. 지원하지
                않는 터미널에서는 이스케이프 시퀀스가 무시되므로 깜빡임이 발생할 수 있습니다.
                Ghostty, iTerm2 3.5+, WezTerm, kitty를 권장합니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;MCP 도구가 회색으로 표시돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                MCP 도구 이름에 search, read, get, write 등의 키워드가 포함되지 않으면 기본 회색이
                적용됩니다. 색상을 변경하려면{" "}
                <code className="text-cyan-600">getMCPToolDisplay()</code>의 휴리스틱 규칙을
                수정하거나, <code className="text-cyan-600">toolDisplayMap</code>에 직접 도구를
                등록하세요.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;밝은 터미널에서 글자가 잘 안 보여요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">setActiveTheme(&quot;light&quot;)</code> 또는
                <code className="text-cyan-600">setActiveTheme(&quot;auto&quot;)</code>를
                사용하세요.
                <code className="text-cyan-600">&quot;auto&quot;</code>는{" "}
                <code className="text-cyan-600">COLORFGBG</code>
                환경변수를 분석하여 자동으로 적절한 테마를 선택합니다.
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
                  name: "ActivityFeed.tsx",
                  slug: "activity-feed",
                  relation: "parent",
                  desc: "getToolDisplayText()를 사용하여 완료된 도구 호출을 Static 라인으로 표시",
                },
                {
                  name: "tool-registry.ts",
                  slug: "tool-registry",
                  relation: "sibling",
                  desc: "도구 등록/조회 — tool-display에서 도구 이름으로 렌더링 설정을 매핑",
                },
                {
                  name: "mcp-manager.ts",
                  slug: "mcp-manager",
                  relation: "sibling",
                  desc: "MCP 서버 관리 — MCP 도구의 서버명/도구명을 파싱하여 렌더링에 활용",
                },
                {
                  name: "useAgentLoop.ts",
                  slug: "use-agent-loop",
                  relation: "parent",
                  desc: "에이전트 루프 브릿지 — 도구 실행 이벤트를 렌더링 엔진에 전달",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
