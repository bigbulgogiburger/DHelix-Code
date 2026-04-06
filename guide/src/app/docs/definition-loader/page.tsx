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

export default function DefinitionLoaderPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/subagents/definition-loader.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Definition Loader</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              마크다운(.md) 파일에서 에이전트 정의를 파싱하고 로드하는 모듈입니다.
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
                <code className="text-cyan-600">definition-loader</code>는 서브에이전트의 역할, 도구
                권한, 시스템 프롬프트 등을 마크다운 형식으로 기술한 에이전트 정의 파일을 파싱합니다.
                파일의 YAML 프론트매터에서 메타데이터를 추출하고, 본문은 시스템 프롬프트로
                사용됩니다.
              </p>
              <p>
                로드 우선순위는 두 단계입니다. 먼저 사용자 전역 디렉토리(
                <code className="text-cyan-600">~/.dhelix/agents/*.md</code>)에서 로드하고, 그 다음
                프로젝트 단위 디렉토리(<code className="text-cyan-600">.dhelix/agents/*.md</code>
                )에서 로드합니다. 같은 이름의 에이전트가 양쪽에 있으면 프로젝트 단위가 우선합니다.
              </p>
              <p>
                프론트매터의 케밥 케이스(<code className="text-cyan-600">max-turns</code>)는 카멜
                케이스(<code className="text-cyan-600">maxTurns</code>)로 자동 변환되며, Zod
                스키마로 유효성을 검증한 뒤 <code className="text-cyan-600">AgentDefinition</code>{" "}
                객체를 반환합니다.
              </p>
            </div>

            <MermaidDiagram
              title="Definition Loader 로드 흐름"
              titleColor="purple"
              chart={`graph TD
  USER_DIR["~/.dhelix/agents/<br/><small>사용자 전역 (낮은 우선순위)</small>"]
  PROJ_DIR[".dhelix/agents/<br/><small>프로젝트 단위 (높은 우선순위)</small>"]
  LOADER["loadAgentDefinitions()<br/><small>definition-loader.ts</small>"]
  PARSE["parseAgentFile()<br/><small>프론트매터 + 본문 분리</small>"]
  ZOD["Zod Schema<br/><small>agentDefinitionSchema</small>"]
  RESULT["Map&lt;name, AgentDefinition&gt;"]

  USER_DIR -->|"*.md 파일"| LOADER
  PROJ_DIR -->|"*.md 파일 (덮어쓰기)"| LOADER
  LOADER --> PARSE
  PARSE --> ZOD
  ZOD -->|"유효성 통과"| RESULT

  style LOADER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PARSE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style ZOD fill:#dcfce7,stroke:#10b981,color:#1e293b
  style RESULT fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style USER_DIR fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style PROJ_DIR fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 채용 공고 양식을 떠올리세요. 상단에 역할명, 필요 기술, 경력
              요건(프론트매터)을 적고, 아래에 상세 직무 기술서(시스템 프롬프트)를 작성합니다. 이
              모듈은 그 양식을 읽어 구조화된 데이터로 변환하는 파서입니다.
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

            {/* parseYamlFrontmatter */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              parseYamlFrontmatter(content)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              마크다운 파일에서 YAML 프론트매터(&quot;---&quot;로 감싸진 메타데이터)와 본문을
              분리합니다. 프론트매터가 없으면 빈 객체와 전체 텍스트를 본문으로 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">parseYamlFrontmatter</span>(
              <span className="prop">content</span>: <span className="type">string</span>): {"{"}
              {"\n"}
              {"  "}
              <span className="kw">readonly</span> <span className="prop">frontmatter</span>:{" "}
              <span className="type">Record</span>&lt;<span className="type">string</span>,{" "}
              <span className="type">unknown</span>&gt;;
              {"\n"}
              {"  "}
              <span className="kw">readonly</span> <span className="prop">body</span>:{" "}
              <span className="type">string</span>;{"\n"}
              {"}"}
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "content",
                  type: "string",
                  required: true,
                  desc: "마크다운 파일 전체 내용",
                },
              ]}
            />

            {/* parseAgentFile */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              parseAgentFile(content, source, filePath?)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              단일 에이전트 정의 파일을 파싱합니다. 프론트매터를 추출하고 Zod 스키마로 유효성을
              검증한 뒤<code className="text-cyan-600">AgentDefinition</code> 객체를 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">parseAgentFile</span>({"\n"}
              {"  "}
              <span className="prop">content</span>: <span className="type">string</span>,{"\n"}
              {"  "}
              <span className="prop">source</span>:{" "}
              <span className="type">AgentDefinitionSource</span>,{"\n"}
              {"  "}
              <span className="prop">filePath</span>?: <span className="type">string</span>,{"\n"}):{" "}
              <span className="type">AgentDefinition</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "content",
                  type: "string",
                  required: true,
                  desc: "에이전트 정의 파일의 전체 내용",
                },
                {
                  name: "source",
                  type: '"project" | "user" | "cli"',
                  required: true,
                  desc: "정의가 로드된 출처",
                },
                {
                  name: "filePath",
                  type: "string | undefined",
                  required: false,
                  desc: "파일 경로 (에러 메시지용)",
                },
              ]}
            />

            {/* loadAgentDefinitions */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              loadAgentDefinitions(workingDirectory)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              모든 설정 디렉토리에서 에이전트 정의를 로드합니다. 사용자 전역 &rarr; 프로젝트 단위
              순서로 로드하며, 같은 이름이면 프로젝트 단위가 덮어씁니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span>{" "}
              <span className="fn">loadAgentDefinitions</span>({"\n"}
              {"  "}
              <span className="prop">workingDirectory</span>: <span className="type">string</span>,
              {"\n"}): <span className="type">Promise</span>&lt;<span className="type">Map</span>
              &lt;<span className="type">string</span>,{" "}
              <span className="type">AgentDefinition</span>&gt;&gt;
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "workingDirectory",
                  type: "string",
                  required: true,
                  desc: "프로젝트 작업 디렉토리 경로",
                },
              ]}
            />

            {/* AgentDefinitionLoadError */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class AgentDefinitionLoadError
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              에이전트 정의 로딩 중 발생하는 에러 클래스입니다.{" "}
              <code className="text-cyan-600">BaseError</code>를 확장하며 에러 코드{" "}
              <code className="text-cyan-600">&quot;AGENT_DEFINITION_LOAD_ERROR&quot;</code>를
              사용합니다.
            </p>
            <CodeBlock>
              <span className="kw">class</span>{" "}
              <span className="type">AgentDefinitionLoadError</span>{" "}
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

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                프론트매터 파서는 <strong>평탄한(flat) key: value 구조만</strong> 지원합니다. 중첩
                YAML(nested objects)은 파싱되지 않습니다.
              </li>
              <li>
                케밥 케이스(<code className="text-cyan-600">max-turns</code>)는 자동으로 카멜
                케이스(<code className="text-cyan-600">maxTurns</code>)로 변환됩니다. 원래 키
                이름으로는 접근할 수 없습니다.
              </li>
              <li>
                개별 파일 파싱 실패는 치명적이지 않습니다. 실패한 파일은 조용히 건너뛰고 나머지
                파일만 반환합니다.
              </li>
              <li>
                디렉토리가 존재하지 않으면 빈 배열을 반환합니다 (에러 아님). 에이전트 정의 로딩
                실패가 전체 앱을 멈추지 않도록 설계되었습니다.
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
              기본 사용법 &mdash; 에이전트 정의 로드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              프로젝트 디렉토리를 기준으로 모든 에이전트 정의를 로드하는 기본 패턴입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 모든 에이전트 정의를 로드"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">definitions</span> ={" "}
              <span className="kw">await</span> <span className="fn">loadAgentDefinitions</span>(
              <span className="str">&quot;/path/to/project&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 특정 에이전트 정의 조회"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">reviewer</span> ={" "}
              <span className="prop">definitions</span>.<span className="fn">get</span>(
              <span className="str">&quot;code-reviewer&quot;</span>);
              {"\n"}
              <span className="kw">if</span> (<span className="prop">reviewer</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">reviewer</span>.<span className="prop">frontmatter</span>.
              <span className="prop">name</span>);
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">reviewer</span>.<span className="prop">systemPrompt</span>);
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">reviewer</span>.<span className="prop">source</span>);{" "}
              <span className="cm">{"// 'project' 또는 'user'"}</span>
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 에이전트 정의 파일에 프론트매터가 없으면
              <code>AgentDefinitionLoadError</code>가 발생합니다. 최소한 <code>name</code>과
              <code>description</code> 필드가 프론트매터에 포함되어야 합니다.
            </Callout>

            {/* 에이전트 정의 파일 형식 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              에이전트 정의 파일 형식
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              에이전트 정의 파일은 YAML 프론트매터와 마크다운 본문으로 구성됩니다. 프론트매터에
              메타데이터를, 본문에 시스템 프롬프트를 작성합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"---"}</span>
              {"\n"}
              <span className="prop">name</span>: <span className="str">code-reviewer</span>
              {"\n"}
              <span className="prop">description</span>:{" "}
              <span className="str">코드 리뷰 에이전트</span>
              {"\n"}
              <span className="prop">tools</span>:{" "}
              <span className="str">[file_read, grep_search]</span>
              {"\n"}
              <span className="prop">max-turns</span>: <span className="num">15</span>
              {"\n"}
              <span className="cm">{"---"}</span>
              {"\n"}
              <span className="cm">{"# 시스템 프롬프트"}</span>
              {"\n"}당신은 코드 리뷰 전문가입니다.
              {"\n"}코드 품질, 보안, 성능을 중점적으로 검토합니다...
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code className="text-cyan-600">max-turns</code>처럼 케밥
              케이스로 쓰면 자동으로 <code className="text-cyan-600">maxTurns</code>로 변환됩니다.
              프론트매터에서는 어느 형식을 써도 동일하게 동작합니다.
            </Callout>

            {/* 고급 사용법: 직접 파싱 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 단일 파일 직접 파싱
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">parseAgentFile()</code>을 사용하면 개별 파일을 직접
              파싱할 수 있습니다. CLI에서 인라인으로 에이전트를 정의할 때 유용합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">content</span> ={" "}
              <span className="str">
                &quot;---\nname: quick-agent\ndescription: 빠른 작업용\n---\n빠르게
                처리하세요.&quot;
              </span>
              ;{"\n"}
              <span className="kw">const</span> <span className="prop">definition</span> ={" "}
              <span className="fn">parseAgentFile</span>(<span className="prop">content</span>,{" "}
              <span className="str">&quot;cli&quot;</span>);
              {"\n"}
              <span className="cm">{"// definition.frontmatter.name === 'quick-agent'"}</span>
              {"\n"}
              <span className="cm">{"// definition.systemPrompt === '빠르게 처리하세요.'"}</span>
            </CodeBlock>

            <DeepDive title="프론트매터 값 파싱 규칙">
              <p className="mb-3">
                <code className="text-cyan-600">parseValue()</code> 함수는 다양한 YAML 값 타입을
                JavaScript로 변환합니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <code>&quot;true&quot;</code> / <code>&quot;false&quot;</code> &rarr; boolean
                </li>
                <li>
                  <code>&quot;null&quot;</code> / <code>&quot;~&quot;</code> &rarr; null
                </li>
                <li>
                  <code>&quot;42&quot;</code>, <code>&quot;3.14&quot;</code> &rarr; number
                </li>
                <li>
                  <code>&quot;[a, b, c]&quot;</code> &rarr; string[] (인라인 배열)
                </li>
                <li>따옴표 문자열 &rarr; 따옴표 제거된 string</li>
                <li>그 외 &rarr; 일반 string</li>
              </ul>
              <p className="mt-3 text-amber-600">
                중첩 객체나 멀티라인 YAML 문법은 지원하지 않습니다. 복잡한 구조가 필요하면 JSON
                문자열로 값을 전달하세요.
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
              로드 우선순위 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              에이전트 정의는 두 디렉토리에서 순차적으로 로드됩니다. 나중에 로드되는 프로젝트 단위
              정의가 같은 이름의 사용자 전역 정의를 덮어씁니다.
            </p>

            <MermaidDiagram
              title="loadAgentDefinitions 우선순위"
              titleColor="purple"
              chart={`graph TD
  START(("시작")) --> STEP1["1. ~/.dhelix/agents/ 로드<br/><small>사용자 전역 — 낮은 우선순위</small>"]
  STEP1 -->|"Map에 저장"| MAP["Map&lt;name, def&gt;"]
  MAP --> STEP2["2. .dhelix/agents/ 로드<br/><small>프로젝트 단위 — 높은 우선순위</small>"]
  STEP2 -->|"같은 name이면 덮어쓰기"| MAP2["최종 Map"]
  MAP2 --> END(("반환"))

  ERR1["디렉토리 미존재"] -.->|"빈 배열 반환"| STEP1
  ERR2["파일 파싱 실패"] -.->|"건너뛰기"| STEP2

  style STEP1 fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style STEP2 fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style MAP fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style MAP2 fill:#dcfce7,stroke:#10b981,color:#1e293b
  style ERR1 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ERR2 fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석 &mdash; parseAgentFile
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              에이전트 정의 파일을 파싱하는 3단계 프로세스입니다.
            </p>
            <CodeBlock>
              <span className="fn">parseAgentFile</span>(<span className="prop">content</span>,{" "}
              <span className="prop">source</span>, <span className="prop">filePath</span>):{" "}
              <span className="type">AgentDefinition</span> {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 프론트매터와 본문 분리"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> {"{"} <span className="prop">frontmatter</span>,{" "}
              <span className="prop">body</span> {"}"} ={" "}
              <span className="fn">parseYamlFrontmatter</span>(<span className="prop">content</span>
              );
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [2] 프론트매터가 비어있으면 에러"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="fn">Object</span>.
              <span className="fn">keys</span>(<span className="prop">frontmatter</span>).
              <span className="prop">length</span> === <span className="num">0</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">throw new</span>{" "}
              <span className="fn">AgentDefinitionLoadError</span>(
              <span className="str">&quot;Agent file missing frontmatter&quot;</span>);
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] Zod 스키마로 유효성 검증"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">parseResult</span> ={" "}
              <span className="prop">agentDefinitionSchema</span>.
              <span className="fn">safeParse</span>(<span className="prop">frontmatter</span>);
              {"\n"}
              {"  "}
              <span className="kw">if</span> (!<span className="prop">parseResult</span>.
              <span className="prop">success</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">throw new</span>{" "}
              <span className="fn">AgentDefinitionLoadError</span>(
              <span className="str">&quot;Invalid agent frontmatter&quot;</span>);
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> {"{"} <span className="prop">frontmatter</span>:{" "}
              <span className="prop">parseResult</span>.<span className="prop">data</span>,{" "}
              <span className="prop">systemPrompt</span>: <span className="prop">body</span>,{" "}
              <span className="prop">source</span>, <span className="prop">filePath</span> {"}"};
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> &quot;---&quot; 구분자로 프론트매터와
                본문을 분리합니다. 첫 줄이 &quot;---&quot;가 아니면 프론트매터 없음으로 처리합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 프론트매터가 완전히 비어있으면 에러를
                발생시킵니다. 최소한 name과 description이 필요합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> Zod 스키마로 프론트매터 필드의 타입과
                필수 여부를 검증합니다. 실패하면 상세한 이슈 목록과 함께 에러를 발생시킵니다.
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
                &quot;에이전트 정의 파일을 만들었는데 인식되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">다음을 확인하세요:</p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  파일 확장자가 <code className="text-cyan-600">.md</code>인지 확인하세요.
                </li>
                <li>
                  파일이 <code className="text-cyan-600">.dhelix/agents/</code> 또는{" "}
                  <code className="text-cyan-600">~/.dhelix/agents/</code> 디렉토리에 있는지
                  확인하세요.
                </li>
                <li>
                  파일 첫 줄이 정확히 <code className="text-cyan-600">---</code>로 시작하는지
                  확인하세요 (공백 없이).
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Invalid agent frontmatter 에러가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                프론트매터의 필수 필드(<code className="text-cyan-600">name</code>,
                <code className="text-cyan-600">description</code>)가 빠져있거나, 값의 타입이 Zod
                스키마와 맞지 않을 수 있습니다. 에러 메시지에 포함된 issues를 확인하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;프로젝트 에이전트가 전역 에이전트를 덮어쓰지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                덮어쓰기는 <code className="text-cyan-600">name</code> 필드 기준입니다. 파일 이름이
                같더라도 프론트매터의 <code className="text-cyan-600">name</code>이 다르면 별개의
                에이전트로 취급됩니다. 양쪽 파일의 <code className="text-cyan-600">name</code>{" "}
                필드가 동일한지 확인하세요.
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
                  name: "agent-hooks.ts",
                  slug: "agent-hooks",
                  relation: "sibling",
                  desc: "에이전트 정의의 훅 설정을 기존 훅 시스템 형식으로 변환하는 모듈",
                },
                {
                  name: "agent-memory.ts",
                  slug: "agent-memory-sub",
                  relation: "sibling",
                  desc: "서브에이전트의 영속적 메모리를 관리하는 모듈",
                },
                {
                  name: "config-loader.ts",
                  slug: "config-loader",
                  relation: "sibling",
                  desc: "5-Layer 설정 병합 시스템 — 에이전트 정의도 설정의 일부",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
