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

export default function CmdAgentsPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/agents.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/agents 에이전트 관리</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              프로젝트 및 사용자 디렉토리에 등록된 에이전트 정의 파일을 조회하고 관리하는
              명령어입니다.
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
                <code className="text-cyan-600">/agents</code>는 사용자가 정의한 에이전트 프로필을
                조회하고 관리하는 명령어입니다. 에이전트란 특정 역할(코드 리뷰, 보안 분석, 아키텍처
                설계 등)을 수행하도록 미리 정의된 AI 어시스턴트 프로필입니다.
              </p>
              <p>
                에이전트 정의는 마크다운 파일(<code className="text-cyan-600">.md</code>)로
                작성되며, YAML 프론트매터에 이름, 모델, 최대 턴 수, 권한 모드 등의 메타데이터를
                포함합니다.
                <strong>프로젝트 스코프</strong>(<code>.dhelix/agents/</code>)와
                <strong>사용자 스코프</strong>(<code>~/.dhelix/agents/</code>)에서 로드됩니다.
              </p>
              <p>
                내장 에이전트 타입도 제공하여, 사용자 정의 없이도 코드 리뷰어, 보안 분석가 등의 미리
                설정된 에이전트를 사용할 수 있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="/agents 아키텍처"
              titleColor="purple"
              chart={`graph TD
  CMD["/agents 명령어"]
  SCAN["scanAgentDirectory()<br/><small>디렉토리 스캔</small>"]
  PROJ[".dhelix/agents/<br/><small>프로젝트 스코프</small>"]
  USER["~/.dhelix/agents/<br/><small>사용자 스코프</small>"]
  PARSE["parseBasicFrontmatter()<br/><small>YAML 메타 파싱</small>"]
  LIST["list<br/><small>전체 에이전트 목록</small>"]
  SHOW["show<br/><small>에이전트 상세</small>"]
  TYPES["types<br/><small>내장 타입 목록</small>"]
  STATUS["status<br/><small>활성 세션</small>"]
  BUILTIN["AGENT_TYPES<br/><small>내장 에이전트 정의</small>"]

  CMD --> LIST
  CMD --> SHOW
  CMD --> TYPES
  CMD --> STATUS
  LIST --> SCAN
  SHOW --> SCAN
  SCAN --> PROJ
  SCAN --> USER
  SCAN --> PARSE
  TYPES --> BUILTIN

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style SCAN fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style PROJ fill:#dcfce7,stroke:#10b981,color:#065f46
  style USER fill:#dcfce7,stroke:#10b981,color:#065f46
  style BUILTIN fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> /agents는 &quot;인사 관리 시스템&quot;입니다. 사내에 어떤
              전문가들이 있는지, 각자의 역할과 권한이 무엇인지, 현재 누가 일하고 있는지를 확인할 수
              있습니다. 에이전트 정의 파일은 각 전문가의 &quot;이력서&quot;에 해당합니다.
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

            {/* AgentFileInfo interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface AgentFileInfo
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              에이전트 정의 파일에서 추출한 메타데이터 인터페이스입니다. 각 에이전트의
              프론트매터에서 파싱된 정보를 담습니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "name",
                  type: "string",
                  required: true,
                  desc: "에이전트 이름 (프론트매터의 name 필드 또는 파일명)",
                },
                { name: "description", type: "string", required: true, desc: "에이전트 설명" },
                {
                  name: "model",
                  type: "string",
                  required: true,
                  desc: '사용할 LLM 모델 (예: "gpt-4o", "inherit"은 상위 설정 상속)',
                },
                {
                  name: "scope",
                  type: '"project" | "user"',
                  required: true,
                  desc: "적용 범위 (project=프로젝트별, user=전역)",
                },
                {
                  name: "filePath",
                  type: "string",
                  required: true,
                  desc: "에이전트 정의 파일의 절대 경로",
                },
                {
                  name: "maxTurns",
                  type: "string",
                  required: true,
                  desc: '최대 대화 턴 수 (설정 없으면 "-")',
                },
                {
                  name: "permissionMode",
                  type: "string",
                  required: true,
                  desc: '권한 모드 ("default", "plan" 등)',
                },
              ]}
            />

            {/* 서브커맨드 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              서브커맨드
            </h3>
            <ParamTable
              params={[
                {
                  name: "/agents",
                  type: "list",
                  required: false,
                  desc: "모든 에이전트 정의 목록 조회 (기본 서브커맨드)",
                },
                {
                  name: "/agents list",
                  type: "list",
                  required: false,
                  desc: "프로젝트 + 사용자 디렉토리의 에이전트 목록 테이블",
                },
                {
                  name: "/agents show <name>",
                  type: "detail",
                  required: false,
                  desc: "특정 에이전트의 상세 정보 + 시스템 프롬프트 표시",
                },
                {
                  name: "/agents types",
                  type: "list",
                  required: false,
                  desc: "내장 에이전트 타입 목록 (타입, 반복 횟수, 도구 수, 설명)",
                },
                {
                  name: "/agents status",
                  type: "info",
                  required: false,
                  desc: "현재 활성 에이전트 세션 상태",
                },
              ]}
            />

            {/* parseBasicFrontmatter */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              parseBasicFrontmatter(content)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              마크다운 파일에서 YAML 스타일 프론트매터를 파싱합니다.
              <code className="text-cyan-600">---</code>로 감싸진 영역에서 key-value 쌍을
              추출합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 에이전트 정의 파일 예시 (.md)"}</span>
              {"\n"}
              <span className="str">---</span>
              {"\n"}
              <span className="prop">name</span>: <span className="str">code-reviewer</span>
              {"\n"}
              <span className="prop">description</span>:{" "}
              <span className="str">코드 리뷰 전문 에이전트</span>
              {"\n"}
              <span className="prop">model</span>: <span className="str">gpt-4o</span>
              {"\n"}
              <span className="prop">max-turns</span>: <span className="num">10</span>
              {"\n"}
              <span className="prop">permission-mode</span>: <span className="str">plan</span>
              {"\n"}
              <span className="str">---</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 아래부터 시스템 프롬프트 내용"}</span>
              {"\n"}
              <span className="str">당신은 코드 리뷰 전문가입니다...</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                프론트매터의 <code className="text-cyan-600">name</code> 필드가 없으면 파일명(확장자
                제외)이 에이전트 이름으로 사용됩니다.
              </li>
              <li>
                <code className="text-cyan-600">model: inherit</code>은 상위 설정(프로젝트 또는
                전역)의 모델 설정을 상속합니다. 기본값이 <code>inherit</code>이므로 명시적으로
                지정하지 않으면 자동으로 상속됩니다.
              </li>
              <li>
                <code className="text-cyan-600">scanAgentDirectory()</code>는 디렉토리가 없어도
                ENOENT 에러를 삼키고 빈 배열을 반환합니다. 에이전트 디렉토리가 없는 프로젝트에서도
                안전합니다.
              </li>
              <li>
                <code className="text-cyan-600">/agents show</code>에서 에이전트를 찾지 못하면
                이름이 유사한 에이전트를 제안합니다 (부분 문자열 매칭).
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
              기본 사용법 &mdash; 에이전트 목록 조회
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              프로젝트와 사용자 디렉토리의 모든 에이전트를 테이블로 표시합니다.
            </p>
            <CodeBlock>
              <span className="str">/agents</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 예시:"}</span>
              {"\n"}
              <span className="cm">{"// Agent Definitions"}</span>
              {"\n"}
              <span className="cm">{"// ===================="}</span>
              {"\n"}
              <span className="cm">{"//   Name              Scope    Model    Description"}</span>
              {"\n"}
              <span className="cm">{"//   -----------------------------------------------"}</span>
              {"\n"}
              <span className="cm">
                {"//   code-reviewer     project  gpt-4o   코드 리뷰 전문 에이전트"}
              </span>
              {"\n"}
              <span className="cm">
                {"//   security-analyst  user     inherit  보안 취약점 분석"}
              </span>
              {"\n"}
              <span className="cm">{"//   2 agent(s) found."}</span>
            </CodeBlock>

            {/* 에이전트 상세 조회 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              에이전트 상세 조회
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              특정 에이전트의 모든 설정과 시스템 프롬프트를 확인합니다.
            </p>
            <CodeBlock>
              <span className="str">/agents show code-reviewer</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 예시:"}</span>
              {"\n"}
              <span className="cm">{"// Agent: code-reviewer"}</span>
              {"\n"}
              <span className="cm">{"// ===================="}</span>
              {"\n"}
              <span className="cm">{"//   Description:     코드 리뷰 전문 에이전트"}</span>
              {"\n"}
              <span className="cm">{"//   Scope:           project"}</span>
              {"\n"}
              <span className="cm">{"//   Model:           gpt-4o"}</span>
              {"\n"}
              <span className="cm">{"//   Max turns:       10"}</span>
              {"\n"}
              <span className="cm">{"//   Permission mode: plan"}</span>
              {"\n"}
              <span className="cm">
                {"//   File:            /path/to/.dhelix/agents/code-reviewer.md"}
              </span>
              {"\n"}
              <span className="cm">{"// System Prompt:"}</span>
              {"\n"}
              <span className="cm">{"//   당신은 코드 리뷰 전문가입니다..."}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 에이전트 이름이 존재하지 않으면 유사한 이름을 자동으로
              제안합니다. 정확한 이름은 <code>/agents list</code>에서 확인하세요.
            </Callout>

            {/* 내장 타입 조회 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 내장 에이전트 타입 조회
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              시스템에 미리 정의된 에이전트 타입을 확인합니다. 커스텀 정의 없이도 이 타입들을 바로
              사용할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="str">/agents types</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 예시:"}</span>
              {"\n"}
              <span className="cm">{"// Built-in Agent Types"}</span>
              {"\n"}
              <span className="cm">{"// ===================="}</span>
              {"\n"}
              <span className="cm">{"//   Type         Max Iters  Tools   Description"}</span>
              {"\n"}
              <span className="cm">{"//   ------------------------------------------------"}</span>
              {"\n"}
              <span className="cm">
                {"//   explore      20         6       코드베이스 탐색 및 분석"}
              </span>
              {"\n"}
              <span className="cm">
                {"//   code-review  15         8       코드 리뷰 및 개선 제안"}
              </span>
              {"\n"}
              <span className="cm">{"//   security     10         5       보안 취약점 분석"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 에이전트 정의 파일을 만들고 싶다면
              <code>.dhelix/agents/</code>(프로젝트용) 또는 <code>~/.dhelix/agents/</code>(전역)에
              .md 파일을 생성하세요. YAML 프론트매터로 메타데이터를, 본문에 시스템 프롬프트를
              작성합니다.
            </Callout>

            <DeepDive title="에이전트 정의 파일 작성법">
              <p className="mb-3">
                에이전트 정의 파일은 YAML 프론트매터와 시스템 프롬프트로 구성됩니다.
              </p>
              <CodeBlock>
                <span className="str">---</span>
                {"\n"}
                <span className="prop">name</span>: <span className="str">my-agent</span>
                {"\n"}
                <span className="prop">description</span>:{" "}
                <span className="str">커스텀 에이전트 설명</span>
                {"\n"}
                <span className="prop">model</span>: <span className="str">gpt-4o</span>
                {"              "}
                <span className="cm">{"# 또는 inherit"}</span>
                {"\n"}
                <span className="prop">max-turns</span>: <span className="num">20</span>
                {"             "}
                <span className="cm">{"# 최대 대화 턴 수"}</span>
                {"\n"}
                <span className="prop">permission-mode</span>: <span className="str">default</span>
                {"  "}
                <span className="cm">{"# default | plan"}</span>
                {"\n"}
                <span className="str">---</span>
                {"\n"}
                {"\n"}
                <span className="cm">{"# 여기부터 시스템 프롬프트"}</span>
                {"\n"}
                <span className="str">당신은 전문적인 ... 역할을 수행합니다.</span>
                {"\n"}
                <span className="str">다음 규칙을 따르세요:</span>
                {"\n"}
                <span className="str">1. ...</span>
                {"\n"}
                <span className="str">2. ...</span>
              </CodeBlock>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600 mt-3">
                <li>
                  <strong>프로젝트 스코프:</strong> <code>.dhelix/agents/my-agent.md</code> &mdash;
                  해당 프로젝트에서만 사용
                </li>
                <li>
                  <strong>사용자 스코프:</strong> <code>~/.dhelix/agents/my-agent.md</code> &mdash;
                  모든 프로젝트에서 사용
                </li>
              </ul>
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
              에이전트 스캔 플로우
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">scanAgentDirectory()</code>는 프로젝트와 사용자
              디렉토리를
              <code className="text-cyan-600">Promise.all</code>로 동시에 스캔하여 병합합니다.
            </p>

            <MermaidDiagram
              title="에이전트 스캔 및 파싱 플로우"
              titleColor="purple"
              chart={`graph TD
  LIST["/agents list"]
  SCAN1["scanAgentDirectory()<br/><small>.dhelix/agents/</small>"]
  SCAN2["scanAgentDirectory()<br/><small>~/.dhelix/agents/</small>"]
  PALL["Promise.all"]
  READ["readdir()<br/><small>.md 파일 필터</small>"]
  PARSE["parseBasicFrontmatter()<br/><small>YAML 메타 추출</small>"]
  MERGE["allAgents<br/><small>병합 + 테이블 포맷</small>"]

  LIST --> PALL
  PALL --> SCAN1
  PALL --> SCAN2
  SCAN1 --> READ
  SCAN2 --> READ
  READ --> PARSE
  PARSE --> MERGE

  style LIST fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style PALL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MERGE fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              프론트매터 파서의 핵심 로직입니다. 첫 줄이 <code className="text-cyan-600">---</code>
              가 아니면 빈 객체를 반환하여 안전하게 처리합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">parseBasicFrontmatter</span>
              (<span className="prop">content</span>: <span className="type">string</span>):{" "}
              <span className="type">Record</span>&lt;<span className="type">string</span>,{" "}
              <span className="type">string</span>&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">lines</span> ={" "}
              <span className="prop">content</span>.<span className="fn">split</span>(
              <span className="str">&quot;\n&quot;</span>);
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">lines</span>[
              <span className="num">0</span>]?.<span className="fn">trim</span>() !=={" "}
              <span className="str">&quot;---&quot;</span>) <span className="kw">return</span>{" "}
              {"{}"};{"\n"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">endIdx</span> ={" "}
              <span className="prop">lines</span>.<span className="fn">indexOf</span>(
              <span className="str">&quot;---&quot;</span>, <span className="num">1</span>);
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">endIdx</span> === -
              <span className="num">1</span>) <span className="kw">return</span> {"{}"};{"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// --- 사이의 줄들에서 key: value 추출"}</span>
              {"\n"}
              {"  "}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">line</span> <span className="kw">of</span>{" "}
              <span className="prop">lines</span>.<span className="fn">slice</span>(
              <span className="num">1</span>, <span className="prop">endIdx</span>)) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">colonIdx</span> ={" "}
              <span className="prop">trimmed</span>.<span className="fn">indexOf</span>(
              <span className="str">&quot;:&quot;</span>);
              {"\n"}
              {"    "}
              <span className="prop">result</span>[<span className="prop">key</span>] ={" "}
              <span className="prop">value</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">result</span>;{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">ENOENT 처리</strong> &mdash; 디렉토리가 없어도
                에러를 삼키고 빈 배열을 반환합니다. 에이전트 디렉토리가 아직 없는 프로젝트에서도
                안전합니다.
              </p>
              <p>
                <strong className="text-gray-900">유사 이름 제안</strong> &mdash; show에서
                에이전트를 못 찾으면 <code>includes()</code>로 부분 매칭하여 후보를 제안합니다.
              </p>
              <p>
                <strong className="text-gray-900">시스템 프롬프트 추출</strong> &mdash; 프론트매터
                종료 <code>---</code> 이후의 모든 텍스트를 시스템 프롬프트로 표시합니다.
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
                &quot;에이전트 파일을 만들었는데 /agents list에 안 나타나요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">다음을 확인하세요:</p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  파일 확장자가 <code>.md</code>인지 확인 (다른 확장자는 무시됨)
                </li>
                <li>
                  파일 위치가 <code>.dhelix/agents/</code> 또는 <code>~/.dhelix/agents/</code>인지
                  확인
                </li>
                <li>파일이 정상적인 텍스트 파일인지 확인 (심볼릭 링크, 디렉토리는 건너뜀)</li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;프론트매터가 파싱되지 않아요 (description이 &apos;no description&apos;으로
                표시)&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                파일의 <strong>첫 줄</strong>이 정확히 <code>---</code>인지 확인하세요. 앞에
                공백이나 BOM(Byte Order Mark)이 있으면 프론트매터로 인식되지 않습니다. 또한 닫는{" "}
                <code>---</code>가 반드시 있어야 합니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;/agents status에 아무것도 안 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                현재 <code>/agents status</code>는 활성 에이전트 세션 추적 기능과 아직 연결되지
                않았습니다. 향후 업데이트에서 실행 중이거나 최근 완료된 에이전트 세션 정보가 표시될
                예정입니다. 에이전트 실행 상태는 <code>/team status</code>로 확인할 수 있습니다.
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
                  name: "subagent-spawner.ts",
                  slug: "subagent-spawner",
                  relation: "sibling",
                  desc: "에이전트 정의를 기반으로 서브에이전트를 실제 생성하고 실행하는 모듈",
                },
                {
                  name: "cmd-team",
                  slug: "cmd-team",
                  relation: "sibling",
                  desc: "/team 명령어 — 여러 에이전트를 병렬로 실행하는 팀 오케스트레이션",
                },
                {
                  name: "tool-agent.ts",
                  slug: "tool-agent",
                  relation: "sibling",
                  desc: "에이전트 도구 — LLM이 서브에이전트를 스폰할 때 사용하는 도구 정의",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
