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

export default function AgentSkillsLoaderPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/subagents/agent-skills-loader.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Agent Skills Loader</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              서브에이전트의 시스템 프롬프트에 스킬 내용을 주입하는 모듈입니다. 4개의 검색 경로를
              우선순위 순으로 탐색하여 스킬 파일을 로드합니다.
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
                <code className="text-cyan-600">agent-skills-loader</code>는 에이전트 정의
                파일(.md)의 프론트매터에서 지정한 스킬 이름 목록을 받아, 해당 스킬 파일을 파일
                시스템에서 찾아 로드합니다. 스킬이란 에이전트에게 특정 분야의 전문 지식을 제공하는
                마크다운 파일로, 예를 들어 <code className="text-cyan-600">python-testing</code>{" "}
                스킬은 pytest 패턴과 모범 사례에 대한 지침을 담고 있습니다.
              </p>
              <p>
                스킬 검색은 4개의 디렉토리를 우선순위 순으로 탐색합니다. 프로젝트 수준 디렉토리가
                사용자 전역 디렉토리보다 먼저 검색되므로, 같은 이름의 스킬이 있을 경우 프로젝트
                스킬이 전역 스킬보다 우선 적용됩니다.
              </p>
              <p>
                로드된 스킬은 <code className="text-cyan-600">buildSkillPromptSection()</code>을
                통해 시스템 프롬프트에 삽입할 수 있는 마크다운 텍스트 형태로 가공됩니다. 어떤
                디렉토리에서도 찾지 못한 스킬은 조용히 건너뛰며 에러를 발생시키지 않습니다.
              </p>
            </div>

            <MermaidDiagram
              title="Agent Skills Loader 아키텍처 위치"
              titleColor="purple"
              chart={`flowchart TB
  DEF["Agent Definition<br/><small>.md 프론트매터</small>"]
  LOADER["AgentSkillsLoader<br/><small>agent-skills-loader.ts</small>"]
  DIR1[".dbcode/commands/<br/><small>프로젝트 명령 (최우선)</small>"]
  DIR2[".dbcode/skills/<br/><small>프로젝트 스킬</small>"]
  DIR3["~/.dbcode/commands/<br/><small>사용자 전역 명령</small>"]
  DIR4["~/.dbcode/skills/<br/><small>사용자 전역 스킬</small>"]
  SKILL["LoadedSkill[]<br/><small>name + content</small>"]
  PROMPT["buildSkillPromptSection()<br/><small>마크다운 텍스트 변환</small>"]
  SYS["서브에이전트 시스템 프롬프트"]

  DEF -->|"skills: [name1, name2]"| LOADER
  LOADER --> DIR1
  LOADER --> DIR2
  LOADER --> DIR3
  LOADER --> DIR4
  DIR1 & DIR2 & DIR3 & DIR4 --> SKILL
  SKILL --> PROMPT
  PROMPT --> SYS

  style LOADER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style PROMPT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style DEF fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style SKILL fill:#dcfce7,stroke:#10b981,color:#1e293b
  style SYS fill:#e0e7ff,stroke:#3b82f6,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 도서관 사서를 떠올리세요. 에이전트가 스킬 이름 목록을 건네면,
              스킬 로더가 여러 서가(검색 경로)를 순서대로 훑어 해당 책(스킬 파일)을 찾아 가져옵니다.
              프로젝트 서가를 먼저 확인하고, 없으면 전역 서가를 확인합니다.
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

            {/* LoadedSkill interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface LoadedSkill
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              스킬 파일에서 로드된 데이터를 담는 불변 인터페이스입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "name",
                  type: "string",
                  required: true,
                  desc: "스킬의 표시 이름 (스킬 파일 프론트매터의 name 필드)",
                },
                {
                  name: "content",
                  type: "string",
                  required: true,
                  desc: "스킬 본문 내용 (마크다운 텍스트, 프론트매터 제외)",
                },
              ]}
            />

            {/* loadSkillsForAgent */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              loadSkillsForAgent(skillNames, workingDirectory)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              여러 스킬 이름을 받아 4개의 검색 경로에서 순서대로 탐색하여 로드합니다. 찾지 못한
              스킬은 조용히 건너뜁니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span>{" "}
              <span className="fn">loadSkillsForAgent</span>({"\n"}
              {"  "}
              <span className="prop">skillNames</span>:{" "}
              <span className="type">readonly string[]</span>,{"\n"}
              {"  "}
              <span className="prop">workingDirectory</span>: <span className="type">string</span>,
              {"\n"}): <span className="type">Promise&lt;readonly LoadedSkill[]&gt;</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "skillNames",
                  type: "readonly string[]",
                  required: true,
                  desc: '로드할 스킬 이름 배열 (확장자 제외, 예: ["python-testing", "security"])',
                },
                {
                  name: "workingDirectory",
                  type: "string",
                  required: true,
                  desc: "프로젝트 작업 디렉토리 (프로젝트 수준 스킬 검색의 기준 경로)",
                },
              ]}
            />

            {/* buildSkillPromptSection */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              buildSkillPromptSection(skills)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              로드된 스킬 목록을 시스템 프롬프트에 삽입할 수 있는 마크다운 텍스트로 변환합니다. 각
              스킬은 <code className="text-cyan-600">## {"{스킬이름}"}</code> 헤더 아래에 내용이
              배치됩니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span>{" "}
              <span className="fn">buildSkillPromptSection</span>({"\n"}
              {"  "}
              <span className="prop">skills</span>:{" "}
              <span className="type">readonly LoadedSkill[]</span>,{"\n"}
              {"  "}): <span className="type">string</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "skills",
                  type: "readonly LoadedSkill[]",
                  required: true,
                  desc: "loadSkillsForAgent()가 반환한 로드된 스킬 배열",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">loadSkillsForAgent</code>는 스킬 이름에
                확장자(.md)를 자동으로 붙여 검색합니다. 이름에 확장자를 포함하지 마세요.
              </li>
              <li>
                찾지 못한 스킬은 에러 없이 건너뜁니다. 반환 배열의 길이가 입력 이름 배열보다 작을 수
                있습니다.
              </li>
              <li>
                동일한 이름의 스킬이 여러 검색 경로에 있을 경우 가장 우선순위가 높은 경로(프로젝트
                commands)의 스킬만 로드됩니다.
              </li>
              <li>
                <code className="text-cyan-600">buildSkillPromptSection</code>은 스킬이 없으면 빈
                문자열을 반환합니다. 결과를 시스템 프롬프트에 추가하기 전에 빈 문자열 여부를
                확인하지 않아도 됩니다.
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
              기본 사용법 &mdash; 스킬 로드 후 시스템 프롬프트 주입
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              에이전트 정의에서 파싱한 스킬 이름 목록을 받아 시스템 프롬프트에 주입하는 기본
              패턴입니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"}{" "}
              <span className="prop">loadSkillsForAgent</span>,{" "}
              <span className="prop">buildSkillPromptSection</span> {"}"}{" "}
              <span className="kw">from</span>{" "}
              <span className="str">&quot;./agent-skills-loader.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">
                {"// 에이전트 정의 프론트매터: skills: [python-testing, security]"}
              </span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">skillNames</span> = [
              <span className="str">&quot;python-testing&quot;</span>,{" "}
              <span className="str">&quot;security&quot;</span>];{"\n"}
              {"\n"}
              <span className="cm">{"// 1. 스킬 로드 (파일 시스템 탐색)"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">skills</span> ={" "}
              <span className="kw">await</span> <span className="fn">loadSkillsForAgent</span>(
              <span className="prop">skillNames</span>, <span className="prop">process.cwd()</span>
              );{"\n"}
              {"\n"}
              <span className="cm">{"// 2. 시스템 프롬프트용 마크다운 생성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">skillSection</span> ={" "}
              <span className="fn">buildSkillPromptSection</span>(
              <span className="prop">skills</span>);{"\n"}
              {"\n"}
              <span className="cm">{"// 3. 기존 시스템 프롬프트에 추가"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">systemPrompt</span> ={" "}
              <span className="str">
                `${"{"}
                <span className="prop">basePrompt</span>
                {"}"}\n\n${"{"}
                <span className="prop">skillSection</span>
                {"}"}`
              </span>
              ;
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>loadSkillsForAgent</code>는 비동기 함수입니다.{" "}
              <code>await</code>를 반드시 사용하세요. 또한 반환 배열의 길이가 입력보다 작을 수
              있습니다 — 찾지 못한 스킬은 조용히 제외됩니다.
            </Callout>

            {/* 고급 사용법: 프로젝트 스킬 우선순위 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 프로젝트 스킬로 전역 스킬 오버라이드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              같은 이름의 스킬을 프로젝트 레벨에서 재정의하여 프로젝트 전용 지침을 우선 적용하는
              패턴입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 파일 구조 예시:"}</span>
              {"\n"}
              <span className="cm">{"// .dbcode/skills/python-testing.md  ← 프로젝트 전용"}</span>
              {"\n"}
              <span className="cm">{"// ~/.dbcode/skills/python-testing.md ← 전역 기본값"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 항상 프로젝트 .dbcode/skills/의 스킬이 우선 로드됨"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">skills</span> ={" "}
              <span className="kw">await</span> <span className="fn">loadSkillsForAgent</span>([
              <span className="str">&quot;python-testing&quot;</span>],{" "}
              <span className="prop">cwd</span>);
              {"\n"}
              <span className="cm">
                {"// → skills[0].content 는 .dbcode/skills/python-testing.md 내용"}
              </span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 스킬 파일이 없으면 오류 없이 건너뜁니다. 팀원에게 스킬 파일을
              강제하지 않고도 스킬 기능을 안전하게 선택적으로 사용할 수 있습니다.
            </Callout>

            <DeepDive title="스킬 검색 경로 상세 — 4단계 우선순위">
              <p className="mb-3">
                스킬은 아래 4개 경로를 순서대로 탐색합니다. 첫 번째로 발견된 스킬만 사용합니다:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-600">
                <li>
                  <code className="text-cyan-600">
                    {"{"}
                    <span>workingDirectory</span>
                    {"}"}
                  </code>
                  <code className="text-cyan-600">/.dbcode/commands/</code> — 프로젝트 명령 디렉토리
                  (최우선)
                </li>
                <li>
                  <code className="text-cyan-600">
                    {"{"}
                    <span>workingDirectory</span>
                    {"}"}
                  </code>
                  <code className="text-cyan-600">/.dbcode/skills/</code> — 프로젝트 스킬 디렉토리
                </li>
                <li>
                  <code className="text-cyan-600">~/.dbcode/commands/</code> — 사용자 전역 명령
                  디렉토리
                </li>
                <li>
                  <code className="text-cyan-600">~/.dbcode/skills/</code> — 사용자 전역 스킬
                  디렉토리 (최하위)
                </li>
              </ol>
              <p className="mt-3 text-amber-600">
                commands 디렉토리가 skills 디렉토리보다 우선합니다. 스킬을 명령 디렉토리에 두면
                자동으로 더 높은 우선순위를 가집니다.
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
              스킬 탐색 파이프라인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              스킬 로드는 3단계 파이프라인으로 처리됩니다: 경로 계산 → 순차 탐색 → 결과 수집.
            </p>

            <MermaidDiagram
              title="스킬 로드 파이프라인"
              titleColor="purple"
              chart={`graph TD
  INPUT["loadSkillsForAgent(skillNames, cwd)<br/><small>입력: 스킬 이름 배열 + 작업 디렉토리</small>"]
  EARLY["빈 배열?<br/><small>즉시 반환 최적화</small>"]
  DIRS["getSkillDirectories(cwd)<br/><small>4개 검색 경로 계산</small>"]
  LOOP["각 스킬 이름 순회"]
  FIND["findAndLoadSkill(name, dirs)<br/><small>4개 경로 순차 탐색</small>"]
  LOAD["loadSkill(path)<br/><small>skills/loader.ts</small>"]
  HIT["LoadedSkill 반환"]
  MISS["undefined — 다음 경로"]
  COLLECT["결과 수집<br/><small>찾은 스킬만 배열에 추가</small>"]
  OUTPUT["readonly LoadedSkill[]"]

  INPUT --> EARLY
  EARLY -->|"비어있음"| OUTPUT
  EARLY -->|"이름 있음"| DIRS
  DIRS --> LOOP
  LOOP --> FIND
  FIND --> LOAD
  LOAD -->|"성공"| HIT
  LOAD -->|"파일 없음"| MISS
  MISS -->|"다음 경로 시도"| FIND
  HIT --> COLLECT
  COLLECT -->|"모든 이름 완료"| OUTPUT

  style INPUT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style FIND fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style LOAD fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style HIT fill:#dcfce7,stroke:#10b981,color:#1e293b
  style OUTPUT fill:#dcfce7,stroke:#10b981,color:#1e293b
  style MISS fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석 &mdash; buildSkillPromptSection
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              로드된 스킬 배열을 &quot;# Preloaded Skills&quot; 섹션으로 변환하는 핵심 로직입니다.
            </p>
            <CodeBlock>
              <span className="fn">buildSkillPromptSection</span>(
              <span className="prop">skills</span>:{" "}
              <span className="type">readonly LoadedSkill[]</span>):{" "}
              <span className="type">string</span> {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 스킬이 없으면 빈 문자열 반환"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">skills</span>.
              <span className="prop">length</span> === <span className="num">0</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">return</span> <span className="str">&quot;&quot;</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [2] 루트 헤더 생성"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">lines</span> = [
              <span className="str">&quot;# Preloaded Skills&quot;</span>,{" "}
              <span className="str">&quot;&quot;</span>];
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 각 스킬을 ## 헤더 + 내용으로 추가"}</span>
              {"\n"}
              {"  "}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">skill</span> <span className="kw">of</span>{" "}
              <span className="prop">skills</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="prop">lines</span>.<span className="fn">push</span>(
              <span className="str">
                `## ${"{"}skill.name{"}"}`
              </span>
              , <span className="str">&quot;&quot;</span>);{"\n"}
              {"    "}
              <span className="prop">lines</span>.<span className="fn">push</span>(
              <span className="prop">skill</span>.<span className="prop">content</span>);{"\n"}
              {"    "}
              <span className="prop">lines</span>.<span className="fn">push</span>(
              <span className="str">&quot;&quot;</span>);{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [4] 줄 배열을 단일 문자열로 결합"}</span>
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">lines</span>.
              <span className="fn">join</span>(<span className="str">&quot;\n&quot;</span>);{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 빈 배열에 대해 빈 문자열을
                반환합니다. 시스템 프롬프트에 불필요한 빈 섹션이 추가되지 않습니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong>{" "}
                <code className="text-cyan-600"># Preloaded Skills</code> 루트 헤더로 섹션 시작을
                표시합니다. LLM이 스킬 컨텍스트를 명확히 인식할 수 있습니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 각 스킬에{" "}
                <code className="text-cyan-600">## {"{스킬이름}"}</code> 헤더를 붙여 구분합니다.
                스킬 이름은 파일 프론트매터의 name 필드에서 가져옵니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> 줄 배열을 개행 문자로 결합하여 최종
                마크다운 문자열을 반환합니다.
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
                &quot;스킬을 정의했는데 에이전트가 스킬 내용을 모르는 것 같아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                4개의 검색 경로가 올바른지 확인하세요:{" "}
                <code className="text-cyan-600">.dbcode/commands/</code>,{" "}
                <code className="text-cyan-600">.dbcode/skills/</code>,{" "}
                <code className="text-cyan-600">~/.dbcode/commands/</code>,{" "}
                <code className="text-cyan-600">~/.dbcode/skills/</code>. 파일명이{" "}
                <code className="text-cyan-600">{"{스킬이름}.md"}</code> 형태인지(확장자 .md 포함)
                확인하세요. 또한 스킬 파일의 프론트매터에{" "}
                <code className="text-cyan-600">name</code> 필드가 있는지 확인하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;프로젝트 스킬 대신 전역 스킬이 로드돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">loadSkillsForAgent</code>에 전달하는{" "}
                <code className="text-cyan-600">workingDirectory</code>가 실제 프로젝트 루트를
                가리키는지 확인하세요. <code className="text-cyan-600">process.cwd()</code>가 올바른
                디렉토리인지 점검하거나, 절대 경로를 직접 전달해 보세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;buildSkillPromptSection이 빈 문자열을 반환해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">loadSkillsForAgent</code>가 반환한 배열이 비어있는지
                확인하세요. 모든 스킬 이름에 대해 파일을 찾지 못하면 빈 배열이 반환되며,
                <code className="text-cyan-600">buildSkillPromptSection</code>은 빈 문자열을
                반환합니다. 스킬 파일 경로와 파일명을 먼저 점검하세요.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;스킬 이름에 확장자를 붙이면 안 되나요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                스킬 이름은 확장자 없이 전달해야 합니다. 예:{" "}
                <code className="text-cyan-600">&quot;python-testing&quot;</code> (정상),{" "}
                <code className="text-cyan-600">&quot;python-testing.md&quot;</code> (오류).
                내부적으로 <code className="text-cyan-600">.md</code> 확장자를 자동으로 붙여 파일을
                검색합니다. 확장자를 포함하면{" "}
                <code className="text-cyan-600">python-testing.md.md</code> 파일을 찾으려 하여 항상
                실패합니다.
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
                  name: "definition-loader.ts",
                  slug: "definition-loader",
                  relation: "sibling",
                  desc: "에이전트 정의 파일(.md)을 파싱하고 로드하는 모듈 — 프론트매터에서 skills 목록을 읽어 이 모듈에 전달",
                },
                {
                  name: "agent-hooks.ts",
                  slug: "agent-hooks",
                  relation: "sibling",
                  desc: "에이전트 정의의 훅(Hook)을 훅 러너 형식으로 변환하는 모듈 — definition-loader와 함께 사용",
                },
                {
                  name: "spawner.ts",
                  slug: "subagent-spawner",
                  relation: "parent",
                  desc: "서브에이전트를 생성하고 실행하는 오케스트레이터 — loadSkillsForAgent를 호출하여 에이전트 시스템 프롬프트에 스킬 주입",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}
