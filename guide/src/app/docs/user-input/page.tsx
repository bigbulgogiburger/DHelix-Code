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

export default function UserInputPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/components/UserInput.tsx" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">UserInput</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              에디터 수준의 기능을 갖춘 터미널 텍스트 입력 컴포넌트입니다. 커서 이동, 히스토리 탐색,
              탭 파일 경로 자동완성, @ 파일 멘션, 다중 줄 입력을 지원합니다.
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
                <code className="text-cyan-600">UserInput</code>은 Ink의{" "}
                <code className="text-cyan-600">useInput</code> 훅을 기반으로 터미널에서 풀 기능
                텍스트 에디터를 구현한 컴포넌트입니다. 단순한 텍스트 입력을 넘어 Emacs 스타일 커서
                이동(Ctrl+A/E/K/U/W), 단어 단위 이동(Alt+화살표), 입력 히스토리 탐색, 파일 경로 Tab
                자동완성, @ 멘션 기반 파일 참조까지 지원합니다.
              </p>
              <p>
                다중 줄 입력도 지원합니다. Enter는 항상 전송(submit)이고, 줄바꿈은{" "}
                <code className="text-cyan-600">Ctrl+J</code>로 삽입합니다. 이는 한국어/CJK IME
                환경에서 Shift+Enter가 정상 동작하지 않는 문제를 우회하기 위한 설계입니다.
              </p>
              <p>
                파일 검색에는 <code className="text-cyan-600">fast-glob</code> 라이브러리를
                사용하며, 검색 깊이는 3단계로 제한하여 성능을 보장합니다. 자동완성과 멘션 후보는
                최대 10개까지 표시됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="UserInput 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  APP["App.tsx<br/><small>루트 컴포넌트</small>"]
  UI["UserInput<br/><small>텍스트 입력 컴포넌트</small>"]
  HIST["useInputHistory<br/><small>입력 히스토리 훅</small>"]
  GLOB["fast-glob<br/><small>파일 경로 검색</small>"]
  SM["SlashCommandMenu<br/><small>명령 자동완성</small>"]
  AL["useAgentLoop<br/><small>에이전트 루프 훅</small>"]

  APP --> UI
  APP --> SM
  UI --> HIST
  UI -->|"Tab 자동완성"| GLOB
  UI -->|"@ 멘션"| GLOB
  UI -->|"onSubmit"| AL
  UI -->|"onChange"| SM

  style UI fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style APP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style HIST fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style GLOB fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style AL fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>설계 원칙:</strong> UserInput은 &quot;입력 수집&quot;에만 집중합니다. 입력된
              텍스트의 처리(에이전트 전달, 슬래시 명령 파싱)는 부모 컴포넌트(App)의 책임입니다.
              <code>onSubmit</code>과 <code>onChange</code> 콜백으로 통신합니다.
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

            {/* UserInputProps interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface UserInputProps
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              UserInput 컴포넌트의 Props를 정의합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "onSubmit",
                  type: "(text: string) => void",
                  required: true,
                  desc: "사용자가 Enter를 눌렀을 때 호출되는 콜백 (트림된 입력 텍스트 전달)",
                },
                {
                  name: "onChange",
                  type: "(value: string) => void",
                  required: false,
                  desc: "입력값이 변경될 때마다 호출되는 콜백 (슬래시 메뉴 표시 등에 활용)",
                },
                {
                  name: "isDisabled",
                  type: "boolean",
                  required: false,
                  desc: "true이면 모든 키 입력을 무시 (기본값: false)",
                },
                {
                  name: "slashMenuVisible",
                  type: "boolean",
                  required: false,
                  desc: "슬래시 명령 메뉴가 표시 중인지 (true이면 방향키/Tab 이벤트를 위임)",
                },
                {
                  name: "placeholder",
                  type: "string",
                  required: false,
                  desc: "빈 입력 시 표시할 안내 텍스트 (기본값: 'Type a message...')",
                },
              ]}
            />

            {/* 키보드 단축키 테이블 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              키보드 단축키
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              UserInput이 처리하는 키보드 단축키 목록입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "Enter",
                  type: "action",
                  required: true,
                  desc: "입력 전송 (@ 멘션 선택 중이면 멘션 확정)",
                },
                {
                  name: "Ctrl+J",
                  type: "action",
                  required: true,
                  desc: "줄바꿈 삽입 (모든 터미널에서 동작)",
                },
                { name: "Ctrl+A", type: "cursor", required: true, desc: "줄 처음으로 이동" },
                { name: "Ctrl+E", type: "cursor", required: true, desc: "줄 끝으로 이동" },
                { name: "Ctrl+K", type: "edit", required: true, desc: "커서부터 줄 끝까지 삭제" },
                { name: "Ctrl+U", type: "edit", required: true, desc: "전체 줄 삭제" },
                { name: "Ctrl+W", type: "edit", required: true, desc: "뒤로 한 단어 삭제" },
                {
                  name: "Ctrl+D",
                  type: "edit",
                  required: true,
                  desc: "앞으로 한 글자 삭제 (빈 줄이면 종료)",
                },
                { name: "Alt+Left/Right", type: "cursor", required: true, desc: "단어 단위 이동" },
                {
                  name: "Up/Down",
                  type: "history",
                  required: true,
                  desc: "입력 히스토리 탐색 또는 멘션 선택",
                },
                {
                  name: "Tab",
                  type: "completion",
                  required: true,
                  desc: "파일 경로 자동완성 또는 후보 순환",
                },
                {
                  name: "@",
                  type: "mention",
                  required: true,
                  desc: "파일 멘션 시작 (이후 파일명 입력)",
                },
                { name: "Escape", type: "cancel", required: true, desc: "자동완성/멘션 취소" },
              ]}
            />

            {/* Helper functions */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              extractCompletionToken(value, cursorOffset)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              커서 위치에서 현재 입력 중인 토큰을 추출합니다. Tab 자동완성의 대상 문자열이 됩니다.
              마지막 공백 이후의 문자열을 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span>{" "}
              <span className="fn">extractCompletionToken</span>(<span className="prop">value</span>
              : <span className="type">string</span>, <span className="prop">cursorOffset</span>:{" "}
              <span className="type">number</span>): <span className="type">string</span>
            </CodeBlock>

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              extractMentionToken(value, cursorOffset)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              커서 위치에서 @ 멘션 토큰을 추출합니다. @와 커서 사이에 공백이 없으면 유효한 멘션으로
              판단합니다. 유효하지 않으면 <code className="text-cyan-600">null</code>을 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">extractMentionToken</span>(
              {"\n"}
              {"  "}
              <span className="prop">value</span>: <span className="type">string</span>,{"\n"}
              {"  "}
              <span className="prop">cursorOffset</span>: <span className="type">number</span>,
              {"\n"}): {"{"} <span className="prop">token</span>:{" "}
              <span className="type">string</span>; <span className="prop">start</span>:{" "}
              <span className="type">number</span> {"}"} | <span className="kw">null</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>한국어/CJK IME 주의:</strong> macOS에서 한국어 입력 시{" "}
                <code className="text-cyan-600">shift=true</code>가 Enter 키 이벤트에도 전파됩니다.
                따라서 Shift+Enter로 줄바꿈을 구분할 수 없으며, 줄바꿈은 반드시{" "}
                <code className="text-cyan-600">Ctrl+J</code>를 사용해야 합니다.
              </li>
              <li>
                Tab 자동완성은 <code className="text-cyan-600">slashMenuVisible</code>이
                <code className="text-cyan-600">true</code>이면 비활성화됩니다 (슬래시 메뉴에 Tab을
                위임).
              </li>
              <li>
                <code className="text-cyan-600">fast-glob</code> 검색 깊이는 3단계로 제한되어
                있습니다. 깊은 디렉토리의 파일은 자동완성에 나타나지 않을 수 있습니다.
              </li>
              <li>
                빈 입력에서 Enter를 누르면 <code className="text-cyan-600">onSubmit</code>이
                호출되지 않습니다 (<code className="text-cyan-600">trimmed.length &gt; 0</code>{" "}
                검사).
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
              기본 사용법 &mdash; App에서 사용하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              App 컴포넌트에서 UserInput을 렌더링하는 패턴입니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="type">UserInput</span> {"}"}{" "}
              <span className="kw">from</span>{" "}
              <span className="str">&quot;./components/UserInput.js&quot;</span>;{"\n"}
              {"\n"}&lt;<span className="type">UserInput</span>
              {"\n"}
              {"  "}
              <span className="prop">onSubmit</span>={"{"}(<span className="prop">text</span>) =&gt;{" "}
              <span className="fn">handleSubmit</span>(<span className="prop">text</span>){"}"}
              {"\n"}
              {"  "}
              <span className="prop">onChange</span>={"{"}(<span className="prop">value</span>)
              =&gt; <span className="fn">setInputValue</span>(<span className="prop">value</span>)
              {"}"}
              {"\n"}
              {"  "}
              <span className="prop">slashMenuVisible</span>={"{"}slashMenuVisible{"}"}
              {"\n"}/&gt;
            </CodeBlock>

            {/* @ 멘션 사용법 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              @ 파일 멘션
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              입력 중 <code className="text-cyan-600">@</code>를 입력하면 파일 멘션 모드가
              시작됩니다. 이후 파일명의 일부를 입력하면 실시간으로 후보가 표시됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 사용자 입력 예시"}</span>
              {"\n"}&gt; 이 파일을 분석해줘 @App
              <span className="cm">{"  ← @ 이후 'App'을 입력하면"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 멘션 후보 표시"}</span>
              {"\n"}
              {"  "}&gt; @src/cli/App.tsx
              {"\n"}
              {"    "}@src/cli/components/AppStatus.tsx
              {"\n"}
              {"    "}@src/core/app-config.ts
              {"\n"}
              {"  "}Up/Down: navigate | Tab: cycle | Enter: select | Esc: cancel
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> @ 멘션은 <code>fast-glob</code>으로{" "}
              <strong>현재 작업 디렉토리</strong>
              (process.cwd())를 기준으로 검색합니다. 프로젝트 루트에서 dbcode를 실행해야 올바른
              파일이 검색됩니다. 숨김 파일(dot 파일)은 검색에서 제외됩니다.
            </Callout>

            {/* Tab 자동완성 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              Tab 파일 경로 자동완성
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              입력 중 Tab 키를 누르면 현재 커서 위치의 토큰을 기준으로 파일 경로 자동완성이
              시작됩니다. Tab을 반복해서 누르면 후보를 순환합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 사용자 입력: 'src/cli/' 이후 Tab"}</span>
              {"\n"}&gt; src/cli/<span className="cm">{"  [Tab]"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 자동완성 후보"}</span>
              {"\n"}
              {"  "}&gt; src/cli/App.tsx
              {"\n"}
              {"    "}src/cli/headless.ts
              {"\n"}
              {"    "}src/cli/setup-wizard.ts
              {"\n"}
              {"    "}...
            </CodeBlock>

            <DeepDive title="다중 줄 입력과 커서 렌더링">
              <p className="mb-3">
                다중 줄 입력 시 각 줄이 독립적으로 렌더링됩니다. 커서가 있는 줄에서만 inverse
                스타일로 커서 위치를 표시하고, 두 번째 줄부터는 파란색 들여쓰기 표시가 추가됩니다.
              </p>
              <CodeBlock>
                <span className="cm">{"// 렌더링 로직 핵심"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">lines</span> ={" "}
                <span className="prop">value</span>.<span className="fn">split</span>(
                <span className="str">&quot;\n&quot;</span>);
                {"\n"}
                <span className="prop">lines</span>.<span className="fn">map</span>((
                <span className="prop">line</span>, <span className="prop">lineIdx</span>) =&gt;{" "}
                {"{"}
                {"\n"}
                {"  "}
                <span className="kw">const</span> <span className="prop">cursorInLine</span> ={" "}
                <span className="cm">{"/* 커서가 이 줄에 있는지 계산 */"}</span>;{"\n"}
                {"  "}
                <span className="kw">if</span> (<span className="prop">cursorInLine</span>) {"{"}
                {"\n"}
                {"    "}
                <span className="cm">{"// before | cursor (inverse) | after"}</span>
                {"\n"}
                {"  "}
                {"}"} <span className="kw">else</span> {"{"}
                {"\n"}
                {"    "}
                <span className="cm">{"// 일반 텍스트만 표시"}</span>
                {"\n"}
                {"  "}
                {"}"}
                {"\n"}
                {"}"});
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                커서 위치는 전체 입력 문자열의 인덱스(
                <code className="text-cyan-600">cursorOffset</code>)로 관리됩니다. 줄 단위 렌더링 시
                각 줄의 시작 인덱스를 계산하여 커서가 어느 줄에 있는지 판단합니다.
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
              키 입력 처리 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">useInput</code> 훅이 키 입력을 받으면, 우선순위에 따라
              각 핸들러가 순차적으로 평가됩니다. 매칭되면 즉시{" "}
              <code className="text-cyan-600">return</code>합니다.
            </p>

            <MermaidDiagram
              title="키 입력 처리 흐름"
              titleColor="purple"
              chart={`graph TD
  INPUT["useInput 키 이벤트<br/><small>input + key 객체</small>"]
  DIS{"isDisabled?"}
  ENTER{"Enter 키?"}
  MENTION_SEL{"멘션 선택 중?"}
  SUBMIT["handleSubmit()<br/><small>입력 전송</small>"]
  MENTION_CONFIRM["멘션 확정<br/><small>@파일명 삽입</small>"]
  CTRL{"Ctrl 조합?"}
  CTRL_ACT["커서/편집 동작<br/><small>A/E/K/U/W/D/J</small>"]
  ESC{"Escape?"}
  CANCEL["자동완성 취소<br/><small>cancelCompletion()</small>"]
  TAB{"Tab?"}
  TAB_ACT["자동완성 시작/순환<br/><small>fast-glob 검색</small>"]
  ARROW{"방향키?"}
  NAV["히스토리/멘션 탐색<br/><small>navigateUp/Down</small>"]
  CHAR["문자 삽입<br/><small>커서 위치에 입력</small>"]

  INPUT --> DIS
  DIS -->|"true"| SKIP(("무시"))
  DIS -->|"false"| ENTER
  ENTER -->|"yes"| MENTION_SEL
  MENTION_SEL -->|"yes"| MENTION_CONFIRM
  MENTION_SEL -->|"no"| SUBMIT
  ENTER -->|"no"| CTRL
  CTRL -->|"yes"| CTRL_ACT
  CTRL -->|"no"| ESC
  ESC -->|"yes"| CANCEL
  ESC -->|"no"| TAB
  TAB -->|"yes"| TAB_ACT
  TAB -->|"no"| ARROW
  ARROW -->|"yes"| NAV
  ARROW -->|"no"| CHAR

  style INPUT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style SUBMIT fill:#dcfce7,stroke:#10b981,color:#065f46
  style MENTION_CONFIRM fill:#dcfce7,stroke:#10b981,color:#065f46
  style CHAR fill:#e0e7ff,stroke:#3b82f6,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              내부 상태 관리
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              UserInput은 6개의 React 상태를 관리합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 핵심 입력 상태"}</span>
              {"\n"}
              <span className="kw">const</span> [<span className="prop">value</span>,{" "}
              <span className="fn">setValue</span>] = <span className="fn">useState</span>(
              <span className="str">&quot;&quot;</span>);{"           "}
              <span className="cm">{"// 현재 입력 텍스트"}</span>
              {"\n"}
              <span className="kw">const</span> [<span className="prop">cursorOffset</span>,{" "}
              <span className="fn">setCursorOffset</span>] = <span className="fn">useState</span>(
              <span className="num">0</span>); <span className="cm">{"// 커서 위치"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// Tab 자동완성 상태"}</span>
              {"\n"}
              <span className="kw">const</span> [<span className="prop">completions</span>,{" "}
              <span className="fn">setCompletions</span>] = <span className="fn">useState</span>&lt;
              <span className="type">string[]</span>&gt;([]);
              {"\n"}
              <span className="kw">const</span> [<span className="prop">completionIndex</span>,{" "}
              <span className="fn">setCompletionIndex</span>] = <span className="fn">useState</span>
              (<span className="num">0</span>);
              {"\n"}
              <span className="kw">const</span> [<span className="prop">isCompleting</span>,{" "}
              <span className="fn">setIsCompleting</span>] = <span className="fn">useState</span>(
              <span className="kw">false</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// @ 멘션 상태"}</span>
              {"\n"}
              <span className="kw">const</span> [<span className="prop">isMentioning</span>,{" "}
              <span className="fn">setIsMentioning</span>] = <span className="fn">useState</span>(
              <span className="kw">false</span>);
              {"\n"}
              <span className="kw">const</span> [<span className="prop">mentionSuggestions</span>,{" "}
              <span className="fn">setMentionSuggestions</span>] ={" "}
              <span className="fn">useState</span>&lt;<span className="type">string[]</span>
              &gt;([]);
              {"\n"}
              <span className="kw">const</span> [<span className="prop">mentionIndex</span>,{" "}
              <span className="fn">setMentionIndex</span>] = <span className="fn">useState</span>(
              <span className="num">0</span>);
            </CodeBlock>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              @ 멘션 검색 트리거
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">useEffect</code>에서 입력값과 커서 위치가 변경될
              때마다 멘션 토큰을 추출하고, 유효한 멘션이면{" "}
              <code className="text-cyan-600">fast-glob</code>으로 파일을 검색합니다.
            </p>
            <CodeBlock>
              <span className="fn">useEffect</span>(() =&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">mention</span> ={" "}
              <span className="fn">extractMentionToken</span>(<span className="prop">value</span>,{" "}
              <span className="prop">cursorOffset</span>);
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">mention</span> &&{" "}
              <span className="prop">mention</span>.<span className="prop">token</span>.
              <span className="prop">length</span> &gt; <span className="num">0</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">pattern</span> ={" "}
              <span className="str">`**/${"{"}</span>
              <span className="prop">mention</span>.<span className="prop">token</span>
              <span className="str">{"}"}*`</span>;{"\n"}
              {"    "}
              <span className="fn">fg</span>(<span className="prop">pattern</span>, {"{"}{" "}
              <span className="prop">deep</span>: <span className="num">3</span>,{" "}
              <span className="prop">onlyFiles</span>: <span className="kw">true</span> {"}"}){"\n"}
              {"      "}.<span className="fn">then</span>((<span className="prop">results</span>)
              =&gt; {"{"}
              {"\n"}
              {"        "}
              <span className="fn">setMentionSuggestions</span>(
              <span className="prop">results</span>.<span className="fn">slice</span>(
              <span className="num">0</span>, <span className="num">10</span>));
              {"\n"}
              {"      "}
              {"}"});
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}, [<span className="prop">value</span>,{" "}
              <span className="prop">cursorOffset</span>]);
            </CodeBlock>
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
                &quot;Enter를 누르면 줄바꿈이 아니라 바로 전송돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                의도된 동작입니다. 한국어/CJK IME 환경에서 Shift+Enter 구분이 불가능하기 때문에,
                Enter는 항상 전송이고 줄바꿈은 <code className="text-cyan-600">Ctrl+J</code>로
                삽입합니다. 이는 macOS에서 한국어 입력 시{" "}
                <code className="text-cyan-600">key.shift</code>가 항상 true로 설정되는 Ink/터미널
                제한 때문입니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Tab 자동완성이 동작하지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">다음을 확인하세요:</p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  슬래시 메뉴가 표시 중이면 Tab이 메뉴에 위임됩니다 (
                  <code className="text-cyan-600">slashMenuVisible</code> 확인).
                </li>
                <li>입력이 비어있으면 자동완성 대상 토큰이 없어 동작하지 않습니다.</li>
                <li>
                  <code className="text-cyan-600">fast-glob</code>은 검색 깊이가 3으로 제한되어 있어
                  깊은 파일은 나오지 않습니다.
                </li>
              </ul>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;@ 멘션에서 원하는 파일이 안 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                멘션 검색은 <code className="text-cyan-600">**/{"{token}"}*</code> 패턴으로
                동작합니다. 파일명의 일부만 입력해도 검색됩니다. 숨김 파일(dot file)은 제외됩니다 (
                <code className="text-cyan-600">dot: false</code>). 최대 10개까지만 표시되며, 검색
                깊이는 3단계로 제한됩니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Ctrl+D를 눌렀더니 프로세스가 종료됐어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                입력이 비어있을 때 Ctrl+D를 누르면{" "}
                <code className="text-cyan-600">process.exit(0)</code>이 호출되어 프로세스가
                종료됩니다. 이는 일반 셸의 EOF(End of File) 동작과 동일합니다. 입력이 비어있지
                않으면 커서 앞의 한 글자만 삭제합니다.
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
                  name: "App.tsx",
                  slug: "app-entry",
                  relation: "parent",
                  desc: "UserInput을 렌더링하고 onSubmit/onChange 콜백을 연결하는 루트 컴포넌트",
                },
                {
                  name: "StatusBar",
                  slug: "status-bar",
                  relation: "sibling",
                  desc: "UserInput 아래에 표시되는 하단 상태바 컴포넌트",
                },
                {
                  name: "ActivityFeed",
                  slug: "activity-feed",
                  relation: "sibling",
                  desc: "UserInput 위에 표시되는 대화 히스토리 피드",
                },
                {
                  name: "useAgentLoop",
                  slug: "use-agent-loop",
                  relation: "child",
                  desc: "UserInput의 onSubmit으로 전달된 입력을 처리하는 에이전트 루프 훅",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
